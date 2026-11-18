import type { ReactNode, RefObject } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import type { PrescriptionEntry } from '../domain/model'

export type PendingPlanChange =
  | { type: 'edit'; entry: PrescriptionEntry }
  | { type: 'confirmation'; entryId: string }
  | { type: 'duration'; entryId: string; value: string }
  | { type: 'regenerate' }

type PrescriptionReviewDialogProps = {
  isScheduleSetupOpen: boolean
  pendingPlanChange: PendingPlanChange | null
  modalRef: RefObject<HTMLElement | null>
  closeButtonRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
  onCancelPlanChange: () => void
  onConfirmPlanChange: () => void
  children: ReactNode
}

export function PrescriptionReviewDialog({
  isScheduleSetupOpen,
  pendingPlanChange,
  modalRef,
  closeButtonRef,
  onClose,
  onCancelPlanChange,
  onConfirmPlanChange,
  children,
}: PrescriptionReviewDialogProps) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        ref={modalRef}
        className="review-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">
              {isScheduleSetupOpen ? 'Paso 2 · Inicio del tratamiento' : 'Paso 1 · Revisar la receta'}
            </p>
            <h2 id="review-title">
              {isScheduleSetupOpen ? '¿Cuándo empieza cada medicamento?' : 'Revisa los medicamentos'}
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="modal-close"
            aria-label="Cerrar revisión"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>

        <div className="safety-notice" role="alert">
          <AlertTriangle size={20} />
          <p>
            {isScheduleSetupOpen
              ? 'Indica la fecha y hora de la primera toma tal como te la indicó el profesional. Las siguientes se espaciarán según la frecuencia revisada.'
              : <>Compara cada indicación con la receta original. Pulsa <strong>“Coincide”</strong> solo si puedes confirmar claramente el medicamento y sus instrucciones. Si algo no se entiende, déjalo sin marcar y consúltalo con el médico o farmacéutico.</>}
          </p>
        </div>

        {pendingPlanChange && (
          <div className="plan-change-warning" role="alert">
            <AlertTriangle size={18} />
            <div>
              <strong>Se reemplazará el calendario activo</strong>
              <p>
                {pendingPlanChange.type === 'regenerate'
                  ? 'Se perderá el registro de las tomas ya marcadas y todas volverán a estado pendiente.'
                  : 'Se borrarán las tomas programadas y sus estados. Después tendrás que revisar las indicaciones y crear un calendario nuevo.'}
              </p>
              <div className="plan-change-warning-actions">
                <button
                  type="button"
                  className="cancel-edit-button"
                  onClick={onCancelPlanChange}
                >
                  Conservar el calendario
                </button>
                <button
                  type="button"
                  className="save-edit-button"
                  onClick={onConfirmPlanChange}
                >
                  {pendingPlanChange.type === 'regenerate' ? 'Recrear calendario' : 'Eliminarlo y continuar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {children}

        <div className="modal-footer">
          <span>Se guarda automáticamente como JSON en este navegador; no se sube a internet.</span>
          <button
            type="button"
            className="ghost-btn"
            onClick={onClose}
          >
            Entendido
          </button>
        </div>
      </section>
    </div>
  )
}
