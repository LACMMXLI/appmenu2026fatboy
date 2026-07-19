const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 21;
const BUSINESS_TIME_ZONE = 'America/Tijuana';

export function areMenuPromotionsOpen(
  now = new Date(),
  startHour = DEFAULT_START_HOUR,
  endHour = DEFAULT_END_HOUR,
) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(now));

  return hour >= startHour && hour < endHour;
}

function parseHour(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
    return fallback;
  }
  return parsed;
}

export function resolvePromotionWindowHours(settings: Record<string, string>): { startHour: number; endHour: number } {
  const startHour = parseHour(settings.promotions_start_hour, DEFAULT_START_HOUR);
  const endHour = parseHour(settings.promotions_end_hour, DEFAULT_END_HOUR);

  if (startHour >= endHour) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  return { startHour, endHour };
}

export function formatPromotionHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}
