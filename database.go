package main

import (
    "crypto/rand"
    "database/sql"
    "encoding/base64"
    "errors"
    "fmt"
    "log"
    "strings"
    "time"
    
    _ "github.com/mattn/go-sqlite3"
    "golang.org/x/crypto/bcrypt"
)

var db *sql.DB

// Data structures
type Session struct {
	ID          int     `json:"id"`
	StartTime   string  `json:"start_time"`
	EndTime     *string `json:"end_time"`
	TotalTime   int     `json:"total_time"`
	Status      string  `json:"status"`
	Completed   int     `json:"completed_pomodoros"`
	Tags        string  `json:"tags"` // Comma-separated tag list
}

type Pomodoro struct {
	ID          int    `json:"id"`
	SessionID   int    `json:"session_id"`
	Number      int    `json:"number"`  // 1-4 for the 4 pomodoros in a session
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Duration    int    `json:"duration"` // In seconds
	Status      string `json:"status"`   // "completed", "stopped", "running"
}

type Break struct {
	ID          int    `json:"id"`
	SessionID   int    `json:"session_id"`
	PomodoroID  int    `json:"pomodoro_id"` // Which pomodoro it follows
	Type        string `json:"type"`        // "short" or "long"
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	Duration    int    `json:"duration"`    // In seconds
	Status      string `json:"status"`      // "completed", "stopped", "running"
}

type Note struct {
	ID          int    `json:"id"`
	SessionID   int    `json:"session_id"`
	PomodoroID  int    `json:"pomodoro_id"`  // Which pomodoro it's associated with (can be null)
	NoteText    string `json:"note"`
	CreatedAt   string `json:"created_at"`
}

type Tag struct {
	ID       int    `json:"id"`
	Name     string `json:"name"`
	Color    string `json:"color"`
	UsageCount int  `json:"usage_count"`
}

// User struct
type User struct {
	ID           int     `json:"id"`
	Username     string  `json:"username"`
	PasswordHash string  `json:"-"` // Never send to client
	Email        *string `json:"email"`
	IsAdmin      bool    `json:"is_admin"`
	CreatedAt    string  `json:"created_at"`
	LastLogin    *string `json:"last_login"`
	AccountStatus string  `json:"account_status"`
}

// For registration and updating users
type UserInput struct {
	Username string  `json:"username"`
	Password string  `json:"password"`
	Email    *string `json:"email"`
	IsAdmin  bool    `json:"is_admin"`
}

// Initialize the database with tables if not already created
func initDB() {
    var err error
    // Open database connection
    db, err = sql.Open("sqlite3", "./pomonotes.db")
    if err != nil {
        fmt.Println("Error opening database:", err)
        return
    }

    // Enable foreign keys
    _, err = db.Exec("PRAGMA foreign_keys = ON")
    if err != nil {
        fmt.Println("Error enabling foreign keys:", err)
    }

    // Create tables with initial schema
    createInitialSchema()
    
    // Run migrations to add any new columns
    migrateSchema()
    
    fmt.Println("Database initialization and migration complete")
}

