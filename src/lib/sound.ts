/** Delikatny „dzwonek piekarnika” z Web Audio API – bez plików audio. */
export function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const notes = [880, 1174.66, 1567.98]
    notes.forEach((f, i) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      const t = ctx.currentTime + i * 0.16
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 1)
    })
    setTimeout(() => ctx.close(), 1600)
  } catch {
    /* brak audio – trudno */
  }
}

export function notify(title: string, body: string) {
  try {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body })
  } catch {
    /* ignoruj */
  }
}
