import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { DirectionProvider } from '@radix-ui/react-direction';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/query';
import { AuthProvider } from './api/auth';
import { router } from './app/routes';
import './styles/app.css';
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Radix reads direction from here — menus, selects and sliders all flip */}
    <DirectionProvider dir="rtl">
      <QueryClientProvider client={queryClient}>
        {/* AuthProvider sits inside QueryClientProvider because signing out
            clears the cache, and outside the router because the guard needs it. */}
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>
    </DirectionProvider>
  </StrictMode>,
);
