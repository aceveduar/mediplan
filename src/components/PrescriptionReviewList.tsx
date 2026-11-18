import type { ChangeEvent, Dispatch, SetStateAction } from 'react'
import { Pill } from 'lucide-react'
import type { PrescriptionEntry } from '../domain/model'
import type { PrescriptionEditValues } from '../domain/prescriptionEditing'
import { PrescriptionEditForm } from './PrescriptionEditForm'

type PrescriptionReviewListProps = {
  entries: PrescriptionEntry[]
  confirmedItems: string[]
  editingEntryId: string | null
  editValues: PrescriptionEditValues
  editError: string
  setEditValues: Dispatch<SetStateAction<PrescriptionEditValues>>
  setEditError: (error: string) => void
  onCancelEditing: () => void
  onSaveCorrection: (event: ChangeEvent<HTMLFormElement>, entryId: string) => void
  onBeginEditing: (entry: PrescriptionEntry) => void
  onToggleConfirmation: (entryId: string) => void
  onContinueToSchedule: () => void
}

export function PrescriptionReviewList({
  entries,
  confirmedItems,
  editingEntryId,
  editValues,
  editError,
  setEditValues,
  setEditError,
  onCancelEditing,
  onSaveCorrection,
  onBeginEditing,
  onToggleConfirmation,
  onContinueToSchedule,
}: PrescriptionReviewListProps) {
  const allItemsConfirmed = confirmedItems.length === entries.length

  return (
    <>
      <div className="review-progress" role="status" aria-live="polite">
        <span>{confirmedItems.length} de {entries.length} indicaciones revisadas</span>
        <div className="review-progress-track">
          <span style={{ width: `${(confirmedItems.length / entries.length) * 100}%` }} />
        </div>
      </div>

      <div className="prescription-list">
        {entries.map((item) => (
          <article className="prescription-item" key={item.id}>
            <div className="prescription-icon"><Pill size={18} /></div>
            {editingEntryId === item.id ? (
              <PrescriptionEditForm
                entryId={item.id}
                values={editValues}
                error={editError}
                setValues={setEditValues}
                setError={setEditError}
                onCancel={onCancelEditing}
                onSubmit={onSaveCorrection}
              />
            ) : (
              <>
                <div>
                  <h3>{item.name}</h3>
                  <p>{item.detail}</p>
                  <small>{item.uncertainty}</small>
                </div>
                <div className="prescription-actions">
                  <button
                    type="button"
                    className="edit-entry-button"
                    onClick={() => onBeginEditing(item)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`confirm-item-button ${confirmedItems.includes(item.id) ? 'is-confirmed' : ''}`}
                    aria-pressed={confirmedItems.includes(item.id)}
                    onClick={() => onToggleConfirmation(item.id)}
                  >
                    {confirmedItems.includes(item.id) ? 'Revisada ✓' : 'Coincide'}
                  </button>
                </div>
              </>
            )}
          </article>
        ))}
      </div>

      {allItemsConfirmed && (
        <div className="review-complete" role="status" aria-live="polite">
          <strong>Lectura revisada.</strong>
          <span>Siguiente: indicar cuándo será la primera toma de cada medicamento.</span>
          <button
            type="button"
            className="save-edit-button"
            onClick={onContinueToSchedule}
          >
            Continuar al calendario
          </button>
        </div>
      )}
    </>
  )
}
