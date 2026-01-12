const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('database.db');

// 1. SCHEMA DEFINITION
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
    scope TEXT,
    fileSize TEXT,
    assignedTime TEXT,
    eta TEXT,
    rating INTEGER DEFAULT 0,
    status TEXT, 
    remarks TEXT,
    completionTime TEXT,
    rejectionReason TEXT,
    screenshot TEXT
  );

  CREATE TABLE IF NOT EXISTS memberAssignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupAssignmentId INTEGER,
    memberId INTEGER,
    scope TEXT,
    assignedTime TEXT,
    eta TEXT,
    completionTime TEXT,
    rating INTEGER DEFAULT 0,
    status TEXT,
    remarks TEXT,
    reworkFromId INTEGER,
    bonusAwarded REAL DEFAULT 0,
    blackmarksAwarded REAL DEFAULT 0,
    rejectionReason TEXT,
    screenshot TEXT
  );

  CREATE TABLE IF NOT EXISTS work_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value REAL
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER,
    message TEXT,
    isRead INTEGER DEFAULT 0,
    createdAt TEXT
  );

  -- UPDATED: Added fileName to store original name of uploaded files
  CREATE TABLE IF NOT EXISTS chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senderId INTEGER,
    senderName TEXT,
    senderRole TEXT,
    message TEXT,
    channel TEXT, 
    isImage INTEGER DEFAULT 0,
    fileName TEXT, 
    createdAt TEXT
  );

  -- UPDATED: Added fileName
  CREATE TABLE IF NOT EXISTS forum_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    authorId INTEGER,
    authorName TEXT,
    title TEXT,
    content TEXT,
    isImage INTEGER DEFAULT 0,
    fileName TEXT,
    createdAt TEXT
  );

  -- UPDATED: Added fileName
  CREATE TABLE IF NOT EXISTS forum_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    threadId INTEGER,
    authorId INTEGER,
    authorName TEXT,
    content TEXT,
    isImage INTEGER DEFAULT 0,
    fileName TEXT,
    createdAt TEXT
  );
