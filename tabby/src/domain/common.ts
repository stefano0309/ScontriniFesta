/** Importo in centesimi di euro. Sempre un intero: niente decimali nei calcoli. */
export type Cents = number

/** Data/ora in formato ISO 8601 UTC, es. "2026-10-14T18:30:00.000Z". */
export type Timestamp = string

export const toCents = (euros: number): Cents => Math.round(euros * 100)

export const sumCents = (values: readonly Cents[]): Cents =>
  values.reduce((total, v) => total + v, 0)

/** Solo per l'interfaccia: i calcoli restano in centesimi. */
export const formatEuro = (cents: Cents): string =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)