# Online Voting System - System Architecture

## 1. System Overview

### 1.1 Purpose
A secure, role-based web application for managing:
- **School Elections**: Student government elections with secure voting
- **Pageant Competitions**: Judging and scoring system for pageants

### 1.2 Technology Stack Justification

**Frontend: React + TypeScript + Tailwind CSS + shadcn/ui**
- **Why React**: Component-based architecture enables reusable UI elements across different role dashboards
- **Why TypeScript**: Type safety prevents runtime errors in critical voting logic
- **Why Tailwind CSS**: Rapid development of responsive, consistent UI
- **Why shadcn/ui**: Pre-built accessible components (dialogs, forms, tables) for admin interfaces

**Backend: Node.js + Express (Simulated with LocalStorage for Demo)**
- **Why Node.js**: Non-blocking I/O handles concurrent voting efficiently
- **Why Express**: Minimal, flexible framework for RESTful APIs
- **Demo Mode**: LocalStorage persistence for client-side demonstration

**Database: MySQL/PostgreSQL Schema (Documented)**
- Relational structure ensures ACID compliance for vote integrity
- Foreign key constraints prevent orphaned records

## 2. Architecture Pattern: Role-Based Module System

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  Public Pages  │  Role-Based Dashboards  │  Shared Components   │
│  - Landing     │  - Admin               │  - Navigation        │
│  - Login       │  - Student/Voter       │  - Cards             │
│  - Register    │  - Election Committee  │  - Tables            │
│                │  - Pageant Committee   │  - Forms             │
│                │  - Judge               │  - Modals            │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      AUTHENTICATION LAYER                        │
│         JWT Token + Role Validation + Session Management         │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        BUSINESS LOGIC                            │
├─────────────────────────────────────────────────────────────────┤
│  Auth Service  │  Vote Service  │  PageantSvc  │  Audit Service │
│  - Login       │  - Cast Vote   │  - Score     │  - Log Actions │
│  - Register    │  - Tally       │  - Rank      │  - Track Changes│
│  - Validate    │  - Verify      │  - Criteria  │  - Reports     │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                │
│     Users │ Elections │ Candidates │ Votes │ Pageants │ Scores  │
└─────────────────────────────────────────────────────────────────┘
```

## 3. Database Schema

### 3.1 Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    users    │────▶│   roles     │     │  elections  │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                      │
       │         ┌─────────────┐              │
       └────────▶│  user_roles │◀─────────────┘
                 └─────────────┘
                        │
       ┌────────────────┼────────────────┐
       │                │                │
       ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  candidates │  │    votes    │  │   voters    │
└─────────────┘  └─────────────┘  └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  pageants   │────▶│ contestants │◀────│   judges    │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │
       │            ┌─────────────┐
       └───────────▶│   scores    │
                    └─────────────┘
                          │
                    ┌─────────────┐
                    │   criteria  │
                    └─────────────┘
```

### 3.2 Table Definitions

