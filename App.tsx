import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserRole } from './types';
import { useStore } from './store';
import Auth from './components/Auth'; 
import AdminDashboard from './components/AdminDashboard';
import PMDashboard from './components/PMDashboard';
import TLDashboard from './components/TLDashboard';
import MemberDashboard from './components/MemberDashboard';
import UserProfile from './components/UserProfile'; 
import NotificationPanel from './components/NotificationPanel';
import CommunicationHub from './components/CommunicationHub';

// --- HELPER: CHECK FOR UNREAD MESSAGES ---
const hasUnreadCommunication = (storeState: any, currentUser: any) => {
    if (!currentUser || !storeState.chatMessages) return false;
    
    const lastRead = parseInt(localStorage.getItem(`lastRead_${currentUser.id}`) || '0');
    
    // 1. Check Chat
    const hasUnreadChat = storeState.chatMessages.some((msg: any) => {
        const isNew = new Date(msg.createdAt).getTime() > lastRead;
        if (!isNew) return false;
        if (msg.channel === 'General' || msg.channel === 'Announcements') return true;
        if (msg.channel.startsWith('Team') && msg.channel === `Team-${currentUser.teamId}`) return true;
        return false;
    });

    // 2. Check Forum
    const hasUnreadForum = (storeState.forumThreads || []).some((thread: any) => {
        if (new Date(thread.createdAt).getTime() > lastRead) return true;
        return thread.comments.some((c: any) => new Date(c.createdAt).getTime() > lastRead);
    });

    return hasUnreadChat || hasUnreadForum;
};

