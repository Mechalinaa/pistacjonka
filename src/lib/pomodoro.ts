/**
 * Czysta logika timera Pomodoro. Czas liczony z timestampów, więc
 * odświeżenie strony / uśpienie karty nie gubi ani nie dokłada czasu.
 */
import type { Settings, TimerState } from '../types'

export const IDLE_TIMER: TimerState = {
  phase: 'idle',
  taskId: null,
  durationMs: 0,
  runningSince: null,
  accumulatedMs: 0,
  phaseStartedAt: null,
  cycleCount: 0,
  longBreak: false,
}

export const elapsedMs = (t: TimerState, now = Date.now()) =>
  t.accumulatedMs + (t.runningSince !== null ? Math.max(0, now - t.runningSince) : 0)

export const remainingMs = (t: TimerState, now = Date.now()) => Math.max(0, t.durationMs - elapsedMs(t, now))

export const isRunning = (t: TimerState) => t.phase !== 'idle' && t.runningSince !== null

/** Moment (timestamp), w którym faza się skończyła/skończy – przy założeniu, że biegnie. */
export const phaseEndAt = (t: TimerState) =>
  t.runningSince !== null ? t.runningSince + (t.durationMs - t.accumulatedMs) : null

export function startWork(t: TimerState, taskId: number | null, s: Settings, now = Date.now()): TimerState {
  return {
    ...t,
    phase: 'work',
    taskId,
    durationMs: s.workMin * 60000,
    runningSince: now,
    accumulatedMs: 0,
    phaseStartedAt: now,
    longBreak: false,
  }
}

export function pause(t: TimerState, now = Date.now()): TimerState {
  if (t.runningSince === null) return t
  return { ...t, accumulatedMs: elapsedMs(t, now), runningSince: null }
}

export function resume(t: TimerState, now = Date.now()): TimerState {
  if (t.phase === 'idle' || t.runningSince !== null) return t
  return { ...t, runningSince: now }
}

export function startBreak(t: TimerState, s: Settings, at: number, autoStart: boolean): TimerState {
  const cycle = t.cycleCount + 1
  const long = cycle % Math.max(1, s.sessionsUntilLongBreak) === 0
  return {
    ...t,
    phase: 'break',
    durationMs: (long ? s.longBreakMin : s.breakMin) * 60000,
    runningSince: autoStart ? at : null,
    accumulatedMs: 0,
    phaseStartedAt: at,
    cycleCount: cycle,
    longBreak: long,
  }
}
