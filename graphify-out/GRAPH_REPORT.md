# Graph Report - Miftan  (2026-10-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2324 nodes · 8458 edges · 93 communities (85 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a941490e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- newId
- Button
- routes/auth.ts
- search.tsx
- finance.tsx
- app.ts
- store.ts
- schema.ts
- unit-detail.tsx
- files.ts
- schemas.ts
- compilerOptions
- seed.ts
- Badge
- routes/seasonal.ts
- routes/protocols.ts
- seed-scenarios.ts
- hooks.ts
- shared/src/index.ts
- EmptyState
- web/package.json
- dependencies
- portfolio.test.ts
- policy/leads.ts
- routes/contract-templates.ts
- clock.ts
- ApiError
- selectors.ts
- search-rank.ts
- routes/tickets.ts
- useAuth
- listing.tsx
- cn
- routes/viewings.ts
- policy/renewals.ts
- routes/invites.ts
- routes/renewals.ts
- ref_zod
- search-intent.ts
- routes/search.ts
- shared/package.json
- routes/portfolio.ts
- renewal.ts
- compilerOptions
- api/package.json
- patterns.ts
- auth.tsx
- pricing.tsx
- shell.tsx
- map.tsx
- package.json
- api/tickets.ts
- dependencies
- lifecycle.ts
- calendar.tsx
- performance.tsx
- landing.tsx
- search-state.ts
- views.ts
- portfolio-model.ts
- scheduling.tsx
- api/inquiries.ts
- api/rent-payments.ts
- fixtures/package.json
- leads.test.ts
- api/portfolio.ts
- devDependencies
- regions.ts
- api/reviews.ts
- scripts
- tenant-isolation.test.ts
- log.ts
- notification-bell.tsx
- index.js
- properties-write.ts
- pdf-text.ts
- api/notifications.ts
- availability.ts
- devDependencies
- global-setup.ts
- .oxlintrc.json
- scripts
- whatsAppLink
- api/budget.ts
- vendorId
- features.ts
- .prettierrc.json
- web/tsconfig.json
- tsconfig.json
- token
- modules.d.ts
- .mcp.json

## God Nodes (most connected - your core abstractions)
1. `cn()` - 164 edges
2. `Button` - 119 edges
3. `newId()` - 103 edges
4. `Num()` - 99 edges
5. `ApiError` - 97 edges
6. `useStore` - 82 edges
7. `t` - 79 edges
8. `EmptyState()` - 73 edges
9. `Badge()` - 71 edges
10. `react` - 69 edges

## Surprising Connections (you probably didn't know these)
- `PortfolioStats` --calls--> `daysUntil()`  [EXTRACTED]
  apps/web/src/data/selectors.ts → packages/shared/src/lib/format.ts
- `money()` --calls--> `toAgorot()`  [EXTRACTED]
  apps/api/src/db/seed.ts → packages/shared/src/lib/money.ts
