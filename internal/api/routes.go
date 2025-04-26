package api

import (
	"pom/internal/api/handlers"
	middleauth "pom/internal/api/middleware"

	"github.com/labstack/echo/v4"
)

func SetupRoutes(e *echo.Echo) {
	// Serve static files
	e.Static("/static", "static")

	// Public routes
	e.POST("/api/login", middleauth.LoginHandler)
	e.GET("/api/auth/status", middleauth.AuthStatusHandler, middleauth.OptionalAuth)
	e.GET("/login", loginPage)
	e.POST("/api/logout", middleauth.LogoutHandler)

	// Create a group for routes that require authentication
	authGroup := e.Group("")
	authMiddleware := middleauth.ConfigureJWTMiddleware()
	authGroup.Use(authMiddleware)

	// User routes
	authGroup.GET("/api/user/current", handlers.GetCurrentUserHandler)

	// Admin routes group - requires admin privileges
	adminGroup := authGroup.Group("/admin")
	adminGroup.Use(middleauth.RequireAdmin)

	// Admin API routes
	adminGroup.GET("/api/users", handlers.GetAllUsersHandler)
	adminGroup.POST("/api/users", handlers.CreateUserHandler)
	adminGroup.PUT("/api/users/:id", handlers.UpdateUserHandler)
	adminGroup.DELETE("/api/users/:id", handlers.DeleteUserHandler)
	adminGroup.PUT("/api/users/:id/admin", handlers.SetAdminHandler)
	adminGroup.POST("/api/users/:id/reset-password", handlers.ResetPasswordHandler)

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
	authGroup.POST("/api/sessions", handlers.CreateSessionHandler)
	authGroup.GET("/api/sessions", handlers.GetSessionsHandler)
	authGroup.GET("/api/sessions/:id", handlers.GetSessionHandler)
	authGroup.PUT("/api/sessions/:id", handlers.UpdateSessionHandler)
	authGroup.DELETE("/api/sessions/:id", handlers.DeleteSessionHandler)
	authGroup.GET("/api/sessions/tag", handlers.GetSessionsByTagHandler)

	// Pomodoro CRUD - protected API routes
	authGroup.POST("/api/pomodoros", handlers.CreatePomodoroHandler)
	authGroup.GET("/api/pomodoros/:session_id", handlers.GetPomodorosHandler)
	authGroup.PUT("/api/pomodoros/:id", handlers.UpdatePomodoroHandler)

	// Break CRUD - protected API routes
	authGroup.POST("/api/breaks", handlers.CreateBreakHandler)
	authGroup.GET("/api/breaks/:session_id", handlers.GetBreaksHandler)
	authGroup.PUT("/api/breaks/:id", handlers.UpdateBreakHandler)

	// Note CRUD - protected API routes
	authGroup.POST("/api/notes", handlers.CreateNoteHandler)
	authGroup.GET("/api/notes/:session_id", handlers.GetNotesHandler)
	authGroup.GET("/api/notes", handlers.GetAllNotesHandler)
	authGroup.PUT("/api/notes/:id", handlers.UpdateNoteHandler)
	authGroup.DELETE("/api/notes/:id", handlers.DeleteNoteHandler)

	// Tag CRUD - protected API routes
	authGroup.GET("/api/tags", handlers.GetTagsHandler)
	authGroup.POST("/api/tags", handlers.CreateTagHandler)
	authGroup.PUT("/api/tags/:id", handlers.UpdateTagHandler)
	authGroup.DELETE("/api/tags/:id", handlers.DeleteTagHandler)

	// Stats routes
	authGroup.GET("/api/stats/monthly-tags", handlers.GetMonthlyTagStatsHandler)

	adminGroup.GET("/api/db-stats", handlers.GetDatabaseStatsHandler)
	adminGroup.POST("/api/check-integrity", handlers.CheckDatabaseIntegrityHandler)

	authGroup.PUT("/api/user/update", handlers.UpdateUserProfileHandler)

	authGroup.GET("/profile", userProfilePage)
	authGroup.PUT("/api/user/update", handlers.UpdateUserProfileHandler)

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
