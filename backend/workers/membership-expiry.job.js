import cron from 'node-cron';
import { prisma } from '../prisma/client.js';
import logger from '../config/logger.js';

/**
 * =====================================================
 * MEMBERSHIP EXPIRY SCHEDULER
 * =====================================================
 * Runs periodically to mark expired memberships and downgrade user plans
 * 
 * Schedule: Every hour at the start of the hour
 * Can be adjusted via CRON_SCHEDULE env variable
 */

const CRON_SCHEDULE = process.env.CRON_SCHEDULE || '0 * * * *'; // Default: every hour

/**
 * Check and process expired memberships
 * 
 * This function:
 * 1. Finds all ACTIVE memberships where end_date <= now
 * 2. Updates their status to EXPIRED
 * 3. Downgrades users with expired memberships to FREE plan
 * 4. Logs activity for audit trail
 */
export async function processExpiredMemberships() {
  try {
    logger.info('[CRON] Starting membership expiry check...');

    const result = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Step 1: Find all expired memberships that are still marked ACTIVE
      const expiredMemberships = await tx.userMembership.findMany({
        where: {
          end_date: { lte: now },
          status: 'ACTIVE',
        },
        select: {
          id: true,
          user_id: true,
          plan_id: true,
        },
      });

      if (expiredMemberships.length === 0) {
        logger.debug('[CRON] No expired memberships to process');
        return { expiredCount: 0, updatedUsersCount: 0 };
      }

      // Step 2: Mark all expired memberships as EXPIRED
      const updateMembershipResult = await tx.userMembership.updateMany({
        where: {
          end_date: { lte: now },
          status: 'ACTIVE',
        },
        data: {
          status: 'EXPIRED',
        },
      });

      logger.info(`[CRON] Marked ${updateMembershipResult.count} memberships as EXPIRED`);

      // Step 3: Get unique user IDs that had memberships expire
      const expiredUserIds = [...new Set(expiredMemberships.map(m => m.user_id))];

      // Step 4: Check each user to see if they have any remaining ACTIVE memberships
      // If not, downgrade them to FREE plan
      const usersToDowngrade = [];

      for (const userId of expiredUserIds) {
        const hasActiveMembership = await tx.userMembership.findFirst({
          where: {
            user_id: userId,
            status: 'ACTIVE',
          },
        });

        // If no active memberships, user should be downgraded
        if (!hasActiveMembership) {
          usersToDowngrade.push(userId);
        }
      }

      // Step 5: Downgrade users to FREE plan
      if (usersToDowngrade.length > 0) {
        const updateUserResult = await tx.user.updateMany({
          where: {
            id: { in: usersToDowngrade },
          },
          data: {
            plan: 'FREE',
          },
        });

        logger.info(`[CRON] Downgraded ${updateUserResult.count} users to FREE plan`);

        // Step 6: Log activity for each downgraded user (audit trail)
        const activityLogs = usersToDowngrade.map(userId => ({
          id: crypto.randomUUID ? crypto.randomUUID() : undefined,
          user_id: userId,
          action: 'MEMBERSHIP_EXPIRED',
          entity_type: 'MEMBERSHIP',
          entity_id: userId,
          details: 'Automatic downgrade: All active memberships expired, user plan set to FREE',
          created_at: now,
        }));

        await tx.adminActivityLog.createMany({
          data: activityLogs,
          skipDuplicates: true,
        });
      }

      return {
        expiredCount: updateMembershipResult.count,
        updatedUsersCount: usersToDowngrade.length,
      };
    });

    logger.info(
      `[CRON] Membership expiry check complete: ${result.expiredCount} memberships expired, ${result.updatedUsersCount} users downgraded`
    );

    return result;
  } catch (error) {
    logger.error('[CRON] Membership expiry check failed:', {
      error: error.message,
      stack: error.stack,
    });
    // Don't throw — scheduler should continue even if one run fails
    return { expiredCount: 0, updatedUsersCount: 0, error: error.message };
  }
}

/**
 * Initialize the membership expiry scheduler
 * Should be called on server startup
 */
export function initializeMembershipExpiryScheduler() {
  try {
    logger.info(`[SCHEDULER] Initializing membership expiry scheduler (cron: "${CRON_SCHEDULE}")`);

    const task = cron.schedule(CRON_SCHEDULE, async () => {
      await processExpiredMemberships();
    });

    // Run once on startup (in background)
    setImmediate(() => {
      processExpiredMemberships().catch(err => 
        logger.error('[CRON] Initial run failed:', err.message)
      );
    });

    logger.info('[SCHEDULER] Membership expiry scheduler initialized successfully');

    return task;
  } catch (error) {
    logger.error('[SCHEDULER] Failed to initialize membership expiry scheduler:', error.message);
    throw error;
  }
}
