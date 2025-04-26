package middleauth

import (
	"net/http"
	"os"
	models "pom/internal/db"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"github.com/labstack/echo/v4"

	"errors"
	"strings"
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
	Username string `json:"username"`
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
func LoginHandler(c echo.Context) error {
	var loginReq LoginRequest
	if err := c.Bind(&loginReq); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Validate credentials
	user, err := models.ValidateCredentials(loginReq.Username, loginReq.Password)
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": err.Error()})
	}

	// Update last login time
	models.UpdateLastLogin(user.ID)

	// Set custom claims
	claims := &JwtCustomClaims{
		user.Username,
		user.IsAdmin,
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

	// Set token as an HTTP-only cookie
	cookie := new(http.Cookie)
	cookie.Name = "auth_token"
	cookie.Value = tokenString
	cookie.Expires = time.Now().Add(72 * time.Hour)
	cookie.Path = "/"
	cookie.HttpOnly = true
	c.SetCookie(cookie)

	// Return the token and user info
	return c.JSON(http.StatusOK, map[string]interface{}{
		"token": tokenString,
		"user": map[string]interface{}{
			"id":       user.ID,
			"username": user.Username,
			"isAdmin":  user.IsAdmin,
		},
	})
}
func LogoutHandler(c echo.Context) error {
	// Clear the auth cookie
	cookie := new(http.Cookie)
	cookie.Name = "auth_token"
	cookie.Value = ""
	cookie.Expires = time.Now().Add(-1 * time.Hour) // Expired
	cookie.Path = "/"
	cookie.HttpOnly = true
	c.SetCookie(cookie)

	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func GetCurrentUser(c echo.Context) (models.User, error) {
	userToken := c.Get("user")
	if userToken == nil {
		return models.User{}, errors.New("user not authenticated")
	}

	token, ok := userToken.(*jwt.Token)
	if !ok {
		return models.User{}, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*JwtCustomClaims)
	if !ok {
		return models.User{}, errors.New("invalid claims")
	}

	user, err := models.GetUserByUsername(claims.Name)
	if err != nil {
		return models.User{}, err
	}

	return user, nil
}

func RequireAdmin(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		user, err := GetCurrentUser(c)
		if err != nil {
			return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authentication required"})
		}

		if !user.IsAdmin {
			return c.JSON(http.StatusForbidden, map[string]string{"error": "Admin privileges required"})
		}

		return next(c)
	}
}

// Check auth status
func AuthStatusHandler(c echo.Context) error {
	user := c.Get("user")
	if user == nil {
		return c.JSON(http.StatusOK, map[string]bool{"authenticated": false})
	}
	return c.JSON(http.StatusOK, map[string]bool{"authenticated": true})
}

func ConfigureJWTMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get the auth cookie
			authCookie, err := c.Cookie("auth_token")
			if err != nil || authCookie == nil || authCookie.Value == "" {
				// Check if this is an API request or a page request
				if strings.HasPrefix(c.Request().URL.Path, "/api/") {
					// For API requests, return 401 Unauthorized
					return echo.NewHTTPError(http.StatusUnauthorized, "Please login to continue")
				} else {
					// For page requests, redirect to login page
					return c.Redirect(http.StatusFound, "/login")
				}
			}

			// Parse and validate the token
			token, err := jwt.ParseWithClaims(authCookie.Value, &JwtCustomClaims{}, func(token *jwt.Token) (interface{}, error) {
				return jwtSecret, nil
			})

			if err != nil || !token.Valid {
				// Check if this is an API request or a page request
				if strings.HasPrefix(c.Request().URL.Path, "/api/") {
					// For API requests, return 401 Unauthorized
					return echo.NewHTTPError(http.StatusUnauthorized, "Invalid or expired token")
				} else {
					// For page requests, redirect to login page
					return c.Redirect(http.StatusFound, "/login")
				}
			}

			// Token is valid, set it in context
			c.Set("user", token)
			return next(c)
		}
	}
}

// Optional auth middleware - doesn't require auth but sets user if available
func OptionalAuth(next echo.HandlerFunc) echo.HandlerFunc {
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
