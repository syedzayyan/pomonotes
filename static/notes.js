document.addEventListener('DOMContentLoaded', () => {
    const notesContainer = document.getElementById('notes-container');
    const searchInput = document.getElementById('search-notes');
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const applyFiltersBtn = document.getElementById('apply-filters');
    
    let allNotes = [];
    
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
                
                // Now get all notes for each session
                const notePromises = sessions.map(session => 
                    fetch(`/api/notes/${session.id}`)
                        .then(response => response.json())
                        .then(notes => 
                            notes.map(note => ({
                                ...note,
                                session: sessionMap[note.session_id]
                            }))
                        )
                );
                
                return Promise.all(notePromises);
            })
            .then(notesArrays => {
                // Flatten the array of arrays into a single array of notes
                allNotes = notesArrays.flat();
                
                // Apply any filters
                applyFilters();
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
                <div class="note-content">
                    ${marked.parse(note.note)}
                </div>
                <footer>
                    <button class="view-session-btn" data-session-id="${note.session_id}">
                        View Session
                    </button>
                </footer>
            `;
            
            notesContainer.appendChild(noteCard);
        });
        
        // Add event listeners to view session buttons
        document.querySelectorAll('.view-session-btn').forEach(button => {
            button.addEventListener('click', function() {
                const sessionId = this.getAttribute('data-session-id');
                window.location.href = `/history?session=${sessionId}`;
            });
        });
    }
    
    // Set up event listeners
    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300));
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyFilters);
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
    
    // Initialize
    initializeDateRange();
    loadAllNotes();
});
