import { CheckCircle2 } from 'lucide-react'
import type { DoseStatus } from '../domain/model'

type PlanStatusBannerProps = {
  hasActivePlan: boolean
  totalDoses: number
  statusCounts: Record<DoseStatus, number>
  confirmedCount: number
  prescriptionCount: number
  onReviewPrescription: () => void
}

export function PlanStatusBanner({
  hasActivePlan,
  totalDoses,
  statusCounts,
  confirmedCount,
  prescriptionCount,
  onReviewPrescription,
}: PlanStatusBannerProps) {
  if (hasActivePlan) {
    return (
      <div className="schedule-success plan-status-banner" role="status">
        <CheckCircle2 size={20} />
        <div className="plan-status-copy">
          <strong>Plan activo</strong>
          <span>
            {totalDoses} {totalDoses === 1 ? 'toma' : 'tomas'} en el calendario
            {' · '}{statusCounts.pending} por dar
            {' · '}{statusCounts.given} {statusCounts.given === 1 ? 'administrada' : 'administradas'}
            {' · '}{statusCounts.skipped} {statusCounts.skipped === 1 ? 'omitida' : 'omitidas'}
          </span>
        </div>
      </div>
    )
  }

  const progress = prescriptionCount
    ? (confirmedCount / prescriptionCount) * 100
    : 0

  return (
    <div className="setup-progress-banner" role="status">
      <span className="setup-step-marker">1</span>
      <div className="setup-progress-copy">
        <span className="setup-progress-kicker">PASO 1 DE 2</span>
        <strong>Revisa las indicaciones</strong>
        <span>Confirma cada medicamento con la receta antes de crear el calendario.</span>
      </div>
      <div className="setup-progress-count">
        <strong>{confirmedCount}/{prescriptionCount}</strong>
        <span>confirmadas</span>
        <div className="setup-progress-track" aria-hidden="true">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <button
        type="button"
        className="setup-progress-action"
        onClick={onReviewPrescription}
      >
        Revisar indicaciones
      </button>
    </div>
  )
}
