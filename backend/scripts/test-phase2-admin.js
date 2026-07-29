import { prisma } from '../prisma/client.js';
import { fetchAccountDeletions, exportAccountDeletionsCSV } from '../modules/admin/admin-deletions.service.js';

async function runPhase2Test() {
  console.log('---------------------------------------------------------');
  console.log('STARTING AUTOMATED TEST FOR PHASE 2: ADMIN DELETIONS VIEW & EXPORT');
  console.log('---------------------------------------------------------');

  let testAuditLog = null;

  try {
    // 1. Create a sample audit log entry for testing
    console.log('[1/4] Seeding sample deletion audit record...');
    const testEmail = `phase2_test_${Date.now()}@example.com`;
    testAuditLog = await prisma.accountDeletionAudit.create({
      data: {
        user_name: 'Phase2 Admin Tester',
        user_email: testEmail,
        reason: 'Too expensive / membership cost',
        feedback: 'Cost is too high for monthly subscription',
      },
    });

    console.log(`Sample Audit Log Created (ID: ${testAuditLog.id})`);

    // 2. Test fetchAccountDeletions service function
    console.log('[2/4] Testing fetchAccountDeletions() paginated service...');
    const result = await fetchAccountDeletions({ page: 1, limit: 10, search: 'Phase2' });

    if (!result || !Array.isArray(result.items)) {
      throw new Error('FAILED: fetchAccountDeletions did not return valid items array!');
    }

    const found = result.items.find((item) => item.id === testAuditLog.id);
    if (!found) {
      throw new Error('FAILED: Created audit log was not found in fetchAccountDeletions search results!');
    }

    console.log('PASSED: fetchAccountDeletions returned record correctly:', {
      total: result.pagination.total,
      page: result.pagination.page,
      reasonStats: result.reasonStats,
      foundItem: {
        id: found.id,
        user_name: found.user_name,
        reason: found.reason,
      },
    });

    // 3. Test CSV export service function
    console.log('[3/4] Testing exportAccountDeletionsCSV() CSV generation service...');
    const csvOutput = await exportAccountDeletionsCSV({ search: 'Phase2' });

    if (!csvOutput || typeof csvOutput !== 'string') {
      throw new Error('FAILED: exportAccountDeletionsCSV did not return a valid string!');
    }

    if (!csvOutput.includes('User Name,Email,Reason') || !csvOutput.includes(testEmail)) {
      throw new Error('FAILED: CSV output missing expected headers or test record data!');
    }

    console.log('PASSED: CSV export generated cleanly. Output preview:\n' + csvOutput.split('\n').slice(0, 3).join('\n'));

    // 4. Cleanup sample audit log
    console.log('[4/4] Cleaning up test data...');
    await prisma.accountDeletionAudit.delete({ where: { id: testAuditLog.id } });

    console.log('---------------------------------------------------------');
    console.log('SUCCESS: ALL PHASE 2 AUTOMATED TESTS PASSED CLEANLY! 🎉');
    console.log('---------------------------------------------------------');
  } catch (error) {
    console.error('❌ PHASE 2 TEST FAILED:', error);
    try {
      if (testAuditLog) await prisma.accountDeletionAudit.deleteMany({ where: { id: testAuditLog.id } });
    } catch {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase2Test();
