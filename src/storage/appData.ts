import type { DoseStatus, PrescriptionEntry, ScheduledDose } from '../domain/model'
import { initialPrescriptionEntries, previousPrescriptionDetails } from '../domain/prescriptions'

type StoredScheduleDose = Omit<ScheduledDose, 'scheduledAt' | 'administeredAt'> & {
  scheduledAt: string
  administeredAt?: string | null
  status?: DoseStatus
}

export type StoredAppData = {
  version: 1
  prescriptionEntries: PrescriptionEntry[]
  confirmedItems: string[]
  firstDoseTimes: Record<string, string>
  scheduleEvents: StoredScheduleDose[]
}

export type InitialAppData = Omit<StoredAppData, 'scheduleEvents'> & {
  scheduleEvents: ScheduledDose[]
  error: string
}

type AppDataSnapshot = Omit<StoredAppData, 'version' | 'scheduleEvents'> & {
  scheduleEvents: ScheduledDose[]
}

const storageKey = 'mediplan:amelia:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPrescriptionEntry(value: unknown): value is PrescriptionEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.detail === 'string'
    && typeof value.uncertainty === 'string'
    && (value.durationDays === undefined
      || (typeof value.durationDays === 'number' && Number.isInteger(value.durationDays)))
}

function isStoredScheduleDose(value: unknown): value is StoredScheduleDose {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.medicationName === 'string'
    && typeof value.instructions === 'string'
    && typeof value.scheduledAt === 'string'
    && Number.isFinite(Date.parse(value.scheduledAt))
    && (value.administeredAt === undefined
      || value.administeredAt === null
      || (typeof value.administeredAt === 'string' && Number.isFinite(Date.parse(value.administeredAt))))
    && (value.status === undefined || isDoseStatus(value.status))
}

function isDoseStatus(value: unknown): value is DoseStatus {
  return value === 'pending' || value === 'given' || value === 'skipped'
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

function loadSavedAppData(): { data: StoredAppData; error: string } {
  const defaults: StoredAppData = {
    version: 1,
    prescriptionEntries: initialPrescriptionEntries,
    confirmedItems: [],
    firstDoseTimes: {},
    scheduleEvents: [],
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { data: defaults, error: '' }

    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed)
      || parsed.version !== 1
      || !Array.isArray(parsed.prescriptionEntries)
      || !parsed.prescriptionEntries.every(isPrescriptionEntry)
      || !Array.isArray(parsed.confirmedItems)
      || !parsed.confirmedItems.every((item) => typeof item === 'string')
      || !isStringRecord(parsed.firstDoseTimes)
      || !Array.isArray(parsed.scheduleEvents)
      || !parsed.scheduleEvents.every(isStoredScheduleDose)
    ) {
      throw new Error('El formato guardado no es válido.')
    }

    return {
      data: {
        version: 1,
        prescriptionEntries: parsed.prescriptionEntries,
        confirmedItems: parsed.confirmedItems,
        firstDoseTimes: parsed.firstDoseTimes,
        scheduleEvents: parsed.scheduleEvents,
      },
      error: '',
    }
  } catch (error) {
    console.error('No se pudieron recuperar los datos de MediPlan:', error)
    return {
      data: defaults,
      error: 'No se pudieron leer los datos guardados. Tus cambios nuevos podrían no conservarse.',
    }
  }
}

export function getInitialAppData(): InitialAppData {
  const saved = loadSavedAppData()
  const updatedIds: string[] = []
  const prescriptionEntries = saved.data.prescriptionEntries.map((entry) => {
    const updatedEntry = initialPrescriptionEntries.find((item) => item.id === entry.id)
    const savedCollifrinDuration = entry.id === 'colifrin'
      ? entry.detail.match(/\b(?:por|durante|x)\s*([3-5])\s*d[ií]as?\b/i)
      : null
    const isSavedCollifrinChoice = entry.id === 'colifrin'
      && /\b(?:cada|c\/)\s*12\s*(?:h|hrs?|horas?)\b/i.test(entry.detail)
      && /\bgotas?\b/i.test(entry.detail)
      && savedCollifrinDuration !== null

    if (updatedEntry && (
      entry.detail === previousPrescriptionDetails[entry.id]
      || isSavedCollifrinChoice
    )) {
      updatedIds.push(entry.id)
      return savedCollifrinDuration
        ? { ...updatedEntry, durationDays: Number(savedCollifrinDuration[1]) }
        : updatedEntry
    }
    return entry
  })
  const validIds = new Set(prescriptionEntries.map((entry) => entry.id))

  return {
    ...saved.data,
    prescriptionEntries,
    confirmedItems: saved.data.confirmedItems.filter((id) => validIds.has(id) && !updatedIds.includes(id)),
    scheduleEvents: saved.data.scheduleEvents.map((event) => {
      const updatedEntry = prescriptionEntries.find((entry) =>
        updatedIds.includes(entry.id) && event.id.startsWith(`${entry.id}-`),
      )
      return {
        ...event,
        medicationName: updatedEntry?.name ?? event.medicationName,
        instructions: updatedEntry?.detail ?? event.instructions,
        scheduledAt: new Date(event.scheduledAt),
        administeredAt: event.administeredAt ? new Date(event.administeredAt) : null,
        status: event.status ?? 'pending',
      }
    }),
    error: saved.error,
  }
}

export function toStoredAppData(data: AppDataSnapshot): StoredAppData {
  return {
    version: 1,
    prescriptionEntries: data.prescriptionEntries,
    confirmedItems: data.confirmedItems,
    firstDoseTimes: data.firstDoseTimes,
    scheduleEvents: data.scheduleEvents.map((event) => ({
      id: event.id,
      medicationName: event.medicationName,
      instructions: event.instructions,
      scheduledAt: event.scheduledAt.toISOString(),
      administeredAt: event.administeredAt?.toISOString() ?? null,
      status: event.status,
    })),
  }
}

export function saveAppData(data: StoredAppData) {
  window.localStorage.setItem(storageKey, JSON.stringify(data))
}
