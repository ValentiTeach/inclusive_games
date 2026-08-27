import { Backpack, GraduationCap, ShieldCheck } from 'lucide-react'
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

const ROLE_ICONS = {
  student: Backpack,
  teacher: GraduationCap,
  moderator: ShieldCheck,
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
