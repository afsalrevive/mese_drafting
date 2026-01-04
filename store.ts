import { useState, useEffect } from 'react';
import { User, UserRole, Project, GroupAssignment, MemberAssignment, Team, AppState, DashboardStats } from './types';

const API_BASE = 'http://localhost:3001/api';

export const useStore = () => {
  const [state, setState] = useState<AppState>({
    users: [], teams: [], projects: [], groupAssignments: [], memberAssignments: [], currentUser: null, workTypes: [], stats: null
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/me`, { headers: { Authorization: token } })
        .then(res => res.ok ? res.json().then(user => setState(prev => ({ ...prev, currentUser: user }))) : logout())
        .catch(logout);
    }
  }, [token]);

  useEffect(() => {
    if (token) { fetchTeams(); fetchProjects(); fetchGroupAssignments(); fetchMemberAssignments(); fetchWorkTypes(); fetchUsers(); fetchStats(); }
  }, [token]);

  // AUTH
  const login = async (u, p) => {
    try {
      const res = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username:u, password:p }) });
      if (res.ok) { 
          const { token, user } = await res.json(); 
          setToken(token); 
          localStorage.setItem('token', token); 
          setState(p => ({ ...p, currentUser: user })); 
          return { success: true }; 
      }
      const err = await res.json();
      return { success: false, error: err.error };
    } catch (e) { return { success: false, error: 'Network Error' }; }
  };
  const logout = () => { setToken(null); localStorage.removeItem('token'); setState(p => ({ ...p, currentUser: null })); };
  
  const signup = async (d) => {
     const res = await fetch(`${API_BASE}/users`, { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d) });
     if(res.ok) return { success: true };
     const err = await res.json();
     return { success: false, error: err.error };
  };

  // FETCHERS
  const fetchUsers = async () => { const users = await fetch(`${API_BASE}/users`).then(r=>r.json()); setState(p => ({ ...p, users })); };
  const fetchTeams = async () => { const teams = await fetch(`${API_BASE}/teams`, {headers:{Authorization:token!}}).then(r=>r.json()); setState(p => ({ ...p, teams })); };
  const fetchProjects = async () => { const projects = await fetch(`${API_BASE}/projects`, {headers:{Authorization:token!}}).then(r=>r.json()); setState(p => ({ ...p, projects })); };
  const fetchGroupAssignments = async () => { const groupAssignments = await fetch(`${API_BASE}/groupAssignments`, {headers:{Authorization:token!}}).then(r=>r.json()); setState(p => ({ ...p, groupAssignments })); };
  const fetchMemberAssignments = async () => { const memberAssignments = await fetch(`${API_BASE}/memberAssignments`, {headers:{Authorization:token!}}).then(r=>r.json()); setState(p => ({ ...p, memberAssignments })); };
  const fetchWorkTypes = async () => { const workTypes = await fetch(`${API_BASE}/workTypes`, {headers:{Authorization:token!}}).then(r=>r.json()); setState(p => ({ ...p, workTypes })); };
  
  // STATS & REPORTS
  const fetchStats = async () => { const stats = await fetch(`${API_BASE}/stats`, {headers:{Authorization:token!}}).then(r=>r.json()); setState(p => ({ ...p, stats })); };
  const generateReport = async (filter: any) => { return await fetch(`${API_BASE}/reports`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(filter) }).then(r=>r.json()); };

  // USER MANAGEMENT
  const approveUser = (id, roles) => fetch(`${API_BASE}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({roles, isApproved:true}) }).then(fetchUsers);
  const deleteUser = (id) => fetch(`${API_BASE}/users/${id}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchUsers);
  
  const updateProfile = async (id, data) => {
      const res = await fetch(`${API_BASE}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(data) });
      if (res.ok) { fetchUsers(); return { success: true }; }
      const err = await res.json();
      return { success: false, error: err.error };
  };

  const createTeam = (name) => fetch(`${API_BASE}/teams`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({name, leadIds:[]}) }).then(fetchTeams);
  const assignUserToTeam = (id, teamId) => fetch(`${API_BASE}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({teamId: teamId||null}) }).then(fetchUsers);
  const updateUser = (id, d) => fetch(`${API_BASE}/users/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(d) }).then(fetchUsers);

  // ... (Keep existing PM/TL/Member actions: createProject, assignToGroup, assignToMember etc. exactly as in previous store.ts) ...
  const createProject = async (d) => { await fetch(`${API_BASE}/projects`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({...d, status:'ACTIVE', remarks:''}) }); fetchProjects(); };
  const updateProject = (id, d) => fetch(`${API_BASE}/projects/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(d) }).then(fetchProjects);
  const deleteProject = (id) => fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchProjects);
  const toggleProjectHold = (id, isHold) => fetch(`${API_BASE}/projects/${id}/hold`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({isHold}) }).then(fetchProjects);
  const triggerRework = async (d) => { await fetch(`${API_BASE}/rework`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(d) }); fetchProjects(); fetchGroupAssignments(); };
  const assignToGroup = async (d) => { await fetch(`${API_BASE}/groupAssignments`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({...d, status:'PENDING', remarks:''}) }); fetchGroupAssignments(); };
  const updateGroupAssignment = (id, d) => fetch(`${API_BASE}/groupAssignments/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(d) }).then(fetchGroupAssignments);
  const deleteGroupAssignment = (id) => fetch(`${API_BASE}/groupAssignments/${id}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchGroupAssignments);
  const revokeGroupWork = (id) => updateGroupAssignment(id, {status: 'IN_PROGRESS', completionTime: null});
  const revokeGroupRejection = (id) => updateGroupAssignment(id, {status: 'IN_PROGRESS', rejectionReason: null});
  const assignToMember = async (d) => { await fetch(`${API_BASE}/memberAssignments`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({...d, status:'IN_PROGRESS', completionTime:null}) }); fetchMemberAssignments(); };
  const updateMemberAssignment = (id, d) => fetch(`${API_BASE}/memberAssignments/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(d) }).then(fetchMemberAssignments);
  const submitMemberWork = (id, remarks) => updateMemberAssignment(id, {status:'PENDING_ACK', completionTime: new Date().toISOString(), remarks});
  const acknowledgeMemberWork = (id, rating, overrideBlackmark) => updateMemberAssignment(id, {status:'COMPLETED', rating, overrideBlackmark});
  const revokeMemberWork = (id) => updateMemberAssignment(id, {status:'IN_PROGRESS', completionTime:null});
  const revokeMemberRejection = (id) => updateMemberAssignment(id, {status:'IN_PROGRESS', rejectionReason: null});
  const deleteMemberAssignment = (id) => fetch(`${API_BASE}/memberAssignments/${id}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchMemberAssignments);
  const addRemark = (id, isGroup, remark) => fetch(`${API_BASE}/${isGroup?'groupAssignments':'memberAssignments'}/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({remarks:remark}) }).then(isGroup?fetchGroupAssignments:fetchMemberAssignments);
  const addWorkType = (name) => fetch(`${API_BASE}/workTypes`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({name}) }).then(fetchWorkTypes);
  const removeWorkType = (name) => fetch(`${API_BASE}/workTypes/${name}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchWorkTypes);

  return { 
    state, setState, login, logout, signup, 
    approveUser, deleteUser, updateProfile, createTeam, assignUserToTeam, updateUser,
    createProject, updateProject, deleteProject, toggleProjectHold, triggerRework,
    assignToGroup, updateGroupAssignment, deleteGroupAssignment, revokeGroupWork, revokeGroupRejection,
    assignToMember, updateMemberAssignment, submitMemberWork, acknowledgeMemberWork, revokeMemberWork, revokeMemberRejection, deleteMemberAssignment,
    addRemark, addWorkType, removeWorkType, fetchStats, generateReport,
    fetchTeams, fetchProjects, fetchGroupAssignments, fetchMemberAssignments, fetchUsers
  };
};