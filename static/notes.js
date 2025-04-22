document.addEventListener('DOMContentLoaded', () => {
    const notesContainer = document.getElementById('notes-container');
    const searchInput = document.getElementById('search-notes');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const editorModal = document.getElementById('editor-modal');
    
    let allNotes = [];
    let currentNoteId = null;
    let fullPageEditor = null;
    
    // Initialize with current date range (last 30 days)
    function initializeDateRange() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        dateTo.valueAsDate = today;
        dateFrom.valueAsDate = thirtyDaysAgo;
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
    
    // Load all notes with session info
    function loadAllNotes() {
        // First get all sessions
        fetch('/api/sessions')
            .then(response => response.json())
            .then(sessions => {
                const sessionMap = {};
                sessions.forEach(session => {
                    sessionMap[session.id] = {
                        id: session.id,
                        start_time: session.start_time,
                        status: session.status
                    };
                });
                
                // Now get all notes
                fetch('/api/notes')
                    .then(response => response.json())
                    .then(notes => {
                        // Add session info to each note
                        allNotes = notes.map(note => ({
                            ...note,
                            session: sessionMap[note.session_id] || null
                        }));
                        
                        // Apply any filters
                        applyFilters();
                    });
            })
            .catch(error => {
                console.error('Error loading notes:', error);
                notesContainer.innerHTML = '<p>Error loading notes. Please try again later.</p>';
            });
    }
    
    // Apply filters to notes
    function applyFilters() {
        const searchTerm = searchInput.value.toLowerCase();
        const fromDate = dateFrom.valueAsDate;
        const toDate = dateTo.valueAsDate;
        
        // Set time to end of day for toDate
        if (toDate) {
            toDate.setHours(23, 59, 59, 999);
        }
        
        const filteredNotes = allNotes.filter(note => {
            // Text search filter
            const noteMatches = !searchTerm || note.note.toLowerCase().includes(searchTerm);
            
            // Date range filter
            let dateMatches = true;
            if (note.session && note.session.start_time) {
                const noteDate = new Date(note.session.start_time);
                
                if (fromDate && noteDate < fromDate) {
                    dateMatches = false;
                }
                
                if (toDate && noteDate > toDate) {
                    dateMatches = false;
                }
            }
            
            return noteMatches && dateMatches;
        });
        
        displayNotes(filteredNotes);
    }
    
    // Display notes in the container
    function displayNotes(notes) {
        if (!notes || notes.length === 0) {
            notesContainer.innerHTML = '<p>No notes found matching your criteria.</p>';
            return;
        }
        
        // Sort notes by session date (newest first)
        notes.sort((a, b) => {
            if (!a.session || !b.session) return 0;
            return new Date(b.session.start_time) - new Date(a.session.start_time);
        });
        
        notesContainer.innerHTML = '';
        
        notes.forEach(note => {
            const noteCard = document.createElement('article');
            noteCard.className = 'note-card';
            
            // Format date if available
            let dateHTML = '';
            if (note.session && note.session.start_time) {
                const noteDate = new Date(note.session.start_time);
                dateHTML = `<div class="note-date">${noteDate.toLocaleDateString()}</div>`;
            }
            
            // Session badge if available
            let sessionHTML = '';
            if (note.session) {
                sessionHTML = `
                    <div class="note-session">
                        <span class="session-badge">
                            Session #${note.session.id}
                        </span>
                        <span class="status-badge ${note.session.status}">
                            ${note.session.status}
                        </span>
                    </div>
                `;
            }
            
            // Render markdown content
            noteCard.innerHTML = `
                <header>
                    ${dateHTML}
                    ${sessionHTML}
                </header>
                <div class="note-content" data-markdown="${escapeHTML(note.note)}">
                    ${marked.parse(note.note)}
                </div>
                <footer>
                    <button class="view-session-btn" data-session-id="${note.session_id}">
                        View Session
                    </button>
                    <button class="edit-fullpage-btn" data-note-id="${note.id}">
                        Edit Note
                    </button>
                </footer>
            `;
            
            notesContainer.appendChild(noteCard);
        });
        
        // Add event listeners to buttons
        setupNoteActionHandlers();
    }
    
    // Set up handlers for note action buttons
    function setupNoteActionHandlers() {
        // View session buttons
        document.querySelectorAll('.view-session-btn').forEach(button => {
            button.addEventListener('click', function() {
                const sessionId = this.getAttribute('data-session-id');
                window.location.href = `/history?session=${sessionId}`;
            });
        });
        
        // Edit note buttons
        document.querySelectorAll('.edit-fullpage-btn').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                const noteCard = this.closest('.note-card');
                const noteContent = noteCard.querySelector('.note-content').dataset.markdown;
                
                openFullPageEditor(noteContent, noteId);
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
            titleElement.textContent = `Editing Note #${noteId}`;
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
        updateNote(currentNoteId, updatedContent);
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
            closeFullPageEditor();
            
            // Reload notes to show updated content
            loadAllNotes();
        })
        .catch(error => {
            console.error('Error updating note:', error);
            alert('Failed to update note. Please try again.');
        });
    }
    
    // Helper function to escape HTML
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Debounce helper function
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Set up event listeners
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
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
    
    // Initialize
    initializeDateRange();
    loadAllNotes();
});
