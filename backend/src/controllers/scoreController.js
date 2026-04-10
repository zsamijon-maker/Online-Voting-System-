import { supabase } from '../lib/supabaseClient.js';
import crypto from 'crypto';
import { hasRole, assertRole } from '../lib/roleUtils.js';

// Only transition time-window states automatically; keep terminal states stable once set manually.
const isAutoManagedPageantStatus = (status) => ['upcoming', 'active'].includes(status);

const determinePageantStatus = (eventDate, nowInput = new Date()) => {
  const now = new Date(nowInput);
  const event = new Date(eventDate);

  now.setHours(0, 0, 0, 0);
  event.setHours(0, 0, 0, 0);

  if (now < event) return 'upcoming';
  if (now.getTime() === event.getTime()) return 'active';
  return 'completed';
};

const generateScoreHash = (judgeId, contestantId, criteriaId, score) => {
  return crypto
    .createHash('sha256')
    .update(`${judgeId}:${contestantId}:${criteriaId}:${score}:${Date.now()}`)
    .digest('hex');
};

const SCORING_MODES = {
  AVERAGE: 'average',
  WEIGHTED_MEAN: 'weighted',
  RANKING: 'ranking',
  RANKING_BY_GENDER: 'ranking_by_gender',
};

const RANKING_TIE_BREAKERS = {
  WEIGHTED_CRITERIA: 'weighted_criteria',
  JUDGE_PRIORITY: 'judge_priority',
  KEEP_TIED: 'keep_tied',
};

const round2 = (value) => Math.round(value * 100) / 100;

const normalizeTieBreaker = (tieBreaker) => {
  if (!tieBreaker) return RANKING_TIE_BREAKERS.KEEP_TIED;

  const normalized = String(tieBreaker).toLowerCase();

  if (['1', 'weighted', 'weighted_score', 'weighted_criteria'].includes(normalized)) {
    return RANKING_TIE_BREAKERS.WEIGHTED_CRITERIA;
  }

  if (['2', 'judge', 'judge_priority', 'priority'].includes(normalized)) {
    return RANKING_TIE_BREAKERS.JUDGE_PRIORITY;
  }

  if (['3', 'keep_tied', 'keep_ties', 'tied'].includes(normalized)) {
    return RANKING_TIE_BREAKERS.KEEP_TIED;
  }

  return null;
};

const assignStandardCompetitionRanks = (items, getComparableValue) => {
  let lastValue = null;
  let lastRank = 0;

  return items.map((item, index) => {
    const value = getComparableValue(item);
    const rank = index > 0 && value === lastValue ? lastRank : index + 1;
    lastValue = value;
    lastRank = rank;
    return { ...item, rank };
  });
};

const buildCriteriaAverages = (criteriaRows, contestantScoreRows) => {
  return criteriaRows.map((criterion) => {
    const criterionScores = contestantScoreRows.filter((row) => row.criteria_id === criterion.id);
    const sum = criterionScores.reduce((acc, row) => acc + Number(row.score || 0), 0);
    const averageScore = criterionScores.length > 0 ? sum / criterionScores.length : 0;

    return {
      criteriaId: criterion.id,
      criteriaName: criterion.name,
      weight: Number(criterion.weight || 0),
      maxScore: Number(criterion.max_score || 0),
      averageScore,
      computed: averageScore,
    };
  });
};

