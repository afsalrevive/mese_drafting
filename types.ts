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
  email?: string;       // New field
  avatar?: string;      // New field (Base64)
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

export interface Project {
  id: number;
  name: string;
  date: string;
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
  workTypes: string[]; 
  divisions: string[];
  partNos: string[];
  fileSize: string;
  assignedTime: string;
  eta: string;
  rating?: number;            
  // FIX: Added 'PENDING_ACK' to the allowed statuses below
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'REJECTION_REQ' | 'PENDING_ACK';
  remarks?: string;
  completionTime?: string;
  rejectionReason?: string;   
}

export interface MemberAssignment {
  id: number;
  groupAssignmentId: number;
  memberId: number;
  workTypes: string[]; 
  divisions: string[]; 
  partNos: string[];   
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
}

export interface DashboardStats {
  activeProjects: number;
  completedLastWeek: number;
  avgCompletionTimeHrs: number;
  topTeams?: { name: string; score: number }[];
  teamProductivity?: { name: string; value: number }[];
  personalPending?: number;
  personalCompleted?: number;
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
}