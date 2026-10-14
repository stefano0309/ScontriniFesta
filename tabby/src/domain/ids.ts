/**
 * ID "marchiati": un ShiftId non si può passare dove serve un OrderId.
 * Gli ID sono generati sul dispositivo (UUID) così un invio ripetuto
 * dopo un errore di rete non crea duplicati.
 */
export type Id<T extends string> = string & { readonly __brand: T }

export const asId = <T extends string>(value: string): Id<T> => value as Id<T>
export const newId = <T extends string>(): Id<T> => crypto.randomUUID() as Id<T>

export type UserId = Id<'User'>
export type EventId = Id<'Event'>
export type SessionId = Id<'Session'>
export type ShiftId = Id<'Shift'>
export type DeviceId = Id<'Device'>
export type CategoryId = Id<'Category'>
export type ProductId = Id<'Product'>
export type OrderId = Id<'Order'>
export type OrderLineId = Id<'OrderLine'>
export type PaymentId = Id<'Payment'>
export type PaymentMethodId = Id<'PaymentMethod'>
export type PrintJobId = Id<'PrintJob'>
export type PrinterId = Id<'Printer'>
export type ReceiptConfigId = Id<'ReceiptConfig'>
export type StockMovementId = Id<'StockMovement'>
export type AuditEntryId = Id<'AuditEntry'>
export type ShiftClosingId = Id<'ShiftClosing'>
export type ExpenseId = Id<'Expense'>

export const asUserId = asId<'User'>
export const asEventId = asId<'Event'>
export const asSessionId = asId<'Session'>
export const asShiftId = asId<'Shift'>
export const asDeviceId = asId<'Device'>
export const asCategoryId = asId<'Category'>
export const asProductId = asId<'Product'>
export const asOrderId = asId<'Order'>
export const asOrderLineId = asId<'OrderLine'>
export const asPaymentId = asId<'Payment'>
export const asPaymentMethodId = asId<'PaymentMethod'>
export const asPrintJobId = asId<'PrintJob'>
export const asPrinterId = asId<'Printer'>
export const asReceiptConfigId = asId<'ReceiptConfig'>
export const asStockMovementId = asId<'StockMovement'>
export const asAuditEntryId = asId<'AuditEntry'>
export const asShiftClosingId = asId<'ShiftClosing'>
export const asExpenseId = asId<'Expense'>