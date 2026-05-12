package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/rs/cors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// getRecords returns all tree records.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func getRecords(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cur, err := db.Collection("tree_records").Find(ctx, bson.M{"userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch records")
		return
	}
	defer cur.Close(ctx)

	var records = make([]TreeRecord, 0)
	if err := cur.All(ctx, &records); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode records")
		return
	}

	writeJSON(w, http.StatusOK, records)
}

// createRecord inserts a new tree record.
func createRecord(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var rec TreeRecord
	if err := json.NewDecoder(r.Body).Decode(&rec); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}

	// Basic validation
	if rec.TreeID == "" {
		writeError(w, http.StatusBadRequest, "treeId is required")
		return
	}
	if rec.ActionType != "Irrigation" && rec.ActionType != "Medication" {
		writeError(w, http.StatusBadRequest, "actionType must be either 'Irrigation' or 'Medication'")
		return
	}
	if rec.Date == "" {
		writeError(w, http.StatusBadRequest, "date is required")
		return
	}
	if _, err := time.Parse("2006-01-02", rec.Date); err != nil {
		writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
		return
	}

	if rec.TreeType == "" {
		rec.TreeType = "Olive"
	}
	rec.UserID = userID

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := db.Collection("tree_records").InsertOne(ctx, rec)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create record")
		return
	}

	rec.ID = res.InsertedID.(primitive.ObjectID)
	writeJSON(w, http.StatusCreated, rec)
}

// deleteRecord deletes a record by its MongoDB ObjectID passed as /api/records/{id}
func deleteRecord(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	if idStr == "" {
		writeError(w, http.StatusBadRequest, "id parameter is required")
		return
	}

	oid, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid id format")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := db.Collection("tree_records").DeleteOne(ctx, bson.M{"_id": oid, "userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete record")
		return
	}

	if res.DeletedCount == 0 {
		writeError(w, http.StatusNotFound, "record not found")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func getWateringScheduleMonths(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	monthsRaw, err := db.Collection("watering_schedule").Distinct(ctx, "month", bson.M{"userId": userID})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	months := make([]string, 0, len(monthsRaw))
	for _, v := range monthsRaw {
		if s, ok := v.(string); ok && s != "" {
			months = append(months, s)
		}
	}
	sort.Strings(months)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(months); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func getWateringScheduleByMonth(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "month query parameter is required (YYYY-MM)")
		return
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		writeError(w, http.StatusBadRequest, "month must be in YYYY-MM format")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cur, err := db.Collection("watering_schedule").Find(ctx, bson.M{"month": month, "userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch watering schedule")
		return
	}
	defer cur.Close(ctx)

	var entries = make([]WateringScheduleEntry, 0)
	if err := cur.All(ctx, &entries); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode watering schedule")
		return
	}

	writeJSON(w, http.StatusOK, entries)
}

// upsertWateringSchedule replaces all entries for each month present in the payload.
// The frontend usually uploads a CSV for a single month, but this supports multiple months too.
func upsertWateringSchedule(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var payload []WateringScheduleUpsertPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}
	if len(payload) == 0 {
		writeError(w, http.StatusBadRequest, "payload must be a non-empty array")
		return
	}

	// Build entries + gather touched months
	monthsTouched := map[string]struct{}{}
	entries := make([]interface{}, 0, len(payload))
	for _, p := range payload {
		date := strings.TrimSpace(strings.ReplaceAll(p.Date, "\r", ""))
		if date == "" {
			writeError(w, http.StatusBadRequest, "date is required")
			return
		}

		if _, err := time.Parse("2006-01-02", date); err != nil {
			writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
			return
		}

		month := date[:7]
		if _, err := time.Parse("2006-01", month); err != nil {
			writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
			return
		}
		monthsTouched[month] = struct{}{}

		treeID := ""
		if p.TreeID != nil {
			treeID = strings.TrimSpace(strings.ReplaceAll(*p.TreeID, "\r", ""))
		}
		var treeIDPtr *string
		if treeID != "" {
			treeIDPtr = &treeID
		}

		entries = append(entries, WateringScheduleEntry{
			UserID:         userID,
			Date:           date,
			ShouldIrrigate: p.ShouldIrrigate,
			TreeID:         treeIDPtr,
			Month:          month,
		})
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Replace each touched month: delete + insert.
	collection := db.Collection("watering_schedule")

	// Keep a backup of existing docs for each touched month so we can restore on failure.
	backup := map[string][]bson.M{}
	for month := range monthsTouched {
		cur, err := collection.Find(ctx, bson.M{"month": month, "userId": userID})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read existing schedule")
			return
		}
		var existing []bson.M
		if err := cur.All(ctx, &existing); err == nil {
			backup[month] = existing
		}
		cur.Close(ctx)
	}

	for month := range monthsTouched {
		if _, err := collection.DeleteMany(ctx, bson.M{"month": month, "userId": userID}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to delete old schedule")
			return
		}
	}

	if _, err := collection.InsertMany(ctx, entries); err != nil {
		// Attempt to restore the previous schedule (best effort)
		for _, docs := range backup {
			for _, doc := range docs {
				delete(doc, "_id")
			}
			insertDocs := make([]interface{}, 0, len(docs))
			for _, doc := range docs {
				insertDocs = append(insertDocs, doc)
			}
			_, _ = collection.InsertMany(ctx, insertDocs)
		}
		writeError(w, http.StatusInternalServerError, "failed to insert schedule")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"inserted": len(entries),
		"months":   keys(monthsTouched),
	})
}

