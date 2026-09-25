import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { RequestAccessProvider } from './contexts/RequestAccessContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <RequestAccessProvider>
          <App />
        </RequestAccessProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
