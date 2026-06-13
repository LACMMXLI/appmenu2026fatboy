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
] as const;

export type GoogleReviewBranch = (typeof GOOGLE_REVIEW_BRANCHES)[number];

export function buildGoogleReviewUrl(placeId: string) {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

export function getGoogleReviewUrl(branch: GoogleReviewBranch, settings: Record<string, string>) {
  const configuredUrl = settings[branch.settingsKey]?.trim();
  return configuredUrl || buildGoogleReviewUrl(branch.fallbackPlaceId);
}
