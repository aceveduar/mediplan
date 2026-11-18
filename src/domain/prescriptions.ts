import type { PrescriptionEntry } from './model'

export const initialPrescriptionEntries: PrescriptionEntry[] = [
  {
    id: 'combination-medicine',
    name: 'Amantadina / clorfeniramina / paracetamol (solución infantil)',
    detail: 'Dar 2.5 ml cada 8 horas durante 5 días.',
    uncertainty: 'Verifica el nombre del producto y la indicación con la receta.',
    schedule: {
      dose: { min: 2.5, max: 2.5, unit: 'ml' },
      route: '',
      intervalHours: 8,
      durationDays: 5,
      durationRange: null,
    },
  },
  {
    id: 'bromhexine',
    name: 'Bromhexina (solución infantil)',
    detail: 'Dar 1.5 ml cada 8 horas durante 10 días.',
    uncertainty: 'Verifica la cantidad y la indicación con la receta.',
    schedule: {
      dose: { min: 1.5, max: 1.5, unit: 'ml' },
      route: '',
      intervalHours: 8,
      durationDays: 10,
      durationRange: null,
    },
  },
  {
    id: 'colifrin',
    name: 'Collifrin (infantil)',
    detail: 'Aplicar 1 a 2 gotas en cada fosa nasal cada 12 horas durante 3 a 5 días.',
    uncertainty: 'Elige la duración indicada dentro del rango de 3 a 5 días para calcular el calendario.',
    schedule: {
      dose: { min: 1, max: 2, unit: 'gotas' },
      route: 'Nasal',
      intervalHours: 12,
      durationDays: null,
      durationRange: { min: 3, max: 5 },
    },
  },
  {
    id: 'amoxicillin-clavulanate',
    name: 'Amoxicilina / ácido clavulánico',
    detail: 'Suspensión 125 mg / 5 ml: dar 5 ml cada 8 horas durante 7 días.',
    uncertainty: 'Verifica la presentación y la indicación con la receta.',
    schedule: {
      dose: { min: 5, max: 5, unit: 'ml' },
      route: '',
      intervalHours: 8,
      durationDays: 7,
      durationRange: null,
    },
  },
]
