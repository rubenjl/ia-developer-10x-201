import type { EventInfo } from '@telon/ui';
import { ArrowLink } from '../atoms/ArrowLink.js';
import { SectionLabel } from '../atoms/SectionLabel.js';
import { EventDetails } from '../molecules/EventDetails.js';

type StoreEvent = Pick<EventInfo, 'id' | 'title' | 'venue' | 'starts_at'>;

export function FeaturedEvent({ event, href }: { event: StoreEvent; href: string }) {
  return (
    <section className="featured-event" aria-labelledby="featured-title">
      <div className="featured-event__copy">
        <SectionLabel className="featured-event__label">La próxima función</SectionLabel>
        <h1 id="featured-title">{event.title}<span className="featured-event__period">.</span></h1>
        <EventDetails startsAt={event.starts_at} venue={event.venue} variant="light" />
        <ArrowLink href={href} variant="solid">Descubrir el evento</ArrowLink>
        <span className="featured-event__index" aria-hidden="true">01 <i>/</i> EN ESCENA</span>
      </div>
      <figure className="featured-event__image">
        <img
          src="https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1500&q=85"
          alt="Público disfrutando de una actuación en directo"
          fetchPriority="high"
        />
        <figcaption><span className="featured-event__image-mark" aria-hidden="true">T</span><span>Las noches<br />se viven aquí.</span></figcaption>
      </figure>
    </section>
  );
}