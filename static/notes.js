document.addEventListener('DOMContentLoaded', () => {
    const notesContainer = document.getElementById('notes-container');
    const searchInput = document.getElementById('search-notes');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const applyFiltersBtn = document.getElementById('apply-filters');
    
    let allNotes = [];
    let activeNoteId = null;
    let activeEditor = null;
    let isEditMode = false;
    
    // Initialize with current date range (last 30 days)
    function initializeDateRange() {
        const today = new Date();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(today.getDate() - 30);
        
        dateTo.valueAsDate = today;
        dateFrom.valueAsDate = thirtyDaysAgo;
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
        
        displayNotesTable(filteredNotes);
    }
    
    // Get first few words from note text
    function getPreviewText(text, wordCount = 5) {
        if (!text) return 'No content';
        
        // Remove markdown formatting for better preview
        const plainText = text
            .replace(/[#*_~`]/g, '') // Remove common markdown characters
            .replace(/\[[^\]]*\]\([^)]*\)/g, '') // Remove links
            .trim();
            
        const words = plainText.split(/\s+/);
        const preview = words.slice(0, wordCount).join(' ');
        
        return words.length > wordCount ? `${preview}...` : preview;
    }
    
    // Display notes in table format
    function displayNotesTable(notes) {
        // Create table structure if it doesn't exist
        if (!document.querySelector('.notes-table')) {
            notesContainer.innerHTML = `
                <table class="notes-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Session</th>
                            <th>Preview</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="notes-table-body"></tbody>
                </table>
            `;
        }
        
        const tableBody = document.getElementById('notes-table-body');
        
        if (!notes || notes.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">No notes found matching your criteria.</td></tr>';
            return;
        }
        
        // Sort notes by session date (newest first)
        notes.sort((a, b) => {
            if (!a.session || !b.session) return 0;
            return new Date(b.session.start_time) - new Date(a.session.start_time);
        });
        
        tableBody.innerHTML = '';
        
        notes.forEach(note => {
            // Format date if available
            let dateDisplay = 'N/A';
            if (note.session && note.session.start_time) {
                const noteDate = new Date(note.session.start_time);
                dateDisplay = noteDate.toLocaleDateString();
            }
            
            // Session info
            const sessionDisplay = note.session ? `#${note.session.id}` : 'N/A';
            
            // Preview text (first 5 words)
            const previewText = getPreviewText(note.note);
            
            // Status badge
            let statusDisplay = 'N/A';
            if (note.session && note.session.status) {
                statusDisplay = `<span class="status-badge ${note.session.status}">${note.session.status}</span>`;
            }
            
            // Create note row
            const noteRow = document.createElement('tr');
            noteRow.className = 'note-row';
            noteRow.dataset.noteId = note.id;
            noteRow.innerHTML = `
                <td>${dateDisplay}</td>
                <td>${sessionDisplay}</td>
                <td class="note-preview">${previewText}</td>
                <td>${statusDisplay}</td>
                <td>
                    <div class="action-buttons">
                        <button class="view-session-btn" data-session-id="${note.session_id}">View Session</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(noteRow);
            
            // Create content row (initially hidden)
            const contentRow = document.createElement('tr');
            contentRow.className = 'note-content-row';
            contentRow.id = `note-content-${note.id}`;
            contentRow.innerHTML = `
                <td colspan="5" class="note-content-cell">
                    <div class="markdown-preview" id="preview-${note.id}"></div>
                    <div class="editor-container" id="editor-container-${note.id}" style="display: none;">
                        <textarea id="editor-${note.id}" data-markdown="${escapeHTML(note.note)}"></textarea>
                    </div>
                    <div class="note-actions" style="margin-top: 15px;">
                        <button class="edit-note-btn" data-note-id="${note.id}">Edit</button>
                        <button class="save-note-btn" data-note-id="${note.id}" style="display: none;">Save</button>
                        <button class="cancel-edit-btn" data-note-id="${note.id}" style="display: none;">Cancel</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(contentRow);
        });
        
        // Add event listeners to buttons
        setupNoteActionHandlers();
    }
    
    // Set up handlers for note action buttons
    function setupNoteActionHandlers() {
        // View session buttons
        document.querySelectorAll('.view-session-btn').forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                const sessionId = this.getAttribute('data-session-id');
                window.location.href = `/history?session=${sessionId}`;
            });
        });
        
        // Make entire row clickable
        document.querySelectorAll('.note-row').forEach(row => {
            row.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                toggleNoteContent(noteId);
            });
        });
        
        // Edit note buttons
        document.querySelectorAll('.edit-note-btn').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                showNoteEditor(noteId);
            });
        });
        
        // Save note buttons
        document.querySelectorAll('.save-note-btn').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                saveNote(noteId);
            });
        });
        
        // Cancel edit buttons
        document.querySelectorAll('.cancel-edit-btn').forEach(button => {
            button.addEventListener('click', function() {
                const noteId = this.getAttribute('data-note-id');
                hideNoteEditor(noteId);
            });
        });
    }
    
    // Toggle note content visibility
    function toggleNoteContent(noteId) {
        const contentRow = document.getElementById(`note-content-${noteId}`);
        const noteRow = document.querySelector(`.note-row[data-note-id="${noteId}"]`);
        
        // If already active, hide it
        if (contentRow.classList.contains('active')) {
            hideNoteContent(noteId);
            return;
        }
        
        // If another note is active, hide it first
        if (activeNoteId && activeNoteId !== noteId) {
            hideNoteContent(activeNoteId);
        }
        
        // Show this note
        contentRow.classList.add('active');
        noteRow.classList.add('note-row-active');
        activeNoteId = noteId;
        
        // Display the markdown preview
        renderMarkdownPreview(noteId);
    }
    
    // Hide note content
    function hideNoteContent(noteId) {
        const contentRow = document.getElementById(`note-content-${noteId}`);
        const noteRow = document.querySelector(`.note-row[data-note-id="${noteId}"]`);
        
        contentRow.classList.remove('active');
        noteRow.classList.remove('note-row-active');
        
        // Reset editor state
        const editorContainer = document.getElementById(`editor-container-${noteId}`);
        const previewDiv = document.getElementById(`preview-${noteId}`);
        const editBtn = contentRow.querySelector('.edit-note-btn');
        const saveBtn = contentRow.querySelector('.save-note-btn');
        const cancelBtn = contentRow.querySelector('.cancel-edit-btn');
        
        if (editorContainer) editorContainer.style.display = 'none';
        if (previewDiv) previewDiv.style.display = 'block';
        if (editBtn) editBtn.style.display = 'inline-block';
        if (saveBtn) saveBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        
        // Destroy editor to free resources
        if (activeEditor) {
            activeEditor.toTextArea();
            activeEditor = null;
        }
        
        activeNoteId = null;
        isEditMode = false;
    }
    
    // Show the markdown preview for a note
    function renderMarkdownPreview(noteId) {
        const previewDiv = document.getElementById(`preview-${noteId}`);
        if (!previewDiv) return;
        
        // Find the note content
        const note = allNotes.find(n => n.id === parseInt(noteId));
        if (!note) return;
        
        // Render markdown using the marked library
        previewDiv.innerHTML = marked.parse(note.note || '');
    }
    
    // Show the note editor
    function showNoteEditor(noteId) {
        const contentRow = document.getElementById(`note-content-${noteId}`);
        const editorContainer = document.getElementById(`editor-container-${noteId}`);
        const previewDiv = document.getElementById(`preview-${noteId}`);
        
        // Hide preview, show editor
        previewDiv.style.display = 'none';
        editorContainer.style.display = 'block';
        
        // Switch buttons
        const editBtn = contentRow.querySelector('.edit-note-btn');
        const saveBtn = contentRow.querySelector('.save-note-btn');
        const cancelBtn = contentRow.querySelector('.cancel-edit-btn');
        
        editBtn.style.display = 'none';
        saveBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        
        // Initialize the editor
        initializeEditor(noteId);
        isEditMode = true;
    }
    
    // Hide the note editor and show preview
    function hideNoteEditor(noteId) {
        const contentRow = document.getElementById(`note-content-${noteId}`);
        const editorContainer = document.getElementById(`editor-container-${noteId}`);
        const previewDiv = document.getElementById(`preview-${noteId}`);
        
        // Hide editor, show preview
        editorContainer.style.display = 'none';
        previewDiv.style.display = 'block';
        
        // Switch buttons
        const editBtn = contentRow.querySelector('.edit-note-btn');
        const saveBtn = contentRow.querySelector('.save-note-btn');
        const cancelBtn = contentRow.querySelector('.cancel-edit-btn');
        
        editBtn.style.display = 'inline-block';
        saveBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        
        // Re-render the preview with the original content
        renderMarkdownPreview(noteId);
        
        // Destroy editor
        if (activeEditor) {
            activeEditor.toTextArea();
            activeEditor = null;
        }
        
        isEditMode = false;
    }
    
    // Initialize the SimpleMDE editor for a note
    function initializeEditor(noteId) {
        const editorTextarea = document.getElementById(`editor-${noteId}`);
        if (!editorTextarea) return;
        
        // Cleanup any existing editor
        if (activeEditor) {
            activeEditor.toTextArea();
            activeEditor = null;
        }
        
        // Get the original markdown content
        const markdown = editorTextarea.dataset.markdown || '';
        editorTextarea.value = markdown;
        
        // Initialize SimpleMDE
        activeEditor = new SimpleMDE({
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
    }
    
    // Save a note
    function saveNote(noteId) {
        if (!activeEditor) return;
        
        const updatedContent = activeEditor.value();
        
        fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: updatedContent })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Note updated:', data);
            
            // Update the stored content in the DOM
            const textarea = document.getElementById(`editor-${noteId}`);
            if (textarea) {
                textarea.dataset.markdown = escapeHTML(updatedContent);
            }
            
            // Update the preview text
            const noteRow = document.querySelector(`.note-row[data-note-id="${noteId}"]`);
            const previewCell = noteRow.querySelector('.note-preview');
            if (previewCell) {
                previewCell.textContent = getPreviewText(updatedContent);
            }
            
            // Update the note in our local cache
            const noteIndex = allNotes.findIndex(note => note.id === parseInt(noteId));
            if (noteIndex !== -1) {
                allNotes[noteIndex].note = updatedContent;
            }
            
            // Hide the editor and show the updated preview
            hideNoteEditor(noteId);
            
            // Show success message
            showNotification('Note saved successfully!');
        })
        .catch(error => {
            console.error('Error updating note:', error);
            showNotification('Failed to update note. Please try again.', 'error');
        });
    }
    
    // Show notification message
    function showNotification(message, type = 'success') {
        // Create notification element if it doesn't exist
        let notification = document.getElementById('notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'notification';
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.padding = '10px 20px';
            notification.style.borderRadius = '4px';
            notification.style.color = '#fff';
            notification.style.zIndex = '9999';
            notification.style.transition = 'opacity 0.3s';
            document.body.appendChild(notification);
        }
        
        // Set styles based on notification type
        if (type === 'success') {
            notification.style.backgroundColor = '#4caf50';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#f44336';
        }
        
        // Set message and show notification
        notification.textContent = message;
        notification.style.opacity = '1';
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
        }, 3000);
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
    
    // Initialize
    initializeDateRange();
    loadAllNotes();
});