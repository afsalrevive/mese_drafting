import React, { useState, useEffect } from 'react';
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
        
        // Logic: General/Announcements = Everyone. Team = My Team Only.
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
  const [showProfile, setShowProfile] = useState(false);
  const [, setTick] = useState(0);

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

  // --- NEW: REFRESH DATA ON TAB SWITCH ---
  useEffect(() => {
      const refreshData = async () => {
          if (currentView === 'home') {
             // Home usually needs stats and notifications
             await Promise.all([store.fetchStats(), store.fetchNotifications()]);
          } 
          else if (currentView === 'projects') {
             // Projects needs project list, teams, and assignments
             await Promise.all([
                 store.fetchProjects(), 
                 store.fetchTeams(), 
                 store.fetchGroupAssignments(),
                 store.fetchMemberAssignments() // If needed for status
             ]);
          } 
          else if (currentView === 'reports') {
             // Reports usually fetches its own data on generate, but we can refresh master data
             await Promise.all([store.fetchUsers(), store.fetchTeams(), store.fetchProjects()]);
          } 
          else if (currentView === 'connect') {
             // Connect View handles its own polling, but a meaningful initial fetch helps
             await Promise.all([store.fetchChat(), store.fetchForum()]);
          }
      };
      
      refreshData();
  }, [currentView, activeRole]); // Run whenever view or role changes

  if (!currentUser) {
    return <Auth store={store} />;
  }

  const renderDashboard = () => {
    if (!activeRole) return <div>No role active</div>;
    
    if (currentView === 'connect') {
        return <CommunicationHub store={store} />;
    }
    
    // Pass currentView to dashboards
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* GLOBAL NAVIGATION HEADER */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Logo & Main Nav */}
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                  <i className="fas fa-layer-group"></i>
                </div>
                <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 tracking-tight">
                  WorkFlow
                </span>
              </div>

              {/* Main Tabs */}
              {/* Main Tabs */}
              <nav className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                {['home', 'projects', 'reports', 'connect'].map((view) => (
                   <button
                     key={view}
                     onClick={() => setCurrentView(view as any)}
                     // Added 'relative' class for positioning the dot
                     className={`relative px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${currentView === view ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {view}
                     
                     {/* --- NEW: NOTIFICATION DOT FOR CONNECT --- */}
                     {view === 'connect' && currentView !== 'connect' && hasUnreadCommunication(state, currentUser) && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white animate-pulse"></span>
                     )}
                   </button>
                ))}
              </nav>
            </div>
            
            {/* User Controls */}
            <div className="flex items-center gap-4">
              {/* Role Switcher */}
              {currentUser.roles.length > 1 && (
                <div className="hidden sm:flex items-center bg-slate-50 p-1 rounded-lg border border-slate-100">
                  {currentUser.roles.map(role => (
                    <button
                      key={role}
                      onClick={() => setActiveRole(role)}
                      className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-all ${activeRole === role ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {role === 'PROJECT_MANAGER' ? 'PM' : role === 'TEAM_LEAD' ? 'TL' : role}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative">
                  <button onClick={() => { setShowNotifs(!showNotifs); if(!showNotifs) store.fetchNotifications(); }} className="relative w-9 h-9 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all">
                      <i className="fas fa-bell"></i>
                      {unreadCount > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unreadCount}</span>}
                  </button>
                  {showNotifs && (
                      <NotificationPanel 
                          notifications={state.notifications} 
                          onClose={() => setShowNotifs(false)} 
                          onClear={store.clearNotifications}
                          onMarkRead={store.markRead}
                      />
                  )}
              </div>
              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                 <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{activeRole?.replace('_', ' ')}</p>
                 </div>
                 
                 <button 
                   onClick={() => setShowProfile(true)}
                   className="w-9 h-9 rounded-full bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all"
                   title="Profile"
                 >
                   {currentUser.avatar ? 
                     <img src={currentUser.avatar} alt="avatar" className="w-full h-full rounded-full object-cover" /> :
                     <i className="fas fa-user"></i>
                   }
                 </button>

                 <button 
                   onClick={logout}
                   className="w-9 h-9 rounded-full bg-red-50 hover:bg-red-100 text-red-400 hover:text-red-600 flex items-center justify-center transition-all"
                   title="Logout"
                 >
                   <i className="fas fa-sign-out-alt"></i>
                 </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 max-w-7xl mx-auto w-full animate-fadeIn">
        {renderDashboard()}
      </main>

      {/* Global Profile Modal */}
      {showProfile && <UserProfile store={store} onClose={() => setShowProfile(false)} />}
    </div>
  );
};

export default App;