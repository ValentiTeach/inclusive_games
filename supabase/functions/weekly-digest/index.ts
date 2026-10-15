// Тижневий лист учителям і модераторам.
//
// Що бере з бази — описано в міграції 20261015_notifications_vitals.sql
// (weekly_digest_payload, moderator_digest_payload): лише ті, хто сам увімкнув
// лист на сторінці «Акаунт». Надсилає через Resend (https://resend.com) —
// поштовий SMTP Supabase обслуговує лише листи входу, а не розсилки.
//
// Секрети функції (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY — ключ Resend;
//   DIGEST_FROM    — від кого, напр. "Inclusive Games <digest@ваш-домен>";
//   DIGEST_SECRET  — довільний довгий рядок; без нього функцію не викликати;
//   SITE_URL       — адреса сайту для посилань (необов'язково).
// SUPABASE_URL і SUPABASE_SERVICE_ROLE_KEY Supabase підставляє сам.
//
// Розгортання: `supabase functions deploy weekly-digest --no-verify-jwt`;
// розклад — у кінці міграції (pg_cron + pg_net, щопонеділка).

import { createClient } from 'npm:@supabase/supabase-js@2'

type Group = { name: string; students: number; active: number; attempts: number; inactive: string[] }
type TeacherRow = { user_id: string; email: string; display_name: string | null; groups: Group[] }
type ModeratorRow = { email: string; pending: number }

const SITE_URL = (Deno.env.get('SITE_URL') ?? 'https://inclusive-games.vercel.app').replace(/\/+$/, '')

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function teacherEmail(row: TeacherRow): { subject: string; html: string; text: string } {
  const lines: string[] = []
  const html: string[] = []
  for (const group of row.groups) {
    const summary = `${group.name}: грали ${group.active} з ${group.students}, спроб ${group.attempts}`
    lines.push(summary)
    html.push(`<h3 style="margin:16px 0 4px">${escapeHtml(group.name)}</h3>`)
    html.push(
      `<p style="margin:0">Грали ${group.active} з ${group.students} дітей, спроб за тиждень: ${group.attempts}.</p>`,
    )
    if (group.inactive.length > 0) {
      const names = group.inactive.join(', ')
      lines.push(`  Не грали тиждень: ${names}`)
      html.push(`<p style="margin:4px 0 0">Не грали тиждень: ${escapeHtml(names)}</p>`)
    }
  }

  const hello = row.display_name ? `Вітаємо, ${row.display_name}!` : 'Вітаємо!'
  const footer =
    'Лист приходить, бо ви ввімкнули його на сторінці «Акаунт». Вимкнути можна там само: ' +
    `${SITE_URL}/account`

  return {
    subject: 'Тиждень у ваших групах — Inclusive Games',
    text: [hello, '', ...lines, '', `Детальніше — на сторінці групи: ${SITE_URL}/groups`, '', footer].join('\n'),
    html: [
      `<p>${escapeHtml(hello)}</p>`,
      '<p>Коротко про минулий тиждень:</p>',
      ...html,
      `<p style="margin-top:20px"><a href="${SITE_URL}/groups">Відкрити групи</a> — там підсумок тижня, зміни балів і цілі ІПР.</p>`,
      `<p style="color:#666;font-size:12px">${escapeHtml(footer)}</p>`,
    ].join('\n'),
  }
}

function moderatorEmail(row: ModeratorRow): { subject: string; html: string; text: string } {
  const text = `Заявок батьків, що чекають рішення: ${row.pending}. ${SITE_URL}/admin`
  return {
    subject: `Заявки батьків чекають: ${row.pending} — Inclusive Games`,
    text,
    html: `<p>Заявок батьків, що чекають рішення: <strong>${row.pending}</strong>.</p><p><a href="${SITE_URL}/admin">Відкрити адмін-панель</a></p>`,
  }
}

async function send(to: string, message: { subject: string; html: string; text: string }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: Deno.env.get('DIGEST_FROM'), to, ...message }),
  })
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`)
}

Deno.serve(async (request) => {
  // Без секрету будь-хто з адресою функції міг би запустити розсилку всім.
  const secret = Deno.env.get('DIGEST_SECRET')
  if (!secret || request.headers.get('x-digest-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }
  if (!Deno.env.get('RESEND_API_KEY') || !Deno.env.get('DIGEST_FROM')) {
    return new Response('RESEND_API_KEY / DIGEST_FROM not set', { status: 500 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const [teachers, moderators] = await Promise.all([
    supabase.rpc('weekly_digest_payload'),
    supabase.rpc('moderator_digest_payload'),
  ])
  if (teachers.error) return new Response(teachers.error.message, { status: 500 })
  if (moderators.error) return new Response(moderators.error.message, { status: 500 })

  let sent = 0
  const failed: string[] = []

  for (const row of (teachers.data ?? []) as TeacherRow[]) {
    if (row.groups.length === 0) continue
    try {
      await send(row.email, teacherEmail(row))
      sent += 1
    } catch (error) {
      failed.push(`${row.user_id}: ${(error as Error).message}`)
    }
  }

  for (const row of (moderators.data ?? []) as ModeratorRow[]) {
    try {
      await send(row.email, moderatorEmail(row))
      sent += 1
    } catch (error) {
      failed.push(`moderator: ${(error as Error).message}`)
    }
  }

  return Response.json({ sent, failed })
})
