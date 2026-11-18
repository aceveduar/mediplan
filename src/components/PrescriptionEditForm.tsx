import type { ChangeEvent, Dispatch, SetStateAction } from 'react'

export type PrescriptionEditValues = {
  name: string
  detail: string
  doseMin: string
  doseMax: string
  doseUnit: string
  route: string
  intervalHours: string
  durationDays: string
  durationMin: string
  durationMax: string
}

type PrescriptionEditFormProps = {
  entryId: string
  values: PrescriptionEditValues
  error: string
  setValues: Dispatch<SetStateAction<PrescriptionEditValues>>
  setError: (error: string) => void
  onCancel: () => void
  onSubmit: (event: ChangeEvent<HTMLFormElement>, entryId: string) => void
}

export function PrescriptionEditForm({
  entryId,
  values,
  error,
  setValues,
  setError,
  onCancel,
  onSubmit,
}: PrescriptionEditFormProps) {
  const update = (field: keyof PrescriptionEditValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
  }

  return (
    <form
      className="prescription-edit-form"
      onSubmit={(event) => onSubmit(event, entryId)}
    >
      <label htmlFor={`medicine-name-${entryId}`}>Nombre del medicamento</label>
      <input
        id={`medicine-name-${entryId}`}
        value={values.name}
        onChange={(event) => update('name', event.target.value)}
        autoFocus
      />
      <label htmlFor={`medicine-detail-${entryId}`}>Dosis e indicaciones tal como aparecen</label>
      <textarea
        id={`medicine-detail-${entryId}`}
        rows={3}
        value={values.detail}
        onChange={(event) => update('detail', event.target.value)}
      />
      <p className="edit-help">
        La indicación original se conserva. Completa los campos estructurados copiando la receta;
        MediPlan no los interpreta automáticamente.
      </p>
      <div className="prescription-schedule-fields">
        <label htmlFor={`dose-min-${entryId}`}>
          Cantidad mínima
          <input
            id={`dose-min-${entryId}`}
            type="number"
            min="0"
            step="any"
            value={values.doseMin}
            onChange={(event) => update('doseMin', event.target.value)}
            required
          />
        </label>
        <label htmlFor={`dose-max-${entryId}`}>
          Cantidad máxima (si aplica)
          <input
            id={`dose-max-${entryId}`}
            type="number"
            min="0"
            step="any"
            value={values.doseMax}
            onChange={(event) => update('doseMax', event.target.value)}
          />
        </label>
        <label htmlFor={`dose-unit-${entryId}`}>
          Unidad (ml, gotas, etc.)
          <input
            id={`dose-unit-${entryId}`}
            value={values.doseUnit}
            onChange={(event) => update('doseUnit', event.target.value)}
            required
          />
        </label>
        <label htmlFor={`dose-route-${entryId}`}>
          Vía (solo si está indicada)
          <input
            id={`dose-route-${entryId}`}
            value={values.route}
            onChange={(event) => update('route', event.target.value)}
          />
        </label>
        <label htmlFor={`dose-interval-${entryId}`}>
          Intervalo (horas)
          <input
            id={`dose-interval-${entryId}`}
            type="number"
            min="1"
            step="1"
            value={values.intervalHours}
            onChange={(event) => update('intervalHours', event.target.value)}
            required
          />
        </label>
        <label htmlFor={`dose-duration-${entryId}`}>
          Duración fija (días)
          <input
            id={`dose-duration-${entryId}`}
            type="number"
            min="1"
            step="1"
            value={values.durationDays}
            onChange={(event) => update('durationDays', event.target.value)}
            required={values.durationMin === '' && values.durationMax === ''}
          />
        </label>
        <label htmlFor={`dose-duration-min-${entryId}`}>
          Duración mínima (si es un rango)
          <input
            id={`dose-duration-min-${entryId}`}
            type="number"
            min="1"
            step="1"
            value={values.durationMin}
            onChange={(event) => update('durationMin', event.target.value)}
          />
        </label>
        <label htmlFor={`dose-duration-max-${entryId}`}>
          Duración máxima (si es un rango)
          <input
            id={`dose-duration-max-${entryId}`}
            type="number"
            min="1"
            step="1"
            value={values.durationMax}
            onChange={(event) => update('durationMax', event.target.value)}
          />
        </label>
      </div>
      {error && <p className="file-error" role="alert">{error}</p>}
      <p className="edit-help">
        No calcules ni supongas lo que no se alcanza a leer.
        Si hay duda, consulta al médico o farmacéutico.
      </p>
      <div className="edit-actions">
        <button
          type="button"
          className="cancel-edit-button"
          onClick={() => {
            onCancel()
            setError('')
          }}
        >
          Cancelar
        </button>
        <button type="submit" className="save-edit-button">Guardar corrección</button>
      </div>
    </form>
  )
}
