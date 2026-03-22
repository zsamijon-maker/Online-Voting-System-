import type {
  Pageant, Contestant, Criteria, PageantJudge, Score, PageantResult,
  PageantFormData, ContestantFormData, CriteriaFormData, ScoreFormData, User,
} from '@/types';
import { api, camelize } from '@/lib/api';

/**
 * Pageant Service - backed by Node.js + Supabase API
 */

// -- Pageants --

export async function getAllPageants(): Promise<Pageant[]> {
  const data = await api.get<unknown[]>('/api/pageants');
  return camelize<Pageant[]>(data);
}

export async function getPageantsByStatus(status: Pageant['status']): Promise<Pageant[]> {
  const data = await api.get<unknown[]>(`/api/pageants?status=${status}`);
  return camelize<Pageant[]>(data);
}

export async function getActivePageants(): Promise<Pageant[]> {
  return getPageantsByStatus('active');
}

export async function getJudgePageants(_judgeId: string): Promise<Pageant[]> {
  const data = await api.get<unknown[]>('/api/pageants?assignedToMe=true');
  return camelize<Pageant[]>(data);
}

export async function getPageantById(id: string): Promise<Pageant | null> {
  try {
    const data = await api.get<unknown>(`/api/pageants/${id}`);
    return camelize<Pageant>(data);
  } catch { return null; }
}

export async function createPageant(pageantData: PageantFormData, _createdBy: string): Promise<Pageant> {
  const data = await api.post<unknown>('/api/pageants', pageantData);
  return camelize<Pageant>(data);
}

export async function updatePageant(id: string, updates: Partial<Pageant>): Promise<Pageant | null> {
  try {
    const data = await api.patch<unknown>(`/api/pageants/${id}`, updates);
    return camelize<Pageant>(data);
  } catch { return null; }
}

export async function deletePageant(id: string): Promise<boolean> {
  try { await api.delete(`/api/pageants/${id}`); return true; } catch { return false; }
}

export async function startPageant(id: string): Promise<Pageant | null> {
  try {
    const data = await api.patch<unknown>(`/api/pageants/${id}/status`, { status: 'active' });
    return camelize<Pageant>(data);
  } catch { return null; }
}

export async function completePageant(id: string): Promise<Pageant | null> {
  try {
    const data = await api.patch<unknown>(`/api/pageants/${id}/status`, { status: 'completed' });
    return camelize<Pageant>(data);
  } catch { return null; }
}

export async function publishPageantResults(id: string): Promise<Pageant | null> {
  return updatePageant(id, { resultsPublic: true } as Partial<Pageant>);
}

// -- Contestants --

export async function getContestantsByPageant(pageantId: string): Promise<Contestant[]> {
  const data = await api.get<unknown[]>(`/api/pageants/${pageantId}/contestants`);
  return camelize<Contestant[]>(data);
}

export async function getContestantById(id: string): Promise<Contestant | null> {
  try {
    const data = await api.get<unknown>(`/api/pageants/any/contestants/${id}`);
    return camelize<Contestant>(data);
  } catch { return null; }
}

export async function addContestant(pageantId: string, contestantData: ContestantFormData): Promise<Contestant> {
  if (contestantData.imageFile) {
    const form = new FormData();
    form.append('contestantNumber', String(contestantData.contestantNumber));
    form.append('firstName', contestantData.firstName);
    form.append('lastName', contestantData.lastName);
    form.append('bio', contestantData.bio ?? '');
    form.append('age', contestantData.age ? String(contestantData.age) : '');
    form.append('department', contestantData.department ?? '');
    form.append('photoUrl', contestantData.photoUrl ?? '');
    form.append('image', contestantData.imageFile);

    const data = await api.postForm<unknown>(`/api/pageants/${pageantId}/contestants`, form);
    return camelize<Contestant>(data);
  }

  const data = await api.post<unknown>(`/api/pageants/${pageantId}/contestants`, contestantData);
  return camelize<Contestant>(data);
}

export async function updateContestant(id: string, pageantId: string, updates: Partial<Contestant> & { imageFile?: File }): Promise<Contestant | null> {
  try {
    if (updates.imageFile) {
      const form = new FormData();
      if (updates.contestantNumber !== undefined) form.append('contestantNumber', String(updates.contestantNumber));
      if (updates.firstName !== undefined) form.append('firstName', updates.firstName);
      if (updates.lastName !== undefined) form.append('lastName', updates.lastName);
      if (updates.bio !== undefined) form.append('bio', updates.bio ?? '');
      if (updates.age !== undefined) form.append('age', updates.age ? String(updates.age) : '');
      if (updates.department !== undefined) form.append('department', updates.department ?? '');
      if (updates.photoUrl !== undefined) form.append('photoUrl', updates.photoUrl ?? '');
      if (updates.isActive !== undefined) form.append('isActive', String(updates.isActive));
      form.append('image', updates.imageFile);

      const data = await api.patchForm<unknown>(`/api/pageants/${pageantId}/contestants/${id}`, form);
      return camelize<Contestant>(data);
    }

    const data = await api.patch<unknown>(`/api/pageants/${pageantId}/contestants/${id}`, updates);
    return camelize<Contestant>(data);
  } catch { return null; }
}