// Initial schema creation
func createInitialSchema() {
    tableQueries := map[string]string{
        "sessions": `
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                start_time TEXT,
                end_time TEXT,
                total_time INTEGER DEFAULT 0,
                status TEXT,
                completed_pomodoros INTEGER DEFAULT 0,
                tags TEXT,
                user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL
            )
        `,
        "pomodoros": `
            CREATE TABLE IF NOT EXISTS pomodoros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                number INTEGER,
                start_time TEXT,
                end_time TEXT,
                duration INTEGER,
                status TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
            )
        `,
        "breaks": `
            CREATE TABLE IF NOT EXISTS breaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                pomodoro_id INTEGER,
                type TEXT,
                start_time TEXT,
                end_time TEXT,
                duration INTEGER,
                status TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (pomodoro_id) REFERENCES pomodoros(id) ON DELETE CASCADE
            )
        `,
        "notes": `
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                pomodoro_id INTEGER,
                note TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (pomodoro_id) REFERENCES pomodoros(id) ON DELETE CASCADE
            )
        `,
        "tags": `
            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE,
                color TEXT,
                usage_count INTEGER DEFAULT 0
            )
        `,
        "users": `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                email TEXT UNIQUE,
                is_admin BOOLEAN DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                last_login TEXT,
                account_status TEXT DEFAULT 'active'
            )
        `,
        "session_tags": `
            CREATE TABLE IF NOT EXISTS session_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
                UNIQUE(session_id, tag_id)
            )
        `,
    }
    
    // Execute each table creation query
    for tableName, query := range tableQueries {
        _, err := db.Exec(query)
        if err != nil {
            log.Printf("Error creating %s table: %v\n", tableName, err)
        } else {
            log.Printf("Created or verified %s table\n", tableName)
        }
    }
    
    // Create indexes for better performance
    indexQueries := map[string]string{
        "idx_session_start_time": "CREATE INDEX IF NOT EXISTS idx_session_start_time ON sessions(start_time)",
        "idx_session_user_id": "CREATE INDEX IF NOT EXISTS idx_session_user_id ON sessions(user_id)",
        "idx_session_tags_session_id": "CREATE INDEX IF NOT EXISTS idx_session_tags_session_id ON session_tags(session_id)",
        "idx_session_tags_tag_id": "CREATE INDEX IF NOT EXISTS idx_session_tags_tag_id ON session_tags(tag_id)",
        "idx_users_username": "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
    }
    
    // Execute each index creation query
    for indexName, query := range indexQueries {
        _, err := db.Exec(query)
        if err != nil {
            log.Printf("Error creating %s index: %v\n", indexName, err)
        } else {
            log.Printf("Created or verified %s index\n", indexName)
        }
    }
}

// Define and run migrations
func migrateSchema() {
    // List of migrations to run
    migrations := []struct {
        table       string
        check       string
        migration   string
        description string
    }{
        {
            table:       "sessions",
            check:       "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name='tags'",
            migration:   "ALTER TABLE sessions ADD COLUMN tags TEXT",
            description: "Add tags column to sessions table",
        },
        {
            table:       "pomodoros",
            check:       "SELECT COUNT(*) FROM pragma_table_info('pomodoros') WHERE name='notes'",
            migration:   "ALTER TABLE pomodoros ADD COLUMN notes TEXT",
            description: "Add notes column to pomodoros table",
        },
        {
            table:       "sessions",
            check:       "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name='project_id'",
            migration:   "ALTER TABLE sessions ADD COLUMN project_id INTEGER DEFAULT NULL",
            description: "Add project_id column to sessions table",
        },
        // New migrations for the user management system
        {
            table:       "sessions",
            check:       "SELECT COUNT(*) FROM pragma_table_info('sessions') WHERE name='user_id'",
            migration:   "ALTER TABLE sessions ADD COLUMN user_id INTEGER DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL",
            description: "Add user_id column to sessions table for ownership",
        },
        {
            table:       "users",
            check:       "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='account_status'",
            migration:   "ALTER TABLE users ADD COLUMN account_status TEXT DEFAULT 'active'",
            description: "Add account_status column to users table",
        },
    }

    // Run each migration if needed
    for _, m := range migrations {
        var count int
        row := db.QueryRow(m.check)
        err := row.Scan(&count)
        if err != nil {
            log.Printf("Error checking migration for %s (%s): %v\n", 
                m.table, m.description, err)
            continue
        }

        if count == 0 {
            // Column doesn't exist, apply migration
            _, err = db.Exec(m.migration)
            if err != nil {
                log.Printf("Error applying migration to %s (%s): %v\n", 
                    m.table, m.description, err)
            } else {
                log.Printf("Migration applied: %s\n", m.description)
            }
        }
    }
}

