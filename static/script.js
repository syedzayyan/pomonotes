// Add these sound-related variables at the top of the file, after the existing variables
let notificationCounter = 0;
let badgeSupported = "setAppBadge" in navigator;
let soundEnabled = true; // Default to enabled

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
  let currentTags = []; // Array to store selected tags

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
  const tagContainer = document.getElementById("tag-container");
  const tagInput = document.getElementById("tag-input");
  const addTagBtn = document.getElementById("add-tag-btn");
  const tagSelect = document.getElementById("tag-select");

  // Initialize sound
  function preloadNotificationSound() {
    // Get sound element from DOM or create a new audio instance
    const notificationSound =
      document.getElementById("notification-sound") ||
      new Audio("/static/notification.mp3");

    // Load the sound
    notificationSound.load();

    // Check if sound should be enabled
    const savedPreference = localStorage.getItem("sound-enabled");
    soundEnabled = savedPreference === null ? true : savedPreference === "true";

    // Update checkbox if it exists
    const soundEnabledCheckbox = document.getElementById("sound-enabled");
    if (soundEnabledCheckbox) {
      soundEnabledCheckbox.checked = soundEnabled;
    }

    // Try to play and immediately pause to enable audio on iOS
    // This helps with iOS restrictions on audio playback
    if (soundEnabled) {
      notificationSound
        .play()
        .then(() => {
          notificationSound.pause();
          notificationSound.currentTime = 0;
        })
        .catch((err) => {
          console.log("Audio preload failed, will try again when needed:", err);
        });
    }
  }

  // Play notification sound and vibrate
  function playNotificationAlert() {
    // Check if sound is enabled in the UI
    const soundEnabledCheckbox = document.getElementById("sound-enabled");
    if (soundEnabledCheckbox) {
      soundEnabled = soundEnabledCheckbox.checked;
    } else {
      // Use stored preference if checkbox isn't available
      const savedPreference = localStorage.getItem("sound-enabled");
      soundEnabled =
        savedPreference === null ? true : savedPreference === "true";
    }

    // Play sound if enabled
    if (soundEnabled) {
      const notificationSound =
        document.getElementById("notification-sound") ||
        new Audio("/static/notification.mp3");
      notificationSound
        .play()
        .catch((err) => console.log("Could not play notification sound:", err));
    }

    // Vibrate if supported (most mobile devices)
    if ("vibrate" in navigator) {
      navigator.vibrate([200, 100, 200]); // Vibrate for 200ms, pause for 100ms, vibrate for 200ms
    }

    // Increment notification counter
    notificationCounter++;

    // Update app badge if supported
    if (badgeSupported) {
      navigator.setAppBadge(notificationCounter).catch((err) => {
        console.log("Could not set app badge:", err);
      });
    }

    // Store the counter in localStorage to persist between sessions
    localStorage.setItem("notificationCounter", notificationCounter);
  }

  // Clear notification counter
  function clearNotificationCounter() {
    notificationCounter = 0;
    localStorage.setItem("notificationCounter", 0);

    if (badgeSupported) {
      navigator.clearAppBadge().catch((err) => {
        console.log("Could not clear app badge:", err);
      });
    }
  }

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

  // Load all available tags from the server
  function loadTags() {
    if (!tagSelect) return;

    fetch("/api/tags")
      .then((response) => response.json())
      .then((tags) => {
        // Clear current options
        tagSelect.innerHTML = "";

        // Add a default "Add tag..." option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.text = "Add tag...";
        tagSelect.appendChild(defaultOption);

        // Add each tag as an option
        tags.forEach((tag) => {
          const option = document.createElement("option");
          option.value = tag.name;
          option.text = tag.name;
          option.setAttribute("data-color", tag.color);
          tagSelect.appendChild(option);
        });
      })
      .catch((error) => {
        console.error("Error loading tags:", error);
      });
  }

  // Handle tag selection
  function handleTagSelection() {
    if (!tagSelect || !tagContainer) return;

    const selectedTag = tagSelect.value;
    if (!selectedTag) return;

    // Get the color or use a default
    let tagColor = "#3498db"; // Default blue
    const selectedOption = tagSelect.options[tagSelect.selectedIndex];
    if (selectedOption && selectedOption.getAttribute("data-color")) {
      tagColor = selectedOption.getAttribute("data-color");
    }

    // Add tag if it's not already selected
    if (!currentTags.includes(selectedTag)) {
      addTag(selectedTag, tagColor);
    }

    // Reset the select to the default option
    tagSelect.value = "";
  }

  // Add a tag to the current session
  function addTag(tagName, tagColor) {
    if (!tagContainer) return;

    // Create tag element
    const tagElement = document.createElement("span");
    tagElement.className = "tag";
    tagElement.textContent = tagName;
    tagElement.style.backgroundColor = tagColor;

    // Add remove button
    const removeBtn = document.createElement("span");
    removeBtn.className = "tag-remove";
    removeBtn.textContent = "×";
    removeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      removeTag(tagName);
      tagElement.remove();
    });

    tagElement.appendChild(removeBtn);
    tagContainer.appendChild(tagElement);

    // Add to current tags array
    currentTags.push(tagName);

    // If session is active, update it with the new tag
    if (currentSessionId) {
      updateSessionTags();
    }
  }

  // Remove a tag from the current session
  function removeTag(tagName) {
    const index = currentTags.indexOf(tagName);
    if (index !== -1) {
      currentTags.splice(index, 1);

      // If session is active, update it
      if (currentSessionId) {
        updateSessionTags();
      }
    }
  }

  // Update session tags in the database
  function updateSessionTags() {
    if (!currentSessionId) return;

    // Get current session data first
    fetch(`/api/sessions/${currentSessionId}`)
      .then((response) => response.json())
      .then((session) => {
        // Prepare the tags string
        const tagsString = currentTags.join(",");

        // Update the session
        return fetch(`/api/sessions/${currentSessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            end_time: session.end_time,
            total_time: session.total_time,
            status: session.status,
            completed_pomodoros: session.completed_pomodoros,
            tags: tagsString,
          }),
        });
      })
      .then((response) => response.json())
      .catch((error) => console.error("Error updating session tags:", error));
  }

  // Add a new tag (typed by user)
  function addNewTag() {
    if (!tagInput || !tagContainer) return;

    const tagName = tagInput.value.trim();
    if (!tagName) return;

    // Check if tag already exists
    if (currentTags.includes(tagName)) {
      tagInput.value = "";
      return;
    }

    // Create the tag in the database first
    fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: tagName,
        color: getRandomColor(),
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log("Tag created:", data);

        // Add tag to UI
        addTag(tagName, getRandomColor());

        // Clear input
        tagInput.value = "";

        // Reload tags in select
        loadTags();
      })
      .catch((error) => {
        console.error("Error creating tag:", error);
      });
  }

  // Generate a random color for new tags
  function getRandomColor() {
    const colors = [
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
    ];

    return colors[Math.floor(Math.random() * colors.length)];
  }

  // Verify stored session on page load
  function verifyStoredSession() {
    // Fetch all sessions (already implemented in loadSessions)
    fetch("/api/sessions")
      .then((response) => response.json())
      .then((sessions) => {
        // Check if any sessions are active
        const activeSession = sessions.find(
          (session) =>
            session.status === "running" || session.status === "in-progress",
        );

        if (activeSession) {
          // Ask user if they want to continue
          if (
            confirm(
              `You have an active session (#${activeSession.id}) with ${activeSession.completed_pomodoros} completed pomodoros. Would you like to continue?`,
            )
          ) {
            // Set current session
            currentSessionId = activeSession.id;
            localStorage.setItem("currentSessionId", currentSessionId);

            // Set current pomodoro count (add 1 since we're starting a new one)
            currentPomodoro = activeSession.completed_pomodoros + 1;
            if (currentPomodoroDisplay) {
              currentPomodoroDisplay.textContent = currentPomodoro;
            }

            // Restore tags
            if (activeSession.tags) {
              const tagArray = activeSession.tags
                .split(",")
                .map((tag) => tag.trim());
              // Rest of tag restoration code (already in verifyStoredSession)
            }
          } else {
            // User chose not to continue - stop the session
            const now = new Date().toISOString();

            // Update the session with stopped status
            fetch(`/api/sessions/${activeSession.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                end_time: now,
                total_time: activeSession.total_time || 0,
                status: "stopped",
                completed_pomodoros: activeSession.completed_pomodoros || 0,
                tags: activeSession.tags || "",
              }),
            })
              .then((response) => response.json())
              .then((data) => {
                console.log("Session stopped:", data);
              })
              .catch((error) => {
                console.error("Error stopping session:", error);
              });
          }
        }
      })
      .catch((error) =>
        console.error("Error checking for active sessions:", error),
      );
  }
  function checkForActiveServerSession() {

  }

  // Timer control functions
  function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    startBtn.textContent = "Pause";
    startBtn.classList.add("paused");

    if (!currentSessionId) {
      sessionStartTime = new Date().toISOString();
      // Create a new session in the database with tags
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: sessionStartTime,
          status: "running",
          tags: currentTags.join(","),
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

        // Play sound and vibrate when timer finishes
        playNotificationAlert();

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
              badge: "/static/icon-192x192.png", // Add badge for notifications on some platforms
              tag: "pomodoro-notification", // Group similar notifications
              renotify: true, // Make the device vibrate/alert even if a notification with the same tag already exists
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

    // Update the session with stopped status and current tags
    return fetch(`/api/sessions/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        total_time: totalTime,
        status: "stopped",
        completed_pomodoros: completedPomodoros,
        tags: currentTags.join(","),
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

    // Clear tags
    currentTags = [];
    if (tagContainer) {
      tagContainer.innerHTML = "";
    }

    // Only try to update the session if we have a session ID
    if (currentSessionId) {
      // Update session as cancelled in database
      updateSessionStatus("cancelled");

      // Reset the session
      currentSessionId = null;
      localStorage.removeItem("currentSessionId");
    }

    // Clear notification counter when resetting
    clearNotificationCounter();
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
        tags: currentTags.join(","),
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
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission:", permission);
        // If granted, we might as well try to register for push notifications
        if (permission === "granted" && "serviceWorker" in navigator) {
          // You'd typically register for push notifications here
          console.log("Notification permission granted");
        }
      });
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
        const ctx = document.getElementById("weekly-chart");
        if (ctx) {
          const chartContext = ctx.getContext("2d");
          new Chart(chartContext, {
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
        }
      })
      .catch((error) =>
        console.error("Error loading sessions for chart:", error),
      );
  }

  // Restore notification counter from localStorage
  function restoreNotificationCounter() {
    const storedCounter = localStorage.getItem("notificationCounter");
    if (storedCounter !== null) {
      notificationCounter = parseInt(storedCounter);

      // Update badge if supported
      if (badgeSupported && notificationCounter > 0) {
        navigator.setAppBadge(notificationCounter).catch((err) => {
          console.log("Could not restore app badge:", err);
        });
      }
    }
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

  // Tag event listeners
  if (tagSelect) {
    tagSelect.addEventListener("change", handleTagSelection);
  }

  if (addTagBtn && tagInput) {
    addTagBtn.addEventListener("click", addNewTag);

    // Also allow for enter key
    tagInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        addNewTag();
      }
    });
  }

  // Clear notifications when user interacts with the app
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      clearNotificationCounter();
    }
  });

  // Initialize
  timerDisplay.textContent = formatTime(timeRemaining);
  updateRadialTimer(timeRemaining, pomodoroLength);
  currentPomodoroDisplay.textContent = currentPomodoro;
  requestNotificationPermission();
  preloadNotificationSound();
  restoreNotificationCounter();

  // Load tags
  loadTags();

  // Verify if there's a stored session and validate it
  verifyStoredSession();

  checkForActiveServerSession();
});