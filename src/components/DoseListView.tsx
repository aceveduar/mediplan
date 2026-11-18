import type { DoseStatus, ScheduledDose } from '../domain/model'
import { DoseCard } from './DoseCard'

export type DoseFilter = 'all' | DoseStatus

type DoseListViewProps = {
  filter: DoseFilter
  doses: ScheduledDose[]
  statusCounts: Record<DoseStatus, number>
  onChangeFilter: (filter: DoseFilter) => void
  onUpdateDoseStatus: (id: string, status: DoseStatus) => void
}

const filters: Array<[DoseFilter, string, (counts: Record<DoseStatus, number>, total: number) => number]> = [
  ['all', 'Todas', (_, total) => total],
  ['pending', 'Por dar', (counts) => counts.pending],
  ['given', 'Administradas', (counts) => counts.given],
  ['skipped', 'Omitidas', (counts) => counts.skipped],
]

export function DoseListView({
  filter,
  doses,
  statusCounts,
  onChangeFilter,
  onUpdateDoseStatus,
}: DoseListViewProps) {
  return (
    <>
      <div className="schedule-view-switch dose-filter-switch" role="group" aria-label="Filtrar tomas">
        {filters.map(([filterValue, label, getCount]) => (
          <button
            type="button"
            className={filter === filterValue ? 'is-active' : ''}
            aria-pressed={filter === filterValue}
            onClick={() => onChangeFilter(filterValue)}
            key={filterValue}
          >
            {label} <small>{getCount(statusCounts, doses.length)}</small>
          </button>
        ))}
      </div>
      <div className="dose-list-view">
        {doses.length > 0
          ? doses.map((dose) => (
              <DoseCard
                key={dose.id}
                dose={dose}
                onUpdateStatus={onUpdateDoseStatus}
              />
            ))
          : <p className="dose-filter-empty">No hay tomas en este estado.</p>}
      </div>
    </>
  )
}
