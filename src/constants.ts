/**
 * Date options for {@link Date#toLocaleString}
 *
 * Resulting format: `01/01/1970, 12:00:00`
 */
export const LOG_ENTRY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    hour12: false
};