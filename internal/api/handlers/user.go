package handlers

import (
	"net/http"
	middleauth "pom/internal/api/middleware"
	models "pom/internal/db"

	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

// User profile update request struct
type UserUpdateRequest struct {
	Email           *string `json:"email"`
	CurrentPassword string  `json:"current_password"`
	NewPassword     string  `json:"new_password"`
}

// Update current user's profile
func UpdateUserProfileHandler(c echo.Context) error {
	// Get current user
	currentUser, err := middleauth.GetCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
	}

	// Parse request
	updateReq := new(UserUpdateRequest)
	if err := c.Bind(updateReq); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create a UserInput struct for UpdateUser
	userInput := models.UserInput{
		Username: currentUser.Username,
		Email:    currentUser.Email, // Default to current email
		IsAdmin:  currentUser.IsAdmin,
		// Password will be set later if needed
	}

	// If email is being updated
	if updateReq.Email != nil {
		// Check if the email is already used by another user
		if *updateReq.Email != "" {
			// This check needs to be done separately since UpdateUser doesn't check for email uniqueness across users
			users, err := models.GetAllUsers()
			if err != nil {
				return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
			}

			for _, user := range users {
				if user.ID != currentUser.ID && user.Email != nil && *user.Email == *updateReq.Email {
					return c.JSON(http.StatusBadRequest, map[string]string{"error": "Email is already in use"})
				}
			}
		}

		// Update the email in our userInput
		userInput.Email = updateReq.Email
	}

	// If password change is requested
	if updateReq.NewPassword != "" && updateReq.CurrentPassword != "" {
		// Verify current password
		err = bcrypt.CompareHashAndPassword([]byte(currentUser.PasswordHash), []byte(updateReq.CurrentPassword))
		if err != nil {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "Current password is incorrect"})
		}

		// Set the new password in userInput
		userInput.Password = updateReq.NewPassword
	}

	// Update the user with the information gathered
	err = models.UpdateUser(currentUser.ID, userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to update profile: " + err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Profile updated successfully"})
}
