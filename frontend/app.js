// DOM Elements
const questionForm = document.getElementById('questionForm');
const questionInput = document.getElementById('questionInput');
const messagesContainer = document.getElementById('messagesContainer');
const responseMessage = document.getElementById('responseMessage');

// API Base URL
const API_BASE_URL = 'http://localhost:3000';

// Form submission
questionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const question = questionInput.value.trim();
    
    if (!question) {
        showResponseMessage('Please enter a math question', 'error');
        return;
    }

    // Add user message
    addMessage(question, 'user');
    questionInput.value = '';
    questionInput.focus();

    // Show loading state
    addMessage('Thinking...', 'loading');
    showResponseMessage('Processing your question...', 'loading');

    try {
        // Send question to backend API
        const response = await fetch(`${API_BASE_URL}/api/questions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: question })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Remove loading message
        const loadingMessages = messagesContainer.querySelectorAll('.message.loading');
        if (loadingMessages.length > 0) {
            loadingMessages[loadingMessages.length - 1].remove();
        }
        
        // Add assistant response
        if (data.success) {
            addMessage(data.answer, 'assistant');
            showResponseMessage('✅ Response received!', 'success');
        } else {
            throw new Error(data.error || 'Failed to get response');
        }
    } catch (error) {
        console.error('Error:', error);
        
        // Remove loading message
        const loadingMessages = messagesContainer.querySelectorAll('.message.loading');
        if (loadingMessages.length > 0) {
            loadingMessages[loadingMessages.length - 1].remove();
        }
        
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        showResponseMessage('Error: ' + error.message, 'error');
    }
});

// Add message to chat
function addMessage(text, role) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = text;
    
    messageDiv.appendChild(bubble);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Show response message
function showResponseMessage(text, type) {
    responseMessage.textContent = text;
    
    // Remove all classes
    responseMessage.className = 'response-message';
    
    if (type) {
        responseMessage.classList.add(type);
    }
    
    // Auto-hide after 3 seconds for success
    if (type === 'success') {
        setTimeout(() => {
            responseMessage.className = 'response-message';
        }, 3000);
    }
}

// Keyboard shortcut: Ctrl+Enter or Cmd+Enter to submit
questionInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        questionForm.dispatchEvent(new Event('submit'));
    }
});