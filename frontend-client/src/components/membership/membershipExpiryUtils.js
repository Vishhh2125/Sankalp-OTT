import { formatMembershipEnd } from './membershipApi';

/** Calendar days from today (local) until membership end date. */
export function getMembershipDaysRemaining(endDateIso) {
  if (!endDateIso) return null;
  const end = new Date(endDateIso);
  if (Number.isNaN(end.getTime())) return null;

  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffMs = endDay.getTime() - today.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

const REMINDER_DAYS = [3, 2];

/**
 * Returns reminder payload when membership ends in 3 or 2 days (paid members only).
 */
export function getMembershipExpiryReminder({ plan, membership }) {
  if (!membership?.end_date) return null;
  if (membership.status && membership.status !== 'ACTIVE') return null;

  const isPaid = plan === 'MEMBER' && membership.end_date;
  if (!isPaid) return null;

  const daysLeft = getMembershipDaysRemaining(membership.end_date);
  if (daysLeft == null || daysLeft < 0) return null;
  if (!REMINDER_DAYS.includes(daysLeft)) return null;

  const endLabel = formatMembershipEnd(membership.end_date);
  const planName = membership.plan_name?.trim();

  if (daysLeft === 3) {
    return {
      daysLeft: 3,
      title: '3 days left on your membership',
      body: planName
        ? `Your ${planName} plan ends on ${endLabel}. Extend now to keep unlimited access and ad-free watching.`
        : `Your membership ends on ${endLabel}. Extend now to keep unlimited access and ad-free watching.`,
      cta: 'Extend now',
    };
  }

  return {
    daysLeft: 2,
    title: '2 days left on your membership',
    body: planName
      ? `Your ${planName} plan ends on ${endLabel}. Extend now so you don't lose access to locked episodes.`
      : `Your membership ends on ${endLabel}. Extend now so you don't lose access to locked episodes.`,
    cta: 'Extend now',
  };
}
