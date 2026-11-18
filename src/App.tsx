import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import './App.css'
import type { DoseStatus, PrescriptionEntry, ScheduledDose } from './domain/model'
import {
  getDoseSeriesKey,
  getDoseTimePreview,
  getScheduleRule,
  getScheduledDoseTimes,
  getShiftedDoseTimes,
  formatScheduleTime,
  hasValidDoseAmount,
  sortDosesForTracking,
} from './domain/schedule'
import { getInitialAppData, saveAppData, toStoredAppData } from './storage/appData'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Download,
  FileText,
  List,
  Menu,
  Pill,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { DoseCard } from './components/DoseCard'
import { DoseTimePreview } from './components/DoseTimePreview'
import { MobileNavigation, Sidebar } from './components/Navigation'
import {
  PrescriptionEditForm,
  type PrescriptionEditValues,
} from './components/PrescriptionEditForm'

const recipeAnalysis = {
  patient: 'Amelia',
}

type ScheduleView = 'today' | 'list' | 'calendar'
type DoseFilter = 'all' | DoseStatus
type PendingPlanChange =
  | { type: 'edit'; entry: PrescriptionEntry }
  | { type: 'confirmation'; entryId: string }
  | { type: 'duration'; entryId: string; value: string }
  | { type: 'regenerate' }
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type AdjustableDoseSeries = {
  key: string
  medicationName: string
  instructions: string
  doses: ScheduledDose[]
  lockedCount: number
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
              <section
                className="schedule-adjustment-panel"
                id="schedule-adjustment-panel"
                aria-labelledby="schedule-adjustment-title"
              >
                <div className="schedule-adjustment-heading">
                  <div>
                    <p className="eyebrow">Solo pendientes futuras</p>
                    <h4 id="schedule-adjustment-title">Ajustar el horario de un medicamento</h4>
                    <p>Elige una nueva hora para la próxima toma pendiente. Las demás tomas futuras de ese medicamento se desplazarán lo mismo para conservar el intervalo actual.</p>
                  </div>
                </div>

                <div className="schedule-adjustment-list">
                  {adjustableDoseGroups.map((series, index) => {
                    const medication = prescriptionEntries.find((entry) =>
                      series.doses[0].id.startsWith(`${entry.id}-`),
                    )
                    const intervalHours = medication?.schedule.intervalHours ?? null
                    const selectedTime = scheduleAdjustmentTimes[series.key]
                    const previewStart = selectedTime ? new Date(selectedTime) : null
                    const previewTimes = previewStart && Number.isFinite(previewStart.getTime())
                      ? getShiftedDoseTimes(series.doses, previewStart)
                      : []
                    return (
                      <div className="schedule-adjustment-item" key={series.key}>
                        <div>
                          <strong>{series.medicationName}</strong>
                          <span>
                            Próxima: {formatScheduleTime(series.doses[0].scheduledAt, 'EEE d MMM')}
                            {' · '}{series.doses.length} {series.doses.length === 1 ? 'pendiente' : 'pendientes'}
                            {intervalHours ? ` · cada ${intervalHours} h` : ''}
                          </span>
                          {series.lockedCount > 0 && (
                            <span className="schedule-adjustment-locked">
                              Tiene {series.lockedCount} {series.lockedCount === 1 ? 'toma posterior ya registrada' : 'tomas posteriores ya registradas'}; no se ajustará automáticamente.
                            </span>
                          )}
                        </div>
                        <label htmlFor={`adjustment-time-${index}`}>
                          Nuevo horario de la próxima toma
                          <input
                            id={`adjustment-time-${index}`}
                            type="datetime-local"
                            value={scheduleAdjustmentTimes[series.key] ?? ''}
                            disabled={series.lockedCount > 0}
                            onChange={(event) => {
                              setScheduleAdjustmentTimes((times) => ({
                                ...times,
                                [series.key]: event.target.value,
                              }))
                              setScheduleAdjustmentError('')
                            }}
                          />
                        </label>
                        <DoseTimePreview
                          preview={getDoseTimePreview(previewTimes)}
                          title="Así quedarían las próximas tomas"
                        />
                      </div>
                    )
                  })}
                </div>

                <p className="schedule-adjustment-notice">
                  <AlertTriangle size={17} />
                  <span>
                    Úsalo solo si el médico o farmacéutico indicó un horario alternativo. Las tomas administradas, omitidas o con hora ya pasada no cambian; una toma atrasada no se reprograma automáticamente.
                  </span>
                </p>

                <label className="schedule-adjustment-confirm">
                  <input
                    type="checkbox"
                    checked={scheduleAdjustmentConfirmed}
                    onChange={(event) => {
                      setScheduleAdjustmentConfirmed(event.target.checked)
                      setScheduleAdjustmentError('')
                    }}
                  />
                  Confirmo que este horario alternativo fue indicado por un profesional de salud.
                </label>

                {scheduleAdjustmentError && (
                  <p className="file-error" role="alert">{scheduleAdjustmentError}</p>
                )}
                <div className="schedule-adjustment-actions">
                  <button
                    type="button"
                    className="cancel-edit-button"
                    onClick={() => setIsScheduleAdjustmentOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="save-edit-button"
                    disabled={
                      !scheduleAdjustmentConfirmed
                      || !adjustableDoseGroups.some((series) => series.lockedCount === 0)
                    }
                    onClick={saveScheduleAdjustment}
                  >
                    Aplicar horario autorizado
                  </button>
                </div>
              </section>
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
                  <section className="today-view" aria-label="Tomas de hoy">
                    <div className="today-view-heading">
                      <div>
                        <p className="eyebrow">Agenda de hoy</p>
                        <h4>{format(currentTime, 'EEEE d MMMM', { locale: es })}</h4>
                      </div>
                      <span>{todaysDoses.length} {todaysDoses.length === 1 ? 'toma' : 'tomas'}</span>
                    </div>
                    {todaysDoses.length > 0 ? (
                      <div className="dose-list-view today-dose-list">
                        {todaysDoses.map((dose) => (
                          <DoseCard
                            key={dose.id}
                            dose={dose}
                            isNextDose={dose.id === nextTodayDose?.id}
                            onUpdateStatus={updateDoseStatus}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="today-empty-state">
                        <Sun size={20} />
                        <div>
                          <strong>No hay tomas programadas para hoy</strong>
                          <span>Consulta la semana para ver las próximas fechas del plan.</span>
                        </div>
                        <button
                          type="button"
                          className="review-button"
                          onClick={() => {
                            setVisibleWeekStart(startOfWeek(currentTime, { weekStartsOn: 1 }))
                            setSelectedCalendarDay(currentTime)
                            setScheduleView('calendar')
                          }}
                        >
                          Ver semana
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {scheduleView === 'list' && (
                  <>
                    <div className="schedule-view-switch dose-filter-switch" role="group" aria-label="Filtrar tomas">
                      {([
                        ['all', 'Todas', scheduleEvents.length],
                        ['pending', 'Por dar', statusCounts.pending],
                        ['given', 'Administradas', statusCounts.given],
                        ['skipped', 'Omitidas', statusCounts.skipped],
                      ] as const).map(([filter, label, count]) => (
                        <button
                          type="button"
                          className={doseFilter === filter ? 'is-active' : ''}
                          aria-pressed={doseFilter === filter}
                          onClick={() => setDoseFilter(filter)}
                          key={filter}
                        >
                          {label} <small>{count}</small>
                        </button>
                      ))}
                    </div>
                    <div className="dose-list-view">
                      {filteredScheduleEvents.length > 0
                        ? filteredScheduleEvents.map((dose) => (
                            <DoseCard
                              key={dose.id}
                              dose={dose}
                              onUpdateStatus={updateDoseStatus}
                            />
                          ))
                        : <p className="dose-filter-empty">No hay tomas en este estado.</p>}
                    </div>
                  </>
                )}
                {scheduleView === 'calendar' && (
                  <>
                    <div className="week-picker" role="group" aria-label="Seleccionar día de la semana">
                      {calendarDays.map((day) => {
                        const dayDoses = scheduleEvents.filter((dose) => isSameDay(dose.scheduledAt, day))
                        const isSelected = isSameDay(day, selectedCalendarDay)
                        const isToday = isSameDay(day, currentTime)
                        return (
                          <button
                            type="button"
                            className={`week-day-button${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                            aria-pressed={isSelected}
                            aria-label={`${format(day, 'EEEE d MMMM', { locale: es })}, ${dayDoses.length} ${dayDoses.length === 1 ? 'toma' : 'tomas'}`}
                            onClick={() => setSelectedCalendarDay(day)}
                            key={day.toISOString()}
                          >
                            <span>{format(day, 'EEE', { locale: es })}</span>
                            <strong>{format(day, 'd')}</strong>
                            <small>{dayDoses.length === 0 ? 'Sin tomas' : `${dayDoses.length} ${dayDoses.length === 1 ? 'toma' : 'tomas'}`}</small>
                          </button>
                        )
                      })}
                    </div>
                    <section className="selected-day-agenda" aria-label={`Tomas de ${format(selectedCalendarDay, 'EEEE d MMMM', { locale: es })}`}>
                      <div className="today-view-heading">
                        <div>
                          <p className="eyebrow">Agenda del día</p>
                          <h4>{format(selectedCalendarDay, 'EEEE d MMMM', { locale: es })}</h4>
                        </div>
                        <span>{selectedDayDoses.length} {selectedDayDoses.length === 1 ? 'toma' : 'tomas'}</span>
                      </div>
                      {selectedDayDoses.length > 0 ? (
                        <div className="dose-list-view">
                          {selectedDayDoses.map((dose) => (
                            <DoseCard
                              key={dose.id}
                              dose={dose}
                              onUpdateStatus={updateDoseStatus}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="today-empty-state">
                          <CalendarDays size={20} />
                          <div>
                            <strong>No hay tomas para este día</strong>
                            <span>Elige otra fecha o vuelve a la semana actual.</span>
                          </div>
                          <button
                            type="button"
                            className="review-button"
                            onClick={() => {
                              setVisibleWeekStart(startOfWeek(currentTime, { weekStartsOn: 1 }))
                              setSelectedCalendarDay(currentTime)
                            }}
                          >
                            Ir a hoy
                          </button>
                        </div>
                      )}
                    </section>
                  </>
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
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePrescriptionReview()
          }}
        >
          <section
            ref={reviewModalRef}
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
                ref={reviewCloseRef}
                type="button"
                className="modal-close"
                aria-label="Cerrar revisión"
                onClick={closePrescriptionReview}
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
                        onClick={() => setPendingPlanChange(null)}
                      >
                        Conservar el calendario
                      </button>
                      <button
                        type="button"
                        className="save-edit-button"
                        onClick={confirmPendingPlanChange}
                      >
                        {pendingPlanChange.type === 'regenerate' ? 'Recrear calendario' : 'Eliminarlo y continuar'}
                      </button>
                    </div>
                  </div>
              </div>
            )}

            {!isScheduleSetupOpen ? (
              <>
                <div className="review-progress" role="status" aria-live="polite">
                  <span>{confirmedItems.length} de {prescriptionEntries.length} indicaciones revisadas</span>
                  <div className="review-progress-track">
                    <span style={{ width: `${(confirmedItems.length / prescriptionEntries.length) * 100}%` }} />
                  </div>
                </div>

                <div className="prescription-list">
                  {prescriptionEntries.map((item) => (
                    <article className="prescription-item" key={item.id}>
                      <div className="prescription-icon"><Pill size={18} /></div>
                      {editingEntryId === item.id ? (
                        <PrescriptionEditForm
                          entryId={item.id}
                          values={editValues}
                          error={editError}
                          setValues={setEditValues}
                          setError={setEditError}
                          onCancel={() => setEditingEntryId(null)}
                          onSubmit={saveCorrection}
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
                              onClick={() => beginEditing(item)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`confirm-item-button ${confirmedItems.includes(item.id) ? 'is-confirmed' : ''}`}
                              aria-pressed={confirmedItems.includes(item.id)}
                              onClick={() => toggleConfirmation(item.id)}
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
                      onClick={() => {
                        setIsScheduleSetupOpen(true)
                        setScheduleError('')
                      }}
                    >
                      Continuar al calendario
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="schedule-setup">
                <div className={scheduleReady ? 'setup-checklist is-ready' : 'setup-checklist'} role="status" aria-live="polite">
                  <strong>
                    {scheduleReady
                      ? 'Todo listo para crear el calendario.'
                      : `Faltan ${scheduleBlockers.length} pasos para mostrarlo:`}
                  </strong>
                  {!scheduleReady && (
                    <ul>
                      {scheduleBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                    </ul>
                  )}
                </div>
                {prescriptionEntries.map((item) => {
                  const rule = getScheduleRule(item.schedule)
                  const durationRange = rule.durationRange
                  const ruleIsValid = hasValidDoseAmount(item.schedule)
                    && rule.intervalHours !== null
                    && rule.totalDoses !== null
                    && rule.totalDoses > 0
                  const doseLabel = item.schedule.dose.min !== null
                    ? `${item.schedule.dose.min === item.schedule.dose.max
                      ? item.schedule.dose.min
                      : `${item.schedule.dose.min}–${item.schedule.dose.max}`} ${item.schedule.dose.unit}`
                    : ''
                  const firstDoseTime = firstDoseTimes[item.id]
                    ? new Date(firstDoseTimes[item.id])
                    : null
                  const previewTimes = rule.intervalHours !== null
                    && rule.totalDoses !== null
                    && rule.totalDoses > 0
                    && firstDoseTime
                    && Number.isFinite(firstDoseTime.getTime())
                    ? getScheduledDoseTimes(firstDoseTime, rule.intervalHours, rule.totalDoses)
                    : []

                  return (
                    <article className="schedule-setup-item" key={item.id}>
                      <div>
                        <h3>{item.name}</h3>
                        <p>{item.detail}</p>
                      </div>
                      {durationRange && (
                        <>
                          <label htmlFor={`duration-${item.id}`}>
                            Duración del tratamiento (elige de {durationRange.min} a {durationRange.max} días)
                          </label>
                          <select
                            id={`duration-${item.id}`}
                            value={item.schedule.durationDays ?? ''}
                            onChange={(event) => {
                              updateDurationSelection(item.id, event.target.value)
                              setScheduleError('')
                            }}
                          >
                            <option value="">Selecciona los días</option>
                            {Array.from(
                              { length: durationRange.max - durationRange.min + 1 },
                              (_, index) => durationRange.min + index,
                            ).map((days) => (
                              <option key={days} value={days}>{days} días</option>
                            ))}
                          </select>
                        </>
                      )}
                      {rule.intervalHours !== null && (
                        <p className="schedule-rule">
                          {doseLabel && `${doseLabel} · `}
                          {rule.totalDoses !== null
                            ? `${rule.totalDoses} ${rule.totalDoses === 1 ? 'toma' : 'tomas'} · cada ${rule.intervalHours} horas`
                            : `Cada ${rule.intervalHours} horas`}
                        </p>
                      )}
                      {ruleIsValid ? (
                        <>
                          <label htmlFor={`first-dose-${item.id}`}>Fecha y hora de la primera toma</label>
                          <input
                            id={`first-dose-${item.id}`}
                            type="datetime-local"
                            value={firstDoseTimes[item.id] ?? ''}
                            onChange={(event) => {
                              const nextTimes = { ...firstDoseTimes, [item.id]: event.target.value }
                              setFirstDoseTimes(nextTimes)
                              persistAppState({ firstDoseTimes: nextTimes })
                              setScheduleError('')
                            }}
                          />
                        </>
                      ) : hasValidDoseAmount(item.schedule)
                        && durationRange
                        && rule.intervalHours !== null ? (
                        <p className="duration-choice-help">Elige la duración para calcular cuántas tomas aparecerán.</p>
                      ) : (
                        <div className="schedule-blocked">
                          <p>No se pudo leer con certeza la frecuencia o duración de esta indicación.</p>
                          <button
                            type="button"
                            className="edit-entry-button"
                            onClick={() => {
                              setIsScheduleSetupOpen(false)
                              beginEditing(item)
                            }}
                          >
                            Corregir indicación
                          </button>
                        </div>
                      )}
                      <DoseTimePreview
                        preview={getDoseTimePreview(previewTimes)}
                        title="Así quedarían las próximas tomas"
                      />
                    </article>
                  )
                })}

                {scheduleError && <p className="file-error" role="alert">{scheduleError}</p>}
                <div className="schedule-actions">
                  <button
                    type="button"
                    className="cancel-edit-button"
                    onClick={() => setIsScheduleSetupOpen(false)}
                  >
                    Volver a revisar
                  </button>
                  <button
                    type="button"
                    className="save-edit-button"
                    disabled={!scheduleReady}
                    onClick={() => generateSchedule()}
                  >
                    Crear calendario
                  </button>
                </div>
                <p className="edit-help">No se enviarán notificaciones. El calendario se guarda automáticamente en este navegador.</p>
              </div>
            )}

            <div className="modal-footer">
              <span>Se guarda automáticamente como JSON en este navegador; no se sube a internet.</span>
              <button
                type="button"
                className="ghost-btn"
                onClick={closePrescriptionReview}
              >
                Entendido
              </button>
            </div>
          </section>
        </div>
      )}
      </div>
    </>
  )
}

export default App
