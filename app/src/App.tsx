import { HashRouter } from 'react-router-dom';
import { BankProvider } from './bank/BankProvider';
import { AppRoutes } from './routes';
import { ErrorBoundary } from './ui/States/States';

export function App() {
  return (
    <ErrorBoundary>
      <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <BankProvider>
          <AppRoutes />
        </BankProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}
