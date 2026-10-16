import { Backpack, GraduationCap, HeartHandshake, ShieldCheck } from 'lucide-react'
import Badge from './Badge'
import { useT } from '../../i18n/i18n'

const ROLES = ['student', 'teacher', 'moderator', 'parent']

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
  const t = useT()
  if (!role || !ROLES.includes(role)) return null

  const Icon = ROLE_ICONS[role]

  return (
    <Badge tone={ROLE_TONES[role]}>
      <Icon size={13} aria-hidden="true" />
      {t(`role.${role}`)}
    </Badge>
  )
}

export default RoleBadge
