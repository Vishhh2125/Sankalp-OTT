export const NAV_CONFIG = [
  {
    section: 'Overview',
    items: [{ id: 'dashboard', label: 'Dashboard', badge: null }],
  },
  {
    section: 'Users',
    items: [{ id: 'users', label: 'User Management', badge: null }],
  },
  {
    section: 'Content',
    items: [
      { id: 'dramas',     label: 'Drama / Content',   badge: null },
      { id: 'categories', label: 'Categories & Tags',  badge: null },
      { id: 'banners',       label: 'Banners & Popups',   badge: null },
      { id: 'hero_banners',  label: 'Hero Section',       badge: null },
      // { id: 'live',          label: 'Live Streaming',     badge: null }, // Out of scope for now
    ],
  },
  {
    section: 'Monetization',
    items: [
      { id: 'membership', label: 'Membership Plans', badge: null },
      { id: 'topup',      label: 'Top-Up Plans',     badge: null },
      { id: 'coins',      label: 'Coins & Wallet',   badge: null },
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
  users:         { title: 'User Management',      subtitle: 'Manage all registered users' },
  dramas:        { title: 'Drama / Content',      subtitle: 'Manage content library' },
  categories:    { title: 'Categories & Tags',    subtitle: 'Organise and tag content' },
  banners:       { title: 'Banners & Popups',     subtitle: 'Homepage promotions' },
  hero_banners:  { title: 'Hero Section',         subtitle: 'Home page hero slider banners' },
  membership:    { title: 'Membership Plans',     subtitle: 'Plans and billing' },
  topup:         { title: 'Top-Up Plans',         subtitle: 'Coin package management' },
  coins:         { title: 'Coins & Wallet',       subtitle: 'Virtual currency management' },
  notifications: { title: 'Notifications',        subtitle: 'Push messages & alerts' },
  analytics:     { title: 'Analytics & Reports',  subtitle: 'Growth & performance reports' },
  roles:         { title: 'Roles & Permissions',  subtitle: 'Admin access control' },
  cms:           { title: 'CMS Pages',            subtitle: 'Static content pages' },
  live:          { title: 'Live Streaming',       subtitle: 'Broadcast live to viewers' },
}
