import React, { useState } from 'react';
import { UserRole, Team, User } from '../types';

interface AdminDashboardProps { 
    store: any;
    currentView: 'home' | 'projects' | 'reports'; // Received from App
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ store, currentView }) => {
  const { state, approveUser, createTeam, assignUserToTeam, addWorkType, removeWorkType, updateUser, deleteUser } = store;
  
  // Mapped internal tabs for the "Projects" (Management) view
  const [activeTab, setActiveTab] = useState<'staff' | 'teams' | 'config'>('staff');
  
  // Forms & State
  const [newTeamName, setNewTeamName] = useState('');
  const [newWorkType, setNewWorkType] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [approvalRoles, setApprovalRoles] = useState<Record<number, UserRole[]>>({});

  // Filters
  const pendingUsers = state.users.filter((u: User) => !u.isApproved);
  const approvedUsers = state.users.filter((u: User) => u.isApproved && !u.roles.includes(UserRole.ADMIN));
  const currentTeamLeads = editingTeam ? state.users.filter((u: User) => u.teamId === editingTeam.id && u.roles.includes(UserRole.TEAM_LEAD)) : [];
  const currentTeamMembers = editingTeam ? state.users.filter((u: User) => u.teamId === editingTeam.id && u.roles.includes(UserRole.MEMBER)) : [];
  const unallocatedLeads = state.users.filter((u: User) => !u.teamId && u.roles.includes(UserRole.TEAM_LEAD) && u.isApproved && !u.roles.includes(UserRole.ADMIN));
  const unallocatedMembers = state.users.filter((u: User) => !u.teamId && u.roles.includes(UserRole.MEMBER) && u.isApproved && !u.roles.includes(UserRole.ADMIN));

  // Handlers (Simplified)
  const handleCreateTeam = (e: React.FormEvent) => { e.preventDefault(); if (newTeamName.trim()) { createTeam(newTeamName); setNewTeamName(''); } };
  const handleAddWorkType = (e: React.FormEvent) => { e.preventDefault(); if (newWorkType.trim()) { addWorkType(newWorkType.trim()); setNewWorkType(''); } };
  const handleApprove = (user: User) => { const finalRoles = approvalRoles[user.id] || user.roles; approveUser(user.id, finalRoles); };
  const handleUpdateStaff = (e: React.FormEvent) => { e.preventDefault(); if (editingUser) { updateUser(editingUser.id, { name: editingUser.name, username: editingUser.username, password: editingUser.password, roles: editingUser.roles }); setEditingUser(null); } };
  const toggleApprovalRole = (userId: number, role: UserRole) => { const current = approvalRoles[userId] || state.users.find((u: User) => u.id === userId)?.roles || []; const updated = current.includes(role) ? current.filter(r => r !== role) : [...current, role]; setApprovalRoles({ ...approvalRoles, [userId]: updated }); };
  const toggleEditUserRole = (role: UserRole) => { if (!editingUser) return; const updated = editingUser.roles.includes(role) ? editingUser.roles.filter(r => r !== role) : [...editingUser.roles, role]; setEditingUser({ ...editingUser, roles: updated }); };
  const addToTeam = (userId: number) => { if (editingTeam) assignUserToTeam(userId, editingTeam.id); };
  const removeFromTeam = (userId: number) => { assignUserToTeam(userId, null); };

  // Note: Admin might not have explicit Stats/Reports yet, defaulting to Management view
  if (currentView === 'home' || currentView === 'reports') {
      return (
          <div className="flex flex-col items-center justify-center h-96 text-slate-400">
             <i className="fas fa-chart-pie text-4xl mb-4"></i>
             <p>Admin Statistics and Reports are under development.</p>
             <button onClick={()=>setActiveTab('staff')} className="text-indigo-600 font-bold mt-2">Go to Management</button>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ADMIN SUB-TABS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Admin</h1>
          <p className="text-slate-500 mt-1">Manage infrastructure, teams, and staff</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 self-start">
          <button onClick={() => setActiveTab('staff')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'staff' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Staff</button>
          <button onClick={() => setActiveTab('teams')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Teams</button>
          <button onClick={() => setActiveTab('config')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'config' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Config</button>
        </div>
      </div>

      {/* STAFF TAB */}
      {activeTab === 'staff' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-slate-800">Pending Requests</h2>
                <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black">{pendingUsers.length}</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {pendingUsers.length === 0 ? <div className="p-12 text-center text-slate-400 italic text-sm">No pending approvals</div> : pendingUsers.map((user: User) => {
                    const activeRoles = approvalRoles[user.id] || user.roles;
                    return (
                      <div key={user.id} className="p-5 bg-white hover:bg-slate-50 transition-colors">
                        <div className="mb-4"><p className="font-bold text-slate-900 text-sm">{user.name}</p><p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">@{user.username}</p></div>
                        <div className="space-y-2 mb-4">{[UserRole.PROJECT_MANAGER, UserRole.TEAM_LEAD, UserRole.MEMBER].map(role => (<button key={role} onClick={() => toggleApprovalRole(user.id, role)} className={`w-full flex items-center justify-between p-2 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all ${activeRoles.includes(role) ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-100 text-slate-400'}`}>{role.replace('_', ' ')}{activeRoles.includes(role) && <i className="fas fa-check-circle"></i>}</button>))}</div>
                        <div className="flex gap-2"><button onClick={() => handleApprove(user)} className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700">Approve</button><button onClick={() => { if(window.confirm('Delete Request?')) deleteUser(user.id); }} className="px-4 bg-red-50 text-red-500 rounded-xl hover:bg-red-100"><i className="fas fa-trash"></i></button></div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="bg-slate-50 px-6 py-4 border-b border-slate-200"><h2 className="font-bold text-slate-800">Active Staff List</h2></div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 uppercase font-black border-b tracking-widest"><tr><th className="px-6 py-4">Name / ID</th><th className="px-6 py-4">Roles</th><th className="px-6 py-4">Team</th><th className="px-6 py-4 text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{approvedUsers.map((user: User) => (<tr key={user.id} className="hover:bg-slate-50/50 group transition-colors"><td className="px-6 py-4"><p className="font-bold text-slate-800">{user.name}</p><p className="text-[10px] text-slate-400 font-bold tracking-tighter">@{user.username}</p></td><td className="px-6 py-4"><div className="flex flex-wrap gap-1">{user.roles.map(role => (<span key={role} className="bg-slate-100 px-2 py-0.5 rounded text-[8px] font-black uppercase text-slate-600 border border-slate-200">{role.replace('_', ' ')}</span>))}</div></td><td className="px-6 py-4"><span className={`font-medium px-2 py-0.5 rounded border ${user.teamId ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{state.teams.find((t: any) => t.id === user.teamId)?.name || 'Unallocated'}</span></td><td className="px-6 py-4 text-right"><button onClick={() => setEditingUser(user)} className="text-indigo-600 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 p-2 rounded-lg transition-all"><i className="fas fa-edit text-lg"></i></button></td></tr>))}</tbody>
                  </table>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* TEAMS TAB */}
      {activeTab === 'teams' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="max-w-md">
              <h2 className="font-bold text-slate-900 text-lg mb-1">Create a New Team</h2>
              <p className="text-sm text-slate-500">Define a group of employees for allocation.</p>
            </div>
            <form onSubmit={handleCreateTeam} className="flex gap-2 w-full md:w-auto">
              <input type="text" placeholder="Enter Team Name..." className="flex-grow border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-violet-500 min-w-[300px]" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
              <button className="bg-violet-600 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-violet-100 hover:bg-violet-700">Create Team</button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">Existing Teams</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-400 uppercase font-black border-b tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Team Name</th>
                    <th className="px-6 py-4">Team Leads</th>
                    <th className="px-6 py-4">Members</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {state.teams.map((team: Team) => {
                    const members = state.users.filter((u: User) => u.teamId === team.id);
                    const leads = members.filter((u: User) => u.roles.includes(UserRole.TEAM_LEAD));
                    return (
                      <tr key={team.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-900">{team.name}</td>
                        <td className="px-6 py-4">
                           <div className="flex -space-x-2">
                            {leads.length > 0 ? leads.map(l => (
                              <div key={l.id} className="w-8 h-8 bg-indigo-600 border-2 border-white rounded-full flex items-center justify-center text-white text-[10px] font-black" title={l.name}>
                                {(l.name || 'U').charAt(0)}
                              </div>
                            )) : <span className="text-slate-400 italic">No Leads</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-bold">{members.length} Staff</td>
                        <td className="px-6 py-4 text-right">
                           <button onClick={() => { setEditingTeam(team); setShowAddUserModal(false); }} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-all border border-indigo-100">Manage Team</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === 'config' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <i className="fas fa-cog text-slate-400"></i>
            <h2 className="font-bold text-slate-800">Global System Settings</h2>
          </div>
          <div className="p-8 space-y-8">
            <div className="max-w-2xl">
              <h3 className="font-bold text-slate-900 mb-2">Work Classification</h3>
              <p className="text-sm text-slate-500 mb-6">Manage the work types available for Project Managers when initializing projects.</p>
              <form onSubmit={handleAddWorkType} className="flex gap-2 mb-8">
                <input type="text" placeholder="e.g. Design, Analysis..." className="flex-grow border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500" value={newWorkType} onChange={(e) => setNewWorkType(e.target.value)} />
                <button className="bg-amber-500 text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-amber-100 hover:bg-amber-600">Add Work Type</button>
              </form>
              <div className="flex flex-wrap gap-3">
                {state.workTypes.map((type: string) => (
                  <div key={type} className="flex items-center gap-3 px-4 py-3 bg-white text-slate-700 rounded-xl font-bold border border-slate-200 shadow-sm hover:border-amber-200 transition-all group">
                    {type}
                    <button onClick={() => removeWorkType(type)} className="text-slate-300 hover:text-red-500 group-hover:text-slate-400 transition-colors"><i className="fas fa-times-circle"></i></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER EDIT MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
           <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 animate-slideUp">
              <h2 className="text-xl font-black text-slate-900 mb-6">Edit Employee Data</h2>
              <form onSubmit={handleUpdateStaff} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Full Name</label>
                  <input className="w-full border-slate-200 border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Username</label>
                  <input className="w-full border-slate-200 border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editingUser.username} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Update Password</label>
                  <input type="text" className="w-full border-slate-200 border p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" value={editingUser.password} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Change Roles</label>
                  <div className="space-y-2">
                    {[UserRole.PROJECT_MANAGER, UserRole.TEAM_LEAD, UserRole.MEMBER].map(role => (
                      <label key={role} className="flex items-center gap-3 p-2 border rounded-xl cursor-pointer">
                        <input type="checkbox" checked={editingUser.roles.includes(role)} onChange={() => toggleEditUserRole(role)} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{role.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button type="submit" className="flex-1 bg-indigo-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700">Save Changes</button>
                  <button type="button" onClick={() => setEditingUser(null)} className="flex-1 bg-slate-50 text-slate-500 font-black py-3 rounded-xl text-xs uppercase tracking-widest hover:bg-slate-100">Cancel</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {/* TEAM MANAGE MODAL */}
      {editingTeam && !showAddUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full my-8 overflow-hidden animate-slideUp">
            <div className="bg-slate-50 px-8 py-6 border-b flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900">{editingTeam.name}</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team Roster Management</p>
              </div>
              <button onClick={() => setEditingTeam(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 space-y-8">
              
              {/* Existing Leads */}
              <div>
                 <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Existing Team Leads</label>
                    <span className="text-[10px] font-bold text-slate-400">{currentTeamLeads.length} Assigned</span>
                 </div>
                 <div className="space-y-2">
                    {currentTeamLeads.length === 0 ? (
                       <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 italic text-sm">No leads currently assigned.</div>
                    ) : (
                       currentTeamLeads.map(lead => (
                          <div key={lead.id} className="flex items-center justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/20">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs">{(lead.name || 'U').charAt(0)}</div>
                                <div>
                                   <p className="text-sm font-bold text-slate-900">{lead.name}</p>
                                   <p className="text-[10px] text-slate-500 font-bold">@{lead.username}</p>
                                </div>
                             </div>
                             <button onClick={() => removeFromTeam(lead.id)} className="text-xs font-bold text-red-400 hover:text-red-600 px-3 py-1 bg-white rounded border border-slate-100 shadow-sm hover:shadow">Remove</button>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              {/* Existing Members */}
              <div>
                 <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Existing Members</label>
                    <span className="text-[10px] font-bold text-slate-400">{currentTeamMembers.length} Assigned</span>
                 </div>
                 <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {currentTeamMembers.length === 0 ? (
                       <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 italic text-sm">No members currently assigned.</div>
                    ) : (
                       currentTeamMembers.map(member => (
                          <div key={member.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center font-black text-xs">{(member.name || 'U').charAt(0)}</div>
                                <div>
                                   <p className="text-sm font-bold text-slate-900">{member.name}</p>
                                   <div className="flex gap-2">
                                     <span className="text-[10px] text-slate-500 font-bold">@{member.username}</span>
                                     {member.roles.includes(UserRole.TEAM_LEAD) && <span className="text-[8px] bg-indigo-100 text-indigo-600 px-1 rounded uppercase font-bold">Lead Role</span>}
                                   </div>
                                </div>
                             </div>
                             <button onClick={() => removeFromTeam(member.id)} className="text-xs font-bold text-red-400 hover:text-red-600 px-3 py-1 bg-slate-50 rounded border border-slate-100 hover:bg-red-50">Remove</button>
                          </div>
                       ))
                    )}
                 </div>
              </div>

              {/* Add Button */}
              <div className="pt-4 border-t border-slate-100">
                 <button onClick={() => setShowAddUserModal(true)} className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold text-sm hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                    <i className="fas fa-plus-circle"></i> Add Leads or Members
                 </button>
              </div>
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-end">
               <button onClick={() => setEditingTeam(null)} className="px-6 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-slate-800">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD USER MODAL */}
      {showAddUserModal && editingTeam && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 animate-slideUp flex flex-col max-h-[90vh]">
               <div className="flex justify-between items-center mb-6 flex-shrink-0">
                  <div>
                     <h2 className="text-lg font-black text-slate-900">Add Staff</h2>
                     <p className="text-xs text-slate-500">Adding to <strong>{editingTeam.name}</strong></p>
                  </div>
                  <button onClick={() => setShowAddUserModal(false)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-xl"></i></button>
               </div>

               <div className="overflow-y-auto pr-2 custom-scrollbar space-y-8 flex-grow">
                  {/* Unallocated Leads */}
                  <div>
                     <h3 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-3 border-b border-indigo-100 pb-2">Available Team Leads (Unallocated)</h3>
                     <div className="space-y-2">
                        {unallocatedLeads.length === 0 ? (
                           <div className="text-slate-400 italic text-xs py-2">No unallocated leads available.</div>
                        ) : (
                           unallocatedLeads.map(u => (
                              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-indigo-400 group cursor-pointer transition-all" onClick={() => addToTeam(u.id)}>
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs">{(u.name || 'U').charAt(0)}</div>
                                    <div>
                                       <p className="text-sm font-bold text-slate-900">{u.name}</p>
                                       <p className="text-[10px] text-slate-400">@{u.username}</p>
                                    </div>
                                 </div>
                                 <button className="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-indigo-200">Add</button>
                              </div>
                           ))
                        )}
                     </div>
                  </div>

                  {/* Unallocated Members */}
                  <div>
                     <h3 className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-3 border-b border-indigo-100 pb-2">Available Members (Unallocated)</h3>
                     <div className="space-y-2">
                        {unallocatedMembers.length === 0 ? (
                           <div className="text-slate-400 italic text-xs py-2">No unallocated members available.</div>
                        ) : (
                           unallocatedMembers.map(u => (
                              <div key={u.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-400 group cursor-pointer transition-all" onClick={() => addToTeam(u.id)}>
                                 <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-black text-xs">{(u.name || 'U').charAt(0)}</div>
                                    <div>
                                       <p className="text-sm font-bold text-slate-900">{u.name}</p>
                                       <div className="flex gap-2">
                                          <p className="text-[10px] text-slate-400">@{u.username}</p>
                                          {u.roles.includes(UserRole.TEAM_LEAD) && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1 rounded font-bold">Also Lead</span>}
                                       </div>
                                    </div>
                                 </div>
                                 <button className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-lg shadow-emerald-200">Add</button>
                              </div>
                           ))
                        )}
                     </div>
                  </div>
               </div>

               <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setShowAddUserModal(false)} className="bg-slate-100 text-slate-600 hover:bg-slate-200 px-6 py-2 rounded-lg font-bold text-xs uppercase tracking-widest transition-colors">Done</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default AdminDashboard;