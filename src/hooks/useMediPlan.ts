import { useState } from 'react'
import type { DoseStatus, PrescriptionEntry, ScheduledDose } from '../domain/model'
import {
  getScheduleRule,
  getScheduledDoseTimes,
  hasValidDoseAmount,
} from '../domain/schedule'
import { getInitialAppData, saveAppData, toStoredAppData } from '../storage/appData'

type AppDataChanges = {
  prescriptionEntries?: PrescriptionEntry[]
  confirmedItems?: string[]
  firstDoseTimes?: Record<string, string>
  scheduleEvents?: ScheduledDose[]
}

export type ScheduleGenerationResult =
  | { type: 'incomplete' }
  | { type: 'confirmation-required' }
  | { type: 'invalid'; medicationName: string }
  | { type: 'created'; firstDoseAt: Date }

export function useMediPlan() {
  const [initialData] = useState(getInitialAppData)
  const [prescriptionEntries, setPrescriptionEntries] = useState(initialData.prescriptionEntries)
  const [confirmedItems, setConfirmedItems] = useState(initialData.confirmedItems)
  const [firstDoseTimes, setFirstDoseTimes] = useState(initialData.firstDoseTimes)
  const [scheduleEvents, setScheduleEvents] = useState<ScheduledDose[]>(initialData.scheduleEvents)
  const [persistenceError, setPersistenceError] = useState(initialData.error)
  const [canPersist, setCanPersist] = useState(!initialData.error)

  const persistAppState = (changes: AppDataChanges = {}) => {
    if (!canPersist) return

    try {
      saveAppData(toStoredAppData({
        prescriptionEntries: changes.prescriptionEntries ?? prescriptionEntries,
        confirmedItems: changes.confirmedItems ?? confirmedItems,
        firstDoseTimes: changes.firstDoseTimes ?? firstDoseTimes,
        scheduleEvents: changes.scheduleEvents ?? scheduleEvents,
      }))
      setPersistenceError('')
    } catch (error) {
      console.error('No se pudieron guardar los datos de MediPlan:', error)
      setPersistenceError('No se pudieron guardar los cambios en este navegador.')
      setCanPersist(false)
    }
  }

  const allItemsConfirmed = confirmedItems.length === prescriptionEntries.length
  const scheduleReady = prescriptionEntries.every((entry) => {
    const rule = getScheduleRule(entry.schedule)
    return hasValidDoseAmount(entry.schedule)
      && rule.intervalHours !== null
      && rule.totalDoses !== null
      && rule.totalDoses > 0
      && Boolean(firstDoseTimes[entry.id])
  })
  const scheduleBlockers = prescriptionEntries.flatMap((entry) => {
    const rule = getScheduleRule(entry.schedule)
    if (!hasValidDoseAmount(entry.schedule)) {
      return [`Completa la cantidad y unidad de ${entry.name} tal como aparecen en la receta.`]
    }
    if (rule.durationRange && rule.totalDoses === null) {
      return [`Elige entre ${rule.durationRange.min} y ${rule.durationRange.max} días para ${entry.name}.`]
    }
    if (rule.intervalHours === null || rule.totalDoses === null || rule.totalDoses <= 0) {
      return [`Completa el intervalo y la duración de ${entry.name} tal como aparecen en la receta.`]
    }
    return firstDoseTimes[entry.id]
      ? []
      : [`Elige cuándo será la primera toma de ${entry.name}.`]
  })

  const applyConfirmationToggle = (id: string) => {
    const nextConfirmedItems = confirmedItems.includes(id)
      ? confirmedItems.filter((item) => item !== id)
      : [...confirmedItems, id]
    setScheduleEvents([])
    setConfirmedItems(nextConfirmedItems)
    persistAppState({ confirmedItems: nextConfirmedItems, scheduleEvents: [] })
  }

  const applyDurationSelection = (id: string, value: string) => {
    const durationDays = value ? Number(value) : null
    const nextEntries = prescriptionEntries.map((entry) => (
      entry.id === id
        ? { ...entry, schedule: { ...entry.schedule, durationDays } }
        : entry
    ))
    setPrescriptionEntries(nextEntries)
    setScheduleEvents([])
    persistAppState({ prescriptionEntries: nextEntries, scheduleEvents: [] })
  }

  const prepareEntryEdit = (entryId: string) => {
    const nextConfirmedItems = confirmedItems.filter((id) => id !== entryId)
    const nextFirstDoseTimes = { ...firstDoseTimes }
    delete nextFirstDoseTimes[entryId]
    setScheduleEvents([])
    setFirstDoseTimes(nextFirstDoseTimes)
    setConfirmedItems(nextConfirmedItems)
    persistAppState({
      confirmedItems: nextConfirmedItems,
      firstDoseTimes: nextFirstDoseTimes,
      scheduleEvents: [],
    })
  }

  const updatePrescriptionEntries = (nextEntries: PrescriptionEntry[]) => {
    setPrescriptionEntries(nextEntries)
    persistAppState({ prescriptionEntries: nextEntries })
  }

  const updateFirstDoseTime = (entryId: string, value: string) => {
    const nextTimes = { ...firstDoseTimes, [entryId]: value }
    setFirstDoseTimes(nextTimes)
    persistAppState({ firstDoseTimes: nextTimes })
  }

  const updateDoseStatus = (id: string, status: DoseStatus) => {
    const nextEvents = scheduleEvents.map((dose) => (
      dose.id === id
        ? { ...dose, status, administeredAt: status === 'given' ? new Date() : null }
        : dose
    ))
    setScheduleEvents(nextEvents)
    persistAppState({ scheduleEvents: nextEvents })
  }

  const createSchedule = (replaceActivePlan = false): ScheduleGenerationResult => {
    if (!allItemsConfirmed || !scheduleReady) return { type: 'incomplete' }
    if (scheduleEvents.length > 0 && !replaceActivePlan) {
      return { type: 'confirmation-required' }
    }

    const generated: ScheduledDose[] = []
    for (const entry of prescriptionEntries) {
      const rule = getScheduleRule(entry.schedule)
      const firstDose = new Date(firstDoseTimes[entry.id])
      if (
        rule.intervalHours === null
        || rule.totalDoses === null
        || Number.isNaN(firstDose.getTime())
      ) {
        return { type: 'invalid', medicationName: entry.name }
      }

      const scheduledTimes = getScheduledDoseTimes(firstDose, rule.intervalHours, rule.totalDoses)
      for (let doseIndex = 0; doseIndex < scheduledTimes.length; doseIndex += 1) {
        generated.push({
          id: `${entry.id}-${doseIndex}`,
          medicationName: entry.name,
          instructions: entry.detail,
          scheduledAt: scheduledTimes[doseIndex],
          administeredAt: null,
          status: 'pending',
        })
      }
    }

    if (generated.length === 0) return { type: 'invalid', medicationName: '' }

    generated.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    setScheduleEvents(generated)
    persistAppState({ scheduleEvents: generated })
    return { type: 'created', firstDoseAt: generated[0].scheduledAt }
  }

  const updateScheduleEvents = (nextEvents: ScheduledDose[]) => {
    setScheduleEvents(nextEvents)
    persistAppState({ scheduleEvents: nextEvents })
  }

  return {
    prescriptionEntries,
    confirmedItems,
    firstDoseTimes,
    scheduleEvents,
    persistenceError,
    scheduleReady,
    scheduleBlockers,
    applyConfirmationToggle,
    applyDurationSelection,
    prepareEntryEdit,
    updatePrescriptionEntries,
    updateFirstDoseTime,
    updateDoseStatus,
    createSchedule,
    updateScheduleEvents,
  }
}
