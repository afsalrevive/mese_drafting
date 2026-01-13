const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const fs = require('fs');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const sessionsFile = 'sessions.json';

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

let sessions = {};
if (fs.existsSync(sessionsFile)) {
  sessions = JSON.parse(fs.readFileSync(sessionsFile, 'utf8'));
}

const saveSessions = () => fs.writeFileSync(sessionsFile, JSON.stringify(sessions));

const requireAuth = (req, res, next) => {
  const token = req.headers.authorization;
  if (!token || !sessions[token]) return res.status(401).json({ error: 'Unauthorized' });
  req.user = sessions[token];
  next();
};

// --- FILE UPLOAD CONFIGURATION ---

// Helper to ensure directories exist (Recursive)
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

// Create folders
ensureDir('./uploads/screenshots');
ensureDir('./uploads/forum');

// 1. Config for Member Screenshots
const screenshotStorage = multer.diskStorage({
  destination: './uploads/screenshots/', 
  filename: function(req, file, cb) {
    cb(null, 'proof-' + Date.now() + path.extname(file.originalname));
  }
});

const uploadScreenshot = multer({ 
  storage: screenshotStorage,
  limits: { fileSize: 5000000 } // 5MB
});

// 2. Config for Discussion Forum & Chat
const forumStorage = multer.diskStorage({
  destination: './uploads/forum/', 
  filename: function(req, file, cb) {
    cb(null, 'forum-' + Date.now() + path.extname(file.originalname));
  }
});

const uploadForum = multer({ 
  storage: forumStorage,
  limits: { fileSize: 10000000 } // 10MB (Higher limit for discussions)
});

// Serve static files (Access via http://host/uploads/screenshots/filename.png)
app.use('/uploads', express.static('uploads'));


// --- AUTH & USER MGMT ---

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.login(username, password);
  if (user) {
    delete user.password;
    const token = Math.random().toString(36);
    sessions[token] = user;
    saveSessions();
    res.json({ token, user });
  } else {
    res.status(401).json({ error: 'Invalid credentials or account pending approval' });
  }
});

app.post('/api/logout', requireAuth, (req, res) => {
  delete sessions[req.headers.authorization];
  saveSessions();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const users = db.getUsers();
  const freshUser = users.find(u => u.id === req.user.id);
  if (freshUser) {
    sessions[req.headers.authorization] = freshUser;
    saveSessions();
    res.json(freshUser);
  } else {
    res.status(401).json({ error: 'User not found' });
  }
});

app.get('/api/users', (req, res) => res.json(db.getUsers()));

app.post('/api/users', (req, res) => {
  try {
    res.json(db.insertUser(req.body.name, req.body.username, req.body.password, req.body.email, req.body.roles));
  } catch (err) {
    if (err.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'Username already exists' });
    } else {
        res.status(500).json({ error: err.message });
    }
  }
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  if (req.user.id !== parseInt(req.params.id) && !req.user.roles.includes('ADMIN')) {
      return res.status(403).json({ error: 'Forbidden' });
  }
  try {
      res.json(db.updateUser(req.params.id, req.body));
  } catch (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'Username already exists' });
      } else {
        res.status(500).json({ error: err.message });
      }
  }
});

app.delete('/api/users/:id', requireAuth, (req, res) => {
    if (!req.user.roles.includes('ADMIN')) return res.status(403).json({ error: 'Forbidden' });
    res.json(db.deleteUser(req.params.id));
});

// --- STATS & REPORTS ---

app.get('/api/stats', requireAuth, (req, res) => {
    res.json(db.getStats(req.user.roles, req.user.id));
});

// REPLACE the existing app.post('/api/reports', ...) block with this:

app.post('/api/reports', requireAuth, (req, res) => {
    const { startDate, endDate, teamId, memberId, role: contextRole } = req.body;
    let role = 'MEMBER';

    // Logic: Use the requested context role IF the user actually has that permission.
    // Otherwise, default to their highest role.
    if (contextRole && req.user.roles.includes(contextRole)) {
        role = contextRole;
        // Map frontend role names to DB expected strings if necessary
        if (role === 'PROJECT_MANAGER') role = 'PM'; 
    } else {
        // Fallback to highest role
        if (req.user.roles.includes('ADMIN') || req.user.roles.includes('PROJECT_MANAGER')) role = 'PM';
        else if (req.user.roles.includes('TEAM_LEAD')) role = 'TEAM_LEAD';
    }
    
    res.json(db.getReport(role, req.user.id, startDate, endDate, teamId, memberId));
});

