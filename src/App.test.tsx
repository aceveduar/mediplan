import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { initialPrescriptionEntries } from './domain/prescriptions'

function toLocalDateTimeValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function getStoredScheduleEvents() {
  const saved = window.localStorage.getItem('mediplan:amelia:v2')
  if (!saved) throw new Error('No se guardó el calendario de MediPlan.')
  return JSON.parse(saved).scheduleEvents as Array<{
    id: string
    status: string
    scheduledAt: string
  }>
}

async function createActiveSchedule(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Revisar indicaciones' }))

  for (let index = 0; index < initialPrescriptionEntries.length; index += 1) {
    await user.click(screen.getAllByRole('button', { name: 'Coincide' })[0])
  }

  await user.click(screen.getByRole('button', { name: 'Continuar al calendario' }))
  await user.selectOptions(
    screen.getByLabelText('Duración del tratamiento (elige de 3 a 5 días)'),
    '3',
  )

  const startTime = toLocalDateTimeValue(new Date())
  for (const entry of initialPrescriptionEntries) {
    fireEvent.change(screen.getByLabelText('Fecha y hora de la primera toma', {
      selector: `#first-dose-${entry.id}`,
    }), { target: { value: startTime } })
  }

  await user.click(screen.getByRole('button', { name: 'Crear calendario' }))
}

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('MediPlan medication flow', () => {
  it('reviews a prescription, creates its schedule, and records then undoes a dose', async () => {
    const user = userEvent.setup()
    render(<App />)

    await createActiveSchedule(user)

    const medicationName = initialPrescriptionEntries[0].name
    const markAsGivenName = `Marcar ${medicationName} como administrada`
    await user.click(screen.getAllByRole('button', { name: markAsGivenName })[0])
    expect(getStoredScheduleEvents().find((dose) => dose.id === 'combination-medicine-0')?.status)
      .toBe('given')

    await user.click(screen.getAllByRole('button', {
      name: `Volver a marcar ${medicationName} por dar`,
    })[0])
    expect(getStoredScheduleEvents().find((dose) => dose.id === 'combination-medicine-0')?.status)
      .toBe('pending')
  })

  it('preserves the active schedule when a destructive plan change is canceled', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createActiveSchedule(user)
    const eventsBeforeReview = getStoredScheduleEvents()

    await user.click(screen.getByRole('button', { name: 'Revisar el plan' }))
    await user.click(screen.getAllByRole('button', { name: 'Revisada ✓' })[0])

    expect(screen.getByText('Se reemplazará el calendario activo')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Conservar el calendario' }))

    expect(getStoredScheduleEvents()).toEqual(eventsBeforeReview)
    expect(screen.getByText('Plan activo')).toBeTruthy()
  })

  it('requires prescription review again after saving a correction', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createActiveSchedule(user)

    await user.click(screen.getByRole('button', { name: 'Revisar el plan' }))
    await user.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    await user.click(screen.getByRole('button', { name: 'Eliminarlo y continuar' }))
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }))

    expect(screen.getAllByRole('button', { name: 'Coincide' })).toHaveLength(1)
    expect(getStoredScheduleEvents()).toHaveLength(0)
    const saved = JSON.parse(window.localStorage.getItem('mediplan:amelia:v2') ?? '{}')
    expect(saved.confirmedItems).not.toContain('combination-medicine')
  })

  it('moves future doses only after professional confirmation and preserves recorded doses', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createActiveSchedule(user)

    const medicationName = initialPrescriptionEntries[0].name
    await user.click(screen.getAllByRole('button', {
      name: `Marcar ${medicationName} como administrada`,
    })[0])
    const eventsBeforeAdjustment = getStoredScheduleEvents()
    const recordedDoseBefore = eventsBeforeAdjustment
      .find((dose) => dose.id === 'combination-medicine-0')
    if (!recordedDoseBefore) throw new Error('No se guardó la toma registrada.')

    await user.click(screen.getByRole('button', { name: 'Ajustar tomas futuras' }))
    fireEvent.change(screen.getAllByLabelText('Nuevo horario de la próxima toma')[0], {
      target: { value: toLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60_000)) },
    })
    await user.click(screen.getByLabelText(
      'Confirmo que este horario alternativo fue indicado por un profesional de salud.',
    ))
    await user.click(screen.getByRole('button', { name: 'Aplicar horario autorizado' }))

    const updatedEvents = getStoredScheduleEvents()
    expect(updatedEvents.find((dose) => dose.id === recordedDoseBefore.id)).toEqual(recordedDoseBefore)
    expect(updatedEvents.some((dose) => (
      dose.status === 'pending'
      && dose.scheduledAt !== eventsBeforeAdjustment.find((previous) => previous.id === dose.id)?.scheduledAt
    ))).toBe(true)
  })

  it('shows a persistence error when local storage rejects a change', async () => {
    const user = userEvent.setup()
    render(<App />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    })

    await user.click(screen.getByRole('button', { name: 'Revisar indicaciones' }))
    await user.click(screen.getAllByRole('button', { name: 'Coincide' })[0])

    expect(screen.getByText('No se pudieron guardar los cambios en este navegador.')).toBeTruthy()
  })

  it('downloads a versioned JSON backup of the active schedule', async () => {
    const user = userEvent.setup()
    render(<App />)
    await createActiveSchedule(user)

    const createObjectUrl = vi.fn((_blob: Blob) => 'blob:mediplan-backup')
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    const clickAnchor = vi.spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(this.download).toBe('mediplan-amelia.json')
      })

    await user.click(screen.getByRole('button', { name: 'Descargar respaldo JSON' }))

    expect(clickAnchor).toHaveBeenCalledOnce()
    const backup = JSON.parse(await createObjectUrl.mock.calls[0][0].text())
    expect(backup.version).toBe(2)
    expect(backup.scheduleEvents.length).toBeGreaterThan(0)
  })
})
