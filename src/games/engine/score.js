export function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)))
}
