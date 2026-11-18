import { CheckCircle2 } from 'lucide-react'
import type { DoseStatus, ScheduledDose } from '../domain/model'
import { isSameDay } from 'date-fns'
import { formatScheduleTime } from '../domain/schedule'

type DoseCardProps = {
  dose: ScheduledDose
  compact?: boolean
  isNextDose?: boolean
  onUpdateStatus: (id: string, status: DoseStatus) => void
}

export function DoseCard({
  dose,
  compact = false,
  isNextDose = false,
  onUpdateStatus,
}: DoseCardProps) {
  return (
    <article
      className={`dose-card dose-card-${dose.status}${compact ? ' dose-card-compact' : ''}${isNextDose ? ' dose-card-next' : ''}`}
      title={`${dose.medicationName} · ${dose.instructions}`}
    >
      <div className="dose-card-heading">
        <time dateTime={dose.scheduledAt.toISOString()}>
          {formatScheduleTime(dose.scheduledAt, compact ? undefined : 'EEE d MMM')}
        </time>
        <span className={`dose-status dose-status-${dose.status}`}>
          {compact
            ? dose.status === 'given' ? 'Dada' : dose.status === 'skipped' ? 'Omitida' : 'Pendiente'
            : dose.status === 'given' ? 'Administrada' : dose.status === 'skipped' ? 'Omitida' : 'Por dar'}
        </span>
        {isNextDose && <span className="dose-priority-label">Siguiente</span>}
      </div>
      <strong>{dose.medicationName}</strong>
      {dose.status === 'given' && dose.administeredAt && (
        <span className={`dose-actual-time${compact ? ' is-compact' : ''}`}>
          <CheckCircle2 size={12} />
          {compact
            ? 'Real'
            : isSameDay(dose.administeredAt, dose.scheduledAt) ? 'Administrada' : 'Administrada el'}
          {' '}{formatScheduleTime(
            dose.administeredAt,
            isSameDay(dose.administeredAt, dose.scheduledAt) ? undefined : 'd MMM',
          )}
        </span>
      )}
      {!compact && <span className="dose-instructions">{dose.instructions}</span>}
      <div className="dose-card-actions">
        {dose.status === 'pending' ? (
          <>
            <button
              type="button"
              className="dose-action-primary"
              aria-label={`Marcar ${dose.medicationName} como administrada`}
              onClick={() => onUpdateStatus(dose.id, 'given')}
            >
              Ya la di
            </button>
            <button
              type="button"
              className="dose-action-secondary"
              aria-label={`Omitir toma de ${dose.medicationName}`}
              onClick={() => onUpdateStatus(dose.id, 'skipped')}
            >
              Omitir
            </button>
          </>
        ) : (
          <button
            type="button"
            className="dose-action-secondary"
            aria-label={`Volver a marcar ${dose.medicationName} por dar`}
            onClick={() => onUpdateStatus(dose.id, 'pending')}
          >
            Deshacer
          </button>
        )}
      </div>
    </article>
  )
}
