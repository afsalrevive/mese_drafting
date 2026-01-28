import React, { useState, useEffect } from 'react';
import { Project, GroupAssignment, MemberAssignment, ScopeItem,Team } from '../types';
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
    name: '', date: '', 
    divisions: [] as string[], partNos: [] as string[], workTypes: [] as string[],
    newDivPrefix: '', newDivCount: '', newDivStart: '1',
    newPartPrefix: '', newPartCount: '', newPartStart: '1',
    manualDiv: '', manualPart: '',
    
    // Scope Mapping State
    scopeMapping: [] as { divs: string[], parts: string[], wts: string[] }[],
    tempMapDivs: [] as string[],
    tempMapParts: [] as string[],
    tempMapWTs: [] as string[],
    
    // 🟢 NEW: Track which rule is being edited (-1 or null means "New Mode")
    editingRuleIndex: null as number | null 
  });

  // 🔒 Safety Check: Is the builder currently "Dirty" (Active)?
  // If true, we disable the main Save/Cancel buttons
  const isBuilderActive = projForm.tempMapDivs.length > 0 || projForm.tempMapParts.length > 0 || projForm.tempMapWTs.length > 0;
  
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

  // 🔒 Helper: Check if a Scope Rule is already allocated
  const isRuleInUse = (rule: any) => {
      if (!editingProjectId) return false; // New projects are safe
      
      // Get all active assignments for this project
      const projectGas = state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === editingProjectId);
      if (projectGas.length === 0) return false;

      // Check if ANY combination in this rule is already in a GroupAssignment
      return rule.divs.some((d: string) => 
          rule.parts.some((p: string) => 
              rule.wts.some((w: string) => 
                  projectGas.some(ga => 
                      ga.scope.some(s => 
                          s.division === d && 
                          s.parts.some(pt => pt.name === p && pt.workTypes.includes(w))
                      )
                  )
              )
          )
      );
  };
  const getScopeStatusColor = (gaId: number, div: string, part: string, wt: string) => {
      // Find all allocations by the Team Lead for this specific Group Assignment
      const memberAssigns = state.memberAssignments.filter((ma: MemberAssignment) => 
          ma.groupAssignmentId === gaId && 
          ma.status !== 'REJECTED' // Ignore rejected tasks
      );

      // Check if this specific item is assigned to ANY member
      const relevantAssigns = memberAssigns.filter((ma: MemberAssignment) => 
          ma.scope?.some(s => s.division === div && s.parts.some(p => p.name === part && p.workTypes.includes(wt)))
      );

      if (relevantAssigns.length === 0) return 'bg-white text-slate-400 border-slate-200'; // Unallocated (No Color)

      // Check if ALL assignments for this item are completed
      const isComplete = relevantAssigns.every((ma: MemberAssignment) => ma.status === 'COMPLETED');
      
      return isComplete 
          ? 'bg-green-500 text-white border-green-600'  // Completed (Green)
          : 'bg-amber-400 text-white border-amber-500'; // Allocated (Yellow)
  };

  const getAvailabilityLabel = (id: number) => {
      // Access the availability map from store
      const availMap = state.availability?.teams || {};
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
  const removeDiv = (div: string) => {
      // 1. Check Scope Mapping (Builder rules)
      const inScope = projForm.scopeMapping.some(rule => rule.divs.includes(div));
      // 2. Check Allocation (Live Teams) - Only if editing an existing project
      const inAlloc = editingProjectId && state.groupAssignments.some((ga: GroupAssignment) => 
          ga.projectId === editingProjectId && 
          ga.scope.some((s: ScopeItem) => s.division === div)
      );

      if(inScope || inAlloc) {
          alert(`Cannot delete Division "${div}":\nIt is currently used in scope rules or allocated to a team.`);
          return;
      }
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
      const inScope = projForm.scopeMapping.some(rule => rule.parts.includes(part));
      const inAlloc = editingProjectId && state.groupAssignments.some((ga: GroupAssignment) => 
          ga.projectId === editingProjectId && 
          ga.scope.some((s: ScopeItem) => s.parts.some(p => p.name === part))
      );

      if(inScope || inAlloc) {
          alert(`Cannot delete Part "${part}":\nIt is currently used in scope rules or allocated to a team.`);
          return;
      }
      setProjForm(prev => ({ ...prev, partNos: prev.partNos.filter(p => p !== part) }));
  };

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
      
      // 🛡️ BARRIER: Prevent saving if the builder is still active
      if (isBuilderActive) {
          alert("⚠️ UNFINISHED RULE\n\nYou have an active scope rule being edited (Selection boxes are not empty).\n\nPlease click 'Add/Update Rule' to commit it, or 'Undo' to clear it before saving the project.");
          return;
      }

      // 🟢 LOGIC: Handle Scope Ambiguity
      let finalScopeMapping = [...projForm.scopeMapping];

      // CASE 1: New Project with NO rules defined
      // We force generate an "All-to-All" rule so it starts as Explicit, not Implicit.
      if (!editingProjectId && finalScopeMapping.length === 0) {
          if (projForm.divisions.length > 0 && projForm.partNos.length > 0 && projForm.workTypes.length > 0) {
              finalScopeMapping = [{
                  divs: projForm.divisions,
                  parts: projForm.partNos,
                  wts: projForm.workTypes
              }];
              // Optional: Notify user (or just do it silently)
              console.log("Auto-generated All-to-All scope for new project");
          }
      }
      
      // CASE 2: Existing Project (Legacy)
      // We do NOTHING. If finalScopeMapping is empty, we send empty. 
      // This preserves the "Implicit" legacy mode for old projects.

      const payload = { 
          name: projForm.name, 
          date: projForm.date, 
          divisions: projForm.divisions, 
          partNos: projForm.partNos,
          workTypes: projForm.workTypes,
          
          // Send the calculated scope structure
          scopeStructure: JSON.stringify(finalScopeMapping) 
      };

      if (editingProjectId) await updateProject(editingProjectId, payload);
      else await createProject(payload);
      
      setShowAddProject(false); 
      setEditingProjectId(null); 
      setProjForm({ 
          name: '', date: '', divisions: [], partNos: [], workTypes: [], 
          newDivPrefix: '', newDivCount: '', newDivStart: '1', 
          newPartPrefix: '', newPartCount: '', newPartStart: '1', 
          manualDiv: '', manualPart: '',
          scopeMapping: [], tempMapDivs: [], tempMapParts: [], tempMapWTs: [],
          editingRuleIndex: null 
      });
  };

  // --- TREE & STATUS LOGIC ---
  const getVirtualScope = (p: Project | null) => {
      if (!p || !p.divisions) return [];

      // 1. ADVANCED MODE: Check if rules exist and are not empty
      if (p.scopeStructure && p.scopeStructure !== "[]") {
          try {
              const rules = JSON.parse(p.scopeStructure);
              if (rules.length > 0) {
                  const tree: ScopeItem[] = [];

                  rules.forEach((rule: any) => {
                      rule.divs.forEach((div: string) => {
                          let divItem = tree.find(t => t.division === div);
                          if (!divItem) {
                              divItem = { division: div, parts: [] };
                              tree.push(divItem);
                          }

                          rule.parts.forEach((part: string) => {
                              let partItem = divItem!.parts.find((pt: any) => pt.name === part);
                              if (!partItem) {
                                  partItem = { name: part, workTypes: [] };
                                  divItem!.parts.push(partItem);
                              }
                              // Add unique Work Types from this rule
                              rule.wts.forEach((wt: string) => {
                                  if (!partItem!.workTypes.includes(wt)) {
                                      partItem!.workTypes.push(wt);
                                  }
                              });
                          });
                      });
                  });
                  return tree;
              }
          } catch (e) {
              console.error("Failed to parse scope structure", e);
          }
      }

      // 2. SIMPLE MODE (Fallback): All-to-All
      return p.divisions.map(div => ({
          division: div,
          parts: (p.partNos || []).map(part => ({ name: part, workTypes: [...(p.workTypes || [])] }))
      }));
  };
  // 🔍 Helper: Check the status of a specific Scope Combination
  const getScopeStatus = (d: string, p: string, w: string) => {
      if (!editingProjectId) return null;
      
      // Find assignments for this project that contain this exact D/P/W combo
      const activeGA = state.groupAssignments.find((ga: GroupAssignment) => 
          ga.projectId === editingProjectId &&
          ga.scope.some(s => 
              s.division === d && 
              s.parts.some(pt => pt.name === p && pt.workTypes.includes(w))
          )
      );

      if (!activeGA) return null;
      return activeGA.status === 'COMPLETED' ? 'COMPLETED' : 'ALLOCATED';
  };

  // 🔒 Helper: Determine if a builder item (Div/Part/WT) should be locked
  const getItemLockStatus = (type: 'div' | 'part' | 'wt', item: string) => {
      // We check if this item, combined with the CURRENT temporary selections, forms a locked scope.
      const { tempMapDivs, tempMapParts, tempMapWTs } = projForm;
      
      let hasAllocated = false;
      let hasCompleted = false;

      if (type === 'div') {
          // Check this Div against all selected Parts & WTs
          for (const p of tempMapParts) {
              for (const w of tempMapWTs) {
                  const status = getScopeStatus(item, p, w);
                  if (status === 'ALLOCATED') hasAllocated = true;
                  if (status === 'COMPLETED') hasCompleted = true;
              }
          }
      } else if (type === 'part') {
          // Check this Part against all selected Divs & WTs
          for (const d of tempMapDivs) {
              for (const w of tempMapWTs) {
                  const status = getScopeStatus(d, item, w);
                  if (status === 'ALLOCATED') hasAllocated = true;
                  if (status === 'COMPLETED') hasCompleted = true;
              }
          }
      } else if (type === 'wt') {
          // Check this WT against all selected Divs & Parts
          for (const d of tempMapDivs) {
              for (const p of tempMapParts) {
                  const status = getScopeStatus(d, p, item);
                  if (status === 'ALLOCATED') hasAllocated = true;
                  if (status === 'COMPLETED') hasCompleted = true;
              }
          }
      }

      // Priority: Allocated (Yellow) > Completed (Green) > Null (Editable)
      if (hasAllocated) return 'ALLOCATED';
      if (hasCompleted) return 'COMPLETED';
      return null;
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

      // NEW: Validation Check
      if (!allocForm.projectId || !allocForm.teamId || !allocForm.assignedTime || !allocForm.eta || allocScope.length === 0) {
          alert("⚠️ Missing Fields!\n\nPlease ensure you have provided:\n- Project & Team\n- At least one Scope item\n- Assigned Time & ETA");
          return;
      }

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

    // Safe Parse Scope
    let existingMapping = [];
    try {
        if (p.scopeStructure) existingMapping = JSON.parse(p.scopeStructure);
    } catch (e) { console.error("Failed to parse scope structure", e); }

    setProjForm({ 
        name: p.name, 
        
        // Ensure we only grab the YYYY-MM-DD part
        date: p.date ? p.date.split('T')[0] : '', 
        
        divisions: p.divisions || [],
        partNos: p.partNos || [],
        workTypes: p.workTypes || [],

        // Reset Generators
        newDivPrefix: '', newDivCount: '', newDivStart: '1', 
        newPartPrefix: '', newPartCount: '', newPartStart: '1', 
        manualDiv: '', manualPart: '',

        // Load Mapping & Reset Builder State
        scopeMapping: existingMapping,
        tempMapDivs: [], 
        tempMapParts: [], 
        tempMapWTs: [],
        editingRuleIndex: null // 🟢 NEW: Ensure we start in "Add Mode", not "Edit Mode"
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
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full md:w-auto">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide shrink-0">Project Management</h2>
            {/* Tabs: Horizontal scroll on mobile */}
            <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto overflow-x-auto">
                {['ongoing', 'recent', 'completed', 'hold'].map(t => (
                    <button key={t} onClick={()=>{setFilterTab(t); setActiveProjectId(null);}} className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all whitespace-nowrap ${filterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                ))}
            </div>
        </div>
        <div className="relative w-full md:w-auto">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
            <input placeholder="Search..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-full md:w-64 outline-none focus:ring-2 focus:ring-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
      {/* ----------------- LEFT: PROJECT LIST ----------------- */}
         {/* Mobile: Hidden if project selected. Desktop: Always visible (col-span-4) */}
         <div className={`${activeProjectId ? 'hidden lg:flex' : 'flex'} lg:col-span-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-col max-h-[75vh]`}>
             
             {/* 1. NEW PROJECT BUTTON (Moved to Top & Sticky) */}
            <div className="p-4 border-b bg-slate-50 z-10 sticky top-0">
                <button 
                    onClick={() => {
                        setEditingProjectId(null); 
                        const today = getLocalISOString().split('T')[0];

                        setProjForm({ 
                            name: '', 
                            date: today, 
                            divisions: [], 
                            partNos: [], 
                            workTypes: [], 
                            newDivPrefix: '', newDivCount: '', newDivStart: '1', 
                            newPartPrefix: '', newPartCount: '', newPartStart: '1', 
                            manualDiv: '', manualPart: '',
                            
                            scopeMapping: [], 
                            tempMapDivs: [], 
                            tempMapParts: [], 
                            tempMapWTs: [],
                            
                            // 🟢 NEW: Reset the rule editor state
                            editingRuleIndex: null 
                        });
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
        {/* Mobile: Hidden if NO project selected. Desktop: Always visible (col-span-8) */}
        <div className={`${!activeProjectId ? 'hidden lg:block' : 'block'} lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 min-h-[500px]`}>
            {activeProject ? (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 border-b border-slate-100 pb-4 gap-4">
                        <div className="flex items-center gap-3">
                            {/* Mobile Back Button */}
                            <button onClick={() => setActiveProjectId(null)} className="lg:hidden text-slate-400 hover:text-slate-600">
                                <i className="fas fa-arrow-left text-xl"></i>
                            </button>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900">{activeProject.name}</h2>
                        </div>

                        <div className="flex gap-2">
                            <button 
                                onClick={() => openProjectEdit(activeProject)} 
                                className="bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
                            >
                                Edit
                            </button>
                            {/* FIX: Send an Object { status: ... }, NOT a boolean */}
                            <button 
                                onClick={() => updateProject(activeProject.id, { status: activeProject.status === 'ON_HOLD' ? 'ACTIVE' : 'ON_HOLD' })} 
                                className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-bold"
                            >
                                {activeProject.status === 'ON_HOLD' ? 'Resume' : 'Hold'}
                            </button>
                            
                            <button 
                                onClick={() => {
                                    // BARRIER: Check for active teams
                                    const hasActiveWork = state.groupAssignments.some((ga: GroupAssignment) => ga.projectId === activeProject.id);
                                    
                                    if (hasActiveWork) {
                                        alert(`⛔ CANNOT DELETE PROJECT\n\nThere are teams currently working on this project.\n\nPlease remove all Team Allocations first.`);
                                        return;
                                    }

                                    if (window.confirm(`⚠️ DELETE PROJECT?\n\nAre you sure you want to delete "${activeProject.name}"?\n\nThis action cannot be undone.`)) {
                                        deleteProject(activeProject.id);
                                        setActiveProjectId(null); // Close the view
                                    }
                                }} 
                                className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                            >
                                Delete Project
                            </button>
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
                         {/* Find the main "Deploy Work" button and replace it */}
                        <button 
                            onClick={() => { 
                                setEditId(null); 
                                setAllocScope([]); 
                                
                                // 🟢 FIX: Generate FRESH time right now
                                const nowTime = getLocalISOString(); 
                                
                                setAllocForm({ 
                                    projectId: activeProjectId ? activeProjectId.toString() : '', 
                                    teamId: '', 
                                    fileSize: '', 
                                    eta: '', 
                                    assignedTime: nowTime // 🟢 Applies correctly
                                }); 
                                
                                setShowDeploy(true); 
                            }} 
                            className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all flex items-center"
                        >
                            <i className="fas fa-plus mr-2"></i>
                            Deploy Work
                        </button>
                     </div>

                     {/* TEAM ALLOCATIONS LIST (SCROLLABLE) */}
                     <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                        {state.groupAssignments.filter((ga: GroupAssignment) => ga.projectId === activeProject.id).map((ga: GroupAssignment) => (
                            <div key={ga.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col md:flex-row gap-4 items-start md:items-center transition-all hover:shadow-md">
                                
                                {/* COLUMN 1: Basic Info & Times */}
                                <div className="min-w-[140px] shrink-0">
                                    <p className="font-bold text-slate-900 text-sm truncate">{state.teams.find(t=>t.id===ga.teamId)?.name}</p>
                                    <div className="text-[10px] text-slate-500 mt-1 space-y-0.5">
                                        <div><span className="font-bold text-slate-400 w-14 inline-block">Assigned:</span> {new Date(ga.assignedTime).toLocaleDateString()}</div>
                                        <div><span className="font-bold text-amber-500 w-14 inline-block">ETA:</span> {new Date(ga.eta).toLocaleDateString()}</div>
                                        {ga.completionTime && (
                                            <div><span className="font-bold text-green-600 w-14 inline-block">Done:</span> {new Date(ga.completionTime).toLocaleDateString()}</div>
                                        )}
                                    </div>
                                </div>

                                {/* COLUMN 2: SCOPE ALLOCATION TREE (The New Middle Area) */}
                                <div className="flex-grow w-full md:w-auto bg-white rounded-lg border border-slate-200 p-2 max-h-[80px] overflow-y-auto custom-scrollbar">
                                    {ga.scope && ga.scope.length > 0 ? (
                                        <div className="flex flex-col gap-1.5">
                                            {ga.scope.map((s, sIdx) => (
                                                <div key={sIdx} className="flex items-start gap-2 text-[9px] leading-tight">
                                                    <span className="font-bold text-indigo-900 min-w-[50px] mt-0.5">{s.division}</span>
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                        {s.parts.map((p, pIdx) => (
                                                            <div key={pIdx} className="flex items-center gap-1">
                                                                <span className="text-slate-500 font-bold">{p.name}:</span>
                                                                <div className="flex gap-0.5">
                                                                    {p.workTypes.map(wt => (
                                                                        <span 
                                                                            key={wt} 
                                                                            className={`px-1 rounded border text-[8px] font-bold ${getScopeStatusColor(ga.id, s.division, p.name, wt)}`}
                                                                            title={`${wt} - ${getScopeStatusColor(ga.id, s.division, p.name, wt).includes('green') ? 'Completed' : 'Allocated'}`}
                                                                        >
                                                                            {wt}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-400 italic">No scope defined.</span>
                                    )}
                                </div>
                                
                                {/* COLUMN 3: Status & Buttons */}
                                <div className="flex items-center gap-2 shrink-0">
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
                                    
                                    {/* FIX: Use openEditAlloc */}
                                    {ga.status !== 'COMPLETED' && ga.status !== 'REJECTED' && (
                                        <button 
                                            onClick={() => openEditAlloc(ga)} 
                                            className="bg-white border text-indigo-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-indigo-50"
                                        >
                                            Edit
                                        </button>
                                    )}

                                    <button onClick={()=>setTrackerId(ga.id)} className="bg-white border text-blue-600 px-3 py-1 rounded text-[10px] font-bold hover:bg-blue-50">Tracker</button>
                                    
                                    {/* HIDE DELETE IF COMPLETED */}
                                    {ga.status !== 'COMPLETED' && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();

                                                // 1. Check for sub-tasks (using 'ga.id' instead of 'group.id')
                                                const hasSubTasks = state.memberAssignments.some(
                                                    (ma: MemberAssignment) => ma.groupAssignmentId === ga.id
                                                );

                                                if (hasSubTasks) {
                                                    alert("⛔ ACTION DENIED\n\nThe Team Lead has already distributed this work.\n\nThe Team Lead must un-assign members before you can delete this.");
                                                    return;
                                                }

                                                // 2. Get Team Name safely
                                                const teamName = state.teams.find((t: any) => t.id === ga.teamId)?.name || 'this team';

                                                // 3. Confirm (using 'ga.id')
                                                if (window.confirm(`⚠️ CONFIRM DELETE\n\nRemove this assignment from ${teamName}?`)) {
                                                    deleteGroupAssignment(ga.id);
                                                }
                                            }}
                                            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                            title="Delete Assignment"
                                        >
                                            <i className="fas fa-trash"></i>
                                        </button>
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
      {/* ADD / EDIT PROJECT MODAL - V3 (Undo/Update Logic) */}
      {showAddProject && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
             <div className="bg-white rounded-3xl w-full max-w-7xl h-[90vh] shadow-2xl flex flex-col overflow-hidden">
                
                {/* HEADER */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-xl font-black text-slate-900">{editingProjectId ? 'Edit Project' : 'New Project'}</h2>
                    {/* Close X only works if not busy */}
                    <button 
                        disabled={isBuilderActive}
                        onClick={() => setShowAddProject(false)} 
                        className={`text-xl font-bold px-2 ${isBuilderActive ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        ✕
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 overflow-hidden flex flex-row">
                    
                    {/* === LEFT COLUMN (Definitions) === */}
                    <div className="w-1/3 flex-shrink-0 flex flex-col border-r border-slate-100 bg-white min-w-[350px]">
                        <form id="projectForm" onSubmit={handleProjectSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                           
                           {/* Basic Info */}
                           <div className="space-y-4">
                               <div className="space-y-1">
                                   <label className="text-[10px] font-black uppercase text-slate-400">Project Name</label>
                                   <input required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm text-slate-700 focus:border-indigo-500 outline-none" value={projForm.name} onChange={e=>setProjForm({...projForm, name: e.target.value})} />
                               </div>
                               <div className="space-y-1">
                                   <label className="text-[10px] font-black uppercase text-slate-400">Date</label>
                                   <input type="date" required className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold text-sm text-slate-700 focus:border-indigo-500 outline-none" value={projForm.date} onChange={e=>setProjForm({...projForm, date: e.target.value})} />
                               </div>
                           </div>
                           
                           {/* DIVISIONS */}
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                              <div className="flex justify-between items-center"><p className="text-xs font-black uppercase text-slate-500">Divisions</p><span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded text-slate-400 border border-slate-100">{projForm.divisions.length}</span></div>
                              <div className="flex gap-2">
                                  <input className="w-14 p-2 text-[10px] border rounded-lg font-bold text-center" placeholder="Pre" value={projForm.newDivPrefix} onChange={e=>setProjForm({...projForm, newDivPrefix: e.target.value})} />
                                  <input className="w-14 p-2 text-[10px] border rounded-lg font-bold text-center" placeholder="Start" value={projForm.newDivStart} onChange={e=>setProjForm({...projForm, newDivStart: e.target.value})} />
                                  <input className="w-14 p-2 text-[10px] border rounded-lg font-bold text-center" placeholder="Qty" value={projForm.newDivCount} onChange={e=>setProjForm({...projForm, newDivCount: e.target.value})} />
                                  <button type="button" onClick={addGeneratedDivs} className="flex-1 bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-slate-700">Generate</button>
                              </div>
                              <div className="flex gap-2">
                                  <input className="flex-1 p-2 text-[10px] border rounded-lg font-bold" placeholder="Manual Add" value={projForm.manualDiv} onChange={e=>setProjForm({...projForm, manualDiv: e.target.value})} />
                                  <button type="button" onClick={addManualDiv} className="bg-white border px-3 rounded-lg text-[10px] font-bold hover:bg-slate-50">+</button>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                  {projForm.divisions.map(d => <span key={d} onClick={() => removeDiv(d)} className="cursor-pointer text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200">{d}</span>)}
                              </div>
                           </div>

                           {/* PARTS */}
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                              <div className="flex justify-between items-center"><p className="text-xs font-black uppercase text-slate-500">Parts</p><span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded text-slate-400 border border-slate-100">{projForm.partNos.length}</span></div>
                              <div className="flex gap-2">
                                  <input className="w-14 p-2 text-[10px] border rounded-lg font-bold text-center" placeholder="Pre" value={projForm.newPartPrefix} onChange={e=>setProjForm({...projForm, newPartPrefix: e.target.value})} />
                                  <input className="w-14 p-2 text-[10px] border rounded-lg font-bold text-center" placeholder="Start" value={projForm.newPartStart} onChange={e=>setProjForm({...projForm, newPartStart: e.target.value})} />
                                  <input className="w-14 p-2 text-[10px] border rounded-lg font-bold text-center" placeholder="Qty" value={projForm.newPartCount} onChange={e=>setProjForm({...projForm, newPartCount: e.target.value})} />
                                  <button type="button" onClick={addGeneratedParts} className="flex-1 bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-md hover:bg-slate-700">Generate</button>
                              </div>
                              <div className="flex gap-2">
                                  <input className="flex-1 p-2 text-[10px] border rounded-lg font-bold" placeholder="Manual Add" value={projForm.manualPart} onChange={e=>setProjForm({...projForm, manualPart: e.target.value})} />
                                  <button type="button" onClick={addManualPart} className="bg-white border px-3 rounded-lg text-[10px] font-bold hover:bg-slate-50">+</button>
                              </div>
                              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                  {projForm.partNos.map(p => <span key={p} onClick={() => removePart(p)} className="cursor-pointer text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md font-bold text-slate-600 hover:bg-red-50 hover:text-red-500 hover:border-red-200">{p}</span>)}
                              </div>
                           </div>

                           {/* WORK TYPES */}
                           <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Required Work Types</label>
                                <div className="flex flex-wrap gap-2">
                                    {state.workTypes.map((w: string) => (
                                        <button type="button" key={w} onClick={()=>setProjForm(prev => ({...prev, workTypes: toggleList(prev.workTypes, w)}))} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${projForm.workTypes.includes(w)?'bg-indigo-600 text-white border-indigo-600 shadow-md':'bg-white text-slate-500 border-slate-200 hover:border-indigo-300'}`}>{w}</button>
                                    ))}
                                </div>
                           </div>
                        </form>
                    </div>

                    {/* === RIGHT COLUMN (Scope Builder) === */}
                    <div className="flex-1 bg-indigo-50/50 p-6 flex flex-col overflow-hidden w-2/3">
                        
                        {/* Builder Grid */}
                        <div className="flex gap-4 items-stretch mb-4 h-52">
                             {/* Selectors */}
                            <div className="flex-1 grid grid-cols-3 gap-3 h-full">
                                {/* 1. Div Selector */}
                                <div className="bg-white border border-indigo-100 rounded-2xl p-3 flex flex-col shadow-sm">
                                    <div className="flex justify-between mb-2 pb-1 border-b border-slate-50"><span className="text-[10px] font-black uppercase text-slate-400">1. Divisions</span><button type="button" onClick={() => setProjForm(prev => ({...prev, tempMapDivs: prev.tempMapDivs.length === prev.divisions.length ? [] : prev.divisions}))} className="text-[9px] text-indigo-600 font-bold hover:bg-indigo-50 px-2 rounded">ALL</button></div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                        {projForm.divisions.map(d => {
                                            const lockStatus = getItemLockStatus('div', d);
                                            return (
                                                <div key={d} onClick={() => !lockStatus && setProjForm(prev=>({...prev, tempMapDivs: toggleList(prev.tempMapDivs, d)}))} className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-all flex justify-between items-center ${lockStatus==='ALLOCATED'?'bg-amber-100 text-amber-800 border-amber-200 opacity-80':lockStatus==='COMPLETED'?'bg-green-100 text-green-800 border-green-200 opacity-80':projForm.tempMapDivs.includes(d)?'bg-indigo-600 text-white border-indigo-600 shadow-sm':'hover:bg-slate-50 text-slate-500 border-transparent'}`}>{d}{lockStatus && <i className="fas fa-lock text-[8px]"></i>}</div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* 2. Part Selector */}
                                <div className="bg-white border border-indigo-100 rounded-2xl p-3 flex flex-col shadow-sm">
                                    <div className="flex justify-between mb-2 pb-1 border-b border-slate-50"><span className="text-[10px] font-black uppercase text-slate-400">2. Parts</span><button type="button" onClick={() => setProjForm(prev => ({...prev, tempMapParts: prev.tempMapParts.length === prev.partNos.length ? [] : prev.partNos}))} className="text-[9px] text-indigo-600 font-bold hover:bg-indigo-50 px-2 rounded">ALL</button></div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                        {projForm.partNos.map(p => {
                                            const lockStatus = getItemLockStatus('part', p);
                                            return (
                                                <div key={p} onClick={() => !lockStatus && setProjForm(prev=>({...prev, tempMapParts: toggleList(prev.tempMapParts, p)}))} className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-all flex justify-between items-center ${lockStatus==='ALLOCATED'?'bg-amber-100 text-amber-800 border-amber-200 opacity-80':lockStatus==='COMPLETED'?'bg-green-100 text-green-800 border-green-200 opacity-80':projForm.tempMapParts.includes(p)?'bg-indigo-600 text-white border-indigo-600 shadow-sm':'hover:bg-slate-50 text-slate-500 border-transparent'}`}>{p}{lockStatus && <i className="fas fa-lock text-[8px]"></i>}</div>
                                            );
                                        })}
                                    </div>
                                </div>
                                {/* 3. WT Selector */}
                                <div className="bg-white border border-indigo-100 rounded-2xl p-3 flex flex-col shadow-sm">
                                    <div className="flex justify-between mb-2 pb-1 border-b border-slate-50"><span className="text-[10px] font-black uppercase text-slate-400">3. Work Types</span><button type="button" onClick={() => setProjForm(prev => ({...prev, tempMapWTs: prev.tempMapWTs.length === prev.workTypes.length ? [] : prev.workTypes}))} className="text-[9px] text-indigo-600 font-bold hover:bg-indigo-50 px-2 rounded">ALL</button></div>
                                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
                                        {projForm.workTypes.map(w => {
                                            const lockStatus = getItemLockStatus('wt', w);
                                            return (
                                                <div key={w} onClick={() => !lockStatus && setProjForm(prev=>({...prev, tempMapWTs: toggleList(prev.tempMapWTs, w)}))} className={`text-[10px] px-2 py-1 rounded-lg font-bold border transition-all flex justify-between items-center ${lockStatus==='ALLOCATED'?'bg-amber-100 text-amber-800 border-amber-200 opacity-80':lockStatus==='COMPLETED'?'bg-green-100 text-green-800 border-green-200 opacity-80':projForm.tempMapWTs.includes(w)?'bg-indigo-600 text-white border-indigo-600 shadow-sm':'hover:bg-slate-50 text-slate-500 border-transparent'}`}>{w}{lockStatus && <i className="fas fa-lock text-[8px]"></i>}</div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Action Buttons (Add/Update & Undo) */}
                            <div className="flex flex-col gap-2 w-24">
                                {/* ADD / UPDATE BUTTON */}
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        if(projForm.tempMapDivs.length === 0 || projForm.tempMapParts.length === 0 || projForm.tempMapWTs.length === 0) {
                                            alert("Select at least one Division, Part, and Work Type.");
                                            return;
                                        }
                                        const newRule = { divs: projForm.tempMapDivs, parts: projForm.tempMapParts, wts: projForm.tempMapWTs };
                                        
                                        if (projForm.editingRuleIndex !== null) {
                                            // 🟢 UPDATE MODE: Replace existing rule
                                            const updatedMapping = [...projForm.scopeMapping];
                                            updatedMapping[projForm.editingRuleIndex] = newRule;
                                            setProjForm(prev => ({
                                                ...prev, scopeMapping: updatedMapping, 
                                                tempMapDivs: [], tempMapParts: [], tempMapWTs: [], editingRuleIndex: null
                                            }));
                                        } else {
                                            // 🟢 ADD MODE: Append new rule
                                            setProjForm(prev => ({
                                                ...prev, scopeMapping: [...prev.scopeMapping, newRule], 
                                                tempMapDivs: [], tempMapParts: [], tempMapWTs: [], editingRuleIndex: null
                                            }));
                                        }
                                    }}
                                    className={`flex-1 rounded-2xl flex flex-col items-center justify-center font-black transition-transform hover:scale-[1.02] active:scale-95 text-white shadow-lg ${projForm.editingRuleIndex !== null ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                                >
                                    <span className={`text-2xl mb-1 ${projForm.editingRuleIndex !== null ? 'rotate-0' : ''}`}>{projForm.editingRuleIndex !== null ? '↻' : '+'}</span>
                                    <span className="text-[9px] uppercase font-bold tracking-wider">{projForm.editingRuleIndex !== null ? 'Update' : 'Add'}</span>
                                </button>

                                {/* UNDO BUTTON */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setProjForm(prev => ({
                                            ...prev, 
                                            tempMapDivs: [], tempMapParts: [], tempMapWTs: [], editingRuleIndex: null
                                        }));
                                    }}
                                    className="h-12 bg-white border-2 border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-400 rounded-xl flex flex-col items-center justify-center font-bold text-[9px] uppercase transition-colors"
                                    title="Clear Selection / Cancel Edit"
                                >
                                    <i className="fas fa-undo mb-0.5"></i> Undo
                                </button>
                            </div>
                        </div>

                        {/* Rules List Header */}
                        <div className="flex justify-between items-end mb-3 pb-2 border-b border-indigo-200">
                             <div>
                                <h3 className="font-black text-indigo-900 uppercase text-sm">Active Rules</h3>
                                <p className="text-[10px] text-indigo-500">
                                    {projForm.scopeMapping.length === 0 
                                        ? "List is empty. Project will use 'All-to-All' logic automatically." 
                                        : "Specific rules are active. 'All-to-All' logic is disabled."}
                                </p>
                             </div>
                             <span className="text-[10px] font-bold bg-white text-indigo-600 px-3 py-1 rounded-full shadow-sm ring-1 ring-indigo-100">{projForm.scopeMapping.length} Rules</span>
                        </div>

                        {/* RULES LIST AREA */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                             {projForm.scopeMapping.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <i className="fas fa-layer-group text-5xl mb-4 text-indigo-200"></i>
                                    <p className="text-sm font-bold text-slate-500">
                                        {editingProjectId ? 'Legacy Mode: All-to-All' : 'Default: All-to-All'}
                                    </p>
                                    <p className="text-xs text-center max-w-[200px]">
                                        {editingProjectId 
                                            ? "This project uses dynamic legacy mapping." // Old projects stay implicit
                                            : "An explicit All-to-All rule will be created automatically upon save." // New projects get explicit rule
                                        }
                                    </p>
                                </div>
                            )}
                            {projForm.scopeMapping.map((rule, idx) => {
                                const isLocked = isRuleInUse(rule); 
                                const isEditing = projForm.editingRuleIndex === idx;

                                // 🟢 1. DETERMINE PROJECT TYPE
                                // Check if the project being edited originally had rules defined.
                                // If yes, it's a "Standard Project". If no (or null), it's "Legacy".
                                const originalProject = editingProjectId 
                                    ? state.projects.find((p: Project) => p.id === editingProjectId) 
                                    : null;
                                    
                                const isLegacyProject = originalProject 
                                    ? (!originalProject.scopeStructure || originalProject.scopeStructure === "[]")
                                    : true; // New projects (unsaved) are treated loosely until saved

                                // 🟢 2. CALCULATE DELETE GUARD
                                const isLastRule = projForm.scopeMapping.length === 1;
                                
                                // We forbid deletion if:
                                // A. It is the LAST rule
                                // B. AND it is NOT a legacy project (Standard projects must have >= 1 rule)
                                // C. AND we are in Edit Mode (not creating a fresh project from scratch)
                                const isDeleteDisabled = isLocked || isEditing || (isLastRule && !isLegacyProject && editingProjectId);

                                return (
                                    <div key={idx} className={`bg-white p-4 rounded-2xl border-l-[6px] shadow-sm flex gap-4 items-center group transition-all ${isEditing ? 'border-l-amber-500 ring-2 ring-amber-100 bg-amber-50' : isLocked ? 'border-l-slate-400 bg-slate-50/50' : 'border-l-indigo-500 hover:shadow-md'}`}>
                                        <div className="flex-1 grid grid-cols-3 gap-6 text-xs">
                                            <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Divisions</span><span className="font-bold text-slate-700 leading-relaxed">{rule.divs.join(', ')}</span></div>
                                            <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Parts</span><span className="font-bold text-slate-700 leading-relaxed">{rule.parts.join(', ')}</span></div>
                                            <div><span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Work Types</span><span className="font-bold text-indigo-600 leading-relaxed">{rule.wts.join(', ')}</span></div>
                                        </div>

                                        <div className="flex gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {/* Edit Button */}
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setProjForm(prev => ({ 
                                                        ...prev, 
                                                        tempMapDivs: rule.divs, tempMapParts: rule.parts, tempMapWTs: rule.wts, 
                                                        editingRuleIndex: idx 
                                                    }));
                                                }} 
                                                className={`p-2.5 rounded-xl transition-colors ${isEditing ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-50 hover:bg-indigo-100 text-indigo-600'}`}
                                                title="Edit Rule"
                                            >
                                                <i className="fas fa-edit"></i>
                                            </button>
                                            
                                            {/* Delete Button - UPDATED WITH GUARD */}
                                            <button 
                                                type="button" 
                                                disabled={isDeleteDisabled}
                                                onClick={() => {
                                                    if(window.confirm("Are you sure you want to delete this scope rule?")) {
                                                        setProjForm(prev => ({...prev, scopeMapping: prev.scopeMapping.filter((_, i) => i !== idx)}));
                                                    }
                                                }} 
                                                className={`p-2.5 rounded-xl transition-colors ${
                                                    isDeleteDisabled 
                                                    ? 'bg-slate-100 text-slate-300 cursor-not-allowed' 
                                                    : 'bg-slate-50 hover:bg-red-100 text-red-500'
                                                }`}
                                                title={
                                                    isLocked ? "Cannot delete: Work allocated" : 
                                                    isEditing ? "Cannot delete: Currently editing" :
                                                    (isLastRule && !isLegacyProject) ? "Cannot delete: Project must have at least one rule" :
                                                    "Delete Rule"
                                                }
                                            >
                                                {isLocked ? <i className="fas fa-lock"></i> : <i className="fas fa-trash"></i>}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center">
                      <div className="text-[10px] text-slate-400 font-bold ml-2">
                          {editingProjectId ? 'EDITING EXISTING PROJECT' : 'CREATING NEW PROJECT'}
                      </div>
                      <div className="flex gap-3">
                          {/* Cancel DIV (Safe) */}
                          {/* DISABLED if builder is active (user must Undo or Add first) */}
                          <button 
                             disabled={isBuilderActive}
                             type="button"
                             onClick={() => setShowAddProject(false)} 
                             className={`px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-wide border-2 ${isBuilderActive ? 'border-slate-100 text-slate-300 cursor-not-allowed' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                          >
                              Cancel
                          </button>
                          
                          {/* Submit Button */}
                          {/* DISABLED if builder is active */}
                          <button 
                            disabled={isBuilderActive}
                            type="submit" 
                            form="projectForm" 
                            className={`px-10 py-3 rounded-xl font-black text-xs uppercase tracking-wide shadow-lg transition-all transform ${isBuilderActive ? 'bg-slate-300 text-white shadow-none cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 active:scale-95'}`}
                          >
                              {editingProjectId ? 'Save Changes' : 'Create Project'}
                          </button>
                      </div>
                </div>

             </div>
          </div>
      )}

      {/* DEPLOY / REWORK MODAL */}
      {(showDeploy || showRework) && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className={`bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl ${showRework ? 'border-t-4 border-red-500' : ''}`}>
               <h2 className="text-2xl font-black mb-6 text-slate-900">{showRework ? 'Rework Order' : editId ? 'Edit Allocation' : 'Deploy Team'}</h2>
               
               {/* 1. FORM STARTS HERE (Note the ID) */}
               <form id="deployForm" onSubmit={showRework ? handleReworkSubmit : handleDeploySubmit} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-400">Project</label>
                          <select required disabled={!!editId || showRework} className="w-full border-2 border-slate-100 p-3 rounded-xl font-bold bg-white" value={allocForm.projectId} onChange={e=>setAllocForm({...allocForm, projectId: e.target.value})}>
                              <option value="">Select...</option>
                              {state.projects.map((p: Project) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Team</label>
                        <select 
                            required 
                            disabled={!!editId}
                            className={`w-full border-2 p-3 rounded-xl font-bold ${editId ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-100' : 'bg-white border-slate-100'}`} 
                            value={allocForm.teamId} 
                            onChange={e=>setAllocForm({...allocForm, teamId: e.target.value})}
                        >
                            <option value="">Select...</option>
                            {state.teams.map((t: Team) => (
                                <option key={t.id} value={t.id}>{t.name} ({getAvailabilityLabel(t.id)})</option>
                            ))}
                        </select>
                        {editId && <p className="text-[10px] text-amber-600 font-bold"><i className="fas fa-lock"></i> Locked for editing</p>}
                    </div>
                  </div>
                  
                  {/* Scope Selector */}
                  {allocForm.projectId && selectedDeployProject && (
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 max-h-60 overflow-y-auto custom-scrollbar">
                        <h3 className="font-bold text-xs uppercase mb-3 text-slate-500">Select Scope to Assign</h3>
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
                                                    const existingAssignment = state.groupAssignments.find((ga: GroupAssignment) =>
                                                        ga.projectId === selectedDeployProject.id &&
                                                        ga.scope.some((sc: ScopeItem) =>
                                                            sc.division === s.division &&
                                                            sc.parts.some((pt: any) => pt.name === p.name && pt.workTypes.includes(wt))
                                                        )
                                                    );
                                                    const isCompleted = existingAssignment?.status === 'COMPLETED';
                                                    const isAllocated = existingAssignment && !isCompleted;

                                                    let buttonClass = "text-[9px] px-2 py-0.5 rounded border transition-all font-bold ";
                                                    if (isSelected) buttonClass += isCompleted ? "bg-blue-600 text-white border-green-400 border-2" : isAllocated ? "bg-blue-600 text-white border-yellow-400 border-2" : "bg-indigo-600 text-white border-indigo-600";
                                                    else buttonClass += isCompleted ? "bg-green-100 text-green-700 border-green-200" : isAllocated ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "bg-white text-slate-400 border-slate-200";

                                                    return (
                                                        <button 
                                                            type="button" key={wt} 
                                                            onClick={() => toggleAllocScope(s.division, p.name, wt)}
                                                            className={buttonClass}
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
               </form> 
               {/* 2. FORM ENDS HERE. BUTTONS ARE OUTSIDE. */}

               <div className="flex gap-3 pt-4">
                  {/* Confirm Button - Uses form="deployForm" to link back to the form */}
                  <button 
                      type="submit" 
                      form="deployForm" 
                      className={`flex-1 text-white py-3 rounded-xl font-black uppercase shadow-lg transition-colors ${showRework ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                  >
                      Confirm
                  </button>

                  {/* Cancel Button - Completely independent now */}
                  <button 
                      type="button" 
                      onClick={(e) => {
                          e.preventDefault(); 
                          setShowDeploy(false); 
                          setShowRework(false);
                          setEditId(null);
                          setAllocScope([]);
                      }} 
                      className="flex-1 bg-white border border-slate-200 text-slate-500 py-3 rounded-xl font-black uppercase hover:bg-slate-50"
                  >
                      Cancel
                  </button>
               </div>
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
                            <td className="p-2">{ma.screenshot && <button onClick={()=>setViewScreenshot(`/${ma.screenshot}`)} className="text-blue-600 underline font-bold">View Image</button>}</td>
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