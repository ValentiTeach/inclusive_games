/**
 * Дитина з повітряною кулькою — спереду або ззаду.
 *
 * Спереду й ззаду мають розрізнятися з першого погляду, і не одним лише
 * кольором: спереду видно очі, усмішку й лямки рюкзака, ззаду — потилицю з
 * волоссям і сам рюкзак. Саме це дитина має помітити, перш ніж відповідати,
 * — у цьому половина завдання.
 *
 * `side` — з якого боку екрана піднята рука з кулькою. Котра це рука самої
 * дитини, вирішує конфіг (screenSide), а не малюнок.
 */

const VIEW_W = 160
const SHOULDER_Y = 104
const SHOULDER_X = { left: 58, right: 102 }

function Arm({ side, raised }) {
  const sign = side === 'left' ? -1 : 1
  const shoulder = { x: SHOULDER_X[side], y: SHOULDER_Y }
  const hand = raised ? { x: shoulder.x + sign * 28, y: 70 } : { x: shoulder.x + sign * 14, y: 162 }
  return (
    <g>
      <line className="kid__sleeve" x1={shoulder.x} y1={shoulder.y} x2={hand.x} y2={hand.y} />
      <circle className="kid__skin" cx={hand.x} cy={hand.y} r={7} />
      {raised && (
        <>
          <path
            className="kid__string"
            d={`M${hand.x} ${hand.y - 6} q ${sign * 6} -14 0 -26`}
            fill="none"
          />
          <ellipse className="kid__balloon" cx={hand.x} cy={hand.y - 48} rx={16} ry={19} />
          <path className="kid__balloon" d={`M${hand.x - 4} ${hand.y - 28} h8 l-4 -5 z`} />
        </>
      )}
    </g>
  )
}

function Kid({ view, side }) {
  const front = view === 'front'
  return (
    <svg
      className={`kid kid--${view}`}
      viewBox={`0 0 ${VIEW_W} 230`}
      role="img"
      aria-label={front ? 'Дитина дивиться на тебе' : 'Дитина стоїть спиною до тебе'}
    >
      {/* Ноги */}
      <rect className="kid__legs" x={62} y={168} width={15} height={48} rx={6} />
      <rect className="kid__legs" x={83} y={168} width={15} height={48} rx={6} />
      <ellipse className="kid__shoe" cx={69} cy={217} rx={11} ry={6} />
      <ellipse className="kid__shoe" cx={91} cy={217} rx={11} ry={6} />

      <Arm side="left" raised={side === 'left'} />
      <Arm side="right" raised={side === 'right'} />

      {/* Тулуб */}
      <rect className="kid__shirt" x={55} y={96} width={50} height={78} rx={16} />

      {front ? (
        <>
          {/* Лямки рюкзака спереду */}
          <line className="kid__strap" x1={66} y1={98} x2={66} y2={150} />
          <line className="kid__strap" x1={94} y1={98} x2={94} y2={150} />
        </>
      ) : (
        <>
          {/* Рюкзак — видно лише ззаду */}
          <rect className="kid__backpack" x={62} y={104} width={36} height={50} rx={9} />
          <rect className="kid__pocket" x={69} y={128} width={22} height={16} rx={4} />
        </>
      )}

      {/* Шия й голова */}
      <rect className="kid__skin" x={73} y={84} width={14} height={14} rx={4} />
      {front ? (
        <>
          <circle className="kid__skin" cx={80} cy={60} r={28} />
          <path className="kid__hair" d="M52 58 Q54 28 80 28 Q106 28 108 58 Q96 44 80 44 Q64 44 52 58 Z" />
          <circle className="kid__eye" cx={70} cy={62} r={3.5} />
          <circle className="kid__eye" cx={90} cy={62} r={3.5} />
          <path className="kid__mouth" d="M70 74 Q80 82 90 74" fill="none" />
        </>
      ) : (
        <>
          <circle className="kid__skin" cx={51} cy={62} r={6} />
          <circle className="kid__skin" cx={109} cy={62} r={6} />
          <circle className="kid__hair" cx={80} cy={60} r={28} />
        </>
      )}
    </svg>
  )
}

export default Kid
