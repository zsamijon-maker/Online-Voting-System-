import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import {
  Crown, Users, Star, Plus, Edit, Trash2, Play, CheckCircle,
  UserPlus, Search, Check, MoreHorizontal, Calendar, BarChart3, Scale,
  TrendingUp, LogOut, Menu, X, ChevronDown, ChevronUp, Trophy, Medal, Vote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getAllPageants, createPageant, updatePageant, deletePageant,
  startPageant, completePageant, getPageantResults,
  addContestant, updateContestant, removeContestant, addCriteria,
  assignJudgesBulk, getAssignableJudges, getContestantsByPageant,
  getCriteriaByPageant, getPageantJudges, validateCriteriaWeights,
} from '@/services/pageantService';
import type {
  Pageant, Contestant, Criteria, PageantJudge, PageantResult,
  PageantResultsResponse, PageantFormData, ContestantFormData,
  CriteriaFormData, User,
} from '@/types';
import { formatDate, formatPageantStatus, formatScoringMethod } from '@/utils/formatters';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Shared design primitives ─────────────────────────────────────────────────
const NAV = [
  { value: 'overview',    label: 'Overview',          icon: TrendingUp },
  { value: 'pageants',    label: 'Manage Pageants',    icon: Crown },
  { value: 'contestants', label: 'Contestants',        icon: Users },
  { value: 'criteria',    label: 'Criteria',           icon: Scale },
  { value: 'judges',      label: 'Judges',             icon: Star },
  { value: 'results',     label: 'Results',            icon: BarChart3 },
];

