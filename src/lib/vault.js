import { useSyncExternalStore } from 'react'
import { supabase } from './supabaseClient'
import { isMissingTable } from './assignments'

/**
 * Захищений щоденник фахівця: шифрування в браузері, ключ — лише в фахівця.
 *
 * Що шифрується: нотатки й позначки щоденника, настрій дитини до й після
 * заняття, її відповідь «як тобі було». Це найчутливіше, що є на платформі, —
 * емоційний стан і поведінка дитини. Сервер бачить тільки шифротекст.
 *
 * Як це влаштовано:
 *
 * - У фахівця є пара ключів ECDH P-256. Відкритий ключ лежить у базі
 *   відкрито: ним шифрує будь-хто, кому треба передати фахівцю дані, — і сам
 *   фахівець, і дитина його групи (настрій). Розшифрувати відкритим ключем не
 *   можна.
 * - Закритий ключ лежить у базі лише зашифрованим: AES-256-GCM ключем, який
 *   виводиться з пароля фахівця (PBKDF2-SHA-256, 600 000 ітерацій, своя сіль).
 *   Пароль нікуди не відправляється.
 * - Кожен запис шифрується окремо: одноразова пара ECDH → HKDF → AES-256-GCM.
 *   До запису прив'язаний контекст (наприклад, «щоденник цієї дитини») як
 *   додані дані GCM: шифротекст, пересаджений в інший рядок бази, не
 *   розшифрується.
 *
 * Від чого захищає: від витоку бази чи резервної копії, від того, хто має
 * доступ до сервера чи панелі Supabase, від помилки в правилах доступу. Від
 * чого НЕ захищає: від зламаного пристрою самого фахівця і від підміненого коду
 * сайту — такий код міг би прочитати пароль у мить введення. Це чесна межа
 * будь-якого шифрування в браузері.
 *
 * Пароль не відновлюється. Забутий пароль — це втрачені записи; так і задумано,
 * бо «відновлення» означало б, що ключ є ще в когось.
 */

export const MIN_PASSPHRASE = 10
export const DEFAULT_ITERATIONS = 600_000
const SEAL_PREFIX = 's1'
const WRAP_PREFIX = 'w1'
const HKDF_INFO = new TextEncoder().encode('inclusive-games/seal/v1')
const AUTO_LOCK_MS = 30 * 60 * 1000

function subtle() {
  const api = globalThis.crypto?.subtle
  if (!api) throw new Error('Цей браузер не підтримує шифрування (WebCrypto).')
  return api
}

export function isCryptoSupported() {
  return Boolean(globalThis.crypto?.subtle)
}

/* ─────────── base64 ─────────── */

function toB64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function fromB64(text) {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length) {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/* ─────────── ключ із пароля ─────────── */

async function passphraseKey(passphrase, salt, iterations) {
  const material = await subtle().importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function wrapPrivate(privateKey, passphrase, iterations) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await passphraseKey(passphrase, salt, iterations)
  const pkcs8 = await subtle().exportKey('pkcs8', privateKey)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, pkcs8)
  return {
    salt: toB64(salt),
    iterations,
    wrapped_key: [WRAP_PREFIX, toB64(iv), toB64(ct)].join('.'),
  }
}

export class WrongPassphraseError extends Error {
  constructor() {
    super('wrong_passphrase')
    this.name = 'WrongPassphraseError'
  }
}

async function unwrapPrivate(record, passphrase, { extractable = false } = {}) {
  const [prefix, iv, ct] = String(record.wrapped_key).split('.')
  if (prefix !== WRAP_PREFIX) throw new Error('Невідомий формат ключа.')
  const key = await passphraseKey(passphrase, fromB64(record.salt), record.iterations)
  let pkcs8
  try {
    pkcs8 = await subtle().decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct))
  } catch {
    // GCM не розшифровує з хибним ключем — тобто з хибним паролем.
    throw new WrongPassphraseError()
  }
  return subtle().importKey('pkcs8', pkcs8, { name: 'ECDH', namedCurve: 'P-256' }, extractable, [
    'deriveBits',
  ])
}

/** Нова пара ключів, закритий — під паролем. Повертає рядок для бази. */
export async function buildVault(passphrase, iterations = DEFAULT_ITERATIONS) {
  if (String(passphrase).length < MIN_PASSPHRASE) throw new Error('passphrase_too_short')
  const pair = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const spki = await subtle().exportKey('spki', pair.publicKey)
  return { public_key: toB64(spki), ...(await wrapPrivate(pair.privateKey, passphrase, iterations)) }
}

/** Той самий закритий ключ під новим паролем. Старі записи лишаються читабельними. */
export async function rewrapVault(record, oldPassphrase, newPassphrase) {
  if (String(newPassphrase).length < MIN_PASSPHRASE) throw new Error('passphrase_too_short')
  const privateKey = await unwrapPrivate(record, oldPassphrase, { extractable: true })
  return wrapPrivate(privateKey, newPassphrase, record.iterations ?? DEFAULT_ITERATIONS)
}

