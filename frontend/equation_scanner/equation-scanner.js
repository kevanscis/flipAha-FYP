// Equation Scanner - Vanilla JS Implementation
// Configuration
const API_BASE_URL = '';

function goChat() {
  window.location.href = `${API_BASE_URL}/`;
}
function goImage() {
  window.location.href = `${API_BASE_URL}/image`;
}

// State management
const state = {
    sessionId: null,
    selectedFile: null,
    previewUrl: null,
    uploadedImageId: null,
    currentImage: null,
    currentLatex: null,
    images: [],
    rating: null,
    activeTab: 'upload',
    converting: false,
    uploading: false,
    highAccuracy: false,
    cropper: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load session from localStorage
    const savedSession = localStorage.getItem('flipaha_session_id');
    if (savedSession) {
        state.sessionId = savedSession;
    }

    // Set up all handlers
    setupTabs();
    setupFileInput();
    setupUploadHandlers();
    setupEditorHandlers();
    setupCropHandlers();
});

// ==================== Tab Management ====================
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            setActiveTab(tabName);
        });
    });
}

function setActiveTab(tabName) {
    state.activeTab = tabName;

    // Update button states
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content visibility
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

    // Load gallery when switching to it
    if (tabName === 'gallery') {
        loadGallery();
    }

    // Update editor when switching to it
    if (tabName === 'editor') {
        updateEditorDisplay();
    }
}

// ==================== File Input Setup ====================
function setupFileInput() {
    const wrapper = document.getElementById('fileInputWrapper');
    const input = document.getElementById('fileInput');

    wrapper.addEventListener('click', () => input.click());

    // Drag and drop
    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.style.background = '#ffe8e0';
    });

    wrapper.addEventListener('dragleave', () => {
        wrapper.style.background = '#fff5f0';
    });

    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.style.background = '#fff5f0';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            input.files = files;
            handleFileSelect();
        }
    });

    input.addEventListener('change', handleFileSelect);
}

function handleFileSelect() {
    const input = document.getElementById('fileInput');
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'];
    if (!allowedTypes.includes(file.type)) {
        showError('Invalid file type. Please upload an image file.');
        return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
        showError('File size too large. Maximum size is 10MB.');
        return;
    }

    state.selectedFile = file;
    state.previewUrl = URL.createObjectURL(file);
    state.uploadedImageId = null;

    clearMessages();
    showPreview();

    // Upload immediately so quality warnings appear before the user presses Convert
    uploadImage();
}

function showPreview() {
    const previewSection = document.getElementById('previewSection');
    const previewImage = document.getElementById('previewImage');

    if (previewImage) {
        previewImage.src = state.previewUrl;
    }
    if (previewSection) {
        previewSection.style.display = 'block';
    }
}

// ==================== Upload Handlers ====================
function setupUploadHandlers() {
    const convertBtn = document.getElementById('convertBtn');
    const showCropBtn = document.getElementById('showCropBtn');
    const highAccuracyCheckbox = document.getElementById('highAccuracy');

    if (convertBtn) convertBtn.addEventListener('click', handleConvert);
    if (showCropBtn) showCropBtn.addEventListener('click', handleShowCrop);
    if (highAccuracyCheckbox) {
        highAccuracyCheckbox.addEventListener('change', (e) => {
            state.highAccuracy = e.target.checked;
        });
    }
}

