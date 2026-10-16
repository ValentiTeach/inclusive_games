/**
 * Тваринки-аватари. Дитина, яка ще не читає, на спільному комп'ютері не
 * впізнає себе за підписом «Оля Петренко» — а лисичку впізнає.
 *
 * Емодзі, а не малюнки: кольорові, однаково зрозумілі на всіх системах і не
 * важать нічого. Ключ — те, що лягає в profiles.avatar (латиниця, бо так
 * обмежує міграція); назва — для екранного читача й підказки.
 */
export const AVATARS = [
  { key: 'fox', emoji: '🦊', label: 'Лисичка' },
  { key: 'cat', emoji: '🐱', label: 'Котик' },
  { key: 'dog', emoji: '🐶', label: 'Песик' },
  { key: 'bunny', emoji: '🐰', label: 'Зайчик' },
  { key: 'bear', emoji: '🐻', label: 'Ведмедик' },
  { key: 'panda', emoji: '🐼', label: 'Панда' },
  { key: 'koala', emoji: '🐨', label: 'Коала' },
  { key: 'tiger', emoji: '🐯', label: 'Тигреня' },
  { key: 'lion', emoji: '🦁', label: 'Левеня' },
  { key: 'frog', emoji: '🐸', label: 'Жабка' },
  { key: 'owl', emoji: '🦉', label: 'Совеня' },
  { key: 'penguin', emoji: '🐧', label: 'Пінгвін' },
  { key: 'turtle', emoji: '🐢', label: 'Черепашка' },
  { key: 'hedgehog', emoji: '🦔', label: 'Їжачок' },
  { key: 'butterfly', emoji: '🦋', label: 'Метелик' },
  { key: 'whale', emoji: '🐳', label: 'Китеня' },
]

export function avatarOf(key) {
  return AVATARS.find((avatar) => avatar.key === key) ?? null
}
