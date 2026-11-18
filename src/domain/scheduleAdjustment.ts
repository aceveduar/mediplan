import type { ScheduledDose } from './model'
import { getShiftedDoseTimes } from './schedule'

export type AdjustableDoseSeries = {
  key: string
  medicationName: string
  instructions: string
  doses: ScheduledDose[]
  lockedCount: number
}

export type ScheduleAdjustmentResult =
  | { valid: true; scheduleEvents: ScheduledDose[] }
  | { valid: false; error: string }

export function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function calculateScheduleAdjustment(
  scheduleEvents: ScheduledDose[],
  seriesList: AdjustableDoseSeries[],
  adjustmentTimes: Record<string, string>,
  confirmed: boolean,
  now: Date = new Date(),
): ScheduleAdjustmentResult {
  if (!confirmed) {
    return {
      valid: false,
      error: 'Confirma que el horario alternativo fue indicado por el médico o farmacéutico.',
    }
  }

  const updatedTimes = new Map<string, Date>()
  let hasChanges = false

  for (const series of seriesList) {
    if (series.lockedCount > 0) continue
    const selectedTime = adjustmentTimes[series.key]
    if (selectedTime === toLocalDateTimeValue(series.doses[0].scheduledAt)) continue
    const newFirstDose = new Date(selectedTime)
    if (Number.isNaN(newFirstDose.getTime()) || newFirstDose.getTime() <= now.getTime()) {
      return { valid: false, error: `Elige una fecha futura para ${series.medicationName}.` }
    }

    if (newFirstDose.getTime() === series.doses[0].scheduledAt.getTime()) continue
    hasChanges = true

    const shiftedTimes = getShiftedDoseTimes(series.doses, newFirstDose)
    for (const [index, dose] of series.doses.entries()) {
      const scheduledAt = shiftedTimes[index]
      if (scheduledAt.getTime() <= now.getTime()) {
        return {
          valid: false,
          error: `El nuevo horario de ${series.medicationName} deja una toma en el pasado.`,
        }
      }
      updatedTimes.set(dose.id, scheduledAt)
    }
  }

  if (!hasChanges) {
    return {
      valid: false,
      error: 'Cambia al menos una fecha u hora futura para guardar el ajuste.',
    }
  }

  const updatedEvents = scheduleEvents
    .map((dose) => {
      const scheduledAt = updatedTimes.get(dose.id)
      return scheduledAt ? { ...dose, scheduledAt } : dose
    })
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())

  return { valid: true, scheduleEvents: updatedEvents }
}
