import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuditEntryView,
  BriefingView,
  BudgetPolicyView,
  ComparisonView,
  ContractScanView,
  CreateTicketInput,
  ExpenseView,
  InquiryView,
  LeadView,
  MarketRow,
  ProtocolRunView,
  PropertyView,
  ScreeningCriterion,
  ScreeningPresetView,
  SearchFilters,
  SearchResult,
  SeasonalTaskView,
  SlotView,
  ThreadView,
  TicketView,
  ReviewView,
  MyReview,
  VendorView,
} from '@miftan/shared';

/* Shapes the client assembles from an endpoint rather than importing whole. */
type ThreadSummary = Omit<ThreadView, 'messages'>;
type MarketResponse = { rows: MarketRow[]; minimumSample: number; generatedAt: string };
type ReviewBundle = {
  about: ReviewView[];
  mine: MyReview[];
  pending: Array<{
    leaseId: string;
    propertyLabel: string;
    counterpartName: string;
    myRole: 'owner' | 'tenant';
    tenancyFrom: string;
    tenancyUntil: string;
    writeBy: string;
  }>;
  averageRating: number | null;
  reviewCount: number;
};
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

/* ── Leads, screening, audit ──────────────────────────── */

export function useLeads(propertyId?: string) {
  const query = propertyId ? `?propertyId=${encodeURIComponent(propertyId)}` : '';
  return useQuery({
    queryKey: [...keys.leads, propertyId ?? 'all'],
    queryFn: () => api.request<{ leads: LeadView[] }>(`/leads${query}`),
    select: (data) => data.leads,
  });
}

export function useScreeningPresets() {
  return useQuery({
    queryKey: keys.presets,
    queryFn: () => api.request<{ presets: ScreeningPresetView[] }>('/screening/presets'),
    select: (data) => data.presets,
  });
}

export function useScreeningAudit(limit = 60) {
  return useQuery({
    queryKey: [...keys.audit, limit],
    queryFn: () => api.request<{ entries: AuditEntryView[]; total: number }>(`/screening/audit?limit=${limit}`),
  });
}

export function useSetLeadStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: LeadView['stage'] }) =>
      api.request<LeadView>(`/leads/${id}/stage`, { method: 'POST', body: JSON.stringify({ stage }) }),
    /* The audit log gains a line on every stage change, so it invalidates too. */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.leads });
      void qc.invalidateQueries({ queryKey: keys.audit });
    },
  });
}

export function useUpdatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; criteria?: ScreeningCriterion[]; name?: string }) =>
      api.request<{ presets: ScreeningPresetView[] }>(`/screening/presets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    /* Changing a criterion re-scores every lead, so the lists go too. */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.presets });
      void qc.invalidateQueries({ queryKey: keys.leads });
    },
  });
}

export function useActivatePreset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.request<{ presets: ScreeningPresetView[] }>(`/screening/presets/${id}/activate`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.presets });
      void qc.invalidateQueries({ queryKey: keys.leads });
      void qc.invalidateQueries({ queryKey: keys.audit });
    },
  });
}

export function useReserveQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { propertyId: string; desiredMoveIn: string; watchOnly?: boolean }) =>
      api.request<LeadView>('/leads', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.leads });
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useLeaveQueue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<{ ok: true }>(`/leads/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.leads });
      void qc.invalidateQueries({ queryKey: keys.me });
    },
  });
}

/* ── Availability inquiries ───────────────────────────── */

export function useInquiries() {
  return useQuery({
    queryKey: keys.inquiries,
    queryFn: () => api.request<{ inquiries: InquiryView[] }>('/inquiries'),
    select: (data) => data.inquiries,
  });
}

export function useAskAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { propertyId: string; message: string; desiredMoveIn: string }) =>
      api.request<InquiryView>('/inquiries', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.inquiries }),
  });
}

/**
 * Every step of the chain goes through one mutation, because they all
 * invalidate the same three things — and a date the owner publishes changes the
 * property and the search, not only the inquiry.
 */
export function useInquiryAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'ask-tenant' | 'answer' | 'reply' | 'decline';
      body?: unknown;
    }) =>
      api.request<InquiryView>(`/inquiries/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.inquiries });
      void qc.invalidateQueries({ queryKey: keys.properties });
      void qc.invalidateQueries({ queryKey: keys.search });
    },
  });
}

/* ── Preventive maintenance ───────────────────────────── */

export function useSeasonal() {
  return useQuery({
    queryKey: keys.seasonal,
    queryFn: () =>
      api.request<{ tasks: SeasonalTaskView[]; outstandingExpectedSaving: number }>('/seasonal'),
  });
}

export function useSeasonalStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: SeasonalTaskView['status'] }) =>
      api.request<SeasonalTaskView>(`/seasonal/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.seasonal }),
  });
}

export function useScheduleSeasonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; severity?: string; note?: string | null }) =>
      api.request<SeasonalTaskView>(`/seasonal/${id}/schedule`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /* It becomes a real ticket, so the board has to know. */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.seasonal });
      void qc.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

/* ── Protocols ────────────────────────────────────────── */

export function useProtocols() {
  return useQuery({
    queryKey: keys.protocols,
    queryFn: () => api.request<{ runs: ProtocolRunView[] }>('/protocols'),
    select: (data) => data.runs,
  });
}

