# Pomonotes ⏱️📝

A simple Pomodoro timer with built-in Markdown note-taking. Made for forgetful folks (like me) who want to track when they worked on what—kind of like *Memento*, but with fewer tattoos.

---

## Features 🚀

### 🍅 Pomodoro Timer  
- 4x 25-minute pomodoros per session  
- 5-minute short breaks after pomodoros 1–3  
- 15-minute long break after pomodoro 4  
- Pause, stop, and reset (with confirmation)  
- Clean radial timer display  

### 📝 Markdown Notes  
- Take notes during pomodoro sessions  
- Full Markdown support with live preview  
- Quick formatting toolbar  
- Notes linked to each pomodoro  

### 📅 Session Management  
- View full session history  
- Breakdown of pomodoros and breaks  
- Add/edit notes for past sessions  
- Track focus and productivity over time  

### 📊 Analytics  
- 7-day productivity chart  
- Total focused time  
- Completed pomodoros counter  

### 📱 Progressive Web App  
- Installable on your device  
- Works offline  
- Timer completion notifications  

---

## ⚙️ Tech Stack  
- **Backend:** Go + Echo  
- **Database:** SQLite  
- **Frontend:** HTML, CSS, JS  
- **UI Framework:** Pico CSS  
- **Interactivity:** HTMX  
- **Charts:** Chart.js  
- **Markdown Rendering:** Marked.js  

---

## 🗂️ Database Schema  
- **Sessions:** Tracks entire work sessions  
- **Pomodoros:** Individual 25-minute focus periods  
- **Breaks:** Short and long breaks  
- **Notes:** Markdown notes linked to sessions/pomodoros  

---

## 🛠️ Local Development

```bash
git clone <repo-url>
cd pomonotes
go get
ADMIN_PASSWORD=your_pass JWT_SECRET=your_secure_jwt_secret go run *.go
```

## 🚀 Quick Start with Docker

### Step 1: Pull the Image

Once the image is pushed to Docker Hub (or once you build it yourself), you can easily run Pomonotes.

```bash
docker pull yourdockerhubusername/pomonotes
```
🛡️ Default Credentials:

If no environment variables are set, the container will use:

ADMIN_PASSWORD=admin
JWT_SECRET=your_secure_jwt_secret

⚠️ It's strongly recommended to override these for production use!

To run with secure credentials:

```bash
docker run -p 8080:8080 \
  -e ADMIN_PASSWORD=mysecurepassword \
  -e JWT_SECRET=mylongsecurejwtsecret \
  yourdockerhubusername/pomonotes
```
