import type { DoseStatus, PrescriptionEntry, PrescriptionSchedule, ScheduledDose } from '../domain/model'
import { initialPrescriptionEntries } from '../domain/prescriptions'

type StoredScheduleDose = Omit<ScheduledDose, 'scheduledAt' | 'administeredAt'> & {
  scheduledAt: string
  administeredAt?: string | null
  status?: DoseStatus
}

type LegacyPrescriptionEntry = Omit<PrescriptionEntry, 'schedule'> & {
  durationDays?: number
}

type LegacyStoredAppData = {
  version: 1
  prescriptionEntries: LegacyPrescriptionEntry[]
  confirmedItems: string[]
  firstDoseTimes: Record<string, string>
  scheduleEvents: StoredScheduleDose[]
}

export type StoredAppData = {
  version: 2
  prescriptionEntries: PrescriptionEntry[]
  confirmedItems: string[]
  firstDoseTimes: Record<string, string>
  scheduleEvents: StoredScheduleDose[]
}

export type AppDataBackupResult =
  | { valid: true; data: StoredAppData }
  | { valid: false; error: string }

export type InitialAppData = Omit<StoredAppData, 'scheduleEvents'> & {
  scheduleEvents: ScheduledDose[]
  error: string
}

type AppDataSnapshot = Omit<StoredAppData, 'version' | 'scheduleEvents'> & {
  scheduleEvents: ScheduledDose[]
}

type LoadedAppData = {
  data: StoredAppData
  error: string
  migrated: boolean
}

const storageKey = 'mediplan:amelia:v2'
const legacyStorageKey = 'mediplan:amelia:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isOptionalPositiveNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0)
}

function isPrescriptionSchedule(value: unknown): value is PrescriptionSchedule {
  if (!isRecord(value) || !isRecord(value.dose)) return false

  const { dose, durationRange } = value
  const validRange = durationRange === null
    || (isRecord(durationRange)
      && typeof durationRange.min === 'number'
      && Number.isInteger(durationRange.min)
      && durationRange.min > 0
      && typeof durationRange.max === 'number'
      && Number.isInteger(durationRange.max)
      && durationRange.max >= durationRange.min)
  const doseMin = dose.min
  const doseMax = dose.max
  const intervalHours = value.intervalHours
  const durationDays = value.durationDays
  const durationWithinRange = durationRange === null
    || durationDays === null
    || (isRecord(durationRange)
      && typeof durationDays === 'number'
      && typeof durationRange.min === 'number'
      && typeof durationRange.max === 'number'
      && durationDays >= durationRange.min
      && durationDays <= durationRange.max)

  return isOptionalPositiveNumber(doseMin)
    && isOptionalPositiveNumber(doseMax)
    && (doseMin === null || doseMax === null || doseMax >= doseMin)
    && typeof dose.unit === 'string'
    && typeof value.route === 'string'
    && isOptionalPositiveNumber(intervalHours)
    && (intervalHours === null || Number.isInteger(intervalHours))
    && isOptionalPositiveNumber(durationDays)
    && (durationDays === null || Number.isInteger(durationDays))
    && validRange
    && durationWithinRange
}

function isPrescriptionEntry(value: unknown): value is PrescriptionEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.detail === 'string'
    && typeof value.uncertainty === 'string'
    && isPrescriptionSchedule(value.schedule)
}

