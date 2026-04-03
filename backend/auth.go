package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type authContextKey string

const userIDContextKey authContextKey = "auth.userId"
const userRoleContextKey authContextKey = "auth.userRole"
const authUserContextKey authContextKey = "auth.user"

type authClaims struct {
	UserID         string `json:"userId"`
	Email          string `json:"email"`
	Role           string `json:"role"`
	SessionVersion int64  `json:"sessionVersion"`
	jwt.RegisteredClaims
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token string         `json:"token"`
	User  authUserPublic `json:"user"`
}

type signUpResponse struct {
	Token string         `json:"token"`
	User  authUserPublic `json:"user"`
}

type authUserPublic struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

func getJWTSecret() []byte {
	secret := strings.TrimSpace(os.Getenv("JWT_SECRET"))
	if secret == "" {
		secret = "dev-only-change-me"
	}
	return []byte(secret)
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeUserDefaults(user *User) {
	if strings.TrimSpace(user.Role) == "" {
		user.Role = "user"
	}
	if strings.TrimSpace(user.Status) == "" {
		user.Status = "verified"
	}
	if user.SessionVersion <= 0 {
		user.SessionVersion = 1
	}
}

func createToken(user User) (string, error) {
	now := time.Now()
	claims := authClaims{
		UserID:         user.ID.Hex(),
		Email:          user.Email,
		Role:           user.Role,
		SessionVersion: user.SessionVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID.Hex(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(7 * 24 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(getJWTSecret())
}

func parseBearerToken(header string) string {
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rawToken := parseBearerToken(r.Header.Get("Authorization"))
		if rawToken == "" {
			writeError(w, http.StatusUnauthorized, "authentication required")
			return
		}

		parsed, err := jwt.ParseWithClaims(rawToken, &authClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, errors.New("unexpected signing method")
			}
			return getJWTSecret(), nil
		})
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}

		claims, ok := parsed.Claims.(*authClaims)
		if !ok || !parsed.Valid || strings.TrimSpace(claims.UserID) == "" {
			writeError(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}

		ctxTimeout, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		oid, err := primitive.ObjectIDFromHex(claims.UserID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}

		var user User
		if err := db.Collection("users").FindOne(ctxTimeout, bson.M{"_id": oid}).Decode(&user); err != nil {
			writeError(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}
		normalizeUserDefaults(&user)

		if user.SessionVersion != claims.SessionVersion {
			writeError(w, http.StatusUnauthorized, "session has been invalidated")
			return
		}
		if user.Status == "suspended" {
			writeError(w, http.StatusForbidden, "Your account has been suspended. Contact support.")
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, claims.UserID)
		ctx = context.WithValue(ctx, userRoleContextKey, strings.TrimSpace(claims.Role))
		ctx = context.WithValue(ctx, authUserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func userIDFromContext(ctx context.Context) string {
	uid, _ := ctx.Value(userIDContextKey).(string)
	return strings.TrimSpace(uid)
}

func userRoleFromContext(ctx context.Context) string {
	role, _ := ctx.Value(userRoleContextKey).(string)
	return strings.TrimSpace(role)
}

func authUserFromContext(ctx context.Context) *User {
	user, _ := ctx.Value(authUserContextKey).(*User)
	return user
}

func signUp(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}

	email := normalizeEmail(req.Email)
	password := strings.TrimSpace(req.Password)

	if email == "" || password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	if !strings.Contains(email, "@") {
		writeError(w, http.StatusBadRequest, "please enter a valid email")
		return
	}
	if len(password) < 8 {
		writeError(w, http.StatusBadRequest, "password must be at least 8 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create account")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	users := db.Collection("users")
	if err := users.FindOne(ctx, bson.M{"email": email}).Err(); err == nil {
		writeError(w, http.StatusConflict, "an account with this email already exists")
		return
	} else if !errors.Is(err, mongo.ErrNoDocuments) {
		writeError(w, http.StatusInternalServerError, "failed to create account")
		return
	}

	user := User{
		Email:          email,
		PasswordHash:   string(hash),
		Role:           "user",
		Status:         "verified",
		SessionVersion: 1,
		TwoFAMethods:   []string{},
		CreatedAt:      time.Now().Unix(),
	}
	res, err := users.InsertOne(ctx, user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create account")
		return
	}
	oid, ok := res.InsertedID.(primitive.ObjectID)
	if !ok {
		writeError(w, http.StatusInternalServerError, "failed to create account")
		return
	}
	user.ID = oid

	token, err := createToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	writeJSON(w, http.StatusCreated, signUpResponse{
		Token: token,
		User: authUserPublic{
			ID:     user.ID.Hex(),
			Email:  user.Email,
			Role:   user.Role,
			Status: user.Status,
		},
	})
}

func signIn(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}

	email := normalizeEmail(req.Email)
	password := strings.TrimSpace(req.Password)
	if email == "" || password == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var user User
	if err := db.Collection("users").FindOne(ctx, bson.M{"email": email}).Decode(&user); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			writeError(w, http.StatusUnauthorized, "wrong email or password")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to sign in")
		return
	}
	normalizeUserDefaults(&user)

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		writeError(w, http.StatusUnauthorized, "wrong email or password")
		return
	}
	if user.Status == "suspended" {
		writeError(w, http.StatusForbidden, "Your account has been suspended. Contact support.")
		return
	}
	ctxUpdate, cancelUpdate := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancelUpdate()
	now := time.Now().Unix()
	_, _ = db.Collection("users").UpdateByID(ctxUpdate, user.ID, bson.M{"$set": bson.M{"lastLoginAt": now}})
	user.LastLoginAt = now

	token, err := createToken(user)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create session")
		return
	}

	writeJSON(w, http.StatusOK, authResponse{
		Token: token,
		User: authUserPublic{
			ID:     user.ID.Hex(),
			Email:  user.Email,
			Role:   user.Role,
			Status: user.Status,
		},
	})
}

func getSession(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	oid, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid or expired session")
		return
	}

	var user User
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&user); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			writeError(w, http.StatusUnauthorized, "invalid or expired session")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}
	normalizeUserDefaults(&user)

	writeJSON(w, http.StatusOK, authUserPublic{ID: user.ID.Hex(), Email: user.Email, Role: user.Role, Status: user.Status})
}
