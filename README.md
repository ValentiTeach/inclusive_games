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