// --- PROJECT ENDPOINTS ---
app.get('/api/teams', requireAuth, (req, res) => res.json(db.getTeams()));
app.post('/api/teams', requireAuth, (req, res) => res.json(db.insertTeam(req.body.name, req.body.leadIds)));
app.get('/api/projects', requireAuth, (req, res) => res.json(db.getProjects()));
app.post('/api/projects', requireAuth, (req, res) => res.json(db.insertProject(req.body.name, req.body.date, req.body.divisions, req.body.partNos, req.body.workTypes, req.body.status, req.body.remarks)));
app.put('/api/projects/:id', requireAuth, (req, res) => res.json(db.updateProject(req.params.id, req.body)));
app.put('/api/projects/:id/hold', requireAuth, (req, res) => { db.toggleHold(req.params.id, req.body.isHold); res.json({ success: true }); });
app.delete('/api/projects/:id', requireAuth, (req, res) => res.json(db.deleteProject(req.params.id)));
app.post('/api/rework', requireAuth, (req, res) => { res.json(db.triggerRework(req.body.projectId, req.body.teamId, req.body.scope, req.body.assignedTime, req.body.eta, req.body.fileSize)); });
app.get('/api/groupAssignments', requireAuth, (req, res) => res.json(db.getGroupAssignments()));
app.post('/api/groupAssignments', requireAuth, (req, res) => { res.json(db.insertGroupAssignment(req.body.projectId, req.body.teamId, req.body.scope, req.body.fileSize, req.body.assignedTime, req.body.eta, 'PENDING', req.body.remarks));});
app.put('/api/groupAssignments/:id', requireAuth, (req, res) => res.json(db.updateGroupAssignment(req.params.id, req.body)));
app.delete('/api/groupAssignments/:id', requireAuth, (req, res) => res.json(db.deleteGroupAssignment(req.params.id)));
app.get('/api/memberAssignments', requireAuth, (req, res) => res.json(db.getMemberAssignments()));
app.post('/api/memberAssignments', requireAuth, (req, res) => res.json(db.insertMemberAssignment(req.body.groupAssignmentId, req.body.memberId, req.body.scope, req.body.assignedTime, req.body.eta, req.body.completionTime, 'IN_PROGRESS', req.body.remarks, req.body.reworkFromId, 0, 0)));
app.put('/api/memberAssignments/:id', requireAuth, (req, res) => res.json(db.updateMemberAssignment(req.params.id, req.body)));
app.delete('/api/memberAssignments/:id', requireAuth, (req, res) => res.json(db.deleteMemberAssignment(req.params.id)));
app.get('/api/workTypes', requireAuth, (req, res) => res.json(db.getWorkTypes()));
app.post('/api/workTypes', requireAuth, (req, res) => { const r = db.addWorkType(req.body.name); r.success ? res.json(r) : res.status(400).json(r); });
app.delete('/api/workTypes/:name', requireAuth, (req, res) => res.json(db.removeWorkType(req.params.name)));
app.get('/api/config/public', (req, res) => {
    res.json(db.getPublicConfig());
});
app.get('/api/config', requireAuth, (req, res) => {
    res.json(db.getConfig());
});
app.put('/api/config', requireAuth, (req, res) => {
    if (!req.user.roles.includes('ADMIN')) return res.status(403).json({ error: 'Forbidden' });
    res.json(db.updateConfig(req.body));
});

app.get('/api/notifications', requireAuth, (req, res) => res.json(db.getNotifications(req.user.id)));
app.post('/api/notifications/read', requireAuth, (req, res) => res.json(db.markNotificationsRead(req.user.id)));
app.delete('/api/notifications', requireAuth, (req, res) => res.json(db.clearNotifications(req.user.id)));

// --- MEMBER ASSIGNMENT SUBMISSION (Uses Screenshot Storage) ---
app.post('/api/memberAssignments/submit', requireAuth, uploadScreenshot.single('screenshot'), (req, res) => {
    const { id, remarks, customTime } = req.body;
    const screenshotPath = req.file ? req.file.path.replace('\\', '/') : null;

    res.json(db.updateMemberAssignment(id, {
        status: 'PENDING_ACK',
        completionTime: customTime || new Date().toISOString(),
        remarks: remarks,
        screenshot: screenshotPath // Saved to uploads/screenshots/
    }));
});

