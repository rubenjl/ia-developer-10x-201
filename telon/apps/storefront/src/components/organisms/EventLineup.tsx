import type { EventInfo } from '@telon/ui';
import { SectionLabel } from '../atoms/SectionLabel.js';
import { EventCard } from '../molecules/EventCard.js';

type StoreEvent = Pick<EventInfo, 'id' | 'title' | 'venue' | 'starts_at'>;

export function EventLineup({ events, basePath }: { events: StoreEvent[]; basePath: string }) {
  if (events.length === 0) return null;

  return (
    <section className="event-lineup" aria-labelledby="lineup-title">
      <div className="event-lineup__heading">
        <div>
          <SectionLabel>Otras fechas</SectionLabel>
          <h2 id="lineup-title">Sigue el <em>telón abierto.</em></h2>
        </div>
        <span className="event-lineup__count">{String(events.length).padStart(2, '0')} EVENTOS</span>
      </div>
      <div className="event-lineup__grid">
        {events.map((event, index) => (
          <EventCard key={event.id} event={event} index={index + 2} href={`${basePath}/e/${event.id}`} />
        ))}
      </div>
    </section>
  );
}