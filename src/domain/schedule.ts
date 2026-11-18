import type { PrescriptionSchedule, ScheduledDose } from './model'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export const nightWindowStartHour = 20
export const nightWindowEndHour = 7
export const nightWindowLabel = '8:00 PM–7:00 AM'

export function formatScheduleTime(date: Date, datePattern?: string) {
  const dateLabel = datePattern ? `${format(date, datePattern, { locale: es })}, ` : ''
  return `${dateLabel}${format(date, 'h:mm')} ${date.getHours() < 12 ? 'AM' : 'PM'}`
}

export function getDoseSeriesKey(dose: Pick<ScheduledDose, 'medicationName' | 'instructions'>) {
  return JSON.stringify([dose.medicationName, dose.instructions])
}

export function sortDosesForTracking(doses: ScheduledDose[]) {
  return [...doses].sort((left, right) => {
    const statusOrder = Number(left.status !== 'pending') - Number(right.status !== 'pending')
    return statusOrder || left.scheduledAt.getTime() - right.scheduledAt.getTime()
  })
}

export function isNightTime(date: Date) {
  const hour = date.getHours()
  return hour >= nightWindowStartHour || hour < nightWindowEndHour
}

export function getScheduledDoseTimes(firstDose: Date, intervalHours: number, totalDoses: number) {
  return Array.from(
    { length: totalDoses },
    (_, index) => new Date(firstDose.getTime() + index * intervalHours * 60 * 60 * 1000),
  )
}

export function getShiftedDoseTimes(doses: ScheduledDose[], newFirstDose: Date) {
  const originalFirstDose = doses[0].scheduledAt.getTime()
  const offset = newFirstDose.getTime() - originalFirstDose
  return doses.map((dose) => new Date(dose.scheduledAt.getTime() + offset))
}

export function getDoseTimePreview(times: Date[]) {
  const visibleTimes = times.slice(0, 4)
  return {
    times: visibleTimes,
    remainingCount: times.length - visibleTimes.length,
    nightCount: times.filter(isNightTime).length,
  }
}

export function getScheduleRule(schedule: PrescriptionSchedule) {
  const { intervalHours, durationRange } = schedule
  const durationDays = durationRange
    ? schedule.durationDays !== null
      && schedule.durationDays >= durationRange.min
      && schedule.durationDays <= durationRange.max
      ? schedule.durationDays
      : null
    : schedule.durationDays
  const totalDoses = intervalHours && durationDays
    ? Math.ceil((durationDays * 24) / intervalHours)
    : null

  return { intervalHours, totalDoses, durationRange }
}

export function hasValidDoseAmount(schedule: PrescriptionSchedule) {
  const { min, max, unit } = schedule.dose
  return min !== null
    && Number.isFinite(min)
    && min > 0
    && (max === null || (Number.isFinite(max) && max >= min))
    && unit.trim().length > 0
}
