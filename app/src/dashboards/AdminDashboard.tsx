import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users, Vote, Crown, TrendingUp, UserPlus, FileText, Search,
  MoreHorizontal, Edit, Trash2, UserCheck, UserX, Shield, LogOut,
  Menu, X, Activity, Eye, Plus, CheckCircle, Play,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getAllUsers, createUser, updateUser, deleteUser, setUserActive, assignRole, removeRole, getUserStatistics, type UserUpdatePayload } from '@/services/userService';
import {
  getAllElections, createElection, updateElection, deleteElection,
  openElection, closeElection, publishResults, getElectionResults,
  getCandidatesByElection, getElectionPositions, addCandidate,
  updateCandidate, removeCandidate,
} from '@/services/electionService';
import {
  getAllPageants, createPageant, updatePageant, deletePageant,
  startPageant, completePageant, publishPageantResults, getPageantResults,
  getContestantsByPageant, addContestant, updateContestant, removeContestant,
} from '@/services/pageantService';
import { getAllAuditLogs, getAuditStatistics } from '@/services/auditService';
import type {
  User, UserRole, Election, Pageant, AuditLog, ElectionFormData,
  PageantFormData, Candidate, ElectionPosition, CandidateFormData,
  ElectionResult, Contestant, ContestantFormData, PageantResultsResponse,
} from '@/types';
import { formatDate, formatDateTime, formatRoleName, formatScoringMethod } from '@/utils/formatters';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// ─── Design primitives shared across all sub-components ──────────────────────

/** Stat card used in OverviewTab */
const StatCard = ({
  label, value, icon: Icon, accent,
}: { label: string; value: number; icon: React.ElementType; accent: string }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{value.toLocaleString()}</p>
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accent}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
);

