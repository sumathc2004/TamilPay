// Page <-> URL mapping for the app's own lightweight routing — just the browser's
// History API, no router library. Kept in one place so App.jsx's navigate() and its
// popstate listener always agree on the same paths.

const STATIC_PATHS = {
  login: '/login',
  home: '/',
  pg: '/pg',
  pgStatus: '/pg-status',
  imps: '/imps',
  reports: '/reports',
  transactions: '/transactions',
  walletSettlement: '/wallet-settlement',
  customers: '/customers',
  admin: '/admin',
  pgsettings: '/settings',
  qrCodes: '/qr-codes',
  qrRequests: '/qr-requests',
  cardPayments: '/card-payments',
  profile: '/profile',
  announcements: '/announcements',
};

const PATH_TO_PAGE = Object.fromEntries(
  Object.entries(STATIC_PATHS).map(([page, path]) => [path, page]),
);

// Reports opened with a specific report pre-selected (e.g. Admin's "IMPS Report"
// tile deep-links straight past the generic menu) get their own sub-path too, so a
// refresh or a shared link lands back on that report instead of just the menu.
const REPORT_SLUGS = {
  adminImpsReport: 'admin-imps',
  adminPgReport: 'admin-pg',
};
const SLUG_TO_REPORT = Object.fromEntries(
  Object.entries(REPORT_SLUGS).map(([report, slug]) => [slug, report]),
);

/** { page, params } -> URL path (customerDetail and Reports are the only pages carrying params). */
export function toPath(page, params) {
  if (page === 'customerDetail') {
    if (params?.mode === 'create') return '/customers/new';
    if (params?.customerId != null) return `/customers/${params.customerId}${params.mode === 'edit' ? '/edit' : ''}`;
    return '/customers';
  }
  if (page === 'reports' && params?.report && REPORT_SLUGS[params.report]) {
    return `/reports/${REPORT_SLUGS[params.report]}`;
  }
  return STATIC_PATHS[page] ?? '/';
}

/** URL path -> { page, params } — page is null for anything unrecognized. */
export function fromPath(rawPathname) {
  // Gateways and proxies often hand a URL back with a trailing slash or different
  // capitalization; neither should turn a known page into "unrecognized".
  const pathname = rawPathname.length > 1 ? rawPathname.replace(/\/+$/, '').toLowerCase() : rawPathname;
  const customerMatch = pathname.match(/^\/customers\/(new|(\d+)(\/edit)?)$/);
  if (customerMatch) {
    if (customerMatch[1] === 'new') return { page: 'customerDetail', params: { mode: 'create' } };
    return {
      page: 'customerDetail',
      params: { customerId: Number(customerMatch[2]), mode: customerMatch[3] ? 'edit' : 'view' },
    };
  }
  const reportMatch = pathname.match(/^\/reports\/([a-z-]+)$/);
  if (reportMatch && SLUG_TO_REPORT[reportMatch[1]]) {
    return { page: 'reports', params: { report: SLUG_TO_REPORT[reportMatch[1]] } };
  }
  return { page: PATH_TO_PAGE[pathname] ?? null, params: null };
}
