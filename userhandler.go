package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

// User profile update request struct
type UserUpdateRequest struct {
	Email          *string `json:"email"`
	CurrentPassword string  `json:"current_password"`
	NewPassword     string  `json:"new_password"`
}

// Update current user's profile
func updateUserProfileHandler(c echo.Context) error {
	// Get current user
	currentUser, err := getCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
	}
	
	// Parse request
	updateReq := new(UserUpdateRequest)
	if err := c.Bind(updateReq); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}
	
	// Start a database transaction
	tx, err := db.Begin()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
	}
	defer tx.Rollback() // Rollback if something goes wrong
	
	// If password change is requested
	if updateReq.NewPassword != "" && updateReq.CurrentPassword != "" {
		// Verify current password
		err = bcrypt.CompareHashAndPassword([]byte(currentUser.PasswordHash), []byte(updateReq.CurrentPassword))
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Current password is incorrect"})
		}
		
		// Hash the new password
		newPasswordHash, err := bcrypt.GenerateFromPassword([]byte(updateReq.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to process new password"})
		}
		
		// Update password
		_, err = tx.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(newPasswordHash), currentUser.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update password"})
		}
	}
	
	// Update email if provided
	if updateReq.Email != nil {
		// Check if the email is already used by another user
		if *updateReq.Email != "" {
			var count int
			err = tx.QueryRow("SELECT COUNT(*) FROM users WHERE email = ? AND id != ?", *updateReq.Email, currentUser.ID).Scan(&count)
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
			}
			
			if count > 0 {
				return c.JSON(http.StatusBadRequest, map[string]string{"error": "Email is already in use"})
			}
		}
		
		// Update email
		_, err = tx.Exec("UPDATE users SET email = ? WHERE id = ?", updateReq.Email, currentUser.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update email"})
		}
	}
	
	// Commit the transaction
	if err = tx.Commit(); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to save changes"})
	}
	
	return c.JSON(http.StatusOK, map[string]string{"message": "Profile updated successfully"})
}
