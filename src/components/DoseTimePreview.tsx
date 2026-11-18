import { AlertTriangle } from 'lucide-react'
import {
  formatScheduleTime,
  isNightTime,
  nightWindowLabel,
  getDoseTimePreview,
} from '../domain/schedule'

type DoseTimePreviewProps = {
  preview: ReturnType<typeof getDoseTimePreview>
  title: string
}

export function DoseTimePreview({ preview, title }: DoseTimePreviewProps) {
  if (preview.times.length === 0) return null

  return (
    <div className="dose-time-preview" aria-live="polite">
      <strong>{title}</strong>
      <ul className="dose-time-preview-list">
        {preview.times.map((time, index) => (
          <li className={isNightTime(time) ? 'is-night' : ''} key={`${time.toISOString()}-${index}`}>
            <time dateTime={time.toISOString()}>{formatScheduleTime(time, 'EEE d MMM')}</time>
            {isNightTime(time) && <span>Horario nocturno</span>}
          </li>
        ))}
      </ul>
      {preview.remainingCount > 0 && (
        <p className="dose-time-preview-remaining">
          Y {preview.remainingCount} {preview.remainingCount === 1 ? 'toma más' : 'tomas más'} según el mismo intervalo.
        </p>
      )}
      {preview.nightCount > 0 && (
        <p className="dose-time-preview-warning">
          <AlertTriangle size={16} />
          <span>
            {preview.nightCount} {preview.nightCount === 1 ? 'toma cae' : 'tomas caen'} entre {nightWindowLabel}.
            {' '}La vista previa respeta el intervalo indicado; consulta a un médico o farmacéutico antes de cambiarlo.
          </span>
        </p>
      )}
    </div>
  )
}