const ActionBtn = ({
  type = 'button', onClick, disabled, children, color = 'blue', fullWidth = false, size = 'md',
}: {
  type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean;
  children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'outline' | 'purple';
  fullWidth?: boolean; size?: 'sm' | 'md';
}) => {
  const palette = {
    blue:   'bg-[#1E3A8A] hover:bg-[#1d3580] text-white shadow-sm shadow-blue-200',
    green:  'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200',
    red:    'bg-red-600 hover:bg-red-700 text-white',
    outline:'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
    purple: 'bg-purple-700 hover:bg-purple-800 text-white shadow-sm shadow-purple-200',
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

const DataTable = ({ headers, children, empty }: {
  headers: string[]; children: React.ReactNode; empty?: boolean;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-100">
        <thead>
          <tr className="bg-[#1E3A8A]">
            {headers.map((h, i) => (
              <th key={i} className={`px-5 py-3 text-xs font-bold text-white uppercase tracking-wider ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {empty ? (
            <tr><td colSpan={headers.length} className="px-5 py-10 text-center text-sm text-gray-400">No data available.</td></tr>
          ) : children}
        </tbody>
      </table>
    </div>
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
      {formatPageantStatus(status)}
    </span>
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

const SectionHeader = ({ title, subtitle, action }: {
  title: string; subtitle?: string; action?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

const FormField = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs font-semibold text-gray-700 tracking-wide">{label}</Label>
    {children}
    {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
  </div>
);
const fic = "rounded-xl border-gray-200 bg-gray-50/60 text-sm focus:ring-[#1E3A8A]/30 focus:border-[#1E3A8A]";

// ─── Rank badge helper ────────────────────────────────────────────────────────
const rankBadge = (rank: number) => {
  if (rank === 1) return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-700"><Trophy className="h-3 w-3" /> Gold</span>;
  if (rank === 2) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600"><Medal className="h-3 w-3" /> Silver</span>;
  if (rank === 3) return <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-700"><Medal className="h-3 w-3" /> Bronze</span>;
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function PageantCommitteeDashboard() {
  // ── All logic unchanged ───────────────────────────────────────────────────
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab]                           = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen]         = useState(false);
  const [pageants, setPageants]                             = useState<Pageant[]>([]);
  const [selectedPageant, setSelectedPageant]               = useState<Pageant | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen]           = useState(false);
  const [isEditModalOpen, setIsEditModalOpen]               = useState(false);
  const [isContestantModalOpen, setIsContestantModalOpen]   = useState(false);
  const [isEditContestantModalOpen, setIsEditContestantModalOpen] = useState(false);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen]       = useState(false);
  const [isJudgeModalOpen, setIsJudgeModalOpen]             = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen]         = useState(false);
  const [results, setResults]                               = useState<PageantResultsResponse>([]);
  const [rankingTieBreaker, setRankingTieBreaker]           = useState<'weighted_criteria' | 'judge_priority' | 'keep_tied'>('keep_tied');
  const [isMobileNavOpen, setIsMobileNavOpen]               = useState(false);
  const [selectedContestant, setSelectedContestant]         = useState<Contestant | null>(null);
  const [contestantsRefreshTick, setContestantsRefreshTick] = useState(0);

  const fetchPageants = useCallback(async () => {
    const allPageants = await getAllPageants();
    setPageants(allPageants);
  }, []);

  useEffect(() => { Promise.resolve().then(() => { void fetchPageants(); }); }, [fetchPageants]);
  useEffect(() => { Promise.resolve().then(() => { void fetchPageants(); }); }, [activeTab, fetchPageants]);
  useEffect(() => {
    const handleFocus = () => { void fetchPageants(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchPageants]);

  const handleCreatePageant = async (data: PageantFormData) => {
    if (!user) { showError('You must be signed in to create a pageant.'); return; }
    try {
      await createPageant(data, user.id);
      showSuccess('Pageant created successfully');
      setIsCreateModalOpen(false);
      void fetchPageants();
    } catch (error) { showError(error instanceof Error ? error.message : 'Failed to create pageant'); }
  };

  const handleUpdatePageant = async (id: string, updates: Partial<Pageant>) => {
    const result = await updatePageant(id, updates);
    if (result) {
      showSuccess('Pageant updated successfully');
      setIsEditModalOpen(false); setSelectedPageant(null); void fetchPageants();
    } else { showError('Failed to update pageant'); }
  };

  const handleDeletePageant = async (id: string) => {
    if (confirm('Are you sure you want to delete this pageant?')) {
      const success = await deletePageant(id);
      if (success) { showSuccess('Pageant deleted successfully'); void fetchPageants(); }
      else { showError('Failed to delete pageant'); }
    }
  };

  const handleStartPageant    = async (id: string) => { const r = await startPageant(id);    if (r) { showSuccess('Pageant is now active');  void fetchPageants(); } };
  const handleCompletePageant = async (id: string) => { const r = await completePageant(id); if (r) { showSuccess('Pageant has been completed'); void fetchPageants(); } };
  const handleViewResults = async (pageant: Pageant, tieBreaker = rankingTieBreaker) => {
    const pageantResults = await getPageantResults(
      pageant.id,
      pageant.scoringMethod === 'ranking' || pageant.scoringMethod === 'ranking_by_gender' ? tieBreaker : undefined
    );
    setResults(pageantResults); setSelectedPageant(pageant); setIsResultsModalOpen(true);
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
      setIsContestantModalOpen(false); setSelectedPageant(null); setSelectedContestant(null);
      void fetchPageants();
    } catch (error) { showError(error instanceof Error ? error.message : 'Failed to add contestant'); }
  };

  const handleUpdateContestant = async (pageantId: string, contestantId: string, data: ContestantFormData) => {
    const updated = await updateContestant(contestantId, pageantId, {
      contestantNumber: data.contestantNumber, firstName: data.firstName, lastName: data.lastName,
      bio: data.bio, age: data.age, department: data.department, gender: data.gender,
      photoUrl: data.photoUrl, isActive: true, imageFile: data.imageFile,
    });
    if (!updated) { showError('Failed to update contestant'); return; }
    showSuccess('Contestant updated successfully');
    setContestantsRefreshTick((prev) => prev + 1);
    setIsEditContestantModalOpen(false); setSelectedPageant(null); setSelectedContestant(null);
    void fetchPageants();
  };

  const handleDeleteContestant = async (pageantId: string, contestant: Contestant) => {
    if (!confirm(`Are you sure you want to remove ${contestant.firstName} ${contestant.lastName}?`)) return;
    const success = await removeContestant(contestant.id, pageantId);
    if (!success) { showError('Failed to remove contestant'); return; }
    showSuccess('Contestant removed successfully');
    setContestantsRefreshTick((prev) => prev + 1);
    void fetchPageants();
  };

  const handleAddCriteria = async (pageantId: string, data: CriteriaFormData) => {
    try {
      await addCriteria(pageantId, data);
      showSuccess('Criteria added successfully');
      setIsCriteriaModalOpen(false); void fetchPageants();
    } catch (error) { showError(error instanceof Error ? error.message : 'Failed to add criteria'); }
  };

  const handleAssignJudges = async (pageantId: string, judgeIds: string[]) => {
    if (!user) { showError('You must be signed in to assign judges.'); return; }
    try {
      const result = await assignJudgesBulk(pageantId, judgeIds);
      const suffix = result.assignedCount === 1 ? '' : 's';
      showSuccess(`${result.assignedCount} judge${suffix} assigned successfully`);
      if (result.invalidJudgeIds.length > 0) {
        showError(`${result.invalidJudgeIds.length} selection(s) were skipped because they are not active judges.`);
      }
      setIsJudgeModalOpen(false); void fetchPageants();
    } catch (error) { showError(error instanceof Error ? error.message : 'Failed to assign judges'); }
  };

  const handleLogout = async () => { await logout(); window.location.href = '/login'; };

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
            <span className="text-sm font-bold text-gray-900">Pageant Panel</span>
          </div>
          <button
            type="button" onClick={() => setIsMobileNavOpen((prev) => !prev)}
            className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {isMobileNavOpen && (
          <button type="button" className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden" aria-label="Close navigation overlay" onClick={() => setIsMobileNavOpen(false)} />
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
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Pageant Panel</p>
              </div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-3 space-y-1">
            <TabsList className="h-auto w-full bg-transparent p-0 flex flex-col items-stretch gap-1">
              {NAV.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}
                  className="w-full justify-start gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-left text-gray-600 border border-transparent hover:bg-gray-50 hover:text-gray-900 data-[state=active]:bg-[#EFF3FF] data-[state=active]:text-[#1E3A8A] data-[state=active]:border-[#C7D7FD] data-[state=active]:font-semibold transition-all"
                >
                  <Icon className="w-4 h-4 shrink-0" /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
          <div className="p-3 border-t border-gray-100">
            <button type="button" onClick={() => setIsLogoutDialogOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
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
                  {NAV.find(n => n.value === activeTab)?.label ?? 'Pageant Committee'}
                </h1>
                <p className="text-sm text-blue-200/80 mt-0.5">Welcome back, {user?.firstName} {user?.lastName}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white w-fit">
                <Crown className="w-3 h-3" /> Pageant Committee
              </span>
            </div>
          </header>

          <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
            <TabsContent value="overview">
              <PageantOverviewTab pageants={pageants} onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="pageants">
              <PageantsTab
                pageants={pageants}
                onCreate={() => setIsCreateModalOpen(true)}
                onEdit={(pageant) => { setSelectedPageant(pageant); setIsEditModalOpen(true); }}
                onDelete={handleDeletePageant}
                onStart={handleStartPageant}
                onComplete={handleCompletePageant}
                onViewResults={handleViewResults}
              />
            </TabsContent>
            <TabsContent value="contestants">
              <ContestantsTab
                pageants={pageants}
                refreshTick={contestantsRefreshTick}
                onAddContestant={(pageant) => { setSelectedPageant(pageant); setSelectedContestant(null); setIsContestantModalOpen(true); }}
                onEditContestant={(pageant, contestant) => { setSelectedPageant(pageant); setSelectedContestant(contestant); setIsEditContestantModalOpen(true); }}
                onDeleteContestant={handleDeleteContestant}
              />
            </TabsContent>
            <TabsContent value="criteria">
              <CriteriaTab pageants={pageants} onAddCriteria={(pageant) => { setSelectedPageant(pageant); setIsCriteriaModalOpen(true); }} />
            </TabsContent>
            <TabsContent value="judges">
              <JudgesTab pageants={pageants} onAssignJudge={(pageant) => { setSelectedPageant(pageant); setIsJudgeModalOpen(true); }} />
            </TabsContent>
            <TabsContent value="results">
              <ResultsTab pageants={pageants} onViewResults={handleViewResults} />
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

      {/* ── CREATE PAGEANT ───────────────────────────────────────────────── */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Create New Pageant</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Set up a new pageant competition.</DialogDescription>
          </DialogHeader>
          <PageantForm onSubmit={handleCreatePageant} onCancel={() => setIsCreateModalOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* ── EDIT PAGEANT ─────────────────────────────────────────────────── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Edit Pageant</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Update pageant details.</DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <PageantForm pageant={selectedPageant} onSubmit={(data) => handleUpdatePageant(selectedPageant.id, data)} onCancel={() => { setIsEditModalOpen(false); setSelectedPageant(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── ADD CONTESTANT ───────────────────────────────────────────────── */}
      <Dialog open={isContestantModalOpen} onOpenChange={setIsContestantModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Add Contestant</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Add a new contestant to {selectedPageant?.name}.</DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <ContestantForm scoringMethod={selectedPageant.scoringMethod} onSubmit={(data) => handleAddContestant(selectedPageant.id, data)} onCancel={() => { setIsContestantModalOpen(false); setSelectedPageant(null); setSelectedContestant(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── EDIT CONTESTANT ──────────────────────────────────────────────── */}
      <Dialog open={isEditContestantModalOpen} onOpenChange={setIsEditContestantModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Edit Contestant</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Update contestant details for {selectedPageant?.name}.</DialogDescription>
          </DialogHeader>
          {selectedPageant && selectedContestant && (
            <ContestantForm contestant={selectedContestant} scoringMethod={selectedPageant.scoringMethod} submitLabel="Save Changes" onSubmit={(data) => handleUpdateContestant(selectedPageant.id, selectedContestant.id, data)} onCancel={() => { setIsEditContestantModalOpen(false); setSelectedPageant(null); setSelectedContestant(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── ADD CRITERIA ─────────────────────────────────────────────────── */}
      <Dialog open={isCriteriaModalOpen} onOpenChange={setIsCriteriaModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Add Scoring Criteria</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Add a new criteria to {selectedPageant?.name}.</DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <CriteriaForm onSubmit={(data) => handleAddCriteria(selectedPageant.id, data)} onCancel={() => { setIsCriteriaModalOpen(false); setSelectedPageant(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── ASSIGN JUDGE ─────────────────────────────────────────────────── */}
      <Dialog open={isJudgeModalOpen} onOpenChange={setIsJudgeModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Assign Judge</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Assign a judge to {selectedPageant?.name}.</DialogDescription>
          </DialogHeader>
          {selectedPageant && (
            <AssignJudgeForm pageantId={selectedPageant.id} onSubmit={(judgeIds) => handleAssignJudges(selectedPageant.id, judgeIds)} onCancel={() => { setIsJudgeModalOpen(false); setSelectedPageant(null); }} />
          )}
        </DialogContent>
      </Dialog>

      {/* ── RESULTS MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Pageant Results</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Results for {selectedPageant?.name}</DialogDescription>
          </DialogHeader>
          {(selectedPageant?.scoringMethod === 'ranking' || selectedPageant?.scoringMethod === 'ranking_by_gender') && (
            <div className="mb-4 space-y-1.5">
              <Label className="text-xs font-semibold text-gray-700 tracking-wide">Ranking Tie-breaker</Label>
              <Select value={rankingTieBreaker} onValueChange={(value: 'weighted_criteria' | 'judge_priority' | 'keep_tied') => void handleRankingTieBreakerChange(value)}>
                <SelectTrigger className="w-full sm:w-72 rounded-xl border-gray-200 text-sm"><SelectValue placeholder="Select tie-breaker" /></SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="keep_tied">Keep tied rank</SelectItem>
                  <SelectItem value="weighted_criteria">Highest weighted criteria score</SelectItem>
                  <SelectItem value="judge_priority">Judge priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <PageantResultsDisplay results={results} scoringMethod={selectedPageant?.scoringMethod} pageant={selectedPageant} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantOverviewTab({ pageants, onNavigate }: { pageants: Pageant[]; onNavigate: (tab: string) => void }) {
  const total     = pageants.length;
  const active    = pageants.filter(p => p.status === 'active').length;
  const upcoming  = pageants.filter(p => p.status === 'upcoming' || p.status === 'draft').length;
  const completed = pageants.filter(p => p.status === 'completed' || p.status === 'archived').length;

  const statusData = [
    { status: 'Active', count: active },
    { status: 'Upcoming', count: upcoming },
    { status: 'Completed', count: completed },
  ].filter(d => d.count > 0);

  const recentPageants = [...pageants].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  const statCards = [
    { label: 'Total Pageants',    value: total,     accent: 'bg-purple-50 text-purple-600', icon: Crown },
    { label: 'Active',            value: active,    accent: 'bg-green-50 text-green-600',   icon: Vote },
    { label: 'Upcoming / Draft',  value: upcoming,  accent: 'bg-amber-50 text-amber-600',   icon: Calendar },
    { label: 'Completed',         value: completed, accent: 'bg-gray-50 text-gray-500',     icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SectionCard>
          <CardHeading eyebrow="Distribution" title="Pageants by Status" />
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" fill="#7C3AED" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 py-8 text-center">No pageants yet.</p>}
        </SectionCard>

        <SectionCard>
          <CardHeading eyebrow="Latest" title="Recent Pageants" />
          {recentPageants.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {recentPageants.map((pageant) => (
                <li key={pageant.id} className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate min-w-0">{pageant.name}</span>
                  <StatusPill status={pageant.status} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-gray-400">No pageants found.</p>}
        </SectionCard>
      </div>

      <SectionCard>
        <CardHeading eyebrow="Shortcuts" title="Quick Actions" />
        <div className="flex flex-wrap gap-3">
          <ActionBtn onClick={() => onNavigate('pageants')} color="blue"><Crown className="w-4 h-4" /> Manage Pageants</ActionBtn>
          <ActionBtn onClick={() => onNavigate('contestants')} color="outline"><Users className="w-4 h-4" /> Manage Contestants</ActionBtn>
          <ActionBtn onClick={() => onNavigate('judges')} color="outline"><Star className="w-4 h-4" /> Manage Judges</ActionBtn>
          <ActionBtn onClick={() => onNavigate('results')} color="outline"><BarChart3 className="w-4 h-4" /> View Results</ActionBtn>
        </div>
      </SectionCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANTS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantsTab({ pageants, onCreate, onEdit, onDelete, onStart, onComplete, onViewResults }: {
  pageants: Pageant[]; onCreate: () => void; onEdit: (pageant: Pageant) => void;
  onDelete: (id: string) => void; onStart: (id: string) => void; onComplete: (id: string) => void;
  onViewResults: (pageant: Pageant) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="All Pageants"
        subtitle={`${pageants.length} total pageant${pageants.length !== 1 ? 's' : ''}`}
        action={<ActionBtn color="green" onClick={onCreate}><Plus className="w-4 h-4" /> Create Pageant</ActionBtn>}
      />
      <DataTable headers={['Pageant', 'Status', 'Event Date', 'Actions']} empty={pageants.length === 0}>
        {pageants.map((pageant) => (
          <tr key={pageant.id} className="hover:bg-gray-50/70 transition-colors">
            <td className="px-5 py-3.5">
              <p className="text-sm font-semibold text-gray-900">{pageant.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formatScoringMethod(pageant.scoringMethod)}</p>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap"><StatusPill status={pageant.status} /></td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" /> {formatDate(pageant.eventDate)}
              </div>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem onClick={() => onEdit(pageant)}><Edit className="w-4 h-4 mr-2" /> Edit</DropdownMenuItem>
                  {pageant.status === 'upcoming' && <DropdownMenuItem onClick={() => onStart(pageant.id)}><Play className="w-4 h-4 mr-2" /> Start Pageant</DropdownMenuItem>}
                  {pageant.status === 'active' && <DropdownMenuItem onClick={() => onComplete(pageant.id)}><CheckCircle className="w-4 h-4 mr-2" /> Complete</DropdownMenuItem>}
                  <DropdownMenuItem onClick={() => onViewResults(pageant)}><BarChart3 className="w-4 h-4 mr-2" /> View Results</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(pageant.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTESTANTS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ContestantsTab({ pageants, refreshTick, onAddContestant, onEditContestant, onDeleteContestant }: {
  pageants: Pageant[]; refreshTick: number;
  onAddContestant: (pageant: Pageant) => void;
  onEditContestant: (pageant: Pageant, contestant: Contestant) => void;
  onDeleteContestant: (pageantId: string, contestant: Contestant) => void;
}) {
  const [selectedPageantId, setSelectedPageantId] = useState<string>('');
  const [contestants, setContestants]             = useState<Contestant[]>([]);
  const [loadingContestants, setLoadingContestants] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!selectedPageantId) {
      Promise.resolve().then(() => { setContestants([]); });
      return;
    }
    Promise.resolve().then(() => {
      setLoadingContestants(true);
      getContestantsByPageant(selectedPageantId)
        .then((c) => { if (mounted) setContestants(c); })
        .catch(() => { if (mounted) setContestants([]); })
        .finally(() => { if (mounted) setLoadingContestants(false); });
    });
    return () => { mounted = false; };
  }, [selectedPageantId, refreshTick]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Manage Contestants"
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Select value={selectedPageantId} onValueChange={setSelectedPageantId}>
              <SelectTrigger className="w-full sm:w-60 rounded-xl border-gray-200 text-sm"><SelectValue placeholder="Select a pageant" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {pageants.map((pageant) => <SelectItem key={pageant.id} value={pageant.id}>{pageant.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedPageantId && (
              <ActionBtn color="green" onClick={() => { const p = pageants.find(p => p.id === selectedPageantId); if (p) onAddContestant(p); }}>
                <Plus className="w-4 h-4" /> Add Contestant
              </ActionBtn>
            )}
          </div>
        }
      />

      {!selectedPageantId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">Select a Pageant</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">Choose a pageant to view and manage its contestants.</p>
        </div>
      ) : loadingContestants ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" /> Loading contestants…
        </div>
      ) : contestants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><Users className="w-8 h-8 text-gray-300" /></div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">No Contestants Yet</h3>
          <p className="text-sm text-gray-400 mt-1">Add your first contestant to this pageant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contestants.map((contestant) => {
            const selectedPageant = pageants.find((p) => p.id === selectedPageantId);
            return (
              <div key={contestant.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-lg font-extrabold shrink-0">
                      {(contestant.photoPath || contestant.photoUrl) ? (
                        <img src={contestant.photoPath || contestant.photoUrl} alt={`${contestant.firstName} ${contestant.lastName}`} className="w-full h-full object-cover" />
                      ) : `${contestant.firstName[0]}${contestant.lastName[0]}`}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-gray-900 truncate">#{contestant.contestantNumber} {contestant.firstName} {contestant.lastName}</p>
                      {contestant.department && <p className="text-xs text-gray-400 truncate">{contestant.department}</p>}
                      {contestant.age && <p className="text-xs text-gray-400">Age: {contestant.age}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                      onClick={() => { if (selectedPageant) onEditContestant(selectedPageant, contestant); }}
                    ><Edit className="w-3.5 h-3.5" /></button>
                    <button type="button"
                      className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                      onClick={() => onDeleteContestant(selectedPageantId, contestant)}
                    ><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERIA TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function CriteriaTab({ pageants, onAddCriteria }: { pageants: Pageant[]; onAddCriteria: (pageant: Pageant) => void }) {
  const [selectedPageantId, setSelectedPageantId] = useState<string>('');
  const [criteria, setCriteria]                   = useState<Criteria[]>([]);
  const [loadingCriteria, setLoadingCriteria]     = useState(false);
  const [weightValidation, setWeightValidation]   = useState<{ valid: boolean; total: number }>({ valid: true, total: 0 });

  useEffect(() => {
    let mounted = true;
    if (!selectedPageantId) {
      Promise.resolve().then(() => {
        setCriteria([]);
        setWeightValidation({ valid: true, total: 0 });
      });
      return;
    }
    Promise.resolve().then(() => {
      setLoadingCriteria(true);
      Promise.all([getCriteriaByPageant(selectedPageantId), validateCriteriaWeights(selectedPageantId)])
        .then(([c, validation]) => { if (!mounted) return; setCriteria(c); setWeightValidation(validation); })
        .catch(() => { if (!mounted) return; setCriteria([]); setWeightValidation({ valid: true, total: 0 }); })
        .finally(() => { if (mounted) setLoadingCriteria(false); });
    });
    return () => { mounted = false; };
  }, [selectedPageantId]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Scoring Criteria"
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Select value={selectedPageantId} onValueChange={setSelectedPageantId}>
              <SelectTrigger className="w-full sm:w-60 rounded-xl border-gray-200 text-sm"><SelectValue placeholder="Select a pageant" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {pageants.map((pageant) => <SelectItem key={pageant.id} value={pageant.id}>{pageant.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedPageantId && (
              <ActionBtn color="green" onClick={() => { const p = pageants.find(p => p.id === selectedPageantId); if (p) onAddCriteria(p); }}>
                <Plus className="w-4 h-4" /> Add Criteria
              </ActionBtn>
            )}
          </div>
        }
      />

      {!selectedPageantId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><Scale className="w-8 h-8 text-gray-300" /></div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">Select a Pageant</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">Choose a pageant to view and manage its scoring criteria.</p>
        </div>
      ) : loadingCriteria ? (
        <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-gray-100 gap-2 text-sm text-gray-400">
          <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" /> Loading criteria…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Weight validation */}
          <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${weightValidation.valid ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <Scale className={`w-5 h-5 shrink-0 ${weightValidation.valid ? 'text-green-600' : 'text-amber-500'}`} />
            <span className={`text-sm font-semibold ${weightValidation.valid ? 'text-green-800' : 'text-amber-800'}`}>
              Total Weight: {weightValidation.total.toFixed(2)}%
              {!weightValidation.valid && <span className="font-normal ml-1 text-amber-700">(Should equal 100%)</span>}
            </span>
          </div>

          <DataTable headers={['Criteria', 'Weight', 'Max Score']} empty={criteria.length === 0}>
            {criteria.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                  {c.description && <p className="text-xs text-gray-400 mt-0.5">{c.description}</p>}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">{c.weight}%</td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600 text-right">{c.maxScore}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// JUDGES TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function JudgesTab({ pageants, onAssignJudge }: { pageants: Pageant[]; onAssignJudge: (pageant: Pageant) => void }) {
  const [selectedPageantId, setSelectedPageantId] = useState<string>('');
  const [judges, setJudges]                       = useState<PageantJudge[]>([]);

  useEffect(() => {
    if (!selectedPageantId) {
      Promise.resolve().then(() => { setJudges([]); });
      return;
    }
    Promise.resolve().then(() => {
      getPageantJudges(selectedPageantId).then(setJudges);
    });
  }, [selectedPageantId]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Assigned Judges"
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Select value={selectedPageantId} onValueChange={setSelectedPageantId}>
              <SelectTrigger className="w-full sm:w-60 rounded-xl border-gray-200 text-sm"><SelectValue placeholder="Select a pageant" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                {pageants.map((pageant) => <SelectItem key={pageant.id} value={pageant.id}>{pageant.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedPageantId && (
              <ActionBtn color="green" onClick={() => { const p = pageants.find(p => p.id === selectedPageantId); if (p) onAssignJudge(p); }}>
                <UserPlus className="w-4 h-4" /> Assign Judge
              </ActionBtn>
            )}
          </div>
        }
      />

      {!selectedPageantId ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><UserPlus className="w-8 h-8 text-gray-300" /></div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">Select a Pageant</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">Choose a pageant to view and manage its judges.</p>
        </div>
      ) : (
        <DataTable headers={['Judge Name', 'Assigned At', 'Status']} empty={judges.length === 0}>
          {judges.map((judge) => (
            <tr key={judge.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-5 py-3.5 whitespace-nowrap text-sm font-semibold text-gray-900">{judge.judgeName}</td>
              <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-500">{formatDate(judge.assignedAt)}</td>
              <td className="px-5 py-3.5 whitespace-nowrap text-right">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">Active</span>
              </td>
            </tr>
          ))}
        </DataTable>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ResultsTab({ pageants, onViewResults }: { pageants: Pageant[]; onViewResults: (pageant: Pageant) => void }) {
  const completedPageants = pageants.filter(p => p.status === 'completed' || p.status === 'archived');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Analytics</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Pageant Results</h2>
      </div>

      {completedPageants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><BarChart3 className="w-8 h-8 text-gray-300" /></div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">No Completed Pageants</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">There are no completed pageants with results available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {completedPageants.map((pageant) => (
            <div key={pageant.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1">{pageant.name}</h3>
              <p className="text-xs text-gray-400 mb-4">Completed {formatDate(pageant.eventDate)}</p>
              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${pageant.resultsPublic ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {pageant.resultsPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <ActionBtn color="green" fullWidth onClick={() => onViewResults(pageant)}>
                <BarChart3 className="w-4 h-4" /> View Results
              </ActionBtn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANT FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantForm({ pageant, onSubmit, onCancel }: {
  pageant?: Pageant; onSubmit: (data: PageantFormData) => void; onCancel: () => void;
}) {
  const [formData, setFormData] = useState<PageantFormData>({
    name: pageant?.name || '', description: pageant?.description || '',
    eventDate: pageant?.eventDate || '', scoringMethod: pageant?.scoringMethod || 'weighted',
    totalWeight: pageant?.totalWeight || 100, resultsPublic: pageant?.resultsPublic || false,
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <FormField label="Pageant Name"><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className={fic} /></FormField>
      <FormField label="Description"><Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className={fic} /></FormField>
      <FormField label="Event Date"><Input id="eventDate" type="date" value={formData.eventDate} onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })} required className={fic} /></FormField>
      <FormField label="Scoring Method">
        <Select value={formData.scoringMethod} onValueChange={(value) => setFormData({ ...formData, scoringMethod: value as PageantFormData['scoringMethod'] })}>
          <SelectTrigger className={fic}><SelectValue /></SelectTrigger>
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
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">{pageant ? 'Save Changes' : 'Create Pageant'}</Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTESTANT FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ContestantForm({ contestant, scoringMethod, submitLabel, onSubmit, onCancel }: {
  contestant?: Contestant; scoringMethod: Pageant['scoringMethod'];
  submitLabel?: string; onSubmit: (data: ContestantFormData) => void; onCancel: () => void;
}) {
  const [formData, setFormData] = useState<ContestantFormData>({
    contestantNumber: contestant?.contestantNumber || 1, firstName: contestant?.firstName || '',
    lastName: contestant?.lastName || '', gender: contestant?.gender ?? undefined,
    bio: contestant?.bio || '', age: contestant?.age, department: contestant?.department || '',
    photoUrl: contestant?.photoUrl || '', photoPath: contestant?.photoPath || '', imageFile: undefined,
  });
  const [previewUrl, setPreviewUrl]                   = useState<string>('');
  const [fileName, setFileName]                       = useState<string>('');
  const [fileValidationError, setFileValidationError] = useState<string>('');
  const [genderValidationError, setGenderValidationError] = useState<string>('');
  const genderRequired = scoringMethod === 'ranking_by_gender';

  useEffect(() => {
    if (!contestant) return;
    Promise.resolve().then(() => {
      setFormData({ contestantNumber: contestant.contestantNumber, firstName: contestant.firstName, lastName: contestant.lastName, gender: contestant.gender ?? undefined, bio: contestant.bio || '', age: contestant.age, department: contestant.department || '', photoUrl: contestant.photoUrl || '', photoPath: contestant.photoPath || '', imageFile: undefined });
      setPreviewUrl(''); setFileName(''); setFileValidationError(''); setGenderValidationError('');
    });
  }, [contestant]);

  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (genderRequired && !formData.gender) { setGenderValidationError('Gender is required for Ranking by Gender pageants.'); return; }
    setGenderValidationError(''); onSubmit(formData);
  };

  const handleFileChange = (file?: File) => {
    if (!file) { setFormData({ ...formData, imageFile: undefined }); setPreviewUrl(''); setFileName(''); setFileValidationError(''); return; }
    if (!['image/jpeg', 'image/png'].includes(file.type)) { setFileValidationError('Only JPEG and PNG images are allowed.'); setFormData({ ...formData, imageFile: undefined }); setPreviewUrl(''); setFileName(''); return; }
    if (file.size > 2 * 1024 * 1024) { setFileValidationError('Image must be 2MB or smaller.'); setFormData({ ...formData, imageFile: undefined }); setPreviewUrl(''); setFileName(''); return; }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setFormData({ ...formData, imageFile: file }); setPreviewUrl(nextPreview); setFileName(file.name); setFileValidationError('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Contestant #"><Input type="number" min={1} value={formData.contestantNumber} onChange={(e) => setFormData({ ...formData, contestantNumber: parseInt(e.target.value) })} required className={fic} /></FormField>
        <FormField label="Age"><Input type="number" min={16} max={100} value={formData.age || ''} onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || undefined })} className={fic} /></FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First Name"><Input value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className={fic} /></FormField>
        <FormField label="Last Name"><Input value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className={fic} /></FormField>
      </div>
      {genderRequired && (
        <FormField label="Gender">
          <Select value={formData.gender} onValueChange={(value: 'Male' | 'Female') => { setFormData({ ...formData, gender: value }); setGenderValidationError(''); }}>
            <SelectTrigger className={fic}><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent className="rounded-xl"><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
          </Select>
          {genderValidationError && <p className="text-xs text-red-600">{genderValidationError}</p>}
        </FormField>
      )}
      <FormField label="Department/College"><Input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} placeholder="e.g., College of Engineering" className={fic} /></FormField>
      <FormField label="Contestant Image" hint="JPG or PNG, max 2MB">
        <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e.target.files?.[0])} className={fic} />
        {fileName && <p className="text-xs text-gray-600">Selected: {fileName}</p>}
        {fileValidationError && <p className="text-xs text-red-600">{fileValidationError}</p>}
        {(previewUrl || formData.photoPath || formData.photoUrl) && (
          <div className="mt-2 rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</p>
            <img src={previewUrl || formData.photoPath || formData.photoUrl} alt="Contestant preview" className="w-16 h-16 object-cover rounded-2xl border border-gray-200" />
          </div>
        )}
      </FormField>
      <FormField label="Biography"><Textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} rows={3} className={fic} /></FormField>
      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">{submitLabel ?? 'Add Contestant'}</Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRITERIA FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function CriteriaForm({ onSubmit, onCancel }: { onSubmit: (data: CriteriaFormData) => void; onCancel: () => void }) {
  const [formData, setFormData] = useState<CriteriaFormData>({ name: '', description: '', weight: 25, maxScore: 10, displayOrder: 0 });
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(formData); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <FormField label="Criteria Name"><Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Beauty & Poise" required className={fic} /></FormField>
      <FormField label="Description"><Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} className={fic} /></FormField>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="Weight (%)"><Input type="number" min={1} max={100} step={0.01} value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) })} required className={fic} /></FormField>
        <FormField label="Max Score"><Input type="number" min={1} max={100} value={formData.maxScore} onChange={(e) => setFormData({ ...formData, maxScore: parseFloat(e.target.value) })} required className={fic} /></FormField>
      </div>
      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white">Add Criteria</Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGN JUDGE FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function AssignJudgeForm({ pageantId, onSubmit, onCancel }: {
  pageantId: string; onSubmit: (judgeIds: string[]) => void; onCancel: () => void;
}) {
  const [judges, setJudges]                   = useState<User[]>([]);
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>([]);
  const [assignedJudgeIds, setAssignedJudgeIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm]           = useState('');
  const [isLoading, setIsLoading]             = useState(true);
  const [loadError, setLoadError]             = useState<string>('');

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([getAssignableJudges(pageantId), getPageantJudges(pageantId)])
      .then(([availableResult, assignedResult]) => {
        if (!mounted) return;
        if (availableResult.status === 'fulfilled') { setJudges(availableResult.value.filter((u) => u.roles.includes('judge') && u.isActive)); }
        else { setJudges([]); setLoadError('Unable to load judges. Please refresh and try again.'); }
        if (assignedResult.status === 'fulfilled') { setAssignedJudgeIds(new Set(assignedResult.value.filter((j) => j.isActive).map((j) => j.judgeId))); }
        else { setAssignedJudgeIds(new Set()); if (availableResult.status === 'fulfilled') { setLoadError('Unable to load current assignments. You can still select judges.'); } }
      })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [pageantId]);

  const filteredJudges = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return judges;
    return judges.filter((judge) => {
      const fullName = `${judge.firstName} ${judge.lastName}`.toLowerCase();
      return fullName.includes(query) || judge.email.toLowerCase().includes(query);
    });
  }, [judges, searchTerm]);

  const toggleJudge = (judgeId: string) => {
    if (assignedJudgeIds.has(judgeId)) return;
    setSelectedJudgeIds((prev) => prev.includes(judgeId) ? prev.filter((id) => id !== judgeId) : [...prev, judgeId]);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (selectedJudgeIds.length === 0) return; onSubmit(selectedJudgeIds); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold text-gray-700 tracking-wide">Search Judges</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search by name or email" className={`${fic} pl-9`} />
        </div>
        <p className="text-xs text-gray-400">Selected: <span className="font-semibold text-gray-600">{selectedJudgeIds.length}</span></p>
        {loadError && <p className="text-xs text-amber-600">{loadError}</p>}
      </div>

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-gray-100 p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-gray-400">
            <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" /> Loading judges…
          </div>
        ) : filteredJudges.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">No judges found.</p>
        ) : filteredJudges.map((judge) => {
          const isSelected = selectedJudgeIds.includes(judge.id);
          const isAlreadyAssigned = assignedJudgeIds.has(judge.id);
          const displayName = `${judge.firstName} ${judge.lastName}`;
          const profilePhoto = judge.photoPath || judge.photoUrl;

          return (
            <button
              key={judge.id} type="button"
              className={`w-full rounded-xl border p-3 text-left transition-all ${
                isAlreadyAssigned ? 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-70'
                : isSelected ? 'border-[#166534] bg-green-50 ring-1 ring-[#166534]/20'
                : 'border-gray-100 bg-white hover:border-[#1E3A8A]/30 hover:bg-gray-50/60'
              }`}
              onClick={() => toggleJudge(judge.id)}
              disabled={isAlreadyAssigned}
              aria-pressed={isSelected}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {profilePhoto ? <img src={profilePhoto} alt={displayName} className="w-full h-full object-cover" /> : `${judge.firstName?.[0]}${judge.lastName?.[0]}`}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
                  <p className="truncate text-xs text-gray-400">{judge.email}</p>
                </div>
                {isAlreadyAssigned ? (
                  <span className="text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5">Assigned</span>
                ) : isSelected ? (
                  <span className="rounded-full bg-[#166534] p-1 text-white"><Check className="h-3 w-3" /></span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white" disabled={selectedJudgeIds.length === 0}>
          Assign Selected Judges
        </Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGEANT RESULTS DISPLAY (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function PageantResultsDisplay({ results, scoringMethod, pageant }: {
  results: PageantResultsResponse; scoringMethod?: Pageant['scoringMethod']; pageant?: Pageant | null;
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) => setExpandedRows((prev) => {
    const n = new Set(prev);
    if (n.has(id)) {
      n.delete(id);
    } else {
      n.add(id);
    }
    return n;
  });

  const resolvedScoringMode = (firstResult?: PageantResult) =>
    firstResult?.scoringMode || (scoringMethod === 'average' ? 'AVERAGE' : scoringMethod === 'ranking' ? 'RANKING' : scoringMethod === 'ranking_by_gender' ? 'RANKING_BY_GENDER' : 'WEIGHTED_MEAN');

  const rowScoreDisplay = (result: PageantResult, mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    if (mode === 'AVERAGE') return { finalScore: `${(result.finalScore ?? result.totalScore).toFixed(2)} / 10`, additional: 'Final score (/10)' };
    if (mode === 'RANKING') return { finalScore: `Rank #${result.rank}`, additional: `Average rank: ${(result.rankScore ?? result.totalScore).toFixed(2)}` };
    return { finalScore: `${(result.finalPercentage ?? result.weightedScore).toFixed(2)}%`, additional: `Final rating: ${(result.finalRating ?? result.totalScore).toFixed(2)} / 10` };
  };

  const chartDataFor = (list: PageantResult[], mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    const maxRank = Math.max(...list.map((r) => r.rank), 1);
    return list.map((r) => {
      if (mode === 'AVERAGE') { const pct = ((r.finalScore ?? r.totalScore) / 10) * 100; return { name: `#${r.contestantNumber}`, fullName: r.contestantName, value: Number(pct.toFixed(2)), label: `${pct.toFixed(1)}%` }; }
      if (mode === 'RANKING') { const pct = maxRank === 1 ? 100 : ((maxRank - r.rank) / (maxRank - 1)) * 100; return { name: `#${r.contestantNumber}`, fullName: r.contestantName, value: Number(pct.toFixed(2)), label: `#${r.rank}` }; }
      const pct = r.finalPercentage ?? r.weightedScore;
      return { name: `#${r.contestantNumber}`, fullName: r.contestantName, value: Number(pct.toFixed(2)), label: `${pct.toFixed(1)}%` };
    });
  };

  const sortResultsByMode = (list: PageantResult[], mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    const sorted = [...list];
    if (mode === 'RANKING') { sorted.sort((a, b) => a.rank - b.rank); return sorted; }
    if (mode === 'AVERAGE') { sorted.sort((a, b) => (b.finalScore ?? b.totalScore) - (a.finalScore ?? a.totalScore)); return sorted; }
    sorted.sort((a, b) => (b.finalPercentage ?? b.weightedScore) - (a.finalPercentage ?? a.weightedScore));
    return sorted;
  };

  const renderComparisonChart = (title: string, list: PageantResult[], mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    if (list.length === 0) return <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-400">No contestants in this section.</div>;
    const chartData = chartDataFor(sortResultsByMode(list, mode), mode);
    return (
      <SectionCard>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold text-gray-900">{title}</p>
          <p className="text-xs text-gray-400">{mode === 'RANKING' ? 'Higher bar = better rank' : 'Higher bar = better score'}</p>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={chartData} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(value: number, _name, item) => [mode === 'RANKING' ? `${item.payload.label} (${value.toFixed(1)}%)` : `${value.toFixed(1)}%`, item.payload.fullName]} />
            <Bar dataKey="value" fill="#1E3A8A" radius={[6, 6, 0, 0]}>
              <LabelList dataKey="label" position="top" fill="#1F2937" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 sm:grid-cols-3 lg:grid-cols-4">
          {chartData.map((row) => (
            <div key={row.fullName} className="rounded-xl border border-gray-100 bg-gray-50/60 px-2 py-1.5">
              <span className="font-extrabold text-gray-800">{row.name}</span> {row.label}
            </div>
          ))}
        </div>
      </SectionCard>
    );
  };

  const renderDetails = (result: PageantResult) => {
    const judgeScoreRows = (result.judgeScores || []).map((j) => ({ name: j.judgeLabel, value: Number(j.percentage.toFixed(2)) }));
    return (
      <div className="space-y-4 bg-gray-50/60 p-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Judge Scores</p>
          {judgeScoreRows.length === 0 ? <p className="text-sm text-gray-400">No judge score breakdown available.</p> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={judgeScoreRows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} formatter={(v: number) => [`${v.toFixed(2)}%`, 'Score']} />
                <Bar dataKey="value" fill="#166534" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Criteria Breakdown</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm">
              <thead><tr className="bg-[#1E3A8A]">
                {['Criteria', 'Score', 'Max Score', 'Weight', 'Computed'].map((h, i) => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider ${i >= 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {result.criteriaBreakdown.map((c) => (
                  <tr key={c.criteriaId} className="hover:bg-gray-50/70">
                    <td className="px-4 py-2.5 text-gray-800 font-medium">{c.criteriaName}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{c.averageScore.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{(c.maxScore ?? 10).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{c.weight.toFixed(2)}%</td>
                    <td className="px-4 py-2.5 text-right font-extrabold text-gray-900">{(c.computed ?? c.weightedContribution).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRankingTable = (title: string, list: PageantResult[], mode: 'AVERAGE' | 'WEIGHTED_MEAN' | 'RANKING') => {
    if (list.length === 0) return <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-400">No contestants in this section.</div>;
    const sortedList = sortResultsByMode(list, mode);
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50">
          <p className="text-sm font-extrabold text-gray-900">{title}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead><tr className="bg-[#1E3A8A]">
              {['Rank', 'Contestant', 'Final Score', 'Additional Info', 'Details'].map((h, i) => (
                <th key={h} className={`px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider ${i >= 2 ? 'text-right' : 'text-left'} ${i === 4 ? 'text-center' : ''}`}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sortedList.map((result) => {
                const expanded = expandedRows.has(result.contestantId);
                const score = rowScoreDisplay(result, mode);
                const rowBg = result.rank === 1 ? 'bg-yellow-50/70' : result.rank === 2 ? 'bg-gray-50/70' : result.rank === 3 ? 'bg-orange-50/70' : 'bg-white';
                return (
                  <Fragment key={result.contestantId}>
                    <tr className={`border-t border-gray-50 cursor-pointer hover:bg-blue-50/40 transition-colors ${rowBg}`} onClick={() => toggleRow(result.contestantId)}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-gray-900">#{result.rank}</span>
                          {rankBadge(result.rank)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-xs font-extrabold shrink-0">
                            {result.photoPath || result.photoUrl ? <img src={result.photoPath || result.photoUrl} alt={result.contestantName} className="w-full h-full object-cover" /> : result.contestantName.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{result.contestantName}</p>
                            <p className="text-xs text-gray-400">Contestant #{result.contestantNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-extrabold text-gray-900">{score.finalScore}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{score.additional}</td>
                      <td className="px-4 py-2.5 text-center text-gray-400">
                        {expanded ? <ChevronUp className="mx-auto h-4 w-4" /> : <ChevronDown className="mx-auto h-4 w-4" />}
                      </td>
                    </tr>
                    {expanded && <tr className="border-t border-gray-50"><td colSpan={5}>{renderDetails(result)}</td></tr>}
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
    <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Pageant',       value: pageant?.name || sectionLabel },
          { label: 'Scoring Method', value: formatScoringMethod(scoringMethod || 'weighted') },
          { label: 'Contestants',   value: String(totalContestants) },
          { label: 'Status',        value: pageant?.status ? formatPageantStatus(pageant.status) : 'Completed' },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );

  if (Array.isArray(results)) {
    if (results.length === 0) return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><BarChart3 className="w-7 h-7 text-gray-300" /></div>
        <p className="text-sm text-gray-400">No results available yet.</p>
      </div>
    );

    const mode = resolvedScoringMode(results[0]);
    const baseMode = mode === 'RANKING' ? 'RANKING' : mode === 'AVERAGE' ? 'AVERAGE' : 'WEIGHTED_MEAN';
    const sortedOverall = sortResultsByMode(results, baseMode);
    const winner = sortedOverall[0];
    const firstRunnerUp = sortedOverall[1] || null;
    const secondRunnerUp = sortedOverall[2] || null;

    return (
      <div className="space-y-5 pt-1">
        {renderHeader(results.length, 'Overall Results')}

        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
          <h4 className="flex items-center gap-2 text-base font-extrabold text-gray-900 mb-3">
            <Crown className="h-5 w-5 text-amber-500" /> Winner: {winner.contestantName}
          </h4>
          <p className="text-sm text-gray-600 mb-3">{rowScoreDisplay(winner, baseMode).finalScore}</p>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-gray-600">
              1st Runner-up: <span className="font-semibold text-gray-900">{firstRunnerUp?.contestantName || 'N/A'}</span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-white px-3 py-2 text-gray-600">
              2nd Runner-up: <span className="font-semibold text-gray-900">{secondRunnerUp?.contestantName || 'N/A'}</span>
            </div>
          </div>
        </div>

        {renderRankingTable('Ranking Table', results, baseMode)}
        {renderComparisonChart('Comparison Chart', results, baseMode)}
      </div>
    );
  }

  const totalContestants = results.maleResults.length + results.femaleResults.length;
  if (totalContestants === 0) return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4"><BarChart3 className="w-7 h-7 text-gray-300" /></div>
      <p className="text-sm text-gray-400">No results available yet.</p>
    </div>
  );

  return (
    <div className="space-y-5 pt-1">
      {renderHeader(totalContestants, 'Division Results')}

      {results.warnings && results.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{results.warnings.join(' ')}</div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { label: 'Male Winner',   winner: results.maleWinner },
          { label: 'Female Winner', winner: results.femaleWinner },
        ].map(({ label, winner: w }) => (
          <div key={label} className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
            <h4 className="flex items-center gap-2 text-base font-extrabold text-gray-900 mb-1">
              <Crown className="h-4 w-4 text-amber-500" /> {label}
            </h4>
            <p className="text-sm text-gray-600">{w?.contestantName || 'N/A'}</p>
            {w && <p className="text-sm font-extrabold text-gray-900">{rowScoreDisplay(w, 'RANKING').finalScore}</p>}
          </div>
        ))}
      </div>

      {renderRankingTable('Male Ranking Table', results.maleResults, 'RANKING')}
      {renderComparisonChart('Male Division Comparison', results.maleResults, 'RANKING')}
      {renderRankingTable('Female Ranking Table', results.femaleResults, 'RANKING')}
      {renderComparisonChart('Female Division Comparison', results.femaleResults, 'RANKING')}
    </div>
  );
}