package main

import (
	"github.com/labstack/echo/v4"
)

// Update this in routes.go

func setupRoutes(e *echo.Echo) {
	// Serve static files
	e.Static("/static", "static")

	// Public routes
	e.POST("/api/login", loginHandler)
	e.GET("/api/auth/status", authStatusHandler, optionalAuth)
	e.GET("/login", loginPage)
	e.POST("/api/logout", logoutHandler)

	// Create a group for routes that require authentication
	authGroup := e.Group("")
	authMiddleware := configureJWTMiddleware()
	authGroup.Use(authMiddleware)

	// User routes
	authGroup.GET("/api/user/current", getCurrentUserHandler)

	// Admin routes group - requires admin privileges
	adminGroup := authGroup.Group("/admin")
	adminGroup.Use(requireAdmin)
	
	// Admin API routes
	adminGroup.GET("/api/users", getAllUsersHandler)
	adminGroup.POST("/api/users", createUserHandler)
	adminGroup.PUT("/api/users/:id", updateUserHandler)
	adminGroup.DELETE("/api/users/:id", deleteUserHandler)
	adminGroup.PUT("/api/users/:id/admin", setAdminHandler)
	adminGroup.POST("/api/users/:id/reset-password", resetPasswordHandler)
	
	// Admin pages
	adminGroup.GET("", adminDashboardPage)
	adminGroup.GET("/users", func(c echo.Context) error {
		return c.File("templates/admin_users.html")
	})

	// Protected pages
	authGroup.GET("/", homepage)
	authGroup.GET("/history", historyPage)
	authGroup.GET("/notes", notesPage)
	authGroup.GET("/activities", activitiesPage)
	
	// Session CRUD - protected API routes
	authGroup.POST("/api/sessions", createSessionHandler)
	authGroup.GET("/api/sessions", getSessionsHandler)
	authGroup.GET("/api/sessions/:id", getSessionHandler)
	authGroup.PUT("/api/sessions/:id", updateSessionHandler)
	authGroup.DELETE("/api/sessions/:id", deleteSessionHandler)
	authGroup.GET("/api/sessions/tag", getSessionsByTagHandler)

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
	authGroup.GET("/api/notes", getAllNotesHandler)
	authGroup.PUT("/api/notes/:id", updateNoteHandler)
	authGroup.DELETE("/api/notes/:id", deleteNoteHandler)
	
	// Tag CRUD - protected API routes
	authGroup.GET("/api/tags", getTagsHandler)
	authGroup.POST("/api/tags", createTagHandler)
	authGroup.PUT("/api/tags/:id", updateTagHandler)
	authGroup.DELETE("/api/tags/:id", deleteTagHandler)
	
	// Stats routes
	authGroup.GET("/api/stats/monthly-tags", getMonthlyTagStatsHandler)

	adminGroup.GET("/api/db-stats", getDatabaseStatsHandler)
	adminGroup.POST("/api/check-integrity", checkDatabaseIntegrityHandler)

	authGroup.PUT("/api/user/update", updateUserProfileHandler)

	authGroup.GET("/profile", userProfilePage)
	authGroup.PUT("/api/user/update", updateUserProfileHandler)
	
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

// Login page serves the login.html
func loginPage(c echo.Context) error {
	return c.File("templates/login.html")
}

// Admin dashboard page
func adminDashboardPage(c echo.Context) error {
	return c.File("templates/admin.html")
}

func userProfilePage(c echo.Context) error {
	return c.File("templates/profile.html")
}
