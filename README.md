# Pomonotes

A minimalist Pomodoro timer with markdown note-taking capabilities, built with Go and modern web technologies. Mostly because I track sessions and I want to record when I did what just like that Memento movie. I am very foregetful and this hopefully helps you as well, if you are using it.

## Features

- **Complete Pomodoro System**
  - Four 25-minute pomodoros per session
  - Short breaks (5 min) after pomodoros 1-3
  - Long break (15 min) after pomodoro 4
  - Pause, stop, and reset functionality with confirmation
  - Beautiful radial timer visualization

- **Markdown Notes**
  - Write notes during your pomodoro sessions
  - Full markdown support with live preview
  - Quick formatting toolbar
  - Notes associated with specific pomodoros

- **Session Management**
  - View complete session history
  - See detailed breakdown of each session
  - Add notes to past sessions
  - Track your productivity over time

- **Analytics**
  - 7-day productivity visualization
  - Track completed pomodoros
  - Measure total focused time

- **Progressive Web App**
  - Install on your device
  - Work offline
  - Notifications for timer completion

## Technology Stack

- **Backend**: Go with Echo framework
- **Database**: SQLite
- **Frontend**: HTML, CSS, JavaScript 
- **UI Framework**: Pico CSS for minimal styling
- **Interactivity**: HTMX for seamless interactions
- **Charts**: Chart.js for data visualization
- **Markdown**: Marked.js for rendering

## Design Decisions

### Database Structure

The application uses a four-table design:

1. **Sessions**: Tracks overall work sessions
2. **Pomodoros**: Records individual 25-minute focus periods
3. **Breaks**: Stores break periods between pomodoros
4. **Notes**: Contains markdown notes linked to sessions/pomodoros


## Local Development

1. Clone the repository
2. Make sure Go is installed
3. Install dependencies: `go get`
4. Run the application: `go run *.go ADMIN_PASSWORD=your_pass JWT_SECRET=your_secure_jwt_secret go run *.go`
5. Visit `http://localhost:8080` in your browser

## Future Enhancements

- Task management integration
- Statistics and reporting
- Custom timer settings
- Data export/import
- Actual Authentication
