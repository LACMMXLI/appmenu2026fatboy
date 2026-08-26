import { StaffSessionProvider, useStaffSession } from '@/context/StaffSessionContext';
import { InstallPrompt } from '@/components/InstallPrompt';
import { UpdateStatusBanner } from '@/components/UpdateStatus';
import { isDesktopApp } from '@/desktop/desktop-bridge';
import { LoginView } from '@/views/LoginView';
import { OperationView } from '@/views/OperationView';
import { DriverDeliveryView } from '@/views/DriverDeliveryView';

function AppRoutes() {
  const { staff, isRestoring } = useStaffSession();

  if (isRestoring) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[#101010] text-white">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">Cargando…</p>
      </main>
    );
  }

  if (!staff) return <LoginView />;
  return staff.role === 'DRIVER' ? <DriverDeliveryView /> : <OperationView />;
}

export default function App() {
  return (
    <StaffSessionProvider>
      <AppRoutes />
      <UpdateStatusBanner />
      {!isDesktopApp() && <InstallPrompt />}
    </StaffSessionProvider>
  );
}
