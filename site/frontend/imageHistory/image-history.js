// Image History Management
let currentSessionId = null;
let images = [];

// Logout function
async function goLogout() {
    // Clear user-specific session so image history is not accessible after logout
    localStorage.removeItem('flipaha_session_id');
    await fetch('/logout', {
        method: 'POST',
        credentials: 'include'
    });
    window.location.reload();
}

// Check if user is admin and show/hide dashboard button
async function checkAdminStatus() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        const dashboardButton = document.getElementById('dashboardButton');
        
        if (!data.logged_in || data.role !== 'admin') {
            dashboardButton.style.display = 'none';
        } else {
            dashboardButton.style.display = 'block';
        }
    } catch (error) {
        console.warn('Could not check admin status:', error);
        // Hide dashboard button by default if check fails
        const dashboardButton = document.getElementById('dashboardButton');
        dashboardButton.style.display = 'none';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeImageHistory();
    checkAdminStatus();
});

// Modal controls
document.getElementById('closeModal').addEventListener('click', closeImageModal);
document.getElementById('imageModal').addEventListener('click', (e) => {
    if (e.target.id === 'imageModal') {
        closeImageModal();
    }
});

// Keyboard shortcut to close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeImageModal();
    }
});

async function initializeImageHistory() {
    try {
        // Verify user is logged in before showing any image history
        const authRes = await fetch('/api/me', { credentials: 'include' });
        const authData = await authRes.json();

        if (!authData.logged_in) {
            console.warn('User not logged in, redirecting to login');
            showErrorMessage('Please log in to view your image history.');
            showEmptyState();
            return;
        }

        // Use user-specific session ID
        currentSessionId = 'user_' + authData.user_id;
        localStorage.setItem('flipaha_session_id', currentSessionId);
        console.log('Image History - User session ID:', currentSessionId);
        
        if (!currentSessionId) {
            console.warn('No session ID found in localStorage');
            showEmptyState();
            return;
        }

        // Show loading state
        showLoadingState(true);
        
        // Fetch images from API
        const apiUrl = `/api/images?session_id=${encodeURIComponent(currentSessionId)}`;
        console.log('Fetching images from:', apiUrl);
        
        const response = await fetch(apiUrl);
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response data:', data);

        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch images');
        }

        images = data.images || [];
        console.log('Images loaded:', images.length);

        showLoadingState(false);

        if (images.length === 0) {
            console.log('No images found, showing empty state');
            showEmptyState();
        } else {
            showImageGallery();
            updateStats(data.stats);
        }
    } catch (error) {
        console.error('Error loading image history:', error);
        showLoadingState(false);
        showErrorMessage(`Failed to load image history: ${error.message}`);
        showEmptyState();
    }
}

function showLoadingState(show) {
    const loadingEl = document.getElementById('loadingState');
    if (show) {
        loadingEl.style.display = 'flex';
    } else {
        loadingEl.style.display = 'none';
    }
}

function showErrorMessage(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

function showEmptyState() {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('gallerySection').style.display = 'none';
    document.getElementById('statsSection').style.display = 'none';
}

function showImageGallery() {
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('gallerySection').style.display = 'block';
    document.getElementById('statsSection').style.display = 'flex';
    renderImageGallery();
}

function updateStats(stats) {
    if (stats) {
        document.getElementById('totalImages').textContent = stats.total_images || images.length;
    }
}

function renderImageGallery() {
    const gallery = document.getElementById('imageGallery');
    gallery.innerHTML = '';

    images.forEach((image) => {
        const card = createImageCard(image);
        gallery.appendChild(card);
    });
}

function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Truncate filename for display
    const displayFilename = image.filename.length > 20 
        ? image.filename.substring(0, 17) + '...' 
        : image.filename;
    
    // Create LaTeX preview (truncated)
    const latexPreview = image.latex || image.edited_latex || 'No LaTeX extracted';
    const latexDisplay = latexPreview.length > 50 
        ? latexPreview.substring(0, 47) + '...' 
        : latexPreview;

    card.innerHTML = `
        <img src="${image.data}" alt="${image.filename}" class="image-card-image">
        <div class="image-card-content">
            <div class="image-card-title" title="${image.filename}">
                ${displayFilename}
            </div>
            ${image.latex || image.edited_latex ? `
                <div class="image-card-latex" title="${latexPreview}">
                    ${latexDisplay}
                </div>
            ` : ''}
            <div class="image-card-actions">
                <button class="image-action-btn btn-view" onclick="viewImageDetails('${image.id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="image-action-btn btn-delete" onclick="deleteImage('${image.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `;

    return card;
}

function viewImageDetails(imageId) {
    const image = images.find(img => img.id === imageId);
    if (!image) return;

    // Set modal content
    document.getElementById('modalImage').src = image.data;
    document.getElementById('modalImage').alt = image.filename;

    // Show LaTeX section if available
    const latexSection = document.getElementById('modalLatexSection');
    if (image.latex || image.edited_latex) {
        const latexCode = image.edited_latex || image.latex;
        document.getElementById('modalLatexCode').textContent = latexCode;
        latexSection.style.display = 'block';
        
        // Try to render LaTeX preview if KaTeX is available
        try {
            if (window.katex) {
                const preview = document.createElement('div');
                preview.style.marginTop = '12px';
                preview.style.padding = '12px';
                preview.style.background = '#f5f5f5';
                preview.style.borderRadius = '6px';
                katex.render(latexCode, preview, { 
                    throwOnError: false,
                    displayMode: true 
                });
                latexSection.appendChild(preview);
            }
        } catch (e) {
            console.warn('Could not render LaTeX preview:', e);
        }
    } else {
        latexSection.style.display = 'none';
    }

    // Show modal
    const modal = document.getElementById('imageModal');
    modal.classList.add('active');
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.remove('active');
    
    // Clean up LaTeX preview
    const latexSection = document.getElementById('modalLatexSection');
    const previews = latexSection.querySelectorAll('div:not(#modalLatexCode):not(.modal-latex-label)');
    previews.forEach(p => p.remove());
}

async function deleteImage(imageId) {
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }

    try {
        const response = await fetch(`/api/image/${imageId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ session_id: currentSessionId })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            // Remove from local array
            images = images.filter(img => img.id !== imageId);
            
            // Close modal if open
            closeImageModal();
            
            // Update display
            if (images.length === 0) {
                showEmptyState();
            } else {
                renderImageGallery();
                updateStats({ total_images: images.length });
            }
            
            showErrorMessage('Image deleted successfully');
        } else {
            showErrorMessage(data.error || 'Failed to delete image');
        }
    } catch (error) {
        console.error('Error deleting image:', error);
        showErrorMessage(`Failed to delete image: ${error.message}`);
    }
}
