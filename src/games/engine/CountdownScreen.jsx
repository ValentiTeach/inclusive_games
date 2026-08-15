function CountdownScreen({ value }) {
  return (
    <div className="game-shell__countdown" aria-live="assertive">
      {value > 0 ? value : 'Старт!'}
    </div>
  )
}

export default CountdownScreen
