export const ADMIN_SECTIONS = [
  'dashboard',
  'users',
  'approvals',
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
  'submissions',
  'packages',
  'student_onboarding',
  'assign_courses',
  'account_deletions',
]

export const SECTION_LABELS = {
  dashboard: 'Dashboard',
  users: 'User Management',
  dramas: 'Drama / Content',
  profile: 'Complete Profile',
  approvals: 'Approvals',
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
  submissions: 'Submissions',
  packages: 'Packages',
  student_onboarding: 'Student Onboarding',
  assign_courses: 'Assign Courses',
  account_deletions: 'Account Deletions',
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
  if (user.role === 'teacher') {
    if (pageId === 'profile') return true
    if (user.is_profile_complete === false) return false
    return ['dashboard', 'dramas', 'live', 'submissions'].includes(pageId)
  }
  return Array.isArray(user.sections) && (user.sections.includes(pageId) || (pageId === 'account_deletions' && user.sections.includes('users')))
}

export function getFirstAllowedPage(user) {
  if (!user) return 'dashboard'
  if (isMainAdminRole(user)) return 'dashboard'
  if (user.role === 'teacher') {
    if (user.is_profile_complete === false) return 'profile'
    return 'dashboard'
  }
  const allowed = ADMIN_SECTIONS.find((id) => user.sections?.includes(id))
  return allowed || 'dashboard'
}

export function filterNavByPermissions(navConfig, user) {
  if (!user) return []
  if (isMainAdminRole(user)) {
    // Admin doesn't need to see "Complete Profile" page
    return navConfig
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => item.id !== 'profile'),
      }))
      .filter((group) => group.items.length > 0)
  }
  
  if (user.role === 'teacher') {
    const allowedTeacherSections = ['dashboard', 'dramas', 'live', 'submissions', 'profile']
    
    return navConfig
      .map((group) => ({
        ...group,
        items: group.items
          .filter((item) => allowedTeacherSections.includes(item.id))
          .map((item) => {
            if (item.id === 'profile') {
              return {
                ...item,
                label: user.is_profile_complete ? 'Teacher Profile' : 'Complete Profile',
              }
            }
            return item
          }),
      }))
      .filter((group) => group.items.length > 0)
  }

  return navConfig
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.id !== 'roles' && item.id !== 'profile' && (user.sections?.includes(item.id) || (item.id === 'account_deletions' && user.sections?.includes('users')))
      ),
    }))
    .filter((group) => group.items.length > 0)
}
