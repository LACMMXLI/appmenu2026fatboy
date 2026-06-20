import React, { useEffect, useState } from 'react';
import { ArrowLeft, Filter, KeyRound, MessageSquareText, RefreshCw, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  getAdminSurveyResponses,
  type SurveyAdminResult,
  type SurveyFilters,
  type SurveyResponseItem,
} from '@/lib/api';

const emptyResult: SurveyAdminResult = {
  metrics: {
    total: 0,
    averageGeneral: 0,
    averageFood: 0,
    averageService: 0,
    averageWaitTime: 0,
    averageCleanliness: 0,
    wouldReturnPercent: 0,
  },
  recentComments: [],
  responses: [],
};

const returnLabels = { yes: 'Sí', no: 'No', maybe: 'Tal vez' } as const;

export function AdminSurveysView() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem('fatboy-admin-key') ?? '');
  const [authorized, setAuthorized] = useState(false);
  const [result, setResult] = useState(emptyResult);
  const [filters, setFilters] = useState<SurveyFilters>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (adminKey) void load(adminKey, filters);
  }, []);

  async function load(key = adminKey, nextFilters = filters) {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminSurveyResponses(key, nextFilters);
      setResult(data);
      setAuthorized(true);
      sessionStorage.setItem('fatboy-admin-key', key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las encuestas.');
      if (!authorized) setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  if (!authorized) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background p-5 text-white">
        <form
          onSubmit={(event) => { event.preventDefault(); void load(); }}
          className="w-full max-w-sm rounded-2xl border border-outline bg-surface p-6 shadow-2xl"
        >
          <KeyRound className="text-primary" size={32} />
          <h1 className="mt-4 font-display text-4xl tracking-wide">ADMIN ENCUESTAS</h1>
          <p className="mb-5 text-xs text-gray-500">Usa la misma clave del panel administrativo.</p>
          <Input label="Clave administrativa" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} required />
          {error && <p className="mt-3 text-xs font-bold text-red-400">{error}</p>}
          <Button type="submit" isLoading={loading} className="mt-5 w-full">Entrar</Button>
        </form>
      </main>
    );
  }

  const metrics = result.metrics;
  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-background p-4 text-white lg:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-outline pb-4">
          <div className="flex items-center gap-3">
            <a href="/admin-catalog" className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline bg-surface text-gray-400 hover:text-white" aria-label="Volver al panel">
              <ArrowLeft size={18} />
            </a>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Satisfacción del cliente</p>
              <h1 className="font-display text-4xl leading-none tracking-wide">ENCUESTAS</h1>
            </div>
          </div>
          <Button size="sm" variant="outline" isLoading={loading} onClick={() => void load()}><RefreshCw size={15} /> Actualizar</Button>
        </header>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <Metric label="Respuestas" value={String(metrics.total)} />
          <Metric label="General" value={formatAverage(metrics.averageGeneral)} />
          <Metric label="Comida" value={formatAverage(metrics.averageFood)} />
          <Metric label="Atención" value={formatAverage(metrics.averageService)} />
          <Metric label="Espera" value={formatAverage(metrics.averageWaitTime)} />
          <Metric label="Limpieza" value={formatAverage(metrics.averageCleanliness)} />
          <Metric label="Sí volverían" value={`${metrics.wouldReturnPercent.toFixed(0)}%`} />
        </section>

        <section className="rounded-xl border border-outline bg-surface p-4">
          <div className="mb-3 flex items-center gap-2"><Filter size={16} className="text-primary" /><h2 className="text-xs font-black uppercase tracking-wider">Filtros</h2></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <FilterSelect label="Sucursal" value={filters.branch ?? ''} onChange={(value) => setFilters({ ...filters, branch: value })} options={[['', 'Todas'], ['Venecia', 'Venecia'], ['San Marcos', 'San Marcos']]} />
            <FilterInput label="Fecha inicial" type="date" value={filters.dateFrom ?? ''} onChange={(value) => setFilters({ ...filters, dateFrom: value })} />
            <FilterInput label="Fecha final" type="date" value={filters.dateTo ?? ''} onChange={(value) => setFilters({ ...filters, dateTo: value })} />
            <FilterSelect label="General" value={filters.ratingGeneral ?? ''} onChange={(value) => setFilters({ ...filters, ratingGeneral: value })} options={[['', 'Todas'], ['5', '5 estrellas'], ['4', '4 estrellas'], ['3', '3 estrellas'], ['2', '2 estrellas'], ['1', '1 estrella']]} />
            <label className="flex min-h-14 items-center gap-2 rounded-lg border border-outline bg-black/20 px-3 text-xs font-bold text-gray-300 lg:mt-[18px]">
              <input type="checkbox" checked={filters.hasComment ?? false} onChange={(event) => setFilters({ ...filters, hasComment: event.target.checked })} className="accent-primary" />
              Con comentario
            </label>
            <Button className="lg:mt-[18px]" onClick={() => void load(adminKey, filters)} isLoading={loading}>Aplicar</Button>
          </div>
          {error && <p className="mt-3 text-xs font-bold text-red-400">{error}</p>}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-outline bg-surface">
            <div className="border-b border-outline px-4 py-3"><h2 className="text-xs font-black uppercase tracking-wider">Respuestas completas ({result.responses.length})</h2></div>
            {result.responses.length === 0 ? (
              <p className="p-8 text-center text-xs text-gray-500">No hay respuestas con estos filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left text-xs">
                  <thead className="bg-black/25 text-[10px] uppercase tracking-wider text-gray-500">
                    <tr><th className="p-3">Fecha</th><th>Sucursal</th><th>General</th><th>Comida</th><th>Atención</th><th>Espera</th><th>Limpieza</th><th>Volvería</th><th className="pr-3">Comentario</th></tr>
                  </thead>
                  <tbody className="divide-y divide-outline/70">
                    {result.responses.map((response) => <ResponseRow key={response.id} response={response} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-outline bg-surface">
            <div className="flex items-center gap-2 border-b border-outline px-4 py-3"><MessageSquareText size={16} className="text-gold" /><h2 className="text-xs font-black uppercase tracking-wider">Comentarios recientes</h2></div>
            <div className="max-h-[620px] divide-y divide-outline/70 overflow-y-auto">
              {result.recentComments.length === 0 && <p className="p-6 text-center text-xs text-gray-500">Sin comentarios.</p>}
              {result.recentComments.map((item) => (
                <article key={item.id} className="p-4">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-gray-500"><span>{item.branch}</span><span>{formatDate(item.createdAt)}</span></div>
                  <p className="text-xs leading-relaxed text-gray-200">{item.comment}</p>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="rounded-xl border border-outline bg-surface p-4"><p className="text-[9px] font-black uppercase tracking-wider text-gray-500">{label}</p><p className="mt-1 flex items-center gap-1 text-2xl font-black"><Star size={14} className="text-gold" fill="currentColor" />{value}</p></article>;
}

function ResponseRow({ response }: { response: SurveyResponseItem }) {
  return (
    <tr className="align-top hover:bg-white/[0.025]">
      <td className="whitespace-nowrap p-3 text-gray-400">{formatDate(response.createdAt)}</td>
      <td className="whitespace-nowrap py-3 font-bold">{response.branch}</td>
      <td className="py-3 font-black text-gold">{response.ratingGeneral}</td><td className="py-3">{response.ratingFood}</td><td className="py-3">{response.ratingService}</td><td className="py-3">{response.ratingWaitTime}</td><td className="py-3">{response.ratingCleanliness}</td>
      <td className="whitespace-nowrap py-3">{returnLabels[response.wouldReturn]}</td>
      <td className="max-w-[300px] py-3 pr-3 leading-relaxed text-gray-400">{response.comment || '—'}</td>
    </tr>
  );
}

function FilterInput({ label, ...props }: { label: string; type: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}<input type={props.type} value={props.value} onChange={(event) => props.onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline bg-black/20 px-3 text-xs text-white outline-none focus:border-primary" /></label>;
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}<select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-outline bg-[#111] px-3 text-xs text-white outline-none focus:border-primary">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>;
}

function formatAverage(value: number) { return Number(value).toFixed(1); }
function formatDate(value: string) { return new Date(value).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }); }
