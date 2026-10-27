import type { EventInfo } from '@telon/ui';
import { SectionLabel } from '../atoms/SectionLabel.js';
import { EmptyLineup } from '../organisms/EmptyLineup.js';
import { EventLineup } from '../organisms/EventLineup.js';
import { FeaturedEvent } from '../organisms/FeaturedEvent.js';
import { StoreHeader } from '../organisms/StoreHeader.js';

type StoreEvent = Pick<EventInfo, 'id' | 'title' | 'venue' | 'starts_at'>;

export function TenantStorefront({ tenantName, events, basePath }: { tenantName: string; events: StoreEvent[]; basePath: string }) {
  const [featured, ...upcoming] = events;
  return (
    <div className="storefront">
      <StoreHeader tenantName={tenantName} basePath={basePath} />
      <main id="cartelera" className="storefront__main">
        <div className="storefront__intro">
          <SectionLabel>Agenda cultural · {tenantName}</SectionLabel>
          <span>UNA ENTRADA<br />A OTRO MUNDO</span>
        </div>
        {featured ? (
          <>
            <FeaturedEvent event={featured} href={`${basePath}/e/${featured.id}`} />
            <EventLineup events={upcoming} basePath={basePath} />
          </>
        ) : <EmptyLineup />}
      </main>
      <footer className="store-footer">
        <span>© {new Date().getFullYear()} {tenantName}</span>
        <span>Nos vemos entre bambalinas <i aria-hidden="true">✳</i></span>
      </footer>
    </div>
  );
}