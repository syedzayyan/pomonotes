package handlers

import (
	"net/http"
	models "pom/internal/db"
	"strconv"

	"github.com/labstack/echo/v4"
)

// Pomodoro handlers
func CreatePomodoroHandler(c echo.Context) error {
	pomodoro := new(models.Pomodoro)
	if err := c.Bind(pomodoro); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create new pomodoro
	pomodoroID, err := models.CreatePomodoro(pomodoro.SessionID, pomodoro.Number, pomodoro.StartTime, pomodoro.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new pomodoro ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Pomodoro created successfully",
		"id":      pomodoroID,
	})
}

func GetPomodorosHandler(c echo.Context) error {
	sessionID, err := strconv.Atoi(c.Param("session_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	pomodoros, err := models.GetPomodoros(sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, pomodoros)
}

func UpdatePomodoroHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid pomodoro ID"})
	}

	pomodoro := new(models.Pomodoro)
	if err := c.Bind(pomodoro); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the pomodoro
	err = models.UpdatePomodoro(id, pomodoro.EndTime, pomodoro.Duration, pomodoro.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Pomodoro updated successfully"})
}

// Break handlers
func CreateBreakHandler(c echo.Context) error {
	breakItem := new(models.Break)
	if err := c.Bind(breakItem); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create new break
	breakID, err := models.CreateBreak(breakItem.SessionID, breakItem.PomodoroID, breakItem.Type, breakItem.StartTime, breakItem.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new break ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Break created successfully",
		"id":      breakID,
	})
}

func GetBreaksHandler(c echo.Context) error {
	sessionID, err := strconv.Atoi(c.Param("session_id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid session ID"})
	}

	breaks, err := models.GetBreaks(sessionID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, breaks)
}

func UpdateBreakHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid break ID"})
	}

	breakItem := new(models.Break)
	if err := c.Bind(breakItem); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the break
	err = models.UpdateBreak(id, breakItem.EndTime, breakItem.Duration, breakItem.Status)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Break updated successfully"})
}
