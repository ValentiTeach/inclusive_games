import './Helper.css'

/**
 * Совеня — наскрізний персонаж-помічник.
 *
 * Один і той самий герой пояснює правила (тим самим голосом, що й кнопка
 * «Послухати»), радіє разом із дитиною, заспокоює після помилки й показує рухи
 * у фізхвилинці. Для дитини з РАС знайоме обличчя на кожному екрані — це
 * передбачуваність, а не прикраса.
 *
 * Намальоване, а не картинкою: працює без мережі, нічого не важить і бере
 * кольори теми.
 *
 * Пози:
 *  - wave — привітання, одне крило вгорі;
 *  - explain — пояснює, крило вбік;
 *  - cheer — радіє, обидва крила вгорі;
 *  - calm — спокій, очі заплющені (дихання, «спробуй ще»);
 *  - wide — крила в сторони (фізхвилинка).
 */
export const HELPER_NAME = 'Совеня'

const WINGS = {
  wave: [15, -150],
  explain: [15, -85],
  cheer: [150, -150],
  calm: [5, -5],
  wide: [90, -90],
}

function Wing({ x, angle }) {
  return (
    <ellipse
      className="helper__wing"
      cx={x}
      cy={90}
      rx={9}
      ry={20}
      transform={`rotate(${angle} ${x} 72)`}
    />
  )
}

function Eye({ cx, closed }) {
  if (closed) {
    return (
      <path
        className="helper__lid"
        d={`M${cx - 9} 59 Q${cx} 66 ${cx + 9} 59`}
        fill="none"
        strokeWidth={3}
        strokeLinecap="round"
      />
    )
  }
  return (
    <g>
      <circle className="helper__eye" cx={cx} cy={58} r={12} />
      <circle className="helper__pupil" cx={cx + 1} cy={59} r={5.5} />
      <circle cx={cx + 3} cy={56} r={1.8} fill="#ffffff" />
    </g>
  )
}

function Helper({ pose = 'wave', size = 96, label, className = '' }) {
  const [left, right] = WINGS[pose] ?? WINGS.wave
  const closed = pose === 'calm'

  return (
    <svg
      className={`helper helper--${pose} ${className}`.trim()}
      viewBox="0 0 120 130"
      width={size}
      height={(size * 130) / 120}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <Wing x={28} angle={left} />
      <Wing x={92} angle={right} />
      <path className="helper__body" d="M30 40 L40 22 L50 36 Q60 32 70 36 L80 22 L90 40 Q96 60 94 82 Q92 116 60 116 Q28 116 26 82 Q24 60 30 40 Z" />
      <ellipse className="helper__belly" cx={60} cy={90} rx={21} ry={20} />
      <path className="helper__feather" d="M50 86 Q55 90 60 86 Q65 90 70 86 M50 96 Q55 100 60 96 Q65 100 70 96" fill="none" strokeWidth={2} strokeLinecap="round" />
      <Eye cx={47} closed={closed} />
      <Eye cx={73} closed={closed} />
      <path className="helper__beak" d="M55 68 L65 68 L60 76 Z" />
      {pose === 'cheer' && (
        <path className="helper__smile" d="M53 79 Q60 84 67 79" fill="none" strokeWidth={2} strokeLinecap="round" />
      )}
      <path className="helper__feet" d="M48 116 l-4 6 M52 116 l0 7 M56 116 l4 6 M64 116 l-4 6 M68 116 l0 7 M72 116 l4 6" strokeWidth={3} strokeLinecap="round" />
    </svg>
  )
}

export default Helper
