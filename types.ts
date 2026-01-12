export enum UserRole {
  ADMIN = 'ADMIN',
  PROJECT_MANAGER = 'PROJECT_MANAGER',
  TEAM_LEAD = 'TEAM_LEAD',
  MEMBER = 'MEMBER'
}

export interface User {
  id: number;
  name: string;
  username: string;
  password?: string;
  email?: string;
  avatar?: string;
  roles: UserRole[];
  teamId?: number | null;
  isApproved: boolean;
  blackmarks: number;
  bonusPoints: number;
}

export interface Team {
  id: number;
  name: string;
  leadIds: number[];
}

// --- HYBRID STRUCTURE ---
export interface ScopePart {
  name: string;
  workTypes: string[];
}

export interface ScopeItem {
  division: string;
  parts: ScopePart[];
}

export interface Project {
  id: number;
  name: string;
  date: string;
  // Projects use Flat Lists
  divisions: string[];
  partNos: string[];
  workTypes: string[]; 
  status: 'ACTIVE' | 'ON_HOLD' | 'COMPLETED';
  remarks?: string;
  holdStartTime?: string;     
  totalHoldDuration?: number; 
}

export interface GroupAssignment {
  id: number;
  projectId: number;
  teamId: number;
  // Assignments use Hierarchy
  scope: ScopeItem[]; 
  fileSize: string;
  assignedTime: string;
  eta: string;
  rating?: number;            
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'REJECTION_REQ' | 'PENDING_ACK';
  remarks?: string;
  completionTime?: string;
  rejectionReason?: string;   
}

export interface MemberAssignment {
  id: number;
  groupAssignmentId: number;
  memberId: number;
  scope: ScopeItem[];
  assignedTime: string;
  eta: string;
  completionTime?: string | null;
  rating?: number;
  status: 'IN_PROGRESS' | 'PENDING_ACK' | 'COMPLETED' | 'REJECTED' | 'REJECTION_REQ';
  remarks?: string;
  reworkFromId?: number;
  bonusAwarded?: number;
  blackmarksAwarded?: number;
  rejectionReason?: string;
  screenshot?: string; 
}

export interface DashboardStats {
  activeProjects: number;
  completedLastWeek: number;
  avgCompletionTimeHrs: number;
  topTeams?: { name: string; score: number }[];
  teamProductivity?: { name: string; value: number }[];
  personalPending?: number;
  personalCompleted?: number;
  activeProjectsCount?: number; 
  scoreData?: { bonusPoints: number; blackmarks: number };
  pendingTasks?: number;
  teamAvgTime?: { name: string; value: number }[];
  topMembers?: { name: string; netScore: number }[];
  memberProductivity?: { name: string; completed: number }[];
  memberAvgTime?: { name: string; value: number }[];
}

export interface AppState {
  users: User[];
  teams: Team[];
  projects: Project[];
  groupAssignments: GroupAssignment[];
  memberAssignments: MemberAssignment[];
  currentUser: User | null;
  workTypes: string[];
  stats: DashboardStats | null;
  config: any;
  chatMessages: any[]; 
  forumThreads: any[]; 
  notifications: any[];
}