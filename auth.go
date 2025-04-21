package main

import (
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/labstack/echo/v4"
)

// JWT secret key - in production, this should be securely managed
var jwtSecret = []byte(getEnvWithDefault("JWT_SECRET", "default_jwt_secret_change_this_in_production"))

// Admin credentials
var adminPassword = getEnvWithDefault("ADMIN_PASSWORD", "admin123")

// JWT claims struct
type JwtCustomClaims struct {
	Name  string `json:"name"`
	Admin bool   `json:"admin"`
	jwt.StandardClaims
}

// Auth request structure
type LoginRequest struct {
	Password string `json:"password"`
}

// Get environment variable with default fallback
func getEnvWithDefault(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

// Login handler
func loginHandler(c echo.Context) error {
	var loginReq LoginRequest
	if err := c.Bind(&loginReq); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Check if password matches
	if loginReq.Password != adminPassword {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid credentials"})
	}

	// Set custom claims
	claims := &JwtCustomClaims{
		"admin",
		true,
		jwt.StandardClaims{
			ExpiresAt: time.Now().Add(time.Hour * 72).Unix(), // Token valid for 3 days
		},
	}

	// Create token with claims
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Generate encoded token
	tokenString, err := token.SignedString(jwtSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Could not generate token"})
	}

	// Return the token
	return c.JSON(http.StatusOK, map[string]string{
		"token": tokenString,
	})
}

// Check auth status
func authStatusHandler(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusOK, map[string]bool{"authenticated": false})
	}
	return c.JSON(http.StatusOK, map[string]bool{"authenticated": true})
}

// Configure JWT middleware
func configureJWTMiddleware() echo.MiddlewareFunc {
	// Create a custom middleware function
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get the auth cookie
			authCookie, err := c.Cookie("auth_token")
			if err != nil || authCookie == nil || authCookie.Value == "" {
				return echo.NewHTTPError(http.StatusUnauthorized, "Please login to continue")
			}
			
			// Parse and validate the token
			token, err := jwt.ParseWithClaims(authCookie.Value, &JwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
				return jwtSecret, nil
			})
			
			if err != nil || !token.Valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
			}
			
			// Token is valid, set it in context
			c.Set("user", token)
			return next(c)
		}
	}
}

// Optional auth middleware - doesn't require auth but sets user if available
func optionalAuth(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		authCookie, err := c.Cookie("auth_token")
		if err == nil && authCookie != nil && authCookie.Value != "" {
			token, err := jwt.ParseWithClaims(authCookie.Value, &JwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
				return jwtSecret, nil
			})
			
			if err == nil && token.Valid {
				c.Set("user", token)
			}
		}
		return next(c)
	}
}
