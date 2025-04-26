package handlers

import (
	"net/http"
	models "pom/internal/db"
	"strconv"

	"github.com/labstack/echo/v4"
)

// Note handlers
func CreateNoteHandler(c echo.Context) error {
	note := new(models.Note)
	if err := c.Bind(note); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	err := models.CreateNote(note.SessionID, note.PomodoroID, note.NoteText)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]string{"message": "Note created successfully"})
}

func GetNotesHandler(c echo.Context) error {
	sessionID, err := strconv.Atoi(c.Param("session_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	notes, err := models.GetNotes(sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func GetAllNotesHandler(c echo.Context) error {
	notes, err := models.GetAllNotes()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func UpdateNoteHandler(c echo.Context) error {
	// Get the note ID from the URL parameter
	noteID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid note ID"})
	}

	// Bind the request body to a Note struct
	note := new(models.Note)
	if err := c.Bind(note); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the note in the database
	if err := models.UpdateNote(noteID, note.NoteText); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Note updated successfully"})
}

func DeleteNoteHandler(c echo.Context) error {
	// Get the note ID from the URL parameter
	noteID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid note ID"})
	}

	// Delete the note from the database
	if err := models.DeleteNote(noteID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Note deleted successfully"})
}
