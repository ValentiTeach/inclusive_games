/**
 * Куди писати про дані дитини — адреса відповідального за платформу.
 *
 * Береться з VITE_PRIVACY_CONTACT (див. .env.example), а не пишеться в код:
 * у кожного розгортання (школа, центр, мережа) своя відповідальна особа, і
 * адреса розробника на чужому сайті була б неправдою.
 *
 * Без змінної сторінки чесно кажуть «через педагога» — і не вигадують адреси.
 */
export const PRIVACY_CONTACT = (import.meta.env.VITE_PRIVACY_CONTACT ?? '').trim() || null

/** Посилання для контакту: пошта — mailto, адреса сайту — як є, решта — без посилання. */
export function contactHref(contact) {
  if (!contact) return null
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return `mailto:${contact}`
  if (/^https?:\/\//.test(contact)) return contact
  return null
}
