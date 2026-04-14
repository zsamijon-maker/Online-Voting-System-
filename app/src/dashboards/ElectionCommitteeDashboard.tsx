import { Fragment, useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Users, Plus, Edit, Trash2, Play, StopCircle, UserCheck,
  MoreHorizontal, Calendar, BarChart3, TrendingUp, LogOut, Menu, X,
  Crown, ChevronDown, ChevronUp, Trophy, Medal, Vote,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getAllElections, createElection, updateElection, deleteElection,
  openElection, closeElection, getElectionResults,
  addCandidate, getCandidatesByElection, getElectionPositions,
} from '@/services/electionService';
import type {
  Election, Candidate, ElectionResult, ElectionFormData,
  CandidateFormData, ElectionPosition,
} from '@/types';
import { formatDate, formatElectionType, formatElectionStatus } from '@/utils/formatters';
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
import { Checkbox } from '@/components/ui/checkbox';

// ─── Shared design primitives ─────────────────────────────────────────────────
const NAV = [
  { value: 'overview',   label: 'Overview',          icon: TrendingUp },
  { value: 'elections',  label: 'Manage Elections',   icon: Calendar },
  { value: 'candidates', label: 'Candidates',         icon: Users },
  { value: 'results',    label: 'Results',            icon: BarChart3 },
];

const ActionBtn = ({
  type = 'button', onClick, disabled, children, color = 'blue', fullWidth = false, size = 'md',
}: {
  type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean;
  children: React.ReactNode; color?: 'blue' | 'green' | 'red' | 'outline';
  fullWidth?: boolean; size?: 'sm' | 'md';
}) => {
  const palette = {
    blue:    'bg-[#1E3A8A] hover:bg-[#1d3580] text-white shadow-sm shadow-blue-200',
    green:   'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200',
    red:     'bg-red-600 hover:bg-red-700 text-white',
    outline: 'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700',
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
              <th
                key={i}
                className={`px-5 py-3 text-xs font-bold text-white uppercase tracking-wider ${i === headers.length - 1 ? 'text-right' : 'text-left'}`}
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
                No data available.
              </td>
            </tr>
          ) : children}
        </tbody>
      </table>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active:   'bg-green-50 text-green-700 border border-green-200',
    closed:   'bg-gray-100 text-gray-600 border border-gray-200',
    archived: 'bg-gray-100 text-gray-500 border border-gray-200',
    upcoming: 'bg-blue-50 text-blue-700 border border-blue-200',
    draft:    'bg-amber-50 text-amber-700 border border-amber-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {formatElectionStatus(status)}
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

