import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import {
  Crown,
  Star,
  CheckCircle,
  Clock,
  Info,
  LogOut,
  Menu,
  X,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getJudgePageants,
  getContestantsByPageant,
  getCriteriaByPageant,
  getMyScoresByPageant,
  getPageantResults,
  submitScores,
} from '@/services/pageantService';
import type { Pageant, Contestant, Criteria, Score, User, PageantResult, PageantResultsResponse } from '@/types';
import { formatDate, formatDateTime, formatPageantStatus } from '@/utils/formatters';
import { useSupabaseProfile, DEFAULT_PROFILE_AVATAR } from '@/hooks/useSupabaseProfile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';

export default function JudgeDashboard() {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [pageants, setPageants] = useState<Pageant[]>([]);
  const [selectedPageant, setSelectedPageant] = useState<Pageant | null>(null);
  const [selectedContestant, setSelectedContestant] = useState<Contestant | null>(null);
  const [isScoringModalOpen, setIsScoringModalOpen] = useState(false);
  const [submittedScores, setSubmittedScores] = useState<Score[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedResultsPageant, setSelectedResultsPageant] = useState<Pageant | null>(null);
  const [pageantResults, setPageantResults] = useState<PageantResultsResponse>([]);
  const [loadingResults, setLoadingResults] = useState(false);

  const fetchData = useCallback(async () => {
    if (user) {
      const judgePageants = await getJudgePageants(user.id);
      setPageants(judgePageants);

      // Get all submitted scores
      const allScores: Score[] = [];
      await Promise.all(
        judgePageants.map(async (pageant) => {
          const pageantScores = await getMyScoresByPageant(pageant.id);
          allScores.push(...pageantScores);
        })
      );
      setSubmittedScores(allScores);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void fetchData();
    }
  }, [user, fetchData]);

  useEffect(() => {
    if (!user) return;
    Promise.resolve().then(() => {
      void fetchData();
    });
  }, [activeTab, user, fetchData]);

  useEffect(() => {
    const handleFocus = () => {
      if (!user) return;
      void fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, fetchData]);

  const handleSelectContestant = (contestant: Contestant) => {
    setSelectedContestant(contestant);
    setIsScoringModalOpen(true);
  };

  const handleSubmitScores = async (
    contestantId: string,
    scores: { criteriaId: string; score: number; notes?: string }[]
  ) => {
    if (selectedPageant && user) {
      const result = await submitScores(selectedPageant.id, contestantId, user.id, scores);

      if (result.success) {
        showSuccess(`Scores submitted successfully for ${selectedContestant?.firstName} ${selectedContestant?.lastName}`);
        setIsScoringModalOpen(false);
        setSelectedContestant(null);
        void fetchData();
      } else {
        showError(result.error || 'Failed to submit scores');
      }
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleViewResults = async (pageant: Pageant) => {
    setSelectedResultsPageant(pageant);
    setLoadingResults(true);
    try {
      const results = await getPageantResults(pageant.id);
      setPageantResults(results);
    } finally {
      setLoadingResults(false);
    }
  };

  const handleBackToResultsList = () => {
    setSelectedResultsPageant(null);
    setPageantResults([]);
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
          <p className="text-sm font-semibold text-[#1E3A8A]">Judge Panel</p>
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
            <h2 className="text-lg font-bold text-[#1E3A8A]">Judge Panel</h2>
            <p className="text-xs text-gray-500 mt-1">Navigation</p>
          </div>

          <div className="p-3 overflow-x-hidden overflow-y-auto md:flex-1">
            <TabsList className="h-auto w-full min-w-0 bg-transparent p-0 flex flex-col items-stretch justify-start gap-2 overflow-x-hidden md:flex-col md:overflow-visible">
              <TabsTrigger
                value="overview"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Info className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="pageants"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Crown className="w-4 h-4" />
                My Pageants
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <CheckCircle className="w-4 h-4" />
                My Scores
              </TabsTrigger>
              <TabsTrigger
                value="results"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <BarChart3 className="w-4 h-4" />
                Results
              </TabsTrigger>
              <TabsTrigger
                value="profile"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Star className="w-4 h-4" />
                Profile
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
                  <h1 className="text-xl font-bold text-white sm:text-2xl">Judge Portal</h1>
                  <p className="text-sm text-blue-200 mt-1">
                    Welcome, Judge {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <Badge className="w-fit bg-white/20 text-white border border-white/30">
                  <Star className="w-3 h-3 mr-1" />
                  Judge
                </Badge>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <TabsContent value="overview">
              <JudgeOverviewTab pageants={pageants} submittedScores={submittedScores} onNavigate={setActiveTab} />
            </TabsContent>

            <TabsContent value="pageants">
              {selectedPageant ? (
                <ScoringInterface
                  pageant={selectedPageant}
                  judgeId={user!.id}
                  onBack={() => {
                    setSelectedPageant(null);
                    setSelectedContestant(null);
                  }}
                  onSelectContestant={handleSelectContestant}
                />
              ) : (
                <PageantsList
                  pageants={pageants}
                  onSelectPageant={setSelectedPageant}
                />
              )}
            </TabsContent>

            <TabsContent value="history">
              <ScoringHistory scores={submittedScores} pageants={pageants} />
            </TabsContent>

            <TabsContent value="results">
              <JudgeResultsTab
                pageants={pageants}
                selectedPageant={selectedResultsPageant}
                results={pageantResults}
                loading={loadingResults}
                onViewResults={handleViewResults}
                onBack={handleBackToResultsList}
              />
            </TabsContent>

            <TabsContent value="profile">
              <JudgeProfile user={user!} />
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

      {/* Scoring Modal */}
      <Dialog open={isScoringModalOpen} onOpenChange={setIsScoringModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Score Contestant</DialogTitle>
            <DialogDescription>
              {selectedContestant && (
                <>
                  Scoring #{selectedContestant.contestantNumber} {selectedContestant.firstName} {selectedContestant.lastName}
                  {selectedPageant && ` for ${selectedPageant.name}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && selectedContestant && user && (
            <ScoringForm
              pageant={selectedPageant}
              contestant={selectedContestant}
              judgeId={user.id}
              onSubmit={handleSubmitScores}
              onCancel={() => {
                setIsScoringModalOpen(false);
                setSelectedContestant(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// JUDGE OVERVIEW TAB
// ============================================
function JudgeOverviewTab({
  pageants,
  submittedScores,
  onNavigate,
}: {
  pageants: Pageant[];
  submittedScores: Score[];
  onNavigate: (tab: string) => void;
}) {
  const assignedPageants = pageants.length;
  const activePageants = pageants.filter(p => p.status === 'active').length;
  const scoreRecords = submittedScores.length;
  // Unique contestants scored across all pageants
  const scoredContestants = new Set(submittedScores.map(s => `${s.pageantId}:${s.contestantId}`)).size;

  const statCards = [
    { label: 'Assigned Pageants', value: assignedPageants, colorClass: 'bg-purple-100 text-purple-600' },
    { label: 'Active Pageants', value: activePageants, colorClass: 'bg-green-100 text-green-600' },
    { label: 'Contestants Scored', value: scoredContestants, colorClass: 'bg-blue-100 text-blue-600' },
    { label: 'Score Records', value: scoreRecords, colorClass: 'bg-amber-100 text-amber-600' },
  ];

  const statusBadgeClass: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    upcoming: 'bg-blue-100 text-blue-800',
    draft: 'bg-gray-100 text-gray-700',
    completed: 'bg-purple-100 text-purple-800',
    archived: 'bg-gray-100 text-gray-500',
  };

  // Per-pageant score count
  const pageantScoreCounts = pageants.map(p => ({
    id: p.id,
    name: p.name,
    status: p.status,
    scored: new Set(
      submittedScores.filter(s => s.pageantId === p.id).map(s => s.contestantId)
    ).size,
  }));

  return (
    <div className="space-y-6">
      {/* Alert if active pageants have no scores yet */}
      {activePageants > 0 && scoreRecords === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Scoring is open!</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You have active pageants waiting for your scores.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
            <div className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${card.colorClass}`}>
              total
            </div>
          </div>
        ))}
      </div>

      {/* Per-Pageant Scoring Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">My Assigned Pageants</h3>
        {pageantScoreCounts.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {pageantScoreCounts.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400">{p.scored} contestant{p.scored !== 1 ? 's' : ''} scored</p>
                </div>
                <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusBadgeClass[p.status] || 'bg-gray-100 text-gray-700'}`}>
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No pageants assigned yet.</p>
        )}
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
            Score Contestants
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('history')}>
            <CheckCircle className="w-4 h-4 mr-2" />
            My Scoring History
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
// RESULTS TAB
// ============================================
function JudgeResultsTab({
  pageants,
  selectedPageant,
  results,
  loading,
  onViewResults,
  onBack,
}: {
  pageants: Pageant[];
  selectedPageant: Pageant | null;
  results: PageantResultsResponse;
  loading: boolean;
  onViewResults: (pageant: Pageant) => void;
  onBack: () => void;
}) {
  if (selectedPageant) {
    return (
      <JudgeResultsView
        pageant={selectedPageant}
        results={results}
        loading={loading}
        onBack={onBack}
      />
    );
  }

  if (pageants.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Results Available</h3>
        <p className="text-gray-500 mt-2">You are not assigned to any pageants.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#1E3A8A]">Assigned Pageant Results</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {pageants.map((pageant) => {
          const statusLabel =
            pageant.status === 'active'
              ? 'Ongoing'
              : pageant.status === 'completed'
              ? 'Completed'
              : pageant.status === 'upcoming'
              ? 'Upcoming'
              : pageant.status === 'draft'
              ? 'Draft'
              : pageant.status === 'archived'
              ? 'Archived'
              : 'Closed';

          const statusClass =
            pageant.status === 'active'
              ? 'bg-green-100 text-green-800'
              : pageant.status === 'completed'
              ? 'bg-purple-100 text-purple-800'
              : pageant.status === 'upcoming'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-700';

          return (
            <Card key={pageant.id} className="border border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg leading-tight">{pageant.name}</CardTitle>
                <CardDescription>{formatDate(pageant.eventDate)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Badge className={statusClass}>{statusLabel}</Badge>
                <div>
                  <p className="text-xs text-gray-500">Scoring Method</p>
                  <p className="text-sm font-medium text-gray-800">{formatScoringMethodLabel(pageant.scoringMethod)}</p>
                </div>
                <Button
                  className="w-full rounded-md bg-[#1E3A8A] font-medium hover:bg-[#162d6b]"
                  onClick={() => onViewResults(pageant)}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  View Results
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function formatScoringMethodLabel(method: Pageant['scoringMethod']) {
  if (method === 'average') return 'Average';
  if (method === 'weighted') return 'Weighted Mean';
  if (method === 'ranking_by_gender') return 'Ranking by Gender';
  return 'Ranking';
}

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
}

function JudgeResultsView({
  pageant,
  results,
  loading,
  onBack,
}: {
  pageant: Pageant;
  results: PageantResultsResponse;
  loading: boolean;
  onBack: () => void;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading results...</p>;
  }

  const isStandardResults = Array.isArray(results);
  const flatResults = isStandardResults ? results : [...results.maleResults, ...results.femaleResults];

  if (flatResults.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={onBack}>← Back to Results</Button>
        <p className="text-sm text-gray-500">No result records available yet for this pageant.</p>
      </div>
    );
  }

  const scoringMode =
    isStandardResults
      ? (results[0]?.scoringMode ||
        (pageant.scoringMethod === 'average'
          ? 'AVERAGE'
          : pageant.scoringMethod === 'ranking'
          ? 'RANKING'
          : 'WEIGHTED_MEAN'))
      : 'RANKING_BY_GENDER';

  const renderFinalValue = (result: PageantResult) => {
    if (scoringMode === 'AVERAGE') {
      return `Final Score: ${(result.finalScore ?? result.totalScore).toFixed(2)} / 10`;
    }

    if (scoringMode === 'RANKING' || scoringMode === 'RANKING_BY_GENDER') {
      return `Average Rank: ${(result.rankScore ?? result.totalScore).toFixed(2)} | Final Position: ${ordinal(result.rank)}`;
    }

    return `Final Percentage: ${(result.finalPercentage ?? result.weightedScore).toFixed(2)}% | Final Rating: ${(result.finalRating ?? result.totalScore).toFixed(2)} / 10`;
  };

  const renderRankingDivision = (title: string, divisionResults: PageantResult[], winnerLabel: string, winner: PageantResult | null) => (
    <Card className="border border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Badge className="bg-gray-100 text-gray-700">{divisionResults.length} contestant{divisionResults.length !== 1 ? 's' : ''}</Badge>
        </div>
        <CardDescription>
          {winner ? `${winnerLabel}: ${winner.contestantName}` : 'No contestants in this category'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {divisionResults.length === 0 ? (
          <p className="text-sm text-gray-500">No contestants in this category.</p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-gray-200">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Rank</th>
                  <th className="px-3 py-2 text-left font-medium">Contestant</th>
                  <th className="px-3 py-2 text-right font-medium">Average Rank</th>
                  <th className="px-3 py-2 text-right font-medium">Judges</th>
                </tr>
              </thead>
              <tbody>
                {divisionResults.map((result) => (
                  <tr key={result.contestantId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-semibold text-gray-800">#{result.rank}</td>
                    <td className="px-3 py-2 text-gray-900">{result.contestantName}</td>
                    <td className="px-3 py-2 text-right text-gray-800">{(result.rankScore ?? result.totalScore).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{result.judgeScores?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="outline" size="sm" onClick={onBack} className="mb-2">← Back to Results</Button>
          <h3 className="text-2xl font-bold text-gray-900">{pageant.name}</h3>
          <p className="text-sm text-gray-500 mt-1">Scoring Method: {formatScoringMethodLabel(pageant.scoringMethod)}</p>
        </div>
        <Badge className="w-fit bg-[#1E3A8A]/10 text-[#1E3A8A] border border-[#1E3A8A]/20">
          {flatResults.length} contestant{flatResults.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {isStandardResults ? (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {results.map((result) => (
          <Card key={result.contestantId} className="border border-gray-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {result.photoPath || result.photoUrl ? (
                    <img
                      src={result.photoPath || result.photoUrl}
                      alt={result.contestantName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center font-semibold">
                      {result.contestantName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{result.contestantName}</CardTitle>
                    <CardDescription>Contestant #{result.contestantNumber}</CardDescription>
                  </div>
                </div>
                <Badge className="bg-gray-100 text-gray-700">#{result.rank}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-800 mb-2">Judge Scores (0-100%)</p>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ReBarChart data={result.judgeScores || []} margin={{ top: 12, right: 10, left: -16, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis dataKey="judgeLabel" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={48} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => [`${Number(value).toFixed(2)}%`, 'Score']} />
                      <Bar dataKey="percentage" fill="#1E3A8A" radius={[6, 6, 0, 0]}>
                        <LabelList dataKey="percentage" position="top" formatter={(value: number) => `${Number(value).toFixed(1)}%`} />
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-gray-200">
                <table className="w-full min-w-[560px] text-sm">
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
                    {result.criteriaBreakdown.map((criterion) => {
                      const computed =
                        scoringMode === 'AVERAGE'
                          ? `${criterion.averageScore.toFixed(2)}`
                          : `${(criterion.computed ?? criterion.weightedContribution).toFixed(2)}%`;

                      return (
                        <tr key={criterion.criteriaId} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-800">{criterion.criteriaName}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{criterion.averageScore.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{(criterion.maxScore ?? 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-gray-700">{criterion.weight.toFixed(2)}%</td>
                          <td className="px-3 py-2 text-right font-medium text-gray-900">{computed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="rounded-md border border-[#1E3A8A]/20 bg-[#1E3A8A]/5 px-3 py-2 text-sm font-medium text-[#1E3A8A]">
                {renderFinalValue(result)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      ) : (
        <div className="space-y-5">
          {results.warnings && results.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {results.warnings.join(' ')}
            </div>
          )}

          <Card className="border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardHeader>
              <CardTitle className="text-lg text-gray-900">Division Winners</CardTitle>
              <CardDescription>
                Male Winner: {results.maleWinner?.contestantName || 'N/A'} | Female Winner: {results.femaleWinner?.contestantName || 'N/A'}
              </CardDescription>
            </CardHeader>
          </Card>

          {renderRankingDivision('Male Division', results.maleResults, 'Male Winner', results.maleWinner)}
          {renderRankingDivision('Female Division', results.femaleResults, 'Female Winner', results.femaleWinner)}
        </div>
      )}

      {isStandardResults && (
      <Card className="border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
        <CardHeader>
          <CardTitle className="text-lg text-gray-900">Winner: {results[0].contestantName}</CardTitle>
          <CardDescription>
            {scoringMode === 'RANKING'
              ? `Average Rank: ${(results[0].rankScore ?? results[0].totalScore).toFixed(2)} | Position: ${ordinal(results[0].rank)}`
              : scoringMode === 'AVERAGE'
              ? `Score: ${(results[0].finalScore ?? results[0].totalScore).toFixed(2)} / 10`
              : `Score: ${(results[0].finalPercentage ?? results[0].weightedScore).toFixed(2)}%`}
          </CardDescription>
        </CardHeader>
      </Card>
      )}
    </div>
  );
}

// ============================================
// PAGEANTS LIST
// ============================================
function PageantsList({
  pageants,
  onSelectPageant,
}: {
  pageants: Pageant[];
  onSelectPageant: (pageant: Pageant) => void;
}) {
  if (pageants.length === 0) {
    return (
      <div className="text-center py-12">
        <Crown className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Assigned Pageants</h3>
        <p className="text-gray-500 mt-2">You are not assigned as a judge to any pageants.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pageants.map((pageant) => (
          <Card
            key={pageant.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onSelectPageant(pageant)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{pageant.name}</CardTitle>
                  <CardDescription className="mt-1">
                    {formatPageantStatus(pageant.status)}
                  </CardDescription>
                </div>
                <Badge
                  className={
                    pageant.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }
                >
                  {pageant.status === 'active' ? 'Scoring Open' : 'Scoring Closed'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                {pageant.description}
              </p>
              <div className="flex items-center text-sm text-gray-500">
                <Clock className="w-4 h-4 mr-2" />
                Event on {formatDate(pageant.eventDate)}
              </div>
              <Button className="w-full mt-4 bg-[#2E7D32] hover:bg-[#1B5E20] rounded-md font-medium">
                <Star className="w-4 h-4 mr-2" />
                Start Scoring
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SCORING INTERFACE
// ============================================
function ScoringInterface({
  pageant,
  judgeId,
  onBack,
  onSelectContestant,
}: {
  pageant: Pageant;
  judgeId: string;
  onBack: () => void;
  onSelectContestant: (contestant: Contestant) => void;
}) {
  const [contestants, setContestants] = useState<Contestant[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scoredSet, setScoredSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [c, cr, pageantScores] = await Promise.all([
        getContestantsByPageant(pageant.id),
        getCriteriaByPageant(pageant.id),
        getMyScoresByPageant(pageant.id),
      ]);
      if (cancelled) return;
      setContestants(c);
      setCriteria(cr);

      const criteriaIds = new Set(cr.map((item) => item.id));
      const scored = new Set<string>();
      c.forEach((cont) => {
        const scoredCriteria = new Set(
          pageantScores
            .filter((s) => s.contestantId === cont.id)
            .map((s) => s.criteriaId)
        );

        const isFullyScored = [...criteriaIds].every((criteriaId) => scoredCriteria.has(criteriaId));
        if (isFullyScored) scored.add(cont.id);
      });

      if (!cancelled) setScoredSet(new Set(scored));
    }
    void load();
    return () => { cancelled = true; };
  }, [pageant.id, judgeId]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="outline" size="sm" onClick={onBack} className="mb-2 touch-target sm:min-h-9">
            ← Back to Pageants
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">{pageant.name}</h2>
          <p className="text-gray-500 mt-1">{pageant.description}</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-2">
            <Clock className="w-3 h-3 mr-1" />
            Event on {formatDate(pageant.eventDate)}
          </Badge>
        </div>
      </div>

      {/* Scoring Criteria Info */}
        <div className="bg-blue-50 border border-[#1E3A8A]/20 rounded-lg p-4">
          <h4 className="font-medium text-[#1E3A8A] flex items-center gap-2 mb-2">
          <Info className="w-4 h-4" />
          Scoring Criteria
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {criteria.map((c) => (
            <div key={c.id} className="bg-white rounded p-2 text-sm">
              <span className="font-medium">{c.name}</span>
              <span className="text-gray-500 ml-2">({c.weight}%)</span>
              <span className="text-gray-400 block">Max: {c.maxScore}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contestants */}
      <div>
        <h3 className="text-lg font-semibold text-[#1E3A8A] mb-4">Contestants</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contestants.map((contestant) => {
            const isScored = scoredSet.has(contestant.id);

            return (
              <div
                key={contestant.id}
                className={`border rounded-lg overflow-hidden transition-shadow ${
                  isScored
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 hover:shadow-md'
                }`}
              >
                <div className="aspect-square bg-gray-100 relative">
                  {contestant.photoPath || contestant.photoUrl ? (
                    <img
                      src={contestant.photoPath || contestant.photoUrl}
                      alt={`${contestant.firstName} ${contestant.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#1E3A8A]">
                      <span className="text-4xl font-bold text-white">
                        {contestant.firstName[0]}{contestant.lastName[0]}
                      </span>
                    </div>
                  )}
                  {isScored && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                      <CheckCircle className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">
                      #{contestant.contestantNumber} {contestant.firstName} {contestant.lastName}
                    </h4>
                  </div>
                  {contestant.department && (
                    <p className="text-sm text-gray-500 mb-2">{contestant.department}</p>
                  )}
                  {isScored ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Scored</span>
                    </div>
                  ) : pageant.status === 'active' ? (
                    <Button
                      className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20]"
                      onClick={() => onSelectContestant(contestant)}
                    >
                      <Star className="w-4 h-4 mr-2" />
                      Score Contestant
                    </Button>
                  ) : (
                    <Button variant="outline" className="touch-target w-full" disabled>
                      Scoring Closed
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SCORING FORM
// ============================================
function ScoringForm({
  pageant,
  contestant,
  judgeId,
  onSubmit,
  onCancel,
}: {
  pageant: Pageant;
  contestant: Contestant;
  judgeId: string;
  onSubmit: (contestantId: string, scores: { criteriaId: string; score: number; notes?: string }[]) => void;
  onCancel: () => void;
}) {
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [judgeScores, setJudgeScores] = useState<Score[]>([]);
  const [scoredIds, setScoredIds] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, { score: number; notes: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const [c, pageantScores] = await Promise.all([
        getCriteriaByPageant(pageant.id),
        getMyScoresByPageant(pageant.id),
      ]);
      const js = pageantScores.filter((score) => score.contestantId === contestant.id);
      setCriteria(c);
      setJudgeScores(js);
      const si = new Set(js.map((s) => s.criteriaId));
      setScoredIds(si);
      const initial: Record<string, { score: number; notes: string }> = {};
      c.forEach((cr) => {
        const ex = js.find((s) => s.criteriaId === cr.id);
        initial[cr.id] = ex
          ? { score: ex.score, notes: ex.notes || '' }
          : { score: cr.maxScore / 2, notes: '' };
      });
      setScores(initial);
      setLoading(false);
    }
    void init();
  }, [pageant.id, contestant.id, judgeId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter out already scored criteria
    const newScores = criteria
      .filter((c) => !scoredIds.has(c.id))
      .map((c) => ({
        criteriaId: c.id,
        score: scores[c.id]?.score || 0,
        notes: scores[c.id]?.notes,
      }));

    if (newScores.length === 0) {
      onCancel();
      return;
    }

    onSubmit(contestant.id, newScores);
  };

  const updateScore = (criteriaId: string, score: number) => {
    setScores((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], score },
    }));
  };

  const updateNotes = (criteriaId: string, notes: string) => {
    setScores((prev) => ({
      ...prev,
      [criteriaId]: { ...prev[criteriaId], notes },
    }));
  };

  const unscoredCriteria = criteria.filter((c) => !scoredIds.has(c.id));

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading scoring data...</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {criteria.map((c) => {
        const isScored = scoredIds.has(c.id);
        const existingScore = judgeScores.find((s) => s.criteriaId === c.id);

        return (
          <div
            key={c.id}
            className={`p-4 rounded-lg ${
              isScored ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <Label className="font-medium text-gray-900">{c.name}</Label>
                <p className="text-sm text-gray-500">{c.description}</p>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-500">Weight: {c.weight}%</span>
                {isScored && (
                  <Badge className="ml-2 bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Scored
                  </Badge>
                )}
              </div>
            </div>

            {isScored ? (
              <div className="flex items-center gap-2 text-green-700">
                <Star className="w-5 h-5" />
                <span className="font-semibold">{existingScore?.score.toFixed(2)}</span>
                <span className="text-sm text-gray-500">/ {c.maxScore}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <Slider
                    value={[scores[c.id]?.score || 0]}
                    onValueChange={(value) => updateScore(c.id, value[0])}
                    max={c.maxScore}
                    step={0.1}
                    className="flex-1"
                  />
                  <div className="w-20 text-right">
                    <Input
                      type="number"
                      min={0}
                      max={c.maxScore}
                      step={0.1}
                      value={scores[c.id]?.score || 0}
                      onChange={(e) => updateScore(c.id, parseFloat(e.target.value))}
                      className="h-11 w-20 text-right sm:h-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor={`notes-${c.id}`} className="text-sm text-gray-500">
                    Notes (optional)
                  </Label>
                  <Textarea
                    id={`notes-${c.id}`}
                    value={scores[c.id]?.notes || ''}
                    onChange={(e) => updateNotes(c.id, e.target.value)}
                    rows={2}
                    placeholder="Add any comments about this criteria..."
                  />
                </div>
              </>
            )}
          </div>
        );
      })}

      {unscoredCriteria.length > 0 ? (
        <DialogFooter className="touch-footer">
          <Button type="button" variant="outline" className="touch-target w-full sm:w-auto" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto">
            <CheckCircle className="w-4 h-4 mr-2" />
            Submit Scores
          </Button>
        </DialogFooter>
      ) : (
        <div className="text-center py-4">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-green-700 font-medium">All criteria scored!</p>
          <Button type="button" variant="outline" onClick={onCancel} className="mt-4 touch-target w-full sm:w-auto">
            Close
          </Button>
        </div>
      )}
    </form>
  );
}

// ============================================
// SCORING HISTORY
// ============================================
function ScoringHistory({
  scores,
  pageants,
}: {
  scores: Score[];
  pageants: Pageant[];
}) {
  const [criteriaByPageant, setCriteriaByPageant] = useState<Record<string, Criteria[]>>({});

  useEffect(() => {
    const pageantIds = [...new Set(scores.map((score) => score.pageantId))];

    if (pageantIds.length === 0) {
      Promise.resolve().then(() => setCriteriaByPageant({}));
      return;
    }

    async function loadCriteria() {
      const entries = await Promise.all(
        pageantIds.map(async (pageantId) => {
          const criteria = await getCriteriaByPageant(pageantId);
          return [pageantId, criteria] as const;
        })
      );

      const nextMap: Record<string, Criteria[]> = {};
      entries.forEach(([pageantId, criteria]) => {
        nextMap[pageantId] = criteria;
      });

      setCriteriaByPageant(nextMap);
    }

    void loadCriteria();
  }, [scores]);

  if (scores.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Scores Submitted</h3>
        <p className="text-gray-500 mt-2">You haven't submitted any scores yet.</p>
      </div>
    );
  }

  // Group scores by pageant and contestant
  const groupedScores: Record<string, Record<string, Score[]>> = {};
  scores.forEach((score) => {
    if (!groupedScores[score.pageantId]) {
      groupedScores[score.pageantId] = {};
    }
    if (!groupedScores[score.pageantId][score.contestantId]) {
      groupedScores[score.pageantId][score.contestantId] = [];
    }
    groupedScores[score.pageantId][score.contestantId].push(score);
  });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#1E3A8A]">My Scoring History</h3>

      {Object.entries(groupedScores).map(([pageantId, contestants]) => {
        const pageant = pageants.find(p => p.id === pageantId);
        if (!pageant) return null;

        return (
          <Card key={pageantId}>
            <CardHeader>
              <CardTitle className="text-lg">{pageant.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(contestants).map(([contestantId, contestantScores]) => {
                  const totalScore = contestantScores.reduce((sum, s) => sum + s.score, 0);
                  const averageScore = totalScore / contestantScores.length;
                  const criteria = criteriaByPageant[pageantId] || [];

                  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
                  const criteriaById: Record<string, Criteria> = {};
                  criteria.forEach((criterion) => {
                    criteriaById[criterion.id] = criterion;
                  });

                  const weightedMean = contestantScores.reduce((sum, scoreEntry) => {
                    const criterion = criteriaById[scoreEntry.criteriaId];
                    if (!criterion || criterion.maxScore <= 0 || totalWeight <= 0) return sum;

                    const adjustedWeight = (criterion.weight / totalWeight) * 100;
                    const normalized = scoreEntry.score / criterion.maxScore;
                    return sum + normalized * adjustedWeight;
                  }, 0);

                  const scoreSummary =
                    pageant.scoringMethod === 'weighted'
                      ? {
                          label: 'Weighted Mean',
                          value: `${weightedMean.toFixed(2)}%`,
                        }
                      : pageant.scoringMethod === 'ranking'
                      ? {
                          label: 'Rank Input Avg',
                          value: averageScore.toFixed(2),
                        }
                      : {
                          label: 'Average',
                          value: averageScore.toFixed(2),
                        };

                  return (
                    <div
                      key={contestantId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          Contestant scored
                        </p>
                        <p className="text-sm text-gray-500">
                          {contestantScores.length} criteria scored
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {scoreSummary.label}: {scoreSummary.value}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(contestantScores[0].submittedAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// JUDGE PROFILE
// ============================================
function JudgeProfile({ user }: { user: User }) {
  const { profile, isLoading } = useSupabaseProfile();
  const displayName = profile?.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
  const displayEmail = profile?.email || user.email || 'No email available';
  const displayAvatar = profile?.avatarUrl || user.photoUrl || user.photoPath || DEFAULT_PROFILE_AVATAR;

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>Your judge account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center gap-4" aria-busy="true" aria-live="polite">
              <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-52 bg-gray-200 rounded animate-pulse" />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-2xl font-bold">
                <img
                  src={displayAvatar}
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_PROFILE_AVATAR;
                  }}
                />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{displayName}</h3>
                <p className="text-gray-500">{displayEmail}</p>
                <Badge className="mt-2 bg-[#1E3A8A]/10 text-[#1E3A8A] border border-[#1E3A8A]/20">
                  <Star className="w-3 h-3 mr-1" />
                  Judge
                </Badge>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 pt-4 border-t border-gray-100 sm:grid-cols-2">
            <div>
              <ProfileLabel>First Name</ProfileLabel>
              <p className="text-sm text-gray-900 mt-1">{profile ? displayName.split(/\s+/)[0] || 'User' : user.firstName || 'User'}</p>
            </div>
            <div>
              <ProfileLabel>Last Name</ProfileLabel>
              <p className="text-sm text-gray-900 mt-1">{profile ? displayName.split(/\s+/).slice(1).join(' ') || 'N/A' : user.lastName || 'N/A'}</p>
            </div>
            <div>
              <ProfileLabel>Email</ProfileLabel>
              <p className="text-sm text-gray-900 mt-1">{displayEmail}</p>
            </div>
            <div>
              <ProfileLabel>Account Status</ProfileLabel>
              <Badge
                className={
                  user.isActive
                    ? 'bg-green-100 text-green-800 mt-1'
                    : 'bg-red-100 text-red-800 mt-1'
                }
              >
                {user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-500">{children}</p>;
}




