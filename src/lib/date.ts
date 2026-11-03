const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function expandYear(year: number): number {
  if (year >= 100) return year;
  return year >= 70 ? 1900 + year : 2000 + year;
}

/**
 * Read a date cell into YYYY-MM-DD.
 * When both the day and the month are 12 or under, the day comes first (UK style).
 * A 6-digit number is YYMMDD, which is how MT940 writes dates.
 */
export function parseDate(input: string | null | undefined): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw) return null;

  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (match) return iso(+match[1], +match[2], +match[3]);

  match = raw.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/);
  if (match) return iso(+match[1], +match[2], +match[3]);

  match = raw.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6}(?:\.\d+)?)?(?:\[[^\]]*\])?$/);
  if (match) return iso(+match[1], +match[2], +match[3]);

  match = raw.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (match) return iso(expandYear(+match[1]), +match[2], +match[3]);

  match = raw.match(/^(\d{1,2})[\s./-]+([A-Za-z]+)[\s./-]+(\d{2,4})$/);
  if (match && MONTHS[match[2].toLowerCase()]) {
    return iso(expandYear(+match[3]), MONTHS[match[2].toLowerCase()], +match[1]);
  }

  match = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (match && MONTHS[match[1].toLowerCase()]) {
    return iso(expandYear(+match[3]), MONTHS[match[1].toLowerCase()], +match[2]);
  }

  match = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (match) {
    const first = +match[1];
    const second = +match[2];
    const year = expandYear(+match[3]);
    if (first > 12 && second <= 12) return iso(year, second, first);
    if (second > 12 && first <= 12) return iso(year, first, second);
    return iso(year, second, first);
  }

  return null;
}

export function daysBetween(laterOrA: string, earlierOrB: string): number {
  const a = utcDay(laterOrA);
  const b = utcDay(earlierOrB);
  return Math.round((a - b) / 86_400_000);
}

function utcDay(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}
