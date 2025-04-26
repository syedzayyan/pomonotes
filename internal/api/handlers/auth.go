package handlers

import (
	"net/http"
	middleauth "pom/internal/api/middleware"
	models "pom/internal/db"
	"strconv"

	"github.com/labstack/echo/v4"
)

// Get all users (admin only)
func GetAllUsersHandler(c echo.Context) error {
	users, err := models.GetAllUsers()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Don't send password hashes
	for i := range users {
		users[i].PasswordHash = ""
	}

	return c.JSON(http.StatusOK, users)
}

// Get current user info
func GetCurrentUserHandler(c echo.Context) error {
	user, err := middleauth.GetCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Not authenticated"})
	}

	// Don't send password hash
	user.PasswordHash = ""

	return c.JSON(http.StatusOK, user)
}

// Create new user (admin only)
func CreateUserHandler(c echo.Context) error {
	userInput := new(models.UserInput)
	if err := c.Bind(userInput); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Validate input
	if userInput.Username == "" || userInput.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username and password are required"})
	}

	// Create user
	userID, err := models.CreateUser(*userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "User created successfully",
		"id":      userID,
	})
}

// Update user (admin only)
func UpdateUserHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}

	// Check if user exists
	_, err = models.GetUserByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	userInput := new(models.UserInput)
	if err := c.Bind(userInput); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Validate input
	if userInput.Username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username is required"})
	}

	// Update user
	err = models.UpdateUser(id, *userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "User updated successfully"})
}

// Delete user (soft delete, admin only)
func DeleteUserHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}

	// Check if user exists
	_, err = models.GetUserByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// Soft delete user
	err = models.SoftDeleteUser(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "User deleted successfully"})
}

// Set user admin status (admin only)
func SetAdminHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}

	// Structure for request
	type AdminRequest struct {
		IsAdmin bool `json:"is_admin"`
	}

	adminReq := new(AdminRequest)
	if err := c.Bind(adminReq); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Get current user
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// Get current user data
	user, err := models.GetUserByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	userInput := models.UserInput{
		Username: user.Username,
		Password: "", // Empty password means don't change it
		Email:    user.Email,
		IsAdmin:  adminReq.IsAdmin,
	}

	err = models.UpdateUser(id, userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "User admin status updated successfully",
	})
}

// Reset user password (admin only)
func ResetPasswordHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}

	// Get current user data
	user, err := models.GetUserByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// Generate a new random password
	newPassword, err := models.GenerateSecurePassword(12)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate password"})
	}

	// Update user with new password
	userInput := models.UserInput{
		Username: user.Username,
		Password: newPassword, // This will be hashed in UpdateUser
		Email:    user.Email,
		IsAdmin:  user.IsAdmin,
	}

	err = models.UpdateUser(id, userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new plaintext password to the admin
	return c.JSON(http.StatusOK, map[string]string{
		"message":  "Password reset successfully",
		"password": newPassword,
	})
}
