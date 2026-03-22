import type { Election, Candidate, Vote, ElectionResult, ElectionFormData, CandidateFormData, ElectionPosition } from '@/types';
import { api, camelize } from '@/lib/api';

/**
 * Election Service — backed by Node.js + Supabase API
 */

// ── Elections ────────────────────────────────────────────

export async function getAllElections(): Promise<Election[]> {
  const data = await api.get<unknown[]>('/api/elections');
  return camelize<Election[]>(data);
}

export async function getElectionsByStatus(status: Election['status']): Promise<Election[]> {
  const data = await api.get<unknown[]>(`/api/elections?status=${status}`);
  return camelize<Election[]>(data);
}

export async function getActiveElections(): Promise<Election[]> {
  return getElectionsByStatus('active');
}

export async function getElectionById(id: string): Promise<Election | null> {
  try {
    const data = await api.get<unknown>(`/api/elections/${id}`);
    return camelize<Election>(data);
  } catch {
    return null;
  }
}

export async function createElection(electionData: ElectionFormData, _createdBy: string): Promise<Election> {
  const data = await api.post<unknown>('/api/elections', electionData);
  return camelize<Election>(data);
}

export async function updateElection(id: string, updates: Partial<Election>): Promise<Election | null> {
  try {
    const data = await api.patch<unknown>(`/api/elections/${id}`, updates);
    return camelize<Election>(data);
  } catch {
    return null;
  }
}

export async function deleteElection(id: string): Promise<boolean> {
  try {
    await api.delete(`/api/elections/${id}`);
    return true;
  } catch {
    return false;
  }
}

export async function openElection(id: string): Promise<Election | null> {
  try {
    const data = await api.patch<unknown>(`/api/elections/${id}/status`, { status: 'active' });
    return camelize<Election>(data);
  } catch {
    return null;
  }
}

export async function closeElection(id: string): Promise<Election | null> {
  try {
    const data = await api.patch<unknown>(`/api/elections/${id}/status`, { status: 'closed' });
    return camelize<Election>(data);
  } catch {
    return null;
  }
}

export async function publishResults(id: string): Promise<Election | null> {
  return updateElection(id, { resultsPublic: true } as Partial<Election>);
}

// ── Candidates ───────────────────────────────────────────

export async function getCandidatesByElection(electionId: string): Promise<Candidate[]> {
  const data = await api.get<unknown[]>(`/api/elections/${electionId}/candidates`);
  return camelize<Candidate[]>(data);
}

export async function getCandidatesByPosition(electionId: string, position: string): Promise<Candidate[]> {
  const candidates = await getCandidatesByElection(electionId);
  return candidates.filter(c => c.position === position && c.isActive);
}

export async function getElectionPositions(electionId: string): Promise<ElectionPosition[]> {
  const data = await api.get<unknown[]>(`/api/elections/${electionId}/positions`);
  return camelize<ElectionPosition[]>(data);
}

export async function addCandidate(electionId: string, candidateData: CandidateFormData): Promise<Candidate> {
  if (candidateData.imageFile) {
    const form = new FormData();
    form.append('positionId', candidateData.positionId);
    form.append('displayName', candidateData.displayName);
    form.append('bio', candidateData.bio ?? '');
    form.append('platform', candidateData.platform ?? '');
    form.append('photoUrl', candidateData.photoUrl ?? '');
    form.append('isWriteIn', String(candidateData.isWriteIn));
    form.append('image', candidateData.imageFile);

    const data = await api.postForm<unknown>(`/api/elections/${electionId}/candidates`, form);
    return camelize<Candidate>(data);
  }

  const data = await api.post<unknown>(`/api/elections/${electionId}/candidates`, candidateData);
  return camelize<Candidate>(data);
}

export async function updateCandidate(id: string, electionId: string, updates: Partial<Candidate> & { imageFile?: File }): Promise<Candidate | null> {
  try {
    if (updates.imageFile) {
      const form = new FormData();
      if (updates.positionId !== undefined) form.append('positionId', updates.positionId);
      if (updates.displayName !== undefined) form.append('displayName', updates.displayName);
      if (updates.bio !== undefined) form.append('bio', updates.bio ?? '');
      if (updates.platform !== undefined) form.append('platform', updates.platform ?? '');
      if (updates.photoUrl !== undefined) form.append('photoUrl', updates.photoUrl ?? '');
      if (updates.isWriteIn !== undefined) form.append('isWriteIn', String(updates.isWriteIn));
      if (updates.isActive !== undefined) form.append('isActive', String(updates.isActive));
      form.append('image', updates.imageFile);

      const data = await api.patchForm<unknown>(`/api/elections/${electionId}/candidates/${id}`, form);
      return camelize<Candidate>(data);
    }

    const data = await api.patch<unknown>(`/api/elections/${electionId}/candidates/${id}`, updates);
    return camelize<Candidate>(data);
  } catch {
    return null;
  }
}

export async function removeCandidate(id: string, electionId: string): Promise<boolean> {
  try {
    await api.patch(`/api/elections/${electionId}/candidates/${id}`, { isActive: false });
    return true;
  } catch {
    return false;
  }
}

// ── Voting ───────────────────────────────────────────────

export async function hasVoted(electionId: string, _voterId: string, position: string): Promise<boolean> {
  try {
    const votes = await api.get<{ position: string }[]>(`/api/votes/elections/${electionId}/my-votes`);
    return votes.some(v => v.position === position);
  } catch {
    return false;
  }
}

export async function getUserVotes(electionId: string, _voterId: string): Promise<Vote[]> {
  const data = await api.get<unknown[]>(`/api/votes/elections/${electionId}/my-votes`);
  return camelize<Vote[]>(data);
}

export async function castVote(
  electionId: string,
  _voterId: string,
  candidateId: string,
  position: string
): Promise<{ success: boolean; error?: string; vote?: Vote }> {
  try {
    const data = await api.post<{ message: string; voteHash: string }>('/api/votes', {
      electionId, candidateId, position,
    });
    return { success: true, vote: { voteHash: data.voteHash } as unknown as Vote };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// ── Results ──────────────────────────────────────────────

export async function getElectionResults(electionId: string): Promise<ElectionResult[]> {
  const data = await api.get<unknown[]>(`/api/votes/elections/${electionId}/results`);
  return camelize<ElectionResult[]>(data);
}

export async function getPositionWinner(
  electionId: string,
  position: string
): Promise<{ candidateId: string; displayName: string; voteCount: number } | null> {
  const results = await getElectionResults(electionId);
  const positionResult = results.find(r => r.position === position);
  if (!positionResult || positionResult.candidates.length === 0) return null;
  const winner = positionResult.candidates[0];
  return { candidateId: winner.candidateId, displayName: winner.displayName, voteCount: winner.voteCount };
}
