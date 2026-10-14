import { sumCents, type Cents, type Timestamp } from './common'
import type { PaymentMethodId, SessionId, ShiftClosingId, ShiftId, UserId } from './ids'
import type { Payment, PaymentMethod } from './payment'
import type { Shift } from './shift'

export interface MethodTotal {
  readonly methodId: PaymentMethodId
  readonly totalCents: Cents
  readonly paymentsCount: number
}

/** Riepilogo archiviato alla chiusura di un turno. Non si cancella e non si modifica. */
export interface ShiftClosing {
  readonly id: ShiftClosingId
  readonly shiftId: ShiftId
  readonly sessionId: SessionId
  readonly closedByUserId: UserId
  readonly closedAt: Timestamp
  readonly openingFloatCents: Cents
  readonly salesCents: Cents
  readonly paymentsCount: number
  readonly totalsByMethod: readonly MethodTotal[]
  readonly expectedCashCents: Cents
  readonly countedCashCents: Cents
  /** contato - atteso: negativo = ammanco, positivo = eccedenza. */
  readonly differenceCents: Cents
  readonly reason?: string
}

const paymentsOfShift = (shift: Pick<Shift, 'id'>, payments: readonly Payment[]) =>
  payments.filter((p) => p.shiftId === shift.id)

/** Contante atteso = fondo iniziale + incassi in contanti del turno. */
export function expectedCashCents(
  shift: Pick<Shift, 'id' | 'openingFloatCents'>,
  payments: readonly Payment[],
  methods: readonly PaymentMethod[],
): Cents {
  const cashIds = new Set(methods.filter((m) => m.kind === 'cash').map((m) => m.id))
  const cash = paymentsOfShift(shift, payments).filter((p) => cashIds.has(p.methodId))
  return shift.openingFloatCents + sumCents(cash.map((p) => p.amountCents))
}

export const cashDifferenceCents = (counted: Cents, expected: Cents): Cents => counted - expected

export type CloseShiftError = 'alreadyClosed' | 'invalidCount'

export type CloseShiftResult =
  | { readonly ok: true; readonly shift: Shift; readonly closing: ShiftClosing }
  | { readonly ok: false; readonly error: CloseShiftError }

export interface CloseShiftInput {
  readonly shift: Shift
  readonly payments: readonly Payment[]
  readonly methods: readonly PaymentMethod[]
  readonly countedCashCents: Cents
  readonly reason?: string
  readonly userId: UserId
  readonly closingId: ShiftClosingId
  readonly now: Timestamp
}

export function closeShift(input: CloseShiftInput): CloseShiftResult {
  const { shift, payments, methods, countedCashCents } = input
  if (shift.status === 'closed') return { ok: false, error: 'alreadyClosed' }
  if (!Number.isInteger(countedCashCents) || countedCashCents < 0) {
    return { ok: false, error: 'invalidCount' }
  }
  const own = paymentsOfShift(shift, payments)
  const expected = expectedCashCents(shift, payments, methods)
  const totalsByMethod: MethodTotal[] = methods
    .map((m) => {
      const mine = own.filter((p) => p.methodId === m.id)
      return { methodId: m.id, totalCents: sumCents(mine.map((p) => p.amountCents)), paymentsCount: mine.length }
    })
    .filter((t) => t.paymentsCount > 0)

  const closing: ShiftClosing = {
    id: input.closingId,
    shiftId: shift.id,
    sessionId: shift.sessionId,
    closedByUserId: input.userId,
    closedAt: input.now,
    openingFloatCents: shift.openingFloatCents,
    salesCents: sumCents(own.map((p) => p.amountCents)),
    paymentsCount: own.length,
    totalsByMethod,
    expectedCashCents: expected,
    countedCashCents,
    differenceCents: cashDifferenceCents(countedCashCents, expected),
    ...(input.reason ? { reason: input.reason } : {}),
  }
  return { ok: true, shift: { ...shift, status: 'closed', closedAt: input.now }, closing }
}