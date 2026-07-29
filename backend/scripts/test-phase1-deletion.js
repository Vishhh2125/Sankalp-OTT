import { prisma } from '../prisma/client.js';
import { deleteUserAccount, DELETION_REASONS } from '../modules/user/user-deletion.service.js';

async function runPhase1Test() {
  console.log('---------------------------------------------------------');
  console.log('STARTING AUTOMATED TEST FOR PHASE 1: ACCOUNT DELETION ENGINE');
  console.log('---------------------------------------------------------');

  const testEmail = `test_deletion_${Date.now()}@example.com`;
  let testUser = null;
  let testShow = null;
  let testPayment = null;
  let testCert = null;

  try {
    // 1. Create a dummy Show (needed for watch history and certificate)
    console.log('[1/6] Creating test show...');
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({
        data: { name: 'Test Category' },
      });
    }

    testShow = await prisma.show.create({
      data: {
        title: 'Test Show for Deletion',
        category_id: category.id,
      },
    });

    // 2. Create test user with linked activity, payments, and certificates
    console.log('[2/6] Creating test user with linked financial & certificate records...');
    testUser = await prisma.user.create({
      data: {
        name: 'John Doe DeletionTest',
        email: testEmail,
        password: 'hashedpassword123',
        coins: 100,
      },
    });

    // Create payment transaction
    testPayment = await prisma.paymentTransaction.create({
      data: {
        user_id: testUser.id,
        amount: 499.00,
        type: 'membership',
        status: 'completed',
        gateway: 'cashfree',
      },
    });

    // Create certificate
    const certCode = `CERT-DELTEST-${Date.now()}`;
    testCert = await prisma.certificate.create({
      data: {
        user_id: testUser.id,
        show_id: testShow.id,
        certificate_code: certCode,
        snapshot_data: { student_name: 'John Doe DeletionTest', course_title: 'Test Course' },
      },
    });

    console.log(`User Created (ID: ${testUser.id}, Email: ${testEmail})`);
    console.log(`Payment Transaction Created (ID: ${testPayment.id})`);
    console.log(`Certificate Created (ID: ${testCert.id}, Code: ${certCode})`);

    // 3. Execute deleteUserAccount
    console.log('[3/6] Invoking deleteUserAccount service with valid reason...');
    const deletionReason = DELETION_REASONS[3]; // 'Privacy or data concerns'
    const deletionFeedback = 'I want my personal data removed.';

    const result = await deleteUserAccount(testUser.id, deletionReason, deletionFeedback);
    console.log('Service Result:', result);

    // 4. Verify AccountDeletionAudit record
    console.log('[4/6] Verifying permanent AccountDeletionAudit log...');
    const auditRecord = await prisma.accountDeletionAudit.findFirst({
      where: { user_email: testEmail },
    });

    if (!auditRecord) {
      throw new Error('FAILED: AccountDeletionAudit record was not created!');
    }
    console.log('PASSED: Found Audit Log:', {
      id: auditRecord.id,
      user_name: auditRecord.user_name,
      user_email: auditRecord.user_email,
      reason: auditRecord.reason,
      feedback: auditRecord.feedback,
      deleted_at: auditRecord.deleted_at,
    });

    // 5. Verify payment transaction & certificate anonymization
    console.log('[5/6] Verifying financial & certificate records are anonymized (user_id is NULL)...');
    const updatedPayment = await prisma.paymentTransaction.findUnique({
      where: { id: testPayment.id },
    });
    if (!updatedPayment || updatedPayment.user_id !== null) {
      throw new Error('FAILED: Payment transaction user_id was not set to NULL!');
    }
    console.log('PASSED: PaymentTransaction user_id is now NULL (retained for tax compliance).');

    const updatedCert = await prisma.certificate.findUnique({
      where: { id: testCert.id },
    });
    if (!updatedCert || updatedCert.user_id !== null) {
      throw new Error('FAILED: Certificate user_id was not set to NULL!');
    }
    console.log('PASSED: Certificate user_id is now NULL (retained for public verification).');

    const deletedUserCheck = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    if (deletedUserCheck) {
      throw new Error('FAILED: User record still exists in users table!');
    }
    console.log('PASSED: User row was successfully hard-deleted from users table.');

    // 6. Verify immediate re-registration with same email
    console.log('[6/6] Verifying immediate re-registration with same email...');
    const newUser = await prisma.user.create({
      data: {
        name: 'Brand New John Doe',
        email: testEmail,
        password: 'newpassword123',
      },
    });
    console.log(`PASSED: Re-registration successful for ${testEmail}! New User ID: ${newUser.id}`);

    // Cleanup test artifacts
    await prisma.user.delete({ where: { id: newUser.id } });
    await prisma.paymentTransaction.delete({ where: { id: testPayment.id } });
    await prisma.certificate.delete({ where: { id: testCert.id } });
    await prisma.accountDeletionAudit.delete({ where: { id: auditRecord.id } });
    await prisma.show.delete({ where: { id: testShow.id } });

    console.log('---------------------------------------------------------');
    console.log('SUCCESS: ALL PHASE 1 AUTOMATED TESTS PASSED CLEANLY! 🎉');
    console.log('---------------------------------------------------------');
  } catch (error) {
    console.error('❌ PHASE 1 TEST FAILED:', error);
    // Cleanup on failure if objects created
    try {
      if (testPayment) await prisma.paymentTransaction.deleteMany({ where: { id: testPayment.id } });
      if (testCert) await prisma.certificate.deleteMany({ where: { id: testCert.id } });
      if (testUser) await prisma.user.deleteMany({ where: { email: testEmail } });
      if (testShow) await prisma.show.deleteMany({ where: { id: testShow.id } });
    } catch {}
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runPhase1Test();