function isLegacyPrescriptionEntry(value: unknown): value is LegacyPrescriptionEntry {
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

function hasCommonStoredFields(value: Record<string, unknown>) {
  return Array.isArray(value.confirmedItems)
    && value.confirmedItems.every((item) => typeof item === 'string')
    && isStringRecord(value.firstDoseTimes)
    && Array.isArray(value.scheduleEvents)
    && value.scheduleEvents.every(isStoredScheduleDose)
}

function isStoredAppData(value: unknown): value is StoredAppData {
  return isRecord(value)
    && value.version === 2
    && hasCommonStoredFields(value)
    && Array.isArray(value.prescriptionEntries)
    && value.prescriptionEntries.every(isPrescriptionEntry)
}

function isLegacyStoredAppData(value: unknown): value is LegacyStoredAppData {
  return isRecord(value)
    && value.version === 1
    && hasCommonStoredFields(value)
    && Array.isArray(value.prescriptionEntries)
    && value.prescriptionEntries.every(isLegacyPrescriptionEntry)
}

function createUnresolvedSchedule(): PrescriptionSchedule {
  return {
    dose: { min: null, max: null, unit: '' },
    route: '',
    intervalHours: null,
    durationDays: null,
    durationRange: null,
  }
}

function migrateLegacyAppData(legacy: LegacyStoredAppData): StoredAppData {
  const unresolvedIds = new Set<string>()
  const prescriptionEntries = legacy.prescriptionEntries.map((entry) => {
    const knownEntry = initialPrescriptionEntries.find((initial) =>
      initial.id === entry.id && initial.detail === entry.detail,
    )

    if (!knownEntry) {
      unresolvedIds.add(entry.id)
      return { ...entry, schedule: createUnresolvedSchedule() }
    }

    const range = knownEntry.schedule.durationRange
    const savedDuration = range
      && entry.durationDays !== undefined
      && entry.durationDays >= range.min
      && entry.durationDays <= range.max
      ? entry.durationDays
      : knownEntry.schedule.durationDays

    return {
      ...entry,
      schedule: { ...knownEntry.schedule, durationDays: savedDuration },
    }
  })

  return {
    version: 2,
    prescriptionEntries,
    confirmedItems: legacy.confirmedItems.filter((id) => !unresolvedIds.has(id)),
    firstDoseTimes: legacy.firstDoseTimes,
    scheduleEvents: legacy.scheduleEvents,
  }
}

export function parseAppDataBackup(raw: string): AppDataBackupResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { valid: false, error: 'El archivo no contiene un JSON válido.' }
  }

  if (isStoredAppData(parsed)) return { valid: true, data: parsed }
  if (isLegacyStoredAppData(parsed)) {
    return { valid: true, data: migrateLegacyAppData(parsed) }
  }
  return { valid: false, error: 'El archivo no es un respaldo válido de MediPlan.' }
}

function loadSavedAppData(): LoadedAppData {
  const defaults: StoredAppData = {
    version: 2,
    prescriptionEntries: initialPrescriptionEntries,
    confirmedItems: [],
    firstDoseTimes: {},
    scheduleEvents: [],
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
      ?? window.localStorage.getItem(legacyStorageKey)
    if (!raw) return { data: defaults, error: '', migrated: false }

    const parsed: unknown = JSON.parse(raw)
    if (isStoredAppData(parsed)) return { data: parsed, error: '', migrated: false }
    if (isLegacyStoredAppData(parsed)) {
      return { data: migrateLegacyAppData(parsed), error: '', migrated: true }
    }
    throw new Error('El formato guardado no es válido.')
  } catch (error) {
    console.error('No se pudieron recuperar los datos de MediPlan:', error)
    return {
      data: defaults,
      error: 'No se pudieron leer los datos guardados. Tus cambios nuevos podrían no conservarse.',
      migrated: false,
    }
  }
}

export function getInitialAppData(): InitialAppData {
  const saved = loadSavedAppData()
  const scheduleEvents = saved.data.scheduleEvents.map((event) => ({
    ...event,
    scheduledAt: new Date(event.scheduledAt),
    administeredAt: event.administeredAt ? new Date(event.administeredAt) : null,
    status: event.status ?? 'pending',
  }))

  let error = saved.error
  if (saved.migrated) {
    try {
      saveAppData(saved.data)
    } catch (migrationError) {
      console.error('No se pudieron actualizar los datos al nuevo formato de MediPlan:', migrationError)
      error = 'Tus datos anteriores se conservaron, pero no se pudo completar la actualización.'
    }
  }

  return { ...saved.data, scheduleEvents, error }
}

export function toStoredAppData(data: AppDataSnapshot): StoredAppData {
  return {
    version: 2,
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
