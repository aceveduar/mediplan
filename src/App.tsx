import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import './App.css'
import type { PrescriptionEntry, ScheduledDose } from './domain/model'
import {
  buildPrescriptionCorrection,
  emptyPrescriptionEditValues,
  getPrescriptionEditValues,
} from './domain/prescriptionEditing'
import {
  getDoseSeriesKey,
  formatScheduleTime,
  sortDosesForTracking,
} from './domain/schedule'
import {
  calculateScheduleAdjustment,
  toLocalDateTimeValue,
  type AdjustableDoseSeries,
} from './domain/scheduleAdjustment'
import { toStoredAppData } from './storage/appData'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Sun,
} from 'lucide-react'
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { DoseListView, type DoseFilter } from './components/DoseListView'
import { MobileNavigation, Sidebar } from './components/Navigation'
import { PrescriptionReviewList } from './components/PrescriptionReviewList'
import {
  PrescriptionReviewDialog,
  type PendingPlanChange,
} from './components/PrescriptionReviewDialog'
import { ScheduleSetup } from './components/ScheduleSetup'
import { ScheduleAdjustmentPanel } from './components/ScheduleAdjustmentPanel'
import { TodayScheduleView } from './components/TodayScheduleView'
import { WeekScheduleView } from './components/WeekScheduleView'
import { PrescriptionFileAttachment } from './components/PrescriptionFileAttachment'
import { MainHeader } from './components/MainHeader'
import { PlanStatusBanner } from './components/PlanStatusBanner'
import { useMediPlan } from './hooks/useMediPlan'

const recipeAnalysis = {
  patient: 'Amelia',
}

type ScheduleView = 'today' | 'list' | 'calendar'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

