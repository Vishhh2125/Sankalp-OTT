export const NAV_CONFIG = [
  {
    section: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', badge: null }, { id: 'profile', label: 'Complete Profile', badge: null }],
  },
  {
    section: 'Users',
    items: [
      { id: 'users',              label: 'User Management',     badge: null },
      { id: 'student_onboarding', label: 'Student Onboarding', badge: null },
      { id: 'assign_courses',     label: 'Assign Courses',     badge: null },
      { id: 'account_deletions',  label: 'Account Deletions',  badge: null },
    ],
  },
  {
    section: 'Content',
    items: [
      { id: 'dramas',     label: 'Course / Content',   badge: null },
      { id: 'categories', label: 'Categories & Tags',  badge: null },
      { id: 'banners',       label: 'Banners & Popups',   badge: null },
      { id: 'hero_banners',  label: 'Hero Section',       badge: null },
      { id: 'approvals',    label: 'Approvals',          badge: null },
      { id: 'live',          label: 'Live Streaming',     badge: null },
      { id: 'submissions',   label: 'Submissions',        badge: null },
    ],
  },
  {
    section: 'Monetization',
    items: [
      { id: 'membership', label: 'Membership Plans', badge: null },
      { id: 'topup',      label: 'Top-Up Plans',     badge: null },
      { id: 'coins',      label: 'Coins & Wallet',   badge: null },
      { id: 'packages',   label: 'Packages',         badge: null },
    ],
  },
  {
    section: 'Engagement',
    items: [{ id: 'notifications', label: 'Notifications', badge: null }],
  },
  {
    section: 'System',
    items: [
      { id: 'analytics', label: 'Analytics & Reports',  badge: null },
      { id: 'roles',     label: 'Roles & Permissions',  badge: null },
      { id: 'cms',       label: 'CMS Pages',             badge: null },
    ],
  },
]

export const PAGE_META = {
  dashboard:     { title: 'Dashboard',            subtitle: 'Platform overview' },
  users:              { title: 'User Management',      subtitle: 'Manage all registered users' },
  student_onboarding: { title: 'Student Onboarding', subtitle: 'Onboard new students with instant credentials email' },
  assign_courses:     { title: 'Assign Courses',     subtitle: 'Grant or revoke course access for enrolled students' },
  dramas:        { title: 'Course / Content',      subtitle: 'Manage content library' },
  categories:    { title: 'Categories & Tags',    subtitle: 'Organise and tag content' },
  banners:       { title: 'Banners & Popups',     subtitle: 'Homepage promotions' },
  hero_banners:  { title: 'Hero Section',         subtitle: 'Home page hero slider banners' },
  membership:    { title: 'Membership Plans',     subtitle: 'Plans and billing' },
  topup:         { title: 'Top-Up Plans',         subtitle: 'Coin package management' },
  coins:         { title: 'Coins & Wallet',       subtitle: 'Virtual currency management' },
  packages:      { title: 'Packages',             subtitle: 'Manage bundled show packages' },
  notifications: { title: 'Notifications',        subtitle: 'Push messages & alerts' },
  analytics:     { title: 'Analytics & Reports',  subtitle: 'Growth & performance reports' },
  roles:         { title: 'Roles & Permissions',  subtitle: 'Admin access control' },
  cms:           { title: 'CMS Pages',            subtitle: 'Static content pages' },
  live:          { title: 'Live Streaming',       subtitle: 'Broadcast live to viewers' },
  submissions:   { title: 'Submissions',          subtitle: 'Grade student assignment submissions' },
  approvals:     { title: 'Approvals',             subtitle: 'Pending shows & lectures' },
  profile:       { title: 'Complete Profile',      subtitle: 'Complete your teacher profile' },
  account_deletions: { title: 'Account Deletions', subtitle: 'Audit log of user-initiated account deletions' },
}
