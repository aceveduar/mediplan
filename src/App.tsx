import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import './App.css'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Columns3,
  Download,
  FileText,
  List,
  Menu,
  Pill,
  ShieldCheck,
  Sparkles,
  Sun,
  Upload,
  X,
} from 'lucide-react'
import { addDays, addWeeks, format, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import { es } from 'date-fns/locale'

const recipeAnalysis = {
  patient: 'Amelia',
}

type PrescriptionEntry = {
  id: string
  name: string
  detail: string
  uncertainty: string
  durationDays?: number
}

type DoseStatus = 'pending' | 'given' | 'skipped'
type ScheduleView = 'today' | 'list' | 'calendar' | 'kanban'
type DoseFilter = 'all' | DoseStatus
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type ScheduledDose = {
  id: string
  medicationName: string
  instructions: string
  scheduledAt: Date
  administeredAt: Date | null
  status: DoseStatus
}

type AdjustableDoseSeries = {
  key: string
  medicationName: string
  instructions: string
  doses: ScheduledDose[]
  lockedCount: number
}

type StoredScheduleDose = Omit<ScheduledDose, 'scheduledAt' | 'administeredAt'> & {
  scheduledAt: string
  administeredAt?: string | null
  status?: DoseStatus
}

type StoredAppData = {
  version: 1
  prescriptionEntries: PrescriptionEntry[]
  confirmedItems: string[]
  firstDoseTimes: Record<string, string>
  scheduleEvents: StoredScheduleDose[]
}

type InitialAppData = Omit<StoredAppData, 'scheduleEvents'> & {
  scheduleEvents: ScheduledDose[]
  error: string
}

function getDoseSeriesKey(dose: Pick<ScheduledDose, 'medicationName' | 'instructions'>) {
  return JSON.stringify([dose.medicationName, dose.instructions])
}

function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const initialPrescriptionEntries: PrescriptionEntry[] = [
  {
    id: 'combination-medicine',
    name: 'Amantadina / clorfeniramina / paracetamol (solución infantil)',
    detail: 'Dar 2.5 ml cada 8 horas durante 5 días.',
    uncertainty: 'Verifica el nombre del producto y la indicación con la receta.',
  },
  {
    id: 'bromhexine',
    name: 'Bromhexina (solución infantil)',
    detail: 'Dar 1.5 ml cada 8 horas durante 10 días.',
    uncertainty: 'Verifica la cantidad y la indicación con la receta.',
  },
  {
    id: 'colifrin',
    name: 'Collifrin (infantil)',
    detail: 'Aplicar 1 a 2 gotas en cada fosa nasal cada 12 horas durante 3 a 5 días.',
    uncertainty: 'Elige la duración indicada dentro del rango de 3 a 5 días para calcular el calendario.',
  },
  {
    id: 'amoxicillin-clavulanate',
    name: 'Amoxicilina / ácido clavulánico',
    detail: 'Suspensión 125 mg / 5 ml: dar 5 ml cada 8 horas durante 7 días.',
    uncertainty: 'Verifica la presentación y la indicación con la receta.',
  },
]

const previousPrescriptionDetails: Record<string, string> = {
  'combination-medicine': 'Parece indicar 2.5 ml cada 8 horas por 5 días.',
  bromhexine: 'Parece indicar 1.5 ml cada 8 horas por 10 días.',
  colifrin: 'Parece indicar 1–2 gotas cada 12 horas; la duración no se distingue con certeza.',
  'amoxicillin-clavulanate': 'Parece indicar suspensión 125/31.25 mg por 5 ml: 5 ml cada 8 horas por 7 días.',
}

const storageKey = 'mediplan:amelia:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPrescriptionEntry(value: unknown): value is PrescriptionEntry {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.detail === 'string'
    && typeof value.uncertainty === 'string'
    && (value.durationDays === undefined
      || (typeof value.durationDays === 'number' && Number.isInteger(value.durationDays)))
}

function isStoredScheduleDose(value: unknown): value is StoredScheduleDose {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.medicationName === 'string'
    && typeof value.instructions === 'string'
    && typeof value.scheduledAt === 'string'
    && Number.isFinite(Date.parse(value.scheduledAt))
    && (value.administeredAt === undefined
      || value.administeredAt === null
      || (typeof value.administeredAt === 'string' && Number.isFinite(Date.parse(value.administeredAt))))
    && (value.status === undefined || isDoseStatus(value.status))
}

