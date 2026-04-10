import { supabase } from '../lib/supabaseClient.js';
import { isAdmin, assertRole } from '../lib/roleUtils.js';
import { writeAuditLog } from '../lib/auditLogger.js';
import { logger } from '../lib/logger.js';

const PREDEFINED_ELECTION_POSITIONS = Object.freeze({
  student_government: [
    { position_name: 'President', max_vote: 1 },
    { position_name: 'Vice President', max_vote: 1 },
    { position_name: 'Senators', max_vote: 12 },
  ],
  fstlp_officers: [
    { position_name: 'President', max_vote: 1 },
    { position_name: 'Vice President', max_vote: 1 },
    { position_name: 'Secretary', max_vote: 1 },
    { position_name: 'Treasurer', max_vote: 1 },
    { position_name: 'Auditor', max_vote: 1 },
    { position_name: 'PIO', max_vote: 2 },
    { position_name: 'Board Members', max_vote: 6 },
  ],
});

const isPredefinedPositionsElection = (type) => Boolean(PREDEFINED_ELECTION_POSITIONS[type]);

const buildPredefinedPositions = (electionId, type) =>
  (PREDEFINED_ELECTION_POSITIONS[type] || []).map((position) => ({
    election_id: electionId,
    position_name: position.position_name,
    max_vote: position.max_vote,
  }));

const createElectionPositions = async (electionId, type) => {
  if (!isPredefinedPositionsElection(type)) return [];

  const positions = buildPredefinedPositions(electionId, type);
  const { data, error } = await supabase
    .from('election_positions')
    .insert(positions)
    .select('id, election_id, position_name, max_vote, created_at');

  if (error) throw error;
  return data ?? [];
};

// Only transition time-window states automatically; keep terminal states stable once set manually.
const isAutoManagedElectionStatus = (status) => ['upcoming', 'active'].includes(status);

const computeTimedElectionStatus = (startDate, endDate, now = new Date()) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'active';
  return 'closed';
};

const resolveElectionStatus = (election, now = new Date()) => {
  if (!isAutoManagedElectionStatus(election.status)) return election.status;
  return computeTimedElectionStatus(election.start_date, election.end_date, now);
};

const reconcileElectionStatuses = async () => {
  const { data, error } = await supabase
    .from('elections')
    .select('id, status, start_date, end_date')
    .in('status', ['upcoming', 'active']);

  if (error) throw error;

  const now = new Date();
  const updates = (data ?? [])
    .map((election) => {
      const nextStatus = resolveElectionStatus(election, now);
      return nextStatus === election.status ? null : { id: election.id, status: nextStatus };
    })
    .filter(Boolean);

  if (updates.length === 0) return;

  await Promise.all(
    updates.map((update) =>
      supabase
        .from('elections')
        .update({ status: update.status, updated_at: now.toISOString() })
        .eq('id', update.id)
    )
  );
};

// Helper function to determine status based on dates
const determineStatus = (startDate, endDate) => {
  return computeTimedElectionStatus(startDate, endDate);
};

// GET /api/elections
export const getElections = async (req, res) => {
  const { status } = req.query;

  // Keep DB statuses aligned with current time window before serving voters/admins.
  try {
    await reconcileElectionStatuses();
  } catch (reconcileError) {
    logger.warn('[getElections] status reconciliation skipped:', reconcileError?.message || reconcileError);
  }

  let query = supabase.from('elections').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
};

// GET /api/elections/:id
export const getElectionById = async (req, res) => {
  const { data, error } = await supabase
    .from('elections')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Election not found.' });
  res.json(data);
};

// GET /api/elections/:id/positions
export const getElectionPositions = async (req, res) => {
  const { data, error } = await supabase
    .from('election_positions')
    .select('id, position_name, max_vote, election_id, created_at')
    .eq('election_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const normalized = (data ?? []).map((position) => ({
    id: position.id,
    name: position.position_name,
    vote_limit: position.max_vote,
    election_id: position.election_id,
    created_at: position.created_at,
  }));

  res.json(normalized);
};

