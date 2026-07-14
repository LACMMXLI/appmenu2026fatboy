export const GOOGLE_REVIEW_BRANCHES = [
  {
    id: 'venecia',
    label: 'Venecia',
    settingsKey: 'google_reviews_url',
    fallbackPlaceId: 'ChIJi0vnrExx14ARCFbYG3xvPqo',
  },
  {
    id: 'san-marcos',
    label: 'San Marcos',
    settingsKey: 'google_reviews_san_marcos_url',
    fallbackPlaceId: 'ChIJ6zxiklN714ARVQ2BPf3W3Xc',
  },
  {
    id: 'americas',
    label: 'Calzada de las Américas',
    settingsKey: 'google_reviews_americas_url',
    fallbackPlaceId: 'ChIJD2a-eABx14ARQpdrmTxn--Y',
  },
] as const;

export type GoogleReviewBranch = (typeof GOOGLE_REVIEW_BRANCHES)[number];

export const GOOGLE_REVIEW_ROUTE = '/google-review';
export const GOOGLE_REVIEW_ROUTE_ALIASES = [GOOGLE_REVIEW_ROUTE, '/google-reviews', '/resenas-google', '/calificar'];
export const GOOGLE_REVIEW_COOLDOWN_MS = 12 * 60 * 60 * 1000;
export const GOOGLE_REVIEW_LAST_SUBMITTED_KEY = 'fatboy-google-review-last-submitted-at';

export function buildGoogleReviewUrl(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function withGoogleReviewRating(url: string, rating: number) {
  if (rating < 4 || rating > 5) return url;
  if (url.includes('/maps/')) return url.replace(/,\d?$/, '') + `,${rating}`;
  return url;
}

export function getGoogleReviewUrl(branch: GoogleReviewBranch, settings: Record<string, string>) {
  const configuredUrl = settings[branch.settingsKey]?.trim();
  return configuredUrl || buildGoogleReviewUrl(branch.fallbackPlaceId);
}

export function isGoogleReviewRoutePath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return GOOGLE_REVIEW_ROUTE_ALIASES.includes(normalized);
}

export function getGoogleReviewCooldown(now = Date.now()) {
  const storedValue = localStorage.getItem(GOOGLE_REVIEW_LAST_SUBMITTED_KEY);
  const lastSubmittedAt = storedValue ? Number(storedValue) : 0;
  const remainingMs = Math.max(0, lastSubmittedAt + GOOGLE_REVIEW_COOLDOWN_MS - now);

  return {
    blocked: remainingMs > 0,
    remainingMs,
    nextAllowedAt: remainingMs > 0 ? new Date(now + remainingMs) : null,
  };
}

export function markGoogleReviewSubmitted(now = Date.now()) {
  localStorage.setItem(GOOGLE_REVIEW_LAST_SUBMITTED_KEY, String(now));
}

export function formatGoogleReviewCooldown(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
