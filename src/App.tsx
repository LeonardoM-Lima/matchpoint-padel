import { RouterProvider } from 'react-router-dom';
import { PwaInstallPrompt } from './components/PwaInstallPrompt';
import { AuthProvider } from './contexts/AuthContext';
import { router } from './router';

function AppContent() {
  return (
    <>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
      <PwaInstallPrompt />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