async function handleConvert() {
    // Ensure session exists
    if (!state.sessionId) {
        state.sessionId = 'session_' + Date.now();
        localStorage.setItem('flipaha_session_id', state.sessionId);
    }

    // Upload the image first if not uploaded
    if (!state.uploadedImageId && state.selectedFile) {
        await uploadImage();
        if (!state.uploadedImageId) return;
    }

    if (!state.uploadedImageId || !state.sessionId) {
        showError('Please select an image first.');
        return;
    }

    state.converting = true;
    const convertLoading = document.getElementById('convertLoading');
    const convertBtn = document.getElementById('convertBtn');

    if (convertLoading) convertLoading.style.display = 'block';
    if (convertBtn) convertBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: state.sessionId,
                image_id: state.uploadedImageId,
                options: {
                    high_accuracy: state.highAccuracy,
                    preprocess: 'auto'
                }
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Conversion failed');
        }

        // Log conversion results for debugging
        console.log('=== Conversion Results ===');
        console.log('Model used:', data.model || 'unknown');
        console.log('Confidence:', data.confidence);
        console.log('LaTeX output:', data.latex);
        console.log('Preprocess variant:', data.preprocess_variant);
        console.log('Validation:', data.validation);
        console.log('Full response:', data);
        console.log('=========================');

        // Update state with conversion results
        state.currentImage = {
            imageId: state.uploadedImageId,
            filename: state.selectedFile?.name || 'image',
            preview: state.previewUrl
        };

        state.currentLatex = {
            imageId: state.uploadedImageId,
            latex: data.latex || '',
            confidence: data.confidence || 0,
            model: data.model || 'unknown'
        };

        showSuccess('✅ Image converted to LaTeX!');

        // Switch to editor tab
        setTimeout(() => {
            setActiveTab('editor');
        }, 800);

        // Log image input method usage to analytics (only on successful conversion)
        try {
            await fetch(`${API_BASE_URL}/api/log-input-method`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    input_method: 'image'
                })
            });
        } catch (logError) {
            console.warn('Failed to log image input method:', logError);
        }

    } catch (err) {
        showError('Conversion error: ' + err.message);
    } finally {
        state.converting = false;
        if (convertLoading) convertLoading.style.display = 'none';
        if (convertBtn) convertBtn.disabled = false;
    }
}


async function uploadImage() {
    if (!state.selectedFile) return false;

    const formData = new FormData();
    formData.append('file', state.selectedFile);
    if (state.sessionId) {
        formData.append('session_id', state.sessionId);
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            if (data.warnings && data.warnings.length > 0) {
                showQualityWarnings(data.warnings);
            }
            throw new Error(data.error || 'Upload failed');
        }

        // Update session ID if new one was created
        if (data.session_id && data.session_id !== state.sessionId) {
            state.sessionId = data.session_id;
            localStorage.setItem('flipaha_session_id', data.session_id);
        }

        state.uploadedImageId = data.image_id;
        state.previewUrl = data.preview;

        if (data.quality && data.quality.warnings && data.quality.warnings.length > 0) {
            showQualityWarnings(data.quality.warnings, data.quality.hint);
        }

        return true;
    } catch (err) {
        showError(err.message);
        return false;
    }
}

function handleShowCrop() {
    if (!state.previewUrl) {
        showError('No image to crop');
        return;
    }

    // Load Cropper.js if not already loaded
    if (!window.Cropper) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js';
        script.onload = () => {
            initializeCrop();
        };
        document.body.appendChild(script);
    } else {
        initializeCrop();
    }
}

function initializeCrop() {
    const cropModal = document.getElementById('cropModal');
    const cropImage = document.getElementById('cropImage');
    
    // Set image source
    cropImage.src = state.previewUrl;
    
    // Show modal
    cropModal.classList.add('active');
    
    // Initialize Cropper after image loads
    cropImage.onload = () => {
        if (state.cropper) {
            state.cropper.destroy();
        }
        
        state.cropper = new Cropper(cropImage, {
            aspectRatio: NaN, // Free aspect ratio
            viewMode: 1,
            autoCropArea: 0.8,
            responsive: true,
            guides: true,
            center: true,
            highlight: true,
            background: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false
        });
    };
}

function setupCropHandlers() {
    const cropModal = document.getElementById('cropModal');
    const cropConfirmBtn = document.getElementById('cropConfirmBtn');
    const cropCancelBtn = document.getElementById('cropCancelBtn');
    
    if (cropConfirmBtn) {
        cropConfirmBtn.addEventListener('click', () => {
            if (state.cropper) {
                // Get cropped canvas
                const canvas = state.cropper.getCroppedCanvas({
                    maxWidth: 4096,
                    maxHeight: 4096,
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                });
                
                if (canvas) {
                    // Convert canvas to blob
                    canvas.toBlob((blob) => {
                        // Update state with cropped image
                        const croppedUrl = URL.createObjectURL(blob);
                        
                        // Revoke old preview URL
                        if (state.previewUrl) {
                            URL.revokeObjectURL(state.previewUrl);
                        }
                        
                        state.previewUrl = croppedUrl;
                        
                        // Create a new file from blob
                        const fileName = state.selectedFile ? state.selectedFile.name : 'cropped_image.png';
                        state.selectedFile = new File([blob], fileName, { type: 'image/png' });
                        
                        // Update preview
                        const previewImage = document.getElementById('previewImage');
                        if (previewImage) {
                            previewImage.src = croppedUrl;
                        }
                        
                        // Close modal
                        closeCropModal();
                        
                        showSuccess('Image cropped successfully!');
                    }, 'image/png');
                }
            }
        });
    }
    
    if (cropCancelBtn) {
        cropCancelBtn.addEventListener('click', closeCropModal);
    }
    
    // Close on click outside
    if (cropModal) {
        cropModal.addEventListener('click', (e) => {
            if (e.target === cropModal) {
                closeCropModal();
            }
        });
    }
}

