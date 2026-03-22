import { supabase } from '../lib/supabaseClient.js';

// GET /api/audit
export const getAuditLogs = async (req, res) => {
  const { userId, entityType, entityId, action, startDate, endDate, page = 1, limit = 50, search } = req.query;

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (userId) query = query.eq('user_id', userId);
  if (entityType) query = query.eq('entity_type', entityType);
  if (entityId) query = query.eq('entity_id', entityId);
  if (action) query = query.eq('action', action);
  if (startDate) query = query.gte('created_at', startDate);
  if (endDate) query = query.lte('created_at', endDate);
  if (search) query = query.or(`action.ilike.%${search}%,user_name.ilike.%${search}%,entity_type.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) throw error;

  res.json({
    logs: data,
    total: count,
    totalPages: Math.ceil(count / limit),
    page: Number(page),
  });
};

// POST /api/audit  — internal use: add entry
export const addAuditLog = async (req, res) => {
  const { userId, userName, action, entityType, entityId, oldValues, newValues } = req.body;
  if (!action || !entityType) {
    return res.status(400).json({ error: 'action and entityType are required.' });
  }

  const { data, error } = await supabase
    .from('audit_logs')
    .insert({
      user_id: userId || req.user?.id,
      user_name: userName,
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      old_values: oldValues || null,
      new_values: newValues || null,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
};
