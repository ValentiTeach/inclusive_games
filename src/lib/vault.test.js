import { describe, it, expect } from 'vitest'
import {
  WrongPassphraseError,
  buildVault,
  openVault,
  rewrapVault,
  seal,
  unseal,
  isSealed,
} from './vault'

// Мало ітерацій лише для швидкості тестів; у продукті — 600 000.
const FAST = 1000
const PASS = 'довгий пароль фахівця'

describe('vault', () => {
  it('seals with the public key and opens only with the passphrase', async () => {
    const record = await buildVault(PASS, FAST)
    const sealed = await seal(record.public_key, { note: 'Тривожилась на початку' }, 'diary:kid-1')

    expect(isSealed(sealed)).toBe(true)
    // На сервері лежить шифротекст, а не текст.
    expect(sealed).not.toContain('Тривожилась')
    expect(record.wrapped_key).not.toContain(record.public_key)

    const key = await openVault(record, PASS)
    await expect(unseal(key, sealed, 'diary:kid-1')).resolves.toEqual({
      note: 'Тривожилась на початку',
    })
  })

  it('refuses a wrong passphrase', async () => {
    const record = await buildVault(PASS, FAST)
    await expect(openVault(record, 'зовсім інший пароль')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    )
  })

  it('binds a record to its context: moved to another child it does not open', async () => {
    const record = await buildVault(PASS, FAST)
    const key = await openVault(record, PASS)
    const sealed = await seal(record.public_key, { mood: 'sad' }, 'diary:kid-1')
    await expect(unseal(key, sealed, 'diary:kid-2')).rejects.toThrow()
  })

  it('every seal is different even for the same value', async () => {
    const record = await buildVault(PASS, FAST)
    const a = await seal(record.public_key, { mood: 'ok' })
    const b = await seal(record.public_key, { mood: 'ok' })
    expect(a).not.toBe(b)
  })

  it('a new passphrase keeps old records readable', async () => {
    const record = await buildVault(PASS, FAST)
    const sealed = await seal(record.public_key, { help: 'prompt' })
    const rewrapped = { ...record, ...(await rewrapVault(record, PASS, 'новий довгий пароль')) }

    await expect(openVault(rewrapped, PASS)).rejects.toBeInstanceOf(WrongPassphraseError)
    const key = await openVault(rewrapped, 'новий довгий пароль')
    await expect(unseal(key, sealed)).resolves.toEqual({ help: 'prompt' })
  })

  it('rejects a short passphrase', async () => {
    await expect(buildVault('коротко', FAST)).rejects.toThrow('passphrase_too_short')
  })
})
