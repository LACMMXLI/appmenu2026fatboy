import { describe, expect, it } from 'vitest';
import { buildGoogleMapsUrl, buildPhoneUrl, buildWhatsAppUrl } from './deliveryLinks';

describe('delivery links', () => {
  it('encodes the full delivery address for Google Maps', () => {
    expect(buildGoogleMapsUrl('Av. de las Américas 123, Mexicali')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Av.%20de%20las%20Am%C3%A9ricas%20123%2C%20Mexicali',
    );
  });

  it('keeps phone links dialable and adds Mexico country code for WhatsApp', () => {
    expect(buildPhoneUrl('(686) 123-4567')).toBe('tel:6861234567');
    expect(buildWhatsAppUrl('(686) 123-4567')).toBe('https://wa.me/526861234567');
  });
});
