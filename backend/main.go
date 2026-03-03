package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
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

func main() {
	// Connect to MongoDB
	initMongo()

	r := chi.NewRouter()

	// CORS configuration to allow your frontend origins.
	corsMiddleware := cors.New(cors.Options{
		AllowOrigins: []string{
			"http://localhost:5173",
			"http://127.0.0.1:5173",
			"http://192.168.69.251:5173", // your current LAN IP
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           int((12 * time.Hour).Seconds()),
	})
	r.Use(corsMiddleware.Handler)

	// Routes
	r.Get("/api/records", getRecords)
	r.Post("/api/records", createRecord)
	r.Delete("/api/records", deleteRecord)

	log.Println("Go API running on http://localhost:8080")
	if err := http.ListenAndServe(":8080", r); err != nil {
		log.Fatal(err)
	}
}
