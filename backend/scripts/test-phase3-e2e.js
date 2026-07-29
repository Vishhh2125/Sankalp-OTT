import { prisma } from '../prisma/client.js';
import { deleteUserAccount } from '../modules/user/user-deletion.service.js';
import { fetchAccountDeletions } from '../modules/admin/admin-deletions.service.js';

async function runPhase3E2ETest() {
  console.log('---------------------------------------------------------');
  console.log('STARTING FULL END-TO-END TEST FOR PHASE 3: DELETE ACCOUNT');
  console.log('---------------------------------------------------------');

  const testEmail = `e2e_delete_${Date.now()}@example.com`;
  let testUser = null;
  let testShow = null;
  let testPayment = null;
  let testCert = null;
  let auditLogId = null;

  try {
    // 1. Setup Test Show
    console.log('[1/5] Setting up test show and user...');
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: 'E2E Category' } });
    }

    testShow = await prisma.show.create({
      data: { title: 'E2E Test Show', category_id: category.id },
    });

    // 2. Create User with active membership & payment & certificate
    testUser = await prisma.user.create({
      data: {
        name: 'E2E User FinalTest',
        email: testEmail,
        password: 'securepassword123',
        coins: 250,
      },
    });

    testPayment = await prisma.paymentTransaction.create({
      data: {
        user_id: testUser.id,
        amount: 999.00,
        type: 'membership',
        status: 'completed',
      },
    });

    testCert = await prisma.certificate.create({
      data: {
        user_id: testUser.id,
        show_id: testShow.id,
        certificate_code: `CERT-E2E-${Date.now()}`,
        snapshot_data: { student_name: 'E2E User FinalTest' },
      },
    });

    console.log(`Test user created: ${testEmail} (ID: ${testUser.id})`);

    // 3. Simulate Mobile Client calling deletion service
    console.log('[2/5] Simulating Mobile Client calling delete account API...');
    const deletionReason = 'Technical issues / bugs';
    const deletionFeedback = 'Video playback freezes frequently on Android device.';

    const deleteResult = await deleteUserAccount(testUser.id, deletionReason, deletionFeedback);
    if (!deleteResult || !deleteResult.success) {
      throw new Error('FAILED: Mobile client delete request failed!');
    }
    console.log('PASSED: Account deletion response:', deleteResult);

    // 4. Verify Database Integrity & Anonymization
    console.log('[3/5] Verifying DB integrity & anonymization...');
    const checkUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    if (checkUser) throw new Error('FAILED: User record was not hard deleted!');

    const checkPayment = await prisma.paymentTransaction.findUnique({ where: { id: testPayment.id } });
    if (!checkPayment || checkPayment.user_id !== null) throw new Error('FAILED: Payment record user_id was not set to NULL!');

    const checkCert = await prisma.certificate.findUnique({ where: { id: testCert.id } });
    if (!checkCert || checkCert.user_id !== null) throw new Error('FAILED: Certificate record user_id was not set to NULL!');

    console.log('PASSED: User row deleted; payment and certificate records anonymized.');

    // 5. Verify Admin Panel Audit Trail
    console.log('[4/5] Verifying Admin Panel Audit Trail API...');
    const adminFetch = await fetchAccountDeletions({ search: testEmail });
    if (!adminFetch || !adminFetch.items || adminFetch.items.length === 0) {
      throw new Error('FAILED: Admin API did not return audit record for deleted user!');
    }

    const auditItem = adminFetch.items[0];
    auditLogId = auditItem.id;
    console.log('PASSED: Admin API returned audit trail item:', {
      user_name: auditItem.user_name,
      user_email: auditItem.user_email,
      reason: auditItem.reason,
      feedback: auditItem.feedback,
      deleted_at: auditItem.deleted_at,
    });

    // 6. Verify Immediate Re-registration
    console.log('[5/5] Testing immediate re-registration with same email...');
    const reRegUser = await prisma.user.create({
      data: {
        name: 'Re-registered User',
        email: testEmail,
        password: 'newpassword456',
      },
    });
    console.log(`PASSED: Re-registration successful! New User ID: ${reRegUser.id}`);

    // Cleanup
    await prisma.user.delete({ where: { id: reRegUser.id } });
    await prisma.paymentTransaction.delete({ where: { id: testPayment.id } });
    await prisma.certificate.delete({ where: { id: testCert.id } });
    await prisma.accountDeletionAudit.delete({ where: { id: auditLogId } });
    await prisma.show.delete({ where: { id: testShow.id } });

    console.log('---------------------------------------------------------');
    console.log('SUCCESS: ALL PHASE 3 END-TO-END TESTS PASSED CLEANLY! 🚀');
    console.log('---------------------------------------------------------');
  } catch (error) {
    console.error('❌ PHASE 3 TEST FAILED:', error);
    try {
      if (testPayment) await prisma.paymentTransaction.deleteMany({ where: { id: testPayment.id } });
      if (testCert) await prisma.certificate.deleteMany({ where: { id: testCert.id } });
      if (testUser) await prisma.user.deleteMany({ where: { email: testEmail } });
      if (testShow) await prisma.show.deleteMany({ where: { id: testShow.id } });
      if (auditLogId) await prisma.accountDeletionAudit.deleteMany({ where: { id: auditLogId } });
    } catch {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase3E2ETest();
