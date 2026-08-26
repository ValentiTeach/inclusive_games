import Badge from './Badge'

const ROLE_LABELS = {
  student: 'Учень',
  teacher: 'Вчитель',
  moderator: 'Модератор',
}

const ROLE_TONES = {
  student: 'memory',
  teacher: 'attention',
  moderator: 'reaction',
}

function RoleBadge({ role }) {
  if (!role || !ROLE_LABELS[role]) return null

  return <Badge tone={ROLE_TONES[role]}>{ROLE_LABELS[role]}</Badge>
}

export default RoleBadge
