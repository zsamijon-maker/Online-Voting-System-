import { supabase } from '../lib/supabaseClient.js';
import crypto from 'crypto';
import { hasRole } from '../lib/roleUtils.js';

// Only transition time-window states automatically; keep terminal states stable once set manually.
const isAutoManagedElectionStatus = (status) => ['upcoming', 'active'].includes(status);

const computeTimedElectionStatus = (startDate, endDate, now = new Date()) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'active';
  return 'closed';
};

const generateVoteHash = (voterId, electionId, candidateId, position) => {
  // Use cryptographic random bytes for entropy instead of predictable timestamp
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString(36); // Use base-36 for less predictable format
  return crypto
    .createHash('sha256')
    .update(`${voterId}:${electionId}:${candidateId}:${position}:${timestamp}:${randomBytes}`)
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
    .select('id, status, type, start_date, end_date')
    .eq('id', electionId)
    .single();

  if (electionError || !election) return res.status(404).json({ error: 'Election not found.' });

  const effectiveStatus = isAutoManagedElectionStatus(election.status)
    ? computeTimedElectionStatus(election.start_date, election.end_date)
    : election.status;

  if (effectiveStatus !== election.status) {
    await supabase
      .from('elections')
      .update({ status: effectiveStatus, updated_at: new Date().toISOString() })
      .eq('id', election.id);
  }

  if (effectiveStatus !== 'active') return res.status(400).json({ error: 'Election is not active.' });

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

  const voteHash = generateVoteHash(req.user.id, electionId, candidateId, effectivePosition);

  // Atomic insert path handled by Postgres function to prevent check/insert races.
  const { data: submitResult, error: submitError } = await supabase.rpc('submit_vote_atomic', {
    p_election_id: electionId,
    p_voter_id: req.user.id,
    p_candidate_id: candidateId,
    p_vote_hash: voteHash,
    p_ip_address: req.ip,
    p_user_agent: req.headers['user-agent'] ?? null,
  });

  if (submitError) {
    if (
      submitError.code === 'PGRST202' ||
      String(submitError.message || '').toLowerCase().includes('submit_vote_atomic')
    ) {
      return res.status(500).json({
        error: 'Voting service is not fully configured. Please apply the latest database migration.',
      });
    }
    throw submitError;
  }

  const resultRow = Array.isArray(submitResult) ? submitResult[0] : submitResult;
  if (!resultRow?.success) {
    if (resultRow?.error_code === 'DUPLICATE_CANDIDATE') {
      return res.status(409).json({ error: resultRow.error_message || 'You have already voted for this candidate.' });
    }

    if (resultRow?.error_code === 'POSITION_LIMIT_REACHED') {
      return res.status(409).json({ error: resultRow.error_message || `Maximum votes reached for ${effectivePosition}.` });
    }

    if (resultRow?.error_code === 'CANDIDATE_NOT_FOUND') {
      return res.status(404).json({ error: resultRow.error_message || 'Candidate not found.' });
    }

    if (resultRow?.error_code === 'CANDIDATE_ELECTION_MISMATCH') {
      return res.status(400).json({ error: resultRow.error_message || 'Candidate does not belong to this election.' });
    }

    return res.status(400).json({ error: resultRow?.error_message || 'Unable to submit vote.' });
  }

  res.status(201).json({ message: 'Vote submitted successfully.', voteHash: resultRow.vote_hash });
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
