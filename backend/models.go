package main

import "go.mongodb.org/mongo-driver/bson/primitive"

type User struct {
	ID                   primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Email                string             `bson:"email" json:"email"`
	PasswordHash         string             `bson:"passwordHash" json:"-"`
	Role                 string             `bson:"role" json:"role"`
	Status               string             `bson:"status" json:"status"`
	SessionVersion       int64              `bson:"sessionVersion" json:"-"`
	TwoFAMethods         []string           `bson:"twoFaMethods,omitempty" json:"twoFaMethods,omitempty"`
	LastLoginAt          int64              `bson:"lastLoginAt,omitempty" json:"lastLoginAt,omitempty"`
	VerificationToken    string             `bson:"verificationToken,omitempty" json:"-"`
	VerificationTokenExp int64              `bson:"verificationTokenExp,omitempty" json:"-"`
	VerificationSentAt   int64              `bson:"verificationSentAt,omitempty" json:"-"`
	CreatedAt            int64              `bson:"createdAt" json:"createdAt"`
}

// TreeRecord matches your React TreeRecord (except id is an ObjectID).
type TreeRecord struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID     string             `bson:"userId" json:"-"`
	TreeID     string             `bson:"treeId" json:"treeId"`
	TreeType   string             `bson:"treeType" json:"treeType"`
	ActionType string             `bson:"actionType" json:"actionType"` // Irrigation | Medication
	Details    string             `bson:"details" json:"details"`
	Date       string             `bson:"date" json:"date"` // YYYY-MM-DD
	Notes      string             `bson:"notes,omitempty" json:"notes,omitempty"`
}

// WateringScheduleEntry represents one day in a watering schedule.
type WateringScheduleEntry struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID         string             `bson:"userId" json:"-"`
	Date           string             `bson:"date" json:"date"`
	ShouldIrrigate bool               `bson:"shouldIrrigate" json:"shouldIrrigate"`
	TreeID         *string            `bson:"treeId,omitempty" json:"treeId,omitempty"`
	Month          string             `bson:"month" json:"month"` // YYYY-MM
}

// WateringScheduleUpsertPayload is the JSON shape accepted from the frontend.
// Month is derived from Date server-side.
type WateringScheduleUpsertPayload struct {
	Date           string  `json:"date"` // YYYY-MM-DD
	ShouldIrrigate bool    `json:"shouldIrrigate"`
	TreeID         *string `json:"treeId,omitempty"`
}

// MedicationScheduleEntry represents one day in a medication schedule.
type MedicationScheduleEntry struct {
	ID               primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	UserID           string             `bson:"userId" json:"-"`
	Date             string             `bson:"date" json:"date"`
	ShouldApply      bool               `bson:"shouldApply" json:"shouldApply"`
	MedicationType   string             `bson:"medicationType" json:"medicationType"`
	RecommendedBrand string             `bson:"recommendedBrand" json:"recommendedBrand"`
	Month            string             `bson:"month" json:"month"` // YYYY-MM
}

// MedicationScheduleUpsertPayload is the JSON shape accepted from the frontend.
// Month is derived from Date server-side.
type MedicationScheduleUpsertPayload struct {
	Date             string `json:"date"` // YYYY-MM-DD
	ShouldApply      bool   `json:"shouldApply"`
	MedicationType   string `json:"medicationType"`
	RecommendedBrand string `json:"recommendedBrand"`
}
