import { supabase } from '../lib/supabaseClient.js';

const parseWeight = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

const getCurrentCriteriaWeightTotal = async (pageantId, excludeCriteriaId) => {
  let query = supabase
    .from('criteria')
    .select('weight')
    .eq('pageant_id', pageantId);

  if (excludeCriteriaId) {
    query = query.neq('id', excludeCriteriaId);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).reduce((sum, row) => sum + Number(row.weight || 0), 0);
};

// GET /api/pageants/:pageantId/criteria
export const getCriteria = async (req, res) => {
  const { data, error } = await supabase
    .from('criteria')
    .select('*')
    .eq('pageant_id', req.params.pageantId)
    .order('display_order');
  if (error) throw error;
  res.json(data);
};

// POST /api/pageants/:pageantId/criteria
export const createCriteria = async (req, res) => {
  const { name, description, weight, maxScore, displayOrder } = req.body;
  if (!name || weight === undefined || !maxScore) {
    return res.status(400).json({ error: 'name, weight, and maxScore are required.' });
  }

  const parsedWeight = parseWeight(weight);
  if (parsedWeight === null || parsedWeight <= 0) {
    return res.status(400).json({ error: 'weight must be a positive number.' });
  }

  const currentTotal = await getCurrentCriteriaWeightTotal(req.params.pageantId);
  const nextTotal = currentTotal + parsedWeight;
  if (nextTotal > 100) {
    return res.status(400).json({
      error: `Cannot add criteria. Total weight would be ${nextTotal.toFixed(2)}%, which is greater than 100%.`,
    });
  }

  const { data, error } = await supabase
    .from('criteria')
    .insert({
      pageant_id: req.params.pageantId,
      name,
      description: description || null,
      weight: parsedWeight,
      max_score: maxScore,
      display_order: displayOrder ?? 0,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
};

// PATCH /api/pageants/:pageantId/criteria/:id
export const updateCriteria = async (req, res) => {
  const { name, description, weight, maxScore, displayOrder, isActive } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (weight !== undefined) {
    const parsedWeight = parseWeight(weight);
    if (parsedWeight === null || parsedWeight <= 0) {
      return res.status(400).json({ error: 'weight must be a positive number.' });
    }

    const currentTotal = await getCurrentCriteriaWeightTotal(req.params.pageantId, req.params.id);
    const nextTotal = currentTotal + parsedWeight;
    if (nextTotal > 100) {
      return res.status(400).json({
        error: `Cannot update criteria. Total weight would be ${nextTotal.toFixed(2)}%, which is greater than 100%.`,
      });
    }

    updates.weight = parsedWeight;
  }
  if (maxScore !== undefined) updates.max_score = maxScore;
  if (displayOrder !== undefined) updates.display_order = displayOrder;
  if (isActive !== undefined) updates.is_active = isActive;

  const { data, error } = await supabase
    .from('criteria')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
};

// DELETE /api/pageants/:pageantId/criteria/:id
export const deleteCriteria = async (req, res) => {
  const { error } = await supabase.from('criteria').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'Criteria deleted.' });
};
