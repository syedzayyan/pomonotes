package main

import (
	"github.com/labstack/echo/v4"
)

func setupRoutes(e *echo.Echo) {
	// Serve static files (CSS, JS, etc.)
	e.Static("/static", "static")

	// Serve the homepage and other HTML pages
	e.GET("/", homepage)
	e.GET("/history", historyPage)
	e.GET("/notes", notesPage)

	// Session CRUD
	e.POST("/api/sessions", createSessionHandler)
	e.GET("/api/sessions", getSessionsHandler)
	e.GET("/api/sessions/:id", getSessionHandler)
	e.PUT("/api/sessions/:id", updateSessionHandler)
	e.DELETE("/api/sessions/:id", deleteSessionHandler)

	// Pomodoro CRUD
	e.POST("/api/pomodoros", createPomodoroHandler)
	e.GET("/api/pomodoros/:session_id", getPomodorosHandler)
	e.PUT("/api/pomodoros/:id", updatePomodoroHandler)

	// Break CRUD
	e.POST("/api/breaks", createBreakHandler)
	e.GET("/api/breaks/:session_id", getBreaksHandler)
	e.PUT("/api/breaks/:id", updateBreakHandler)

	// Note CRUD
	e.POST("/api/notes", createNoteHandler)
	e.GET("/api/notes/:session_id", getNotesHandler)
	e.GET("/api/notes", getAllNotesHandler)  // Get all notes for browsing
	e.PUT("/api/notes/:id", updateNoteHandler)
	e.DELETE("/api/notes/:id", deleteNoteHandler)
	
	// For the PWA
	e.GET("/manifest.json", func(c echo.Context) error {
		return c.File("static/manifest.json")
	})
}

// Homepage serves the index.html
func homepage(c echo.Context) error {
	return c.File("web/index.html")
}

// History page serves the history.html
func historyPage(c echo.Context) error {
	return c.File("web/history.html")
}

// Notes page serves the notes.html
func notesPage(c echo.Context) error {
	return c.File("web/notes.html")
}