function isDoseStatus(value: unknown): value is DoseStatus {
  return value === 'pending' || value === 'given' || value === 'skipped'
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

function loadSavedAppData(): { data: StoredAppData; error: string } {
  const defaults: StoredAppData = {
    version: 1,
    prescriptionEntries: initialPrescriptionEntries,
    confirmedItems: [],
    firstDoseTimes: {},
    scheduleEvents: [],
  }

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return { data: defaults, error: '' }

    const parsed: unknown = JSON.parse(raw)
    if (
      !isRecord(parsed)
      || parsed.version !== 1
      || !Array.isArray(parsed.prescriptionEntries)
      || !parsed.prescriptionEntries.every(isPrescriptionEntry)
      || !Array.isArray(parsed.confirmedItems)
      || !parsed.confirmedItems.every((item) => typeof item === 'string')
      || !isStringRecord(parsed.firstDoseTimes)
      || !Array.isArray(parsed.scheduleEvents)
      || !parsed.scheduleEvents.every(isStoredScheduleDose)
    ) {
      throw new Error('El formato guardado no es válido.')
    }

    return {
      data: {
        version: 1,
        prescriptionEntries: parsed.prescriptionEntries,
        confirmedItems: parsed.confirmedItems,
        firstDoseTimes: parsed.firstDoseTimes,
        scheduleEvents: parsed.scheduleEvents,
      },
      error: '',
    }
  } catch (error) {
    console.error('No se pudieron recuperar los datos de MediPlan:', error)
    return {
      data: defaults,
      error: 'No se pudieron leer los datos guardados. Tus cambios nuevos podrían no conservarse.',
    }
  }
}

function getInitialAppData(): InitialAppData {
  const saved = loadSavedAppData()
  const updatedIds: string[] = []
  const prescriptionEntries = saved.data.prescriptionEntries.map((entry) => {
    const updatedEntry = initialPrescriptionEntries.find((item) => item.id === entry.id)
    const savedCollifrinDuration = entry.id === 'colifrin'
      ? entry.detail.match(/\b(?:por|durante|x)\s*([3-5])\s*d[ií]as?\b/i)
      : null
    const isSavedCollifrinChoice = entry.id === 'colifrin'
      && /\b(?:cada|c\/)\s*12\s*(?:h|hrs?|horas?)\b/i.test(entry.detail)
      && /\bgotas?\b/i.test(entry.detail)
      && savedCollifrinDuration !== null

    if (updatedEntry && (
      entry.detail === previousPrescriptionDetails[entry.id]
      || isSavedCollifrinChoice
    )) {
      updatedIds.push(entry.id)
      return savedCollifrinDuration
        ? { ...updatedEntry, durationDays: Number(savedCollifrinDuration[1]) }
        : updatedEntry
    }
    return entry
  })
  const validIds = new Set(prescriptionEntries.map((entry) => entry.id))

  return {
    ...saved.data,
    prescriptionEntries,
    confirmedItems: saved.data.confirmedItems.filter((id) => validIds.has(id) && !updatedIds.includes(id)),
    scheduleEvents: saved.data.scheduleEvents.map((event) => {
      const updatedEntry = prescriptionEntries.find((entry) =>
        updatedIds.includes(entry.id) && event.id.startsWith(`${entry.id}-`),
      )
      return {
        ...event,
        medicationName: updatedEntry?.name ?? event.medicationName,
        instructions: updatedEntry?.detail ?? event.instructions,
        scheduledAt: new Date(event.scheduledAt),
        administeredAt: event.administeredAt ? new Date(event.administeredAt) : null,
        status: event.status ?? 'pending',
      }
    }),
    error: saved.error,
  }
}

