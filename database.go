package main

import (
	"database/sql"
	"fmt"
	_ "github.com/mattn/go-sqlite3"
)

var db *sql.DB

// Data structures
type Session struct {
	ID          int    `json:"id"`
	StartTime   string `json:"start_time"`
	EndTime     string `json:"end_time"`
	TotalTime   int    `json:"total_time"`
	Status      string `json:"status"`
	Completed   int    `json:"completed_pomodoros"`
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

// Initialize the database with tables if not already created
func initDB() {
	var err error
	// Open database connection
	db, err = sql.Open("sqlite3", "./pomonotes.db")
	if err != nil {
		fmt.Println("Error opening database:", err)
		return
	}

	// Create tables if they don't exist
	createSessionsTable := `
	CREATE TABLE IF NOT EXISTS sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		start_time TEXT,
		end_time TEXT,
		total_time INTEGER DEFAULT 0,
		status TEXT,
		completed_pomodoros INTEGER DEFAULT 0
	);`

	createPomodorosTable := `
	CREATE TABLE IF NOT EXISTS pomodoros (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER,
		number INTEGER,
		start_time TEXT,
		end_time TEXT,
		duration INTEGER,
		status TEXT,
		FOREIGN KEY (session_id) REFERENCES sessions(id)
	);`

	createBreaksTable := `
	CREATE TABLE IF NOT EXISTS breaks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER,
		pomodoro_id INTEGER,
		type TEXT,
		start_time TEXT,
		end_time TEXT,
		duration INTEGER,
		status TEXT,
		FOREIGN KEY (session_id) REFERENCES sessions(id),
		FOREIGN KEY (pomodoro_id) REFERENCES pomodoros(id)
	);`

	createNotesTable := `
	CREATE TABLE IF NOT EXISTS notes (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER,
		pomodoro_id INTEGER,
		note TEXT,
		created_at TEXT DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (session_id) REFERENCES sessions(id),
		FOREIGN KEY (pomodoro_id) REFERENCES pomodoros(id)
	);`

	// Execute the queries to create tables
	if _, err := db.Exec(createSessionsTable); err != nil {
		fmt.Println("Error creating sessions table:", err)
		return
	}
	if _, err := db.Exec(createPomodorosTable); err != nil {
		fmt.Println("Error creating pomodoros table:", err)
		return
	}
	if _, err := db.Exec(createBreaksTable); err != nil {
		fmt.Println("Error creating breaks table:", err)
		return
	}
	if _, err := db.Exec(createNotesTable); err != nil {
		fmt.Println("Error creating notes table:", err)
		return
	}
}

// Session CRUD functions

func createSession(startTime string) (int64, error) {
	statement, err := db.Prepare("INSERT INTO sessions(start_time, status, completed_pomodoros) VALUES (?, ?, ?)")
	if err != nil {
		return 0, err
	}
	result, err := statement.Exec(startTime, "running", 0)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func getSessions() ([]Session, error) {
	rows, err := db.Query("SELECT id, start_time, end_time, total_time, status, completed_pomodoros FROM sessions ORDER BY id DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var session Session
		err := rows.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, session)
	}
	return sessions, nil
}

func getSession(id int) (Session, error) {
	row := db.QueryRow("SELECT id, start_time, end_time, total_time, status, completed_pomodoros FROM sessions WHERE id = ?", id)
	var session Session
	err := row.Scan(&session.ID, &session.StartTime, &session.EndTime, &session.TotalTime, &session.Status, &session.Completed)
	if err != nil {
		return session, err
	}
	return session, nil
}

func updateSession(id int, endTime string, totalTime int, status string, completedPomodoros int) error {
	statement, err := db.Prepare("UPDATE sessions SET end_time = ?, total_time = ?, status = ?, completed_pomodoros = ? WHERE id = ?")
	if err != nil {
		return err
	}
	_, err = statement.Exec(endTime, totalTime, status, completedPomodoros, id)
	return err
}

func deleteSession(id int) error {
	// First delete related breaks
	_, err := db.Exec("DELETE FROM breaks WHERE session_id = ?", id)
	if err != nil {
		return err
	}
	
	// Delete related pomodoros
	_, err = db.Exec("DELETE FROM pomodoros WHERE session_id = ?", id)
	if err != nil {
		return err
	}
	
	// Delete related notes
	_, err = db.Exec("DELETE FROM notes WHERE session_id = ?", id)
	if err != nil {
		return err
	}
	
	// Then delete the session
	_, err = db.Exec("DELETE FROM sessions WHERE id = ?", id)
	return err
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
