import { useSearchParams } from 'react-router-dom';
import { t } from '@miftan/shared';
import { useInquiries, useLeads, useThreads } from '@/api/hooks';
import { PageHeader, Num } from '@/components/shared/typography';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OwnerCrm } from './crm';
import { OwnerInquiries } from './inquiries';
import { OwnerMessages } from './messages';

type Tab = 'leads' | 'inquiries' | 'messages';

/**
 * Leads, availability inquiries and messages, as one screen.
 *
 * Three different questions — "who is applying", "who is asking if a flat
 * will free up", "what did somebody just say" — that used to live on three
 * separate rail entries. They share a tab bar because they share an owner's
 * actual rhythm of checking them: together, in one sitting, not as three
 * separate trips through the nav.
 *
 * Each tab renders the existing screen exactly as it worked standalone, minus
 * its own `<PageHeader>` — dropped at the source, since none of the three has
 * a route of its own left to be a standalone page on. Nothing about how leads
 * are scored, how an inquiry crosses between owner/tenant/seeker, or how a
 * thread counts unread changes here at all.
 */
export function OwnerLeadsHub() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'leads';

  const { data: leads = [] } = useLeads();
  const { data: inquiries = [] } = useInquiries();
  const { data: threads } = useThreads();

  const leadCount = leads.filter((l) => l.scope === 'owner').length;
  const inquiryCount = inquiries.filter(
    (x) => x.scope === 'owner' && (x.status === 'new' || x.status === 'answered'),
  ).length;
  const unread = threads?.totalUnread ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title={t.leadsHub.title} subtitle={t.leadsHub.subtitle} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="leads">
            {t.leadsHub.tabLeads}
            {leadCount ? <Num className="ms-1.5 text-2xs text-muted">{leadCount}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="inquiries">
            {t.leadsHub.tabInquiries}
            {inquiryCount ? <Num className="ms-1.5 text-2xs text-muted">{inquiryCount}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="messages">
            {t.leadsHub.tabMessages}
            {unread ? <Num className="ms-1.5 text-2xs text-muted">{unread}</Num> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <OwnerCrm />
        </TabsContent>
        <TabsContent value="inquiries">
          <OwnerInquiries />
        </TabsContent>
        <TabsContent value="messages">
          <OwnerMessages />
        </TabsContent>
      </Tabs>
    </div>
  );
}