function getScheduleRule(detail: string, selectedDurationDays?: number) {
  const intervalMatch = detail.match(/\b(?:cada|c\/)\s*(\d+)\s*(?:h|hrs?|horas?)\b/i)
  const durationRangeMatch = detail.match(/\b(?:por|durante|x)\s*(\d+)\s*(?:a|hasta|[-–])\s*(\d+)\s*d[ií]as?\b/i)
  const daysMatch = durationRangeMatch
    ? null
    : detail.match(/\b(?:por|durante|x)\s*(\d+)\s*d[ií]as?\b/i)
  const dosesMatch = detail.match(/\b(?:por|x)\s*(\d+)\s*dosis\b/i)
  const intervalHours = intervalMatch ? Number(intervalMatch[1]) : null
  const durationRange = durationRangeMatch
    ? { min: Number(durationRangeMatch[1]), max: Number(durationRangeMatch[2]) }
    : null
  const validSelectedDuration = durationRange
    && selectedDurationDays !== undefined
    && selectedDurationDays >= durationRange.min
    && selectedDurationDays <= durationRange.max
    ? selectedDurationDays
    : null
  const durationDays = daysMatch ? Number(daysMatch[1]) : validSelectedDuration
  const totalDoses = dosesMatch
    ? Number(dosesMatch[1])
    : durationDays && intervalHours
      ? Math.ceil((durationDays * 24) / intervalHours)
      : null

  return { intervalHours, totalDoses, durationRange }
}

