package main

import (
	"log"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	e := echo.New()

	// Middleware
	e.Use(middleware.Logger())
	e.Use(middleware.Recover())

	// Initialize the database
	initDB()

	// Set up routes
	setupRoutes(e)

	// Start server
	log.Println("Server is running on http://localhost:8080")
	log.Fatal(e.Start(":8080"))
}
