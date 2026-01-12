import React, { useState, useEffect } from 'react';
import { Project, GroupAssignment, MemberAssignment, ScopeItem } from '../types';
import { StatsView, ReportGenerator } from './StatsAndReports';

interface PMDashboardProps { store: any; currentView: 'home' | 'projects' | 'reports'; }

const PMDashboard: React.FC<PMDashboardProps> = ({ store, currentView }) => {
  const { state, createProject, updateProject, deleteProject, toggleProjectHold, triggerRework, assignToGroup, updateGroupAssignment, deleteGroupAssignment } = store;

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

  // Screenshot Viewer State
  const [viewScreenshot, setViewScreenshot] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Forms
  const getLocalISOString = () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
      return now.toISOString().slice(0, 16);
  };

  const [reviewForm, setReviewForm] = useState({ rating: 5, overrideBlackmark: false });
  
  // ORIGINAL PROJ FORM (Lists for UI)
  const [projForm, setProjForm] = useState({ 
    name: '', date: getLocalISOString().split('T')[0], 
    divisions: [] as string[], partNos: [] as string[], workTypes: [] as string[],
    newDivPrefix: '', newDivCount: '', newDivStart: '1',
    newPartPrefix: '', newPartCount: '', newPartStart: '1',
    manualDiv: '', manualPart: ''
  });
  
  // NEW: HIERARCHY STATE FOR ALLOCATION
  const [allocScope, setAllocScope] = useState<ScopeItem[]>([]); 
  const [allocForm, setAllocForm] = useState({ 
      projectId: '', 
      teamId: '', 
      fileSize: '', 
      eta: '', 
      assignedTime: getLocalISOString() 
  });

  // ----------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ----------------------------------------------------------------------

  // List Helpers
  const toggleList = (list: string[], item: string) => 
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];
  
  const generateItems = (prefix: string, count: string, start: string) => {
    const c = parseInt(count) || 0;
    const s = parseInt(start) || 1;
    if (!prefix || c <= 0) return [];
    return Array.from({ length: c }, (_, i) => `${prefix}${s + i}`);
  };

  // Generator Handlers
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
  const removeDiv = (div: string) => setProjForm(prev => ({ ...prev, divisions: prev.divisions.filter(d => d !== div) }));

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
  const removePart = (part: string) => setProjForm(prev => ({ ...prev, partNos: prev.partNos.filter(p => p !== part) }));

  // --- ALLOCATION SELECTOR ---
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

  const isAllocSelected = (div: string, part: string, wt: string) => {
      return allocScope.some(s => s.division === div && s.parts.some(p => p.name === part && p.workTypes.includes(wt)));
  };

  // --- VISUAL STATUS BAR ---
  const getDivisionStatus = (p: Project, divName: string) => {
      const assigns = state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === p.id);
      
      // 1. Unallocated (Grey)
      const isAllocated = assigns.some(ga => ga.scope?.some(s => s.division === divName));
      if (!isAllocated) return 'GREY';

      // 2. Completed (Green)
      const relevantAssigns = assigns.filter(ga => ga.scope?.some(s => s.division === divName));
      const isComplete = relevantAssigns.length > 0 && relevantAssigns.every(ga => ga.status === 'COMPLETED');
      
      return isComplete ? 'GREEN' : 'YELLOW';
  };

  const getProjectStats = (p: Project) => {
      // 1. Calculate Total Unique Scope Items (Denominator)
      const totalDivs = p.divisions?.length || 0;
      const totalParts = p.partNos?.length || 0;
      const totalWT = p.workTypes?.length || 0;
      const totalUnits = totalDivs * totalParts * totalWT; 

      if (totalUnits === 0) return { allocated: 0, progress: 0 };

      // 2. Track Statuses for each unique item
      // Key: "Div-Part-WT", Value: Array of completion statuses [true, false, ...]
      const itemStatusMap = new Map<string, boolean[]>();
      const allocatedSet = new Set<string>();

      const projectAssignments = state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === p.id);

      projectAssignments.forEach(ga => {
          const isGaComplete = ga.status === 'COMPLETED';
          // Iterate GA Scope
          ga.scope?.forEach(s => {
              s.parts.forEach(pItem => {
                  pItem.workTypes.forEach(wt => {
                      const key = `${s.division}-${pItem.name}-${wt}`;
                      
                      // Allocation: Add to Set (Ensures we don't count > 100% if same item assigned twice)
                      allocatedSet.add(key);

                      // Completion: Track status of THIS instance
                      if (!itemStatusMap.has(key)) itemStatusMap.set(key, []);
                      itemStatusMap.get(key)!.push(isGaComplete);
                  });
              });
          });
      });

      // 3. Calculate Final Counts
      const allocatedCount = allocatedSet.size;
      
      // An item is Complete ONLY if ALL its assigned instances are Complete
      // (e.g. Team A Done + Team B Pending = Item Not Complete)
      let completedCount = 0;
      itemStatusMap.forEach((statuses) => {
          if (statuses.length > 0 && statuses.every(s => s === true)) {
              completedCount++;
          }
      });

      return { 
          allocated: Math.round((allocatedCount / totalUnits) * 100), 
          progress: Math.round((completedCount / totalUnits) * 100) 
      };
  };

  const getFilteredProjects = () => {
    return state.projects.filter((p: Project) => {
        const stats = getProjectStats(p);
        let tabMatch = false;

        // Check if this project has any assignments with Rejection status/requests
        const hasRejections = state.groupAssignments.some((ga: GroupAssignment) => 
            ga.projectId === p.id && (ga.status === 'REJECTION_REQ' || ga.status === 'REJECTED')
        );

        if (filterTab === 'hold') tabMatch = p.status === 'ON_HOLD';
        else if (filterTab === 'completed') tabMatch = stats.progress >= 100 && p.status !== 'ON_HOLD';
        else if (filterTab === 'ongoing') tabMatch = stats.progress < 100 && p.status !== 'ON_HOLD';
        else if (filterTab === 'recent') tabMatch = stats.progress >= 100;
        else if (filterTab === 'rejected') tabMatch = hasRejections; // <--- NEW TAB LOGIC
        
        if (!tabMatch) return false;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            return p.name.toLowerCase().includes(query);
        }
        return true;
    });
  };

  // ----------------------------------------------------------------------
  // HANDLERS
  // ----------------------------------------------------------------------

  const handleProjectSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      // FIX: Send flat lists directly to DB (Hybrid Model)
      const payload = { 
          name: projForm.name, 
          date: projForm.date, 
          divisions: projForm.divisions, 
          partNos: projForm.partNos,
          workTypes: projForm.workTypes
      };

      if (editingProjectId) await updateProject(editingProjectId, payload);
      else await createProject(payload);
      
      setShowAddProject(false); 
      setEditingProjectId(null); 
      setProjForm({ name: '', date: '', divisions: [], partNos: [], workTypes: [], newDivPrefix: '', newDivCount: '', newDivStart: '1', newPartPrefix: '', newPartCount: '', newPartStart: '1', manualDiv: '', manualPart: '' });
  };

  // --- TREE & STATUS LOGIC ---
  const getVirtualScope = (p: Project | null) => {
      if (!p || !p.divisions) return [];
      return p.divisions.map(div => ({
          division: div,
          parts: (p.partNos || []).map(part => ({ name: part, workTypes: [...(p.workTypes || [])] }))
      }));
  };

  const getStatusColor = (p: Project, div: string, part: string, wt: string) => {
      const assigns = state.groupAssignments.filter((ga: GroupAssignment) => 
          ga.projectId === p.id && 
          ga.scope?.some(s => s.division === div && s.parts.some(pt => pt.name === part && pt.workTypes.includes(wt)))
      );
      if (assigns.length === 0) return 'bg-slate-200 text-slate-400 border-slate-300'; // Unallocated (Grey)
      const isComplete = assigns.every((ga: GroupAssignment) => ga.status === 'COMPLETED');
      return isComplete ? 'bg-green-500 text-white border-green-600' : 'bg-amber-400 text-white border-amber-500'; // Done vs In Progress
  };

  const handleDeploySubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const payload = { ...allocForm, projectId: parseInt(allocForm.projectId), teamId: parseInt(allocForm.teamId), scope: allocScope };
      if (editId) {
          updateGroupAssignment(editId, payload);
          setEditId(null);
      } else {
          assignToGroup(payload);
      }
      setShowDeploy(false);
      setAllocScope([]);
      setAllocForm({ projectId: '', teamId: '', fileSize: '', eta: '', assignedTime: getLocalISOString() });
  };

  const handleReworkSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      await triggerRework({ ...allocForm, projectId: parseInt(allocForm.projectId), teamId: parseInt(allocForm.teamId), scope: allocScope });
      setShowRework(false);
      setAllocScope([]);
  };
  
  const openProjectEdit = (p: Project) => {
      setEditingProjectId(p.id);
      // Load flat lists directly from the project
      setProjForm({ 
          ...projForm, 
          name: p.name, 
          date: p.date,
          divisions: p.divisions || [],
          partNos: p.partNos || [],
          workTypes: p.workTypes || []
      });
      setShowAddProject(true);
  };

  const openEditAlloc = (ga: GroupAssignment) => {
      setAllocForm({
         projectId: String(ga.projectId), teamId: String(ga.teamId),
         fileSize: ga.fileSize, eta: ga.eta, assignedTime: ga.assignedTime
      });
      setAllocScope(ga.scope || []);
      setEditId(ga.id);
      setShowDeploy(true);
  };

  const selectedDeployProject = allocForm.projectId ? state.projects.find((p: Project) => p.id === parseInt(allocForm.projectId)) : null;

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
                     <button key={t} onClick={()=>{setFilterTab(t); setActiveProjectId(null);}} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                 ))}
             </div>
         </div>
        <div className="relative">
            <i className="fas fa-search absolute left-3 top-3 text-slate-400 text-xs"></i>
            <input placeholder="Search..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-64 outline-none focus:ring-2 focus:ring-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
      {/* ----------------- LEFT: PROJECT LIST ----------------- */}
         <div className="lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]">
             
             {/* 1. NEW PROJECT BUTTON (Moved to Top & Sticky) */}
             <div className="p-4 border-b bg-slate-50 z-10 sticky top-0">
                 <button 
                     onClick={() => {
                         setEditingProjectId(null); 
                         setProjForm({ name: '', date: new Date().toISOString().split('T')[0], divisions: [], partNos: [], workTypes: [], newDivPrefix: '', newDivCount: '', newDivStart: '1', newPartPrefix: '', newPartCount: '', newPartStart: '1', manualDiv: '', manualPart: '' }); 
                         setShowAddProject(true);
                     }} 
                     className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-colors"
                 >
                     + New Project
                 </button>
             </div>

             {/* 2. PROJECT LIST (Scrollable Area) */}
             <div className="overflow-y-auto flex-1">
                 {getFilteredProjects().map((p: Project) => {
                     const stats = getProjectStats(p);
                     return (
                         <div key={p.id} onClick={()=>setActiveProjectId(p.id)} className={`p-5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${activeProjectId===p.id?'bg-indigo-50/50 border-l-4 border-l-indigo-600':''}`}>
                             <div className="flex justify-between items-start mb-2">
                                <h3 className={`font-bold text-sm ${activeProjectId===p.id?'text-indigo-900':'text-slate-700'}`}>{p.name}</h3>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${p.status==='ON_HOLD'?'bg-amber-100 text-amber-700':stats.progress>=100?'bg-green-100 text-green-700':'bg-indigo-100 text-indigo-700'}`}>{(p.status || 'ACTIVE').replace('_', ' ')}</span>
                             </div>
                             
                             <div className="space-y-2 mt-3">
                                <div>
                                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-1"><span>Allocated</span><span>{stats.allocated}%</span></div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative"><div style={{width: `${stats.allocated}%`}} className="absolute h-full bg-slate-400 rounded-full"></div></div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-1"><span>Completed</span><span>{stats.progress}%</span></div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden relative"><div style={{width: `${stats.progress}%`}} className="absolute h-full bg-indigo-500 rounded-full"></div></div>
                                </div>
                             </div>
                             
                             {/* VISUAL STATUS BAR */}
                             <div className="mt-3 flex flex-wrap gap-1">
                                {p.divisions?.map((divName, i) => {
                                    const status = getDivisionStatus(p, divName); // Ensure this helper exists or remove if not needed
                                    const color = status === 'GREEN' ? 'bg-green-500 text-white' : status === 'YELLOW' ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500';
                                    return <span key={i} className={`text-[8px] font-black px-1.5 py-0.5 rounded ${color}`} title={`${divName}: ${status}`}>{divName}</span>
                                })}
                            </div>
                         </div>
                     )
                 })}
                 
                 {/* EMPTY STATE (Optional) */}
                 {getFilteredProjects().length === 0 && (
                     <div className="p-8 text-center text-slate-400 text-xs italic">
                         No projects found.
                     </div>
                 )}
             </div>
         </div>

         {/* ----------------- RIGHT: DETAILS ----------------- */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]">
             {activeProject ? (
                 <>
                     <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                        <h2 className="text-2xl font-black text-slate-900">{activeProject.name}</h2>
                        <div className="flex gap-2">
                            <button onClick={() => { setEditingProjectId(activeProject.id); setProjForm(activeProject as any); setShowAddProject(true); }} className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold">Edit</button>
                            <button onClick={() => toggleProjectHold(activeProject.id, activeProject.status !== 'ON_HOLD')} className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold">{activeProject.status==='ON_HOLD'?'Resume':'Hold'}</button>
                            <button onClick={() => deleteProject(activeProject.id)} className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold">Delete</button>
                        </div>
                     </div>

                     {/* TREE STRUCTURE VISUALIZATION */}
                     <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                         <h4 className="text-[10px] font-black uppercase text-slate-400 mb-3">Master Scope Status</h4>
                         <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
                             {getVirtualScope(activeProject).map((s, i) => (
                                 <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                     <div className="text-xs font-black text-indigo-900 mb-2 border-b pb-1">{s.division}</div>
                                     <div className="flex flex-wrap gap-4">
                                         {s.parts.map((p, j) => (
                                             <div key={j} className="flex flex-col gap-1 min-w-[60px]">
                                                 <span className="text-[9px] font-bold text-slate-500">{p.name}</span>
                                                 <div className="flex flex-wrap gap-1">
                                                     {p.workTypes.map(wt => (
                                                         <span key={wt} className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${getStatusColor(activeProject, s.division, p.name, wt)}`} title={wt}>{wt.substring(0,2).toUpperCase()}</span>
                                                     ))}
                                                 </div>
                                             </div>
                                         ))}
                                     </div>
                                 </div>
                             ))}
                         </div>
                     </div>

                     <div className="flex justify-between items-center mb-4 mt-8 pt-6 border-t border-slate-100">
                         <h3 className="font-bold text-slate-800">Team Allocations</h3>
                         <button onClick={() => { setAllocForm({ projectId: String(activeProject.id), teamId: '', fileSize: '', eta: '', assignedTime: new Date().toISOString().slice(0,16) }); setAllocScope([]); setShowDeploy(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700">Deploy Team</button>
                     </div>

                     {/* TEAM ALLOCATIONS LIST (SCROLLABLE) */}
                     <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === activeProject.id).map((ga: GroupAssignment) => (
                           <div key={ga.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center transition-all hover:shadow-md">
                              <div>
                                  <p className="font-bold text-slate-900 text-sm">{state.teams.find(t=>t.id===ga.teamId)?.name}</p>
                                  
                                  {/* NEW: Detailed Times Display */}
                                  <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                                      <div><span className="font-bold text-slate-400 w-16 inline-block">Assigned:</span> {new Date(ga.assignedTime).toLocaleDateString()}</div>
                                      <div><span className="font-bold text-amber-500 w-16 inline-block">ETA:</span> {new Date(ga.eta).toLocaleString()}</div>
                                      {ga.completionTime && (
                                          <div><span className="font-bold text-green-600 w-16 inline-block">Completed:</span> {new Date(ga.completionTime).toLocaleString()}</div>
                                      )}
                                  </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${ga.status==='COMPLETED'?'bg-green-100 text-green-700':ga.status==='PENDING_ACK'?'bg-amber-100 text-amber-700':'bg-slate-200 text-slate-500'}`}>{ga.status.replace('_',' ')}</span>
                                  {ga.status === 'REJECTION_REQ' && (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    if(confirm("Accept Rejection? This will mark the task as unallocated.")) {
                                                        updateGroupAssignment(ga.id, { status: 'REJECTED', rejectionReason: ga.rejectionReason + " [Accepted by PM]" });
                                                    }
                                                }} 
                                                className="bg-red-600 text-white px-3 py-1 rounded text-[10px] font-bold shadow-sm hover:bg-red-700"
                                            >
                                                Accept
                                            </button>
                                            <button 
                                                onClick={() => updateGroupAssignment(ga.id, { status: 'IN_PROGRESS', rejectionReason: null })} 
                                                className="bg-white border border-slate-300 text-slate-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-slate-50"
                                            >
                                                Revoke
                                            </button>
                                        </>
                                    )}
                                  {ga.status === 'PENDING_ACK' && <button onClick={()=>setReviewId(ga.id)} className="bg-green-600 text-white px-3 py-1 rounded text-[10px] font-bold shadow-sm">Review</button>}
                                  
                                  {/* NEW: Edit Button (Only if not completed) */}
                                  {ga.status !== 'COMPLETED' && ga.status !== 'REJECTED' && (
                                    <button 
                                        onClick={() => {
                                            setAllocForm({ projectId: String(ga.projectId), teamId: String(ga.teamId), fileSize: ga.fileSize || '', eta: ga.eta, assignedTime: ga.assignedTime });
                                            setAllocScope(ga.scope || []);
                                            setShowDeploy(true);
                                        }} 
                                        className="bg-white border text-indigo-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-50"
                                    >
                                        Edit
                                    </button>
                                  )}

                                  <button onClick={()=>setTrackerId(ga.id)} className="bg-white border text-blue-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-50">Tracker</button>
                                  
                                  {/* HIDE DELETE IF COMPLETED */}
                                  {ga.status !== 'COMPLETED' && (
                                    <button onClick={() => deleteGroupAssignment(ga.id)} className="text-red-300 hover:text-red-600 ml-1 transition-colors"><i className="fas fa-trash"></i></button>
                                  )}
                              </div>
                           </div>
                        ))}
                        {state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === activeProject.id).length === 0 && (
                            <p className="text-center text-xs text-slate-400 italic py-4">No teams deployed yet.</p>
                        )}
                     </div>
                 </>
             ) : <div className="text-center text-slate-400 mt-20">Select a project</div>}
         </div>
      </div>
      {/* ----------------- MODALS ----------------- */}

      {/* CREATE / EDIT PROJECT MODAL (Uses Original Layout) */}
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
                              <span key={d} className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
                                  {d}
                                  <button type="button" onClick={() => removeDiv(d)} className="text-slate-300 hover:text-red-500 ml-1"><i className="fas fa-times"></i></button>
                              </span>
                          ))}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                          <input placeholder="Prefix" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newDivPrefix} onChange={e=>setProjForm({...projForm, newDivPrefix: e.target.value})} />
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
                              <span key={p} className="flex items-center gap-1 bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-[10px] font-bold text-slate-700 shadow-sm">
                                  {p}
                                  <button type="button" onClick={() => removePart(p)} className="text-slate-300 hover:text-red-500 ml-1"><i className="fas fa-times"></i></button>
                              </span>
                          ))}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                          <input placeholder="Prefix" className="col-span-1 border p-2 rounded-lg text-xs font-bold" value={projForm.newPartPrefix} onChange={e=>setProjForm({...projForm, newPartPrefix: e.target.value})} />
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
                            {state.workTypes.map((w: string) => (
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

      {/* DEPLOY / REWORK MODAL (Hierarchical Selector) */}
      {(showDeploy || showRework) && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className={`bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl ${showRework ? 'border-t-4 border-red-500' : ''}`}>
               <h2 className="text-2xl font-black mb-6 text-slate-900">{showRework ? 'Rework Order' : editId ? 'Edit Allocation' : 'Deploy Team'}</h2>
               <form onSubmit={showRework ? handleReworkSubmit : handleDeploySubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Project</label>
                          <select required disabled={!!editId || showRework} className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={allocForm.projectId} onChange={e=>setAllocForm({...allocForm, projectId: e.target.value})}>
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
                  
                  {allocForm.projectId && selectedDeployProject && (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 max-h-60 overflow-y-auto custom-scrollbar">
                        <h3 className="font-bold text-xs uppercase mb-3 text-slate-500">Select Scope to Assign</h3>
                        {/* Use getVirtualScope logic here */}
                        {getVirtualScope(selectedDeployProject).map((s: ScopeItem, idx: number) => (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 mb-2">
                                <h4 className="font-black text-slate-800 text-xs mb-2">{s.division}</h4>
                                <div className="pl-3 border-l-2 border-slate-100 space-y-2">
                                    {s.parts.map((p: any, pIdx: number) => (
                                        <div key={pIdx} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-slate-600">{p.name}</span>
                                            <div className="flex flex-wrap gap-1">
                                                {p.workTypes.map((wt: string) => {
                                                    const isSelected = isAllocSelected(s.division, p.name, wt);
                                                    return (
                                                        <button 
                                                        type="button" key={wt} 
                                                        onClick={() => toggleAllocScope(s.division, p.name, wt)}
                                                        className={`text-[9px] px-2 py-0.5 rounded border transition-all ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}
                                                        >
                                                            {wt}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Assigned</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold" value={allocForm.assignedTime} onChange={e=>setAllocForm({...allocForm, assignedTime: e.target.value})}/></div>
                      <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">ETA</label><input type="datetime-local" className="w-full border-2 border-slate-100 p-3 rounded-xl text-xs font-bold" value={allocForm.eta} onChange={e=>setAllocForm({...allocForm, eta: e.target.value})}/></div>
                  </div>
                  <input placeholder="File Size (e.g. 500MB)" className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm" value={allocForm.fileSize} onChange={e=>setAllocForm({...allocForm, fileSize: e.target.value})} />
                  
                  <div className="flex gap-3 pt-4">
                      <button className={`flex-1 text-white py-3 rounded-xl font-black uppercase shadow-lg transition-colors ${showRework ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Confirm</button>
                      <button type="button" onClick={()=>{setShowDeploy(false); setShowRework(false);}} className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase hover:bg-slate-50">Cancel</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* TRACKER MODAL */}
      {trackerId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto">
             <div className="flex justify-between mb-4">
                 <h2 className="font-black text-xl">Assignment Tracker</h2>
                 <button onClick={()=>setTrackerId(null)}>x</button>
             </div>
             <table className="w-full text-left text-xs">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="p-2">Member</th>
                        <th className="p-2">Assigned</th>
                        <th className="p-2">ETA</th>
                        <th className="p-2">Completed</th>
                        <th className="p-2">Status</th>
                        <th className="p-2">Image</th>
                    </tr>
                </thead>
                <tbody>
                    {state.memberAssignments.filter((ma: MemberAssignment) => ma.groupAssignmentId === trackerId).map((ma: MemberAssignment) => (
                        <tr key={ma.id} className="border-b">
                            <td className="p-2 font-bold">{state.users.find((u: any)=>u.id===ma.memberId)?.name}</td>
                            
                            {/* TIME COLUMNS */}
                            <td className="p-2 text-slate-500">{new Date(ma.assignedTime).toLocaleString()}</td>
                            <td className="p-2 font-mono text-amber-600">{new Date(ma.eta).toLocaleString()}</td>
                            <td className="p-2 font-mono text-green-600">{ma.completionTime ? new Date(ma.completionTime).toLocaleString() : '-'}</td>
                            
                            <td className="p-2"><span className={`px-2 py-0.5 rounded ${ma.status==='COMPLETED'?'bg-green-100 text-green-700':'bg-amber-100 text-amber-700'}`}>{ma.status}</span></td>
                            <td className="p-2">{ma.screenshot && <button onClick={()=>setViewScreenshot(`http://127.0.0.1:3001/${ma.screenshot}`)} className="text-blue-600 underline font-bold">View Image</button>}</td>
                        </tr>
                    ))}
                </tbody>
             </table>
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

      {/* REVIEW MODAL (PM) */}
      {reviewId && (
         <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-2xl">
               <h2 className="font-bold mb-4">Approve Team Work</h2>
               <div className="flex gap-2 mb-4">{[1,2,3,4,5].map(s=><button key={s} onClick={()=>setReviewForm({...reviewForm, rating:s})} className={`text-xl ${s<=reviewForm.rating?'text-amber-400':'text-gray-300'}`}>★</button>)}</div>
               <button onClick={()=>{updateGroupAssignment(reviewId, {status:'COMPLETED', rating:reviewForm.rating}); setReviewId(null);}} className="bg-green-600 text-white px-4 py-2 rounded">Approve</button>
               <button onClick={()=>setReviewId(null)} className="ml-2 text-gray-500">Cancel</button>
            </div>
         </div>
      )}
    </div>
  );
};

export default PMDashboard;