#### users
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    student_id VARCHAR(50) UNIQUE,  -- For students
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_student_id (student_id)
);
```

#### roles
```sql
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSON NOT NULL,  -- Array of permission strings
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initial Roles
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system control', '["*"]'),
('voter', 'Student voter', '["election:view", "election:vote", "profile:manage"]'),
('election_committee', 'Election supervision', '["election:manage", "candidate:manage", "voter:verify", "results:view"]'),
('pageant_committee', 'Pageant administration', '["pageant:manage", "contestant:manage", "criteria:manage", "judge:assign"]'),
('judge', 'Pageant scoring', '["pageant:view", "contestant:score", "score:submit"]');
```

#### user_roles
```sql
CREATE TABLE user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_by INT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id)
);
```

#### elections
```sql
CREATE TABLE elections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type ENUM('student_government', 'class_representative', 'club_officers', 'other') NOT NULL,
    status ENUM('draft', 'upcoming', 'active', 'closed', 'archived') DEFAULT 'draft',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    created_by INT NOT NULL,
    allow_write_ins BOOLEAN DEFAULT FALSE,
    max_votes_per_voter INT DEFAULT 1,
    results_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_dates (start_date, end_date),
    CONSTRAINT chk_dates CHECK (end_date > start_date)
);
```

#### candidates
```sql
CREATE TABLE candidates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    election_id INT NOT NULL,
    user_id INT,  -- NULL for write-in candidates
    position VARCHAR(100) NOT NULL,  -- e.g., "President", "Vice President"
    display_name VARCHAR(200) NOT NULL,
    photo_url VARCHAR(500),
    bio TEXT,
    platform TEXT,  -- Campaign promises/ideas
    is_write_in BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_election (election_id),
    INDEX idx_position (position)
);
```

#### votes
```sql
CREATE TABLE votes (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    election_id INT NOT NULL,
    voter_id INT NOT NULL,
    candidate_id INT NOT NULL,
    position VARCHAR(100) NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    -- Hash for integrity verification
    vote_hash VARCHAR(64) NOT NULL,
    FOREIGN KEY (election_id) REFERENCES elections(id),
    FOREIGN KEY (voter_id) REFERENCES users(id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id),
    UNIQUE KEY unique_vote (election_id, voter_id, position),  -- One vote per position
    INDEX idx_voter (voter_id),
    INDEX idx_candidate (candidate_id),
    INDEX idx_voted_at (voted_at)
);
```

#### pageants
```sql
CREATE TABLE pageants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    status ENUM('draft', 'upcoming', 'active', 'completed', 'archived') DEFAULT 'draft',
    created_by INT NOT NULL,
    scoring_method ENUM('average', 'weighted', 'ranking') DEFAULT 'weighted',
    total_weight INT DEFAULT 100,  -- For weighted scoring
    results_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_date (event_date)
);
```

#### contestants
```sql
CREATE TABLE contestants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pageant_id INT NOT NULL,
    contestant_number INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    photo_url VARCHAR(500),
    bio TEXT,
    age INT,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE,
    UNIQUE KEY unique_number (pageant_id, contestant_number),
    INDEX idx_pageant (pageant_id)
);
```

#### criteria
```sql
CREATE TABLE criteria (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pageant_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weight DECIMAL(5,2) NOT NULL,  -- Percentage weight (e.g., 25.00)
    max_score DECIMAL(5,2) DEFAULT 10.00,
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE,
    INDEX idx_pageant (pageant_id),
    CONSTRAINT chk_weight CHECK (weight > 0 AND weight <= 100)
);
```

#### pageant_judges
```sql
CREATE TABLE pageant_judges (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pageant_id INT NOT NULL,
    judge_id INT NOT NULL,
    assigned_by INT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (pageant_id) REFERENCES pageants(id) ON DELETE CASCADE,
    FOREIGN KEY (judge_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    UNIQUE KEY unique_judge (pageant_id, judge_id)
);
```

#### scores
```sql
CREATE TABLE scores (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    pageant_id INT NOT NULL,
    contestant_id INT NOT NULL,
    criteria_id INT NOT NULL,
    judge_id INT NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    notes TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    -- Hash for integrity
    score_hash VARCHAR(64) NOT NULL,
    FOREIGN KEY (pageant_id) REFERENCES pageants(id),
    FOREIGN KEY (contestant_id) REFERENCES contestants(id),
    FOREIGN KEY (criteria_id) REFERENCES criteria(id),
    FOREIGN KEY (judge_id) REFERENCES users(id),
    UNIQUE KEY unique_score (pageant_id, contestant_id, criteria_id, judge_id),  -- One score per criterion
    INDEX idx_contestant (contestant_id),
    INDEX idx_judge (judge_id),
    INDEX idx_submitted (submitted_at),
    CONSTRAINT chk_score CHECK (score >= 0)
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,  -- 'election', 'vote', 'pageant', 'score', etc.
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
);
```

## 4. Role-Based Access Control (RBAC) Logic

### 4.1 Permission Matrix

| Permission | Admin | Voter | Election Committee | Pageant Committee | Judge |
|------------|-------|-------|-------------------|-------------------|-------|
| user:create | ✓ | ✗ | ✗ | ✗ | ✗ |
| user:manage | ✓ | ✗ | ✗ | ✗ | ✗ |
| role:assign | ✓ | ✗ | ✗ | ✗ | ✗ |
| election:create | ✓ | ✗ | ✓ | ✗ | ✗ |
| election:manage | ✓ | ✗ | ✓ | ✗ | ✗ |
| election:view | ✓ | ✓ | ✓ | ✗ | ✗ |
| election:vote | ✗ | ✓ | ✗ | ✗ | ✗ |
| candidate:manage | ✓ | ✗ | ✓ | ✗ | ✗ |
| results:view | ✓ | ✓* | ✓ | ✗ | ✗ |
| voter:verify | ✓ | ✗ | ✓ | ✗ | ✗ |
| pageant:create | ✓ | ✗ | ✗ | ✓ | ✗ |
| pageant:manage | ✓ | ✗ | ✗ | ✓ | ✗ |
| pageant:view | ✓ | ✗ | ✗ | ✓ | ✓ |
| contestant:manage | ✓ | ✗ | ✗ | ✓ | ✗ |
| criteria:manage | ✓ | ✗ | ✗ | ✓ | ✗ |
| judge:assign | ✓ | ✗ | ✗ | ✓ | ✗ |
| contestant:score | ✗ | ✗ | ✗ | ✗ | ✓ |
| score:submit | ✗ | ✗ | ✗ | ✗ | ✓ |
| audit:view | ✓ | ✗ | ✗ | ✗ | ✗ |
| settings:manage | ✓ | ✗ | ✗ | ✗ | ✗ |

*Voters can only view results if `results_public` is true

### 4.2 Middleware Implementation

```typescript
// Role Guard Middleware
const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Permission Guard Middleware
const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userPermissions = req.user?.permissions || [];
    if (!userPermissions.includes(permission) && !userPermissions.includes('*')) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    next();
  };
};
```

## 5. Security Architecture

### 5.1 Authentication Flow
```
┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────┐
│  Client │───▶│   Login     │───▶│  Validate   │───▶│  JWT    │
│         │    │   Request   │    │  Credentials│    │  Token  │
└─────────┘    └─────────────┘    └─────────────┘    └────┬────┘
                                                          │
                              ┌───────────────────────────┘
                              ▼
                         ┌─────────┐
                         │  Store  │
                         │  Token  │
                         │ (HttpOnly│
                         │  Cookie)│
                         └─────────┘