export function openVault(record, passphrase) {
  return unwrapPrivate(record, passphrase)
}

/* ─────────── запечатати / відкрити ─────────── */

async function sharedKey(privateKey, publicKey, usage) {
  const bits = await subtle().deriveBits({ name: 'ECDH', public: publicKey }, privateKey, 256)
  const material = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: HKDF_INFO },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  )
}

/**
 * Зашифрувати значення для власника відкритого ключа. Закритий ключ для цього
 * не потрібен — тому дитина може передати свій настрій учителеві, а вчитель
 * записати щоденник, не вводячи пароля щоразу.
 */
export async function seal(publicKeyB64, value, context = '') {
  const recipient = await subtle().importKey(
    'spki',
    fromB64(publicKeyB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ephemeral = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
  const key = await sharedKey(ephemeral.privateKey, recipient, 'encrypt')
  const iv = randomBytes(12)
  const ct = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(JSON.stringify(value)),
  )
  const epk = await subtle().exportKey('spki', ephemeral.publicKey)
  return [SEAL_PREFIX, toB64(epk), toB64(iv), toB64(ct)].join('.')
}

export function isSealed(text) {
  return typeof text === 'string' && text.startsWith(`${SEAL_PREFIX}.`)
}

export async function unseal(privateKey, sealed, context = '') {
  const [prefix, epk, iv, ct] = String(sealed).split('.')
  if (prefix !== SEAL_PREFIX) throw new Error('Невідомий формат запису.')
  const sender = await subtle().importKey(
    'spki',
    fromB64(epk),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const key = await sharedKey(privateKey, sender, 'decrypt')
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: fromB64(iv), additionalData: encoder.encode(context) },
    key,
    fromB64(ct),
  )
  return JSON.parse(decoder.decode(plain))
}

/* ─────────── відімкнений ключ у цій вкладці ───────────
 *
 * Лише в пам'яті: ні localStorage, ні sessionStorage. Закрита вкладка — замкнений
 * щоденник. І сам замикається після півгодини без діла: учительський комп'ютер
 * у кабінеті часто лишають увімкненим.
 */
let state = { privateKey: null, publicKey: null }
let lockTimer = null
const listeners = new Set()

function emit() {
  state = { ...state }
  listeners.forEach((listener) => listener())
}

function touch() {
  clearTimeout(lockTimer)
  lockTimer = setTimeout(lockVault, AUTO_LOCK_MS)
}

export function lockVault() {
  clearTimeout(lockTimer)
  state.privateKey = null
  emit()
}

function unlockedWith(privateKey, publicKey) {
  state.privateKey = privateKey
  state.publicKey = publicKey
  touch()
  emit()
}

export function useVaultState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}

export function isUnlocked() {
  return Boolean(state.privateKey)
}

/** Розшифрувати відімкненим ключем. null — замкнено або запис не відкрився. */
export async function readSealed(sealed, context = '') {
  if (!state.privateKey || !isSealed(sealed)) return null
  touch()
  try {
    return await unseal(state.privateKey, sealed, context)
  } catch {
    return null
  }
}

/* ─────────── хмара ─────────── */

const VAULT_COLUMNS = 'owner_id, public_key, wrapped_key, salt, iterations, updated_at'

/** Сховище поточного фахівця. undefined — таблиці ще немає; null — не створено. */
export async function fetchMyVault() {
  const { data, error } = await supabase.from('specialist_vaults').select(VAULT_COLUMNS).maybeSingle()
  if (isMissingTable(error)) return undefined
  if (error) throw error
  if (data?.public_key) state.publicKey = data.public_key
  return data ?? null
}

export async function createVault(passphrase) {
  const record = await buildVault(passphrase)
  const { data, error } = await supabase
    .from('specialist_vaults')
    .insert(record)
    .select(VAULT_COLUMNS)
    .single()
  if (error) throw error
  const privateKey = await openVault(data, passphrase)
  unlockedWith(privateKey, data.public_key)
  return data
}

export async function unlockMyVault(record, passphrase) {
  const privateKey = await openVault(record, passphrase)
  unlockedWith(privateKey, record.public_key)
}

export async function changePassphrase(record, oldPassphrase, newPassphrase) {
  const patch = await rewrapVault(record, oldPassphrase, newPassphrase)
  const { data, error } = await supabase
    .from('specialist_vaults')
    .update(patch)
    .eq('owner_id', record.owner_id)
    .select(VAULT_COLUMNS)
    .single()
  if (error) throw error
  return data
}

/**
 * Відкритий ключ учителя групи — ним дитина шифрує свій настрій. null: учитель
 * ще не створив щоденник, і тоді настрій просто не зберігається, а не
 * зберігається відкрито.
 */
export async function groupVaultKey(groupId) {
  if (!groupId) return null
  const { data, error } = await supabase.rpc('group_vault_key', { p_group_id: groupId })
  if (error) return null
  return typeof data === 'string' && data ? data : null
}

export function myPublicKey() {
  return state.publicKey
}
