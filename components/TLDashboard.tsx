import React, { useState, useEffect } from 'react';
import { GroupAssignment, MemberAssignment, ScopeItem, User } from '../types';
import { StatsView, ReportGenerator } from './StatsAndReports';

interface TLDashboardProps { 
    store: any; 
    currentView: 'home' | 'projects' | 'reports'; 
}

const TLDashboard: React.FC<TLDashboardProps> = ({ store, currentView }) => {
  const { state, assignToMember, updateMemberAssignment, acknowledgeMemberWork, updateGroupAssignment, deleteMemberAssignment } = store;

  const [filterTab, setFilterTab] = useState('ongoing'); 
  const [searchQuery, setSearchQuery] = useState(''); 
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  
  useEffect(() => { setActiveGroupId(null); }, [filterTab, currentView]);

  const activeGroup = state.groupAssignments.find((g: GroupAssignment) => g.id === activeGroupId) || null;
  const myTeamId = state.currentUser?.teamId;

  // Modal State
  const [showAlloc, setShowAlloc] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState<number|null>(null);
  const [reviewData, setReviewData] = useState<MemberAssignment | null>(null);
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [viewRejection, setViewRejection] = useState<MemberAssignment | null>(null);

  // Forms
  const getLocalISO = () => { const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); return now.toISOString().slice(0, 16); };
  const [allocForm, setAllocForm] = useState({ memberId: '', assignedTime: getLocalISO(), eta: '' });
  const [allocScope, setAllocScope] = useState<ScopeItem[]>([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, overrideBlackmark: false });

  // ----------------------------------------------------------------------
  // HELPERS
  // ----------------------------------------------------------------------

  // Availability Label Generator (For Members)
  const getAvailabilityLabel = (id: number) => {
      const availMap = state.availability?.members || {};
      const freeAt = availMap[id];

      if (!freeAt) return "🟢 Available Now";

      const freeDate = new Date(freeAt);
      const now = new Date();

      if (freeDate <= now) return "🟢 Available Now";

      const hoursLeft = (freeDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      if (hoursLeft < 24) {
          return `🟡 Free at ${freeDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      } else {
          return `🔴 Busy until ${freeDate.toLocaleDateString()}`;
      }
  };

  const toggleAllocScope = (div: string, part: string, wt: string) => {
      setAllocScope(prev => {
          const newScope = JSON.parse(JSON.stringify(prev));
          let divItem = newScope.find((s: ScopeItem) => s.division === div);
          if (!divItem) { divItem = { division: div, parts: [] }; newScope.push(divItem); }
          let partItem = divItem.parts.find((p: any) => p.name === part);
          if (!partItem) { partItem = { name: part, workTypes: [] }; divItem.parts.push(partItem); }
          if (partItem.workTypes.includes(wt)) {
              partItem.workTypes = partItem.workTypes.filter((w: string) => w !== wt);
              if (partItem.workTypes.length === 0) divItem.parts = divItem.parts.filter((p: any) => p.name !== part);
              if (divItem.parts.length === 0) { const idx = newScope.indexOf(divItem); newScope.splice(idx, 1); }
          } else { partItem.workTypes.push(wt); }
          return newScope;
      });
  };
  const isAllocSelected = (div: string, part: string, wt: string) => allocScope.some(s => s.division === div && s.parts.some(p => p.name === part && p.workTypes.includes(wt)));


  const isItemComplete = (ga: GroupAssignment, div: string, part: string, wt: string) => {
        const relevantAssignments = state.memberAssignments.filter((ma: MemberAssignment) => 
            ma.groupAssignmentId === ga.id && 
            ma.status !== 'REJECTED' && 
            ma.scope?.some(s => s.division === div && s.parts.some(p => p.name === part && p.workTypes.includes(wt)))
        );

        if (relevantAssignments.length === 0) return false;
        return relevantAssignments.every(ma => ma.status === 'COMPLETED');
    };

 const isItemAllocated = (ga: GroupAssignment, div: string, part: string, wt: string) => {
        return state.memberAssignments.some((ma: MemberAssignment) => 
            ma.groupAssignmentId === ga.id && 
            ma.status !== 'REJECTED' &&
            ma.scope?.some(s => s.division === div && s.parts.some(p => p.name === part && p.workTypes.includes(wt)))
        );
    };

  const getGroupStats = (ga: GroupAssignment) => {
      let total = 0; let done = 0; let allocated = 0;
      ga.scope?.forEach(s => s.parts.forEach(p => p.workTypes.forEach(wt => {
          total++;
          if (isItemComplete(ga, s.division, p.name, wt)) done++;
          if (isItemAllocated(ga, s.division, p.name, wt)) allocated++;
      })));
      return { 
          progress: total > 0 ? Math.round((done / total) * 100) : 0, 
          allocation: total > 0 ? Math.round((allocated / total) * 100) : 0,
          isFullyComplete: total > 0 && done === total,
          totalWorkUnits: total 
      };
  };

  // Inside TLDashboard.tsx

const getFilteredGroups = () => {
  return state.groupAssignments.filter((ga: GroupAssignment) => {
     if (ga.teamId !== myTeamId) return false;
     const proj = state.projects.find(p => p.id === ga.projectId);
     
     // Check if any member under this group has submitted work (Waiting for TL)
     const hasPendingMembers = state.memberAssignments.some((ma: MemberAssignment) => 
        ma.groupAssignmentId === ga.id && ma.status === 'PENDING_ACK'
     );

     // Check if the group itself is submitted (Waiting for PM)
     const isPendingPM = ga.status === 'PENDING_ACK';

     let tabMatch = false;
     if (filterTab === 'hold') tabMatch = proj?.status === 'ON_HOLD';
     else if (filterTab === 'completed') tabMatch = ga.status === 'COMPLETED';
     else if (filterTab === 'rejected') tabMatch = ga.status === 'REJECTION_REQ' || ga.status === 'REJECTED';
     
     // 🟢 1. NEW PENDING LOGIC (Shows if EITHER condition is true)
     else if (filterTab === 'pending') tabMatch = hasPendingMembers || isPendingPM;

     // 🟢 2. ONGOING (Keep as is, or exclude purely pending items if desired. 
     // Usually, TLs want to see the project in "Ongoing" too if other members are still working)
     else if (filterTab === 'ongoing') tabMatch = ga.status !== 'COMPLETED' && ga.status !== 'REJECTED' && proj?.status !== 'ON_HOLD';
     
     else if (filterTab === 'recent') tabMatch = ga.status === 'COMPLETED' && new Date(ga.completionTime!) > new Date(Date.now() - 86400000);
     
     if (!tabMatch) return false;
     if (searchQuery.trim()) return proj?.name.toLowerCase().includes(searchQuery.toLowerCase());
     return true;
  });
};

const pendingReviewCount = state.memberAssignments.filter((ma: MemberAssignment) => {
    // We need to find the parent group assignment to verify it belongs to my team
    const parentGA = state.groupAssignments.find((g: GroupAssignment) => g.id === ma.groupAssignmentId);
    return parentGA?.teamId === myTeamId && ma.status === 'PENDING_ACK';
}).length;


  const handleAllocSubmit = () => {
      // VALIDATION 1: Mandatory Fields
      if (!allocForm.memberId || !allocForm.eta || allocScope.length === 0) {
          alert("⚠️ Missing Information!\n\nPlease ensure you have selected:\n- A Member\n- At least one Scope Item\n- An ETA");
          return;
      }

      // VALIDATION 2: ETA Check (Member ETA <= Team ETA)
      if (activeGroup && allocForm.eta) {
          const memberEta = new Date(allocForm.eta);
          const teamEta = new Date(activeGroup.eta);

          if (memberEta > teamEta) {
              alert(`⚠️ Invalid ETA!\n\nThe Member ETA cannot be later than the Team deadline.\nTeam Deadline: ${teamEta.toLocaleString()}`);
              return;
          }
      }

      const payload = { ...allocForm, groupAssignmentId: activeGroup!.id, memberId: parseInt(allocForm.memberId), scope: allocScope };
      if (editMode && editId) { 
          updateMemberAssignment(editId, payload); 
          setEditMode(false); 
          setEditId(null); 
      } else { 
          assignToMember(payload); 
      }
      setShowAlloc(false); 
      setAllocScope([]);
  };

  const handleRevokeSubmission = (ma: MemberAssignment) => {
    const reason = prompt("Enter reason for revoking (this will send it back to the member):");
    if(reason) {
        updateMemberAssignment(ma.id, { 
            status: 'IN_PROGRESS', // <--- KEY FIX: Makes it visible to member again
            rejectionReason: reason 
        });
    }
};

  const openEdit = (ma: MemberAssignment) => { 
      setAllocForm({ memberId: String(ma.memberId), assignedTime: ma.assignedTime, eta: ma.eta }); 
      setAllocScope(ma.scope || []);
      setEditId(ma.id); setEditMode(true); setShowAlloc(true); 
  };

  if (currentView === 'home') return <StatsView stats={state.stats} role="TEAM_LEAD" userName={state.currentUser?.name} />;
  if (currentView === 'reports') return <ReportGenerator store={store} role="TEAM_LEAD" />;

  const activeStats = activeGroup ? getGroupStats(activeGroup) : null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide shrink-0">Work Orders</h2>
             <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                 {['ongoing','pending', 'recent', 'completed', 'hold', 'rejected'].map(t => (
                     <button key={t} onClick={()=>setFilterTab(t)} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all whitespace-nowrap ${filterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t}
                     {t === 'pending' && pendingReviewCount > 0 && (
                        <span className="ml-1 bg-amber-500 text-white text-[8px] px-1.5 py-0.5 rounded-full shadow-sm">
                            {pendingReviewCount}
                        </span>
                    )}
                    </button>
                 ))}
             </div>
         </div>
         <div className="relative w-full md:w-auto">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input placeholder="Filter work..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-full md:w-64 outline-none focus:ring-2 focus:ring-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
         </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
         {/* LIST COLUMN (LEFT) */}
         <div className={`${activeGroupId ? 'hidden lg:block' : 'block'} lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto max-h-[75vh]`}>
             {getFilteredGroups().map((ga: GroupAssignment) => {
                 const stats = getGroupStats(ga); 
                 return (
                     <div key={ga.id} onClick={()=>setActiveGroupId(ga.id)} className={`p-5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${activeGroup?.id===ga.id?'bg-indigo-50/50 border-l-4 border-l-indigo-600':''}`}>
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h3 className={`font-bold text-sm ${activeGroup?.id===ga.id?'text-indigo-900':'text-slate-700'}`}>{state.projects.find(p=>p.id===ga.projectId)?.name}</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">{ga.fileSize} • {new Date(ga.eta).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${ga.status==='COMPLETED'?'bg-green-100 text-green-700':ga.status==='REJECTED'?'bg-red-100 text-red-600':'bg-amber-100 text-amber-700'}`}>{ga.status.replace('_', ' ')}</span>
                        </div>
                        
                        <div className="space-y-2 mt-3">
                            <div>
                                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-0.5">
                                    <span>Allocated</span><span>{stats.allocation}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div style={{width: `${stats.allocation}%`}} className="h-full bg-indigo-400 rounded-full"></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-0.5">
                                    <span>Completed</span><span>{stats.progress}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div style={{width: `${stats.progress}%`}} className="h-full bg-green-500 rounded-full"></div>
                                </div>
                            </div>
                        </div>
                     </div>
                 );
             })}
         </div>

         {/* DETAILS COLUMN (RIGHT) */}
         <div className={`${!activeGroupId ? 'hidden lg:block' : 'block'} lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]`}>
             {activeGroup ? (
                 <>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-100 pb-4 gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => setActiveGroupId(null)} className="lg:hidden text-slate-400 hover:text-slate-600">
                                <i className="fas fa-arrow-left text-xl"></i>
                            </button>
                            <h2 className="text-xl font-black text-slate-900">{state.projects.find(p=>p.id===activeGroup.projectId)?.name}</h2>
                        </div>
                       <div className="flex flex-wrap gap-2 mt-2">
                        {/* File Size Badge */}
                        <span className="text-xs bg-slate-800 text-white px-2 py-0.5 rounded font-bold">
                            <i className="fas fa-file mr-1"></i>
                            {activeGroup.fileSize || 'No File'}
                        </span>

                        {/* Start Date */}
                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-bold text-slate-600">
                            Start: {new Date(activeGroup.assignedTime).toLocaleDateString()}
                        </span>

                        {/* ETA */}
                        <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold border border-amber-100">
                            ETA: {new Date(activeGroup.eta).toLocaleString()}
                        </span>
                    </div>
                       <div className="flex gap-2">
                          {(() => {
                              const hasActiveAllocations = state.memberAssignments.some((ma: MemberAssignment) => ma.groupAssignmentId === activeGroup.id && ma.status !== 'REJECTED');
                              const isSubmittedOrDone = activeGroup.status === 'COMPLETED' || activeGroup.status === 'PENDING_ACK';
                              
                              return (
                                <>
                                    {/* 1. REJECT / REVOKE PROJECT */}
                                    {filterTab !== 'completed' && !isSubmittedOrDone && activeGroup.status !== 'REJECTED' && (
                                        activeGroup.status === 'REJECTION_REQ' ? (
                                            <button 
                                                onClick={() => updateGroupAssignment(activeGroup.id, {status: 'IN_PROGRESS', rejectionReason: null})} 
                                                className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-100"
                                            >
                                                Revoke Rejection
                                            </button>
                                        ) : (
                                            <button 
                                                disabled={hasActiveAllocations}
                                                onClick={()=>{const r=prompt('Rejection Reason'); if(r) updateGroupAssignment(activeGroup.id, {status: 'REJECTION_REQ', rejectionReason: r})}} 
                                                className={`px-4 py-2 rounded-xl text-xs font-black uppercase border ${hasActiveAllocations ? 'bg-slate-100 text-slate-400 border-transparent cursor-not-allowed' : 'bg-white border-red-200 text-red-600 hover:bg-red-50'}`}
                                                title={hasActiveAllocations ? "Cannot reject while members have active tasks" : "Reject this project"}
                                            >
                                                Reject
                                            </button>
                                        )
                                    )}

                                    {/* 2. ALLOCATE MEMBER */}
                                    {activeGroup.status !== 'REJECTED' && activeGroup.status !== 'REJECTION_REQ' && (
                                        <button 
                                            disabled={isSubmittedOrDone}
                                            onClick={()=>{setEditMode(false); setEditId(null); setAllocForm({...allocForm, memberId: ''}); setAllocScope([]); setShowAlloc(true);}} 
                                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg ${isSubmittedOrDone ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'}`}
                                        >
                                            Allocate Member
                                        </button>
                                    )}
                                    
                                    {/* 3. SUBMIT TO PM / WAITING STATUS */}
                                    {activeGroup.status === 'PENDING_ACK' ? (
                                        <button 
                                            disabled 
                                            className="px-4 py-2 rounded-xl text-xs font-black uppercase bg-amber-100 text-amber-600 border border-amber-200 cursor-not-allowed shadow-sm"
                                        >
                                            <i className="fas fa-hourglass-half mr-1"></i> Waiting PM Approval
                                        </button>
                                    ) : (
                                        activeStats?.isFullyComplete && !isSubmittedOrDone && (
                                            <button onClick={()=>updateGroupAssignment(activeGroup!.id, {status: 'PENDING_ACK', completionTime: new Date().toISOString()})} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase shadow-lg shadow-green-200 hover:bg-green-700">Submit to PM</button>
                                        )
                                    )}
                                </>
                              );
                          })()}
                       </div>
                    </div>

                {/* SCOPE DISPLAY */}
                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Scope Breakdown</h4>
                    {activeGroup && activeGroup.scope ? activeGroup.scope.map((s, idx) => (
                        <div key={idx} className="mb-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <div className="text-xs font-black text-indigo-900 mb-2 border-b pb-1">{s.division}</div>
                            <div className="flex flex-wrap gap-4">
                                {s.parts.map((p, pIdx) => (
                                    <div key={pIdx} className="flex flex-col gap-1 min-w-[50px]">
                                        <span className="text-[9px] font-bold text-slate-500">{p.name}</span>
                                        <div className="flex flex-wrap gap-1">
                                            {p.workTypes.map(wt => {
                                                const complete = isItemComplete(activeGroup, s.division, p.name, wt);
                                                const allocated = isItemAllocated(activeGroup, s.division, p.name, wt);
                                                const color = complete ? 'bg-green-500 text-white border-green-600' : allocated ? 'bg-amber-400 text-white border-amber-500' : 'bg-slate-200 text-slate-400 border-slate-300';
                                                return <span key={wt} className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${color}`}>{wt.substring(0,2).toUpperCase()}</span>;
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )) : <p className="text-xs text-slate-400 italic">No scope allocated.</p>}
                </div>

                    {/* MEMBER TABLE (Corrected) */}
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar border border-slate-100 rounded-xl relative">
                        <table className="w-full text-left text-xs border-collapse">
                           <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-3 bg-slate-50">Member</th>
                                    <th className="p-3 bg-slate-50">Scope</th>
                                    <th className="p-3 bg-slate-50">Assigned</th>
                                    <th className="p-3 bg-slate-50">ETA</th> 
                                    <th className="p-3 bg-slate-50">Status</th>
                                    <th className="p-3 text-right bg-slate-50">Actions</th>
                                </tr>
                            </thead>
                           <tbody className="divide-y divide-slate-50">
                            {state.memberAssignments.filter((ma: MemberAssignment) => ma.groupAssignmentId === activeGroup!.id).map((ma: MemberAssignment) => {
                                return (
                                    <tr key={ma.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-bold text-slate-900 align-top">{state.users.find((u: User)=>u.id===ma.memberId)?.name}</td>
                                        
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar min-w-[200px]">
                                                {ma.scope && ma.scope.length > 0 ? ma.scope.map((s, sIdx) => (
                                                    <div key={sIdx} className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-black text-indigo-900 border-b border-slate-100 pb-0.5 mb-0.5">
                                                            {s.division}
                                                        </span>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 pl-1">
                                                            {s.parts.map((p, pIdx) => (
                                                                <div key={pIdx} className="flex items-center gap-1">
                                                                    <span className="text-[9px] font-bold text-slate-500">{p.name}:</span>
                                                                    <div className="flex gap-0.5">
                                                                        {p.workTypes.map(wt => (
                                                                            <span 
                                                                                key={wt} 
                                                                                className={`px-1 rounded border text-[8px] font-bold ${
                                                                                    ma.status === 'COMPLETED' 
                                                                                        ? 'bg-green-500 text-white border-green-600'
                                                                                        : 'bg-amber-400 text-white border-amber-500'
                                                                                }`}
                                                                            >
                                                                                {wt}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <span className="text-xs text-slate-300">-</span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="p-3 text-xs text-slate-500 align-top">
                                            <div className="flex flex-col">
                                                <span>{new Date(ma.assignedTime).toLocaleDateString()}</span>
                                                <span className="text-[10px] text-slate-400">{new Date(ma.assignedTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-xs text-amber-600 font-bold align-top">{new Date(ma.eta).toLocaleString()}</td>
                                        
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col items-start">
                                                <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                                                    ma.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 
                                                    ma.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 
                                                    'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {ma.status.replace('_', ' ')}
                                                </span>

                                                {/* SHOW COMPLETION TIME & LATE INDICATOR */}
                                                {ma.status === 'COMPLETED' && ma.completionTime && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-[9px] text-green-600 font-bold">
                                                            Done: {new Date(ma.completionTime).toLocaleString()}
                                                        </span>
                                                        
                                                        {/* LOGIC: Only show if Completion Time is AFTER the ETA */}
                                                        {new Date(ma.completionTime) > new Date(ma.eta) && (
                                                            <span className="text-[8px] px-1 py-0.5 bg-red-100 text-red-600 border border-red-200 rounded font-bold" title="Submitted Late">
                                                                <i className="fas fa-exclamation-circle"></i> Late
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        
                                        <td className="p-3 text-right flex justify-end gap-2 items-start align-top">
                                            {ma.status === 'COMPLETED' && ma.screenshot && (
                                                <button 
                                                    onClick={() => setViewScreenshot(`/${ma.screenshot}`)}
                                                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[9px] font-bold border border-blue-100 bg-blue-50 px-2 py-1 rounded transition-colors mr-1"
                                                >
                                                    <i className="fas fa-image"></i> Proof
                                                </button>
                                            )}

                                            {ma.status === 'REJECTION_REQ' && (
                                                <>
                                                    {/* 🟢 CHANGE: Open Modal instead of confirm() */}
                                                    <button 
                                                        onClick={() => setViewRejection(ma)} 
                                                        className="bg-red-500 text-white px-2 py-1 rounded text-[9px] font-bold hover:bg-red-600"
                                                    >
                                                        Review Rejection
                                                    </button>
                                                    
                                                    <button 
                                                        onClick={() => updateMemberAssignment(ma.id, { status: 'IN_PROGRESS', rejectionReason: null })} 
                                                        className="bg-white border border-slate-300 text-slate-500 px-2 py-1 rounded text-[9px] font-bold hover:bg-slate-50"
                                                    >
                                                        Revoke
                                                    </button>
                                                </>
                                            )}

                                            {ma.status === 'PENDING_ACK' && (
                                                <>
                                                    <button onClick={()=>setReviewData(ma)} className="bg-green-600 text-white px-2 py-1 rounded text-[9px] font-bold">Review</button>
                                                    <button onClick={()=>handleRevokeSubmission(ma)} className="bg-red-50 text-red-600 px-2 py-1 rounded text-[9px] font-bold border border-red-100">Revoke</button>
                                                </>
                                            )}
                                            
                                            {/* Fix: Strictly exclude Edit/Delete if status is COMPLETED, REJECTED, REJECTION_REQ, or PENDING_ACK */}
                                            {ma.status !== 'COMPLETED' && ma.status !== 'REJECTED' && ma.status !== 'REJECTION_REQ' && ma.status !== 'PENDING_ACK' && (
                                                <>
                                                    <button onClick={()=>openEdit(ma)} className="text-slate-400 hover:text-indigo-600"><i className="fas fa-edit"></i></button>
                                                    <button onClick={()=>{if(window.confirm('Delete?')) deleteMemberAssignment(ma.id)}} className="text-slate-300 hover:text-red-500 ml-2"><i className="fas fa-trash"></i></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        </table>
                    </div>
                 </>
             ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                    <i className="fas fa-clipboard-list text-5xl mb-4"></i>
                    <p className="text-sm font-bold italic">Select a work order.</p>
                </div>
             )}
         </div>
      </div>
      {/* 🔴 REJECTION REVIEW MODAL (TL) */}
        {viewRejection && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
                <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
                    <h3 className="text-lg font-black text-slate-900 mb-2">Review Rejection Request</h3>
                    
                    <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6">
                        <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Reason from Member</p>
                        <p className="text-sm font-bold text-red-800 italic">
                            "{viewRejection.rejectionReason || 'No reason provided.'}"
                        </p>
                    </div>

                    <p className="text-xs text-slate-500 mb-6">
                        By accepting, this scope will be marked as <span className="font-bold text-red-500">REJECTED</span> and will become unallocated in your dashboard. You can then re-assign it to someone else.
                    </p>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => {
                                updateMemberAssignment(viewRejection.id, { status: 'REJECTED' });
                                setViewRejection(null);
                            }} 
                            className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-red-100 hover:bg-red-700"
                        >
                            Accept Rejection
                        </button>
                        <button 
                            onClick={() => setViewRejection(null)} 
                            className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-xs uppercase hover:bg-slate-200"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}

      {/* ALLOC MODAL */}
      {showAlloc && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
             <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
                <h2 className="text-xl font-black mb-4">{editMode ? 'Edit Task' : 'Assign Task'}</h2>
                <div className="space-y-4">
                    <select className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={allocForm.memberId} onChange={e=>setAllocForm({...allocForm, memberId: e.target.value})} disabled={editMode}>
                       <option value="">Select Member</option>
                       {state.users.filter((u: any)=>u.teamId===myTeamId && u.roles.includes('MEMBER'))
                            .sort((a: any, b: any) => {
                                const dateA = state.availability?.members[a.id] || 0;
                                const dateB = state.availability?.members[b.id] || 0;
                                if (dateA === 0 && dateB !== 0) return -1;
                                if (dateA !== 0 && dateB === 0) return 1;
                                return new Date(dateA).getTime() - new Date(dateB).getTime();
                            })
                            .map((u: any)=>(
                            <option key={u.id} value={u.id}>
                                {u.name} ({getAvailabilityLabel(u.id)})
                            </option>
                        ))}
                    </select>
                    {editMode && (
                        <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                            <i className="fas fa-lock"></i>
                            Member is locked. To re-assign, please delete this task and create a new one.
                        </p>
                    )}
                    
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 max-h-60 overflow-y-auto custom-scrollbar">
                        <h3 className="font-bold text-xs uppercase mb-3 text-slate-500">Select Scope Subset</h3>
                        {activeGroup?.scope?.map(s => (
                            <div key={s.division} className="mb-2 bg-white p-2 rounded border">
                                <p className="text-xs font-bold text-indigo-900">{s.division}</p>
                                <div className="pl-2">
                                    {s.parts.map(p => (
                                        <div key={p.name} className="flex flex-wrap gap-2 text-xs items-center mb-1">
                                            <span className="font-bold text-slate-600 min-w-[40px]">{p.name}:</span>
                                            {p.workTypes.map(wt => {
                                                // 1. Check Status in Database
                                                const existingMA = state.memberAssignments.find((ma: MemberAssignment) => 
                                                    ma.groupAssignmentId === activeGroup!.id &&
                                                    ma.id !== editId && // Ignore self if editing
                                                    ma.scope?.some((sc: any) => 
                                                        sc.division === s.division && 
                                                        sc.parts.some((pt: any) => pt.name === p.name && pt.workTypes.includes(wt))
                                                    )
                                                );
                                                
                                                const isAllocated = !!existingMA;
                                                const isCompleted = existingMA?.status === 'COMPLETED';
                                                const isSelected = isAllocSelected(s.division, p.name, wt);

                                                // 2. Dynamic Styling
                                                let btnStyle = "px-1.5 py-0.5 border rounded text-[9px] transition-all font-bold flex items-center gap-1 ";
                                                
                                                if (isSelected) {
                                                    if (isCompleted) btnStyle += "bg-blue-600 text-white border-green-400 border-2 shadow-sm"; // Blue w/ Green Border
                                                    else if (isAllocated) btnStyle += "bg-blue-600 text-white border-yellow-400 border-2 shadow-sm"; // Blue w/ Yellow Border
                                                    else btnStyle += "bg-indigo-600 text-white border-indigo-600"; // Standard Blue
                                                } else {
                                                    if (isCompleted) btnStyle += "bg-green-100 text-green-700 border-green-200";
                                                    else if (isAllocated) btnStyle += "bg-yellow-50 text-yellow-700 border-yellow-200";
                                                    else btnStyle += "bg-white text-slate-400 border-slate-200";
                                                }

                                                return (
                                                    <button 
                                                        key={wt} 
                                                        onClick={()=>toggleAllocScope(s.division, p.name, wt)} 
                                                        className={btnStyle}
                                                        title={existingMA ? `Assigned to ${state.users.find((u:any)=>u.id===existingMA.memberId)?.name}` : "Available"}
                                                    >
                                                        {wt}
                                                        {/* Status Icons */}
                                                        {!isSelected && isCompleted && <i className="fas fa-check text-[7px]"></i>}
                                                        {!isSelected && isAllocated && <i className="fas fa-user text-[7px]"></i>}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] uppercase text-slate-400 font-black">Start</label>
                            <input 
                                type="datetime-local" 
                                className="w-full border-2 border-slate-100 p-2 rounded-xl text-xs font-bold" 
                                value={allocForm.assignedTime} 
                                onChange={e=>setAllocForm({...allocForm, assignedTime: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] uppercase text-slate-400 font-black">ETA</label>
                            <input 
                                type="datetime-local" 
                                className="w-full border-2 border-slate-100 p-2 rounded-xl text-xs font-bold" 
                                value={allocForm.eta} 
                                onChange={e=>setAllocForm({...allocForm, eta: e.target.value})}
                                max={activeGroup?.eta ? new Date(activeGroup.eta).toISOString().slice(0, 16) : undefined}
                            />
                        </div>
                    </div>
                    <button onClick={handleAllocSubmit} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:bg-indigo-700">Confirm</button>
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
                
                {reviewData.screenshot && (
                    <div className="mb-4 text-center">
                        <button 
                            onClick={() => setViewScreenshot(`/${reviewData.screenshot}`)} 
                            className="text-blue-600 text-xs font-bold underline"
                        >
                            <i className="fas fa-image mr-1"></i>View Proof Screenshot
                        </button>
                    </div>
                )}
                {reviewData.completionTime && new Date(reviewData.completionTime) > new Date(reviewData.eta) && (
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

      {/* ADVANCED SCREENSHOT VIEWER (Unified Toolbar) */}
      {viewScreenshot && (
          <div 
            className="fixed inset-0 z-[9999] bg-black/95 flex flex-col justify-center items-center animate-fadeIn" 
            onClick={() => setViewScreenshot(null)}
          >
              {/* Single Top-Right Toolbar containing ALL controls */}
              <div className="absolute top-5 right-5 flex gap-3 z-50" onClick={(e) => e.stopPropagation()}>
                  
                  {/* Download */}
                  <a 
                    href={viewScreenshot} 
                    download="proof.jpg" 
                    className="text-white bg-white/20 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/30 backdrop-blur-sm transition-all" 
                    title="Download"
                  >
                      <i className="fas fa-download"></i>
                  </a>

                  {/* Zoom In */}
                  <button 
                    onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))} 
                    className="text-white bg-white/20 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/30 backdrop-blur-sm transition-all" 
                    title="Zoom In"
                  >
                      <i className="fas fa-search-plus"></i>
                  </button>

                  {/* Zoom Out */}
                  <button 
                    onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))} 
                    className="text-white bg-white/20 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/30 backdrop-blur-sm transition-all" 
                    title="Zoom Out"
                  >
                      <i className="fas fa-search-minus"></i>
                  </button>

                  {/* Close */}
                  <button 
                    onClick={() => setViewScreenshot(null)} 
                    className="text-white bg-red-500/80 w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-600 backdrop-blur-sm transition-all" 
                    title="Close"
                  >
                      <i className="fas fa-times"></i>
                  </button>
              </div>

              {/* Image Container */}
              <div className="w-full h-full flex items-center justify-center p-4 overflow-hidden">
                  <img 
                      src={viewScreenshot} 
                      style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s ease-out' }} 
                      className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl" 
                      alt="Proof" 
                      onClick={(e) => e.stopPropagation()} 
                  />
              </div>
          </div>
      )}
    </div>
  );
};

export default TLDashboard;