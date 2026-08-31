import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTicketInput,
  ExpenseView,
  PropertyView,
  TicketView,
  VendorView,
} from '@miftan/shared';
import { api } from './client';
import { keys } from './query';

/**
 * Every server read and write the app makes.
 *
 * Kept in one file so invalidation is reviewable: when a ticket changes, the
 * lists that show it have to change too, and that pairing is easy to forget
 * when the mutation lives next to the button that fires it.
 */

/* ── Reads ─────────────────────────────────────────────── */

export function useProperties() {
  return useQuery({
    queryKey: keys.properties,
    queryFn: () => api.request<{ properties: PropertyView[] }>('/properties'),
    select: (data) => data.properties,
  });
}

export function useProperty(id: string) {
  return useQuery({
    queryKey: keys.property(id),
    queryFn: () => api.request<PropertyView>(`/properties/${id}`),
    enabled: Boolean(id),
  });
}

export function useSearch() {
  return useQuery({
    queryKey: keys.search,
    queryFn: () => api.request<{ properties: PropertyView[] }>('/search'),
    select: (data) => data.properties,
  });
}

export function useTickets(filters?: { propertyId?: string }) {
  const query = filters?.propertyId ? `?propertyId=${encodeURIComponent(filters.propertyId)}` : '';
  return useQuery({
    queryKey: keys.tickets(filters),
    queryFn: () => api.request<{ tickets: TicketView[] }>(`/tickets${query}`),
    select: (data) => data.tickets,
  });
}

export function useVendors() {
  return useQuery({
    queryKey: keys.vendors,
    queryFn: () => api.request<{ vendors: VendorView[] }>('/vendors'),
    select: (data) => data.vendors,
  });
}

export function useExpenses(propertyId?: string) {
  const query = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
  return useQuery({
    queryKey: keys.expenses(propertyId),
    queryFn: () => api.request<{ expenses: ExpenseView[]; totalAgorot: number }>(`/expenses${query}`),
  });
}

/* ── Writes ────────────────────────────────────────────── */

/**
 * Anything that touches a ticket invalidates both the one ticket and every
 * list, because a status change moves it between kanban columns and changes
 * the open count in the navigation.
 */
function useTicketMutation<TInput>(
  run: (input: TInput) => Promise<TicketView>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (ticket) => {
      queryClient.setQueryData(keys.ticket(ticket.id), ticket);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: keys.properties });
    },
  });
}

export function useCreateTicket() {
  return useTicketMutation((input: CreateTicketInput) =>
    api.request<TicketView>('/tickets', { method: 'POST', body: JSON.stringify(input) }),
  );
}

export function useTicketAction() {
  return useTicketMutation(
    ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
      api.request<TicketView>(`/tickets/${id}/actions/${action}`, {
        method: 'POST',
        body: JSON.stringify(body ?? {}),
      }),
  );
}

export function useConfirmSlot() {
  return useTicketMutation(({ id }: { id: string }) =>
    api.request<TicketView>(`/tickets/${id}/confirm-slot`, { method: 'POST' }),
  );
}

export function useUploadReceipt() {
  return useTicketMutation(
    ({ id, amountAgorot, file }: { id: string; amountAgorot: number; file?: string | null }) =>
      api.request<TicketView>(`/tickets/${id}/receipt`, {
        method: 'POST',
        body: JSON.stringify({ amountAgorot, file: file ?? null }),
      }),
  );
}

export function usePostMessage() {
  return useTicketMutation(({ id, body }: { id: string; body: string }) =>
    api.request<TicketView>(`/tickets/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }),
  );
}

/* ── Uploads ───────────────────────────────────────────── */

/**
 * Two steps, deliberately: ask the server where to put the file, then send the
 * bytes straight there. In production that second request never touches our
 * API at all, so a phone full of leak photos does not become our bandwidth bill.
 */
export async function uploadFile(
  file: File,
  folder: 'tickets' | 'receipts' | 'protocol' | 'properties',
): Promise<string> {
  const target = await api.request<{ uploadUrl: string; publicUrl: string }>('/uploads/sign', {
    method: 'POST',
    body: JSON.stringify({ folder, filename: file.name, contentType: file.type }),
  });

  const res = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`upload failed: ${res.status}`);

  return target.publicUrl;
}
