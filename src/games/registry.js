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

/*
 * Ігрові поля вантажаться окремими шматками, конфіги — ні.
 *
 * Конфіг потрібен синхронно і не одній сторінці: GameShell перебирає всі 19,
 * щоб дібрати рівень за спробами в сусідніх іграх тієї ж категорії, а список
 * завдань учителя бере з них рівні. Разом конфіги важать небагато.
 *
 * Важать поля — розмітка, стилі й логіка кожної гри. Дитина за раз грає в одну,
 * а завантажувала досі всі дев'ятнадцять. Тепер приходить тільки та, яку
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
