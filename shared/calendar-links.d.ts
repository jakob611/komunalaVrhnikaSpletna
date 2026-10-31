type Event = { id: string; date: string; type: string; label: string };
export type CalendarDestinations = Record<
  "google" | "apple" | "outlook" | "other",
  string
>;
export function calendarLinks(options: {
  event: Event;
  address: string;
  routeId?: string;
  outlookWork?: boolean;
  today?: string;
}): {
  once: CalendarDestinations;
  upcoming: CalendarDestinations | null;
  feed: string | null;
};
