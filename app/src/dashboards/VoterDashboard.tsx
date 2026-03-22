import { useState, useEffect, useCallback } from 'react';
import {
  Vote,
  CheckCircle,
  Clock,
  Calendar,
  User as UserIcon,
  AlertCircle,
  Info,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getActiveElections,
  getCandidatesByPosition,
  getElectionPositions,
  castVote,
  getUserVotes,
} from '@/services/electionService';
import type { Election, Candidate, ElectionPosition, Vote as VoteType, User } from '@/types';
import { formatDate, formatDateTime, formatElectionType } from '@/utils/formatters';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface VotingState {
  electionId: string;
  position: string;
  selectedCandidate: string | null;
}

export default function VoterDashboard() {
  const { user, logout } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [elections, setElections] = useState<Election[]>([]);
  const [userVotes, setUserVotes] = useState<VoteType[]>([]);
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [votingState, setVotingState] = useState<VotingState | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const activeElections = await getActiveElections();
    setElections(activeElections);

    if (user) {
      const allVotes: VoteType[] = [];
      await Promise.all(
        activeElections.map(async (election) => {
          const votes = await getUserVotes(election.id, user.id);
          allVotes.push(...votes);
        })
      );
      setUserVotes(allVotes);
    }
  }, [user]);

  // Fetch data on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const handleSelectElection = (election: Election) => {
    setSelectedElection(election);
  };

  const handleSelectCandidate = (position: string, candidateId: string) => {
    if (selectedElection) {
      setVotingState({
        electionId: selectedElection.id,
        position,
        selectedCandidate: candidateId,
      });
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmVote = async () => {
    if (votingState && user) {
      const result = await castVote(
        votingState.electionId,
        user.id,
        votingState.selectedCandidate!,
        votingState.position
      );

      if (result.success) {
        showSuccess('Your vote has been recorded successfully!');
        setIsConfirmModalOpen(false);
        setVotingState(null);
        void fetchData();
      } else {
        showError(result.error || 'Failed to cast vote');
      }
    }
  };

  const getVotedCandidate = (electionId: string, position: string): string | null => {
    const vote = userVotes.find(v => v.electionId === electionId && v.position === position);
    return vote?.candidateId || null;
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
          <p className="text-sm font-semibold text-[#1E3A8A]">Student Panel</p>
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
            <h2 className="text-lg font-bold text-[#1E3A8A]">Student Panel</h2>
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
                value="elections"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Vote className="w-4 h-4" />
                Active Elections
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <Clock className="w-4 h-4" />
                My Voting History
              </TabsTrigger>
              <TabsTrigger
                value="profile"
                className="w-full min-w-0 justify-start gap-2 overflow-hidden whitespace-nowrap [&>svg]:shrink-0 rounded-md border border-transparent px-3 py-2 text-left text-gray-700 data-[state=active]:bg-[#1E3A8A] data-[state=active]:text-white data-[state=active]:border-[#1E3A8A]"
              >
                <UserIcon className="w-4 h-4" />
                My Profile
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
                  <h1 className="text-xl font-bold text-white sm:text-2xl">Student Voting Portal</h1>
                  <p className="text-sm text-blue-200 mt-1">
                    Welcome, {user?.firstName} {user?.lastName}
                  </p>
                </div>
                <Badge className="w-fit bg-white/20 text-white border border-white/30">
                  <UserIcon className="w-3 h-3 mr-1" />
                  Student Voter
                </Badge>
              </div>
            </div>
          </header>

          <div className="px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
            <TabsContent value="overview">
              <VoterOverviewTab elections={elections} userVotes={userVotes} onNavigate={setActiveTab} />
            </TabsContent>

            <TabsContent value="elections">
              {selectedElection ? (
                <VotingInterface
                  election={selectedElection}
                  onBack={() => setSelectedElection(null)}
                  onSelectCandidate={handleSelectCandidate}
                  getVotedCandidate={getVotedCandidate}
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

            <TabsContent value="profile">
              <VoterProfile user={user!} />
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

      {/* Confirmation Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Your Vote</DialogTitle>
            <DialogDescription>
              Please review your selection. Once submitted, your vote cannot be changed.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Important Notice
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Voting is final. You cannot change your vote after submission.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="touch-footer">
            <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => setIsConfirmModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="touch-target w-full rounded-md bg-[#2E7D32] font-medium hover:bg-[#1B5E20] sm:w-auto"
              onClick={handleConfirmVote}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirm Vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// VOTER OVERVIEW TAB
// ============================================
function VoterOverviewTab({
  elections,
  userVotes,
  onNavigate,
}: {
  elections: Election[];
  userVotes: VoteType[];
  onNavigate: (tab: string) => void;
}) {
  const totalOpen = elections.length;
  const votedElectionIds = new Set(userVotes.map(v => v.electionId));
  const votedCount = elections.filter(e => votedElectionIds.has(e.id)).length;
  const pendingCount = totalOpen - votedCount;

  const statCards = [
    { label: 'Open Elections', value: totalOpen, colorClass: 'bg-blue-100 text-blue-600' },
    { label: 'Votes Submitted', value: votedCount, colorClass: 'bg-green-100 text-green-600' },
    { label: 'Still to Vote In', value: pendingCount, colorClass: pendingCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Alert if pending votes */}
      {pendingCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Your vote matters!</p>
            <p className="text-sm text-amber-700 mt-0.5">
              You have {pendingCount} open election{pendingCount > 1 ? 's' : ''} waiting for your vote.
            </p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* My Voting Status per election */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">My Voting Status</h3>
        {elections.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {elections.map((election) => {
              const hasVoted = votedElectionIds.has(election.id);
              return (
                <li key={election.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{election.title}</p>
                    <p className="text-xs text-gray-400">Ends {formatDate(election.endDate)}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    hasVoted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {hasVoted ? 'Voted' : 'Not voted yet'}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">No active elections at this time.</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#1E3A8A] mb-4">Quick Actions</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            className="touch-target w-full rounded-md bg-[#1E3A8A] font-medium hover:bg-[#162d6b] sm:w-auto"
            onClick={() => onNavigate('elections')}
          >
            <Vote className="w-4 h-4 mr-2" />
            Browse Elections
          </Button>
          <Button variant="outline" className="touch-target w-full sm:w-auto" onClick={() => onNavigate('history')}>
            <Clock className="w-4 h-4 mr-2" />
            My Voting History
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ELECTIONS LIST
// ============================================
function ElectionsList({
  elections,
  userVotes,
  onSelectElection,
}: {
  elections: Election[];
  userVotes: VoteType[];
  onSelectElection: (election: Election) => void;
}) {
  if (elections.length === 0) {
    return (
      <div className="text-center py-12">
        <Vote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Active Elections</h3>
        <p className="text-gray-500 mt-2">There are no active elections at this time.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {elections.map((election) => {
          const electionVotes = userVotes.filter(v => v.electionId === election.id);
          const hasVotedInElection = electionVotes.length > 0;

          return (
            <Card
              key={election.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onSelectElection(election)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{election.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {formatElectionType(election.type)}
                    </CardDescription>
                  </div>
                  <Badge
                    className={
                      hasVotedInElection
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }
                  >
                    {hasVotedInElection ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Voted
                      </>
                    ) : (
                      <>
                        <Clock className="w-3 h-3 mr-1" />
                        Open
                      </>
                    )}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                  {election.description}
                </p>
                <div className="flex items-center text-sm text-gray-500">
                  <Calendar className="w-4 h-4 mr-2" />
                  Ends {formatDate(election.endDate)}
                </div>
                {hasVotedInElection && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-sm text-green-600 font-medium">
                      You have voted in this election
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// VOTING INTERFACE
// ============================================
function VotingInterface({
  election,
  onBack,
  onSelectCandidate,
  getVotedCandidate,
}: {
  election: Election;
  onBack: () => void;
  onSelectCandidate: (position: string, candidateId: string) => void;
  getVotedCandidate: (electionId: string, position: string) => string | null;
}) {
  const [positions, setPositions] = useState<ElectionPosition[]>([]);
  const [candidatesByPosition, setCandidatesByPosition] = useState<Record<string, Candidate[]>>({});

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="outline" size="sm" onClick={onBack} className="mb-2">
            ← Back to Elections
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">{election.title}</h2>
          <p className="text-gray-500 mt-1">{election.description}</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-2">
            <Clock className="w-3 h-3 mr-1" />
            Ends {formatDateTime(election.endDate)}
          </Badge>
        </div>
      </div>

      {/* Positions */}
      <div className="space-y-8">
        {positions.map((position) => {
          const positionName = position.name;
          const candidates = candidatesByPosition[positionName] || [];
          const votedCandidateId = getVotedCandidate(election.id, positionName);
          const hasVotedForPosition = !!votedCandidateId;

          return (
            <div key={position.id} className="bg-white rounded-lg shadow border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1E3A8A]">{positionName}</h3>
                {hasVotedForPosition && (
                  <Badge className="bg-green-100 text-green-800">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Voted
                  </Badge>
                )}
              </div>

              {hasVotedForPosition ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">
                        You have voted for this position
                      </p>
                      <p className="text-sm text-green-600">
                        Thank you for participating in the election!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {candidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      onSelect={() => onSelectCandidate(positionName, candidate.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// CANDIDATE CARD
// ============================================
function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: Candidate;
  onSelect: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
      <div className="aspect-square bg-gray-100 relative">
        {(candidate.photoPath || candidate.photoUrl) && !imageError ? (
          <img
            src={candidate.photoPath || candidate.photoUrl}
            alt={candidate.displayName}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#1E3A8A]">
            <span className="text-4xl font-bold text-white">
              {candidate.displayName.charAt(0)}
            </span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h4 className="font-semibold text-gray-900">{candidate.displayName}</h4>
        {candidate.bio && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">{candidate.bio}</p>
        )}
        <div className="mt-3 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowDetails(!showDetails)}
          >
            <Info className="w-4 h-4 mr-2" />
            {showDetails ? 'Hide Details' : 'View Platform'}
          </Button>
          <Button
            className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] rounded-md font-medium"
            onClick={onSelect}
          >
            <Vote className="w-4 h-4 mr-2" />
            Vote
          </Button>
        </div>
        {showDetails && candidate.platform && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-sm text-gray-600 whitespace-pre-line">
              {candidate.platform}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// VOTING HISTORY
// ============================================
function VotingHistory({
  userVotes,
  elections,
}: {
  userVotes: VoteType[];
  elections: Election[];
}) {
  if (userVotes.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No Voting History</h3>
        <p className="text-gray-500 mt-2">You haven't cast any votes yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[#1E3A8A]">Your Voting History</h3>
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-[#1E3A8A]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Election
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Voted At
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {userVotes.map((vote) => {
              const election = elections.find(e => e.id === vote.electionId);
              return (
                <tr key={vote.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {election?.title || 'Unknown Election'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {vote.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDateTime(vote.votedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Recorded
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================
// VOTER PROFILE
// ============================================
function VoterProfile({ user }: { user: User }) {
  const { profile, isLoading } = useSupabaseProfile();

  const displayName = profile?.name || `${user.firstName} ${user.lastName}`.trim() || 'User';
  const displayEmail = profile?.email || user.email || 'No email available';
  const displayAvatar = profile?.avatarUrl || user.photoUrl || user.photoPath || DEFAULT_PROFILE_AVATAR;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>My Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
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
                {user.studentId && (
                  <p className="text-sm text-gray-400">Student ID: {user.studentId}</p>
                )}
                {!profile && <p className="text-xs text-gray-400 mt-1">Using local account fallback profile.</p>}
              </div>
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <ProfileLabel>Display Initials</ProfileLabel>
              <p className="text-sm text-gray-900 mt-1">{initials}</p>
            </div>
            <div>
              <ProfileLabel>Student ID</ProfileLabel>
              <p className="text-sm text-gray-900 mt-1">{user.studentId || 'N/A'}</p>
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
            <div>
              <ProfileLabel>Member Since</ProfileLabel>
              <p className="text-sm text-gray-900 mt-1">{formatDate(user.createdAt)}</p>
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




