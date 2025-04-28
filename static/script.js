// Add these sound-related variables at the top of the file, after the existing variables
let notificationCounter = 0;
let badgeSupported = "setAppBadge" in navigator;
let soundEnabled = true; // Default to enabled
let activeTimerNotification = null;
const NOTIFICATION_UPDATE_INTERVAL = 60; // Update every minute

// Add offline support variables
let isOnline = navigator.onLine;
let pendingRequests = [];
const PENDING_REQUESTS_KEY = "pomonotes_pending_requests";
const SESSION_CACHE_KEY = "pomonotes_session_cache";

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
  let currentSkippedPomodoros = 0; // Track skipped pomodoros for accurate time calculation

  // DOM elements
  const timerDisplay = document.getElementById("timer-display");
  const startBtn = document.querySelector(".start-btn");
  const stopBtn = document.querySelector(".stop-btn");
  const resetBtn = document.querySelector(".reset-btn");
  const skipBtn = document.querySelector(".skip-btn");
  const currentPomodoroDisplay = document.getElementById("current-pomodoro");
  const markdownEditor = document.getElementById("markdown-editor");
  const markdownPreview = document.getElementById("markdown-preview");
  const saveBtn = document.querySelector(".save-btn");
  const radialTimer = document.querySelector(".radial-timer circle.progress");
  const confirmModal = document.getElementById("confirm-modal");
  const tagContainer = document.getElementById("tag-container");
  const tagSelect = document.getElementById("tag-select");
  const offlineIndicator = document.createElement("div"); // Offline indicator element

  // Setup offline indicator
  offlineIndicator.className = "offline-indicator";
  offlineIndicator.innerHTML = "You are offline. Changes will sync when connection is restored.";
  offlineIndicator.style.display = "none";
  offlineIndicator.style.backgroundColor = "#f39c12";
  offlineIndicator.style.color = "white";
  offlineIndicator.style.padding = "10px";
  offlineIndicator.style.textAlign = "center";
  offlineIndicator.style.position = "fixed";
  offlineIndicator.style.top = "0";
  offlineIndicator.style.left = "0";
  offlineIndicator.style.right = "0";
  offlineIndicator.style.zIndex = "9999";
  document.body.appendChild(offlineIndicator);

  // Make SimpleMDE globally accessible for htmx integration
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
    window.simpleMDE = simpleMDE; // Make it available globally
  }

  // Load pending requests from localStorage
  function loadPendingRequests() {
    const storedRequests = localStorage.getItem(PENDING_REQUESTS_KEY);
    if (storedRequests) {
      try {
        pendingRequests = JSON.parse(storedRequests);
      } catch (e) {
        console.error("Error parsing stored pending requests:", e);
        pendingRequests = [];
      }
    }
  }

  // Save pending requests to localStorage
  function savePendingRequests() {
    try {
      localStorage.setItem(PENDING_REQUESTS_KEY, JSON.stringify(pendingRequests));
    } catch (e) {
      console.error("Error saving pending requests:", e);
    }
  }

  // Online/offline event handlers
  function handleOffline() {
    isOnline = false;
    offlineIndicator.style.display = "block";
    console.log("App is offline. Changes will be queued.");
  }

  function handleOnline() {
    isOnline = true;
    offlineIndicator.style.display = "none";
    console.log("App is back online. Processing queued requests...");
    processPendingRequests();
  }

  // Process pending requests when back online
  async function processPendingRequests() {
    if (!isOnline || pendingRequests.length === 0) return;

    const requestsToProcess = [...pendingRequests];
    pendingRequests = [];
    savePendingRequests();

    for (const req of requestsToProcess) {
      try {
        const response = await fetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body
        });

        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log(`Processed pending ${req.method} request to ${req.url}:`, data);

        // Handle special cases like updating IDs after creation
        if (req.method === "POST" && req.type === "session" && data.id) {
          if (currentSessionId === req.tempId) {
            currentSessionId = data.id;
            localStorage.setItem("currentSessionId", currentSessionId);
          }
        } else if (req.method === "POST" && req.type === "pomodoro" && data.id) {
          if (currentPomodoroId === req.tempId) {
            currentPomodoroId = data.id;
          }
        } else if (req.method === "POST" && req.type === "break" && data.id) {
          if (currentBreakId === req.tempId) {
            currentBreakId = data.id;
          }
        }
      } catch (error) {
        console.error(`Error processing pending request to ${req.url}:`, error);
        // Re-queue the request for later
        pendingRequests.push(req);
        savePendingRequests();
      }
    }
  }

  // Enhanced fetch function with offline support
  function fetchWithOfflineSupport(url, options = {}, type = null, tempId = null) {
    // If online, try normal fetch
    if (isOnline) {
      return fetch(url, options)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
          }
          return response.json();
        })
        .catch(error => {
          console.error(`Error with fetch to ${url}:`, error);
          
          // If network error, queue the request and handle offline
          if (error.name === 'TypeError' && error.message.includes('Network')) {
            handleOffline();
            const request = {
              url,
              method: options.method || 'GET',
              headers: options.headers || {},
              body: options.body,
              type,
              tempId
            };
            pendingRequests.push(request);
            savePendingRequests();
            
            // For POST requests that create resources, return a temporary object with tempId
            if (options.method === 'POST') {
              try {
                const bodyData = JSON.parse(options.body);
                return Promise.resolve({ ...bodyData, id: tempId });
              } catch (e) {
                return Promise.resolve({ id: tempId });
              }
            }
          }
          
          // Re-throw other errors
          throw error;
        });
    } else {
      // If offline, queue the request immediately
      const request = {
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body,
        type,
        tempId
      };
      pendingRequests.push(request);
      savePendingRequests();
      
      // For POST requests that create resources, return a temporary object with tempId
      if (options.method === 'POST') {
        try {
          const bodyData = JSON.parse(options.body);
          return Promise.resolve({ ...bodyData, id: tempId });
        } catch (e) {
          return Promise.resolve({ id: tempId });
        }
      }
      
      // For other requests, return empty success
      return Promise.resolve({});
    }
  }

  // Cache session data locally
  function cacheSessionData(sessionData) {
    try {
      let sessionCache = {};
      const storedCache = localStorage.getItem(SESSION_CACHE_KEY);
      if (storedCache) {
        sessionCache = JSON.parse(storedCache);
      }
      
      // Update or add the session data
      sessionCache[sessionData.id] = sessionData;
      
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(sessionCache));
    } catch (e) {
      console.error("Error caching session data:", e);
    }
  }

  // Get cached session data
  function getCachedSessionData(sessionId) {
    try {
      const storedCache = localStorage.getItem(SESSION_CACHE_KEY);
      if (storedCache) {
        const sessionCache = JSON.parse(storedCache);
        return sessionCache[sessionId];
      }
    } catch (e) {
      console.error("Error getting cached session data:", e);
    }
    return null;
  }

  // Generate a temporary ID for offline use
  function generateTempId() {
    return 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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

  // Function to update skip button text based on current state
  function updateSkipButtonText() {
    if (!skipBtn) return;
    
    if (isBreak) {
      skipBtn.textContent = "End Break";
    } else if (timeRemaining <= 0) {
      skipBtn.textContent = "End Pom";
    } else {
      skipBtn.textContent = "Skip";
    }
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
    fetchWithOfflineSupport(`/api/sessions/${currentSessionId}`)
      .then((session) => {
        // Prepare the tags string
        const tagsString = currentTags.join(",");

        // Update the session
        return fetchWithOfflineSupport(`/api/sessions/${currentSessionId}`, {
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
      .catch((error) => console.error("Error updating session tags:", error));
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
    const storedSessionId = localStorage.getItem("currentSessionId");

    // Try to get sessions from the server
    fetchWithOfflineSupport("/api/sessions")
      .then(sessions => {
        // If offline and no sessions returned, try to use cached session
        if (!isOnline && (!sessions || sessions.length === 0) && storedSessionId) {
          const cachedSession = getCachedSessionData(storedSessionId);
          if (cachedSession && !["completed", "stopped", "cancelled"].includes(cachedSession.status)) {
            // Restore from cache
            currentSessionId = storedSessionId;
            console.log("Restored cached session:", currentSessionId);
            
            // Restore pomodoro count
            if (cachedSession.completed_pomodoros) {
              currentPomodoro = cachedSession.completed_pomodoros + 1;
              if (currentPomodoroDisplay) {
                currentPomodoroDisplay.textContent = currentPomodoro;
              }
            }
            
            // Restore tags
            if (cachedSession.tags) {
              restoreSessionTags(cachedSession.tags);
            }
            return;
          }
        }
        
        // Look for stored session
        if (storedSessionId) {
          const storedSession = sessions.find(s => s.id === storedSessionId);

          if (!storedSession || ["completed", "stopped", "cancelled"].includes(storedSession.status)) {
            // Clear invalid or completed stored session
            localStorage.removeItem("currentSessionId");
            currentSessionId = null;
          } else {
            // Restore valid stored session
            currentSessionId = storedSessionId;
            console.log("Restored session:", currentSessionId);

            // Restore tags if they exist
            if (storedSession.tags) {
              restoreSessionTags(storedSession.tags);
            }
            
            // Cache this session
            cacheSessionData(storedSession);
          }
        }

        // Check for active session
        const activeSession = sessions.find(session =>
          ["running", "in-progress"].includes(session.status)
        );

        if (activeSession && activeSession.id !== currentSessionId) {
          // Show confirmation to user
          confirmModal.querySelector(".modal-message").textContent =
            `You have an active session (#${activeSession.id}) with ${activeSession.completed_pomodoros} completed pomodoros. Would you like to continue?`;
            
          const confirmBtn = confirmModal.querySelector(".confirm-btn");
          confirmBtn.textContent = "Continue Session";
          confirmBtn.onclick = function() {
            // User wants to continue active session
            currentSessionId = activeSession.id;
            localStorage.setItem("currentSessionId", currentSessionId);
            
            // Update pomodoro count
            currentPomodoro = activeSession.completed_pomodoros + 1;
            if (currentPomodoroDisplay) {
              currentPomodoroDisplay.textContent = currentPomodoro;
            }
            
            // Restore tags
            if (activeSession.tags) {
              restoreSessionTags(activeSession.tags);
            }
            
            // Cache this session
            cacheSessionData(activeSession);
            
            confirmModal.close();
          };
          
          const cancelBtn = confirmModal.querySelector(".cancel-btn");
          cancelBtn.textContent = "Stop Session";
          cancelBtn.onclick = function() {
            // User declined - stop the session
            const now = new Date().toISOString();
            fetchWithOfflineSupport(`/api/sessions/${activeSession.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                end_time: now,
                total_time: activeSession.total_time || 0,
                status: "stopped",
                completed_pomodoros: activeSession.completed_pomodoros || 0,
                tags: activeSession.tags || ""
              })
            })
              .then(data => console.log("Session stopped:", data))
              .catch(error => console.error("Error stopping session:", error));
              
            confirmModal.close();
          };
          
          confirmModal.showModal();
        }
      })
      .catch(error => {
        console.error("Error fetching sessions:", error);
        
        // If we have a stored session ID and are offline, try to restore from cache
        if (!isOnline && storedSessionId) {
          const cachedSession = getCachedSessionData(storedSessionId);
          if (cachedSession && !["completed", "stopped", "cancelled"].includes(cachedSession.status)) {
            // Restore from cache
            currentSessionId = storedSessionId;
            console.log("Restored cached session due to fetch error:", currentSessionId);
            
            // Restore pomodoro count
            if (cachedSession.completed_pomodoros) {
              currentPomodoro = cachedSession.completed_pomodoros + 1;
              if (currentPomodoroDisplay) {
                currentPomodoroDisplay.textContent = currentPomodoro;
              }
            }
            
            // Restore tags
            if (cachedSession.tags) {
              restoreSessionTags(cachedSession.tags);
            }
          }
        }
      });

    // Integrated helper function
    function restoreSessionTags(tagString) {
      if (!tagString) return;
      
      const tagArray = tagString.split(",").filter(tag => tag.trim() !== "");
      currentTags = [];
      tagContainer.innerHTML = "";

      // First try to get tags from the server
      fetchWithOfflineSupport("/api/tags")
        .then(allTags => {
          tagArray.forEach(tagName => {
            const tagInfo = allTags.find(t => t.name === tagName);
            const tagColor = tagInfo ? tagInfo.color : getRandomColor();
            addTag(tagName, tagColor);
          });
        })
        .catch(error => {
          console.error("Error fetching tags:", error);
          // If offline or error, just create tags with random colors
          tagArray.forEach(tagName => {
            addTag(tagName, getRandomColor());
          });
        });
    }
  }
  
  // Create timer notification function
  function createTimerNotification(timeRemaining, isBreak) {
    // Only proceed if notification permission is granted
    if (Notification.permission !== "granted") return;

    // Clear any existing timer notification
    clearTimerNotification();

    const sessionType = isBreak ?
      (currentPomodoro % 4 === 0 ? "Long Break" : "Short Break") :
      `Pomodoro #${currentPomodoro}`;

    let timeDisplay;
    if (timeRemaining < 0) {
      // We're in overtime
      timeDisplay = `OVERTIME: ${formatTime(Math.abs(timeRemaining))}`;
    } else {
      timeDisplay = `${formatTime(timeRemaining)} remaining`;
    }

    const notificationOptions = {
      body: `${sessionType}: ${timeDisplay}`,
      icon: "/static/icon-192x192.png",
      badge: "/static/icon-192x192.png",
      tag: "timer-notification",
      silent: true, // Don't play sound for these updates
      renotify: false,
      // Add actions to allow quick control of the timer
      actions: [
        {
          action: 'pause',
          title: isTimerRunning ? 'Pause' : 'Resume'
        }
      ]
    };

    // Create and show the notification
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification("Pomonotes Timer Running", notificationOptions)
        .then(() => {
          // Store reference to the active notification
          activeTimerNotification = {
            title: "Pomonotes Timer Running",
            options: notificationOptions
          };
        });
    });
  }
  
  function updateTimerNotification(timeRemaining, isBreak) {
    // Only proceed if notification permission is granted
    if (Notification.permission !== "granted") return;

    // Clear existing notification first
    clearTimerNotification();

    // Then create a new one with updated time
    createTimerNotification(timeRemaining, isBreak);
  }
  
  function clearTimerNotification() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
      registration.getNotifications({ tag: 'timer-notification' })
        .then(notifications => {
          notifications.forEach(notification => notification.close());
        });
    });

    activeTimerNotification = null;
  }
  
  // Timer control functions
  function startTimer() {
    if (isTimerRunning) return;

    isTimerRunning = true;
    startBtn.textContent = "Pause";
    startBtn.classList.add("paused");

    // Create or continue a session
    if (!currentSessionId) {
      sessionStartTime = new Date().toISOString();
      const tempId = generateTempId();
      
      // Create a new session with tags
      fetchWithOfflineSupport("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_time: sessionStartTime,
          status: "running",
          tags: currentTags.join(","),
          completed_pomodoros: 0,
          skipped_pomodoros: 0,
        }),
      }, "session", tempId)
        .then((data) => {
          console.log("Session created:", data);
          if (data && data.id) {
            currentSessionId = data.id;
            localStorage.setItem("currentSessionId", currentSessionId);
            
            // Cache the session data
            cacheSessionData({
              id: currentSessionId,
              start_time: sessionStartTime,
              status: "running",
              tags: currentTags.join(","),
              completed_pomodoros: 0,
              skipped_pomodoros: 0
            });
            
            // Update htmx save button to include session ID
            if (saveBtn && saveBtn.hasAttribute('hx-post')) {
              const noteUrl = `/api/notes?session_id=${currentSessionId}`;
              saveBtn.setAttribute('hx-post', noteUrl);
            }
            
            if (currentPomodoro === 1 && !currentPomodoroId) {
              createNewPomodoro();
            }
          }
        })
        .catch((error) => console.error("Error creating session:", error));
    } else if (isPaused) {
      isPaused = false;
    }

    const totalTime = isBreak
      ? currentPomodoro % 4 === 0
        ? longBreakLength
        : shortBreakLength
      : pomodoroLength;

    // Flag to track if we've passed the original time limit
    let hasPassedTimeLimit = timeRemaining <= 0;

    // Create initial timer notification
    createTimerNotification(timeRemaining, isBreak);

    // Track how many seconds since last notification update
    let secondsSinceNotificationUpdate = 0;

    // Using performance.now() for more accurate timing
    const startTime = window.performance.now();
    // Only use expected end time if we haven't passed the limit yet
    const expectedEndTime = !hasPassedTimeLimit ? startTime + (timeRemaining * 1000) : null;
    let lastUpdateTime = startTime;
    let overtimeSeconds = hasPassedTimeLimit ? Math.abs(timeRemaining) : 0;

    // Function to update timer display
    const updateTimer = () => {
      const currentTime = window.performance.now();
      const elapsedSeconds = Math.floor((currentTime - lastUpdateTime) / 1000);

      // Only update if at least a second has passed
      if (elapsedSeconds >= 1) {
        lastUpdateTime = currentTime;
        secondsSinceNotificationUpdate += elapsedSeconds;

        if (!hasPassedTimeLimit) {
          // Update time remaining based on actual elapsed time
          timeRemaining -= elapsedSeconds;

          // Check if we've passed the time limit
          if (timeRemaining <= 0) {
            hasPassedTimeLimit = true;
            overtimeSeconds = Math.abs(timeRemaining);

            // Play sound and vibrate when timer finishes
            playNotificationAlert();

            // Send notification but keep the timer running
            if (Notification.permission === "granted") {
              const phaseType = isBreak
                ? `${currentPomodoro % 4 === 0 ? "Long" : "Short"} break`
                : "Pomodoro";

              new Notification(`${phaseType} Complete!`, {
                body: `Time's up! Timer will continue running for tracking.`,
                icon: "/static/icon-192x192.png",
                badge: "/static/icon-192x192.png",
                tag: "overtime-notification",
                renotify: true,
              });
            }

            // Check if we've completed 4 pomodoros
            if (!isBreak && currentPomodoro >= 4) {
              // Mark session as completed but keep timer running
              completePomodoro();
              updateSessionStatus("completed", calculateTotalTime(), currentPomodoro);
            }
            
            // Update skip button text when entering overtime
            updateSkipButtonText();
          }
        } else {
          // In overtime, just increment the overtime counter
          overtimeSeconds += elapsedSeconds;
        }

        // Format display time differently when in overtime
        let displayTime;
        if (hasPassedTimeLimit) {
          displayTime = "-" + formatTime(overtimeSeconds);
        } else {
          displayTime = formatTime(Math.max(0, timeRemaining));
        }

        // Update displays
        timerDisplay.textContent = displayTime;

        // For radial timer, show either remaining time or full circle in overtime
        if (!hasPassedTimeLimit) {
          updateRadialTimer(Math.max(0, timeRemaining), totalTime);
        } else {
          // In overtime, keep the circle completely filled
          radialTimer.style.strokeDashoffset = 0;
        }

        // Update notification every minute
        if (secondsSinceNotificationUpdate >= NOTIFICATION_UPDATE_INTERVAL) {
          if (hasPassedTimeLimit) {
            // Update with overtime information
            updateTimerNotification(-overtimeSeconds, isBreak);
          } else {
            updateTimerNotification(timeRemaining, isBreak);
          }
          secondsSinceNotificationUpdate = 0;
        }
      }

      // Schedule next update based on the difference between expected and actual time
      const nextUpdateDelay = Math.max(16, 1000 - (window.performance.now() % 1000));
      timerInterval = setTimeout(updateTimer, nextUpdateDelay);
    };

    // Start the timer loop with initial update
    timerInterval = setTimeout(updateTimer, 1000);
  }

  // Pause the timer
  function pauseTimer() {
    if (!isTimerRunning) return;

    clearInterval(timerInterval);
    isTimerRunning = false;
    isPaused = true;
    startBtn.textContent = "Resume";
    startBtn.classList.remove("paused");

    // Update the notification to show paused state
    if (Notification.permission === "granted") {
      clearTimerNotification();
      const sessionType = isBreak ?
        (currentPomodoro % 4 === 0 ? "Long Break" : "Short Break") :
        `Pomodoro #${currentPomodoro}`;

      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification("Pomonotes Timer Paused", {
          body: `${sessionType}: ${formatTime(timeRemaining)} remaining`,
          icon: "/static/icon-192x192.png",
          badge: "/static/icon-192x192.png",
          tag: "timer-notification",
          silent: true,
          actions: [
            {
              action: 'resume',
              title: 'Resume'
            }
          ]
        });
      });
    }

    // Update the current pomodoro or break status in the database
    if (isBreak) {
      updateBreakStatus("paused");
    } else {
      updatePomodoroStatus("paused");
    }
  }

  // Calculate the total time accounting for skipped pomodoros
  function calculateTotalTime() {
    // Calculate time for completed pomodoros
    const completedCount = Math.max(0, currentPomodoro - (isBreak ? 0 : 1));
    
    // This fixes the incorrect total time calculation for skipped sessions
    // Only count time for actual completed pomodoros, not skipped ones
    const completedTime = (completedCount - currentSkippedPomodoros) * pomodoroLength;
    
    // Add time for the current incomplete pomodoro if not in a break
    let currentPomodoroTime = 0;
    if (!isBreak && timeRemaining < pomodoroLength) {
      currentPomodoroTime = pomodoroLength - timeRemaining;
    }
    
    return completedTime + currentPomodoroTime;
  }

  function skipTimer() {
    if (!isTimerRunning && !isPaused) return;

    // Show confirmation modal
    confirmModal.querySelector(".modal-message").textContent =
      `Are you sure you want to skip the current ${isBreak ? "break" : "pomodoro"}?`;

    // Set up confirm button action
    const confirmBtn = confirmModal.querySelector(".confirm-btn");
    confirmBtn.onclick = function () {
      confirmModal.close();
      executeSkipTimer();
    };

    // Set up cancel button action
    const cancelBtn = confirmModal.querySelector(".cancel-btn");
    cancelBtn.onclick = function () {
      confirmModal.close();
    };

    confirmModal.showModal();
  }

  // Modified executeSkipTimer to handle end of 4 pomodoros and track skipped pomodoros
  function executeSkipTimer() {
    clearTimeout(timerInterval);
    
    // Update current timer in database
    if (!isBreak && timeRemaining <= 0) {
      // We've already passed the full pomodoro time, mark as completed instead of skipped
      updatePomodoroStatus("completed");
    } else if (!isBreak) {
      // Normal skip behavior for an incomplete pomodoro
      updatePomodoroStatus("skipped");
      
      // Track that this pomodoro was skipped for accurate time calculation
      currentSkippedPomodoros++;
      
      // Update skipped_pomodoros count in session
      if (currentSessionId) {
        updateSessionSkippedPomodoros(currentSkippedPomodoros);
      }
    } else {
      // Skip behavior for breaks remains unchanged
      updateBreakStatus("skipped");
    }

    // Check if we've completed 4 pomodoros
    const completingFourthPomodoro = !isBreak && currentPomodoro === 4;

    // Transition to next phase
    if (isBreak) {
      // If in break, move to next pomodoro
      isBreak = false;
      if (currentPomodoro < 4) {
        currentPomodoro++;
        currentPomodoroDisplay.textContent = currentPomodoro;
      }
      timeRemaining = pomodoroLength;
      radialTimer.style.stroke = "#e74c3c"; // Red for pomodoro
      createNewPomodoro();
    } else {
      // If in pomodoro, move to break
      isBreak = true;
      timeRemaining = currentPomodoro % 4 === 0 ? longBreakLength : shortBreakLength;
      radialTimer.style.stroke = "#3498db"; // Blue for break
      createNewBreak();

      // If we've completed the 4th pomodoro, mark session as completed
      if (completingFourthPomodoro) {
        // Use our accurate time calculation that accounts for skipped pomodoros
        updateSessionStatus("completed", calculateTotalTime(), 4);
      }
    }

    // Update timer display
    timerDisplay.textContent = formatTime(timeRemaining);
    updateRadialTimer(timeRemaining, timeRemaining);
    
    // Update skip button text based on new state
    updateSkipButtonText();

    // If timer was running, restart it
    if (isTimerRunning) {
      isTimerRunning = false; // Reset so startTimer doesn't return early
      startTimer();
    } else if (isPaused) {
      isPaused = false;
      startBtn.textContent = "Start";
      startBtn.classList.remove("paused");
    }

    // Clear any notifications and update UI
    clearTimerNotification();

    // If we're transitioning to a break, show notification
    if (isBreak && Notification.permission === "granted") {
      const breakType = currentPomodoro % 4 === 0 ? "long" : "short";
      new Notification("Pomodoro Skipped", {
        body: `Moving to a ${breakType} break.`,
        icon: "/static/icon-192x192.png",
        badge: "/static/icon-192x192.png",
        tag: "pomodoro-notification",
        renotify: true,
      });
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

    clearTimerNotification();

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

    // Calculate completed pomodoros
    const completedPomodoros = Math.max(0, currentPomodoro - (isBreak ? 0 : 1));

    // Calculate total time using our accurate method
    const totalTime = calculateTotalTime();

    isBreak = false;
    currentPomodoro = 1;
    currentPomodoroId = null;
    currentBreakId = null;
    currentSkippedPomodoros = 0; // Reset skipped count
    currentPomodoroDisplay.textContent = currentPomodoro;
    timeRemaining = pomodoroLength;
    timerDisplay.textContent = formatTime(timeRemaining);
    updateRadialTimer(timeRemaining, pomodoroLength);
    radialTimer.style.stroke = "#e74c3c"; // Red for pomodoro
    
    // Update skip button text
    updateSkipButtonText();
    
    // Update session in database
    return fetchWithOfflineSupport(`/api/sessions/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        total_time: totalTime,
        status: "stopped",
        completed_pomodoros: completedPomodoros,
        skipped_pomodoros: currentSkippedPomodoros,
        tags: currentTags.join(","),
      }),
    })
      .then(response => {
        // Remove session ID from save button
        if (saveBtn && saveBtn.hasAttribute('hx-post')) {
          saveBtn.setAttribute('hx-post', '/api/notes');
        }
        
        // Clear session ID
        currentSessionId = null;
        localStorage.removeItem("currentSessionId");
        
        return response;
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
    currentSkippedPomodoros = 0; // Reset skipped count
    currentPomodoroDisplay.textContent = currentPomodoro;
    timeRemaining = pomodoroLength;
    timerDisplay.textContent = formatTime(timeRemaining);
    updateRadialTimer(timeRemaining, pomodoroLength);
    radialTimer.style.stroke = "#e74c3c"; // Red for pomodoro
    startBtn.textContent = "Start";
    startBtn.classList.remove("paused");
    
    // Update skip button text to initial state
    updateSkipButtonText();

    clearTimerNotification();

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
      
      // Remove session ID from save button
      if (saveBtn && saveBtn.hasAttribute('hx-post')) {
        saveBtn.setAttribute('hx-post', '/api/notes');
      }
    }

    // Clear notification counter when resetting
    clearNotificationCounter();
  }

  // Helper functions for database updates
  function createNewPomodoro() {
    // Only create if we have a session ID
    if (!currentSessionId) return;

    const tempId = generateTempId();
    
    fetchWithOfflineSupport("/api/pomodoros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        number: currentPomodoro,
        start_time: new Date().toISOString(),
        status: "running",
      }),
    }, "pomodoro", tempId)
      .then((data) => {
        if (data && data.id) {
          currentPomodoroId = data.id;
          
          // Update notes endpoint to include pomodoro_id
          if (saveBtn && saveBtn.hasAttribute('hx-post') && currentSessionId) {
            const noteUrl = `/api/notes?session_id=${currentSessionId}&pomodoro_id=${data.id}`;
            saveBtn.setAttribute('hx-post', noteUrl);
          }
        }
      })
      .catch((error) => console.error("Error creating pomodoro:", error));
  }

  function completePomodoro() {
    // Only update if we have a pomodoro ID
    if (!currentPomodoroId) return;

    // Get the actual time worked (could be more than pomodoroLength)
    const actualTimeWorked = pomodoroLength - Math.min(timeRemaining, pomodoroLength);

    // Update pomodoro with actual time worked
    const now = new Date().toISOString();
    fetchWithOfflineSupport(`/api/pomodoros/${currentPomodoroId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        duration: actualTimeWorked,
        status: "completed",
      }),
    })
      .catch((error) => console.error("Error updating pomodoro:", error));

    // Update session progress
    updateSessionProgress();
  }

  function updatePomodoroStatus(status) {
    // Only update if we have a pomodoro ID
    if (!currentPomodoroId) return;

    const now = new Date().toISOString();
    const elapsedSeconds = pomodoroLength - timeRemaining;

    fetchWithOfflineSupport(`/api/pomodoros/${currentPomodoroId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        duration: elapsedSeconds,
        status: status,
      }),
    })
      .catch((error) => console.error("Error updating pomodoro:", error));
  }

  function createNewBreak() {
    // Only create if we have a session ID and pomodoro ID
    if (!currentSessionId || !currentPomodoroId) return;

    const breakType = currentPomodoro % 4 === 0 ? "long" : "short";
    const tempId = generateTempId();

    fetchWithOfflineSupport("/api/breaks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: currentSessionId,
        pomodoro_id: currentPomodoroId,
        type: breakType,
        start_time: new Date().toISOString(),
        status: "running",
      }),
    }, "break", tempId)
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

    fetchWithOfflineSupport(`/api/breaks/${currentBreakId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        end_time: now,
        duration: elapsedSeconds,
        status: status,
      }),
    })
      .catch((error) => console.error("Error updating break:", error));

    // Reset the current break ID
    currentBreakId = null;
  }

  // Update skipped pomodoros count in the session
  function updateSessionSkippedPomodoros(skippedCount) {
    if (!currentSessionId) return;

    fetchWithOfflineSupport(`/api/sessions/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skipped_pomodoros: skippedCount
      }),
    })
      .catch((error) => console.error("Error updating session skipped pomodoros:", error));
  }

  function updateSessionProgress() {
    if (!currentSessionId) return;

    // Calculate completed pomodoros
    const completedPomodoros = Math.max(0, currentPomodoro - (isBreak ? 0 : 1));

    // Calculate total time using our accurate method
    const totalTime = calculateTotalTime();

    // Update session status
    const status = completedPomodoros >= 4 ? "completed" : "in-progress";
    updateSessionStatus(status, totalTime, completedPomodoros);
  }

  function updateSessionStatus(status, totalTime = 0, completedPomodoros = 0) {
    if (!currentSessionId) return;

    const sessionData = {
      end_time: new Date().toISOString(),
      total_time: totalTime,
      status: status,
      completed_pomodoros: completedPomodoros,
      skipped_pomodoros: currentSkippedPomodoros,
      tags: currentTags.join(","),
    };

    fetchWithOfflineSupport(`/api/sessions/${currentSessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sessionData),
    })
      .then(() => {
        // Update the cached session data
        const cachedSession = getCachedSessionData(currentSessionId);
        if (cachedSession) {
          cacheSessionData({
            ...cachedSession,
            ...sessionData
          });
        }
      })
      .catch((error) => console.error("Error updating session:", error));
  }

  // Request notification permission
  function requestNotificationPermission() {
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        console.log("Notification permission:", permission);

        // If granted, we can use notifications
        if (permission === "granted") {
          // If timer is already running, create a notification for it
          if (isTimerRunning) {
            createTimerNotification(timeRemaining, isBreak);
          }
        }
      });
    }
  }
  
  // Handle offline error with custom modal message
  function showOfflineErrorModal(message) {
    confirmModal.querySelector(".modal-message").textContent = message || 
      "You are currently offline. Your data will be saved locally and synced when you're back online.";
    
    const confirmBtn = confirmModal.querySelector(".confirm-btn");
    confirmBtn.textContent = "OK";
    confirmBtn.onclick = function() {
      confirmModal.close();
    };
    
    // Hide the cancel button for this info message
    const cancelBtn = confirmModal.querySelector(".cancel-btn");
    cancelBtn.style.display = "none";
    
    confirmModal.showModal();
    
    // Make sure to reset the cancel button display when modal is closed
    confirmModal.addEventListener('close', function onClose() {
      cancelBtn.style.display = "block";
      confirmModal.removeEventListener('close', onClose);
    });
  }
  
  navigator.serviceWorker.addEventListener('message', function (event) {
    console.log('Message received from service worker:', event.data);

    // Handle timer control messages
    if (event.data.action === 'pauseTimer' && isTimerRunning) {
      pauseTimer();
    } else if (event.data.action === 'resumeTimer' && !isTimerRunning && isPaused) {
      startTimer();
    }
  });
  
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

  // Event listeners for online/offline status
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Check initial online status
  if (!navigator.onLine) {
    handleOffline();
  }

  // Event listeners
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (isTimerRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    });
  }

  if (skipBtn) {
    skipBtn.addEventListener("click", skipTimer);
    
    // Set initial skip button text
    updateSkipButtonText();
  }

  if (stopBtn) {
    stopBtn.addEventListener("click", stopTimer);
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", resetTimer);
  }

  // Add htmx event listener for tag selection
  if (tagSelect) {
    tagSelect.addEventListener("change", function() {
      const selectedTag = this.value;
      if (!selectedTag) return;
      
      // Get tag color
      let tagColor = "#3498db"; // Default blue
      const selectedOption = this.options[this.selectedIndex];
      if (selectedOption && selectedOption.getAttribute("data-color")) {
        tagColor = selectedOption.getAttribute("data-color");
      }
      
      // Add tag if not already selected
      if (!currentTags.includes(selectedTag)) {
        addTag(selectedTag, tagColor);
      }
      
      // Reset select to default option
      this.value = "";
    });
  }

  // Handle tag input via htmx
  document.body.addEventListener('htmx:afterRequest', function(event) {
    // If a tag was added successfully
    if (event.detail.pathInfo.requestPath === '/api/tags' && 
        event.detail.pathInfo.method === 'POST' && 
        event.detail.successful) {
      
      // Get the response data
      const newTag = JSON.parse(event.detail.xhr.responseText);
      
      if (newTag && newTag.name) {
        // Add the tag to the UI
        addTag(newTag.name, newTag.color || getRandomColor());
        
        // Clear tag input
        if (tagInput) {
          tagInput.value = '';
        }
      }
    }
    
    // If a note was saved successfully
    if (event.detail.pathInfo.requestPath.startsWith('/api/notes') && 
        event.detail.pathInfo.method === 'POST' && 
        event.detail.successful) {
      
      // Clear the editor
      if (window.simpleMDE) {
        window.simpleMDE.value('');
      } else if (markdownEditor) {
        markdownEditor.value = '';
        if (markdownPreview) {
          markdownPreview.innerHTML = '';
        }
      }
      
      // Show success message
      alert('Note saved successfully!');
    }
  });

  // Handle htmx error events
  document.body.addEventListener('htmx:responseError', function(event) {
    // Check if offline error
    if (!navigator.onLine || event.detail.xhr.status === 0) {
      handleOffline();
      
      // Show offline message
      showOfflineErrorModal();
      
      // Try to handle the request offline if applicable
      const url = event.detail.requestConfig.path;
      const method = event.detail.requestConfig.verb;
      
      // For now, just inform the user their changes will sync later
      console.log(`Handling offline request: ${method} ${url}`);
    }
  });
  // If using SimpleMDE, setup the save note functionality
  if (saveBtn && !saveBtn.hasAttribute('hx-post')) {
    saveBtn.addEventListener("click", function() {
      // Get note content from SimpleMDE or regular textarea
      const noteText = window.simpleMDE 
        ? window.simpleMDE.value().trim() 
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
      
      // Create note data
      const noteData = {
        session_id: currentSessionId,
        pomodoro_id: currentPomodoroId,
        note: noteText
      };
      
      // Save the note
      fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(noteData)
      })
        .then(response => response.json())
        .then(data => {
          console.log("Note saved:", data);
          
          // Clear the editor
          if (window.simpleMDE) {
            window.simpleMDE.value("");
          } else if (markdownEditor) {
            markdownEditor.value = "";
            if (markdownPreview) {
              markdownPreview.innerHTML = "";
            }
          }
          
          alert("Note saved successfully!");
        })
        .catch(error => console.error("Error saving note:", error));
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
  restoreNotificationCounter();
  verifyStoredSession();
  updateSkipButtonText(); // Set initial skip button text
});