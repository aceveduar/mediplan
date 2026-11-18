import { describe, expect, it } from 'vitest'
import { initialPrescriptionEntries } from './prescriptions'
import {
  buildPrescriptionCorrection,
  getPrescriptionEditValues,
} from './prescriptionEditing'

describe('prescription correction', () => {
  const entry = initialPrescriptionEntries[0]
  const values = getPrescriptionEditValues(entry)

  it('keeps structured fixed-dose details when the correction is valid', () => {
    const result = buildPrescriptionCorrection(entry, values)

    expect(result).toEqual({
      valid: true,
      entry: {
        ...entry,
        uncertainty: 'Corrección guardada; revisa de nuevo que coincida con la receta original.',
      },
    })
  })

  it('rejects invalid dose amounts and non-integer intervals', () => {
    expect(buildPrescriptionCorrection(entry, { ...values, doseMin: '0' })).toMatchObject({
      valid: false,
      error: 'Indica una cantidad válida y su unidad tal como aparecen en la receta.',
    })
    expect(buildPrescriptionCorrection(entry, { ...values, intervalHours: '8.5' })).toMatchObject({
      valid: false,
      error: 'Indica el intervalo en horas tal como aparece en la receta.',
    })
  })

  it('accepts a duration range but rejects combining it with a fixed duration', () => {
    const rangeValues = {
      ...values,
      durationDays: '',
      durationMin: '3',
      durationMax: '5',
    }

    expect(buildPrescriptionCorrection(entry, rangeValues)).toMatchObject({
      valid: true,
      entry: { schedule: { durationDays: null, durationRange: { min: 3, max: 5 } } },
    })
    expect(buildPrescriptionCorrection(entry, {
      ...rangeValues,
      durationDays: '4',
    })).toMatchObject({
      valid: false,
      error: 'Completa una duración fija o un rango válido de días, no ambos.',
    })
  })
})