// --- CHAT ROUTES (Uses Forum Storage) ---
app.get('/api/chat', requireAuth, (req, res) => {
    res.json(db.getChatMessages());
});

app.post('/api/chat', requireAuth, uploadForum.single('image'), (req, res) => {
    // 1. Determine Content & Filename
    let content = req.body.message;
    let fileName = null;
    let isImage = req.body.isImage === 'true'; // Convert string 'true' to boolean

    if (req.file) {
        // If file exists, content becomes the path
        content = '/uploads/forum/' + req.file.filename;
        fileName = req.file.originalname; // Capture the original name (e.g., "Design.pdf")
        
        // Auto-detect image type from mimetype if not specified
        if (req.file.mimetype.startsWith('image/')) {
            isImage = true;
        }
    }
    
    // 2. Pass fileName as the 7th argument (Check your db.js sendMessage signature)
    res.json(db.sendMessage(
        req.user.id, 
        req.user.name, 
        req.user.roles[0], 
        content, 
        req.body.channel,
        isImage,
        fileName // <--- NEW ARGUMENT
    ));
});

// --- FORUM ROUTES ---
app.get('/api/forum', requireAuth, (req, res) => {
    res.json(db.getThreads());
});

app.post('/api/forum', requireAuth, uploadForum.single('image'), (req, res) => {
    let content = req.body.content;
    let fileName = null;
    let isImage = req.body.isImage === 'true';

    if (req.file) {
        content = '/uploads/forum/' + req.file.filename;
        fileName = req.file.originalname;
        if (req.file.mimetype.startsWith('image/')) isImage = true;
    }
    
    res.json(db.createThread(
        req.user.id, 
        req.user.name, 
        req.body.title, 
        content,
        isImage,
        fileName // <--- NEW ARGUMENT
    ));
});

app.post('/api/forum/comment', requireAuth, uploadForum.single('image'), (req, res) => {
    let content = req.body.content;
    let fileName = null;
    let isImage = req.body.isImage === 'true';

    if (req.file) {
        content = '/uploads/forum/' + req.file.filename;
        fileName = req.file.originalname;
        if (req.file.mimetype.startsWith('image/')) isImage = true;
    }
    
    res.json(db.createComment(
        req.body.threadId, 
        req.user.id, 
        req.user.name, 
        content,
        isImage,
        fileName // <--- NEW ARGUMENT
    ));
});

app.delete('/api/chat/:id', requireAuth, (req, res) => {
    const msgId = parseInt(req.params.id);
    const msg = db.getMessageById(msgId);
    
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (msg.senderId !== req.user.id && !req.user.roles.includes('ADMIN')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete file if it exists
    if (msg.fileName && msg.message.startsWith('/uploads')) {
        const filePath = path.join(__dirname, msg.message);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json(db.deleteMessage(msgId));
});

// 3. NEW: Delete Forum Thread/Comment
app.delete('/api/forum/:type/:id', requireAuth, (req, res) => {
    const { type, id } = req.params; // type = 'thread' or 'comment'
    const itemId = parseInt(id);
    
    let item, deleteFunc;
    
    if (type === 'thread') {
        item = db.getThreadById(itemId);
        deleteFunc = db.deleteThread;
    } else {
        item = db.getCommentById(itemId);
        deleteFunc = db.deleteComment;
    }

    if (!item) return res.status(404).json({ error: 'Item not found' });
    
    // Permission check
    if (item.authorId !== req.user.id && !req.user.roles.includes('ADMIN') && !req.user.roles.includes('PROJECT_MANAGER')) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    // Delete file if exists (content column stores path)
    if ((item.isImage || item.fileName) && item.content.startsWith('/uploads')) {
        const filePath = path.join(__dirname, item.content);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    res.json(deleteFunc(itemId));
});
// Availability Endpoint
app.get('/api/availability', requireAuth, (req, res) => {
  try {
    const data = db.getAvailability();
    res.json(data);
  } catch (err) {
    console.error("Availability Error:", err);
    res.status(500).json({ error: "Failed to fetch availability" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});