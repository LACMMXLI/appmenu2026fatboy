import { StaffSessionProvider, useStaffSession } from '@/context/StaffSessionContext';
import { LoginView } from '@/views/LoginView';
import { OperationView } from '@/views/OperationView';

function AppRoutes() {
  const { staff, isRestoring } = useStaffSession();

  if (isRestoring) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#101010] text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Cargando…</p>
      </main>
    );
  }

  return staff ? <OperationView /> : <LoginView />;
}

export default function App() {
  return (
    <StaffSessionProvider>
      <AppRoutes />
    </StaffSessionProvider>
  );
}
