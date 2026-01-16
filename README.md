# FlipAha - Task Manager Application

A full-stack web application built with HTML, CSS, JavaScript (frontend), Node.js/Express (backend), and Firebase (database).

## 🚀 Features

- ✅ Create, read, update, and delete tasks
- ✅ Mark tasks as completed
- ✅ Real-time task updates with Firestore
- ✅ Responsive design for mobile and desktop
- ✅ RESTful API backend
- ✅ Firebase authentication ready

## 📁 Project Structure

```
flipAha-FYP/
├── public/                    # Frontend files
│   ├── index.html            # Main HTML file
│   ├── styles.css            # Styling
│   ├── app.js                # Frontend JavaScript
│   └── firebase-config.js    # Firebase client config
├── src/                       # Backend files
│   ├── server.js             # Express server
│   └── firebase-config-admin.example.json
├── package.json              # Node.js dependencies
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: Firebase Firestore
- **Hosting**: Can be deployed to Firebase Hosting, Heroku, Vercel, etc.

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Firebase account (free tier available)
- Web browser with modern JavaScript support

## ⚙️ Setup Instructions

### 1. Clone or Initialize the Project

```bash
cd /Applications/MAMP/htdocs/flipAha-FYP
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Firebase

#### Frontend Configuration:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Go to Project Settings → General
4. Copy your Firebase config object
5. Update `public/firebase-config.js` with your credentials:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

#### Backend Configuration (Optional - for API features):

1. In Firebase Console, go to Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Save the JSON file as `src/firebase-config-admin.json`
4. Create a `.env` file from `.env.example`:

```bash
cp .env.example .env
```

5. Update `.env` with your Firebase database URL

### 4. Create Firestore Database

1. In Firebase Console, go to Firestore Database
2. Click "Create Database"
3. Select "Start in test mode" (for development)
4. Choose a location close to you
5. The database will be ready to use

### 5. Run the Application

**Development mode (with auto-reload):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📚 API Endpoints

### GET /api/tasks
Get all tasks
```bash
curl http://localhost:3000/api/tasks
```

### GET /api/tasks/:id
Get a specific task
```bash
curl http://localhost:3000/api/tasks/{taskId}
```

### POST /api/tasks
Create a new task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"My Task","description":"Task details"}'
```

### PUT /api/tasks/:id
Update a task
```bash
curl -X PUT http://localhost:3000/api/tasks/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"title":"Updated Title","completed":true}'
```

### DELETE /api/tasks/:id
Delete a task
```bash
curl -X DELETE http://localhost:3000/api/tasks/{taskId}
```

### GET /api/health
Health check
```bash
curl http://localhost:3000/api/health
```

## 🎨 Frontend Features

- **Beautiful UI**: Modern gradient design with smooth animations
- **Responsive**: Works on mobile, tablet, and desktop
- **Real-time Updates**: Instant sync with Firebase
- **Task Management**: Add, edit, complete, and delete tasks
- **Persistent Storage**: All data saved to Firebase

## 🔐 Security Notes

- The frontend uses Firebase client SDK (web)
- Backend API endpoints are available for authenticated requests
- Firestore Security Rules should be configured for production:

```json
{
  "rules": {
    "tasks": {
      "$uid": {
        ".read": "auth.uid == $uid",
        ".write": "auth.uid == $uid"
      }
    }
  }
}
```

## 🚀 Deployment

### Deploy to Firebase Hosting

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project
firebase init hosting

# Build and deploy
npm run build  # if you have a build script
firebase deploy
```

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Heroku

```bash
# Install Heroku CLI
# Log in
heroku login

# Create app
heroku create your-app-name

# Deploy
git push heroku main
```

## 📖 Usage Guide

### Adding a Task
1. Enter task title in the input field
2. Optionally add a description
3. Click "Add Task"

### Completing a Task
- Check the checkbox on any task card to mark it as complete
- The task will appear faded with strikethrough text

### Editing a Task
1. Click "Edit" button on a task
2. Update the title or description
3. Click OK to save

### Deleting a Task
1. Click "Delete" button on a task
2. Confirm the deletion

## 🐛 Troubleshooting

### Firebase Connection Issues
- Verify Firebase credentials are correct
- Check Firestore Database is in "test mode" or rules allow access
- Check browser console for errors

### Node.js/Express Issues
- Ensure Node.js is installed: `node --version`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check if port 3000 is available

### CSS Not Loading
- Clear browser cache (Ctrl+Shift+Delete or Cmd+Shift+Delete)
- Check that `public/styles.css` exists
- Verify server is running

## 📝 Environment Variables

Create a `.env` file with:

```
PORT=3000
FIREBASE_DATABASE_URL=your_database_url
```

## 🤝 Contributing

Feel free to fork this project and submit pull requests for any improvements.

## 📄 License

This project is open source and available under the ISC License.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review Firebase documentation: https://firebase.google.com/docs
3. Check Express.js documentation: https://expressjs.com

## 🎓 Learning Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Express.js Guide](https://expressjs.com)
- [Firestore Database](https://firebase.google.com/docs/firestore)
- [Vanilla JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

---

**Happy coding! 🚀**
