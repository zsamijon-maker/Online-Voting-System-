import type { Election, Pageant } from '@/types';

/**
 * Validation Utility Functions
 */

// Email validation
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Password validation (min 8 chars, at least 1 uppercase, 1 lowercase, 1 number)
export function isValidPassword(password: string): boolean {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}

// Student ID validation (format: YYYY-XXXXX)
export function isValidStudentId(studentId: string): boolean {
  const studentIdRegex = /^\d{4}-\d{5}$/;
  return studentIdRegex.test(studentId);
}

// Check if election is active (within voting time window)
export function isElectionActive(election: Election): boolean {
  const now = new Date();
  const startDate = new Date(election.startDate);
  const endDate = new Date(election.endDate);
  return election.status === 'active' && now >= startDate && now <= endDate;
}

// Check if pageant is active
export function isPageantActive(pageant: Pageant): boolean {
  return pageant.status === 'active';
}

// Check if date is in the future
export function isFutureDate(date: string): boolean {
  return new Date(date) > new Date();
}

// Check if date range is valid (end > start)
export function isValidDateRange(startDate: string, endDate: string): boolean {
  return new Date(endDate) > new Date(startDate);
}

// Validate score range
export function isValidScore(score: number, maxScore: number): boolean {
  return score >= 0 && score <= maxScore;
}

// Validate weight sum (should equal 100 for weighted scoring)
export function validateWeights(weights: number[]): { valid: boolean; total: number } {
  const total = weights.reduce((sum, w) => sum + w, 0);
  return { valid: Math.abs(total - 100) < 0.01, total };
}

// Sanitize string input (basic XSS prevention)
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim();
}

// Check if value is empty (null, undefined, empty string, empty array)
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// Validate required fields
export function validateRequired(
  data: Record<string, unknown>,
  requiredFields: string[]
): { valid: boolean; missing: string[] } {
  const missing = requiredFields.filter(field => isEmpty(data[field]));
  return { valid: missing.length === 0, missing };
}

// Validate file type
export function isValidImageType(fileType: string): boolean {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  return validTypes.includes(fileType);
}

// Validate file size (max 5MB)
export function isValidFileSize(fileSize: number, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return fileSize <= maxSizeBytes;
}
