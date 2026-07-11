const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function extractEmailFromContactInfo(contactInfo?: string | null): string {
  if (!contactInfo) return '';
  const trimmed = contactInfo.trim();
  return isValidEmail(trimmed) ? trimmed : '';
}
