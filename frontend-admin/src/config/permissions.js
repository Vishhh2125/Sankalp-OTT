/** Permission keys — must match backend ADMIN_SECTIONS and nav item ids */
export const ADMIN_SECTIONS = [
  'dashboard',
  'users',
  'dramas',
  'categories',
  'banners',
  'hero_banners',
  'membership',
  'topup',
  'coins',
  'notifications',
  'analytics',
  'roles',
  'cms',
  'live',
]

export const SECTION_LABELS = {
  dashboard: 'Dashboard',
  users: 'User Management',
  dramas: 'Drama / Content',
  categories: 'Categories & Tags',
  banners: 'Banners & Popups',
  hero_banners: 'Hero Section',
  membership: 'Membership Plans',
  topup: 'Top-Up Plans',
  coins: 'Coins & Wallet',
  notifications: 'Notifications',
  analytics: 'Analytics & Reports',
  roles: 'Roles & Permissions',
  cms: 'CMS Pages',
  live: 'Live Streaming',
}

/** Sub-admin assignable sections (roles management is main-admin only) */
export const SECTION_OPTIONS = ADMIN_SECTIONS.filter((id) => id !== 'roles').map((id) => ({
  id,
  label: SECTION_LABELS[id],
}))

function isMainAdminRole(user) {
  return user?.role === 'admin' || user?.role === 'ADMIN'
}

export function canAccessPage(user, pageId) {
  if (!user) return false
  if (isMainAdminRole(user)) return true
  return Array.isArray(user.sections) && user.sections.includes(pageId)
}

export function getFirstAllowedPage(user) {
  if (!user) return 'dashboard'
  if (isMainAdminRole(user)) return 'dashboard'
  const allowed = ADMIN_SECTIONS.find((id) => user.sections?.includes(id))
  return allowed || 'dashboard'
}

export function filterNavByPermissions(navConfig, user) {
  if (!user) return []
  if (isMainAdminRole(user)) return navConfig
  return navConfig
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.id !== 'roles' && user.sections?.includes(item.id)
      ),
    }))
    .filter((group) => group.items.length > 0)
}