function App() {
  const {
    prescriptionEntries,
    confirmedItems,
    firstDoseTimes,
    scheduleEvents,
    persistenceError,
    scheduleReady,
    scheduleBlockers,
    applyConfirmationToggle,
    applyDurationSelection,
    prepareEntryEdit,
    updatePrescriptionEntries,
    updateFirstDoseTime,
    updateDoseStatus,
    createSchedule,
    updateScheduleEvents,
  } = useMediPlan()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.matchMedia('(max-width: 980px)').matches,
  )
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isAppInstalled, setIsAppInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  const [installError, setInstallError] = useState('')
  const [isPrescriptionReviewOpen, setIsPrescriptionReviewOpen] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState(emptyPrescriptionEditValues)
  const [editError, setEditError] = useState('')
  const [pendingPlanChange, setPendingPlanChange] = useState<PendingPlanChange | null>(null)
  const [isScheduleSetupOpen, setIsScheduleSetupOpen] = useState(false)
  const [scheduleView, setScheduleView] = useState<ScheduleView>('today')
  const [doseFilter, setDoseFilter] = useState<DoseFilter>('all')
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [isScheduleAdjustmentOpen, setIsScheduleAdjustmentOpen] = useState(false)
  const [scheduleAdjustmentTimes, setScheduleAdjustmentTimes] = useState<Record<string, string>>({})
  const [scheduleAdjustmentConfirmed, setScheduleAdjustmentConfirmed] = useState(false)
  const [scheduleAdjustmentError, setScheduleAdjustmentError] = useState('')
  const [visibleWeekStart, setVisibleWeekStart] = useState(
    () => startOfWeek(currentTime, { weekStartsOn: 1 }),
  )
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(() => currentTime)
  const [scheduleError, setScheduleError] = useState('')
  const reviewModalRef = useRef<HTMLElement>(null)
  const reviewCloseRef = useRef<HTMLButtonElement>(null)
  const focusReturnRef = useRef<HTMLElement | null>(null)
  const closePrescriptionReview = () => {
    setPendingPlanChange(null)
    setIsPrescriptionReviewOpen(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setCurrentTime(new Date()), 60_000)
    return () => window.clearTimeout(timeoutId)
  }, [currentTime])

  useEffect(() => {
    const handleInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPromptEvent)
    }
    const handleAppInstalled = () => {
      setInstallPrompt(null)
      setIsAppInstalled(true)
    }

    window.addEventListener('beforeinstallprompt', handleInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallApp = async () => {
    if (!installPrompt) return
    setInstallError('')
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      setInstallPrompt(null)
      if (outcome === 'accepted') setIsAppInstalled(true)
    } catch (error) {
      console.error('No se pudo iniciar la instalación de MediPlan.', error)
      setInstallError('No se pudo iniciar la instalación. Prueba desde el menú del navegador.')
    }
  }

  useEffect(() => {
    if (!isPrescriptionReviewOpen) return
    reviewCloseRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePrescriptionReview()
        return
      }

      if (event.key !== 'Tab') return
      const focusable = reviewModalRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      focusReturnRef.current?.focus()
    }
  }, [isPrescriptionReviewOpen, isScheduleSetupOpen])

  const openPrescriptionReview = () => {
    focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIsPrescriptionReviewOpen(true)
  }
  const toggleConfirmation = (id: string) => {
    if (scheduleEvents.length > 0) {
      setPendingPlanChange({ type: 'confirmation', entryId: id })
      return
    }

    applyConfirmationToggle(id)
  }
  const updateDurationSelection = (id: string, value: string) => {
    if (scheduleEvents.length > 0) {
      setPendingPlanChange({ type: 'duration', entryId: id, value })
      return
    }

    applyDurationSelection(id, value)
  }
  const applyEntryEdit = (entry: PrescriptionEntry) => {
    setEditingEntryId(entry.id)
    setEditValues(getPrescriptionEditValues(entry))
    setEditError('')
    prepareEntryEdit(entry.id)
  }
  const beginEditing = (entry: PrescriptionEntry) => {
    if (scheduleEvents.length > 0) {
      setPendingPlanChange({ type: 'edit', entry })
      return
    }

    applyEntryEdit(entry)
  }
  const saveCorrection = (event: ChangeEvent<HTMLFormElement>, entryId: string) => {
    event.preventDefault()
    const entry = prescriptionEntries.find((item) => item.id === entryId)
    if (!entry) {
      setEditError('No se encontró el medicamento que intentas corregir.')
      return
    }
    const result = buildPrescriptionCorrection(entry, editValues)
    if (!result.valid) {
      setEditError(result.error)
      return
    }
    const nextEntries = prescriptionEntries.map((entry) =>
      entry.id === entryId ? result.entry : entry,
    )
    updatePrescriptionEntries(nextEntries)
    setEditingEntryId(null)
    setEditError('')
  }
  const generateSchedule = (replaceActivePlan = false) => {
    const result = createSchedule(replaceActivePlan)
    if (result.type === 'incomplete') {
      setScheduleError('Revisa todas las indicaciones y completa la primera toma de cada medicamento.')
      return
    }
    if (result.type === 'confirmation-required') {
      setPendingPlanChange({ type: 'regenerate' })
      return
    }
    if (result.type === 'invalid') {
      setScheduleError(result.medicationName
        ? `No se puede programar ${result.medicationName}. Revisa la frecuencia, duración y hora inicial.`
        : 'No hay indicaciones para generar el calendario.')
      return
    }

    setVisibleWeekStart(startOfWeek(result.firstDoseAt, { weekStartsOn: 1 }))
    setSelectedCalendarDay(result.firstDoseAt)
    setScheduleError('')
    setIsScheduleSetupOpen(false)
    closePrescriptionReview()
  }
  const confirmPendingPlanChange = () => {
    if (!pendingPlanChange) return

    const change = pendingPlanChange
    setPendingPlanChange(null)
    if (change.type === 'edit') applyEntryEdit(change.entry)
    else if (change.type === 'confirmation') applyConfirmationToggle(change.entryId)
    else if (change.type === 'duration') applyDurationSelection(change.entryId, change.value)
    else generateSchedule(true)
  }
  const downloadScheduleJson = () => {
    const savedData = toStoredAppData({
      prescriptionEntries,
      confirmedItems,
      firstDoseTimes,
      scheduleEvents,
    })
    const downloadUrl = URL.createObjectURL(
      new Blob([JSON.stringify(savedData, null, 2)], { type: 'application/json' }),
    )
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = 'mediplan-amelia.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)
  }
  const calendarDays = Array.from({ length: 7 }, (_, index) => addDays(visibleWeekStart, index))
  const selectedDayDoses = sortDosesForTracking(
    scheduleEvents.filter((dose) => isSameDay(dose.scheduledAt, selectedCalendarDay)),
  )
  const todaysDoses = sortDosesForTracking(
    scheduleEvents.filter((dose) => isSameDay(dose.scheduledAt, currentTime)),
  )
  const todaysPendingCount = todaysDoses.filter((dose) => dose.status === 'pending').length
  const todaysGivenCount = todaysDoses.filter((dose) => dose.status === 'given').length
  const todaysSkippedCount = todaysDoses.filter((dose) => dose.status === 'skipped').length
  const nextTodayDose = todaysDoses.find((dose) => dose.status === 'pending')
  const statusCounts = {
    pending: scheduleEvents.filter((dose) => dose.status === 'pending').length,
    given: scheduleEvents.filter((dose) => dose.status === 'given').length,
    skipped: scheduleEvents.filter((dose) => dose.status === 'skipped').length,
  }
  const adjustableDoseGroups: AdjustableDoseSeries[] = Array.from(
    scheduleEvents
      .filter((dose) => dose.status === 'pending' && dose.scheduledAt.getTime() > currentTime.getTime())
      .reduce((groups, dose) => {
        const key = getDoseSeriesKey(dose)
        const series = groups.get(key)
        if (series) series.push(dose)
        else groups.set(key, [dose])
        return groups
      }, new Map<string, ScheduledDose[]>()),
    ([key, doses]) => {
      doses.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
      const firstDose = doses[0]
      return {
        key,
        medicationName: firstDose.medicationName,
        instructions: firstDose.instructions,
        doses,
        lockedCount: scheduleEvents.filter((dose) => (
          getDoseSeriesKey(dose) === key
          && dose.status !== 'pending'
          && dose.scheduledAt.getTime() > currentTime.getTime()
          && dose.scheduledAt.getTime() >= firstDose.scheduledAt.getTime()
        )).length,
      }
    },
  )
  const canAdjustSchedule = adjustableDoseGroups.some((series) => series.lockedCount === 0)
  const nextPendingDose = scheduleEvents
    .filter((dose) => dose.status === 'pending')
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())[0]
  const filteredScheduleEvents = sortDosesForTracking(
    doseFilter === 'all'
      ? scheduleEvents
      : scheduleEvents.filter((dose) => dose.status === doseFilter),
  )
  const openScheduleAdjustment = () => {
    setScheduleAdjustmentError('')
    setScheduleAdjustmentConfirmed(false)
    setScheduleAdjustmentTimes(Object.fromEntries(
      adjustableDoseGroups.map((series) => [
        series.key,
        toLocalDateTimeValue(series.doses[0].scheduledAt),
      ]),
    ))
    setIsScheduleAdjustmentOpen(true)
  }
  const saveScheduleAdjustment = () => {
    const result = calculateScheduleAdjustment(
      scheduleEvents,
      adjustableDoseGroups,
      scheduleAdjustmentTimes,
      scheduleAdjustmentConfirmed,
    )
    if (!result.valid) {
      setScheduleAdjustmentError(result.error)
      return
    }

    updateScheduleEvents(result.scheduleEvents)
    setIsScheduleAdjustmentOpen(false)
    setScheduleAdjustmentTimes({})
    setScheduleAdjustmentConfirmed(false)
    setScheduleAdjustmentError('')
  }
  return (
    <>
      <a className="skip-link" href="#main-content">Ir al contenido principal</a>
      <div className={`app-shell ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${scheduleEvents.length > 0 ? 'has-active-plan' : 'is-setup'}`}>
      <Sidebar
        collapsed={isSidebarCollapsed}
        scheduleView={scheduleView}
        hasActivePlan={scheduleEvents.length > 0}
        pendingCount={statusCounts.pending}
        isPrescriptionReviewOpen={isPrescriptionReviewOpen}
        onToday={() => {
          setScheduleView('today')
          document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onList={() => {
          setScheduleView('list')
          document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onOpenReview={openPrescriptionReview}
      />

      <main className="main-panel" id="main-content">
        <MainHeader
          patientName={recipeAnalysis.patient}
          isSidebarCollapsed={isSidebarCollapsed}
          canInstall={Boolean(installPrompt && !isAppInstalled)}
          hasActivePlan={scheduleEvents.length > 0}
          onToggleSidebar={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
          onInstall={() => void handleInstallApp()}
          onReviewPrescription={openPrescriptionReview}
        />

        {installError && <p className="file-error" role="alert">{installError}</p>}

        <PlanStatusBanner
          hasActivePlan={scheduleEvents.length > 0}
          totalDoses={scheduleEvents.length}
          statusCounts={statusCounts}
          confirmedCount={confirmedItems.length}
          prescriptionCount={prescriptionEntries.length}
          onReviewPrescription={openPrescriptionReview}
        />
        {persistenceError && <p className="file-error" role="alert">{persistenceError}</p>}

        <section className="hero-grid">
          <PrescriptionFileAttachment />
        </section>

        <section className="content-grid">
          <div className="calendar-panel card-surface" id="calendar-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Calendario y seguimiento</p>
                <h3>Tomas de Amelia</h3>
              </div>
              {scheduleEvents.length > 0 && (
                <div className="section-actions">
                  {(isScheduleAdjustmentOpen || canAdjustSchedule) && (
                    <button
                      type="button"
                      className="review-button"
                      aria-expanded={isScheduleAdjustmentOpen}
                      aria-controls="schedule-adjustment-panel"
                      onClick={() => {
                        if (isScheduleAdjustmentOpen) setIsScheduleAdjustmentOpen(false)
                        else openScheduleAdjustment()
                      }}
                    >
                      {isScheduleAdjustmentOpen ? 'Cerrar ajuste' : 'Ajustar tomas futuras'}
                    </button>
                  )}
                  <button type="button" className="review-button" onClick={openPrescriptionReview}>
                    Revisar el plan
                  </button>
                </div>
              )}
            </div>

            {scheduleEvents.length > 0 && isScheduleAdjustmentOpen && (
              <ScheduleAdjustmentPanel
                series={adjustableDoseGroups}
                prescriptionEntries={prescriptionEntries}
                adjustmentTimes={scheduleAdjustmentTimes}
                confirmed={scheduleAdjustmentConfirmed}
                error={scheduleAdjustmentError}
                onChangeTime={(key, value) => {
                  setScheduleAdjustmentTimes((times) => ({ ...times, [key]: value }))
                  setScheduleAdjustmentError('')
                }}
                onConfirmChange={(confirmed) => {
                  setScheduleAdjustmentConfirmed(confirmed)
                  setScheduleAdjustmentError('')
                }}
                onCancel={() => setIsScheduleAdjustmentOpen(false)}
                onApply={saveScheduleAdjustment}
              />
            )}

            {scheduleEvents.length > 0 ? (
              <div className="generated-schedule">
                <div className={`tracking-overview ${scheduleView === 'today' ? 'is-today-view' : ''}`}>
                  <div className="today-summary" role="status" aria-live="polite">
                    <span className="overview-label">Resumen de hoy</span>
                    <strong>
                      {todaysDoses.length === 0
                        ? 'Sin tomas programadas'
                        : `${todaysGivenCount} de ${todaysDoses.length} ${todaysDoses.length === 1 ? 'toma administrada' : 'tomas administradas'}`}
                    </strong>
                    <span>
                      {todaysPendingCount} por dar · {todaysGivenCount} {todaysGivenCount === 1 ? 'administrada' : 'administradas'}
                      {' · '}{todaysSkippedCount} {todaysSkippedCount === 1 ? 'omitida' : 'omitidas'}
                    </span>
                    <div
                      className="today-progress-track"
                      role="img"
                      aria-label={todaysDoses.length === 0
                        ? 'Sin tomas programadas hoy'
                        : `${todaysGivenCount} de ${todaysDoses.length} ${todaysDoses.length === 1 ? 'toma administrada' : 'tomas administradas'} hoy`}
                    >
                      <span style={{
                        width: `${todaysDoses.length ? (todaysGivenCount / todaysDoses.length) * 100 : 0}%`,
                      }} />
                    </div>
                  </div>
                  {scheduleView !== 'today' && (
                    <div className="next-dose-summary">
                      <span className="overview-label">Siguiente por registrar</span>
                      {nextPendingDose ? (
                        <>
                          <time dateTime={nextPendingDose.scheduledAt.toISOString()}>
                            {formatScheduleTime(nextPendingDose.scheduledAt, 'EEE d MMM')}
                          </time>
                          <strong>{nextPendingDose.medicationName}</strong>
                        </>
                      ) : (
                        <strong>Todas las tomas tienen estado registrado.</strong>
                      )}
                    </div>
                  )}
                </div>
                <div className="schedule-toolbar">
                  <div className="schedule-view-switch" role="group" aria-label="Cambiar vista de tomas">
                    <button
                      type="button"
                      className={scheduleView === 'today' ? 'is-active' : ''}
                      aria-pressed={scheduleView === 'today'}
                      onClick={() => setScheduleView('today')}
                    >
                      <Sun size={16} /> Hoy
                      <small className="today-view-count">{todaysDoses.length}</small>
                    </button>
                    <button
                      type="button"
                      className={scheduleView === 'list' ? 'is-active' : ''}
                      aria-pressed={scheduleView === 'list'}
                      onClick={() => setScheduleView('list')}
                    >
                      <List size={16} /> Lista
                    </button>
                    <button
                      type="button"
                      className={scheduleView === 'calendar' ? 'is-active' : ''}
                      aria-pressed={scheduleView === 'calendar'}
                      onClick={() => setScheduleView('calendar')}
                    >
                      <CalendarDays size={16} /> Semana
                    </button>
                  </div>
                  {scheduleView === 'calendar' && (
                    <div className="week-navigation" aria-label="Navegar semanas">
                      <button
                        type="button"
                        aria-label="Semana anterior"
                        onClick={() => {
                          const previousWeek = subWeeks(visibleWeekStart, 1)
                          setVisibleWeekStart(previousWeek)
                          setSelectedCalendarDay(previousWeek)
                        }}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <strong>
                        {format(visibleWeekStart, 'd MMM', { locale: es })} – {format(calendarDays[6], 'd MMM yyyy', { locale: es })}
                      </strong>
                      <button
                        type="button"
                        className="week-today-button"
                        onClick={() => {
                          setVisibleWeekStart(startOfWeek(currentTime, { weekStartsOn: 1 }))
                          setSelectedCalendarDay(currentTime)
                        }}
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        aria-label="Semana siguiente"
                        onClick={() => {
                          const nextWeek = addWeeks(visibleWeekStart, 1)
                          setVisibleWeekStart(nextWeek)
                          setSelectedCalendarDay(nextWeek)
                        }}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>

                {scheduleView === 'today' && (
                  <TodayScheduleView
                    currentTime={currentTime}
                    doses={todaysDoses}
                    nextDoseId={nextTodayDose?.id}
                    onUpdateDoseStatus={updateDoseStatus}
                    onViewWeek={() => {
                      setVisibleWeekStart(startOfWeek(currentTime, { weekStartsOn: 1 }))
                      setSelectedCalendarDay(currentTime)
                      setScheduleView('calendar')
                    }}
                  />
                )}

                {scheduleView === 'list' && (
                  <DoseListView
                    filter={doseFilter}
                    doses={filteredScheduleEvents}
                    statusCounts={statusCounts}
                    onChangeFilter={setDoseFilter}
                    onUpdateDoseStatus={updateDoseStatus}
                  />
                )}
                {scheduleView === 'calendar' && (
                  <WeekScheduleView
                    days={calendarDays}
                    events={scheduleEvents}
                    currentTime={currentTime}
                    selectedDay={selectedCalendarDay}
                    selectedDayDoses={selectedDayDoses}
                    onSelectDay={setSelectedCalendarDay}
                    onUpdateDoseStatus={updateDoseStatus}
                    onGoToToday={() => {
                      setVisibleWeekStart(startOfWeek(currentTime, { weekStartsOn: 1 }))
                      setSelectedCalendarDay(currentTime)
                    }}
                  />
                )}
                <button type="button" className="export-json-button" onClick={downloadScheduleJson}>
                  Descargar respaldo JSON
                </button>
              </div>
            ) : (
              <div className="calendar-empty">
                <div className="empty-icon"><CalendarDays size={22} /></div>
                <p className="empty-kicker">TU PLAN, PASO A PASO</p>
                <h4>Aún no hay un horario</h4>
                <p>Confirma las indicaciones de la receta y define la fecha y hora de inicio. Después podrás registrar cada toma aquí.</p>
                <ol className="empty-steps" aria-label="Pasos para crear el calendario">
                  <li aria-current="step"><span>1</span>Revisa la receta</li>
                  <li><span>2</span>Define el inicio</li>
                  <li><span>3</span>Registra las tomas</li>
                </ol>
              </div>
            )}
          </div>
        </section>
      </main>
      <MobileNavigation
        scheduleView={scheduleView}
        hasActivePlan={scheduleEvents.length > 0}
        isMenuOpen={!isSidebarCollapsed}
        isPrescriptionReviewOpen={isPrescriptionReviewOpen}
        onToday={() => {
          setScheduleView('today')
          document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onList={() => {
          setScheduleView('list')
          document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })
        }}
        onOpenReview={openPrescriptionReview}
        onToggleMenu={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
      />
      {isPrescriptionReviewOpen && (
        <PrescriptionReviewDialog
          isScheduleSetupOpen={isScheduleSetupOpen}
          pendingPlanChange={pendingPlanChange}
          modalRef={reviewModalRef}
          closeButtonRef={reviewCloseRef}
          onClose={closePrescriptionReview}
          onCancelPlanChange={() => setPendingPlanChange(null)}
          onConfirmPlanChange={confirmPendingPlanChange}
        >
            {!isScheduleSetupOpen ? (
              <PrescriptionReviewList
                entries={prescriptionEntries}
                confirmedItems={confirmedItems}
                editingEntryId={editingEntryId}
                editValues={editValues}
                editError={editError}
                setEditValues={setEditValues}
                setEditError={setEditError}
                onCancelEditing={() => setEditingEntryId(null)}
                onSaveCorrection={saveCorrection}
                onBeginEditing={beginEditing}
                onToggleConfirmation={toggleConfirmation}
                onContinueToSchedule={() => {
                  setIsScheduleSetupOpen(true)
                  setScheduleError('')
                }}
              />
            ) : (
              <ScheduleSetup
                prescriptionEntries={prescriptionEntries}
                firstDoseTimes={firstDoseTimes}
                scheduleReady={scheduleReady}
                scheduleBlockers={scheduleBlockers}
                scheduleError={scheduleError}
                onDurationChange={(entryId, value) => {
                  updateDurationSelection(entryId, value)
                  setScheduleError('')
                }}
                onFirstDoseTimeChange={(entryId, value) => {
                  updateFirstDoseTime(entryId, value)
                  setScheduleError('')
                }}
                onCorrectEntry={(entry) => {
                  setIsScheduleSetupOpen(false)
                  beginEditing(entry)
                }}
                onBack={() => setIsScheduleSetupOpen(false)}
                onCreateSchedule={() => generateSchedule()}
              />
            )}
        </PrescriptionReviewDialog>
      )}
      </div>
    </>
  )
}

export default App
