import React, { useState } from 'react';
import { MemberAssignment } from '../types';
import { StatsView, ReportGenerator } from './StatsAndReports';

interface MemberDashboardProps { 
    store: any; 
    currentView: 'home' | 'projects' | 'reports';
}

const MemberDashboard: React.FC<MemberDashboardProps> = ({ store, currentView }) => {
  const { state, submitMemberWork, updateMemberAssignment, addRemark } = store;
  
  const [filterTab, setFilterTab] = useState('ongoing'); 
  const [searchQuery, setSearchQuery] = useState('');

  const getFilteredTasks = () => {
     return state.memberAssignments.filter((ma: MemberAssignment) => {
        if (ma.memberId !== state.currentUser?.id) return false;
        const ga = state.groupAssignments.find(g => g.id === ma.groupAssignmentId);
        const proj = state.projects.find(p => p.id === ga?.projectId);

        let tabMatch = false;
        if (filterTab === 'hold') tabMatch = proj?.status === 'ON_HOLD';
        else if (filterTab === 'completed') tabMatch = ma.status === 'COMPLETED';
        else if (filterTab === 'ongoing') tabMatch = ma.status !== 'COMPLETED' && proj?.status !== 'ON_HOLD';
        else if (filterTab === 'recent') tabMatch = ma.status === 'COMPLETED' && new Date(ma.completionTime!) > new Date(Date.now() - 86400000);
        
        if (!tabMatch) return false;
        if (searchQuery.trim()) return proj?.name.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
     });
  };

  const handleReject = (ma: MemberAssignment) => {
      const reason = prompt("Reason for rejection:");
      if (reason) updateMemberAssignment(ma.id, { status: 'REJECTION_REQ', rejectionReason: reason });
  };

  if (currentView === 'home') return <StatsView stats={state.stats} role="MEMBER" userName={state.currentUser?.name} />;
  if (currentView === 'reports') return <ReportGenerator store={store} role="MEMBER" />;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-4">
             <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">My Tasks</h2>
             <div className="flex bg-slate-100 p-1 rounded-lg">
                 {['ongoing', 'recent', 'completed', 'hold'].map(t => (
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
                    
                    {/* SCOPE ITEMS (Safe Render) */}
                    <div className="grid grid-cols-4 gap-4 text-xs">
                        <div className="col-span-2">
                            <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Scope</p>
                            <div className="flex flex-wrap gap-1">
                                {task.divisions && Array.isArray(task.divisions) && task.divisions.filter((d: any) => typeof d === 'string').map((d: string) => (
                                    <span key={d} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700">{d}</span>
                                ))}
                                {task.partNos && Array.isArray(task.partNos) && task.partNos.filter((p: any) => typeof p === 'string').map((p: string) => (
                                    <span key={p} className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-700">{p}</span>
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
                             {/* UPDATED: Displays Date AND Time */}
                             <span className="text-[9px] text-slate-400 font-bold">{new Date(task.completionTime!).toLocaleString()}</span>
                         </div>
                     ) : task.status === 'PENDING_ACK' ? (
                         <div className="text-center text-amber-600 font-black uppercase text-xs flex flex-col items-center gap-1"><i className="fas fa-clock text-2xl"></i>Wait for TL</div>
                     ) : task.status === 'REJECTION_REQ' ? (
                         <div className="text-center text-orange-600 font-black uppercase text-xs">Rejection Pending</div>
                     ) : (
                         <>
                            <button onClick={()=>{const r=prompt("Final Remarks:", ""); if(r) submitMemberWork(task.id, r)}} className="bg-slate-900 text-white py-3 rounded-xl font-black text-xs uppercase shadow-lg shadow-slate-200 hover:bg-slate-800">Submit</button>
                            <button onClick={()=>handleReject(task)} className="bg-red-50 text-red-600 py-3 rounded-xl font-black text-xs uppercase border border-red-100 hover:bg-red-100">Reject</button>
                         </>
                     )}
                  </div>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};
export default MemberDashboard;