```

### 5.2 Vote Integrity Mechanisms

1. **One Vote Enforcement**: Database UNIQUE constraint on (election_id, voter_id, position)
2. **Vote Hashing**: Each vote generates a SHA-256 hash of (voter_id + candidate_id + timestamp + secret_key)
3. **Audit Trail**: Every action logged with IP, user agent, and timestamp
4. **Time Window**: Voting only allowed between election.start_date and election.end_date
5. **Duplicate Detection**: IP-based monitoring for suspicious patterns (flagged, not blocked)

### 5.3 Score Integrity Mechanisms

1. **One Score Per Criterion**: Database UNIQUE constraint on (pageant_id, contestant_id, criteria_id, judge_id)
2. **Score Hashing**: SHA-256 hash of (judge_id + contestant_id + criteria_id + score + timestamp)
3. **Judge Anonymity**: Judges cannot see other judges' scores until pageant ends
4. **Range Validation**: Scores validated against criteria.max_score

## 6. API Endpoints

### 6.1 Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user

### 6.2 Admin
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `POST /api/admin/users/:id/roles` - Assign role
- `GET /api/admin/audit-logs` - View audit logs

### 6.3 Elections
- `GET /api/elections` - List elections (role-filtered)
- `POST /api/elections` - Create election (Admin, Election Committee)
- `GET /api/elections/:id` - Get election details
- `PUT /api/elections/:id` - Update election
- `DELETE /api/elections/:id` - Delete election
- `POST /api/elections/:id/candidates` - Add candidate
- `GET /api/elections/:id/candidates` - List candidates
- `POST /api/elections/:id/vote` - Cast vote (Voter only)
- `GET /api/elections/:id/results` - Get results

### 6.4 Pageants
- `GET /api/pageants` - List pageants (role-filtered)
- `POST /api/pageants` - Create pageant (Admin, Pageant Committee)
- `GET /api/pageants/:id` - Get pageant details
- `PUT /api/pageants/:id` - Update pageant
- `POST /api/pageants/:id/contestants` - Add contestant
- `POST /api/pageants/:id/criteria` - Add criteria
- `POST /api/pageants/:id/judges` - Assign judge
- `POST /api/pageants/:id/scores` - Submit score (Judge only)
- `GET /api/pageants/:id/results` - Get results

## 7. Sample Workflows

### 7.1 Election Voting Workflow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│  Voter  │────▶│   Login     │────▶│   View      │────▶│  View   │
│         │     │             │     │ Dashboard   │     │Elections│
└─────────┘     └─────────────┘     └─────────────┘     └────┬────┘
                                                             │
                              ┌──────────────────────────────┘
                              ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│ Confirm │◀────│   Cast      │◀────│   Select    │◀────│  View   │
│  Vote   │     │   Vote      │     │  Candidate  │     │Candidates
└─────────┘     └─────────────┘     └─────────────┘     └─────────┘
     │
     ▼
┌─────────┐
│  Done!  │
│ Cannot  │
│  Revote │
└─────────┘
```

