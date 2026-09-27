/**
 * The demo Worker is built with VITE_DEMO=true. Production is not.
 * Vite inlines the comparison, so demo-only screens drop out of that bundle.
 */
export const isDemoBuild = import.meta.env.VITE_DEMO === 'true';