// deleteWateringScheduleMonth clears all schedule entries for a specific month.
func deleteWateringScheduleMonth(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "month query parameter is required (YYYY-MM)")
		return
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		writeError(w, http.StatusBadRequest, "month must be in YYYY-MM format")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := db.Collection("watering_schedule").DeleteMany(ctx, bson.M{"month": month, "userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear watering schedule")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"deleted": res.DeletedCount,
		"month":   month,
	})
}

func getMedicationScheduleMonths(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	monthsRaw, err := db.Collection("medication_schedule").Distinct(ctx, "month", bson.M{"userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load medication months")
		return
	}

	months := make([]string, 0, len(monthsRaw))
	for _, v := range monthsRaw {
		if s, ok := v.(string); ok && s != "" {
			months = append(months, s)
		}
	}
	sort.Strings(months)

	writeJSON(w, http.StatusOK, months)
}

func getMedicationScheduleByMonth(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "month query parameter is required (YYYY-MM)")
		return
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		writeError(w, http.StatusBadRequest, "month must be in YYYY-MM format")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cur, err := db.Collection("medication_schedule").Find(ctx, bson.M{"month": month, "userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fetch medication schedule")
		return
	}
	defer cur.Close(ctx)

	var entries = make([]MedicationScheduleEntry, 0)
	if err := cur.All(ctx, &entries); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decode medication schedule")
		return
	}

	writeJSON(w, http.StatusOK, entries)
}

func upsertMedicationSchedule(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	var payload []MedicationScheduleUpsertPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request payload")
		return
	}
	if len(payload) == 0 {
		writeError(w, http.StatusBadRequest, "payload must be a non-empty array")
		return
	}

	// Build entries + gather touched months
	monthsTouched := map[string]struct{}{}
	entries := make([]interface{}, 0, len(payload))
	for _, p := range payload {
		date := strings.TrimSpace(strings.ReplaceAll(p.Date, "\r", ""))
		if date == "" {
			writeError(w, http.StatusBadRequest, "date is required")
			return
		}

		if _, err := time.Parse("2006-01-02", date); err != nil {
			writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
			return
		}

		month := date[:7]
		if _, err := time.Parse("2006-01", month); err != nil {
			writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
			return
		}
		monthsTouched[month] = struct{}{}

		medicationType := strings.TrimSpace(strings.ReplaceAll(p.MedicationType, "\r", ""))
		if medicationType == "" {
			writeError(w, http.StatusBadRequest, "medicationType is required")
			return
		}
		recommendedBrand := strings.TrimSpace(strings.ReplaceAll(p.RecommendedBrand, "\r", ""))

		entries = append(entries, MedicationScheduleEntry{
			UserID:           userID,
			Date:             date,
			ShouldApply:      p.ShouldApply,
			MedicationType:   medicationType,
			RecommendedBrand: recommendedBrand,
			Month:            month,
		})
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Replace each touched month: delete + insert.
	collection := db.Collection("medication_schedule")

	// Keep a backup of existing docs for each touched month so we can restore on failure.
	backup := map[string][]bson.M{}
	for month := range monthsTouched {
		cur, err := collection.Find(ctx, bson.M{"month": month, "userId": userID})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to read existing schedule")
			return
		}
		var existing []bson.M
		if err := cur.All(ctx, &existing); err == nil {
			backup[month] = existing
		}
		cur.Close(ctx)
	}

	for month := range monthsTouched {
		if _, err := collection.DeleteMany(ctx, bson.M{"month": month, "userId": userID}); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to delete old schedule")
			return
		}
	}

	if _, err := collection.InsertMany(ctx, entries); err != nil {
		// Attempt to restore the previous schedule (best effort)
		for _, docs := range backup {
			for _, doc := range docs {
				delete(doc, "_id")
			}
			insertDocs := make([]interface{}, 0, len(docs))
			for _, doc := range docs {
				insertDocs = append(insertDocs, doc)
			}
			_, _ = collection.InsertMany(ctx, insertDocs)
		}
		writeError(w, http.StatusInternalServerError, "failed to insert schedule")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":       true,
		"inserted": len(entries),
		"months":   keys(monthsTouched),
	})
}

