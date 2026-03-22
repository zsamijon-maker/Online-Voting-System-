import { supabase } from '../lib/supabaseClient.js';
import crypto from 'crypto';
import { hasRole, assertRole } from '../lib/roleUtils.js';

const generateScoreHash = (judgeId, contestantId, criteriaId, score) => {
  return crypto
    .createHash('sha256')
    .update(`${judgeId}:${contestantId}:${criteriaId}:${score}:${Date.now()}`)
    .digest('hex');
};

// POST /api/scores  — judge submits scores for a contestant
export const submitScores = async (req, res) => {
  // Defence-in-depth: must be judge or admin.
  if (assertRole(req, res, 'judge')) return;

  const { pageantId, contestantId, scores } = req.body;

  if (!pageantId || !contestantId || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'pageantId, contestantId, and scores array are required.' });
  }

  // Verify judge is assigned to this pageant
  const { data: judgeAssignment } = await supabase
    .from('pageant_judges')
    .select('id')
    .eq('pageant_id', pageantId)
    .eq('judge_id', req.user.id)
    .eq('is_active', true)
    .single();

  if (!judgeAssignment) {
    return res.status(403).json({ error: 'You are not assigned as a judge for this pageant.' });
  }

  const rows = scores.map(({ criteriaId, score, notes }) => ({
    pageant_id: pageantId,
    contestant_id: contestantId,
    criteria_id: criteriaId,
    judge_id: req.user.id,
    score,
    notes: notes || null,
    score_hash: generateScoreHash(req.user.id, contestantId, criteriaId, score),
    ip_address: req.ip,
  }));

  // Upsert scores (replace if judge already scored this contestant/criteria)
  const { data, error } = await supabase
    .from('scores')
    .upsert(rows, { onConflict: 'pageant_id,contestant_id,criteria_id,judge_id' })
    .select();

  if (error) throw error;
  res.status(201).json(data);
};

// GET /api/pageants/:pageantId/results
export const getPageantResults = async (req, res) => {
  const { pageantId } = req.params;

  // If this pageant's results are not yet public, restrict to admins,
  // pageant committee members, and assigned judges only.
  const { data: pageant, error: pageantError } = await supabase
    .from('pageants')
    .select('results_public')
    .eq('id', pageantId)
    .single();

  if (pageantError || !pageant) {
    return res.status(404).json({ error: 'Pageant not found.' });
  }

  if (!pageant.results_public && !hasRole(req, 'pageant_committee', 'judge')) {
    return res.status(403).json({ error: 'Pageant results are not yet public.' });
  }

  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('contestant_id, criteria_id, score, criteria(name, weight, max_score)')
    .eq('pageant_id', pageantId);

  if (scoresError) throw scoresError;

  const { data: contestants, error: contestantsError } = await supabase
    .from('contestants')
    .select('id, contestant_number, first_name, last_name, photo_url, photo_path')
    .eq('pageant_id', pageantId)
    .eq('is_active', true);

  if (contestantsError) throw contestantsError;

  const results = contestants.map(contestant => {
    const contestantScores = scores.filter(s => s.contestant_id === contestant.id);

    const criteriaMap = {};
    for (const s of contestantScores) {
      if (!criteriaMap[s.criteria_id]) {
        criteriaMap[s.criteria_id] = {
          criteriaId: s.criteria_id,
          criteriaName: s.criteria?.name,
          weight: s.criteria?.weight ?? 0,
          maxScore: s.criteria?.max_score ?? 100,
          scores: [],
        };
      }
      criteriaMap[s.criteria_id].scores.push(s.score);
    }

    let totalWeighted = 0;
    const criteriaBreakdown = Object.values(criteriaMap).map(c => {
      const avg = c.scores.reduce((a, b) => a + b, 0) / (c.scores.length || 1);
      const weighted = (avg / c.maxScore) * c.weight;
      totalWeighted += weighted;
      return {
        criteriaId: c.criteriaId,
        criteriaName: c.criteriaName,
        weight: c.weight,
        averageScore: Math.round(avg * 100) / 100,
        weightedContribution: Math.round(weighted * 100) / 100,
      };
    });

    return {
      contestantId: contestant.id,
      contestantNumber: contestant.contestant_number,
      contestantName: `${contestant.first_name} ${contestant.last_name}`,
      photoPath: contestant.photo_path,
      photoUrl: contestant.photo_url,
      weightedScore: Math.round(totalWeighted * 100) / 100,
      criteriaBreakdown,
    };
  });

  // Sort by weighted score and assign rank
  results.sort((a, b) => b.weightedScore - a.weightedScore);
  results.forEach((r, i) => (r.rank = i + 1));

  res.json(results);
};

// GET /api/pageants/:pageantId/my-scores
export const getMyScores = async (req, res) => {
  const { data, error } = await supabase
    .from('scores')
    .select('*')
    .eq('pageant_id', req.params.pageantId)
    .eq('judge_id', req.user.id);
  if (error) throw error;
  res.json(data);
};
