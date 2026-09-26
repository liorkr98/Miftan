import { createBrowserRouter } from 'react-router-dom';
import { RequireAuth } from './guard';
import { Landing } from './landing';
import { LegalPage } from './legal-page';
import { SignIn } from './sign-in';
import { SignUp } from './sign-up';
import { OwnerShell, SeekerShell, TenantShell } from './shell';
import { NotFound } from './not-found';
import { OwnerDashboard } from '@/personas/owner/dashboard';
import { OwnerProperties } from '@/personas/owner/properties';
import { OwnerUnitDetail } from '@/personas/owner/unit-detail';
import { OwnerTickets } from '@/personas/owner/tickets';
import { OwnerScreening } from '@/personas/owner/screening';
import { OwnerFinance } from '@/personas/owner/finance';
import { OwnerContracts } from '@/personas/owner/contracts';
import { OwnerLeadsHub } from '@/personas/owner/leads-hub';
import { OwnerMaintenanceHub } from '@/personas/owner/maintenance-hub';
import { OwnerRevenue } from '@/personas/owner/revenue';
import { PremiumGate } from '@/components/shared/premium-gate';
import { t } from '@miftan/shared';
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
  { path: '/', element: <Landing /> },
  { path: '/sign-in', element: <SignIn /> },
  { path: '/sign-up', element: <SignUp /> },
  { path: '/legal/:id', element: <LegalPage /> },
  {
    /* Everything below here needs a session. */
    element: <RequireAuth />,
    children: [
      {
        path: '/owner',
        element: <OwnerShell />,
        children: [
          { index: true, element: <OwnerDashboard /> },
          { path: 'properties', element: <OwnerProperties /> },
          { path: 'properties/:id', element: <OwnerUnitDetail /> },
          { path: 'tickets', element: <OwnerTickets /> },
          /* Combined hubs. Old bookmarks to the pages folded into them still
             land somewhere sensible rather than 404ing. */
          { path: 'leads', element: <OwnerLeadsHub /> },
          { path: 'crm', element: <OwnerLeadsHub /> },
          { path: 'inquiries', element: <OwnerLeadsHub /> },
          { path: 'messages', element: <OwnerLeadsHub /> },
          { path: 'maintenance', element: <OwnerMaintenanceHub /> },
          { path: 'vendors', element: <OwnerMaintenanceHub /> },
          { path: 'contracts', element: <OwnerContracts /> },
          {
            path: 'revenue',
            element: (
              <PremiumGate hint={t.premium.revenueLockedHint}>
                <OwnerRevenue />
              </PremiumGate>
            ),
          },
          { path: 'leads/filters', element: <OwnerScreening /> },
          { path: 'crm/filters', element: <OwnerScreening /> },
          { path: 'finance', element: <OwnerFinance /> },
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
    ],
  },
  { path: '*', element: <NotFound /> },
]);
