package main

import (
	"net/http"
	"strconv"
	
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

// Get all users (admin only)
func getAllUsersHandler(c echo.Context) error {
	users, err := getAllUsers()
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
func getCurrentUserHandler(c echo.Context) error {
	user, err := getCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Not authenticated"})
	}
	
	// Don't send password hash
	user.PasswordHash = ""
	
	return c.JSON(http.StatusOK, user)
}

// Create new user (admin only)
func createUserHandler(c echo.Context) error {
	userInput := new(UserInput)
	if err := c.Bind(userInput); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}
	
	// Validate input
	if userInput.Username == "" || userInput.Password == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username and password are required"})
	}
	
	// Create user
	userID, err := createUser(*userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "User created successfully",
		"id": userID,
	})
}

// Update user (admin only)
func updateUserHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}
	
	// Check if user exists
	_, err = getUserByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	
	userInput := new(UserInput)
	if err := c.Bind(userInput); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}
	
	// Validate input
	if userInput.Username == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Username is required"})
	}
	
	// Update user
	err = updateUser(id, *userInput)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusOK, map[string]string{"message": "User updated successfully"})
}

// Delete user (soft delete, admin only)
func deleteUserHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}
	
	// Check if user exists
	_, err = getUserByID(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	
	// Soft delete user
	err = softDeleteUser(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusOK, map[string]string{"message": "User deleted successfully"})
}

// Set user admin status (admin only)
func setAdminHandler(c echo.Context) error {
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
	
	// Update admin status
	_, err = db.Exec("UPDATE users SET is_admin = ? WHERE id = ?", adminReq.IsAdmin, id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusOK, map[string]string{
		"message": "User admin status updated successfully",
	})
}

// Reset user password (admin only)
func resetPasswordHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid user ID"})
	}
	
	// Generate a new random password
	newPassword, err := generateSecurePassword(12)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate password"})
	}
	
	// Hash the password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}
	
	// Update user
	_, err = db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(passwordHash), id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	// Return the new plaintext password to the admin
	return c.JSON(http.StatusOK, map[string]string{
		"message": "Password reset successfully",
		"password": newPassword,
	})
}