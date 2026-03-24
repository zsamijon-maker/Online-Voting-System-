import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import {
  Crown,
  Users,
  Star,
  Plus,
  Edit,
  Trash2,
  Play,
  CheckCircle,
  Eye,
  UserPlus,
  Search,
  Check,
  MoreHorizontal,
  Calendar,
  BarChart3,
  Scale,
  TrendingUp,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronUp,
  Trophy,
  Medal,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getAllPageants,
  createPageant,
  updatePageant,
  deletePageant,
  startPageant,
  completePageant,
  publishPageantResults,
  getPageantResults,
  addContestant,
  updateContestant,
  removeContestant,
  addCriteria,
  assignJudgesBulk,
  getAssignableJudges,
  getContestantsByPageant,
  getCriteriaByPageant,
  getPageantJudges,
  validateCriteriaWeights,
} from '@/services/pageantService';
import type {
  Pageant,
  Contestant,
  Criteria,
  PageantJudge,
  PageantResult,
  PageantResultsResponse,
  PageantFormData,
  ContestantFormData,
  CriteriaFormData,
  User,
} from '@/types';
import { formatDate, formatPageantStatus, formatScoringMethod } from '@/utils/formatters';
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

export default function PageantCommitteeDashboard() {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [pageants, setPageants] = useState<Pageant[]>([]);
  const [selectedPageant, setSelectedPageant] = useState<Pageant | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isContestantModalOpen, setIsContestantModalOpen] = useState(false);
  const [isEditContestantModalOpen, setIsEditContestantModalOpen] = useState(false);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [isJudgeModalOpen, setIsJudgeModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [results, setResults] = useState<PageantResultsResponse>([]);
  const [rankingTieBreaker, setRankingTieBreaker] = useState<'weighted_criteria' | 'judge_priority' | 'keep_tied'>('keep_tied');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);
  const [contestantsRefreshTick, setContestantsRefreshTick] = useState(0);

  const fetchPageants = useCallback(async () => {
    const allPageants = await getAllPageants();
    setPageants(allPageants);
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchPageants();
    });
  }, [fetchPageants]);

  useEffect(() => {
    Promise.resolve().then(() => {
      void fetchPageants();
    });
  }, [activeTab, fetchPageants]);

  useEffect(() => {
    const handleFocus = () => {
      void fetchPageants();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchPageants]);

  const handleCreatePageant = async (data: PageantFormData) => {
    if (user) {
      await createPageant(data, user.id);
      showSuccess('Pageant created successfully');
      setIsCreateModalOpen(false);
      void fetchPageants();
    }
  };

  const handleUpdatePageant = async (id: string, updates: Partial<Pageant>) => {
    const result = await updatePageant(id, updates);
    if (result) {
      showSuccess('Pageant updated successfully');
      setIsEditModalOpen(false);
      setSelectedPageant(null);
      void fetchPageants();
    } else {
      showError('Failed to update pageant');
    }
  };

  const handleDeletePageant = async (id: string) => {
    if (confirm('Are you sure you want to delete this pageant?')) {
      const success = await deletePageant(id);
      if (success) {
        showSuccess('Pageant deleted successfully');
        void fetchPageants();
      } else {
        showError('Failed to delete pageant');
      }
    }
  };

  const handleStartPageant = async (id: string) => {
    const result = await startPageant(id);
    if (result) {
      showSuccess('Pageant is now active');
      void fetchPageants();
    }
  };

  const handleCompletePageant = async (id: string) => {
    const result = await completePageant(id);
    if (result) {
      showSuccess('Pageant has been completed');
      void fetchPageants();
    }
  };

  const handlePublishResults = async (id: string) => {
    const result = await publishPageantResults(id);
    if (result) {
      showSuccess('Results are now public');
      void fetchPageants();
    }
  };

  const handleViewResults = async (pageant: Pageant, tieBreaker = rankingTieBreaker) => {
    const pageantResults = await getPageantResults(
      pageant.id,
      pageant.scoringMethod === 'ranking' || pageant.scoringMethod === 'ranking_by_gender' ? tieBreaker : undefined
    );
    setResults(pageantResults);
    setSelectedPageant(pageant);
    setIsResultsModalOpen(true);
  };

  const handleRankingTieBreakerChange = async (value: 'weighted_criteria' | 'judge_priority' | 'keep_tied') => {
    setRankingTieBreaker(value);

    if (!selectedPageant || (selectedPageant.scoringMethod !== 'ranking' && selectedPageant.scoringMethod !== 'ranking_by_gender')) return;

    const pageantResults = await getPageantResults(selectedPageant.id, value);
    setResults(pageantResults);
  };

  const handleAddContestant = async (pageantId: string, data: ContestantFormData) => {
    try {
      await addContestant(pageantId, data);
      showSuccess('Contestant added successfully');
      setContestantsRefreshTick((prev) => prev + 1);
      setIsContestantModalOpen(false);
      setSelectedPageant(null);
      setSelectedContestant(null);
      void fetchPageants();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add contestant';
      showError(message);
    }
  };

  const handleUpdateContestant = async (pageantId: string, contestantId: string, data: ContestantFormData) => {
    const updated = await updateContestant(contestantId, pageantId, {
      contestantNumber: data.contestantNumber,
      firstName: data.firstName,
      lastName: data.lastName,
      bio: data.bio,
      age: data.age,
      department: data.department,
      gender: data.gender,
      photoUrl: data.photoUrl,
      isActive: true,
      imageFile: data.imageFile,
    });

    if (!updated) {
      showError('Failed to update contestant');
      return;
    }

    showSuccess('Contestant updated successfully');
    setContestantsRefreshTick((prev) => prev + 1);
    setIsEditContestantModalOpen(false);
    setSelectedPageant(null);
    setSelectedContestant(null);
    void fetchPageants();
  };

  const handleDeleteContestant = async (pageantId: string, contestant: Contestant) => {
    const confirmed = confirm(`Are you sure you want to remove ${contestant.firstName} ${contestant.lastName}?`);
    if (!confirmed) return;

    const success = await removeContestant(contestant.id, pageantId);
    if (!success) {
      showError('Failed to remove contestant');
      return;
    }

    showSuccess('Contestant removed successfully');
    setContestantsRefreshTick((prev) => prev + 1);
    void fetchPageants();
  };

  const handleAddCriteria = async (pageantId: string, data: CriteriaFormData) => {
    await addCriteria(pageantId, data);
    showSuccess('Criteria added successfully');
    setIsCriteriaModalOpen(false);
    void fetchPageants();
  };

  const handleAssignJudges = async (pageantId: string, judgeIds: string[]) => {
    if (user) {
      const result = await assignJudgesBulk(pageantId, judgeIds);
      const suffix = result.assignedCount === 1 ? '' : 's';
      showSuccess(`${result.assignedCount} judge${suffix} assigned successfully`);

      if (result.invalidJudgeIds.length > 0) {
        showError(`${result.invalidJudgeIds.length} selection(s) were skipped because they are not active judges.`);
      }

      setIsJudgeModalOpen(false);
      void fetchPageants();
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
          <p className="text-sm font-semibold text-[#1E3A8A]">Pageant Panel</p>
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
            <h2 className="text-lg font-bold text-[#1E3A8A]">Pageant Panel</h2>
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
                value="pageants"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Crown className="w-4 h-4" />
                Manage Pageants
              </TabsTrigger>
              <TabsTrigger
                value="contestants"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Users className="w-4 h-4" />
                Contestants
              </TabsTrigger>
              <TabsTrigger
                value="criteria"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Scale className="w-4 h-4" />
                Criteria
              </TabsTrigger>
              <TabsTrigger
                value="judges"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Star className="w-4 h-4" />
                Judges
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
                  <h1 className="text-xl font-bold text-white sm:text-2xl">Pageant Committee Dashboard</h1>
                  <p className="text-sm text-blue-200 mt-1">
                    Welcome back, {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <Badge className="w-fit bg-white/20 text-white border border-white/30">
                  <Crown className="w-3 h-3 mr-1" />
                  Pageant Committee
                </Badge>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <TabsContent value="overview">
              <PageantOverviewTab pageants={pageants} onNavigate={setActiveTab} />
            </TabsContent>

            <TabsContent value="pageants">
              <PageantsTab
                pageants={pageants}
                onCreate={() => setIsCreateModalOpen(true)}
                onEdit={(pageant) => {
                  setSelectedPageant(pageant);
                  setIsEditModalOpen(true);
                }}
                onDelete={handleDeletePageant}
                onStart={handleStartPageant}
                onComplete={handleCompletePageant}
                onPublishResults={handlePublishResults}
                onViewResults={handleViewResults}
              />
            </TabsContent>

            <TabsContent value="contestants">
              <ContestantsTab
                pageants={pageants}
                refreshTick={contestantsRefreshTick}
                onAddContestant={(pageant) => {
                  setSelectedPageant(pageant);
                  setSelectedContestant(null);
                  setIsContestantModalOpen(true);
                }}
                onEditContestant={(pageant, contestant) => {
                  setSelectedPageant(pageant);
                  setSelectedContestant(contestant);
                  setIsEditContestantModalOpen(true);
                }}
                onDeleteContestant={handleDeleteContestant}
              />
            </TabsContent>

            <TabsContent value="criteria">
              <CriteriaTab
                pageants={pageants}
                onAddCriteria={(pageant) => {
                  setSelectedPageant(pageant);
                  setIsCriteriaModalOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="judges">
              <JudgesTab
                pageants={pageants}
                onAssignJudge={(pageant) => {
                  setSelectedPageant(pageant);
                  setIsJudgeModalOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="results">
              <ResultsTab
                pageants={pageants}
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

      {/* Create Pageant Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Pageant</DialogTitle>
            <DialogDescription>
              Set up a new pageant competition.
            </DialogDescription>
          </DialogHeader>
          <PageantForm
            onSubmit={handleCreatePageant}
            onCancel={() => setIsCreateModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Pageant Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pageant</DialogTitle>
            <DialogDescription>
              Update pageant details.
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <PageantForm
              pageant={selectedPageant}
              onSubmit={(data) => handleUpdatePageant(selectedPageant.id, data)}
              onCancel={() => {
                setIsEditModalOpen(false);
                setSelectedPageant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Contestant Modal */}
      <Dialog open={isContestantModalOpen} onOpenChange={setIsContestantModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Contestant</DialogTitle>
            <DialogDescription>
              Add a new contestant to {selectedPageant?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <ContestantForm
              scoringMethod={selectedPageant.scoringMethod}
              onSubmit={(data) => handleAddContestant(selectedPageant.id, data)}
              onCancel={() => {
                setIsContestantModalOpen(false);
                setSelectedPageant(null);
                setSelectedContestant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Contestant Modal */}
      <Dialog open={isEditContestantModalOpen} onOpenChange={setIsEditContestantModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Contestant</DialogTitle>
            <DialogDescription>
              Update contestant details for {selectedPageant?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && selectedContestant && (
            <ContestantForm
              contestant={selectedContestant}
              scoringMethod={selectedPageant.scoringMethod}
              submitLabel="Save Changes"
              onSubmit={(data) => handleUpdateContestant(selectedPageant.id, selectedContestant.id, data)}
              onCancel={() => {
                setIsEditContestantModalOpen(false);
                setSelectedPageant(null);
                setSelectedContestant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add Criteria Modal */}
      <Dialog open={isCriteriaModalOpen} onOpenChange={setIsCriteriaModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Scoring Criteria</DialogTitle>
            <DialogDescription>
              Add a new criteria to {selectedPageant?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <CriteriaForm
              onSubmit={(data) => handleAddCriteria(selectedPageant.id, data)}
              onCancel={() => {
                setIsCriteriaModalOpen(false);
                setSelectedPageant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Judge Modal */}
      <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Judge</DialogTitle>
            <DialogDescription>
              Assign a judge to {selectedPageant?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <AssignJudgeForm
              pageantId={selectedPageant.id}
              onSubmit={(judgeIds) => handleAssignJudges(selectedPageant.id, judgeIds)}
              onCancel={() => {
                setIsJudgeModalOpen(false);
                setSelectedPageant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Results Modal */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pageant Results</DialogTitle>
            <DialogDescription>
              Results for {selectedPageant?.name}
            </DialogDescription>
          </DialogHeader>
          {(selectedPageant?.scoringMethod === 'ranking' || selectedPageant?.scoringMethod === 'ranking_by_gender') && (
            <div className="mb-4 space-y-2">
              <Label>Ranking Tie-breaker</Label>
              <Select value={rankingTieBreaker} onValueChange={(value: 'weighted_criteria' | 'judge_priority' | 'keep_tied') => void handleRankingTieBreakerChange(value)}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <SelectValue placeholder="Select tie-breaker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep_tied">Keep tied rank</SelectItem>
                  <SelectItem value="weighted_criteria">Highest weighted criteria score</SelectItem>
                  <SelectItem value="judge_priority">Judge priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <PageantResultsDisplay
            results={results}
            scoringMethod={selectedPageant?.scoringMethod}
            pageant={selectedPageant}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// OVERVIEW TAB
// ============================================
function PageantOverviewTab({
  pageants,
  onNavigate,
}: {
  pageants: Pageant[];
  onNavigate: (tab: string) => void;
}) {
  const total = pageants.length;
  const active = pageants.filter(p => p.status === 'active').length;
  const upcoming = pageants.filter(p => p.status === 'upcoming' || p.status === 'draft').length;
  const completed = pageants.filter(p => p.status === 'completed' || p.status === 'archived').length;

  const statusData = [
    { status: 'Active', count: active },
    { status: 'Upcoming', count: upcoming },
    { status: 'Completed', count: completed },
  ].filter(d => d.count > 0);

  const recentPageants = [...pageants]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statCards = [
    { label: 'Total Pageants', value: total, colorClass: 'bg-purple-100 text-purple-600' },
    { label: 'Active', value: active, colorClass: 'bg-green-100 text-green-600' },
    { label: 'Upcoming / Draft', value: upcoming, colorClass: 'bg-amber-100 text-amber-600' },
    { label: 'Completed', value: completed, colorClass: 'bg-gray-100 text-gray-600' },
  ];

  const statusBadgeClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    upcoming: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-700',
    completed: 'bg-purple-100 text-purple-800',
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
              pageants
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pageants by Status Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Pageants by Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No pageants yet.</p>
          )}
        </div>

        {/* Recent Pageants */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Recent Pageants</h3>
          {recentPageants.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {recentPageants.map((pageant) => (
                <li key={pageant.id} className="py-2 flex items-center justify-between gap-2">
                  <span className="text-sm text-gray-800 truncate min-w-0">{pageant.name}</span>
                  <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium capitalize ${statusBadgeClass[pageant.status] || 'bg-gray-100 text-gray-700'}`}>
                    {pageant.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No pageants found.</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Quick Actions</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="touch-target w-full rounded-md bg-[#1E3A8A] font-medium hover:bg-[#162d6b] sm:w-auto"
            onClick={() => onNavigate('pageants')}
          >
            <Crown className="w-4 h-4 mr-2" />
            Manage Pageants
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('contestants')}>
            <Users className="w-4 h-4 mr-2" />
            Manage Contestants
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('judges')}>
            <Star className="w-4 h-4 mr-2" />
            Manage Judges
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
// PAGEANTS TAB
// ============================================
function PageantsTab({
  pageants,
  onCreate,
  onEdit,
  onDelete,
  onStart,
  onComplete,
  onPublishResults,
  onViewResults,
}: {
  pageants: Pageant[];
  onCreate: () => void;
  onEdit: (pageant: Pageant) => void;
  onDelete: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onPublishResults: (id: string) => void;
  onViewResults: (pageant: Pageant) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">All Pageants</h3>
        <Button className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto" onClick={onCreate}>
          <Plus className="w-4 h-4 mr-2" />
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
                  <div className="text-sm text-gray-500">{formatScoringMethod(pageant.scoringMethod)}</div>
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
                    {formatPageantStatus(pageant.status)}
                  </Badge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(pageant.eventDate)}
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
                      <DropdownMenuItem onClick={() => onEdit(pageant)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {pageant.status === 'upcoming' && (
                        <DropdownMenuItem onClick={() => onStart(pageant.id)}>
                          <Play className="w-4 h-4 mr-2" />
                          Start Pageant
                        </DropdownMenuItem>
                      )}
                      {pageant.status === 'active' && (
                        <DropdownMenuItem onClick={() => onComplete(pageant.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete
                        </DropdownMenuItem>
                      )}
                      {pageant.status === 'completed' && !pageant.resultsPublic && (
                        <DropdownMenuItem onClick={() => onPublishResults(pageant.id)}>
                          <Eye className="w-4 h-4 mr-2" />
                          Publish Results
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onViewResults(pageant)}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        View Results
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(pageant.id)}
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
// CONTESTANTS TAB
// ============================================
function ContestantsTab({
  pageants,
  refreshTick,
  onAddContestant,
  onEditContestant,
  onDeleteContestant,
}: {
  pageants: Pageant[];
  refreshTick: number;
  onAddContestant: (pageant: Pageant) => void;
  onEditContestant: (pageant: Pageant, contestant: Contestant) => void;
  onDeleteContestant: (pageantId: string, contestant: Contestant) => void;
}) {
  const [selectedPageantId, setSelectedPageantId] = useState<string>('');
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [loadingContestants, setLoadingContestants] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!selectedPageantId) {
      setContestants([]);
      return;
    }
    setLoadingContestants(true);
    getContestantsByPageant(selectedPageantId)
      .then((c) => { if (mounted) setContestants(c); })
      .catch(() => { if (mounted) setContestants([]); })
      .finally(() => { if (mounted) setLoadingContestants(false); });
    return () => { mounted = false; };
  }, [selectedPageantId, refreshTick]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Manage Contestants</h3>
        <div className="touch-action-group">
          <Select value={selectedPageantId} onValueChange={setSelectedPageantId}>
            <SelectTrigger className="w-full touch-target sm:w-64">
              <SelectValue placeholder="Select a pageant" />
            </SelectTrigger>
            <SelectContent>
              {pageants.map((pageant) => (
                <SelectItem key={pageant.id} value={pageant.id}>
                  {pageant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPageantId && (
            <Button
              className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto"
              onClick={() => {
                const pageant = pageants.find(p => p.id === selectedPageantId);
                if (pageant) onAddContestant(pageant);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contestant
            </Button>
          )}
        </div>
      </div>

      {selectedPageantId ? (
        loadingContestants ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">Loading contestants...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contestants.map((contestant) => {
              const selectedPageant = pageants.find((p) => p.id === selectedPageantId);
              return (
                <Card key={contestant.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-4 min-w-0">
                        {contestant.photoPath || contestant.photoUrl ? (
                          <img
                            src={contestant.photoPath || contestant.photoUrl}
                            alt={`${contestant.firstName} ${contestant.lastName}`}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-[#1E3A8A] flex items-center justify-center text-white text-xl font-bold">
                            {contestant.firstName[0]}{contestant.lastName[0]}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            #{contestant.contestantNumber} {contestant.firstName} {contestant.lastName}
                          </p>
                          {contestant.department && (
                            <p className="text-sm text-gray-500 truncate">{contestant.department}</p>
                          )}
                          {contestant.age && (
                            <p className="text-sm text-gray-500">Age: {contestant.age}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="touch-target-compact"
                          onClick={() => {
                            if (selectedPageant) onEditContestant(selectedPageant, contestant);
                          }}
                          aria-label={`Edit ${contestant.firstName} ${contestant.lastName}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="touch-target-compact text-red-600 hover:text-red-700"
                          onClick={() => onDeleteContestant(selectedPageantId, contestant)}
                          aria-label={`Remove ${contestant.firstName} ${contestant.lastName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Select a Pageant</h3>
          <p className="text-gray-500 mt-2">Choose a pageant to view and manage its contestants.</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// CRITERIA TAB
// ============================================
function CriteriaTab({
  pageants,
  onAddCriteria,
}: {
  pageants: Pageant[];
  onAddCriteria: (pageant: Pageant) => void;
}) {
  const [selectedPageantId, setSelectedPageantId] = useState<string>('');
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [weightValidation, setWeightValidation] = useState<{ valid: boolean; total: number }>({ valid: true, total: 0 });

  useEffect(() => {
    let mounted = true;
    if (!selectedPageantId) {
      setCriteria([]);
      setWeightValidation({ valid: true, total: 0 });
      return;
    }
    setLoadingCriteria(true);
    Promise.all([
      getCriteriaByPageant(selectedPageantId),
      validateCriteriaWeights(selectedPageantId),
    ])
      .then(([c, validation]) => {
        if (!mounted) return;
        setCriteria(c);
        setWeightValidation(validation);
      })
      .catch(() => {
        if (!mounted) return;
        setCriteria([]);
        setWeightValidation({ valid: true, total: 0 });
      })
      .finally(() => { if (mounted) setLoadingCriteria(false); });
    return () => { mounted = false; };
  }, [selectedPageantId]);
  // Compute content to render for the criteria area to avoid nested JSX ternaries
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let criteriaContent: any;
  if (!selectedPageantId) {
    criteriaContent = (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Select a Pageant</h3>
        <p className="text-gray-500 mt-2">Choose a pageant to view and manage its scoring criteria.</p>
      </div>
    );
  } else if (loadingCriteria) {
    criteriaContent = (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">Loading criteria...</div>
    );
  } else {
    criteriaContent = (
      <div className="space-y-4">
        <div className={`p-4 rounded-lg ${weightValidation.valid ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
          <div className="flex items-center gap-2">
            <Scale className={`w-5 h-5 ${weightValidation.valid ? 'text-green-600' : 'text-yellow-600'}`} />
            <span className={`font-medium ${weightValidation.valid ? 'text-green-800' : 'text-yellow-800'}`}>
              Total Weight: {weightValidation.total.toFixed(2)}%
            </span>
            {!weightValidation.valid && (
              <span className="text-yellow-700 text-sm">
                (Should equal 100%)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#1E3A8A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Criteria
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Max Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {criteria.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    {c.description && (
                      <div className="text-sm text-gray-500">{c.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.weight}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {c.maxScore}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Scoring Criteria</h3>
        <div className="touch-action-group">
          <Select value={selectedPageantId} onValueChange={setSelectedPageantId}>
            <SelectTrigger className="w-full touch-target sm:w-64">
              <SelectValue placeholder="Select a pageant" />
            </SelectTrigger>
            <SelectContent>
              {pageants.map((pageant) => (
                <SelectItem key={pageant.id} value={pageant.id}>
                  {pageant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPageantId && (
            <Button
              className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto"
              onClick={() => {
                const pageant = pageants.find(p => p.id === selectedPageantId);
                if (pageant) onAddCriteria(pageant);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Criteria
            </Button>
          )}
        </div>
      </div>

      {criteriaContent}
    </div>
  );
}

// ============================================
// JUDGES TAB
// ============================================
function JudgesTab({
  pageants,
  onAssignJudge,
}: {
  pageants: Pageant[];
  onAssignJudge: (pageant: Pageant) => void;
}) {
  const [selectedPageantId, setSelectedPageantId] = useState<string>('');
  const [judges, setJudges] = useState<PageantJudge[]>([]);

  useEffect(() => {
    if (!selectedPageantId) {
      setJudges([]);
      return;
    }
    getPageantJudges(selectedPageantId).then(setJudges);
  }, [selectedPageantId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Assigned Judges</h3>
        <div className="touch-action-group">
          <Select value={selectedPageantId} onValueChange={setSelectedPageantId}>
            <SelectTrigger className="w-full touch-target sm:w-64">
              <SelectValue placeholder="Select a pageant" />
            </SelectTrigger>
            <SelectContent>
              {pageants.map((pageant) => (
                <SelectItem key={pageant.id} value={pageant.id}>
                  {pageant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPageantId && (
            <Button
              className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto"
              onClick={() => {
                const pageant = pageants.find(p => p.id === selectedPageantId);
                if (pageant) onAssignJudge(pageant);
              }}
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Assign Judge
            </Button>
          )}
        </div>
      </div>

      {selectedPageantId ? (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-[#1E3A8A]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Judge Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Assigned At
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {judges.map((judge) => (
                <tr key={judge.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {judge.judgeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(judge.assignedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className="bg-green-100 text-green-800">
                      Active
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <UserPlus className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Select a Pageant</h3>
          <p className="text-gray-500 mt-2">Choose a pageant to view and manage its judges.</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// RESULTS TAB
// ============================================
function ResultsTab({
  pageants,
  onViewResults,
}: {
  pageants: Pageant[];
  onViewResults: (pageant: Pageant) => void;
}) {
  const completedPageants = pageants.filter(p => p.status === 'completed' || p.status === 'archived');

  return (
    <div className="space-y-6">
        <h3 className="text-lg font-semibold text-[#1E3A8A]">Pageant Results</h3>

      {completedPageants.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Completed Pageants</h3>
          <p className="text-gray-500 mt-2">There are no completed pageants with results available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {completedPageants.map((pageant) => (
            <Card key={pageant.id}>
              <CardHeader>
                <CardTitle className="text-lg">{pageant.name}</CardTitle>
                <CardDescription>
                  Completed on {formatDate(pageant.eventDate)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Badge
                  className={
                    pageant.resultsPublic
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }
                >
                  {pageant.resultsPublic ? 'Results Public' : 'Results Private'}
                </Badge>
                <Button
                  className="mt-4 touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20]"
                  onClick={() => onViewResults(pageant)}
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
// PAGEANT FORM
// ============================================
function PageantForm({
  pageant,
  onSubmit,
  onCancel,
}: {
  pageant?: Pageant;
  onSubmit: (data: PageantFormData) => void;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Pageant Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
        <Label htmlFor="eventDate">Event Date</Label>
        <Input
          id="eventDate"
          type="date"
          value={formData.eventDate}
          onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
          required
        />
      </div>
      <div>
        <Label htmlFor="scoringMethod">Scoring Method</Label>
        <Select
          value={formData.scoringMethod}
          onValueChange={(value) => setFormData({ ...formData, scoringMethod: value as PageantFormData['scoringMethod'] })}
        >
          <SelectTrigger>
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
          {pageant ? 'Save Changes' : 'Create Pageant'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// CONTESTANT FORM
// ============================================
function ContestantForm({
  contestant,
  scoringMethod,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  contestant?: Contestant;
  scoringMethod: Pageant['scoringMethod'];
  submitLabel?: string;
  onSubmit: (data: ContestantFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<ContestantFormData>({
    contestantNumber: contestant?.contestantNumber || 1,
    firstName: contestant?.firstName || '',
    lastName: contestant?.lastName || '',
    gender: contestant?.gender ?? undefined,
    bio: contestant?.bio || '',
    age: contestant?.age,
    department: contestant?.department || '',
    photoUrl: contestant?.photoUrl || '',
    photoPath: contestant?.photoPath || '',
    imageFile: undefined,
  });
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileValidationError, setFileValidationError] = useState<string>('');
  const [genderValidationError, setGenderValidationError] = useState<string>('');

  const genderRequired = scoringMethod === 'ranking_by_gender';

  useEffect(() => {
    if (!contestant) return;

    setFormData({
      contestantNumber: contestant.contestantNumber,
      firstName: contestant.firstName,
      lastName: contestant.lastName,
      gender: contestant.gender ?? undefined,
      bio: contestant.bio || '',
      age: contestant.age,
      department: contestant.department || '',
      photoUrl: contestant.photoUrl || '',
      photoPath: contestant.photoPath || '',
      imageFile: undefined,
    });
    setPreviewUrl('');
    setFileName('');
    setFileValidationError('');
    setGenderValidationError('');
  }, [contestant]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (genderRequired && !formData.gender) {
      setGenderValidationError('Gender is required for Ranking by Gender pageants.');
      return;
    }

    setGenderValidationError('');
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
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="contestantNumber">Contestant #</Label>
          <Input
            id="contestantNumber"
            type="number"
            min={1}
            value={formData.contestantNumber}
            onChange={(e) => setFormData({ ...formData, contestantNumber: parseInt(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            type="number"
            min={16}
            max={100}
            value={formData.age || ''}
            onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>
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
      {genderRequired && (
        <div>
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={formData.gender}
            onValueChange={(value: 'Male' | 'Female') => {
              setFormData({ ...formData, gender: value });
              setGenderValidationError('');
            }}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select gender" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
          {genderValidationError ? <p className="text-xs text-red-600 mt-1">{genderValidationError}</p> : null}
        </div>
      )}
      <div>
        <Label htmlFor="department">Department/College</Label>
        <Input
          id="department"
          value={formData.department}
          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
          placeholder="e.g., College of Engineering"
        />
      </div>
      <div>
        <Label htmlFor="contestantImage">Contestant Image</Label>
        <Input
          id="contestantImage"
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
            <img
              src={previewUrl || formData.photoPath || formData.photoUrl}
              alt="Contestant preview"
              className="w-20 h-20 object-cover rounded-full border-2 border-gray-200"
            />
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
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
          {submitLabel ?? 'Add Contestant'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// CRITERIA FORM
// ============================================
function CriteriaForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CriteriaFormData) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<CriteriaFormData>({
    name: '',
    description: '',
    weight: 25,
    maxScore: 10,
    displayOrder: 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Criteria Name</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Beauty & Poise"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="weight">Weight (%)</Label>
          <Input
            id="weight"
            type="number"
            min={1}
            max={100}
            step={0.01}
            value={formData.weight}
            onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })}
            required
          />
        </div>
        <div>
          <Label htmlFor="maxScore">Max Score</Label>
          <Input
            id="maxScore"
            type="number"
            min={1}
            max={100}
            value={formData.maxScore}
            onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) })}
            required
          />
        </div>
      </div>
      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
          Add Criteria
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// ASSIGN JUDGE FORM
// ============================================
function AssignJudgeForm({
  pageantId,
  onSubmit,
  onCancel,
}: {
  pageantId: string;
  onSubmit: (judgeIds: string[]) => void;
  onCancel: () => void;
}) {
  const [judges, setJudges] = useState<User[]>([]);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [assignedJudgeIds, setAssignedJudgeIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    Promise.allSettled([getAssignableJudges(pageantId), getPageantJudges(pageantId)])
      .then(([availableResult, assignedResult]) => {
        if (!mounted) return;

        if (availableResult.status === 'fulfilled') {
          setJudges(availableResult.value.filter((u) => u.roles.includes('judge') && u.isActive));
        } else {
          setJudges([]);
          setLoadError('Unable to load judges. Please refresh and try again.');
        }

        if (assignedResult.status === 'fulfilled') {
          setAssignedJudgeIds(new Set(assignedResult.value.filter((j) => j.isActive).map((j) => j.judgeId)));
        } else {
          setAssignedJudgeIds(new Set());
          if (availableResult.status === 'fulfilled') {
            setLoadError('Unable to load current assignments. You can still select judges.');
          }
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [pageantId]);

  const filteredJudges = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return judges;

    return judges.filter((judge) => {
      const fullName = `${judge.firstName} ${judge.lastName}`.toLowerCase();
      const email = judge.email.toLowerCase();
      return fullName.includes(query) || email.includes(query);
    });
  }, [judges, searchTerm]);

  const toggleJudge = (judgeId: string) => {
    if (assignedJudgeIds.has(judgeId)) return;

    setSelectedJudgeIds((prev) =>
      prev.includes(judgeId) ? prev.filter((id) => id !== judgeId) : [...prev, judgeId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJudgeIds.length === 0) return;
    onSubmit(selectedJudgeIds);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="judge-search">Search Judges</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="judge-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
        <p className="text-sm text-gray-500">
          Selected: <span className="font-semibold text-gray-700">{selectedJudgeIds.length}</span>
        </p>
        {loadError && <p className="text-sm text-amber-700">{loadError}</p>}
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-2">
        {isLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">Loading judges...</p>
        ) : filteredJudges.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">No judges found for your search.</p>
        ) : (
          filteredJudges.map((judge) => {
            const isSelected = selectedJudgeIds.includes(judge.id);
            const isAlreadyAssigned = assignedJudgeIds.has(judge.id);
            const displayName = `${judge.firstName} ${judge.lastName}`;
            const profilePhoto = judge.photoPath || judge.photoUrl;

            return (
              <button
                key={judge.id}
                type="button"
                className={`w-full rounded-md border p-3 text-left transition ${
                  isAlreadyAssigned
                    ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-80'
                    : isSelected
                    ? 'border-[#2E7D32] bg-green-50 ring-1 ring-[#2E7D32]/30'
                    : 'border-gray-200 bg-white hover:border-[#1E3A8A]/40'
                }`}
                onClick={() => toggleJudge(judge.id)}
                disabled={isAlreadyAssigned}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-3">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={displayName}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A8A] text-sm font-semibold text-white">
                      {judge.firstName?.[0]}{judge.lastName?.[0]}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{displayName}</p>
                    <p className="truncate text-xs text-gray-500">{judge.email}</p>
                  </div>

                  {isAlreadyAssigned ? (
                    <Badge className="bg-gray-200 text-gray-700">Assigned</Badge>
                  ) : isSelected ? (
                    <span className="rounded-full bg-[#2E7D32] p-1 text-white">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })
        )}
      </div>

      <DialogFooter className="touch-footer">
        <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto"
          disabled={selectedJudgeIds.length === 0}
        >
          Assign Selected Judges
        </Button>
      </DialogFooter>
    </form>
  );
}

// ============================================
// PAGEANT RESULTS DISPLAY
// ============================================
function PageantResultsDisplay({
  results,
  scoringMethod,
  pageant,
}: {
  results: PageantResultsResponse;
  scoringMethod?: Pageant['scoringMethod'];
  pageant?: Pageant | null;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolvedScoringMode = (firstResult?: PageantResult) =>
    firstResult?.scoringMode ||
    (scoringMethod === 'average'
      ? 'AVERAGE'
      : scoringMethod === 'ranking'
      ? 'RANKING'
      : scoringMethod === 'ranking_by_gender'
      ? 'RANKING_BY_GENDER'
      : 'WEIGHTED_MEAN');

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800"><Trophy className="h-3 w-3" /> Gold</span>;
    if (rank === 2) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700"><Medal className="h-3 w-3" /> Silver</span>;
    if (rank === 3) return <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700"><Medal className="h-3 w-3" /> Bronze</span>;
    return null;
  };

  const rowScoreDisplay = (result: PageantResult, mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    if (mode === 'AVERAGE') {
      const score = result.finalScore ?? result.totalScore;
      return { finalScore: `${score.toFixed(2)} / 10`, additional: 'Final score (/10)' };
    }

    if (mode === 'RANKING') {
      return {
        finalScore: `Rank #${result.rank}`,
        additional: `Average rank: ${(result.rankScore ?? result.totalScore).toFixed(2)}`,
      };
    }

    return {
      finalScore: `${(result.finalPercentage ?? result.weightedScore).toFixed(2)}%`,
      additional: `Final rating: ${(result.finalRating ?? result.totalScore).toFixed(2)} / 10`,
    };
  };

  const chartDataFor = (list: PageantResult[], mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    const maxRank = Math.max(...list.map((r) => r.rank), 1);
    return list.map((r) => {
      if (mode === 'AVERAGE') {
        const pct = ((r.finalScore ?? r.totalScore) / 10) * 100;
        return { name: `#${r.contestantNumber}`, fullName: r.contestantName, value: Number(pct.toFixed(2)), label: `${pct.toFixed(1)}%` };
      }

      if (mode === 'RANKING') {
        const pct = maxRank === 1 ? 100 : ((maxRank - r.rank) / (maxRank - 1)) * 100;
        return { name: `#${r.contestantNumber}`, fullName: r.contestantName, value: Number(pct.toFixed(2)), label: `#${r.rank}` };
      }

      const pct = r.finalPercentage ?? r.weightedScore;
      return { name: `#${r.contestantNumber}`, fullName: r.contestantName, value: Number(pct.toFixed(2)), label: `${pct.toFixed(1)}%` };
    });
  };

  const sortResultsByMode = (list: PageantResult[], mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    const sorted = [...list];

    if (mode === 'RANKING') {
      sorted.sort((a, b) => a.rank - b.rank);
      return sorted;
    }

    if (mode === 'AVERAGE') {
      sorted.sort((a, b) => (b.finalScore ?? b.totalScore) - (a.finalScore ?? a.totalScore));
      return sorted;
    }

    sorted.sort((a, b) => (b.finalPercentage ?? b.weightedScore) - (a.finalPercentage ?? a.weightedScore));
    return sorted;
  };

  const renderComparisonChart = (
    title: string,
    list: PageantResult[],
    mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING'
  ) => {
    if (list.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No contestants in this section.
        </div>
      );
    }

    const chartData = chartDataFor(sortResultsByMode(list, mode), mode);

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h5 className="font-semibold text-gray-900">{title}</h5>
          <p className="text-xs text-gray-500">
            {mode === 'RANKING' ? 'Higher bar means better rank (lower is better).' : 'Higher bar means better score.'}
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, _name, item) => [
                mode === 'RANKING' ? `${item.payload.label} (${value.toFixed(1)}%)` : `${value.toFixed(1)}%`,
                item.payload.fullName,
              ]}
            />
            <Bar dataKey="value" fill="#1E3A8A" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="label" position="top" fill="#1F2937" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-3 lg:grid-cols-4">
          {chartData.map((row) => (
            <div key={row.fullName} className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
              <span className="font-medium text-gray-800">{row.name}</span> {row.label}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDetails = (result: PageantResult) => {
    const judgeScoreRows = (result.judgeScores || []).map((j) => ({
      name: j.judgeLabel,
      value: Number(j.percentage.toFixed(2)),
    }));

    return (
      <div className="space-y-4 bg-[#F8FAFC] p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h6 className="mb-3 text-sm font-semibold text-gray-900">Judge Scores</h6>
          {judgeScoreRows.length === 0 ? (
            <p className="text-sm text-gray-500">No judge score breakdown available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={judgeScoreRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(2)}%`, 'Score']} />
                <Bar dataKey="value" fill="#2E7D32" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <h6 className="mb-3 text-sm font-semibold text-gray-900">Criteria Breakdown</h6>
          <div className="overflow-x-auto">
            <table className="min-w-[720px] w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Criteria</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                  <th className="px-3 py-2 text-right font-medium">Max Score</th>
                  <th className="px-3 py-2 text-right font-medium">Weight</th>
                  <th className="px-3 py-2 text-right font-medium">Computed</th>
                </tr>
              </thead>
              <tbody>
                {result.criteriaBreakdown.map((c) => (
                  <tr key={c.criteriaId} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-800">{c.criteriaName}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{c.averageScore.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{(c.maxScore ?? 10).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{c.weight.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right font-medium text-gray-900">{(c.computed ?? c.weightedContribution).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRankingTable = (
    title: string,
    list: PageantResult[],
    mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING'
  ) => {
    if (list.length === 0) {
      return (
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
          No contestants in this section.
        </div>
      );
    }

    const sortedList = sortResultsByMode(list, mode);

    return (
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-3">
          <h5 className="font-semibold text-gray-900">{title}</h5>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Rank</th>
                <th className="px-3 py-2 text-left font-medium">Contestant</th>
                <th className="px-3 py-2 text-right font-medium">Final Score</th>
                <th className="px-3 py-2 text-right font-medium">Additional Info</th>
                <th className="px-3 py-2 text-center font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {sortedList.map((result) => {
                const expanded = expandedRows.has(result.contestantId);
                const score = rowScoreDisplay(result, mode);
                const topRowClass =
                  result.rank === 1
                    ? 'bg-yellow-50'
                    : result.rank === 2
                    ? 'bg-gray-50'
                    : result.rank === 3
                    ? 'bg-orange-50'
                    : 'bg-white';

                return (
                  <Fragment key={result.contestantId}>
                    <tr
                      className={`border-t border-gray-100 ${topRowClass} cursor-pointer hover:bg-blue-50/40`}
                      onClick={() => toggleRow(result.contestantId)}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">#{result.rank}</span>
                          {rankBadge(result.rank)}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          {result.photoPath || result.photoUrl ? (
                            <img
                              src={result.photoPath || result.photoUrl}
                              alt={result.contestantName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1E3A8A] text-white font-medium">
                              {result.contestantName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{result.contestantName}</p>
                            <p className="text-xs text-gray-500">Contestant #{result.contestantNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-gray-900">{score.finalScore}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{score.additional}</td>
                      <td className="px-3 py-2 text-center text-gray-600">
                        {expanded ? <ChevronUp className="mx-auto h-4 w-4" /> : <ChevronDown className="mx-auto h-4 w-4" />}
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="border-t border-gray-100">
                        <td colSpan={5}>{renderDetails(result)}</td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderHeader = (totalContestants: number, sectionLabel: string) => (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Pageant</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{pageant?.name || sectionLabel}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Scoring Method</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{formatScoringMethod(scoringMethod || 'weighted')}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Contestants</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{totalContestants}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{pageant?.status ? formatPageantStatus(pageant.status) : 'Completed'}</p>
        </div>
      </div>
    </div>
  );

  if (Array.isArray(results)) {
    if (results.length === 0) {
      return (
        <div className="text-center py-8">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No results available yet.</p>
        </div>
      );
    }

    const mode = resolvedScoringMode(results[0]);
    const baseMode = mode === 'RANKING' ? 'RANKING' : mode === 'AVERAGE' ? 'AVERAGE' : 'WEIGHTED_MEAN';
    const sortedOverall = sortResultsByMode(results, baseMode);
    const winner = sortedOverall[0];
    const firstRunnerUp = sortedOverall[1] || null;
    const secondRunnerUp = sortedOverall[2] || null;

    return (
      <div className="space-y-6">
        {renderHeader(results.length, 'Overall Results')}

        <div className="rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Crown className="h-5 w-5 text-yellow-600" />
            Winner: {winner.contestantName}
          </h4>
          <p className="mt-1 text-sm text-gray-700">{rowScoreDisplay(winner, baseMode).finalScore}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <p className="rounded border border-yellow-200 bg-white px-3 py-2 text-gray-700">
              1st Runner-up: <span className="font-medium text-gray-900">{firstRunnerUp?.contestantName || 'N/A'}</span>
            </p>
            <p className="rounded border border-yellow-200 bg-white px-3 py-2 text-gray-700">
              2nd Runner-up: <span className="font-medium text-gray-900">{secondRunnerUp?.contestantName || 'N/A'}</span>
            </p>
          </div>
        </div>

        {renderRankingTable('Ranking Table', results, baseMode)}
        {renderComparisonChart('Comparison Chart', results, baseMode)}
      </div>
    );
  }

  const totalContestants = results.maleResults.length + results.femaleResults.length;
  if (totalContestants === 0) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No results available yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderHeader(totalContestants, 'Division Results')}

      {results.warnings && results.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {results.warnings.join(' ')}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Crown className="h-5 w-5 text-yellow-600" /> Male Winner
          </h4>
          <p className="mt-1 text-sm text-gray-700">{results.maleWinner?.contestantName || 'N/A'}</p>
          {results.maleWinner ? <p className="text-sm font-medium text-gray-900">{rowScoreDisplay(results.maleWinner, 'RANKING').finalScore}</p> : null}
        </div>
        <div className="rounded-lg border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-4">
          <h4 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Crown className="h-5 w-5 text-yellow-600" /> Female Winner
          </h4>
          <p className="mt-1 text-sm text-gray-700">{results.femaleWinner?.contestantName || 'N/A'}</p>
          {results.femaleWinner ? <p className="text-sm font-medium text-gray-900">{rowScoreDisplay(results.femaleWinner, 'RANKING').finalScore}</p> : null}
        </div>
      </div>

      {renderRankingTable('Male Ranking Table', results.maleResults, 'RANKING')}
      {renderComparisonChart('Male Division Comparison', results.maleResults, 'RANKING')}

      {renderRankingTable('Female Ranking Table', results.femaleResults, 'RANKING')}
      {renderComparisonChart('Female Division Comparison', results.femaleResults, 'RANKING')}
    </div>
  );
}





