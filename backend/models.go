package main

import "go.mongodb.org/mongo-driver/bson/primitive"

// TreeRecord matches your React TreeRecord (except id is an ObjectID).
type TreeRecord struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	TreeID     string             `bson:"treeId" json:"treeId"`
	TreeType   string             `bson:"treeType" json:"treeType"`
	ActionType string             `bson:"actionType" json:"actionType"` // Irrigation | Medication
	Details    string             `bson:"details" json:"details"`
	Date       string             `bson:"date" json:"date"` // YYYY-MM-DD
	Notes      string             `bson:"notes,omitempty" json:"notes,omitempty"`
}

// WateringScheduleEntry for optional future CSV upload feature.
type WateringScheduleEntry struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Date           string             `bson:"date" json:"date"`
	ShouldIrrigate bool               `bson:"shouldIrrigate" json:"shouldIrrigate"`
	TreeID         *string            `bson:"treeId,omitempty" json:"treeId,omitempty"`
}