function App() {
  const [initialData] = useState(getInitialAppData)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null)
  const [isAppInstalled, setIsAppInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )
  const [installError, setInstallError] = useState('')
  const [isPrescriptionReviewOpen, setIsPrescriptionReviewOpen] = useState(false)
  const [prescriptionEntries, setPrescriptionEntries] = useState(initialData.prescriptionEntries)
  const [confirmedItems, setConfirmedItems] = useState(initialData.confirmedItems)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState({ name: '', detail: '' })
  const [editError, setEditError] = useState('')
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
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => startOfWeek(
    initialData.scheduleEvents[0]?.scheduledAt ?? new Date(),
    { weekStartsOn: 1 },
  ))
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
        setIsPrescriptionReviewOpen(false)
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
      const savedData: StoredAppData = {
        version: 1,
        prescriptionEntries: changes.prescriptionEntries ?? prescriptionEntries,
        confirmedItems: changes.confirmedItems ?? confirmedItems,
        firstDoseTimes: changes.firstDoseTimes ?? firstDoseTimes,
        scheduleEvents: (changes.scheduleEvents ?? scheduleEvents).map((event) => ({
          id: event.id,
          medicationName: event.medicationName,
          instructions: event.instructions,
          scheduledAt: event.scheduledAt.toISOString(),
          administeredAt: event.administeredAt?.toISOString() ?? null,
          status: event.status,
        })),
      }
      window.localStorage.setItem(storageKey, JSON.stringify(savedData))
      setPersistenceError('')
    } catch (error) {
      console.error('No se pudieron guardar los datos de MediPlan:', error)
      setPersistenceError('No se pudieron guardar los cambios en este navegador.')
      setCanPersist(false)
    }
  }
  const toggleConfirmation = (id: string) => {
    const nextConfirmedItems = confirmedItems.includes(id)
      ? confirmedItems.filter((item) => item !== id)
      : [...confirmedItems, id]
    setScheduleEvents([])
    setConfirmedItems(nextConfirmedItems)
    persistAppState({ confirmedItems: nextConfirmedItems, scheduleEvents: [] })
  }
  const updateDurationSelection = (id: string, value: string) => {
    const durationDays = value ? Number(value) : undefined
    const nextEntries = prescriptionEntries.map((entry) => {
      if (entry.id !== id) return entry
      const updatedEntry = { ...entry }
      if (durationDays === undefined) delete updatedEntry.durationDays
      else updatedEntry.durationDays = durationDays
      return updatedEntry
    })
    setPrescriptionEntries(nextEntries)
    setScheduleEvents([])
    persistAppState({ prescriptionEntries: nextEntries, scheduleEvents: [] })
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
    const rule = getScheduleRule(entry.detail, entry.durationDays)
    return rule.intervalHours !== null
      && rule.totalDoses !== null
      && rule.totalDoses > 0
      && Boolean(firstDoseTimes[entry.id])
  })
  const scheduleBlockers = prescriptionEntries.flatMap((entry) => {
    const rule = getScheduleRule(entry.detail, entry.durationDays)
    if (rule.durationRange && rule.totalDoses === null) {
      return [`Elige entre ${rule.durationRange.min} y ${rule.durationRange.max} días para ${entry.name}.`]
    }
    if (rule.intervalHours === null || rule.totalDoses === null || rule.totalDoses <= 0) {
      return [`Corrige la frecuencia o duración de ${entry.name}.`]
    }
    return firstDoseTimes[entry.id]
      ? []
      : [`Elige cuándo será la primera toma de ${entry.name}.`]
  })
  const beginEditing = (entry: PrescriptionEntry) => {
    const nextConfirmedItems = confirmedItems.filter((id) => id !== entry.id)
    const nextFirstDoseTimes = { ...firstDoseTimes }
    delete nextFirstDoseTimes[entry.id]
    setEditingEntryId(entry.id)
    setEditValues({ name: entry.name, detail: entry.detail })
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
  const saveCorrection = (event: ChangeEvent<HTMLFormElement>, entryId: string) => {
    event.preventDefault()
    if (!editValues.name.trim() || !editValues.detail.trim()) {
      setEditError('Completa el nombre y la indicación para guardar.')
      return
    }

    const nextEntries = prescriptionEntries.map((entry) =>
      entry.id === entryId
        ? {
            ...entry,
            name: editValues.name.trim(),
            detail: editValues.detail.trim(),
            uncertainty: 'Corrección guardada; revisa de nuevo que coincida con la receta original.',
          }
        : entry,
    )
    setPrescriptionEntries(nextEntries)
    persistAppState({ prescriptionEntries: nextEntries })
    setEditingEntryId(null)
    setEditError('')
  }
  const generateSchedule = () => {
    if (!allItemsConfirmed || !scheduleReady) {
      setScheduleError('Revisa todas las indicaciones y completa la primera toma de cada medicamento.')
      return
    }

    const generated: ScheduledDose[] = []
    for (const entry of prescriptionEntries) {
      const rule = getScheduleRule(entry.detail, entry.durationDays)
      const firstDose = new Date(firstDoseTimes[entry.id])
      if (
        rule.intervalHours === null
        || rule.totalDoses === null
        || Number.isNaN(firstDose.getTime())
      ) {
        setScheduleError(`No se puede programar ${entry.name}. Revisa la frecuencia, duración y hora inicial.`)
        return
      }

      for (let doseIndex = 0; doseIndex < rule.totalDoses; doseIndex += 1) {
        generated.push({
          id: `${entry.id}-${doseIndex}`,
          medicationName: entry.name,
          instructions: entry.detail,
          scheduledAt: new Date(firstDose.getTime() + doseIndex * rule.intervalHours * 60 * 60 * 1000),
          administeredAt: null,
          status: 'pending',
        })
      }
    }

    generated.sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
    setScheduleEvents(generated)
    setVisibleWeekStart(startOfWeek(generated[0].scheduledAt, { weekStartsOn: 1 }))
    persistAppState({ scheduleEvents: generated })
    setScheduleError('')
    setIsScheduleSetupOpen(false)
    setIsPrescriptionReviewOpen(false)
  }
  const downloadScheduleJson = () => {
    const savedData: StoredAppData = {
      version: 1,
      prescriptionEntries,
      confirmedItems,
      firstDoseTimes,
      scheduleEvents: scheduleEvents.map((event) => ({
        id: event.id,
        medicationName: event.medicationName,
        instructions: event.instructions,
        scheduledAt: event.scheduledAt.toISOString(),
        administeredAt: event.administeredAt?.toISOString() ?? null,
        status: event.status,
      })),
    }
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
  const todaysDoses = scheduleEvents.filter((dose) => isSameDay(dose.scheduledAt, currentTime))
  const todaysPendingCount = todaysDoses.filter((dose) => dose.status === 'pending').length
  const todaysGivenCount = todaysDoses.filter((dose) => dose.status === 'given').length
  const todaysSkippedCount = todaysDoses.filter((dose) => dose.status === 'skipped').length
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
  const nextPendingDose = scheduleEvents
    .filter((dose) => dose.status === 'pending')
    .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())[0]
  const filteredScheduleEvents = doseFilter === 'all'
    ? scheduleEvents
    : scheduleEvents.filter((dose) => dose.status === doseFilter)
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

      for (const dose of series.doses) {
        const scheduledAt = new Date(dose.scheduledAt.getTime() + offset)
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
  const renderDoseCard = (dose: ScheduledDose, compact = false) => (
    <article
      className={`dose-card dose-card-${dose.status}${compact ? ' dose-card-compact' : ''}`}
      key={dose.id}
      title={`${dose.medicationName} · ${dose.instructions}`}
    >
      <div className="dose-card-heading">
        <time dateTime={dose.scheduledAt.toISOString()}>
          {format(dose.scheduledAt, compact ? 'HH:mm' : 'EEE d MMM, HH:mm', { locale: es })}
        </time>
        <span className={`dose-status dose-status-${dose.status}`}>
          {compact
            ? dose.status === 'given' ? 'Dada' : dose.status === 'skipped' ? 'Omitida' : 'Pendiente'
            : dose.status === 'given' ? 'Administrada' : dose.status === 'skipped' ? 'Omitida' : 'Por dar'}
        </span>
      </div>
      <strong>{dose.medicationName}</strong>
      {dose.status === 'given' && dose.administeredAt && (
        <span className={`dose-actual-time${compact ? ' is-compact' : ''}`}>
          <CheckCircle2 size={12} />
          {compact
            ? 'Real'
            : isSameDay(dose.administeredAt, dose.scheduledAt) ? 'Administrada' : 'Administrada el'}
          {' '}{format(
            dose.administeredAt,
            isSameDay(dose.administeredAt, dose.scheduledAt)
              ? 'HH:mm'
              : compact ? 'd MMM HH:mm' : 'd MMM, HH:mm',
            { locale: es },
          )}
        </span>
      )}
      {!compact && <span className="dose-instructions">{dose.instructions}</span>}
      <div className="dose-card-actions">
        {dose.status === 'pending' ? (
          <>
            <button
              type="button"
              className="dose-action-primary"
              aria-label={`Marcar ${dose.medicationName} como administrada`}
              onClick={() => updateDoseStatus(dose.id, 'given')}
            >
              {compact ? 'Ya la di' : 'Marcar administrada'}
            </button>
            <button
              type="button"
              className="dose-action-secondary"
              aria-label={`Omitir toma de ${dose.medicationName}`}
              onClick={() => updateDoseStatus(dose.id, 'skipped')}
            >
              Omitir
            </button>
          </>
        ) : (
          <button
            type="button"
            className="dose-action-secondary"
            aria-label={`Volver a marcar ${dose.medicationName} por dar`}
            onClick={() => updateDoseStatus(dose.id, 'pending')}
          >
            {compact ? 'Deshacer' : 'Volver a por dar'}
          </button>
        )}
      </div>
    </article>
  )

  return (
    <>
      <a className="skip-link" href="#main-content">Ir al contenido principal</a>
      <div className={`app-shell ${isSidebarCollapsed ? 'is-sidebar-collapsed' : ''}`}>
      <aside
        className={`sidebar ${isSidebarCollapsed ? 'is-collapsed' : ''}`}
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
            className="nav-item active"
            aria-current="page"
            aria-label="Calendario"
            title={isSidebarCollapsed ? 'Calendario' : undefined}
            onClick={() => document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <CalendarDays size={18} />
            <span className="nav-label">Calendario</span>
          </button>
          <button
            type="button"
            className="nav-item"
            aria-label="Recetas"
            title={isSidebarCollapsed ? 'Recetas' : undefined}
            onClick={openPrescriptionReview}
          >
            <FileText size={18} />
            <span className="nav-label">Recetas</span>
          </button>
          <button
            type="button"
            className="nav-item"
            aria-label="Recordatorios"
            disabled
            title="Disponible próximamente"
          >
            <Bell size={18} />
            <span className="nav-label">Recordatorios</span>
          </button>
          <button
            type="button"
            className="nav-item"
            aria-label="Seguimiento"
            title={isSidebarCollapsed ? 'Seguimiento' : undefined}
            onClick={() => {
              setScheduleView('kanban')
              document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <ShieldCheck size={18} />
            <span className="nav-label">Seguimiento</span>
          </button>
        </nav>

        <div className="mini-card card-soft">
          <p className="label">{scheduleEvents.length > 0 ? 'Seguimiento' : 'Siguiente paso'}</p>
          <h3>{scheduleEvents.length > 0 ? `${statusCounts.pending} por dar` : 'Revisar receta'}</h3>
          <span>
            {scheduleEvents.length > 0
              ? 'Marca cada toma cuando la administres.'
              : 'Confirma la lectura antes de crear un plan.'}
          </span>
        </div>
      </aside>

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
            <button className="ghost-btn" type="button" onClick={openPrescriptionReview}>
              <FileText size={16} />
              Revisar indicaciones
            </button>
          </div>
        </header>

        {installError && <p className="file-error" role="alert">{installError}</p>}

        {scheduleEvents.length > 0 ? (
          <div className="schedule-success plan-status-banner" role="status">
            <CheckCircle2 size={20} />
            <div className="plan-status-copy">
              <strong>Plan activo</strong>
              <span>{scheduleEvents.length} tomas en el calendario · {statusCounts.pending} por dar · {statusCounts.given} administradas · {statusCounts.skipped} omitidas</span>
            </div>
          </div>
        ) : (
          <div className="setup-progress-banner" role="status">
            <span className="setup-step-marker">1</span>
            <div className="setup-progress-copy">
              <span className="setup-progress-kicker">PASO 1 DE 2</span>
              <strong>Revisa las indicaciones</strong>
              <span>Compara la transcripción con la receta; después elegirás cuándo inicia cada medicamento.</span>
            </div>
            <div className="setup-progress-count">
              <strong>{confirmedItems.length}/{prescriptionEntries.length}</strong>
              <span>confirmadas</span>
              <div className="setup-progress-track" aria-hidden="true">
                <span style={{ width: `${prescriptionEntries.length ? (confirmedItems.length / prescriptionEntries.length) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        )}
        {persistenceError && <p className="file-error" role="alert">{persistenceError}</p>}

        <section className="hero-grid">
          <div className="upload-card card-surface">
            <div className="upload-header">
              <div className="status-pill">
                <Sparkles size={15} />
                {selectedFileName ? 'Archivo de referencia' : 'Transcripción de receta'}
              </div>
              <span className="muted">
                {selectedFileName ? 'No se interpreta automáticamente' : `${prescriptionEntries.length - confirmedItems.length} indicaciones por confirmar`}
              </span>
            </div>

            <div className="upload-body">
              <button type="button" className="upload-box" onClick={openFilePicker}>
                <Upload size={28} />
                <strong>{selectedFileName ? 'Cambiar archivo' : 'Adjuntar archivo de referencia'}</strong>
                <span>JPG, PNG, WebP o PDF · máximo 10 MB</span>
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
                  <span className="label">Lectura</span>
                  <strong>Transcripción compartida</strong>
                </div>
                <div>
                  <span className="label">Origen</span>
                  <strong>{selectedFileName ? 'Archivo solo de referencia' : 'Conversación compartida'}</strong>
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
              Si adjuntas una imagen o PDF, solo verás una vista previa: MediPlan no extrae datos automáticamente. Compara la transcripción con la receta original.
            </p>
            <button
              type="button"
              className="review-button"
              onClick={openPrescriptionReview}
            >
              <FileText size={16} />
              Revisar indicaciones
              {confirmedItems.length < prescriptionEntries.length && ` · ${prescriptionEntries.length - confirmedItems.length} pendientes`}
            </button>
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
                  <button
                    type="button"
                    className="review-button"
                    aria-expanded={isScheduleAdjustmentOpen}
                    aria-controls="schedule-adjustment-panel"
                    disabled={!isScheduleAdjustmentOpen && adjustableDoseGroups.length === 0}
                    onClick={() => {
                      if (isScheduleAdjustmentOpen) setIsScheduleAdjustmentOpen(false)
                      else openScheduleAdjustment()
                    }}
                  >
                    {isScheduleAdjustmentOpen ? 'Cerrar ajuste' : 'Ajustar tomas futuras'}
                  </button>
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
                    const intervalHours = getScheduleRule(series.instructions).intervalHours
                    return (
                      <div className="schedule-adjustment-item" key={series.key}>
                        <div>
                          <strong>{series.medicationName}</strong>
                          <span>
                            Próxima: {format(series.doses[0].scheduledAt, 'EEE d MMM, HH:mm', { locale: es })}
                            {' · '}{series.doses.length} pendientes
                            {intervalHours ? ` · cada ${intervalHours} h` : ''}
                          </span>
                          {series.lockedCount > 0 && (
                            <span className="schedule-adjustment-locked">
                              Tiene {series.lockedCount} toma(s) posterior(es) ya registrada(s); no se ajustará automáticamente.
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
                <div className="tracking-overview">
                  <div className="today-summary" role="status" aria-live="polite">
                    <span className="overview-label">Resumen de hoy</span>
                    <strong>{todaysDoses.length} tomas programadas</strong>
                    <span>{todaysPendingCount} por dar · {todaysGivenCount} administradas · {todaysSkippedCount} omitidas</span>
                    <span>{scheduleEvents.length} tomas en el plan · estado guardado en este navegador</span>
                  </div>
                  <div className="next-dose-summary">
                    <span className="overview-label">Siguiente por registrar</span>
                    {nextPendingDose ? (
                      <>
                        <time dateTime={nextPendingDose.scheduledAt.toISOString()}>
                          {format(nextPendingDose.scheduledAt, 'EEE d MMM, HH:mm', { locale: es })}
                        </time>
                        <strong>{nextPendingDose.medicationName}</strong>
                        <span>Marca el estado solo después de comprobar la toma.</span>
                        <div className="next-dose-actions">
                          <button
                            type="button"
                            className="dose-action-primary"
                            aria-label={`Marcar ${nextPendingDose.medicationName} como administrada`}
                            onClick={() => updateDoseStatus(nextPendingDose.id, 'given')}
                          >
                            Ya la di
                          </button>
                          <button
                            type="button"
                            className="dose-action-secondary"
                            aria-label={`Marcar ${nextPendingDose.medicationName} como omitida`}
                            onClick={() => updateDoseStatus(nextPendingDose.id, 'skipped')}
                          >
                            Omitir
                          </button>
                        </div>
                      </>
                    ) : (
                      <strong>Todas las tomas tienen estado registrado.</strong>
                    )}
                  </div>
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
                      <CalendarDays size={16} /> Calendario
                    </button>
                    <button
                      type="button"
                      className={scheduleView === 'kanban' ? 'is-active' : ''}
                      aria-pressed={scheduleView === 'kanban'}
                      onClick={() => setScheduleView('kanban')}
                    >
                      <Columns3 size={16} /> Kanban
                    </button>
                  </div>
                  {scheduleView === 'calendar' && (
                    <div className="week-navigation" aria-label="Navegar semanas">
                      <button
                        type="button"
                        aria-label="Semana anterior"
                        onClick={() => setVisibleWeekStart((date) => subWeeks(date, 1))}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <strong>
                        {format(visibleWeekStart, 'd MMM', { locale: es })} – {format(calendarDays[6], 'd MMM yyyy', { locale: es })}
                      </strong>
                      <button
                        type="button"
                        className="week-today-button"
                        onClick={() => setVisibleWeekStart(startOfWeek(currentTime, { weekStartsOn: 1 }))}
                      >
                        Hoy
                      </button>
                      <button
                        type="button"
                        aria-label="Semana siguiente"
                        onClick={() => setVisibleWeekStart((date) => addWeeks(date, 1))}
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
                        {todaysDoses.map((dose) => renderDoseCard(dose))}
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
                        ? filteredScheduleEvents.map((dose) => renderDoseCard(dose))
                        : <p className="dose-filter-empty">No hay tomas en este estado.</p>}
                    </div>
                  </>
                )}
                {scheduleView === 'calendar' && (
                  <div className="calendar-week-grid" aria-label="Tomas de la semana">
                    {calendarDays.map((day) => {
                      const dayDoses = scheduleEvents.filter((dose) => isSameDay(dose.scheduledAt, day))
                      return (
                        <section className={`calendar-day ${isSameDay(day, currentTime) ? 'is-today' : ''}`} key={day.toISOString()}>
                          <header>
                            <span>{format(day, 'EEE', { locale: es })}</span>
                            <strong>{format(day, 'd')}</strong>
                          </header>
                          <div className="calendar-day-doses">
                            {dayDoses.length > 0
                              ? dayDoses.map((dose) => renderDoseCard(dose, true))
                              : <span className="no-doses">Sin tomas</span>}
                          </div>
                        </section>
                      )
                    })}
                  </div>
                )}
                {scheduleView === 'kanban' && (
                  <div className="dose-kanban">
                    {([
                      ['pending', 'Por dar', statusCounts.pending],
                      ['given', 'Administradas', statusCounts.given],
                      ['skipped', 'Omitidas', statusCounts.skipped],
                    ] as const).map(([status, label, count]) => (
                      <section className={`kanban-column kanban-${status}`} key={status}>
                        <header>
                          <h4>{label}</h4>
                          <span>{count}</span>
                        </header>
                        <div className="kanban-column-doses">
                          {scheduleEvents
                            .filter((dose) => dose.status === status)
                            .map((dose) => renderDoseCard(dose))}
                        </div>
                      </section>
                    ))}
                  </div>
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
                <button
                  type="button"
                  className="review-button"
                  onClick={openPrescriptionReview}
                >
                  <FileText size={16} />
                  Empezar revisión
                </button>
              </div>
            )}
          </div>
        </section>
      </main>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        <button
          type="button"
          className="mobile-nav-item is-active"
          aria-current="page"
          onClick={() => document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <CalendarDays size={20} />
          <span>Hoy</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item"
          onClick={openPrescriptionReview}
        >
          <FileText size={20} />
          <span>Receta</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => {
            setScheduleView('list')
            document.getElementById('calendar-panel')?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          <List size={20} />
          <span>Listado</span>
        </button>
        <button
          type="button"
          className="mobile-nav-item"
          onClick={() => setIsSidebarCollapsed((collapsed) => !collapsed)}
        >
          <Menu size={20} />
          <span>Más</span>
        </button>
      </nav>
      {isPrescriptionReviewOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsPrescriptionReviewOpen(false)
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
                onClick={() => setIsPrescriptionReviewOpen(false)}
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
                        <form className="prescription-edit-form" onSubmit={(event) => saveCorrection(event, item.id)}>
                          <label htmlFor={`medicine-name-${item.id}`}>Nombre del medicamento</label>
                          <input
                            id={`medicine-name-${item.id}`}
                            value={editValues.name}
                            onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))}
                            autoFocus
                          />
                          <label htmlFor={`medicine-detail-${item.id}`}>Dosis e indicaciones tal como aparecen</label>
                          <textarea
                            id={`medicine-detail-${item.id}`}
                            rows={3}
                            value={editValues.detail}
                            onChange={(event) => setEditValues((current) => ({ ...current, detail: event.target.value }))}
                          />
                          {editError && <p className="file-error" role="alert">{editError}</p>}
                          <p className="edit-help">Copia la indicación de la receta; no calcules ni supongas lo que no se alcanza a leer.</p>
                          <div className="edit-actions">
                            <button
                              type="button"
                              className="cancel-edit-button"
                              onClick={() => {
                                setEditingEntryId(null)
                                setEditError('')
                              }}
                            >
                              Cancelar
                            </button>
                            <button type="submit" className="save-edit-button">Guardar corrección</button>
                          </div>
                        </form>
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
                  const rule = getScheduleRule(item.detail, item.durationDays)
                  const durationRange = rule.durationRange
                  const ruleIsValid = rule.intervalHours !== null
                    && rule.totalDoses !== null
                    && rule.totalDoses > 0

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
                            value={item.durationDays ?? ''}
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
                          {rule.totalDoses !== null
                            ? `${rule.totalDoses} tomas · cada ${rule.intervalHours} horas`
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
                      ) : durationRange && rule.intervalHours !== null ? (
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
                    onClick={generateSchedule}
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
                onClick={() => setIsPrescriptionReviewOpen(false)}
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
