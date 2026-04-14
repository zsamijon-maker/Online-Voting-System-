import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Vote, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useNotification } from '@/contexts/NotificationContext';
import type { Candidate, Vote as VoteType } from '@/types';
import { castVote, getUserVotes } from '@/services/electionService';

export type CandidateDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
  voterId: string;
  maxVotesForPosition: number;
  onVoteSuccess?: () => void;
};

export function CandidateDetailsModal({
  isOpen,
  onClose,
  candidate,
  voterId,
  maxVotesForPosition,
  onVoteSuccess,
}: CandidateDetailsModalProps) {
  const { showError } = useNotification();
  const [isChecking, setIsChecking] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [votesForPosition, setVotesForPosition] = useState<VoteType[]>([]);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!isOpen || !candidate || !voterId) {
      setVotesForPosition([]);
      setIsChecking(false);
      return;
    }

    let cancelled = false;

    Promise.resolve().then(async () => {
      setIsChecking(true);
      try {
        const votes = await getUserVotes(candidate.electionId, voterId);
        if (cancelled) return;
        setVotesForPosition(votes.filter((v) => v.position === candidate.position));
      } catch {
        if (!cancelled) {
          setVotesForPosition([]);
          showError('Unable to verify your vote status right now.');
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, candidate, voterId, showError]);

  const hasReachedLimit = votesForPosition.length >= maxVotesForPosition;
  const hasAlreadyVotedPosition = votesForPosition.length > 0;

  const voteButtonText = useMemo(() => {
    if (isChecking) return 'Checking eligibility...';
    if (isVoting) return 'Recording vote...';
    if (hasReachedLimit || hasAlreadyVotedPosition) return 'Already Voted';
    return 'Vote Now';
  }, [isChecking, isVoting, hasReachedLimit, hasAlreadyVotedPosition]);

  const canVote = Boolean(candidate)
    && !isChecking
    && !isVoting
    && !hasReachedLimit
    && !hasAlreadyVotedPosition;

  const handleVote = async () => {
    if (!candidate || !canVote) return;

    setIsVoting(true);
    try {
      const result = await castVote(candidate.electionId, voterId, candidate.id, candidate.position);
      if (!result.success) {
        showError(result.error || 'Failed to record your vote.');
        return;
      }

      onVoteSuccess?.();
      onClose();
    } finally {
      setIsVoting(false);
    }
  };

  const partylist = (candidate as Candidate & { partylist?: string } | null)?.partylist;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl rounded-2xl p-0 overflow-hidden border-gray-100 shadow-xl">
        {!candidate ? null : (
          <>
            <DialogHeader className="px-6 pt-6 pb-3 text-left">
              <DialogTitle className="text-xl font-extrabold text-gray-900 tracking-tight">Candidate Details</DialogTitle>
              <DialogDescription className="text-sm text-gray-500">
                Review profile information before casting your vote.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-4 max-h-[62vh] overflow-y-auto space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="w-24 h-24 rounded-full bg-[#1E3A8A] overflow-hidden flex items-center justify-center shrink-0">
                  {(candidate.photoPath || candidate.photoUrl) && !imageError ? (
                    <img
                      src={candidate.photoPath || candidate.photoUrl}
                      alt={candidate.displayName}
                      className="w-full h-full object-cover"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <span className="text-3xl font-extrabold text-white">{candidate.displayName.charAt(0)}</span>
                  )}
                </div>
                <div className="space-y-1 min-w-0">
                  <h3 className="text-lg font-extrabold text-gray-900 tracking-tight break-words">{candidate.displayName}</h3>
                  <p className="text-sm font-semibold text-[#1E3A8A]">{candidate.position}</p>
                  {partylist && <p className="text-xs text-gray-500">Partylist: {partylist}</p>}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Biography</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {candidate.bio || 'No biography provided.'}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Campaign Platform</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                    {candidate.platform || 'No campaign platform provided.'}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-700">
                    Votes used for this position: <span className="font-extrabold">{votesForPosition.length}/{maxVotesForPosition}</span>
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="sticky bottom-0 border-t border-gray-100 bg-white px-6 py-4 gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                disabled={isVoting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void handleVote(); }}
                disabled={!canVote}
                className={[
                  'w-full sm:w-auto px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-150 inline-flex items-center justify-center gap-2',
                  canVote
                    ? 'bg-[#166534] hover:bg-[#14532d] text-white shadow-sm shadow-green-200 hover:-translate-y-px active:translate-y-0'
                    : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed',
                ].join(' ')}
              >
                {hasAlreadyVotedPosition || hasReachedLimit ? <CheckCircle className="w-4 h-4" /> : <Vote className="w-4 h-4" />}
                {voteButtonText}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
