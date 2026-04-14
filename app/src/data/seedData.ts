import type {
  User,
  Election,
  Candidate,
  Pageant,
  Contestant,
  Criteria,
  PageantJudge,
  Score,
  Vote,
  AuditLog,
  ElectionResult,
  PageantResult,
} from '@/types';

// ============================================
// USERS
// ============================================

export const seedUsers: User[] = [
  // Admin
  {
    id: 'user-001',
    email: 'admin@school.edu',
    firstName: 'System',
    lastName: 'Administrator',
    roles: ['admin'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-12-15T08:30:00Z',
    twoFactorEnabled: false,
  },
  // Election Committee
  {
    id: 'user-002',
    email: 'election.committee@school.edu',
    firstName: 'Election',
    lastName: 'Committee',
    roles: ['election_committee'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-12-14T09:15:00Z',
    twoFactorEnabled: false,
  },
  // Pageant Committee
  {
    id: 'user-003',
    email: 'pageant.committee@school.edu',
    firstName: 'Pageant',
    lastName: 'Committee',
    roles: ['pageant_committee'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-12-13T10:00:00Z',
    twoFactorEnabled: false,
  },
  // Judges
  {
    id: 'user-004',
    email: 'judge1@school.edu',
    firstName: 'Maria',
    lastName: 'Santos',
    roles: ['judge'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    lastLogin: '2024-12-10T14:20:00Z',
    twoFactorEnabled: false,
  },
  {
    id: 'user-005',
    email: 'judge2@school.edu',
    firstName: 'John',
    lastName: 'Doe',
    roles: ['judge'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    lastLogin: '2024-12-11T11:30:00Z',
    twoFactorEnabled: false,
  },
  {
    id: 'user-006',
    email: 'judge3@school.edu',
    firstName: 'Sarah',
    lastName: 'Lee',
    roles: ['judge'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
    lastLogin: '2024-12-12T16:45:00Z',
    twoFactorEnabled: false,
  },
  // Students/Voters
  {
    id: 'user-007',
    email: 'student1@school.edu',
    firstName: 'Juan',
    lastName: 'Dela Cruz',
    studentId: '2021-00001',
    roles: ['voter'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    lastLogin: '2024-12-15T07:00:00Z',
    twoFactorEnabled: false,
  },
  {
    id: 'user-008',
    email: 'student2@school.edu',
    firstName: 'Maria',
    lastName: 'Garcia',
    studentId: '2021-00002',
    roles: ['voter'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    lastLogin: '2024-12-14T13:30:00Z',
    twoFactorEnabled: false,
  },
  {
    id: 'user-009',
    email: 'student3@school.edu',
    firstName: 'Pedro',
    lastName: 'Reyes',
    studentId: '2021-00003',
    roles: ['voter'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    lastLogin: '2024-12-13T09:45:00Z',
    twoFactorEnabled: false,
  },
  {
    id: 'user-010',
    email: 'student4@school.edu',
    firstName: 'Ana',
    lastName: 'Lim',
    studentId: '2021-00004',
    roles: ['voter'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    lastLogin: '2024-12-12T15:20:00Z',
    twoFactorEnabled: false,
  },
  {
    id: 'user-011',
    email: 'student5@school.edu',
    firstName: 'Carlos',
    lastName: 'Tan',
    studentId: '2021-00005',
    roles: ['voter'],
    isActive: true,
    emailVerified: true,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z',
    lastLogin: '2024-12-11T10:15:00Z',
    twoFactorEnabled: false,
  },
];

// ============================================
// ELECTIONS
// ============================================

export const seedElections: Election[] = [
  {
    id: 'election-001',
    title: 'SSG & FSTLP Officers Election 2025',
    description: 'Annual election for SSG and FSTLP officer positions.',
    type: 'ssg_fstlp_officers',
    status: 'active',
    startDate: '2024-12-01T00:00:00Z',
    endDate: '2024-12-31T23:59:59Z',
    createdBy: 'user-002',
    allowWriteIns: false,
    maxVotesPerVoter: 1,
    resultsPublic: false,
    createdAt: '2024-11-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'election-002',
    title: 'Class Representative Election - Batch 2025',
    description: 'Election for class representatives for the graduating batch of 2025.',
    type: 'class_representative',
    status: 'upcoming',
    startDate: '2025-01-15T00:00:00Z',
    endDate: '2025-01-20T23:59:59Z',
    createdBy: 'user-002',
    allowWriteIns: true,
    maxVotesPerVoter: 2,
    resultsPublic: true,
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'election-003',
    title: 'Computer Science Club Officers',
    description: 'Election for Computer Science Club officer positions.',
    type: 'club_officers',
    status: 'closed',
    startDate: '2024-10-01T00:00:00Z',
    endDate: '2024-10-07T23:59:59Z',
    createdBy: 'user-002',
    allowWriteIns: false,
    maxVotesPerVoter: 1,
    resultsPublic: true,
    createdAt: '2024-09-01T00:00:00Z',
    updatedAt: '2024-09-01T00:00:00Z',
  },
];

// ============================================
// CANDIDATES
// ============================================

export const seedCandidates: Candidate[] = [
  // Election 001 - President
  {
    id: 'candidate-001',
    electionId: 'election-001',
    userId: 'user-007',
    position: 'President',
    displayName: 'Juan Dela Cruz',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    bio: 'Third-year Computer Science student passionate about student welfare and campus improvements.',
    platform: '1. Better campus Wi-Fi\n2. Extended library hours\n3. More scholarship opportunities',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'candidate-002',
    electionId: 'election-001',
    userId: 'user-008',
    position: 'President',
    displayName: 'Maria Garcia',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    bio: 'Business Administration major with experience in student leadership.',
    platform: '1. Student entrepreneurship programs\n2. Career fair improvements\n3. Mental health initiatives',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  // Election 001 - Vice President
  {
    id: 'candidate-003',
    electionId: 'election-001',
    userId: 'user-009',
    position: 'Vice President',
    displayName: 'Pedro Reyes',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    bio: 'Engineering student focused on infrastructure and facilities.',
    platform: '1. Better cafeteria food\n2. More parking spaces\n3. Classroom renovations',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'candidate-004',
    electionId: 'election-001',
    userId: 'user-010',
    position: 'Vice President',
    displayName: 'Ana Lim',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    bio: 'Education major dedicated to student advocacy.',
    platform: '1. Student rights protection\n2. Transparent governance\n3. Student feedback system',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  // Election 001 - Secretary
  {
    id: 'candidate-005',
    electionId: 'election-001',
    userId: 'user-011',
    position: 'Secretary',
    displayName: 'Carlos Tan',
    photoUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop',
    bio: 'Communications major with excellent organizational skills.',
    platform: '1. Better communication channels\n2. Digital documentation\n3. Meeting transparency',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  // Election 002 - Class Representative
  {
    id: 'candidate-006',
    electionId: 'election-002',
    userId: 'user-007',
    position: 'Class Representative',
    displayName: 'Juan Dela Cruz',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    bio: 'Dedicated to representing batch 2025.',
    platform: '1. Batch unity activities\n2. Career preparation seminars\n3. Alumni networking',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-12-10T00:00:00Z',
  },
  {
    id: 'candidate-007',
    electionId: 'election-002',
    userId: 'user-008',
    position: 'Class Representative',
    displayName: 'Maria Garcia',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    bio: 'Committed to serving the batch with integrity.',
    platform: '1. Batch fundraising\n2. Graduation preparation\n3. Batch merchandise',
    isWriteIn: false,
    isActive: true,
    createdAt: '2024-12-10T00:00:00Z',
  },
];

// ============================================
// VOTES
// ============================================

export const seedVotes: Vote[] = [
  {
    id: 'vote-001',
    electionId: 'election-003',
    voterId: 'user-007',
    candidateId: 'candidate-001',
    position: 'President',
    votedAt: '2024-10-02T10:30:00Z',
    voteHash: 'a1b2c3d4e5f6789012345678901234567890abcdef',
  },
  {
    id: 'vote-002',
    electionId: 'election-003',
    voterId: 'user-008',
    candidateId: 'candidate-002',
    position: 'President',
    votedAt: '2024-10-03T14:15:00Z',
    voteHash: 'b2c3d4e5f6789012345678901234567890abcdef12',
  },
  {
    id: 'vote-003',
    electionId: 'election-003',
    voterId: 'user-009',
    candidateId: 'candidate-001',
    position: 'President',
    votedAt: '2024-10-04T09:45:00Z',
    voteHash: 'c3d4e5f6789012345678901234567890abcdef1234',
  },
];

// ============================================
// PAGEANTS
// ============================================

export const seedPageants: Pageant[] = [
  {
    id: 'pageant-001',
    name: 'Mr. & Ms. University 2025',
    description: 'The most prestigious pageant competition in the university, celebrating beauty, talent, and intelligence.',
    eventDate: '2025-02-14',
    status: 'active',
    createdBy: 'user-003',
    scoringMethod: 'weighted',
    totalWeight: 100,
    resultsPublic: false,
    createdAt: '2024-11-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'pageant-002',
    name: 'College of Engineering Pageant',
    description: 'Annual pageant for Engineering students showcasing their talents and achievements.',
    eventDate: '2025-01-25',
    status: 'upcoming',
    createdBy: 'user-003',
    scoringMethod: 'weighted',
    totalWeight: 100,
    resultsPublic: false,
    createdAt: '2024-12-01T00:00:00Z',
    updatedAt: '2024-12-01T00:00:00Z',
  },
  {
    id: 'pageant-003',
    name: 'College of Business Pageant 2024',
    description: 'Business College annual pageant competition.',
    eventDate: '2024-09-20',
    status: 'completed',
    createdBy: 'user-003',
    scoringMethod: 'weighted',
    totalWeight: 100,
    resultsPublic: true,
    createdAt: '2024-08-01T00:00:00Z',
    updatedAt: '2024-08-01T00:00:00Z',
  },
];

// ============================================
// CONTESTANTS
// ============================================

export const seedContestants: Contestant[] = [
  // Pageant 001 - Male
  {
    id: 'contestant-001',
    pageantId: 'pageant-001',
    contestantNumber: 1,
    firstName: 'Michael',
    lastName: 'Johnson',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop',
    bio: 'Fourth-year Engineering student, athlete, and advocate for environmental sustainability.',
    age: 21,
    department: 'College of Engineering',
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'contestant-002',
    pageantId: 'pageant-001',
    contestantNumber: 2,
    firstName: 'David',
    lastName: 'Chen',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    bio: 'Business Administration major with a passion for entrepreneurship and community service.',
    age: 22,
    department: 'College of Business',
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'contestant-003',
    pageantId: 'pageant-001',
    contestantNumber: 3,
    firstName: 'James',
    lastName: 'Rodriguez',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop',
    bio: 'Computer Science student and tech innovator, passionate about using technology for social good.',
    age: 20,
    department: 'College of Computer Science',
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  // Pageant 001 - Female
  {
    id: 'contestant-004',
    pageantId: 'pageant-001',
    contestantNumber: 4,
    firstName: 'Sophia',
    lastName: 'Anderson',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    bio: 'Education major dedicated to teaching and youth empowerment.',
    age: 21,
    department: 'College of Education',
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'contestant-005',
    pageantId: 'pageant-001',
    contestantNumber: 5,
    firstName: 'Emma',
    lastName: 'Wilson',
    photoUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop',
    bio: 'Nursing student with a heart for community health and wellness programs.',
    age: 22,
    department: 'College of Nursing',
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'contestant-006',
    pageantId: 'pageant-001',
    contestantNumber: 6,
    firstName: 'Isabella',
    lastName: 'Garcia',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
    bio: 'Architecture student with a creative vision for sustainable design.',
    age: 21,
    department: 'College of Architecture',
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
];

// ============================================
// CRITERIA
// ============================================

export const seedCriteria: Criteria[] = [
  // Pageant 001
  {
    id: 'criteria-001',
    pageantId: 'pageant-001',
    name: 'Beauty & Poise',
    description: 'Overall physical beauty, grace, and stage presence.',
    weight: 30,
    maxScore: 10,
    displayOrder: 1,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'criteria-002',
    pageantId: 'pageant-001',
    name: 'Intelligence & Wit',
    description: 'Ability to answer questions thoughtfully and demonstrate knowledge.',
    weight: 25,
    maxScore: 10,
    displayOrder: 2,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'criteria-003',
    pageantId: 'pageant-001',
    name: 'Talent',
    description: 'Performance in talent portion showcasing unique skills.',
    weight: 25,
    maxScore: 10,
    displayOrder: 3,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
  {
    id: 'criteria-004',
    pageantId: 'pageant-001',
    name: 'Advocacy',
    description: 'Presentation and commitment to personal advocacy/social cause.',
    weight: 20,
    maxScore: 10,
    displayOrder: 4,
    isActive: true,
    createdAt: '2024-11-15T00:00:00Z',
  },
];

// ============================================
// PAGEANT JUDGES
// ============================================

export const seedPageantJudges: PageantJudge[] = [
  {
    id: 'pj-001',
    pageantId: 'pageant-001',
    judgeId: 'user-004',
    judgeName: 'Maria Santos',
    assignedBy: 'user-003',
    assignedAt: '2024-11-20T00:00:00Z',
    isActive: true,
  },
  {
    id: 'pj-002',
    pageantId: 'pageant-001',
    judgeId: 'user-005',
    judgeName: 'John Doe',
    assignedBy: 'user-003',
    assignedAt: '2024-11-20T00:00:00Z',
    isActive: true,
  },
  {
    id: 'pj-003',
    pageantId: 'pageant-001',
    judgeId: 'user-006',
    judgeName: 'Sarah Lee',
    assignedBy: 'user-003',
    assignedAt: '2024-11-20T00:00:00Z',
    isActive: true,
  },
];

// ============================================
// SCORES
// ============================================

export const seedScores: Score[] = [
  // Pageant 003 (Completed) - Judge 1 scores
  {
    id: 'score-001',
    pageantId: 'pageant-003',
    contestantId: 'contestant-001',
    criteriaId: 'criteria-001',
    judgeId: 'user-004',
    score: 9.5,
    notes: 'Excellent stage presence',
    submittedAt: '2024-09-20T18:30:00Z',
    scoreHash: 'd4e5f6789012345678901234567890abcdef123456',
  },
  {
    id: 'score-002',
    pageantId: 'pageant-003',
    contestantId: 'contestant-001',
    criteriaId: 'criteria-002',
    judgeId: 'user-004',
    score: 9.0,
    notes: 'Very articulate answers',
    submittedAt: '2024-09-20T18:32:00Z',
    scoreHash: 'e5f6789012345678901234567890abcdef12345678',
  },
  // Pageant 003 - Judge 2 scores
  {
    id: 'score-003',
    pageantId: 'pageant-003',
    contestantId: 'contestant-001',
    criteriaId: 'criteria-001',
    judgeId: 'user-005',
    score: 9.2,
    notes: 'Great confidence',
    submittedAt: '2024-09-20T18:35:00Z',
    scoreHash: 'f6789012345678901234567890abcdef1234567890',
  },
  {
    id: 'score-004',
    pageantId: 'pageant-003',
    contestantId: 'contestant-001',
    criteriaId: 'criteria-002',
    judgeId: 'user-005',
    score: 8.8,
    notes: 'Good responses',
    submittedAt: '2024-09-20T18:37:00Z',
    scoreHash: '789012345678901234567890abcdef123456789012',
  },
];

// ============================================
// AUDIT LOGS
// ============================================

export const seedAuditLogs: AuditLog[] = [
  {
    id: 'audit-001',
    userId: 'user-001',
    userName: 'System Administrator',
    action: 'user_created',
    entityType: 'user',
    entityId: 'user-007',
    newValues: { email: 'student1@school.edu', roles: ['voter'] },
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'audit-002',
    userId: 'user-002',
    userName: 'Election Committee',
    action: 'election_created',
    entityType: 'election',
    entityId: 'election-001',
    newValues: { title: 'Student Government Election 2025', status: 'draft' },
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'audit-003',
    userId: 'user-007',
    userName: 'Juan Dela Cruz',
    action: 'vote_cast',
    entityType: 'vote',
    entityId: 'vote-001',
    newValues: { electionId: 'election-003', candidateId: 'candidate-001' },
    createdAt: '2024-10-02T10:30:00Z',
  },
  {
    id: 'audit-004',
    userId: 'user-003',
    userName: 'Pageant Committee',
    action: 'pageant_created',
    entityType: 'pageant',
    entityId: 'pageant-001',
    newValues: { name: 'Mr. & Ms. University 2025', status: 'draft' },
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'audit-005',
    userId: 'user-004',
    userName: 'Maria Santos',
    action: 'score_submitted',
    entityType: 'score',
    entityId: 'score-001',
    newValues: { pageantId: 'pageant-003', contestantId: 'contestant-001', score: 9.5 },
    createdAt: '2024-09-20T18:30:00Z',
  },
];

// ============================================
// ELECTION RESULTS
// ============================================

export const seedElectionResults: ElectionResult[] = [
  {
    electionId: 'election-003',
    position: 'President',
    candidates: [
      {
        candidateId: 'candidate-001',
        displayName: 'Juan Dela Cruz',
        photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
        voteCount: 2,
        percentage: 66.67,
      },
      {
        candidateId: 'candidate-002',
        displayName: 'Maria Garcia',
        photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
        voteCount: 1,
        percentage: 33.33,
      },
    ],
    totalVotes: 3,
  },
];

// ============================================
// PAGEANT RESULTS
// ============================================

export const seedPageantResults: PageantResult[] = [
  {
    pageantId: 'pageant-003',
    contestantId: 'contestant-001',
    contestantNumber: 1,
    contestantName: 'Michael Johnson',
    photoUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop',
    totalScore: 18.5,
    weightedScore: 92.5,
    rank: 1,
    criteriaBreakdown: [
      {
        criteriaId: 'criteria-001',
        criteriaName: 'Beauty & Poise',
        weight: 30,
        averageScore: 9.35,
        weightedContribution: 28.05,
      },
      {
        criteriaId: 'criteria-002',
        criteriaName: 'Intelligence & Wit',
        weight: 25,
        averageScore: 8.9,
        weightedContribution: 22.25,
      },
    ],
  },
];

// ============================================
// INITIALIZATION FUNCTION
// ============================================

export function initializeLocalStorage(): void {
  if (typeof window === 'undefined') return;

  const data = {
    users: seedUsers,
    elections: seedElections,
    candidates: seedCandidates,
    votes: seedVotes,
    pageants: seedPageants,
    contestants: seedContestants,
    criteria: seedCriteria,
    pageantJudges: seedPageantJudges,
    scores: seedScores,
    auditLogs: seedAuditLogs,
    electionResults: seedElectionResults,
    pageantResults: seedPageantResults,
  };

  // Only initialize if not already set
  if (!localStorage.getItem('voting_system_data')) {
    localStorage.setItem('voting_system_data', JSON.stringify(data));
  }

  if (!localStorage.getItem('voting_system_current_user')) {
    localStorage.setItem('voting_system_current_user', JSON.stringify(null));
  }
}

export function getStoredData() {
  if (typeof window === 'undefined') {
    return {
      users: seedUsers,
      elections: seedElections,
      candidates: seedCandidates,
      votes: seedVotes,
      pageants: seedPageants,
      contestants: seedContestants,
      criteria: seedCriteria,
      pageantJudges: seedPageantJudges,
      scores: seedScores,
      auditLogs: seedAuditLogs,
      electionResults: seedElectionResults,
      pageantResults: seedPageantResults,
    };
  }

  const data = localStorage.getItem('voting_system_data');
  if (data) {
    return JSON.parse(data);
  }

  initializeLocalStorage();
  return JSON.parse(localStorage.getItem('voting_system_data')!);
}

export function setStoredData(data: ReturnType<typeof getStoredData>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('voting_system_data', JSON.stringify(data));
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem('voting_system_current_user');
  return user ? JSON.parse(user) : null;
}

export function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('voting_system_current_user', JSON.stringify(user));
}
