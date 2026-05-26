import { getPrismaClient } from '../../config/db.js';
import logger from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';

const prisma = getPrismaClient();

export async function getAllDramas() {
  try {
    const shows = await prisma.show.findMany({
      select: {
        id: true,
        title: true,
        thumbnail_url: true,
        is_active: true,
      },
      where: {
        is_active: true,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    return shows;
  } catch (error) {
    logger.error('Error fetching dramas:', error);
    throw new ApiError(500, 'Failed to fetch dramas');
  }
}

export async function sendNotification(notificationData, adminId) {
  try {
    const {
      title,
      body,
      type,
      audience,
    } = notificationData;

    // Get target users based on audience
    const userFilter = getUserFilterByAudience(audience);

    // Get all target users
    const users = await prisma.user.findMany(userFilter);

    if (users.length === 0) {
      throw new ApiError(400, 'No users match the specified audience');
    }

    const userIds = users.map(u => u.id);

    // Create notifications for all target users
    const notificationData_bulk = userIds.map(userId => ({
      user_id: userId,
      title,
      body,
      type,
    }));

    const result = await prisma.notificationLog.createMany({
      data: notificationData_bulk,
    });

    logger.info(`Sent ${result.count} notifications of type ${type}`);

    return {
      status: 'sent',
      count: result.count,
      type,
      audience,
      title,
    };
  } catch (error) {
    logger.error('Error sending notification:', error);
    throw error instanceof ApiError ? error : new ApiError(500, 'Failed to send notification');
  }
}

export async function getUserNotifications(userId, options = {}) {
  try {
    const { page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const notifications = await prisma.notificationLog.findMany({
      where: { user_id: userId },
      orderBy: { sent_at: 'desc' },
      skip,
      take: limit,
    });

    const total = await prisma.notificationLog.count({ where: { user_id: userId } });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching user notifications:', error);
    throw new ApiError(500, 'Failed to fetch notifications');
  }
}

export async function markNotificationAsRead(notificationId, userId) {
  try {
    const notification = await prisma.notificationLog.updateMany({
      where: {
        id: notificationId,
        user_id: userId,
      },
      data: {
        is_read: true,
        read_at: new Date(),
      },
    });

    if (notification.count === 0) {
      throw new ApiError(404, 'Notification not found');
    }

    return { success: true };
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    throw error instanceof ApiError ? error : new ApiError(500, 'Failed to update notification');
  }
}

export async function getNotificationStats() {
  try {
    const totalSent = await prisma.notificationLog.count();
    const totalRead = await prisma.notificationLog.count({ where: { is_read: true } });
    const openRate = totalSent > 0 ? ((totalRead / totalSent) * 100).toFixed(2) : 0;

    const typeBreakdown = await prisma.notificationLog.groupBy({
      by: ['type'],
      _count: {
        _all: true,
      },
    });

    // Map the result to the expected format
    const formattedTypeBreakdown = typeBreakdown.map(item => ({
      type: item.type,
      count: item._count._all,
    }));

    return {
      totalSent,
      totalRead,
      openRate: `${openRate}%`,
      typeBreakdown: formattedTypeBreakdown,
    };
  } catch (error) {
    logger.error('Error fetching notification stats:', error);
    throw new ApiError(500, 'Failed to fetch notification statistics');
  }
}

export async function getAllSentNotifications(page = 1, limit = 50) {
  try {
    // Get unique notification broadcasts (grouped by title, type, sent_at)
    const broadcasts = await prisma.notificationLog.groupBy({
      by: ['title', 'type', 'sent_at'],
      _count: {
        id: true,
      },
      orderBy: {
        sent_at: 'desc',
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get total count of unique broadcasts
    const totalBroadcasts = await prisma.notificationLog.findMany({
      distinct: ['title', 'type', 'sent_at'],
      select: {
        title: true,
        type: true,
        sent_at: true,
      },
    });

    const total = totalBroadcasts.length;

    return {
      notifications: broadcasts.map(b => ({
        id: `${b.title}-${b.type}-${b.sent_at.getTime()}`,
        title: b.title,
        type: b.type,
        sent_at: b.sent_at,
        recipients: b._count.id,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Error fetching sent notifications:', error);
    throw new ApiError(500, 'Failed to fetch sent notifications');
  }
}

export async function getNotificationConfig(adminId) {
  try {
    // Store config in a dedicated table or admin preferences
    // For now, return default config
    const config = {
      enableDramaNotifications: true,
      enableMembershipNotifications: true,
      enableRewardNotifications: true,
      defaultTrigger: 'on-login',
      maxNotificationsPerDay: 5,
    };

    return config;
  } catch (error) {
    logger.error('Error fetching notification config:', error);
    throw new ApiError(500, 'Failed to fetch notification config');
  }
}

export async function updateNotificationConfig(adminId, configData) {
  try {
    // Store updated config (in a dedicated table or admin preferences)
    // For now, just return the updated config
    logger.info(`Updated notification config by admin ${adminId}`, configData);

    return {
      success: true,
      config: configData,
    };
  } catch (error) {
    logger.error('Error updating notification config:', error);
    throw new ApiError(500, 'Failed to update notification config');
  }
}

export async function deleteNotificationBroadcast(title, type, sent_at) {
  try {
    // Delete all notifications matching this broadcast
    const result = await prisma.notificationLog.deleteMany({
      where: {
        title,
        type,
        sent_at: new Date(sent_at),
      },
    });

    if (result.count === 0) {
      throw new ApiError(404, 'Notification broadcast not found');
    }

    logger.info(`Deleted notification broadcast: ${title} (${result.count} records)`);

    return {
      success: true,
      message: `Deleted ${result.count} notification records`,
      deletedCount: result.count,
    };
  } catch (error) {
    logger.error('Error deleting notification broadcast:', error);
    throw error instanceof ApiError ? error : new ApiError(500, 'Failed to delete notification');
  }
}

// Helper function to filter users by audience
function getUserFilterByAudience(audience) {
  switch (audience) {
    case 'free':
      return {
        where: {
          plan: 'FREE',
        },
      };
    case 'paid':
      return {
        where: {
          plan: 'MEMBER',
        },
      };
    case 'weekly-plan':
      return {
        where: {
          memberships: {
            some: {
              status: 'ACTIVE',
              plan: {
                duration: 'weekly',
              },
            },
          },
        },
      };
    case 'monthly-plan':
      return {
        where: {
          memberships: {
            some: {
              status: 'ACTIVE',
              plan: {
                duration: 'monthly',
              },
            },
          },
        },
      };
    case 'annual-plan':
      return {
        where: {
          memberships: {
            some: {
              status: 'ACTIVE',
              plan: {
                duration: 'annual',
              },
            },
          },
        },
      };
    case 'all':
    default:
      return {};
  }
}
