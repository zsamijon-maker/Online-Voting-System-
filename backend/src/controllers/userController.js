import { supabase } from '../lib/supabaseClient.js';
import { assertAdmin, isSelf } from '../lib/roleUtils.js';

// GET /api/users
export const getUsers = async (req, res) => {
  const { role } = req.query;
  let query = supabase.from('users').select('*').order('created_at', { ascending: false });
  if (role) query = query.contains('roles', [role]);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
};

// GET /api/users/:id
export const getUserById = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'User not found.' });
  res.json(data);
};

// PATCH /api/users/:id
export const updateUser = async (req, res) => {
  // Defence-in-depth: verify admin role even though the route already guards it.
  if (assertAdmin(req, res)) return;

  const { firstName, lastName, studentId, isActive } = req.body;

  // Prevent an admin from accidentally deactivating their own account.
  if (isActive === false && isSelf(req, req.params.id)) {
    return res.status(403).json({ error: 'You cannot deactivate your own account.' });
  }

  const updates = {};
  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (studentId !== undefined) updates.student_id = studentId;
  if (isActive !== undefined) updates.is_active = isActive;
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw error;
  res.json(data);
};

// PATCH /api/users/:id/roles
export const updateUserRoles = async (req, res) => {
  // Defence-in-depth: verify admin role.
  if (assertAdmin(req, res)) return;

  const { roles } = req.body;
  if (!Array.isArray(roles)) return res.status(400).json({ error: 'roles must be an array.' });

  // Prevent an admin from editing their own roles (avoids accidental self-lockout).
  if (isSelf(req, req.params.id)) {
    return res.status(403).json({ error: 'Admins cannot modify their own roles. Contact another admin.' });
  }

  const { data, error } = await supabase
    .from('users')
    .update({ roles, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw error;
  res.json(data);
};

// DELETE /api/users/:id
export const deleteUser = async (req, res) => {
  // Defence-in-depth: verify admin role.
  if (assertAdmin(req, res)) return;

  // Prevent an admin from deleting their own account (prevents lockout).
  if (isSelf(req, req.params.id)) {
    return res.status(403).json({ error: 'Admins cannot delete their own account.' });
  }

  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) throw error;
  res.json({ message: 'User deleted.' });
};

// GET /api/users/me
export const getMe = async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', req.user.id)
    .single();
  if (error) return res.status(404).json({ error: 'User not found.' });
  res.json(data);
};
