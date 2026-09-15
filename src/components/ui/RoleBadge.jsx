import { Backpack, GraduationCap, HeartHandshake, ShieldCheck } from 'lucide-react'
import Badge from './Badge'

const ROLE_LABELS = {
  student: 'Учень',
  teacher: 'Вчитель',
  moderator: 'Модератор',
  parent: 'Батьки',
}

const ROLE_TONES = {
  student: 'memory',
  teacher: 'attention',
  moderator: 'reaction',
  parent: 'thinking',
}

const ROLE_ICONS = {
  student: Backpack,
  teacher: GraduationCap,
  moderator: ShieldCheck,
  parent: HeartHandshake,
}

function RoleBadge({ role }) {
  if (!role || !ROLE_LABELS[role]) return null

  const Icon = ROLE_ICONS[role]

  return (
    <Badge tone={ROLE_TONES[role]}>
      <Icon size={13} aria-hidden="true" />
      {ROLE_LABELS[role]}
    </Badge>
  )
}

export default RoleBadge
