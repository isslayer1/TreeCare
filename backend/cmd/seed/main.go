package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	promote := flag.String("promote", "", "email address to promote to admin")
	flag.Parse()

	email := strings.ToLower(strings.TrimSpace(*promote))
	if email == "" {
		log.Fatal("usage: go run ./cmd/seed --promote admin@example.com")
	}

	uri := strings.TrimSpace(os.Getenv("MONGODB_URI"))
	if uri == "" {
		uri = "mongodb://localhost:27017"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(uri))
	if err != nil {
		log.Fatalf("failed to connect to MongoDB: %v", err)
	}
	defer func() {
		_ = client.Disconnect(context.Background())
	}()

	db := client.Database("orchard_db")
	res, err := db.Collection("users").UpdateOne(ctx,
		bson.M{"email": email},
		bson.M{"$set": bson.M{"role": "admin"}, "$inc": bson.M{"sessionVersion": 1}},
	)
	if err != nil {
		log.Fatalf("failed to promote user: %v", err)
	}
	if res.MatchedCount == 0 {
		log.Fatalf("user not found: %s", email)
	}

	fmt.Printf("promoted %s to admin\n", email)
}
