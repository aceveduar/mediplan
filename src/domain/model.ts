export type PrescriptionEntry = {
  id: string
  name: string
  detail: string
  uncertainty: string
  durationDays?: number
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
