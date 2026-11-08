# Graph Report - Miftan  (2026-11-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2517 nodes · 9061 edges · 110 communities (103 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4dc6ed3e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- newId
- Num
- israelToday
- Button
- schema.ts
- formatDate
- crm.tsx
- app.ts
- db/client.ts
- compilerOptions
- ApiError
- storage/index.ts
- dependencies
- api/package.json
- routes.tsx
- hooks.ts
- unit-detail.tsx
- listing.tsx
- data/reset.ts
- worker.ts
- record-lease.test.ts
- web/package.json
- finance.tsx
- shared/src/index.ts
- me.ts
- types/index.ts
- store.ts
- clock.ts
- MiftanClient
- api/tickets.ts
- schemas.ts
- steps
- shared/package.json
- map.tsx
- cn
- search-rank.ts
- routes/auth.ts
- ref_zod
- lucide-react
- phase.tsx
- selectors.ts
- steps
- api/search.ts
- api/renewals.ts
- render-demo-seed.ts
- demo-data.ts
- search.tsx
- api/leads.ts
- search-state.ts
- api/viewings.ts
- search-intent.ts
- compilerOptions
- package.json
- patterns.ts
- auth.tsx
- landing.tsx
- steps
- routes/threads.ts
- shell.tsx
- routes/contract-templates.ts
- status.tsx
- lib/screening.ts
- check
- api/inquiries.ts
- api/invites.ts
- views.ts
- apps_api_src_db_client_schema
- seed-scenarios.ts
- regions.ts
- routes/contracts.ts
- performance.tsx
- fixtures/package.json
- bundle-migrations.ts
- seed-extra.ts
- rate-limit.ts
- updates
- api/portfolio.ts
- api/rent-payments.ts
- lib/seasonal.ts
- lib/budget.ts
- leads.test.ts
- pricing.tsx
- renewal.ts
- demo-guard.ts
- mailer.ts
- search-card.tsx
- scripts
- api/contract-templates.ts
- api/protocols.ts
- api/reviews.ts
- viewings.test.ts
- log.ts
- pdf-text.ts
- scripts
- templates.ts
- presign.ts
- notification-bell.tsx
- api/notifications.ts
- FileBucket
- .oxlintrc.json
- scripts
- card.tsx
- features.ts
- .prettierrc.json
- readyForReceipt
- web/tsconfig.json
- tsconfig.json
- cloudflare-node.d.ts
- @mapbox/mapbox-gl-rtl-text@^0.4.0
- modules.d.ts

## God Nodes (most connected - your core abstractions)
1. `cn()` - 164 edges
2. `Button` - 119 edges
3. `newId()` - 103 edges
4. `Num()` - 99 edges
5. `ApiError` - 96 edges
6. `useStore` - 83 edges
7. `t` - 79 edges
8. `EmptyState()` - 73 edges
9. `israelToday()` - 73 edges
10. `Db` - 72 edges

## Surprising Connections (you probably didn't know these)
- `buildApp()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/app.ts → packages/shared/src/api/errors.ts
- `rotateSession()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/lib/auth.ts → packages/shared/src/api/errors.ts
- `consumeAuthToken()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/lib/auth-tokens.ts → packages/shared/src/api/errors.ts
- `readRefreshCookie()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/lib/http.ts → packages/shared/src/api/errors.ts
- `rateLimit()` --calls--> `ApiError`  [EXTRACTED]
  apps/api/src/lib/rate-limit.ts → packages/shared/src/api/errors.ts

## Import Cycles
- None detected.

## Communities (110 total, 7 thin omitted)

### Community 0 - "newId"
Cohesion: 0.03
Nodes (129): buildApp(), leaseId(), derive(), hashPassword(), IssuedSession, loadServerSecret(), PBKDF2_ITERATIONS, REFRESH_GRACE_MS (+121 more)

### Community 1 - "Num"
Cohesion: 0.09
Nodes (77): useActivatePreset(), useCommitScan(), useContractTemplates(), useDeleteTemplate(), useInquiries(), useProperties(), useRenderTemplate(), useRenewals() (+69 more)

### Community 2 - "israelToday"
Cohesion: 0.06
Nodes (73): serverSecretSync(), geocodeAddress(), publicLocation(), OPEN_TICKET_STATUSES, Contact, currentTenants(), InquiryContext, InquiryRow (+65 more)

