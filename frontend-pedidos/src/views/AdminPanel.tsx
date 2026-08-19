import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Power, RotateCcw, Save, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  changeStaffPassword,
  createStaff,
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
}

const emptyCreateForm = {
  name: '',
  username: '',
  password: '',
  role: 'STAFF' as Staff['role'],
  branchId: '',
};

export function AdminPanel({ token, currentStaff, branches }: AdminPanelProps) {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmation: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  return (
    <section className="flex-1 overflow-y-auto bg-[#101010] px-4 py-5 lg:px-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-primary">Configuración protegida</p>
            <h2 className="mt-1 font-display text-4xl leading-none tracking-wide">PERSONAL Y ACCESO</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-400">
              Las sucursales se toman del catálogo existente. Aquí solo asignas usuarios y permisos para recibir pedidos.
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
      </div>
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
