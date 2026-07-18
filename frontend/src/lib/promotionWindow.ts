const PROMOTION_CUTOFF_HOUR = 21;
const BUSINESS_TIME_ZONE = 'America/Tijuana';

export function areMenuPromotionsOpen(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: BUSINESS_TIME_ZONE,
  }).format(now));

  return hour < PROMOTION_CUTOFF_HOUR;
}