// POST /api/elections
export const createElection = async (req, res) => {
  // Defence-in-depth: must be election_committee or admin.
  if (assertRole(req, res, 'election_committee')) return;

  const { title, description, type, startDate, endDate, allowWriteIns, maxVotesPerVoter, resultsPublic } = req.body;

  if (!title || !type || !startDate || !endDate) {
    return res.status(400).json({ error: 'title, type, startDate, and endDate are required.' });
  }

  if (resultsPublic === true && !isAdmin(req)) {
    return res.status(403).json({ error: 'Only admins can publish election results.' });
  }

  // Automatically determine status based on dates
  const status = determineStatus(startDate, endDate);

  const { data, error } = await supabase
    .from('elections')
    .insert({
      title,
      description,
      type,
      status,
      start_date: startDate,
      end_date: endDate,
      created_by: req.user.id,
      allow_write_ins: allowWriteIns ?? false,
      max_votes_per_voter: isPredefinedPositionsElection(type) ? 1 : (maxVotesPerVoter ?? 1),
      results_public: resultsPublic ?? false,
    })
    .select()
    .single();

  if (error) throw error;

  try {
    const positions = await createElectionPositions(data.id, type);
    await writeAuditLog({
      req,
      action: 'election_created',
      entityType: 'election',
      entityId: data.id,
      newValues: data,
    });
    res.status(201).json({ ...data, positions });
  } catch (positionError) {
    await supabase.from('elections').delete().eq('id', data.id);
    throw positionError;
  }
};

// PATCH /api/elections/:id
export const updateElection = async (req, res) => {
  // Defence-in-depth: must be election_committee or admin.
  if (assertRole(req, res, 'election_committee')) return;

  const { title, description, type, startDate, endDate, allowWriteIns, maxVotesPerVoter, resultsPublic } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (type !== undefined) updates.type = type;
  if (startDate !== undefined) updates.start_date = startDate;
  if (endDate !== undefined) updates.end_date = endDate;
  if (allowWriteIns !== undefined) updates.allow_write_ins = allowWriteIns;
  if (maxVotesPerVoter !== undefined) updates.max_votes_per_voter = maxVotesPerVoter;
  if (resultsPublic !== undefined) {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: 'Only admins can change election results visibility.' });
    }
    updates.results_public = resultsPublic;
  }

  const { data: currentElection, error: currentElectionError } = await supabase
    .from('elections')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (currentElectionError || !currentElection) {
    return res.status(404).json({ error: 'Election not found.' });
  }

  // If either startDate or endDate is being updated, recalculate status.
  if (startDate !== undefined || endDate !== undefined) {
    const finalStartDate = startDate || currentElection.start_date;
    const finalEndDate = endDate || currentElection.end_date;
    updates.status = determineStatus(finalStartDate, finalEndDate);
  }

  const { data, error } = await supabase
    .from('elections')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;

  await writeAuditLog({
    req,
    action: 'election_updated',
    entityType: 'election',
    entityId: data.id,
    oldValues: currentElection,
    newValues: data,
  });

  res.json(data);
};

// PATCH /api/elections/:id/status
export const updateElectionStatus = async (req, res) => {
  // Defence-in-depth: must be election_committee or admin.
  if (assertRole(req, res, 'election_committee')) return;

  const { status } = req.body;
  const validStatuses = ['draft', 'upcoming', 'active', 'closed', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  // Only admins may archive an election (irreversible action).
  if (status === 'archived' && !isAdmin(req)) {
    return res.status(403).json({ error: 'Only admins can archive an election.' });
  }

  const { data: currentElection, error: currentElectionError } = await supabase
    .from('elections')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (currentElectionError || !currentElection) {
    return res.status(404).json({ error: 'Election not found.' });
  }

  const { data, error } = await supabase
    .from('elections')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;

  await writeAuditLog({
    req,
    action: 'election_status_updated',
    entityType: 'election',
    entityId: data.id,
    oldValues: { status: currentElection.status },
    newValues: { status: data.status },
  });

  res.json(data);
};

// DELETE /api/elections/:id
export const deleteElection = async (req, res) => {
  // Defence-in-depth: must be election_committee or admin.
  if (assertRole(req, res, 'election_committee')) return;

  // Only the creator or an admin may delete the election.
  const { data: election, error: fetchError } = await supabase
    .from('elections')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !election) return res.status(404).json({ error: 'Election not found.' });

  if (election.created_by !== req.user.id && !isAdmin(req)) {
    return res.status(403).json({ error: 'Only the election creator or an admin can delete this election.' });
  }

  const { error } = await supabase.from('elections').delete().eq('id', req.params.id);
  if (error) throw error;

  await writeAuditLog({
    req,
    action: 'election_deleted',
    entityType: 'election',
    entityId: req.params.id,
    oldValues: election,
  });

  res.json({ message: 'Election deleted.' });
};
