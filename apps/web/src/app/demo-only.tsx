import type * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsDemo } from '@/lib/demo';

/** A screen built on illustrative data. Real accounts are sent home. */
export function DemoOnly({ children }: { children: React.ReactNode }) {
  const isDemo = useIsDemo();
  if (!isDemo) return <Navigate to="/owner" replace />;
  return <>{children}</>;
}
