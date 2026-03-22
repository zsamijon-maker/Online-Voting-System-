import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Play,
  StopCircle,
  Eye,
  UserCheck,
  MoreHorizontal,
  Calendar,
  BarChart3,
  TrendingUp,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getAllElections,
  createElection,
  updateElection,
  deleteElection,
  openElection,
  closeElection,
  publishResults,
  getElectionResults,
  addCandidate,
  getCandidatesByElection,
  getElectionPositions,
} from '@/services/electionService';
import type { Election, Candidate, ElectionResult, ElectionFormData, CandidateFormData, ElectionPosition } from '@/types';
import { formatDate, formatElectionType, formatElectionStatus } from '@/utils/formatters';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function ElectionCommitteeDashboard() {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    const allElections = await getAllElections();
    setElections(allElections);
  };

  const handleCreateElection = async (data: ElectionFormData) => {
    if (user) {
      try {
        await createElection(data, user.id);
        showSuccess('Election created successfully');
        setIsCreateModalOpen(false);
        void fetchElections();
      } catch (error) {
        showError('Failed to create election: ' + (error as Error).message);
      }
    }
  };

  const handleUpdateElection = async (id: string, updates: Partial<Election>) => {
    const result = await updateElection(id, updates);
    if (result) {
      showSuccess('Election updated successfully');
      setIsEditModalOpen(false);
      setSelectedElection(null);
      void fetchElections();
    } else {
      showError('Failed to update election');
    }
  };

  const handleDeleteElection = async (id: string) => {
    if (confirm('Are you sure you want to delete this election?')) {
      const success = await deleteElection(id);
      if (success) {
        showSuccess('Election deleted successfully');
        void fetchElections();
      } else {
        showError('Failed to delete election');
      }
    }
  };

  const handleOpenElection = async (id: string) => {
    const result = await openElection(id);
    if (result) {
      showSuccess('Election is now open for voting');
      void fetchElections();
    }
  };

  const handleCloseElection = async (id: string) => {
    const result = await closeElection(id);
    if (result) {
      showSuccess('Election has been closed');
      void fetchElections();
    }
  };

  const handlePublishResults = async (id: string) => {
    const result = await publishResults(id);
    if (result) {
      showSuccess('Results are now public');
      void fetchElections();
    }
  };

  const handleViewResults = async (election: Election) => {
    const electionResults = await getElectionResults(election.id);
    setResults(electionResults);
    setSelectedElection(election);
    setIsResultsModalOpen(true);
  };

  const handleAddCandidate = async (electionId: string, data: CandidateFormData) => {
    try {
      await addCandidate(electionId, data);
      showSuccess('Candidate added successfully');
      setIsCandidateModalOpen(false);
      void fetchElections();
    } catch (error) {
      showError('Failed to add candidate: ' + (error as Error).message);
    }
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
          <p className="text-sm font-semibold text-[#1E3A8A]">Election Panel</p>
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
            <h2 className="text-lg font-bold text-[#1E3A8A]">Election Panel</h2>
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
                value="elections"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Calendar className="w-4 h-4" />
                Manage Elections
              </TabsTrigger>
              <TabsTrigger
                value="candidates"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Users className="w-4 h-4" />
                Candidates
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <BarChart3 className="w-4 h-4" />
                Results
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
                  <h1 className="text-xl font-bold text-white sm:text-2xl">Election Committee Dashboard</h1>
                  <p className="text-sm text-blue-200 mt-1">
                    Welcome back, {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <Badge className="w-fit bg-white/20 text-white border border-white/30">
                  <UserCheck className="w-3 h-3 mr-1" />
                  Election Committee
                </Badge>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <TabsContent value="overview">
              <ElectionOverviewTab elections={elections} onNavigate={setActiveTab} />
            </TabsContent>

            <TabsContent value="elections">
              <ElectionsTab
                elections={elections}
                onCreate={() => setIsCreateModalOpen(true)}
                onEdit={(election) => {
                  setSelectedElection(election);
                  setIsEditModalOpen(true);
                }}
                onDelete={handleDeleteElection}
                onOpen={handleOpenElection}
                onClose={handleCloseElection}
                onPublishResults={handlePublishResults}
                onViewResults={handleViewResults}
              />
            </TabsContent>

            <TabsContent value="candidates">
              <CandidatesTab
                elections={elections}
                onAddCandidate={(election) => {
                  setSelectedElection(election);
                  setIsCandidateModalOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="results">
              <ResultsTab
                elections={elections}
                onViewResults={handleViewResults}
              />
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

      {/* Create Election Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Election</DialogTitle>
            <DialogDescription>
              Set up a new election for students to vote.
            </DialogDescription>
          </DialogHeader>
          <ElectionForm
            onSubmit={handleCreateElection}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Election Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Election</DialogTitle>
            <DialogDescription>
              Update election details.
            </DialogDescription>
          </DialogHeader>
          {selectedElection && (
            <ElectionForm
              election={selectedElection}
              onSubmit={(data) => handleUpdateElection(selectedElection.id, data)}
              onCancel={() => {
                setIsEditModalOpen(false);
                setSelectedElection(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Candidate Modal */}
      <Dialog open={isCandidateModalOpen} onOpenChange={setIsCandidateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
            <DialogDescription>
              Add a new candidate to {selectedElection?.title}.
            </DialogDescription>
          </DialogHeader>
          {selectedElection && (
            <CandidateForm
              electionId={selectedElection.id}
              onSubmit={(data) => handleAddCandidate(selectedElection.id, data)}
              onCancel={() => {
                setIsCandidateModalOpen(false);
                setSelectedElection(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Election Results</DialogTitle>
            <DialogDescription>
              Results for {selectedElection?.title}
            </DialogDescription>
          </DialogHeader>
          <ResultsDisplay results={results} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================
function ElectionOverviewTab({
  elections,
  onNavigate,
}: {
  elections: Election[];
  onNavigate: (tab: string) => void;
}) {
  const total = elections.length;
  const active = elections.filter(e => e.status === 'active').length;
  const upcoming = elections.filter(e => e.status === 'upcoming' || e.status === 'draft').length;
  const closed = elections.filter(e => e.status === 'closed' || e.status === 'archived').length;

  const statusData = [
    { status: 'Active', count: active },
    { status: 'Upcoming', count: upcoming },
    { status: 'Closed', count: closed },
  ].filter(d => d.count > 0);

  const recentElections = [...elections]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statCards = [
    { label: 'Total Elections', value: total, colorClass: 'bg-blue-100 text-blue-600' },
    { label: 'Active', value: active, colorClass: 'bg-green-100 text-green-600' },
    { label: 'Upcoming / Draft', value: upcoming, colorClass: 'bg-amber-100 text-amber-600' },
    { label: 'Closed / Archived', value: closed, colorClass: 'bg-gray-100 text-gray-600' },
  ];

  const statusBadgeClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    upcoming: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-700',
    closed: 'bg-red-100 text-red-800',
    archived: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
            <div className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${card.colorClass}`}>
              elections
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Elections by Status Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Elections by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No elections yet.</p>
          )}
        </div>

        {/* Recent Elections */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Recent Elections</h3>
          {recentElections.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recentElections.map((election) => (
                <li key={election.id} className="py-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-800 truncate min-w-0">{election.title}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadgeClass[election.status] || 'bg-gray-100 text-gray-700'}`}>
                    {election.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No elections found.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Quick Actions</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="touch-target w-full rounded-md bg-[#1E3A8A] font-medium hover:bg-[#162d6b] sm:w-auto"
            onClick={() => onNavigate('elections')}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Manage Elections
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('candidates')}>
            <Users className="w-4 h-4 mr-2" />
            Manage Candidates
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('results')}>
            <BarChart3 className="w-4 h-4 mr-2" />
            View Results
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ELECTIONS TAB
// ============================================
function ElectionsTab({
  elections,
  onCreate,
  onEdit,
  onDelete,
  onOpen,
  onClose,
  onPublishResults,
  onViewResults,
}: {
  elections: Election[];
  onCreate: () => void;
  onEdit: (election: Election) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onPublishResults: (id: string) => void;
  onViewResults: (election: Election) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">All Elections</h3>
        <Button className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto" onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" />
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
                  <div className="text-sm text-gray-500">{formatElectionType(election.type)}</div>
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
                    {formatElectionStatus(election.status)}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(election.startDate)} - {formatDate(election.endDate)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="touch-target-compact">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(election)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {election.status === 'upcoming' && (
                        <DropdownMenuItem onClick={() => onOpen(election.id)}>
                          <Play className="w-4 h-4 mr-2" />
                          Open Voting
                        </DropdownMenuItem>
                      )}
                      {election.status === 'active' && (
                        <DropdownMenuItem onClick={() => onClose(election.id)}>
                          <StopCircle className="w-4 h-4 mr-2" />
                          Close Voting
                        </DropdownMenuItem>
                      )}
                      {election.status === 'closed' && !election.resultsPublic && (
                        <DropdownMenuItem onClick={() => onPublishResults(election.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Publish Results
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onViewResults(election)}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        View Results
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(election.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
// CANDIDATES TAB
// ============================================
function CandidatesTab({
  elections,
  onAddCandidate,
}: {
  elections: Election[];
  onAddCandidate: (election: Election) => void;
}) {
  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedElectionId) {
      setIsLoading(true);
      getCandidatesByElection(selectedElectionId)
        .then(setCandidates)
        .catch(() => setCandidates([]))
        .finally(() => setIsLoading(false));
    } else {
      setCandidates([]);
    }
  }, [selectedElectionId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Manage Candidates</h3>
        <div className="touch-action-group">
          <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
            <SelectTrigger className="w-full sm:w-64 touch-target">
              <SelectValue placeholder="Select an election" />
            </SelectTrigger>
            <SelectContent>
              {elections.map((election) => (
                <SelectItem key={election.id} value={election.id}>
                  {election.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedElectionId && (
            <Button
              className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto"
              onClick={() => {
                const election = elections.find(e => e.id === selectedElectionId);
                if (election) onAddCandidate(election);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          )}
        </div>
      </div>

      {selectedElectionId ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#1E3A8A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Candidate
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Loading candidates...
                  </td>
                </tr>
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    No candidates added yet.
                  </td>
                </tr>
              ) : (
                candidates.map((candidate) => (
                <tr key={candidate.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {candidate.photoPath || candidate.photoUrl ? (
                        <img
                          src={candidate.photoPath || candidate.photoUrl}
                          alt={candidate.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                          onError={(e) => {
                            // Replace with initials fallback if image fails to load
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            if (target.nextElementSibling) {
                              (target.nextElementSibling as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-10 h-10 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white font-medium"
                        style={{ display: (candidate.photoPath || candidate.photoUrl) ? 'none' : 'flex' }}
                      >
                        {candidate.displayName.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {candidate.displayName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {candidate.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge
                      className={
                        candidate.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }
                    >
                      {candidate.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Select an Election</h3>
          <p className="text-gray-500 mt-2">Choose an election to view and manage its candidates.</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// RESULTS TAB
// ============================================
function ResultsTab({
  elections,
  onViewResults,
}: {
  elections: Election[];
  onViewResults: (election: Election) => void;
}) {
  const closedElections = elections.filter(e => e.status === 'closed' || e.status === 'archived');

  return (
    <div className="space-y-6">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Election Results</h3>

      {closedElections.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Completed Elections</h3>
          <p className="text-gray-500 mt-2">There are no closed elections with results available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {closedElections.map((election) => (
            <Card key={election.id}>
              <CardHeader>
                <CardTitle className="text-lg">{election.title}</CardTitle>
                <CardDescription>
                  {formatElectionType(election.type)} • Closed on {formatDate(election.endDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge
                  className={
                    election.resultsPublic
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }
                >
                  {election.resultsPublic ? 'Results Public' : 'Results Private'}
                </Badge>
                <Button
                  className="mt-4 touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20]"
                  onClick={() => onViewResults(election)}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Results
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// ELECTION FORM
// ============================================
const STUDENT_GOVERNMENT_POSITIONS = [
  { name: 'President', maxVote: 1 },
  { name: 'Vice President', maxVote: 1 },
  { name: 'Senators', maxVote: 12 },
];

function ElectionForm({
  election,
  onSubmit,
  onCancel,
}: {
  election?: Election;
  onSubmit: (data: ElectionFormData) => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ElectionFormData>({
    title: election?.title || '',
    description: election?.description || '',
    type: election?.type || 'student_government',
    startDate: election?.startDate ? election.startDate.slice(0, 16) : '',
    endDate: election?.endDate ? election.endDate.slice(0, 16) : '',
    allowWriteIns: election?.allowWriteIns || false,
    maxVotesPerVoter: election?.maxVotesPerVoter || 1,
    resultsPublic: election?.resultsPublic || false,
  });
  const isStudentGovernment = formData.type === 'student_government';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting) {
      setIsSubmitting(true);
      onSubmit(formData);
      // Reset after a small delay (the parent will close the modal on success)
      setTimeout(() => setIsSubmitting(false), 1000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">Election Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="type">Election Type</Label>
        <Select
          value={formData.type}
          onValueChange={(value) => {
            const nextType = value as ElectionFormData['type'];
            setFormData((prev) => ({
              ...prev,
              type: nextType,
              maxVotesPerVoter: nextType === 'student_government' ? 1 : prev.maxVotesPerVoter,
            }));
          }}
        >
          <SelectTrigger>
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
      {isStudentGovernment && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">Student Government Positions</p>
          <p className="mt-1 text-xs text-blue-700">
            Positions and vote limits are generated automatically for this election type.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {STUDENT_GOVERNMENT_POSITIONS.map((position) => (
              <div key={position.name} className="rounded-md border border-blue-200 bg-white p-3">
                <p className="text-sm font-medium text-blue-900">{position.name}</p>
                <p className="text-xs text-blue-700">Max votes: {position.maxVote}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="startDate">Start Date</Label>
          <Input
            id="startDate"
            type="datetime-local"
            value={formData.startDate}
            onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
            required
          />
        </div>
        <div>
          <Label htmlFor="endDate">End Date</Label>
          <Input
            id="endDate"
            type="datetime-local"
            value={formData.endDate}
            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="allowWriteIns"
          checked={formData.allowWriteIns}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, allowWriteIns: checked as boolean })
          }
        />
        <Label htmlFor="allowWriteIns" className="font-normal">
          Allow write-in candidates
        </Label>
      </div>
      {!isStudentGovernment && (
        <div>
          <Label htmlFor="maxVotesPerVoter">Max Votes Per Voter</Label>
          <Input
            id="maxVotesPerVoter"
            type="number"
            min={1}
            max={10}
            value={formData.maxVotesPerVoter}
            onChange={(e) => setFormData({ ...formData, maxVotesPerVoter: parseInt(e.target.value) })}
          />
        </div>
      )}
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : election ? 'Save Changes' : 'Create Election'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// CANDIDATE FORM
// ============================================
function CandidateForm({
  electionId,
  onSubmit,
  onCancel,
}: {
  electionId: string;
  onSubmit: (data: CandidateFormData) => void;
  onCancel: () => void;
}) {
  const [positions, setPositions] = useState<ElectionPosition[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [formData, setFormData] = useState<CandidateFormData>({
    positionId: '',
    position: '',
    displayName: '',
    bio: '',
    platform: '',
    photoUrl: '',
    photoPath: '',
    imageFile: undefined,
    isWriteIn: false,
  });
  const [imageError, setImageError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileValidationError, setFileValidationError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    setIsLoadingPositions(true);
    getElectionPositions(electionId)
      .then((pos) => {
        if (!mounted) return;
        setPositions(pos);
        if (pos.length > 0) {
          setFormData((prev) => ({
            ...prev,
            positionId: pos[0].id,
            position: pos[0].name,
          }));
        }
      })
      .catch(() => {
        if (!mounted) return;
        setPositions([]);
      })
      .finally(() => {
        if (!mounted) return;
        setIsLoadingPositions(false);
      });

    return () => {
      mounted = false;
    };
  }, [electionId]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.positionId || isLoadingPositions || positions.length === 0) return;
    onSubmit(formData);
  };

  const handleFileChange = (file?: File) => {
    if (!file) {
      setFormData({ ...formData, imageFile: undefined });
      setPreviewUrl('');
      setFileName('');
      setFileValidationError('');
      return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFileValidationError('Only JPEG and PNG images are allowed.');
      setFormData({ ...formData, imageFile: undefined });
      setPreviewUrl('');
      setFileName('');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setFileValidationError('Image must be 2MB or smaller.');
      setFormData({ ...formData, imageFile: undefined });
      setPreviewUrl('');
      setFileName('');
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const nextPreview = URL.createObjectURL(file);
    setFormData({ ...formData, imageFile: file });
    setPreviewUrl(nextPreview);
    setFileName(file.name);
    setFileValidationError('');
    setImageError(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="position">Position</Label>
        {isLoadingPositions ? (
          <p className="text-sm text-gray-500">Loading positions...</p>
        ) : positions.length === 0 ? (
          <p className="text-sm text-amber-600">Election has no positions configured.</p>
        ) : (
          <Select
            value={formData.positionId}
            onValueChange={(value) => {
              const selected = positions.find((position) => position.id === value);
              setFormData({
                ...formData,
                positionId: value,
                position: selected?.name ?? '',
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {positions.map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.name} (Max votes: {position.voteLimit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label htmlFor="displayName">Candidate Name</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="candidateImage">Candidate Image</Label>
        <Input
          id="candidateImage"
          type="file"
          accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
        />
        <p className="text-xs text-gray-500 mt-1">Allowed: JPG or PNG, max size 2MB.</p>
        {fileName ? <p className="text-xs text-gray-700 mt-1">Selected file: {fileName}</p> : null}
        {fileValidationError ? <p className="text-xs text-red-600 mt-1">{fileValidationError}</p> : null}

        {(previewUrl || formData.photoPath || formData.photoUrl) && (
          <div className="mt-3 rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs font-medium text-gray-700 mb-2">Image preview</p>
            {imageError ? (
              <div className="w-20 h-20 border-2 border-red-300 rounded-full flex items-center justify-center bg-red-50">
                <span className="text-xs text-red-600 text-center px-2">Preview unavailable</span>
              </div>
            ) : (
              <img
                src={previewUrl || formData.photoPath || formData.photoUrl}
                alt="Candidate preview"
                className="w-20 h-20 object-cover rounded-full border-2 border-gray-200"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="bio">Biography</Label>
        <Textarea
          id="bio"
          value={formData.bio}
          onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
          rows={3}
        />
      </div>
      <div>
        <Label htmlFor="platform">Campaign Platform</Label>
        <Textarea
          id="platform"
          value={formData.platform}
          onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
          rows={4}
          placeholder="List campaign promises and ideas..."
        />
      </div>
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto" disabled={isLoadingPositions || positions.length === 0 || !formData.positionId}>
          Add Candidate
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// RESULTS DISPLAY
// ============================================
function ResultsDisplay({ results }: { results: ElectionResult[] }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No results available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {results.map((result) => (
        <div key={result.position} className="border border-gray-200 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">{result.position}</h4>
          <div className="space-y-3">
            {result.candidates.map((candidate, index) => (
              <div key={candidate.candidateId} className="flex items-center gap-4">
                <div className="w-8 text-center font-bold text-gray-500">#{index + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{candidate.displayName}</span>
                    <span className="text-sm text-gray-500">
                      {candidate.voteCount} votes ({candidate.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2E7D32] rounded-full"
                      style={{ width: `${candidate.percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">
            Total Votes: {result.totalVotes}
          </div>
        </div>
      ))}
    </div>
  );
}





