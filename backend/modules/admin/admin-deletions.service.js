import { prisma } from '../../prisma/client.js';

/**
 * Fetch paginated account deletion audit records with search & filters
 */
export async function fetchAccountDeletions({ page = 1, limit = 20, search = '', reason = '', startDate = '', endDate = '' }) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const where = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { user_name: { contains: q, mode: 'insensitive' } },
      { user_email: { contains: q, mode: 'insensitive' } },
      { feedback: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (reason && reason.trim()) {
    where.reason = reason.trim();
  }

  if (startDate || endDate) {
    where.deleted_at = {};
    if (startDate) where.deleted_at.gte = new Date(startDate);
    if (endDate) {
      const eod = new Date(endDate);
      eod.setHours(23, 59, 59, 999);
      where.deleted_at.lte = eod;
    }
  }

  const [total, items, reasonCounts] = await Promise.all([
    prisma.accountDeletionAudit.count({ where }),
    prisma.accountDeletionAudit.findMany({
      where,
      orderBy: { deleted_at: 'desc' },
      skip,
      take: limitNum,
    }),
    prisma.accountDeletionAudit.groupBy({
      by: ['reason'],
      _count: { reason: true },
    }),
  ]);

  const reasonStats = reasonCounts.reduce((acc, curr) => {
    acc[curr.reason] = curr._count.reason;
    return acc;
  }, {});

  return {
    items,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
    reasonStats,
  };
}

/**
 * Export matching account deletion audit records as CSV format
 */
export async function exportAccountDeletionsCSV({ search = '', reason = '', startDate = '', endDate = '' }) {
  const where = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { user_name: { contains: q, mode: 'insensitive' } },
      { user_email: { contains: q, mode: 'insensitive' } },
      { feedback: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (reason && reason.trim()) {
    where.reason = reason.trim();
  }

  if (startDate || endDate) {
    where.deleted_at = {};
    if (startDate) where.deleted_at.gte = new Date(startDate);
    if (endDate) {
      const eod = new Date(endDate);
      eod.setHours(23, 59, 59, 999);
      where.deleted_at.lte = eod;
    }
  }

  const items = await prisma.accountDeletionAudit.findMany({
    where,
    orderBy: { deleted_at: 'desc' },
  });

  const headers = ['ID', 'User Name', 'Email', 'Reason', 'Feedback / Suggestion', 'Date Deleted'];
  const csvRows = [headers.join(',')];

  for (const item of items) {
    const row = [
      `"${item.id}"`,
      `"${(item.user_name || '').replace(/"/g, '""')}"`,
      `"${(item.user_email || '').replace(/"/g, '""')}"`,
      `"${(item.reason || '').replace(/"/g, '""')}"`,
      `"${(item.feedback || '').replace(/"/g, '""')}"`,
      `"${item.deleted_at ? new Date(item.deleted_at).toISOString() : ''}"`,
    ];
    csvRows.push(row.join(','));
  }

  return csvRows.join('\n');
}
