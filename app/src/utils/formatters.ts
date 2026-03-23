/**
 * Formatting Utility Functions
 */

// Format date to readable string
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  };
  return d.toLocaleDateString('en-US', defaultOptions);
}

// Format date and time
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format time only
export function formatTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format relative time (e.g., "2 hours ago")
export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return formatDate(d);
}

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value.toFixed(decimals)}%`;
}

// Format currency
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

// Format score with max decimal places
export function formatScore(score: number, decimals: number = 2): string {
  return score.toFixed(decimals);
}

// Format user name (first + last)
export function formatUserName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`;
}

// Format role name for display
export function formatRoleName(role: string): string {
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Format election status for display
export function formatElectionStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    upcoming: 'Upcoming',
    active: 'Active',
    closed: 'Closed',
    archived: 'Archived',
  };
  return statusMap[status] || status;
}

// Format pageant status for display
export function formatPageantStatus(status: string): string {
  const statusMap: Record<string, string> = {
    draft: 'Draft',
    upcoming: 'Upcoming',
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  };
  return statusMap[status] || status;
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// Format phone number (basic)
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// Get initials from name
export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// Format election type
export function formatElectionType(type: string): string {
  const typeMap: Record<string, string> = {
    student_government: 'Student Government',
    class_representative: 'Class Representative',
    club_officers: 'Club Officers',
    other: 'Other',
  };
  return typeMap[type] || type;
}

// Format scoring method
export function formatScoringMethod(method: string): string {
  const methodMap: Record<string, string> = {
    average: 'Average',
    weighted: 'Weighted',
    ranking: 'Ranking',
    ranking_by_gender: 'Ranking by Gender',
  };
  return methodMap[method] || method;
}
