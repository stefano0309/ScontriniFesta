import type { PrinterId, SessionId } from './ids'
import type { PrintKind } from './printJob'

export type PrinterConnection = 'bluetooth' | 'network' | 'rawbt'
export type PrinterStatus = 'ready' | 'offline' | 'error'
export type PaperWidthMm = 58 | 80

export interface Printer {
  readonly id: PrinterId
  readonly sessionId: SessionId
  readonly name: string
  readonly connection: PrinterConnection
  /** MAC Bluetooth o indirizzo IP, a seconda della connessione. */
  readonly address?: string
  readonly paperWidthMm: PaperWidthMm
  readonly status: PrinterStatus
  /** Quali documenti stampa: ricevute, comande o entrambi. */
  readonly handles: readonly PrintKind[]
  readonly hasCutter: boolean
  /** Righe vuote prima del taglio, da regolare con il test di calibrazione. */
  readonly cutFeedLines: number
}

/** Caratteri per riga con il font standard ESC/POS. */
export const charsPerLine = (width: PaperWidthMm): number => (width === 58 ? 32 : 48)