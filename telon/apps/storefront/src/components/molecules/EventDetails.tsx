import { formatDate } from '@telon/ui';

export function EventDetails({ startsAt, venue, variant = 'default' }: { startsAt: string; venue: string; variant?: 'default' | 'light' }) {
  return (
    <div className={`event-details event-details--${variant}`}>
      <span><span className="event-details__symbol" aria-hidden="true">◷</span><time dateTime={startsAt}>{formatDate(startsAt)}</time></span>
      <span><span className="event-details__symbol" aria-hidden="true">⌖</span>{venue}</span>
    </div>
  );
}