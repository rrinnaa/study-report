export const ROUTES = {
  HOME: '/',
  AUTH: '/auth',
  UPLOAD: '/reports/upload',
  ANALYSIS: '/reports/analysis',
  MY_UPLOADS: '/reports/history',
  EDIT_PROFILE: '/profile/edit',
  ADMIN: '/admin/users',
} as const

export const LEGACY_ROUTE_REDIRECTS: Record<string, string> = {
  '/upload': ROUTES.UPLOAD,
  '/analysis': ROUTES.ANALYSIS,
  '/my-uploads': ROUTES.MY_UPLOADS,
  '/edit-profile': ROUTES.EDIT_PROFILE,
  '/admin': ROUTES.ADMIN,
}