### Community 3 - "Button"
Cohesion: 0.12
Nodes (61): useCreateVendor(), useDeleteVendor(), useInquiryAction(), usePublishWindows(), useTicketAction(), useVendors(), ForgotPassword(), ResetPassword() (+53 more)

### Community 4 - "schema.ts"
Cohesion: 0.03
Nodes (60): actorRole, appMeta, auditAction, authTokens, availabilityConfidence, availabilityInquiries, budgetPolicies, contractScans (+52 more)

### Community 5 - "formatDate"
Cohesion: 0.07
Nodes (58): useMeetingSlotAction(), useRenewalAction(), useViewingAction(), useViewings(), addDays(), AvailabilityPicker(), dayLabel(), dayMonth (+50 more)

### Community 6 - "crm.tsx"
Cohesion: 0.10
Nodes (51): useCreateInvite(), useCreateProperty(), useInvites(), useLeads(), useRecordLease(), useRevokeInvite(), useSetLeadStage(), useUpdateProperty() (+43 more)

### Community 7 - "app.ts"
Cohesion: 0.10
Nodes (48): transaction(), inArray(), activeCriteria(), evaluate(), LeadRow, loadLeadContexts(), projectLead(), PropertyRow (+40 more)

### Community 8 - "db/client.ts"
Cohesion: 0.09
Nodes (33): atomically(), expectChanged(), insertChunks(), InsertValues, isGuardFailure(), Tx, Write, Db (+25 more)

### Community 9 - "compilerOptions"
Cohesion: 0.04
Nodes (42): compilerOptions, paths, types, extends, include, ../../tsconfig.base.json, @miftan/fixtures, @miftan/shared (+34 more)

### Community 10 - "ApiError"
Cohesion: 0.11
Nodes (34): verifyAccessToken(), authenticatePlugin, fastify, FastifyInstance, FastifyRequest, USER_COLUMNS, userForToken(), answerByFor() (+26 more)

### Community 11 - "storage/index.ts"
Cohesion: 0.13
Nodes (28): signSchema, targetSchema, uploadRoutes(), ALLOWED_TYPES, assertSize(), assertUploadable(), EXTENSION, MAX_UPLOAD_BYTES (+20 more)

### Community 12 - "dependencies"
Cohesion: 0.05
Nodes (38): dependencies, class-variance-authority@^0.7.1, clsx@^2.1.1, lucide-react@^0.577.0, @radix-ui/react-checkbox@^1.4.1, @radix-ui/react-dialog@^1.3.1, @radix-ui/react-dropdown-menu@^2.2.1, @radix-ui/react-label@^2.1.17 (+30 more)

### Community 13 - "api/package.json"
Cohesion: 0.07
Nodes (34): dependencies, aws4fetch@^1.0.20, dotenv@^17.4.2, fastify@^5.12.7, @fastify/cookie@^11.1.3, @fastify/cors@^11.3.1, fastify-plugin@^6.0.1, fastify-type-provider-zod@^7.0.0 (+26 more)

### Community 14 - "routes.tsx"
Cohesion: 0.13
Nodes (26): useAuth(), Account(), DemoOnly(), AppErrorPage(), Entry(), homeFor(), NoRoles(), RequireAuth() (+18 more)

### Community 15 - "hooks.ts"
Cohesion: 0.08
Nodes (31): MarketResponse, RenewalWrite, ReviewBundle, ThreadSummary, useAcceptInvite(), useConfirmSlot(), useContractScans(), useCreateTicket() (+23 more)

### Community 16 - "unit-detail.tsx"
Cohesion: 0.13
Nodes (32): uploadFile(), useCompleteProtocol(), usePortfolioSnapshot(), useProperty(), useProtocolComparison(), useProtocols(), useStartProtocol(), useUpdateProtocolEntry() (+24 more)

### Community 17 - "listing.tsx"
Cohesion: 0.13
Nodes (27): useApplyFromWatch(), useAskAvailability(), useLeaveQueue(), useRecordListingView(), useReserveQueue(), PublicListing(), ListingStats(), AvailabilityChip() (+19 more)

### Community 18 - "data/reset.ts"
Cohesion: 0.10
Nodes (20): DEMO_TODAY, expenses, LATE, PARTIAL, inquiries, leases, DEFAULT_MOVE_IN, DEMO_SEEKER_ID (+12 more)

