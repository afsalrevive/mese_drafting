import { useState, useEffect } from 'react';
import { User, UserRole, Project, GroupAssignment, MemberAssignment, Team, AppState, DashboardStats } from './types';

const API_BASE = "/api";

export const useStore = () => {
  const [state, setState] = useState<AppState & { 
      config: any, 
      chatMessages: any[], 
      forumThreads: any[], 
      notifications: any[],
      availability: { teams: Record<string, string>, members: Record<string, string> }
  }>({
    users: [], teams: [], projects: [], groupAssignments: [], memberAssignments: [], 
    currentUser: null, workTypes: [], stats: null, config: {},
    chatMessages: [], forumThreads: [], notifications: [],
    availability: { teams: {}, members: {} } // <--- NEW INITIAL VALUE
  });
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));

  // --- HELPER: Fetch all data (Only called when logged in) ---
  const fetchInitialData = () => {
      fetchTeams(); fetchProjects(); fetchGroupAssignments(); 
      fetchMemberAssignments(); fetchWorkTypes(); fetchUsers(); fetchStats(); 
      fetchConfig(); fetchNotifications(); fetchChat(); fetchForum();fetchAvailability();
  };

  useEffect(() => {
      fetch(`${API_BASE}/config/public`)
        .then(res => res.json())
        .then(publicConfig => {
            setState(prev => ({ ...prev, config: { ...prev.config, ...publicConfig } }));
        })
        .catch(err => console.error("Failed to load public config", err));
  }, []);
  
  // --- EFFECT: Auth & Initial Load ---
  useEffect(() => {
    if (token) {
      // 1. Verify Token integrity first
      fetch(`${API_BASE}/me`, { headers: { Authorization: token } })
        .then(res => {
            if (res.ok) {
                res.json().then(user => {
                    setState(prev => ({ ...prev, currentUser: user }));
                    // 2. Only fetch data if token is valid
                    fetchInitialData(); 
                });
            } else {
                // 3. If Token is invalid, Logout (stops 401 loops)
                logout();
            }
        })
        .catch(() => logout());
    }
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

  const logout = () => { 
      setToken(null); 
      localStorage.removeItem('token'); 
      setState(p => ({ ...p, currentUser: null })); 
  };
  
  const signup = async (d) => {
     const res = await fetch(`${API_BASE}/users`, { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d) });
     if(res.ok) return { success: true };
     const err = await res.json();
     return { success: false, error: err.error };
  };
  const fetchAvailability = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/availability`, {headers:{Authorization:token}});
        if(res.ok) { 
            const availability = await res.json(); 
            setState(p => ({ ...p, availability })); 
        }
      } catch(e) {}
  };
  // --- FETCHERS (GUARDED: Will not run without token) ---
  const fetchUsers = async () => { 
      if (!token) return;
      const res = await fetch(`${API_BASE}/users`);
      if(res.ok) { const users = await res.json(); setState(p => ({ ...p, users })); }
  };
  
  const fetchTeams = async () => { 
      if (!token) return; 
      try {
        const res = await fetch(`${API_BASE}/teams`, {headers:{Authorization:token}});
        if(res.ok) { const teams = await res.json(); setState(p => ({ ...p, teams })); }
      } catch(e) {}
  };

  const fetchProjects = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/projects`, {headers:{Authorization:token}});
        if(res.ok) { const projects = await res.json(); setState(p => ({ ...p, projects })); }
      } catch(e) {}
  };

  const fetchGroupAssignments = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/groupAssignments`, {headers:{Authorization:token}});
        if(res.ok) { const groupAssignments = await res.json(); setState(p => ({ ...p, groupAssignments })); }
      } catch(e) {}
  };

  const fetchMemberAssignments = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/memberAssignments`, {headers:{Authorization:token}});
        if(res.ok) { const memberAssignments = await res.json(); setState(p => ({ ...p, memberAssignments })); }
      } catch(e) {}
  };

  const fetchWorkTypes = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/workTypes`, {headers:{Authorization:token}});
        if(res.ok) { const workTypes = await res.json(); setState(p => ({ ...p, workTypes })); }
      } catch(e) {}
  };
  
  const fetchStats = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/stats`, {headers:{Authorization:token}});
        if(res.ok) { const stats = await res.json(); setState(p => ({ ...p, stats })); }
      } catch(e) {}
  };

  const generateReport = async (filter: any, roleContext?: string) => { 
    try {
        const response = await fetch(`${API_BASE}/reports`, { 
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json', 
                Authorization: token!
            }, 
            // Pass the current View Role as context
            body: JSON.stringify({ ...filter, role: roleContext }) 
        });

        if (!response.ok) return [];
        return await response.json(); 
    } catch (error) {
        return [];
    }
  };
  
  const fetchConfig = async () => {
      if (!token) return;
      try {
          const res = await fetch(`${API_BASE}/config`, { headers: { Authorization: token } });
          if(res.ok) { const config = await res.json(); setState(p => ({ ...p, config })); }
      } catch (e) {}
  };

  const updateConfig = async (data) => {
      const res = await fetch(`${API_BASE}/config`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify(data) });
      if(res.ok) { fetchConfig(); return { success: true }; }
      return { success: false };
  };

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

  // PROJECT ACTIONS
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
  const submitMemberWork = (id, remarks, customTime, screenshot) => 
      updateMemberAssignment(id, {
          status: 'PENDING_ACK', 
          completionTime: customTime || new Date().toISOString(), 
          remarks,
          screenshot
      });
  const acknowledgeMemberWork = (id, rating, overrideBlackmark) => updateMemberAssignment(id, {status:'COMPLETED', rating, overrideBlackmark});
  const revokeMemberWork = (id) => updateMemberAssignment(id, {status:'IN_PROGRESS', completionTime:null});
  const revokeMemberRejection = (id) => updateMemberAssignment(id, {status:'IN_PROGRESS', rejectionReason: null});
  const deleteMemberAssignment = (id) => fetch(`${API_BASE}/memberAssignments/${id}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchMemberAssignments);
  const addRemark = (id, isGroup, remark) => fetch(`${API_BASE}/${isGroup?'groupAssignments':'memberAssignments'}/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({remarks:remark}) }).then(isGroup?fetchGroupAssignments:fetchMemberAssignments);
  const addWorkType = (name) => fetch(`${API_BASE}/workTypes`, { method: 'POST', headers: {'Content-Type':'application/json', Authorization:token!}, body: JSON.stringify({name}) }).then(fetchWorkTypes);
  const removeWorkType = (name) => fetch(`${API_BASE}/workTypes/${name}`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchWorkTypes);
  
  const fetchNotifications = async () => { 
      if (!token) return;
      try {
        const res = await fetch(`${API_BASE}/notifications`, {headers:{Authorization:token}});
        if(res.ok) { const notifications = await res.json(); setState(p => ({ ...p, notifications })); }
      } catch(e) {}
  };
  
  const fetchChat = async () => { 
      if (!token) return;
      try {
          const res = await fetch(`${API_BASE}/chat`, { headers: { Authorization: token } });
          if (res.ok) { const chatMessages = await res.json(); setState(p => ({ ...p, chatMessages })); }
      } catch (err) {}
  };

  const fetchForum = async () => { 
      if (!token) return;
      try {
          const res = await fetch(`${API_BASE}/forum`, { headers: { Authorization: token } });
          if (res.ok) { const forumThreads = await res.json(); setState(p => ({ ...p, forumThreads })); }
      } catch (err) {}
  };

  const markRead = () => fetch(`${API_BASE}/notifications/read`, { method: 'POST', headers: {Authorization:token!} }).then(fetchNotifications);
  const clearNotifications = () => fetch(`${API_BASE}/notifications`, { method: 'DELETE', headers: {Authorization:token!} }).then(fetchNotifications);

  const sendMessage = async (message: string, channel: string, isImage: boolean = false) => {
      await fetch(`${API_BASE}/chat`, { method: 'POST', headers: {'Content-Type': 'application/json', Authorization: token!}, body: JSON.stringify({ message, channel, isImage }) });
      fetchChat();
  };

  const createThread = async (title: string, content: string, isImage: boolean = false) => {
      await fetch(`${API_BASE}/forum`, { method: 'POST', headers: {'Content-Type': 'application/json', Authorization: token!}, body: JSON.stringify({ title, content, isImage }) });
      fetchForum();
  };

  const createComment = async (threadId: number, content: string, isImage: boolean = false) => {
      await fetch(`${API_BASE}/forum/comment`, { method: 'POST', headers: {'Content-Type': 'application/json', Authorization: token!}, body: JSON.stringify({ threadId, content, isImage }) });
      fetchForum();
  };

  return { 
    state, setState, login, logout, signup, 
    approveUser, deleteUser, updateProfile, createTeam, assignUserToTeam, updateUser,
    createProject, updateProject, deleteProject, toggleProjectHold, triggerRework,
    assignToGroup, updateGroupAssignment, deleteGroupAssignment, revokeGroupWork, revokeGroupRejection,
    assignToMember, updateMemberAssignment, submitMemberWork, acknowledgeMemberWork, revokeMemberWork, 
    revokeMemberRejection, deleteMemberAssignment,
    addRemark, addWorkType, removeWorkType, fetchStats, generateReport,
    fetchTeams, fetchProjects, fetchGroupAssignments, fetchMemberAssignments, fetchUsers,
    updateConfig,fetchNotifications, markRead, clearNotifications,fetchChat, sendMessage,
    fetchForum, createThread, createComment, fetchAvailability
  };
};