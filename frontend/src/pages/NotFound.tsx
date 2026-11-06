import { Compass } from 'lucide-react';
import { ButtonLink, EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="This page doesn't exist"
      description="The link may be out of date, or the object was removed by a recent scan."
      action={<ButtonLink to="/" variant="primary">Go to overview</ButtonLink>}
    />
  );
}