### Community 19 - "worker.ts"
Cohesion: 0.12
Nodes (21): DemoSeed, seedIfEmpty(), bindBucket(), ApiBindings, Dispatch, handleApi(), originConfigured, prepare() (+13 more)

### Community 20 - "record-lease.test.ts"
Cohesion: 0.10
Nodes (20): sentMail, fill(), mailUser(), env, parsed, schema, BOUNDS, Point (+12 more)

### Community 21 - "web/package.json"
Cohesion: 0.09
Nodes (27): @radix-ui/react-direction@^1.2.0, @radix-ui/react-popover@^1.3.1, zustand@^5.0.16, devDependencies, oxlint@^1.89.0, tailwindcss@^4.3.3, @tailwindcss/vite@^4.3.3, @types/leaflet@^1.9.22 (+19 more)

### Community 22 - "finance.tsx"
Cohesion: 0.18
Nodes (25): useBriefings(), useBudget(), useExpenses(), useMarket(), useRentPayments(), useScreeningPresets(), useUpdateBudget(), AXIS (+17 more)

### Community 23 - "shared/src/index.ts"
Cohesion: 0.22
Nodes (13): Contact(), StartOwner(), Door(), Welcome(), SIZES, Wordmark(), AttentionItem, APP_NAME (+5 more)

### Community 24 - "me.ts"
Cohesion: 0.13
Nodes (25): sendMail(), hashToken(), issueAuthToken(), retireUnused(), capabilitiesFor(), requireUser(), accountIsDemo(), dismissedRoles() (+17 more)

### Community 25 - "types/index.ts"
Cohesion: 0.09
Nodes (26): LeadContext, Actions, Session, Address, ContractScanStatus, ExpenseKind, Guarantor, InquiryStatus (+18 more)

### Community 26 - "store.ts"
Cohesion: 0.13
Nodes (26): buildSeed(), buildSeasonalTasks(), Entities, hydrate(), nextId(), nowIso(), rescore(), Store (+18 more)

### Community 27 - "clock.ts"
Cohesion: 0.13
Nodes (21): addDays(), addHours(), apartmentPhotos(), BEDROOM, daysAgo(), daysOut(), EXTERIOR, hoursAgo() (+13 more)

### Community 28 - "MiftanClient"
Cohesion: 0.13
Nodes (11): ClientOptions, MiftanClient, toApiError(), ApiErrorBody, ERROR_CODES, ERROR_STATUS, ErrorCode, ForgotPasswordInput (+3 more)

### Community 29 - "api/tickets.ts"
Cohesion: 0.08
Nodes (23): budgetPolicySchema, BudgetPolicyView, updateBudgetPolicySchema, assignedVendorSchema, assignVendorSchema, CreateTicketInput, createTicketSchema, fileRef (+15 more)

### Community 30 - "schemas.ts"
Cohesion: 0.08
Nodes (22): AuthResult, authResultSchema, capabilitiesSchema, ChangeEmailInput, changeEmailSchema, ChangePasswordInput, changePasswordSchema, dismissOnboardingSchema (+14 more)

### Community 31 - "steps"
Cohesion: 0.08
Nodes (23): concurrency, cancel-in-progress, group, GRAPHIFY_BACKEND, runs-on, steps, timeout-minutes, jobs (+15 more)

### Community 32 - "shared/package.json"
Cohesion: 0.10
Nodes (22): @types/node@^24.19.2, @types/node, date-fns@^4.4.0, @types/node@^24.19.2, date-fns, dependencies, date-fns@^4.1.0, zod@^4.6.7 (+14 more)

### Community 33 - "map.tsx"
Cohesion: 0.12
Nodes (18): leaflet@^1.9.4, maplibre-gl@^6.15.0, @maplibre/maplibre-gl-leaflet@^0.1.4, react-leaflet@^4.2.1, FitBounds(), KeepSized(), MapListing, PICKER_ICON (+10 more)

### Community 34 - "cn"
Cohesion: 0.17
Nodes (21): DepartureTrack(), DepartureTrackProps, MonthList(), MonthListRow(), TONE_BAR, TONE_CAP, TrackBar(), OfferCard() (+13 more)

