import { api } from '../../services/api';

export async function fetchMembershipPlans() {
  const res = await api.get('/membership/plans');
  return res.data?.data ?? [];
}

export async function createSubscriptionPaymentOrder(planId, gateway = 'cashfree') {
  const res = await api.post('/payments/create-subscription-order', {
    plan_id: planId,
    gateway,
  });
  return res.data?.data;
}

export async function verifyPaymentOrder(orderId) {
  const res = await api.post('/payments/verify-order', { order_id: orderId });
  return res.data?.data;
}

export async function fetchCurrentSubscription() {
  const res = await api.get('/subscription/current');
  return res.data?.data;
}

/** @deprecated Dev-only simulated purchase — use createSubscriptionPaymentOrder + Cashfree */
export async function simulateMembershipPurchase(planId) {
  const res = await api.post('/membership/simulate-purchase', { plan_id: planId });
  return res.data?.data;
}

export function formatPlanPrice(price, currency = 'INR') {
  const n = parseFloat(price);
  if (currency === 'INR') return `₹${n.toFixed(2)}`;
  if (currency === 'USD') return `$${n.toFixed(2)}`;
  return String(price);
}

export function getDurationLabel(duration) {
  const d = String(duration || '').toLowerCase();
  if (d === 'lifetime') return 'Lifetime access';
  if (d === 'weekly' || d === 'week') return 'week';
  if (d === 'monthly' || d === 'month') return 'month';
  if (d === 'annual' || d === 'year' || d === 'yearly') return 'year';
  return duration;
}

export function formatMembershipEnd(iso) {
  if (!iso) return 'Lifetime';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function isLifetimePlan(planOrDuration) {
  const d =
    typeof planOrDuration === 'string'
      ? planOrDuration
      : planOrDuration?.duration;
  return String(d || '').toLowerCase() === 'lifetime';
}

export function getPlanUnlockScopeLabel(plan) {
  if (!plan?.category_id) {
    return 'all categories';
  }
  return plan.category_name || 'this category';
}

export function findBlockingLifetimeMembership(memberships, plan) {
  if (!Array.isArray(memberships) || !plan) return null;
  const targetScope = plan.category_id ?? null;

  return memberships.find((m) => {
    const lifetime =
      m.is_lifetime || isLifetimePlan(m.duration) || m.end_date == null;
    if (!lifetime) return false;
    if (m.category_id == null) return true;
    return m.category_id === targetScope;
  });
}

export function blockingLifetimeMessage(blockingMembership) {
  if (!blockingMembership) return null;
  if (blockingMembership.category_id == null) {
    return 'You already have lifetime access to all categories';
  }
  const name = blockingMembership.category_name || 'this category';
  return `You already have lifetime access to ${name}`;
}
