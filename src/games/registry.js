import { lazy } from 'react'

import { config as schulteConfig } from './schulte/schulte.config'
import { config as stroopConfig } from './stroop/stroop.config'
import { config as simonConfig } from './simon/simon.config'
import { config as memoryPairsConfig } from './memory-pairs/memoryPairs.config'
import { config as reactionTimeConfig } from './reaction-time/reactionTime.config'
import { config as quickMathConfig } from './quick-math/quickMath.config'
import { config as subitizingConfig } from './subitizing/subitizing.config'
import { config as goNoGoConfig } from './go-no-go/goNoGo.config'
import { config as nbackConfig } from './n-back/nback.config'
import { config as targetSearchConfig } from './target-search/targetSearch.config'
import { config as matricesConfig } from './matrices/matrices.config'
import { config as mentalRotationConfig } from './mental-rotation/mentalRotation.config'
import { config as keyboardTrainerConfig } from './keyboard-trainer/keyboardTrainer.config'
import { config as trafficLightConfig } from './traffic-light/trafficLight.config'
import { config as catchTheMomentConfig } from './catch-the-moment/catchTheMoment.config'
import { config as whatVanishedConfig } from './what-vanished/whatVanished.config'
import { config as digitSpanConfig } from './digit-span/digitSpan.config'
import { config as oddOneOutConfig } from './odd-one-out/oddOneOut.config'
import { config as continueRowConfig } from './continue-row/continueRow.config'
import { config as dayNightConfig } from './day-night/dayNight.config'
import { config as cardSortConfig } from './card-sort/cardSort.config'
import { config as rhythmConfig } from './rhythm/rhythm.config'
import { config as firstSoundConfig } from './first-sound/firstSound.config'
import { config as wordGroupsConfig } from './word-groups/wordGroups.config'
import { config as graphicDictationConfig } from './graphic-dictation/graphicDictation.config'
import { config as tracePathConfig } from './trace-path/tracePath.config'
import { config as towerConfig } from './tower/tower.config'
import { config as numberLineConfig } from './number-line/numberLine.config'
import { config as emotionsConfig } from './emotions/emotions.config'
import { config as flankerConfig } from './flanker/flanker.config'
import { config as hiddenFiguresConfig } from './hidden-figures/hiddenFigures.config'
import { config as moreDotsConfig } from './more-dots/moreDots.config'
import { config as seriationConfig } from './seriation/seriation.config'
import { config as listenCatchConfig } from './listen-catch/listenCatch.config'
import { config as storyOrderConfig } from './story-order/storyOrder.config'
import { config as tenWordsConfig } from './ten-words/tenWords.config'
import { config as objectPlaceConfig } from './object-place/objectPlace.config'
import { config as mazeConfig } from './maze/maze.config'
import { config as timeSenseConfig } from './time-sense/timeSense.config'
import { config as symmetryConfig } from './symmetry/symmetry.config'

/*
 * Ігрові поля вантажаться окремими шматками, конфіги — ні.
 *
 * Конфіг потрібен синхронно і не одній сторінці: GameShell перебирає всі,
 * щоб дібрати рівень за спробами в сусідніх іграх тієї ж категорії, а список
 * завдань учителя бере з них рівні. Разом конфіги важать небагато.
 *
 * Важать поля — розмітка, стилі й логіка кожної гри. Дитина за раз грає в одну,
 * а завантажувала досі всі. Тепер приходить тільки та, яку
 * відкрили.
 *
 * Завантажувачі лежать окремою мапою, а не тільки всередині lazy(): дістати
 * функцію назад із lazy-компонента можна лише через внутрішні поля React, а
 * вони не є частиною публічного API. Мапа потрібна і для випередження нижче,
 * і для офлайну — щоб service worker мав що покласти в кеш наперед.
 */
