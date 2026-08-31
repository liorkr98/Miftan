import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { APP_NAME, t } from '@miftan/shared';
import { useAuth } from '@/api/auth';
import { EmptyState } from '@/components/shared/empty-state';
import { rolesFor, roleFromPath, type Role } from './role-switcher';
import { DoorOpen } from 'lucide-react';

/**
 * Nothing renders until the session question is settled.
 *
 * On a cold load the refresh cookie may still be good, so the app has to ask
 * the server first. Showing a login form during that beat would flash it at
 * somebody who is already signed in — brief, and exactly the kind of thing
 * that makes software feel unreliable.
 */
export function RequireAuth() {
  const { user, capabilities, restoring } = useAuth();
  const location = useLocation();

  if (restoring) {
    return (
      <div className="grid min-h-dvh place-items-center bg-surface">
        <div className="flex items-center gap-2.5 text-muted">
          <DoorOpen className="h-5 w-5 animate-pulse" />
          <span className="text-sm font-semibold">{APP_NAME}</span>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;

  /* A route the account has no relationship with is not a 403 screen — it is
     simply not one of their views, so they land on one that is. */
  const available = rolesFor(capabilities);
  const wanted = roleFromPath(location.pathname);
  if (wanted && !available.includes(wanted)) {
    return <Navigate to={homeFor(available)} replace />;
  }

  return <Outlet />;
}

export function homeFor(roles: Role[]): string {
  if (roles.includes('owner')) return '/owner';
  if (roles.includes('tenant')) return '/tenant';
  return '/search';
}

/** Signed in, but the account holds nothing yet. */
export function NoRoles() {
  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-4">
      <EmptyState title={t.roles.none} hint={t.roles.noneHint} className="max-w-md bg-bg" />
    </div>
  );
}

/** Sends a signed-in visitor at "/" to whichever view they actually have. */
export function RoleHome() {
  const { capabilities } = useAuth();
  return <Navigate to={homeFor(rolesFor(capabilities))} replace />;
}