const App: React.FC = () => {
  const store = useStore();
  const { state, logout } = store;
  const { currentUser } = state;
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const unreadCount = state.notifications.filter(n => !n.isRead).length;

  const [currentView, setCurrentView] = useState<'home' | 'projects' | 'reports' | 'connect'>('projects');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [, setTick] = useState(0);

  // 🟢 STATE: Visual Spinner for Manual Button
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 🟢 REF: The Lock to prevent stacking requests
  const isFetchingRef = useRef(false);

  useEffect(() => {
      const handleRead = () => setTick(t => t + 1);
      window.addEventListener('communicationRead', handleRead);
      return () => window.removeEventListener('communicationRead', handleRead);
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.roles.length > 0) {
      if (!activeRole || !currentUser.roles.includes(activeRole)) {
        setActiveRole(currentUser.roles[0]);
      }
    } else {
      setActiveRole(null);
    }
  }, [currentUser]);

  // ---------------------------------------------------------
  // 🟢 1. SAFE REFRESH LOGIC (With Locking)
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // 🟢 1. SAFE REFRESH LOGIC (With Timeout Protection)
  // ---------------------------------------------------------
  // Inside App.tsx

  const refreshData = useCallback(async (isManual = false) => {
      // 🔒 LOCK: If data is already loading (Auto or Manual), stop here.
      if (isFetchingRef.current) {
          // OPTIONAL: If user clicks while Auto-Refresh is running, 
          // we can just ignore it since data is coming anyway.
          return;
      }
      
      // 🔒 Set Lock
      isFetchingRef.current = true;
      
      // 🟢 VISUALS: Only show spinner if YOU clicked the button
      if (isManual) {
          setIsRefreshing(true);
      }

      // 🕒 SAFETY TIMEOUT: 5 seconds max
      const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
      );

      try {
          const promises = [];
          
          // 1. Always fetch essentials
          promises.push(store.fetchNotifications());
          promises.push(store.fetchStats());

          // 2. Context-aware fetching
          if (currentView === 'projects') {
              promises.push(store.fetchProjects());
              promises.push(store.fetchTeams());
              promises.push(store.fetchGroupAssignments());
              promises.push(store.fetchMemberAssignments());
          } 
          else if (currentView === 'reports') {
              promises.push(store.fetchUsers());
              promises.push(store.fetchTeams());
              promises.push(store.fetchProjects());
          } 
          else if (currentView === 'connect') {
              promises.push(store.fetchChat());
              promises.push(store.fetchForum());
          }
          
          // Wait for data OR timeout
          await Promise.race([Promise.all(promises), timeoutPromise]);

      } catch (err) {
          console.warn("Background refresh skipped/timed out");
      } finally {
          // 🔓 UNLOCK
          isFetchingRef.current = false;
          
          // 🟢 STOP SPINNER: Only stops if it was started manually
          if (isManual) {
              setTimeout(() => setIsRefreshing(false), 500);
          }
      }
  }, [currentView, store]);
  // ---------------------------------------------------------
  // 🟢 2. AUTO-REFRESH TIMER (With Visibility Check)
  // ---------------------------------------------------------
  useEffect(() => {
      // 1. Initial Load (Safe)
      refreshData();

      // 2. Timer
      const intervalId = setInterval(() => {
          // ⚡ OPTIMIZATION: Only refresh if user is looking at the tab
          if (!document.hidden && currentUser) {
              refreshData(false); 
          }
      }, 30000);

      return () => clearInterval(intervalId);
  }, [refreshData, currentUser]);

  if (!currentUser) {
    return <Auth store={store} />;
  }

  const renderDashboard = () => {
    if (!activeRole) return <div>No role active</div>;
    
    if (currentView === 'connect') {
        return <CommunicationHub store={store} />;
    }
    
    const props = { store, currentView };
    
    switch (activeRole) {
      case UserRole.ADMIN:
        return <AdminDashboard {...props} />;
      case UserRole.PROJECT_MANAGER:
        return <PMDashboard {...props} />;
      case UserRole.TEAM_LEAD:
        return <TLDashboard {...props} />;
      case UserRole.MEMBER:
        return <MemberDashboard {...props} />;
      default:
        return <div>Role not recognized</div>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 pb-20 relative">
      {/* GLOBAL NAVIGATION HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-3 md:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo & Main Nav */}
            <div className="flex items-center gap-2 md:gap-8">
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-all active:scale-95"
              >
                <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'} text-lg`}></i>
              </button>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all overflow-hidden">
                    <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
                  </div>
                <span className="text-lg md:text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight">
                  Drafting WorkFlow
                </span>
              </div>

              <nav className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                {['home', 'projects', 'reports', 'connect'].map((view) => (
                   <button
                     key={view}
                     onClick={() => setCurrentView(view as any)}
                     className={`relative px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${currentView === view ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {view}
                     {view === 'connect' && currentView !== 'connect' && hasUnreadCommunication(state, currentUser) && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                     )}
                   </button>
                ))}
              </nav>
            </div>
            
            {/* User Controls */}
            <div className="flex items-center gap-2 md:gap-4">
              {currentUser.roles.length > 1 && (
                <>
                  <div className="hidden sm:flex items-center bg-slate-50 p-1 rounded-lg border border-slate-100">
                    {currentUser.roles.map(role => (
                      <button key={role} onClick={() => setActiveRole(role)} className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${activeRole === role ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                        {role === 'PROJECT_MANAGER' ? 'PM' : role === 'TEAM_LEAD' ? 'TL' : role}
                      </button>
                    ))}
                  </div>
                  <div className="sm:hidden relative">
                    <select value={activeRole || ''} onChange={(e) => setActiveRole(e.target.value as any)} className="appearance-none bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold py-1.5 pl-2 pr-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[80px]">
                      {currentUser.roles.map(role => <option key={role} value={role}>{role.replace('_', ' ')}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-1 pointer-events-none text-indigo-500"><i className="fas fa-chevron-down text-[8px]"></i></div>
                  </div>
                </>
              )}

              <div className="relative">
                  <button onClick={() => { setShowNotifs(!showNotifs); if(!showNotifs) store.fetchNotifications(); }} className="relative w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all">
                      <i className="fas fa-bell text-xs md:text-sm"></i>
                      {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>}
                  </button>
                  {showNotifs && <NotificationPanel notifications={state.notifications} onClose={() => setShowNotifs(false)} onClear={store.clearNotifications} onMarkRead={store.markRead} />}
              </div>

              <div className="flex items-center gap-2 pl-2 md:gap-3 md:pl-4 md:border-l md:border-slate-200 border-l border-slate-100">
                 <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{activeRole?.replace('_', ' ')}</p>
                 </div>
                 <button onClick={() => setShowProfile(true)} className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all">
                   {currentUser.avatar ? <img src={currentUser.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" /> : <i className="fas fa-user text-xs md:text-sm"></i>}
                 </button>
                 <button onClick={logout} className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all"><i className="fas fa-sign-out-alt text-xs md:text-sm"></i></button>
              </div>
            </div>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white shadow-xl animate-fadeIn absolute w-full left-0 top-16 z-40">
            <div className="p-4 grid grid-cols-2 gap-3">
               {['home', 'projects', 'reports', 'connect'].map((view) => (
                   <button key={view} onClick={() => { setCurrentView(view as any); setIsMobileMenuOpen(false); }} className={`relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all ${currentView === view ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' : 'bg-white border-slate-100 text-slate-500 hover:bg-slate-50'}`}>
                     <i className={`fas fa-${view === 'home' ? 'home' : view === 'projects' ? 'briefcase' : view === 'reports' ? 'chart-pie' : 'comments'} text-xl`}></i>
                     <span className="text-xs font-black uppercase tracking-wider">{view}</span>
                     {view === 'connect' && currentView !== 'connect' && hasUnreadCommunication(state, currentUser) && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse absolute top-3 right-3"></span>}
                   </button>
               ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow p-3 md:p-8 max-w-7xl mx-auto w-full animate-fadeIn">
        {renderDashboard()}
      </main>

      {showProfile && <UserProfile store={store} onClose={() => setShowProfile(false)} />}

      {/* FLOATING REFRESH BUTTON */}
      <button 
          onClick={() => refreshData(true)} // Pass 'true' for manual
          className={`fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 bg-slate-900 text-white w-12 h-12 md:w-14 md:h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 hover:bg-indigo-600 focus:outline-none focus:ring-4 focus:ring-indigo-300 ${isRefreshing ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
          title="Refresh Data"
          disabled={isRefreshing} // Disable click only if manually refreshing
      >
          {/* Only spin if isRefreshing is true */}
          <i className={`fas fa-sync-alt text-lg md:text-xl ${isRefreshing ? 'animate-spin' : ''}`}></i>
      </button>

    </div>
  );
};

export default App;