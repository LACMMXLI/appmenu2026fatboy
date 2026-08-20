import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, KeyRound, Power, RotateCcw, Save, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  changeStaffPassword,
  createStaff,
  deleteAllOrders,
  DELETE_ALL_ORDERS_CONFIRMATION,
  listStaff,
  resetStaffPassword,
  updateStaff,
  type Branch,
  type Staff,
} from '@/lib/api';
import { cn } from '@/lib/utils';

interface AdminPanelProps {
  token: string;
  currentStaff: Staff;
  branches: Branch[];
  onOrdersDeleted: () => void;
}

const emptyCreateForm = {
  name: '',
  username: '',
  password: '',
  role: 'STAFF' as Staff['role'],
  branchId: '',
};

export function AdminPanel({ token, currentStaff, branches, onOrdersDeleted }: AdminPanelProps) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupConfirmation, setCleanupConfirmation] = useState('');
  const [deletingOrders, setDeletingOrders] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      setStaffList(await listStaff(token));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el personal.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  function showMessage(value: string) {
    setError('');
    setMessage(value);
    window.setTimeout(() => setMessage(''), 2800);
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const branchId = createForm.role === 'ADMIN' ? null : createForm.branchId || null;
      const created = await createStaff(token, { ...createForm, branchId });
      setStaffList((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setCreateForm(emptyCreateForm);
      showMessage(`Usuario ${created.username} creado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el usuario.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmation) {
      setError('La confirmación no coincide con la nueva contraseña.');
      return;
    }
    setSaving(true);
    try {
      await changeStaffPassword(token, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmation: '' });
      showMessage('Tu contraseña fue actualizada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setSaving(false);
    }
  }

  function replaceStaff(updated: Staff) {
    setStaffList((current) => current.map((member) => (member.id === updated.id ? updated : member)));
  }

  async function handleDeleteAllOrders() {
    if (cleanupConfirmation !== DELETE_ALL_ORDERS_CONFIRMATION) return;
    setDeletingOrders(true);
    setError('');
    try {
      const result = await deleteAllOrders(token);
      setCleanupOpen(false);
      setCleanupConfirmation('');
      onOrdersDeleted();
      showMessage(
        `${result.deletedOrders} pedidos eliminados. ${result.preservedCustomers} clientes permanecen registrados.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron eliminar los pedidos.');
    } finally {
      setDeletingOrders(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto bg-[#101010] px-4 py-5 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Configuración protegida</p>
            <h2 className="mt-1 font-display text-4xl leading-none tracking-wide">ADMINISTRACIÓN DEL SISTEMA</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Gestiona usuarios, permisos y tareas protegidas. Las sucursales se toman del catálogo existente.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => void loadStaff()} isLoading={loading}>
            <RotateCcw size={15} className="mr-1" /> Actualizar
          </Button>
        </div>

        {(message || error) && (
          <div className={cn('flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold', message && !error ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' : 'border-primary/20 bg-primary/10 text-primary')}>
            {message && !error ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
            {error || message}
          </div>
        )}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
          <section className="rounded-xl border border-white/10 bg-[#181818] p-4 lg:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary"><UserPlus size={20} /></span>
              <div>
                <h3 className="font-display text-2xl leading-none tracking-wide">NUEVO USUARIO</h3>
                <p className="mt-1 text-xs text-gray-500">Crea una cuenta y asígnala a una sucursal del menú.</p>
              </div>
            </div>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              <Input label="Nombre" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="Ej. Ana López" required />
              <Input label="Usuario" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} placeholder="ana.lopez" autoComplete="off" required />
              <Input label="Contraseña inicial" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} minLength={8} autoComplete="new-password" required />
              <label className="flex w-full flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Rol</span>
                <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as Staff['role'], branchId: e.target.value === 'ADMIN' ? '' : createForm.branchId })} className="h-14 rounded-lg border border-outline bg-surface px-4 text-sm text-white outline-none focus:border-primary">
                  <option value="STAFF">Personal operativo</option>
                  <option value="MANAGER">Encargado de sucursal</option>
                  <option value="ADMIN">Administrador global</option>
                </select>
              </label>
              <label className="flex w-full flex-col gap-1.5 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Sucursal del catálogo</span>
                <select value={createForm.branchId} disabled={createForm.role === 'ADMIN'} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })} required={createForm.role !== 'ADMIN'} className="h-14 rounded-lg border border-outline bg-surface px-4 text-sm text-white outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-40">
                  <option value="">Selecciona una sucursal</option>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                {createForm.role === 'ADMIN' && <span className="text-[11px] text-gray-500">Los administradores no quedan amarrados a una sucursal.</span>}
              </label>
              <Button type="submit" size="lg" className="sm:col-span-2" isLoading={saving}>Crear usuario</Button>
            </form>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#181818] p-4 lg:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300"><KeyRound size={20} /></span>
              <div>
                <h3 className="font-display text-2xl leading-none tracking-wide">MI CONTRASEÑA</h3>
                <p className="mt-1 text-xs text-gray-500">Sesión actual: {currentStaff.username}</p>
              </div>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <Input label="Contraseña actual" type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} autoComplete="current-password" required />
              <Input label="Nueva contraseña" type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} minLength={8} autoComplete="new-password" required />
              <Input label="Confirmar nueva contraseña" type="password" value={passwordForm.confirmation} onChange={(e) => setPasswordForm({ ...passwordForm, confirmation: e.target.value })} minLength={8} autoComplete="new-password" required />
              <Button type="submit" variant="outline" className="w-full" isLoading={saving}><Save size={15} className="mr-2" /> Cambiar contraseña</Button>
            </form>
          </section>
        </div>

        <section className="rounded-xl border border-white/10 bg-[#181818] p-4 lg:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><Users size={20} /></span>
            <div>
              <h3 className="font-display text-2xl leading-none tracking-wide">USUARIOS REGISTRADOS</h3>
              <p className="mt-1 text-xs text-gray-500">Administra estado, rol, sucursal y contraseñas.</p>
            </div>
          </div>
          {loading ? <p className="py-6 text-sm text-gray-500">Cargando personal…</p> : staffList.length === 0 ? <p className="py-6 text-sm text-gray-500">Todavía no hay usuarios registrados.</p> : (
            <div className="grid gap-3">
              {staffList.map((member) => <StaffRow key={member.id} member={member} branches={branches} token={token} onUpdated={replaceStaff} onMessage={showMessage} onError={setError} />)}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-red-400/25 bg-red-400/[0.06] p-4 lg:p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-400/15 text-red-300"><Trash2 size={20} /></span>
              <div>
                <h3 className="font-display text-2xl leading-none tracking-wide text-white">LIMPIEZA DE PEDIDOS</h3>
                <p className="mt-1 max-w-3xl text-xs font-semibold leading-relaxed text-gray-400">
                  Elimina todos los pedidos, productos asociados, historial de estados y trabajos de impresión. Los clientes, puntos, personal, sucursales y catálogo permanecen intactos.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCleanupConfirmation('');
                setError('');
                setCleanupOpen(true);
              }}
              className="border-red-400/30 text-red-300 hover:bg-red-400/10"
            >
              <Trash2 size={15} className="mr-2" /> Eliminar pedidos
            </Button>
          </div>
        </section>
      </div>

      {cleanupOpen && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
          onClick={() => { if (!deletingOrders) setCleanupOpen(false); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="cleanup-orders-title"
            className="w-full max-w-lg rounded-2xl border border-red-400/30 bg-[#181818] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">Acción irreversible</p>
                <h3 id="cleanup-orders-title" className="mt-1 font-display text-3xl leading-none tracking-wide text-white">ELIMINAR TODOS LOS PEDIDOS</h3>
              </div>
              <button type="button" onClick={() => setCleanupOpen(false)} disabled={deletingOrders} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Cerrar">
                <X size={20} />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-semibold leading-relaxed text-red-100">
              Se borrarán pedidos pendientes, pedidos finalizados, sus artículos, historial y cola de impresión. Las cuentas de clientes y sus puntos no se borrarán.
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold text-gray-300">Escribe exactamente:</span>
              <code className="mt-1 block rounded-md bg-black/30 px-3 py-2 text-xs font-black text-red-200">{DELETE_ALL_ORDERS_CONFIRMATION}</code>
              <input
                type="text"
                value={cleanupConfirmation}
                onChange={(event) => setCleanupConfirmation(event.target.value)}
                autoComplete="off"
                className="mt-2 h-12 w-full rounded-lg border border-white/10 bg-[#101010] px-3 text-sm font-bold text-white outline-none focus:border-red-400"
              />
            </label>

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" onClick={() => setCleanupOpen(false)} disabled={deletingOrders}>Cancelar</Button>
              <Button
                type="button"
                onClick={() => void handleDeleteAllOrders()}
                isLoading={deletingOrders}
                disabled={cleanupConfirmation !== DELETE_ALL_ORDERS_CONFIRMATION}
                className="bg-red-600 hover:bg-red-700"
              >
                Eliminar definitivamente
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </section>
  );
}

function StaffRow({ member, branches, token, onUpdated, onMessage, onError }: { key?: string; member: Staff; branches: Branch[]; token: string; onUpdated: (staff: Staff) => void; onMessage: (message: string) => void; onError: (message: string) => void }) {
  const [role, setRole] = useState(member.role);
  const [branchId, setBranchId] = useState(member.branchId ?? '');
  const [active, setActive] = useState(member.active);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function saveChanges() {
    setSaving(true);
    try {
      const updated = await updateStaff(token, member.id, { role, branchId: role === 'ADMIN' ? null : branchId || null, active });
      onUpdated(updated);
      onMessage(`Cambios guardados para ${member.username}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword() {
    setResetting(true);
    try {
      await resetStaffPassword(token, member.id, password);
      setPassword('');
      onMessage(`Contraseña restablecida para ${member.username}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <article className="rounded-lg border border-white/10 bg-[#11100f] p-3 lg:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={cn('mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg', member.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/5 text-gray-500')}><ShieldCheck size={18} /></span>
          <div>
            <p className="font-bold text-white">{member.name}</p>
            <p className="text-xs text-gray-500">@{member.username} · {member.role}</p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-400">
          <Power size={14} className={active ? 'text-emerald-300' : 'text-gray-600'} />
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[#e8000a]" /> Activo
        </label>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
        <select value={role} onChange={(e) => { const nextRole = e.target.value as Staff['role']; setRole(nextRole); if (nextRole === 'ADMIN') setBranchId(''); }} className="h-10 rounded-md border border-outline bg-surface px-3 text-xs text-white outline-none focus:border-primary">
          <option value="STAFF">Personal operativo</option>
          <option value="MANAGER">Encargado</option>
          <option value="ADMIN">Administrador</option>
        </select>
        <select value={branchId} disabled={role === 'ADMIN'} onChange={(e) => setBranchId(e.target.value)} className="h-10 rounded-md border border-outline bg-surface px-3 text-xs text-white outline-none focus:border-primary disabled:opacity-40">
          <option value="">Sin sucursal</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={() => void saveChanges()} isLoading={saving}><Save size={14} className="mr-1" /> Guardar</Button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-white/5 pt-3">
        <div className="min-w-[220px] flex-1"><Input label="Nueva contraseña para este usuario" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} autoComplete="new-password" /></div>
        <Button type="button" size="sm" variant="ghost" disabled={!password} onClick={() => void resetPassword()} isLoading={resetting}><KeyRound size={14} className="mr-1" /> Restablecer clave</Button>
      </div>
    </article>
  );
}
