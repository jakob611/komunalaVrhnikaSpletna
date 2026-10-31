export type CalendarDate = { id: string; type: string; date: string };
export function publishedCalendarSeries<T extends CalendarDate>(
  events: T[],
  selectedId: string,
): T[];
export function publishedRecurrence(dates: string[]): string[];
