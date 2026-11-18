import type { PrescriptionEntry } from './model'

export type PrescriptionEditValues = {
  name: string
  detail: string
  doseMin: string
  doseMax: string
  doseUnit: string
  route: string
  intervalHours: string
  durationDays: string
  durationMin: string
  durationMax: string
}

export const emptyPrescriptionEditValues: PrescriptionEditValues = {
  name: '',
  detail: '',
  doseMin: '',
  doseMax: '',
  doseUnit: '',
  route: '',
  intervalHours: '',
  durationDays: '',
  durationMin: '',
  durationMax: '',
}

export function getPrescriptionEditValues(entry: PrescriptionEntry): PrescriptionEditValues {
  return {
    name: entry.name,
    detail: entry.detail,
    doseMin: entry.schedule.dose.min?.toString() ?? '',
    doseMax: entry.schedule.dose.max?.toString() ?? '',
    doseUnit: entry.schedule.dose.unit,
    route: entry.schedule.route,
    intervalHours: entry.schedule.intervalHours?.toString() ?? '',
    durationDays: entry.schedule.durationDays?.toString() ?? '',
    durationMin: entry.schedule.durationRange?.min.toString() ?? '',
    durationMax: entry.schedule.durationRange?.max.toString() ?? '',
  }
}

export type PrescriptionCorrectionResult =
  | { valid: true; entry: PrescriptionEntry }
  | { valid: false; error: string }

function parsePositiveNumber(value: string) {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function buildPrescriptionCorrection(
  entry: PrescriptionEntry,
  values: PrescriptionEditValues,
): PrescriptionCorrectionResult {
  if (!values.name.trim() || !values.detail.trim()) {
    return { valid: false, error: 'Completa el nombre y la indicación para guardar.' }
  }

  const doseMin = parsePositiveNumber(values.doseMin)
  const doseMax = values.doseMax.trim()
    ? parsePositiveNumber(values.doseMax)
    : doseMin
  const intervalHours = parsePositiveNumber(values.intervalHours)
  const durationDays = values.durationDays.trim()
    ? parsePositiveNumber(values.durationDays)
    : null
  const durationMin = values.durationMin.trim()
    ? parsePositiveNumber(values.durationMin)
    : null
  const durationMax = values.durationMax.trim()
    ? parsePositiveNumber(values.durationMax)
    : null
  const hasDurationRange = values.durationMin.trim() !== '' || values.durationMax.trim() !== ''
  let durationRange: { min: number; max: number } | null = null

  if (doseMin === null || doseMax === null || doseMax < doseMin || !values.doseUnit.trim()) {
    return {
      valid: false,
      error: 'Indica una cantidad válida y su unidad tal como aparecen en la receta.',
    }
  }
  if (intervalHours === null || !Number.isInteger(intervalHours)) {
    return {
      valid: false,
      error: 'Indica el intervalo en horas tal como aparece en la receta.',
    }
  }
  if (hasDurationRange) {
    if (
      durationDays !== null
      || durationMin === null
      || durationMax === null
      || !Number.isInteger(durationMin)
      || !Number.isInteger(durationMax)
      || durationMax < durationMin
    ) {
      return {
        valid: false,
        error: 'Completa una duración fija o un rango válido de días, no ambos.',
      }
    }
    durationRange = { min: durationMin, max: durationMax }
  } else if (durationDays === null || !Number.isInteger(durationDays)) {
    return {
      valid: false,
      error: 'Indica la duración en días tal como aparece en la receta.',
    }
  }

  return {
    valid: true,
    entry: {
      ...entry,
      name: values.name.trim(),
      detail: values.detail.trim(),
      uncertainty: 'Corrección guardada; revisa de nuevo que coincida con la receta original.',
      schedule: {
        dose: {
          min: doseMin,
          max: doseMax,
          unit: values.doseUnit.trim(),
        },
        route: values.route.trim(),
        intervalHours,
        durationDays: hasDurationRange ? null : durationDays,
        durationRange,
      },
    },
  }
}
