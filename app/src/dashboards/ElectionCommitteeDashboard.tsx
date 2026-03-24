import { Fragment, useState, useEffect, useCallback } from 'react';
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
  Crown,
  ChevronDown,
  ChevronUp,
  Trophy,
  Medal,
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

  const fetchElections = useCallback(async () => {
    const allElections = await getAllElections();
    setElections(allElections);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchElections();
    });
  }, [fetchElections]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchElections();
    });
  }, [activeTab, fetchElections]);

  useEffect(() => {
    const handleFocus = () => {
      void fetchElections();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchElections]);

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
          <ResultsDisplay results={results} election={selectedElection} />
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

const FSTLP_OFFICERS_POSITIONS = [
  { name: 'President', maxVote: 1 },
  { name: 'Vice President', maxVote: 1 },
  { name: 'Secretary', maxVote: 1 },
  { name: 'Treasurer', maxVote: 1 },
  { name: 'Auditor', maxVote: 1 },
  { name: 'PIO', maxVote: 2 },
  { name: 'Board Members', maxVote: 6 },
];

const toLocalDateTimeInputValue = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoFromDateTimeLocal = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
};

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
    startDate: toLocalDateTimeInputValue(election?.startDate),
    endDate: toLocalDateTimeInputValue(election?.endDate),
    allowWriteIns: election?.allowWriteIns || false,
    maxVotesPerVoter: election?.maxVotesPerVoter || 1,
    resultsPublic: election?.resultsPublic || false,
  });
  const isStudentGovernment = formData.type === 'student_government';
  const isFstlpOfficers = formData.type === 'fstlp_officers';
  const usesPredefinedPositions = isStudentGovernment || isFstlpOfficers;
  const predefinedPositionCards = isStudentGovernment ? STUDENT_GOVERNMENT_POSITIONS : isFstlpOfficers ? FSTLP_OFFICERS_POSITIONS : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting) {
      setIsSubmitting(true);
      onSubmit({
        ...formData,
        startDate: toIsoFromDateTimeLocal(formData.startDate),
        endDate: toIsoFromDateTimeLocal(formData.endDate),
      });
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
              maxVotesPerVoter: (nextType === 'student_government' || nextType === 'fstlp_officers') ? 1 : prev.maxVotesPerVoter,
            }));
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="student_government">Student Government</SelectItem>
            <SelectItem value="fstlp_officers">FSTLP Officers</SelectItem>
            <SelectItem value="class_representative">Class Representative</SelectItem>
            <SelectItem value="club_officers">Club Officers</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {usesPredefinedPositions && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-semibold text-blue-900">
            {isStudentGovernment ? 'Student Government Positions' : 'FSTLP Officers Positions'}
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Positions and vote limits are generated automatically for this election type.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {predefinedPositionCards.map((position) => (
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
      {!usesPredefinedPositions && (
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
function ResultsDisplay({
  results,
  election,
}: {
  results: ElectionResult[];
  election: Election | null;
}) {
  const [expandedPositions, setExpandedPositions] = useState<Set<string>>(new Set());
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());

  const normalizePositionResults = (rows: ElectionResult[]) =>
    rows.map((row) => {
      const sortedCandidates = [...row.candidates].sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        if (b.percentage !== a.percentage) return b.percentage - a.percentage;
        return a.displayName.localeCompare(b.displayName);
      });

      let currentRank = 0;
      let previousVoteCount = -1;

      const ranked = sortedCandidates.map((candidate, index) => {
        if (candidate.voteCount !== previousVoteCount) {
          currentRank = index + 1;
          previousVoteCount = candidate.voteCount;
        }
        return { ...candidate, rank: currentRank };
      });

      return {
        ...row,
        candidates: ranked,
      };
    });

  const normalizedResults = normalizePositionResults(results);
  const totalVotesOverall = normalizedResults.reduce((sum, row) => sum + row.totalVotes, 0);
  const totalCandidatesOverall = normalizedResults.reduce((sum, row) => sum + row.candidates.length, 0);
  const highestTurnoutPosition =
    normalizedResults.length > 0
      ? [...normalizedResults].sort((a, b) => b.totalVotes - a.totalVotes)[0]
      : null;

  const togglePosition = (position: string) => {
    setExpandedPositions((prev) => {
      const next = new Set(prev);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  };

  const toggleCandidate = (position: string, candidateId: string) => {
    const key = `${position}::${candidateId}`;
    setExpandedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800"><Trophy className="h-3 w-3" /> Gold</span>;
    if (rank === 2) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700"><Medal className="h-3 w-3" /> Silver</span>;
    if (rank === 3) return <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"><Medal className="h-3 w-3" /> Bronze</span>;
    return null;
  };

  if (results.length === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No results available yet.</p>
      </div>
    );
  }

  const positionTotalsChart = normalizedResults.map((row) => ({
    position: row.position,
    votes: row.totalVotes,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Election</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{election?.title || 'Election Results'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Type</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{election ? formatElectionType(election.type) : 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{election ? formatElectionStatus(election.status) : 'Closed'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">End Date</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{election ? formatDate(election.endDate) : 'N/A'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Positions</p>
          <p className="text-2xl font-bold text-gray-900">{normalizedResults.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Candidates</p>
          <p className="text-2xl font-bold text-gray-900">{totalCandidatesOverall}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Votes Cast</p>
          <p className="text-2xl font-bold text-gray-900">{totalVotesOverall}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Highest Turnout</p>
          <p className="text-sm font-semibold text-gray-900 mt-1">{highestTurnoutPosition?.position || 'N/A'}</p>
          <p className="text-xs text-gray-500">{highestTurnoutPosition?.totalVotes || 0} votes</p>
        </div>
      </div>

      <div className="rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-4">
        <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
          <Crown className="w-5 h-5 text-yellow-600" /> Position Winners
        </h4>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {normalizedResults.map((row) => {
            const winner = row.candidates[0];
            const tiedWinners = row.candidates.filter((c) => c.voteCount === winner.voteCount);

            return (
              <div key={row.position} className="rounded-md border border-yellow-200 bg-white p-3">
                <p className="text-sm font-semibold text-gray-900">{row.position}</p>
                <p className="text-sm text-gray-700 mt-1">{winner.displayName}</p>
                <p className="text-xs text-gray-500">{winner.voteCount} votes • {winner.percentage.toFixed(1)}%</p>
                {tiedWinners.length > 1 ? (
                  <Badge className="mt-2 bg-amber-100 text-amber-800">Tie ({tiedWinners.length})</Badge>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h4 className="text-base font-semibold text-gray-900 mb-3">Position Comparison (Total Votes)</h4>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={positionTotalsChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <XAxis dataKey="position" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip formatter={(value: number) => [`${value} votes`, 'Total Votes']} />
            <Bar dataKey="votes" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {normalizedResults.map((result) => {
        const isExpanded = expandedPositions.has(result.position);
        const candidateChartData = result.candidates.map((candidate) => ({
          name: candidate.displayName,
          votes: candidate.voteCount,
          percentage: candidate.percentage,
        }));

        return (
          <div key={result.position} className="rounded-lg border border-gray-200 bg-white">
            <button
              type="button"
              className="w-full px-4 py-3 border-b border-gray-200 flex items-center justify-between hover:bg-gray-50 text-left"
              onClick={() => togglePosition(result.position)}
            >
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{result.position}</h4>
                <p className="text-sm text-gray-500">Total Votes: {result.totalVotes}</p>
              </div>
              {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
            </button>

            {isExpanded ? (
              <div className="p-4 space-y-4">
                <div className="rounded-lg border border-gray-200 bg-[#F8FAFC] p-3">
                  <h5 className="text-sm font-semibold text-gray-900 mb-2">Candidate Comparison</h5>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={candidateChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip formatter={(value: number, _n, item) => [`${value} votes (${item.payload.percentage.toFixed(1)}%)`, 'Result']} />
                      <Bar dataKey="votes" fill="#2E7D32" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Rank</th>
                        <th className="px-3 py-2 text-left font-medium">Candidate</th>
                        <th className="px-3 py-2 text-right font-medium">Votes</th>
                        <th className="px-3 py-2 text-right font-medium">Percentage</th>
                        <th className="px-3 py-2 text-center font-medium">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.candidates.map((candidate) => {
                        const rowKey = `${result.position}::${candidate.candidateId}`;
                        const rowExpanded = expandedCandidates.has(rowKey);
                        const topRowClass =
                          candidate.rank === 1
                            ? 'bg-yellow-50'
                            : candidate.rank === 2
                            ? 'bg-gray-50'
                            : candidate.rank === 3
                            ? 'bg-orange-50'
                            : 'bg-white';

                        return (
                          <Fragment key={rowKey}>
                            <tr
                              className={`border-t border-gray-100 ${topRowClass} cursor-pointer hover:bg-blue-50/40`}
                              onClick={() => toggleCandidate(result.position, candidate.candidateId)}
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">#{candidate.rank}</span>
                                  {rankBadge(candidate.rank)}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-gray-900 font-medium">{candidate.displayName}</td>
                              <td className="px-3 py-2 text-right text-gray-800">{candidate.voteCount}</td>
                              <td className="px-3 py-2 text-right text-gray-800">{candidate.percentage.toFixed(1)}%</td>
                              <td className="px-3 py-2 text-center text-gray-600">
                                {rowExpanded ? <ChevronUp className="mx-auto h-4 w-4" /> : <ChevronDown className="mx-auto h-4 w-4" />}
                              </td>
                            </tr>
                            {rowExpanded ? (
                              <tr className="border-t border-gray-100">
                                <td colSpan={5} className="bg-[#F8FAFC] p-4">
                                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    <div className="rounded border border-gray-200 bg-white p-3">
                                      <p className="text-xs text-gray-500">Votes</p>
                                      <p className="text-sm font-semibold text-gray-900">{candidate.voteCount}</p>
                                    </div>
                                    <div className="rounded border border-gray-200 bg-white p-3">
                                      <p className="text-xs text-gray-500">Percentage</p>
                                      <p className="text-sm font-semibold text-gray-900">{candidate.percentage.toFixed(1)}%</p>
                                    </div>
                                    <div className="rounded border border-gray-200 bg-white p-3">
                                      <p className="text-xs text-gray-500">Share of Position Votes</p>
                                      <p className="text-sm font-semibold text-gray-900">{candidate.voteCount}/{result.totalVotes}</p>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}





