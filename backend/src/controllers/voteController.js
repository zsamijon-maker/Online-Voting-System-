import { supabase } from '../lib/supabaseClient.js';
import crypto from 'crypto';
import { hasRole } from '../lib/roleUtils.js';

const STUDENT_GOV_POSITION_LIMITS = Object.freeze({
  President: 1,
  'Vice President': 1,
  Senators: 12,
});

const resolvePositionVoteLimit = async ({ electionId, positionId, legacyPosition }) => {
  if (positionId) {
    const { data: positionRule, error } = await supabase
      .from('election_positions')
      .select('max_vote')
      .eq('election_id', electionId)
      .eq('id', positionId)
      .maybeSingle();

    if (error) throw error;
    if (positionRule?.max_vote && positionRule.max_vote >= 1) return positionRule.max_vote;
  }

  // Legacy fallback for pre-migration records without position_id.
  return STUDENT_GOV_POSITION_LIMITS[legacyPosition] ?? 1;
};

const generateVoteHash = (voterId, electionId, candidateId, position) => {
  return crypto
    .createHash('sha256')
    .update(`${voterId}:${electionId}:${candidateId}:${position}:${Date.now()}`)
    .digest('hex');
};

// POST /api/votes
export const submitVote = async (req, res) => {
  const { electionId, candidateId } = req.body;

  if (!electionId || !candidateId) {
    return res.status(400).json({ error: 'electionId and candidateId are required.' });
  }

  // Check election is active
  const { data: election, error: electionError } = await supabase
    .from('elections')
    .select('status, type')
    .eq('id', electionId)
    .single();

  if (electionError || !election) return res.status(404).json({ error: 'Election not found.' });
  if (election.status !== 'active') return res.status(400).json({ error: 'Election is not active.' });

  const { data: candidate, error: candidateError } = await supabase
    .from('candidates')
    .select('id, election_id, position, position_id')
    .eq('id', candidateId)
    .single();

  if (candidateError || !candidate) {
    return res.status(404).json({ error: 'Candidate not found.' });
  }

  if (candidate.election_id !== electionId) {
    return res.status(400).json({ error: 'Candidate does not belong to this election.' });
  }

  const effectivePosition = candidate.position;
  const positionKey = candidate.position_id ?? effectivePosition;

  // Prevent duplicate vote for the same candidate.
  const { data: duplicateCandidateVote, error: duplicateVoteError } = await supabase
    .from('votes')
    .select('id')
    .eq('election_id', electionId)
    .eq('voter_id', req.user.id)
    .eq('candidate_id', candidateId)
    .maybeSingle();

  if (duplicateVoteError) throw duplicateVoteError;
  if (duplicateCandidateVote) {
    return res.status(409).json({ error: 'You have already voted for this candidate.' });
  }

  const maxVotesForPosition = await resolvePositionVoteLimit({
    electionId,
    positionId: candidate.position_id,
    legacyPosition: effectivePosition,
  });

  const { data: existingVotes, error: countError } = await supabase
    .from('votes')
    .select('candidate_id, candidates(position_id, position)')
    .eq('election_id', electionId)
    .eq('voter_id', req.user.id);

  if (countError) throw countError;

  const votesForPositionCount = (existingVotes ?? []).filter((vote) => {
    const votedPositionKey = vote.candidates?.position_id ?? vote.candidates?.position;
    return votedPositionKey === positionKey;
  }).length;

  if (votesForPositionCount >= maxVotesForPosition) {
    return res.status(409).json({
      error: `Maximum votes reached for ${effectivePosition}. Limit: ${maxVotesForPosition}.`,
    });
  }

  const voteHash = generateVoteHash(req.user.id, electionId, candidateId, position);

  const { data, error } = await supabase
    .from('votes')
    .insert({
      election_id: electionId,
      voter_id: req.user.id,
      candidate_id: candidateId,
      position: effectivePosition,
      vote_hash: voteHash,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json({ message: 'Vote submitted successfully.', voteHash: data.vote_hash });
};

// GET /api/elections/:electionId/results
export const getElectionResults = async (req, res) => {
  const { electionId } = req.params;

  // If this election's results are not yet public, restrict to admins and
  // election committee members only.
  const { data: election, error: electionError } = await supabase
    .from('elections')
    .select('results_public')
    .eq('id', electionId)
    .single();

  if (electionError || !election) {
    return res.status(404).json({ error: 'Election not found.' });
  }

  if (!election.results_public && !hasRole(req, 'election_committee')) {
    return res.status(403).json({ error: 'Election results are not yet public.' });
  }

  const { data: votes, error } = await supabase
    .from('votes')
    .select('candidate_id, position, candidates(display_name, photo_url, photo_path)')
    .eq('election_id', electionId);

  if (error) throw error;

  // Tally by position
  const results = {};
  for (const vote of votes) {
    if (!results[vote.position]) results[vote.position] = {};
    const key = vote.candidate_id;
    if (!results[vote.position][key]) {
      results[vote.position][key] = {
        candidateId: key,
        displayName: vote.candidates?.display_name,
        photoPath: vote.candidates?.photo_path,
        photoUrl: vote.candidates?.photo_url,
        voteCount: 0,
      };
    }
    results[vote.position][key].voteCount++;
  }

  // Calculate percentages
  const formatted = Object.entries(results).map(([position, candidates]) => {
    const candidateList = Object.values(candidates);
    const total = candidateList.reduce((sum, c) => sum + c.voteCount, 0);
    return {
      position,
      totalVotes: total,
      candidates: candidateList.map(c => ({
        ...c,
        percentage: total > 0 ? Math.round((c.voteCount / total) * 100 * 10) / 10 : 0,
      })),
    };
  });

  res.json(formatted);
};

// GET /api/elections/:electionId/my-votes
export const getMyVotes = async (req, res) => {
  const { data, error } = await supabase
    .from('votes')
    .select('position, candidate_id, voted_at')
    .eq('election_id', req.params.electionId)
    .eq('voter_id', req.user.id);
  if (error) throw error;
  res.json(data);
};