export function useProtocolComparison(propertyId: string) {
  return useQuery({
    queryKey: keys.protocolCompare(propertyId),
    queryFn: () => api.request<ComparisonView>(`/protocols/compare/${propertyId}`),
    enabled: Boolean(propertyId),
  });
}

export function useStartProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { propertyId: string; kind: 'move_in' | 'move_out' }) =>
      api.request<ProtocolRunView>('/protocols', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.protocols }),
  });
}

export function useUpdateProtocolEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      runId,
      itemId,
      ...body
    }: {
      runId: string;
      itemId: string;
      done?: boolean;
      value?: string | null;
      photos?: string[];
      note?: string | null;
    }) =>
      api.request<ProtocolRunView>(`/protocols/${runId}/entries/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: keys.protocols });
      void qc.invalidateQueries({ queryKey: keys.protocol(vars.runId) });
    },
  });
}

export function useCompleteProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api.request<ProtocolRunView>(`/protocols/${runId}/complete`, { method: 'POST' }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.protocols }),
  });
}

/* ── Message threads ──────────────────────────────────── */

export function useThreads() {
  return useQuery({
    queryKey: keys.threads,
    queryFn: () => api.request<{ threads: ThreadSummary[]; totalUnread: number }>('/threads'),
  });
}

export function useThread(id: string) {
  return useQuery({
    queryKey: keys.thread(id),
    queryFn: () => api.request<ThreadView>(`/threads/${id}`),
    enabled: Boolean(id),
  });
}

export function useStartThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.request<ThreadView>('/threads', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.threads }),
  });
}

export function usePostThreadMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.request<ThreadView>(`/threads/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: keys.threads });
      void qc.invalidateQueries({ queryKey: keys.thread(vars.id) });
    },
  });
}

export function useMarkThreadRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.request<ThreadView>(`/threads/${id}/read`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: keys.threads });
      void qc.invalidateQueries({ queryKey: keys.thread(id) });
    },
  });
}

/* ── Contracts ────────────────────────────────────────── */

export function useContractScans() {
  return useQuery({
    queryKey: keys.contracts,
    queryFn: () => api.request<{ scans: ContractScanView[] }>('/contracts'),
    select: (data) => data.scans,
  });
}

export function useScanContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { propertyId: string; fileName: string; fileUrl?: string | null; text: string }) =>
      api.request<ContractScanView>('/contracts', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.contracts }),
  });
}

export function useCommitScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) =>
      api.request<ContractScanView>(`/contracts/${id}/commit`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /* Committing rewrites the lease and the unit's rent. */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.contracts });
      void qc.invalidateQueries({ queryKey: keys.properties });
    },
  });
}

/* ── Budget ───────────────────────────────────────────── */

export function useBudget() {
  return useQuery({
    queryKey: keys.budget,
    queryFn: () => api.request<BudgetPolicyView>('/budget'),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.request<BudgetPolicyView>('/budget', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.budget }),
  });
}

/* ── Search and the market ────────────────────────────── */

/**
 * A mutation rather than a query, deliberately: it writes a search event, and
 * react-query would otherwise refire it on mount and inflate the demand data
 * with searches nobody performed.
 */
export function useRunSearch() {
  return useMutation({
    mutationFn: (filters: SearchFilters) =>
      api.request<{ results: SearchResult[]; total: number; totalIgnoringDate: number }>('/search', {
        method: 'POST',
        body: JSON.stringify({ filters }),
      }),
  });
}

export function useMarket(district?: string) {
  const query = district ? `?district=${encodeURIComponent(district)}` : '';
  return useQuery({
    queryKey: keys.market(district),
    queryFn: () => api.request<MarketResponse>(`/market${query}`),
  });
}

/* ── Viewings ─────────────────────────────────────────── */

export function useViewings(propertyId: string) {
  return useQuery({
    queryKey: keys.viewings(propertyId),
    queryFn: () =>
      api.request<{ slots: SlotView[]; eligible: boolean | null; ineligibleReason: string | null }>(
        `/viewings/${propertyId}`,
      ),
    enabled: Boolean(propertyId),
  });
}

export function useBriefings(withinHours = 24) {
  return useQuery({
    queryKey: [...keys.briefings, withinHours],
    queryFn: () =>
      api.request<{ briefings: BriefingView[] }>(`/viewings/upcoming/briefings?withinHours=${withinHours}`),
    select: (data) => data.briefings,
  });
}

export function usePublishSlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.request<{ slots: SlotView[] }>('/viewings', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['viewings'] }),
  });
}

export function useViewingAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: 'book' | 'invite' | 'cancel' | 'attendance';
      body?: unknown;
    }) =>
      api.request<SlotView>(`/viewings/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    /* Booking moves a lead's stage, so the CRM has to know. */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['viewings'] });
      void qc.invalidateQueries({ queryKey: keys.leads });
    },
  });
}

/* ── Reviews ──────────────────────────────────────────── */

export function useReviews(userId?: string) {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
  return useQuery({
    queryKey: keys.reviews(userId),
    queryFn: () => api.request<ReviewBundle>(`/reviews${query}`),
  });
}

export function useWriteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.request<ReviewView>('/reviews', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reviews'] }),
  });
}
