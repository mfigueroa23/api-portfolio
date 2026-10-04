// Calendar dates travel as text and are stored in DATE columns, which Prisma
// reads back as UTC midnight; going through UTC keeps them unchanged.
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function monthToDate(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`);
}

export function dateToMonth(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 7) : null;
}

export function calendarToDate(day: string): Date;
export function calendarToDate(day: string | null | undefined): Date | null;
export function calendarToDate(day: string | null | undefined): Date | null {
  return day ? new Date(`${day}T00:00:00Z`) : null;
}

export function dateToCalendar(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}
