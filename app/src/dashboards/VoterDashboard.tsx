import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Vote, CheckCircle, Clock, Calendar, User as UserIcon,
  AlertCircle, Info, LogOut, Menu, X, TrendingUp, BarChart3,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getActiveElections, getAllElections, getCandidatesByPosition, getElectionPositions,
  castVotesBatch, getElectionResults, getUserVotes,
} from '@/services/electionService';
import type { Election, Candidate, ElectionPosition, ElectionResult, Vote as VoteType, User } from '@/types';
import { formatDate, formatDateTime, formatElectionType } from '@/utils/formatters';
import { useSupabaseProfile, DEFAULT_PROFILE_AVATAR } from '@/hooks/useSupabaseProfile';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { CandidateDetailsModal } from '@/components/dashboard/CandidateDetailsModal';

// ─── Shared design primitives (same system as AdminDashboard) ─────────────────

const NAV = [
  { value: 'overview',  label: 'Overview',           icon: TrendingUp },
  { value: 'elections', label: 'Active Elections',    icon: Vote },
  { value: 'history',   label: 'My Voting History',  icon: Clock },
  { value: 'results',   label: 'Election Results',   icon: BarChart3 },
  { value: 'profile',   label: 'My Profile',         icon: UserIcon },
];

const ActionBtn = ({
  type = 'button', onClick, disabled, children, color = 'blue', fullWidth = false,
}: {
  type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean;
  children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'outline'; fullWidth?: boolean;
}) => {
  const palette = {
    blue:    'bg-[#1E3A8A] hover:bg-[#1d3580] text-white shadow-sm shadow-blue-200',
    green:   'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200',
    red:     'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold
        rounded-xl transition-all duration-150
        hover:-translate-y-px active:translate-y-0
        disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0
        ${palette[color]}
        ${fullWidth ? 'w-full' : ''}
      `}
    >
      {children}
    </button>
  );
};

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
                className="px-5 py-3 text-left text-xs font-bold text-white uppercase tracking-wider"
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
                No records found.
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  </div>
);

const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
    {children}
  </div>
);

const CardHeading = ({ eyebrow, title }: { eyebrow?: string; title: string }) => (
  <div className="mb-5">
    {eyebrow && <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{eyebrow}</p>}
    <h3 className="text-base font-extrabold text-gray-900 tracking-tight">{title}</h3>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function VoterDashboard() {
  // ── All logic unchanged ───────────────────────────────────────────────────
  const { user, logout } = useAuth();
  const { showError } = useNotification();
  const [activeTab, setActiveTab]             = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [elections, setElections]             = useState<Election[]>([]);
  const [resultElections, setResultElections] = useState<Election[]>([]);
  const [userVotes, setUserVotes]             = useState<VoteType[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [selectedResultElection, setSelectedResultElection] = useState<Election | null>(null);
  const [selectedElectionResults, setSelectedElectionResults] = useState<ElectionResult[]>([]);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [pendingDraftCount, setPendingDraftCount] = useState(0);
  const [isLoading, setIsLoading]             = useState(true);
  const [error, setError]                     = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [activeElections, allElections] = await Promise.all([
        getActiveElections(),
        getAllElections(),
      ]);
      setElections(activeElections);
      setResultElections(allElections.filter((election) => election.resultsPublic));

      if (user) {
        const allVotes: VoteType[] = [];
        const voteResults = await Promise.allSettled(
          activeElections.map((election) => getUserVotes(election.id, user.id))
        );
        let hasVoteLoadFailure = false;
        voteResults.forEach((result) => {
          if (result.status === 'fulfilled') { allVotes.push(...result.value); }
          else { hasVoteLoadFailure = true; }
        });
        if (hasVoteLoadFailure) {
          showError('Some voting history data could not be loaded. Please try again.');
        }
        setUserVotes(allVotes);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(message);
      showError(message);
      console.error('VoterDashboard fetchData error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, showError]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const confirmDiscardDraftVotes = useCallback((): boolean => {
    if (pendingDraftCount === 0) return true;
    return window.confirm(
      `You have ${pendingDraftCount} unsubmitted draft vote${pendingDraftCount > 1 ? 's' : ''}. Leave this voting screen and discard them?`
    );
  }, [pendingDraftCount]);

  const handleSelectElection = (election: Election) => { setSelectedElection(election); };

  const handleVoteSuccess = () => {
    setPendingDraftCount(0);
    void fetchData();
  };

  const handleTabChange = (value: string) => {
    if (value === activeTab) {
      setIsMobileNavOpen(false);
      return;
    }

    if (activeTab === 'elections' && selectedElection && value !== 'elections') {
      if (!confirmDiscardDraftVotes()) return;
      setSelectedElection(null);
      setPendingDraftCount(0);
    }

    setActiveTab(value);
    setIsMobileNavOpen(false);
  };

  const handleBackToElectionsList = () => {
    if (!confirmDiscardDraftVotes()) return;
    setSelectedElection(null);
    setPendingDraftCount(0);
  };

  const getVotesForPosition = (electionId: string, position: string): VoteType[] =>
    userVotes.filter(v => v.electionId === electionId && v.position === position);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const handleViewElectionResults = async (election: Election) => {
    if (!election.resultsPublic) {
      showError('Results are not yet published by admin for this election.');
      return;
    }

    setIsLoadingResults(true);
    try {
      const results = await getElectionResults(election.id);
      setSelectedElectionResults(results);
      setSelectedResultElection(election);
    } catch {
      showError('Unable to load election results right now.');
    } finally {
      setIsLoadingResults(false);
    }
  };

  const handleBackToResultsList = () => {
    setSelectedResultElection(null);
    setSelectedElectionResults([]);
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center shadow-lg shadow-blue-200">
              <Vote className="w-8 h-8 text-white" />
            </div>
            <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-[#f2c94c] animate-spin" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">Loading Voter Dashboard</p>
            <p className="text-xs text-gray-400 mt-1">Please wait a moment…</p>
          </div>
          <div className="w-40 h-1 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] animate-pulse" style={{ width: '65%' }} />
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Loading Error</h2>
            <p className="text-sm text-gray-500 leading-relaxed">{error}</p>
          </div>
          <div className="h-px bg-gray-100" />
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <ActionBtn onClick={() => void fetchData()} color="blue">Retry</ActionBtn>
            <ActionBtn onClick={handleLogout} color="outline">Logout</ActionBtn>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F8FC] overflow-x-hidden">
      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="min-h-screen"
      >

        {/* ── MOBILE TOP BAR ───────────────────────────────────────────── */}
        <div className="sticky top-0 z-40 flex items-center justify-between bg-white border-b border-gray-100 px-4 py-3 md:hidden shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#1E3A8A] flex items-center justify-center">
              <Vote className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">Student Portal</span>
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
          {/* Brand */}
          <div className="px-5 py-5 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1E3A8A] to-[#2563EB] flex items-center justify-center shadow-md shadow-blue-200">
                <Vote className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">SchoolVote</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Student Portal</p>
              </div>
            </div>
          </div>

          {/* Nav */}
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

        {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
        <main className="md:ml-64 min-w-0 flex flex-col min-h-screen">

          {/* Page header */}
          <DashboardHeader
            activeTabLabel={NAV.find((n) => n.value === activeTab)?.label ?? 'Student Portal'}
            user={user!}
          />

          {/* Tab panels */}
          <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
            <TabsContent value="overview">
              <VoterOverviewTab elections={elections} userVotes={userVotes} onNavigate={handleTabChange} />
            </TabsContent>
            <TabsContent value="elections">
              {selectedElection ? (
                <VotingInterface
                  election={selectedElection}
                  onBack={handleBackToElectionsList}
                  voterId={user?.id || ''}
                  onVoteSuccess={handleVoteSuccess}
                  getVotesForPosition={getVotesForPosition}
                  onDraftStateChange={setPendingDraftCount}
                />
              ) : (
                <ElectionsList
                  elections={elections}
                  userVotes={userVotes}
                  onSelectElection={handleSelectElection}
                />
              )}
            </TabsContent>
            <TabsContent value="history">
              <VotingHistory userVotes={userVotes} elections={elections} />
            </TabsContent>
            <TabsContent value="results">
              <VoterResultsTab
                elections={resultElections}
                selectedElection={selectedResultElection}
                results={selectedElectionResults}
                loading={isLoadingResults}
                onViewResults={handleViewElectionResults}
                onBack={handleBackToResultsList}
              />
            </TabsContent>
            <TabsContent value="profile">
              <VoterProfile user={user!} />
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
          <DialogFooter className="gap-2 mt-2">
            <button
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
              onClick={() => setIsLogoutDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white transition-colors"
              onClick={() => { void handleLogout(); }}
            >
              Sign Out
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOTER OVERVIEW TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function VoterOverviewTab({
  elections, userVotes, onNavigate,
}: { elections: Election[]; userVotes: VoteType[]; onNavigate: (tab: string) => void }) {

  const totalOpen         = elections.length;
  const votedElectionIds  = new Set(userVotes.map(v => v.electionId));
  const votedCount        = elections.filter(e => votedElectionIds.has(e.id)).length;
  const pendingCount      = totalOpen - votedCount;

  const statCards = [
    { label: 'Open Elections',   value: totalOpen,    accent: 'bg-blue-50 text-blue-600',   icon: Vote },
    { label: 'Votes Submitted',  value: votedCount,   accent: 'bg-green-50 text-green-600', icon: CheckCircle },
    { label: 'Still to Vote In', value: pendingCount, accent: pendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400', icon: Clock },
  ];

  return (
    <div className="space-y-6">
      {/* Pending vote alert */}
      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-extrabold text-amber-800">Your vote matters!</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You have {pendingCount} open election{pendingCount > 1 ? 's' : ''} waiting for your vote.
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Voting status per election */}
      <SectionCard>
        <CardHeading eyebrow="Status" title="My Voting Status" />
        {elections.length > 0 ? (
          <ul className="divide-y divide-gray-50">
            {elections.map((election) => {
              const hasVoted = votedElectionIds.has(election.id);
              return (
                <li key={election.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{election.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Ends {formatDate(election.endDate)}</p>
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    hasVoted
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {hasVoted ? <><CheckCircle className="w-3 h-3" /> Voted</> : <><Clock className="w-3 h-3" /> Pending</>}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No active elections at this time.</p>
        )}
      </SectionCard>

      {/* Quick actions */}
      <SectionCard>
        <CardHeading eyebrow="Shortcuts" title="Quick Actions" />
        <div className="flex flex-wrap gap-3">
          <ActionBtn onClick={() => onNavigate('elections')} color="blue">
            <Vote className="w-4 h-4" /> Browse Elections
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('history')} color="outline">
            <Clock className="w-4 h-4" /> My Voting History
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('results')} color="outline">
            <TrendingUp className="w-4 h-4" /> View Published Results
          </ActionBtn>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS TAB
// ═══════════════════════════════════════════════════════════════════════════════
function VoterResultsTab({
  elections, selectedElection, results, loading, onViewResults, onBack,
}: {
  elections: Election[];
  selectedElection: Election | null;
  results: ElectionResult[];
  loading: boolean;
  onViewResults: (election: Election) => void;
  onBack: () => void;
}) {
  if (selectedElection) {
    return (
      <ElectionResultsView
        election={selectedElection}
        results={results}
        loading={loading}
        onBack={onBack}
      />
    );
  }

  if (elections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
          <TrendingUp className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-extrabold text-gray-700 tracking-tight">No Published Results Yet</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">Election results will appear here after admin publishes them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Published</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Election Results</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {elections.map((election) => (
          <div
            key={election.id}
            className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                Published
              </span>
            </div>

            <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1 group-hover:text-[#1E3A8A] transition-colors">
              {election.title}
            </h3>
            <p className="text-xs font-semibold text-[#2563EB] mb-2">{formatElectionType(election.type)}</p>
            <p className="text-sm text-gray-500 line-clamp-2 mb-4">{election.description}</p>

            <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
              <Calendar className="w-3.5 h-3.5" />
              Ended {formatDate(election.endDate)}
            </div>

            <ActionBtn color="blue" fullWidth onClick={() => onViewResults(election)}>
              <TrendingUp className="w-4 h-4" /> View Results
            </ActionBtn>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElectionResultsView({
  election, results, loading, onBack,
}: {
  election: Election;
  results: ElectionResult[];
  loading: boolean;
  onBack: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-8">
        <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
        Loading results…
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors">
          ← Back to Results
        </button>
        <p className="text-sm text-gray-500">No result records are available yet for this election.</p>
      </div>
    );
  }

  const getResultGroup = (position: string) => {
    if (position.startsWith('SSG ')) return 'SSG Results';
    if (position.startsWith('FSTLP ')) return 'FSTLP Results';
    return 'Other Results';
  };

  const groupedResults = results.reduce<Record<string, ElectionResult[]>>((acc, item) => {
    const key = getResultGroup(item.position);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const groupOrder = ['SSG Results', 'FSTLP Results', 'Other Results'];
  const orderedGroups = groupOrder
    .map((group) => ({ group, rows: groupedResults[group] ?? [] }))
    .filter((entry) => entry.rows.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mb-3">
          ← Back to Results
        </button>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{election.title}</h2>
        <p className="text-sm text-gray-500 mt-1">Election Type: {formatElectionType(election.type)}</p>
      </div>

      <div className="space-y-5">
        {orderedGroups.map(({ group, rows }) => (
          <div key={group} className="space-y-3">
            <h3 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">{group}</h3>
            {rows.map((positionResult) => (
              <SectionCard key={positionResult.position}>
                <CardHeading
                  eyebrow="Position"
                  title={`${positionResult.position} (${positionResult.totalVotes} total votes)`}
                />

                <DataTable headers={['Rank', 'Candidate', 'Votes', 'Percentage']} empty={positionResult.candidates.length === 0}>
                  {positionResult.candidates.map((candidate, index) => (
                    <tr key={candidate.candidateId} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">#{index + 1}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(candidate.photoPath || candidate.photoUrl) ? (
                              <img
                                src={candidate.photoPath || candidate.photoUrl}
                                alt={candidate.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : candidate.displayName.charAt(0).toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{candidate.displayName}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">{candidate.voteCount}</td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">{candidate.percentage.toFixed(1)}%</td>
                    </tr>
                  ))}
                </DataTable>
              </SectionCard>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ELECTIONS LIST (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ElectionsList({
  elections, userVotes, onSelectElection,
}: { elections: Election[]; userVotes: VoteType[]; onSelectElection: (election: Election) => void }) {

  if (elections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
          <Vote className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-extrabold text-gray-700 tracking-tight">No Active Elections</h3>
        <p className="text-sm text-gray-400 mt-1 max-w-xs">There are no active elections at this time. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Elections</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Active Elections</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {elections.map((election) => {
          const electionVotes       = userVotes.filter(v => v.electionId === election.id);
          const hasVotedInElection  = electionVotes.length > 0;

          return (
            <button
              key={election.id}
              type="button"
              onClick={() => onSelectElection(election)}
              className="group text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-5
                         hover:shadow-lg hover:border-blue-100 hover:-translate-y-1 transition-all duration-200"
            >
              {/* Status badge */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center">
                  <Vote className="w-5 h-5 text-[#1E3A8A]" />
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                  hasVotedInElection
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {hasVotedInElection
                    ? <><CheckCircle className="w-3 h-3" /> Voted</>
                    : <><Clock className="w-3 h-3" /> Open</>}
                </span>
              </div>

              <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1 group-hover:text-[#1E3A8A] transition-colors">
                {election.title}
              </h3>
              <p className="text-xs font-semibold text-[#2563EB] mb-2">{formatElectionType(election.type)}</p>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4">{election.description}</p>

              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Calendar className="w-3.5 h-3.5" />
                Ends {formatDate(election.endDate)}
              </div>

              {hasVotedInElection && (
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> You have voted in this election
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOTING INTERFACE (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function VotingInterface({
  election, onBack, voterId, onVoteSuccess, getVotesForPosition, onDraftStateChange,
}: {
  election: Election; onBack: () => void;
  voterId: string;
  onVoteSuccess: () => void;
  getVotesForPosition: (electionId: string, position: string) => VoteType[];
  onDraftStateChange: (count: number) => void;
}) {
  const { showSuccess, showError } = useNotification();
  const [positions, setPositions]                 = useState<ElectionPosition[]>([]);
  const [candidatesByPosition, setCandidatesByPosition] = useState<Record<string, Candidate[]>>({});
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [selectedMaxVotes, setSelectedMaxVotes] = useState(1);
  const [draftSelectionsByPosition, setDraftSelectionsByPosition] = useState<Record<string, string[]>>({});
  const [isSubmittingAllVotes, setIsSubmittingAllVotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const pos = await getElectionPositions(election.id);
      if (cancelled) return;
      setPositions(pos);
      const map: Record<string, Candidate[]> = {};
      await Promise.all(
        pos.map(async (p) => {
          const cands = await getCandidatesByPosition(election.id, p.name);
          map[p.name] = cands;
        })
      );
      if (!cancelled) setCandidatesByPosition(map);
    }
    void load();
    return () => { cancelled = true; };
  }, [election.id]);

  useEffect(() => {
    setDraftSelectionsByPosition({});
    setSelectedCandidate(null);
    setIsCandidateModalOpen(false);
    setIsSubmittingAllVotes(false);
  }, [election.id]);

  const draftSummaryByPosition = useMemo(() => (
    positions
      .map((position) => {
        const selectedIds = draftSelectionsByPosition[position.name] ?? [];
        const candidates = candidatesByPosition[position.name] ?? [];
        const submittedVotesCount = getVotesForPosition(election.id, position.name).length;
        const selectedCandidates = selectedIds
          .map((candidateId) => candidates.find((item) => item.id === candidateId))
          .filter((candidate): candidate is Candidate => Boolean(candidate));

        return {
          positionName: position.name,
          maxVotes: position.voteLimit,
          submittedVotesCount,
          selectedCount: selectedCandidates.length,
          selectedCandidates,
        };
      })
      .filter((entry) => entry.selectedCount > 0)
  ), [positions, draftSelectionsByPosition, candidatesByPosition, getVotesForPosition, election.id]);

  const totalDraftSelections = useMemo(
    () => draftSummaryByPosition.reduce((sum, entry) => sum + entry.selectedCount, 0),
    [draftSummaryByPosition]
  );

  useEffect(() => {
    onDraftStateChange(totalDraftSelections);
    return () => { onDraftStateChange(0); };
  }, [totalDraftSelections, onDraftStateChange]);

  useEffect(() => {
    if (totalDraftSelections === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [totalDraftSelections]);

  const handleToggleCandidateSelection = (
    candidate: Candidate,
    positionName: string,
    maxVotes: number,
    submittedVotesCount: number
  ) => {
    if (isSubmittingAllVotes) return;

    setDraftSelectionsByPosition((prev) => {
      const currentSelections = prev[positionName] ?? [];
      const isSelected = currentSelections.includes(candidate.id);

      if (isSelected) {
        return {
          ...prev,
          [positionName]: currentSelections.filter((id) => id !== candidate.id),
        };
      }

      const usedVotes = submittedVotesCount + currentSelections.length;
      if (usedVotes >= maxVotes) {
        showError(`Maximum votes reached for ${positionName}. Limit: ${maxVotes}.`);
        return prev;
      }

      return {
        ...prev,
        [positionName]: [...currentSelections, candidate.id],
      };
    });
  };

  const handleSubmitAllVotes = async () => {
    const selections = positions.flatMap((position) => {
      const ids = draftSelectionsByPosition[position.name] ?? [];
      return ids.map((candidateId) => ({
        candidateId,
        position: position.name,
      }));
    });

    if (selections.length === 0) {
      showError('No candidates selected yet. Please add candidates to your ballot first.');
      return;
    }

    const confirmed = window.confirm(
      `Submit ${selections.length} vote${selections.length > 1 ? 's' : ''} now? This action cannot be undone.`
    );
    if (!confirmed) return;

    setIsSubmittingAllVotes(true);
    try {
      const result = await castVotesBatch(election.id, voterId, selections);
      if (!result.success) {
        showError(result.error || 'Failed to submit selected votes. Please try again.');
        return;
      }

      setDraftSelectionsByPosition({});
      const submittedCount = result.submittedCount ?? selections.length;
      showSuccess(`Successfully submitted ${submittedCount} vote${submittedCount > 1 ? 's' : ''}.`);
      onVoteSuccess();
    } finally {
      setIsSubmittingAllVotes(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back + heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-700 transition-colors mb-3"
          >
            ← Back to Elections
          </button>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">{election.title}</h2>
          <p className="text-sm text-gray-500 mt-1">{election.description}</p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 lg:shrink-0">
          <span className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs font-semibold text-gray-600 w-fit shrink-0 whitespace-nowrap">
            <Clock className="w-3 h-3" /> Ends {formatDateTime(election.endDate)}
          </span>
          <ActionBtn
            color="green"
            onClick={() => { void handleSubmitAllVotes(); }}
            disabled={totalDraftSelections === 0 || isSubmittingAllVotes}
          >
            <Vote className="w-4 h-4" />
            <span className="whitespace-nowrap">
              {isSubmittingAllVotes
                ? 'Submitting...'
                : `Submit All Votes (${totalDraftSelections})`}
            </span>
          </ActionBtn>
        </div>
      </div>

      <SectionCard className="border-blue-100 bg-blue-50/40">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Draft Ballot</p>
              <p className="text-sm text-blue-800 font-semibold">
                {totalDraftSelections > 0
                  ? `${totalDraftSelections} candidate${totalDraftSelections > 1 ? 's' : ''} selected. Review, then submit once.`
                  : 'Select candidates from cards or modal, then submit all votes in one action.'}
              </p>
            </div>
          </div>

          {totalDraftSelections > 0 && (
            <div className="space-y-3">
              {draftSummaryByPosition.map((group) => (
                <div
                  key={group.positionName}
                  className="rounded-xl border border-blue-100 bg-white p-3"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <p className="text-xs font-semibold text-gray-900">{group.positionName}</p>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                          {group.selectedCount}/{group.maxVotes} selected
                        </span>
                        {group.submittedVotesCount > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border border-green-200 bg-green-50 text-green-700">
                            {group.submittedVotesCount}/{group.maxVotes} submitted
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {group.selectedCandidates.map((candidate) => (
                        <div key={candidate.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-2.5 py-2">
                          <p className="text-xs font-semibold text-gray-800 truncate pr-3">{candidate.displayName}</p>
                          <button
                            type="button"
                            className="text-[11px] font-semibold text-red-600 hover:text-red-700"
                            onClick={() => {
                              handleToggleCandidateSelection(
                                candidate,
                                group.positionName,
                                group.maxVotes,
                                group.submittedVotesCount
                              );
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* Positions */}
      <div className="space-y-6">
        {positions.map((position) => {
          const positionName      = position.name;
          const candidates        = candidatesByPosition[positionName] || [];
          const submittedVotesForPosition = getVotesForPosition(election.id, positionName);
          const maxVotes          = position.voteLimit;
          const selectedIds       = draftSelectionsByPosition[positionName] || [];
          const usedVotes         = submittedVotesForPosition.length + selectedIds.length;
          const votedCandidateIds = new Set(submittedVotesForPosition.map((vote) => vote.candidateId));
          const votesRemaining    = Math.max(0, maxVotes - usedVotes);
          const hasReachedLimit   = votesRemaining === 0;

          return (
            <div key={position.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              {/* Position header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-extrabold text-gray-900">{positionName}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  hasReachedLimit
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                }`}>
                  {usedVotes}/{maxVotes} votes used
                </span>
              </div>

              {/* Vote limit feedback */}
              {hasReachedLimit ? (
                <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3 mb-5">
                  <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Maximum votes reached for this position</p>
                    <p className="text-xs text-green-600 mt-0.5">Limit: {maxVotes} candidate{maxVotes > 1 ? 's' : ''}.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-4 py-2.5 mb-5">
                  <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  <p className="text-sm text-blue-700">
                    You can still vote for{' '}
                    <span className="font-extrabold">{votesRemaining}</span>{' '}
                    candidate{votesRemaining > 1 ? 's' : ''} in this position.
                  </p>
                </div>
              )}

              {/* Candidate grid */}
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {candidates.map((candidate) => (
                  (() => {
                    const isSubmitted = votedCandidateIds.has(candidate.id);
                    const isSelected = selectedIds.includes(candidate.id);
                    const disabled = isSubmittingAllVotes || isSubmitted || (!isSelected && hasReachedLimit);
                    return (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    isSubmitted={isSubmitted}
                    isSelected={isSelected}
                    disabled={disabled}
                    onViewDetails={() => {
                      setSelectedCandidate(candidate);
                      setSelectedMaxVotes(maxVotes);
                      setIsCandidateModalOpen(true);
                    }}
                    onToggleSelection={() => {
                      handleToggleCandidateSelection(
                        candidate,
                        positionName,
                        maxVotes,
                        submittedVotesForPosition.length
                      );
                    }}
                  />
                    );
                  })()
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <CandidateDetailsModal
        isOpen={isCandidateModalOpen}
        onClose={() => {
          setIsCandidateModalOpen(false);
          setSelectedCandidate(null);
        }}
        candidate={selectedCandidate}
        maxVotesForPosition={selectedMaxVotes}
        selectedCandidateIdsForPosition={selectedCandidate ? (draftSelectionsByPosition[selectedCandidate.position] || []) : []}
        submittedCandidateIdsForPosition={selectedCandidate ? getVotesForPosition(election.id, selectedCandidate.position).map((vote) => vote.candidateId) : []}
        onToggleSelection={(candidate) => {
          const position = positions.find((item) => item.name === candidate.position);
          if (!position) return;
          const submittedVotesCount = getVotesForPosition(election.id, candidate.position).length;
          handleToggleCandidateSelection(candidate, candidate.position, position.voteLimit, submittedVotesCount);
        }}
        isSubmittingAllVotes={isSubmittingAllVotes}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATE CARD (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function CandidateCard({
  candidate, isSubmitted, isSelected, disabled, onViewDetails, onToggleSelection,
}: {
  candidate: Candidate;
  isSubmitted: boolean;
  isSelected: boolean;
  disabled?: boolean;
  onViewDetails: () => void;
  onToggleSelection: () => void;
}) {
  const [imageError, setImageError]   = useState(false);

  return (
    <div className={`
      bg-white rounded-2xl border overflow-hidden transition-all duration-200
      ${isSubmitted ? 'border-green-200 ring-1 ring-green-200' : isSelected ? 'border-amber-200 ring-1 ring-amber-200' : 'border-gray-100'}
      ${!disabled ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-75'}
    `}>
      {/* Photo */}
      <div className="aspect-square bg-gray-100 relative">
        {(candidate.photoPath || candidate.photoUrl) && !imageError ? (
          <img
            src={candidate.photoPath || candidate.photoUrl}
            alt={candidate.displayName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] to-[#2563EB]">
            <span className="text-4xl font-extrabold text-white">
              {candidate.displayName.charAt(0)}
            </span>
          </div>
        )}

        {/* Voted overlay badge */}
        {(isSubmitted || isSelected) && (
          <div className={`absolute top-2 right-2 text-white rounded-full p-1 shadow-md ${isSubmitted ? 'bg-green-500' : 'bg-amber-500'}`}>
            <CheckCircle className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        <div>
          <h4 className="text-sm sm:text-base font-extrabold text-gray-900 leading-tight line-clamp-2">{candidate.displayName}</h4>
          <p className="text-xs sm:text-sm font-semibold text-[#1E3A8A] mt-1 truncate">{candidate.position}</p>
        </div>

        <div className="space-y-1.5 sm:space-y-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="w-full flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> View Details
          </button>

          <button
            type="button"
            onClick={onToggleSelection}
            disabled={disabled}
            className={`
              w-full flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 text-[11px] sm:text-xs font-bold rounded-xl
              transition-all duration-150
              ${isSubmitted
                ? 'bg-green-50 text-green-700 border border-green-200 cursor-default'
                : isSelected
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : disabled
                ? 'bg-gray-50 text-gray-400 border border-gray-200 cursor-not-allowed'
                : 'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200 hover:-translate-y-px active:translate-y-0'
              }
            `}
          >
            {isSubmitted
              ? <><CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Already Submitted</>
              : isSelected
              ? <><CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Selected</>
              : disabled
              ? 'Unavailable'
              : <><Vote className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Select</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOTING HISTORY (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function VotingHistory({
  userVotes, elections,
}: { userVotes: VoteType[]; elections: Election[] }) {

  if (userVotes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-5">
          <CheckCircle className="w-8 h-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-extrabold text-gray-700 tracking-tight">No Voting History</h3>
        <p className="text-sm text-gray-400 mt-1">You haven't cast any votes yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">History</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Your Voting History</h2>
      </div>

      <DataTable headers={['Election', 'Position', 'Voted At', 'Status']} empty={false}>
        {userVotes.map((vote) => {
          const election = elections.find(e => e.id === vote.electionId);
          return (
            <tr key={vote.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">
                {election?.title || 'Unknown Election'}
              </td>
              <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">
                {vote.position}
              </td>
              <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">
                {formatDateTime(vote.votedAt)}
              </td>
              <td className="px-5 py-3.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                  <CheckCircle className="w-3 h-3" /> Recorded
                </span>
              </td>
            </tr>
          );
        })}
      </DataTable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VOTER PROFILE (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function VoterProfile({ user }: { user: User }) {
  const { profile, isLoading: profileLoading } = useSupabaseProfile();

  const displayName   = profile?.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
  const displayEmail  = profile?.email || user.email || 'No email available';
  const displayAvatar = user.photoUrl || user.photoPath || profile?.avatarUrl || DEFAULT_PROFILE_AVATAR;
  const initials      = displayName.split(/\s+/).filter(Boolean).slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '').join('') || 'U';

  const profileFields = [
    { label: 'First Name',    value: profile ? displayName.split(/\s+/)[0] || 'User' : user.firstName || 'User' },
    { label: 'Last Name',     value: profile ? displayName.split(/\s+/).slice(1).join(' ') || 'N/A' : user.lastName || 'N/A' },
    { label: 'Email',         value: displayEmail },
    { label: 'Initials',      value: initials },
    { label: 'Student ID',    value: user.studentId || 'N/A' },
    { label: 'Member Since',  value: formatDate(user.createdAt) },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Account</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">My Profile</h2>
      </div>

      <SectionCard>
        {/* Avatar + name */}
        {profileLoading ? (
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
              {user.studentId && <p className="text-xs text-gray-400 mt-0.5">ID: {user.studentId}</p>}
              {!profile && <p className="text-[11px] text-gray-400 mt-1">Using local account fallback profile.</p>}
            </div>
          </div>
        )}

        <Separator className="mb-5" />

        {/* Profile fields grid */}
        <div className="grid grid-cols-1 gap-y-4 gap-x-6 sm:grid-cols-2">
          {profileFields.map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className="text-sm font-medium text-gray-900">{value}</p>
            </div>
          ))}

          {/* Account status — special treatment */}
          <div>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Account Status</p>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              user.isActive
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {user.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}