import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)
  const gameName = "Інклюзивні ігри"
  const year = 2027

  return (
    <div>
      <h1> Лічильник кліків  номер 15 </h1>
      <p> Ти натиснув {count} разів </p>
      <button onClick={() => setCount (count + 1)}>
        Натисни на мене
      </button>
    </div>
  )
}

export default App 