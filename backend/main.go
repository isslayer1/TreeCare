package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/rs/cors"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// getRecords returns all tree records.
func getRecords(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cur, err := db.Collection("tree_records").Find(ctx, bson.M{})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)

	var records []TreeRecord
	if err := cur.All(ctx, &records); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(records); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// createRecord inserts a new tree record.
func createRecord(w http.ResponseWriter, r *http.Request) {
	var rec TreeRecord
	if err := json.NewDecoder(r.Body).Decode(&rec); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if rec.TreeType == "" {
		rec.TreeType = "Olive"
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := db.Collection("tree_records").InsertOne(ctx, rec)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	rec.ID = res.InsertedID.(primitive.ObjectID)

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(rec); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// deleteRecord deletes a record by its MongoDB ObjectID passed as ?id=...
func deleteRecord(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "id query parameter is required", http.StatusBadRequest)
		return
	}

	oid, err := primitive.ObjectIDFromHex(idStr)
	if err != nil {
		http.Error(w, "invalid id format", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	_, err = db.Collection("tree_records").DeleteOne(ctx, bson.M{"_id": oid})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func getWateringScheduleMonths(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	monthsRaw, err := db.Collection("watering_schedule").Distinct(ctx, "month", bson.M{})
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
	month := r.URL.Query().Get("month")
	if month == "" {
		http.Error(w, "month query parameter is required (YYYY-MM)", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	cur, err := db.Collection("watering_schedule").Find(ctx, bson.M{"month": month})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer cur.Close(ctx)

	var entries []WateringScheduleEntry
	if err := cur.All(ctx, &entries); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(entries); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// upsertWateringSchedule replaces all entries for each month present in the payload.
// The frontend usually uploads a CSV for a single month, but this supports multiple months too.
func upsertWateringSchedule(w http.ResponseWriter, r *http.Request) {
	var payload []WateringScheduleUpsertPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(payload) == 0 {
		http.Error(w, "payload must be a non-empty array", http.StatusBadRequest)
		return
	}

	// Build entries + gather touched months
	monthsTouched := map[string]struct{}{}
	entries := make([]interface{}, 0, len(payload))
	for _, p := range payload {
		if len(p.Date) < 7 {
			http.Error(w, "invalid date format; expected YYYY-MM-DD", http.StatusBadRequest)
			return
		}
		month := p.Date[:7]
		monthsTouched[month] = struct{}{}

		entries = append(entries, WateringScheduleEntry{
			Date:           p.Date,
			ShouldIrrigate: p.ShouldIrrigate,
			TreeID:         p.TreeID,
			Month:          month,
		})
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Replace each touched month in a simple way: delete + insert.
	collection := db.Collection("watering_schedule")
	for month := range monthsTouched {
		if _, err := collection.DeleteMany(ctx, bson.M{"month": month}); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	if _, err := collection.InsertMany(ctx, entries); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{
		"ok":        true,
		"inserted":  len(entries),
		"months":    keys(monthsTouched),
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

// deleteWateringScheduleMonth clears all schedule entries for a specific month.
func deleteWateringScheduleMonth(w http.ResponseWriter, r *http.Request) {
	month := r.URL.Query().Get("month")
	if month == "" {
		http.Error(w, "month query parameter is required (YYYY-MM)", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	res, err := db.Collection("watering_schedule").DeleteMany(ctx, bson.M{"month": month})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"deleted": res.DeletedCount,
		"month":   month,
	}); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
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
	// Connect to MongoDB
	initMongo()

	r := chi.NewRouter()

	// CORS configuration to allow your frontend from localhost and LAN IPs.
	corsMiddleware := cors.New(cors.Options{
		AllowedOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
		},
		// Additionally allow any origin by echoing it back.
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Origin", "Content-Type", "Accept"},
		ExposedHeaders:   []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           int((12 * time.Hour).Seconds()),
	})
	r.Use(corsMiddleware.Handler)

	// Routes
	r.Get("/api/records", getRecords)
	r.Post("/api/records", createRecord)
	r.Delete("/api/records", deleteRecord)
	r.Get("/api/watering-schedule/months", getWateringScheduleMonths)
	r.Get("/api/watering-schedule", getWateringScheduleByMonth)
	r.Post("/api/watering-schedule", upsertWateringSchedule)
	r.Delete("/api/watering-schedule", deleteWateringScheduleMonth)

	log.Println("Go API running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
