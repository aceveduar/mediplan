import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getInitialAppData, saveAppData, toStoredAppData } from './appData'

const storage = new Map<string, string>()

beforeEach(() => {
  storage.clear()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('app data persistence', () => {
  it('round-trips scheduled dose dates through the stored format', () => {
    const scheduledAt = new Date(2026, 10, 17, 8, 0)
    const administeredAt = new Date(2026, 10, 17, 8, 12)

    saveAppData(toStoredAppData({
      prescriptionEntries: [],
      confirmedItems: [],
      firstDoseTimes: {},
      scheduleEvents: [{
        id: 'dose-1',
        medicationName: 'Medicamento',
        instructions: 'Cada 8 horas',
        scheduledAt,
        administeredAt,
        status: 'given',
      }],
    }))

    const loaded = getInitialAppData()
    expect(loaded.scheduleEvents[0].scheduledAt).toEqual(scheduledAt)
    expect(loaded.scheduleEvents[0].administeredAt).toEqual(administeredAt)
    expect(loaded.scheduleEvents[0].status).toBe('given')
  })

  it('keeps older saved doses usable when optional tracking fields are absent', () => {
    storage.set('mediplan:amelia:v1', JSON.stringify({
      version: 1,
      prescriptionEntries: [],
      confirmedItems: [],
      firstDoseTimes: {},
      scheduleEvents: [{
        id: 'dose-1',
        medicationName: 'Medicamento',
        instructions: 'Cada 8 horas',
        scheduledAt: '2026-11-17T14:00:00.000Z',
      }],
    }))

    const loaded = getInitialAppData()
    expect(loaded.scheduleEvents[0].status).toBe('pending')
    expect(loaded.scheduleEvents[0].administeredAt).toBeNull()
  })
})