const LOADERS = {
  schulte: () => import('./schulte/SchultePlayArea'),
  stroop: () => import('./stroop/StroopPlayArea'),
  simon: () => import('./simon/SimonPlayArea'),
  'memory-pairs': () => import('./memory-pairs/MemoryPairsPlayArea'),
  'reaction-time': () => import('./reaction-time/ReactionTimePlayArea'),
  'quick-math': () => import('./quick-math/QuickMathPlayArea'),
  subitizing: () => import('./subitizing/SubitizingPlayArea'),
  'go-no-go': () => import('./go-no-go/GoNoGoPlayArea'),
  'n-back': () => import('./n-back/NBackPlayArea'),
  'target-search': () => import('./target-search/TargetSearchPlayArea'),
  matrices: () => import('./matrices/MatricesPlayArea'),
  'mental-rotation': () => import('./mental-rotation/MentalRotationPlayArea'),
  'keyboard-trainer': () => import('./keyboard-trainer/KeyboardTrainerPlayArea'),
  'traffic-light': () => import('./traffic-light/TrafficLightPlayArea'),
  'catch-the-moment': () => import('./catch-the-moment/CatchTheMomentPlayArea'),
  'what-vanished': () => import('./what-vanished/WhatVanishedPlayArea'),
  'digit-span': () => import('./digit-span/DigitSpanPlayArea'),
  'odd-one-out': () => import('./odd-one-out/OddOneOutPlayArea'),
  'continue-row': () => import('./continue-row/ContinueRowPlayArea'),
  'day-night': () => import('./day-night/DayNightPlayArea'),
  'card-sort': () => import('./card-sort/CardSortPlayArea'),
  rhythm: () => import('./rhythm/RhythmPlayArea'),
  'first-sound': () => import('./first-sound/FirstSoundPlayArea'),
  'word-groups': () => import('./word-groups/WordGroupsPlayArea'),
  'graphic-dictation': () => import('./graphic-dictation/GraphicDictationPlayArea'),
  'trace-path': () => import('./trace-path/TracePathPlayArea'),
  tower: () => import('./tower/TowerPlayArea'),
  'number-line': () => import('./number-line/NumberLinePlayArea'),
  emotions: () => import('./emotions/EmotionsPlayArea'),
  flanker: () => import('./flanker/FlankerPlayArea'),
  'hidden-figures': () => import('./hidden-figures/HiddenFiguresPlayArea'),
  'more-dots': () => import('./more-dots/MoreDotsPlayArea'),
  seriation: () => import('./seriation/SeriationPlayArea'),
  'listen-catch': () => import('./listen-catch/ListenCatchPlayArea'),
  'story-order': () => import('./story-order/StoryOrderPlayArea'),
  'ten-words': () => import('./ten-words/TenWordsPlayArea'),
  'object-place': () => import('./object-place/ObjectPlacePlayArea'),
  maze: () => import('./maze/MazePlayArea'),
  'time-sense': () => import('./time-sense/TimeSensePlayArea'),
  symmetry: () => import('./symmetry/SymmetryPlayArea'),
}

