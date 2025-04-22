document.addEventListener('DOMContentLoaded', () => {
    const sessionsTableBody = document.getElementById('sessions-table-body');
    const sessionModal = document.getElementById('session-modal');
    const closeModalBtn = document.getElementById('close-modal');
    const sessionDetails = document.getElementById('session-details');
    const sessionNotesList = document.getElementById('session-notes-list');
    const addNoteTextarea = document.getElementById('add-note-textarea');
    const addNoteBtn = document.getElementById('add-note-btn');
    const editorModal = document.getElementById('editor-modal');
    
    let currentSessionId = null;
    let currentNoteId = null;
    let addNoteEditor = null;
    let editNoteEditor = null;
    let fullPageEditor = null;
    
    // Check URL for session parameter to open specific session
    function checkUrlForSession() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session');
        if (sessionId) {
            openSessionDetails(sessionId);
        }
    }
    
    // Load sessions on page load
    loadSessions();
    
    // Initialize SimpleMDE for add note textarea when modal is shown
    function initializeAddNoteEditor() {
        if (!addNoteEditor && addNoteTextarea) {
            addNoteEditor = new SimpleMDE({
                element: addNoteTextarea,
                spellChecker: false,
                status: false,
                placeholder: "Add a new note to this session...",
                toolbar: [
                    'bold', 'italic', 'heading', '|',
                    'quote', 'unordered-list', 'ordered-list', '|',
                    'link', 'image', '|',
                    'preview', 'guide'
                ]
            });
        }
    }
    
    // Initialize full page editor
    function initializeFullPageEditor(noteContent, noteId) {
        const editorTextarea = document.getElementById('fullpage-editor-textarea');
        if (!editorTextarea) return;
        
        if (fullPageEditor) {
            fullPageEditor.toTextArea();
            fullPageEditor = null;
        }
        
        editorTextarea.value = noteContent;
        
        fullPageEditor = new SimpleMDE({
            element: editorTextarea,
            spellChecker: false,
            autofocus: true,
            toolbar: [
                'bold', 'italic', 'heading', '|',
                'quote', 'unordered-list', 'ordered-list', '|',
                'link', 'image', '|',
                'preview', 'side-by-side', 'fullscreen', '|',
                'guide'
            ]
        });
        
        currentNoteId = noteId;
    }
    
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
                    // Check if we should open a specific session
                    checkUrlForSession();
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
        
        // Update URL with session ID without reloading
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.pushState({}, '', url);
        
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
                
                // Initialize the add note editor
                setTimeout(initializeAddNoteEditor, 100);
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
                        
                        // Store the raw markdown and render it
                        noteDiv.innerHTML = `
                            <div class="note-content" data-markdown="${escapeHTML(note.note)}">${marked.parse(note.note)}</div>
                            <div class="note-actions">
                                <button class="edit-note" data-note-id="${note.id}">Edit</button>
                                <button class="edit-fullpage" data-note-id="${note.id}">Full Page Edit</button>
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
                
                // Get the raw markdown content
                const markdownContent = noteItem.querySelector('.note-content').dataset.markdown || 
                                       noteItem.querySelector('.note-content').textContent;
                
                // Replace with textarea for editing
                noteItem.innerHTML = `
                    <textarea class="edit-note-textarea" id="edit-note-${noteId}">${markdownContent}</textarea>
                    <div class="note-actions">
                        <button class="save-edit" data-note-id="${noteId}">Save</button>
                        <button class="cancel-edit">Cancel</button>
                    </div>
                `;
                
                // Initialize SimpleMDE for the edit textarea
                const editTextarea = document.getElementById(`edit-note-${noteId}`);
                if (editTextarea) {
                    editNoteEditor = new SimpleMDE({
                        element: editTextarea,
                        spellChecker: false,
                        status: false,
                        toolbar: [
                            'bold', 'italic', 'heading', '|',
                            'quote', 'unordered-list', 'ordered-list', '|',
                            'link', 'image', '|',
                            'preview', 'guide'
                        ]
                    });
                }
                
                // Set up save and cancel handlers
                noteItem.querySelector('.save-edit').addEventListener('click', function() {
                    const updatedNote = editNoteEditor ? editNoteEditor.value() : 
                                        noteItem.querySelector('.edit-note-textarea').value;
                    updateNote(noteId, updatedNote);
                    
                    // Clean up SimpleMDE instance
                    if (editNoteEditor) {
                        editNoteEditor.toTextArea();
                        editNoteEditor = null;
                    }
                });
                
                noteItem.querySelector('.cancel-edit').addEventListener('click', function() {
                    // Clean up SimpleMDE instance
                    if (editNoteEditor) {
                        editNoteEditor.toTextArea();
                        editNoteEditor = null;
                    }
                    
                    // Reload notes to cancel edit
                    loadSessionNotes(currentSessionId);
                });
            });
        });
        
        // Full Page Edit buttons
        document.querySelectorAll('.edit-fullpage').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                const noteItem = this.closest('.note-item');
                
                // Get the raw markdown content
                const markdownContent = noteItem.querySelector('.note-content').dataset.markdown || 
                                       noteItem.querySelector('.note-content').textContent;
                
                // Open the editor modal
                openFullPageEditor(markdownContent, noteId);
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
    
    // Open the full-page editor modal
    function openFullPageEditor(content, noteId) {
        if (!editorModal) {
            console.error('Editor modal not found in the DOM');
            return;
        }
        
        // Initialize the editor with content
        const titleElement = document.getElementById('editor-title');
        if (titleElement) {
            titleElement.textContent = `Editing Note for Session #${currentSessionId}`;
        }
        
        initializeFullPageEditor(content, noteId);
        editorModal.showModal();
    }
    
    // Close the full-page editor modal
    function closeFullPageEditor() {
        if (fullPageEditor) {
            fullPageEditor.toTextArea();
            fullPageEditor = null;
        }
        if (editorModal) {
            editorModal.close();
        }
    }
    
    // Save the note from full-page editor
    function saveFullPageNote() {
        if (!fullPageEditor || !currentNoteId) return;
        
        const updatedContent = fullPageEditor.value();
        updateNote(currentNoteId, updatedContent, true);
    }
    
    // Update a note
    function updateNote(noteId, noteText, closeEditorAfterSave = false) {
        fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: noteText })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Note updated:', data);
            
            if (closeEditorAfterSave) {
                closeFullPageEditor();
            }
            
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
            
            // If the current modal session is being deleted, close it
            if (sessionId === currentSessionId && sessionModal.open) {
                sessionModal.close();
            }
            
            // Refresh the sessions list
            loadSessions();
            
            // Clear session parameter from URL
            const url = new URL(window.location);
            url.searchParams.delete('session');
            window.history.pushState({}, '', url);
        })
        .catch(error => {
            console.error('Error deleting session:', error);
            alert('Failed to delete session. Please try again.');
        });
    }
    
    // Add a new note to the current session
    function addNote() {
        const noteText = addNoteEditor ? addNoteEditor.value() : addNoteTextarea.value.trim();
        
        if (!noteText) {
            alert('Please enter a note before saving.');
            return;
        }
        
        // Create a simple object with the required fields
        const noteData = {
            "session_id": parseInt(currentSessionId, 10),
            "pomodoro_id": 0,
            "note": noteText
        };
        
        console.log('Sending note data:', noteData);
        
        fetch('/api/notes', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(noteData)
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    console.error('Server error response:', text);
                    try {
                        const errorData = JSON.parse(text);
                        throw new Error(errorData.error || 'Error adding note');
                    } catch (e) {
                        throw new Error('Error adding note: ' + response.status);
                    }
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('Note added successfully:', data);
            
            // Clear the editor
            if (addNoteEditor) {
                addNoteEditor.value('');
            } else {
                addNoteTextarea.value = '';
            }
            
            // Reload the notes list
            loadSessionNotes(currentSessionId);
        })
        .catch(error => {
            console.error('Error adding note:', error);
            alert('Failed to add note: ' + error.message);
        });
    }
    
    // Helper function to escape HTML
    function escapeHTML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Event listeners
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            // Clean up SimpleMDE instances when closing modal
            if (addNoteEditor) {
                addNoteEditor.toTextArea();
                addNoteEditor = null;
            }
            if (editNoteEditor) {
                editNoteEditor.toTextArea();
                editNoteEditor = null;
            }
            sessionModal.close();
            
            // Clear session parameter from URL
            const url = new URL(window.location);
            url.searchParams.delete('session');
            window.history.pushState({}, '', url);
        });
    }
    
    if (addNoteBtn) {
        addNoteBtn.addEventListener('click', addNote);
    }
    
    // Full-page editor event listeners
    document.addEventListener('click', event => {
        if (event.target.id === 'editor-save-btn') {
            saveFullPageNote();
        }
        
        if (event.target.id === 'editor-cancel-btn' || event.target.id === 'editor-close') {
            closeFullPageEditor();
        }
    });
    
    // Handle back button navigation
    window.addEventListener('popstate', () => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session');
        
        if (sessionId) {
            // Open the session modal for the new session ID
            openSessionDetails(sessionId);
        } else {
            // Close any open modals if no session ID in URL
            if (sessionModal.open) {
                sessionModal.close();
            }
            if (editorModal && editorModal.open) {
                closeFullPageEditor();
            }
        }
    });
});