function closeCropModal() {
    const cropModal = document.getElementById('cropModal');
    cropModal.classList.remove('active');
    
    if (state.cropper) {
        state.cropper.destroy();
        state.cropper = null;
    }
}

// ==================== Editor Handlers ====================
function setupEditorHandlers() {
    const saveBtn = document.getElementById('saveLatexBtn');
    const exportBtn = document.getElementById('exportLatexBtn');
    const latexInput = document.getElementById('latexInput');

    if (saveBtn) saveBtn.addEventListener('click', saveLatexChanges);
    if (exportBtn) exportBtn.addEventListener('click', copyLatexToClipboard);
    if (latexInput) latexInput.addEventListener('input', updateLatexPreview);

    // Rating stars
    document.querySelectorAll('.star').forEach(star => {
        star.addEventListener('click', () => {
            const rating = parseInt(star.dataset.rating);
            state.rating = rating;
            updateStarDisplay(rating);
        });
    });
}

function updateEditorDisplay() {
    const editorContent = document.getElementById('editorContent');
    const noImageSelected = document.getElementById('noImageSelected');

    if (state.currentLatex && state.currentImage) {
        console.log('Editor Display - Model:', state.currentLatex.model, 'Confidence:', state.currentLatex.confidence);
        
        if (editorContent) editorContent.style.display = 'flex';
        if (noImageSelected) noImageSelected.style.display = 'none';

        const imageNameInput = document.getElementById('imageNameInput');
        const latexInput = document.getElementById('latexInput');

        if (imageNameInput) imageNameInput.value = state.currentImage.filename || '';
        if (latexInput) latexInput.value = state.currentLatex.latex || '';

        // Display confidence if available
        const confidenceBadge = document.getElementById('confidenceBadge');
        const confidenceValue = document.getElementById('confidenceValue');
        if (state.currentLatex.confidence !== undefined && state.currentLatex.confidence !== null) {
            if (confidenceBadge) confidenceBadge.style.display = 'block';
            if (confidenceValue) {
                const percent = Math.round(state.currentLatex.confidence * 100);
                confidenceValue.textContent = percent + '%';
            }
        } else {
            if (confidenceBadge) confidenceBadge.style.display = 'none';
        }

        state.rating = null;
        document.querySelectorAll('.star').forEach(s => {
            s.textContent = '☆';
            s.classList.remove('active');
        });

        updateLatexPreview();
    } else {
        if (editorContent) editorContent.style.display = 'none';
        if (noImageSelected) noImageSelected.style.display = 'block';
    }
}

function updateLatexPreview() {
    const latexInput = document.getElementById('latexInput');
    const previewBox = document.getElementById('latexPreview');

    if (!previewBox || !latexInput) return;

    const latexValue = latexInput.value || '';

    if (!latexValue.trim()) {
        previewBox.innerHTML = '<p>Preview will appear here</p>';
        return;
    }

    try {
        const sanitized = sanitizeLatex(latexValue);
        
        // Render using KaTeX (which is already loaded)
        if (window.katex) {
            previewBox.innerHTML = '';
            try {
                katex.render(sanitized, previewBox, {
                    throwOnError: false,
                    displayMode: true
                });
            } catch (err) {
                console.error('KaTeX error:', err);
                previewBox.innerHTML = '<p style="color: red;">LaTeX rendering error</p>';
            }
        } else {
            // Fallback: display as LaTeX code
            const html = `<div style="font-size: 1.2em;">$$${sanitized}$$</div>`;
            previewBox.innerHTML = html;
        }
    } catch (err) {
        previewBox.innerHTML = '<p style="color: red;">Error: ' + err.message + '</p>';
    }
}

