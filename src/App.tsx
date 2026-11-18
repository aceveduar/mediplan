import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import './App.css'
import type { DoseStatus, PrescriptionEntry, ScheduledDose } from './domain/model'
import {
  getDoseSeriesKey,
  getScheduleRule,
  getScheduledDoseTimes,
  getShiftedDoseTimes,
  formatScheduleTime,
  hasValidDoseAmount,
  sortDosesForTracking,
} from './domain/schedule'
import { getInitialAppData, saveAppData, toStoredAppData } from './storage/appData'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  FileText,
  List,
  Menu,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react'
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { DoseListView, type DoseFilter } from './components/DoseListView'
import { MobileNavigation, Sidebar } from './components/Navigation'
import {
  type PrescriptionEditValues,
} from './components/PrescriptionEditForm'
import { PrescriptionReviewList } from './components/PrescriptionReviewList'
import {
  PrescriptionReviewDialog,
  type PendingPlanChange,
} from './components/PrescriptionReviewDialog'
import { ScheduleSetup } from './components/ScheduleSetup'
import {
  ScheduleAdjustmentPanel,
  type AdjustableDoseSeries,
} from './components/ScheduleAdjustmentPanel'
import { TodayScheduleView } from './components/TodayScheduleView'
import { WeekScheduleView } from './components/WeekScheduleView'

const recipeAnalysis = {
  patient: 'Amelia',
}

type ScheduleView = 'today' | 'list' | 'calendar'
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const emptyPrescriptionEditValues: PrescriptionEditValues = {
  name: '',
  detail: '',
  doseMin: '',
  doseMax: '',
  doseUnit: '',
  route: '',
  intervalHours: '',
  durationDays: '',
  durationMin: '',
  durationMax: '',
}

function getPrescriptionEditValues(entry: PrescriptionEntry): PrescriptionEditValues {
  return {
    name: entry.name,
    detail: entry.detail,
    doseMin: entry.schedule.dose.min?.toString() ?? '',
    doseMax: entry.schedule.dose.max?.toString() ?? '',
    doseUnit: entry.schedule.dose.unit,
    route: entry.schedule.route,
    intervalHours: entry.schedule.intervalHours?.toString() ?? '',
    durationDays: entry.schedule.durationDays?.toString() ?? '',
    durationMin: entry.schedule.durationRange?.min.toString() ?? '',
    durationMax: entry.schedule.durationRange?.max.toString() ?? '',
  }
}