const buildWeightedDetails = (criteriaAverages) => {
  const totalWeight = criteriaAverages.reduce((sum, c) => sum + c.weight, 0);
  const adjustedCriteria = criteriaAverages.map((c) => ({
    ...c,
    adjustedWeight: totalWeight > 0 ? (c.weight / totalWeight) * 100 : 0,
  }));

  const weightedContributions = adjustedCriteria.map((criterion) => {
    const normalized = criterion.maxScore > 0 ? criterion.averageScore / criterion.maxScore : 0;
    const weightedContribution = normalized * criterion.adjustedWeight;

    return {
      criteriaId: criterion.criteriaId,
      criteriaName: criterion.criteriaName,
      weight: criterion.weight,
      maxScore: criterion.maxScore,
      averageScore: round2(criterion.averageScore),
      weightedContribution: round2(weightedContribution),
      computed: round2(weightedContribution),
    };
  });

  const finalPercentage = weightedContributions.reduce((sum, c) => sum + c.weightedContribution, 0);

  return {
    totalWeight,
    criteriaBreakdown: weightedContributions,
    finalPercentage: round2(finalPercentage),
    finalRating: round2(finalPercentage / 10),
  };
};

// POST /api/scores  — judge submits scores for a contestant
export const submitScores = async (req, res) => {
  // Defence-in-depth: must be judge or admin.
  if (assertRole(req, res, 'judge')) return;

  const { pageantId, contestantId, scores } = req.body;

  if (!pageantId || !contestantId || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'pageantId, contestantId, and scores array are required.' });
  }

  const { data: pageant, error: pageantError } = await supabase
    .from('pageants')
    .select('id, status, event_date')
    .eq('id', pageantId)
    .single();

  if (pageantError || !pageant) {
    return res.status(404).json({ error: 'Pageant not found.' });
  }

  const effectiveStatus = isAutoManagedPageantStatus(pageant.status)
    ? determinePageantStatus(pageant.event_date)
    : pageant.status;

  if (effectiveStatus !== pageant.status) {
    await supabase
      .from('pageants')
      .update({ status: effectiveStatus, updated_at: new Date().toISOString() })
      .eq('id', pageant.id);
  }

  if (effectiveStatus !== 'active') {
    return res.status(400).json({ error: 'Pageant is not active for scoring.' });
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
  const tieBreaker = normalizeTieBreaker(req.query.tieBreaker);

  if (req.query.tieBreaker && !tieBreaker) {
    return res.status(400).json({
      error: 'Invalid tieBreaker. Supported values: weighted_criteria, judge_priority, keep_tied.',
    });
  }

  // If this pageant's results are not yet public, restrict to admins and
  // pageant committee members only.
  const { data: pageant, error: pageantError } = await supabase
    .from('pageants')
    .select('id, results_public, scoring_method')
    .eq('id', pageantId)
    .single();

  if (pageantError || !pageant) {
    return res.status(404).json({ error: 'Pageant not found.' });
  }

  if (!pageant.results_public && !hasRole(req, 'pageant_committee')) {
    return res.status(403).json({ error: 'Pageant results are not yet public.' });
  }

  const { data: pageantJudgeRows, error: pageantJudgeError } = await supabase
    .from('pageant_judges')
    .select('judge_id, assigned_at')
    .eq('pageant_id', pageantId)
    .eq('is_active', true)
    .order('assigned_at', { ascending: true });

  if (pageantJudgeError) throw pageantJudgeError;

  const assignedJudgeIds = (pageantJudgeRows || []).map((row) => row.judge_id);
  const isJudgeOnlyRequest =
    Array.isArray(req.user?.roles) &&
    req.user.roles.includes('judge') &&
    !req.user.roles.includes('admin') &&
    !req.user.roles.includes('pageant_committee');

  if (isJudgeOnlyRequest && !assignedJudgeIds.includes(req.user.id)) {
    return res.status(403).json({ error: 'You are not assigned to this pageant.' });
  }

  if (!Object.values(SCORING_MODES).includes(pageant.scoring_method)) {
    return res.status(400).json({
      error: `Invalid scoring_method '${pageant.scoring_method}'. Supported: average, weighted, ranking, ranking_by_gender.`,
    });
  }

  const selectedTieBreaker = tieBreaker || RANKING_TIE_BREAKERS.KEEP_TIED;

  const { data: criteriaRows, error: criteriaError } = await supabase
    .from('criteria')
    .select('id, name, weight, max_score')
    .eq('pageant_id', pageantId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (criteriaError) throw criteriaError;

  if (!criteriaRows || criteriaRows.length === 0) {
    return res.status(400).json({ error: 'Cannot compute results without active criteria.' });
  }

  const { data: scores, error: scoresError } = await supabase
    .from('scores')
    .select('contestant_id, criteria_id, judge_id, score')
    .eq('pageant_id', pageantId);

  if (scoresError) throw scoresError;

  const invalidScore = (scores || []).find((row) => {
    const criterion = criteriaRows.find((c) => c.id === row.criteria_id);
    if (!criterion) return true;
    const numericScore = Number(row.score);
    if (!Number.isFinite(numericScore)) return true;
    if (numericScore < 0) return true;
    if (numericScore > Number(criterion.max_score || 0)) return true;
    return false;
  });

  if (invalidScore) {
    return res.status(400).json({
      error: 'Invalid score input detected. Scores must be numeric and within criterion max_score bounds.',
    });
  }

  const { data: contestants, error: contestantsError } = await supabase
    .from('contestants')
    .select('id, contestant_number, first_name, last_name, photo_url, photo_path, gender')
    .eq('pageant_id', pageantId)
    .eq('is_active', true);

  if (contestantsError) throw contestantsError;

  const allScores = scores || [];
  const scoreJudgeIds = [...new Set(allScores.map((row) => row.judge_id).filter(Boolean))];
  const judgeOrder = [...assignedJudgeIds, ...scoreJudgeIds.filter((id) => !assignedJudgeIds.includes(id))];
  const judgeLabelMap = new Map(judgeOrder.map((judgeId, index) => [judgeId, `Judge ${index + 1}`]));

  const totalCriteriaWeight = criteriaRows.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  const adjustedWeightByCriteriaId = criteriaRows.reduce((acc, criterion) => {
    acc[criterion.id] =
      totalCriteriaWeight > 0 ? (Number(criterion.weight || 0) / totalCriteriaWeight) * 100 : 0;
    return acc;
  }, {});

  const buildJudgePercentages = (contestantScores) => {
    return judgeOrder.map((judgeId) => {
      const judgeScores = contestantScores.filter((scoreRow) => scoreRow.judge_id === judgeId);
      const scoreByCriteriaId = judgeScores.reduce((acc, scoreRow) => {
        acc[scoreRow.criteria_id] = Number(scoreRow.score || 0);
        return acc;
      }, {});

      const percentage = criteriaRows.reduce((sum, criterion) => {
        const maxScore = Number(criterion.max_score || 0);
        if (maxScore <= 0) return sum;
        const criterionScore = Number(scoreByCriteriaId[criterion.id] || 0);
        const normalized = criterionScore / maxScore;
        return sum + normalized * Number(adjustedWeightByCriteriaId[criterion.id] || 0);
      }, 0);

      return {
        judgeId,
        judgeLabel: judgeLabelMap.get(judgeId) || 'Judge',
        percentage: round2(percentage),
      };
    });
  };

  const contestantBase = contestants.map((contestant) => ({
    pageantId,
    contestantId: contestant.id,
    contestantNumber: contestant.contestant_number,
    contestantName: `${contestant.first_name} ${contestant.last_name}`,
    gender: contestant.gender || null,
    photoPath: contestant.photo_path,
    photoUrl: contestant.photo_url,
  }));

  if (pageant.scoring_method === SCORING_MODES.AVERAGE) {
    const computed = contestantBase.map((contestant) => {
      const contestantScores = allScores.filter((s) => s.contestant_id === contestant.contestantId);
      const criteriaAverages = buildCriteriaAverages(criteriaRows, contestantScores);
      const finalScoreRaw =
        criteriaAverages.reduce((sum, c) => sum + c.averageScore, 0) / (criteriaAverages.length || 1);
      const finalScore = round2(finalScoreRaw);

      return {
        ...contestant,
        scoringMode: 'AVERAGE',
        finalScore,
        finalPercentage: null,
        finalRating: null,
        rankScore: null,
        totalScore: finalScore,
        weightedScore: finalScore,
        judgeScores: buildJudgePercentages(contestantScores),
        criteriaBreakdown: criteriaAverages.map((c) => ({
          criteriaId: c.criteriaId,
          criteriaName: c.criteriaName,
          weight: c.weight,
          maxScore: c.maxScore,
          averageScore: round2(c.averageScore),
          weightedContribution: 0,
          computed: round2(c.computed),
        })),
      };
    });

    const sorted = [...computed].sort((a, b) => b.finalScore - a.finalScore);
    const ranked = assignStandardCompetitionRanks(sorted, (item) => item.finalScore);
    return res.json(ranked);
  }

  if (pageant.scoring_method === SCORING_MODES.WEIGHTED_MEAN) {
    const computed = contestantBase.map((contestant) => {
      const contestantScores = allScores.filter((s) => s.contestant_id === contestant.contestantId);
      const criteriaAverages = buildCriteriaAverages(criteriaRows, contestantScores);
      const weighted = buildWeightedDetails(criteriaAverages);

      return {
        ...contestant,
        scoringMode: 'WEIGHTED_MEAN',
        finalScore: null,
        finalPercentage: weighted.finalPercentage,
        finalRating: weighted.finalRating,
        rankScore: null,
        totalScore: weighted.finalRating,
        weightedScore: weighted.finalPercentage,
        judgeScores: buildJudgePercentages(contestantScores),
        criteriaBreakdown: weighted.criteriaBreakdown,
      };
    });

    const sorted = [...computed].sort((a, b) => b.finalPercentage - a.finalPercentage);
    const ranked = assignStandardCompetitionRanks(sorted, (item) => item.finalPercentage);
    return res.json(ranked);
  }

  let judgePriorityRows = pageantJudgeRows || [];
  if (selectedTieBreaker === RANKING_TIE_BREAKERS.JUDGE_PRIORITY) {
    const { data, error } = await supabase
      .from('pageant_judges')
      .select('judge_id, assigned_at')
      .eq('pageant_id', pageantId)
      .eq('is_active', true)
      .order('assigned_at', { ascending: true });

    if (error) throw error;
    judgePriorityRows = data || [];
  }

  const rankedJudgeIds = judgePriorityRows.map((row) => row.judge_id);

  const computeRankingResults = (contestantGroup) => {
    const contestantIds = new Set(contestantGroup.map((contestant) => contestant.contestantId));
    const groupScores = allScores.filter((scoreRow) => contestantIds.has(scoreRow.contestant_id));

    const judgeContestantTotals = {};
    for (const scoreRow of groupScores) {
      const judgeId = scoreRow.judge_id;
      const contestantId = scoreRow.contestant_id;
      if (!judgeId || !contestantId) continue;

      if (!judgeContestantTotals[judgeId]) judgeContestantTotals[judgeId] = {};
      judgeContestantTotals[judgeId][contestantId] =
        (judgeContestantTotals[judgeId][contestantId] || 0) + Number(scoreRow.score || 0);
    }

    const judgeRanksByContestant = {};
    Object.entries(judgeContestantTotals).forEach(([judgeId, totalsByContestant]) => {
      const sortedTotals = Object.entries(totalsByContestant)
        .map(([contestantId, total]) => ({ contestantId, total }))
        .sort((a, b) => b.total - a.total);

      let previousTotal = null;
      let previousRank = 0;
      sortedTotals.forEach((entry, index) => {
        const rank = index > 0 && entry.total === previousTotal ? previousRank : index + 1;
        if (!judgeRanksByContestant[entry.contestantId]) {
          judgeRanksByContestant[entry.contestantId] = {};
        }
        judgeRanksByContestant[entry.contestantId][judgeId] = rank;
        previousTotal = entry.total;
        previousRank = rank;
      });
    });

    const computed = contestantGroup.map((contestant) => {
      const contestantScores = groupScores.filter((s) => s.contestant_id === contestant.contestantId);
      const criteriaAverages = buildCriteriaAverages(criteriaRows, contestantScores);
      const weighted = buildWeightedDetails(criteriaAverages);
      const candidateRanks = Object.values(judgeRanksByContestant[contestant.contestantId] || {});
      const rankScoreRaw =
        candidateRanks.length > 0
          ? candidateRanks.reduce((sum, rank) => sum + rank, 0) / candidateRanks.length
          : Number.POSITIVE_INFINITY;

      return {
        ...contestant,
        scoringMode: 'RANKING',
        finalScore: null,
        finalPercentage: null,
        finalRating: null,
        rankScore: Number.isFinite(rankScoreRaw) ? round2(rankScoreRaw) : null,
        rankingTieBreaker: selectedTieBreaker,
        totalScore: Number.isFinite(rankScoreRaw) ? round2(rankScoreRaw) : 0,
        weightedScore: weighted.finalPercentage,
        judgeScores: buildJudgePercentages(contestantScores),
        criteriaBreakdown: weighted.criteriaBreakdown,
        judgeRanks: judgeRanksByContestant[contestant.contestantId] || {},
        _rankScoreComparable: rankScoreRaw,
      };
    });

    const compareByTieBreaker = (a, b) => {
      if (a._rankScoreComparable !== b._rankScoreComparable) {
        return a._rankScoreComparable - b._rankScoreComparable;
      }

      if (selectedTieBreaker === RANKING_TIE_BREAKERS.WEIGHTED_CRITERIA) {
        if (b.weightedScore !== a.weightedScore) {
          return b.weightedScore - a.weightedScore;
        }
      }

      if (selectedTieBreaker === RANKING_TIE_BREAKERS.JUDGE_PRIORITY && rankedJudgeIds.length > 0) {
        for (const judgeId of rankedJudgeIds) {
          const aRank = a.judgeRanks[judgeId] ?? Number.POSITIVE_INFINITY;
          const bRank = b.judgeRanks[judgeId] ?? Number.POSITIVE_INFINITY;
          if (aRank !== bRank) return aRank - bRank;
        }
      }

      return a.contestantNumber - b.contestantNumber;
    };

    const sorted = [...computed].sort(compareByTieBreaker);
    const ranked =
      selectedTieBreaker === RANKING_TIE_BREAKERS.KEEP_TIED
        ? assignStandardCompetitionRanks(sorted, (item) => item._rankScoreComparable)
        : sorted.map((item, index) => ({ ...item, rank: index + 1 }));

    return ranked.map(({ _rankScoreComparable, judgeRanks, ...publicResult }) => publicResult);
  };

  if (pageant.scoring_method === SCORING_MODES.RANKING_BY_GENDER) {
    const maleContestants = contestantBase.filter((contestant) => contestant.gender === 'Male');
    const femaleContestants = contestantBase.filter((contestant) => contestant.gender === 'Female');
    const excludedCount = contestantBase.length - maleContestants.length - femaleContestants.length;

    const maleResults = computeRankingResults(maleContestants);
    const femaleResults = computeRankingResults(femaleContestants);

    return res.json({
      scoringMode: 'RANKING_BY_GENDER',
      rankingTieBreaker: selectedTieBreaker,
      maleResults,
      femaleResults,
      maleWinner: maleResults[0] || null,
      femaleWinner: femaleResults[0] || null,
      warnings:
        excludedCount > 0
          ? [`${excludedCount} contestant(s) were excluded because gender is missing or invalid.`]
          : [],
    });
  }

  const response = computeRankingResults(contestantBase);
  return res.json(response);
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
