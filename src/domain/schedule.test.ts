import { describe, expect, it } from 'vitest'
import { getScheduleRule, getScheduledDoseTimes, isNightTime } from './schedule'

describe('schedule rules', () => {
  it('calculates dose counts from interval and duration', () => {
    expect(getScheduleRule('Dar 2.5 ml cada 8 horas durante 5 días')).toEqual({
      intervalHours: 8,
      totalDoses: 15,
      durationRange: null,
    })
  })

  it('requires an explicit duration choice when the prescription gives a range', () => {
    const detail = 'Aplicar cada 12 horas durante 3 a 5 días'

    expect(getScheduleRule(detail).totalDoses).toBeNull()
    expect(getScheduleRule(detail, 4).totalDoses).toBe(8)
    expect(getScheduleRule(detail, 6).totalDoses).toBeNull()
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