// Add table statistics function for database health checks
func getDatabaseStats() map[string]int {
    tables := []string{"sessions", "pomodoros", "breaks", "notes", "tags"}
    stats := make(map[string]int)
    
    for _, table := range tables {
        var count int
        query := fmt.Sprintf("SELECT COUNT(*) FROM %s", table)
        err := db.QueryRow(query).Scan(&count)
        if err != nil {
            fmt.Printf("Error getting count for %s: %v\n", table, err)
            stats[table] = -1 // Indicate error
        } else {
            stats[table] = count
        }
    }
    
    return stats
}

// Add function to check database integrity
func checkDatabaseIntegrity() (bool, error) {
    rows, err := db.Query("PRAGMA integrity_check")
    if err != nil {
        return false, err
    }
    defer rows.Close()
    
    if rows.Next() {
        var result string
        if err := rows.Scan(&result); err != nil {
            return false, err
        }
        return result == "ok", nil
    }
    
    return false, fmt.Errorf("no result from integrity check")
}

// Session CRUD functions

func createSession(startTime string, tags string) (int64, error) {
	statement, err := db.Prepare("INSERT INTO sessions(start_time, status, completed_pomodoros, tags) VALUES (?, ?, ?, ?)")
	if err != nil {
		return 0, err
	}
	result, err := statement.Exec(startTime, "running", 0, tags)
	if err != nil {
		return 0, err
	}
	
	// Update tag usage counts
	if tags != "" {
		updateTagCounts(tags)
	}
	
	return result.LastInsertId()
}

func getSessions() ([]Session, error) {
	rows, err := db.Query("SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags FROM sessions ORDER BY id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString // Use NullString to handle NULL values

		// Scan using the nullable type for tags
		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		// Set tags to empty string if NULL or the actual value if not NULL
		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}

func getSession(id int) (Session, error) {
    row := db.QueryRow("SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags FROM sessions WHERE id = ?", id)
    var session Session
    var tagsNullable sql.NullString // Use NullString to handle NULL values

    err := row.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
    if err != nil {
        return session, err
    }

    // Set tags to empty string if NULL or the actual value if not NULL
    if tagsNullable.Valid {
        session.Tags = tagsNullable.String
    } else {
        session.Tags = ""
    }

    return session, nil
}
func updateSession(id int, endTime *string, totalTime int, status string, completedPomodoros int, tags string) error {
    // If tags are updated, update the tag usage counts
    if tags != "" {
        // Get the current tags to see what changed
        currentSession, err := getSession(id)
        if err == nil && currentSession.Tags != tags {
            // Decrement old tags and increment new ones
            if currentSession.Tags != "" {
                decrementTagCounts(currentSession.Tags)
            }
            updateTagCounts(tags)
        }
    }
    
    statement, err := db.Prepare("UPDATE sessions SET end_time = ?, total_time = ?, status = ?, completed_pomodoros = ?, tags = ? WHERE id = ?")
    if err != nil {
        return err
    }
    
    // Dereference the pointer or use NULL if it's nil
    var endTimeValue interface{} = nil
    if endTime != nil {
        endTimeValue = *endTime
    }
    
    _, err = statement.Exec(endTimeValue, totalTime, status, completedPomodoros, tags, id)
    return err
}

// Enhanced function to update session tags
func updateSessionTags(sessionID int, newTags string) error {
    // Begin transaction
    tx, err := db.Begin()
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    
    defer func() {
        if err != nil {
            tx.Rollback()
        }
    }()
    
    // Get current tags
    var currentTags string
    err = tx.QueryRow("SELECT tags FROM sessions WHERE id = ?", sessionID).Scan(&currentTags)
    if err != nil {
        return fmt.Errorf("failed to get current tags: %w", err)
    }
    
    // Only update if tags have changed
    if currentTags != newTags {
        // Decrement old tags
        if currentTags != "" {
            decrementTagCounts(currentTags)
        }
        
        // Increment new tags
        if newTags != "" {
            updateTagCounts(newTags)
        }
        
        // Update the session
        _, err = tx.Exec("UPDATE sessions SET tags = ? WHERE id = ?", newTags, sessionID)
        if err != nil {
            return fmt.Errorf("failed to update session tags: %w", err)
        }
    }
    
    // Commit transaction
    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }
    
    return nil
}