### Community 35 - "search-rank.ts"
Cohesion: 0.16
Nodes (20): Comparable, ComparisonBasis, computeInsight(), median(), MIN_AREA_STATS_SAMPLE, MIN_COMPARABLE_SAMPLE, peerGroups(), PriceVerdict (+12 more)

### Community 36 - "routes/auth.ts"
Cohesion: 0.19
Nodes (18): ACCESS_TTL_SECONDS, createSession(), revokeAllSessions(), revokeSession(), rotateSession(), signAccessToken(), consumeAuthToken(), verifyPassword() (+10 more)

### Community 37 - "ref_zod"
Cohesion: 0.15
Nodes (17): loadOwned(), project(), PropertyRow, seasonalRoutes(), TaskRow, createVendorSchema, expenseListSchema, expenseSchema (+9 more)

### Community 38 - "lucide-react"
Cohesion: 0.16
Nodes (13): Amenity, Fact(), OnboardingStep, Role, Range(), RevenueLensToggle(), useRevenueModel(), ButtonProps (+5 more)

### Community 39 - "phase.tsx"
Cohesion: 0.14
Nodes (15): PHASE, TURN, BadgeProps, PortfolioRow, PropertySnapshot, RenewalView, DEMAND_PHASES, PhaseFacts (+7 more)

### Community 40 - "selectors.ts"
Cohesion: 0.12
Nodes (13): availabilityKind(), leaseForProperty(), MonthRollup, OPEN_TICKET_STATUSES, PortfolioStats, portfolioStats(), portfolioTrackRows(), RentComparison (+5 more)

### Community 41 - "steps"
Cohesion: 0.10
Nodes (20): concurrency, cancel-in-progress, group, jobs, verify, name, on, pull_request (+12 more)

### Community 42 - "api/search.ts"
Cohesion: 0.10
Nodes (19): availabilityConfidenceSchema, CreatePropertyInput, createPropertySchema, unitStatusSchema, UpdatePropertyInput, updatePropertySchema, amenitySchema, districtSchema (+11 more)

### Community 43 - "api/renewals.ts"
Cohesion: 0.10
Nodes (20): completeRenewalSchema, extendDeadlineSchema, ListingRequirements, listingRequirementsSchema, MeetingSlot, meetingSlotSchema, offerMeetingSchema, publishWindowsSchema (+12 more)

### Community 44 - "render-demo-seed.ts"
Cohesion: 0.17
Nodes (13): here, literal(), out, renderDemoSeed(), SKIP, bindDatabase(), DEV_PASSWORD, D1_DATABASE_ID (+5 more)

### Community 45 - "demo-data.ts"
Cohesion: 0.24
Nodes (18): day(), money(), propId(), seedDemoData(), ticketId(), userId(), vendorId(), DEMO_NAME (+10 more)

### Community 46 - "search.tsx"
Cohesion: 0.15
Nodes (19): useInterpretSearch(), useRenterProfile(), useRunSearch(), useSearchUniverse(), CardGridSkeleton(), AiNote, AMENITY_FILTERS, AreaOverview() (+11 more)

### Community 47 - "api/leads.ts"
Cohesion: 0.10
Nodes (19): auditEntrySchema, AuditEntryView, auditListSchema, leadListSchema, leadStageSchema, LeadView, leadViewSchema, OwnerLead (+11 more)

### Community 48 - "search-state.ts"
Cohesion: 0.18
Nodes (17): buildChips(), Chip, EMPTY, fill(), FormState, isClientSort(), ltr(), num() (+9 more)

### Community 49 - "api/viewings.ts"
Cohesion: 0.11
Nodes (18): screeningFlagSchema, screeningSnapshotSchema, bookSlotSchema, briefingSchema, BriefingView, cancelSlotSchema, inviteToSlotSchema, markAttendanceSchema (+10 more)

### Community 50 - "search-intent.ts"
Cohesion: 0.15
Nodes (18): addDays(), AMENITY_KEYS, AMENITY_WORDS, escape(), iso(), MONTHS, normalizeModelIntent(), pad() (+10 more)

### Community 51 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+10 more)

### Community 52 - "package.json"
Cohesion: 0.14
Nodes (17): drizzle-orm@^0.45.4, typescript@~6.0.2, typescript@~6.0.2, devDependencies, drizzle-orm@^0.45.4, patch-package@^8.0.1, typescript@~6.0.2, wrangler@^4.158.0 (+9 more)

