import { describe, expect, it } from 'vitest'
import type { PrescriptionSchedule } from './model'
import { getScheduleRule, getScheduledDoseTimes, isNightTime } from './schedule'

describe('schedule rules', () => {
  it('calculates dose counts from explicit interval and duration fields', () => {
    const schedule: PrescriptionSchedule = {
      dose: { min: 2.5, max: 2.5, unit: 'ml' },
      route: '',
      intervalHours: 8,
      durationDays: 5,
      durationRange: null,
    }

    expect(getScheduleRule(schedule)).toEqual({
      intervalHours: 8,
      totalDoses: 15,
      durationRange: null,
    })
  })

  it('requires an explicit duration choice when a schedule has a duration range', () => {
    const schedule: PrescriptionSchedule = {
      dose: { min: 1, max: 2, unit: 'gotas' },
      route: 'Nasal',
      intervalHours: 12,
      durationDays: null,
      durationRange: { min: 3, max: 5 },
    }

    expect(getScheduleRule(schedule).totalDoses).toBeNull()
    expect(getScheduleRule({ ...schedule, durationDays: 4 }).totalDoses).toBe(8)
    expect(getScheduleRule({ ...schedule, durationDays: 6 }).totalDoses).toBeNull()
  })

  it('generates dose times at the exact interval across midnight', () => {
    const firstDose = new Date(2026, 10, 17, 20, 0)
    const doses = getScheduledDoseTimes(firstDose, 8, 3)

    expect(doses.map((dose) => [dose.getDate(), dose.getHours()])).toEqual([
      [17, 20],
      [18, 4],
      [18, 12],
    ])
  })

  it.each([
    [new Date(2026, 10, 17, 19, 59), false],
    [new Date(2026, 10, 17, 20, 0), true],
    [new Date(2026, 10, 17, 6, 59), true],
    [new Date(2026, 10, 17, 7, 0), false],
  ])('classifies the night-window boundary at %s', (date, isNight) => {
    expect(isNightTime(date)).toBe(isNight)
  })
})
