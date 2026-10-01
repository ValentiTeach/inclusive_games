/**
 * Схематичне обличчя з одним із шести виразів.
 *
 * Вираз тримають три речі, як у справжньому обличчі: брови, очі й рот. Решта
 * (шкіра, зачіска) — лише щоб люди були різні.
 */
const INK = '#2a1f1a'

const BROWS = {
  calm: [[31, 37, 43, 37]],
  joy: [[31, 36, 43, 35]],
  sadness: [[31, 39, 43, 33]],
  anger: [[31, 33, 43, 40]],
  surprise: [[31, 30, 43, 28]],
  fear: [[31, 34, 43, 29]],
}

function Brows({ emotion }) {
  const [[x1, y1, x2, y2]] = BROWS[emotion]
  return (
    <g stroke={INK} strokeWidth={3} strokeLinecap="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {/* Права брова — дзеркало лівої відносно середини обличчя. */}
      <line x1={100 - x1} y1={y1} x2={100 - x2} y2={y2} />
    </g>
  )
}

function Eyes({ emotion }) {
  if (emotion === 'joy') {
    return (
      <g stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none">
        <path d="M32 49 Q37 43 42 49" />
        <path d="M58 49 Q63 43 68 49" />
      </g>
    )
  }
  const wide = emotion === 'surprise' || emotion === 'fear'
  return (
    <g>
      {wide && (
        <>
          <circle cx={37} cy={47} r={6.5} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={63} cy={47} r={6.5} fill="#fff" stroke={INK} strokeWidth={1.5} />
        </>
      )}
      <circle cx={37} cy={47} r={wide ? 3 : 3.6} fill={INK} />
      <circle cx={63} cy={47} r={wide ? 3 : 3.6} fill={INK} />
    </g>
  )
}

function Mouth({ emotion }) {
  switch (emotion) {
    case 'joy':
      return <path d="M35 62 Q50 82 65 62 Z" fill={INK} />
    case 'calm':
      return <path d="M41 66 Q50 71 59 66" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    case 'sadness':
      return <path d="M38 73 Q50 62 62 73" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />
    case 'anger':
      return <path d="M38 71 Q50 65 62 71" stroke={INK} strokeWidth={4} fill="none" strokeLinecap="round" />
    case 'surprise':
      return <ellipse cx={50} cy={70} rx={6} ry={8} fill={INK} />
    case 'fear':
      // Широко розтягнутий рот із зубами — на відміну від круглого «О» здивування.
      return (
        <g>
          <ellipse cx={50} cy={71} rx={10} ry={5.5} fill={INK} />
          <line x1={42} y1={69} x2={58} y2={69} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
        </g>
      )
    default:
      return null
  }
}

function Hair({ person }) {
  const fill = person.hair
  switch (person.style) {
    case 'buns':
      return (
        <g fill={fill}>
          <circle cx={22} cy={22} r={11} />
          <circle cx={78} cy={22} r={11} />
          <path d="M14 46 Q16 12 50 12 Q84 12 86 46 Q76 26 50 24 Q24 26 14 46 Z" />
        </g>
      )
    case 'curly':
      return (
        <g fill={fill}>
          {[18, 30, 42, 54, 66, 78].map((x) => (
            <circle key={x} cx={x} cy={x === 18 || x === 78 ? 30 : 18} r={11} />
          ))}
        </g>
      )
    case 'bangs':
      return <path d="M12 52 Q10 10 50 10 Q90 10 88 52 L80 52 Q78 32 70 30 L30 30 Q22 32 20 52 Z" fill={fill} />
    case 'long':
      return <path d="M10 90 Q6 10 50 10 Q94 10 90 90 L80 90 Q84 34 50 24 Q16 34 20 90 Z" fill={fill} />
    default:
      return <path d="M14 44 Q14 10 50 10 Q86 10 86 44 Q74 24 50 22 Q26 24 14 44 Z" fill={fill} />
  }
}

function Face({ emotion, person, size = 120, label }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {person.style === 'long' && <Hair person={person} />}
      <circle cx={50} cy={52} r={37} fill={person.skin} />
      {person.style !== 'long' && <Hair person={person} />}
      <Brows emotion={emotion} />
      <Eyes emotion={emotion} />
      {emotion === 'sadness' && <path d="M66 54 Q69 60 66 62 Q63 60 66 54 Z" fill="#4f8fe0" />}
      <Mouth emotion={emotion} />
    </svg>
  )
}

export default Face
