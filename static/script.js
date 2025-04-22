document.addEventListener("DOMContentLoaded", () => {
  // Timer settings
  const pomodoroLength = 25 * 60; // 25 minutes in seconds
  const shortBreakLength = 5 * 60; // 5 minutes in seconds
  const longBreakLength = 15 * 60; // 15 minutes in seconds
  let timeRemaining = pomodoroLength;
  let timerInterval;
  let isTimerRunning = false;
  let isPaused = false;
  let currentPomodoro = 1;
  let isBreak = false;
  let sessionStartTime;
  // Use localStorage to persist session ID between page loads
  let currentSessionId = localStorage.getItem("currentSessionId") || null;
  let currentPomodoroId = null;
  let currentBreakId = null;

  // DOM elements
  const timerDisplay = document.getElementById("timer-display");
  const startBtn = document.querySelector(".start-btn");
  const stopBtn = document.querySelector(".stop-btn");
  const resetBtn = document.querySelector(".reset-btn");
  const currentPomodoroDisplay = document.getElementById("current-pomodoro");
  const markdownEditor = document.getElementById("markdown-editor");
  const markdownPreview = document.getElementById("markdown-preview");
  const saveBtn = document.querySelector(".save-btn");
  const radialTimer = document.querySelector(".radial-timer circle.progress");
  const confirmModal = document.getElementById("confirm-modal");

  // Initialize SimpleMDE if the editor element exists
  let simpleMDE;
  if (markdownEditor) {
    simpleMDE = new SimpleMDE({
      element: markdownEditor,
      spellChecker: false,
      autosave: {
        enabled: true,
        uniqueId: "pomonotes-editor",
        delay: 1000,
      },
      placeholder: "Write your session notes in markdown here...",
    });
  }

  // Timer circumference calculation
  const radius = parseInt(radialTimer.getAttribute("r"));
  const circumference = 2 * Math.PI * radius;
  radialTimer.style.strokeDasharray = `${circumference} ${circumference}`;
  radialTimer.style.strokeDashoffset = `${circumference}`;

  // Format time as MM:SS
  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }

  // Update the radial timer display
  function updateRadialTimer(timeRemaining, totalTime) {
    const percentage = timeRemaining / totalTime;
    const offset = circumference - percentage * circumference;
    radialTimer.style.strokeDashoffset = offset;
  }

  // Verify stored session on page load
  function verifyStoredSession() {
    const storedSessionId = localStorage.getItem("currentSessionId");

    if (storedSessionId) {
      // Verify this session actually exists in the database
      fetch(`/api/sessions/${storedSessionId}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Stored session not found");
          }
          return response.json();
        })
        .then((session) => {
          // If session is already completed or cancelled, don't use it
          if (
            session.status === "completed" ||
            session.status === "stopped" ||
            session.status === "cancelled"
          ) {
            localStorage.removeItem("currentSessionId");
            currentSessionId = null;
          } else {
            currentSessionId = storedSessionId;
            console.log("Restored session:", currentSessionId);
          }
        })
        .catch((error) => {
          console.error("Error verifying stored session:", error);
          localStorage.removeItem("currentSessionId");
          currentSessionId = null;
        });
    }
  }

  // Timer control functions
  function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    startBtn.textContent = "Pause";
    startBtn.classList.add("paused");

    if (!currentSessionId) {
      sessionStartTime = new Date().toISOString();
      // Create a new session in the database
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: sessionStartTime,
          status: "running",
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("Session created:", data);
          // Get the session ID from the response
          if (data && data.id) {
            currentSessionId = data.id;
            // Store session ID in localStorage for persistence
            localStorage.setItem("currentSessionId", currentSessionId);

            // Create the first pomodoro if this is a new session
            if (currentPomodoro === 1 && !currentPomodoroId) {
              createNewPomodoro();
            }
          }
        })
        .catch((error) => console.error("Error creating session:", error));
    } else if (isPaused) {
      // If we're resuming from pause, just continue the current pomodoro
      isPaused = false;
    }

    const totalTime = isBreak
      ? currentPomodoro % 4 === 0
        ? longBreakLength
        : shortBreakLength
      : pomodoroLength;

    timerInterval = setInterval(() => {
      timeRemaining--;

      // Update displays
      timerDisplay.textContent = formatTime(timeRemaining);
      updateRadialTimer(timeRemaining, totalTime);

      // Check if timer has finished
      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        startBtn.textContent = "Start";
        startBtn.classList.remove("paused");

        if (isBreak) {
          // If break is over, move to next pomodoro
          completeBreak();
          isBreak = false;
          if (currentPomodoro < 4) {
            currentPomodoro++;
            currentPomodoroDisplay.textContent = currentPomodoro;
            createNewPomodoro();
          }
          timeRemaining = pomodoroLength;
          radialTimer.style.stroke = "#e74c3c"; // Red for pomodoro
        } else {
          // If pomodoro is over, move to break
          completePomodoro();
          isBreak = true;
          timeRemaining =
            currentPomodoro % 4 === 0 ? longBreakLength : shortBreakLength;
          radialTimer.style.stroke = "#3498db"; // Blue for break
          createNewBreak();

          // Show notification
          if (Notification.permission === "granted") {
            const breakType = currentPomodoro % 4 === 0 ? "long" : "short";
            new Notification("Pomodoro Complete!", {
              body: `Time for a ${breakType} break. Click to return to app.`,
              icon: "/static/icon-192x192.png",
            });
          }
        }

        timerDisplay.textContent = formatTime(timeRemaining);
        updateRadialTimer(timeRemaining, timeRemaining);
      }
    }, 1000);
  }

  // Pause the timer
  function pauseTimer() {
    if (!isTimerRunning) return;

    clearInterval(timerInterval);
    isTimerRunning = false;
    isPaused = true;
    startBtn.textContent = "Resume";
    startBtn.classList.remove("paused");

    // Update the current pomodoro or break status in the database
    if (isBreak) {
      updateBreakStatus("paused");
    } else {
      updatePomodoroStatus("paused");
    }
  }

  // Stop the timer (with confirmation)
  function stopTimer() {
    // Only show confirmation if timer is running or paused
    if (!isTimerRunning && !isPaused) return;

    // Show confirmation modal
    confirmModal.querySelector(".modal-message").textContent =
      "Are you sure you want to stop the current timer? This will end your current pomodoro.";

    // Set up confirm button action
    const confirmBtn = confirmModal.querySelector(".confirm-btn");
    confirmBtn.onclick = function () {
      confirmModal.close();
      executeStopTimer();
    };

    // Set up cancel button action
    const cancelBtn = confirmModal.querySelector(".cancel-btn");
    cancelBtn.onclick = function () {
      confirmModal.close();
    };

    confirmModal.showModal();
  }

  // Execute the stop timer action after confirmation
  function executeStopTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    isPaused = false;
    startBtn.textContent = "Start";
    startBtn.classList.remove("paused");

    // End the current pomodoro or break in database
    if (isBreak) {
      updateBreakStatus("stopped");
    } else {
      updatePomodoroStatus("stopped");
    }

    // Make sure we have a valid session ID before trying to update
    if (!currentSessionId) {
      console.error("Cannot stop session: No current session ID");
      return;
    }

    console.log("Attempting to stop session with ID:", currentSessionId);

    // Now update the session
    const now = new Date().toISOString();

    // Calculate total time spent in completed pomodoros
    // We count pomodoros that were fully completed
    const completedPomodoros = Math.max(0, currentPomodoro - (isBreak ? 0 : 1));

    // Calculate time for completed pomodoros
    let totalTime = completedPomodoros * pomodoroLength;

    // Add time for the current incomplete pomodoro if not in a break
    if (!isBreak && timeRemaining < pomodoroLength) {
      totalTime += pomodoroLength - timeRemaining;
    }

    isBreak = false;
    currentPomodoro = 1;
    currentPomodoroId = null;
    currentBreakId = null;
    currentPomodoroDisplay.textContent = currentPomodoro;
    timeRemaining = pomodoroLength;
    timerDisplay.textContent = formatTime(timeRemaining);
    updateRadialTimer(timeRemaining, pomodoroLength);
    radialTimer.style.stroke = "#e74c3c"; // Red for pomodoro
    // Update the session with stopped status
    return fetch(`/api/sessions/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        total_time: totalTime,
        status: "stopped",
        completed_pomodoros: completedPomodoros,
      }),
    });
  }

  // Reset the timer (with confirmation)
  function resetTimer() {
    // Only show confirmation if session is active
    if (!currentSessionId) return;

    // Show confirmation modal
    confirmModal.querySelector(".modal-message").textContent =
      "Are you sure you want to reset the timer? This will end your current session.";

    // Set up confirm button action
    const confirmBtn = confirmModal.querySelector(".confirm-btn");
    confirmBtn.onclick = function () {
      confirmModal.close();
      executeResetTimer();
    };

    // Set up cancel button action
    const cancelBtn = confirmModal.querySelector(".cancel-btn");
    cancelBtn.onclick = function () {
      confirmModal.close();
    };

    confirmModal.showModal();
  }

  // Execute the reset timer action after confirmation
  function executeResetTimer() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    isPaused = false;
    isBreak = false;
    currentPomodoro = 1;
    currentPomodoroId = null;
    currentBreakId = null;
    currentPomodoroDisplay.textContent = currentPomodoro;
    timeRemaining = pomodoroLength;
    timerDisplay.textContent = formatTime(timeRemaining);
    updateRadialTimer(timeRemaining, pomodoroLength);
    radialTimer.style.stroke = "#e74c3c"; // Red for pomodoro
    startBtn.textContent = "Start";
    startBtn.classList.remove("paused");

    // Only try to update the session if we have a session ID
    if (currentSessionId) {
      // Update session as complete in database
      updateSessionStatus("cancelled");

      // Reset the session
      currentSessionId = null;
      localStorage.removeItem("currentSessionId");
    }
  }

  // Helper functions for database updates
  function createNewPomodoro() {
    // Only create if we have a session ID
    if (!currentSessionId) return;

    fetch("/api/pomodoros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        number: currentPomodoro,
        start_time: new Date().toISOString(),
        status: "running",
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.id) {
          currentPomodoroId = data.id;
        }
      })
      .catch((error) => console.error("Error creating pomodoro:", error));
  }

  function completePomodoro() {
    // Only update if we have a pomodoro ID
    if (!currentPomodoroId) return;
    updateSessionProgress();
    updatePomodoroStatus("completed");
  }

  function updatePomodoroStatus(status) {
    // Only update if we have a pomodoro ID
    if (!currentPomodoroId) return;

    const now = new Date().toISOString();
    const elapsedSeconds = pomodoroLength - timeRemaining;

    fetch(`/api/pomodoros/${currentPomodoroId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        duration: elapsedSeconds,
        status: status,
      }),
    })
      .then((response) => response.json())
      .catch((error) => console.error("Error updating pomodoro:", error));
  }

  function createNewBreak() {
    // Only create if we have a session ID and pomodoro ID
    if (!currentSessionId || !currentPomodoroId) return;

    const breakType = currentPomodoro % 4 === 0 ? "long" : "short";

    fetch("/api/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        pomodoro_id: currentPomodoroId,
        type: breakType,
        start_time: new Date().toISOString(),
        status: "running",
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data && data.id) {
          currentBreakId = data.id;
        }
      })
      .catch((error) => console.error("Error creating break:", error));
  }

  function completeBreak() {
    // Only update if we have a break ID
    if (!currentBreakId) return;

    updateBreakStatus("completed");
  }

  function updateBreakStatus(status) {
    // Only update if we have a break ID
    if (!currentBreakId) return;

    const now = new Date().toISOString();
    const breakLength =
      currentPomodoro % 4 === 0 ? longBreakLength : shortBreakLength;
    const elapsedSeconds = breakLength - timeRemaining;

    fetch(`/api/breaks/${currentBreakId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        duration: elapsedSeconds,
        status: status,
      }),
    })
      .then((response) => response.json())
      .catch((error) => console.error("Error updating break:", error));

    // Reset the current break ID
    currentBreakId = null;
  }

  function updateSessionProgress() {
    if (!currentSessionId) return;

    // Calculate completed pomodoros
    const completedPomodoros = Math.max(0, currentPomodoro - (isBreak ? 0 : 1));
    const totalTime = completedPomodoros * pomodoroLength;

    updateSessionStatus(
      completedPomodoros >= 4 ? "completed" : "in-progress",
      totalTime,
      completedPomodoros,
    );
  }

  function updateSessionStatus(status, totalTime = 0, completedPomodoros = 0) {
    if (!currentSessionId) return;

    fetch(`/api/sessions/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: new Date().toISOString(),
        total_time: totalTime,
        status: status,
        completed_pomodoros: completedPomodoros,
      }),
    })
      .then((response) => response.json())
      .catch((error) => console.error("Error updating session:", error));
  }

  // Save note for the current session
  function saveNote() {
    // If using SimpleMDE, get value from there
    const noteText = simpleMDE
      ? simpleMDE.value().trim()
      : markdownEditor
        ? markdownEditor.value.trim()
        : "";

    if (!noteText) {
      alert("Please enter a note before saving.");
      return;
    }

    if (!currentSessionId) {
      alert("Start a timer session before saving a note.");
      return;
    }

    // Save the note
    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        pomodoro_id: currentPomodoroId,
        note: noteText,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Note saved:", data);
        // Clear the editor - use SimpleMDE if available
        if (simpleMDE) {
          simpleMDE.value("");
        } else if (markdownEditor) {
          markdownEditor.value = "";
          if (markdownPreview) {
            markdownPreview.innerHTML = "";
          }
        }
      })
      .catch((error) => console.error("Error saving note:", error));
  }

  // Markdown editor preview functionality - only if not using SimpleMDE
  if (markdownEditor && !simpleMDE) {
    markdownEditor.addEventListener("input", function () {
      if (markdownPreview) {
        markdownPreview.innerHTML = marked.parse(this.value);
      }
    });
  }

  // Request notification permission
  function requestNotificationPermission() {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }

  // Weekly chart initialization
  function initWeeklyChart() {
    fetch("/api/sessions")
      .then((response) => response.json())
      .then((sessions) => {
        // Process data for the last 7 days
        const days = [];
        const dailyDurations = [];

        // Get dates for the last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          days.push(date.toLocaleDateString("en-US", { weekday: "short" }));
          dailyDurations.push(0); // Initialize with 0 minutes
        }

        // Calculate duration for each day
        if (sessions && sessions.length > 0) {
          sessions.forEach((session) => {
            const sessionDate = new Date(session.start_time);
            const today = new Date();

            // Check if session is within the last 7 days
            const diffTime = Math.abs(today - sessionDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 7) {
              const dayIndex = 6 - diffDays;
              dailyDurations[dayIndex] += session.total_time / 60; // Convert seconds to minutes
            }
          });
        }

        // Create the chart
        const ctx = document.getElementById("weekly-chart").getContext("2d");
        new Chart(ctx, {
          type: "bar",
          data: {
            labels: days,
            datasets: [
              {
                label: "Minutes",
                data: dailyDurations,
                backgroundColor: "rgba(231, 76, 60, 0.7)",
                borderColor: "rgba(231, 76, 60, 1)",
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: "Minutes",
                },
              },
            },
            plugins: {
              title: {
                display: true,
                text: "Daily Pomodoro Minutes",
              },
              legend: {
                display: false,
              },
            },
          },
        });
      })
      .catch((error) =>
        console.error("Error loading sessions for chart:", error),
      );
  }

  // Event listeners
  startBtn.addEventListener("click", () => {
    if (isTimerRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  if (stopBtn) {
    stopBtn.addEventListener("click", stopTimer);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetTimer);
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", saveNote);
  }

  // Initialize
  timerDisplay.textContent = formatTime(timeRemaining);
  updateRadialTimer(timeRemaining, pomodoroLength);
  currentPomodoroDisplay.textContent = currentPomodoro;
  requestNotificationPermission();

  // Verify if there's a stored session and validate it
  verifyStoredSession();

  // Initialize weekly chart if it exists
  if (document.getElementById("weekly-chart")) {
    initWeeklyChart();
  }
});