- `buildApp()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/app.ts → packages/shared/src/api/errors.ts
- `rotateSession()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/lib/auth.ts → packages/shared/src/api/errors.ts
- `consumeAuthToken()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/lib/auth-tokens.ts → packages/shared/src/api/errors.ts

## Import Cycles
- None detected.

## Communities (93 total, 8 thin omitted)

### Community 0 - "newId"
Cohesion: 0.03
Nodes (123): Db, [{ secured }], ACCESS_TTL_SECONDS, ARGON, hashPassword(), IssuedSession, REFRESH_GRACE_MS, secret (+115 more)

### Community 1 - "Button"
Cohesion: 0.10
Nodes (79): useCreateProperty(), useCreateVendor(), useDeleteVendor(), useInquiryAction(), usePublishWindows(), useRenewalAction(), useStartThread(), useUpdateProperty() (+71 more)

### Community 2 - "routes/auth.ts"
Cohesion: 0.06
Nodes (67): sendMail(), fill(), mailUser(), actionMail(), alreadyRegisteredMail(), emailChangeMail(), resetMail(), verifyMail() (+59 more)

### Community 3 - "search.tsx"
Cohesion: 0.10
Nodes (62): useCommitScan(), useContractScans(), useContractTemplates(), useDeleteTemplate(), useInterpretSearch(), useLeads(), useProperties(), useRenderTemplate() (+54 more)

### Community 4 - "finance.tsx"
Cohesion: 0.08
Nodes (51): useBriefings(), useBudget(), useDismissOnboarding(), useExpenses(), useMarket(), useRentPayments(), useUpdateBudget(), AXIS (+43 more)

### Community 5 - "app.ts"
Cohesion: 0.09
Nodes (51): buildApp(), sql, backfillCityCentrePins(), geocodeAddress(), Contact, currentTenants(), InquiryContext, InquiryRow (+43 more)

### Community 6 - "store.ts"
Cohesion: 0.06
Nodes (54): buildSeed(), Actions, buildSeasonalTasks(), Entities, hydrate(), nextId(), nowIso(), rescore() (+46 more)

### Community 7 - "schema.ts"
Cohesion: 0.03
Nodes (57): actorRole, appMeta, auditAction, authTokens, availabilityConfidence, availabilityInquiries, budgetPolicies, contractScans (+49 more)

### Community 8 - "unit-detail.tsx"
Cohesion: 0.11
Nodes (51): useActivatePreset(), useInquiries(), useRenewals(), useScreeningAudit(), useScreeningPresets(), useTickets(), useUpdatePreset(), PhaseChip() (+43 more)

### Community 9 - "files.ts"
Cohesion: 0.09
Nodes (32): signSchema, targetSchema, uploadRoutes(), ALLOWED_TYPES, assertSize(), assertUploadable(), EXTENSION, MAX_UPLOAD_BYTES (+24 more)

### Community 10 - "schemas.ts"
Cohesion: 0.06
Nodes (33): ClientOptions, MiftanClient, toApiError(), ApiErrorBody, ERROR_CODES, ERROR_STATUS, ErrorCode, AuthResult (+25 more)

### Community 11 - "compilerOptions"
Cohesion: 0.04
Nodes (42): compilerOptions, paths, types, extends, include, ../../tsconfig.base.json, @miftan/fixtures, @miftan/shared (+34 more)

### Community 12 - "seed.ts"
Cohesion: 0.07
Nodes (34): assertDemoFlag(), assertDemoSeedAllowed(), assertNoRealAccounts(), assertSafeToErase(), DEMO_MARKER_KEY, DEMO_MARKER_VALUE, ERASE_CONFIRMATION, IdRow (+26 more)

### Community 13 - "Badge"
Cohesion: 0.11
Nodes (35): useConfirmSlot(), usePostMessage(), useTicketAction(), useTicketMutation(), useUploadReceipt(), PHASE, TURN, AVAILABILITY_ICON (+27 more)

### Community 14 - "routes/seasonal.ts"
Cohesion: 0.09
Nodes (34): autoApprovedThisMonth(), decideAutoApproval(), policyFor(), budgetRoutes(), current(), loadOwned(), project(), PropertyRow (+26 more)

### Community 15 - "routes/protocols.ts"
Cohesion: 0.08
Nodes (33): publicLocation(), OPEN_TICKET_STATUSES, contact(), LeaseRow, leaseTerms(), projectProperty(), PropertyContext, PropertyRow (+25 more)

### Community 16 - "seed-scenarios.ts"
Cohesion: 0.11
Nodes (35): DEMO_EMAIL, DEMO_NAME, lid(), money(), pid(), seedDemoAccount(), Tx, uid() (+27 more)

### Community 17 - "hooks.ts"
Cohesion: 0.09
Nodes (32): MarketResponse, RenewalWrite, ReviewBundle, ThreadSummary, useCompleteProtocol(), useCreateInvite(), useInvites(), useMarkRentPaid() (+24 more)

### Community 18 - "shared/src/index.ts"
Cohesion: 0.17
Nodes (20): api, Account(), SessionRow, Contact(), AppErrorPage(), ForgotPassword(), LegalPage(), NotFound() (+12 more)

### Community 19 - "EmptyState"
Cohesion: 0.14
Nodes (27): uploadFile(), useAcceptInvite(), useCreateTicket(), useInvitePreview(), useReviews(), useSetPropertyPhotos(), useViewings(), useWriteReview() (+19 more)

### Community 20 - "web/package.json"
Cohesion: 0.06
Nodes (31): name, private, type, version, here, shared, clsx, @mapbox/mapbox-gl-rtl-text (+23 more)

### Community 21 - "dependencies"
Cohesion: 0.06
Nodes (34): dependencies, class-variance-authority, clsx, date-fns, leaflet, lucide-react, @mapbox/mapbox-gl-rtl-text, maplibre-gl (+26 more)

### Community 22 - "portfolio.test.ts"
Cohesion: 0.11
Nodes (20): leaseId(), getMailer(), ConsoleMailer, Mailer, OutboundMail, sentMail, ResendMailer, day() (+12 more)

### Community 23 - "policy/leads.ts"
Cohesion: 0.09
Nodes (29): LeadContext, LeadRow, projectLead(), PropertyRow, snapshot(), UserRow, auditEntrySchema, AuditEntryView (+21 more)

### Community 24 - "routes/contract-templates.ts"
Cohesion: 0.09
Nodes (27): asView(), contractTemplateRoutes(), TemplateRow, makeUser(), other, owner, tenant, RenderedContract (+19 more)

### Community 25 - "clock.ts"
Cohesion: 0.15
Nodes (22): addDays(), addHours(), addMonths(), BEDROOM, daysAgo(), daysOut(), DEMO_TODAY, EXTERIOR (+14 more)

### Community 26 - "ApiError"
Cohesion: 0.10
Nodes (25): supabaseAuthEnabled(), verifyAccessToken(), verifySupabaseToken(), authenticatePlugin, fastify, FastifyInstance, FastifyRequest, requireUser() (+17 more)

### Community 27 - "selectors.ts"
Cohesion: 0.09
Nodes (21): availabilityKind(), Comparable, leaseForProperty(), MonthRollup, OPEN_TICKET_STATUSES, PortfolioStats, portfolioTrackRows(), RentComparison (+13 more)

### Community 28 - "search-rank.ts"
Cohesion: 0.13
Nodes (26): EnrichedResult, SearchResult, Comparable, ComparisonBasis, computeInsight(), ListingInsight, median(), MIN_AREA_STATS_SAMPLE (+18 more)

### Community 29 - "routes/tickets.ts"
Cohesion: 0.14
Nodes (25): availableActions(), nextStatus(), RECEIPT_ALLOWED_FROM, TicketAction, Transition, TRANSITIONS, loadTicketContexts(), loadTicketOr404() (+17 more)

### Community 30 - "useAuth"
Cohesion: 0.16
Nodes (22): useAuth(), Entry(), homeFor(), NoRoles(), RequireAuth(), Splash(), Landing(), Pricing() (+14 more)

### Community 31 - "listing.tsx"
Cohesion: 0.17
Nodes (24): useApplyFromWatch(), useAskAvailability(), useLeaveQueue(), useRecordListingView(), useReserveQueue(), Amenity, Fact(), PublicListing() (+16 more)

### Community 32 - "cn"
Cohesion: 0.19
Nodes (24): useScheduleSeasonal(), useSeasonal(), useSeasonalStatus(), OfferCard(), OfferRail(), Range(), RevenueMarker(), RevenueZone() (+16 more)

### Community 33 - "routes/viewings.ts"
Cohesion: 0.13
Nodes (25): claim(), label(), oneForViewer(), ownedSlot(), projectForOwner(), PropertyRow, SlotRow, viewingRoutes() (+17 more)

### Community 34 - "policy/renewals.ts"
Cohesion: 0.15
Nodes (22): answerByFor(), canChange(), CycleAccess, cycleForWrite(), CycleRow, endOfDay(), LeaseRow, leasesFor() (+14 more)

### Community 35 - "routes/invites.ts"
Cohesion: 0.12
Nodes (23): hashToken(), inviteRoutes(), InviteRow, isOfflineTenant(), OFFLINE_TENANT_PREFIX, overlappingLease(), ownerView(), statusOf() (+15 more)

### Community 36 - "routes/renewals.ts"
Cohesion: 0.11
Nodes (22): leaseParams, requireRole(), requireStage(), slotParams, completeRenewalSchema, extendDeadlineSchema, ListingRequirements, listingRequirementsSchema (+14 more)

### Community 37 - "ref_zod"
Cohesion: 0.13
Nodes (18): extractor, loadOwned(), project(), PropertyRow, ScanRow, fileLinkOrNull(), commitScanSchema, contractScanListSchema (+10 more)

### Community 38 - "search-intent.ts"
Cohesion: 0.12
Nodes (22): AiNote, addDays(), AMENITY_KEYS, AMENITY_WORDS, escape(), iso(), MONTHS, normalizeModelIntent() (+14 more)

### Community 39 - "routes/search.ts"
Cohesion: 0.13
Nodes (19): interpretWithModel(), ModelConfig, systemPrompt(), conditions(), recordSearch(), searchRoutes(), districtSchema, interpretRequestSchema (+11 more)

### Community 40 - "shared/package.json"
Cohesion: 0.10
Nodes (19): @types/node, date-fns, dependencies, date-fns, zod, devDependencies, @types/node, vitest (+11 more)

### Community 41 - "routes/portfolio.ts"
Cohesion: 0.25
Nodes (17): activeCriteria(), evaluate(), loadLeadContexts(), replacementFor(), eligible(), Item, turnoverItems(), viewingItems() (+9 more)

### Community 42 - "renewal.ts"
Cohesion: 0.13
Nodes (15): addDays(), APPLICANTS_AUTO_OPEN_HOURS, CycleFacts, MEETING_MINUTES, nextStep(), OwnerStep, RENEWAL_DEFAULT_LEAD_DAYS, RENEWAL_NOTICE_BUFFER_DAYS (+7 more)

### Community 43 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 44 - "api/package.json"
Cohesion: 0.11
Nodes (16): @miftan/fixtures, vitest, zod, name, private, type, version, aws4fetch (+8 more)

### Community 45 - "patterns.ts"
Cohesion: 0.19
Nodes (14): ContractExtractor, ExtractionResult, WANTED, WantedKey, createExtractor(), lineAround(), matchOne(), MONEY (+6 more)

### Community 46 - "auth.tsx"
Cohesion: 0.18
Nodes (14): AuthContext, AuthProvider(), AuthState, onSignedOut(), keys, queryClient, router, Capabilities (+6 more)

### Community 47 - "pricing.tsx"
Cohesion: 0.15
Nodes (14): DemoOnly(), isDemoBuild, useIsDemo(), ADD_ONS, AddOnId, marketFor(), OWNER_PLANS, PlanId (+6 more)

### Community 48 - "shell.tsx"
Cohesion: 0.25
Nodes (15): AppFooter(), BottomTabs(), NavItem, OwnerShell(), RailLink(), SeekerShell(), SkipLink(), TenantShell() (+7 more)

### Community 49 - "map.tsx"
Cohesion: 0.16
Nodes (13): FitBounds(), KeepSized(), MapListing, PICKER_ICON, pinIcon(), PinPicker(), rasterFallback(), ResultsMap() (+5 more)

### Community 50 - "package.json"
Cohesion: 0.12
Nodes (16): devDependencies, drizzle-orm, typescript, drizzle-orm, typescript, name, private, scripts (+8 more)

### Community 51 - "api/tickets.ts"
Cohesion: 0.12
Nodes (16): assignedVendorSchema, assignVendorSchema, CreateTicketInput, createTicketSchema, ownerTicketSchema, postMessageSchema, severitySchema, tenantTicketSchema (+8 more)

### Community 52 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, aws4fetch, dotenv, drizzle-orm, fastify, @fastify/cookie, @fastify/cors, fastify-plugin (+8 more)

### Community 53 - "lifecycle.ts"
Cohesion: 0.19
Nodes (11): PortfolioRow, PropertySnapshot, RenewalView, DEMAND_PHASES, PhaseFacts, PhaseResult, PropertyPhase, SCHEDULING_PHASES (+3 more)

### Community 54 - "calendar.tsx"
Cohesion: 0.31
Nodes (13): useMeetingSlotAction(), useViewingAction(), dayLabel(), useNow(), WeekAgenda(), addDays(), AppointmentSheet(), CalEvent (+5 more)

### Community 55 - "performance.tsx"
Cohesion: 0.23
Nodes (14): usePortfolioAnalytics(), addDays(), bucket(), funnelFor(), FunnelPanel(), MetricGrid(), PerformanceSection(), Period (+6 more)

### Community 56 - "landing.tsx"
Cohesion: 0.16
Nodes (11): iso(), PRINCIPLE_ICONS, ROLE_ICONS, sampleRows(), LegalDoc(), MarkdownTable(), LEGAL_PAGES, LEGAL_REVIEW_NOTICE (+3 more)

### Community 57 - "search-state.ts"
Cohesion: 0.19
Nodes (13): applyIntent(), Chip, EMPTY, fill(), FormState, isClientSort(), num(), SERVER_SORTS (+5 more)

### Community 58 - "views.ts"
Cohesion: 0.13
Nodes (14): addressSchema, AddressView, availabilitySignalSchema, AvailabilitySignalView, leaseTermsSchema, ownerPropertySchema, propertyListSchema, PropertyView (+6 more)

### Community 59 - "portfolio-model.ts"
Cohesion: 0.26
Nodes (11): usePortfolioSnapshot(), attentionFor(), AttentionItem, currentRenewal(), fill(), labelOf(), ListFilter, RENEWAL_PHASES (+3 more)

### Community 60 - "scheduling.tsx"
Cohesion: 0.23
Nodes (12): addDays(), AvailabilityPicker(), dayMonth, fill(), GridSlot, nowHHMM(), PRESETS, slotsIn() (+4 more)

### Community 61 - "api/inquiries.ts"
Cohesion: 0.15
Nodes (12): askInquirySchema, askTenantSchema, inquiryListSchema, inquiryStatusSchema, inquiryViewSchema, ownerInquirySchema, ownerReplySchema, renewalIntentSchema (+4 more)

### Community 62 - "api/rent-payments.ts"
Cohesion: 0.15
Nodes (12): MarkRentPaidInput, markRentPaidSchema, OwnerRentPayment, ownerRentPaymentSchema, paymentMethodSchema, rentPaymentBase, rentPaymentListSchema, rentPaymentQuerySchema (+4 more)

### Community 63 - "fixtures/package.json"
Cohesion: 0.17
Nodes (11): @miftan/shared, dependencies, @miftan/shared, exports, name, private, scripts, typecheck (+3 more)

### Community 64 - "leads.test.ts"
Cohesion: 0.20
Nodes (7): alice, bob, makeUser(), owner, queueUp(), req(), soon()

### Community 65 - "api/portfolio.ts"
Cohesion: 0.17
Nodes (11): analyticsQuerySchema, appointmentSchema, Funnel, funnelSchema, PortfolioAnalytics, portfolioAnalyticsSchema, PortfolioSnapshot, portfolioSnapshotSchema (+3 more)

### Community 66 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/leaflet, @types/node, @types/react, @types/react-dom (+3 more)

### Community 67 - "regions.ts"
Cohesion: 0.20
Nodes (9): BY_NAME, CITIES, citiesByDistrict(), citiesIn(), District, DISTRICTS, TEL_AVIV, TEL_AVIV_AREA_NAMES (+1 more)

### Community 68 - "api/reviews.ts"
Cohesion: 0.20
Nodes (9): MyReview, myReviewSchema, reviewablePendingSchema, reviewerRoleSchema, reviewListSchema, reviewSchema, ReviewView, score (+1 more)

### Community 69 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, db:generate, db:migrate, db:reset, db:seed, dev, start, test (+1 more)

### Community 70 - "tenant-isolation.test.ts"
Cohesion: 0.33
Nodes (8): date(), day(), get(), ids, lease(), makeUser(), ticket(), titles()

### Community 71 - "log.ts"
Cohesion: 0.39
Nodes (6): LoggableError, logSerializers, redactUrl(), safeError(), scrubMessage(), SECRET_PATHS

### Community 72 - "notification-bell.tsx"
Cohesion: 0.39
Nodes (7): useMarkNotificationsSeen(), useNotifications(), NotificationBell(), ROLE_ICON, RoleMark(), textFor(), @radix-ui/react-popover

### Community 73 - "index.js"
Cohesion: 0.43
Nodes (7): AVAILABILITY, dateHe(), escape(), fetch(), listingCard(), rooms(), shekels()

### Community 74 - "properties-write.ts"
Cohesion: 0.25
Nodes (7): availabilityConfidenceSchema, CreatePropertyInput, createPropertySchema, unitStatusSchema, UpdatePropertyInput, updatePropertySchema, amenitySchema

### Community 75 - "pdf-text.ts"
Cohesion: 0.38
Nodes (5): logicalOrder(), markerHits(), MARKERS, pdfText(), pdfjs-dist

### Community 76 - "api/notifications.ts"
Cohesion: 0.29
Nodes (6): NotificationFeed, notificationFeedSchema, NotificationKind, notificationKindSchema, notificationSchema, NotificationView

### Community 77 - "availability.ts"
Cohesion: 0.48
Nodes (6): AvailabilityInput, AvailabilityKind, AvailabilitySignal, AvailabilityConfidence, RenewalIntent, UnitStatus

### Community 78 - "devDependencies"
Cohesion: 0.33
Nodes (6): devDependencies, drizzle-kit, pino-pretty, @types/node, typescript, vitest

### Community 80 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 81 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, typecheck

### Community 82 - "whatsAppLink"
Cohesion: 0.53
Nodes (4): ticketWhatsAppMessage(), toInternational(), vendorWhatsAppGreeting(), whatsAppLink()

### Community 83 - "api/budget.ts"
Cohesion: 0.40
Nodes (4): budgetPolicySchema, BudgetPolicyView, updateBudgetPolicySchema, ticketCategorySchema

### Community 84 - "vendorId"
Cohesion: 0.67
Nodes (4): vendorId(), readyForReceipt(), reportLeak(), req()

### Community 86 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): printWidth, singleQuote, trailingComma

## Knowledge Gaps
- **16 isolated node(s):** `@mapbox/mapbox-gl-rtl-text`, `oxlint`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-separator`, `@radix-ui/react-slider` (+11 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 758 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `fastify` connect `newId` to `routes/auth.ts`, `app.ts`, `files.ts`, `routes/seasonal.ts`, `routes/protocols.ts`, `portfolio.test.ts`, `policy/leads.ts`, `routes/contract-templates.ts`, `ApiError`, `routes/tickets.ts`, `routes/viewings.ts`, `routes/invites.ts`, `routes/renewals.ts`, `ref_zod`, `routes/search.ts`, `routes/portfolio.ts`, `api/package.json`, `leads.test.ts`, `tenant-isolation.test.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `@mapbox/mapbox-gl-rtl-text`, `oxlint`, `@radix-ui/react-dropdown-menu` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `newId` be split into smaller, more focused modules?**
  _Cohesion score 0.027622594661700806 - nodes in this community are weakly interconnected._
- **Why does `ApiError` connect `ApiError` to `newId`, `routes/auth.ts`, `app.ts`, `files.ts`, `schemas.ts`, `routes/seasonal.ts`, `routes/protocols.ts`, `shared/src/index.ts`, `EmptyState`, `policy/leads.ts`, `routes/contract-templates.ts`, `routes/tickets.ts`, `useAuth`, `listing.tsx`, `routes/viewings.ts`, `policy/renewals.ts`, `routes/invites.ts`, `routes/renewals.ts`, `ref_zod`, `routes/portfolio.ts`, `auth.tsx`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.09575923392612859 - nodes in this community are weakly interconnected._
- **Why does `react` connect `EmptyState` to `Button`, `search.tsx`, `finance.tsx`, `unit-detail.tsx`, `Badge`, `hooks.ts`, `shared/src/index.ts`, `web/package.json`, `useAuth`, `listing.tsx`, `cn`, `auth.tsx`, `pricing.tsx`, `shell.tsx`, `map.tsx`, `calendar.tsx`, `performance.tsx`, `landing.tsx`, `portfolio-model.ts`, `scheduling.tsx`, `notification-bell.tsx`, `use-delayed-ready.ts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `routes/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06185919343814081 - nodes in this community are weakly interconnected._