### Community 53 - "patterns.ts"
Cohesion: 0.19
Nodes (14): ContractExtractor, ExtractionResult, WANTED, WantedKey, createExtractor(), lineAround(), matchOne(), MONEY (+6 more)

### Community 54 - "auth.tsx"
Cohesion: 0.20
Nodes (12): AuthContext, AuthProvider(), AuthState, api, onSignedOut(), keys, queryClient, SessionRow (+4 more)

### Community 55 - "landing.tsx"
Cohesion: 0.14
Nodes (14): iso(), Landing(), PRINCIPLE_ICONS, ROLE_ICONS, sampleRows(), LegalPage(), LegalDoc(), MarkdownTable() (+6 more)

### Community 56 - "steps"
Cohesion: 0.11
Nodes (17): jobs, update, name, on, push, permissions, contents, paths (+9 more)

### Community 57 - "routes/threads.ts"
Cohesion: 0.20
Nodes (15): assertThreadLinks(), loadThread(), MessageRow, project(), projectMany(), sideOf(), threadRoutes(), ThreadRow (+7 more)

### Community 58 - "shell.tsx"
Cohesion: 0.28
Nodes (14): AppFooter(), BottomTabs(), NavItem, OwnerShell(), RailLink(), SeekerShell(), SkipLink(), TenantShell() (+6 more)

### Community 59 - "routes/contract-templates.ts"
Cohesion: 0.20
Nodes (14): asView(), contractTemplateRoutes(), TemplateRow, builtInTemplate(), CONTRACT_DISCLAIMER, CONTRACT_TEMPLATES, ContractTemplate, PARTIES (+6 more)

### Community 60 - "status.tsx"
Cohesion: 0.17
Nodes (14): AVAILABILITY_COLOR, AVAILABILITY_ICON, AVAILABILITY_LABEL, AVAILABILITY_TONE, SEVERITY_TONE, STAGE_TONE, TICKET_TONE, UNIT_TONE (+6 more)

### Community 61 - "lib/screening.ts"
Cohesion: 0.18
Nodes (12): Comparable, CycleFacts, ALL_CRITERION_IDS, DEFAULT_CRITERIA, effectiveCriteria(), employmentLabel(), evaluateLead(), fill() (+4 more)

### Community 62 - "check"
Cohesion: 0.12
Nodes (15): env, runs-on, steps, timeout-minutes, SITE, jobs, check, name (+7 more)

### Community 63 - "api/inquiries.ts"
Cohesion: 0.12
Nodes (15): askInquirySchema, askTenantSchema, inquiryListSchema, inquiryStatusSchema, InquiryView, inquiryViewSchema, OwnerInquiry, ownerInquirySchema (+7 more)

### Community 64 - "api/invites.ts"
Cohesion: 0.12
Nodes (15): acceptedInviteSchema, CreatedInvite, createdInviteSchema, CreateInviteInput, createInviteSchema, day, inviteListSchema, InvitePreview (+7 more)

### Community 65 - "views.ts"
Cohesion: 0.12
Nodes (15): addressSchema, AddressView, availabilitySignalSchema, AvailabilitySignalView, fileRef, leaseTermsSchema, ownerPropertySchema, propertyListSchema (+7 more)

### Community 66 - "apps_api_src_db_client_schema"
Cohesion: 0.30
Nodes (11): interpretWithModel(), autoApprovedThisMonth(), decideAutoApproval(), policyFor(), budgetRoutes(), current(), conditions(), percentile() (+3 more)

### Community 67 - "seed-scenarios.ts"
Cohesion: 0.22
Nodes (14): addDays(), ago(), FIRST, LAST, lid(), money(), monthEnd(), pid() (+6 more)

### Community 68 - "regions.ts"
Cohesion: 0.14
Nodes (12): ModelConfig, systemPrompt(), BY_NAME, CITIES, citiesByDistrict(), citiesIn(), CityEntry, District (+4 more)

### Community 69 - "routes/contracts.ts"
Cohesion: 0.19
Nodes (13): contractRoutes(), extractor, loadOwned(), project(), PropertyRow, ScanRow, commitScanSchema, contractScanListSchema (+5 more)

### Community 70 - "performance.tsx"
Cohesion: 0.23
Nodes (14): usePortfolioAnalytics(), addDays(), bucket(), funnelFor(), FunnelPanel(), MetricGrid(), PerformanceSection(), Period (+6 more)