/** Section header used inside tab panels */
const SectionHeader = ({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

/** Pill button used for primary actions */
const ActionBtn = ({
  onClick, children, color = 'blue', size = 'md',
}: {
  onClick?: () => void; children: React.ReactNode;
  color?: 'blue' | 'green' | 'red' | 'outline'; size?: 'sm' | 'md';
}) => {
  const palette = {
    blue: 'bg-[#1E3A8A] hover:bg-[#1d3580] text-white shadow-sm shadow-blue-200',
    green: 'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200',
    red: 'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
  };
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 font-semibold rounded-xl transition-all hover:-translate-y-px active:translate-y-0 ${palette[color]} ${sz}`}
    >
      {children}
    </button>
  );
};

/** Table shell */
const DataTable = ({ headers, children, empty }: {
  headers: string[]; children: React.ReactNode; empty?: boolean;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr className="bg-[#1E3A8A]">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-5 py-3 text-xs font-bold text-white uppercase tracking-wider ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {empty ? (
            <tr>
              <td colSpan={headers.length} className="px-5 py-10 text-center text-sm text-gray-400">
                No data available.
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border border-green-200',
    closed: 'bg-gray-100 text-gray-600 border border-gray-200',
    completed: 'bg-gray-100 text-gray-600 border border-gray-200',
    upcoming: 'bg-blue-50 text-blue-700 border border-blue-200',
    draft: 'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

// ─── DashboardStats interface (unchanged) ────────────────────────────────────
interface DashboardStats {
  totalUsers: number;
  activeElections: number;
  totalElections: number;
  totalVotes: number;
  upcomingPageants: number;
  activePageants: number;
  usersByRole: Record<string, number>;
}

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const NAV = [
  { value: 'overview',  label: 'Overview',         icon: TrendingUp },
  { value: 'users',     label: 'User Management',  icon: Users },
  { value: 'elections', label: 'Elections',         icon: Vote },
  { value: 'pageants',  label: 'Pageants',          icon: Crown },
  { value: 'audit',     label: 'Audit Logs',        icon: FileText },
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { showError } = useNotification();
  const [activeTab, setActiveTab]           = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen]       = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0, activeElections: 0, totalElections: 0,
    totalVotes: 0, upcomingPageants: 0, activePageants: 0, usersByRole: {},
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);

  // ── All data-fetching logic unchanged ────────────────────────────────────
  const fetchStats = useCallback(async () => {
    const [userStatsResult, electionsResult, pageantsResult, auditStatsResult, auditLogsResult] =
      await Promise.allSettled([
        getUserStatistics(), getAllElections(), getAllPageants(),
        getAuditStatistics(), getAllAuditLogs(),
      ]);

    const userStats = userStatsResult.status === 'fulfilled'
      ? userStatsResult.value
      : { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, usersByRole: {}, newUsersThisMonth: 0 };
    const elections = electionsResult.status === 'fulfilled' ? electionsResult.value : [];
    const pageants  = pageantsResult.status  === 'fulfilled' ? pageantsResult.value  : [];
    const auditStats = auditStatsResult.status === 'fulfilled'
      ? auditStatsResult.value
      : { totalLogs: 0, logsToday: 0, logsThisWeek: 0, logsThisMonth: 0, actionCounts: {}, entityTypeCounts: {} };
    const auditLogs = auditLogsResult.status === 'fulfilled' ? auditLogsResult.value : [];

    if (userStatsResult.status === 'rejected') {
      showError('Failed to load user statistics. Please refresh the page.');
    }

    const electionPageantLogs = auditLogs.filter(
      (log) => log.entityType === 'election' || log.entityType === 'pageant'
    );
    setRecentAuditLogs(electionPageantLogs.slice(0, 8));
    setStats({
      totalUsers:       userStats.totalUsers,
      activeElections:  elections.filter(e => e.status === 'active').length,
      totalElections:   elections.length,
      totalVotes:       auditStats.actionCounts['vote_cast'] || 0,
      upcomingPageants: pageants.filter(p => p.status === 'upcoming').length,
      activePageants:   pageants.filter(p => p.status === 'active').length,
      usersByRole:      userStats.usersByRole,
    });
  }, [showError]);

  useEffect(() => { Promise.resolve().then(() => { void fetchStats(); }); }, [fetchStats]);
  useEffect(() => {
    if (activeTab === 'overview') { Promise.resolve().then(() => { void fetchStats(); }); }
  }, [activeTab, fetchStats]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  // ── Nav change helper ────────────────────────────────────────────────────
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setIsMobileNavOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] overflow-x-hidden">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="min-h-screen">

        {/* ── MOBILE TOP BAR ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 flex items-center justify-between bg-white border-b border-gray-100 px-4 py-3 md:hidden shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] flex items-center justify-center">
              <Vote className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">Admin Panel</span>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile overlay */}
        {isMobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        {/* ── SIDEBAR ────────────────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          w-[80vw] max-w-[260px] bg-white border-r border-gray-100 shadow-xl
          transition-transform duration-200
          md:w-64 md:max-w-none md:translate-x-0 md:shadow-none
          ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Sidebar brand */}
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center shadow-md shadow-blue-200">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">SchoolVote</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Admin Panel</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <TabsList className="h-auto w-full bg-transparent p-0 flex flex-col items-stretch gap-1">
              {NAV.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="
                    w-full justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left
                    text-gray-600 border border-transparent
                    hover:bg-gray-50 hover:text-gray-900
                    data-[state=active]:bg-[#EFF3FF] data-[state=active]:text-[#1E3A8A]
                    data-[state=active]:border-[#C7D7FD] data-[state=active]:font-semibold
                    transition-all
                  "
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsLogoutDialogOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ───────────────────────────────────────────────── */}
        <main className="md:ml-64 min-w-0 flex flex-col min-h-screen">

          {/* Page header */}
          <header className="bg-gradient-to-r from-[#0c1f4a] to-[#1E3A8A] px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
                  {NAV.find(n => n.value === activeTab)?.label ?? 'Dashboard'}
                </h1>
                <p className="text-sm text-blue-200/80 mt-0.5">
                  Welcome back, {user?.firstName} {user?.lastName}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white w-fit">
                <Shield className="w-3 h-3" /> Administrator
              </span>
            </div>
          </header>

          {/* Tab panels */}
          <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
            <TabsContent value="overview">
              <OverviewTab stats={stats} recentLogs={recentAuditLogs} onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="users">
              <UserManagementTab onUpdate={fetchStats} />
            </TabsContent>
            <TabsContent value="elections">
              <ElectionsTab isActive={activeTab === 'elections'} />
            </TabsContent>
            <TabsContent value="pageants">
              <PageantsTab isActive={activeTab === 'pageants'} />
            </TabsContent>
            <TabsContent value="audit">
              <AuditLogsTab />
            </TabsContent>
          </div>
        </main>
      </Tabs>

      {/* ── LOGOUT DIALOG ──────────────────────────────────────────────────── */}
      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold tracking-tight">Sign out?</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              You'll be returned to the login page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2 mt-2">
            <Button variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={() => setIsLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white" onClick={() => { void handleLogout(); }}>
              Sign Out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════
function OverviewTab({
  stats, recentLogs, onNavigate,
}: { stats: DashboardStats; recentLogs: AuditLog[]; onNavigate: (tab: string) => void }) {

  const statCards = [
    { label: 'Total Users',       value: stats.totalUsers,       icon: Users,     accent: 'bg-blue-50 text-blue-600' },
    { label: 'Active Elections',  value: stats.activeElections,  icon: Vote,      accent: 'bg-green-50 text-green-600' },
    { label: 'Total Elections',   value: stats.totalElections,   icon: TrendingUp,accent: 'bg-indigo-50 text-indigo-600' },
    { label: 'Votes Cast',        value: stats.totalVotes,       icon: UserCheck, accent: 'bg-purple-50 text-purple-600' },
    { label: 'Active Pageants',   value: stats.activePageants,   icon: Crown,     accent: 'bg-amber-50 text-amber-600' },
    { label: 'Upcoming Pageants', value: stats.upcomingPageants, icon: Activity,  accent: 'bg-orange-50 text-orange-600' },
  ];

  const roleChartData = Object.entries(stats.usersByRole)
    .filter(([role]) => role !== 'admin')
    .map(([role, count]) => ({ role: formatRoleName(role), count }));

  const roleColors: Record<string, string> = {
    admin:              'bg-red-50 text-red-700 border border-red-200',
    voter:              'bg-blue-50 text-blue-700 border border-blue-200',
    election_committee: 'bg-green-50 text-green-700 border border-green-200',
    pageant_committee:  'bg-purple-50 text-purple-700 border border-purple-200',
    judge:              'bg-amber-50 text-amber-700 border border-amber-200',
  };

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <StatCard key={i} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Distribution</p>
          <h3 className="text-base font-extrabold text-gray-900 mb-5">Users by Role</h3>
          {roleChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={roleChartData} margin={{ top: 4, right: 8, left: -20, bottom: 60 }}>
                <XAxis dataKey="role" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data available.</p>
          )}
        </div>

        {/* Role breakdown pills */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Breakdown</p>
          <h3 className="text-base font-extrabold text-gray-900 mb-5">Role Summary</h3>
          {Object.entries(stats.usersByRole).length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {Object.entries(stats.usersByRole).map(([role, count]) => (
                <div
                  key={role}
                  className={`px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${roleColors[role] ?? 'bg-gray-100 text-gray-700 border border-gray-200'}`}
                >
                  <span className="font-medium">{formatRoleName(role)}</span>
                  <span className="font-extrabold text-base">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No users found.</p>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Live Feed</p>
        <h3 className="text-base font-extrabold text-gray-900 mb-5">Recent Election &amp; Pageant Activity</h3>
        {recentLogs.length > 0 ? (
          <ul className="divide-y divide-gray-50">
            {recentLogs.map((log) => (
              <li key={log.id} className="py-3 flex items-start gap-3">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#1E3A8A]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 capitalize">{log.action.replace(/_/g, ' ')}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                      {log.entityType}
                    </span>
                    {typeof (log.newValues as { status?: unknown } | undefined)?.status === 'string' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-[10px] font-semibold text-blue-600">
                        Status: {(log.newValues as { status: string }).status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {log.userName && <p className="text-xs text-gray-400">by {log.userName}</p>}
                    <p className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No recent activity.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Shortcuts</p>
        <h3 className="text-base font-extrabold text-gray-900 mb-5">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <ActionBtn onClick={() => onNavigate('users')} color="blue">
            <Users className="w-4 h-4" /> Manage Users
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('elections')} color="outline">
            <Vote className="w-4 h-4" /> View Elections
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('pageants')} color="outline">
            <Crown className="w-4 h-4" /> View Pageants
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('audit')} color="outline">
            <FileText className="w-4 h-4" /> Audit Logs
          </ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// USER MANAGEMENT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function UserManagementTab({ onUpdate }: { onUpdate: () => void }) {
  const [users, setUsers]                     = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers]   = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser]         = useState<User | null>(null);
  const { showSuccess, showError }            = useNotification();

  const [searchEC,    setSearchEC]    = useState('');
  const [searchPC,    setSearchPC]    = useState('');
  const [searchVoter, setSearchVoter] = useState('');
  const [searchJudge, setSearchJudge] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers.filter((u) => !u.roles.includes('admin')));
    } catch (error) {
      showError((error as Error).message || 'Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [showError]);

  useEffect(() => { Promise.resolve().then(() => { void fetchUsers(); }); }, [fetchUsers]);

  const handleCreateUser = async (userData: {
    email: string; password: string; firstName: string;
    lastName: string; studentId?: string; roles: UserRole[];
  }) => {
    const result = await createUser(userData);
    if (result.success) {
      showSuccess('User created successfully');
      setIsCreateModalOpen(false);
      void fetchUsers(); void onUpdate();
    } else { showError(result.error || 'Failed to create user'); }
  };

  const { refreshUser } = useAuth();

  const handleUpdateUser = async (id: string, updates: UserUpdatePayload) => {
    const result = await updateUser(id, updates);
    if (result.success) {
      const editedUser = users.find((u) => u.id === id);
      const isStaffUser = !!editedUser?.roles.some((role) => role === 'election_committee' || role === 'pageant_committee' || role === 'judge');
      const emailChanged = typeof updates.email === 'string' && updates.email.trim().length > 0;
      if (isStaffUser && emailChanged) {
        showSuccess('User updated. Staff account must set up TOTP again using the new email.');
      } else {
        showSuccess('User updated successfully! Reload page to fully sync profile.');
      }
      setEditingUser(null);
      void fetchUsers(); void onUpdate();
      try { await refreshUser(); } catch { /* graceful fallback */ }
    } else { showError(result.error || 'Failed to update user'); }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      const result = await deleteUser(id);
      if (result.success) {
        showSuccess('User deleted successfully');
        void fetchUsers(); void onUpdate();
      } else { showError(result.error || 'Failed to delete user'); }
    }
  };

  const handleToggleActive = async (user: User) => {
    const result = await setUserActive(user.id, !user.isActive);
    if (result.success) {
      showSuccess(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
      void fetchUsers(); void onUpdate();
    } else { showError(result.error || 'Failed to update user'); }
  };

  const handleAssignRole = async (userId: string, role: UserRole) => {
    const result = await assignRole(userId, role);
    if (result.success) { showSuccess('Role assigned successfully'); void fetchUsers(); void onUpdate(); }
    else { showError(result.error || 'Failed to assign role'); }
  };

  const handleRemoveRole = async (userId: string, role: UserRole) => {
    const result = await removeRole(userId, role);
    if (result.success) { showSuccess('Role removed successfully'); void fetchUsers(); void onUpdate(); }
    else { showError(result.error || 'Failed to remove role'); }
  };

  const filterByQuery = (list: User[], query: string) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (u) => u.firstName.toLowerCase().includes(q) || u.lastName.toLowerCase().includes(q)
        || u.email.toLowerCase().includes(q) || (u.studentId && u.studentId.toLowerCase().includes(q))
    );
  };

  const ecAll    = users.filter((u) => u.roles.includes('election_committee'));
  const pcAll    = users.filter((u) => u.roles.includes('pageant_committee'));
  const voterAll = users.filter((u) => u.roles.includes('voter'));
  const judgeAll = users.filter((u) => u.roles.includes('judge'));

  const sections = [
    { title: 'Election Committee', role: 'election_committee' as UserRole, all: ecAll,    filtered: filterByQuery(ecAll,    searchEC),    search: searchEC,    setSearch: setSearchEC },
    { title: 'Pageant Committee',  role: 'pageant_committee'  as UserRole, all: pcAll,    filtered: filterByQuery(pcAll,    searchPC),    search: searchPC,    setSearch: setSearchPC },
    { title: 'Voters',             role: 'voter'              as UserRole, all: voterAll, filtered: filterByQuery(voterAll, searchVoter), search: searchVoter, setSearch: setSearchVoter },
    { title: 'Judges',             role: 'judge'              as UserRole, all: judgeAll, filtered: filterByQuery(judgeAll, searchJudge), search: searchJudge, setSearch: setSearchJudge },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader
        title="User Management"
        subtitle="Manage all system users by role"
        action={
          <ActionBtn onClick={() => setIsCreateModalOpen(true)} color="green">
            <UserPlus className="w-4 h-4" /> Add User
          </ActionBtn>
        }
      />

      {isLoadingUsers && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
          Loading users…
        </div>
      )}

      {sections.map(({ title, role, all, filtered, search, setSearch }) => (
        <div key={role} className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-extrabold text-gray-900">{title}</h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-semibold text-blue-600">
                {all.length}
              </span>
            </div>
            <div className="relative flex items-center">
              <Search className="absolute left-3 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                className="w-full sm:w-52 pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50/60 focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A] transition-all"
                placeholder={`Search ${title.toLowerCase()}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <DataTable
            headers={['User', 'Roles', 'Status', 'Created', 'Actions']}
            empty={filtered.length === 0}
          >
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(u.photoUrl || u.photoPath) ? (
                        <img src={u.photoUrl || u.photoPath} alt="Profile" className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.src = ''; }} />
                      ) : `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{u.firstName} {u.lastName}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                      {u.studentId && <p className="text-[11px] text-gray-400">ID: {u.studentId}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span key={r} className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 text-xs font-medium text-gray-600">
                        {formatRoleName(r)}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
                  {formatDate(u.createdAt)}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem onClick={() => setEditingUser(u)}>
                        <Edit className="w-4 h-4 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                        {u.isActive
                          ? <><UserX className="w-4 h-4 mr-2" /> Deactivate</>
                          : <><UserCheck className="w-4 h-4 mr-2" /> Activate</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDeleteUser(u.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </DataTable>
        </div>
      ))}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Create New User</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Add a new user to the system.</DialogDescription>
          </DialogHeader>
          <CreateUserForm onSubmit={handleCreateUser} onCancel={() => setIsCreateModalOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Edit User</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Update user information.</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <EditUserForm
              user={editingUser}
              onSubmit={(updates) => handleUpdateUser(editingUser.id, updates)}
              onCancel={() => setEditingUser(null)}
              onAssignRole={(role) => handleAssignRole(editingUser.id, role)}
              onRemoveRole={(role) => handleRemoveRole(editingUser.id, role)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Shared form field wrapper ────────────────────────────────────────────────
const FormField = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-gray-700 tracking-wide">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);

// ─── Shared form input style ─────────────────────────────────────────────────
const formInputClass = "rounded-xl border-gray-200 bg-gray-50/60 text-sm focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A]";

// ═══════════════════════════════════════════════════════════════════════════════
// CREATE USER FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function CreateUserForm({
  onSubmit, onCancel,
}: {
  onSubmit: (data: { email: string; password: string; firstName: string; lastName: string; studentId?: string; roles: UserRole[] }) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    email: '', password: '', firstName: '', lastName: '',
    role: 'election_committee' as UserRole,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ email: formData.email, password: formData.password, firstName: formData.firstName, lastName: formData.lastName, roles: [formData.role] });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First Name">
          <Input id="firstName" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className={formInputClass} />
        </FormField>
        <FormField label="Last Name">
          <Input id="lastName" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className={formInputClass} />
        </FormField>
      </div>
      <FormField label="Email">
        <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className={formInputClass} />
      </FormField>
      <FormField label="Password" hint="Minimum 8 characters">
        <Input id="password" type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required minLength={8} className={formInputClass} />
      </FormField>
      <FormField label="Role">
        <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}>
          <SelectTrigger className={formInputClass}><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="voter">Voter</SelectItem>
            <SelectItem value="election_committee">Election Committee</SelectItem>
            <SelectItem value="pageant_committee">Pageant Committee</SelectItem>
            <SelectItem value="judge">Judge</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">Create User</Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDIT USER FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function EditUserForm({
  user, onSubmit, onCancel,
}: {
  user: User; onSubmit: (updates: UserUpdatePayload) => void; onCancel: () => void;
  onAssignRole: (role: UserRole) => void; onRemoveRole: (role: UserRole) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: user.firstName, lastName: user.lastName,
    email: user.email, studentId: user.studentId || '',
    password: '', confirmPassword: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Voter-only: all roles are voter
  const isVoterOnly = user.roles.length > 0 && user.roles.every((role) => role === 'voter');
  // Staff roles that support password updates
  const canEditPassword = user.roles.some(
    (role) => role === 'election_committee' || role === 'pageant_committee' || role === 'judge'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const hasPasswordInput = formData.password.trim().length > 0 || formData.confirmPassword.trim().length > 0;
    if (hasPasswordInput) {
      if (!canEditPassword) {
        setFormError('Password update is only available for election committee, pageant committee, and judge roles.');
        return;
      }
      if (formData.password.length < 8) {
        setFormError('Password must be at least 8 characters.');
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    const updates: UserUpdatePayload = {
      firstName: formData.firstName,
      lastName: formData.lastName,
    };
    if (isVoterOnly) { updates.studentId = formData.studentId; }
    else { updates.email = formData.email; }
    if (canEditPassword && formData.password.trim().length > 0) {
      updates.password = formData.password;
    }
    onSubmit(updates);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First Name">
          <Input id="edit-firstName" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className={formInputClass} />
        </FormField>
        <FormField label="Last Name">
          <Input id="edit-lastName" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className={formInputClass} />
        </FormField>
      </div>

      <FormField label="Email">
        <Input id="edit-email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={isVoterOnly} className={formInputClass} />
      </FormField>

      {isVoterOnly && (
        <FormField label="Student ID">
          <Input id="edit-studentId" value={formData.studentId} onChange={(e) => setFormData({ ...formData, studentId: e.target.value })} className={formInputClass} />
        </FormField>
      )}

      {canEditPassword && (
        <>
          <FormField label="New Password" hint="At least 8 characters. Leave blank to keep current password.">
            <Input
              id="edit-password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Leave blank to keep current password"
              className={formInputClass}
            />
          </FormField>
          <FormField label="Confirm New Password">
            <Input
              id="edit-confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              placeholder="Re-enter new password"
              className={formInputClass}
            />
          </FormField>

          {/* TOTP re-setup warning */}
          <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5">
            <span className="text-amber-500 mt-0.5 shrink-0">⚠</span>
            <p className="text-xs text-amber-700 leading-relaxed">
              Changing email for election committee, pageant committee, or judge will require TOTP setup again.
            </p>
          </div>
        </>
      )}

      {/* Inline form error */}
      {formError && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5">
          <span className="text-red-500 mt-0.5 shrink-0">✕</span>
          <p className="text-xs text-red-700 leading-relaxed">{formError}</p>
        </div>
      )}

      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">Save Changes</Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTIONS TAB (logic unchanged, UI redesigned)
// ═══════════════════════════════════════════════════════════════════════════════
function ElectionsTab({ isActive }: { isActive: boolean }) {
  const [elections, setElections]                 = useState<Election[]>([]);
  const [isElectionModalOpen, setIsElectionModalOpen]   = useState(false);
  const [editingElection, setEditingElection]     = useState<Election | null>(null);
  const [selectedElection, setSelectedElection]   = useState<Election | null>(null);
  const [isCandidatesModalOpen, setIsCandidatesModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen]     = useState(false);
  const [candidates, setCandidates]               = useState<Candidate[]>([]);
  const [positions, setPositions]                 = useState<ElectionPosition[]>([]);
  const [results, setResults]                     = useState<ElectionResult[]>([]);
  const [editingCandidate, setEditingCandidate]   = useState<Candidate | null>(null);
  const { showSuccess, showError }                = useNotification();

  const fetchElections = useCallback(async () => {
    const data = await getAllElections();
    setElections(data);
  }, []);

  useEffect(() => { if (!isActive) return; void fetchElections(); }, [isActive, fetchElections]);

  const handleSaveElection = async (formData: ElectionFormData) => {
    if (editingElection) {
      const updated = await updateElection(editingElection.id, formData as Partial<Election>);
      if (!updated) { showError('Failed to update election'); return; }
      showSuccess('Election updated successfully');
    } else {
      await createElection(formData, 'admin');
      showSuccess('Election created successfully');
    }
    setIsElectionModalOpen(false); setEditingElection(null); void fetchElections();
  };

  const openCandidatesModal = async (election: Election) => {
    setSelectedElection(election); setIsCandidatesModalOpen(true);
    try {
      const [loadedCandidates, loadedPositions] = await Promise.all([
        getCandidatesByElection(election.id), getElectionPositions(election.id),
      ]);
      setCandidates(loadedCandidates); setPositions(loadedPositions);
    } catch { showError('Failed to load candidates'); }
  };

  const handleSaveCandidate = async (formData: CandidateFormData) => {
    if (!selectedElection) return;
    if (editingCandidate) {
      const updated = await updateCandidate(editingCandidate.id, selectedElection.id, {
        positionId: formData.positionId, displayName: formData.displayName,
        bio: formData.bio, platform: formData.platform, isWriteIn: formData.isWriteIn,
      });
      if (!updated) { showError('Failed to update candidate'); return; }
      showSuccess('Candidate updated successfully');
    } else {
      await addCandidate(selectedElection.id, formData);
      showSuccess('Candidate added successfully');
    }
    const refreshed = await getCandidatesByElection(selectedElection.id);
    setCandidates(refreshed); setEditingCandidate(null);
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    if (!selectedElection) return;
    const ok = await removeCandidate(candidate.id, selectedElection.id);
    if (!ok) { showError('Failed to remove candidate'); return; }
    showSuccess('Candidate removed successfully');
    const refreshed = await getCandidatesByElection(selectedElection.id);
    setCandidates(refreshed);
  };

  const openResultsModal = async (election: Election) => {
    setSelectedElection(election); setIsResultsModalOpen(true);
    try { const loaded = await getElectionResults(election.id); setResults(loaded); }
    catch { setResults([]); showError('Unable to load election results'); }
  };

  const handleStatusAction = async (election: Election, action: 'open' | 'close' | 'publish') => {
    const response = action === 'open' ? await openElection(election.id)
      : action === 'close' ? await closeElection(election.id)
      : await publishResults(election.id);
    if (!response) { showError('Failed to update election action'); return; }
    showSuccess(action === 'publish' ? 'Election results published' : `Election ${action} action completed`);
    void fetchElections();
  };

  const handleDeleteElection = async (election: Election) => {
    if (!confirm(`Delete election "${election.title}"?`)) return;
    const ok = await deleteElection(election.id);
    if (!ok) { showError('Failed to delete election'); return; }
    showSuccess('Election deleted successfully'); void fetchElections();
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Elections"
        subtitle={`${elections.length} total election${elections.length !== 1 ? 's' : ''}`}
        action={
          <ActionBtn color="green" onClick={() => { setEditingElection(null); setIsElectionModalOpen(true); }}>
            <Vote className="w-4 h-4" /> Create Election
          </ActionBtn>
        }
      />

      <DataTable
        headers={['Election', 'Status', 'Dates', 'Results', 'Actions']}
        empty={elections.length === 0}
      >
        {elections.map((election) => (
          <tr key={election.id} className="hover:bg-gray-50/70 transition-colors">
            <td className="px-5 py-3.5">
              <p className="text-sm font-semibold text-gray-900">{election.title}</p>
              <p className="text-xs text-gray-400 capitalize">{election.type.replace(/_/g, ' ')}</p>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <StatusBadge status={election.status} />
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
              {formatDate(election.startDate)} — {formatDate(election.endDate)}
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${election.resultsPublic ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {election.resultsPublic ? 'Public' : 'Private'}
              </span>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => { setEditingElection(election); setIsElectionModalOpen(true); }}>
                    <Edit className="w-4 h-4 mr-2" /> Edit Election
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void openCandidatesModal(election)}>
                    <Users className="w-4 h-4 mr-2" /> Manage Candidates
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void openResultsModal(election)}>
                    <Eye className="w-4 h-4 mr-2" /> View Results
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleStatusAction(election, 'open')}>
                    <Play className="w-4 h-4 mr-2" /> Set Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleStatusAction(election, 'close')}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Set Closed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleStatusAction(election, 'publish')}>
                    <Eye className="w-4 h-4 mr-2" /> Publish Results
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => void handleDeleteElection(election)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        ))}
      </DataTable>

      <Dialog open={isElectionModalOpen} onOpenChange={setIsElectionModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">{editingElection ? 'Edit Election' : 'Create Election'}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Admin has full control over election lifecycle settings.</DialogDescription>
          </DialogHeader>
          <ElectionEditorForm election={editingElection} onSubmit={handleSaveElection} onCancel={() => { setIsElectionModalOpen(false); setEditingElection(null); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={isCandidatesModalOpen} onOpenChange={setIsCandidatesModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Manage Candidates</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">{selectedElection?.title}</DialogDescription>
          </DialogHeader>
          {selectedElection && (
            <AdminCandidateManager
              candidates={candidates} positions={positions} editingCandidate={editingCandidate}
              onSave={handleSaveCandidate} onEdit={setEditingCandidate}
              onDelete={handleDeleteCandidate} onCancelEdit={() => setEditingCandidate(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Election Results</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">{selectedElection?.title} — read-only snapshot</DialogDescription>
          </DialogHeader>
          <AdminElectionResultsView results={results} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANTS TAB (logic unchanged, UI redesigned)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantsTab({ isActive }: { isActive: boolean }) {
  const [pageants, setPageants]                       = useState<Pageant[]>([]);
  const [isPageantModalOpen, setIsPageantModalOpen]   = useState(false);
  const [editingPageant, setEditingPageant]           = useState<Pageant | null>(null);
  const [selectedPageant, setSelectedPageant]         = useState<Pageant | null>(null);
  const [isContestantsModalOpen, setIsContestantsModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen]   = useState(false);
  const [contestants, setContestants]                 = useState<Contestant[]>([]);
  const [editingContestant, setEditingContestant]     = useState<Contestant | null>(null);
  const [results, setResults]                         = useState<PageantResultsResponse>([]);
  const { showSuccess, showError }                    = useNotification();

  const fetchPageants = useCallback(async () => {
    const data = await getAllPageants(); setPageants(data);
  }, []);

  useEffect(() => { if (!isActive) return; void fetchPageants(); }, [isActive, fetchPageants]);

  const handleSavePageant = async (formData: PageantFormData) => {
    if (editingPageant) {
      const updated = await updatePageant(editingPageant.id, formData as Partial<Pageant>);
      if (!updated) { showError('Failed to update pageant'); return; }
      showSuccess('Pageant updated successfully');
    } else {
      await createPageant(formData, 'admin'); showSuccess('Pageant created successfully');
    }
    setIsPageantModalOpen(false); setEditingPageant(null); void fetchPageants();
  };

  const openContestantsModal = async (pageant: Pageant) => {
    setSelectedPageant(pageant); setIsContestantsModalOpen(true);
    try { const loaded = await getContestantsByPageant(pageant.id); setContestants(loaded); }
    catch { showError('Failed to load contestants'); }
  };

  const handleSaveContestant = async (formData: ContestantFormData) => {
    if (!selectedPageant) return;
    if (editingContestant) {
      const updated = await updateContestant(editingContestant.id, selectedPageant.id, {
        contestantNumber: formData.contestantNumber, firstName: formData.firstName,
        lastName: formData.lastName, gender: formData.gender, bio: formData.bio,
        age: formData.age, department: formData.department, photoUrl: formData.photoUrl, isActive: true,
      });
      if (!updated) { showError('Failed to update contestant'); return; }
      showSuccess('Contestant updated successfully');
    } else {
      await addContestant(selectedPageant.id, formData); showSuccess('Contestant added successfully');
    }
    const refreshed = await getContestantsByPageant(selectedPageant.id);
    setContestants(refreshed); setEditingContestant(null);
  };

  const handleDeleteContestant = async (contestant: Contestant) => {
    if (!selectedPageant) return;
    const ok = await removeContestant(contestant.id, selectedPageant.id);
    if (!ok) { showError('Failed to remove contestant'); return; }
    showSuccess('Contestant removed successfully');
    const refreshed = await getContestantsByPageant(selectedPageant.id);
    setContestants(refreshed);
  };

  const openResultsModal = async (pageant: Pageant) => {
    setSelectedPageant(pageant); setIsResultsModalOpen(true);
    try { const loaded = await getPageantResults(pageant.id); setResults(loaded); }
    catch { setResults([]); showError('Unable to load pageant results'); }
  };

  const handleStatusAction = async (pageant: Pageant, action: 'start' | 'complete' | 'publish') => {
    const response = action === 'start' ? await startPageant(pageant.id)
      : action === 'complete' ? await completePageant(pageant.id)
      : await publishPageantResults(pageant.id);
    if (!response) { showError('Failed to update pageant action'); return; }
    showSuccess(action === 'publish' ? 'Pageant results published' : `Pageant ${action} action completed`);
    void fetchPageants();
  };

  const handleDeletePageant = async (pageant: Pageant) => {
    if (!confirm(`Delete pageant "${pageant.name}"?`)) return;
    const ok = await deletePageant(pageant.id);
    if (!ok) { showError('Failed to delete pageant'); return; }
    showSuccess('Pageant deleted successfully'); void fetchPageants();
  };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Pageants"
        subtitle={`${pageants.length} total pageant${pageants.length !== 1 ? 's' : ''}`}
        action={
          <ActionBtn color="green" onClick={() => { setEditingPageant(null); setIsPageantModalOpen(true); }}>
            <Crown className="w-4 h-4" /> Create Pageant
          </ActionBtn>
        }
      />

      <DataTable
        headers={['Pageant', 'Status', 'Event Date', 'Results', 'Actions']}
        empty={pageants.length === 0}
      >
        {pageants.map((pageant) => (
          <tr key={pageant.id} className="hover:bg-gray-50/70 transition-colors">
            <td className="px-5 py-3.5">
              <p className="text-sm font-semibold text-gray-900">{pageant.name}</p>
              <p className="text-xs text-gray-400">{formatScoringMethod(pageant.scoringMethod)} scoring</p>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <StatusBadge status={pageant.status} />
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
              {formatDate(pageant.eventDate)}
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${pageant.resultsPublic ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                {pageant.resultsPublic ? 'Public' : 'Private'}
              </span>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => { setEditingPageant(pageant); setIsPageantModalOpen(true); }}>
                    <Edit className="w-4 h-4 mr-2" /> Edit Pageant
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void openContestantsModal(pageant)}>
                    <Users className="w-4 h-4 mr-2" /> Manage Contestants
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void openResultsModal(pageant)}>
                    <Eye className="w-4 h-4 mr-2" /> View Results
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleStatusAction(pageant, 'start')}>
                    <Play className="w-4 h-4 mr-2" /> Set Active
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleStatusAction(pageant, 'complete')}>
                    <CheckCircle className="w-4 h-4 mr-2" /> Set Completed
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleStatusAction(pageant, 'publish')}>
                    <Eye className="w-4 h-4 mr-2" /> Publish Results
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => void handleDeletePageant(pageant)}>
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        ))}
      </DataTable>

      <Dialog open={isPageantModalOpen} onOpenChange={setIsPageantModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">{editingPageant ? 'Edit Pageant' : 'Create Pageant'}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Admin has full control over pageant lifecycle settings.</DialogDescription>
          </DialogHeader>
          <PageantEditorForm pageant={editingPageant} onSubmit={handleSavePageant} onCancel={() => { setIsPageantModalOpen(false); setEditingPageant(null); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={isContestantsModalOpen} onOpenChange={setIsContestantsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Manage Contestants</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">{selectedPageant?.name}</DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <AdminContestantManager
              pageant={selectedPageant} contestants={contestants} editingContestant={editingContestant}
              onSave={handleSaveContestant} onEdit={setEditingContestant}
              onDelete={handleDeleteContestant} onCancelEdit={() => setEditingContestant(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Pageant Results</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">{selectedPageant?.name} — read-only snapshot</DialogDescription>
          </DialogHeader>
          <AdminPageantResultsView results={results} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTION EDITOR FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ElectionEditorForm({ election, onSubmit, onCancel }: {
  election: Election | null; onSubmit: (formData: ElectionFormData) => void; onCancel: () => void;
}) {
  const [formData, setFormData] = useState<ElectionFormData>({
    title: election?.title || '', description: election?.description || '',
    type: election?.type || 'student_government', startDate: election?.startDate || '',
    endDate: election?.endDate || '', allowWriteIns: election?.allowWriteIns || false,
    maxVotesPerVoter: election?.maxVotesPerVoter || 1, resultsPublic: election?.resultsPublic || false,
  });

  useEffect(() => {
    setFormData({
      title: election?.title || '', description: election?.description || '',
      type: election?.type || 'student_government', startDate: election?.startDate || '',
      endDate: election?.endDate || '', allowWriteIns: election?.allowWriteIns || false,
      maxVotesPerVoter: election?.maxVotesPerVoter || 1, resultsPublic: election?.resultsPublic || false,
    });
  }, [election]);

  return (
    <form className="space-y-4 pt-1" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <FormField label="Title">
        <Input id="election-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required className={formInputClass} />
      </FormField>
      <FormField label="Description">
        <Textarea id="election-description" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={formInputClass} />
      </FormField>
      <FormField label="Type">
        <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as ElectionFormData['type'] })}>
          <SelectTrigger className={formInputClass}><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="student_government">Student Government</SelectItem>
            <SelectItem value="fstlp_officers">FSTLP Officers</SelectItem>
            <SelectItem value="class_representative">Class Representative</SelectItem>
            <SelectItem value="club_officers">Club Officers</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Start Date">
          <Input id="election-start" type="datetime-local" value={formData.startDate.slice(0, 16)} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required className={formInputClass} />
        </FormField>
        <FormField label="End Date">
          <Input id="election-end" type="datetime-local" value={formData.endDate.slice(0, 16)} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required className={formInputClass} />
        </FormField>
      </div>
      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">
          {election ? 'Save Election' : 'Create Election'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANT EDITOR FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantEditorForm({ pageant, onSubmit, onCancel }: {
  pageant: Pageant | null; onSubmit: (formData: PageantFormData) => void; onCancel: () => void;
}) {
  const [formData, setFormData] = useState<PageantFormData>({
    name: pageant?.name || '', description: pageant?.description || '',
    eventDate: pageant?.eventDate || '', scoringMethod: pageant?.scoringMethod || 'weighted',
    totalWeight: pageant?.totalWeight || 100, resultsPublic: pageant?.resultsPublic || false,
  });

  useEffect(() => {
    setFormData({
      name: pageant?.name || '', description: pageant?.description || '',
      eventDate: pageant?.eventDate || '', scoringMethod: pageant?.scoringMethod || 'weighted',
      totalWeight: pageant?.totalWeight || 100, resultsPublic: pageant?.resultsPublic || false,
    });
  }, [pageant]);

  return (
    <form className="space-y-4 pt-1" onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }}>
      <FormField label="Name">
        <Input id="pageant-name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className={formInputClass} />
      </FormField>
      <FormField label="Description">
        <Textarea id="pageant-description" rows={3} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className={formInputClass} />
      </FormField>
      <FormField label="Event Date">
        <Input id="pageant-date" type="date" value={formData.eventDate.slice(0, 10)} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} required className={formInputClass} />
      </FormField>
      <FormField label="Scoring Method">
        <Select value={formData.scoringMethod} onValueChange={(value) => setFormData({ ...formData, scoringMethod: value as PageantFormData['scoringMethod'] })}>
          <SelectTrigger className={formInputClass}><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="average">Average</SelectItem>
            <SelectItem value="weighted">Weighted</SelectItem>
            <SelectItem value="ranking">Ranking</SelectItem>
            <SelectItem value="ranking_by_gender">Ranking by Gender</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">
          {pageant ? 'Save Pageant' : 'Create Pageant'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN CANDIDATE MANAGER (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function AdminCandidateManager({
  candidates, positions, editingCandidate, onSave, onEdit, onDelete, onCancelEdit,
}: {
  candidates: Candidate[]; positions: ElectionPosition[];
  editingCandidate: Candidate | null;
  onSave: (formData: CandidateFormData) => void;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
  onCancelEdit: () => void;
}) {
  const [formData, setFormData] = useState<CandidateFormData>({
    positionId: positions[0]?.id || '', displayName: '', bio: '', platform: '', photoUrl: '', isWriteIn: false,
  });

  useEffect(() => {
    if (!editingCandidate) {
      setFormData({ positionId: positions[0]?.id || '', displayName: '', bio: '', platform: '', photoUrl: '', isWriteIn: false });
      return;
    }
    setFormData({
      positionId: editingCandidate.positionId || '', displayName: editingCandidate.displayName,
      bio: editingCandidate.bio || '', platform: editingCandidate.platform || '',
      photoUrl: editingCandidate.photoUrl || '', isWriteIn: editingCandidate.isWriteIn,
    });
  }, [editingCandidate, positions]);

  return (
    <div className="space-y-5 pt-1">
      <form
        className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4"
        onSubmit={(e) => { e.preventDefault(); onSave(formData); }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-gray-900">{editingCandidate ? 'Edit Candidate' : 'Add Candidate'}</p>
          {editingCandidate && (
            <button type="button" onClick={onCancelEdit} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancel edit</button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Position">
            <Select value={formData.positionId} onValueChange={(value) => setFormData({ ...formData, positionId: value })}>
              <SelectTrigger className={formInputClass}><SelectValue placeholder="Select position" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {positions.map((position) => <SelectItem key={position.id} value={position.id}>{position.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Display Name">
            <Input value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} required className={formInputClass} />
          </FormField>
        </div>
        <FormField label="Bio">
          <Textarea rows={2} value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className={formInputClass} />
        </FormField>
        <FormField label="Platform">
          <Textarea rows={2} value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} className={formInputClass} />
        </FormField>
        <FormField label="Write-in Candidate">
          <Select value={String(formData.isWriteIn)} onValueChange={(value) => setFormData({ ...formData, isWriteIn: value === 'true' })}>
            <SelectTrigger className={formInputClass}><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" className="rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {editingCandidate ? 'Save Candidate' : 'Add Candidate'}
          </Button>
        </div>
      </form>

      <DataTable headers={['Candidate', 'Position', 'Status', 'Actions']} empty={candidates.length === 0}>
        {candidates.map((candidate) => (
          <tr key={candidate.id} className="hover:bg-gray-50/70">
            <td className="px-5 py-3 text-sm font-medium text-gray-900">{candidate.displayName}</td>
            <td className="px-5 py-3 text-sm text-gray-500">{candidate.position}</td>
            <td className="px-5 py-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${candidate.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                {candidate.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td className="px-5 py-3 text-right">
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors mr-1" onClick={() => onEdit(candidate)}>
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => onDelete(candidate)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN CONTESTANT MANAGER (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function AdminContestantManager({
  pageant, contestants, editingContestant, onSave, onEdit, onDelete, onCancelEdit,
}: {
  pageant: Pageant; contestants: Contestant[]; editingContestant: Contestant | null;
  onSave: (formData: ContestantFormData) => void; onEdit: (contestant: Contestant) => void;
  onDelete: (contestant: Contestant) => void; onCancelEdit: () => void;
}) {
  const [formData, setFormData] = useState<ContestantFormData>({
    contestantNumber: 1, firstName: '', lastName: '', gender: undefined,
    bio: '', age: undefined, department: '', photoUrl: '',
  });

  useEffect(() => {
    if (!editingContestant) {
      setFormData({ contestantNumber: Math.max(1, contestants.length + 1), firstName: '', lastName: '', gender: undefined, bio: '', age: undefined, department: '', photoUrl: '' });
      return;
    }
    setFormData({
      contestantNumber: editingContestant.contestantNumber, firstName: editingContestant.firstName,
      lastName: editingContestant.lastName, gender: editingContestant.gender ?? undefined,
      bio: editingContestant.bio || '', age: editingContestant.age, department: editingContestant.department || '', photoUrl: editingContestant.photoUrl || '',
    });
  }, [editingContestant, contestants.length]);

  const genderRequired = pageant.scoringMethod === 'ranking_by_gender';

  return (
    <div className="space-y-5 pt-1">
      <form
        className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-4"
        onSubmit={(e) => { e.preventDefault(); if (genderRequired && !formData.gender) return; onSave(formData); }}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-gray-900">{editingContestant ? 'Edit Contestant' : 'Add Contestant'}</p>
          {editingContestant && (
            <button type="button" onClick={onCancelEdit} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Cancel edit</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Contestant No.">
            <Input type="number" min={1} value={formData.contestantNumber} onChange={(e) => setFormData({ ...formData, contestantNumber: Number(e.target.value) })} required className={formInputClass} />
          </FormField>
          <FormField label="Age">
            <Input type="number" value={formData.age || ''} onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || undefined })} className={formInputClass} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="First Name">
            <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className={formInputClass} />
          </FormField>
          <FormField label="Last Name">
            <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className={formInputClass} />
          </FormField>
        </div>
        <FormField label="Department">
          <Input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className={formInputClass} />
        </FormField>
        {genderRequired && (
          <FormField label="Gender">
            <Select value={formData.gender} onValueChange={(value: 'Male' | 'Female') => setFormData({ ...formData, gender: value })}>
              <SelectTrigger className={formInputClass}><SelectValue placeholder="Select gender" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        )}
        <FormField label="Biography">
          <Textarea rows={2} value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} className={formInputClass} />
        </FormField>
        <div className="flex justify-end">
          <Button type="submit" className="rounded-xl bg-[#166534] hover:bg-[#14532d] text-white text-sm">
            <Plus className="w-4 h-4 mr-1.5" />
            {editingContestant ? 'Save Contestant' : 'Add Contestant'}
          </Button>
        </div>
      </form>

      <DataTable headers={['Contestant', 'No.', 'Gender', 'Actions']} empty={contestants.length === 0}>
        {contestants.map((contestant) => (
          <tr key={contestant.id} className="hover:bg-gray-50/70">
            <td className="px-5 py-3 text-sm font-medium text-gray-900">{contestant.firstName} {contestant.lastName}</td>
            <td className="px-5 py-3 text-sm text-gray-500">{contestant.contestantNumber}</td>
            <td className="px-5 py-3 text-sm text-gray-500">{contestant.gender || '—'}</td>
            <td className="px-5 py-3 text-right">
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors mr-1" onClick={() => onEdit(contestant)}>
                <Edit className="w-3.5 h-3.5" />
              </button>
              <button className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors" onClick={() => onDelete(contestant)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTION RESULTS VIEW (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function AdminElectionResultsView({ results }: { results: ElectionResult[] }) {
  if (results.length === 0) return <p className="text-sm text-gray-400 py-4">No result records available.</p>;

  return (
    <div className="space-y-4 pt-1">
      {results.map((positionResult) => (
        <div key={positionResult.position} className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
            <p className="font-extrabold text-gray-900 text-sm">{positionResult.position}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total votes: {positionResult.totalVotes}</p>
          </div>
          <table className="min-w-full divide-y divide-gray-50">
            <thead>
              <tr>
                <th className="px-5 py-2 text-left text-xs font-bold text-gray-500 uppercase">Candidate</th>
                <th className="px-5 py-2 text-right text-xs font-bold text-gray-500 uppercase">Votes</th>
                <th className="px-5 py-2 text-right text-xs font-bold text-gray-500 uppercase">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {positionResult.candidates.map((candidate) => (
                <tr key={candidate.candidateId} className="hover:bg-gray-50/70">
                  <td className="px-5 py-2.5 text-sm text-gray-900">{candidate.displayName}</td>
                  <td className="px-5 py-2.5 text-sm text-right text-gray-600">{candidate.voteCount}</td>
                  <td className="px-5 py-2.5 text-sm text-right text-gray-600">{candidate.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANT RESULTS VIEW (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function AdminPageantResultsView({ results }: { results: PageantResultsResponse }) {
  if (Array.isArray(results)) {
    if (results.length === 0) return <p className="text-sm text-gray-400 py-4">No result records available.</p>;

    return (
      <div className="rounded-2xl border border-gray-100 overflow-hidden pt-1">
        <table className="min-w-full divide-y divide-gray-50">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-2 text-left text-xs font-bold text-gray-500 uppercase">Rank</th>
              <th className="px-5 py-2 text-left text-xs font-bold text-gray-500 uppercase">Contestant</th>
              <th className="px-5 py-2 text-right text-xs font-bold text-gray-500 uppercase">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {results.map((result) => (
              <tr key={result.contestantId} className="hover:bg-gray-50/70">
                <td className="px-5 py-2.5 text-sm font-semibold text-gray-900">#{result.rank}</td>
                <td className="px-5 py-2.5 text-sm text-gray-900">{result.contestantName}</td>
                <td className="px-5 py-2.5 text-sm text-right text-gray-600">
                  {result.scoringMode === 'AVERAGE' ? `${(result.finalScore ?? result.totalScore).toFixed(2)} / 10`
                    : result.scoringMode === 'RANKING' ? `${(result.rankScore ?? result.totalScore).toFixed(2)} rank`
                    : `${(result.finalPercentage ?? result.weightedScore).toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-medium">
        🏆 Male Winner: <strong>{results.maleWinner?.contestantName || 'N/A'}</strong>
        &nbsp;·&nbsp;
        Female Winner: <strong>{results.femaleWinner?.contestantName || 'N/A'}</strong>
      </div>
      {[
        { label: 'Male Division', data: results.maleResults },
        { label: 'Female Division', data: results.femaleResults },
      ].map(({ label, data }) => (
        <div key={label} className="rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-2.5 bg-gray-50 border-b border-gray-100">
            <p className="text-sm font-extrabold text-gray-900">{label}</p>
          </div>
          <table className="min-w-full divide-y divide-gray-50">
            <thead>
              <tr>
                <th className="px-5 py-2 text-left text-xs font-bold text-gray-500 uppercase">Rank</th>
                <th className="px-5 py-2 text-left text-xs font-bold text-gray-500 uppercase">Contestant</th>
                <th className="px-5 py-2 text-right text-xs font-bold text-gray-500 uppercase">Avg Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data.map((result) => (
                <tr key={result.contestantId} className="hover:bg-gray-50/70">
                  <td className="px-5 py-2.5 text-sm font-semibold text-gray-900">#{result.rank}</td>
                  <td className="px-5 py-2.5 text-sm text-gray-900">{result.contestantName}</td>
                  <td className="px-5 py-2.5 text-sm text-right text-gray-600">{(result.rankScore ?? result.totalScore).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    getAllAuditLogs().then(all => setLogs(all.slice(0, 100)));
  }, []);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Audit Logs"
        subtitle="Last 100 system events"
        action={
          <ActionBtn color="outline">
            <FileText className="w-4 h-4" /> Export
          </ActionBtn>
        }
      />

      <DataTable headers={['Timestamp', 'Action', 'Entity', 'User']} empty={logs.length === 0}>
        {logs.map((log) => (
          <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
            <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
              {formatDateTime(log.createdAt)}
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 bg-gray-50">
                {log.action}
              </span>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
              {log.entityType}{log.entityId && ` · ${log.entityId.slice(-6)}`}
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
              {log.userName || 'System'}
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}
