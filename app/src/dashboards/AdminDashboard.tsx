import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import { getAllUsers, createUser, updateUser, deleteUser, setUserActive, assignRole, removeRole, getUserStatistics } from '@/services/userService';
import { getAllElections } from '@/services/electionService';
import { getAllPageants } from '@/services/pageantService';
import { getAllAuditLogs, getAuditStatistics } from '@/services/auditService';
import type { User, UserRole, Election, Pageant, AuditLog } from '@/types';
import { formatDate, formatDateTime, formatRoleName } from '@/utils/formatters';
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

  // Fetch stats on mount
  useEffect(() => {
    void fetchStats();
  }, []);

  const fetchStats = async () => {
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

    setRecentAuditLogs(auditLogs.slice(0, 5));
    setStats({
      totalUsers: userStats.totalUsers,
      activeElections: elections.filter(e => e.status === 'active').length,
      totalElections: elections.length,
      totalVotes: auditStats.actionCounts['vote_cast'] || 0,
      upcomingPageants: pageants.filter(p => p.status === 'upcoming').length,
      activePageants: pageants.filter(p => p.status === 'active').length,
      usersByRole: userStats.usersByRole,
    });
  };

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
              <ElectionsTab />
            </TabsContent>

            <TabsContent value="pageants">
              <PageantsTab />
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

      {/* Recent System Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Recent System Activity</h3>
        {recentLogs.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {recentLogs.map((log) => (
              <li key={log.id} className="py-2 flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#1E3A8A]" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 capitalize">{log.action.replace(/_/g, ' ')}</p>
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

  useEffect(() => {
    void fetchUsers();
  }, []);

  const fetchUsers = async () => {
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
  };

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
function ElectionsTab() {
  const [elections, setElections] = useState<Election[]>([]);

  useEffect(() => {
    getAllElections().then(setElections);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">All Elections</h3>
        <Button className="bg-[#2E7D32] hover:bg-[#1B5E20] rounded-md font-medium">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// PAGEANTS TAB
// ============================================
function PageantsTab() {
  const [pageants, setPageants] = useState<Pageant[]>([]);

  useEffect(() => {
    getAllPageants().then(setPageants);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">All Pageants</h3>
        <Button className="bg-[#2E7D32] hover:bg-[#1B5E20] rounded-md font-medium">
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {pageants.map((pageant) => (
              <tr key={pageant.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{pageant.name}</div>
                  <div className="text-sm text-gray-500">{pageant.scoringMethod} scoring</div>
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
              </tr>
            ))}
          </tbody>
        </table>
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




