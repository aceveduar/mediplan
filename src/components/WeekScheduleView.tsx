import { format, isSameDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarDays } from 'lucide-react'
import type { DoseStatus, ScheduledDose } from '../domain/model'
import { DoseCard } from './DoseCard'

type WeekScheduleViewProps = {
  days: Date[]
  events: ScheduledDose[]
  currentTime: Date
  selectedDay: Date
  selectedDayDoses: ScheduledDose[]
  onSelectDay: (day: Date) => void
  onUpdateDoseStatus: (id: string, status: DoseStatus) => void
  onGoToToday: () => void
}

export function WeekScheduleView({
  days,
  events,
  currentTime,
  selectedDay,
  selectedDayDoses,
  onSelectDay,
  onUpdateDoseStatus,
  onGoToToday,
}: WeekScheduleViewProps) {
  return (
    <>
      <div className="week-picker" role="group" aria-label="Seleccionar día de la semana">
        {days.map((day) => {
          const dayDoses = events.filter((dose) => isSameDay(dose.scheduledAt, day))
          const isSelected = isSameDay(day, selectedDay)
          const isToday = isSameDay(day, currentTime)
          return (
            <button
              type="button"
              className={`week-day-button${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
              aria-pressed={isSelected}
              aria-label={`${format(day, 'EEEE d MMMM', { locale: es })}, ${dayDoses.length} ${dayDoses.length === 1 ? 'toma' : 'tomas'}`}
              onClick={() => onSelectDay(day)}
              key={day.toISOString()}
            >
              <span>{format(day, 'EEE', { locale: es })}</span>
              <strong>{format(day, 'd')}</strong>
              <small>{dayDoses.length === 0 ? 'Sin tomas' : `${dayDoses.length} ${dayDoses.length === 1 ? 'toma' : 'tomas'}`}</small>
            </button>
          )
        })}
      </div>
      <section className="selected-day-agenda" aria-label={`Tomas de ${format(selectedDay, 'EEEE d MMMM', { locale: es })}`}>
        <div className="today-view-heading">
          <div>
            <p className="eyebrow">Agenda del día</p>
            <h4>{format(selectedDay, 'EEEE d MMMM', { locale: es })}</h4>
          </div>
          <span>{selectedDayDoses.length} {selectedDayDoses.length === 1 ? 'toma' : 'tomas'}</span>
        </div>
        {selectedDayDoses.length > 0 ? (
          <div className="dose-list-view">
            {selectedDayDoses.map((dose) => (
              <DoseCard
                key={dose.id}
                dose={dose}
                onUpdateStatus={onUpdateDoseStatus}
              />
            ))}
          </div>
        ) : (
          <div className="today-empty-state">
            <CalendarDays size={20} />
            <div>
              <strong>No hay tomas para este día</strong>
              <span>Elige otra fecha o vuelve a la semana actual.</span>
            </div>
            <button
              type="button"
              className="review-button"
              onClick={onGoToToday}
            >
              Ir a hoy
            </button>
          </div>
        )}
      </section>
    </>
  )
}