// Delete session and all related data (improved with transaction support)
func deleteSession(id int) error {
    // Get session to decrement tag counts before deletion
    session, err := getSession(id)
    if err != nil {
        // If we can't get the session, it might not exist
        return fmt.Errorf("session not found: %w", err)
    }

    // Begin a transaction
    tx, err := db.Begin()
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    
    // Use defer with a named error return to handle rollback/commit
    defer func() {
        if err != nil {
            tx.Rollback()
        }
    }()

    // Decrement tag counts if applicable
    if session.Tags != "" {
        decrementTagCounts(session.Tags)
    }
    
    // Delete all related data within the transaction
    deleteQueries := []struct {
        query string
        description string
    }{
        {"DELETE FROM breaks WHERE session_id = ?", "breaks"},
        {"DELETE FROM pomodoros WHERE session_id = ?", "pomodoros"},
        {"DELETE FROM notes WHERE session_id = ?", "notes"},
        {"DELETE FROM sessions WHERE id = ?", "session"},
    }
    
    for _, dq := range deleteQueries {
        _, err = tx.Exec(dq.query, id)
        if err != nil {
            return fmt.Errorf("failed to delete %s: %w", dq.description, err)
        }
    }
    
    // Commit the transaction
    if err = tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit transaction: %w", err)
    }
    
    return nil
}

// Tag CRUD functions