### Community 71 - "fixtures/package.json"
Cohesion: 0.15
Nodes (13): @miftan/shared@*, @miftan/shared, @miftan/shared@*, dependencies, @miftan/shared@*, exports, name, private (+5 more)

### Community 72 - "bundle-migrations.ts"
Cohesion: 0.18
Nodes (7): dir, here, renderMigrations(), here, shared, FORBIDDEN, sourceFiles()

### Community 73 - "seed-extra.ts"
Cohesion: 0.22
Nodes (13): FLATS, lid(), money(), pid(), seedExtraDemo(), SEEKERS, TENANTS, Tx (+5 more)

### Community 74 - "rate-limit.ts"
Cohesion: 0.16
Nodes (13): clientIp(), proxiedClientIp(), authBurst, Bucket, buckets, interpretBurst, joinBurst, rateLimit() (+5 more)

### Community 75 - "updates"
Cohesion: 0.14
Nodes (13): minor-and-patch, dependency-name, update-types, update-types, interval, updates, directory, groups (+5 more)

### Community 76 - "api/portfolio.ts"
Cohesion: 0.14
Nodes (13): analyticsQuerySchema, Appointment, appointmentSchema, calendarDay, Funnel, funnelSchema, PortfolioAnalytics, portfolioAnalyticsSchema (+5 more)

### Community 77 - "api/rent-payments.ts"
Cohesion: 0.14
Nodes (13): MarkRentPaidInput, markRentPaidSchema, OwnerRentPayment, ownerRentPaymentSchema, paymentMethodSchema, rentPaymentBase, rentPaymentListSchema, rentPaymentQuerySchema (+5 more)

### Community 78 - "lib/seasonal.ts"
Cohesion: 0.22
Nodes (9): seasonalTemplates, appliesTo(), expectedSaving(), nextDueDate(), scheduleFor(), totalExpectedSaving(), ISRAEL_TZ, offsetMinutes() (+1 more)

### Community 79 - "lib/budget.ts"
Cohesion: 0.21
Nodes (10): BASELINE, BudgetDecision, BudgetPolicy, DEFAULT_BUDGET_POLICY, estimateFor(), evaluateBudget(), fmt(), SEVERITY_MULTIPLIER (+2 more)

### Community 80 - "leads.test.ts"
Cohesion: 0.20
Nodes (7): alice, bob, makeUser(), owner, queueUp(), req(), soon()

### Community 81 - "pricing.tsx"
Cohesion: 0.21
Nodes (10): ADD_ONS, AddOnId, OWNER_PLANS, PlanId, PlanPrice, SERVICE_PRICES, SERVICE_PRICES_SOURCE, ServiceId (+2 more)

### Community 82 - "renewal.ts"
Cohesion: 0.17
Nodes (10): APPLICANTS_AUTO_OPEN_HOURS, MEETING_MINUTES, OwnerStep, RENEWAL_DEFAULT_LEAD_DAYS, RENEWAL_NOTICE_BUFFER_DAYS, RENEWAL_TOPICS, RenewalStage, TenantStep (+2 more)

### Community 83 - "demo-guard.ts"
Cohesion: 0.27
Nodes (9): assertDemoFlag(), assertDemoSeedAllowed(), assertNoRealAccounts(), assertSafeToErase(), DEMO_MARKER_KEY, DEMO_MARKER_VALUE, ERASE_CONFIRMATION, IdRow (+1 more)

### Community 84 - "mailer.ts"
Cohesion: 0.29
Nodes (5): getMailer(), ConsoleMailer, Mailer, OutboundMail, ResendMailer

### Community 85 - "search-card.tsx"
Cohesion: 0.33
Nodes (9): basisText(), EnrichedResult, fill(), REASON_LABEL, verdictText(), SearchResult, ListingInsight, MatchResult (+1 more)

### Community 86 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:reset, db:seed, dev, dev:api, lint, postinstall (+2 more)

### Community 87 - "api/contract-templates.ts"
Cohesion: 0.20
Nodes (9): RenderedContract, renderedSchema, renderTemplateSchema, saveTemplateSchema, templateListSchema, templateSchema, templateVariableSchema, TemplateView (+1 more)

