import type { PrescriptionEntry } from '../domain/model'
import {
  getDoseTimePreview,
  getScheduleRule,
  getScheduledDoseTimes,
  hasValidDoseAmount,
} from '../domain/schedule'
import { DoseTimePreview } from './DoseTimePreview'

type ScheduleSetupProps = {
  prescriptionEntries: PrescriptionEntry[]
  firstDoseTimes: Record<string, string>
  scheduleReady: boolean
  scheduleBlockers: string[]
  scheduleError: string
  onDurationChange: (entryId: string, value: string) => void
  onFirstDoseTimeChange: (entryId: string, value: string) => void
  onCorrectEntry: (entry: PrescriptionEntry) => void
  onBack: () => void
  onCreateSchedule: () => void
}

export function ScheduleSetup({
  prescriptionEntries,
  firstDoseTimes,
  scheduleReady,
  scheduleBlockers,
  scheduleError,
  onDurationChange,
  onFirstDoseTimeChange,
  onCorrectEntry,
  onBack,
  onCreateSchedule,
}: ScheduleSetupProps) {
  return (
    <div className="schedule-setup">
      <div className={scheduleReady ? 'setup-checklist is-ready' : 'setup-checklist'} role="status" aria-live="polite">
        <strong>
          {scheduleReady
            ? 'Todo listo para crear el calendario.'
            : `Faltan ${scheduleBlockers.length} pasos para mostrarlo:`}
        </strong>
        {!scheduleReady && (
          <ul>
            {scheduleBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
          </ul>
        )}
      </div>
      {prescriptionEntries.map((item) => {
        const rule = getScheduleRule(item.schedule)
        const durationRange = rule.durationRange
        const ruleIsValid = hasValidDoseAmount(item.schedule)
          && rule.intervalHours !== null
          && rule.totalDoses !== null
          && rule.totalDoses > 0
        const doseLabel = item.schedule.dose.min !== null
          ? `${item.schedule.dose.min === item.schedule.dose.max
            ? item.schedule.dose.min
            : `${item.schedule.dose.min}–${item.schedule.dose.max}`} ${item.schedule.dose.unit}`
          : ''
        const firstDoseTime = firstDoseTimes[item.id]
          ? new Date(firstDoseTimes[item.id])
          : null
        const previewTimes = rule.intervalHours !== null
          && rule.totalDoses !== null
          && rule.totalDoses > 0
          && firstDoseTime
          && Number.isFinite(firstDoseTime.getTime())
          ? getScheduledDoseTimes(firstDoseTime, rule.intervalHours, rule.totalDoses)
          : []

        return (
          <article className="schedule-setup-item" key={item.id}>
            <div>
              <h3>{item.name}</h3>
              <p>{item.detail}</p>
            </div>
            {durationRange && (
              <>
                <label htmlFor={`duration-${item.id}`}>
                  Duración del tratamiento (elige de {durationRange.min} a {durationRange.max} días)
                </label>
                <select
                  id={`duration-${item.id}`}
                  value={item.schedule.durationDays ?? ''}
                  onChange={(event) => onDurationChange(item.id, event.target.value)}
                >
                  <option value="">Selecciona los días</option>
                  {Array.from(
                    { length: durationRange.max - durationRange.min + 1 },
                    (_, index) => durationRange.min + index,
                  ).map((days) => (
                    <option key={days} value={days}>{days} días</option>
                  ))}
                </select>
              </>
            )}
            {rule.intervalHours !== null && (
              <p className="schedule-rule">
                {doseLabel && `${doseLabel} · `}
                {rule.totalDoses !== null
                  ? `${rule.totalDoses} ${rule.totalDoses === 1 ? 'toma' : 'tomas'} · cada ${rule.intervalHours} horas`
                  : `Cada ${rule.intervalHours} horas`}
              </p>
            )}
            {ruleIsValid ? (
              <>
                <label htmlFor={`first-dose-${item.id}`}>Fecha y hora de la primera toma</label>
                <input
                  id={`first-dose-${item.id}`}
                  type="datetime-local"
                  value={firstDoseTimes[item.id] ?? ''}
                  onChange={(event) => onFirstDoseTimeChange(item.id, event.target.value)}
                />
              </>
            ) : hasValidDoseAmount(item.schedule)
              && durationRange
              && rule.intervalHours !== null ? (
              <p className="duration-choice-help">Elige la duración para calcular cuántas tomas aparecerán.</p>
            ) : (
              <div className="schedule-blocked">
                <p>No se pudo leer con certeza la frecuencia o duración de esta indicación.</p>
                <button
                  type="button"
                  className="edit-entry-button"
                  onClick={() => onCorrectEntry(item)}
                >
                  Corregir indicación
                </button>
              </div>
            )}
            <DoseTimePreview
              preview={getDoseTimePreview(previewTimes)}
              title="Así quedarían las próximas tomas"
            />
          </article>
        )
      })}

      {scheduleError && <p className="file-error" role="alert">{scheduleError}</p>}
      <div className="schedule-actions">
        <button
          type="button"
          className="cancel-edit-button"
          onClick={onBack}
        >
          Volver a revisar
        </button>
        <button
          type="button"
          className="save-edit-button"
          disabled={!scheduleReady}
          onClick={onCreateSchedule}
        >
          Crear calendario
        </button>
      </div>
      <p className="edit-help">No se enviarán notificaciones. El calendario se guarda automáticamente en este navegador.</p>
    </div>
  )
}
