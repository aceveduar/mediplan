import { AlertTriangle } from 'lucide-react'
import type { PrescriptionEntry } from '../domain/model'
import { getDoseTimePreview, getShiftedDoseTimes } from '../domain/schedule'
import { formatScheduleTime } from '../domain/schedule'
import type { AdjustableDoseSeries } from '../domain/scheduleAdjustment'
import { DoseTimePreview } from './DoseTimePreview'

type ScheduleAdjustmentPanelProps = {
  series: AdjustableDoseSeries[]
  prescriptionEntries: PrescriptionEntry[]
  adjustmentTimes: Record<string, string>
  confirmed: boolean
  error: string
  onChangeTime: (key: string, value: string) => void
  onConfirmChange: (confirmed: boolean) => void
  onCancel: () => void
  onApply: () => void
}

export function ScheduleAdjustmentPanel({
  series,
  prescriptionEntries,
  adjustmentTimes,
  confirmed,
  error,
  onChangeTime,
  onConfirmChange,
  onCancel,
  onApply,
}: ScheduleAdjustmentPanelProps) {
  const canApply = confirmed && series.some((item) => item.lockedCount === 0)

  return (
    <section
      className="schedule-adjustment-panel"
      id="schedule-adjustment-panel"
      aria-labelledby="schedule-adjustment-title"
    >
      <div className="schedule-adjustment-heading">
        <div>
          <p className="eyebrow">Solo pendientes futuras</p>
          <h4 id="schedule-adjustment-title">Ajustar el horario de un medicamento</h4>
          <p>
            Elige una nueva hora para la próxima toma pendiente. Las demás tomas futuras de ese
            medicamento se desplazarán lo mismo para conservar el intervalo actual.
          </p>
        </div>
      </div>

      <div className="schedule-adjustment-list">
        {series.map((item, index) => {
          const medication = prescriptionEntries.find((entry) =>
            item.doses[0].id.startsWith(`${entry.id}-`),
          )
          const intervalHours = medication?.schedule.intervalHours ?? null
          const selectedTime = adjustmentTimes[item.key]
          const previewStart = selectedTime ? new Date(selectedTime) : null
          const previewTimes = previewStart && Number.isFinite(previewStart.getTime())
            ? getShiftedDoseTimes(item.doses, previewStart)
            : []

          return (
            <div className="schedule-adjustment-item" key={item.key}>
              <div>
                <strong>{item.medicationName}</strong>
                <span>
                  Próxima: {formatScheduleTime(item.doses[0].scheduledAt, 'EEE d MMM')}
                  {' · '}{item.doses.length} {item.doses.length === 1 ? 'pendiente' : 'pendientes'}
                  {intervalHours ? ` · cada ${intervalHours} h` : ''}
                </span>
                {item.lockedCount > 0 && (
                  <span className="schedule-adjustment-locked">
                    Tiene {item.lockedCount} {item.lockedCount === 1
                      ? 'toma posterior ya registrada'
                      : 'tomas posteriores ya registradas'}; no se ajustará automáticamente.
                  </span>
                )}
              </div>
              <label htmlFor={`adjustment-time-${index}`}>
                Nuevo horario de la próxima toma
                <input
                  id={`adjustment-time-${index}`}
                  type="datetime-local"
                  value={adjustmentTimes[item.key] ?? ''}
                  disabled={item.lockedCount > 0}
                  onChange={(event) => onChangeTime(item.key, event.target.value)}
                />
              </label>
              <DoseTimePreview
                preview={getDoseTimePreview(previewTimes)}
                title="Así quedarían las próximas tomas"
              />
            </div>
          )
        })}
      </div>

      <p className="schedule-adjustment-notice">
        <AlertTriangle size={17} />
        <span>
          Úsalo solo si el médico o farmacéutico indicó un horario alternativo. Las tomas
          administradas, omitidas o con hora ya pasada no cambian; una toma atrasada no se
          reprograma automáticamente.
        </span>
      </p>

      <label className="schedule-adjustment-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => onConfirmChange(event.target.checked)}
        />
        Confirmo que este horario alternativo fue indicado por un profesional de salud.
      </label>

      {error && <p className="file-error" role="alert">{error}</p>}
      <div className="schedule-adjustment-actions">
        <button
          type="button"
          className="cancel-edit-button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="save-edit-button"
          disabled={!canApply}
          onClick={onApply}
        >
          Aplicar horario autorizado
        </button>
      </div>
    </section>
  )
}
