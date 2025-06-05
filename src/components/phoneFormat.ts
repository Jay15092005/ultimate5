// Utility to format phone numbers to E.164 (+91XXXXXXXXXX)
export function toE164(phone: string, countryCode: string = '+91'): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');
  // Remove leading 0 or 91 if present
  if (digits.startsWith('91')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Ensure 10 digits
  if (digits.length !== 10) throw new Error('Invalid phone number');
  return `${countryCode}${digits}`;
} 