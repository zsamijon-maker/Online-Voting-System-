/**
 * Hash Utility Functions
 * 
 * These functions provide cryptographic hashing for vote and score integrity.
 * In production, these would use server-side hashing with secret keys.
 */

/**
 * Generate a SHA-256 hash of the input string
 */
export async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a vote hash for integrity verification
 * Format: voterId + candidateId + timestamp + electionId
 */
export async function generateVoteHash(
  voterId: string,
  candidateId: string,
  electionId: string,
  timestamp: string
): Promise<string> {
  const message = `${voterId}:${candidateId}:${electionId}:${timestamp}`;
  return sha256(message);
}

/**
 * Generate a score hash for integrity verification
 * Format: judgeId + contestantId + criteriaId + score + timestamp
 */
export async function generateScoreHash(
  judgeId: string,
  contestantId: string,
  criteriaId: string,
  score: number,
  timestamp: string
): Promise<string> {
  const message = `${judgeId}:${contestantId}:${criteriaId}:${score}:${timestamp}`;
  return sha256(message);
}

/**
 * Generate a simple hash for demo purposes (synchronous)
 * Note: In production, use the async sha256 function
 */
export function generateSimpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * Verify vote hash integrity
 */
export async function verifyVoteHash(
  hash: string,
  voterId: string,
  candidateId: string,
  electionId: string,
  timestamp: string
): Promise<boolean> {
  const expectedHash = await generateVoteHash(voterId, candidateId, electionId, timestamp);
  return hash === expectedHash;
}

/**
 * Verify score hash integrity
 */
export async function verifyScoreHash(
  hash: string,
  judgeId: string,
  contestantId: string,
  criteriaId: string,
  score: number,
  timestamp: string
): Promise<boolean> {
  const expectedHash = await generateScoreHash(judgeId, contestantId, criteriaId, score, timestamp);
  return hash === expectedHash;
}
