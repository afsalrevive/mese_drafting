const Database = require('better-sqlite3');
const db = new Database('database.db');

// 1. SCHEMA DEFINITION (Consolidated for Fresh Start)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    password TEXT,
    email TEXT,
    avatar TEXT,
    roles TEXT,
    teamId INTEGER,
    isApproved INTEGER DEFAULT 0,
    blackmarks REAL DEFAULT 0,
    bonusPoints REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    leadIds TEXT,
    blackmarks REAL DEFAULT 0,
    bonusPoints REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    date TEXT,
    divisions TEXT,
    partNos TEXT,
    workTypes TEXT,
    status TEXT,
    remarks TEXT,
    holdStartTime TEXT,
    totalHoldDuration INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS groupAssignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    projectId INTEGER,
    teamId INTEGER,
    workTypes TEXT,
    divisions TEXT,
    partNos TEXT,
    fileSize TEXT,
    assignedTime TEXT,
    eta TEXT,
    rating INTEGER DEFAULT 0,
    status TEXT, 
    remarks TEXT,
    completionTime TEXT,
    rejectionReason TEXT
  );

  CREATE TABLE IF NOT EXISTS memberAssignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupAssignmentId INTEGER,
    memberId INTEGER,
    workTypes TEXT,
    divisions TEXT,
    partNos TEXT,
    assignedTime TEXT,
    eta TEXT,
    completionTime TEXT,
    rating INTEGER DEFAULT 0,
    status TEXT,
    remarks TEXT,
    reworkFromId INTEGER,
    bonusAwarded REAL DEFAULT 0,
    blackmarksAwarded REAL DEFAULT 0,
    rejectionReason TEXT
  );

  CREATE TABLE IF NOT EXISTS work_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );
