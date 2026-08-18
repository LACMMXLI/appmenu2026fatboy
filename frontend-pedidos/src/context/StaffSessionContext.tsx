import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getBranches, getStaffMe, staffLogin, staffLogout, type Branch, type Staff } from '@/lib/api';

// La app vive instalada en tablets de sucursal (Sección Veintiocho del
// plan): usamos localStorage, no sessionStorage, para que la sesión
// sobreviva a que la PWA se cierre y reabra — StaffSession ya dura 14h en
// el backend (un turno operativo), así que basta con no perder el token al
// cerrar la pestaña.
const STAFF_TOKEN_KEY = 'fatboy-pedidos-staff-token';

interface StaffSessionValue {
  /** null mientras se restaura la sesión guardada; false si no hay sesión válida. */
  staff: Staff | null;
  token: string;
  isRestoring: boolean;
  error: string;
  branches: Branch[];
  /** Sucursal real del operador. Nunca elegible manualmente salvo ADMIN (Sección Seis). */
  effectiveBranchId: string;
  selectedBranchId: string;
  setSelectedBranchId: (branchId: string) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const StaffSessionContext = createContext<StaffSessionValue | null>(null);

export function StaffSessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState(() => localStorage.getItem(STAFF_TOKEN_KEY) ?? '');
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  // Restaurar sesión guardada al abrir la app.
  useEffect(() => {
    if (!token) {
      setIsRestoring(false);
      return;
    }
    getStaffMe(token)
      .then((s) => {
        setStaff(s);
        if (s.branchId) setSelectedBranchId(s.branchId);
      })
      .catch(() => {
        localStorage.removeItem(STAFF_TOKEN_KEY);
        setToken('');
      })
      .finally(() => setIsRestoring(false));
  }, [token]);

  // Lista de sucursales, necesaria solo para el selector de ADMIN (sin
  // sucursal fija). Un STAFF/MANAGER nunca la usa para elegir — su
  // sucursal viene de `staff.branchId`, resuelto por el backend.
  useEffect(() => {
    if (!staff) return;
    getBranches()
      .then((list) => {
        setBranches(list);
        if (staff.role === 'ADMIN') {
          setSelectedBranchId((current) => (current && list.some((b) => b.id === current) ? current : list[0]?.id ?? ''));
        }
      })
      .catch(() => undefined);
  }, [staff]);

  const login = useCallback(async (username: string, password: string) => {
    setError('');
    try {
      const { token: newToken, staff: loggedStaff } = await staffLogin({ username, password });
      localStorage.setItem(STAFF_TOKEN_KEY, newToken);
      setToken(newToken);
      setStaff(loggedStaff);
      if (loggedStaff.branchId) setSelectedBranchId(loggedStaff.branchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Usuario o contraseña incorrectos.');
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) await staffLogout(token).catch(() => undefined);
    localStorage.removeItem(STAFF_TOKEN_KEY);
    setToken('');
    setStaff(null);
    setBranches([]);
    setSelectedBranchId('');
  }, [token]);

  const effectiveBranchId = staff?.role === 'ADMIN' ? selectedBranchId : staff?.branchId ?? '';

  const value = useMemo<StaffSessionValue>(
    () => ({
      staff,
      token,
      isRestoring,
      error,
      branches,
      effectiveBranchId,
      selectedBranchId,
      setSelectedBranchId,
      login,
      logout,
    }),
    [staff, token, isRestoring, error, branches, effectiveBranchId, selectedBranchId, login, logout],
  );

  return <StaffSessionContext.Provider value={value}>{children}</StaffSessionContext.Provider>;
}

export function useStaffSession(): StaffSessionValue {
  const ctx = useContext(StaffSessionContext);
  if (!ctx) throw new Error('useStaffSession debe usarse dentro de <StaffSessionProvider>.');
  return ctx;
}
