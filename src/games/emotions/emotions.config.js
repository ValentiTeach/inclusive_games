import { pickRandom, shuffle } from '../engine/random'
import { trialMetrics } from '../engine/metrics'
import { gameInfo } from '../../data/games'

/**
 * Емоції — впізнавання емоцій за обличчям і розуміння, що відчуває людина в
 * ситуації. Для дітей із розладами аутистичного спектра це одна з головних
 * цілей корекції, а для решти — основа соціального мислення.
 *
 * Обличчя намальовані, а не сфотографовані: схематичне обличчя легше читати,
 * і на ньому немає реальної людини.
 */
export const EMOTIONS = {
  joy: { name: 'Радість' },
  sadness: { name: 'Сум' },
  anger: { name: 'Злість' },
  fear: { name: 'Страх' },
  surprise: { name: 'Здивування' },
  calm: { name: 'Спокій' },
}

/* Різні люди: щоб «таке саме обличчя» шукалося за виразом, а не за зачіскою. */
export const PEOPLE = [
  { id: 'p1', skin: '#f2c7a5', hair: '#4a2f1d', style: 'short' },
  { id: 'p2', skin: '#d9a07a', hair: '#1f1b18', style: 'buns' },
  { id: 'p3', skin: '#8d5a3b', hair: '#121010', style: 'curly' },
  { id: 'p4', skin: '#f6d8c0', hair: '#c9862f', style: 'bangs' },
  { id: 'p5', skin: '#b97b56', hair: '#3b2a20', style: 'long' },
  { id: 'p6', skin: '#efc9a0', hair: '#7a4a24', style: 'short' },
]

export const SITUATIONS = [
  { emotion: 'joy', text: 'Петрикові подарували цуценя, про яке він давно мріяв.' },
  { emotion: 'joy', text: 'Клас Олі виграв естафету.' },
  { emotion: 'joy', text: 'До Марти в гості приїхала улюблена бабуся.' },
  { emotion: 'sadness', text: 'У Сашка зламалася улюблена іграшка.' },
  { emotion: 'sadness', text: 'Найкраща подруга Ані переїхала в інше місто.' },
  { emotion: 'sadness', text: 'Пішов дощ, і прогулянку в парку скасували.' },
  { emotion: 'anger', text: 'Хтось навмисно розламав вежу, яку Іван довго будував.' },
  { emotion: 'anger', text: 'Брат без дозволу взяв Олин планшет і не віддає.' },
  { emotion: 'fear', text: 'Уночі за вікном загуркотів грім, і згасло світло.' },
  { emotion: 'fear', text: 'Великий собака голосно гавкає й біжить до Максима.' },
  { emotion: 'surprise', text: 'Мама відчинила двері, а там уся родина з тортом!' },
  { emotion: 'surprise', text: 'Тарас відкрив коробку, а звідти вистрибнула іграшкова жаба.' },
  { emotion: 'calm', text: 'Соня лежить у гамаку й слухає, як шелестить листя.' },
  { emotion: 'calm', text: 'Перед сном тато читає Дмитрикові казку.' },
]

export const config = {
  ...gameInfo('emotions'),
  instructions: [
    'Подивись на обличчя: брови, очі й рот підкажуть, що людина відчуває.',
    'На першому рівні знайди серед інших людей обличчя з таким самим настроєм.',
    'Далі — назви емоцію словом, а потім вирішуй, що відчуває дитина в ситуації.',
  ],
  keyHint: { keys: 'Цифри', text: 'вибрати варіант за номером' },
  practice: {
    hint: (level) =>
      level.mode === 'situation'
        ? 'Уяви, що це сталося з тобою. Як би тобі було? Обери таке обличчя.'
        : level.mode === 'name'
          ? 'Подивись на брови й рот. Усмішка — радість, брови зсунуті донизу — злість, рот кружечком — здивування.'
          : 'Не дивись на зачіску — дивись на брови, очі й рот. Знайди такий самий настрій.',
  },
  levels: [
    {
      id: 'match',
      label: 'Таке саме обличчя',
      trialCount: 8,
      mode: 'match',
      emotions: ['joy', 'sadness', 'anger', 'surprise'],
      options: 3,
    },
    { id: 'name', label: 'Назви емоцію', trialCount: 8, mode: 'name', emotions: Object.keys(EMOTIONS), options: 4 },
    {
      id: 'situation',
      label: 'Що відчуває?',
      trialCount: 8,
      mode: 'situation',
      emotions: Object.keys(EMOTIONS),
      options: 3,
    },
  ],
}

function otherEmotions(level, emotion, count) {
  return shuffle(level.emotions.filter((id) => id !== emotion)).slice(0, count)
}

export function generateTrial(level, previous) {
  if (level.mode === 'situation') {
    const situation = pickRandom(SITUATIONS.filter((item) => item.text !== previous?.text))
    const person = pickRandom(PEOPLE)
    const options = shuffle([situation.emotion, ...otherEmotions(level, situation.emotion, level.options - 1)])
    return { mode: 'situation', text: situation.text, answer: situation.emotion, person, options }
  }

  const emotion = pickRandom(level.emotions.filter((id) => id !== previous?.answer))
  const [person, ...others] = shuffle(PEOPLE)
  const distractors = otherEmotions(level, emotion, level.options - 1)

  if (level.mode === 'name') {
    return { mode: 'name', answer: emotion, person, options: shuffle([emotion, ...distractors]) }
  }

  // Варіанти — інші люди, і кожен з іншим настроєм, крім одного.
  const options = shuffle([emotion, ...distractors]).map((id, index) => ({
    emotion: id,
    person: others[index],
  }))
  return { mode: 'match', answer: emotion, person, options }
}

export function optionEmotion(option) {
  return typeof option === 'string' ? option : option.emotion
}

export function checkAnswer(trial, emotion) {
  return { correct: emotion === trial.answer }
}

export function scoring(results) {
  const metrics = trialMetrics(results)

  return {
    score: metrics.accuracy_pct ?? 0,
    entries: [
      { label: 'Правильно', value: `${metrics.correct} / ${metrics.total}` },
      { label: 'Точність', value: `${metrics.accuracy_pct ?? 0}%` },
      { label: 'Середній час', value: `${metrics.avg_rt_ms ?? 0} мс` },
    ],
    metrics,
  }
}
