import type { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 21;
const BUSINESS_TIME_ZONE = 'America/Tijuana';

export const PROMOTION_START_HOUR_KEY = 'promotions_start_hour';
export const PROMOTION_END_HOUR_KEY = 'promotions_end_hour';

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

export async function resolvePromotionWindowHours(prisma: PrismaService): Promise<{ startHour: number; endHour: number }> {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [PROMOTION_START_HOUR_KEY, PROMOTION_END_HOUR_KEY] } },
  });
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const startHour = parseHour(map.get(PROMOTION_START_HOUR_KEY), DEFAULT_START_HOUR);
  const endHour = parseHour(map.get(PROMOTION_END_HOUR_KEY), DEFAULT_END_HOUR);

  if (startHour >= endHour) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  return { startHour, endHour };
}
