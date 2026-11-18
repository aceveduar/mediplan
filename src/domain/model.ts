export type PrescriptionEntry = {
  id: string
  name: string
  detail: string
  uncertainty: string
  schedule: PrescriptionSchedule
}

export type DoseAmount = {
  min: number | null
  max: number | null
  unit: string
}

export type PrescriptionSchedule = {
  dose: DoseAmount
  route: string
  intervalHours: number | null
  durationDays: number | null
  durationRange: { min: number; max: number } | null
}

export type DoseStatus = 'pending' | 'given' | 'skipped'

export type ScheduledDose = {
  id: string
  medicationName: string
  instructions: string
  scheduledAt: Date
  administeredAt: Date | null
  status: DoseStatus
}
