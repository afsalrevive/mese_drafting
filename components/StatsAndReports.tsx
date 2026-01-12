import React, { useState } from 'react';
import ExportToolbar from './ExportToolbar'; 

// --- NEW: SIMPLE LINE CHART COMPONENT ---
const SimpleLineChart = ({ data, title }) => {
    if (!data || data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-400 italic bg-white rounded-2xl border border-slate-100 mt-6">No activity data to display</div>;

    const height = 250;
    const width = 600;
    const padding = 40; // Increased padding for Y-axis labels
    const chartHeight = height - padding * 2;
    const chartWidth = width - padding * 2;
    
    // Calculate Y-Axis Max Value
    const maxVal = Math.max(...data.map(d => Math.max(d.bonus, d.blackmark, d.projects)), 5);
    const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal].map(Math.round);

    const getX = (i) => padding + (i * (chartWidth / (data.length - 1 || 1)));
    const getY = (val) => height - padding - ((val / maxVal) * chartHeight);
    
    const makePath = (key) => data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`).join(' ');

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mt-6">
            <h3 className="font-bold text-slate-900 mb-6 border-b pb-4">{title}</h3>
            <div className="w-full overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-w-[500px]">
                    {/* Y-Axis Grid & Labels */}
                    {yTicks.map((tick, i) => {
                        const y = height - padding - ((tick / maxVal) * chartHeight);
                        return (
                            <g key={i}>
                                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                                <text x={padding - 10} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="bold">{tick}</text>
                            </g>
                        );
                    })}

                    {/* X-Axis Labels */}
                    {data.map((d, i) => (
                        <text key={i} x={getX(i)} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b" fontWeight="bold">
                            {d.name}
                        </text>
                    ))}

                    {/* Data Lines */}
                    <path d={makePath('bonus')} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={makePath('blackmark')} fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    <path d={makePath('projects')} fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                    {/* Data Points */}
                    {data.map((d, i) => (
                        <g key={i}>
                            <circle cx={getX(i)} cy={getY(d.bonus)} r="3" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                            <circle cx={getX(i)} cy={getY(d.blackmark)} r="3" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
                            <circle cx={getX(i)} cy={getY(d.projects)} r="3" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                        </g>
                    ))}
                </svg>
            </div>
            
            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4 pt-2 border-t border-slate-50">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span><span className="text-xs font-bold text-slate-600">Bonus Pts</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-xs font-bold text-slate-600">Blackmarks</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500"></span><span className="text-xs font-bold text-slate-600">Projects Done</span></div>
            </div>
        </div>
    );
};

// --- SHARED UI COMPONENTS (KEPT EXACTLY AS ORIGINAL) ---
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

// --- STATS VIEW (KEPT EXACTLY AS ORIGINAL) ---
export const StatsView = ({ stats, role, userName }) => {
    // Default to 'week' (Last 7 Days)
    const [graphMode, setGraphMode] = useState<'week' | 'month'>('week');

    if (!stats) return <div className="p-10 text-center text-slate-400 animate-pulse">Loading Analytics...</div>;

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Greeting */}
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

            {/* Admin / PM Stats */}
            {(role === 'PROJECT_MANAGER' || role === 'ADMIN') && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Projects Done (7d)</p><p className="text-3xl font-black text-emerald-500">{stats.pmCompletedLastWeek}</p></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Projects</p><p className="text-3xl font-black text-indigo-600">{stats.pmActiveProjects}</p></div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <LeaderboardCard title="Top Teams" data={stats.topTeams} icon="fa-trophy" colorClass="text-yellow-500" />
                        <BarChartCard title="Team Productivity" data={stats.teamProductivity} valueSuffix="ratio" barColor="bg-blue-500" />
                        <BarChartCard title="Avg Time (Hrs)" data={stats.teamAvgTime} valueSuffix="hrs" barColor="bg-amber-400" />
                    </div>
                </>
            )}

            {/* Team Lead Stats */}
            {role === 'TEAM_LEAD' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Active Projects</p><p className="text-3xl font-black text-indigo-600">{stats.tlActiveProjects || 0}</p></div>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <LeaderboardCard title="Top Members" data={stats.topMembers} icon="fa-medal" colorClass="text-orange-500" />
                        <BarChartCard title="Member Productivity" data={stats.memberProductivity?.map(m => ({name: m.name, value: m.completed}))} valueSuffix="tasks" barColor="bg-emerald-500" />
                        <BarChartCard title="Avg Speed" data={stats.memberAvgTime} valueSuffix="hrs" barColor="bg-indigo-400" />
                    </div>
                </>
            )}

            {/* Member Stats (With Graph) */}
            {role === 'MEMBER' && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">My Net Score</p>
                            <p className="text-4xl font-black text-slate-900">{stats.scoreData ? (stats.scoreData.bonusPoints - stats.scoreData.blackmarks) : 0}</p>
                            <div className="flex gap-3 mt-2 text-xs font-bold"><span className="text-green-600">+{stats.scoreData?.bonusPoints || 0} Bonus</span><span className="text-red-500">-{stats.scoreData?.blackmarks || 0} Marks</span></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Done (7d)</p><p className="text-3xl font-black text-emerald-500">{stats.memberCompletedLastWeek}</p></div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Pending</p><p className="text-3xl font-black text-indigo-600">{stats.pendingTasks}</p></div>
                    </div>

                    {/* PERSONAL GROWTH GRAPH */}
                    <div className="relative pt-6 border-t border-slate-100 mt-8">
                        <h3 className="text-lg font-black text-slate-800 mb-4 pl-1">My Performance</h3>
                        <div className="absolute right-0 top-6 z-10 flex gap-2">
                            <button onClick={()=>setGraphMode('week')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${graphMode==='week'?'bg-indigo-600 text-white shadow-md':'bg-white border text-slate-500 hover:bg-slate-50'}`}>Last 7 Days</button>
                            <button onClick={()=>setGraphMode('month')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${graphMode==='month'?'bg-indigo-600 text-white shadow-md':'bg-white border text-slate-500 hover:bg-slate-50'}`}>Last 6 Months</button>
                        </div>
                        <SimpleLineChart 
                            title="" // Title handled by header above
                            data={graphMode === 'week' ? stats.dailyTrend : stats.monthlyTrend} 
                        />
                    </div>
                </>
            )}
        </div>
    );
};
// --- NEW COMPONENT: SEARCHABLE DROPDOWN ---
const SearchableSelect = ({ options, value, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = React.useRef(null);

    // Close dropdown when clicking outside
    React.useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    // Get selected label
    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder;

    // Filter options based on search
    const filteredOptions = options.filter(o => 
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative space-y-1" ref={wrapperRef}>
            <label className="text-[10px] font-black uppercase text-slate-400">{placeholder}</label>
            <div 
                className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm bg-white cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className={value ? "text-slate-800" : "text-slate-400"}>
                    {selectedLabel}
                </span>
                <i className={`fas fa-chevron-down text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full bg-white border-2 border-slate-100 rounded-xl shadow-xl mt-1 max-h-60 overflow-y-auto">
                    <div className="p-2 sticky top-0 bg-white border-b border-slate-50">
                        <input 
                            type="text" 
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold outline-none focus:border-indigo-500"
                            placeholder="Type to search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map(opt => (
                            <div 
                                key={opt.value} 
                                className={`p-3 text-xs font-bold cursor-pointer hover:bg-indigo-50 hover:text-indigo-600 ${String(value) === String(opt.value) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600'}`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                            >
                                {opt.label}
                            </div>
                        ))
                    ) : (
                        <div className="p-4 text-center text-xs text-slate-400 italic">No results found</div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- REPORT GENERATOR VIEW (WITH EXPORT ADDED) ---
export const ReportGenerator = ({ store, role }) => {
    // Helper: Local Date
    const getLocalDate = (d: Date) => {
        const copy = new Date(d);
        copy.setMinutes(copy.getMinutes() - copy.getTimezoneOffset());
        return copy.toISOString().split('T')[0];
    };

    const [filter, setFilter] = useState({ 
        startDate: getLocalDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), 
        endDate: getLocalDate(new Date()), 
        teamId: '', 
        memberId: '',
        projectId: '' 
    });
    
    const [data, setData] = useState<any[]>([]);

    const generate = async () => {
        if(!filter.startDate || !filter.endDate) return alert("Select Date Range");
        try {
            // PASS 'role' PROP TO STORE
            let res = await store.generateReport(filter, role);
            res = res || [];

            // 2. FORCE FILTER (Fix: "Results not filtered")
            // Even if backend ignores projectId, we filter it here client-side
            if (filter.projectId) {
                const selectedProj = store.state.projects.find((p: any) => String(p.id) === String(filter.projectId));
                res = res.filter((r: any) => 
                    // Check by ID if available, otherwise by Name match
                    (r.projectId && String(r.projectId) === String(filter.projectId)) || 
                    (r.projectName && r.projectName === selectedProj?.name)
                );
            }
            // Force Filter for Team (Double check)
            if (filter.teamId) {
                 res = res.filter((r: any) => r.teamId && String(r.teamId) === String(filter.teamId));
            }
            // Force Filter for Member
            if (filter.memberId) {
                 res = res.filter((r: any) => r.memberId && String(r.memberId) === String(filter.memberId));
            }

            setData(res);
        } catch (e) {
            console.error(e);
            setData([]);
        }
    };

    const formatScope = (r: any) => {
        if (r.scope && Array.isArray(r.scope) && r.scope.length > 0) {
            return r.scope.map((s: any) => {
                const partNames = s.parts?.map((p: any) => p.name).join(', ') || '';
                return `${s.division} (${partNames})`; 
            }).join(', ');
        }
        if (r.divisions && r.divisions.length > 0) {
            return `${r.divisions.join(', ')} (${r.partNos?.join(', ') || ''})`;
        }
        return '-';
    };

    const getReportTitle = () => {
        // 1. MEMBER CONTEXT: Show Member Name
        if (role === 'MEMBER') {
            return `Performance Report: ${store.state.currentUser?.name || 'Member'}`;
        }

        // 2. TEAM LEAD CONTEXT: Show Team Name + Member Filter (if any)
        if (role === 'TEAM_LEAD') {
            const myTeamId = store.state.currentUser?.teamId;
            const myTeam = store.state.teams.find((t: any) => t.id === myTeamId);
            let title = `Team Report: ${myTeam?.name || 'My Team'}`;
            
            // NEW: Append Member Name if filtered
            if (filter.memberId) {
                const member = store.state.users.find((u: any) => String(u.id) === String(filter.memberId));
                title += ` | Member: ${member?.name || 'Unknown'}`;
            }
            return title;
        }

        // 3. PM / ADMIN CONTEXT: Dynamic Heading based on all Filters
        let parts: string[] = [];

        // Check Project Filter
        if (filter.projectId) {
            const proj = store.state.projects.find((p: any) => String(p.id) === String(filter.projectId));
            parts.push(`Project: ${proj?.name || 'Unknown'}`);
        } else {
            parts.push("All Projects");
        }

        // Check Team Filter
        if (filter.teamId) {
            const team = store.state.teams.find((t: any) => String(t.id) === String(filter.teamId));
            parts.push(`Team: ${team?.name || 'Unknown'}`);
        }

        // Check Member Filter
        if (filter.memberId) {
            const member = store.state.users.find((u: any) => String(u.id) === String(filter.memberId));
            parts.push(`Member: ${member?.name || 'Unknown'}`);
        }

        return parts.length > 0 ? parts.join(" | ") : "General Summary Report";
    };

    const exportData = data.map(r => ({
        ...r,
        scopeSummary: formatScope(r),
        status: r.status.replace('_', ' ')
    }));

    const exportColumns = [
        { header: 'Project', key: 'projectName' },
        { header: 'Team', key: 'teamName' },
        { header: 'Member', key: 'memberName' },
        { header: 'Work Scope', key: 'scopeSummary' },
        { header: 'Assigned', key: 'assignedTime' },
        { header: 'ETA', key: 'eta' },
        { header: 'Completed', key: 'completionTime' },
        { header: 'Status', key: 'status' },
        { header: 'Rating', key: 'rating' },
        { header: 'Bonus', key: 'bonusAwarded' },
        { header: 'Blackmarks', key: 'blackmarksAwarded' }
    ];

    // Prepare Options for Searchable Select
    const projectOptions = [
        { value: '', label: 'All Projects' },
        ...store.state.projects.map((p: any) => ({ value: p.id, label: p.name }))
    ];

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="font-black text-lg mb-6 text-slate-900">Generate Report</h3>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
                    
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">Start Date</label><input type="date" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm" value={filter.startDate} onChange={e=>setFilter({...filter, startDate:e.target.value})} /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black uppercase text-slate-400">End Date</label><input type="date" className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm" value={filter.endDate} onChange={e=>setFilter({...filter, endDate:e.target.value})} /></div>
                    
                    {/* --- USE NEW SEARCHABLE SELECT FOR PROJECT --- */}
                    <div className="col-span-2 md:col-span-1">
                        <SearchableSelect 
                            placeholder="Filter Project"
                            options={projectOptions}
                            value={filter.projectId}
                            onChange={(val: any) => setFilter({...filter, projectId: val})}
                        />
                    </div>
                    {/* ------------------------------------------- */}

                    {(role === 'PM' || role === 'ADMIN') && (
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-slate-400">Filter Team</label>
                            <select className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm bg-white" value={filter.teamId} onChange={e=>setFilter({...filter, teamId:e.target.value, memberId: ''})}>
                                <option value="">All Teams</option>
                                {store.state.teams.map((t:any)=><option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    
                    {role !== 'MEMBER' && (
                         <div className="space-y-1">
                             <label className="text-[10px] font-black uppercase text-slate-400">Filter Member</label>
                             <select className="w-full border-2 border-slate-100 p-2.5 rounded-xl font-bold text-sm bg-white" value={filter.memberId} onChange={e=>setFilter({...filter, memberId:e.target.value})}>
                                 <option value="">All Members</option>
                                 {store.state.users.filter((u:any) => {
                                    if(filter.teamId) return u.teamId === parseInt(filter.teamId);
                                    return true;
                                 }).map((u:any)=><option key={u.id} value={u.id}>{u.name}</option>)}
                             </select>
                         </div>
                    )}
                    
                    <button onClick={generate} className="bg-slate-900 text-white py-3 rounded-xl font-black uppercase text-xs shadow-lg hover:bg-slate-800 transition-transform active:scale-95">Generate</button>
                </div>
            </div>

            {/* ... Rest of the table and ExportToolbar code remains the same ... */}
            {data && data.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h4 className="font-black text-slate-600 uppercase text-xs tracking-wider">Results ({data.length})</h4>
                        <ExportToolbar 
                            data={exportData} 
                            fileName={`Report_${filter.startDate}`}
                            title={getReportTitle()}
                            columns={exportColumns}
                        />
                    </div>
                    {/* ... table code ... */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                             {/* ... existing table header and body ... */}
                             <thead className="bg-white font-black uppercase text-slate-500 tracking-wider border-b">
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
                                        <td className="p-4 text-slate-500 font-medium max-w-[200px] truncate" title={formatScope(r)}>{formatScope(r)}</td>
                                        <td className="p-4 text-slate-500">{new Date(r.assignedTime).toLocaleDateString()}</td>
                                        <td className="p-4 text-amber-600 font-bold">{new Date(r.eta).toLocaleDateString()}</td>
                                        <td className="p-4 font-bold text-emerald-600">{r.completionTime ? new Date(r.completionTime).toLocaleString() : '-'}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${r.status==='COMPLETED'?'bg-green-100 text-green-700':r.status==='REJECTED'?'bg-red-100 text-red-600':'bg-slate-100 text-slate-600'}`}>{r.status.replace('_',' ')}</span></td>
                                        <td className="p-4 text-amber-500 font-bold">{r.rating ? r.rating + ' ★' : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400"><p className="font-bold text-sm">No records found.</p></div>}
        </div>
    );
};