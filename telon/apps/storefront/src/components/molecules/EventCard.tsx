import type { EventInfo } from '@telon/ui';
import { ArrowLink } from '../atoms/ArrowLink.js';
import { EventDetails } from './EventDetails.js';

type StoreEvent = Pick<EventInfo, 'id' | 'title' | 'venue' | 'starts_at'>;

export function EventCard({ event, href, index }: { event: StoreEvent; href: string; index: number }) {
  return (
    <article className="event-card">
      <p className="event-card__number">{String(index).padStart(2, '0')} <span>— EN CARTEL</span></p>
      <h3><a href={href}>{event.title}</a></h3>
      <EventDetails startsAt={event.starts_at} venue={event.venue} />
      <ArrowLink href={href} aria-label={`Ver ${event.title}`}>Ver evento</ArrowLink>
    </article>
  );
}