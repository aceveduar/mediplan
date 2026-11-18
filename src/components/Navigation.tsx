import { CalendarDays, FileText, List, Menu } from 'lucide-react'

type ScheduleView = 'today' | 'list' | 'calendar'

type SidebarProps = {
  collapsed: boolean
  scheduleView: ScheduleView
  hasActivePlan: boolean
  pendingCount: number
  isPrescriptionReviewOpen: boolean
  onToday: () => void
  onList: () => void
  onOpenReview: () => void
}

export function Sidebar({
  collapsed,
  scheduleView,
  hasActivePlan,
  pendingCount,
  isPrescriptionReviewOpen,
  onToday,
  onList,
  onOpenReview,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}
      id="primary-sidebar"
    >
      <div className="brand-wrap">
        <div className="brand-mark">M</div>
        <div>
          <p className="eyebrow">Seguimiento familiar</p>
          <h2>MediPlan</h2>
        </div>
      </div>

      <nav className="nav-menu" aria-label="Navegación principal">
        <button
          type="button"
          className={`nav-item ${scheduleView !== 'list' ? 'active' : ''}`}
          aria-current={scheduleView !== 'list' ? 'page' : undefined}
          aria-label="Calendario"
          title={collapsed ? 'Calendario' : undefined}
          onClick={onToday}
        >
          <CalendarDays size={18} />
          <span className="nav-label">Calendario</span>
        </button>
        <button
          type="button"
          className={`nav-item ${isPrescriptionReviewOpen ? 'active' : ''}`}
          aria-label="Recetas"
          aria-haspopup="dialog"
          aria-expanded={isPrescriptionReviewOpen}
          title={collapsed ? 'Recetas' : undefined}
          onClick={onOpenReview}
        >
          <FileText size={18} />
          <span className="nav-label">Recetas</span>
        </button>
        {hasActivePlan && (
          <button
            type="button"
            className={`nav-item ${scheduleView === 'list' ? 'active' : ''}`}
            aria-current={scheduleView === 'list' ? 'page' : undefined}
            aria-label="Lista"
            title={collapsed ? 'Lista' : undefined}
            onClick={onList}
          >
            <List size={18} />
            <span className="nav-label">Lista</span>
          </button>
        )}
      </nav>

      <div className="mini-card card-soft">
        <p className="label">{hasActivePlan ? 'Seguimiento' : 'Siguiente paso'}</p>
        <h3>{hasActivePlan ? `${pendingCount} por dar` : 'Revisar receta'}</h3>
        <span>
          {hasActivePlan
            ? 'Marca cada toma cuando la administres.'
            : 'Confirma la lectura antes de crear un plan.'}
        </span>
      </div>
    </aside>
  )
}

type MobileNavigationProps = {
  scheduleView: ScheduleView
  hasActivePlan: boolean
  isMenuOpen: boolean
  isPrescriptionReviewOpen: boolean
  onToday: () => void
  onList: () => void
  onOpenReview: () => void
  onToggleMenu: () => void
}

export function MobileNavigation({
  scheduleView,
  hasActivePlan,
  isMenuOpen,
  isPrescriptionReviewOpen,
  onToday,
  onList,
  onOpenReview,
  onToggleMenu,
}: MobileNavigationProps) {
  return (
    <nav
      className={`mobile-nav${hasActivePlan ? '' : ' is-setup'}`}
      aria-label="Navegación móvil"
    >
      <button
        type="button"
        className={`mobile-nav-item ${scheduleView === 'today' ? 'is-active' : ''}`}
        aria-current={scheduleView === 'today' ? 'page' : undefined}
        onClick={onToday}
      >
        <CalendarDays size={20} />
        <span>Hoy</span>
      </button>
      <button
        type="button"
        className={`mobile-nav-item ${isPrescriptionReviewOpen ? 'is-active' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={isPrescriptionReviewOpen}
        onClick={onOpenReview}
      >
        <FileText size={20} />
        <span>Recetas</span>
      </button>
      {hasActivePlan && (
        <button
          type="button"
          className={`mobile-nav-item ${scheduleView === 'list' ? 'is-active' : ''}`}
          aria-current={scheduleView === 'list' ? 'page' : undefined}
          onClick={onList}
        >
          <List size={20} />
          <span>Lista</span>
        </button>
      )}
      <button
        type="button"
        className={`mobile-nav-item ${isMenuOpen ? 'is-menu-open' : ''}`}
        aria-expanded={isMenuOpen}
        onClick={onToggleMenu}
      >
        <Menu size={20} />
        <span>Más</span>
      </button>
    </nav>
  )
}
