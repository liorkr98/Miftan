import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@miftan/shared';

/**
 * Retrying a 401 or a 403 just delays the same answer, and retrying a 404
 * cannot conjure the row into existence. Only genuinely transient failures are
 * worth a second attempt.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (attempt, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return attempt < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});

/** Query keys in one place, so an invalidation cannot miss a screen. */
export const keys = {
  me: ['me'] as const,
  properties: ['properties'] as const,
  property: (id: string) => ['properties', id] as const,
  search: ['search'] as const,
  tickets: (filters?: { propertyId?: string }) => ['tickets', filters ?? {}] as const,
  ticket: (id: string) => ['tickets', id] as const,
  vendors: ['vendors'] as const,
  expenses: (propertyId?: string) => ['expenses', propertyId ?? 'all'] as const,
  rentPayments: (filters?: { propertyId?: string; from?: string; to?: string }) =>
    ['rent-payments', filters ?? {}] as const,
  renterProfile: ['me', 'renter-profile'] as const,

  leads: ['leads'] as const,
  lead: (id: string) => ['leads', id] as const,
  presets: ['screening', 'presets'] as const,
  audit: ['screening', 'audit'] as const,
  inquiries: ['inquiries'] as const,
  seasonal: ['seasonal'] as const,
  protocols: ['protocols'] as const,
  protocol: (id: string) => ['protocols', id] as const,
  protocolCompare: (propertyId: string) => ['protocols', 'compare', propertyId] as const,
  threads: ['threads'] as const,
  thread: (id: string) => ['threads', id] as const,
  contracts: ['contracts'] as const,
  contract: (id: string) => ['contracts', id] as const,
  templates: ['contracts', 'templates'] as const,
  budget: ['budget'] as const,
  market: (district?: string) => ['market', district ?? 'all'] as const,
  viewings: (propertyId: string) => ['viewings', propertyId] as const,
  briefings: ['viewings', 'briefings'] as const,
  reviews: (userId?: string) => ['reviews', userId ?? 'me'] as const,
};
