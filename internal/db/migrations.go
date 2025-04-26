package models

import (
	"log"

	_ "github.com/mattn/go-sqlite3"
)

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
