import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { DirectionProvider } from '@radix-ui/react-direction';
import { router } from './app/routes';
import './styles/app.css';
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Radix reads direction from here — menus, selects and sliders all flip */}
    <DirectionProvider dir="rtl">
      <RouterProvider router={router} />
    </DirectionProvider>
  </StrictMode>,
);
