import { describe, expect, it } from 'vitest'
import type { ScheduledDose } from './model'
import {
  calculateScheduleAdjustment,
  toLocalDateTimeValue,
  type AdjustableDoseSeries,
} from './scheduleAdjustment'

function createDose(id: string, scheduledAt: Date, status: ScheduledDose['status'] = 'pending'): ScheduledDose {
  return {
    id,
    medicationName: 'Medicamento',
    instructions: 'Cada 8 horas',
    scheduledAt,
    administeredAt: status === 'given' ? new Date(scheduledAt.getTime() + 5 * 60_000) : null,
    status,
  }
}

describe('schedule adjustment', () => {
  const now = new Date(2026, 10, 18, 8, 0)
  const firstDose = createDose('medicine-1', new Date(2026, 10, 18, 10, 0))
  const secondDose = createDose('medicine-2', new Date(2026, 10, 18, 18, 0))
  const recordedDose = createDose('recorded-dose', new Date(2026, 10, 18, 9, 0), 'given')
  const series: AdjustableDoseSeries[] = [{
    key: 'medicine',
    medicationName: 'Medicamento',
    instructions: 'Cada 8 horas',
    doses: [firstDose, secondDose],
    lockedCount: 0,
  }]

  it('moves pending doses and preserves unrelated recorded doses', () => {
    const newFirstDose = new Date(2026, 10, 18, 11, 0)
    const result = calculateScheduleAdjustment(
      [recordedDose, firstDose, secondDose],
      series,
      { medicine: toLocalDateTimeValue(newFirstDose) },
      true,
      now,
    )

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.scheduleEvents.map((dose) => dose.scheduledAt)).toEqual([
      recordedDose.scheduledAt,
      newFirstDose,
      new Date(2026, 10, 18, 19, 0),
    ])
    expect(result.scheduleEvents[0]).toEqual(recordedDose)
  })

  it('requires professional confirmation and a future time', () => {
    const futureTime = toLocalDateTimeValue(new Date(2026, 10, 18, 11, 0))
    expect(calculateScheduleAdjustment(
      [firstDose, secondDose],
      series,
      { medicine: futureTime },
      false,
      now,
    )).toMatchObject({
      valid: false,
      error: 'Confirma que el horario alternativo fue indicado por el médico o farmacéutico.',
    })

    expect(calculateScheduleAdjustment(
      [firstDose, secondDose],
      series,
      { medicine: toLocalDateTimeValue(new Date(2026, 10, 18, 7, 0)) },
      true,
      now,
    )).toMatchObject({
      valid: false,
      error: 'Elige una fecha futura para Medicamento.',
    })
  })

  it('does not save when no schedule time changes', () => {
    expect(calculateScheduleAdjustment(
      [firstDose, secondDose],
      series,
      { medicine: toLocalDateTimeValue(firstDose.scheduledAt) },
      true,
      now,
    )).toMatchObject({
      valid: false,
      error: 'Cambia al menos una fecha u hora futura para guardar el ajuste.',
    })
  })
})