func createTag(name string, color string) (int64, error) {
	statement, err := db.Prepare("INSERT INTO tags(name, color, usage_count) VALUES (?, ?, ?)")
	if err != nil {
		return 0, err
	}
	result, err := statement.Exec(name, color, 0)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func getTags() ([]Tag, error) {
	rows, err := db.Query("SELECT id, name, color, usage_count FROM tags ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []Tag
	for rows.Next() {
		var tag Tag
		err := rows.Scan(&tag.ID, &tag.Name, &tag.Color, &tag.UsageCount)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, nil
}

func updateTag(id int, name string, color string) error {
	statement, err := db.Prepare("UPDATE tags SET name = ?, color = ? WHERE id = ?")
	if err != nil {
		return err
	}
	_, err = statement.Exec(name, color, id)
	return err
}

func deleteTag(id int) error {
	// Get tag name before deletion
	row := db.QueryRow("SELECT name FROM tags WHERE id = ?", id)
	var tagName string
	err := row.Scan(&tagName)
	if err != nil {
		return err
	}
	
	// Remove this tag from all sessions that have it
	rows, err := db.Query("SELECT id, tags FROM sessions WHERE tags LIKE ?", "%"+tagName+"%")
	if err != nil {
		return err
	}
	defer rows.Close()
	
	for rows.Next() {
		var sessionId int
		var sessionTags string
		err := rows.Scan(&sessionId, &sessionTags)
		if err != nil {
			continue
		}
		
		// Remove the tag from the comma-separated list
		tagList := strings.Split(sessionTags, ",")
		newTagList := []string{}
		for _, tag := range tagList {
			tag = strings.TrimSpace(tag)
			if tag != tagName {
				newTagList = append(newTagList, tag)
			}
		}
		
		// Update the session with the new tag list
		newTags := strings.Join(newTagList, ",")
		db.Exec("UPDATE sessions SET tags = ? WHERE id = ?", newTags, sessionId)
	}
	
	// Delete the tag
	_, err = db.Exec("DELETE FROM tags WHERE id = ?", id)
	return err
}

// Helper functions for tag management

func updateTagCounts(tagString string) {
	if tagString == "" {
		return
	}
	
	tagList := strings.Split(tagString, ",")
	for _, tag := range tagList {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		
		// Check if tag exists
		var count int
		row := db.QueryRow("SELECT COUNT(*) FROM tags WHERE name = ?", tag)
		err := row.Scan(&count)
		if err != nil {
			continue
		}
		
		if count > 0 {
			// Increment usage count for existing tag
			db.Exec("UPDATE tags SET usage_count = usage_count + 1 WHERE name = ?", tag)
		} else {
			// Create new tag with default color
			createTag(tag, getRandomColor())
		}
	}
}

func decrementTagCounts(tagString string) {
	if tagString == "" {
		return
	}
	
	tagList := strings.Split(tagString, ",")
	for _, tag := range tagList {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		
		// Decrement usage count
		db.Exec("UPDATE tags SET usage_count = MAX(0, usage_count - 1) WHERE name = ?", tag)
	}
}

func getRandomColor() string {
	// Generate a random color from a predefined list
	colors := []string{
		"#3498db", // Blue
		"#2ecc71", // Green
		"#e74c3c", // Red
		"#f39c12", // Orange
		"#9b59b6", // Purple
		"#1abc9c", // Teal
		"#d35400", // Dark Orange
		"#34495e", // Dark Blue
		"#16a085", // Light Green
		"#c0392b", // Burgundy
	}
	
	// Get count of tags to use as index
	var count int
	row := db.QueryRow("SELECT COUNT(*) FROM tags")
	err := row.Scan(&count)
	if err != nil {
		return colors[0]
	}
	
	index := count % len(colors)
	return colors[index]
}

// Pomodoro CRUD functions

func createPomodoro(sessionID int, number int, startTime string, status string) (int64, error) {
	statement, err := db.Prepare("INSERT INTO pomodoros(session_id, number, start_time, status) VALUES (?, ?, ?, ?)")
	if err != nil {
		return 0, err
	}
	result, err := statement.Exec(sessionID, number, startTime, status)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func getPomodoros(sessionID int) ([]Pomodoro, error) {
	rows, err := db.Query("SELECT id, session_id, number, start_time, end_time, duration, status FROM pomodoros WHERE session_id = ? ORDER BY number", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pomodoros []Pomodoro
	for rows.Next() {
		var pomodoro Pomodoro
		err := rows.Scan(&pomodoro.ID, &pomodoro.SessionID, &pomodoro.Number, &pomodoro.StartTime, &pomodoro.EndTime, &pomodoro.Duration, &pomodoro.Status)
		if err != nil {
			return nil, err
		}
		pomodoros = append(pomodoros, pomodoro)
	}
	return pomodoros, nil
}

func updatePomodoro(id int, endTime string, duration int, status string) error {
	statement, err := db.Prepare("UPDATE pomodoros SET end_time = ?, duration = ?, status = ? WHERE id = ?")
	if err != nil {
		return err
	}
	_, err = statement.Exec(endTime, duration, status, id)
	return err
}

// Break CRUD functions

func createBreak(sessionID int, pomodoroID int, breakType string, startTime string, status string) (int64, error) {
	statement, err := db.Prepare("INSERT INTO breaks(session_id, pomodoro_id, type, start_time, status) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return 0, err
	}
	result, err := statement.Exec(sessionID, pomodoroID, breakType, startTime, status)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func getBreaks(sessionID int) ([]Break, error) {
	rows, err := db.Query("SELECT id, session_id, pomodoro_id, type, start_time, end_time, duration, status FROM breaks WHERE session_id = ? ORDER BY id", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var breaks []Break
	for rows.Next() {
		var breakItem Break
		err := rows.Scan(&breakItem.ID, &breakItem.SessionID, &breakItem.PomodoroID, &breakItem.Type, &breakItem.StartTime, &breakItem.EndTime, &breakItem.Duration, &breakItem.Status)
		if err != nil {
			return nil, err
		}
		breaks = append(breaks, breakItem)
	}
	return breaks, nil
}

func updateBreak(id int, endTime string, duration int, status string) error {
	statement, err := db.Prepare("UPDATE breaks SET end_time = ?, duration = ?, status = ? WHERE id = ?")
	if err != nil {
		return err
	}
	_, err = statement.Exec(endTime, duration, status, id)
	return err
}

// Note CRUD functions

func createNote(sessionID int, pomodoroID int, noteText string) error {
	statement, err := db.Prepare("INSERT INTO notes(session_id, pomodoro_id, note) VALUES (?, ?, ?)")
	if err != nil {
		return err
	}
	_, err = statement.Exec(sessionID, pomodoroID, noteText)
	return err
}

func getNotes(sessionID int) ([]Note, error) {
	rows, err := db.Query("SELECT id, session_id, pomodoro_id, note, created_at FROM notes WHERE session_id = ? ORDER BY created_at DESC", sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []Note
	for rows.Next() {
		var note Note
		err := rows.Scan(&note.ID, &note.SessionID, &note.PomodoroID, &note.NoteText, &note.CreatedAt)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}
	return notes, nil
}

func updateNote(id int, noteText string) error {
	statement, err := db.Prepare("UPDATE notes SET note = ? WHERE id = ?")
	if err != nil {
		return err
	}
	_, err = statement.Exec(noteText, id)
	return err
}

func deleteNote(id int) error {
	_, err := db.Exec("DELETE FROM notes WHERE id = ?", id)
	return err
}

// Get all notes for the notes browsing page
func getAllNotes() ([]Note, error) {
	rows, err := db.Query(`
		SELECT n.id, n.session_id, n.pomodoro_id, n.note, n.created_at 
		FROM notes n
		JOIN sessions s ON n.session_id = s.id
		ORDER BY n.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []Note
	for rows.Next() {
		var note Note
		err := rows.Scan(&note.ID, &note.SessionID, &note.PomodoroID, &note.NoteText, &note.CreatedAt)
		if err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}
	return notes, nil
}

// Get sessions by date range
func getSessionsByDateRange(startDate string, endDate string) ([]Session, error) {
	query := `
		SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags 
		FROM sessions 
		WHERE start_time >= ? AND start_time <= ? 
		ORDER BY start_time
	`
	rows, err := db.Query(query, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString // Use NullString to handle NULL values

		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		// Set tags to empty string if NULL or the actual value if not NULL
		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}
// Get sessions by tag

func getSessionsByTag(tag string) ([]Session, error) {
	// Using LIKE with wildcards to match tag in the comma-separated list
	query := `
		SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags 
		FROM sessions 
		WHERE tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags = ?
		ORDER BY start_time DESC
	`
	// Four patterns to match: exact match, start of list, end of list, or middle of list
	rows, err := db.Query(query, tag, tag+",%", "%,"+tag, "%,"+tag+",%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString // Use NullString to handle NULL values

		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		// Set tags to empty string if NULL or the actual value if not NULL
		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}
// Get monthly stats for each tag
func getMonthlyTagStats(year int) (map[string]map[string]int, error) {
	// Final structure will be: { "month": { "tag1": minutes, "tag2": minutes } }
	stats := make(map[string]map[string]int)
	
	// Initialize months
	months := []string{"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"}
	for _, month := range months {
		stats[month] = make(map[string]int)
	}
	
	// Query sessions for the given year
	query := `
		SELECT start_time, total_time, tags 
		FROM sessions 
		WHERE strftime('%Y', start_time) = ? 
		AND status IN ('completed', 'stopped') 
		AND total_time > 0
		ORDER BY start_time
	`
	rows, err := db.Query(query, fmt.Sprintf("%d", year))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	for rows.Next() {
		var startTime string
		var totalTime int
		var tags string
		
		err := rows.Scan(&startTime, &totalTime, &tags)
		if err != nil {
			continue
		}
		
		// Extract month from start_time (format: 2023-01-15T14:30:00)
		// SQLite strftime returns 01-12 for months
		var monthIndex int
		row := db.QueryRow("SELECT strftime('%m', ?)", startTime)
		err = row.Scan(&monthIndex)
		if err != nil {
			continue
		}
		
		monthName := months[monthIndex-1] // Convert 1-12 to 0-11 for array index
		minutes := totalTime / 60 // Convert seconds to minutes
		
		if tags == "" {
			// Use "Untagged" for sessions without tags
			if _, ok := stats[monthName]["Untagged"]; !ok {
				stats[monthName]["Untagged"] = 0
			}
			stats[monthName]["Untagged"] += minutes
		} else {
			// Split tags and distribute minutes proportionally
			tagList := strings.Split(tags, ",")
			minutesPerTag := minutes / len(tagList)
			
			for _, tag := range tagList {
				tag = strings.TrimSpace(tag)
				if tag == "" {
					continue
				}
				
				if _, ok := stats[monthName][tag]; !ok {
					stats[monthName][tag] = 0
				}
				stats[monthName][tag] += minutesPerTag
			}
		}
	}
	
	return stats, nil
}


func createUser(input UserInput) (int64, error) {
	// Hash the password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return 0, err
	}

	// Insert user into database
	stmt, err := db.Prepare("INSERT INTO users (username, password_hash, email, is_admin) VALUES (?, ?, ?, ?)")
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	result, err := stmt.Exec(input.Username, string(passwordHash), input.Email, input.IsAdmin)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// Get user by ID
func getUserByID(id int) (User, error) {
	var user User
	row := db.QueryRow("SELECT id, username, password_hash, email, is_admin, created_at, last_login, account_status FROM users WHERE id = ?", id)
	err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Email, &user.IsAdmin, &user.CreatedAt, &user.LastLogin, &user.AccountStatus)
	return user, err
}

// Get user by username
func getUserByUsername(username string) (User, error) {
	var user User
	row := db.QueryRow("SELECT id, username, password_hash, email, is_admin, created_at, last_login, account_status FROM users WHERE username = ?", username)
	err := row.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Email, &user.IsAdmin, &user.CreatedAt, &user.LastLogin, &user.AccountStatus)
	return user, err
}

// Get all users (for admin use)
func getAllUsers() ([]User, error) {
	rows, err := db.Query("SELECT id, username, password_hash, email, is_admin, created_at, last_login, account_status FROM users ORDER BY username")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		if err := rows.Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Email, &user.IsAdmin, &user.CreatedAt, &user.LastLogin, &user.AccountStatus); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	return users, nil
}

// Update user
func updateUser(id int, input UserInput) error {
	// If password is provided, hash it
	if input.Password != "" {
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
		if err != nil {
			return err
		}
		
		_, err = db.Exec("UPDATE users SET username = ?, password_hash = ?, email = ?, is_admin = ? WHERE id = ?",
			input.Username, string(passwordHash), input.Email, input.IsAdmin, id)
		return err
	} else {
		// Don't update password if not provided
		_, err := db.Exec("UPDATE users SET username = ?, email = ?, is_admin = ? WHERE id = ?",
			input.Username, input.Email, input.IsAdmin, id)
		return err
	}
}

// Delete user (soft delete)
func softDeleteUser(id int) error {
	_, err := db.Exec("UPDATE users SET account_status = 'deleted' WHERE id = ?", id)
	return err
}

// Hard delete user
func hardDeleteUser(id int) error {
	_, err := db.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

// Update last login time
func updateLastLogin(id int) error {
	now := time.Now().Format(time.RFC3339)
	_, err := db.Exec("UPDATE users SET last_login = ? WHERE id = ?", now, id)
	return err
}

// Check credentials
func validateCredentials(username, password string) (User, error) {
	user, err := getUserByUsername(username)
	if err != nil {
		return User{}, errors.New("invalid credentials")
	}
	
	// Check account status
	if user.AccountStatus != "active" {
		return User{}, errors.New("account is not active")
	}

	// Check password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	if err != nil {
		return User{}, errors.New("invalid credentials")
	}

	return user, nil
}

// Generate a secure random password
func generateSecurePassword(length int) (string, error) {
	if length < 8 {
		length = 8 // Minimum secure password length
	}
	
	bytes := make([]byte, length)
	_, err := rand.Read(bytes)
	if err != nil {
		return "", err
	}
	
	return base64.URLEncoding.EncodeToString(bytes)[:length], nil
}


func createSessionWithUser(startTime string, tags string, userID int) (int64, error) {
	statement, err := db.Prepare("INSERT INTO sessions(start_time, status, completed_pomodoros, tags, user_id) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return 0, err
	}
	result, err := statement.Exec(startTime, "running", 0, tags, userID)
	if err != nil {
		return 0, err
	}
	
	// Update tag usage counts
	if tags != "" {
		updateTagCounts(tags)
	}
	
	return result.LastInsertId()
}


func getSessionsForUser(userID int) ([]Session, error) {
	rows, err := db.Query("SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags FROM sessions WHERE user_id = ? OR user_id IS NULL ORDER BY id DESC", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString // Use NullString to handle NULL values

		// Scan using the nullable type for tags
		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		// Set tags to empty string if NULL or the actual value if not NULL
		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}

func getSessionsByDateRangeForUser(startDate string, endDate string, userID int) ([]Session, error) {
	query := `
		SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags 
		FROM sessions 
		WHERE (user_id = ? OR user_id IS NULL) 
		AND start_time >= ? AND start_time <= ? 
		ORDER BY start_time
	`
	rows, err := db.Query(query, userID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString // Use NullString to handle NULL values

		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		// Set tags to empty string if NULL or the actual value if not NULL
		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}

func getSessionsByTagForUser(tag string, userID int) ([]Session, error) {
	// Using LIKE with wildcards to match tag in the comma-separated list
	query := `
		SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags 
		FROM sessions 
		WHERE (user_id = ? OR user_id IS NULL)
		AND (tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags = ?)
		ORDER BY start_time DESC
	`
	// Four patterns to match: exact match, start of list, end of list, or middle of list
	rows, err := db.Query(query, userID, tag, tag+",%", "%,"+tag, "%,"+tag+",%")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString // Use NullString to handle NULL values

		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		// Set tags to empty string if NULL or the actual value if not NULL
		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}


func isSessionOwner(sessionID int, userID int) (bool, error) {
	var ownerID sql.NullInt64
	err := db.QueryRow("SELECT user_id FROM sessions WHERE id = ?", sessionID).Scan(&ownerID)
	if err != nil {
		return false, err
	}
	
	// Either the session has no owner (NULL user_id) or the user is the owner
	return !ownerID.Valid || (ownerID.Valid && int(ownerID.Int64) == userID), nil
}

// Add this to database.go
func getSessionsByDaysForUser(days int, userID int) ([]Session, error) {
	// Calculate start date (n days ago)
	now := time.Now()
	startDate := now.AddDate(0, 0, -days).Format("2006-01-02T15:04:05.999Z")
	
	query := `
		SELECT id, start_time, end_time, total_time, status, completed_pomodoros, tags 
		FROM sessions 
		WHERE (user_id = ? OR user_id IS NULL)
		AND start_time >= ? 
		ORDER BY start_time DESC
	`
	
	rows, err := db.Query(query, userID, startDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		var tagsNullable sql.NullString

		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed, &tagsNullable)
		if err != nil {
			return nil, err
		}

		if tagsNullable.Valid {
			session.Tags = tagsNullable.String
		} else {
			session.Tags = ""
		}

		sessions = append(sessions, session)
	}
	return sessions, nil
}