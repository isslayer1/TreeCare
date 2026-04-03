package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type adminLog struct {
	AdminID      string `bson:"adminId" json:"adminId"`
	Action       string `bson:"action" json:"action"`
	TargetUserID string `bson:"targetUserId" json:"targetUserId"`
	Timestamp    int64  `bson:"timestamp" json:"timestamp"`
}

type adminUserListItem struct {
	ID           string   `json:"id"`
	Email        string   `json:"email"`
	Role         string   `json:"role"`
	Status       string   `json:"status"`
	TwoFAMethods []string `json:"twoFaMethods"`
	CreatedAt    int64    `json:"createdAt"`
	LastLoginAt  int64    `json:"lastLoginAt"`
}

type adminUserListResponse struct {
	Users      []adminUserListItem `json:"users"`
	Page       int                 `json:"page"`
	PageSize   int                 `json:"pageSize"`
	Total      int64               `json:"total"`
	TotalPages int                 `json:"totalPages"`
}

type updateRoleRequest struct {
	Role string `json:"role"`
}

type updateStatusRequest struct {
	Status string `json:"status"`
}

func requireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user := authUserFromContext(r.Context())
		if user == nil || strings.TrimSpace(user.Role) != "admin" {
			writeError(w, http.StatusForbidden, "admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func logAdminAction(ctx context.Context, adminID, action, targetUserID string) {
	if strings.TrimSpace(adminID) == "" || strings.TrimSpace(targetUserID) == "" {
		return
	}
	_, _ = db.Collection("admin_logs").InsertOne(ctx, adminLog{
		AdminID:      adminID,
		Action:       action,
		TargetUserID: targetUserID,
		Timestamp:    time.Now().Unix(),
	})
}

func parseObjectIDParam(w http.ResponseWriter, r *http.Request, param string) (primitive.ObjectID, bool) {
	id := strings.TrimSpace(chi.URLParam(r, param))
	oid, err := primitive.ObjectIDFromHex(id)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid user id")
		return primitive.NilObjectID, false
	}
	return oid, true
}

func getAdminUsers(w http.ResponseWriter, r *http.Request) {
	page := 1
	if p := strings.TrimSpace(r.URL.Query().Get("page")); p != "" {
		if parsed, err := strconv.Atoi(p); err == nil && parsed > 0 {
			page = parsed
		}
	}
	pageSize := 20
	search := strings.TrimSpace(strings.ToLower(r.URL.Query().Get("search")))

	filter := bson.M{}
	if search != "" {
		filter["email"] = bson.M{"$regex": search, "$options": "i"}
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	total, err := db.Collection("users").CountDocuments(ctx, filter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to count users")
		return
	}

	findOpts := options.Find().
		SetSort(bson.D{{Key: "createdAt", Value: -1}}).
		SetSkip(int64((page - 1) * pageSize)).
		SetLimit(int64(pageSize))
	cur, err := db.Collection("users").Find(ctx, filter, findOpts)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch users")
		return
	}
	defer cur.Close(ctx)

	pageUsers := make([]User, 0)
	if err := cur.All(ctx, &pageUsers); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode users")
		return
	}

	items := make([]adminUserListItem, 0, len(pageUsers))
	for _, u := range pageUsers {
		items = append(items, adminUserListItem{
			ID:           u.ID.Hex(),
			Email:        u.Email,
			Role:         u.Role,
			Status:       u.Status,
			TwoFAMethods: u.TwoFAMethods,
			CreatedAt:    u.CreatedAt,
			LastLoginAt:  u.LastLoginAt,
		})
	}

	totalPages := int((total + int64(pageSize) - 1) / int64(pageSize))
	writeJSON(w, http.StatusOK, adminUserListResponse{
		Users:      items,
		Page:       page,
		PageSize:   pageSize,
		Total:      total,
		TotalPages: totalPages,
	})
}

func getAdminUserByID(w http.ResponseWriter, r *http.Request) {
	oid, ok := parseObjectIDParam(w, r, "id")
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	var user User
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&user); err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	writeJSON(w, http.StatusOK, adminUserListItem{
		ID:           user.ID.Hex(),
		Email:        user.Email,
		Role:         user.Role,
		Status:       user.Status,
		TwoFAMethods: user.TwoFAMethods,
		CreatedAt:    user.CreatedAt,
		LastLoginAt:  user.LastLoginAt,
	})
}

