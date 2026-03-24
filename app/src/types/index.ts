// ============================================
// USER & AUTHENTICATION TYPES
// ============================================

export type UserRole = 'admin' | 'voter' | 'election_committee' | 'pageant_committee' | 'judge';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  photoPath?: string;
  photoUrl?: string;
  studentId?: string;
  roles: UserRole[];
  isActive: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  studentId: string;   // required — must be exactly 6 digits
  role?: UserRole;
}

// Returned by POST /api/auth/register (Step 1)
export interface RegistrationSetupData {
  message: string;
  requiresTotpSetup: true;
  challengeToken: string;
  otpauthUrl: string;
  secretKey: string;
}

// Returned by POST /api/auth/login (Step 1)
export interface LoginChallengeData {
  requires2FA: true;
  challengeToken: string;
}

// ============================================
// ROLE & PERMISSION TYPES
// ============================================

export interface Role {
  id: string;
  name: UserRole;
  description: string;
  permissions: Permission[];
}

export type Permission =
  | '*'
  | 'user:create' | 'user:manage' | 'role:assign'
  | 'election:create' | 'election:manage' | 'election:view' | 'election:vote'
  | 'candidate:manage'
  | 'results:view'
  | 'voter:verify'
  | 'pageant:create' | 'pageant:manage' | 'pageant:view'
  | 'contestant:manage'
  | 'criteria:manage'
  | 'judge:assign'
  | 'contestant:score' | 'score:submit'
  | 'audit:view'
  | 'settings:manage';

// ============================================
// ELECTION TYPES
// ============================================

export type ElectionType = 'student_government' | 'fstlp_officers' | 'class_representative' | 'club_officers' | 'other';
export type ElectionStatus = 'draft' | 'upcoming' | 'active' | 'closed' | 'archived';

export interface Election {
  id: string;
  title: string;
  description: string;
  type: ElectionType;
  status: ElectionStatus;
  startDate: string;
  endDate: string;
  createdBy: string;
  allowWriteIns: boolean;
  maxVotesPerVoter: number;
  resultsPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  electionId: string;
  userId?: string;
  positionId?: string;
  position: string;
  displayName: string;
  photoPath?: string;
  photoUrl?: string;
  bio?: string;
  platform?: string;
  isWriteIn: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Vote {
  id: string;
  electionId: string;
  voterId: string;
  candidateId: string;
  position: string;
  votedAt: string;
  ipAddress?: string;
  userAgent?: string;
  voteHash: string;
}

export interface ElectionResult {
  electionId: string;
  position: string;
  candidates: {
    candidateId: string;
    displayName: string;
    photoPath?: string;
    photoUrl?: string;
    voteCount: number;
    percentage: number;
  }[];
  totalVotes: number;
}

// ============================================
// PAGEANT TYPES
// ============================================

export type PageantStatus = 'draft' | 'upcoming' | 'active' | 'completed' | 'archived';
export type ScoringMethod = 'average' | 'weighted' | 'ranking' | 'ranking_by_gender';

export interface Pageant {
  id: string;
  name: string;
  description: string;
  eventDate: string;
  status: PageantStatus;
  createdBy: string;
  scoringMethod: ScoringMethod;
  totalWeight: number;
  resultsPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Contestant {
  id: string;
  pageantId: string;
  contestantNumber: number;
  firstName: string;
  lastName: string;
  gender?: 'Male' | 'Female' | null;
  photoPath?: string;
  photoUrl?: string;
  bio?: string;
  age?: number;
  department?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Criteria {
  id: string;
  pageantId: string;
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
}

export interface PageantJudge {
  id: string;
  pageantId: string;
  judgeId: string;
  judgeName: string;
  assignedBy: string;
  assignedAt: string;
  isActive: boolean;
}

export interface Score {
  id: string;
  pageantId: string;
  contestantId: string;
  criteriaId: string;
  judgeId: string;
  score: number;
  notes?: string;
  submittedAt: string;
  ipAddress?: string;
  scoreHash: string;
}

export interface PageantResult {
  pageantId: string;
  contestantId: string;
  contestantNumber: number;
  contestantName: string;
  gender?: 'Male' | 'Female' | null;
  photoPath?: string;
  photoUrl?: string;
  totalScore: number;
  weightedScore: number;
  rank: number;
  scoringMode?: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING';
  finalScore?: number | null;
  finalPercentage?: number | null;
  finalRating?: number | null;
  rankScore?: number | null;
  rankingTieBreaker?: 'weighted_criteria' | 'judge_priority' | 'keep_tied';
  judgeScores?: {
    judgeId: string;
    judgeLabel: string;
    percentage: number;
  }[];
  criteriaBreakdown: {
    criteriaId: string;
    criteriaName: string;
    weight: number;
    maxScore?: number;
    averageScore: number;
    weightedContribution: number;
    computed?: number;
  }[];
}

export interface RankingByGenderResults {
  scoringMode: 'RANKING_BY_GENDER';
  rankingTieBreaker?: 'weighted_criteria' | 'judge_priority' | 'keep_tied';
  maleResults: PageantResult[];
  femaleResults: PageantResult[];
  maleWinner: PageantResult | null;
  femaleWinner: PageantResult | null;
  warnings?: string[];
}

export type PageantResultsResponse = PageantResult[] | RankingByGenderResults;

// ============================================
// AUDIT LOG TYPES
// ============================================

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: 'user' | 'election' | 'vote' | 'pageant' | 'score' | 'candidate' | 'contestant' | 'criteria';
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================
// UI TYPES
// ============================================

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface NavItem {
  label: string;
  path: string;
  icon?: string;
  roles?: UserRole[];
}

export interface DashboardStats {
  totalUsers: number;
  activeElections: number;
  totalVotes: number;
  upcomingPageants: number;
}

// ============================================
// FORM TYPES
// ============================================

export interface ElectionFormData {
  title: string;
  description: string;
  type: ElectionType;
  startDate: string;
  endDate: string;
  allowWriteIns: boolean;
  maxVotesPerVoter: number;
  resultsPublic: boolean;
}

export interface CandidateFormData {
  positionId: string;
  position?: string;
  displayName: string;
  bio?: string;
  platform?: string;
  photoUrl?: string;
  photoPath?: string;
  imageFile?: File;
  isWriteIn: boolean;
}

export interface ElectionPosition {
  id: string;
  electionId: string;
  name: string;
  voteLimit: number;
  createdAt?: string;
}

export interface PageantFormData {
  name: string;
  description: string;
  eventDate: string;
  scoringMethod: ScoringMethod;
  totalWeight: number;
  resultsPublic: boolean;
}

export interface ContestantFormData {
  contestantNumber: number;
  firstName: string;
  lastName: string;
  gender?: 'Male' | 'Female';
  bio?: string;
  age?: number;
  department?: string;
  photoUrl?: string;
  photoPath?: string;
  imageFile?: File;
}

export interface CriteriaFormData {
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  displayOrder: number;
}

export interface ScoreFormData {
  contestantId: string;
  scores: {
    criteriaId: string;
    score: number;
    notes?: string;
  }[];
}
