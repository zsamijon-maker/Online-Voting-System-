import type { User, UserRole } from '@/types';
import { api, camelize } from '@/lib/api';

/**
 * User Service  backed by Node.js + Supabase API
 */

export async function getAllUsers(): Promise<User[]> {
  const data = await api.get<unknown[]>('/api/users');
  return camelize<User[]>(data);
}

export async function getUsersByRole(role: UserRole): Promise<User[]> {
  const data = await api.get<unknown[]>(`/api/users?role=${role}`);
  return camelize<User[]>(data);
}

export async function getUserById(id: string): Promise<User | null> {
  try {
    const data = await api.get<unknown>(`/api/users/${id}`);
    return camelize<User>(data);
  } catch {
    return null;
  }
}

export async function createUser(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  studentId?: string;
  roles?: UserRole[];
}): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const data = await api.post<unknown>('/api/auth/register', userData);
    return { success: true, user: camelize<User>(data) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateUser(
  id: string,
  updates: Partial<User>
): Promise<{ success: boolean; error?: string; user?: User }> {
  try {
    const data = await api.patch<unknown>(`/api/users/${id}`, updates);
    return { success: true, user: camelize<User>(data) };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await api.delete(`/api/users/${id}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setUserActive(
  id: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  return updateUser(id, { isActive } as Partial<User>);
}

export async function assignRole(
  id: string,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserById(id);
    if (!user) return { success: false, error: 'User not found' };
    if (user.roles.includes(role)) return { success: false, error: 'User already has this role' };
    const newRoles = [...user.roles, role];
    await api.patch(`/api/users/${id}/roles`, { roles: newRoles });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function removeRole(
  id: string,
  role: UserRole
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getUserById(id);
    if (!user) return { success: false, error: 'User not found' };
    if (!user.roles.includes(role)) return { success: false, error: 'User does not have this role' };
    if (user.roles.length === 1) return { success: false, error: 'User must have at least one role' };
    const newRoles = user.roles.filter(r => r !== role);
    await api.patch(`/api/users/${id}/roles`, { roles: newRoles });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function searchUsers(query: string): Promise<User[]> {
  const all = await getAllUsers();
  const q = query.toLowerCase();
  return all.filter(
    u =>
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.studentId?.toLowerCase().includes(q)
  );
}

export async function getUserStatistics(): Promise<{
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: Record<UserRole, number>;
  newUsersThisMonth: number;
}> {
  const users = await getAllUsers();
  const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const usersByRole: Record<UserRole, number> = {
    admin: 0, voter: 0, election_committee: 0, pageant_committee: 0, judge: 0,
  };
  users.forEach(u => u.roles.forEach(r => { usersByRole[r] = (usersByRole[r] || 0) + 1; }));
  return {
    totalUsers: users.length,
    activeUsers: users.filter(u => u.isActive).length,
    inactiveUsers: users.filter(u => !u.isActive).length,
    usersByRole,
    newUsersThisMonth: users.filter(u => new Date(u.createdAt) >= monthAgo).length,
  };
}
