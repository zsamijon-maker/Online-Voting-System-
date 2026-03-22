import { supabase } from '../lib/supabaseClient.js';

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

  const { data, error } = await supabase
    .from('criteria')
    .insert({
      pageant_id: req.params.pageantId,
      name,
      description: description || null,
      weight,
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
  if (weight !== undefined) updates.weight = weight;
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
