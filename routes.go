package main

import (
	"github.com/labstack/echo/v4"
)

func setupRoutes(e *echo.Echo) {
	// Serve static files (CSS, JS, etc.)
	e.Static("/static", "static")

	// Authentication routes - these don't need auth protection
	e.POST("/api/login", loginHandler)
	e.GET("/api/auth/status", authStatusHandler, optionalAuth)
	e.GET("/login", loginPage) // Dedicated login page

	// Create a group for routes that require authentication
	authGroup := e.Group("")
	authMiddleware := configureJWTMiddleware()
	authGroup.Use(authMiddleware)

	// Serve the homepage and other HTML pages - protected routes
	authGroup.GET("/", homepage)
	authGroup.GET("/history", historyPage)
	authGroup.GET("/notes", notesPage)
	authGroup.GET("/activities", activitiesPage)
	authGroup.GET("/tags", tagsManagementPage) // New tags management page

	// Session CRUD - protected API routes
	authGroup.POST("/api/sessions", createSessionHandler)
	authGroup.GET("/api/sessions", getSessionsHandler)
	authGroup.GET("/api/sessions/:id", getSessionHandler)
	authGroup.PUT("/api/sessions/:id", updateSessionHandler)
	authGroup.DELETE("/api/sessions/:id", deleteSessionHandler)
	authGroup.GET("/api/sessions/tag", getSessionsByTagHandler) // New route to get sessions by tag

	// Pomodoro CRUD - protected API routes
	authGroup.POST("/api/pomodoros", createPomodoroHandler)
	authGroup.GET("/api/pomodoros/:session_id", getPomodorosHandler)
	authGroup.PUT("/api/pomodoros/:id", updatePomodoroHandler)

	// Break CRUD - protected API routes
	authGroup.POST("/api/breaks", createBreakHandler)
	authGroup.GET("/api/breaks/:session_id", getBreaksHandler)
	authGroup.PUT("/api/breaks/:id", updateBreakHandler)

	// Note CRUD - protected API routes
	authGroup.POST("/api/notes", createNoteHandler)
	authGroup.GET("/api/notes/:session_id", getNotesHandler)
	authGroup.GET("/api/notes", getAllNotesHandler)  // Get all notes for browsing
	authGroup.PUT("/api/notes/:id", updateNoteHandler)
	authGroup.DELETE("/api/notes/:id", deleteNoteHandler)
	
	// Tag CRUD - protected API routes
	authGroup.GET("/api/tags", getTagsHandler)
	authGroup.POST("/api/tags", createTagHandler)
	authGroup.PUT("/api/tags/:id", updateTagHandler)
	authGroup.DELETE("/api/tags/:id", deleteTagHandler)
	
	// Stats routes
	authGroup.GET("/api/stats/monthly-tags", getMonthlyTagStatsHandler) // Get monthly stats by tag
	
	// For the PWA
	e.GET("/manifest.json", func(c echo.Context) error {
		return c.File("static/manifest.json")
	})
}

// Homepage serves the index.html
func homepage(c echo.Context) error {
	return c.File("templates/index.html")
}

// History page serves the history.html
func historyPage(c echo.Context) error {
	return c.File("templates/history.html")
}

// Notes page serves the notes.html
func notesPage(c echo.Context) error {
	return c.File("templates/notes.html")
}

// Activities page serves the activities.html
func activitiesPage(c echo.Context) error {
	return c.File("templates/activities.html")
}

// Tags management page serves the tags.html
func tagsManagementPage(c echo.Context) error {
	return c.File("templates/tags.html")
}

// Login page serves the login.html
func loginPage(c echo.Context) error {
	return c.File("templates/login.html")
}