func patchAdminUserRole(w http.ResponseWriter, r *http.Request) {
	oid, ok := parseObjectIDParam(w, r, "id")
	if !ok {
		return
	}

	var req updateRoleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}
	req.Role = strings.TrimSpace(req.Role)
	if req.Role != "user" && req.Role != "admin" {
		writeError(w, http.StatusBadRequest, "role must be either 'user' or 'admin'")
		return
	}

	adminID := userIDFromContext(r.Context())
	if oid.Hex() == adminID && req.Role != "admin" {
		writeError(w, http.StatusBadRequest, "an admin cannot demote themselves")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	if req.Role == "user" {
		adminCount, err := db.Collection("users").CountDocuments(ctx, bson.M{"role": "admin"})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to validate admin count")
			return
		}
		var target User
		if err := db.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&target); err != nil {
			writeError(w, http.StatusNotFound, "user not found")
			return
		}
		if target.Role == "admin" && adminCount <= 1 {
			writeError(w, http.StatusBadRequest, "cannot demote the last remaining admin")
			return
		}
	}

	res, err := db.Collection("users").UpdateByID(ctx, oid, bson.M{"$set": bson.M{"role": req.Role}, "$inc": bson.M{"sessionVersion": 1}})
	if err != nil || res.MatchedCount == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	logAdminAction(ctx, adminID, "role_change", oid.Hex())
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func patchAdminUserStatus(w http.ResponseWriter, r *http.Request) {
	oid, ok := parseObjectIDParam(w, r, "id")
	if !ok {
		return
	}

	var req updateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}
	req.Status = strings.TrimSpace(req.Status)
	if req.Status != "verified" && req.Status != "unverified" && req.Status != "suspended" {
		writeError(w, http.StatusBadRequest, "status must be one of verified, unverified, suspended")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	update := bson.M{"$set": bson.M{"status": req.Status}}
	if req.Status == "verified" {
		update["$unset"] = bson.M{"verificationToken": "", "verificationTokenExp": ""}
	}
	res, err := db.Collection("users").UpdateByID(ctx, oid, update)
	if err != nil || res.MatchedCount == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	logAdminAction(ctx, userIDFromContext(r.Context()), "status_change", oid.Hex())
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func deleteAdminUser(w http.ResponseWriter, r *http.Request) {
	oid, ok := parseObjectIDParam(w, r, "id")
	if !ok {
		return
	}

	adminID := userIDFromContext(r.Context())
	if oid.Hex() == adminID {
		writeError(w, http.StatusBadRequest, "an admin cannot delete themselves")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	var target User
	if err := db.Collection("users").FindOne(ctx, bson.M{"_id": oid}).Decode(&target); err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	if target.Role == "admin" {
		adminCount, err := db.Collection("users").CountDocuments(ctx, bson.M{"role": "admin"})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to validate admin count")
			return
		}
		if adminCount <= 1 {
			writeError(w, http.StatusBadRequest, "cannot delete the last remaining admin")
			return
		}
	}

	_, _ = db.Collection("tree_records").DeleteMany(ctx, bson.M{"userId": oid.Hex()})
	_, _ = db.Collection("watering_schedule").DeleteMany(ctx, bson.M{"userId": oid.Hex()})
	_, _ = db.Collection("medication_schedule").DeleteMany(ctx, bson.M{"userId": oid.Hex()})

	res, err := db.Collection("users").DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil || res.DeletedCount == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	logAdminAction(ctx, adminID, "delete_user", oid.Hex())
	w.WriteHeader(http.StatusNoContent)
}

func forceLogoutUser(w http.ResponseWriter, r *http.Request) {
	oid, ok := parseObjectIDParam(w, r, "id")
	if !ok {
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	res, err := db.Collection("users").UpdateByID(ctx, oid, bson.M{"$inc": bson.M{"sessionVersion": 1}})
	if err != nil || res.MatchedCount == 0 {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	logAdminAction(ctx, userIDFromContext(r.Context()), "force_logout", oid.Hex())
	writeJSON(w, http.StatusOK, map[string]any{"ok": true})
}
