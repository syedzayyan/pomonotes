document.addEventListener('DOMContentLoaded', () => {
    const sessionsTableBody = document.getElementById('sessions-table-body');
    const sessionModal = document.getElementById('session-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const sessionDetails = document.getElementById('session-details');
    const sessionNotesList = document.getElementById('session-notes-list');
    const addNoteTextarea = document.getElementById('add-note-textarea');
    const addNoteBtn = document.getElementById('add-note-btn');
    
    let currentSessionId = null;
    
    // Load sessions on page load
    loadSessions();
    
    // Load sessions data using fetch
    function loadSessions() {
        sessionsTableBody.innerHTML = '<tr><td colspan="6">Loading sessions...</td></tr>';
        
        fetch('/api/sessions')
            .then(response => {
                console.log('Response status:', response.status);
                return response.text(); // First get as text to see what we're actually getting
            })
            .then(text => {
                console.log('Raw response:', text);
                try {
                    return JSON.parse(text); // Now try to parse as JSON
                } catch (e) {
                    console.error('Failed to parse JSON:', e);
                    sessionsTableBody.innerHTML = '<tr><td colspan="6">Error parsing server response.</td></tr>';
                    throw e;
                }
            })
            .then(sessions => {
                console.log('Parsed sessions:', sessions);
                
                if (sessions && sessions.length > 0) {
                    sessionsTableBody.innerHTML = ''; // Clear loading message
                    
                    sessions.forEach(session => {
                        console.log('Processing session:', session);
                        // Get completed pomodoros
                        const completedPomodoros = session.completed_pomodoros || 0;
                        
                        // Format start time
                        const startDate = new Date(session.start_time);
                        const formattedDate = startDate.toLocaleDateString();
                        
                        // Calculate total time in minutes
                        const totalMinutes = Math.round(session.total_time / 60);
                        
                        // Create row
                        const row = document.createElement('tr');
                        row.setAttribute('data-session-id', session.id);
                        row.className = 'session-row';
                        
                        row.innerHTML = `
                            <td>${session.id}</td>
                            <td>${formattedDate}</td>
                            <td>${completedPomodoros}/4</td>
                            <td>${totalMinutes} min</td>
                            <td><span class="status-badge ${session.status}">${session.status}</span></td>
                            <td>
                                <button class="view-session" data-session-id="${session.id}">View</button>
                                <button class="delete-session" data-session-id="${session.id}">Delete</button>
                            </td>
                        `;
                        
                        sessionsTableBody.appendChild(row);
                    });
                    
                    setupSessionClickHandlers();
                } else {
                    sessionsTableBody.innerHTML = '<tr><td colspan="6">No sessions found.</td></tr>';
                }
            })
            .catch(error => {
                console.error('Error loading sessions:', error);
                sessionsTableBody.innerHTML = '<tr><td colspan="6">Error loading sessions. Please try again.</td></tr>';
            });
    }
    
    // Setup click handlers for session rows
    function setupSessionClickHandlers() {
        // View session buttons
        document.querySelectorAll('.view-session').forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                const sessionId = this.getAttribute('data-session-id');
                openSessionDetails(sessionId);
            });
        });
        
        // Delete session buttons
        document.querySelectorAll('.delete-session').forEach(button => {
            button.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                const sessionId = this.getAttribute('data-session-id');
                
                if (confirm('Are you sure you want to delete this session and all its notes?')) {
                    deleteSession(sessionId);
                }
            });
        });
    }
    
    // Open session details modal
    function openSessionDetails(sessionId) {
        currentSessionId = sessionId;
        
        // Fetch session details
        fetch(`/api/sessions/${sessionId}`)
            .then(response => response.json())
            .then(session => {
                const startDate = new Date(session.start_time);
                const formattedStart = startDate.toLocaleString();
                
                let endTime = 'In progress';
                if (session.end_time) {
                    const endDate = new Date(session.end_time);
                    endTime = endDate.toLocaleString();
                }
                
                const totalMinutes = Math.round(session.total_time / 60);
                const completedPomodoros = session.completed_pomodoros || 0;
                
                // Update modal content
                sessionDetails.innerHTML = `
                    <dl>
                        <dt>Session ID</dt>
                        <dd>${session.id}</dd>
                        <dt>Started</dt>
                        <dd>${formattedStart}</dd>
                        <dt>Ended</dt>
                        <dd>${endTime}</dd>
                        <dt>Duration</dt>
                        <dd>${totalMinutes} minutes</dd>
                        <dt>Pomodoros</dt>
                        <dd>${completedPomodoros}/4</dd>
                        <dt>Status</dt>
                        <dd><span class="status-badge ${session.status}">${session.status}</span></dd>
                    </dl>
                `;
                
                // Fetch notes for this session
                loadSessionNotes(sessionId);
                
                // Show the modal
                sessionModal.showModal();
            })
            .catch(error => {
                console.error('Error loading session details:', error);
                alert('Failed to load session details. Please try again.');
            });
    }
    
    // Load notes for a session
    function loadSessionNotes(sessionId) {
        fetch(`/api/notes/${sessionId}`)
            .then(response => response.json())
            .then(notes => {
                sessionNotesList.innerHTML = '';
                
                if (notes && notes.length > 0) {
                    notes.forEach(note => {
                        const noteDiv = document.createElement('div');
                        noteDiv.className = 'note-item';
                        
                        // Render markdown
                        noteDiv.innerHTML = `
                            <div class="note-content">${marked.parse(note.note)}</div>
                            <div class="note-actions">
                                <button class="edit-note" data-note-id="${note.id}">Edit</button>
                                <button class="delete-note" data-note-id="${note.id}">Delete</button>
                            </div>
                        `;
                        
                        sessionNotesList.appendChild(noteDiv);
                    });
                    
                    // Set up edit and delete handlers
                    setupNoteActionHandlers();
                } else {
                    sessionNotesList.innerHTML = '<p>No notes for this session.</p>';
                }
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                sessionNotesList.innerHTML = '<p>Error loading notes.</p>';
            });
    }
    
    // Set up handlers for note edit/delete buttons
    function setupNoteActionHandlers() {
        // Edit note buttons
        document.querySelectorAll('.edit-note').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                const noteItem = this.closest('.note-item');
                const markdownContent = noteItem.querySelector('.note-content').textContent;
                
                noteItem.innerHTML = `
                    <textarea class="edit-note-textarea">${markdownContent}</textarea>
                    <div class="note-actions">
                        <button class="save-edit" data-note-id="${noteId}">Save</button>
                        <button class="cancel-edit">Cancel</button>
                    </div>
                `;
                
                // Set up save and cancel handlers
                noteItem.querySelector('.save-edit').addEventListener('click', function() {
                    const updatedNote = noteItem.querySelector('.edit-note-textarea').value;
                    updateNote(noteId, updatedNote);
                });
                
                noteItem.querySelector('.cancel-edit').addEventListener('click', function() {
                    // Reload notes to cancel edit
                    loadSessionNotes(currentSessionId);
                });
            });
        });
        
        // Delete note buttons
        document.querySelectorAll('.delete-note').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                
                if (confirm('Are you sure you want to delete this note?')) {
                    deleteNote(noteId);
                }
            });
        });
    }
    
    // Update a note
    function updateNote(noteId, noteText) {
        fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: noteText })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Note updated:', data);
            loadSessionNotes(currentSessionId);
        })
        .catch(error => {
            console.error('Error updating note:', error);
            alert('Failed to update note. Please try again.');
        });
    }
    
    // Delete a note
    function deleteNote(noteId) {
        fetch(`/api/notes/${noteId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Note deleted:', data);
            loadSessionNotes(currentSessionId);
        })
        .catch(error => {
            console.error('Error deleting note:', error);
            alert('Failed to delete note. Please try again.');
        });
    }
    
    // Delete a session
    function deleteSession(sessionId) {
        fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            console.log('Session deleted:', data);
            // Refresh the sessions list
            loadSessions();
        })
        .catch(error => {
            console.error('Error deleting session:', error);
            alert('Failed to delete session. Please try again.');
        });
    }
    
    // Add a new note to the current session
    function addNote() {
        const noteText = addNoteTextarea.value.trim();
        
        if (!noteText) {
            alert('Please enter a note before saving.');
            return;
        }
        
        fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: currentSessionId,
                note: noteText
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Note added:', data);
            addNoteTextarea.value = ''; // Clear the textarea
            loadSessionNotes(currentSessionId);
        })
        .catch(error => {
            console.error('Error adding note:', error);
            alert('Failed to add note. Please try again.');
        });
    }
    
    // Event listeners
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            sessionModal.close();
        });
    }
    
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', addNote);
    }
});
