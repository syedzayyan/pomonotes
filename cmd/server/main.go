package main

import (
	"log"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"

	"pom/internal/api"
	models "pom/internal/db"
)

// Update the main function to initialize admin user
func main() {
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowCredentials: true,
	}))

	// Initialize the database
	models.InitDB()
	// Initialize admin user
	models.InitializeAdminUser()
	// Set up routes
	api.SetupRoutes(e)

	// Start server
	log.Println("Server is running on http://localhost:8080")
	log.Fatal(e.Start("0.0.0.0:8080"))
}
