package main

import (
	"net/http"
	"strconv"
	"time"
	"strings"
	"github.com/labstack/echo/v4"
	"log"
)

// Session handlers
func createSessionHandler(c echo.Context) error {
	session := new(Session)
	if err := c.Bind(session); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Get current user ID
	currentUser, err := getCurrentUser(c)
	if err != nil {
		// If there's an error getting the user, use the session without a user ID
		log.Printf("Warning: Creating session without user ID: %v", err)
	}

	// Create a new session with tags
	var sessionID int64
	if err == nil {
		// Create session with user ID
		sessionID, err = createSessionWithUser(session.StartTime, session.Tags, currentUser.ID)
	} else {
		// Create session without user ID (fallback)
		sessionID, err = createSession(session.StartTime, session.Tags)
	}
	
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new session ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Session created successfully",
		"id": sessionID,
	})
}

// Update this in handlers.go

// Modify getSessionsHandler to limit data by default
func getSessionsHandler(c echo.Context) error {
	// Get current user
	currentUser, err := getCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
	}
	
	// Parse query parameters
	tag := c.QueryParam("tag")
	rangeParam := c.QueryParam("range")
	daysParam := c.QueryParam("days")
	
	// Default to 7 days if not specified
	days := 7
	if daysParam != "" {
		parsedDays, err := strconv.Atoi(daysParam)
		if err == nil && parsedDays > 0 {
			days = parsedDays
		}
	}
	
	// If tag filter provided, get sessions by tag
	if tag != "" {
		sessions, err := getSessionsByTagForUser(tag, currentUser.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, sessions)
	}
	
	// If date range provided, filter by date
	if rangeParam != "" {
		// Get start and end dates based on range parameter
		startDate, endDate := getDateRangeFromParam(rangeParam)
		sessions, err := getSessionsByDateRangeForUser(startDate, endDate, currentUser.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, sessions)
	}
	
	// Otherwise get sessions for the specified number of days
	sessions, err := getSessionsByDaysForUser(days, currentUser.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, sessions)
}



func getSessionHandler(c echo.Context) error {
	// Get current user
	currentUser, err := getCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	// Get the session
	session, err := getSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
	}

	// Check if admin or session owner
	if !currentUser.IsAdmin {
		// Check session ownership
		isOwner, err := isSessionOwner(id, currentUser.ID)
		if err != nil || !isOwner {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "You don't have permission to access this session"})
		}
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

    // Call the updateSession function with the id parameter and tags
    err = updateSession(id, session.EndTime, session.TotalTime, session.Status, session.Completed, session.Tags)
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

// Tag handlers
func getTagsHandler(c echo.Context) error {
	tags, err := getTags()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, tags)
}

func createTagHandler(c echo.Context) error {
	tag := new(Tag)
	if err := c.Bind(tag); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create new tag
	tagID, err := createTag(tag.Name, tag.Color)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new tag ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Tag created successfully",
		"id": tagID,
	})
}

func updateTagHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid tag ID"})
	}

	tag := new(Tag)
	if err := c.Bind(tag); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the tag
	err = updateTag(id, tag.Name, tag.Color)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Tag updated successfully"})
}

func deleteTagHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid tag ID"})
	}

	// Delete the tag
	err = deleteTag(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Tag deleted successfully"})
}

// Get sessions by tag
func getSessionsByTagHandler(c echo.Context) error {
	tag := c.QueryParam("tag")
	if tag == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tag parameter is required"})
	}

	sessions, err := getSessionsByTag(tag)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, sessions)
}

// Get monthly stats for each tag
func getMonthlyTagStatsHandler(c echo.Context) error {
	yearStr := c.QueryParam("year")
	if yearStr == "" {
		// Default to current year
		yearStr = strconv.Itoa(getCurrentYear())
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid year parameter"})
	}

	stats, err := getMonthlyTagStats(year)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, stats)
}

// Helper function to get start and end dates from range parameter
func getDateRangeFromParam(rangeParam string) (string, string) {
	now := time.Now()
	var startDate time.Time
	
	// Default end date is today at 23:59:59
	endDate := time.Date(now.Year(), now.Month(), now.Day(), 23, 59, 59, 999999999, now.Location())
	
	// Set start date based on range parameter
	switch rangeParam {
	case "7days":
		startDate = now.AddDate(0, 0, -7) // Last 7 days
	case "30days":
		startDate = now.AddDate(0, 0, -30) // Last 30 days
	case "90days":
		startDate = now.AddDate(0, 0, -90) // Last 90 days
	case "year":
		startDate = time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location()) // Start of this year
	case "all":
		startDate = time.Date(2000, 1, 1, 0, 0, 0, 0, now.Location()) // Far in the past to get all
	default:
		startDate = now.AddDate(0, 0, -30) // Default to last 30 days
	}
	
	// Format as ISO8601 strings for SQLite
	startDateStr := startDate.Format("2006-01-02T15:04:05.999Z")
	endDateStr := endDate.Format("2006-01-02T15:04:05.999Z")
	
	return startDateStr, endDateStr
}

// Helper function to get current year
func getCurrentYear() int {
	var year int
	row := db.QueryRow("SELECT strftime('%Y', 'now')")
	err := row.Scan(&year)
	if err != nil {
		return time.Now().Year() // Fallback to Go's time package
	}
	return year
}

// Helper function for session tags
func parseTagsFromQueryParam(tagsParam string) []string {
	if tagsParam == "" {
		return []string{}
	}
	
	tags := strings.Split(tagsParam, ",")
	for i, tag := range tags {
		tags[i] = strings.TrimSpace(tag)
	}
	
	return tags
}
