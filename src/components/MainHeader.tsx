import { Download, FileText, Menu } from 'lucide-react'

type MainHeaderProps = {
  patientName: string
  isSidebarCollapsed: boolean
  canInstall: boolean
  hasActivePlan: boolean
  onToggleSidebar: () => void
  onInstall: () => void
  onReviewPrescription: () => void
}

export function MainHeader({
  patientName,
  isSidebarCollapsed,
  canInstall,
  hasActivePlan,
  onToggleSidebar,
  onInstall,
  onReviewPrescription,
}: MainHeaderProps) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Plan de medicación</p>
        <h1>Plan de {patientName}</h1>
      </div>

      <div className="top-actions">
        <button
          type="button"
          className="sidebar-toggle"
          aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          aria-expanded={!isSidebarCollapsed}
          aria-controls="primary-sidebar"
          onClick={onToggleSidebar}
        >
          <Menu size={19} />
        </button>
        {canInstall && (
          <button
            type="button"
            className="ghost-btn"
            aria-label="Instalar MediPlan en el escritorio"
            title="Instalar MediPlan como una app"
            onClick={onInstall}
          >
            <Download size={16} />
            Instalar app
          </button>
        )}
        {hasActivePlan && (
          <button
            className="ghost-btn"
            type="button"
            aria-label="Revisar indicaciones de la receta"
            onClick={onReviewPrescription}
          >
            <FileText size={16} />
            Revisar indicaciones
          </button>
        )}
      </div>
    </header>
  )
}
