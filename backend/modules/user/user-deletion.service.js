import { prisma } from '../../prisma/client.js';

export const DELETION_REASONS = [
  'Not using the platform enough',
  'Found a better alternative',
  'Too expensive / membership cost',
  'Privacy or data concerns',
  'Course or content not relevant to me',
  'Technical issues / bugs',
  'Creating a new account',
  'Other',
];

/**
 * Delete a user account permanently while anonymizing tax/compliance records
 * and storing a permanent deletion audit trail.
 *
 * @param {string} userId - UUID of the user requesting deletion
 * @param {string} reason - Selection from DELETION_REASONS
 * @param {string} [feedback] - Optional free-text feedback
 */
export async function deleteUserAccount(userId, reason, feedback) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  // Ensure reason is valid
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason || !DELETION_REASONS.includes(trimmedReason)) {
    const error = new Error('Please select a valid reason for account deletion.');
    error.statusCode = 400;
    throw error;
  }

  const trimmedFeedback = feedback && typeof feedback === 'string' ? feedback.trim() : null;

  return await prisma.$transaction(async (tx) => {
    // 1. Record permanent audit log
    await tx.accountDeletionAudit.create({
      data: {
        original_id: user.id,
        user_name: user.name || 'User',
        user_email: user.email,
        reason: trimmedReason,
        feedback: trimmedFeedback,
      },
    });

    // 2. Anonymize payment transactions (de-link user_id for tax compliance)
    await tx.paymentTransaction.updateMany({
      where: { user_id: userId },
      data: { user_id: null },
    });

    // 3. Anonymize issued certificates (de-link user_id, keep snapshot_data)
    await tx.certificate.updateMany({
      where: { user_id: userId },
      data: { user_id: null },
    });

    // 4. Hard delete user (cascades watch history, bookmarks, ratings, coin transactions, etc.)
    await tx.user.delete({
      where: { id: userId },
    });

    return {
      success: true,
      message: 'Account deleted successfully.',
    };
  });
}
