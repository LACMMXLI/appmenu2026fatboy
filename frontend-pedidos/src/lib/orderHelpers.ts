// Utilidades puramente de presentación para pedidos — sin lógica de
// negocio (Sección Cinco del plan: React solo representa el estado que ya
// calculó el backend, nunca decide reglas por su cuenta).

export function currency(value: number): string {
  return value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export function parseJsonList(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean);
    }
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

export function orderAge(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  return `Hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// Sección Treinta y uno: "el tiempo transcurrido es operacionalmente más
// importante que la fecha completa" — pero la hora de reloj sigue siendo
// el ancla que el operador reconoce de un vistazo.
export function orderClockTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
}

function orderAgeMinutes(createdAt: string): number {
  return Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 60000);
}

// Umbrales por estado — "demasiado tiempo" no significa lo mismo esperando
// aceptación que esperando que el cliente recoja un pedido ya listo
// (Sección Treinta y uno: destacar visualmente los pedidos que se
// atrasan). Solo aplica a estados activos; los terminales no se destacan.
const STALE_MINUTES_BY_STATUS: Partial<Record<string, number>> = {
  PENDING_APPROVAL: 8,
  ACCEPTED: 15,
  PREPARING: 20,
  READY: 10,
};

export function isOrderStale(order: { status: string; createdAt: string }): boolean {
  const threshold = STALE_MINUTES_BY_STATUS[order.status];
  if (!threshold) return false;
  return orderAgeMinutes(order.createdAt) >= threshold;
}

// Ping corto por WebAudio — sin asset externo. El navegador solo exige un
// gesto previo del usuario (el submit del login) antes de permitir audio
// (Sección Nueve del plan).
export function playNewOrderChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // Restricciones de autoplay/permisos — se omite en silencio, la UI ya se actualizó igual.
  }
}
