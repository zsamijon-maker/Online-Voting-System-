import { supabase } from '../lib/supabaseClient.js';
import { assertAdmin, isSelf } from '../lib/roleUtils.js';
import { logger } from '../lib/logger.js';

const STAFF_ROLES = new Set(['election_committee', 'pageant_committee', 'judge']);

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

  const { firstName, lastName, studentId, isActive, email, password } = req.body;
  const updates = {};

  // Prevent an admin from accidentally deactivating their own account.
  if (isActive === false && isSelf(req, req.params.id)) {
    return res.status(403).json({ error: 'You cannot deactivate your own account.' });
  }

  // Fetch user to check roles and current email
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('roles,email')
    .eq('id', req.params.id)
    .single();
  if (userError || !user) return res.status(404).json({ error: 'User not found.' });

  const roles = Array.isArray(user.roles) ? user.roles : [];
  const isVoterOnly = roles.length > 0 && roles.every((role) => role === 'voter');
  const isStaffUser = roles.some((role) => STAFF_ROLES.has(role));
  const isGmail = user.email && user.email.endsWith('@gmail.com');
  const emailChanged = email !== undefined && email !== user.email;

  // Role-based field constraints: voter-only users may update student_id but not email.
  if (!isVoterOnly && studentId !== undefined) {
    return res.status(400).json({ error: 'studentId can only be updated for voter-only users.' });
  }
  if (isVoterOnly && email !== undefined) {
    return res.status(400).json({ error: 'Email cannot be updated for voter users.' });
  }
  if (isGmail && email !== undefined && email !== user.email) {
    return res.status(400).json({ error: 'Email cannot be updated for Google-managed accounts.' });
  }
  if (password !== undefined && !isStaffUser) {
    return res.status(400).json({ error: 'Password updates are only allowed for election committee, pageant committee, and judge users.' });
  }
  if (password !== undefined && (typeof password !== 'string' || password.length < 8)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  if (firstName !== undefined) updates.first_name = firstName;
  if (lastName !== undefined) updates.last_name = lastName;
  if (studentId !== undefined && isVoterOnly) updates.student_id = studentId;
  if (isActive !== undefined) updates.is_active = isActive;
  if (email !== undefined && !isVoterOnly && !isGmail) {
    updates.email = email;
  }

  // Staff email changes require re-enrollment of TOTP using the new email.
  if (emailChanged && isStaffUser) {
    updates.totp_secret = null;
    updates.two_factor_enabled = false;
    updates.totp_rebind_required = false;
  }

  // Update auth.users using Supabase Admin API - ALWAYS sync names via user_metadata
  const authPayload = {};
  if (email !== undefined && !isVoterOnly && !isGmail) {
    authPayload.email = email;
  }
  if (password !== undefined && isStaffUser) {
    authPayload.password = password;
  }
  
  // CRITICAL: Always sync first_name/last_name to user_metadata for supabase.auth.getUser()
  const userMetadataUpdate = {};
  if (firstName !== undefined) userMetadataUpdate.first_name = firstName;
  if (lastName !== undefined) userMetadataUpdate.last_name = lastName;
  
  // Merge with existing metadata (preserve other fields like avatar_url)
  const { data: existingUser, error: existingUserError } = await supabase.auth.admin.getUserById(req.params.id);
  if (existingUserError || !existingUser?.user) {
    return res.status(404).json({ error: 'Auth user not found.' });
  }
  const currentMetadata = existingUser.user.user_metadata || {};
  const newMetadata = { ...currentMetadata, ...userMetadataUpdate };
  authPayload.user_metadata = newMetadata;

  if (Object.keys(authPayload).length > 0) {
    try {
      const { error: authError } = await supabase.auth.admin.updateUserById(
        req.params.id, 
        authPayload
      );
      if (authError) {
        logger.error(`Auth update failed for user ${req.params.id}:`, authError.message);
        return res.status(500).json({ error: 'Failed to sync auth user profile.' });
      }
      logger.info(`Auth user ${req.params.id} updated successfully (user_metadata: ${JSON.stringify(userMetadataUpdate)})`);
    } catch (err) {
      logger.error('Admin auth update error:', err);
      return res.status(500).json({ error: 'Failed to sync auth user profile.' });
    }
  }

  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) throw error;
  res.json(updated);
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
