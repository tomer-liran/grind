// @ts-check

export const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

export function formatLocalDateKey(date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function getLocalWeekKey(input = new Date()) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("A valid date is required to calculate a week key.");
  }

  const day = date.getDay();
  const offsetToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offsetToMonday);
  date.setHours(0, 0, 0, 0);
  return formatLocalDateKey(date);
}

export function getLocalWeekday(input = new Date()) {
  const date = new Date(input);
  return WEEKDAY_NAMES[date.getDay()] ?? "";
}

export function formatWeekdayLabel(weekday) {
  if (!weekday) return "";
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}
