import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, LockKeyhole, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { submitSurvey, type SurveyPayload, type SurveyWouldReturn } from '@/lib/api';

type RatingKey = 'ratingGeneral' | 'ratingFood' | 'ratingService' | 'ratingWaitTime' | 'ratingCleanliness';

const ratingFields: Array<{ key: RatingKey; label: string }> = [
  { key: 'ratingGeneral', label: 'Calificación general' },
  { key: 'ratingFood', label: 'Calidad de comida' },
  { key: 'ratingService', label: 'Atención del personal' },
  { key: 'ratingWaitTime', label: 'Tiempo de espera' },
  { key: 'ratingCleanliness', label: 'Limpieza del lugar' },
];

const initialForm: SurveyPayload = {
  branch: '' as SurveyPayload['branch'],
  ratingGeneral: 0,
  ratingFood: 0,
  ratingService: 0,
  ratingWaitTime: 0,
  ratingCleanliness: 0,
  wouldReturn: '' as SurveyWouldReturn,
  comment: '',
};

export function SurveyView() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!submitted) return;
    const timer = window.setTimeout(() => window.location.assign('/'), 2500);
    return () => window.clearTimeout(timer);
  }, [submitted]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting || submitted) return;
    if (!form.branch || ratingFields.some(({ key }) => !form[key]) || !form.wouldReturn) {
      setError('Completa todos los campos obligatorios.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await submitSurvey({ ...form, comment: form.comment?.trim() || undefined });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la encuesta.');
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-white">
        <section className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface p-7 text-center shadow-2xl">
          <CheckCircle2 className="mx-auto text-green" size={58} strokeWidth={1.8} />
          <h1 className="mt-5 font-display text-4xl tracking-wide">¡GRACIAS!</h1>
          <p className="mt-2 text-sm font-semibold text-gray-300">Gracias por ayudarnos a mejorar.</p>
          <p className="mt-1 text-xs text-gray-500">Te llevaremos al menú en unos segundos.</p>
          <Button className="mt-6 w-full" size="lg" onClick={() => window.location.assign('/')}>
            Ver menú <ChevronRight size={20} />
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-background px-4 py-6 text-white sm:px-6">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-lg space-y-4 pb-8">
        <header className="flex items-center gap-3 px-1 py-2">
          <img src="/images/logo.png" alt="Fatboy" className="h-14 w-14 rounded-xl object-contain" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Tu opinión importa</p>
            <h1 className="font-display text-4xl leading-none tracking-wide">ENCUESTA FATBOY</h1>
          </div>
        </header>

        <div className="flex items-center gap-2 rounded-xl border border-green/20 bg-green/8 px-4 py-3 text-xs font-semibold text-gray-300">
          <LockKeyhole size={17} className="shrink-0 text-green" />
          Encuesta anónima. No pedimos datos personales.
        </div>

        <SurveyCard title="1. Elige tu sucursal">
          <div className="grid grid-cols-2 gap-2">
            {(['Venecia', 'San Marcos'] as const).map((branch) => (
              <ChoiceButton key={branch} selected={form.branch === branch} onClick={() => setForm({ ...form, branch })}>
                {branch}
              </ChoiceButton>
            ))}
          </div>
        </SurveyCard>

        <SurveyCard title="2. Califica tu experiencia" subtitle="1 es muy malo y 5 es excelente">
          <div className="divide-y divide-white/6">
            {ratingFields.map(({ key, label }) => (
              <div key={key} className="py-3 first:pt-1 last:pb-1">
                <p className="mb-2 text-xs font-bold text-gray-200">{label}</p>
                <div className="flex justify-between gap-1" role="radiogroup" aria-label={label}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      role="radio"
                      aria-checked={form[key] === rating}
                      aria-label={`${rating} de 5`}
                      onClick={() => setForm({ ...form, [key]: rating })}
                      className={`flex h-11 flex-1 items-center justify-center rounded-lg border transition-colors ${
                        form[key] >= rating
                          ? 'border-gold bg-gold/12 text-gold'
                          : 'border-white/10 bg-black/20 text-gray-600'
                      }`}
                    >
                      <Star size={20} fill={form[key] >= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SurveyCard>

        <SurveyCard title="3. ¿Volverías a comprar?">
          <div className="grid grid-cols-3 gap-2">
            {([
              ['yes', 'Sí'],
              ['maybe', 'Tal vez'],
              ['no', 'No'],
            ] as const).map(([value, label]) => (
              <ChoiceButton key={value} selected={form.wouldReturn === value} onClick={() => setForm({ ...form, wouldReturn: value })}>
                {label}
              </ChoiceButton>
            ))}
          </div>
        </SurveyCard>

        <SurveyCard title="4. Comentario" subtitle="Opcional">
          <textarea
            value={form.comment}
            onChange={(event) => setForm({ ...form, comment: event.target.value })}
            maxLength={500}
            rows={4}
            placeholder="Cuéntanos qué podemos mejorar..."
            className="w-full resize-none rounded-xl border border-outline bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-primary"
          />
          <p className="mt-1 text-right text-[10px] font-semibold text-gray-500">{form.comment?.length ?? 0}/500</p>
        </SurveyCard>

        {error && <p role="alert" className="rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs font-bold text-red-200">{error}</p>}

        <Button type="submit" size="lg" isLoading={isSubmitting} disabled={submitted} className="w-full">
          Enviar encuesta
        </Button>
        <p className="text-center text-[10px] leading-relaxed text-gray-600">Tu respuesta se usa únicamente para mejorar el servicio.</p>
      </form>
    </main>
  );
}

function SurveyCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-outline bg-surface p-4 shadow-lg">
      <div className="mb-3">
        <h2 className="text-sm font-black text-white">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[10px] font-semibold text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ChoiceButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 rounded-xl border px-3 text-xs font-black transition-colors ${
        selected ? 'border-primary bg-primary text-white' : 'border-white/10 bg-black/20 text-gray-300'
      }`}
    >
      {children}
    </button>
  );
}
