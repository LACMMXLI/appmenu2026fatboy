import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Order } from '@/lib/api';

// Sección Doce del plan: motivos predefinidos + "Otro" con texto libre.
// El motivo es obligatorio en ambos casos — nunca se permite confirmar sin
// uno (el backend también lo exige, esto es solo mejor UX).
const PRESET_REASONS = [
  'Producto agotado',
  'Sucursal por cerrar',
  'Problema con el pedido',
];
const OTHER = 'Otro';

export function RejectOrderModal({
  order,
  onCancel,
  onConfirm,
}: {
  order: Order;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [selected, setSelected] = useState<string>('');
  const [customReason, setCustomReason] = useState('');

  const finalReason = selected === OTHER ? customReason.trim() : selected;
  const canConfirm = Boolean(finalReason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-[#181818] p-5">
        <h2 className="font-display text-2xl">Rechazar pedido {order.folio}</h2>
        <p className="mt-1 text-xs font-semibold text-gray-400">El cliente verá este motivo inmediatamente.</p>

        <div className="mt-4 space-y-2">
          {[...PRESET_REASONS, OTHER].map((reason) => (
            <label
              key={reason}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#101010] px-3 py-2.5 text-sm font-semibold text-white has-[:checked]:border-primary has-[:checked]:bg-primary/10"
            >
              <input
                type="radio"
                name="reject-reason"
                value={reason}
                checked={selected === reason}
                onChange={() => setSelected(reason)}
                className="accent-primary"
              />
              {reason}
            </label>
          ))}
        </div>

        {selected === OTHER && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder="Especificar motivo…"
            className="mt-3 h-20 w-full rounded-lg border border-white/10 bg-[#101010] p-3 text-sm text-white outline-none focus:border-primary"
            autoFocus
          />
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={() => onConfirm(finalReason)} disabled={!canConfirm}>Confirmar rechazo</Button>
        </div>
      </div>
    </div>
  );
}
