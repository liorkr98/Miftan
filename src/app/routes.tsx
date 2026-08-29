import { createBrowserRouter, Navigate } from 'react-router-dom';
import { OwnerShell, SeekerShell, TenantShell } from './shell';
import { NotFound } from './not-found';
import { OwnerDashboard } from '@/personas/owner/dashboard';
import { OwnerProperties } from '@/personas/owner/properties';
import { OwnerUnitDetail } from '@/personas/owner/unit-detail';
import { OwnerTickets } from '@/personas/owner/tickets';
import { OwnerVendors } from '@/personas/owner/vendors';
import { OwnerCrm } from '@/personas/owner/crm';
import { OwnerScreening } from '@/personas/owner/screening';
import { OwnerFinance } from '@/personas/owner/finance';
import { OwnerMessages } from '@/personas/owner/messages';
import { OwnerInquiries } from '@/personas/owner/inquiries';
import { OwnerContracts } from '@/personas/owner/contracts';
import { OwnerSeasonal } from '@/personas/owner/seasonal';
import { OwnerRevenue } from '@/personas/owner/revenue';
import { TenantHome } from '@/personas/tenant/home';
import { TenantReport } from '@/personas/tenant/report';
import { TenantTickets } from '@/personas/tenant/tickets';
import { TenantRenewal } from '@/personas/tenant/renewal';
import { TenantDocuments } from '@/personas/tenant/documents';
import { SeekerSearch } from '@/personas/seeker/search';
import { SeekerListing } from '@/personas/seeker/listing';
import { SeekerQueue } from '@/personas/seeker/queue';
import { SeekerProfile } from '@/personas/seeker/profile';

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/owner" replace /> },
  {
    path: '/owner',
    element: <OwnerShell />,
    children: [
      { index: true, element: <OwnerDashboard /> },
      { path: 'properties', element: <OwnerProperties /> },
      { path: 'properties/:id', element: <OwnerUnitDetail /> },
      { path: 'tickets', element: <OwnerTickets /> },
      { path: 'vendors', element: <OwnerVendors /> },
      { path: 'crm', element: <OwnerCrm /> },
      { path: 'inquiries', element: <OwnerInquiries /> },
      { path: 'maintenance', element: <OwnerSeasonal /> },
      { path: 'contracts', element: <OwnerContracts /> },
      { path: 'revenue', element: <OwnerRevenue /> },
      { path: 'crm/filters', element: <OwnerScreening /> },
      { path: 'finance', element: <OwnerFinance /> },
      { path: 'messages', element: <OwnerMessages /> },
    ],
  },
  {
    path: '/tenant',
    element: <TenantShell />,
    children: [
      { index: true, element: <TenantHome /> },
      { path: 'report', element: <TenantReport /> },
      { path: 'tickets', element: <TenantTickets /> },
      { path: 'renewal', element: <TenantRenewal /> },
      { path: 'documents', element: <TenantDocuments /> },
    ],
  },
  {
    path: '/search',
    element: <SeekerShell />,
    children: [
      { index: true, element: <SeekerSearch /> },
      { path: 'queue', element: <SeekerQueue /> },
      { path: 'profile', element: <SeekerProfile /> },
      { path: ':id', element: <SeekerListing /> },
    ],
  },
  { path: '*', element: <NotFound /> },
]);