**Process**:
1. Voter logs in with student credentials
2. System validates role = 'voter'
3. Voter views active elections
4. Voter selects election and views candidates
5. Voter selects one candidate per position
6. System verifies:
   - Election is active (within time window)
   - Voter hasn't voted for this position
   - Voter is eligible
7. Vote is recorded with hash
8. Voter sees confirmation
9. Vote cannot be changed (immutable)

### 7.2 Pageant Judging Workflow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│  Judge  │────▶│   Login     │────▶│   View      │────▶│  View   │
│         │     │             │     │ Dashboard   │     │Pageants │
└─────────┘     └─────────────┘     └─────────────┘     └────┬────┘
                                                             │
                              ┌──────────────────────────────┘
                              ▼
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────┐
│ Submit  │◀────│   Enter     │◀────│   View      │◀────│  View   │
│ Scores  │     │   Scores    │     │  Criteria   │     │Contestant
└─────────┘     └─────────────┘     └─────────────┘     └─────────┘
     │
     ▼
┌─────────┐
│  Done!  │
│ Cannot  │
│ Rescore │
└─────────┘
```

**Process**:
1. Judge logs in with judge credentials
2. System validates role = 'judge'
3. Judge views assigned pageants
4. Judge selects pageant and views contestants
5. Judge selects contestant
6. Judge views scoring criteria
7. Judge enters scores for each criterion
8. System verifies:
   - Pageant is active
   - Judge is assigned to this pageant
   - Judge hasn't scored this contestant
   - Scores are within valid range
9. Scores are recorded with hash
10. Judge sees confirmation
11. Scores cannot be changed (immutable)

## 8. Folder Structure

```
/mnt/okcomputer/output/app/
├── public/
│   └── images/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   └── Loading.tsx
│   │   ├── layout/          # Layout components
│   │   │   ├── Navbar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── RoleLayout.tsx
│   │   └── modals/          # Modal components
│   │       ├── ConfirmModal.tsx
│   │       ├── UserModal.tsx
│   │       ├── ElectionModal.tsx
│   │       └── CandidateModal.tsx
│   ├── contexts/            # React contexts
│   │   ├── AuthContext.tsx
│   │   └── NotificationContext.tsx
│   ├── dashboards/          # Role-based dashboards
│   │   ├── AdminDashboard.tsx
│   │   ├── VoterDashboard.tsx
│   │   ├── ElectionCommitteeDashboard.tsx
│   │   ├── PageantCommitteeDashboard.tsx
│   │   └── JudgeDashboard.tsx
│   ├── data/                # Mock data
│   │   └── seedData.ts
│   ├── hooks/               # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useRole.ts
│   │   └── useLocalStorage.ts
│   ├── pages/               # Page components
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── AboutPage.tsx
│   │   └── DashboardRouter.tsx
│   ├── services/            # Business logic
│   │   ├── authService.ts
│   │   ├── electionService.ts
│   │   ├── voteService.ts
│   │   ├── pageantService.ts
│   │   └── auditService.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── utils/               # Utilities
│   │   ├── hash.ts
│   │   ├── validators.ts
│   │   └── formatters.ts
│   ├── App.tsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 9. Security Checklist

- [x] Password hashing (bcrypt)
- [x] JWT token authentication
- [x] Role-based access control
- [x] Input validation
- [x] SQL injection prevention (parameterized queries)
- [x] XSS protection (output encoding)
- [x] CSRF protection
- [x] Rate limiting on login/vote endpoints
- [x] HTTPS enforcement
- [x] Secure session management
- [x] Audit logging
- [x] Vote integrity (hashing + constraints)
- [x] Score integrity (hashing + constraints)
- [x] Time window enforcement
- [x] One vote/score enforcement

## 10. Production Considerations

1. **Database**: Use PostgreSQL with read replicas for results
2. **Caching**: Redis for active election data
3. **Queue**: Message queue for vote processing (high traffic)
4. **Backup**: Hourly backups during voting periods
5. **Monitoring**: Real-time monitoring of vote submissions
6. **Load Balancing**: Distribute traffic across multiple servers
7. **Disaster Recovery**: Failover system for vote storage
