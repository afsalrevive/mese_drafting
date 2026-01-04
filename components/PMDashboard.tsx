import React, { useState, useEffect } from 'react';
import { Project, GroupAssignment, MemberAssignment } from '../types';
import { StatsView, ReportGenerator } from './StatsAndReports';

interface PMDashboardProps { 
    store: any; 
    currentView: 'home' | 'projects' | 'reports'; 
}

const PMDashboard: React.FC<PMDashboardProps> = ({ store, currentView }) => {
  const { 
    state, 
    createProject, 
    updateProject, 
    deleteProject, 
    toggleProjectHold, 
    triggerRework, 
    assignToGroup, 
    updateGroupAssignment, 
    deleteGroupAssignment,
    revokeGroupWork,
    revokeGroupRejection
  } = store;

  // ----------------------------------------------------------------------
  // STATE MANAGEMENT
  // ----------------------------------------------------------------------
  const [filterTab, setFilterTab] = useState('ongoing'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  // Split Screen Selection
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const activeProject = state.projects.find((p: Project) => p.id === activeProjectId) || null;

  // Reset selection when changing main views or tabs
  useEffect(() => {
      setActiveProjectId(null);
  }, [filterTab, currentView]);

  // Modal Visibility
  const [showAddProject, setShowAddProject] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [showRework, setShowRework] = useState(false);
  
  // Modal Data/IDs
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [trackerId, setTrackerId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);

  // Forms
  const [reviewForm, setReviewForm] = useState({ 
      rating: 5, 
      overrideBlackmark: false 
  });
  
  const [projForm, setProjForm] = useState({ 
    name: '', 
    date: new Date().toISOString().split('T')[0], 
    divisions: [] as string[], 
    partNos: [] as string[], 
    workTypes: [] as string[], 
    // Generator Fields
    newDivPrefix: '', newDivCount: '', newDivStart: '1',
    newPartPrefix: '', newPartCount: '', newPartStart: '1',
    // Manual Fields
    manualDiv: '', manualPart: ''
  });
  
  const [allocForm, setAllocForm] = useState({ 
    projectId: '', 
    teamId: '', 
    workTypes: [] as string[], 
    divisions: [] as string[], 
    partNos: [] as string[], 
    fileSize: '', 
    eta: '', 
    assignedTime: '' 
  });

  // ----------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ----------------------------------------------------------------------

  const toggleList = (list: string[], item: string) => 
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  
  const generateItems = (prefix: string, count: string, start: string) => {
    const c = parseInt(count) || 0;
    const s = parseInt(start) || 1;
    if (!prefix || c <= 0) return [];
    return Array.from({ length: c }, (_, i) => `${prefix}${s + i}`);
  };

  /**
   * GRANULAR COMPLETION CHECKER
   * Determines if a specific scope item (Division, Part, or WorkType) 
   * is fully completed for a given Group Allocation.
   * * Logic: "Complete" means every required combination involving this item
   * has been marked COMPLETED by a member.
   */
  const isItemComplete = (ga: GroupAssignment, type: 'div' | 'part' | 'wt', value: string) => {
      // Get all completed work for this team allocation
      const completedMAs = state.memberAssignments.filter((ma: MemberAssignment) => 
          ma.groupAssignmentId === ga.id && ma.status === 'COMPLETED'
      );
      
      // Determine the requirement set
      // If checking Division 'D1', we must check against ALL assigned Parts and WorkTypes
      const reqDivs = type === 'div' ? [value] : ga.divisions;
      const reqParts = type === 'part' ? [value] : ga.partNos;
      const reqWTs = type === 'wt' ? [value] : ga.workTypes;

      // Cartesian Product Check
      return reqDivs.every(d => 
          reqParts.every(p => 
              reqWTs.every(wt => 
                  completedMAs.some((ma: MemberAssignment) => 
                      ma.divisions.includes(d) && 
                      ma.partNos.includes(p) && 
                      ma.workTypes.includes(wt)
                  )
              )
          )
      );
  };

  /**
   * PROJECT LEVEL COMPLETION CHECKER
   * Checks if an item is complete across ALL teams assigned to the project.
   * Used for the summary list on the left.
   */
  const isProjectItemComplete = (projectId: number, type: 'div' | 'part' | 'wt', value: string) => {
      const projectGAs = state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === projectId);
      
      // 1. Find teams that were actually assigned this item
      const relevantGAs = projectGAs.filter((ga: GroupAssignment) => 
          (type === 'div' && ga.divisions.includes(value)) ||
          (type === 'part' && ga.partNos.includes(value)) ||
          (type === 'wt' && ga.workTypes.includes(value))
      );

      // If no team was assigned this item yet, it's not complete.
      if (relevantGAs.length === 0) return false; 

      // 2. Check if EVERY assigned team has completed it
      return relevantGAs.every((ga: GroupAssignment) => isItemComplete(ga, type, value));
  };

  const getProjectStats = (p: Project) => {
    const totalUnits = p.divisions.length * p.partNos.length * p.workTypes.length;
    const assigns = state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === p.id);
    let completedUnits = 0;
    let allocatedUnits = 0;

    assigns.forEach(ga => {
       const units = ga.divisions.length * ga.partNos.length * ga.workTypes.length;
       allocatedUnits += units;
       if (ga.status === 'COMPLETED') {
         completedUnits += units;
       } else {
           // Calculate partial progress based on member completion
           const members = state.memberAssignments.filter(ma => ma.groupAssignmentId === ga.id);
           const memDone = members.filter(m => m.status === 'COMPLETED').length;
           if (members.length > 0) {
             completedUnits += (memDone / members.length) * units;
           }
       }
    });

    return {
      progress: totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0,
      allocated: totalUnits > 0 ? Math.round((allocatedUnits / totalUnits) * 100) : 0
    };
  };

  const getFilteredProjects = () => {
    return state.projects.filter(p => {
        const stats = getProjectStats(p);
        let tabMatch = false;
        
        if (filterTab === 'hold') tabMatch = p.status === 'ON_HOLD';
        else if (filterTab === 'completed') tabMatch = stats.progress >= 100 && p.status !== 'ON_HOLD';
        else if (filterTab === 'ongoing') tabMatch = stats.progress < 100 && p.status !== 'ON_HOLD';
        else if (filterTab === 'recent') tabMatch = stats.progress >= 100; 
        
        if (!tabMatch) return false;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const nameMatch = p.name.toLowerCase().includes(query);
            const teamMatch = state.groupAssignments
                .filter(ga => ga.projectId === p.id)
                .some(ga => state.teams.find(t => t.id === ga.teamId)?.name.toLowerCase().includes(query));
            return nameMatch || teamMatch;
        }
        return true;
    });
  };

  // ----------------------------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------------------------

  const handleGroupReject = (ga: GroupAssignment) => {
      if(window.confirm("Approve this Team Rejection? Status will become REJECTED.")) {
          updateGroupAssignment(ga.id, { status: 'REJECTED' });
      }
  };

  const openProjectEdit = (p: Project) => {
      setEditingProjectId(p.id);
      setProjForm({
          name: p.name,
          date: p.date,
          divisions: p.divisions,
          partNos: p.partNos,
          workTypes: p.workTypes,
          newDivPrefix: '', newDivCount: '', newDivStart: '1',
          newPartPrefix: '', newPartCount: '', newPartStart: '1',
          manualDiv: '', manualPart: ''
      });
      setShowAddProject(true);
  };

  const openRework = (p: Project) => {
      setAllocForm({ 
          projectId: String(p.id), 
          teamId: '', 
          workTypes: [], 
          divisions: [], 
          partNos: [], 
          fileSize: '', 
          eta: '', 
          assignedTime: '' 
      });
      setShowRework(true);
  };

  const openEditAlloc = (ga: GroupAssignment) => {
      setAllocForm({
         projectId: String(ga.projectId), teamId: String(ga.teamId),
         workTypes: ga.workTypes, divisions: ga.divisions, partNos: ga.partNos,
         fileSize: ga.fileSize, eta: ga.eta, assignedTime: ga.assignedTime
      });
      setEditId(ga.id);
      setShowDeploy(true);
  };

  // ----------------------------------------------------------------------
  // FORM HANDLERS
  // ----------------------------------------------------------------------

  const addGeneratedDivs = () => {
      const newItems = generateItems(projForm.newDivPrefix, projForm.newDivCount, projForm.newDivStart);
      if (newItems.length > 0) {
          setProjForm(prev => ({
              ...prev,
              divisions: Array.from(new Set([...prev.divisions, ...newItems])),
              newDivPrefix: '', newDivCount: '', newDivStart: '1'
          }));
      }
  };
  const addManualDiv = () => {
      if (projForm.manualDiv.trim()) {
          setProjForm(prev => ({
              ...prev,
              divisions: Array.from(new Set([...prev.divisions, projForm.manualDiv.trim()])),
              manualDiv: ''
          }));
      }
  };
  const removeDiv = (div: string) => {
      setProjForm(prev => ({ ...prev, divisions: prev.divisions.filter(d => d !== div) }));
  };

  const addGeneratedParts = () => {
      const newItems = generateItems(projForm.newPartPrefix, projForm.newPartCount, projForm.newPartStart);
      if (newItems.length > 0) {
          setProjForm(prev => ({
              ...prev,
              partNos: Array.from(new Set([...prev.partNos, ...newItems])),
              newPartPrefix: '', newPartCount: '', newPartStart: '1'
          }));
      }
  };
  const addManualPart = () => {
      if (projForm.manualPart.trim()) {
          setProjForm(prev => ({
              ...prev,
              partNos: Array.from(new Set([...prev.partNos, projForm.manualPart.trim()])),
              manualPart: ''
          }));
      }
  };
  const removePart = (part: string) => {
      setProjForm(prev => ({ ...prev, partNos: prev.partNos.filter(p => p !== part) }));
  };

  const handleProjectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { 
          name: projForm.name, 
          date: projForm.date, 
          divisions: projForm.divisions, 
          partNos: projForm.partNos, 
          workTypes: projForm.workTypes 
      };

      if (editingProjectId) {
          await updateProject(editingProjectId, payload);
      } else {
          await createProject(payload);
      }
      
      setShowAddProject(false);
      setEditingProjectId(null);
      setProjForm({ name: '', date: '', divisions: [], partNos: [], workTypes: [], newDivPrefix: '', newDivCount: '', newDivStart: '1', newPartPrefix: '', newPartCount: '', newPartStart: '1', manualDiv: '', manualPart: '' });
  };

  const handleDeploySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { ...allocForm, projectId: parseInt(allocForm.projectId), teamId: parseInt(allocForm.teamId) };
      if (editId) {
          updateGroupAssignment(editId, payload);
          setEditId(null);
      } else {
          assignToGroup(payload);
      }
      setShowDeploy(false);
      setAllocForm({ projectId: '', teamId: '', workTypes: [], divisions: [], partNos: [], fileSize: '', eta: '', assignedTime: '' });
  };

  const handleReworkSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await triggerRework({
          projectId: parseInt(allocForm.projectId),
          teamId: parseInt(allocForm.teamId),
          divisions: allocForm.divisions,
          partNos: allocForm.partNos,
          workTypes: allocForm.workTypes,
          assignedTime: allocForm.assignedTime,
          eta: allocForm.eta,
          fileSize: allocForm.fileSize
      });
      setShowRework(false);
      setAllocForm({ projectId: '', teamId: '', workTypes: [], divisions: [], partNos: [], fileSize: '', eta: '', assignedTime: '' });
  };

  // ----------------------------------------------------------------------
  // VIEW RENDER
  // ----------------------------------------------------------------------

  if (currentView === 'home') return <StatsView stats={state.stats} role="PROJECT_MANAGER" userName={state.currentUser?.name} />;
  if (currentView === 'reports') return <ReportGenerator store={store} role="PM" />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ----------------- TOP BAR ----------------- */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">Project Management</h2>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                 {['ongoing', 'recent', 'completed', 'hold'].map(t => (
                     <button 
                       key={t} 
                       onClick={()=>{setFilterTab(t); setActiveProjectId(null);}} 
                       className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                       {t}
                     </button>
                 ))}
             </div>
         </div>
        
        <div className="relative">
            <i className="fas fa-search absolute left-3 top-3 text-slate-400 text-xs"></i>
            <input 
                placeholder="Search Project or Team..." 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
         {/* ----------------- LEFT COLUMN: PROJECT LIST ----------------- */}
         <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto max-h-[75vh]">
             {getFilteredProjects().map((p: Project) => {
                 const stats = getProjectStats(p);
                 return (
                     <div key={p.id} onClick={()=>setActiveProjectId(p.id)} className={`p-5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${activeProjectId===p.id?'bg-indigo-50/50 border-l-4 border-l-indigo-600':''}`}>
                         
                         <div className="flex justify-between items-start mb-2">
                            <h3 className={`font-bold text-sm ${activeProjectId===p.id?'text-indigo-900':'text-slate-700'}`}>{p.name}</h3>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.status==='ON_HOLD'?'bg-amber-100 text-amber-700':stats.progress>=100?'bg-green-100 text-green-700':'bg-indigo-100 text-indigo-700'}`}>
                                {p.status.replace('_', ' ')}
                            </span>
                         </div>
                         
                         {/* PROJECT SUMMARY SCOPE VISUALIZER */}
                         <div className="flex flex-wrap gap-1 mt-2 mb-2">
                             {p.divisions.map(d => (
                                 <div 
                                    key={d} 
                                    className={`w-2 h-2 rounded-full transition-colors duration-500 ${isProjectItemComplete(p.id, 'div', d) ? 'bg-green-500' : 'bg-slate-200'}`} 
                                    title={`Div ${d} Status`}
                                 ></div>
                             ))}
                         </div>

                         <div className="space-y-2 mt-3">
                            <div>
                                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-1"><span>Allocated</span><span>{stats.allocated}%</span></div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                                    <div style={{width: `${stats.allocated}%`}} className="absolute h-full bg-slate-400 rounded-full transition-all duration-500"></div>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-1"><span>Completed</span><span>{stats.progress}%</span></div>
                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative">
                                    <div style={{width: `${stats.progress}%`}} className="absolute h-full bg-indigo-500 rounded-full transition-all duration-500"></div>
                                </div>
                            </div>
                         </div>
                     </div>
                 )
             })}
             
             {getFilteredProjects().length === 0 && (
                 <div className="p-10 flex flex-col items-center justify-center text-slate-300">
                     <i className="fas fa-folder-open text-4xl mb-4"></i>
                     <p className="text-sm font-bold italic">No projects found.</p>
                 </div>
             )}
         </div>

         {/* ----------------- RIGHT COLUMN: DETAILS ----------------- */}
         <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
             {activeProject ? (
                 <>
                     {/* PROJECT INFO */}
                     <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6 pb-6 border-b border-slate-100">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 mb-1">{activeProject.name}</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase">Created: {activeProject.date}</p>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => openProjectEdit(activeProject)} className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-colors"><i className="fas fa-edit mr-2"></i>Edit</button>
                            <button onClick={() => openRework(activeProject)} className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-orange-100 transition-colors"><i className="fas fa-tools mr-2"></i>Rework</button>
                            <button onClick={() => toggleProjectHold(activeProject.id, activeProject.status !== 'ON_HOLD')} className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-colors ${activeProject.status==='ON_HOLD' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {activeProject.status==='ON_HOLD'?'Resume':'Hold'}
                            </button>
                            <button onClick={() => { if(window.confirm('Delete this Project and all its data?')) deleteProject(activeProject.id) }} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-black uppercase hover:bg-red-100 transition-colors"><i className="fas fa-trash"></i></button>
                        </div>
                     </div>

                     {/* ALLOCATIONS ACTIONS */}
                     <div className="flex justify-between items-center mb-6">
                         <h3 className="font-bold text-slate-800">Team Allocations</h3>
                         <button 
                            onClick={() => {
                              setEditId(null); 
                              setAllocForm({ projectId: String(activeProject.id), teamId: '', workTypes: [], divisions: [], partNos: [], fileSize: '', eta: '', assignedTime: '' });
                              setShowDeploy(true);
                            }} 
                            className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-black uppercase shadow-lg hover:bg-indigo-700 shadow-indigo-200 transition-transform hover:scale-105"
                         >
                            Deploy New Team
                         </button>
                     </div>

                     {/* ALLOCATIONS LIST */}
                     <div className="space-y-4">
                        {state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === activeProject.id).map((ga: GroupAssignment) => (
                           <div key={ga.id} className={`p-5 rounded-2xl border transition-all ${ga.status==='REJECTED'?'bg-red-50 border-red-100':ga.status==='REJECTION_REQ'?'bg-orange-50 border-orange-100':'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}>
                              
                              <div className="flex justify-between items-center mb-3">
                                 <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-sm">
                                         {state.teams.find(t=>t.id===ga.teamId)?.name.charAt(0)}
                                     </div>
                                     <div>
                                         <p className="font-bold text-slate-900">{state.teams.find(t=>t.id===ga.teamId)?.name}</p>
                                         <p className="text-[10px] text-slate-500 font-bold uppercase">{ga.fileSize} • {new Date(ga.eta).toLocaleDateString()}</p>
                                     </div>
                                 </div>
                                 <div className="flex gap-1">
                                    <button onClick={()=>setTrackerId(ga.id)} className="bg-white border border-slate-200 text-blue-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-blue-50 shadow-sm transition-colors">Tracker</button>
                                    <button onClick={()=>openEditAlloc(ga)} className="bg-white border border-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-slate-50 shadow-sm transition-colors">Edit</button>
                                    <button onClick={() => { if(window.confirm('Delete this Allocation?')) deleteGroupAssignment(ga.id) }} className="bg-white border border-slate-200 text-red-500 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 shadow-sm transition-colors"><i className="fas fa-trash"></i></button>
                                 </div>
                              </div>

                              {/* VISUAL COMPLETION BADGES (Granular Green Fill) */}
                              <div className="flex flex-wrap gap-4 mb-4 bg-white p-3 rounded-xl border border-slate-100">
                                  <div className="flex flex-wrap gap-1 items-center">
                                      <span className="text-[9px] font-black text-slate-400 mr-1">DIVS:</span>
                                      {ga.divisions.map(d => (
                                          <span key={d} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors duration-500 ${isItemComplete(ga, 'div', d) ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                              {d}
                                          </span>
                                      ))}
                                  </div>
                                  <div className="flex flex-wrap gap-1 items-center">
                                      <span className="text-[9px] font-black text-slate-400 mr-1">PARTS:</span>
                                      {ga.partNos.map(p => (
                                          <span key={p} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors duration-500 ${isItemComplete(ga, 'part', p) ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                              {p}
                                          </span>
                                      ))}
                                  </div>
                                  <div className="flex flex-wrap gap-1 items-center">
                                      <span className="text-[9px] font-black text-slate-400 mr-1">WORK:</span>
                                      {ga.workTypes.map(w => (
                                          <span key={w} className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors duration-500 ${isItemComplete(ga, 'wt', w) ? 'bg-green-100 text-green-700 border-green-200 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                              {w}
                                          </span>
                                      ))}
                                  </div>
                              </div>

                              <div className="flex justify-between items-center">
                                 <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${
                                     ga.status==='REJECTED'?'bg-red-100 text-red-600':
                                     ga.status==='PENDING_ACK'?'bg-amber-100 text-amber-700':
                                     ga.status==='REJECTION_REQ'?'bg-orange-100 text-orange-600':
                                     ga.status==='COMPLETED'?'bg-green-100 text-green-700':
                                     'bg-slate-100 text-slate-500'
                                 }`}>
                                     Status: {ga.status.replace('_', ' ')}
                                 </span>
                                 
                                 <div className="flex gap-2">
                                     {ga.status === 'PENDING_ACK' && (
                                         <>
                                             <button onClick={()=>setReviewId(ga.id)} className="bg-green-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-lg hover:bg-green-700 transition-colors">Review Work</button>
                                             <button onClick={()=>{ if(window.confirm('Revoke Submission?')) revokeGroupWork(ga.id) }} className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-slate-300 transition-colors">Revoke</button>
                                         </>
                                     )}
                                     
                                     {ga.status === 'REJECTION_REQ' && (
                                         <>
                                             <button onClick={()=>handleGroupReject(ga)} className="bg-red-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold shadow-lg hover:bg-red-700 transition-colors">Confirm Reject</button>
                                             <button onClick={()=>{ if(window.confirm('Deny Request?')) revokeGroupRejection(ga.id) }} className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-slate-300 transition-colors">Revoke</button>
                                         </>
                                     )}
                                 </div>
                              </div>
                           </div>
                        ))}
                        
                        {state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === activeProject.id).length === 0 && (
                            <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400">
                                <p className="text-sm font-bold">No teams deployed yet.</p>
                            </div>
                        )}
                     </div>
                 </>
             ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-300">
                     <i className="fas fa-layer-group text-5xl mb-4 opacity-50"></i>
                     <p className="text-sm font-bold italic">Select a project to view details.</p>
                     <button 
                        onClick={() => {
                          setEditingProjectId(null);
                          setProjForm({ name: '', date: new Date().toISOString().split('T')[0], divisions: [], partNos: [], workTypes: [], newDivPrefix: '', newDivCount: '', newDivStart: '1', newPartPrefix: '', newPartCount: '', newPartStart: '1', manualDiv: '', manualPart: '' });
                          setShowAddProject(true);
                        }} 
                        className="mt-4 bg-slate-100 text-slate-600 px-6 py-2 rounded-xl text-xs font-black uppercase hover:bg-slate-200"
                      >
                        Create New Project
                      </button>
                 </div>
             )}
         </div>
      </div>

      {/* ----------------- MODALS ----------------- */}

      {/* TRACKER MODAL */}
      {trackerId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                 <div>
                     <h2 className="text-2xl font-black text-slate-900">Execution Tracker</h2>
                     <p className="text-xs text-slate-500 font-bold uppercase">{state.teams.find(t => t.id === state.groupAssignments.find(ga => ga.id === trackerId)?.teamId)?.name}</p>
                 </div>
                 <button onClick={()=>setTrackerId(null)} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-xl"></i></button>
             </div>
             <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider">
                    <tr>
                        <th className="p-3 rounded-l-lg">Member</th>
                        <th className="p-3">Scope</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Assigned</th>
                        <th className="p-3">ETA</th>
                        <th className="p-3 rounded-r-lg">Completion</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {state.memberAssignments.filter(ma => ma.groupAssignmentId === trackerId).map(ma => (
                        <tr key={ma.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{state.users.find(u=>u.id===ma.memberId)?.name}</td>
                            <td className="p-3 font-medium text-slate-500">{ma.divisions.length}D, {ma.partNos.length}P</td>
                            <td className="p-3">
                                <span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${ma.status==='COMPLETED'?'bg-green-100 text-green-700':ma.status==='REJECTED'?'bg-red-100 text-red-700':'bg-slate-100 text-slate-600'}`}>
                                    {ma.status}
                                </span>
                            </td>
                            <td className="p-3 text-slate-500">{new Date(ma.assignedTime).toLocaleDateString()}</td>
                            <td className="p-3 text-amber-600 font-bold">{new Date(ma.eta).toLocaleDateString()}</td>
                            <td className="p-3 font-bold text-emerald-600">
                                {ma.completionTime ? new Date(ma.completionTime).toLocaleString() : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PROJECT MODAL */}
      {showAddProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
             <div className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                <h2 className="text-2xl font-black mb-6 text-slate-900">{editingProjectId ? 'Edit Project' : 'New Project'}</h2>
                <form onSubmit={handleProjectSubmit} className="space-y-5">
                   <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Project Name</label>
                       <input required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold focus:border-indigo-500 outline-none" value={projForm.name} onChange={e=>setProjForm({...projForm, name: e.target.value})} />
                   </div>
                   <div className="space-y-1">
                       <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
                       <input type="date" required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold focus:border-indigo-500 outline-none" value={projForm.date} onChange={e=>setProjForm({...projForm, date: e.target.value})} />
                   </div>
                   
                   {/* DIVISIONS MANAGER */}
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                          <p className="text-xs font-black uppercase text-slate-500">Divisions</p>
                          <span className="text-[10px] font-bold bg-white px-2 py-1 rounded text-slate-400">{projForm.divisions.length} Added</span>
                      </div>
                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                          {projForm.divisions.map(d => (
                              <span key={d} className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm animate-fadeIn">
                                  {d}
                                  <button type="button" onClick={() => removeDiv(d)} className="text-slate-300 hover:text-red-500 ml-1"><i className="fas fa-times"></i></button>
                              </span>
                          ))}
                          {projForm.divisions.length === 0 && <span className="text-xs text-slate-300 italic">No divisions yet</span>}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                          <input placeholder="Prefix (e.g. D)" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newDivPrefix} onChange={e=>setProjForm({...projForm, newDivPrefix: e.target.value})} />
                          <input placeholder="Start #" type="number" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newDivStart} onChange={e=>setProjForm({...projForm, newDivStart: e.target.value})} />
                          <input placeholder="Qty" type="number" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newDivCount} onChange={e=>setProjForm({...projForm, newDivCount: e.target.value})} />
                          <button type="button" onClick={addGeneratedDivs} className="col-span-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-700">Generate</button>
                      </div>
                      <div className="flex gap-2">
                          <input placeholder="Or add specific name (e.g. Lobby)" className="flex-grow border p-2 rounded-lg text-xs font-bold" value={projForm.manualDiv} onChange={e=>setProjForm({...projForm, manualDiv: e.target.value})} />
                          <button type="button" onClick={addManualDiv} className="bg-white border border-slate-300 text-slate-700 px-4 rounded-lg text-xs font-bold hover:bg-slate-50">Add</button>
                      </div>
                   </div>

                   {/* PARTS MANAGER */}
                   <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                          <p className="text-xs font-black uppercase text-slate-500">Parts</p>
                          <span className="text-[10px] font-bold bg-white px-2 py-1 rounded text-slate-400">{projForm.partNos.length} Added</span>
                      </div>
                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                          {projForm.partNos.map(p => (
                              <span key={p} className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm animate-fadeIn">
                                  {p}
                                  <button type="button" onClick={() => removePart(p)} className="text-slate-300 hover:text-red-500 ml-1"><i className="fas fa-times"></i></button>
                              </span>
                          ))}
                          {projForm.partNos.length === 0 && <span className="text-xs text-slate-300 italic">No parts yet</span>}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                          <input placeholder="Prefix (e.g. P)" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newPartPrefix} onChange={e=>setProjForm({...projForm, newPartPrefix: e.target.value})} />
                          <input placeholder="Start #" type="number" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newPartStart} onChange={e=>setProjForm({...projForm, newPartStart: e.target.value})} />
                          <input placeholder="Qty" type="number" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newPartCount} onChange={e=>setProjForm({...projForm, newPartCount: e.target.value})} />
                          <button type="button" onClick={addGeneratedParts} className="col-span-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-700">Generate</button>
                      </div>
                      <div className="flex gap-2">
                          <input placeholder="Or add specific name (e.g. Wall A)" className="flex-grow border p-2 rounded-lg text-xs font-bold" value={projForm.manualPart} onChange={e=>setProjForm({...projForm, manualPart: e.target.value})} />
                          <button type="button" onClick={addManualPart} className="bg-white border border-slate-300 text-slate-700 px-4 rounded-lg text-xs font-bold hover:bg-slate-50">Add</button>
                      </div>
                   </div>

                   <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-slate-400">Required Work Types</label>
                        <div className="flex flex-wrap gap-2">
                            {state.workTypes.map(w => (
                                <button type="button" key={w} onClick={()=>setProjForm(prev => ({...prev, workTypes: toggleList(prev.workTypes, w)}))} className={`px-4 py-2 rounded-lg text-xs font-bold border transition-all ${projForm.workTypes.includes(w)?'bg-indigo-600 text-white border-indigo-600':'bg-white text-slate-500 border-slate-200'}`}>{w}</button>
                            ))}
                        </div>
                   </div>
                   
                   <div className="flex gap-3 pt-4">
                       <button type="submit" className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:bg-indigo-700 transition-colors">{editingProjectId ? 'Save Changes' : 'Create Project'}</button>
                       <button type="button" onClick={()=>setShowAddProject(false)} className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase hover:bg-slate-50 transition-colors">Cancel</button>
                   </div>
                </form>
             </div>
          </div>
      )}

      {/* DEPLOY MODAL */}
      {showDeploy && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
               <h2 className="text-2xl font-black mb-6 text-slate-900">{editId ? 'Edit Allocation' : 'Deploy Team'}</h2>
               <form onSubmit={handleDeploySubmit} className="space-y-5">
                  {!editId && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Project</label>
                          <select required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={allocForm.projectId} onChange={e=>setAllocForm({...allocForm, projectId: e.target.value})}>
                              <option value="">Select...</option>
                              {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Team</label>
                          <select required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={allocForm.teamId} onChange={e=>setAllocForm({...allocForm, teamId: e.target.value})}>
                              <option value="">Select...</option>
                              {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                      </div>
                    </div>
                  )}
                  
                  {allocForm.projectId && (
                      <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                         <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Work Types</p>
                            <div className="flex flex-wrap gap-1">
                                {state.projects.find(p=>p.id==allocForm.projectId)?.workTypes.map(w=><button type="button" key={w} onClick={()=>setAllocForm(prev=>({...prev, workTypes: toggleList(prev.workTypes, w)}))} className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${allocForm.workTypes.includes(w)?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-500 border-slate-200'}`}>{w}</button>)}
                            </div>
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Divisions</p>
                            <div className="flex flex-wrap gap-1">
                                {state.projects.find(p=>p.id==allocForm.projectId)?.divisions.map(d=><button type="button" key={d} onClick={()=>setAllocForm(prev=>({...prev, divisions: toggleList(prev.divisions, d)}))} className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${allocForm.divisions.includes(d)?'bg-blue-600 text-white border-blue-600':'bg-white text-slate-500 border-slate-200'}`}>{d}</button>)}
                            </div>
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Parts</p>
                            <div className="flex flex-wrap gap-1">
                                {state.projects.find(p=>p.id==allocForm.projectId)?.partNos.map(p=><button type="button" key={p} onClick={()=>setAllocForm(prev=>({...prev, partNos: toggleList(prev.partNos, p)}))} className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${allocForm.partNos.includes(p)?'bg-amber-600 text-white border-amber-600':'bg-white text-slate-500 border-slate-200'}`}>{p}</button>)}
                            </div>
                         </div>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Assigned Time</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold" value={allocForm.assignedTime} onChange={e=>setAllocForm({...allocForm, assignedTime: e.target.value})}/></div>
                      <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">ETA</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold" value={allocForm.eta} onChange={e=>setAllocForm({...allocForm, eta: e.target.value})}/></div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">File Size</label>
                      <input placeholder="e.g. 500MB" className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm" value={allocForm.fileSize} onChange={e=>setAllocForm({...allocForm, fileSize: e.target.value})} />
                  </div>
                  <div className="flex gap-3 pt-4">
                      <button className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:bg-indigo-700 transition-colors">{editId ? 'Save Changes' : 'Deploy'}</button>
                      <button type="button" onClick={()=>{setShowDeploy(false); setEditId(null);}} className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* REWORK MODAL */}
      {showRework && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border-t-4 border-red-500">
               <h2 className="text-2xl font-black mb-6 text-red-600">Issue Rework Order</h2>
               <form onSubmit={handleReworkSubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Original Project</label>
                          <select required disabled className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-slate-50 text-slate-500" value={allocForm.projectId} onChange={e=>setAllocForm({...allocForm, projectId: e.target.value})}>
                              {state.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Assign To Team</label>
                          <select required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={allocForm.teamId} onChange={e=>setAllocForm({...allocForm, teamId: e.target.value})}>
                              <option value="">Select...</option>
                              {state.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                      </div>
                  </div>
                  {allocForm.projectId && (
                      <div className="p-5 bg-red-50 rounded-2xl border border-red-100 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                         <div>
                            <p className="text-[9px] font-black uppercase text-red-400 mb-2">Rework Type</p>
                            <div className="flex flex-wrap gap-1">
                                {state.projects.find(p=>p.id==allocForm.projectId)?.workTypes.map(w=><button type="button" key={w} onClick={()=>setAllocForm(prev=>({...prev, workTypes: toggleList(prev.workTypes, w)}))} className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${allocForm.workTypes.includes(w)?'bg-red-700 text-white border-red-700':'bg-white text-slate-500 border-red-200'}`}>{w}</button>)}
                            </div>
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-red-400 mb-2">Divisions</p>
                            <div className="flex flex-wrap gap-1">
                                {state.projects.find(p=>p.id==allocForm.projectId)?.divisions.map(d=><button type="button" key={d} onClick={()=>setAllocForm(prev=>({...prev, divisions: toggleList(prev.divisions, d)}))} className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${allocForm.divisions.includes(d)?'bg-red-500 text-white border-red-500':'bg-white text-slate-500 border-red-200'}`}>{d}</button>)}
                            </div>
                         </div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-red-400 mb-2">Parts</p>
                            <div className="flex flex-wrap gap-1">
                                {state.projects.find(p=>p.id==allocForm.projectId)?.partNos.map(p=><button type="button" key={p} onClick={()=>setAllocForm(prev=>({...prev, partNos: toggleList(prev.partNos, p)}))} className={`text-[10px] px-3 py-1.5 rounded-lg border font-bold transition-all ${allocForm.partNos.includes(p)?'bg-red-500 text-white border-red-500':'bg-white text-slate-500 border-red-200'}`}>{p}</button>)}
                            </div>
                         </div>
                      </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Assigned</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold" value={allocForm.assignedTime} onChange={e=>setAllocForm({...allocForm, assignedTime: e.target.value})}/></div>
                      <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">ETA</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold" value={allocForm.eta} onChange={e=>setAllocForm({...allocForm, eta: e.target.value})}/></div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">File Size</label>
                      <input placeholder="e.g. 500MB" className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm" value={allocForm.fileSize} onChange={e=>setAllocForm({...allocForm, fileSize: e.target.value})} />
                  </div>
                  <div className="flex gap-3 pt-4">
                      <button className="flex-1 bg-red-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:bg-red-700 transition-colors">Confirm Rework</button>
                      <button type="button" onClick={()=>{setShowRework(false); setAllocForm({ projectId: '', teamId: '', workTypes: [], divisions: [], partNos: [], fileSize: '', eta: '', assignedTime: '' });}} className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase hover:bg-slate-50 transition-colors">Cancel</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* REVIEW MODAL */}
      {reviewId && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
               <h2 className="text-xl font-black mb-2 text-slate-900">Review Work</h2>
               <p className="text-xs text-slate-500 mb-6">Rate the quality of the Team's submission.</p>
               
               <div className="flex justify-center gap-2 mb-8">
                   {[1,2,3,4,5].map(s => (
                       <button key={s} onClick={()=>setReviewForm({...reviewForm, rating: s})} className={`text-3xl transition-transform hover:scale-110 ${s<=reviewForm.rating ? 'text-amber-400' : 'text-slate-200'}`}>
                           <i className="fas fa-star"></i>
                       </button>
                   ))}
               </div>

               {(() => {
                   const ga = state.groupAssignments.find(g => g.id === reviewId);
                   const isLate = ga?.completionTime && new Date(ga.completionTime) > new Date(ga.eta);
                   if (isLate) return (
                       <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 text-left">
                           <p className="text-xs font-black text-red-600 mb-2"><i className="fas fa-clock"></i> Submission was Late</p>
                           <label className="flex items-center gap-2 cursor-pointer">
                               <input type="checkbox" checked={reviewForm.overrideBlackmark} onChange={e=>setReviewForm({...reviewForm, overrideBlackmark: e.target.checked})} className="rounded text-red-600 focus:ring-red-500" />
                               <span className="text-[10px] font-bold uppercase text-slate-700">Waive Penalty (Justified)</span>
                           </label>
                       </div>
                   );
                   return null;
               })()}

               <div className="space-y-3">
                   <button onClick={()=>{ if(reviewId) updateGroupAssignment(reviewId, {status: 'COMPLETED', rating: reviewForm.rating, overrideBlackmark: reviewForm.overrideBlackmark}); setReviewId(null); }} className="w-full bg-green-600 text-white py-3 rounded-xl font-black uppercase shadow-lg hover:bg-green-700 transition-colors">Approve & Complete</button>
                   <button onClick={()=>setReviewId(null)} className="w-full text-slate-400 py-2 font-bold text-xs uppercase hover:text-slate-600 transition-colors">Cancel</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default PMDashboard;