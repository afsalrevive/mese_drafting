import React, { useState, useEffect } from 'react';
import { MemberAssignment } from '../types';
import { StatsView, ReportGenerator } from './StatsAndReports';

interface MemberDashboardProps { 
    store: any; 
    currentView: 'home' | 'projects' | 'reports';
}

const MemberDashboard: React.FC<MemberDashboardProps> = ({ store, currentView }) => {
  const { state, updateMemberAssignment, addRemark } = store;
  const [successMsg, setSuccessMsg] = useState('');
  
  const [filterTab, setFilterTab] = useState('ongoing'); 
  const [searchQuery, setSearchQuery] = useState('');

  // --- NEW STATE FOR SUBMISSION MODAL ---
  const [selectedAssignment, setSelectedAssignment] = useState<MemberAssignment | null>(null);
  const [submitTime, setSubmitTime] = useState('');
  const [remarks, setRemarks] = useState('');

  // --- EFFECT: PRE-LOAD TIME WHEN MODAL OPENS ---
  useEffect(() => {
    if (selectedAssignment) {
        // Get current local time in ISO format (YYYY-MM-DDThh:mm) for the input
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        setSubmitTime(now.toISOString().slice(0, 16));
        setRemarks('');
        setFileToUpload(null);
        setSuccessMsg('');
    }
  }, [selectedAssignment]);

  const getFilteredTasks = () => {
     return state.memberAssignments.filter((ma: MemberAssignment) => {
        if (ma.memberId !== state.currentUser?.id) return false;
        const ga = state.groupAssignments.find(g => g.id === ma.groupAssignmentId);
        const proj = state.projects.find(p => p.id === ga?.projectId);

        let tabMatch = false;
        if (filterTab === 'hold') tabMatch = proj?.status === 'ON_HOLD';
        else if (filterTab === 'completed') tabMatch = ma.status === 'COMPLETED';
        else if (filterTab === 'rejected') tabMatch = ma.status === 'REJECTED' || ma.status === 'REJECTION_REQ';
        else if (filterTab === 'ongoing') tabMatch = ma.status !== 'COMPLETED' && ma.status !== 'REJECTED' && proj?.status !== 'ON_HOLD';
        else if (filterTab === 'recent') tabMatch = ma.status === 'COMPLETED' && new Date(ma.completionTime!) > new Date(Date.now() - 86400000);
        
        if (!tabMatch) return false;
        if (searchQuery.trim()) return proj?.name.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
     });
  };

  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const handleReject = (ma: MemberAssignment) => {
      const reason = prompt("Reason for rejection:");
      if (reason) updateMemberAssignment(ma.id, { status: 'REJECTION_REQ', rejectionReason: reason });
  };

  // --- HANDLER: SUBMIT WORK ---
  const handleSubmitWork = async () => {
    if (!selectedAssignment) return;

    const token = localStorage.getItem('token');
    if (!token) {
        setSuccessMsg("Error: Please log in again.");
        return;
    }

    const formData = new FormData();
    formData.append('id', String(selectedAssignment.id));
    formData.append('remarks', remarks);
    
    if (state.config?.ALLOW_TIME_EDIT && submitTime) {
        formData.append('customTime', new Date(submitTime).toISOString());
    }
    
    if (fileToUpload) {
        formData.append('screenshot', fileToUpload);
    }

    try {
        const response = await fetch('/api/memberAssignments/submit', {
            method: 'POST',
            headers: { 'Authorization': token }, // Removed "Bearer " as per your server setup
            body: formData
        });
        
        if (!response.ok) {
            const err = await response.text();
            throw new Error(err || 'Server Error');
        }

        // 2. UPDATED: Show Inline Message & Auto-Refresh
        setSuccessMsg("✓ Submitted Successfully! Updating...");
        
        // Wait 1.5s then reload to show new status
        setTimeout(() => {
            window.location.reload(); 
        }, 1500);

    } catch (err: any) {
        console.error("Upload failed", err);
        const msg = err.message || JSON.stringify(err);
        setSuccessMsg("❌ Failed: " + msg);
    }
  };

  if (currentView === 'home') return <StatsView stats={state.stats} role="MEMBER" userName={state.currentUser?.name} />;
  if (currentView === 'reports') return <ReportGenerator store={store} role="MEMBER" />;

  return (
    <div className="space-y-6 animate-fadeIn relative">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">My Tasks</h2>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                 {['ongoing', 'recent', 'completed', 'hold','rejected'].map(t => (
                     <button key={t} onClick={()=>setFilterTab(t)} className={`px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${filterTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{t}</button>
                 ))}
             </div>
         </div>
         <div className="relative">
            <i className="fas fa-search absolute left-3 top-2.5 text-slate-400 text-xs"></i>
            <input placeholder="Search..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-bold w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
         </div>
      </div>

      {/* STATS CARDS */}
      <div className="flex gap-4 mb-4">
         <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400">Bonus Points</span>
            <span className="text-2xl font-black text-green-500">{state.currentUser?.bonusPoints}</span>
         </div>
         <div className="flex-1 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-400">Blackmarks</span>
            <span className="text-2xl font-black text-red-500">{state.currentUser?.blackmarks}</span>
         </div>
      </div>

      {/* TASK GRID */}
      <div className="grid gap-6">
        {getFilteredTasks().map((task: MemberAssignment) => {
            const ga = state.groupAssignments.find(g => g.id === task.groupAssignmentId);
            const project = state.projects.find(p => p.id === ga?.projectId);
            const isDone = task.status === 'COMPLETED';
            
            return (
              <div key={task.id} className={`bg-white rounded-3xl shadow-sm border-2 p-6 transition-all hover:shadow-lg ${isDone?'border-green-100 opacity-90':task.status==='REJECTED'?'border-red-100':'border-slate-50'}`}>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-grow space-y-4">
                    <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${task.status==='REJECTED'?'bg-red-100 text-red-600':task.status==='REJECTION_REQ'?'bg-orange-100 text-orange-600':'bg-indigo-100 text-indigo-700'}`}>{task.status.replace('_', ' ')}</span>
                        <h3 className="text-xl font-black text-slate-900">{project?.name}</h3>
                    </div>
                    
                    {/* SCOPE ITEMS */}
                    <div className="grid grid-cols-4 gap-4 text-xs">
                        <div className="col-span-2">
                            <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Scope</p>
                            <div className="space-y-1">
                                {task.scope && task.scope.map((s: any, idx: number) => (
                                    <div key={idx} className="bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                        <span className="font-bold text-[10px] text-indigo-800 mr-1">{s.division}:</span>
                                        <span className="text-[10px] text-slate-600">
                                            {s.parts.map((p: any) => `${p.name} [${p.workTypes.join(',')}]`).join('; ')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div><p className="font-bold text-slate-400 uppercase text-[10px]">Start</p><p className="font-bold">{new Date(task.assignedTime).toLocaleString()}</p></div>
                        <div><p className="font-bold text-slate-400 uppercase text-[10px]">ETA</p><p className="font-bold text-amber-600">{new Date(task.eta).toLocaleString()}</p></div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs italic text-slate-500 flex justify-between">
                        <span>"{task.remarks || 'No remarks'}"</span>
                        {!isDone && <button onClick={()=>{const r=prompt("Edit", task.remarks); if(r) addRemark(task.id, false, r)}} className="text-indigo-500 font-bold not-italic hover:underline">Edit</button>}
                    </div>
                    {(task.status === 'REJECTED' || task.status === 'REJECTION_REQ') && <div className="bg-red-50 p-3 rounded-xl text-xs text-red-600 font-bold">Reason: {task.rejectionReason}</div>}
                  </div>
                  
                  <div className="flex flex-col justify-center gap-2 min-w-[150px] border-l pl-6">
                     {isDone ? (
                         <div className="text-center text-green-600 font-black uppercase text-xs flex flex-col items-center gap-1">
                             <i className="fas fa-check-circle text-2xl"></i>
                             <span>Completed</span>
                             <span className="text-[9px] text-slate-400 font-bold">{new Date(task.completionTime!).toLocaleString()}</span>
                         </div>
                     ) : task.status === 'PENDING_ACK' ? (
                         <div className="text-center text-amber-600 font-black uppercase text-xs flex flex-col items-center gap-1"><i className="fas fa-clock text-2xl"></i>Wait for TL</div>
                     ) : task.status === 'REJECTION_REQ' ? (
                         <div className="flex flex-col items-center gap-2">
                             <span className="text-center text-orange-600 font-black uppercase text-xs">Rejection Pending</span>
                             <button 
                                 onClick={() => updateMemberAssignment(task.id, { status: 'IN_PROGRESS', rejectionReason: null })} 
                                 className="bg-orange-50 text-orange-600 px-3 py-1 rounded-lg text-[10px] font-bold border border-orange-100 hover:bg-orange-100"
                             >
                                 Revoke
                             </button>
                         </div>
                     // FIX: Handle REJECTED status to hide Submit/Reject buttons
                     ) : task.status === 'REJECTED' ? (
                         <div className="text-center text-red-600 font-black uppercase text-xs">
                             <i className="fas fa-ban text-2xl mb-1 block"></i>
                             Rejection Accepted
                         </div>
                     ) : (
                         <>
                            {/* UPDATED: OPEN MODAL INSTEAD OF PROMPT */}
                            <button onClick={()=>setSelectedAssignment(task)} className="bg-slate-900 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-slate-200 hover:bg-slate-800">Submit</button>
                            <button onClick={()=>handleReject(task)} className="bg-red-50 text-red-600 py-3 rounded-xl font-black text-xs uppercase border border-red-100 hover:bg-red-100">Reject</button>
                         </>
                     )}
                  </div>
                </div>
              </div>
            );
        })}
      </div>

      {/* --- SUBMISSION MODAL --- */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-slideUp">
                <h3 className="text-lg font-black text-slate-900 mb-1">Submit Assignment</h3>
                <p className="text-xs text-slate-500 mb-6 font-bold">Project: {state.projects.find(p => p.id === state.groupAssignments.find(g => g.id === selectedAssignment.groupAssignmentId)?.projectId)?.name}</p>
                
                {/* 3. SHOW SUCCESS MESSAGE OR FORM */}
                {successMsg ? (
                    <div className="py-8 text-center">
                        <div className={`text-sm font-black mb-2 ${successMsg.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                            {successMsg}
                        </div>
                        {!successMsg.includes('Failed') && <div className="text-xs text-slate-400 animate-pulse">Refreshing...</div>}
                        
                        {/* Show Retry Button only if failed */}
                        {successMsg.includes('Failed') && (
                            <button onClick={()=>setSuccessMsg('')} className="mt-4 bg-slate-100 text-slate-600 px-4 py-2 rounded text-xs font-bold">Try Again</button>
                        )}
                    </div>
                ) : (
                    <>
                        {state.config?.ALLOW_TIME_EDIT && (
                            <div className="mb-4 bg-amber-50 p-3 rounded-xl border border-amber-100">
                                <label className="block text-[10px] font-black text-amber-600 uppercase mb-1">Custom Completion Time</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full bg-white border border-amber-200 p-2 rounded-lg text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
                                    value={submitTime} 
                                    onChange={e => setSubmitTime(e.target.value)} 
                                />
                                <p className="text-[9px] text-amber-500 mt-1 font-bold"><i className="fas fa-exclamation-circle"></i> Admin enabled manual time entry.</p>
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Proof Screenshot (Optional)</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => setFileToUpload(e.target.files?.[0] || null)}
                                className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-black file:uppercase file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                            {fileToUpload && <p className="text-[9px] text-green-600 font-bold mt-1 ml-1">✓ Image Attached: {fileToUpload.name}</p>}
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Remarks (Optional)</label>
                            <textarea 
                                className="w-full border border-slate-200 p-3 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 min-h-[100px]" 
                                placeholder="Notes for Team Lead..." 
                                value={remarks} 
                                onChange={e => setRemarks(e.target.value)} 
                            />
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={handleSubmitWork} 
                                className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                            >
                                Confirm Submit
                            </button>
                            <button 
                                onClick={() => { setSelectedAssignment(null); setFileToUpload(null); setRemarks(''); }} 
                                className="flex-1 bg-slate-100 text-slate-500 py-3 rounded-xl font-black text-xs uppercase hover:bg-slate-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
export default MemberDashboard;