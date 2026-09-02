# Inclusive Games

Когнітивні ігри для дітей. React + Vite, автентифікація і дані — Supabase,
деплой — Vercel (inclusive-games.vercel.app).

## Supabase-проєкт

Ref: **`uwostumcmuxmocexpnic`** (назва `inclusive-games`).
Дашборд: https://supabase.com/dashboard/project/uwostumcmuxmocexpnic

Перевірити, що відкритий саме він, найпростіше в `Authentication → Users`:
там має бути акаунт вчителя на Gmail, а не список `*@historic-up.local`
(це інший проєкт в тому ж акаунті — легко переплутати, і тоді налаштування
пошти застосовуються не туди, а прод далі шле дефолтні англійські листи).

## Налаштування пошти (Supabase Auth)

Вхід і реєстрація вчителя працюють через magic-link (`signInWithOtp`), тобто
кожен вхід — це надісланий лист. Це накладає дві вимоги на конфігурацію Supabase.

### 1. Власний SMTP (обов'язково)

Вбудований тестовий email-сервіс Supabase (`noreply@mail.app.supabase.io`)
має жорсткий ліміт кількох листів на годину і працює на best-effort основі.
Кілька тестових входів поспіль вичерпують його, і всі наступні спроби входу
падають з `429 over_email_send_rate_limit` — користувач просто не може зайти.

Тому в `Authentication → Emails → SMTP Settings` має бути налаштований власний
SMTP. Поточна конфігурація — Gmail SMTP:

| Поле | Значення |
| --- | --- |
| Host | `smtp.gmail.com` |
| Port | `587` |
| Username | повна Gmail-адреса |
| Password | App Password (16 символів), **не** звичайний пароль акаунта |
| Sender email | та сама Gmail-адреса (або перевірений alias у Gmail) |

Sender email мусить збігатися з Gmail-акаунтом із поля Username. Довільний
домен (`noreply@yourdomain.com` тощо) не спрацює — Gmail не дозволяє
відправляти від імені домену, яким ти не володієш.

App Password створюється на https://myaccount.google.com/apppasswords (укр.
UI: «Паролі додатків»; сторінки немає в бічному меню, потрапити можна лише
прямим посиланням або через пошук в акаунті). Спершу має бути увімкнена
двоетапна перевірка. Ліміт Gmail — близько 500 листів/добу, чого для
платформи цього масштабу достатньо.

Supabase показує попередження, що Gmail призначений для особистої, а не
транзакційної пошти — це очікувано і не блокує роботу. Наслідок лише в тому,
що частина листів може потрапляти в «Промоакції»/спам.

### 2. Ліміт на відправку листів

Після вмикання власного SMTP Supabase автоматично піднімає ліміт до
30 листів/год — окремо робити нічого не треба. Якщо колись стане мало,
значення змінюється в `Authentication → Rate Limits`.

### 3. Шаблон листа

`Authentication → Emails → Magic link or OTP`. Subject: `Вхід до Inclusive Games`.

Тіло листа не має починатися з тексту, що дублює Subject: Gmail показує тему,
а поруч — сніпет із початку тіла, і повторення читається як «Вхід до Inclusive
Games - Вхід до Inclusive Games…». Тому перший рядок тіла несе іншу інформацію,
а назва платформи винесена в підпис унизу.

```html
<div style="font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif;background:#f4f6fb;padding:32px 16px;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;border:1px solid #e3e8f0;">
    <h1 style="font-size:22px;line-height:1.3;color:#16233a;margin:0 0 12px;">Твоє посилання для входу</h1>
    <p style="font-size:15px;line-height:1.6;color:#4a5568;margin:0 0 24px;">Натисни кнопку нижче, щоб увійти до платформи як <strong style="color:#16233a;">{{ .Email }}</strong>. Посилання діє обмежений час і спрацює лише один раз.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#0b4da3;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:999px;">Увійти до платформи</a>
    <p style="font-size:13px;line-height:1.6;color:#8a97ab;margin:28px 0 0;border-top:1px solid #e3e8f0;padding-top:20px;">Якщо вхід запитував не ти — просто проігноруй цей лист, нічого не зміниться.<br><strong style="color:#4f8ce0;">Inclusive Games</strong></p>
  </div>
</div>
```

Кольори (`#0b4da3`, `#4f8ce0`) — ті самі, що `--login-accent-2` / `--login-accent`
у `src/pages/Login.css`. Стилі inline, бо поштові клієнти не тягнуть зовнішній CSS.

### 4. Редиректи

`Authentication → URL Configuration` — `Site URL` і `Redirect URLs` мають
вказувати на прод-домен, інакше посилання з листа веде не туди.

### Як перевірити, що все працює

Конфіг SMTP і шаблонів не лежить у базі, тому перевіряти треба за фактом
відправки — у `auth_logs`:

- `POST /otp` зі `status: 200` (а не `429 over_email_send_rate_limit`);
- відсутність запису `mail.send` з `mail_from: noreply@mail.app.supabase.io` —
  вбудований сервіс завжди його пише, власний SMTP ні;
- далі `GET /verify` 303 + подія `login` — користувач реально зайшов.

## Розробка

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
