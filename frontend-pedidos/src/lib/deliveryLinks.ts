export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

export function buildPhoneUrl(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function buildWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const international = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${international}`;
}
