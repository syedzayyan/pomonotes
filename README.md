# Pomonotes ⏱️📝

A simple Pomodoro timer with built-in Markdown note-taking. Made for forgetful folks (like me) who want to track when they worked on what—kind of like *Memento*, but with fewer tattoos.


## Features 🚀

- 🍅 Pomodoro Timer  
- 📝 Markdown Notes  
- 📅 Session Management  
- 📊 Analytics  
- 📱 Progressive Web App  

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

## 🛠️ Local Development

```bash
git clone https://github.com/syedzayyan/pomonotes
cd pomonotes
go get
ADMIN_PASSWORD=your_pass JWT_SECRET=your_secure_jwt_secret go run *.go
```

## 🚀 Quick Start with Docker

### Step 1: Pull the Image

Once the image is pushed to Docker Hub (or once you build it yourself), you can easily run Pomonotes.

```bash
docker pull zayyanmasud/pomonotes
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
  zayyanmasud/pomonotes
```