async function saveLatexChanges() {
    if (!state.currentLatex || !state.sessionId) {
        showEditorMessage('No image selected', 'error');
        return;
    }

    const latexInput = document.getElementById('latexInput');
    const imageNameInput = document.getElementById('imageNameInput');
    const saveBtn = document.getElementById('saveLatexBtn');

    const latex = latexInput?.value || '';
    const filename = imageNameInput?.value || '';

    try {
        if (saveBtn) saveBtn.disabled = true;

        const response = await fetch(`${API_BASE_URL}/api/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                session_id: state.sessionId,
                image_id: state.currentLatex.imageId,
                latex: latex,
                filename: filename,
                rating: state.rating
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Save failed');
        }

        showEditorMessage('💾 Changes saved successfully!', 'success');
        state.currentLatex.latex = latex;
        state.currentImage.filename = filename;

    } catch (err) {
        showEditorMessage('Error: ' + err.message, 'error');
    } finally {
        if (saveBtn) saveBtn.disabled = false;
    }
}

function copyLatexToClipboard() {
    const latexInput = document.getElementById('latexInput');
    const latex = latexInput?.value || '';

    navigator.clipboard.writeText(latex).then(() => {
        showEditorMessage('📋 LaTeX copied to clipboard!', 'success');
    }).catch(() => {
        showEditorMessage('Failed to copy', 'error');
    });
}

function updateStarDisplay(rating) {
    document.querySelectorAll('.star').forEach((star, idx) => {
        if (idx < rating) {
            star.textContent = '★';
            star.classList.add('active');
        } else {
            star.textContent = '☆';
            star.classList.remove('active');
        }
    });
}

// ==================== Gallery Functions ====================
async function loadGallery() {
    if (!state.sessionId) {
        const galleryEmpty = document.getElementById('galleryEmpty');
        const galleryGrid = document.getElementById('galleryGrid');
        const galleryStats = document.getElementById('galleryStats');
        if (galleryEmpty) galleryEmpty.style.display = 'block';
        if (galleryGrid) galleryGrid.style.display = 'none';
        if (galleryStats) galleryStats.style.display = 'none';
        const galleryLoading = document.getElementById('galleryLoading');
        if (galleryLoading) galleryLoading.style.display = 'none';
        return;
    }

    const galleryLoading = document.getElementById('galleryLoading');
    const galleryError = document.getElementById('galleryError');
    const galleryEmpty = document.getElementById('galleryEmpty');
    const galleryGrid = document.getElementById('galleryGrid');

    if (galleryLoading) galleryLoading.style.display = 'block';
    if (galleryError) galleryError.style.display = 'none';
    if (galleryEmpty) galleryEmpty.style.display = 'none';
    if (galleryGrid) galleryGrid.style.display = 'none';

    try {
        const response = await fetch(`${API_BASE_URL}/api/images?session_id=${state.sessionId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch images');
        }

        state.images = data.images || [];

        const galleryStats = document.getElementById('galleryStats');

        if (state.images.length === 0) {
            if (galleryEmpty) galleryEmpty.style.display = 'block';
            if (galleryStats) galleryStats.style.display = 'none';
        } else {
            renderGallery();
            if (data.stats) {
                displayStats(data.stats);
            }
        }

    } catch (err) {
        if (galleryError) {
            galleryError.textContent = 'Error: ' + err.message;
            galleryError.style.display = 'block';
        }
    } finally {
        if (galleryLoading) galleryLoading.style.display = 'none';
    }
}

function renderGallery() {
    const grid = document.getElementById('galleryGrid');
    if (!grid) return;

    grid.innerHTML = '';

    state.images.forEach(image => {
        const item = document.createElement('div');
        item.className = 'gallery-item';

        const latexDisplay = image.edited_latex || image.latex || '';

        item.innerHTML = `
            <img src="${image.data}" alt="${image.filename}" class="gallery-item-image" style="cursor:pointer;">
            <div class="gallery-item-info">
                <div class="gallery-item-name" title="${image.filename}">${image.filename}</div>
                <div class="gallery-item-latex" title="${latexDisplay}">${latexDisplay}</div>
                <div class="gallery-item-actions">
                    <button class="btn-view">View</button>
                    <button class="btn-delete">Delete</button>
                </div>
            </div>
        `;

        const viewBtn = item.querySelector('.btn-view');
        const deleteBtn = item.querySelector('.btn-delete');
        const img = item.querySelector('.gallery-item-image');

        viewBtn.addEventListener('click', () => handleViewImage(image));
        deleteBtn.addEventListener('click', () => handleDeleteImage(image.id));
        img.addEventListener('click', () => handleViewImage(image));

        grid.appendChild(item);
    });

    grid.style.display = 'grid';
}

function displayStats(stats) {
    const galleryStats = document.getElementById('galleryStats');
    const totalImages = document.getElementById('totalImages');

    if (totalImages) totalImages.textContent = state.images.length;
    if (galleryStats) galleryStats.style.display = 'block';
}

async function handleViewImage(image) {
    try {
        console.log('Loading image from gallery:', image.id, 'Confidence:', image.confidence);
        
        state.currentImage = {
            imageId: image.id,
            filename: image.filename,
            preview: image.data
        };

        state.currentLatex = {
            imageId: image.id,
            latex: image.edited_latex || image.latex,
            confidence: image.confidence
        };

        setActiveTab('editor');
    } catch (err) {
        showError(`Error loading image: ${err.message}`);
    }
}

async function handleDeleteImage(imageId) {
    if (!confirm('Are you sure you want to delete this image?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/image/${imageId}?session_id=${state.sessionId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to delete image');
        }

        showSuccess('Image deleted successfully!');
        loadGallery();

    } catch (err) {
        showError(`Error deleting image: ${err.message}`);
    }
}

