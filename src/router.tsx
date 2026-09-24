import { createBrowserRouter, Navigate } from 'react-router-dom';
import { GuestPage } from './pages/GuestPage';

export const router = createBrowserRouter([
  { path: '/', element: <GuestPage /> },
  // Admin and QR pages are lazy so jszip, qrcode and their UI stay out of the guest bundle.
  { path: '/admin', lazy: () => import('./pages/AdminPage') },
  { path: '/qr', lazy: () => import('./pages/QrPage') },
  { path: '*', element: <Navigate to="/" replace /> },
]);