export const GAME_REGISTRY = {
  schulte: { config: schulteConfig, PlayArea: lazy(LOADERS['schulte']) },
  stroop: { config: stroopConfig, PlayArea: lazy(LOADERS['stroop']) },
  simon: { config: simonConfig, PlayArea: lazy(LOADERS['simon']) },
  'memory-pairs': { config: memoryPairsConfig, PlayArea: lazy(LOADERS['memory-pairs']) },
  'reaction-time': { config: reactionTimeConfig, PlayArea: lazy(LOADERS['reaction-time']) },
  'quick-math': { config: quickMathConfig, PlayArea: lazy(LOADERS['quick-math']) },
  subitizing: { config: subitizingConfig, PlayArea: lazy(LOADERS['subitizing']) },
  'go-no-go': { config: goNoGoConfig, PlayArea: lazy(LOADERS['go-no-go']) },
  'n-back': { config: nbackConfig, PlayArea: lazy(LOADERS['n-back']) },
  'target-search': { config: targetSearchConfig, PlayArea: lazy(LOADERS['target-search']) },
  matrices: { config: matricesConfig, PlayArea: lazy(LOADERS['matrices']) },
  'mental-rotation': { config: mentalRotationConfig, PlayArea: lazy(LOADERS['mental-rotation']) },
  'keyboard-trainer': { config: keyboardTrainerConfig, PlayArea: lazy(LOADERS['keyboard-trainer']) },
  'traffic-light': { config: trafficLightConfig, PlayArea: lazy(LOADERS['traffic-light']) },
  'catch-the-moment': { config: catchTheMomentConfig, PlayArea: lazy(LOADERS['catch-the-moment']) },
  'what-vanished': { config: whatVanishedConfig, PlayArea: lazy(LOADERS['what-vanished']) },
  'digit-span': { config: digitSpanConfig, PlayArea: lazy(LOADERS['digit-span']) },
  'odd-one-out': { config: oddOneOutConfig, PlayArea: lazy(LOADERS['odd-one-out']) },
  'continue-row': { config: continueRowConfig, PlayArea: lazy(LOADERS['continue-row']) },
  'day-night': { config: dayNightConfig, PlayArea: lazy(LOADERS['day-night']) },
  'card-sort': { config: cardSortConfig, PlayArea: lazy(LOADERS['card-sort']) },
  rhythm: { config: rhythmConfig, PlayArea: lazy(LOADERS['rhythm']) },
  'first-sound': { config: firstSoundConfig, PlayArea: lazy(LOADERS['first-sound']) },
  'word-groups': { config: wordGroupsConfig, PlayArea: lazy(LOADERS['word-groups']) },
  'graphic-dictation': { config: graphicDictationConfig, PlayArea: lazy(LOADERS['graphic-dictation']) },
  'trace-path': { config: tracePathConfig, PlayArea: lazy(LOADERS['trace-path']) },
  tower: { config: towerConfig, PlayArea: lazy(LOADERS['tower']) },
  'number-line': { config: numberLineConfig, PlayArea: lazy(LOADERS['number-line']) },
  emotions: { config: emotionsConfig, PlayArea: lazy(LOADERS['emotions']) },
  flanker: { config: flankerConfig, PlayArea: lazy(LOADERS['flanker']) },
  'hidden-figures': { config: hiddenFiguresConfig, PlayArea: lazy(LOADERS['hidden-figures']) },
  'more-dots': { config: moreDotsConfig, PlayArea: lazy(LOADERS['more-dots']) },
  seriation: { config: seriationConfig, PlayArea: lazy(LOADERS['seriation']) },
  'listen-catch': { config: listenCatchConfig, PlayArea: lazy(LOADERS['listen-catch']) },
  'story-order': { config: storyOrderConfig, PlayArea: lazy(LOADERS['story-order']) },
  'ten-words': { config: tenWordsConfig, PlayArea: lazy(LOADERS['ten-words']) },
  'object-place': { config: objectPlaceConfig, PlayArea: lazy(LOADERS['object-place']) },
  maze: { config: mazeConfig, PlayArea: lazy(LOADERS['maze']) },
  'time-sense': { config: timeSenseConfig, PlayArea: lazy(LOADERS['time-sense']) },
  symmetry: { config: symmetryConfig, PlayArea: lazy(LOADERS['symmetry']) },
}

/*
 * Починає завантажувати поле гри, не чекаючи, поки воно знадобиться.
 *
 * Без цього дитина натискала б «Почати», дивилася три секунди зворотного
 * відліку — і бачила порожнечу, поки йде шматок. Виклик на відкритті сторінки
 * дає цим трьом секундам корисну роботу: поле встигає приїхати до першої проби.
 *
 * Помилка тут навмисно ковтається: це лише випередження. Якщо шматок так і не
 * приїде, його попросить Suspense — і тоді збій побачить межа помилок, а не
 * порожня консоль.
 */
export function preloadPlayArea(gameId) {
  const load = LOADERS[gameId]
  if (load) void load().catch(() => {})
}

/**
 * Усі ігрові поля — для випередження на простої, коли мережа ще є.
 * Порядок не важливий: це кеш, а не черга показу.
 */
export function preloadAllPlayAreas() {
  for (const load of Object.values(LOADERS)) {
    void load().catch(() => {})
  }
}
