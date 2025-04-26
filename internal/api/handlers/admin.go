package handlers

import (
	"net/http"
	models "pom/internal/db"

	"github.com/labstack/echo/v4"
)

// Get database stats for admin dashboard
func GetDatabaseStatsHandler(c echo.Context) error {
	stats := models.GetDatabaseStats()
	return c.JSON(http.StatusOK, stats)
}

// Check database integrity
func CheckDatabaseIntegrityHandler(c echo.Context) error {
	integrity, err := models.CheckDatabaseIntegrity()
	if err != nil {
		return c.HTML(http.StatusOK, `<div class="alert-error">Error checking integrity: `+err.Error()+`</div>`)
	}

	if integrity {
		return c.HTML(http.StatusOK, `<div class="alert-success">Database integrity check passed!</div>`)
	} else {
		return c.HTML(http.StatusOK, `<div class="alert-error">Database integrity check failed. Please backup your data and consider rebuilding the database.</div>`)
	}
}