const SectionHeader = ({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) => (
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

// ─── Position constants (merged type) ────────────────────────────────────────
const SSG_FSTLP_OFFICERS_POSITIONS = [
  { name: 'SSG President', maxVote: 1 },
  { name: 'SSG Vice President', maxVote: 1 },
  { name: 'SSG Senators', maxVote: 12 },
  { name: 'FSTLP President', maxVote: 1 },
  { name: 'FSTLP Vice President', maxVote: 1 },
  { name: 'FSTLP Secretary', maxVote: 1 },
  { name: 'FSTLP Treasurer', maxVote: 1 },
  { name: 'FSTLP Auditor', maxVote: 1 },
  { name: 'FSTLP PIO', maxVote: 2 },
  { name: 'FSTLP Board Members', maxVote: 6 },
];

const getResultGroup = (position: string) => {
  if (position.startsWith('SSG ')) return 'SSG Results';
  if (position.startsWith('FSTLP ')) return 'FSTLP Results';
  return 'Other Results';
};

// ─── Date helpers (unchanged) ─────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ElectionCommitteeDashboard() {
  // ── All logic unchanged ───────────────────────────────────────────────────
  const { user, logout }     = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab]               = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [elections, setElections]               = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen]   = useState(false);
  const [isEditModalOpen, setIsEditModalOpen]       = useState(false);
  const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen]     = useState(false);
  const [results, setResults]                   = useState<ElectionResult[]>([]);
  const [isMobileNavOpen, setIsMobileNavOpen]   = useState(false);

  const fetchElections = useCallback(async () => {
    const allElections = await getAllElections();
    setElections(allElections);
  }, []);

  useEffect(() => { Promise.resolve().then(() => { void fetchElections(); }); }, [fetchElections]);
  useEffect(() => { Promise.resolve().then(() => { void fetchElections(); }); }, [activeTab, fetchElections]);
  useEffect(() => {
    const handleFocus = () => { void fetchElections(); };
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
        const message = error instanceof Error ? error.message : 'Failed to create election';
        showError('Failed to create election: ' + message);
      }
    } else {
      showError('You must be signed in to create an election.');
    }
  };

  const handleUpdateElection = async (id: string, updates: Partial<Election>) => {
    const result = await updateElection(id, updates);
    if (result) {
      showSuccess('Election updated successfully');
      setIsEditModalOpen(false);
      setSelectedElection(null);
      void fetchElections();
    } else { showError('Failed to update election'); }
  };

  const handleDeleteElection = async (id: string) => {
    if (confirm('Are you sure you want to delete this election?')) {
      const success = await deleteElection(id);
      if (success) { showSuccess('Election deleted successfully'); void fetchElections(); }
      else { showError('Failed to delete election'); }
    }
  };

  const handleOpenElection = async (id: string) => {
    const result = await openElection(id);
    if (result) { showSuccess('Election is now open for voting'); void fetchElections(); }
  };

  const handleCloseElection = async (id: string) => {
    const result = await closeElection(id);
    if (result) { showSuccess('Election has been closed'); void fetchElections(); }
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
      const message = error instanceof Error ? error.message : 'Failed to add candidate';
      showError('Failed to add candidate: ' + message);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
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
              <Vote className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">Election Panel</span>
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
                <Vote className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 leading-none">SchoolVote</p>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">Election Panel</p>
              </div>
            </div>
          </div>

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
                  {NAV.find(n => n.value === activeTab)?.label ?? 'Election Committee'}
                </h1>
                <p className="text-sm text-blue-200/80 mt-0.5">Welcome back, {user?.firstName} {user?.lastName}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 text-xs font-semibold text-white w-fit">
                <UserCheck className="w-3 h-3" /> Election Committee
              </span>
            </div>
          </header>

          <div className="flex-1 px-5 py-6 sm:px-8 sm:py-8">
            <TabsContent value="overview">
              <ElectionOverviewTab elections={elections} onNavigate={setActiveTab} />
            </TabsContent>
            <TabsContent value="elections">
              <ElectionsTab
                elections={elections}
                onCreate={() => setIsCreateModalOpen(true)}
                onEdit={(election) => { setSelectedElection(election); setIsEditModalOpen(true); }}
                onDelete={handleDeleteElection}
                onOpen={handleOpenElection}
                onClose={handleCloseElection}
                onViewResults={handleViewResults}
              />
            </TabsContent>
            <TabsContent value="candidates">
              <CandidatesTab
                elections={elections}
                onAddCandidate={(election) => { setSelectedElection(election); setIsCandidateModalOpen(true); }}
              />
            </TabsContent>
            <TabsContent value="results">
              <ResultsTab elections={elections} onViewResults={handleViewResults} />
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

      {/* ── CREATE ELECTION MODAL ─────────────────────────────────────────── */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Create New Election</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Set up a new election for students to vote.</DialogDescription>
          </DialogHeader>
          <ElectionForm onSubmit={handleCreateElection} onCancel={() => setIsCreateModalOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* ── EDIT ELECTION MODAL ───────────────────────────────────────────── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Edit Election</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Update election details.</DialogDescription>
          </DialogHeader>
          {selectedElection && (
            <ElectionForm
              election={selectedElection}
              onSubmit={(data) => handleUpdateElection(selectedElection.id, data)}
              onCancel={() => { setIsEditModalOpen(false); setSelectedElection(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── ADD CANDIDATE MODAL ───────────────────────────────────────────── */}
      <Dialog open={isCandidateModalOpen} onOpenChange={setIsCandidateModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Add Candidate</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Add a new candidate to {selectedElection?.title}.</DialogDescription>
          </DialogHeader>
          {selectedElection && (
            <CandidateForm
              electionId={selectedElection.id}
              onSubmit={(data) => handleAddCandidate(selectedElection.id, data)}
              onCancel={() => { setIsCandidateModalOpen(false); setSelectedElection(null); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── RESULTS MODAL ─────────────────────────────────────────────────── */}
      <Dialog open={isResultsModalOpen} onOpenChange={setIsResultsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold">Election Results</DialogTitle>
            <DialogDescription className="text-sm text-gray-500">Results for {selectedElection?.title}</DialogDescription>
          </DialogHeader>
          <ResultsDisplay results={results} election={selectedElection} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ElectionOverviewTab({
  elections, onNavigate,
}: { elections: Election[]; onNavigate: (tab: string) => void }) {

  const total    = elections.length;
  const active   = elections.filter(e => e.status === 'active').length;
  const upcoming = elections.filter(e => e.status === 'upcoming' || e.status === 'draft').length;
  const closed   = elections.filter(e => e.status === 'closed' || e.status === 'archived').length;

  const statusData = [
    { status: 'Active', count: active },
    { status: 'Upcoming', count: upcoming },
    { status: 'Closed', count: closed },
  ].filter(d => d.count > 0);

  const recentElections = [...elections]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const statCards = [
    { label: 'Total Elections',    value: total,    accent: 'bg-blue-50 text-blue-600',   icon: Calendar },
    { label: 'Active',             value: active,   accent: 'bg-green-50 text-green-600', icon: Vote },
    { label: 'Upcoming / Draft',   value: upcoming, accent: 'bg-amber-50 text-amber-600', icon: TrendingUp },
    { label: 'Closed / Archived',  value: closed,   accent: 'bg-gray-50 text-gray-500',   icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <SectionCard>
          <CardHeading eyebrow="Distribution" title="Elections by Status" />
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <XAxis dataKey="status" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
                <Bar dataKey="count" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 py-8 text-center">No elections yet.</p>
          )}
        </SectionCard>

        {/* Recent elections */}
        <SectionCard>
          <CardHeading eyebrow="Latest" title="Recent Elections" />
          {recentElections.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {recentElections.map((election) => (
                <li key={election.id} className="py-2.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 truncate min-w-0">{election.title}</span>
                  <StatusBadge status={election.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No elections found.</p>
          )}
        </SectionCard>
      </div>

      {/* Quick actions */}
      <SectionCard>
        <CardHeading eyebrow="Shortcuts" title="Quick Actions" />
        <div className="flex flex-wrap gap-3">
          <ActionBtn onClick={() => onNavigate('elections')} color="blue">
            <Calendar className="w-4 h-4" /> Manage Elections
          </ActionBtn>
          <ActionBtn onClick={() => onNavigate('candidates')} color="outline">
            <Users className="w-4 h-4" /> Manage Candidates
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
// ELECTIONS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ElectionsTab({
  elections, onCreate, onEdit, onDelete, onOpen, onClose, onViewResults,
}: {
  elections: Election[]; onCreate: () => void; onEdit: (election: Election) => void;
  onDelete: (id: string) => void; onOpen: (id: string) => void; onClose: (id: string) => void;
  onViewResults: (election: Election) => void;
}) {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="All Elections"
        subtitle={`${elections.length} total election${elections.length !== 1 ? 's' : ''}`}
        action={
          <ActionBtn color="green" onClick={onCreate}>
            <Plus className="w-4 h-4" /> Create Election
          </ActionBtn>
        }
      />

      <DataTable headers={['Election', 'Status', 'Dates', 'Actions']} empty={elections.length === 0}>
        {elections.map((election) => (
          <tr key={election.id} className="hover:bg-gray-50/70 transition-colors">
            <td className="px-5 py-3.5">
              <p className="text-sm font-semibold text-gray-900">{election.title}</p>
              <p className="text-xs text-gray-400 capitalize mt-0.5">{formatElectionType(election.type)}</p>
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <StatusBadge status={election.status} />
            </td>
            <td className="px-5 py-3.5 whitespace-nowrap">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(election.startDate)} — {formatDate(election.endDate)}
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
                  <DropdownMenuItem onClick={() => onEdit(election)}>
                    <Edit className="w-4 h-4 mr-2" /> Edit
                  </DropdownMenuItem>
                  {election.status === 'upcoming' && (
                    <DropdownMenuItem onClick={() => onOpen(election.id)}>
                      <Play className="w-4 h-4 mr-2" /> Open Voting
                    </DropdownMenuItem>
                  )}
                  {election.status === 'active' && (
                    <DropdownMenuItem onClick={() => onClose(election.id)}>
                      <StopCircle className="w-4 h-4 mr-2" /> Close Voting
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => onViewResults(election)}>
                    <BarChart3 className="w-4 h-4 mr-2" /> View Results
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDelete(election.id)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </DropdownMenuItem>
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
// CANDIDATES TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function CandidatesTab({
  elections, onAddCandidate,
}: { elections: Election[]; onAddCandidate: (election: Election) => void }) {

  const [selectedElectionId, setSelectedElectionId] = useState<string>('');
  const [candidates, setCandidates]                 = useState<Candidate[]>([]);
  const [isLoading, setIsLoading]                   = useState(false);

  useEffect(() => {
    if (selectedElectionId) {
      Promise.resolve().then(() => {
        setIsLoading(true);
        getCandidatesByElection(selectedElectionId)
          .then(setCandidates)
          .catch(() => setCandidates([]))
          .finally(() => setIsLoading(false));
      });
    } else {
      Promise.resolve().then(() => { setCandidates([]); });
    }
  }, [selectedElectionId]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Manage Candidates"
        action={
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Select value={selectedElectionId} onValueChange={setSelectedElectionId}>
              <SelectTrigger className="w-full sm:w-60 rounded-xl border-gray-200 text-sm">
                <SelectValue placeholder="Select an election" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {elections.map((election) => (
                  <SelectItem key={election.id} value={election.id}>{election.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedElectionId && (
              <ActionBtn color="green" onClick={() => {
                const election = elections.find(e => e.id === selectedElectionId);
                if (election) onAddCandidate(election);
              }}>
                <Plus className="w-4 h-4" /> Add Candidate
              </ActionBtn>
            )}
          </div>
        }
      />

      {selectedElectionId ? (
        <DataTable headers={['Candidate', 'Position', 'Status']} empty={!isLoading && candidates.length === 0}>
          {isLoading ? (
            <tr>
              <td colSpan={3} className="px-5 py-10 text-center">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                  <div className="w-4 h-4 border-2 border-[#1E3A8A] border-t-transparent rounded-full animate-spin" />
                  Loading candidates…
                </div>
              </td>
            </tr>
          ) : candidates.map((candidate) => (
            <tr key={candidate.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="px-5 py-3.5 whitespace-nowrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[#1E3A8A] overflow-hidden flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(candidate.photoPath || candidate.photoUrl) ? (
                      <img
                        src={candidate.photoPath || candidate.photoUrl}
                        alt={candidate.displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : candidate.displayName.charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{candidate.displayName}</p>
                </div>
              </td>
              <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-500">{candidate.position}</td>
              <td className="px-5 py-3.5 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${candidate.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                  {candidate.isActive ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">Select an Election</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">Choose an election above to view and manage its candidates.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS TAB (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ResultsTab({
  elections, onViewResults,
}: { elections: Election[]; onViewResults: (election: Election) => void }) {

  const closedElections = elections.filter(e => e.status === 'closed' || e.status === 'archived');

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Analytics</p>
        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">Election Results</h2>
      </div>

      {closedElections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-gray-100">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
            <BarChart3 className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-base font-extrabold text-gray-700 tracking-tight">No Completed Elections</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-xs">There are no closed elections with results available.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {closedElections.map((election) => (
            <div
              key={election.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-[#1E3A8A]" />
              </div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight mb-1">{election.title}</h3>
              <p className="text-xs text-gray-400 mb-4">
                {formatElectionType(election.type)} · Closed {formatDate(election.endDate)}
              </p>
              <div className="flex items-center justify-between mb-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${election.resultsPublic ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {election.resultsPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <ActionBtn color="green" fullWidth onClick={() => onViewResults(election)}>
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
// ELECTION FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ElectionForm({
  election, onSubmit, onCancel,
}: { election?: Election; onSubmit: (data: ElectionFormData) => void; onCancel: () => void }) {

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ElectionFormData>({
    title: election?.title || '',
    description: election?.description || '',
    type: election?.type || 'ssg_fstlp_officers',
    startDate: toLocalDateTimeInputValue(election?.startDate),
    endDate: toLocalDateTimeInputValue(election?.endDate),
    allowWriteIns: election?.allowWriteIns || false,
    maxVotesPerVoter: election?.maxVotesPerVoter || 1,
    resultsPublic: election?.resultsPublic || false,
  });

  const usesPredefinedPositions = formData.type === 'ssg_fstlp_officers';
  const predefinedPositionCards = usesPredefinedPositions ? SSG_FSTLP_OFFICERS_POSITIONS : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSubmitting) {
      setIsSubmitting(true);
      onSubmit({ ...formData, startDate: toIsoFromDateTimeLocal(formData.startDate), endDate: toIsoFromDateTimeLocal(formData.endDate) });
      setTimeout(() => setIsSubmitting(false), 1000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <FormField label="Election Title">
        <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required className={fic} />
      </FormField>
      <FormField label="Description">
        <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} className={fic} />
      </FormField>
      <FormField label="Election Type">
        <Select
          value={formData.type}
          onValueChange={(value) => {
            const nextType = value as ElectionFormData['type'];
            setFormData((prev) => ({
              ...prev, type: nextType,
              maxVotesPerVoter: nextType === 'ssg_fstlp_officers' ? 1 : prev.maxVotesPerVoter,
            }));
          }}
        >
          <SelectTrigger className={fic}><SelectValue /></SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="ssg_fstlp_officers">SSG &amp; FSTLP Officers</SelectItem>
            <SelectItem value="class_representative">Class Representative</SelectItem>
            <SelectItem value="club_officers">Club Officers</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {usesPredefinedPositions && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-sm font-extrabold text-blue-900 mb-1">SSG &amp; FSTLP Officers Positions</p>
          <p className="text-xs text-blue-600 mb-3">Positions and vote limits are generated automatically.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {predefinedPositionCards.map((position) => (
              <div key={position.name} className="rounded-xl border border-blue-200 bg-white p-3">
                <p className="text-sm font-semibold text-blue-900">{position.name}</p>
                <p className="text-xs text-blue-500 mt-0.5">Max votes: {position.maxVote}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Start Date">
          <Input id="startDate" type="datetime-local" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} required className={fic} />
        </FormField>
        <FormField label="End Date">
          <Input id="endDate" type="datetime-local" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} required className={fic} />
        </FormField>
      </div>

      <div className="flex items-center gap-2.5">
        <Checkbox
          id="allowWriteIns"
          checked={formData.allowWriteIns}
          onCheckedChange={(checked) => setFormData({ ...formData, allowWriteIns: checked as boolean })}
          className="rounded-lg"
        />
        <Label htmlFor="allowWriteIns" className="text-sm font-medium text-gray-700 cursor-pointer">Allow write-in candidates</Label>
      </div>

      {!usesPredefinedPositions && (
        <FormField label="Max Votes Per Voter">
          <Input id="maxVotesPerVoter" type="number" min={1} max={10} value={formData.maxVotesPerVoter} onChange={(e) => setFormData({ ...formData, maxVotesPerVoter: parseInt(e.target.value) })} className={fic} />
        </FormField>
      )}

      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button type="submit" className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : election ? 'Save Changes' : 'Create Election'}
        </Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CANDIDATE FORM (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function CandidateForm({
  electionId, onSubmit, onCancel,
}: { electionId: string; onSubmit: (data: CandidateFormData) => void; onCancel: () => void }) {

  const [positions, setPositions]             = useState<ElectionPosition[]>([]);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);
  const [formData, setFormData] = useState<CandidateFormData>({
    positionId: '', position: '', displayName: '', bio: '', platform: '',
    photoUrl: '', photoPath: '', imageFile: undefined, isWriteIn: false,
  });
  const [imageError, setImageError]           = useState(false);
  const [previewUrl, setPreviewUrl]           = useState<string>('');
  const [fileName, setFileName]               = useState<string>('');
  const [fileValidationError, setFileValidationError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    Promise.resolve().then(() => {
      setIsLoadingPositions(true);
      getElectionPositions(electionId)
        .then((pos) => {
          if (!mounted) return;
          setPositions(pos);
          if (pos.length > 0) {
            setFormData((prev) => ({ ...prev, positionId: pos[0].id, position: pos[0].name }));
          }
        })
        .catch(() => { if (!mounted) return; setPositions([]); })
        .finally(() => { if (!mounted) return; setIsLoadingPositions(false); });
    });
    return () => { mounted = false; };
  }, [electionId]);

  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.positionId || isLoadingPositions || positions.length === 0) return;
    onSubmit(formData);
  };

  const handleFileChange = (file?: File) => {
    if (!file) {
      setFormData({ ...formData, imageFile: undefined });
      setPreviewUrl(''); setFileName(''); setFileValidationError('');
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setFileValidationError('Only JPEG and PNG images are allowed.');
      setFormData({ ...formData, imageFile: undefined });
      setPreviewUrl(''); setFileName(''); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setFileValidationError('Image must be 2MB or smaller.');
      setFormData({ ...formData, imageFile: undefined });
      setPreviewUrl(''); setFileName(''); return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextPreview = URL.createObjectURL(file);
    setFormData({ ...formData, imageFile: file });
    setPreviewUrl(nextPreview); setFileName(file.name);
    setFileValidationError(''); setImageError(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <FormField label="Position">
        {isLoadingPositions ? (
          <p className="text-sm text-gray-500">Loading positions…</p>
        ) : positions.length === 0 ? (
          <p className="text-sm text-amber-600">Election has no positions configured.</p>
        ) : (
          <Select
            value={formData.positionId}
            onValueChange={(value) => {
              const selected = positions.find((p) => p.id === value);
              setFormData({ ...formData, positionId: value, position: selected?.name ?? '' });
            }}
          >
            <SelectTrigger className={fic}><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              {positions.map((position) => (
                <SelectItem key={position.id} value={position.id}>
                  {position.name} (Max votes: {position.voteLimit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <FormField label="Candidate Name">
        <Input id="displayName" value={formData.displayName} onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} required className={fic} />
      </FormField>

      <FormField label="Candidate Image" hint="JPG or PNG, max 2MB">
        <Input
          id="candidateImage" type="file" accept="image/*"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
          className={fic}
        />
        {fileName && <p className="text-xs text-gray-600 mt-1">Selected: {fileName}</p>}
        {fileValidationError && <p className="text-xs text-red-600 mt-1">{fileValidationError}</p>}

        {(previewUrl || formData.photoPath || formData.photoUrl) && (
          <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preview</p>
            {imageError ? (
              <div className="w-16 h-16 rounded-2xl border border-red-200 bg-red-50 flex items-center justify-center">
                <span className="text-[10px] text-red-500 text-center px-1">Unavailable</span>
              </div>
            ) : (
              <img
                src={previewUrl || formData.photoPath || formData.photoUrl}
                alt="Candidate preview"
                className="w-16 h-16 object-cover rounded-2xl border border-gray-200"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        )}
      </FormField>

      <FormField label="Biography">
        <Textarea id="bio" value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} rows={3} className={fic} />
      </FormField>

      <FormField label="Campaign Platform">
        <Textarea id="platform" value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} rows={4} placeholder="List campaign promises and ideas…" className={fic} />
      </FormField>

      <DialogFooter className="gap-2 mt-2">
        <Button type="button" variant="outline" className="rounded-xl flex-1 sm:flex-none" onClick={onCancel}>Cancel</Button>
        <Button
          type="submit"
          className="rounded-xl flex-1 sm:flex-none bg-[#166534] hover:bg-[#14532d] text-white"
          disabled={isLoadingPositions || positions.length === 0 || !formData.positionId}
        >
          Add Candidate
        </Button>
      </DialogFooter>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESULTS DISPLAY (logic unchanged)
// ═══════════════════════════════════════════════════════════════════════════════
function ResultsDisplay({
  results, election,
}: { results: ElectionResult[]; election: Election | null }) {

  const [expandedPositions, setExpandedPositions]   = useState<Set<string>>(new Set());
  const [expandedCandidates, setExpandedCandidates] = useState<Set<string>>(new Set());

  // ── All normalisation logic unchanged ────────────────────────────────────
  const normalizePositionResults = (rows: ElectionResult[]) =>
    rows.map((row) => {
      const sortedCandidates = [...row.candidates].sort((a, b) => {
        if (b.voteCount !== a.voteCount) return b.voteCount - a.voteCount;
        if (b.percentage !== a.percentage) return b.percentage - a.percentage;
        return a.displayName.localeCompare(b.displayName);
      });
      let currentRank = 0; let previousVoteCount = -1;
      const ranked = sortedCandidates.map((candidate, index) => {
        if (candidate.voteCount !== previousVoteCount) { currentRank = index + 1; previousVoteCount = candidate.voteCount; }
        return { ...candidate, rank: currentRank };
      });
      return { ...row, candidates: ranked };
    });

  const normalizedResults           = normalizePositionResults(results);
  const totalVotesOverall           = normalizedResults.reduce((sum, row) => sum + row.totalVotes, 0);
  const totalCandidatesOverall      = normalizedResults.reduce((sum, row) => sum + row.candidates.length, 0);
  const highestTurnoutPosition      = normalizedResults.length > 0
    ? [...normalizedResults].sort((a, b) => b.totalVotes - a.totalVotes)[0] : null;

  const togglePosition  = (position: string) => setExpandedPositions((prev) => {
    const n = new Set(prev);
    if (n.has(position)) {
      n.delete(position);
    } else {
      n.add(position);
    }
    return n;
  });
  const toggleCandidate = (position: string, candidateId: string) => {
    const key = `${position}::${candidateId}`;
    setExpandedCandidates((prev) => {
      const n = new Set(prev);
      if (n.has(key)) {
        n.delete(key);
      } else {
        n.add(key);
      }
      return n;
    });
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-xs font-semibold text-yellow-700"><Trophy className="h-3 w-3" /> Gold</span>;
    if (rank === 2) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600"><Medal className="h-3 w-3" /> Silver</span>;
    if (rank === 3) return <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-700"><Medal className="h-3 w-3" /> Bronze</span>;
    return null;
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-4">
          <BarChart3 className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm text-gray-400">No results available yet.</p>
      </div>
    );
  }

  const groupedResults = normalizedResults.reduce<Record<string, typeof normalizedResults>>((acc, row) => {
    const key = getResultGroup(row.position);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const groupOrder = ['SSG Results', 'FSTLP Results', 'Other Results'];
  const orderedGroups = groupOrder
    .map((group) => ({ group, rows: groupedResults[group] ?? [] }))
    .filter((entry) => entry.rows.length > 0);

  return (
    <div className="space-y-5 pt-1">
      {/* Election info banner */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: 'Election',   value: election?.title || 'Election Results' },
            { label: 'Type',       value: election ? formatElectionType(election.type) : 'N/A' },
            { label: 'Status',     value: election ? formatElectionStatus(election.status) : 'Closed' },
            { label: 'End Date',   value: election ? formatDate(election.endDate) : 'N/A' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Total Positions',  value: normalizedResults.length.toString() },
          { label: 'Total Candidates', value: totalCandidatesOverall.toString() },
          { label: 'Total Votes Cast', value: totalVotesOverall.toString() },
          { label: 'Highest Turnout',  value: highestTurnoutPosition?.position || 'N/A', sub: highestTurnoutPosition ? `${highestTurnoutPosition.totalVotes} votes` : '' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`font-extrabold text-gray-900 ${sub ? 'text-base' : 'text-2xl'} tracking-tight`}>{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Winners banner */}
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-5">
        <h4 className="text-base font-extrabold text-gray-900 flex items-center gap-2 mb-4">
          <Crown className="w-5 h-5 text-amber-500" /> Position Winners
        </h4>
        <div className="space-y-4">
          {orderedGroups.map(({ group, rows }) => (
            <div key={group}>
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">{group}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((row) => {
                  const winner = row.candidates[0];
                  const tiedWinners = row.candidates.filter((c) => c.voteCount === winner.voteCount);
                  return (
                    <div key={row.position} className="rounded-xl border border-amber-200 bg-white p-3.5">
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">{row.position}</p>
                      <p className="text-sm font-extrabold text-gray-900">{winner.displayName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{winner.voteCount} votes · {winner.percentage.toFixed(1)}%</p>
                      {tiedWinners.length > 1 && (
                        <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          Tie ({tiedWinners.length})
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Position comparison chart */}
      <SectionCard>
        <CardHeading eyebrow="Chart" title="Position Comparison (Total Votes)" />
        <div className="space-y-5">
          {orderedGroups.map(({ group, rows }) => {
            const positionTotalsChart = rows.map((row) => ({ position: row.position, votes: row.totalVotes }));
            return (
              <div key={group} className="rounded-xl border border-gray-100 p-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{group}</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={positionTotalsChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <XAxis dataKey="position" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                      formatter={(value: number) => [`${value} votes`, 'Total Votes']}
                    />
                    <Bar dataKey="votes" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Per-position expandable sections */}
      {orderedGroups.map(({ group, rows }) => (
        <div key={group} className="space-y-3">
          <h4 className="text-sm font-extrabold text-gray-700 uppercase tracking-wider">{group}</h4>
          {rows.map((result) => {
            const isExpanded = expandedPositions.has(result.position);
            const candidateChartData = result.candidates.map((candidate) => ({
              name: candidate.displayName, votes: candidate.voteCount, percentage: candidate.percentage,
            }));

            return (
              <div key={result.position} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50/70 text-left transition-colors"
                  onClick={() => togglePosition(result.position)}
                >
                  <div>
                    <h4 className="text-base font-extrabold text-gray-900 tracking-tight">{result.position}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Total Votes: {result.totalVotes}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                    {/* Candidate bar chart */}
                    <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Candidate Comparison</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={candidateChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
                            formatter={(value: number, _n, item) => [`${value} votes (${item.payload.percentage.toFixed(1)}%)`, 'Result']}
                          />
                          <Bar dataKey="votes" fill="#166534" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Candidate table */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-100">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead>
                          <tr className="bg-[#1E3A8A]">
                            {['Rank', 'Candidate', 'Votes', 'Percentage', 'Details'].map((h, i) => (
                              <th
                                key={h}
                                className={`px-4 py-2.5 text-xs font-bold text-white uppercase tracking-wider ${i >= 2 ? 'text-right' : 'text-left'} ${i === 4 ? 'text-center' : ''}`}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.candidates.map((candidate) => {
                            const rowKey = `${result.position}::${candidate.candidateId}`;
                            const rowExpanded = expandedCandidates.has(rowKey);
                            const rowBg =
                              candidate.rank === 1 ? 'bg-yellow-50/70'
                              : candidate.rank === 2 ? 'bg-gray-50/70'
                              : candidate.rank === 3 ? 'bg-orange-50/70'
                              : 'bg-white';

                            return (
                              <Fragment key={rowKey}>
                                <tr
                                  className={`border-t border-gray-50 cursor-pointer hover:bg-blue-50/40 transition-colors ${rowBg}`}
                                  onClick={() => toggleCandidate(result.position, candidate.candidateId)}
                                >
                                  <td className="px-4 py-2.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-extrabold text-gray-900">#{candidate.rank}</span>
                                      {rankBadge(candidate.rank)}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2.5 font-semibold text-gray-900">{candidate.displayName}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700">{candidate.voteCount}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-700">{candidate.percentage.toFixed(1)}%</td>
                                  <td className="px-4 py-2.5 text-center text-gray-400">
                                    {rowExpanded ? <ChevronUp className="mx-auto h-4 w-4" /> : <ChevronDown className="mx-auto h-4 w-4" />}
                                  </td>
                                </tr>
                                {rowExpanded && (
                                  <tr className="border-t border-gray-50">
                                    <td colSpan={5} className="bg-gray-50/60 px-4 py-4">
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                        {[
                                          { label: 'Votes',                value: String(candidate.voteCount) },
                                          { label: 'Percentage',           value: `${candidate.percentage.toFixed(1)}%` },
                                          { label: 'Share of Position',    value: `${candidate.voteCount}/${result.totalVotes}` },
                                        ].map(({ label, value }) => (
                                          <div key={label} className="rounded-xl border border-gray-100 bg-white p-3">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                                            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{value}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}