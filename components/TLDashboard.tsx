import React, { useState, useEffect } from 'react';
import { GroupAssignment, MemberAssignment } from '../types';
import { StatsView, ReportGenerator } from './StatsAndReports';

interface TLDashboardProps { 
    store: any; 
    currentView: 'home' | 'projects' | 'reports'; 
}

const TLDashboard: React.FC<TLDashboardProps> = ({ store, currentView }) => {
  const { state, assignToMember, updateMemberAssignment, acknowledgeMemberWork, updateGroupAssignment, revokeMemberWork, revokeMemberRejection, deleteMemberAssignment } = store;

  const [filterTab, setFilterTab] = useState('ongoing'); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  
  useEffect(() => { setActiveGroupId(null); }, [filterTab, currentView]);

  const activeGroup = state.groupAssignments.find((g: GroupAssignment) => g.id === activeGroupId) || null;

  const [showAlloc, setShowAlloc] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [reviewData, setReviewData] = useState<MemberAssignment | null>(null);

  const getLocalISO = () => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); };
  const [allocForm, setAllocForm] = useState({ memberId: '', workTypes: [] as string[], divisions: [] as string[], partNos: [] as string[], assignedTime: getLocalISO(), eta: '' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, overrideBlackmark: false });

  const myTeamId = state.currentUser?.teamId;

  // --- STRICT COMPLETION CHECK: ALL combinations must be done ---
  const getMissingScopeItems = (ga: GroupAssignment) => {
      const completedMAs = state.memberAssignments.filter((ma: MemberAssignment) => ma.groupAssignmentId === ga.id && ma.status === 'COMPLETED');
      const missing: string[] = [];
      ga.divisions.forEach(div => {
          ga.partNos.forEach(part => {
              ga.workTypes.forEach(wt => {
                  const isCovered = completedMAs.some((ma: MemberAssignment) => ma.divisions.includes(div) && ma.partNos.includes(part) && ma.workTypes.includes(wt));
                  if (!isCovered) missing.push(`${div} - ${part} - ${wt}`);
              });
          });
      });
      return missing;
  };

  const isItemComplete = (ga: GroupAssignment, type: 'div' | 'part' | 'wt', value: string) => {
      const completedMAs = state.memberAssignments.filter((ma: MemberAssignment) => ma.groupAssignmentId === ga.id && ma.status === 'COMPLETED');
      const reqDivs = type === 'div' ? [value] : ga.divisions;
      const reqParts = type === 'part' ? [value] : ga.partNos;
      const reqWTs = type === 'wt' ? [value] : ga.workTypes;
      return reqDivs.every(d => reqParts.every(p => reqWTs.every(wt => completedMAs.some((ma: MemberAssignment) => ma.divisions.includes(d) && ma.partNos.includes(p) && ma.workTypes.includes(wt)))));
  };

  const getGroupStats = (ga: GroupAssignment) => {
      const totalCombinations = ga.divisions.length * ga.partNos.length * ga.workTypes.length;
      const missingCount = getMissingScopeItems(ga).length;
      const completedCount = totalCombinations - missingCount;
      const pct = totalCombinations > 0 ? Math.round((completedCount / totalCombinations) * 100) : 0;
      return { progress: pct, isFullyComplete: missingCount === 0 };
  };

  const getFilteredGroups = () => {
    return state.groupAssignments.filter((ga: GroupAssignment) => {
       if (ga.teamId !== myTeamId) return false;
       const proj = state.projects.find(p => p.id === ga.projectId);
       let tabMatch = false;
       if (filterTab === 'hold') tabMatch = proj?.status === 'ON_HOLD';
       else if (filterTab === 'completed') tabMatch = ga.status === 'COMPLETED';
       else if (filterTab === 'ongoing') tabMatch = ga.status !== 'COMPLETED' && proj?.status !== 'ON_HOLD';
       else if (filterTab === 'recent') tabMatch = ga.status === 'COMPLETED' && new Date(ga.completionTime!) > new Date(Date.now() - 86400000);
       if (!tabMatch) return false;
       if (searchQuery.trim()) return proj?.name.toLowerCase().includes(searchQuery.toLowerCase());
       return true;
    });
  };

  const toggleItem = (list: string[], item: string) => list.includes(item) ? list.filter(i => i !== item) : [...list, item];

  const handleAllocSubmit = () => {
      const payload = { ...allocForm, groupAssignmentId: activeGroup!.id, memberId: parseInt(allocForm.memberId) };
      if (editMode && editId) { updateMemberAssignment(editId, payload); setEditMode(false); setEditId(null); } 
      else { assignToMember(payload); }
      setShowAlloc(false);
  };

  const openEdit = (ma: MemberAssignment) => { setAllocForm({ memberId: String(ma.memberId), workTypes: ma.workTypes, divisions: ma.divisions, partNos: ma.partNos, assignedTime: ma.assignedTime, eta: ma.eta }); setEditId(ma.id); setEditMode(true); setShowAlloc(true); };
  const handleRejectToPM = () => { const reason = prompt("Reason for rejection:"); if (reason) updateGroupAssignment(activeGroup!.id, { status: 'REJECTION_REQ', rejectionReason: reason }); };
  const handleMemberReject = (ma: MemberAssignment) => { if(window.confirm("Approve this rejection?")) updateMemberAssignment(ma.id, { status: 'REJECTED' }); };

  if (currentView === 'home') return <StatsView stats={state.stats} role="TEAM_LEAD" userName={state.currentUser?.name} />;
  if (currentView === 'reports') return <ReportGenerator store={store} role="TEAM_LEAD" />;

  const activeStats = activeGroup ? getGroupStats(activeGroup) : null;
  const missingItems = activeGroup ? getMissingScopeItems(activeGroup) : [];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">Work Orders</h2>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                 {['ongoing', 'recent', 'completed', 'hold'].map(t => (
                     <button key={t} onClick={()=>setFilterTab(t)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                 ))}
             </div>
         </div>
         <div className="relative">
            <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            <input placeholder="Filter work..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
         </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
         {/* LIST COLUMN (LEFT) */}
         <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto max-h-[75vh]">
             {getFilteredGroups().map((ga: GroupAssignment) => {
                 const stats = getGroupStats(ga); 
                 return (
                     <div key={ga.id} onClick={()=>setActiveGroupId(ga.id)} className={`p-5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${activeGroup?.id===ga.id?'bg-indigo-50/50 border-l-4 border-l-indigo-600':''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className={`font-bold text-sm ${activeGroup?.id===ga.id?'text-indigo-900':'text-slate-700'}`}>{state.projects.find(p=>p.id===ga.projectId)?.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{ga.divisions.length} Divs • {ga.partNos.length} Parts</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${ga.status==='COMPLETED'?'bg-green-100 text-green-700':ga.status==='REJECTED'?'bg-red-100 text-red-600':ga.status==='REJECTION_REQ'?'bg-orange-100 text-orange-600':'bg-amber-100 text-amber-700'}`}>{ga.status.replace('_', ' ')}</span>
                        </div>
                        
                        {/* LEFT COLUMN BADGES */}
                        <div className="flex flex-wrap gap-1 mt-2 mb-2">
                             {ga.divisions.map(d => (
                                 <div key={d} className={`w-2 h-2 rounded-full ${isItemComplete(ga, 'div', d) ? 'bg-green-500' : 'bg-slate-200'}`} title={`Div ${d} Status`}></div>
                             ))}
                        </div>

                        <div className="space-y-1 mt-3">
                            <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-1"><span>Completion</span><span>{stats.progress}%</span></div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden"><div style={{width: `${stats.progress}%`}} className={`h-full rounded-full transition-all duration-500 ${stats.progress===100?'bg-green-500':'bg-indigo-500'}`}></div></div>
                        </div>
                     </div>
                 );
             })}
         </div>

         {/* DETAILS COLUMN (RIGHT) */}
         <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
             {activeGroup ? (
                 <>
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                       <div>
                          <h2 className="text-xl font-black text-slate-900">{state.projects.find(p=>p.id===activeGroup.projectId)?.name}</h2>
                          <div className="flex gap-2 mt-1">
                             <span className="text-xs bg-slate-100 px-2 rounded font-bold text-slate-600">Start: {new Date(activeGroup.assignedTime).toLocaleDateString()}</span>
                             <span className="text-xs bg-amber-50 text-amber-600 px-2 rounded font-bold">ETA: {new Date(activeGroup.eta).toLocaleString()}</span>
                             {activeGroup.completionTime && <span className="text-xs bg-green-50 text-green-600 px-2 rounded font-bold">Done: {new Date(activeGroup.completionTime).toLocaleString()}</span>}
                          </div>
                       </div>
                       <div className="flex gap-2">
                          {filterTab === 'ongoing' && activeGroup.status !== 'COMPLETED' && activeGroup.status !== 'REJECTED' && activeGroup.status !== 'REJECTION_REQ' && activeGroup.status !== 'PENDING_ACK' && (
                              <>
                                <button onClick={handleRejectToPM} className="bg-white border border-red-200 text-red-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-50">Reject Order</button>
                                <button onClick={()=>{setEditMode(false); setEditId(null); setShowAlloc(true);}} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-indigo-700 shadow-lg shadow-indigo-200">Allocate Member</button>
                                {activeStats?.isFullyComplete ? (
                                    <button onClick={()=>updateGroupAssignment(activeGroup!.id, {status: 'PENDING_ACK', completionTime: new Date().toISOString()})} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg shadow-green-200 hover:bg-green-700">Submit to PM</button>
                                ) : (
                                    <button disabled className="bg-slate-100 text-slate-400 px-4 py-2 rounded-xl text-xs font-black uppercase cursor-not-allowed" title={`${missingItems.length} items incomplete`}>Incomplete</button>
                                )}
                              </>
                          )}
                          {activeGroup.status === 'PENDING_ACK' && <span className="text-xs font-bold text-amber-600 bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 animate-pulse"><i className="fas fa-clock mr-2"></i>Pending PM Review</span>}
                          {activeGroup.status === 'REJECTION_REQ' && <span className="text-xs font-bold text-orange-500 bg-orange-50 px-3 py-1 rounded">Rejection Pending Approval</span>}
                          {activeGroup.status === 'COMPLETED' && <span className="text-xs font-bold text-green-600 bg-green-50 px-4 py-2 rounded-xl border border-green-100"><i className="fas fa-check-circle mr-2"></i>Approved</span>}
                       </div>
                    </div>

                    {/* BADGES WITH FILL LOGIC */}
                    <div className="flex flex-wrap gap-4 mb-4 bg-white p-3 rounded-xl border border-slate-100">
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] font-black text-slate-400 mr-1">DIVS:</span>
                            {activeGroup.divisions.map(d => (
                                <span key={d} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${isItemComplete(activeGroup, 'div', d) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{d}</span>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] font-black text-slate-400 mr-1">PARTS:</span>
                            {activeGroup.partNos.map(p => (
                                <span key={p} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${isItemComplete(activeGroup, 'part', p) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{p}</span>
                            ))}
                        </div>
                        <div className="flex flex-wrap gap-1 items-center">
                            <span className="text-[9px] font-black text-slate-400 mr-1">WORK:</span>
                            {activeGroup.workTypes.map(w => (
                                <span key={w} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${isItemComplete(activeGroup, 'wt', w) ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>{w}</span>
                            ))}
                        </div>
                    </div>

                    {!activeStats?.isFullyComplete && missingItems.length > 0 && filterTab === 'ongoing' && (
                        <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4">
                            <p className="text-xs font-black text-red-600 uppercase mb-2"><i className="fas fa-exclamation-circle mr-1"></i> Incomplete Work Items</p>
                            <div className="flex flex-wrap gap-2">
                                {missingItems.slice(0, 10).map((item, i) => (
                                    <span key={i} className="text-[10px] bg-white border border-red-100 text-red-500 px-2 py-1 rounded font-bold">{item}</span>
                                ))}
                                {missingItems.length > 10 && <span className="text-[10px] text-red-400 font-bold">...and {missingItems.length - 10} more</span>}
                            </div>
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                           <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                              <tr><th className="p-3 rounded-l-lg">Member</th><th className="p-3">Scope</th><th className="p-3">ETA</th><th className="p-3">Completed</th><th className="p-3">Status</th><th className="p-3 text-right rounded-r-lg">Actions</th></tr>
                           </thead>
                           <tbody className="divide-y divide-slate-50">
                              {state.memberAssignments.filter(ma => ma.groupAssignmentId === activeGroup!.id).map(ma => (
                                 <tr key={ma.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-3 font-bold text-slate-900">{state.users.find(u=>u.id===ma.memberId)?.name}</td>
                                    <td className="p-3 text-slate-500 font-medium">{ma.divisions.length}D, {ma.partNos.length}P</td>
                                    <td className="p-3 text-amber-600 font-bold">{new Date(ma.eta).toLocaleDateString()}</td>
                                    <td className="p-3 font-bold text-emerald-600">{ma.completionTime ? new Date(ma.completionTime).toLocaleString() : '-'}</td>
                                    <td className="p-3">
                                       <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${ma.status==='COMPLETED'?'bg-green-100 text-green-700':ma.status==='REJECTED'?'bg-red-100 text-red-600':ma.status==='REJECTION_REQ'?'bg-orange-100 text-orange-600':'bg-slate-100 text-slate-600'}`}>{ma.status.replace('_', ' ')}</span>
                                       {(ma.status === 'REJECTED' || ma.status === 'REJECTION_REQ') && <div className="text-[8px] text-red-500 font-bold mt-1">{ma.rejectionReason}</div>}
                                    </td>
                                    <td className="p-3 text-right flex justify-end gap-2">
                                        {ma.status === 'PENDING_ACK' && (
                                            <>
                                                <button onClick={()=>setReviewData(ma)} className="bg-green-600 text-white px-2 py-1 rounded text-[9px] font-bold shadow-sm">Review</button>
                                                <button onClick={()=>revokeMemberWork(ma.id)} className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[9px] font-bold hover:bg-slate-300">Revoke</button>
                                            </>
                                        )}
                                        {ma.status === 'REJECTION_REQ' && (
                                            <>
                                                <button onClick={()=>handleMemberReject(ma)} className="bg-red-600 text-white px-2 py-1 rounded text-[9px] font-bold shadow-sm">Confirm</button>
                                                <button onClick={()=>revokeMemberRejection(ma.id)} className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[9px] font-bold hover:bg-slate-300">Revoke</button>
                                            </>
                                        )}
                                        {ma.status !== 'COMPLETED' && ma.status !== 'REJECTED' && ma.status !== 'REJECTION_REQ' && (
                                            <>
                                                <button onClick={()=>openEdit(ma)} className="text-slate-400 hover:text-indigo-600 transition-colors"><i className="fas fa-edit"></i></button>
                                                <button onClick={()=>{if(window.confirm('Delete this allocation?')) deleteMemberAssignment(ma.id)}} className="text-slate-300 hover:text-red-500 ml-2 transition-colors"><i className="fas fa-trash"></i></button>
                                            </>
                                        )}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                    </div>
                 </>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <i className="fas fa-clipboard-list text-5xl mb-4"></i>
                    <p className="text-sm font-bold italic">Select a work order to manage.</p>
                </div>
             )}
         </div>
      </div>

      {/* ALLOC MODAL */}
      {showAlloc && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
             <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                <h2 className="text-xl font-black mb-4">{editMode ? 'Edit Task' : 'Assign Task'}</h2>
                <div className="space-y-4">
                    <select className="w-full border-2 border-slate-100 bg-slate-50 p-3 rounded-xl font-bold text-sm outline-none focus:border-indigo-500 transition-colors" value={allocForm.memberId} onChange={e=>setAllocForm({...allocForm, memberId: e.target.value})}>
                       <option value="">Select Member</option>
                       {state.users.filter(u=>u.teamId===myTeamId && u.roles.includes('MEMBER')).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                    <div className="p-4 bg-slate-50 rounded-xl space-y-3 max-h-40 overflow-y-auto border border-slate-100">
                        <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Divisions</p><div className="flex flex-wrap gap-1">{activeGroup?.divisions.map(d=><button key={d} onClick={()=>setAllocForm(p=>({...p, divisions: toggleItem(p.divisions,d)}))} className={`text-[9px] px-2 py-1 rounded border ${allocForm.divisions.includes(d)?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>{d}</button>)}</div></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Parts</p><div className="flex flex-wrap gap-1">{activeGroup?.partNos.map(p=><button key={p} onClick={()=>setAllocForm(prev=>({...prev, partNos: toggleItem(prev.partNos, p)}))} className={`text-[9px] px-2 py-1 rounded border ${allocForm.partNos.includes(p)?'bg-amber-600 text-white border-amber-600':'bg-white text-slate-500 border-slate-200'}`}>{p}</button>)}</div></div>
                        <div><p className="text-[9px] font-black uppercase text-slate-400 mb-1">Work Types</p><div className="flex flex-wrap gap-1">{activeGroup?.workTypes.map(w=><button key={w} onClick={()=>setAllocForm(p=>({...p, workTypes: toggleItem(p.workTypes,w)}))} className={`text-[9px] px-2 py-1 rounded border ${allocForm.workTypes.includes(w)?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-500 border-slate-200'}`}>{w}</button>)}</div></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-[10px] uppercase text-slate-400 font-black">Start</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-2 rounded-xl text-xs font-bold" value={allocForm.assignedTime} onChange={e=>setAllocForm({...allocForm, assignedTime: e.target.value})}/></div>
                       <div><label className="text-[10px] uppercase text-slate-400 font-black">ETA</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-2 rounded-xl text-xs font-bold" value={allocForm.eta} onChange={e=>setAllocForm({...allocForm, eta: e.target.value})}/></div>
                    </div>
                    <button onClick={handleAllocSubmit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black uppercase shadow-lg shadow-indigo-200 hover:bg-indigo-700">Confirm</button>
                    <button onClick={()=>{setShowAlloc(false); setEditMode(false);}} className="w-full text-slate-400 py-2 font-bold text-xs uppercase hover:text-slate-600">Cancel</button>
                </div>
             </div>
         </div>
      )}

      {/* REVIEW MODAL */}
      {reviewData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                <h2 className="text-xl font-black mb-4">Quality Check</h2>
                <div className="flex justify-center gap-2 mb-4">{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setReviewForm({...reviewForm, rating: s})} className={`text-3xl transition-all hover:scale-110 ${s<=reviewForm.rating?'text-amber-400':'text-slate-200'}`}><i className="fas fa-star"></i></button>)}</div>
                
                {new Date(reviewData.completionTime) > new Date(reviewData.eta) && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 mb-4">
                       <p className="text-xs font-black text-red-600">Late Submission</p>
                       <label className="flex items-center gap-2 mt-2 cursor-pointer"><input type="checkbox" checked={reviewForm.overrideBlackmark} onChange={e=>setReviewForm({...reviewForm, overrideBlackmark: e.target.checked})} /><span className="text-[10px] font-bold uppercase text-slate-600">Waive Penalty</span></label>
                    </div>
                )}
                
                <button onClick={()=>{acknowledgeMemberWork(reviewData.id, reviewForm.rating, reviewForm.overrideBlackmark); setReviewData(null);}} className="w-full bg-slate-900 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:bg-slate-800">Approve</button>
                <button onClick={()=>setReviewData(null)} className="w-full text-slate-400 py-2 font-bold text-xs uppercase hover:text-slate-600">Cancel</button>
             </div>
          </div>
      )}
    </div>
  );
};
export default TLDashboard;