package main

import (
	"net/http"
	"github.com/labstack/echo/v4"
	"log"
)

// Get database stats for admin dashboard
func getDatabaseStatsHandler(c echo.Context) error {
	stats := getDatabaseStats()
	return c.JSON(http.StatusOK, stats)
}

// Check database integrity
func checkDatabaseIntegrityHandler(c echo.Context) error {
	integrity, err := checkDatabaseIntegrity()
	if err != nil {
		return c.HTML(http.StatusOK, `<div class="alert-error">Error checking integrity: `+err.Error()+`</div>`)
	}
	
	if integrity {
		return c.HTML(http.StatusOK, `<div class="alert-success">Database integrity check passed!</div>`)
	} else {
		return c.HTML(http.StatusOK, `<div class="alert-error">Database integrity check failed. Please backup your data and consider rebuilding the database.</div>`)
	}
}

// Initialize admin user if none exists
func initializeAdminUser() {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE is_admin = 1").Scan(&count)
	if err != nil || count > 0 {
		// Either there's an error (table might not exist yet) or there's already an admin
		return
	}
	
	// Create default admin user if no admin exists
	defaultAdmin := UserInput{
		Username: "admin",
		Password: adminPassword, // From auth.go
		Email:    nil,           // No email for default admin
		IsAdmin:  true,
	}
	
	_, err = createUser(defaultAdmin)
	if err != nil {
		// Log the error but continue - this is not critical
		log.Printf("Failed to create default admin user: %v", err)
	} else {
		log.Println("Created default admin user with username 'admin'")
	}
}