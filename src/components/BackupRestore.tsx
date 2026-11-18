import { useRef, useState, type ChangeEvent } from 'react'
import { AlertTriangle } from 'lucide-react'
import { parseAppDataBackup, type StoredAppData } from '../storage/appData'

type PendingBackup = {
  data: StoredAppData
  fileName: string
}

type BackupRestoreProps = {
  onRestore: (data: StoredAppData) => boolean
}

export function BackupRestore({ onRestore }: BackupRestoreProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingBackup, setPendingBackup] = useState<PendingBackup | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    setError('')
    setNotice('')
    setPendingBackup(null)
    try {
      const result = parseAppDataBackup(await file.text())
      if (!result.valid) {
        setError(result.error)
        return
      }
      setPendingBackup({ data: result.data, fileName: file.name })
    } catch (readError) {
      console.error('No se pudo leer el archivo de respaldo de MediPlan:', readError)
      setError('No se pudo leer el archivo de respaldo.')
    }
  }

  const confirmRestore = () => {
    if (!pendingBackup || !onRestore(pendingBackup.data)) return
    setPendingBackup(null)
    setNotice('Respaldo restaurado.')
    setError('')
  }

  return (
    <div className="backup-restore-controls">
      <button
        type="button"
        className="export-json-button"
        onClick={() => fileInputRef.current?.click()}
      >
        Restaurar respaldo JSON
      </button>
      <input
        ref={fileInputRef}
        className="file-input"
        type="file"
        accept=".json,application/json"
        aria-label="Seleccionar respaldo JSON"
        onChange={(event) => void handleFileSelection(event)}
      />
      {error && <p className="file-error" role="alert">{error}</p>}
      {notice && <p className="file-success" role="status">{notice}</p>}
      {pendingBackup && (
        <section
          className="plan-change-warning backup-import-confirmation"
          role="region"
          aria-live="polite"
          aria-labelledby="backup-import-title"
        >
          <AlertTriangle size={18} />
          <div>
            <strong id="backup-import-title">¿Reemplazar el plan actual?</strong>
            <p>
              Se sustituirán las indicaciones y los registros guardados por el contenido de
              {' '}{pendingBackup.fileName}. Esta acción no se puede deshacer.
            </p>
            <div className="plan-change-warning-actions">
              <button
                type="button"
                className="cancel-edit-button"
                onClick={() => {
                  setPendingBackup(null)
                  setError('')
                }}
              >
                Cancelar
              </button>
              <button type="button" className="save-edit-button" onClick={confirmRestore}>
                Reemplazar datos
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
