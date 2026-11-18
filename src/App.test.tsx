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
  return JSON.parse(saved).scheduleEvents as Array<{ id: string; status: string }>
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

    await user.click(screen.getByRole('button', { name: 'Revisar indicaciones' }))
    expect(screen.getByRole('dialog', { name: 'Revisa los medicamentos' })).toBeTruthy()

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
})
