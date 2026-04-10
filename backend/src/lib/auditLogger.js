import { supabase } from './supabaseClient.js';
import { logger } from './logger.js';

export const writeAuditLog = async ({
  req,
  action,
  entityType,
  entityId = null,
  oldValues = null,
  newValues = null,
}) => {
  try {
    await supabase.from('audit_logs').insert({
      user_id: req?.user?.id || null,
      user_name: req?.user?.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      ip_address: req?.ip || null,
      user_agent: req?.headers?.['user-agent'] || null,
    });
  } catch (error) {
    logger.warn('[audit] log write skipped:', error?.message || error);
  }
};