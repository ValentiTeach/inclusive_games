import { PRIVACY_CONTACT, contactHref } from '../../lib/privacy'

/** Контакт відповідального за дані — посиланням, якщо це пошта чи сайт. */
function PrivacyContact({ contact = PRIVACY_CONTACT, fallback }) {
  if (!contact) return fallback
  const href = contactHref(contact)
  return href ? <a href={href}>{contact}</a> : <span>{contact}</span>
}

export default PrivacyContact
