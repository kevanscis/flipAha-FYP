const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// Initialize Firebase Admin
// Make sure to set up your Firebase credentials
// Download your service account key from Firebase Console
/*
try {
    const serviceAccount = require('../firebase-config-admin.json');
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL
    });
    
    console.log('Firebase Admin initialized successfully');
} catch (error) {
    console.warn('Firebase Admin not configured. Set up firebase-config-admin.json for backend features.');
}

const db = admin.firestore();
*/

console.log('Firebase Admin is currently disabled - using local storage only');
const db = null; // Placeholder

// Routes

// GET all tasks
app.get('/api/tasks', async (req, res) => {
    try {
        const snapshot = await db.collection('tasks')
            .orderBy('createdAt', 'desc')
            .get();

        const tasks = [];
        snapshot.forEach(doc => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            data: tasks
        });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// GET single task
app.get('/api/tasks/:id', async (req, res) => {
    try {
        const doc = await db.collection('tasks').doc(req.params.id).get();

        if (!doc.exists) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        res.json({
            success: true,
            data: {
                id: doc.id,
                ...doc.data()
            }
        });
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// POST create task
app.post('/api/tasks', async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!title) {
            return res.status(400).json({
                success: false,
                error: 'Title is required'
            });
        }

        const taskRef = await db.collection('tasks').add({
            title,
            description: description || '',
            completed: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            success: true,
            data: {
                id: taskRef.id,
                title,
                description,
                completed: false
            }
        });
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// PUT update task
app.put('/api/tasks/:id', async (req, res) => {
    try {
        const { title, description, completed } = req.body;

        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (completed !== undefined) updateData.completed = completed;

        await db.collection('tasks').doc(req.params.id).update(updateData);

        res.json({
            success: true,
            message: 'Task updated successfully'
        });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// DELETE task
app.delete('/api/tasks/:id', async (req, res) => {
    try {
        await db.collection('tasks').doc(req.params.id).delete();

        res.json({
            success: true,
            message: 'Task deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running'
    });
});

// POST handle math question
app.post('/api/questions', (req, res) => {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Question is required'
            });
        }

        // Generate response based on question keywords
        const answer = generateMathResponse(question);

        res.json({
            success: true,
            question: question,
            answer: answer
        });
    } catch (error) {
        console.error('Error processing question:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Function to generate math responses
function generateMathResponse(question) {
    const q = question.toLowerCase();

    const responses = {
        'derivative': 'To find the derivative of x², we use the power rule: d/dx(x^n) = n·x^(n-1). So d/dx(x²) = 2x. The derivative represents the instantaneous rate of change of the function.',
        'solve': 'Let me solve 2x + 5 = 13 step by step:\n1. Start: 2x + 5 = 13\n2. Subtract 5 from both sides: 2x = 8\n3. Divide by 2: x = 4\n\nTo verify: 2(4) + 5 = 8 + 5 = 13 ✓',
        'integral': 'The integral (antiderivative) of x² is x³/3 + C, where C is the constant of integration. This is found using the power rule for integration: ∫x^n dx = x^(n+1)/(n+1) + C.',
        'quadratic': 'The quadratic formula is used to solve ax² + bx + c = 0:\n\nx = (-b ± √(b² - 4ac)) / 2a\n\nThe discriminant (b² - 4ac) tells us about the nature of roots.',
        'limit': 'A limit describes the value that a function approaches as the input approaches some value. For example: lim(x→2) (x²) = 4 means as x gets closer to 2, x² approaches 4.',
        'algebra': 'Algebra is the branch of mathematics that uses symbols (variables) to represent unknown quantities and express mathematical relationships. Key concepts include: equations, inequalities, and functions.',
        'geometry': 'Geometry is the study of shapes, sizes, and properties of figures and spaces. Key topics include: points, lines, angles, triangles, circles, area, and volume.',
        'trigonometry': 'Trigonometry deals with relationships between angles and sides of triangles. The main ratios are: sin(θ) = opposite/hypotenuse, cos(θ) = adjacent/hypotenuse, tan(θ) = opposite/adjacent.'
    };

    // Check for keyword matches
    for (const [key, answer] of Object.entries(responses)) {
        if (q.includes(key)) {
            return answer;
        }
    }

    // Default response
    return 'Great question! I\'m here to help you understand math concepts. Here are my suggestions:\n\n1. Break the problem into smaller parts\n2. Identify what you know and what you need to find\n3. Choose the appropriate formula or method\n4. Work through it step by step\n5. Double-check your answer\n\nFeel free to ask follow-up questions or clarify any specific concepts! Some topics I can help with: derivatives, solving equations, integrals, quadratic formula, limits, algebra, geometry, and trigonometry.';
}

// Serve index.html for any other route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
