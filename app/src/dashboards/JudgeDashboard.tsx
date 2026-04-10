import { useState, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LabelList,
} from 'recharts';
import {
  Crown, Star, CheckCircle, Clock, Info, LogOut, Menu, X, BarChart3, Vote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getJudgePageants, getContestantsByPageant, getCriteriaByPageant,
  getMyScoresByPageant, getPageantResults, submitScores,
} from '@/services/pageantService';
import type { Pageant, Contestant, Criteria, Score, User, PageantResult, PageantResultsResponse } from '@/types';
import { formatDate, formatDateTime, formatPageantStatus } from '@/utils/formatters';
import { useSupabaseProfile, DEFAULT_PROFILE_AVATAR } from '@/hooks/useSupabaseProfile';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

// ─── Shared design primitives (same system as all dashboards) ─────────────────
const NAV = [
  { value: 'overview',  label: 'Overview',         icon: Info },
  { value: 'pageants',  label: 'My Pageants',       icon: Crown },
  { value: 'history',   label: 'My Scores',         icon: CheckCircle },
  { value: 'results',   label: 'Results',           icon: BarChart3 },
  { value: 'profile',   label: 'Profile',           icon: Star },
];

const ActionBtn = ({
  type = 'button', onClick, disabled, children, color = 'blue', fullWidth = false, size = 'md',
}: {
  type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean;
  children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'outline' | 'amber';
  fullWidth?: boolean; size?: 'sm' | 'md';
}) => {
  const palette = {
    blue:    'bg-[#1E3A8A] hover:bg-[#1d3580] text-white shadow-sm shadow-blue-200',
    green:   'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200',
    red:     'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
    amber:   'bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-200',
  };
  const sz = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';
  return (
    <button
      type={type} onClick={onClick} disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold rounded-xl
        transition-all duration-150 hover:-translate-y-px active:translate-y-0
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0
        ${palette[color]} ${sz} ${fullWidth ? 'w-full' : ''}
      `}
    >
      {children}
    </button>
  );
};

const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>{children}</div>
);

const CardHeading = ({ eyebrow, title }: { eyebrow?: string; title: string }) => (
  <div className="mb-5">
    {eyebrow && <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{eyebrow}</p>}
    <h3 className="text-base font-extrabold text-gray-900 tracking-tight">{title}</h3>
  </div>
);

const StatusPill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active:    'bg-green-50 text-green-700 border border-green-200',
    upcoming:  'bg-blue-50 text-blue-700 border border-blue-200',
    draft:     'bg-amber-50 text-amber-700 border border-amber-200',
    completed: 'bg-purple-50 text-purple-700 border border-purple-200',
    archived:  'bg-gray-100 text-gray-500 border border-gray-200',
    closed:    'bg-gray-100 text-gray-600 border border-gray-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
};

// ─── Helper functions (unchanged) ────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function JudgeDashboard() {
  // ── All logic unchanged ───────────────────────────────────────────────────
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab]                     = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen]   = useState(false);
  const [pageants, setPageants]                       = useState<Pageant[]>([]);
  const [selectedPageant, setSelectedPageant]         = useState<Pageant | null>(null);
  const [selectedContestant, setSelectedContestant]   = useState<Contestant | null>(null);
  const [isScoringModalOpen, setIsScoringModalOpen]   = useState(false);
  const [submittedScores, setSubmittedScores]         = useState<Score[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen]         = useState(false);
  const [selectedResultsPageant, setSelectedResultsPageant] = useState<Pageant | null>(null);
  const [pageantResults, setPageantResults]           = useState<PageantResultsResponse>([]);
  const [loadingResults, setLoadingResults]           = useState(false);
  const [resultsNotice, setResultsNotice]             = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (user) {
      const judgePageants = await getJudgePageants(user.id);
      setPageants(judgePageants);
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

  useEffect(() => { if (user) { void fetchData(); } }, [user, fetchData]);
  useEffect(() => {
    if (!user) return;
    Promise.resolve().then(() => { void fetchData(); });
  }, [activeTab, user, fetchData]);
  useEffect(() => {
    const handleFocus = () => { if (!user) return; void fetchData(); };
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
        showSuccess(`Scores submitted for ${selectedContestant?.firstName} ${selectedContestant?.lastName}`);
        setIsScoringModalOpen(false);
        setSelectedContestant(null);
        void fetchData();
      } else { showError(result.error || 'Failed to submit scores'); }
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleViewResults = async (pageant: Pageant) => {
    if (!pageant.resultsPublic) {
      setResultsNotice('Results are not yet published by admin for this pageant.');
      return;
    }

    setResultsNotice(null);
    setSelectedResultsPageant(pageant);
    setLoadingResults(true);
    try {
      const results = await getPageantResults(pageant.id);
      setPageantResults(results);
    } catch {
      setResultsNotice('Unable to load results right now. Please try again.');
    } finally { setLoadingResults(false); }
  };

  const handleBackToResultsList = () => {
    setSelectedResultsPageant(null);
    setPageantResults([]);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FC] overflow-x-hidden">
      <Tabs
        value={activeTab}
        onValueChange={(value) => { setActiveTab(value); setIsMobileNavOpen(false); }}
        className="min-h-screen"
      >
        {/* ── MOBILE TOP BAR ───────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 flex items-center justify-between bg-white border-b border-gray-100 px-4 py-3 md:hidden shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] flex items-center justify-center">
              <Crown className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">Judge Panel</span>
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

        {isMobileNavOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            aria-label="Close navigation overlay"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
        <aside className={`
          fixed inset-y-0 left-0 z-50 flex flex-col
          w-[80vw] max-w-[260px] bg-white border-r border-gray-100 shadow-xl
          transition-transform duration-200
          md:w-64 md:max-w-none md:translate-x-0 md:shadow-none
          ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center shadow-md shadow-blue-200">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">SchoolVote</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Judge Panel</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <TabsList className="h-auto w-full bg-transparent p-0 flex flex-col items-stretch gap-1">
              {NAV.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value} value={value}
                  className="
                    w-full justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left
                    text-gray-600 border border-transparent
                    hover:bg-gray-50 hover:text-gray-900
                    data-[state=active]:bg-[#EFF3FF] data-[state=active]:text-[#1E3A8A]
                    data-[state=active]:border-[#C7D7FD] data-[state=active]:font-semibold
                    transition-all
                  "
                >
                  <Icon className="w-4 h-4 shrink-0" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>

          <div className="p-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsLogoutDialogOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" /> Sign Out
            </button>
          </div>
        </aside>

        {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
        <main className="md:ml-64 min-w-0 flex flex-col min-h-screen">
          <header className="bg-gradient-to-r from-[#0c1f4a] to-[#1E3A8A] px-5 py-5 sm:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-extrabold text-white tracking-tight sm:text-2xl">
                  {NAV.find(n => n.value === activeTab)?.label ?? 'Judge Portal'}
                </h1>
                <p className="text-sm text-blue-200/80 mt-0.5">
                  Welcome, Judge {user?.firstName} {user?.lastName}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white w-fit">
                <Star className="w-3 h-3" /> Judge
              </span>
            </div>
          </header>

          <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
            <TabsContent value="overview">
              <JudgeOverviewTab pageants={pageants} submittedScores={submittedScores} onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="pageants">
              {selectedPageant ? (
                <ScoringInterface
                  pageant={selectedPageant}
                  judgeId={user!.id}
                  onBack={() => { setSelectedPageant(null); setSelectedContestant(null); }}
                  onSelectContestant={handleSelectContestant}
                />
              ) : (
                <PageantsList pageants={pageants} onSelectPageant={setSelectedPageant} />
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
                notice={resultsNotice}
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

      {/* ── LOGOUT DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={isLogoutDialogOpen} onOpenChange={setIsLogoutDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold tracking-tight">Sign out?</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">You'll be returned to the login page.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={() => setIsLogoutDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white" onClick={() => { void handleLogout(); }}>Sign Out</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SCORING MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={isScoringModalOpen} onOpenChange={setIsScoringModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Score Contestant</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">
              {selectedContestant && (
                <>Scoring #{selectedContestant.contestantNumber} {selectedContestant.firstName} {selectedContestant.lastName}{selectedPageant && ` for ${selectedPageant.name}`}</>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedPageant && selectedContestant && user && (
            <ScoringForm
              pageant={selectedPageant}
              contestant={selectedContestant}
              judgeId={user.id}
              onSubmit={handleSubmitScores}
              onCancel={() => { setIsScoringModalOpen(false); setSelectedContestant(null); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDGE OVERVIEW TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function JudgeOverviewTab({
  pageants, submittedScores, onNavigate,
}: { pageants: Pageant[]; submittedScores: Score[]; onNavigate: (tab: string) => void }) {

  const assignedPageants    = pageants.length;
  const activePageants      = pageants.filter(p => p.status === 'active').length;
  const scoreRecords        = submittedScores.length;
  const scoredContestants   = new Set(submittedScores.map(s => `${s.pageantId}:${s.contestantId}`)).size;

  const statCards = [
    { label: 'Assigned Pageants',   value: assignedPageants,  accent: 'bg-purple-50 text-purple-600',  icon: Crown },
    { label: 'Active Pageants',     value: activePageants,    accent: 'bg-green-50 text-green-600',    icon: Vote },
    { label: 'Contestants Scored',  value: scoredContestants, accent: 'bg-blue-50 text-blue-600',      icon: CheckCircle },
    { label: 'Score Records',       value: scoreRecords,      accent: 'bg-amber-50 text-amber-600',    icon: Star },
  ];

  const pageantScoreCounts = pageants.map(p => ({
    id: p.id, name: p.name, status: p.status,
    scored: new Set(submittedScores.filter(s => s.pageantId === p.id).map(s => s.contestantId)).size,
  }));

  return (
    <div className="space-y-6">
      {/* Active but unscored alert */}
      {activePageants > 0 && scoreRecords === 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-extrabold text-amber-800">Scoring is open!</p>
            <p className="text-sm text-amber-700 mt-0.5">You have active pageants waiting for your scores.</p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{card.label}</p>
                <p className="text-3xl font-extrabold text-gray-900 tracking-tight">{card.value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.accent}`}>
                <card.icon className="w-5 h-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Assigned pageants status */}
      <SectionCard>
        <CardHeading eyebrow="Status" title="My Assigned Pageants" />
        {pageantScoreCounts.length > 0 ? (
          <ul className="divide-y divide-gray-50">
            {pageantScoreCounts.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.scored} contestant{p.scored !== 1 ? 's' : ''} scored</p>
                </div>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No pageants assigned yet.</p>
        )}
      </SectionCard>

      {/* Quick actions */}
      <SectionCard>
        <CardHeading eyebrow="Shortcuts" title="Quick Actions" />
        <div className="flex flex-wrap gap-3">
          <ActionBtn onClick={() => onNavigate('pageants')} color="blue">
            <Crown className="w-4 h-4" /> Score Contestants
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('history')} color="outline">
            <CheckCircle className="w-4 h-4" /> My Scoring History
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('results')} color="outline">
            <BarChart3 className="w-4 h-4" /> View Results
          </ActionBtn>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function JudgeResultsTab({
  pageants, selectedPageant, results, loading, notice, onViewResults, onBack,
}: {
  pageants: Pageant[]; selectedPageant: Pageant | null;
  results: PageantResultsResponse; loading: boolean;
  notice: string | null;
  onViewResults: (pageant: Pageant) => void; onBack: () => void;
}) {
  if (selectedPageant) {
    return <JudgeResultsView pageant={selectedPageant} results={results} loading={loading} onBack={onBack} />;
  }

  if (pageants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
          <BarChart3 className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-base font-extrabold text-gray-700 tracking-tight">No Results Available</h3>
        <p className="text-sm text-gray-400 mt-1">You are not assigned to any pageants.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {notice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {notice}
        </div>
      )}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Analytics</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Assigned Pageant Results</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {pageants.map((pageant) => (
          <div
            key={pageant.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5 text-[#1E3A8A]" />
            </div>
            <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1">{pageant.name}</h3>
            <p className="text-xs text-gray-400 mb-1">{formatDate(pageant.eventDate)}</p>
            <p className="text-xs font-medium text-gray-500 mb-4">{formatScoringMethodLabel(pageant.scoringMethod)}</p>
            <div className="flex items-center justify-between mb-4">
              <StatusPill status={pageant.status} />
            </div>
            {pageant.resultsPublic ? (
              <ActionBtn color="blue" fullWidth onClick={() => onViewResults(pageant)}>
                <BarChart3 className="w-4 h-4" /> View Results
              </ActionBtn>
            ) : (
              <ActionBtn color="outline" fullWidth disabled>
                <Clock className="w-4 h-4" /> Waiting for Admin Publish
              </ActionBtn>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDGE RESULTS VIEW (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function JudgeResultsView({
  pageant, results, loading, onBack,
}: { pageant: Pageant; results: PageantResultsResponse; loading: boolean; onBack: () => void }) {

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
        Loading results…
      </div>
    );
  }

  const isStandardResults = Array.isArray(results);
  const flatResults = isStandardResults ? results : [...results.maleResults, ...results.femaleResults];

  if (flatResults.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
          ← Back to Results
        </button>
        <p className="text-sm text-gray-500">No result records available yet for this pageant.</p>
      </div>
    );
  }

  const scoringMode = isStandardResults
    ? (results[0]?.scoringMode || (pageant.scoringMethod === 'average' ? 'AVERAGE' : pageant.scoringMethod === 'ranking' ? 'RANKING' : 'WEIGHTED_MEAN'))
    : 'RANKING_BY_GENDER';

  const renderFinalValue = (result: PageantResult) => {
    if (scoringMode === 'AVERAGE') return `Final Score: ${(result.finalScore ?? result.totalScore).toFixed(2)} / 10`;
    if (scoringMode === 'RANKING' || scoringMode === 'RANKING_BY_GENDER') return `Average Rank: ${(result.rankScore ?? result.totalScore).toFixed(2)} | Final Position: ${ordinal(result.rank)}`;
    return `Final Percentage: ${(result.finalPercentage ?? result.weightedScore).toFixed(2)}% | Final Rating: ${(result.finalRating ?? result.totalScore).toFixed(2)} / 10`;
  };

  const renderRankingDivision = (title: string, divisionResults: PageantResult[], winnerLabel: string, winner: PageantResult | null) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50">
        <div className="flex items-center justify-between gap-3">
          <h4 className="text-base font-extrabold text-gray-900">{title}</h4>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200">
            {divisionResults.length} contestant{divisionResults.length !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{winner ? `${winnerLabel}: ${winner.contestantName}` : 'No contestants in this category'}</p>
      </div>
      <div className="p-5">
        {divisionResults.length === 0 ? (
          <p className="text-sm text-gray-400">No contestants in this category.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-[#1E3A8A]">
                <tr>
                  {['Rank', 'Contestant', 'Average Rank', 'Judges'].map((h, i) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider ${i >= 2 ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {divisionResults.map((result) => (
                  <tr key={result.contestantId} className="hover:bg-gray-50/70 transition-colors">
                    <td className="px-4 py-2.5 font-extrabold text-gray-900">#{result.rank}</td>
                    <td className="px-4 py-2.5 text-gray-900 font-medium">{result.contestantName}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{(result.rankScore ?? result.totalScore).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{result.judgeScores?.length ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mb-3">
            ← Back to Results
          </button>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{pageant.name}</h2>
          <p className="text-sm text-gray-500 mt-1">Scoring Method: {formatScoringMethodLabel(pageant.scoringMethod)}</p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#EFF3FF] border border-[#C7D7FD] text-xs font-semibold text-[#1E3A8A] w-fit">
          {flatResults.length} contestant{flatResults.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Standard results (average / weighted / ranking) */}
      {isStandardResults ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {results.map((result) => (
              <div key={result.contestantId} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Card header */}
                <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-lg font-extrabold shrink-0">
                      {result.photoPath || result.photoUrl ? (
                        <img src={result.photoPath || result.photoUrl} alt={result.contestantName} className="w-full h-full object-cover" />
                      ) : result.contestantName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-gray-900 truncate">{result.contestantName}</p>
                      <p className="text-xs text-gray-400">Contestant #{result.contestantNumber}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-200 text-xs font-extrabold text-gray-700">#{result.rank}</span>
                </div>

                <div className="p-5 space-y-4">
                  {/* Bar chart */}
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Judge Scores (0–100%)</p>
                    <div className="h-52 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ReBarChart data={result.judgeScores || []} margin={{ top: 12, right: 10, left: -16, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="judgeLabel" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={48} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                            formatter={(value: number) => [`${Number(value).toFixed(2)}%`, 'Score']}
                          />
                          <Bar dataKey="percentage" fill="#1E3A8A" radius={[6, 6, 0, 0]}>
                            <LabelList dataKey="percentage" position="top" formatter={(value: number) => `${Number(value).toFixed(1)}%`} style={{ fontSize: 10 }} />
                          </Bar>
                        </ReBarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Criteria breakdown table */}
                  <div className="overflow-x-auto rounded-2xl border border-gray-100">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead className="bg-[#1E3A8A]">
                        <tr>
                          {['Criteria', 'Score', 'Max', 'Weight', 'Computed'].map((h, i) => (
                            <th key={h} className={`px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider ${i >= 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {result.criteriaBreakdown.map((criterion) => {
                          const computed = scoringMode === 'AVERAGE'
                            ? `${criterion.averageScore.toFixed(2)}`
                            : `${(criterion.computed ?? criterion.weightedContribution).toFixed(2)}%`;
                          return (
                            <tr key={criterion.criteriaId} className="hover:bg-gray-50/70">
                              <td className="px-4 py-2.5 text-gray-800 font-medium">{criterion.criteriaName}</td>
                              <td className="px-4 py-2.5 text-right text-gray-700">{criterion.averageScore.toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right text-gray-600">{(criterion.maxScore ?? 0).toFixed(2)}</td>
                              <td className="px-4 py-2.5 text-right text-gray-600">{criterion.weight.toFixed(2)}%</td>
                              <td className="px-4 py-2.5 text-right font-extrabold text-gray-900">{computed}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Final value banner */}
                  <div className="rounded-xl border border-[#C7D7FD] bg-[#EFF3FF] px-4 py-2.5 text-sm font-semibold text-[#1E3A8A]">
                    {renderFinalValue(result)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Winner banner */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-4">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-1">Winner</p>
            <p className="text-lg font-extrabold text-gray-900">{results[0].contestantName}</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {scoringMode === 'RANKING'
                ? `Average Rank: ${(results[0].rankScore ?? results[0].totalScore).toFixed(2)} · Position: ${ordinal(results[0].rank)}`
                : scoringMode === 'AVERAGE'
                ? `Score: ${(results[0].finalScore ?? results[0].totalScore).toFixed(2)} / 10`
                : `Score: ${(results[0].finalPercentage ?? results[0].weightedScore).toFixed(2)}%`}
            </p>
          </div>
        </>
      ) : (
        /* Ranking by gender results */
        <div className="space-y-5">
          {results.warnings && results.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {results.warnings.join(' ')}
            </div>
          )}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-5 py-4">
            <p className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">Division Winners</p>
            <div className="flex flex-wrap gap-4">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Male Winner</p>
                <p className="text-sm font-extrabold text-gray-900">{results.maleWinner?.contestantName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Female Winner</p>
                <p className="text-sm font-extrabold text-gray-900">{results.femaleWinner?.contestantName || 'N/A'}</p>
              </div>
            </div>
          </div>
          {renderRankingDivision('Male Division', results.maleResults, 'Male Winner', results.maleWinner)}
          {renderRankingDivision('Female Division', results.femaleResults, 'Female Winner', results.femaleWinner)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANTS LIST (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantsList({
  pageants, onSelectPageant,
}: { pageants: Pageant[]; onSelectPageant: (pageant: Pageant) => void }) {

  if (pageants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
          <Crown className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-base font-extrabold text-gray-700 tracking-tight">No Assigned Pageants</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">You are not assigned as a judge to any pageants.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pageants</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">My Assigned Pageants</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {pageants.map((pageant) => (
          <button
            key={pageant.id}
            type="button"
            onClick={() => onSelectPageant(pageant)}
            className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                       hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center">
                <Crown className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${pageant.status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                {pageant.status === 'active' ? 'Scoring Open' : 'Scoring Closed'}
              </span>
            </div>

            <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1 group-hover:text-[#1E3A8A] transition-colors">
              {pageant.name}
            </h3>
            <p className="text-xs text-gray-400 mb-2">{formatPageantStatus(pageant.status)}</p>
            <p className="text-sm text-gray-500 line-clamp-2 mb-4">{pageant.description}</p>

            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Clock className="w-3.5 h-3.5" /> Event on {formatDate(pageant.eventDate)}
            </div>

            <div className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all ${pageant.status === 'active' ? 'bg-[#166534] text-white shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
              <Star className="w-3.5 h-3.5" />
              {pageant.status === 'active' ? 'Start Scoring' : 'Unavailable'}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING INTERFACE (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ScoringInterface({
  pageant, judgeId, onBack, onSelectContestant,
}: {
  pageant: Pageant; judgeId: string; onBack: () => void;
  onSelectContestant: (contestant: Contestant) => void;
}) {
  const [contestants, setContestants]   = useState<Contestant[]>([]);
  const [criteria, setCriteria]         = useState<Criteria[]>([]);
  const [scoredSet, setScoredSet]       = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [c, cr, pageantScores] = await Promise.all([
        getContestantsByPageant(pageant.id),
        getCriteriaByPageant(pageant.id),
        getMyScoresByPageant(pageant.id),
      ]);
      if (cancelled) return;
      setContestants(c); setCriteria(cr);
      const criteriaIds = new Set(cr.map((item) => item.id));
      const scored = new Set<string>();
      c.forEach((cont) => {
        const scoredCriteria = new Set(pageantScores.filter((s) => s.contestantId === cont.id).map((s) => s.criteriaId));
        if ([...criteriaIds].every((criteriaId) => scoredCriteria.has(criteriaId))) scored.add(cont.id);
      });
      if (!cancelled) setScoredSet(new Set(scored));
    }
    void load();
    return () => { cancelled = true; };
  }, [pageant.id, judgeId]);

  return (
    <div className="space-y-6">
      {/* Back + heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button" onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mb-3"
          >
            ← Back to Pageants
          </button>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{pageant.name}</h2>
          <p className="text-sm text-gray-500 mt-1">{pageant.description}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-600 w-fit shrink-0">
          <Clock className="w-3 h-3" /> Event on {formatDate(pageant.eventDate)}
        </span>
      </div>

      {/* Criteria info */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <h4 className="text-sm font-extrabold text-[#1E3A8A] flex items-center gap-2 mb-3">
          <Info className="w-4 h-4" /> Scoring Criteria
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {criteria.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-blue-100 p-3">
              <p className="text-sm font-semibold text-gray-900">{c.name}</p>
              <p className="text-xs text-blue-600 mt-0.5">Weight: {c.weight}%</p>
              <p className="text-xs text-gray-400">Max: {c.maxScore}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Contestants grid */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contestants</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contestants.map((contestant) => {
            const isScored = scoredSet.has(contestant.id);
            return (
              <div
                key={contestant.id}
                className={`bg-white rounded-2xl overflow-hidden border transition-all duration-200 ${
                  isScored ? 'border-green-200 ring-1 ring-green-200' : 'border-gray-100 hover:shadow-md hover:-translate-y-0.5'
                }`}
              >
                {/* Photo */}
                <div className="aspect-square relative">
                  {contestant.photoPath || contestant.photoUrl ? (
                    <img
                      src={contestant.photoPath || contestant.photoUrl}
                      alt={`${contestant.firstName} ${contestant.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] to-[#2563EB]">
                      <span className="text-4xl font-extrabold text-white">
                        {contestant.firstName[0]}{contestant.lastName[0]}
                      </span>
                    </div>
                  )}
                  {isScored && (
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-1.5 rounded-full shadow-md">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-sm font-extrabold text-gray-900 mb-0.5">
                    #{contestant.contestantNumber} {contestant.firstName} {contestant.lastName}
                  </p>
                  {contestant.department && (
                    <p className="text-xs text-gray-400 mb-3">{contestant.department}</p>
                  )}

                  {isScored ? (
                    <div className="flex items-center gap-2 text-green-700 text-sm font-semibold">
                      <CheckCircle className="w-4 h-4" /> Scored
                    </div>
                  ) : pageant.status === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onSelectContestant(contestant)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-[#166534] hover:bg-[#14532d] text-white shadow-sm transition-all hover:-translate-y-px active:translate-y-0"
                    >
                      <Star className="w-3.5 h-3.5" /> Score Contestant
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 text-gray-400 bg-gray-50">
                      Scoring Closed
                    </div>
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

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ScoringForm({
  pageant, contestant, judgeId, onSubmit, onCancel,
}: {
  pageant: Pageant; contestant: Contestant; judgeId: string;
  onSubmit: (contestantId: string, scores: { criteriaId: string; score: number; notes?: string }[]) => void;
  onCancel: () => void;
}) {
  const [criteria, setCriteria]         = useState<Criteria[]>([]);
  const [judgeScores, setJudgeScores]   = useState<Score[]>([]);
  const [scoredIds, setScoredIds]       = useState<Set<string>>(new Set());
  const [scores, setScores]             = useState<Record<string, { score: number; notes: string }>>({});
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    async function init() {
      const [c, pageantScores] = await Promise.all([
        getCriteriaByPageant(pageant.id),
        getMyScoresByPageant(pageant.id),
      ]);
      const js = pageantScores.filter((score) => score.contestantId === contestant.id);
      setCriteria(c); setJudgeScores(js);
      const si = new Set(js.map((s) => s.criteriaId));
      setScoredIds(si);
      const initial: Record<string, { score: number; notes: string }> = {};
      c.forEach((cr) => {
        const ex = js.find((s) => s.criteriaId === cr.id);
        initial[cr.id] = ex ? { score: ex.score, notes: ex.notes || '' } : { score: cr.maxScore / 2, notes: '' };
      });
      setScores(initial);
      setLoading(false);
    }
    void init();
  }, [pageant.id, contestant.id, judgeId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newScores = criteria
      .filter((c) => !scoredIds.has(c.id))
      .map((c) => ({ criteriaId: c.id, score: scores[c.id]?.score || 0, notes: scores[c.id]?.notes }));
    if (newScores.length === 0) { onCancel(); return; }
    onSubmit(contestant.id, newScores);
  };

  const updateScore = (criteriaId: string, score: number) =>
    setScores((prev) => ({ ...prev, [criteriaId]: { ...prev[criteriaId], score } }));
  const updateNotes = (criteriaId: string, notes: string) =>
    setScores((prev) => ({ ...prev, [criteriaId]: { ...prev[criteriaId], notes } }));

  const unscoredCriteria = criteria.filter((c) => !scoredIds.has(c.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 gap-2 text-sm text-gray-400">
        <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
        Loading scoring data…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      {criteria.map((c) => {
        const isScored      = scoredIds.has(c.id);
        const existingScore = judgeScores.find((s) => s.criteriaId === c.id);

        return (
          <div
            key={c.id}
            className={`rounded-2xl p-4 ${isScored ? 'bg-green-50 border border-green-200' : 'bg-gray-50/60 border border-gray-100'}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-sm font-extrabold text-gray-900">{c.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="text-xs text-gray-500">Weight: {c.weight}%</p>
                {isScored && (
                  <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-xs font-semibold text-green-700">
                    <CheckCircle className="w-3 h-3" /> Scored
                  </span>
                )}
              </div>
            </div>

            {isScored ? (
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="font-extrabold text-gray-900">{existingScore?.score.toFixed(2)}</span>
                <span className="text-xs text-gray-400">/ {c.maxScore}</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <Slider
                    value={[scores[c.id]?.score || 0]}
                    onValueChange={(value) => updateScore(c.id, value[0])}
                    max={c.maxScore} step={0.1} className="flex-1"
                  />
                  <Input
                    type="number" min={0} max={c.maxScore} step={0.1}
                    value={scores[c.id]?.score || 0}
                    onChange={(e) => updateScore(c.id, parseFloat(e.target.value))}
                    className="w-20 text-right rounded-xl border-gray-200 text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor={`notes-${c.id}`} className="text-xs font-semibold text-gray-500 tracking-wide">Notes (optional)</Label>
                  <Textarea
                    id={`notes-${c.id}`}
                    value={scores[c.id]?.notes || ''}
                    onChange={(e) => updateNotes(c.id, e.target.value)}
                    rows={2}
                    placeholder="Add any comments about this criteria…"
                    className="mt-1.5 rounded-xl border-gray-200 bg-white text-sm"
                  />
                </div>
              </>
            )}
          </div>
        );
      })}

      {unscoredCriteria.length > 0 ? (
        <DialogFooter className="gap-2 mt-2">
          <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
          <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">
            <CheckCircle className="w-4 h-4" /> Submit Scores
          </Button>
        </DialogFooter>
      ) : (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-7 h-7 text-green-500" />
          </div>
          <p className="text-base font-extrabold text-green-700">All criteria scored!</p>
          <button
            type="button" onClick={onCancel}
            className="mt-4 px-5 py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING HISTORY (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ScoringHistory({
  scores, pageants,
}: { scores: Score[]; pageants: Pageant[] }) {

  const [criteriaByPageant, setCriteriaByPageant] = useState<Record<string, Criteria[]>>({});

  useEffect(() => {
    const pageantIds = [...new Set(scores.map((score) => score.pageantId))];
    if (pageantIds.length === 0) { Promise.resolve().then(() => setCriteriaByPageant({})); return; }
    async function loadCriteria() {
      const entries = await Promise.all(
        pageantIds.map(async (pageantId) => {
          const criteria = await getCriteriaByPageant(pageantId);
          return [pageantId, criteria] as const;
        })
      );
      const nextMap: Record<string, Criteria[]> = {};
      entries.forEach(([pageantId, criteria]) => { nextMap[pageantId] = criteria; });
      setCriteriaByPageant(nextMap);
    }
    void loadCriteria();
  }, [scores]);

  if (scores.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
          <Star className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-base font-extrabold text-gray-700 tracking-tight">No Scores Submitted</h3>
        <p className="text-sm text-gray-400 mt-1">You haven't submitted any scores yet.</p>
      </div>
    );
  }

  // Group scores by pageant and contestant (logic unchanged)
  const groupedScores: Record<string, Record<string, Score[]>> = {};
  scores.forEach((score) => {
    if (!groupedScores[score.pageantId]) groupedScores[score.pageantId] = {};
    if (!groupedScores[score.pageantId][score.contestantId]) groupedScores[score.pageantId][score.contestantId] = [];
    groupedScores[score.pageantId][score.contestantId].push(score);
  });

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">History</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">My Scoring History</h2>
      </div>

      {Object.entries(groupedScores).map(([pageantId, contestants]) => {
        const pageant = pageants.find(p => p.id === pageantId);
        if (!pageant) return null;

        return (
          <SectionCard key={pageantId}>
            <CardHeading eyebrow="Pageant" title={pageant.name} />
            <div className="space-y-3">
              {Object.entries(contestants).map(([contestantId, contestantScores]) => {
                const totalScore    = contestantScores.reduce((sum, s) => sum + s.score, 0);
                const averageScore  = totalScore / contestantScores.length;
                const criteria      = criteriaByPageant[pageantId] || [];
                const totalWeight   = criteria.reduce((sum, c) => sum + c.weight, 0);
                const criteriaById: Record<string, Criteria> = {};
                criteria.forEach((criterion) => { criteriaById[criterion.id] = criterion; });

                const weightedMean = contestantScores.reduce((sum, scoreEntry) => {
                  const criterion = criteriaById[scoreEntry.criteriaId];
                  if (!criterion || criterion.maxScore <= 0 || totalWeight <= 0) return sum;
                  const adjustedWeight = (criterion.weight / totalWeight) * 100;
                  const normalized = scoreEntry.score / criterion.maxScore;
                  return sum + normalized * adjustedWeight;
                }, 0);

                const scoreSummary = pageant.scoringMethod === 'weighted'
                  ? { label: 'Weighted Mean', value: `${weightedMean.toFixed(2)}%` }
                  : pageant.scoringMethod === 'ranking'
                  ? { label: 'Rank Input Avg', value: averageScore.toFixed(2) }
                  : { label: 'Average', value: averageScore.toFixed(2) };

                return (
                  <div
                    key={contestantId}
                    className="flex items-center justify-between p-3.5 bg-gray-50/60 rounded-xl border border-gray-100"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Contestant scored</p>
                      <p className="text-xs text-gray-400 mt-0.5">{contestantScores.length} criteria scored</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-extrabold text-gray-900">
                        {scoreSummary.label}: {scoreSummary.value}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{formatDateTime(contestantScores[0].submittedAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDGE PROFILE (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function JudgeProfile({ user }: { user: User }) {
  const { profile, isLoading } = useSupabaseProfile();
  const metadataFirstName = typeof profile?.name === 'string' ? profile.name.split(/\s+/)[0] : '';
  const metadataLastName  = typeof profile?.name === 'string' ? profile.name.split(/\s+/).slice(1).join(' ') : '';
  const firstName     = user.firstName || metadataFirstName || 'User';
  const lastName      = user.lastName  || metadataLastName  || 'N/A';
  const displayName   = `${firstName} ${lastName}`.trim();
  const displayEmail  = profile?.email || user.email || 'No email available';
  const displayAvatar = user.photoUrl || user.photoPath || profile?.avatarUrl || DEFAULT_PROFILE_AVATAR;

  const profileFields = [
    { label: 'First Name',     value: firstName },
    { label: 'Last Name',      value: lastName },
    { label: 'Email',          value: displayEmail },
    { label: 'Member Since',   value: user.createdAt ? formatDate(user.createdAt) : 'N/A' },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Account</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">My Profile</h2>
      </div>

      <SectionCard>
        {/* Avatar + name */}
        {isLoading ? (
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 animate-pulse shrink-0" />
            <div className="space-y-2">
              <div className="h-5 w-40 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-4 w-52 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-2xl font-extrabold shrink-0">
              <img
                src={displayAvatar}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.src = DEFAULT_PROFILE_AVATAR; }}
              />
            </div>
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 tracking-tight">{displayName}</h3>
              <p className="text-sm text-gray-500">{displayEmail}</p>
              <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF3FF] border border-[#C7D7FD] text-xs font-semibold text-[#1E3A8A]">
                <Star className="w-3 h-3" /> Judge
              </span>
            </div>
          </div>
        )}

        <Separator className="mb-5" />

        <div className="grid grid-cols-1 gap-y-4 gap-x-6 sm:grid-cols-2">
          {profileFields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Status</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${user.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}