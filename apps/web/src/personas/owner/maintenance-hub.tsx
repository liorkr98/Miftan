import { useSearchParams } from 'react-router-dom';
import { t } from '@miftan/shared';
import { useSeasonal } from '@/api/hooks';
import { PageHeader, Num } from '@/components/shared/typography';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OwnerSeasonal } from './seasonal';
import { OwnerVendors } from './vendors';

type Tab = 'preventive' | 'vendors';

/**
 * Preventive maintenance and the people who do it, as one screen.
 *
 * The two were always the same conversation — a due task and "who do I call
 * about it" are one decision, not two. `preventive` stays the default tab so
 * the existing `/owner/maintenance` link (the dashboard's "5 due soon" tile,
 * among others) keeps meaning what it always meant.
 */
export function OwnerMaintenanceHub() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'preventive';

  const { data } = useSeasonal();
  const dueSoon = (data?.tasks ?? []).filter((x) => x.status === 'due').length;

  return (
    <div className="space-y-5">
      <PageHeader title={t.maintenanceHub.title} subtitle={t.maintenanceHub.subtitle} />

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="preventive">
            {t.maintenanceHub.tabPreventive}
            {dueSoon ? <Num className="ms-1.5 text-2xs text-muted">{dueSoon}</Num> : null}
          </TabsTrigger>
          <TabsTrigger value="vendors">{t.maintenanceHub.tabVendors}</TabsTrigger>
        </TabsList>

        <TabsContent value="preventive">
          <OwnerSeasonal />
        </TabsContent>
        <TabsContent value="vendors">
          <OwnerVendors />
        </TabsContent>
      </Tabs>
    </div>
  );
}
