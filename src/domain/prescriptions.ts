import type { PrescriptionEntry } from './model'

export const initialPrescriptionEntries: PrescriptionEntry[] = [
  {
    id: 'combination-medicine',
    name: 'Amantadina / clorfeniramina / paracetamol (solución infantil)',
    detail: 'Dar 2.5 ml cada 8 horas durante 5 días.',
    uncertainty: 'Verifica el nombre del producto y la indicación con la receta.',
  },
  {
    id: 'bromhexine',
    name: 'Bromhexina (solución infantil)',
    detail: 'Dar 1.5 ml cada 8 horas durante 10 días.',
    uncertainty: 'Verifica la cantidad y la indicación con la receta.',
  },
  {
    id: 'colifrin',
    name: 'Collifrin (infantil)',
    detail: 'Aplicar 1 a 2 gotas en cada fosa nasal cada 12 horas durante 3 a 5 días.',
    uncertainty: 'Elige la duración indicada dentro del rango de 3 a 5 días para calcular el calendario.',
  },
  {
    id: 'amoxicillin-clavulanate',
    name: 'Amoxicilina / ácido clavulánico',
    detail: 'Suspensión 125 mg / 5 ml: dar 5 ml cada 8 horas durante 7 días.',
    uncertainty: 'Verifica la presentación y la indicación con la receta.',
  },
]

export const previousPrescriptionDetails: Record<string, string> = {
  'combination-medicine': 'Parece indicar 2.5 ml cada 8 horas por 5 días.',
  bromhexine: 'Parece indicar 1.5 ml cada 8 horas por 10 días.',
  colifrin: 'Parece indicar 1–2 gotas cada 12 horas; la duración no se distingue con certeza.',
  'amoxicillin-clavulanate': 'Parece indicar suspensión 125/31.25 mg por 5 ml: 5 ml cada 8 horas por 7 días.',
}