func deleteMedicationScheduleMonth(w http.ResponseWriter, r *http.Request) {
	userID := userIDFromContext(r.Context())
	if userID == "" {
		writeError(w, http.StatusUnauthorized, "authentication required")
		return
	}

	month := r.URL.Query().Get("month")
	if month == "" {
		writeError(w, http.StatusBadRequest, "month query parameter is required (YYYY-MM)")
		return
	}
	if _, err := time.Parse("2006-01", month); err != nil {
		writeError(w, http.StatusBadRequest, "month must be in YYYY-MM format")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := db.Collection("medication_schedule").DeleteMany(ctx, bson.M{"month": month, "userId": userID})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear medication schedule")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"deleted": res.DeletedCount,
		"month":   month,
	})
}

func keys(m map[string]struct{}) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func main() {
	// Load local env file if present.
	_ = godotenv.Load()

	// Connect to MongoDB
	initMongo()

	r := chi.NewRouter()

	// Middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// CORS configuration (restrict to trusted origins by default)
	allowedOrigins := []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	if env := os.Getenv("ALLOWED_ORIGINS"); env != "" {
		// Comma-separated list
		allowedOrigins = append([]string{}, strings.Split(env, ",")...)
	}

	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           int((12 * time.Hour).Seconds()),
	})
	r.Use(corsMiddleware.Handler)

	// Public auth routes
	r.Post("/api/auth/signup", signUp)
	r.Post("/api/auth/signin", signIn)

	// Protected API routes
	r.Route("/api", func(api chi.Router) {
		api.Use(authMiddleware)
		api.Get("/auth/me", getSession)
		api.Post("/chat", chatWithAssistant)
		api.Get("/records", getRecords)
		api.Post("/records", createRecord)
		api.Delete("/records/{id}", deleteRecord)
		api.Get("/watering-schedule/months", getWateringScheduleMonths)
		api.Get("/watering-schedule", getWateringScheduleByMonth)
		api.Post("/watering-schedule", upsertWateringSchedule)
		api.Delete("/watering-schedule", deleteWateringScheduleMonth)
		api.Get("/medication-schedule/months", getMedicationScheduleMonths)
		api.Get("/medication-schedule", getMedicationScheduleByMonth)
		api.Post("/medication-schedule", upsertMedicationSchedule)
		api.Delete("/medication-schedule", deleteMedicationScheduleMonth)
	})

	// Protected admin routes
	r.Route("/api/admin", func(admin chi.Router) {
		admin.Use(authMiddleware)
		admin.Use(requireAdmin)
		admin.Get("/users", getAdminUsers)
		admin.Get("/users/{id}", getAdminUserByID)
		admin.Patch("/users/{id}/role", patchAdminUserRole)
		admin.Patch("/users/{id}/status", patchAdminUserStatus)
		admin.Delete("/users/{id}", deleteAdminUser)
		admin.Post("/users/{id}/force-logout", forceLogoutUser)
	})

	log.Println("Go API running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
