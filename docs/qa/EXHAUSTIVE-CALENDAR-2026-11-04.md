# Calendar acceptance audit, 3–4 November 2026

The earlier review checked the Google link and feed response but missed the provider failure. This pass exercised Google Calendar with a signed-in browser and compared events in the receiving calendar with the published route.

| Action | Result and evidence |
| --- | --- |
| Google, original future-collection shortcut | Reproduced “Unable to add calendar. Check the URL.” The browser received Google’s error with an HTTPS feed inside `cid`. The feed returned valid iCalendar data over HTTPS. |
| Google, direct subscription | Google’s Add calendar dialog accepted the `webcal:` URL through `/calendar/render`. Google initially listed the URL without events. After its first import, the calendar was named KPV – Mešana embalaža and showed the published 4 and 18 November and 2 December all-day dates. The Google settings displayed the exact tested source URL. |
| Google, From URL fallback | Pasting the production HTTPS BIO feed into Google’s From URL form created KPV – Biološki odpadki with all-day events on 3, 10, 17 and 24 November and 1 December. In the isolated HTTPS preview, the site’s copy button put the exact HTTPS feed on the clipboard and its fallback link reached Google’s From URL form. |
| Google, one date | The user reported that this path works. Rendered tests verify the event form and the exclusive next-day end date. The subscription fix preserves that path. |
| Apple, one date and subscription | Rendered tests verify the single-date HTTPS download and native `webcal:` subscription. Native acceptance requires an Apple device. |
| Outlook, personal and work/school | Rendered tests verify both host choices, the all-day event boundaries, and the HTTPS feed passed into the subscription screen. Account acceptance requires a Microsoft account. |
| Other calendars and file fallback | Rendered tests exercise single-event file, native subscription, download link and unavailable route. ICAL.js independently parsed the calendar output. |
| Exact dates and feed refresh | The independent parser checked 96 route/fraction combinations, including empty feeds. Tests verify all-day dates, next-day end dates, unique event IDs, route-only locations, UTF-8 folding, and correct dates after moves, deletions and removal of a route. |
| Provider HTTP probes and calendar descriptions | A live `HEAD` returned 405 before the fix. The updated Worker returns the GET status and calendar headers without a response body. The subscription description now explains updates and possible delays. The downloaded copy still explains that it stays fixed. |
| Dialog states | Rendered tests cover switching providers and repeat mode, pending clipboard completion, copy failure and retry, Escape, no confirmed route, and HTTPS fallback without a household address. |

The final design keeps the direct Google shortcut and adds a collapsible copy-link fallback to Google’s supported From URL screen. The provider can take time to load the first dates. [Google Calendar Help](https://support.google.com/calendar/answer/37100?hl=en)

The user confirmed that Apple and Outlook acceptance environments are unavailable. Current Work settings also disabled computer control during the final pass, so the final portal button still needs a browser click-through with the changed bundle. The actual Google provider test used the exact link format now emitted by the portal. [Apple Calendar subscription guidance](https://developer.apple.com/library/archive/documentation/AppleApplications/Conceptual/CalendarScriptingGuide/Calendar-SubscribetoaCalendar.html) · [Outlook subscription guidance](https://support.microsoft.com/en-us/outlook/import-or-subscribe-to-a-calendar-in-outlook-com-or-outlook-on-the-web)
