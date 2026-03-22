import { supabase } from '../lib/supabaseClient.js';
import { isAdmin, assertRole } from '../lib/roleUtils.js';

// Helper function to determine pageant status based on event date
const determinePageantStatus = (eventDate) => {
  const now = new Date();
  const event = new Date(eventDate);
  
  // Reset time to compare just dates
  now.setHours(0, 0, 0, 0);
  event.setHours(0, 0, 0, 0);

  if (now < event) {
    return 'upcoming';
  } else if (now.getTime() === event.getTime()) {
    return 'active';
  } else {
    return 'completed';
  }
};

// GET /api/pageants
export const getPageants = async (req, res) => {
  const { status, assignedToMe } = req.query;

  if (String(assignedToMe).toLowerCase() === 'true') {
    let assignmentQuery = supabase
      .from('pageant_judges')
      .select('pageants(*)')
      .eq('judge_id', req.user.id)
      .eq('is_active', true)
      .order('assigned_at', { ascending: false });

    if (status) {
      assignmentQuery = assignmentQuery.eq('pageants.status', status);
    }

    const { data: assignmentRows, error: assignmentError } = await assignmentQuery;
    if (assignmentError) throw assignmentError;

    const pageants = (assignmentRows ?? [])
      .map((row) => row.pageants)
      .filter(Boolean);

    return res.json(pageants);
  }

  let query = supabase.from('pageants').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
};

// GET /api/pageants/:id
export const getPageantById = async (req, res) => {
  const { data, error } = await supabase
    .from('pageants')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Pageant not found.' });
  res.json(data);
};

// POST /api/pageants
export const createPageant = async (req, res) => {
  // Defence-in-depth: must be pageant_committee or admin.
  if (assertRole(req, res, 'pageant_committee')) return;

  const { name, description, eventDate, scoringMethod, totalWeight, resultsPublic } = req.body;
  if (!name || !eventDate || !scoringMethod) {
    return res.status(400).json({ error: 'name, eventDate, and scoringMethod are required.' });
  }

  // Automatically determine status based on event date
  const status = determinePageantStatus(eventDate);

  const { data, error } = await supabase
    .from('pageants')
    .insert({
      name,
      description,
      event_date: eventDate,
      status,
      created_by: req.user.id,
      scoring_method: scoringMethod,
      total_weight: totalWeight ?? 100,
      results_public: resultsPublic ?? false,
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
};

// PATCH /api/pageants/:id
export const updatePageant = async (req, res) => {
  // Defence-in-depth: must be pageant_committee or admin.
  if (assertRole(req, res, 'pageant_committee')) return;

  const { name, description, eventDate, scoringMethod, totalWeight, resultsPublic } = req.body;
  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (eventDate !== undefined) updates.event_date = eventDate;
  if (scoringMethod !== undefined) updates.scoring_method = scoringMethod;
  if (totalWeight !== undefined) updates.total_weight = totalWeight;
  if (resultsPublic !== undefined) updates.results_public = resultsPublic;

  // If eventDate is being updated, recalculate status
  if (eventDate !== undefined) {
    updates.status = determinePageantStatus(eventDate);
  }

  const { data, error } = await supabase
    .from('pageants')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
};

// PATCH /api/pageants/:id/status
export const updatePageantStatus = async (req, res) => {
  // Defence-in-depth: must be pageant_committee or admin.
  if (assertRole(req, res, 'pageant_committee')) return;

  const { status } = req.body;
  const validStatuses = ['draft', 'upcoming', 'active', 'completed', 'archived'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  // Only admins may archive a pageant (irreversible action).
  if (status === 'archived' && !isAdmin(req)) {
    return res.status(403).json({ error: 'Only admins can archive a pageant.' });
  }

  const { data, error } = await supabase
    .from('pageants')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
};

// DELETE /api/pageants/:id
export const deletePageant = async (req, res) => {
  // Defence-in-depth: must be pageant_committee or admin.
  if (assertRole(req, res, 'pageant_committee')) return;

  // Only the creator or an admin may delete the pageant.
  const { data: pageant, error: fetchError } = await supabase
    .from('pageants')
    .select('created_by')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !pageant) return res.status(404).json({ error: 'Pageant not found.' });

  if (pageant.created_by !== req.user.id && !isAdmin(req)) {
    return res.status(403).json({ error: 'Only the pageant creator or an admin can delete this pageant.' });
  }

  const { error } = await supabase.from('pageants').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Pageant deleted.' });
};