// ==================== Utility Functions ====================
function showError(message) {
    const errorDiv = document.getElementById('uploadError');
    if (!errorDiv) return;

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';

    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const successDiv = document.getElementById('uploadSuccess');
    if (!successDiv) return;

    successDiv.textContent = message;
    successDiv.style.display = 'block';

    setTimeout(() => {
        successDiv.style.display = 'none';
    }, 5000);
}

function showEditorMessage(message, type) {
    const msgDiv = document.getElementById('editorMessage');
    if (!msgDiv) return;

    msgDiv.textContent = message;
    msgDiv.className = type === 'success' ? 'success-message' : 'error-message';
    msgDiv.style.display = 'block';

    setTimeout(() => {
        msgDiv.style.display = 'none';
    }, 3000);
}

function showQualityWarnings(warnings, hint) {
    const warningsDiv = document.getElementById('qualityWarnings');
    const warningsList = document.getElementById('warningsList');

    if (!warningsDiv || !warningsList) return;

    warningsList.innerHTML = '';
    warnings.forEach(warning => {
        const li = document.createElement('li');
        li.textContent = warning;
        warningsList.appendChild(li);
    });

    // Show actionable hint if provided
    if (hint) {
        const hintLi = document.createElement('li');
        hintLi.style.fontWeight = 'bold';
        hintLi.style.marginTop = '8px';
        hintLi.textContent = hint;
        warningsList.appendChild(hintLi);
    }

    warningsDiv.style.display = 'block';
}

function clearMessages() {
    const uploadError = document.getElementById('uploadError');
    const uploadSuccess = document.getElementById('uploadSuccess');
    const qualityWarnings = document.getElementById('qualityWarnings');

    if (uploadError) uploadError.style.display = 'none';
    if (uploadSuccess) uploadSuccess.style.display = 'none';
    if (qualityWarnings) qualityWarnings.style.display = 'none';
}

function sanitizeLatex(input) {
    let expr = (input || '').trim();
    if (!expr) return '';

    // Strip common math delimiters
    if (expr.startsWith('$$') && expr.endsWith('$$')) {
        expr = expr.slice(2, -2).trim();
    } else if (expr.startsWith('$') && expr.endsWith('$')) {
        expr = expr.slice(1, -1).trim();
    } else if (expr.startsWith('\\[') && expr.endsWith('\\]')) {
        expr = expr.slice(2, -2).trim();
    } else if (expr.startsWith('\\(') && expr.endsWith('\\)')) {
        expr = expr.slice(2, -2).trim();
    }

    // Handle specific LaTeX issues
    expr = expr.replace(/\\mathcal\s*\{\s*(\\[a-zA-Z]+)\s*\}/g, '$1');
    expr = expr.replace(/\\lbrace\b/g, '\\{');
    expr = expr.replace(/\\rbrace\b/g, '\\}');

    return expr;
}