`);

// 2. SEED ADMIN
const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!admin) {
  console.log('--- CREATING DEFAULT ADMIN ACCOUNT ---');
  db.prepare('INSERT INTO users (name, username, password, roles, isApproved) VALUES (?, ?, ?, ?, ?)').run('Global Admin', 'admin', 'password', JSON.stringify(['ADMIN']), 1);
}

// 3. HELPERS & CONSTANTS
const safe = (val) => val == null ? null : (typeof val === 'boolean' ? (val ? 1 : 0) : val);
const safeInt = (val) => (val === null || val === undefined || val === '') ? null : parseInt(val, 10);

const SCORES = {
  BONUS_ON_TIME: 3,
  BONUS_STARS: { 3: 1, 4: 2, 5: 3 },
  BM_DELAY_PER_HR: 1,
  BM_REWORK: 5
};

// 4. PREPARED STATEMENTS
const stmts = {
  login: db.prepare('SELECT * FROM users WHERE username = ? AND password = ? AND isApproved = 1'),
  getUsers: db.prepare('SELECT * FROM users'),
  insertUser: db.prepare('INSERT INTO users (name, username, password, email, roles) VALUES (?, ?, ?, ?, ?)'),
  updateUser: db.prepare('UPDATE users SET name = COALESCE(?, name), username = COALESCE(?, username), password = COALESCE(?, password), email = COALESCE(?, email), avatar = COALESCE(?, avatar), roles = COALESCE(?, roles), isApproved = COALESCE(?, isApproved), blackmarks = COALESCE(?, blackmarks), bonusPoints = COALESCE(?, bonusPoints), teamId = COALESCE(?, teamId) WHERE id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  
  getTeams: db.prepare('SELECT * FROM teams'),
  insertTeam: db.prepare('INSERT INTO teams (name, leadIds) VALUES (?, ?)'),
  
  getProjects: db.prepare('SELECT * FROM projects'),
  insertProject: db.prepare('INSERT INTO projects (name, date, divisions, partNos, workTypes, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updateProject: db.prepare('UPDATE projects SET name = COALESCE(?, name), date = COALESCE(?, date), divisions = COALESCE(?, divisions), partNos = COALESCE(?, partNos), workTypes = COALESCE(?, workTypes), status = COALESCE(?, status), remarks = COALESCE(?, remarks), holdStartTime = COALESCE(?, holdStartTime), totalHoldDuration = COALESCE(?, totalHoldDuration) WHERE id = ?'),
  
  getGroupAssignments: db.prepare('SELECT * FROM groupAssignments'),
  insertGroupAssignment: db.prepare('INSERT INTO groupAssignments (projectId, teamId, workTypes, divisions, partNos, fileSize, assignedTime, eta, status, remarks, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'),
  updateGroupAssignment: db.prepare('UPDATE groupAssignments SET projectId = COALESCE(?, projectId), teamId = COALESCE(?, teamId), workTypes = COALESCE(?, workTypes), divisions = COALESCE(?, divisions), partNos = COALESCE(?, partNos), fileSize = COALESCE(?, fileSize), assignedTime = COALESCE(?, assignedTime), eta = COALESCE(?, eta), status = COALESCE(?, status), remarks = COALESCE(?, remarks), completionTime = COALESCE(?, completionTime), rating = COALESCE(?, rating), rejectionReason = COALESCE(?, rejectionReason) WHERE id = ?'),

  getMemberAssignments: db.prepare('SELECT * FROM memberAssignments'),
  insertMemberAssignment: db.prepare('INSERT INTO memberAssignments (groupAssignmentId, memberId, workTypes, divisions, partNos, assignedTime, eta, completionTime, status, remarks, reworkFromId, bonusAwarded, blackmarksAwarded, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'),
  updateMemberAssignment: db.prepare('UPDATE memberAssignments SET groupAssignmentId = COALESCE(?, groupAssignmentId), memberId = COALESCE(?, memberId), workTypes = COALESCE(?, workTypes), divisions = COALESCE(?, divisions), partNos = COALESCE(?, partNos), assignedTime = COALESCE(?, assignedTime), eta = COALESCE(?, eta), completionTime = COALESCE(?, completionTime), status = COALESCE(?, status), remarks = COALESCE(?, remarks), reworkFromId = COALESCE(?, reworkFromId), bonusAwarded = COALESCE(?, bonusAwarded), blackmarksAwarded = COALESCE(?, blackmarksAwarded), rating = COALESCE(?, rating), rejectionReason = COALESCE(?, rejectionReason) WHERE id = ?'),
  
  getWorkTypes: db.prepare('SELECT name FROM work_types'),
  insertWorkType: db.prepare('INSERT INTO work_types (name) VALUES (?)'),
  deleteWorkType: db.prepare('DELETE FROM work_types WHERE name = ?'),

  updateUserScore: db.prepare('UPDATE users SET bonusPoints = bonusPoints + ?, blackmarks = blackmarks + ? WHERE id = ?'),
  updateTeamScore: db.prepare('UPDATE teams SET bonusPoints = bonusPoints + ?, blackmarks = blackmarks + ? WHERE id = ?'),
  
  extendProjectEta: db.prepare("UPDATE groupAssignments SET eta = datetime(eta, '+' || ? || ' minutes') WHERE projectId = ? AND status != 'COMPLETED'"),
  extendMemberEta: db.prepare("UPDATE memberAssignments SET eta = datetime(eta, '+' || ? || ' minutes') WHERE groupAssignmentId IN (SELECT id FROM groupAssignments WHERE projectId = ?) AND status != 'COMPLETED'"),
  
  findReworkCulprits: db.prepare(`SELECT ma.memberId FROM memberAssignments ma JOIN groupAssignments ga ON ma.groupAssignmentId = ga.id WHERE ga.projectId = ? AND (EXISTS (SELECT 1 FROM json_each(ma.divisions) WHERE value IN (SELECT value FROM json_each(?))) OR EXISTS (SELECT 1 FROM json_each(ma.partNos) WHERE value IN (SELECT value FROM json_each(?))))`)
};

module.exports = {
  login: (username, password) => { const user = stmts.login.get(username, password); if (user) user.roles = JSON.parse(user.roles); return user; },
  getUsers: () => stmts.getUsers.all().map(u => ({ ...u, roles: JSON.parse(u.roles || '[]') })),
  
  insertUser: (name, username, password, email, roles) => { 
      const result = stmts.insertUser.run(name, username, password, email, JSON.stringify(roles)); 
      return { id: result.lastInsertRowid, name, username, password, email, roles }; 
  },
  
  updateUser: (id, updates) => { 
      stmts.updateUser.run(safe(updates.name), safe(updates.username), safe(updates.password), safe(updates.email), safe(updates.avatar), updates.roles ? JSON.stringify(updates.roles) : null, safe(updates.isApproved), safe(updates.blackmarks), safe(updates.bonusPoints), safeInt(updates.teamId), safeInt(id)); 
      return { success: true }; 
  },

  deleteUser: (id) => { stmts.deleteUser.run(id); return { success: true }; },
  getTeams: () => stmts.getTeams.all().map(t => ({ ...t, leadIds: JSON.parse(t.leadIds || '[]').map(id => parseInt(id)) })),
  insertTeam: (name, leadIds) => { const result = stmts.insertTeam.run(name, JSON.stringify(leadIds || [])); return { id: result.lastInsertRowid, name, leadIds }; },
  
  getProjects: () => stmts.getProjects.all().map(p => ({ ...p, divisions: JSON.parse(p.divisions || '[]'), partNos: JSON.parse(p.partNos || '[]'), workTypes: JSON.parse(p.workTypes || '[]') })),
  insertProject: (name, date, divisions, partNos, workTypes, status, remarks) => { const result = stmts.insertProject.run(name, date, JSON.stringify(divisions || []), JSON.stringify(partNos || []), JSON.stringify(workTypes || []), status, remarks); return { id: result.lastInsertRowid, name, date, divisions, partNos, workTypes, status, remarks }; },
  updateProject: (id, updates) => { 
    stmts.updateProject.run(safe(updates.name), safe(updates.date), updates.divisions ? JSON.stringify(updates.divisions) : null, updates.partNos ? JSON.stringify(updates.partNos) : null, updates.workTypes ? JSON.stringify(updates.workTypes) : null, safe(updates.status), safe(updates.remarks), safe(updates.holdStartTime), safeInt(updates.totalHoldDuration), safeInt(id)); 
    return { success: true }; 
  },
  
  getGroupAssignments: () => stmts.getGroupAssignments.all().map(a => ({ ...a, workTypes: JSON.parse(a.workTypes || '[]'), divisions: JSON.parse(a.divisions || '[]'), partNos: JSON.parse(a.partNos || '[]') })),
  insertGroupAssignment: (projectId, teamId, workTypes, divisions, partNos, fileSize, assignedTime, eta, status, remarks) => {
    const result = stmts.insertGroupAssignment.run(safeInt(projectId), safeInt(teamId), JSON.stringify(workTypes || []), JSON.stringify(divisions || []), JSON.stringify(partNos || []), fileSize, assignedTime, eta, status, remarks);
    return { id: result.lastInsertRowid, projectId, teamId, status: 'PENDING' };
  },
  updateGroupAssignment: (id, updates) => {
    if (updates.status === 'COMPLETED' && updates.rating) {
       const ga = db.prepare('SELECT * FROM groupAssignments WHERE id = ?').get(id);
       module.exports.applyScore(true, ga.teamId, ga.eta, new Date().toISOString(), updates.rating, updates.overrideBlackmark);
       updates.completionTime = new Date().toISOString();
    }
    stmts.updateGroupAssignment.run(safeInt(updates.projectId), safeInt(updates.teamId), updates.workTypes ? JSON.stringify(updates.workTypes) : null, updates.divisions ? JSON.stringify(updates.divisions) : null, updates.partNos ? JSON.stringify(updates.partNos) : null, safe(updates.fileSize), safe(updates.assignedTime), safe(updates.eta), safe(updates.status), safe(updates.remarks), safe(updates.completionTime), safeInt(updates.rating), safe(updates.rejectionReason), safeInt(id));
    return { success: true };
  },

  getMemberAssignments: () => stmts.getMemberAssignments.all().map(a => ({ ...a, workTypes: JSON.parse(a.workTypes || '[]'), divisions: JSON.parse(a.divisions || '[]'), partNos: JSON.parse(a.partNos || '[]') })),
  insertMemberAssignment: (groupAssignmentId, memberId, workTypes, divisions, partNos, assignedTime, eta, completionTime, status, remarks, reworkFromId, bonusAwarded, blackmarksAwarded) => {
    const result = stmts.insertMemberAssignment.run(safeInt(groupAssignmentId), safeInt(memberId), JSON.stringify(workTypes || []), JSON.stringify(divisions || []), JSON.stringify(partNos || []), assignedTime, eta, completionTime, status, remarks, safeInt(reworkFromId), bonusAwarded, blackmarksAwarded);
    return { id: result.lastInsertRowid };
  },
  updateMemberAssignment: (id, updates) => {
    if (updates.status === 'COMPLETED' && updates.rating) {
       const ma = db.prepare('SELECT * FROM memberAssignments WHERE id = ?').get(id);
       const { bonus, blackmark } = module.exports.applyScore(false, ma.memberId, ma.eta, ma.completionTime, updates.rating, updates.overrideBlackmark);
       updates.bonusAwarded = bonus;
       updates.blackmarksAwarded = blackmark;
    }
    stmts.updateMemberAssignment.run(safeInt(updates.groupAssignmentId), safeInt(updates.memberId), updates.workTypes ? JSON.stringify(updates.workTypes) : null, updates.divisions ? JSON.stringify(updates.divisions) : null, updates.partNos ? JSON.stringify(updates.partNos) : null, safe(updates.assignedTime), safe(updates.eta), safe(updates.completionTime), safe(updates.status), safe(updates.remarks), safeInt(updates.reworkFromId), safe(updates.bonusAwarded), safe(updates.blackmarksAwarded), safeInt(updates.rating), safe(updates.rejectionReason), safeInt(id));
    return { success: true };
  },

  deleteProject: (id) => { const safeId = safeInt(id); db.prepare('DELETE FROM memberAssignments WHERE groupAssignmentId IN (SELECT id FROM groupAssignments WHERE projectId = ?)').run(safeId); db.prepare('DELETE FROM groupAssignments WHERE projectId = ?').run(safeId); db.prepare('DELETE FROM projects WHERE id = ?').run(safeId); return { success: true }; },
  deleteGroupAssignment: (id) => { const safeId = safeInt(id); db.prepare('DELETE FROM memberAssignments WHERE groupAssignmentId = ?').run(safeId); db.prepare('DELETE FROM groupAssignments WHERE id = ?').run(safeId); return { success: true }; },
  deleteMemberAssignment: (id) => { const safeId = safeInt(id); db.prepare('DELETE FROM memberAssignments WHERE id = ?').run(safeId); return { success: true }; },
  getWorkTypes: () => stmts.getWorkTypes.all().map(wt => wt.name),
  addWorkType: (name) => { try { stmts.insertWorkType.run(name); return { success: true, name }; } catch (err) { return { success: false, error: 'Already exists' }; } },
  removeWorkType: (name) => { stmts.deleteWorkType.run(name); return { success: true }; },

  toggleHold: (projectId, isHold) => {
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    if (isHold) { stmts.updateProject.run(p.name, p.date, p.divisions, p.partNos, p.workTypes, 'ON_HOLD', p.remarks, new Date().toISOString(), p.totalHoldDuration, projectId); } 
    else {
       const diffMins = p.holdStartTime ? Math.floor((new Date() - new Date(p.holdStartTime)) / 60000) : 0;
       const newTotal = (p.totalHoldDuration || 0) + diffMins;
       stmts.updateProject.run(p.name, p.date, p.divisions, p.partNos, p.workTypes, 'ACTIVE', p.remarks, null, newTotal, projectId);
       if (diffMins > 0) {
          stmts.extendProjectEta.run(diffMins, projectId);
          stmts.extendMemberEta.run(diffMins, projectId);
       }
    }
  },

  triggerRework: (projectId, teamId, divisions, partNos, workTypes, assignedTime, eta, fileSize) => {
     const culprits = stmts.findReworkCulprits.all(projectId, JSON.stringify(divisions), JSON.stringify(partNos));
     culprits.forEach(c => { stmts.updateUserScore.run(0, SCORES.BM_REWORK, c.memberId); });
     const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
     const resProj = stmts.insertProject.run(p.name + " R", new Date().toISOString().split('T')[0], JSON.stringify(divisions), JSON.stringify(partNos), JSON.stringify(workTypes), 'ACTIVE', 'REWORK Generated');
     const resAssign = stmts.insertGroupAssignment.run(resProj.lastInsertRowid, teamId, JSON.stringify(workTypes), JSON.stringify(divisions), JSON.stringify(partNos), fileSize, assignedTime, eta, 'PENDING', 'REWORK ORDER', 0);
     return { success: true, newProjectId: resProj.lastInsertRowid, assignmentId: resAssign.lastInsertRowid };
  },

  applyScore: (isTeam, id, eta, completedAt, rating, overrideBlackmark) => {
    let bonus = 0; let blackmark = 0;
    const delayHrs = (new Date(completedAt) - new Date(eta)) / 36e5;
    if (delayHrs <= 0) bonus += SCORES.BONUS_ON_TIME;
    if (SCORES.BONUS_STARS[rating]) bonus += SCORES.BONUS_STARS[rating];
    // Blackmark logic for delay
    if (delayHrs > 1 && !overrideBlackmark) { blackmark += Math.floor(delayHrs) * SCORES.BM_DELAY_PER_HR; }
    if (isTeam) stmts.updateTeamScore.run(bonus, blackmark, id);
    else stmts.updateUserScore.run(bonus, blackmark, id);
    return { bonus, blackmark };
  },

  revokeGroupWork: (id) => { db.prepare("UPDATE groupAssignments SET status = 'IN_PROGRESS', completionTime = NULL WHERE id = ?").run(id); return { success: true }; },
  revokeGroupRejection: (id) => { db.prepare("UPDATE groupAssignments SET status = 'IN_PROGRESS', rejectionReason = NULL WHERE id = ?").run(id); return { success: true }; },
  revokeMemberWork: (id) => { db.prepare("UPDATE memberAssignments SET status = 'IN_PROGRESS', completionTime = NULL WHERE id = ?").run(id); return { success: true }; },
  revokeMemberRejection: (id) => { db.prepare("UPDATE memberAssignments SET status = 'IN_PROGRESS', rejectionReason = NULL WHERE id = ?").run(id); return { success: true }; },

  getStats: (role, userId) => {
      const stats = {};
      
      // --- PROJECT MANAGER / ADMIN STATS ---
      if (role === 'PROJECT_MANAGER' || role === 'ADMIN') {
          stats.activeProjects = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'ACTIVE'").get().c;
          stats.completedLastWeek = db.prepare("SELECT COUNT(*) as c FROM projects WHERE status = 'COMPLETED' AND date >= date('now', '-7 days')").get().c;
          
          // 1. Top Teams (Net Score = Bonus - Blackmarks)
          stats.topTeams = db.prepare("SELECT name, (bonusPoints - blackmarks) as netScore, bonusPoints, blackmarks FROM teams ORDER BY netScore DESC LIMIT 5").all();

          // 2. Team Productivity (Work / Manpower)
          const productivityRaw = db.prepare(`SELECT t.name, (SELECT COUNT(*) FROM groupAssignments ga WHERE ga.teamId = t.id AND ga.status = 'COMPLETED') as completedWork, (SELECT COUNT(*) FROM users u WHERE u.teamId = t.id AND u.roles LIKE '%MEMBER%') as manpower FROM teams t`).all();
          stats.teamProductivity = productivityRaw.map(t => ({ name: t.name, value: t.manpower > 0 ? parseFloat((t.completedWork / t.manpower).toFixed(2)) : 0, details: `${t.completedWork} tasks / ${t.manpower} staff` })).sort((a,b) => b.value - a.value);

          // 3. Avg Time per Project (Team Basis)
          stats.teamAvgTime = db.prepare(`SELECT t.name, AVG((julianday(ga.completionTime) - julianday(ga.assignedTime)) * 24) as avgHours FROM groupAssignments ga JOIN teams t ON ga.teamId = t.id WHERE ga.status = 'COMPLETED' GROUP BY t.id ORDER BY avgHours ASC`).all().map(r => ({ name: r.name, value: r.avgHours ? parseFloat(r.avgHours.toFixed(1)) : 0 }));
      } 
      
      // --- TEAM LEAD STATS ---
      else if (role === 'TEAM_LEAD') {
          const user = db.prepare("SELECT teamId FROM users WHERE id = ?").get(userId);
          const teamId = user ? user.teamId : null;
          if (teamId) {
              stats.activeProjects = db.prepare("SELECT COUNT(DISTINCT projectId) as c FROM groupAssignments WHERE teamId = ? AND status != 'COMPLETED'").get(teamId).c;
              
              // 1. Top Members (Net Score)
              stats.topMembers = db.prepare("SELECT name, (bonusPoints - blackmarks) as netScore, bonusPoints, blackmarks FROM users WHERE teamId = ? AND roles LIKE '%MEMBER%' ORDER BY netScore DESC LIMIT 5").all(teamId);

              // 2. Member Productivity
              stats.memberProductivity = db.prepare("SELECT u.name, (SELECT COUNT(*) FROM memberAssignments ma WHERE ma.memberId = u.id AND ma.status = 'COMPLETED') as completed FROM users u WHERE u.teamId = ? AND u.roles LIKE '%MEMBER%' ORDER BY completed DESC").all(teamId);

              // 3. Avg Member Time
              stats.memberAvgTime = db.prepare(`SELECT u.name, AVG((julianday(ma.completionTime) - julianday(ma.assignedTime)) * 24) as avgHours FROM memberAssignments ma JOIN users u ON ma.memberId = u.id WHERE u.teamId = ? AND ma.status = 'COMPLETED' GROUP BY u.id ORDER BY avgHours ASC`).all(teamId).map(r => ({ name: r.name, value: r.avgHours ? parseFloat(r.avgHours.toFixed(1)) : 0 }));
          }
      } 
      
      // --- MEMBER STATS ---
      else if (role === 'MEMBER') {
          stats.pendingTasks = db.prepare("SELECT COUNT(*) as c FROM memberAssignments WHERE memberId = ? AND status != 'COMPLETED'").get(userId).c;
          stats.scoreData = db.prepare("SELECT bonusPoints, blackmarks FROM users WHERE id = ?").get(userId) || { bonusPoints: 0, blackmarks: 0 };
          stats.completedLastWeek = db.prepare("SELECT COUNT(*) as c FROM memberAssignments WHERE memberId = ? AND status = 'COMPLETED' AND completionTime >= date('now', '-7 days')").get(userId).c;
      }
      return stats;
  },

  getReport: (role, userId, startDate, endDate, specificTeamId, specificMemberId) => {
      let sql = `SELECT p.name as projectName, t.name as teamName, u.name as memberName, ma.* FROM memberAssignments ma JOIN groupAssignments ga ON ma.groupAssignmentId = ga.id JOIN projects p ON ga.projectId = p.id JOIN teams t ON ga.teamId = t.id JOIN users u ON ma.memberId = u.id WHERE ma.assignedTime BETWEEN ? AND ? `;
      const params = [startDate, endDate];
      if (role === 'TEAM_LEAD') {
          const user = db.prepare("SELECT teamId FROM users WHERE id = ?").get(userId);
          if(user && user.teamId) { sql += ` AND ga.teamId = ?`; params.push(user.teamId); }
      } else if (role === 'MEMBER') {
          sql += ` AND ma.memberId = ?`; params.push(userId);
      } else {
          if (specificTeamId) { sql += ` AND ga.teamId = ?`; params.push(specificTeamId); }
      }
      if (specificMemberId) { sql += ` AND ma.memberId = ?`; params.push(specificMemberId); }
      sql += ` ORDER BY ma.assignedTime DESC`;
      return db.prepare(sql).all(...params).map(r => ({ ...r, workTypes: JSON.parse(r.workTypes||'[]'), divisions: JSON.parse(r.divisions||'[]'), partNos: JSON.parse(r.partNos||'[]') }));
  }
};