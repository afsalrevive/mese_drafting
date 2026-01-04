import React, { useState } from 'react';

// --- SHARED UI COMPONENTS ---
const LeaderboardCard = ({ title, data, icon, colorClass }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
        <h3 className="font-bold text-slate-900 mb-6 border-b pb-4 flex items-center gap-2">
            <i className={`fas ${icon} ${colorClass}`}></i> {title}
        </h3>
        <div className="space-y-4">
            {data?.map((item, i) => (
                <div key={item.name} className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black text-white ${i===0?'bg-yellow-400':i===1?'bg-slate-400':'bg-orange-400'}`}>{i+1}</div>
                        <span className="text-xs font-bold text-slate-700">{item.name}</span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                        <span className="text-[10px] text-green-600 font-bold" title="Bonus">+{item.bonusPoints}</span>
                        <span className="text-[10px] text-red-500 font-bold" title="Blackmarks">-{item.blackmarks}</span>
                        <span className="font-black text-slate-800 text-sm w-8 text-right">{item.netScore}</span>
                    </div>
                </div>
            ))}
            {(!data || data.length === 0) && <p className="text-xs text-slate-400 italic text-center">No data yet</p>}
        </div>
    </div>
);

const BarChartCard = ({ title, data, valueSuffix, barColor }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-full">
        <h3 className="font-bold text-slate-900 mb-6 border-b pb-4">{title}</h3>
        <div className="space-y-5">
            {data?.map((t) => {
                const maxVal = Math.max(...data.map(d => d.value)) || 1;
                const pct = (t.value / maxVal) * 100;
                return (
                    <div key={t.name}>
                        <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-700">{t.name}</span>
                            <span className="text-slate-500">{t.value} {valueSuffix}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div style={{width: `${pct}%`}} className={`h-full rounded-full transition-all duration-1000 ${barColor}`}></div>
                        </div>
                        {t.details && <p className="text-[9px] text-slate-400 mt-1 text-right">{t.details}</p>}
                    </div>
                );
            })}
            {(!data || data.length === 0) && <p className="text-xs text-slate-400 italic text-center">No data available</p>}
        </div>
    </div>
);

export const StatsView = ({ stats, role, userName }) => {
    if (!stats) return <div className="p-10 text-center text-slate-400 animate-pulse">Loading Analytics...</div>;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* GREETING */}
            <div className="bg-white rounded-3xl p-6 border-l-8 border-indigo-600 shadow-sm flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900">Dashboard</h2>
                    <p className="text-slate-500 text-sm font-bold uppercase tracking-wide">Overview for {role.replace('_', ' ')}</p>
                </div>
                <div className="text-right hidden md:block">
                    <p className="text-4xl font-black text-slate-200">{new Date().getDate()}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase">{new Date().toLocaleString('default', { month: 'long' })}</p>
                </div>
            </div>

            {/* --- PROJECT MANAGER / ADMIN --- */}
            {(role === 'PROJECT_MANAGER' || role === 'ADMIN') && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Projects Done (7d)</p>
                            <p className="text-3xl font-black text-emerald-500">{stats.completedLastWeek}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Projects</p>
                            <p className="text-3xl font-black text-indigo-600">{stats.activeProjects}</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <LeaderboardCard title="Top Teams (Net Score)" data={stats.topTeams} icon="fa-trophy" colorClass="text-yellow-500" />
                        <BarChartCard title="Team Productivity (Work/Manpower)" data={stats.teamProductivity} valueSuffix="ratio" barColor="bg-blue-500" />
                        <BarChartCard title="Avg Completion Time (Hours)" data={stats.teamAvgTime} valueSuffix="hrs" barColor="bg-amber-400" />
                    </div>
                </>
            )}

            {/* --- TEAM LEAD --- */}
            {role === 'TEAM_LEAD' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Projects</p>
                            <p className="text-3xl font-black text-indigo-600">{stats.activeProjects}</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <LeaderboardCard title="Top Members (Net Score)" data={stats.topMembers} icon="fa-medal" colorClass="text-orange-500" />
                        <BarChartCard title="Member Productivity (Tasks Done)" data={stats.memberProductivity?.map(m => ({name: m.name, value: m.completed}))} valueSuffix="tasks" barColor="bg-emerald-500" />
                        <BarChartCard title="Avg Completion Speed" data={stats.memberAvgTime} valueSuffix="hrs" barColor="bg-indigo-400" />
                    </div>
                </>
            )}

            {/* --- MEMBER --- */}
            {role === 'MEMBER' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">My Net Score</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-4xl font-black text-slate-900">{stats.scoreData ? stats.scoreData.bonusPoints - stats.scoreData.blackmarks : 0}</p>
                        </div>
                        <div className="flex gap-3 mt-2 text-xs font-bold">
                            <span className="text-green-600">+{stats.scoreData?.bonusPoints || 0} Bonus</span>
                            <span className="text-red-500">-{stats.scoreData?.blackmarks || 0} Marks</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Done (7 Days)</p>
                        <p className="text-3xl font-black text-emerald-500">{stats.completedLastWeek}</p>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending</p>
                        <p className="text-3xl font-black text-indigo-600">{stats.pendingTasks}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export const ReportGenerator = ({ store, role }) => {
    const [filter, setFilter] = useState({ startDate: '', endDate: '', teamId: '', memberId: '' });
    const [data, setData] = useState<any[]>([]);

    const generate = async () => {
        if(!filter.startDate || !filter.endDate) return alert("Select Date Range");
        const res = await store.generateReport(filter);
        setData(res);
    };

    // Filter members based on team selection
    const filteredMembers = store.state.users.filter((u: any) => {
        if (filter.teamId) return u.teamId === parseInt(filter.teamId) && (u.roles.includes('MEMBER') || u.roles.includes('TEAM_LEAD'));
        if (role === 'PM' || role === 'ADMIN') return u.roles.includes('MEMBER') || u.roles.includes('TEAM_LEAD');
        return u.teamId === store.state.currentUser.teamId;
    });

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-black text-lg mb-6 text-slate-900">Generate Report</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Start Date</label><input type="date" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm" value={filter.startDate} onChange={e=>setFilter({...filter, startDate:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">End Date</label><input type="date" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm" value={filter.endDate} onChange={e=>setFilter({...filter, endDate:e.target.value})} /></div>
                    
                    {(role === 'PM' || role === 'ADMIN') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400">Filter Team</label>
                            <select className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm bg-white" value={filter.teamId} onChange={e=>setFilter({...filter, teamId:e.target.value, memberId: ''})}>
                                <option value="">All Teams</option>
                                {store.state.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    
                    {role !== 'MEMBER' && (
                         <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400">Filter Member</label>
                             <select className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm bg-white" value={filter.memberId} onChange={e=>setFilter({...filter, memberId:e.target.value})}>
                                 <option value="">All Members</option>
                                 {filteredMembers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                             </select>
                         </div>
                    )}
                    
                    <button onClick={generate} className="bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-slate-800 transition-transform active:scale-95">Generate Report</button>
                </div>
            </div>

            {data.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 font-black uppercase text-slate-500 tracking-wider">
                                <tr>
                                    <th className="p-4">Project</th>
                                    <th className="p-4">Team</th>
                                    <th className="p-4">Member</th>
                                    <th className="p-4">Work Scope</th>
                                    <th className="p-4">Assigned</th>
                                    <th className="p-4">ETA</th>
                                    <th className="p-4">Completed</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Rating</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {data.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-4 font-bold text-slate-800">{r.projectName}</td>
                                        <td className="p-4 text-slate-600 font-bold">{r.teamName}</td>
                                        <td className="p-4 text-slate-600">{r.memberName}</td>
                                        <td className="p-4 text-slate-500 font-medium">{r.divisions.length}D, {r.partNos.length}P</td>
                                        <td className="p-4 text-slate-500">{new Date(r.assignedTime).toLocaleDateString()}</td>
                                        <td className="p-4 text-amber-600 font-bold">{new Date(r.eta).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-emerald-600">{r.completionTime ? new Date(r.completionTime).toLocaleString() : '-'}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${r.status==='COMPLETED'?'bg-green-100 text-green-700':r.status==='REJECTED'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-600'}`}>{r.status}</span></td>
                                        <td className="p-4 text-amber-500 font-bold">{r.rating ? r.rating + ' ★' : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400"><p className="font-bold text-sm">No records found for this period.</p></div>}
        </div>
    );
};