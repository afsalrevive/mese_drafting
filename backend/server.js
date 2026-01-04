const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./db');
const fs = require('fs');

const app = express();
const PORT = 3001;
const sessionsFile = 'sessions.json';

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Increased for Avatar Base64

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

// --- AUTH & USER MGMT ---

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.login(username, password);
  if (user) {
    const token = Math.random().toString(36);
    sessions[token] = user;
    saveSessions();
    res.json({ token, user });
  } else {
    // FIX: Send specific error code
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
    // New fields: email
    res.json(db.insertUser(req.body.name, req.body.username, req.body.password, req.body.email, req.body.roles));
  } catch (err) {
    // Handle Unique Constraint
    if (err.message.includes('UNIQUE constraint failed')) {
        res.status(409).json({ error: 'Username already exists' });
    } else {
        res.status(500).json({ error: err.message });
    }
  }
});

app.put('/api/users/:id', requireAuth, (req, res) => {
  // Allow self-update or Admin update
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
    // Determine the highest priority role for statistics
    let role = 'MEMBER';
    if (req.user.roles.includes('ADMIN')) role = 'ADMIN'; // Admin sees PM stats
    else if (req.user.roles.includes('PROJECT_MANAGER')) role = 'PROJECT_MANAGER';
    else if (req.user.roles.includes('TEAM_LEAD')) role = 'TEAM_LEAD';
    
    // Pass role and userId to DB
    res.json(db.getStats(role, req.user.id));
});

app.post('/api/reports', requireAuth, (req, res) => {
    const { startDate, endDate, teamId, memberId } = req.body;
    let role = 'MEMBER';
    if (req.user.roles.includes('ADMIN') || req.user.roles.includes('PROJECT_MANAGER')) role = 'PM';
    else if (req.user.roles.includes('TEAM_LEAD')) role = 'TEAM_LEAD';
    
    res.json(db.getReport(role, req.user.id, startDate, endDate, teamId, memberId));
});

// --- EXISTING PROJECT ENDPOINTS (No changes needed, just copy previous structure) ---
app.get('/api/teams', requireAuth, (req, res) => res.json(db.getTeams()));
app.post('/api/teams', requireAuth, (req, res) => res.json(db.insertTeam(req.body.name, req.body.leadIds)));
app.get('/api/projects', requireAuth, (req, res) => res.json(db.getProjects()));
app.post('/api/projects', requireAuth, (req, res) => res.json(db.insertProject(req.body.name, req.body.date, req.body.divisions, req.body.partNos, req.body.workTypes, req.body.status, req.body.remarks)));
app.put('/api/projects/:id', requireAuth, (req, res) => res.json(db.updateProject(req.params.id, req.body)));
app.put('/api/projects/:id/hold', requireAuth, (req, res) => { db.toggleHold(req.params.id, req.body.isHold); res.json({ success: true }); });
app.delete('/api/projects/:id', requireAuth, (req, res) => res.json(db.deleteProject(req.params.id)));
app.post('/api/rework', requireAuth, (req, res) => { res.json(db.triggerRework(req.body.projectId, req.body.teamId, req.body.divisions, req.body.partNos, req.body.workTypes, req.body.assignedTime, req.body.eta, req.body.fileSize)); });
app.get('/api/groupAssignments', requireAuth, (req, res) => res.json(db.getGroupAssignments()));
app.post('/api/groupAssignments', requireAuth, (req, res) => res.json(db.insertGroupAssignment(req.body.projectId, req.body.teamId, req.body.workTypes, req.body.divisions, req.body.partNos, req.body.fileSize, req.body.assignedTime, req.body.eta, 'PENDING', req.body.remarks)));
app.put('/api/groupAssignments/:id', requireAuth, (req, res) => res.json(db.updateGroupAssignment(req.params.id, req.body)));
app.delete('/api/groupAssignments/:id', requireAuth, (req, res) => res.json(db.deleteGroupAssignment(req.params.id)));
app.get('/api/memberAssignments', requireAuth, (req, res) => res.json(db.getMemberAssignments()));
app.post('/api/memberAssignments', requireAuth, (req, res) => res.json(db.insertMemberAssignment(req.body.groupAssignmentId, req.body.memberId, req.body.workTypes, req.body.divisions, req.body.partNos, req.body.assignedTime, req.body.eta, req.body.completionTime, 'IN_PROGRESS', req.body.remarks, req.body.reworkFromId, 0, 0)));
app.put('/api/memberAssignments/:id', requireAuth, (req, res) => res.json(db.updateMemberAssignment(req.params.id, req.body)));
app.delete('/api/memberAssignments/:id', requireAuth, (req, res) => res.json(db.deleteMemberAssignment(req.params.id)));
app.get('/api/workTypes', requireAuth, (req, res) => res.json(db.getWorkTypes()));
app.post('/api/workTypes', requireAuth, (req, res) => { const r = db.addWorkType(req.body.name); r.success ? res.json(r) : res.status(400).json(r); });
app.delete('/api/workTypes/:name', requireAuth, (req, res) => res.json(db.removeWorkType(req.params.name)));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));