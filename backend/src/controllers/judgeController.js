import { supabase } from '../lib/supabaseClient.js';

const hasJudgeRole = (roles) => Array.isArray(roles) && roles.includes('judge');

const formatJudgeName = (judge) => `${judge.first_name} ${judge.last_name}`.trim();

async function assignJudgeToPageant({ pageantId, judge, assignedBy }) {
  const { data, error } = await supabase
    .from('pageant_judges')
    .upsert(
      {
        pageant_id: pageantId,
        judge_id: judge.id,
        judge_name: formatJudgeName(judge) || 'Unknown',
        assigned_by: assignedBy,
        assigned_at: new Date().toISOString(),
        is_active: true,
      },
      { onConflict: 'pageant_id,judge_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// GET /api/pageants/:pageantId/judges
export const getJudges = async (req, res) => {
  const { data, error } = await supabase
    .from('pageant_judges')
    .select('*, users(first_name, last_name, email)')
    .eq('pageant_id', req.params.pageantId)
    .eq('is_active', true);
  if (error) throw error;
  res.json(data);
};

// GET /api/pageants/:pageantId/judges/available
export const getAvailableJudges = async (_req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, first_name, last_name, email, roles, is_active')
    .contains('roles', ['judge'])
    .eq('is_active', true)
    .order('first_name', { ascending: true });

  if (error) throw error;
  res.json(data ?? []);
};

// POST /api/pageants/:pageantId/judges
export const assignJudge = async (req, res) => {
  const { judgeId } = req.body;
  if (!judgeId) return res.status(400).json({ error: 'judgeId is required.' });

  const { data: judge, error: judgeError } = await supabase
    .from('users')
    .select('id, first_name, last_name, roles, is_active')
    .eq('id', judgeId)
    .single();

  if (judgeError || !judge || !judge.is_active || !hasJudgeRole(judge.roles)) {
    return res.status(400).json({ error: 'Selected user is not an active judge.' });
  }

  const data = await assignJudgeToPageant({
    pageantId: req.params.pageantId,
    judge,
    assignedBy: req.user.id,
  });

  res.status(201).json(data);
};

// POST /api/pageants/:pageantId/judges/bulk
export const assignJudgesBulk = async (req, res) => {
  const { judgeIds } = req.body;

  if (!Array.isArray(judgeIds) || judgeIds.length === 0) {
    return res.status(400).json({ error: 'judgeIds must be a non-empty array.' });
  }

  const uniqueJudgeIds = [...new Set(judgeIds.filter(Boolean))];
  if (uniqueJudgeIds.length === 0) {
    return res.status(400).json({ error: 'No valid judgeIds were provided.' });
  }

  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, first_name, last_name, roles, is_active')
    .in('id', uniqueJudgeIds);

  if (usersError) throw usersError;

  const validJudges = (users ?? []).filter((u) => u.is_active && hasJudgeRole(u.roles));
  const validJudgeIds = new Set(validJudges.map((u) => u.id));
  const invalidJudgeIds = uniqueJudgeIds.filter((id) => !validJudgeIds.has(id));

  if (validJudges.length === 0) {
    return res.status(400).json({ error: 'No valid judges found in selection.' });
  }

  const assignments = await Promise.all(
    validJudges.map((judge) =>
      assignJudgeToPageant({
        pageantId: req.params.pageantId,
        judge,
        assignedBy: req.user.id,
      })
    )
  );

  res.status(201).json({
    assigned: assignments,
    assignedCount: assignments.length,
    invalidJudgeIds,
  });
};

// DELETE /api/pageants/:pageantId/judges/:judgeId
export const removeJudge = async (req, res) => {
  const { error } = await supabase
    .from('pageant_judges')
    .update({ is_active: false })
    .eq('pageant_id', req.params.pageantId)
    .eq('judge_id', req.params.judgeId);
  if (error) throw error;
  res.json({ message: 'Judge removed from pageant.' });
};
