import type { AuditLog } from '@/types';
import { api, camelize } from '@/lib/api';

/**
 * Audit Service - backed by Node.js + Supabase API
 */

export async function getAllAuditLogs(): Promise<AuditLog[]> {
  const res = await api.get<{ logs: unknown[] }>('/api/audit');
  return camelize<AuditLog[]>(res.logs);
}

export async function getAuditLogsPaginated(
  page = 1,
  limit = 50
): Promise<{ logs: AuditLog[]; total: number; totalPages: number }> {
  const res = await api.get<{ logs: unknown[]; total: number; totalPages: number }>(
    `/api/audit?page=${page}&limit=${limit}`
  );
  return { logs: camelize<AuditLog[]>(res.logs), total: res.total, totalPages: res.totalPages };
}

export async function getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
  const res = await api.get<{ logs: unknown[] }>(`/api/audit?userId=${userId}`);
  return camelize<AuditLog[]>(res.logs);
}

export async function getAuditLogsByEntity(
  entityType: AuditLog['entityType'],
  entityId?: string
): Promise<AuditLog[]> {
  const params = entityId
    ? `entityType=${entityType}&entityId=${entityId}`
    : `entityType=${entityType}`;
  const res = await api.get<{ logs: unknown[] }>(`/api/audit?${params}`);
  return camelize<AuditLog[]>(res.logs);
}

export async function getAuditLogsByAction(action: string): Promise<AuditLog[]> {
  const res = await api.get<{ logs: unknown[] }>(`/api/audit?action=${action}`);
  return camelize<AuditLog[]>(res.logs);
}

export async function getAuditLogsByDateRange(
  startDate: string,
  endDate: string
): Promise<AuditLog[]> {
  const res = await api.get<{ logs: unknown[] }>(
    `/api/audit?startDate=${startDate}&endDate=${endDate}`
  );
  return camelize<AuditLog[]>(res.logs);
}

export async function searchAuditLogs(query: string): Promise<AuditLog[]> {
  const res = await api.get<{ logs: unknown[] }>(`/api/audit?search=${encodeURIComponent(query)}`);
  return camelize<AuditLog[]>(res.logs);
}

export async function addAuditLog(
  log: Omit<AuditLog, 'id' | 'createdAt'>
): Promise<AuditLog> {
  const data = await api.post<unknown>('/api/audit', log);
  return camelize<AuditLog>(data);
}

export async function getAuditStatistics(): Promise<{
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  actionCounts: Record<string, number>;
  entityTypeCounts: Record<string, number>;
}> {
  const logs = await getAllAuditLogs();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const actionCounts: Record<string, number> = {};
  const entityTypeCounts: Record<string, number> = {};
  let logsToday = 0, logsThisWeek = 0, logsThisMonth = 0;
  logs.forEach(log => {
    const d = new Date(log.createdAt);
    if (d >= today) logsToday++;
    if (d >= weekAgo) logsThisWeek++;
    if (d >= monthAgo) logsThisMonth++;
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    entityTypeCounts[log.entityType] = (entityTypeCounts[log.entityType] || 0) + 1;
  });
  return { totalLogs: logs.length, logsToday, logsThisWeek, logsThisMonth, actionCounts, entityTypeCounts };
}

export function exportAuditLogs(logs: AuditLog[], format: 'json' | 'csv' = 'json'): string {
  if (format === 'csv') {
    const headers = ['ID', 'Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID'];
    const rows = logs.map(l => [l.id, l.createdAt, l.userName || 'System', l.action, l.entityType, l.entityId || '']);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
  return JSON.stringify(logs, null, 2);
}
