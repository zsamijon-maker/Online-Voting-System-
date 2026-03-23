import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users,
  Vote,
  Crown,
  TrendingUp,
  UserPlus,
  FileText,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  LogOut,
  Menu,
  X,
  Activity,
  Eye,
  Plus,
  CheckCircle,
  Play,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getAllUsers, createUser, updateUser, deleteUser, setUserActive, assignRole, removeRole, getUserStatistics } from '@/services/userService';
import {
  getAllElections,
  createElection,
  updateElection,
  deleteElection,
  openElection,
  closeElection,
  publishResults,
  getElectionResults,
  getCandidatesByElection,
  getElectionPositions,
  addCandidate,
  updateCandidate,
  removeCandidate,
} from '@/services/electionService';
import {
  getAllPageants,
  createPageant,
  updatePageant,
  deletePageant,
  startPageant,
  completePageant,
  publishPageantResults,
  getPageantResults,
  getContestantsByPageant,
  addContestant,
  updateContestant,
  removeContestant,
} from '@/services/pageantService';
import { getAllAuditLogs, getAuditStatistics } from '@/services/auditService';
import type {
  User,
  UserRole,
  Election,
  Pageant,
  AuditLog,
  ElectionFormData,
  PageantFormData,
  Candidate,
  ElectionPosition,
  CandidateFormData,
  ElectionResult,
  Contestant,
  ContestantFormData,
  PageantResultsResponse,
} from '@/types';
import { formatDate, formatDateTime, formatRoleName, formatScoringMethod } from '@/utils/formatters';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface DashboardStats {
  totalUsers: number;
  activeElections: number;
  totalElections: number;
  totalVotes: number;
  upcomingPageants: number;
  activePageants: number;
  usersByRole: Record<string, number>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeElections: 0,
    totalElections: 0,
    totalVotes: 0,
    upcomingPageants: 0,
    activePageants: 0,
    usersByRole: {},
  });
  const [recentAuditLogs, setRecentAuditLogs] = useState<AuditLog[]>([]);

  const fetchStats = useCallback(async () => {
    const [userStatsResult, electionsResult, pageantsResult, auditStatsResult, auditLogsResult] = await Promise.allSettled([
      getUserStatistics(),
      getAllElections(),
      getAllPageants(),
      getAuditStatistics(),
      getAllAuditLogs(),
    ]);

    const userStats = userStatsResult.status === 'fulfilled'
      ? userStatsResult.value
      : {
          totalUsers: 0,
          activeUsers: 0,
          inactiveUsers: 0,
          usersByRole: {},
          newUsersThisMonth: 0,
        };

    const elections = electionsResult.status === 'fulfilled' ? electionsResult.value : [];
    const pageants = pageantsResult.status === 'fulfilled' ? pageantsResult.value : [];
    const auditStats = auditStatsResult.status === 'fulfilled'
      ? auditStatsResult.value
      : {
          totalLogs: 0,
          logsToday: 0,
          logsThisWeek: 0,
          logsThisMonth: 0,
          actionCounts: {},
          entityTypeCounts: {},
        };
    const auditLogs = auditLogsResult.status === 'fulfilled' ? auditLogsResult.value : [];

    if (userStatsResult.status === 'rejected') {
      showError('Failed to load user statistics. Please refresh the page.');
    }

    const electionPageantLogs = auditLogs.filter(
      (log) => log.entityType === 'election' || log.entityType === 'pageant'
    );

    setRecentAuditLogs(electionPageantLogs.slice(0, 8));
    setStats({
      totalUsers: userStats.totalUsers,
      activeElections: elections.filter(e => e.status === 'active').length,
      totalElections: elections.length,
      totalVotes: auditStats.actionCounts['vote_cast'] || 0,
      upcomingPageants: pageants.filter(p => p.status === 'upcoming').length,
      activePageants: pageants.filter(p => p.status === 'active').length,
      usersByRole: userStats.usersByRole,
    });
  }, [showError]);

  // Fetch stats on mount
  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchStats();
    });
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'overview') {
      Promise.resolve().then(() => {
        void fetchStats();
      });
    }
  }, [activeTab, fetchStats]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] overflow-x-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          setIsMobileNavOpen(false);
        }}
        className="min-h-screen"
      >
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-[#1E3A8A]/20 bg-white px-4 py-3 md:hidden">
          <p className="text-sm font-semibold text-[#1E3A8A]">Admin Panel</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {isMobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        <aside className={`fixed inset-y-0 left-0 z-50 w-[85vw] max-w-[300px] overflow-x-hidden border-r border-[#1E3A8A]/20 bg-white transition-transform duration-200 md:fixed md:top-0 md:h-screen md:w-64 md:max-w-none md:translate-x-0 md:border-b-0 md:flex md:flex-col ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="px-4 py-5 border-b border-[#1E3A8A]/15">
            <h2 className="text-lg font-bold text-[#1E3A8A]">Admin Panel</h2>
            <p className="text-xs text-gray-500 mt-1">Navigation</p>
          </div>

          <div className="p-3 overflow-x-hidden overflow-y-auto md:flex-1">
            <TabsList className="h-auto w-full min-w-0 bg-transparent p-0 flex flex-col items-stretch justify-start gap-2 overflow-x-hidden md:flex-col md:overflow-visible">
              <TabsTrigger
                value="overview"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <TrendingUp className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Users className="w-4 h-4" />
                User Management
              </TabsTrigger>
              <TabsTrigger
                value="elections"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Vote className="w-4 h-4" />
                Elections
              </TabsTrigger>
              <TabsTrigger
                value="pageants"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Crown className="w-4 h-4" />
                Pageants
              </TabsTrigger>
              <TabsTrigger
                value="audit"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <FileText className="w-4 h-4" />
                Audit Logs
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="p-3 border-t border-[#1E3A8A]/15">
            <Button
              variant="outline"
              className="w-full justify-start border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
              onClick={() => {
                setIsLogoutDialogOpen(true);
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </aside>

        <main className="min-w-0 md:ml-64">
          <header className="bg-[#1E3A8A] border-b border-[#162d6b]">
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <h1 className="text-xl font-bold text-white sm:text-2xl">Admin Dashboard</h1>
                  <p className="text-sm text-blue-200 mt-1">
                    Welcome back, {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <Badge className="w-fit bg-white/20 text-white border border-white/30">
                  <Shield className="w-3 h-3 mr-1" />
                  Administrator
                </Badge>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
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

      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Logout Confirmation</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="touch-footer">
            <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => setIsLogoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="touch-target w-full bg-red-600 text-white hover:bg-red-700 sm:w-auto"
              onClick={() => {
                void handleLogout();
              }}
            >
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================
function OverviewTab({
  stats,
  recentLogs,
  onNavigate,
}: {
  stats: DashboardStats;
  recentLogs: AuditLog[];
  onNavigate: (tab: string) => void;
}) {
  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, colorClass: 'bg-blue-100 text-blue-600' },
    { label: 'Active Elections', value: stats.activeElections, icon: Vote, colorClass: 'bg-green-100 text-green-600' },
    { label: 'Total Elections', value: stats.totalElections, icon: TrendingUp, colorClass: 'bg-indigo-100 text-indigo-600' },
    { label: 'Votes Cast', value: stats.totalVotes, icon: UserCheck, colorClass: 'bg-purple-100 text-purple-600' },
    { label: 'Active Pageants', value: stats.activePageants, icon: Crown, colorClass: 'bg-amber-100 text-amber-600' },
    { label: 'Upcoming Pageants', value: stats.upcomingPageants, icon: Activity, colorClass: 'bg-orange-100 text-orange-600' },
  ];

  const roleColors: Record<string, string> = {
    admin: 'bg-red-100 text-red-800',
    voter: 'bg-blue-100 text-blue-800',
    election_committee: 'bg-green-100 text-green-800',
    pageant_committee: 'bg-purple-100 text-purple-800',
    judge: 'bg-yellow-100 text-yellow-800',
  };

  const roleChartData = Object.entries(stats.usersByRole)
    .filter(([role]) => role !== 'admin')
    .map(([role, count]) => ({
      role: formatRoleName(role),
      count,
    }));

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${card.colorClass}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Role Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Users by Role (Chart)</h3>
          {roleChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={roleChartData} margin={{ top: 4, right: 8, left: -20, bottom: 60 }}>
                <XAxis
                  dataKey="role"
                  tick={{ fontSize: 11 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No data available yet.</p>
          )}
        </div>

        {/* Role Breakdown badges */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Role Breakdown</h3>
          {Object.entries(stats.usersByRole).length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.usersByRole).map(([role, count]) => (
                <div key={role} className={`px-4 py-2 rounded-lg ${roleColors[role] || 'bg-gray-100 text-gray-800'}`}>
                  <span className="font-medium">{formatRoleName(role)}</span>
                  <span className="ml-2 font-bold">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No users found.</p>
          )}
        </div>
      </div>

      {/* Recent Election/Pageant Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Recent Election & Pageant Activity</h3>
        {recentLogs.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {recentLogs.map((log) => (
              <li key={log.id} className="py-2 flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1E3A8A]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 capitalize">{log.action.replace(/_/g, ' ')}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                      {log.entityType}
                    </Badge>
                    {typeof (log.newValues as { status?: unknown } | undefined)?.status === 'string' && (
                      <Badge className="bg-blue-100 text-blue-800 text-[10px]">
                        Status: {(log.newValues as { status: string }).status}
                      </Badge>
                    )}
                  </div>
                  {log.userName && <p className="text-xs text-gray-500">by {log.userName}</p>}
                  <p className="text-xs text-gray-400">{formatDateTime(log.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No recent activity.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Quick Actions</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="touch-target w-full rounded-md bg-[#1E3A8A] font-medium hover:bg-[#162d6b] sm:w-auto"
            onClick={() => onNavigate('users')}
          >
            <Users className="w-4 h-4 mr-2" />
            Manage Users
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('elections')}>
            <Vote className="w-4 h-4 mr-2" />
            View Elections
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('pageants')}>
            <Crown className="w-4 h-4 mr-2" />
            View Pageants
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('audit')}>
            <FileText className="w-4 h-4 mr-2" />
            Audit Logs
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// USER MANAGEMENT TAB
// ============================================
function UserManagementTab({ onUpdate }: { onUpdate: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { showSuccess, showError } = useNotification();

  // Per-section search state
  const [searchEC, setSearchEC] = useState('');
  const [searchPC, setSearchPC] = useState('');
  const [searchVoter, setSearchVoter] = useState('');
  const [searchJudge, setSearchJudge] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const allUsers = await getAllUsers();
      // Exclude admin users from the UI display
      setUsers(allUsers.filter((u) => !u.roles.includes('admin')));
    } catch (error) {
      showError((error as Error).message || 'Failed to load users');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [showError]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchUsers();
    });
  }, [fetchUsers]);

  const handleCreateUser = async (userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    studentId?: string;
    roles: UserRole[];
  }) => {
    const result = await createUser(userData);
    if (result.success) {
      showSuccess('User created successfully');
      setIsCreateModalOpen(false);
      void fetchUsers();
      void onUpdate();
    } else {
      showError(result.error || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (id: string, updates: Partial<User>) => {
    const result = await updateUser(id, updates);
    if (result.success) {
      showSuccess('User updated successfully');
      setEditingUser(null);
      void fetchUsers();
      void onUpdate();
    } else {
      showError(result.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      const result = await deleteUser(id);
      if (result.success) {
        showSuccess('User deleted successfully');
        void fetchUsers();
        void onUpdate();
      } else {
        showError(result.error || 'Failed to delete user');
      }
    }
  };

  const handleToggleActive = async (user: User) => {
    const result = await setUserActive(user.id, !user.isActive);
    if (result.success) {
      showSuccess(`User ${user.isActive ? 'deactivated' : 'activated'} successfully`);
      void fetchUsers();
      void onUpdate();
    } else {
      showError(result.error || 'Failed to update user');
    }
  };

  const handleAssignRole = async (userId: string, role: UserRole) => {
    const result = await assignRole(userId, role);
    if (result.success) {
      showSuccess('Role assigned successfully');
      void fetchUsers();
      void onUpdate();
    } else {
      showError(result.error || 'Failed to assign role');
    }
  };

  const handleRemoveRole = async (userId: string, role: UserRole) => {
    const result = await removeRole(userId, role);
    if (result.success) {
      showSuccess('Role removed successfully');
      void fetchUsers();
      void onUpdate();
    } else {
      showError(result.error || 'Failed to remove role');
    }
  };

  // Client-side filtering per section
  const filterByQuery = (list: User[], query: string) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (u) =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.studentId && u.studentId.toLowerCase().includes(q))
    );
  };

  const ecAll = users.filter((u) => u.roles.includes('election_committee'));
  const pcAll = users.filter((u) => u.roles.includes('pageant_committee'));
  const voterAll = users.filter((u) => u.roles.includes('voter'));
  const judgeAll = users.filter((u) => u.roles.includes('judge'));

  const sections: {
    title: string;
    role: UserRole;
    all: User[];
    filtered: User[];
    search: string;
    setSearch: (v: string) => void;
  }[] = [
    { title: 'Election Committee', role: 'election_committee', all: ecAll, filtered: filterByQuery(ecAll, searchEC), search: searchEC, setSearch: setSearchEC },
    { title: 'Pageant Committee', role: 'pageant_committee', all: pcAll, filtered: filterByQuery(pcAll, searchPC), search: searchPC, setSearch: setSearchPC },
    { title: 'Voters', role: 'voter', all: voterAll, filtered: filterByQuery(voterAll, searchVoter), search: searchVoter, setSearch: setSearchVoter },
    { title: 'Judges', role: 'judge', all: judgeAll, filtered: filterByQuery(judgeAll, searchJudge), search: searchJudge, setSearch: setSearchJudge },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1E3A8A]">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage all system users by role</p>
        </div>
        <Button className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto" onClick={() => setIsCreateModalOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      {isLoadingUsers && (
        <div className="text-sm text-gray-500 py-2">Loading users...</div>
      )}

      {/* Role sections */}
      {sections.map(({ title, role, all, filtered, search, setSearch }) => (
        <div key={role} className="space-y-3">
          {/* Section header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#1E3A8A]">{title}</h3>
              <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs">
                {all.length} {all.length === 1 ? 'user' : 'users'}
              </Badge>
            </div>
            <div className="relative flex w-full items-center sm:w-auto">
              <Search className="absolute left-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <Input
                className="h-11 w-full text-sm pl-8 sm:h-8 sm:w-52"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-[#1E3A8A]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400">
                      {search.trim()
                        ? 'No users match your search.'
                        : `No ${title.toLowerCase()} users found.`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white font-medium">
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-sm text-gray-500">{u.email}</div>
                            {u.studentId && (
                              <div className="text-xs text-gray-400">ID: {u.studentId}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          {u.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-xs">
                              {formatRoleName(r)}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(u.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="touch-target-compact">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingUser(u)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleActive(u)}>
                              {u.isActive ? (
                                <>
                                  <UserX className="w-4 h-4 mr-2" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-4 h-4 mr-2" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(u.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system.
            </DialogDescription>
          </DialogHeader>
          <CreateUserForm
            onSubmit={handleCreateUser}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information.
            </DialogDescription>
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

// ============================================
// CREATE USER FORM
// ============================================
function CreateUserForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    studentId?: string;
    roles: UserRole[];
  }) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'election_committee' as UserRole,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      email: formData.email,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
      roles: [formData.role],
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="firstName">First Name</Label>
          <Input
            id="firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="lastName">Last Name</Label>
          <Input
            id="lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          required
          minLength={8}
          placeholder="Minimum 8 characters"
        />
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="voter">Voter</SelectItem>
            <SelectItem value="election_committee">Election Committee</SelectItem>
            <SelectItem value="pageant_committee">Pageant Committee</SelectItem>
            <SelectItem value="judge">Judge</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
          Create User
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// EDIT USER FORM
// ============================================
function EditUserForm({
  user,
  onSubmit,
  onCancel,
  onAssignRole,
  onRemoveRole,
}: {
  user: User;
  onSubmit: (updates: Partial<User>) => void;
  onCancel: () => void;
  onAssignRole: (role: UserRole) => void;
  onRemoveRole: (role: UserRole) => void;
}) {
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    studentId: user.studentId || '',
  });

  const availableRoles: UserRole[] = ['voter', 'election_committee', 'pageant_committee', 'judge'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="edit-firstName">First Name</Label>
          <Input
            id="edit-firstName"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="edit-lastName">Last Name</Label>
          <Input
            id="edit-lastName"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <Label htmlFor="edit-email">Email</Label>
        <Input
          id="edit-email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="edit-studentId">Student ID</Label>
        <Input
          id="edit-studentId"
          value={formData.studentId}
          onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
        />
      </div>

      {/* Role Management */}
      <div>
        <Label>Roles</Label>
        <div className="mt-2 space-y-2">
          {user.roles.map((role) => (
            <div key={role} className="flex items-center justify-between rounded bg-gray-50 p-2">
              <span className="text-sm">{formatRoleName(role)}</span>
              {user.roles.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="touch-target-compact"
                  onClick={() => onRemoveRole(role)}
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2">
          <Select onValueChange={(value) => onAssignRole(value as UserRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Add role..." />
            </SelectTrigger>
            <SelectContent>
              {availableRoles
                .filter((role) => !user.roles.includes(role))
                .map((role) => (
                  <SelectItem key={role} value={role}>
                    {formatRoleName(role)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// ELECTIONS TAB
// ============================================
function ElectionsTab({ isActive }: { isActive: boolean }) {
  const [elections, setElections] = useState<Election[]>([]);
  const [isElectionModalOpen, setIsElectionModalOpen] = useState(false);
  const [editingElection, setEditingElection] = useState<Election | null>(null);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [isCandidatesModalOpen, setIsCandidatesModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [positions, setPositions] = useState<ElectionPosition[]>([]);
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const { showSuccess, showError } = useNotification();

  const fetchElections = useCallback(async () => {
    const data = await getAllElections();
    setElections(data);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchElections();
  }, [isActive, fetchElections]);

  const handleSaveElection = async (formData: ElectionFormData) => {
    if (editingElection) {
      const updated = await updateElection(editingElection.id, formData as Partial<Election>);
      if (!updated) {
        showError('Failed to update election');
        return;
      }
      showSuccess('Election updated successfully');
    } else {
      await createElection(formData, 'admin');
      showSuccess('Election created successfully');
    }

    setIsElectionModalOpen(false);
    setEditingElection(null);
    void fetchElections();
  };

  const openCandidatesModal = async (election: Election) => {
    setSelectedElection(election);
    setIsCandidatesModalOpen(true);
    try {
      const [loadedCandidates, loadedPositions] = await Promise.all([
        getCandidatesByElection(election.id),
        getElectionPositions(election.id),
      ]);
      setCandidates(loadedCandidates);
      setPositions(loadedPositions);
    } catch {
      showError('Failed to load candidates');
    }
  };

  const handleSaveCandidate = async (formData: CandidateFormData) => {
    if (!selectedElection) return;

    if (editingCandidate) {
      const updated = await updateCandidate(editingCandidate.id, selectedElection.id, {
        positionId: formData.positionId,
        displayName: formData.displayName,
        bio: formData.bio,
        platform: formData.platform,
        isWriteIn: formData.isWriteIn,
      });

      if (!updated) {
        showError('Failed to update candidate');
        return;
      }

      showSuccess('Candidate updated successfully');
    } else {
      await addCandidate(selectedElection.id, formData);
      showSuccess('Candidate added successfully');
    }

    const refreshed = await getCandidatesByElection(selectedElection.id);
    setCandidates(refreshed);
    setEditingCandidate(null);
  };

  const handleDeleteCandidate = async (candidate: Candidate) => {
    if (!selectedElection) return;
    const ok = await removeCandidate(candidate.id, selectedElection.id);
    if (!ok) {
      showError('Failed to remove candidate');
      return;
    }
    showSuccess('Candidate removed successfully');
    const refreshed = await getCandidatesByElection(selectedElection.id);
    setCandidates(refreshed);
  };

  const openResultsModal = async (election: Election) => {
    setSelectedElection(election);
    setIsResultsModalOpen(true);
    try {
      const loaded = await getElectionResults(election.id);
      setResults(loaded);
    } catch {
      setResults([]);
      showError('Unable to load election results');
    }
  };

  const handleStatusAction = async (election: Election, action: 'open' | 'close' | 'publish') => {
    const response =
      action === 'open'
        ? await openElection(election.id)
        : action === 'close'
        ? await closeElection(election.id)
        : await publishResults(election.id);

    if (!response) {
      showError('Failed to update election action');
      return;
    }

    showSuccess(action === 'publish' ? 'Election results published' : `Election ${action} action completed`);
    void fetchElections();
  };

  const handleDeleteElection = async (election: Election) => {
    if (!confirm(`Delete election "${election.title}"?`)) return;
    const ok = await deleteElection(election.id);
    if (!ok) {
      showError('Failed to delete election');
      return;
    }
    showSuccess('Election deleted successfully');
    void fetchElections();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">All Elections</h3>
        <Button
          className="bg-[#2E7D32] hover:bg-[#1B5E20] rounded-md font-medium"
          onClick={() => {
            setEditingElection(null);
            setIsElectionModalOpen(true);
          }}
        >
          <Vote className="w-4 h-4 mr-2" />
          Create Election
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#1E3A8A]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Election
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Dates
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Results
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {elections.map((election) => (
              <tr key={election.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{election.title}</div>
                  <div className="text-sm text-gray-500">{election.type}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge
                    className={
                      election.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : election.status === 'closed'
                        ? 'bg-gray-100 text-gray-800'
                        : election.status === 'upcoming'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {election.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(election.startDate)} - {formatDate(election.endDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge
                    className={
                      election.resultsPublic
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {election.resultsPublic ? 'Public' : 'Private'}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="touch-target-compact">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingElection(election);
                          setIsElectionModalOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Election
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openCandidatesModal(election)}>
                        <Users className="w-4 h-4 mr-2" />
                        Manage Candidates
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openResultsModal(election)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Results (Read-only)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleStatusAction(election, 'open')}>
                        <Play className="w-4 h-4 mr-2" />
                        Set Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleStatusAction(election, 'close')}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Set Closed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleStatusAction(election, 'publish')}>
                        <Eye className="w-4 h-4 mr-2" />
                        Publish Results
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => void handleDeleteElection(election)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Election
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isElectionModalOpen} onOpenChange={setIsElectionModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingElection ? 'Edit Election' : 'Create Election'}</DialogTitle>
            <DialogDescription>
              Admin has full control over election lifecycle settings.
            </DialogDescription>
          </DialogHeader>
          <ElectionEditorForm
            election={editingElection}
            onSubmit={handleSaveElection}
            onCancel={() => {
              setIsElectionModalOpen(false);
              setEditingElection(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isCandidatesModalOpen} onOpenChange={setIsCandidatesModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Candidates</DialogTitle>
            <DialogDescription>
              {selectedElection ? `Election: ${selectedElection.title}` : 'Manage election candidates'}
            </DialogDescription>
          </DialogHeader>

          {selectedElection && (
            <AdminCandidateManager
              candidates={candidates}
              positions={positions}
              editingCandidate={editingCandidate}
              onSave={handleSaveCandidate}
              onEdit={setEditingCandidate}
              onDelete={handleDeleteCandidate}
              onCancelEdit={() => setEditingCandidate(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Election Results (Read-only)</DialogTitle>
            <DialogDescription>
              {selectedElection ? selectedElection.title : 'Election'} results snapshot.
            </DialogDescription>
          </DialogHeader>
          <AdminElectionResultsView results={results} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// PAGEANTS TAB
// ============================================
function PageantsTab({ isActive }: { isActive: boolean }) {
  const [pageants, setPageants] = useState<Pageant[]>([]);
  const [isPageantModalOpen, setIsPageantModalOpen] = useState(false);
  const [editingPageant, setEditingPageant] = useState<Pageant | null>(null);
  const [selectedPageant, setSelectedPageant] = useState<Pageant | null>(null);
  const [isContestantsModalOpen, setIsContestantsModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [editingContestant, setEditingContestant] = useState<Contestant | null>(null);
  const [results, setResults] = useState<PageantResultsResponse>([]);
  const { showSuccess, showError } = useNotification();

  const fetchPageants = useCallback(async () => {
    const data = await getAllPageants();
    setPageants(data);
  }, []);

  useEffect(() => {
    if (!isActive) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchPageants();
  }, [isActive, fetchPageants]);

  const handleSavePageant = async (formData: PageantFormData) => {
    if (editingPageant) {
      const updated = await updatePageant(editingPageant.id, formData as Partial<Pageant>);
      if (!updated) {
        showError('Failed to update pageant');
        return;
      }
      showSuccess('Pageant updated successfully');
    } else {
      await createPageant(formData, 'admin');
      showSuccess('Pageant created successfully');
    }

    setIsPageantModalOpen(false);
    setEditingPageant(null);
    void fetchPageants();
  };

  const openContestantsModal = async (pageant: Pageant) => {
    setSelectedPageant(pageant);
    setIsContestantsModalOpen(true);
    try {
      const loaded = await getContestantsByPageant(pageant.id);
      setContestants(loaded);
    } catch {
      showError('Failed to load contestants');
    }
  };

  const handleSaveContestant = async (formData: ContestantFormData) => {
    if (!selectedPageant) return;

    if (editingContestant) {
      const updated = await updateContestant(editingContestant.id, selectedPageant.id, {
        contestantNumber: formData.contestantNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        gender: formData.gender,
        bio: formData.bio,
        age: formData.age,
        department: formData.department,
        photoUrl: formData.photoUrl,
        isActive: true,
      });
      if (!updated) {
        showError('Failed to update contestant');
        return;
      }
      showSuccess('Contestant updated successfully');
    } else {
      await addContestant(selectedPageant.id, formData);
      showSuccess('Contestant added successfully');
    }

    const refreshed = await getContestantsByPageant(selectedPageant.id);
    setContestants(refreshed);
    setEditingContestant(null);
  };

  const handleDeleteContestant = async (contestant: Contestant) => {
    if (!selectedPageant) return;
    const ok = await removeContestant(contestant.id, selectedPageant.id);
    if (!ok) {
      showError('Failed to remove contestant');
      return;
    }
    showSuccess('Contestant removed successfully');
    const refreshed = await getContestantsByPageant(selectedPageant.id);
    setContestants(refreshed);
  };

  const openResultsModal = async (pageant: Pageant) => {
    setSelectedPageant(pageant);
    setIsResultsModalOpen(true);
    try {
      const loaded = await getPageantResults(pageant.id);
      setResults(loaded);
    } catch {
      setResults([]);
      showError('Unable to load pageant results');
    }
  };

  const handleStatusAction = async (pageant: Pageant, action: 'start' | 'complete' | 'publish') => {
    const response =
      action === 'start'
        ? await startPageant(pageant.id)
        : action === 'complete'
        ? await completePageant(pageant.id)
        : await publishPageantResults(pageant.id);

    if (!response) {
      showError('Failed to update pageant action');
      return;
    }

    showSuccess(action === 'publish' ? 'Pageant results published' : `Pageant ${action} action completed`);
    void fetchPageants();
  };

  const handleDeletePageant = async (pageant: Pageant) => {
    if (!confirm(`Delete pageant "${pageant.name}"?`)) return;
    const ok = await deletePageant(pageant.id);
    if (!ok) {
      showError('Failed to delete pageant');
      return;
    }
    showSuccess('Pageant deleted successfully');
    void fetchPageants();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">All Pageants</h3>
        <Button
          className="bg-[#2E7D32] hover:bg-[#1B5E20] rounded-md font-medium"
          onClick={() => {
            setEditingPageant(null);
            setIsPageantModalOpen(true);
          }}
        >
          <Crown className="w-4 h-4 mr-2" />
          Create Pageant
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#1E3A8A]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Pageant
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Event Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Results
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pageants.map((pageant) => (
              <tr key={pageant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{pageant.name}</div>
                  <div className="text-sm text-gray-500">{formatScoringMethod(pageant.scoringMethod)} scoring</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge
                    className={
                      pageant.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : pageant.status === 'completed'
                        ? 'bg-gray-100 text-gray-800'
                        : pageant.status === 'upcoming'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {pageant.status}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(pageant.eventDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge
                    className={
                      pageant.resultsPublic
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }
                  >
                    {pageant.resultsPublic ? 'Public' : 'Private'}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="touch-target-compact">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingPageant(pageant);
                          setIsPageantModalOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Pageant
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openContestantsModal(pageant)}>
                        <Users className="w-4 h-4 mr-2" />
                        Manage Contestants
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void openResultsModal(pageant)}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Results (Read-only)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleStatusAction(pageant, 'start')}>
                        <Play className="w-4 h-4 mr-2" />
                        Set Active
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleStatusAction(pageant, 'complete')}>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Set Completed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => void handleStatusAction(pageant, 'publish')}>
                        <Eye className="w-4 h-4 mr-2" />
                        Publish Results
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => void handleDeletePageant(pageant)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Pageant
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={isPageantModalOpen} onOpenChange={setIsPageantModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPageant ? 'Edit Pageant' : 'Create Pageant'}</DialogTitle>
            <DialogDescription>
              Admin has full control over pageant lifecycle settings.
            </DialogDescription>
          </DialogHeader>
          <PageantEditorForm
            pageant={editingPageant}
            onSubmit={handleSavePageant}
            onCancel={() => {
              setIsPageantModalOpen(false);
              setEditingPageant(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isContestantsModalOpen} onOpenChange={setIsContestantsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Contestants</DialogTitle>
            <DialogDescription>
              {selectedPageant ? `Pageant: ${selectedPageant.name}` : 'Manage pageant contestants'}
            </DialogDescription>
          </DialogHeader>

          {selectedPageant && (
            <AdminContestantManager
              pageant={selectedPageant}
              contestants={contestants}
              editingContestant={editingContestant}
              onSave={handleSaveContestant}
              onEdit={setEditingContestant}
              onDelete={handleDeleteContestant}
              onCancelEdit={() => setEditingContestant(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pageant Results (Read-only)</DialogTitle>
            <DialogDescription>
              {selectedPageant ? selectedPageant.name : 'Pageant'} results snapshot.
            </DialogDescription>
          </DialogHeader>
          <AdminPageantResultsView results={results} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ElectionEditorForm({
  election,
  onSubmit,
  onCancel,
}: {
  election: Election | null;
  onSubmit: (formData: ElectionFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<ElectionFormData>({
    title: election?.title || '',
    description: election?.description || '',
    type: election?.type || 'student_government',
    startDate: election?.startDate || '',
    endDate: election?.endDate || '',
    allowWriteIns: election?.allowWriteIns || false,
    maxVotesPerVoter: election?.maxVotesPerVoter || 1,
    resultsPublic: election?.resultsPublic || false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      title: election?.title || '',
      description: election?.description || '',
      type: election?.type || 'student_government',
      startDate: election?.startDate || '',
      endDate: election?.endDate || '',
      allowWriteIns: election?.allowWriteIns || false,
      maxVotesPerVoter: election?.maxVotesPerVoter || 1,
      resultsPublic: election?.resultsPublic || false,
    });
  }, [election]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
    >
      <div>
        <Label htmlFor="election-title">Title</Label>
        <Input
          id="election-title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="election-description">Description</Label>
        <Textarea
          id="election-description"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="election-type">Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => setFormData({ ...formData, type: value as ElectionFormData['type'] })}
        >
          <SelectTrigger id="election-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student_government">Student Government</SelectItem>
            <SelectItem value="class_representative">Class Representative</SelectItem>
            <SelectItem value="club_officers">Club Officers</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="election-start">Start Date</Label>
          <Input
            id="election-start"
            type="datetime-local"
            value={formData.startDate.slice(0, 16)}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="election-end">End Date</Label>
          <Input
            id="election-end"
            type="datetime-local"
            value={formData.endDate.slice(0, 16)}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
          />
        </div>
      </div>
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
          {election ? 'Save Election' : 'Create Election'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PageantEditorForm({
  pageant,
  onSubmit,
  onCancel,
}: {
  pageant: Pageant | null;
  onSubmit: (formData: PageantFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<PageantFormData>({
    name: pageant?.name || '',
    description: pageant?.description || '',
    eventDate: pageant?.eventDate || '',
    scoringMethod: pageant?.scoringMethod || 'weighted',
    totalWeight: pageant?.totalWeight || 100,
    resultsPublic: pageant?.resultsPublic || false,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({
      name: pageant?.name || '',
      description: pageant?.description || '',
      eventDate: pageant?.eventDate || '',
      scoringMethod: pageant?.scoringMethod || 'weighted',
      totalWeight: pageant?.totalWeight || 100,
      resultsPublic: pageant?.resultsPublic || false,
    });
  }, [pageant]);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(formData);
      }}
    >
      <div>
        <Label htmlFor="pageant-name">Name</Label>
        <Input
          id="pageant-name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="pageant-description">Description</Label>
        <Textarea
          id="pageant-description"
          rows={3}
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      <div>
        <Label htmlFor="pageant-date">Event Date</Label>
        <Input
          id="pageant-date"
          type="date"
          value={formData.eventDate.slice(0, 10)}
          onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="pageant-method">Scoring Method</Label>
        <Select
          value={formData.scoringMethod}
          onValueChange={(value) => setFormData({ ...formData, scoringMethod: value as PageantFormData['scoringMethod'] })}
        >
          <SelectTrigger id="pageant-method">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="average">Average</SelectItem>
            <SelectItem value="weighted">Weighted</SelectItem>
            <SelectItem value="ranking">Ranking</SelectItem>
            <SelectItem value="ranking_by_gender">Ranking by Gender</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
          {pageant ? 'Save Pageant' : 'Create Pageant'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function AdminCandidateManager({
  candidates,
  positions,
  editingCandidate,
  onSave,
  onEdit,
  onDelete,
  onCancelEdit,
}: {
  candidates: Candidate[];
  positions: ElectionPosition[];
  editingCandidate: Candidate | null;
  onSave: (formData: CandidateFormData) => void;
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
  onCancelEdit: () => void;
}) {
  const [formData, setFormData] = useState<CandidateFormData>({
    positionId: positions[0]?.id || '',
    displayName: '',
    bio: '',
    platform: '',
    photoUrl: '',
    isWriteIn: false,
  });

  useEffect(() => {
    if (!editingCandidate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        positionId: positions[0]?.id || '',
        displayName: '',
        bio: '',
        platform: '',
        photoUrl: '',
        isWriteIn: false,
      });
      return;
    }

    setFormData({
      positionId: editingCandidate.positionId || '',
      displayName: editingCandidate.displayName,
      bio: editingCandidate.bio || '',
      platform: editingCandidate.platform || '',
      photoUrl: editingCandidate.photoUrl || '',
      isWriteIn: editingCandidate.isWriteIn,
    });
  }, [editingCandidate, positions]);

  return (
    <div className="space-y-5">
      <form
        className="space-y-3 rounded-md border border-gray-200 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(formData);
        }}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">{editingCandidate ? 'Edit Candidate' : 'Add Candidate'}</h4>
          {editingCandidate && (
            <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>Cancel Edit</Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Position</Label>
            <Select
              value={formData.positionId}
              onValueChange={(value) => setFormData({ ...formData, positionId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select position" />
              </SelectTrigger>
              <SelectContent>
                {positions.map((position) => (
                  <SelectItem key={position.id} value={position.id}>{position.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Display Name</Label>
            <Input
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <Label>Bio</Label>
          <Textarea rows={2} value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} />
        </div>
        <div>
          <Label>Platform</Label>
          <Textarea rows={2} value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} />
        </div>
        <div>
          <Label>Write-in Candidate</Label>
          <Select
            value={String(formData.isWriteIn)}
            onValueChange={(value) => setFormData({ ...formData, isWriteIn: value === 'true' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">No</SelectItem>
              <SelectItem value="true">Yes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button type="submit" className="bg-[#2E7D32] hover:bg-[#1B5E20]">
            <Plus className="w-4 h-4 mr-2" />
            {editingCandidate ? 'Save Candidate' : 'Add Candidate'}
          </Button>
        </div>
      </form>

      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Candidate</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Position</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Status</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((candidate) => (
              <tr key={candidate.id}>
                <td className="px-4 py-2 text-sm text-gray-900">{candidate.displayName}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{candidate.position}</td>
                <td className="px-4 py-2 text-sm">
                  <Badge className={candidate.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}>
                    {candidate.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(candidate)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(candidate)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminContestantManager({
  pageant,
  contestants,
  editingContestant,
  onSave,
  onEdit,
  onDelete,
  onCancelEdit,
}: {
  pageant: Pageant;
  contestants: Contestant[];
  editingContestant: Contestant | null;
  onSave: (formData: ContestantFormData) => void;
  onEdit: (contestant: Contestant) => void;
  onDelete: (contestant: Contestant) => void;
  onCancelEdit: () => void;
}) {
  const [formData, setFormData] = useState<ContestantFormData>({
    contestantNumber: 1,
    firstName: '',
    lastName: '',
    gender: undefined,
    bio: '',
    age: undefined,
    department: '',
    photoUrl: '',
  });

  useEffect(() => {
    if (!editingContestant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        contestantNumber: Math.max(1, contestants.length + 1),
        firstName: '',
        lastName: '',
        gender: undefined,
        bio: '',
        age: undefined,
        department: '',
        photoUrl: '',
      });
      return;
    }

    setFormData({
      contestantNumber: editingContestant.contestantNumber,
      firstName: editingContestant.firstName,
      lastName: editingContestant.lastName,
      gender: editingContestant.gender ?? undefined,
      bio: editingContestant.bio || '',
      age: editingContestant.age,
      department: editingContestant.department || '',
      photoUrl: editingContestant.photoUrl || '',
    });
  }, [editingContestant, contestants.length]);

  const genderRequired = pageant.scoringMethod === 'ranking_by_gender';

  return (
    <div className="space-y-5">
      <form
        className="space-y-3 rounded-md border border-gray-200 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (genderRequired && !formData.gender) return;
          onSave(formData);
        }}
      >
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-gray-900">{editingContestant ? 'Edit Contestant' : 'Add Contestant'}</h4>
          {editingContestant && (
            <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>Cancel Edit</Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Contestant Number</Label>
            <Input
              type="number"
              min={1}
              value={formData.contestantNumber}
              onChange={(e) => setFormData({ ...formData, contestantNumber: Number(e.target.value) })}
              required
            />
          </div>
          <div>
            <Label>Age</Label>
            <Input
              type="number"
              value={formData.age || ''}
              onChange={(e) => setFormData({ ...formData, age: Number(e.target.value) || undefined })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>First Name</Label>
            <Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
          </div>
        </div>
        <div>
          <Label>Department</Label>
          <Input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} />
        </div>
        {genderRequired && (
          <div>
            <Label>Gender</Label>
            <Select value={formData.gender} onValueChange={(value: 'Male' | 'Female') => setFormData({ ...formData, gender: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>Biography</Label>
          <Textarea rows={2} value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" className="bg-[#2E7D32] hover:bg-[#1B5E20]">
            <Plus className="w-4 h-4 mr-2" />
            {editingContestant ? 'Save Contestant' : 'Add Contestant'}
          </Button>
        </div>
      </form>

      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Contestant</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">No.</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Gender</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {contestants.map((contestant) => (
              <tr key={contestant.id}>
                <td className="px-4 py-2 text-sm text-gray-900">{contestant.firstName} {contestant.lastName}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{contestant.contestantNumber}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{contestant.gender || 'N/A'}</td>
                <td className="px-4 py-2 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(contestant)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(contestant)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminElectionResultsView({ results }: { results: ElectionResult[] }) {
  if (results.length === 0) {
    return <p className="text-sm text-gray-500">No result records available.</p>;
  }

  return (
    <div className="space-y-4">
      {results.map((positionResult) => (
        <div key={positionResult.position} className="rounded-md border border-gray-200 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <p className="font-semibold text-gray-900">{positionResult.position}</p>
            <p className="text-xs text-gray-500">Total Votes: {positionResult.totalVotes}</p>
          </div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-white">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Candidate</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Votes</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {positionResult.candidates.map((candidate) => (
                <tr key={candidate.candidateId}>
                  <td className="px-4 py-2 text-sm text-gray-900">{candidate.displayName}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700">{candidate.voteCount}</td>
                  <td className="px-4 py-2 text-sm text-right text-gray-700">{candidate.percentage.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function AdminPageantResultsView({ results }: { results: PageantResultsResponse }) {
  if (Array.isArray(results)) {
    if (results.length === 0) {
      return <p className="text-sm text-gray-500">No result records available.</p>;
    }

    return (
      <div className="rounded-md border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Rank</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Contestant</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.map((result) => (
              <tr key={result.contestantId}>
                <td className="px-4 py-2 text-sm text-gray-900">#{result.rank}</td>
                <td className="px-4 py-2 text-sm text-gray-900">{result.contestantName}</td>
                <td className="px-4 py-2 text-sm text-right text-gray-700">
                  {result.scoringMode === 'AVERAGE'
                    ? `${(result.finalScore ?? result.totalScore).toFixed(2)} / 10`
                    : result.scoringMode === 'RANKING'
                    ? `${(result.rankScore ?? result.totalScore).toFixed(2)} rank`
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
    <div className="space-y-4">
      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
        Male Winner: {results.maleWinner?.contestantName || 'N/A'} | Female Winner: {results.femaleWinner?.contestantName || 'N/A'}
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-md border border-gray-200 overflow-x-auto">
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 font-semibold text-gray-900">Male Division</div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Rank</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Contestant</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Average Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.maleResults.map((result) => (
                <tr key={result.contestantId}>
                  <td className="px-4 py-2 text-sm">#{result.rank}</td>
                  <td className="px-4 py-2 text-sm">{result.contestantName}</td>
                  <td className="px-4 py-2 text-sm text-right">{(result.rankScore ?? result.totalScore).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-md border border-gray-200 overflow-x-auto">
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 font-semibold text-gray-900">Female Division</div>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Rank</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase">Contestant</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase">Average Rank</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {results.femaleResults.map((result) => (
                <tr key={result.contestantId}>
                  <td className="px-4 py-2 text-sm">#{result.rank}</td>
                  <td className="px-4 py-2 text-sm">{result.contestantName}</td>
                  <td className="px-4 py-2 text-sm text-right">{(result.rankScore ?? result.totalScore).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============================================
// AUDIT LOGS TAB
// ============================================
function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    getAllAuditLogs().then(all => setLogs(all.slice(0, 100)));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Audit Logs</h3>
        <Button variant="outline">
          <FileText className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#1E3A8A]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Entity
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                User
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDateTime(log.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Badge variant="outline">{log.action}</Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.entityType} {log.entityId && `(${log.entityId.slice(-6)})`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.userName || 'System'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




