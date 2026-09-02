# Inclusive Games

Когнітивні ігри для дітей. React + Vite, автентифікація і дані — Supabase,
деплой — Vercel (inclusive-games.vercel.app).

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

App Password створюється в Google Account → Security → 2-Step Verification →
App passwords (спершу треба увімкнути двофакторку). Ліміт Gmail — близько
500 листів/добу, чого для платформи цього масштабу достатньо.

### 2. Ліміт на відправку листів

Після підключення SMTP окремо підняти ліміт у `Authentication → Rate Limits`
(«Rate limit for sending emails») — інакше він лишається на низькому значенні
вбудованого сервіса і проблема повторюється попри власний SMTP.

### 3. Шаблон листа й редиректи

- `Authentication → Emails → Magic link or OTP` — тема й тіло листа українською.
- `Authentication → URL Configuration` — `Site URL` і `Redirect URLs` мають
  вказувати на прод-домен, інакше посилання з листа веде не туди.

## Розробка

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
