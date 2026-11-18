import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Sun } from 'lucide-react'
import type { DoseStatus, ScheduledDose } from '../domain/model'
import { DoseCard } from './DoseCard'

type TodayScheduleViewProps = {
  currentTime: Date
  doses: ScheduledDose[]
  nextDoseId?: string
  onUpdateDoseStatus: (id: string, status: DoseStatus) => void
  onViewWeek: () => void
}

export function TodayScheduleView({
  currentTime,
  doses,
  nextDoseId,
  onUpdateDoseStatus,
  onViewWeek,
}: TodayScheduleViewProps) {
  return (
    <section className="today-view" aria-label="Tomas de hoy">
      <div className="today-view-heading">
        <div>
          <p className="eyebrow">Agenda de hoy</p>
          <h4>{format(currentTime, 'EEEE d MMMM', { locale: es })}</h4>
        </div>
        <span>{doses.length} {doses.length === 1 ? 'toma' : 'tomas'}</span>
      </div>
      {doses.length > 0 ? (
        <div className="dose-list-view today-dose-list">
          {doses.map((dose) => (
            <DoseCard
              key={dose.id}
              dose={dose}
              isNextDose={dose.id === nextDoseId}
              onUpdateStatus={onUpdateDoseStatus}
            />
          ))}
        </div>
      ) : (
        <div className="today-empty-state">
          <Sun size={20} />
          <div>
            <strong>No hay tomas programadas para hoy</strong>
            <span>Consulta la semana para ver las próximas fechas del plan.</span>
          </div>
          <button
            type="button"
            className="review-button"
            onClick={onViewWeek}
          >
            Ver semana
          </button>
        </div>
      )}
    </section>
  )
}
