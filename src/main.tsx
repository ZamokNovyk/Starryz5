import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from '@/src/context/AuthContext';
import { ThemeProvider } from '@/src/context/ThemeContext';
import { PwaTabsProvider } from '@/src/context/PwaTabsContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <PwaTabsProvider>
          <App />
        </PwaTabsProvider>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>
);

