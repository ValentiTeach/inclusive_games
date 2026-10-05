import { describe, it, expect } from 'vitest'
import { contactHref } from './privacy'

describe('контакт відповідального за дані', () => {
  it('пошта стає mailto', () => {
    expect(contactHref('dpo@school.ua')).toBe('mailto:dpo@school.ua')
  })

  it('адреса сайту лишається посиланням', () => {
    expect(contactHref('https://school.ua/privacy')).toBe('https://school.ua/privacy')
  })

  it('телефон чи ім’я — без посилання', () => {
    expect(contactHref('+380 44 000 00 00')).toBeNull()
    expect(contactHref(null)).toBeNull()
  })
})
