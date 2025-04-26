package handlers

import (
	"net/http"
	models "pom/internal/db"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// Helper function for session tags
func ParseTagsFromQueryParam(tagsParam string) []string {
	if tagsParam == "" {
		return []string{}
	}

	tags := strings.Split(tagsParam, ",")
	for i, tag := range tags {
		tags[i] = strings.TrimSpace(tag)
	}

	return tags
}

// Tag handlers
func GetTagsHandler(c echo.Context) error {
	tags, err := models.GetTags()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}
	return c.JSON(http.StatusOK, tags)
}

// Get monthly stats for each tag
func GetMonthlyTagStatsHandler(c echo.Context) error {
	yearStr := c.QueryParam("year")
	if yearStr == "" {
		// Default to current year
		yearStr = strconv.Itoa(models.GetCurrentYear())
	}

	year, err := strconv.Atoi(yearStr)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid year parameter"})
	}

	stats, err := models.GetMonthlyTagStats(year)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, stats)
}

func CreateTagHandler(c echo.Context) error {
	tag := new(models.Tag)
	if err := c.Bind(tag); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Create new tag
	tagID, err := models.CreateTag(tag.Name, tag.Color)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	// Return the new tag ID
	return c.JSON(http.StatusCreated, map[string]interface{}{
		"message": "Tag created successfully",
		"id":      tagID,
	})
}

func UpdateTagHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid tag ID"})
	}

	tag := new(models.Tag)
	if err := c.Bind(tag); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request data"})
	}

	// Update the tag
	err = models.UpdateTag(id, tag.Name, tag.Color)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Tag updated successfully"})
}

func DeleteTagHandler(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid tag ID"})
	}

	// Delete the tag
	err = models.DeleteTag(id)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Tag deleted successfully"})
}

// Get sessions by tag
func GetSessionsByTagHandler(c echo.Context) error {
	tag := c.QueryParam("tag")
	if tag == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Tag parameter is required"})
	}

	sessions, err := models.GetSessionsByTag(tag)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": err.Error()})
	}

	return c.JSON(http.StatusOK, sessions)
}
