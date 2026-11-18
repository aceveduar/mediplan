import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileText, Sparkles, Upload } from 'lucide-react'

export function PrescriptionFileAttachment() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedFileName = selectedFile?.name ?? ''

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!acceptedTypes.includes(file.type)) {
      setFileError('Selecciona una imagen JPG, PNG, WebP o un archivo PDF.')
      setSelectedFile(null)
      setPreviewUrl('')
      event.target.value = ''
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError('El archivo supera el límite de 10 MB.')
      setSelectedFile(null)
      setPreviewUrl('')
      event.target.value = ''
      return
    }

    setFileError('')
    setSelectedFile(file)
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : '')
  }

  const removeSelectedFile = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="upload-card card-surface">
      <div className="upload-header">
        <div className="status-pill">
          <Sparkles size={15} />
          {selectedFileName ? 'Archivo de referencia' : 'Revisión de indicaciones'}
        </div>
        <span className="muted">
          {selectedFileName ? 'Vista previa en este dispositivo' : 'Adjunto opcional'}
        </span>
      </div>

      <div className="upload-body">
        <button
          type="button"
          className="upload-box"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={28} />
          <strong>{selectedFileName ? 'Cambiar archivo' : 'Añadir foto o PDF (opcional)'}</strong>
          <span>JPG, PNG, WebP o PDF · solo vista previa</span>
        </button>
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileSelection}
          aria-label="Seleccionar archivo de receta"
        />

        <div className="meta-list">
          <div>
            <span className="label">Privacidad</span>
            <strong>Datos guardados en este dispositivo</strong>
          </div>
          <div>
            <span className="label">Archivo</span>
            <strong>{selectedFileName ? 'Vista previa temporal' : 'No necesitas adjuntarlo'}</strong>
          </div>
        </div>
      </div>
      {fileError && <p className="file-error" role="alert">{fileError}</p>}
      {selectedFileName && (
        <div className="selected-file-card" role="status">
          {previewUrl ? (
            <img className="file-preview" src={previewUrl} alt={`Vista previa de ${selectedFileName}`} />
          ) : (
            <div className="file-preview-placeholder"><FileText size={28} /></div>
          )}
          <div className="selected-file-details">
            <strong>{selectedFileName}</strong>
            <span>Vista previa en este navegador · no se procesa ni se guarda</span>
            <button
              type="button"
              className="remove-file-button"
              onClick={removeSelectedFile}
            >
              Quitar archivo
            </button>
          </div>
        </div>
      )}
      <p className="file-notice">
        Adjuntar la receta es opcional. El archivo solo se previsualiza aquí; MediPlan no lo interpreta ni lo envía a internet.
      </p>
    </div>
  )
}
