import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initialPrescriptionEntries } from '../domain/prescriptions'
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

  it('migrates known v1 instructions and preserves their saved schedule records', () => {
    storage.set('mediplan:amelia:v1', JSON.stringify({
      version: 1,
      prescriptionEntries: [
        {
          id: initialPrescriptionEntries[0].id,
          name: initialPrescriptionEntries[0].name,
          detail: initialPrescriptionEntries[0].detail,
          uncertainty: initialPrescriptionEntries[0].uncertainty,
        },
        {
          id: 'custom-medicine',
          name: 'Medicamento personalizado',
          detail: 'Dar 7 ml cada 8 horas durante 3 días.',
          uncertainty: 'Revisar receta',
          durationDays: 3,
        },
      ],
      confirmedItems: [initialPrescriptionEntries[0].id, 'custom-medicine'],
      firstDoseTimes: { 'custom-medicine': '2026-11-17T08:00' },
      scheduleEvents: [{
        id: 'custom-medicine-0',
        medicationName: 'Medicamento personalizado',
        instructions: 'Dar 7 ml cada 8 horas durante 3 días.',
        scheduledAt: '2026-11-17T14:00:00.000Z',
        administeredAt: '2026-11-17T14:05:00.000Z',
        status: 'given',
      }],
    }))

    const loaded = getInitialAppData()
    const migratedStorage = JSON.parse(storage.get('mediplan:amelia:v2') ?? '{}')

    expect(loaded.version).toBe(2)
    expect(loaded.prescriptionEntries[0].schedule).toEqual(initialPrescriptionEntries[0].schedule)
    expect(loaded.prescriptionEntries[1].schedule.intervalHours).toBeNull()
    expect(loaded.confirmedItems).toEqual([initialPrescriptionEntries[0].id])
    expect(loaded.firstDoseTimes).toEqual({ 'custom-medicine': '2026-11-17T08:00' })
    expect(loaded.scheduleEvents[0]).toMatchObject({
      id: 'custom-medicine-0',
      scheduledAt: new Date('2026-11-17T14:00:00.000Z'),
      administeredAt: new Date('2026-11-17T14:05:00.000Z'),
      status: 'given',
    })
    expect(migratedStorage.version).toBe(2)
  })

  it('does not infer structured fields from legacy free-text instructions', () => {
    storage.set('mediplan:amelia:v1', JSON.stringify({
      version: 1,
      prescriptionEntries: [{
        id: 'custom-medicine',
        name: 'Medicamento personalizado',
        detail: 'Dar 7 ml cada 8 horas durante 3 días.',
        uncertainty: 'Revisar receta',
      }],
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
    expect(loaded.prescriptionEntries[0].schedule).toEqual({
      dose: { min: null, max: null, unit: '' },
      route: '',
      intervalHours: null,
      durationDays: null,
      durationRange: null,
    })
    expect(loaded.scheduleEvents[0].status).toBe('pending')
    expect(loaded.scheduleEvents[0].administeredAt).toBeNull()
  })
})