export async function removeContestant(id: string, pageantId: string): Promise<boolean> {
  try { await api.patch(`/api/pageants/${pageantId}/contestants/${id}`, { isActive: false }); return true; } catch { return false; }
}

// -- Criteria --

export async function getCriteriaByPageant(pageantId: string): Promise<Criteria[]> {
  const data = await api.get<unknown[]>(`/api/pageants/${pageantId}/criteria`);
  return camelize<Criteria[]>(data);
}

export async function addCriteria(pageantId: string, criteriaData: CriteriaFormData): Promise<Criteria> {
  const data = await api.post<unknown>(`/api/pageants/${pageantId}/criteria`, criteriaData);
  return camelize<Criteria>(data);
}

export async function updateCriteria(id: string, pageantId: string, updates: Partial<Criteria>): Promise<Criteria | null> {
  try {
    const data = await api.patch<unknown>(`/api/pageants/${pageantId}/criteria/${id}`, updates);
    return camelize<Criteria>(data);
  } catch { return null; }
}

export async function removeCriteria(id: string, pageantId: string): Promise<boolean> {
  try { await api.delete(`/api/pageants/${pageantId}/criteria/${id}`); return true; } catch { return false; }
}

export async function validateCriteriaWeights(pageantId: string): Promise<{ valid: boolean; total: number }> {
  const criteria = await getCriteriaByPageant(pageantId);
  const total = criteria.reduce((sum, c) => sum + c.weight, 0);
  return { valid: Math.abs(total - 100) < 0.01, total };
}

// -- Judges --

export async function getPageantJudges(pageantId: string): Promise<PageantJudge[]> {
  const data = await api.get<unknown[]>(`/api/pageants/${pageantId}/judges`);
  return camelize<PageantJudge[]>(data);
}

export async function isPageantJudge(pageantId: string, userId: string): Promise<boolean> {
  const judges = await getPageantJudges(pageantId);
  return judges.some(j => j.judgeId === userId);
}

export async function assignJudge(pageantId: string, judgeId: string, _judgeName: string, _assignedBy: string): Promise<PageantJudge> {
  const data = await api.post<unknown>(`/api/pageants/${pageantId}/judges`, { judgeId });
  return camelize<PageantJudge>(data);
}

export async function getAssignableJudges(pageantId: string): Promise<User[]> {
  const data = await api.get<unknown[]>(`/api/pageants/${pageantId}/judges/available`);
  return camelize<User[]>(data);
}

export async function assignJudgesBulk(
  pageantId: string,
  judgeIds: string[],
): Promise<{ assigned: PageantJudge[]; assignedCount: number; invalidJudgeIds: string[] }> {
  const data = await api.post<unknown>(`/api/pageants/${pageantId}/judges/bulk`, { judgeIds });
  return camelize<{ assigned: PageantJudge[]; assignedCount: number; invalidJudgeIds: string[] }>(data);
}

export async function removeJudgeAssignment(pageantId: string, judgeId: string): Promise<boolean> {
  try { await api.delete(`/api/pageants/${pageantId}/judges/${judgeId}`); return true; } catch { return false; }
}

// -- Scores --

export async function getJudgeScores(pageantId: string, contestantId: string, _judgeId: string): Promise<Score[]> {
  const data = await api.get<unknown[]>(`/api/scores/pageants/${pageantId}/my-scores`);
  const all = camelize<Score[]>(data);
  return all.filter(s => s.contestantId === contestantId);
}

export async function submitScores(
  pageantId: string,
  contestantId: string,
  _judgeId: string,
  scores: ScoreFormData['scores']
): Promise<{ success: boolean; error?: string; submittedCount?: number }> {
  try {
    const data = await api.post<unknown[]>('/api/scores', { pageantId, contestantId, scores });
    return { success: true, submittedCount: (data as unknown[]).length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function hasJudgeScoredContestant(pageantId: string, contestantId: string, judgeId: string): Promise<boolean> {
  const criteria = await getCriteriaByPageant(pageantId);
  const scores = await getJudgeScores(pageantId, contestantId, judgeId);
  return criteria.every(c => scores.some(s => s.criteriaId === c.id));
}

// -- Results --

export async function getPageantResults(pageantId: string): Promise<PageantResult[]> {
  const data = await api.get<unknown[]>(`/api/scores/pageants/${pageantId}/results`);
  return camelize<PageantResult[]>(data);
}

export async function getPageantWinner(pageantId: string): Promise<PageantResult | null> {
  const results = await getPageantResults(pageantId);
  return results.length > 0 ? results[0] : null;
}

export async function getContestantRank(pageantId: string, contestantId: string): Promise<number> {
  const results = await getPageantResults(pageantId);
  return results.find(r => r.contestantId === contestantId)?.rank || 0;
}