function parsePositiveNumber(value: string) {
  const parsed = Number(value)
  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function App() {
  const [initialData] = useState(getInitialAppData)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => window.matchMedia('(max-width: 980px)').matches,
  )
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isAppInstalled, setIsAppInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  const [installError, setInstallError] = useState('')
  const [isPrescriptionReviewOpen, setIsPrescriptionReviewOpen] = useState(false)
  const [prescriptionEntries, setPrescriptionEntries] = useState(initialData.prescriptionEntries)
  const [confirmedItems, setConfirmedItems] = useState(initialData.confirmedItems)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState(emptyPrescriptionEditValues)
  const [editError, setEditError] = useState('')
  const [pendingPlanChange, setPendingPlanChange] = useState<PendingPlanChange | null>(null)
  const [isScheduleSetupOpen, setIsScheduleSetupOpen] = useState(false)
  const [firstDoseTimes, setFirstDoseTimes] = useState(initialData.firstDoseTimes)
  const [scheduleEvents, setScheduleEvents] = useState<ScheduledDose[]>(initialData.scheduleEvents)
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
  const [persistenceError, setPersistenceError] = useState(initialData.error)
  const [canPersist, setCanPersist] = useState(!initialData.error)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const reviewModalRef = useRef<HTMLElement>(null)
  const reviewCloseRef = useRef<HTMLButtonElement>(null)
  const focusReturnRef = useRef<HTMLElement | null>(null)
  const selectedFileName = selectedFile?.name ?? ''
  const closePrescriptionReview = () => {
    setPendingPlanChange(null)
    setIsPrescriptionReviewOpen(false)
  }

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

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

  const openFilePicker = () => fileInputRef.current?.click()
  const openPrescriptionReview = () => {
    focusReturnRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIsPrescriptionReviewOpen(true)
  }
  const persistAppState = (changes: {
    prescriptionEntries?: PrescriptionEntry[]
    confirmedItems?: string[]
    firstDoseTimes?: Record<string, string>
    scheduleEvents?: ScheduledDose[]
  } = {}) => {
    if (!canPersist) return

    try {
      const savedData = toStoredAppData({
        prescriptionEntries: changes.prescriptionEntries ?? prescriptionEntries,
        confirmedItems: changes.confirmedItems ?? confirmedItems,
        firstDoseTimes: changes.firstDoseTimes ?? firstDoseTimes,
        scheduleEvents: changes.scheduleEvents ?? scheduleEvents,
      })
      saveAppData(savedData)
      setPersistenceError('')
    } catch (error) {
      console.error('No se pudieron guardar los datos de MediPlan:', error)
      setPersistenceError('No se pudieron guardar los cambios en este navegador.')
      setCanPersist(false)
    }
  }
  const applyConfirmationToggle = (id: string) => {
    const nextConfirmedItems = confirmedItems.includes(id)
      ? confirmedItems.filter((item) => item !== id)
      : [...confirmedItems, id]
    setScheduleEvents([])
    setConfirmedItems(nextConfirmedItems)
    persistAppState({ confirmedItems: nextConfirmedItems, scheduleEvents: [] })
  }
  const toggleConfirmation = (id: string) => {
    if (scheduleEvents.length > 0) {
      setPendingPlanChange({ type: 'confirmation', entryId: id })
      return
    }

    applyConfirmationToggle(id)
  }
  const applyDurationSelection = (id: string, value: string) => {
    const durationDays = value ? Number(value) : null
    const nextEntries = prescriptionEntries.map((entry) => {
      if (entry.id !== id) return entry
      return {
        ...entry,
        schedule: { ...entry.schedule, durationDays },
      }
    })
    setPrescriptionEntries(nextEntries)
    setScheduleEvents([])
    persistAppState({ prescriptionEntries: nextEntries, scheduleEvents: [] })
  }
  const updateDurationSelection = (id: string, value: string) => {
    if (scheduleEvents.length > 0) {
      setPendingPlanChange({ type: 'duration', entryId: id, value })
      return
    }

    applyDurationSelection(id, value)
  }
  const updateDoseStatus = (id: string, status: DoseStatus) => {
    const nextEvents = scheduleEvents.map((dose) => (
      dose.id === id
        ? { ...dose, status, administeredAt: status === 'given' ? new Date() : null }
        : dose
    ))
    setScheduleEvents(nextEvents)
    persistAppState({ scheduleEvents: nextEvents })
  }
  const allItemsConfirmed = confirmedItems.length === prescriptionEntries.length
  const scheduleReady = prescriptionEntries.every((entry) => {
    const rule = getScheduleRule(entry.schedule)
    return hasValidDoseAmount(entry.schedule)
      && rule.intervalHours !== null
      && rule.totalDoses !== null
      && rule.totalDoses > 0
      && Boolean(firstDoseTimes[entry.id])
  })
  const scheduleBlockers = prescriptionEntries.flatMap((entry) => {
    const rule = getScheduleRule(entry.schedule)
    if (!hasValidDoseAmount(entry.schedule)) {
      return [`Completa la cantidad y unidad de ${entry.name} tal como aparecen en la receta.`]
    }
    if (rule.durationRange && rule.totalDoses === null) {
      return [`Elige entre ${rule.durationRange.min} y ${rule.durationRange.max} días para ${entry.name}.`]
    }
    if (rule.intervalHours === null || rule.totalDoses === null || rule.totalDoses <= 0) {
      return [`Completa el intervalo y la duración de ${entry.name} tal como aparecen en la receta.`]
    }
    return firstDoseTimes[entry.id]
      ? []
      : [`Elige cuándo será la primera toma de ${entry.name}.`]
  })
  const applyEntryEdit = (entry: PrescriptionEntry) => {
    const nextConfirmedItems = confirmedItems.filter((id) => id !== entry.id)
    const nextFirstDoseTimes = { ...firstDoseTimes }
    delete nextFirstDoseTimes[entry.id]
    setEditingEntryId(entry.id)
    setEditValues(getPrescriptionEditValues(entry))
    setEditError('')
    setScheduleEvents([])
    setFirstDoseTimes(nextFirstDoseTimes)
    setConfirmedItems(nextConfirmedItems)
    persistAppState({
      confirmedItems: nextConfirmedItems,
      firstDoseTimes: nextFirstDoseTimes,
      scheduleEvents: [],
    })
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
    if (!editValues.name.trim() || !editValues.detail.trim()) {
      setEditError('Completa el nombre y la indicación para guardar.')
      return
    }

    const doseMin = parsePositiveNumber(editValues.doseMin)
    const doseMax = editValues.doseMax.trim()
      ? parsePositiveNumber(editValues.doseMax)
      : doseMin
    const intervalHours = parsePositiveNumber(editValues.intervalHours)
    const durationDays = editValues.durationDays.trim()
      ? parsePositiveNumber(editValues.durationDays)
      : null
    const durationMin = editValues.durationMin.trim()
      ? parsePositiveNumber(editValues.durationMin)
      : null
    const durationMax = editValues.durationMax.trim()
      ? parsePositiveNumber(editValues.durationMax)
      : null
    const hasDurationRange = editValues.durationMin.trim() !== '' || editValues.durationMax.trim() !== ''
    let durationRange: { min: number; max: number } | null = null

    if (doseMin === null || doseMax === null || doseMax < doseMin || !editValues.doseUnit.trim()) {
      setEditError('Indica una cantidad válida y su unidad tal como aparecen en la receta.')
      return
    }
    if (intervalHours === null || !Number.isInteger(intervalHours)) {
      setEditError('Indica el intervalo en horas tal como aparece en la receta.')
      return
    }
    if (hasDurationRange) {
      if (
        durationDays !== null
        || durationMin === null
        || durationMax === null
        || !Number.isInteger(durationMin)
        || !Number.isInteger(durationMax)
        || durationMax < durationMin
      ) {
        setEditError('Completa una duración fija o un rango válido de días, no ambos.')
        return
      }
      durationRange = { min: durationMin, max: durationMax }
    } else if (durationDays === null || !Number.isInteger(durationDays)) {
      setEditError('Indica la duración en días tal como aparece en la receta.')
      return
    }

    const nextEntries = prescriptionEntries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            name: editValues.name.trim(),
            detail: editValues.detail.trim(),
            uncertainty: 'Corrección guardada; revisa de nuevo que coincida con la receta original.',
            schedule: {
              dose: {
                min: doseMin,
                max: doseMax,
                unit: editValues.doseUnit.trim(),
              },
              route: editValues.route.trim(),
              intervalHours,
              durationDays: hasDurationRange ? null : durationDays,
              durationRange,
            },
          }
        : entry,
    )
    setPrescriptionEntries(nextEntries)
    persistAppState({ prescriptionEntries: nextEntries })
    setEditingEntryId(null)
    setEditError('')
  }
  const generateSchedule = (replaceActivePlan = false) => {
    if (!allItemsConfirmed || !scheduleReady) {
      setScheduleError('Revisa todas las indicaciones y completa la primera toma de cada medicamento.')
      return
    }

    if (scheduleEvents.length > 0 && !replaceActivePlan) {
      setPendingPlanChange({ type: 'regenerate' })
      return
    }

    const generated: ScheduledDose[] = []
    for (const entry of prescriptionEntries) {
      const rule = getScheduleRule(entry.schedule)
      const firstDose = new Date(firstDoseTimes[entry.id])
      if (
        rule.intervalHours === null
        || rule.totalDoses === null
        || Number.isNaN(firstDose.getTime())
      ) {
        setScheduleError(`No se puede programar ${entry.name}. Revisa la frecuencia, duración y hora inicial.`)
        return
      }

      const scheduledTimes = getScheduledDoseTimes(firstDose, rule.intervalHours, rule.totalDoses)
      for (let doseIndex = 0; doseIndex < scheduledTimes.length; doseIndex += 1) {
        generated.push({
          id: `${entry.id}-${doseIndex}`,
          medicationName: entry.name,
          instructions: entry.detail,
          scheduledAt: scheduledTimes[doseIndex],
          administeredAt: null,
          status: 'pending',
        })
      }
    }

    generated.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    setScheduleEvents(generated)
    setVisibleWeekStart(startOfWeek(generated[0].scheduledAt, { weekStartsOn: 1 }))
    setSelectedCalendarDay(generated[0].scheduledAt)
    persistAppState({ scheduleEvents: generated })
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
    if (!scheduleAdjustmentConfirmed) {
      setScheduleAdjustmentError('Confirma que el horario alternativo fue indicado por el médico o farmacéutico.')
      return
    }

    const now = Date.now()
    const updatedTimes = new Map<string, Date>()
    let hasChanges = false

    for (const series of adjustableDoseGroups) {
      if (series.lockedCount > 0) continue
      const selectedTime = scheduleAdjustmentTimes[series.key]
      if (selectedTime === toLocalDateTimeValue(series.doses[0].scheduledAt)) continue
      const newFirstDose = new Date(selectedTime)
      if (Number.isNaN(newFirstDose.getTime()) || newFirstDose.getTime() <= now) {
        setScheduleAdjustmentError(`Elige una fecha futura para ${series.medicationName}.`)
        return
      }

      const offset = newFirstDose.getTime() - series.doses[0].scheduledAt.getTime()
      if (offset === 0) continue
      hasChanges = true

      const shiftedTimes = getShiftedDoseTimes(series.doses, newFirstDose)
      for (const [index, dose] of series.doses.entries()) {
        const scheduledAt = shiftedTimes[index]
        if (scheduledAt.getTime() <= now) {
          setScheduleAdjustmentError(`El nuevo horario de ${series.medicationName} deja una toma en el pasado.`)
          return
        }
        updatedTimes.set(dose.id, scheduledAt)
      }
    }

    if (!hasChanges) {
      setScheduleAdjustmentError('Cambia al menos una fecha u hora futura para guardar el ajuste.')
      return
    }

    const nextEvents = scheduleEvents
      .map((dose) => {
        const scheduledAt = updatedTimes.get(dose.id)
        return scheduledAt ? { ...dose, scheduledAt } : dose
      })
      .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    setScheduleEvents(nextEvents)
    persistAppState({ scheduleEvents: nextEvents })
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
        <header className="topbar">
          <div>
            <p className="eyebrow">Plan de medicación</p>
            <h1>Plan de {recipeAnalysis.patient}</h1>
          </div>

          <div className="top-actions">
            <button
              type="button"
              className="sidebar-toggle"
              aria-label={isSidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
              aria-expanded={!isSidebarCollapsed}
              aria-controls="primary-sidebar"
              onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
            >
              <Menu size={19} />
            </button>
            {installPrompt && !isAppInstalled && (
              <button
                type="button"
                className="ghost-btn"
                aria-label="Instalar MediPlan en el escritorio"
                title="Instalar MediPlan como una app"
                onClick={() => void handleInstallApp()}
              >
                <Download size={16} />
                Instalar app
              </button>
            )}
            {scheduleEvents.length > 0 && (
              <button
                className="ghost-btn"
                type="button"
                aria-label="Revisar indicaciones de la receta"
                onClick={openPrescriptionReview}
              >
                <FileText size={16} />
                Revisar indicaciones
              </button>
            )}
          </div>
        </header>

        {installError && <p className="file-error" role="alert">{installError}</p>}

        {scheduleEvents.length > 0 ? (
          <div className="schedule-success plan-status-banner" role="status">
            <CheckCircle2 size={20} />
            <div className="plan-status-copy">
              <strong>Plan activo</strong>
              <span>
                {scheduleEvents.length} {scheduleEvents.length === 1 ? 'toma' : 'tomas'} en el calendario
                {' · '}{statusCounts.pending} por dar
                {' · '}{statusCounts.given} {statusCounts.given === 1 ? 'administrada' : 'administradas'}
                {' · '}{statusCounts.skipped} {statusCounts.skipped === 1 ? 'omitida' : 'omitidas'}
              </span>
            </div>
          </div>
        ) : (
          <div className="setup-progress-banner" role="status">
            <span className="setup-step-marker">1</span>
            <div className="setup-progress-copy">
              <span className="setup-progress-kicker">PASO 1 DE 2</span>
              <strong>Revisa las indicaciones</strong>
              <span>Confirma cada medicamento con la receta antes de crear el calendario.</span>
            </div>
            <div className="setup-progress-count">
              <strong>{confirmedItems.length}/{prescriptionEntries.length}</strong>
              <span>confirmadas</span>
              <div className="setup-progress-track" aria-hidden="true">
                <span style={{ width: `${prescriptionEntries.length ? (confirmedItems.length / prescriptionEntries.length) * 100 : 0}%` }} />
              </div>
            </div>
            <button
              type="button"
              className="setup-progress-action"
              onClick={openPrescriptionReview}
            >
              Revisar indicaciones
            </button>
          </div>
        )}
        {persistenceError && <p className="file-error" role="alert">{persistenceError}</p>}

        <section className="hero-grid">
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
              <button type="button" className="upload-box" onClick={openFilePicker}>
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
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl('')
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
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
                  const nextTimes = { ...firstDoseTimes, [entryId]: value }
                  setFirstDoseTimes(nextTimes)
                  persistAppState({ firstDoseTimes: nextTimes })
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
