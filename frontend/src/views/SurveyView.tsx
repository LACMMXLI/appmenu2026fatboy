import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, LockKeyhole, Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { submitSurvey, type SurveyPayload, type SurveyWouldReturn } from '@/lib/api';

type RatingKey = 'ratingGeneral' | 'ratingFood' | 'ratingService' | 'ratingWaitTime' | 'ratingCleanliness';

const ratingFields: Array<{ key: RatingKey; label: string; emoji: string }> = [
  { key: 'ratingGeneral', label: 'General', emoji: '⭐' },
  { key: 'ratingFood', label: 'Comida', emoji: '🍔' },
  { key: 'ratingService', label: 'Atención', emoji: '💁' },
  { key: 'ratingWaitTime', label: 'Espera', emoji: '⏱️' },
  { key: 'ratingCleanliness', label: 'Limpieza', emoji: '✨' },
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

const ratingLabels = ['', 'Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente'];

export function SurveyView() {
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [activeRating, setActiveRating] = useState<{ key: string; value: number } | null>(null);

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

  function handleStarClick(key: RatingKey, rating: number) {
    setForm({ ...form, [key]: rating });
    setActiveRating({ key, value: rating });
    setTimeout(() => setActiveRating(null), 600);
  }

  /* ── Success screen ──────────────────────── */
  if (submitted) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-5 text-white">
        <section
          className="w-full max-w-sm rounded-3xl border border-white/10 bg-surface p-7 text-center shadow-2xl"
          style={{ animation: 'surveyFadeInScale .4s cubic-bezier(.34,1.56,.64,1) forwards' }}
        >
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

  /* ── Survey form ─────────────────────────── */
  return (
    <>
      {/* Inline styles for animations — keeps everything self-contained */}
      <style>{`
        @keyframes surveyFadeInScale {
          from { opacity:0; transform:scale(.92); }
          to   { opacity:1; transform:scale(1); }
        }
        @keyframes surveyStarPop {
          0%   { transform:scale(1); }
          40%  { transform:scale(1.35); }
          100% { transform:scale(1); }
        }
        @keyframes surveySlideUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes surveyLabelPop {
          from { opacity:0; transform:translateY(4px) scale(.9); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
        .survey-star-pop { animation: surveyStarPop .3s cubic-bezier(.34,1.56,.64,1); }
        .survey-card-in  { animation: surveySlideUp .35s cubic-bezier(.16,1,.3,1) both; }
        .survey-card-in:nth-child(1) { animation-delay: .05s; }
        .survey-card-in:nth-child(2) { animation-delay: .1s; }
        .survey-card-in:nth-child(3) { animation-delay: .15s; }
        .survey-card-in:nth-child(4) { animation-delay: .2s; }
        .survey-card-in:nth-child(5) { animation-delay: .25s; }
        .survey-card-in:nth-child(6) { animation-delay: .3s; }
        .survey-card-in:nth-child(7) { animation-delay: .35s; }
      `}</style>

      <main className="min-h-[100dvh] overflow-y-auto bg-background px-3 py-4 text-white sm:px-5">
        <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md space-y-3 pb-6">
          {/* ── Header ─────────────────────── */}
          <header className="survey-card-in flex flex-col items-center gap-2 px-1 text-center">
            <img
              src="/images/logo.png"
              alt="Fatboy"
              className="h-11 w-11 rounded-xl object-contain"
            />
            <div>
              <p className="text-[9px] font-black uppercase tracking-[.22em] text-primary">
                Tu opinión importa
              </p>
              <h1 className="whitespace-nowrap font-display text-[clamp(1.6rem,7vw,2.3rem)] leading-none tracking-wide">
                ENCUESTA FATBOY
              </h1>
            </div>
          </header>

          {/* ── Anonymous badge ────────────── */}
          <div className="survey-card-in flex items-center justify-center gap-2 rounded-xl border border-green/20 bg-green/8 px-3 py-2 text-[10px] font-semibold text-gray-300">
            <LockKeyhole size={14} className="shrink-0 text-green" />
            Anónima · Sin datos personales
          </div>

          {/* ── 1. Branch ─────────────────── */}
          <SurveyCard title="Sucursal" step={1} className="survey-card-in">
            <div className="grid grid-cols-2 gap-2">
              {(['Venecia', 'San Marcos', 'Américas'] as const).map((branch) => (
                <ChoiceButton
                  key={branch}
                  selected={form.branch === branch}
                  onClick={() => setForm({ ...form, branch })}
                >
                  {branch}
                </ChoiceButton>
              ))}
            </div>
          </SurveyCard>

          {/* ── 2. Ratings ────────────────── */}
          <SurveyCard title="Califica tu experiencia" step={2} className="survey-card-in">
            <div className="space-y-2.5">
              {ratingFields.map(({ key, label, emoji }) => {
                const currentRating = form[key] as number;
                const justTapped = activeRating?.key === key;
                return (
                  <div key={key} className="text-center">
                    {/* Category label */}
                    <div className="mb-1.5 flex flex-col items-center">
                      <span className="flex items-center gap-1.5 text-[11px] font-bold text-gray-200">
                        <span className="text-sm">{emoji}</span>
                        {label}
                      </span>
                      {currentRating > 0 && (
                        <span
                          className="mt-0.5 text-[10px] font-bold text-gold"
                          style={{ animation: justTapped ? 'surveyLabelPop .25s ease' : 'none' }}
                        >
                          {ratingLabels[currentRating]}
                        </span>
                      )}
                    </div>
                    {/* Stars row */}
                    <div className="flex justify-center gap-1" role="radiogroup" aria-label={label}>
                      {[1, 2, 3, 4, 5].map((rating) => {
                        const filled = currentRating >= rating;
                        const isPopping = justTapped && activeRating?.value === currentRating && filled;
                        return (
                          <button
                            key={rating}
                            type="button"
                            role="radio"
                            aria-checked={currentRating === rating}
                            aria-label={`${rating} de 5`}
                            onClick={() => handleStarClick(key, rating)}
                            className="group relative p-0.5 transition-transform active:scale-90"
                          >
                            <Star
                              size={28}
                              fill={filled ? '#fabd00' : 'none'}
                              stroke={filled ? '#fabd00' : '#555'}
                              strokeWidth={1.5}
                              className={isPopping ? 'survey-star-pop' : ''}
                              style={{
                                filter: filled ? 'drop-shadow(0 0 6px rgba(250,189,0,0.4))' : 'none',
                                transition: 'fill .15s, stroke .15s, filter .15s',
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </SurveyCard>

          {/* ── 3. Would return ────────────── */}
          <SurveyCard title="¿Volverías?" step={3} className="survey-card-in">
            <div className="grid grid-cols-3 gap-2">
              {([
                ['yes', '👍 Sí'],
                ['maybe', '🤔 Tal vez'],
                ['no', '👎 No'],
              ] as const).map(([value, label]) => (
                <ChoiceButton
                  key={value}
                  selected={form.wouldReturn === value}
                  onClick={() => setForm({ ...form, wouldReturn: value })}
                >
                  {label}
                </ChoiceButton>
              ))}
            </div>
          </SurveyCard>

          {/* ── 4. Comment ────────────────── */}
          <SurveyCard title="Comentario" step={4} subtitle="Opcional" className="survey-card-in">
            <textarea
              value={form.comment}
              onChange={(event) => setForm({ ...form, comment: event.target.value })}
              maxLength={500}
              rows={2}
              placeholder="¿Qué podemos mejorar?"
              className="w-full resize-none rounded-xl border border-outline bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-gray-600 focus:border-primary"
            />
            <p className="mt-0.5 text-right text-[9px] font-semibold text-gray-500">
              {form.comment?.length ?? 0}/500
            </p>
          </SurveyCard>

          {/* ── Error ─────────────────────── */}
          {error && (
            <p
              role="alert"
              className="survey-card-in rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-[11px] font-bold text-red-200"
            >
              {error}
            </p>
          )}

          {/* ── Submit ────────────────────── */}
          <Button
            type="submit"
            size="lg"
            isLoading={isSubmitting}
            disabled={submitted}
            className="survey-card-in w-full gap-2"
          >
            <Send size={18} />
            Enviar encuesta
          </Button>

          <p className="text-center text-[9px] leading-relaxed text-gray-600">
            Tu respuesta se usa únicamente para mejorar el servicio.
          </p>
        </form>
      </main>
    </>
  );
}

/* ── Sub-components ──────────────────────── */

function SurveyCard({
  title,
  step,
  subtitle,
  className,
  children,
}: {
  title: string;
  step: number;
  subtitle?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-outline bg-surface p-3.5 shadow-lg ${className ?? ''}`}
    >
      <div className="mb-2 flex flex-col items-center gap-0.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-black text-primary">
          {step}
        </span>
        <h2 className="text-xs font-black text-white">{title}</h2>
        {subtitle && (
          <span className="text-[9px] font-semibold text-gray-500">{subtitle}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  key?: React.Key;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-10 rounded-xl border px-3 text-xs font-black transition-all duration-150 active:scale-95 ${
        selected
          ? 'border-primary bg-primary text-white shadow-[0_0_12px_rgba(232,0,10,0.25)]'
          : 'border-white/10 bg-black/20 text-gray-300 hover:border-white/20'
      }`}
    >
      {children}
    </button>
  );
}
