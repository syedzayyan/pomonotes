package main

import (
	"net/http"
	"strconv"
	"github.com/labstack/echo/v4"
)

// Session handlers
func createSessionHandler(c echo.Context) error {
	session := new(Session)
	if err := c.Bind(session); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create a new session
	sessionID, err := createSession(session.StartTime)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new session ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Session created successfully",
		"id": sessionID,
	})
}

func getSessionsHandler(c echo.Context) error {
	sessions, err := getSessions()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, sessions)
}

func getSessionHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	session, err := getSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
	}

	return c.JSON(http.StatusOK, session)
}
func updateSessionHandler(c echo.Context) error {
    id, err := strconv.Atoi(c.Param("id"))
    if err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
    }

    // Get existing session
    _, err = getSession(id)
    if err != nil {
        return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
    }

    // Update session
    session := new(Session)
    if err := c.Bind(session); err != nil {
        return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
    }

    // Call the updateSession function with the id parameter
    err = updateSession(id, session.EndTime, session.TotalTime, session.Status, session.Completed)
    if err != nil {
        return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
    }

    return c.JSON(http.StatusOK, map[string]string{"message": "Session updated successfully"})
}
func deleteSessionHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	// Check if session exists
	_, err = getSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
	}

	// Call the deleteSession function to remove the session and related notes
	if err := deleteSession(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Session deleted successfully"})
}

// Pomodoro handlers
func createPomodoroHandler(c echo.Context) error {
	pomodoro := new(Pomodoro)
	if err := c.Bind(pomodoro); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create new pomodoro
	pomodoroID, err := createPomodoro(pomodoro.SessionID, pomodoro.Number, pomodoro.StartTime, pomodoro.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new pomodoro ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Pomodoro created successfully",
		"id": pomodoroID,
	})
}

func getPomodorosHandler(c echo.Context) error {
	sessionID, err := strconv.Atoi(c.Param("session_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	pomodoros, err := getPomodoros(sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, pomodoros)
}

func updatePomodoroHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid pomodoro ID"})
	}

	pomodoro := new(Pomodoro)
	if err := c.Bind(pomodoro); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the pomodoro
	err = updatePomodoro(id, pomodoro.EndTime, pomodoro.Duration, pomodoro.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Pomodoro updated successfully"})
}

// Break handlers
func createBreakHandler(c echo.Context) error {
	breakItem := new(Break)
	if err := c.Bind(breakItem); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create new break
	breakID, err := createBreak(breakItem.SessionID, breakItem.PomodoroID, breakItem.Type, breakItem.StartTime, breakItem.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new break ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Break created successfully",
		"id": breakID,
	})
}

func getBreaksHandler(c echo.Context) error {
	sessionID, err := strconv.Atoi(c.Param("session_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	breaks, err := getBreaks(sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, breaks)
}

func updateBreakHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid break ID"})
	}

	breakItem := new(Break)
	if err := c.Bind(breakItem); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the break
	err = updateBreak(id, breakItem.EndTime, breakItem.Duration, breakItem.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Break updated successfully"})
}

// Note handlers
func createNoteHandler(c echo.Context) error {
	note := new(Note)
	if err := c.Bind(note); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	err := createNote(note.SessionID, note.PomodoroID, note.NoteText)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusCreated, map[string]string{"message": "Note created successfully"})
}

func getNotesHandler(c echo.Context) error {
	sessionID, err := strconv.Atoi(c.Param("session_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	notes, err := getNotes(sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func getAllNotesHandler(c echo.Context) error {
	notes, err := getAllNotes()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, notes)
}

func updateNoteHandler(c echo.Context) error {
	// Get the note ID from the URL parameter
	noteID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid note ID"})
	}
	
	// Bind the request body to a Note struct
	note := new(Note)
	if err := c.Bind(note); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}
	
	// Update the note in the database
	if err := updateNote(noteID, note.NoteText); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusOK, map[string]string{"message": "Note updated successfully"})
}

func deleteNoteHandler(c echo.Context) error {
	// Get the note ID from the URL parameter
	noteID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid note ID"})
	}
	
	// Delete the note from the database
	if err := deleteNote(noteID); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	
	return c.JSON(http.StatusOK, map[string]string{"message": "Note deleted successfully"})
}
