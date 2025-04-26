package handlers

import (
	"log"
	"net/http"
	middleauth "pom/internal/api/middleware"
	models "pom/internal/db"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
)

// Session handlers
func CreateSessionHandler(c echo.Context) error {
	session := new(models.Session)
	if err := c.Bind(session); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Get current user ID
	currentUser, err := middleauth.GetCurrentUser(c)
	if err != nil {
		// If there's an error getting the user, use the session without a user ID
		log.Printf("Warning: Creating session without user ID: %v", err)
	}

	// Create a new session with tags
	var sessionID int64
	if err == nil {
		// Create session with user ID
		sessionID, err = models.CreateSessionWithUser(session.StartTime, session.Tags, currentUser.ID)
	} else {
		// Create session without user ID (fallback)
		sessionID, err = models.CreateSession(session.StartTime, session.Tags)
	}

	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new session ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Session created successfully",
		"id":      sessionID,
	})
}

func GetSessionsHandler(c echo.Context) error {
	// Get current user
	currentUser, err := middleauth.GetCurrentUser(c)
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
		sessions, err := models.GetSessionsByTagForUser(tag, currentUser.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, sessions)
	}

	// If date range provided, filter by date
	if rangeParam != "" {
		// Get start and end dates based on range parameter
		startDate, endDate := getDateRangeFromParam(rangeParam)
		sessions, err := models.GetSessionsByDateRangeForUser(startDate, endDate, currentUser.ID)
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
		}
		return c.JSON(http.StatusOK, sessions)
	}

	// Otherwise get sessions for the specified number of days
	sessions, err := models.GetSessionsByDaysForUser(days, currentUser.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, sessions)
}

func GetSessionHandler(c echo.Context) error {
	// Get current user
	currentUser, err := middleauth.GetCurrentUser(c)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
	}

	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	// Get the session
	session, err := models.GetSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
	}

	// Check if admin or session owner
	if !currentUser.IsAdmin {
		// Check session ownership
		isOwner, err := models.IsSessionOwner(id, currentUser.ID)
		if err != nil || !isOwner {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "You don't have permission to access this session"})
		}
	}

	return c.JSON(http.StatusOK, session)
}

func UpdateSessionHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	// Get existing session
	_, err = models.GetSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
	}

	// Update session
	session := new(models.Session)
	if err := c.Bind(session); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Call the updateSession function with the id parameter and tags
	err = models.UpdateSession(id, session.EndTime, session.TotalTime, session.Status, session.Completed, session.Tags)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Session updated successfully"})
}

func DeleteSessionHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	// Check if session exists
	_, err = models.GetSession(id)
	if err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Session not found"})
	}

	// Call the deleteSession function to remove the session and related notes
	if err := models.DeleteSession(id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Session deleted successfully"})
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
