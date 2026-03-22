import { useState, useEffect, useCallback } from 'react';
import {
  Crown,
  Star,
  CheckCircle,
  Clock,
  Info,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getJudgePageants,
  getContestantsByPageant,
  getCriteriaByPageant,
  hasJudgeScoredContestant,
  getJudgeScores,
  submitScores,
} from '@/services/pageantService';
import type { Pageant, Contestant, Criteria, Score, User } from '@/types';
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

  const fetchData = useCallback(async () => {
    if (user) {
      const judgePageants = await getJudgePageants(user.id);
      setPageants(judgePageants);

      // Get all submitted scores
      const allScores: Score[] = [];
      await Promise.all(
        judgePageants.map(async (pageant) => {
          const contestants = await getContestantsByPageant(pageant.id);
          await Promise.all(
            contestants.map(async (contestant) => {
              const scores = await getJudgeScores(pageant.id, contestant.id, user!.id);
              allScores.push(...scores);
            })
          );
        })
      );
      setSubmittedScores(allScores);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchData();
    }
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
        </div>
      </div>
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
      const [c, cr] = await Promise.all([
        getContestantsByPageant(pageant.id),
        getCriteriaByPageant(pageant.id),
      ]);
      if (cancelled) return;
      setContestants(c);
      setCriteria(cr);
      const scored = new Set<string>();
      await Promise.all(
        c.map(async (cont) => {
          const is = await hasJudgeScoredContestant(pageant.id, cont.id, judgeId);
          if (is) scored.add(cont.id);
        })
      );
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
      const [c, js] = await Promise.all([
        getCriteriaByPageant(pageant.id),
        getJudgeScores(pageant.id, contestant.id, judgeId),
      ]);
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
                          Avg: {averageScore.toFixed(2)}
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