### Community 88 - "api/protocols.ts"
Cohesion: 0.20
Nodes (9): comparisonRowSchema, comparisonSchema, ComparisonView, protocolEntrySchema, protocolKindSchema, protocolListSchema, protocolRunSchema, startProtocolSchema (+1 more)

### Community 89 - "api/reviews.ts"
Cohesion: 0.20
Nodes (9): MyReview, myReviewSchema, reviewablePendingSchema, reviewerRoleSchema, reviewListSchema, reviewSchema, ReviewView, score (+1 more)

### Community 90 - "viewings.test.ts"
Cohesion: 0.31
Nodes (8): makeLead(), makeUser(), owner, publish(), req(), soon(), strong, weak

### Community 91 - "log.ts"
Cohesion: 0.39
Nodes (6): LoggableError, logSerializers, redactUrl(), safeError(), scrubMessage(), SECRET_PATHS

### Community 92 - "pdf-text.ts"
Cohesion: 0.32
Nodes (6): pdfjs-dist@^6.4.299, logicalOrder(), markerHits(), MARKERS, pdfText(), pdfjs-dist

### Community 93 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, db:generate, db:reset, db:seed, render:demo, test, typecheck

### Community 94 - "templates.ts"
Cohesion: 0.52
Nodes (6): actionMail(), alreadyRegisteredMail(), emailChangeMail(), resetMail(), verifyMail(), wrap()

### Community 95 - "presign.ts"
Cohesion: 0.48
Nodes (5): encode(), hmac(), presignGet(), PresignInput, sha256()

### Community 96 - "notification-bell.tsx"
Cohesion: 0.48
Nodes (6): useMarkNotificationsSeen(), useNotifications(), NotificationBell(), ROLE_ICON, RoleMark(), textFor()

### Community 97 - "api/notifications.ts"
Cohesion: 0.29
Nodes (6): NotificationFeed, notificationFeedSchema, NotificationKind, notificationKindSchema, notificationSchema, NotificationView

### Community 99 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 100 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, preview, typecheck

### Community 101 - "card.tsx"
Cohesion: 0.40
Nodes (4): Card, CardBody(), CardHeader(), CardTitle()

### Community 103 - ".prettierrc.json"
Cohesion: 0.50
Nodes (3): printWidth, singleQuote, trailingComma

### Community 104 - "readyForReceipt"
Cohesion: 1.00
Nodes (3): readyForReceipt(), reportLeak(), req()

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `israelToday()` connect `israelToday` to `newId`, `Num`, `Button`, `formatDate`, `app.ts`, `db/client.ts`, `ApiError`, `unit-detail.tsx`, `listing.tsx`, `finance.tsx`, `shared/src/index.ts`, `me.ts`, `store.ts`, `selectors.ts`, `routes/contract-templates.ts`, `apps_api_src_db_client_schema`, `seed-scenarios.ts`, `regions.ts`, `performance.tsx`, `lib/seasonal.ts`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Should `newId` be split into smaller, more focused modules?**
  _Cohesion score 0.025328508855456105 - nodes in this community are weakly interconnected._
- **Why does `fastify` connect `newId` to `apps_api_src_db_client_schema`, `israelToday`, `routes/auth.ts`, `routes/contracts.ts`, `ref_zod`, `app.ts`, `db/client.ts`, `rate-limit.ts`, `ApiError`, `storage/index.ts`, `api/package.json`, `leads.test.ts`, `worker.ts`, `record-lease.test.ts`, `me.ts`, `routes/threads.ts`, `viewings.test.ts`, `routes/contract-templates.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `Num` be split into smaller, more focused modules?**
  _Cohesion score 0.08716540837336993 - nodes in this community are weakly interconnected._
- **Why does `react` connect `shared/src/index.ts` to `Num`, `Button`, `formatDate`, `crm.tsx`, `dependencies`, `routes.tsx`, `hooks.ts`, `unit-detail.tsx`, `listing.tsx`, `web/package.json`, `finance.tsx`, `map.tsx`, `cn`, `lucide-react`, `search.tsx`, `auth.tsx`, `landing.tsx`, `shell.tsx`, `status.tsx`, `performance.tsx`, `search-card.tsx`, `notification-bell.tsx`, `card.tsx`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Should `israelToday` be split into smaller, more focused modules?**
  _Cohesion score 0.05929989550679206 - nodes in this community are weakly interconnected._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.11511387163561076 - nodes in this community are weakly interconnected._