`);

// 2. SEED ADMIN & CONFIG
const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!admin) {
  const hash = bcrypt.hashSync('password', 10);
  db.prepare('INSERT INTO users (name, username, password, roles, isApproved) VALUES (?, ?, ?, ?, ?)').run('Global Admin', 'admin', hash, JSON.stringify(['ADMIN']), 1);
}

const defaults = {
  'BONUS_ON_TIME': 3,
  'BONUS_STAR_3': 1,
  'BONUS_STAR_4': 2,
  'BONUS_STAR_5': 3,
  'BM_DELAY_PER_HR': 1,
  'BM_REWORK': 5,
  'ALLOW_TIME_EDIT': 0,
  'ALLOW_SIGNUP': 1
};
const insertConfig = db.prepare('INSERT OR IGNORE INTO system_config (key, value) VALUES (?, ?)');
Object.entries(defaults).forEach(([k, v]) => insertConfig.run(k, v));

// 3. HELPERS
const safe = (val) => val == null ? null : (typeof val === 'boolean' ? (val ? 1 : 0) : val);
const safeInt = (val) => (val === null || val === undefined || val === '') ? null : parseInt(val, 10);
const getConfigMap = () => {
  const rows = db.prepare('SELECT * FROM system_config').all();
  return rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
};
const notify = (userId, message) => {
    if(!userId) return;
    db.prepare('INSERT INTO notifications (userId, message, createdAt) VALUES (?, ?, ?)').run(userId, message, new Date().toISOString());
};
const notifyTeam = (teamId, message, roleFilter) => {
    let sql = 'SELECT id FROM users WHERE teamId = ?';
    if(roleFilter) sql += ` AND roles LIKE '%${roleFilter}%'`;
    const users = db.prepare(sql).all(teamId);
    users.forEach(u => notify(u.id, message));
};

// Check if two scopes overlap (for rework detection)
const checkScopeOverlap = (assignmentScope, reworkScope) => {
    try {
        const aScope = typeof assignmentScope === 'string' ? JSON.parse(assignmentScope) : assignmentScope;
        const rScope = typeof reworkScope === 'string' ? JSON.parse(reworkScope) : reworkScope;
        
        for (const rItem of rScope) {
            const aItem = aScope.find(i => i.division === rItem.division);
            if (aItem) {
                for (const rPart of rItem.parts) {
                    if (aItem.parts.some(p => p.name === rPart.name)) {
                        return true; 
                    }
                }
            }
        }
        return false;
    } catch (e) { return false; }
};

// 4. PREPARED STATEMENTS
const stmts = {
  login: db.prepare('SELECT * FROM users WHERE username = ? AND isApproved = 1'),
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
  insertGroupAssignment: db.prepare('INSERT INTO groupAssignments (projectId, teamId, scope, fileSize, assignedTime, eta, status, remarks, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)'),
  updateGroupAssignment: db.prepare('UPDATE groupAssignments SET projectId = COALESCE(?, projectId), teamId = COALESCE(?, teamId), scope = COALESCE(?, scope), fileSize = COALESCE(?, fileSize), assignedTime = COALESCE(?, assignedTime), eta = COALESCE(?, eta), status = COALESCE(?, status), remarks = COALESCE(?, remarks), completionTime = COALESCE(?, completionTime), rating = COALESCE(?, rating), rejectionReason = COALESCE(?, rejectionReason) WHERE id = ?'),

  getMemberAssignments: db.prepare('SELECT * FROM memberAssignments'),
  getMemberAssignmentsByProject: db.prepare('SELECT ma.* FROM memberAssignments ma JOIN groupAssignments ga ON ma.groupAssignmentId = ga.id WHERE ga.projectId = ?'),
  
  insertMemberAssignment: db.prepare('INSERT INTO memberAssignments (groupAssignmentId, memberId, scope, assignedTime, eta, completionTime, status, remarks, reworkFromId, bonusAwarded, blackmarksAwarded, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'),
  updateMemberAssignment: db.prepare('UPDATE memberAssignments SET groupAssignmentId = COALESCE(?, groupAssignmentId), memberId = COALESCE(?, memberId), scope = COALESCE(?, scope), assignedTime = COALESCE(?, assignedTime), eta = COALESCE(?, eta), completionTime = COALESCE(?, completionTime), status = COALESCE(?, status), remarks = COALESCE(?, remarks), reworkFromId = COALESCE(?, reworkFromId), bonusAwarded = COALESCE(?, bonusAwarded), blackmarksAwarded = COALESCE(?, blackmarksAwarded), rating = COALESCE(?, rating), rejectionReason = COALESCE(?, rejectionReason), screenshot = COALESCE(?, screenshot) WHERE id = ?'),
  
  getWorkTypes: db.prepare('SELECT name FROM work_types'),
  insertWorkType: db.prepare('INSERT INTO work_types (name) VALUES (?)'),
  deleteWorkType: db.prepare('DELETE FROM work_types WHERE name = ?'),

  updateUserScore: db.prepare('UPDATE users SET bonusPoints = bonusPoints + ?, blackmarks = blackmarks + ? WHERE id = ?'),
  updateTeamScore: db.prepare('UPDATE teams SET bonusPoints = bonusPoints + ?, blackmarks = blackmarks + ? WHERE id = ?'),
  
  extendProjectEta: db.prepare("UPDATE groupAssignments SET eta = datetime(eta, '+' || ? || ' minutes') WHERE projectId = ? AND status != 'COMPLETED'"),
  extendMemberEta: db.prepare("UPDATE memberAssignments SET eta = datetime(eta, '+' || ? || ' minutes') WHERE groupAssignmentId IN (SELECT id FROM groupAssignments WHERE projectId = ?) AND status != 'COMPLETED'"),
  
  updateConfig: db.prepare('UPDATE system_config SET value = ? WHERE key = ?'),
  getNotifications: db.prepare('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC LIMIT 50'),
  markRead: db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?'),
  clearNotifications: db.prepare('DELETE FROM notifications WHERE userId = ?'),
  
  // --- UPDATED STATEMENTS (Added fileName) ---
  getMessages: db.prepare('SELECT * FROM chat_messages ORDER BY createdAt DESC LIMIT 100'),
  insertMessage: db.prepare('INSERT INTO chat_messages (senderId, senderName, senderRole, message, channel, isImage, fileName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  
  getThreads: db.prepare('SELECT * FROM forum_threads ORDER BY createdAt DESC'),
  insertThread: db.prepare('INSERT INTO forum_threads (authorId, authorName, title, content, isImage, fileName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  
  getComments: db.prepare('SELECT * FROM forum_comments WHERE threadId = ? ORDER BY createdAt ASC'),
  insertComment: db.prepare('INSERT INTO forum_comments (threadId, authorId, authorName, content, isImage, fileName, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
};

module.exports = {
  login: (username, password) => { 
      const user = stmts.login.get(username); 
      if (user && bcrypt.compareSync(password, user.password)) {
          user.roles = JSON.parse(user.roles);
          delete user.password; 
          return user; 
      }
      return null;
  },
  getUsers: () => stmts.getUsers.all().map(u => ({ ...u, roles: JSON.parse(u.roles || '[]'), password: '' })),
  
  insertUser: (name, username, password, email, roles) => { 
      const hash = bcrypt.hashSync(password, 10);
      const result = stmts.insertUser.run(name, username, hash, email, JSON.stringify(roles)); 
      return { id: result.lastInsertRowid, name, username, email, roles }; 
  },
  
  updateUser: (id, updates) => { 
      let pwd = updates.password;
      if (pwd && !pwd.startsWith('$2a$')) { pwd = bcrypt.hashSync(pwd, 10); } else { pwd = undefined; }
      stmts.updateUser.run(safe(updates.name), safe(updates.username), pwd, safe(updates.email), safe(updates.avatar), updates.roles ? JSON.stringify(updates.roles) : null, safe(updates.isApproved), safe(updates.blackmarks), safe(updates.bonusPoints), safeInt(updates.teamId), safeInt(id)); 
      return { success: true }; 
  },
  deleteUser: (id) => { stmts.deleteUser.run(id); return { success: true }; },
  
  getTeams: () => stmts.getTeams.all().map(t => ({ ...t, leadIds: JSON.parse(t.leadIds || '[]').map(id => parseInt(id)) })),
  insertTeam: (name, leadIds) => { const result = stmts.insertTeam.run(name, JSON.stringify(leadIds || [])); return { id: result.lastInsertRowid, name, leadIds }; },
  
  getProjects: () => stmts.getProjects.all().map(p => ({ 
    ...p, 
    divisions: JSON.parse(p.divisions || '[]'), 
    partNos: JSON.parse(p.partNos || '[]'), 
    workTypes: JSON.parse(p.workTypes || '[]') 
  })),
  insertProject: (name, date, divisions, partNos, workTypes, status, remarks) => { 
      const result = stmts.insertProject.run(
          name, 
          date, 
          JSON.stringify(divisions || []), 
          JSON.stringify(partNos || []), 
          JSON.stringify(workTypes || []), 
          status, 
          remarks
      ); 
      return { id: result.lastInsertRowid, name, date, divisions, partNos, workTypes, status, remarks }; 
  },
  updateProject: (id, updates) => { 
    stmts.updateProject.run(
        safe(updates.name), 
        safe(updates.date), 
        updates.divisions ? JSON.stringify(updates.divisions) : null, 
        updates.partNos ? JSON.stringify(updates.partNos) : null, 
        updates.workTypes ? JSON.stringify(updates.workTypes) : null, 
        safe(updates.status), 
        safe(updates.remarks), 
        safe(updates.holdStartTime), 
        safeInt(updates.totalHoldDuration), 
        safeInt(id)
    ); 
    return { success: true }; 
  },
  
  getGroupAssignments: () => stmts.getGroupAssignments.all().map(a => ({ ...a, scope: JSON.parse(a.scope || '[]') })),
  insertGroupAssignment: (projectId, teamId, scope, fileSize, assignedTime, eta, status, remarks) => {
    const result = stmts.insertGroupAssignment.run(safeInt(projectId), safeInt(teamId), JSON.stringify(scope || []), fileSize, assignedTime, eta, status, remarks);
    notifyTeam(teamId, `New Project Allocated: Check Group Assignments`, 'TEAM_LEAD');
    return { id: result.lastInsertRowid, projectId, teamId, status: 'PENDING' };
  },
  updateGroupAssignment: (id, updates) => {
    const ga = db.prepare(`
        SELECT ga.*, p.name as projName, t.name as teamName 
        FROM groupAssignments ga 
        JOIN projects p ON ga.projectId = p.id 
        JOIN teams t ON ga.teamId = t.id 
        WHERE ga.id = ?
    `).get(id);

    if (updates.status === 'COMPLETED' && updates.rating) {
       module.exports.applyScore(true, ga.teamId, ga.eta, new Date().toISOString(), updates.rating, updates.overrideBlackmark);
       updates.completionTime = new Date().toISOString();
       const pms = db.prepare("SELECT id FROM users WHERE roles LIKE '%PROJECT_MANAGER%' OR roles LIKE '%ADMIN%'").all();
       pms.forEach(u => notify(u.id, `Team '${ga.teamName}' completed Project '${ga.projName}'.`));
    } 
    else if (updates.status === 'PENDING_ACK') {
        const pms = db.prepare("SELECT id FROM users WHERE roles LIKE '%PROJECT_MANAGER%' OR roles LIKE '%ADMIN%'").all();
        pms.forEach(u => notify(u.id, `Team '${ga.teamName}' Submitted Work for Project: ${ga.projName}. Please Review.`));
    }
    else if (updates.status === 'REJECTION_REQ') {
        const pms = db.prepare("SELECT id FROM users WHERE roles LIKE '%PROJECT_MANAGER%' OR roles LIKE '%ADMIN%'").all();
        pms.forEach(u => notify(u.id, `Rejection Req: Team '${ga.teamName}' for Project '${ga.projName}'. Reason: ${updates.rejectionReason}`));
    }
    else if (updates.status === 'REJECTED') {
        notifyTeam(ga.teamId, `Project '${ga.projName}' was REJECTED by PM. Reason: ${updates.rejectionReason}`, 'TEAM_LEAD');
    }

    stmts.updateGroupAssignment.run(safeInt(updates.projectId), safeInt(updates.teamId), updates.scope ? JSON.stringify(updates.scope) : null, safe(updates.fileSize), safe(updates.assignedTime), safe(updates.eta), safe(updates.status), safe(updates.remarks), safe(updates.completionTime), safeInt(updates.rating), safe(updates.rejectionReason), safeInt(id));
    return { success: true };
  },

  getMemberAssignments: () => stmts.getMemberAssignments.all().map(a => ({ ...a, scope: JSON.parse(a.scope || '[]') })),
  insertMemberAssignment: (groupAssignmentId, memberId, scope, assignedTime, eta, completionTime, status, remarks, reworkFromId, bonusAwarded, blackmarksAwarded) => {
    const result = stmts.insertMemberAssignment.run(safeInt(groupAssignmentId), safeInt(memberId), JSON.stringify(scope || []), assignedTime, eta, completionTime, status, remarks, safeInt(reworkFromId), bonusAwarded, blackmarksAwarded);
    notify(memberId, `You have a new task assignment.`);
    return { id: result.lastInsertRowid };
  },
  updateMemberAssignment: (id, updates) => {
    const ma = db.prepare('SELECT ma.*, u.name as memberName, ga.teamId FROM memberAssignments ma JOIN users u ON ma.memberId = u.id JOIN groupAssignments ga ON ma.groupAssignmentId = ga.id WHERE ma.id = ?').get(id);

    if (updates.status === 'COMPLETED' && updates.rating) {
       const { bonus, blackmark } = module.exports.applyScore(false, ma.memberId, ma.eta, ma.completionTime, updates.rating, updates.overrideBlackmark);
       updates.bonusAwarded = bonus;
       updates.blackmarksAwarded = blackmark;
       notify(ma.memberId, `Work Accepted! Rating: ${updates.rating}/5. Points: +${bonus}, BM: ${blackmark}`);
    } 
    else if (updates.status === 'PENDING_ACK') {
        notifyTeam(ma.teamId, `Member '${ma.memberName}' submitted work. Please review.`, 'TEAM_LEAD');
    }
    else if (updates.status === 'REJECTION_REQ') {
        notifyTeam(ma.teamId, `Rejection Req: Member '${ma.memberName}'. Reason: ${updates.rejectionReason}`, 'TEAM_LEAD');
    }
    else if (updates.status === 'REJECTED') {
        notify(ma.memberId, `Your work was REJECTED by Team Lead. Reason: ${updates.rejectionReason}`);
    }

    stmts.updateMemberAssignment.run(safeInt(updates.groupAssignmentId), safeInt(updates.memberId), updates.scope ? JSON.stringify(updates.scope) : null, safe(updates.assignedTime), safe(updates.eta), safe(updates.completionTime), safe(updates.status), safe(updates.remarks), safeInt(updates.reworkFromId), safe(updates.bonusAwarded), safe(updates.blackmarksAwarded), safeInt(updates.rating), safe(updates.rejectionReason), safe(updates.screenshot), safeInt(id));
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
    if (isHold) { stmts.updateProject.run(p.name, p.date, p.scope, 'ON_HOLD', p.remarks, new Date().toISOString(), p.totalHoldDuration, projectId); } 
    else {
       const diffMins = p.holdStartTime ? Math.floor((new Date() - new Date(p.holdStartTime)) / 60000) : 0;
       const newTotal = (p.totalHoldDuration || 0) + diffMins;
       stmts.updateProject.run(p.name, p.date, p.scope, 'ACTIVE', p.remarks, null, newTotal, projectId);
       if (diffMins > 0) {
          stmts.extendProjectEta.run(diffMins, projectId);
          stmts.extendMemberEta.run(diffMins, projectId);
       }
    }
  },

  triggerRework: (projectId, teamId, scope, assignedTime, eta, fileSize) => {
     const config = getConfigMap();
     
     const candidates = stmts.getMemberAssignmentsByProject.all(projectId);
     const culprits = candidates.filter(ma => checkScopeOverlap(ma.scope, scope));
     
     culprits.forEach(c => { 
         stmts.updateUserScore.run(0, config.BM_REWORK || 5, c.memberId);
         notify(c.memberId, `REWORK generated. You received ${config.BM_REWORK} Blackmarks.`);
     });
     
     const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
     const resProj = stmts.insertProject.run(p.name + " R", new Date().toISOString().split('T')[0], JSON.stringify(scope), 'ACTIVE', 'REWORK Generated');
     const resAssign = stmts.insertGroupAssignment.run(resProj.lastInsertRowid, teamId, JSON.stringify(scope), fileSize, assignedTime, eta, 'PENDING', 'REWORK ORDER', 0);
     return { success: true, newProjectId: resProj.lastInsertRowid, assignmentId: resAssign.lastInsertRowid };
  },

  applyScore: (isTeam, id, eta, completedAt, rating, overrideBlackmark) => {
    const config = getConfigMap();
    let bonus = 0; let blackmark = 0;
    const delayHrs = (new Date(completedAt) - new Date(eta)) / 36e5;
    if (delayHrs <= 0) bonus += (config.BONUS_ON_TIME || 3);
    if (rating === 3) bonus += (config.BONUS_STAR_3 || 1);
    else if (rating === 4) bonus += (config.BONUS_STAR_4 || 2);
    else if (rating === 5) bonus += (config.BONUS_STAR_5 || 3);
    if (delayHrs > 1 && !overrideBlackmark) { blackmark += Math.floor(delayHrs) * (config.BM_DELAY_PER_HR || 1); }
    if (isTeam) stmts.updateTeamScore.run(bonus, blackmark, id);
    else stmts.updateUserScore.run(bonus, blackmark, id);
    return { bonus, blackmark };
  },

  getConfig: () => getConfigMap(),

  getPublicConfig: () => {
      const conf = getConfigMap();
      return { ALLOW_SIGNUP: conf.ALLOW_SIGNUP !== undefined ? conf.ALLOW_SIGNUP : 1 };
  },
  
  updateConfig: (updates) => {
    const tx = db.transaction((data) => {
       Object.entries(data).forEach(([k, v]) => stmts.updateConfig.run(v, k));
    });
    tx(updates);
    return { success: true };
  },

  revokeGroupWork: (id) => { db.prepare("UPDATE groupAssignments SET status = 'IN_PROGRESS', completionTime = NULL WHERE id = ?").run(id); return { success: true }; },
  revokeGroupRejection: (id) => { db.prepare("UPDATE groupAssignments SET status = 'IN_PROGRESS', rejectionReason = NULL WHERE id = ?").run(id); return { success: true }; },
  revokeMemberWork: (id) => { db.prepare("UPDATE memberAssignments SET status = 'IN_PROGRESS', completionTime = NULL WHERE id = ?").run(id); return { success: true }; },
  revokeMemberRejection: (id) => { db.prepare("UPDATE memberAssignments SET status = 'IN_PROGRESS', rejectionReason = NULL WHERE id = ?").run(id); return { success: true }; },

  // FIND module.exports.getStats AND REPLACE WITH THIS:

  getStats: (roles, userId) => { 
      const now = new Date();
      const lastWeekDate = new Date(now.setDate(now.getDate() - 7)).toISOString();
      const result = {};

      const userRoles = Array.isArray(roles) ? roles : [roles];

      // --- 1. ADMIN & PROJECT MANAGER STATS ---
      if (userRoles.includes('ADMIN') || userRoles.includes('PROJECT_MANAGER')) {
          result.pmActiveProjects = db.prepare("SELECT COUNT(*) as count FROM projects WHERE status = 'ACTIVE'").get().count;
          result.pmCompletedLastWeek = db.prepare("SELECT COUNT(*) as count FROM groupAssignments WHERE status = 'COMPLETED' AND completionTime > ?").get(lastWeekDate).count;
          result.topTeams = db.prepare("SELECT name, bonusPoints, blackmarks, (bonusPoints - blackmarks) as netScore FROM teams ORDER BY netScore DESC LIMIT 5").all();
          
          const teams = db.prepare("SELECT id, name FROM teams").all();
          result.teamProductivity = teams.map(t => {
              const total = db.prepare("SELECT COUNT(*) as count FROM groupAssignments WHERE teamId = ?").get(t.id).count;
              const done = db.prepare("SELECT COUNT(*) as count FROM groupAssignments WHERE teamId = ? AND status = 'COMPLETED'").get(t.id).count;
              return { name: t.name, value: total > 0 ? parseFloat((done / total).toFixed(2)) : 0, details: `${done}/${total} Projects` };
          });

          result.teamAvgTime = teams.map(t => {
              const completed = db.prepare("SELECT assignedTime, completionTime FROM groupAssignments WHERE teamId = ? AND status = 'COMPLETED'").all(t.id);
              let totalHours = 0;
              if (completed.length > 0) completed.forEach(c => totalHours += (new Date(c.completionTime) - new Date(c.assignedTime)) / 36e5);
              return { name: t.name, value: completed.length > 0 ? parseFloat((totalHours / completed.length).toFixed(1)) : 0 };
          });
      }

      // --- 2. TEAM LEAD STATS ---
      if (userRoles.includes('TEAM_LEAD')) {
          const user = db.prepare("SELECT teamId FROM users WHERE id = ?").get(userId);
          if (user && user.teamId) {
              result.tlActiveProjects = db.prepare("SELECT COUNT(*) as count FROM groupAssignments WHERE teamId = ? AND status != 'COMPLETED' AND status != 'REJECTED'").get(user.teamId).count;
              result.topMembers = db.prepare("SELECT name, bonusPoints, blackmarks, (bonusPoints - blackmarks) as netScore FROM users WHERE teamId = ? ORDER BY netScore DESC LIMIT 5").all(user.teamId);

              const members = db.prepare("SELECT id, name FROM users WHERE teamId = ?").all(user.teamId);
              result.memberProductivity = members.map(m => ({ 
                  name: m.name, 
                  completed: db.prepare("SELECT COUNT(*) as count FROM memberAssignments WHERE memberId = ? AND status = 'COMPLETED'").get(m.id).count 
              }));

              result.memberAvgTime = members.map(m => {
                  const tasks = db.prepare("SELECT assignedTime, completionTime FROM memberAssignments WHERE memberId = ? AND status = 'COMPLETED'").all(m.id);
                  let totalHours = 0;
                  if (tasks.length > 0) tasks.forEach(t => totalHours += (new Date(t.completionTime) - new Date(t.assignedTime)) / 36e5);
                  return { name: m.name, value: tasks.length > 0 ? parseFloat((totalHours / tasks.length).toFixed(1)) : 0 };
          });
          }
      }

      // --- 3. MEMBER STATS (COMMON) ---
      result.scoreData = db.prepare("SELECT bonusPoints, blackmarks FROM users WHERE id = ?").get(userId);
      result.memberCompletedLastWeek = db.prepare("SELECT COUNT(*) as count FROM memberAssignments WHERE memberId = ? AND status = 'COMPLETED' AND completionTime > ?").get(userId, lastWeekDate).count;
      result.pendingTasks = db.prepare("SELECT COUNT(*) as count FROM memberAssignments WHERE memberId = ? AND status != 'COMPLETED' AND status != 'REJECTED'").get(userId).count;

      // --- 4. GROWTH GRAPH: DAILY (Last 7 Days) ---
      result.dailyTrend = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];
          const dayStart = dateStr + 'T00:00:00.000Z';
          const dayEnd = dateStr + 'T23:59:59.999Z';

          const tasks = db.prepare("SELECT bonusAwarded, blackmarksAwarded FROM memberAssignments WHERE memberId = ? AND status = 'COMPLETED' AND completionTime BETWEEN ? AND ?").all(userId, dayStart, dayEnd);
          
          let bonus = 0, blackmark = 0;
          tasks.forEach(t => { bonus += t.bonusAwarded || 0; blackmark += t.blackmarksAwarded || 0; });
          
          result.dailyTrend.push({ 
              name: d.toLocaleDateString('en-US', { weekday: 'short' }), // "Mon"
              bonus, blackmark, projects: tasks.length 
          });
      }

      // --- 5. GROWTH GRAPH: MONTHLY (Last 6 Months) ---
      result.monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
          const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
          const monthEnd = nextMonth.toISOString();

          const tasks = db.prepare("SELECT bonusAwarded, blackmarksAwarded FROM memberAssignments WHERE memberId = ? AND status = 'COMPLETED' AND completionTime >= ? AND completionTime < ?").all(userId, monthStart, monthEnd);
          
          let bonus = 0, blackmark = 0;
          tasks.forEach(t => { bonus += t.bonusAwarded || 0; blackmark += t.blackmarksAwarded || 0; });

          result.monthlyTrend.push({ 
              name: d.toLocaleDateString('en-US', { month: 'short' }), // "Jan"
              bonus, blackmark, projects: tasks.length 
          });
      }

      return result;
  },
  getReport: (role, userId, startDate, endDate, specificTeamId, specificMemberId) => {
      let sql = `SELECT p.name as projectName, t.name as teamName, u.name as memberName, ga.teamId, ma.* FROM memberAssignments ma JOIN groupAssignments ga ON ma.groupAssignmentId = ga.id JOIN projects p ON ga.projectId = p.id JOIN teams t ON ga.teamId = t.id JOIN users u ON ma.memberId = u.id WHERE ma.assignedTime BETWEEN ? AND ? `;
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
      return db.prepare(sql).all(...params).map(r => ({ ...r, scope: JSON.parse(r.scope||'[]') }));
  },

  getNotifications: (userId) => stmts.getNotifications.all(userId),
  markNotificationsRead: (userId) => { stmts.markRead.run(userId); return { success: true }; },
  clearNotifications: (userId) => { stmts.clearNotifications.run(userId); return { success: true }; },

  // --- UPDATED EXPORTS WITH FILE SUPPORT ---
  
  getChatMessages: () => stmts.getMessages.all().reverse(),
  
  // Updated: Accept fileName
  sendMessage: (senderId, senderName, senderRole, message, channel, isImage = false, fileName = null) => { 
      stmts.insertMessage.run(senderId, senderName, senderRole, message, channel, isImage ? 1 : 0, fileName, new Date().toISOString()); 
      return { success: true }; 
  },

  getThreads: () => {
    const threads = stmts.getThreads.all();
    return threads.map(t => ({...t, comments: stmts.getComments.all(t.id)}));
  },
  
  // Updated: Accept fileName
  createThread: (authorId, authorName, title, content, isImage = false, fileName = null) => { 
      stmts.insertThread.run(authorId, authorName, title, content, isImage ? 1 : 0, fileName, new Date().toISOString()); 
      return { success: true }; 
  },
  
  // Updated: Accept fileName
  createComment: (threadId, authorId, authorName, content, isImage = false, fileName = null) => { 
      stmts.insertComment.run(threadId, authorId, authorName, content, isImage ? 1 : 0, fileName, new Date().toISOString()); 
      return { success: true }; 
  },

  // NEW: Get a single message to check file path before delete
  getMessageById: (id) => stmts.getMessages.all().find(m => m.id === parseInt(id)), // Simple lookup
  
  // NEW: Delete message
  deleteMessage: (id) => {
      db.prepare('DELETE FROM chat_messages WHERE id = ?').run(id);
      return { success: true };
  },

  // NEW: Get thread to check file path
  getThreadById: (id) => db.prepare('SELECT * FROM forum_threads WHERE id = ?').get(id),
  
  // NEW: Delete thread and its comments
  deleteThread: (id) => {
      db.prepare('DELETE FROM forum_comments WHERE threadId = ?').run(id);
      db.prepare('DELETE FROM forum_threads WHERE id = ?').run(id);
      return { success: true };
  },

  // NEW: Get comment
  getCommentById: (id) => db.prepare('SELECT * FROM forum_comments WHERE id = ?').get(id),
  
  // NEW: Delete comment
  deleteComment: (id) => {
      db.prepare('DELETE FROM forum_comments WHERE id = ?').run(id);
      return { success: true };
  },
};