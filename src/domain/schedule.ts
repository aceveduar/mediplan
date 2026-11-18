import type { ScheduledDose } from './model'

export const nightWindowStartHour = 20
export const nightWindowEndHour = 7
export const nightWindowLabel = '8:00 PM–7:00 AM'

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

export function getScheduleRule(detail: string, selectedDurationDays?: number) {
  const intervalMatch = detail.match(/\b(?:cada|c\/)\s*(\d+)\s*(?:h|hrs?|horas?)\b/i)
  const durationRangeMatch = detail.match(/\b(?:por|durante|x)\s*(\d+)\s*(?:a|hasta|[-–])\s*(\d+)\s*d[ií]as?\b/i)
  const daysMatch = durationRangeMatch
    ? null
    : detail.match(/\b(?:por|durante|x)\s*(\d+)\s*d[ií]as?\b/i)
  const dosesMatch = detail.match(/\b(?:por|x)\s*(\d+)\s*dosis\b/i)
  const intervalHours = intervalMatch ? Number(intervalMatch[1]) : null
  const durationRange = durationRangeMatch
    ? { min: Number(durationRangeMatch[1]), max: Number(durationRangeMatch[2]) }
    : null
  const validSelectedDuration = durationRange
    && selectedDurationDays !== undefined
    && selectedDurationDays >= durationRange.min
    && selectedDurationDays <= durationRange.max
    ? selectedDurationDays
    : null
  const durationDays = daysMatch ? Number(daysMatch[1]) : validSelectedDuration
  const totalDoses = dosesMatch
    ? Number(dosesMatch[1])
    : durationDays && intervalHours
      ? Math.ceil((durationDays * 24) / intervalHours)
      : null

  return { intervalHours, totalDoses, durationRange }
}
