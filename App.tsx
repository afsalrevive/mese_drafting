import React, { useState, useEffect } from 'react';
import { UserRole } from './types';
import { useStore } from './store';
import Auth from './components/Auth'; 
import AdminDashboard from './components/AdminDashboard';
import PMDashboard from './components/PMDashboard';
import TLDashboard from './components/TLDashboard';
import MemberDashboard from './components/MemberDashboard';
import UserProfile from './components/UserProfile'; 

const App: React.FC = () => {
  const store = useStore();
  const { state, logout } = store;
  const { currentUser } = state;
  const [activeRole, setActiveRole] = useState<UserRole | null>(null);
  
  // New Global View State
  const [currentView, setCurrentView] = useState<'home' | 'projects' | 'reports'>('projects');
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.roles.length > 0) {
      if (!activeRole || !currentUser.roles.includes(activeRole)) {
        setActiveRole(currentUser.roles[0]);
      }
    } else {
      setActiveRole(null);
    }
  }, [currentUser]);

  if (!currentUser) {
    return <Auth store={store} />;
  }

  const renderDashboard = () => {
    if (!activeRole) return <div>No role active</div>;
    
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
              <nav className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                {['home', 'projects', 'reports'].map((view) => (
                   <button
                     key={view}
                     onClick={() => setCurrentView(view as any)}
                     className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${currentView === view ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                   >
                     {view}
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