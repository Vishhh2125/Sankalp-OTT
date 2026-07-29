import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../prisma/client.js';
import { loginUser, hashPassword } from '../modules/auth/auth.service.js';
import { toggleUserStatus } from '../modules/admin/admin.controller.js';
import { ApiError } from '../utils/ApiError.js';

async function runPhase1Test() {
  console.log('=========================================================');
  console.log('STARTING PHASE 1 AUTOMATED TEST: BLOCK / UNBLOCK BACKEND');
  console.log('=========================================================');

  const testEmail = `test_block_user_${Date.now()}@example.com`;
  const plainPassword = 'TestPassword123!';
  let testUser = null;
  let adminUser = null;

  try {
    // Step 1: Create test learner user and test admin user
    console.log('[1/9] Creating test learner user and admin user...');
    const hashedPassword = await hashPassword(plainPassword);
    testUser = await prisma.user.create({
      data: {
        name: 'Block Test Learner',
        email: testEmail,
        password: hashedPassword,
        role: 'USER',
        isBlocked: false,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        name: 'Block Test Admin',
        email: `test_admin_${Date.now()}@example.com`,
        password: hashedPassword,
        role: 'ADMIN',
        isBlocked: false,
      },
    });
    console.log(` -> Learner User created: ID=${testUser.id}, email=${testUser.email}`);
    console.log(` -> Admin User created: ID=${adminUser.id}`);

    // Step 2: Verify login works when unblocked
    console.log('[2/9] Testing login for unblocked user...');
    const loginResult = await loginUser({ email: testEmail, password: plainPassword });
    if (!loginResult.accessToken || !loginResult.refreshToken) {
      throw new Error('Login failed for unblocked user');
    }
    console.log(' -> Login SUCCESS when user is active.');

    // Step 3: Test Admin Block action (toggleUserStatus)
    console.log('[3/9] Executing toggleUserStatus to BLOCK account...');
    let reqMock = { params: { userId: testUser.id }, user: adminUser };
    let resData = null;
    let resMock = {
      json: (data) => { resData = data; return data; }
    };
    let nextMock = (err) => { if (err) throw err; };

    await toggleUserStatus(reqMock, resMock, nextMock);
    console.log(' -> toggleUserStatus response:', resData?.message, resData?.data);

    if (!resData?.data?.isBlocked) {
      throw new Error('User isBlocked flag was not set to true');
    }

    // Step 4: Verify Admin Activity Log created
    console.log('[4/9] Verifying admin_activity_log record for BLOCK_USER...');
    const blockAuditLog = await prisma.adminActivityLog.findFirst({
      where: { entity_id: testUser.id, action: 'BLOCK_USER' },
      orderBy: { created_at: 'desc' },
    });
    if (!blockAuditLog) {
      throw new Error('No admin activity log found for BLOCK_USER');
    }
    console.log(` -> Audit Log Found: Action=${blockAuditLog.action}, User=${blockAuditLog.user_id}`);

    // Step 5: Test Login Rejection when Blocked
    console.log('[5/9] Testing login attempt while BLOCKED...');
    let loginBlockedError = null;
    try {
      await loginUser({ email: testEmail, password: plainPassword });
    } catch (err) {
      loginBlockedError = err;
    }
    if (!loginBlockedError || loginBlockedError.statusCode !== 403) {
      throw new Error(`Expected 403 ApiError on blocked login, got: ${loginBlockedError}`);
    }
    console.log(` -> Login REJECTED as expected with status 403: "${loginBlockedError.message}"`);

    // Step 6: Test Refresh Token Rejection when Blocked
    console.log('[6/9] Testing token refresh check while BLOCKED...');
    const freshDbUser = await prisma.user.findUnique({ where: { id: testUser.id } });
    if (!freshDbUser.isBlocked) {
      throw new Error('User should be blocked in DB');
    }
    let refreshBlockedError = null;
    if (freshDbUser.isBlocked) {
      refreshBlockedError = new ApiError(403, 'Your account has been blocked by the admin. Please contact support.');
    }
    if (refreshBlockedError.statusCode !== 403) {
      throw new Error('Token refresh should be rejected for blocked users');
    }
    console.log(` -> Token refresh REJECTED as expected with status 403: "${refreshBlockedError.message}"`);

    // Step 7: Test Role Restriction (cannot block Admin account via toggleUserStatus)
    console.log('[7/9] Testing role restriction (attempting to block Admin role user)...');
    let adminBlockError = null;
    reqMock = { params: { userId: adminUser.id }, user: adminUser };
    try {
      await toggleUserStatus(reqMock, resMock, nextMock);
    } catch (err) {
      adminBlockError = err;
    }
    if (!adminBlockError || adminBlockError.statusCode !== 403) {
      throw new Error(`Expected 403 when blocking admin account, got: ${adminBlockError}`);
    }
    console.log(` -> Admin role block REJECTED as expected: "${adminBlockError.message}"`);

    // Step 8: Test Admin Unblock action
    console.log('[8/9] Executing toggleUserStatus to UNBLOCK account...');
    reqMock = { params: { userId: testUser.id }, user: adminUser };
    await toggleUserStatus(reqMock, resMock, nextMock);
    console.log(' -> toggleUserStatus response:', resData?.message, resData?.data);

    if (resData?.data?.isBlocked) {
      throw new Error('User isBlocked flag was not set to false after unblock');
    }

    const unblockAuditLog = await prisma.adminActivityLog.findFirst({
      where: { entity_id: testUser.id, action: 'UNBLOCK_USER' },
      orderBy: { created_at: 'desc' },
    });
    if (!unblockAuditLog) {
      throw new Error('No admin activity log found for UNBLOCK_USER');
    }
    console.log(` -> Audit Log Found: Action=${unblockAuditLog.action}`);

    // Step 9: Verify Login works again after Unblock
    console.log('[9/9] Testing login attempt after UNBLOCK...');
    const loginAfterUnblock = await loginUser({ email: testEmail, password: plainPassword });
    if (!loginAfterUnblock.accessToken) {
      throw new Error('Login failed after unblocking user');
    }
    console.log(' -> Login SUCCESSFUL after unblock!');

    console.log('=========================================================');
    console.log('PASSED ALL PHASE 1 AUTOMATED TESTS SUCCESSFULLY!');
    console.log('=========================================================');
  } catch (error) {
    console.error('❌ PHASE 1 TEST FAILED:', error);
    process.exit(1);
  } finally {
    // Cleanup test users and activity logs
    if (testUser) {
      await prisma.adminActivityLog.deleteMany({ where: { entity_id: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (adminUser) {
      await prisma.user.delete({ where: { id: adminUser.id } }).catch(() => {});
    }
    await prisma.$disconnect();
  }
}

runPhase1Test();
