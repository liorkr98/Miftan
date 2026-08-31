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
};
