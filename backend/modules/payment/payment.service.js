import { prisma } from '../../prisma/client.js';
import {
  activeMembershipWhere,
  formatMembershipResponse,
  isLifetimePlan,
  membershipPlanInclude,
} from '../membership/membership.helpers.js';
import {
  addPlanDuration,
} from '../membership/membership-purchase.service.js';
import logger from '../../config/logger.js';
import { ApiError } from '../../utils/ApiError.js';
import {
  createCashfreeOrder,
  fetchCashfreeOrder,
  fetchCashfreeOrderPayments,
  generateCashfreeOrderId,
  mapCashfreeOrderStatus,
  extractPaymentDetailsFromOrder,
  getPaymentMethodString,
} from './cashfree.service.js';
import { getCashfreeCheckoutMode } from '../../config/cashfree.js';
import {
  generatePaystackReference,
  initializePaystackTransaction,
  mapPaystackTransactionStatus,
  extractPaystackPaymentDetails,
  verifyPaystackTransaction,
} from './paystack.service.js';
import { paystackConfig } from '../../config/paystack.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const SUPPORTED_GATEWAYS = new Set(['cashfree', 'paystack']);

function normalizeGateway(gateway) {
  const key = String(gateway || 'cashfree').toLowerCase();
  return SUPPORTED_GATEWAYS.has(key) ? key : 'cashfree';
}

function lifetimeScopeCovers(membership, targetCategoryId) {
  const scopeCategoryId = membership.plan.category_id;
  if (scopeCategoryId === null) return true;
  return scopeCategoryId === targetCategoryId;
}

function coverageBlockMessage(membership) {
  const scopeCategoryId = membership.plan.category_id;
  if (scopeCategoryId === null) {
    return 'You already have lifetime access to All Categories';
  }
  const categoryName = membership.plan.category?.name || 'this category';
  return `You already have lifetime access to ${categoryName}`;
}

async function fetchActiveMembershipsForUser(userId, now) {
  return prisma.userMembership.findMany({
    where: {
      user_id: userId,
      ...activeMembershipWhere(now),
    },
    include: membershipPlanInclude,
  });
}

function makeCustomer(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
  };
}

async function createCashfreeCheckout({
  payment,
  amount,
  currency,
  customer,
  orderNote,
  orderTags,
  prefix,
}) {
  const cashfreeOrderId = generateCashfreeOrderId(prefix);
  const cfOrder = await createCashfreeOrder({
    orderId: cashfreeOrderId,
    amount,
    currency,
    customer,
    orderNote,
    orderTags,
    idempotencyKey: payment.id,
  });

  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      cashfree_order_id: cfOrder.orderId || cashfreeOrderId,
      gateway_ref: cfOrder.orderId || cashfreeOrderId,
    },
  });

  return {
    ok: true,
    data: {
      payment_id: payment.id,
      order_id: cfOrder.orderId || cashfreeOrderId,
      payment_session_id: cfOrder.paymentSessionId,
      order_amount: amount,
      order_currency: currency,
      cashfree_mode: getCashfreeCheckoutMode(),
      gateway: 'cashfree',
    },
  };
}

async function createPaystackCheckout({
  payment,
  amount,
  customer,
  orderNote,
  orderTags,
  prefix,
}) {
  const reference = generatePaystackReference(prefix);

  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      gateway: 'paystack',
      gateway_ref: reference,
    },
  });

  const checkout = await initializePaystackTransaction({
    reference,
    amount,
    currency: paystackConfig.currency,
    email: customer.email,
    callbackUrl: paystackConfig.callbackUrl,
    metadata: {
      ...orderTags,
      payment_id: payment.id,
      customer_id: customer.id,
      note: orderNote,
    },
  });

  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      gateway_ref: checkout.reference || reference,
    },
  });

  return {
    ok: true,
    data: {
      payment_id: payment.id,
      order_id: checkout.reference || reference,
      authorization_url: checkout.authorizationUrl,
      access_code: checkout.accessCode,
      paystack_public_key: paystackConfig.publicKey,
      callback_url: paystackConfig.callbackUrl,
      order_amount: amount,
      order_currency: paystackConfig.currency,
      customer_email: customer.email,
      gateway: 'paystack',
    },
  };
}

/**
 * Validate membership purchase eligibility (same rules as simulate flow).
 */
export async function validateMembershipPurchase(userId, planId) {
  const plan = await prisma.membershipPlan.findFirst({
    where: { id: planId, is_active: true },
    include: { category: { select: { name: true } } },
  });

  if (!plan) {
    return { ok: false, status: 400, message: 'Invalid or inactive membership plan' };
  }

  const now = new Date();
  const activeMemberships = await fetchActiveMembershipsForUser(userId, now);
  const blockingLifetime = activeMemberships.find(
    (m) => isLifetimePlan(m.plan) && lifetimeScopeCovers(m, plan.category_id)
  );

  if (blockingLifetime) {
    return {
      ok: false,
      status: 409,
      message: coverageBlockMessage(blockingLifetime),
    };
  }

  return { ok: true, plan };
}

/**
 * Activate membership after verified payment (idempotent if payment already completed).
 */
export async function fulfillMembershipPayment(paymentRecord) {
  const existingMembership = await prisma.userMembership.findFirst({
    where: { payment_id: paymentRecord.id },
  });

  if (existingMembership) {
    return getMembershipFulfillmentResult(paymentRecord.user_id);
  }

  const plan = await prisma.membershipPlan.findFirst({
    where: { id: paymentRecord.plan_id, is_active: true },
    include: { category: { select: { name: true } } },
  });

  if (!plan) {
    throw new ApiError(400, 'Membership plan no longer available');
  }

  const userId = paymentRecord.user_id;
  const now = new Date();
  const purchaseScopeCategoryId = plan.category_id;
  const purchaseIsLifetime = isLifetimePlan(plan);
  const startDate = now;
  const endDate = purchaseIsLifetime ? null : addPlanDuration(now, plan.duration);

  await prisma.$transaction(async (tx) => {
    const lockedPayment = await tx.paymentTransaction.findUnique({
      where: { id: paymentRecord.id },
    });

    if (!lockedPayment) {
      throw new ApiError(404, 'Payment record not found');
    }

    const existingMembershipInTx = await tx.userMembership.findFirst({
      where: { payment_id: lockedPayment.id },
    });

    if (existingMembershipInTx) {
      return;
    }

    const expireWhere = {
      user_id: userId,
      ...activeMembershipWhere(now),
    };

    if (purchaseScopeCategoryId === null && purchaseIsLifetime) {
      await tx.userMembership.updateMany({
        where: expireWhere,
        data: { status: 'EXPIRED' },
      });
    } else if (purchaseScopeCategoryId === null) {
      await tx.userMembership.updateMany({
        where: {
          ...expireWhere,
          end_date: { not: null },
        },
        data: { status: 'EXPIRED' },
      });
    } else {
      await tx.userMembership.updateMany({
        where: {
          ...expireWhere,
          plan: { category_id: purchaseScopeCategoryId },
        },
        data: { status: 'EXPIRED' },
      });
    }

    await tx.userMembership.create({
      data: {
        user_id: userId,
        plan_id: plan.id,
        payment_id: lockedPayment.id,
        start_date: startDate,
        end_date: endDate,
        status: 'ACTIVE',
      },
    });

    const remainingActive = await tx.userMembership.findMany({
      where: {
        user_id: userId,
        ...activeMembershipWhere(now),
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { plan: remainingActive.length > 0 ? 'MEMBER' : 'FREE' },
    });

    await tx.paymentTransaction.update({
      where: { id: lockedPayment.id },
      data: { status: 'completed' },
    });
  });

  return getMembershipFulfillmentResult(userId);
}

/**
 * Credit wallet coins after verified payment (idempotent).
 */
export async function fulfillWalletPayment(paymentRecord) {
  const existingCredit = await prisma.coinTransaction.findFirst({
    where: { payment_id: paymentRecord.id },
  });

  if (existingCredit) {
    const user = await prisma.user.findUnique({
      where: { id: paymentRecord.user_id },
      select: { coins: true },
    });
    return {
      coins: user?.coins ?? 0,
      alreadyFulfilled: true,
    };
  }

  const topupPlan = await prisma.topUpPlan.findUnique({
    where: { id: paymentRecord.topup_plan_id },
  });

  if (!topupPlan || !topupPlan.is_active) {
    throw new ApiError(400, 'Top-up plan no longer available');
  }

  const result = await prisma.$transaction(async (tx) => {
    const lockedPayment = await tx.paymentTransaction.findUnique({
      where: { id: paymentRecord.id },
    });

    if (!lockedPayment) {
      throw new ApiError(404, 'Payment record not found');
    }

    const existingCreditInTx = await tx.coinTransaction.findFirst({
      where: { payment_id: lockedPayment.id },
    });

    if (existingCreditInTx) {
      const user = await tx.user.findUnique({
        where: { id: lockedPayment.user_id },
        select: { coins: true },
      });
      return { coins: user?.coins ?? 0, alreadyFulfilled: true };
    }

    const user = await tx.user.findUnique({
      where: { id: lockedPayment.user_id },
      select: { id: true, coins: true },
    });

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const coinsToAdd = lockedPayment.wallet_coins ?? topupPlan.coins_amount;
    const nextCoins = (user.coins ?? 0) + coinsToAdd;

    await tx.user.update({
      where: { id: user.id },
      data: { coins: nextCoins },
    });

    await tx.coinTransaction.create({
      data: {
        user_id: user.id,
        type: 'credit',
        amount: coinsToAdd,
        reason: 'wallet_topup',
        ref_id: topupPlan.id,
        payment_id: lockedPayment.id,
        title: 'Coin top-up',
        description: `${topupPlan.name} - ₹${parseFloat(topupPlan.price).toFixed(2)} → ${coinsToAdd} coins`,
        fiat_paise: Math.round(parseFloat(topupPlan.price) * 100),
        status: 'completed',
      },
    });

    await tx.paymentTransaction.update({
      where: { id: lockedPayment.id },
      data: { status: 'completed' },
    });

    return { coins: nextCoins, transaction_id: lockedPayment.id };
  });

  return result;
}

async function getMembershipFulfillmentResult(userId) {
  const now = new Date();
  const remainingActive = await prisma.userMembership.findMany({
    where: {
      user_id: userId,
      ...activeMembershipWhere(now),
    },
    include: membershipPlanInclude,
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { coins: true, plan: true },
  });

  const memberships = remainingActive.map(formatMembershipResponse);
  const hasAllAccess = remainingActive.some((m) => m.plan.category_id === null);

  return {
    plan: user?.plan ?? 'FREE',
    coins: user?.coins ?? 0,
    memberships,
    has_all_access: hasAllAccess,
  };
}

function formatPaymentHistoryRow(p) {
  return {
    id: p.id,
    order_type: p.type === 'membership' ? 'SUBSCRIPTION' : 'WALLET',
    gateway: p.gateway,
    gateway_ref: p.gateway_ref,
    plan_id: p.plan_id,
    topup_plan_id: p.topup_plan_id,
    wallet_coins: p.wallet_coins,
    cashfree_order_id: p.cashfree_order_id,
    cashfree_payment_id: p.cashfree_payment_id,
    payment_status: p.status,
    payment_method: p.payment_method,
    amount: parseFloat(p.amount),
    currency: p.currency,
    created_at: p.created_at,
  };
}

export async function createSubscriptionOrder(user) {
  const planId = user.planId;
  const gateway = normalizeGateway(user.gateway);
  const validation = await validateMembershipPurchase(user.id, planId);
  if (!validation.ok) {
    return validation;
  }

  const plan = validation.plan;

  const payment = await prisma.paymentTransaction.create({
    data: {
      user_id: user.id,
      type: 'membership',
      amount: plan.price,
      currency: gateway === 'paystack' ? paystackConfig.currency : plan.currency,
      gateway,
      status: 'pending',
      plan_id: plan.id,
    },
  });

  try {
    if (gateway === 'paystack') {
      return await createPaystackCheckout({
        payment,
        amount: parseFloat(plan.price),
        customer: makeCustomer(user),
        orderNote: `Membership: ${plan.name}`,
        orderTags: {
          order_type: 'SUBSCRIPTION',
          plan_id: plan.id,
        },
        prefix: 'sub',
      });
    }

    const result = await createCashfreeCheckout({
      payment,
      amount: parseFloat(plan.price),
      currency: plan.currency,
      customer: makeCustomer(user),
      orderNote: `Membership: ${plan.name}`,
      orderTags: {
        order_type: 'SUBSCRIPTION',
        plan_id: plan.id,
        payment_id: payment.id,
        user_id: user.id,
      },
      prefix: 'sub',
    });

    return {
      ...result,
      data: {
        ...result.data,
        plan: {
          id: plan.id,
          name: plan.name,
          price: parseFloat(plan.price),
          currency: plan.currency,
        },
      },
    };
  } catch (err) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
    throw err;
  }
}

export async function createWalletOrder(user) {
  const planId = user.packId;
  const gateway = normalizeGateway(user.gateway);

  const topupPlan = await prisma.topUpPlan.findUnique({
    where: { id: planId },
  });

  if (!topupPlan || !topupPlan.is_active) {
    return { ok: false, status: 400, message: 'Top-up plan not found or inactive' };
  }

  const payment = await prisma.paymentTransaction.create({
    data: {
      user_id: user.id,
      type: 'topup',
      amount: topupPlan.price,
      currency: gateway === 'paystack' ? paystackConfig.currency : topupPlan.currency,
      gateway,
      status: 'pending',
      topup_plan_id: topupPlan.id,
      wallet_coins: topupPlan.coins_amount,
    },
  });

  try {
    if (gateway === 'paystack') {
      return await createPaystackCheckout({
        payment,
        amount: parseFloat(topupPlan.price),
        customer: makeCustomer(user),
        orderNote: `Wallet top-up: ${topupPlan.name}`,
        orderTags: {
          order_type: 'WALLET',
          topup_plan_id: topupPlan.id,
        },
        prefix: 'wal',
      });
    }

    const result = await createCashfreeCheckout({
      payment,
      amount: parseFloat(topupPlan.price),
      currency: topupPlan.currency,
      customer: makeCustomer(user),
      orderNote: `Wallet top-up: ${topupPlan.name}`,
      orderTags: {
        order_type: 'WALLET',
        topup_plan_id: topupPlan.id,
        payment_id: payment.id,
        user_id: user.id,
      },
      prefix: 'wal',
    });

    return {
      ...result,
      data: {
        ...result.data,
        pack: {
          pack_id: topupPlan.id,
          name: topupPlan.name,
          coins: topupPlan.coins_amount,
          price: parseFloat(topupPlan.price),
          currency: topupPlan.currency,
        },
      },
    };
  } catch (err) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { status: 'failed' },
    });
    throw err;
  }
}

/**
 * Verify order with Cashfree and fulfill if paid (backend-only activation).
 */
export async function verifyAndFulfillOrder(userId, orderId) {
  const payment = await prisma.paymentTransaction.findFirst({
    where: {
      user_id: userId,
      OR: [{ cashfree_order_id: orderId }, { gateway_ref: orderId }],
    },
  });

  if (!payment) {
    return { ok: false, status: 404, message: 'Payment order not found' };
  }

  if (TERMINAL_STATUSES.has(payment.status)) {
    return buildVerificationResponse(payment, userId);
  }

  let orderData;
  let mappedStatus = payment.status;
  let paymentDetails = {
    orderStatus: payment.status,
    paymentId: payment.gateway_ref || payment.cashfree_payment_id || null,
    paymentMethod: payment.payment_method || null,
    paymentStatus: payment.status,
  };

  if (payment.gateway === 'paystack') {
    try {
      orderData = await verifyPaystackTransaction(orderId);
    } catch (err) {
      logger.error('Paystack order verification failed', { orderId, error: err.message });
      return { ok: false, status: 502, message: 'Unable to verify payment with gateway' };
    }

    const transaction = orderData?.data || {};
    mappedStatus = mapPaystackTransactionStatus(transaction?.status);
    paymentDetails = extractPaystackPaymentDetails(transaction);
  } else {
    try {
      orderData = await fetchCashfreeOrder(orderId);
    } catch (err) {
      logger.error('Cashfree order verification failed', { orderId, error: err.message });
      return { ok: false, status: 502, message: 'Unable to verify payment with gateway' };
    }

    mappedStatus = mapCashfreeOrderStatus(orderData?.order_status);
    paymentDetails = extractPaymentDetailsFromOrder(orderData);

    if (!paymentDetails.paymentId && mappedStatus === 'completed') {
      try {
        const paymentsData = await fetchCashfreeOrderPayments(orderId);
        const list = paymentsData || [];
        const latest = Array.isArray(list) ? list[0] : null;
        paymentDetails = {
          orderStatus: orderData?.order_status,
          paymentId: latest?.cf_payment_id || null,
          paymentMethod: latest ? getPaymentMethodString(latest.payment_method, latest.payment_group) : null,
          paymentStatus: latest?.payment_status || null,
        };
      } catch {
        // non-fatal
      }
    }
  }

  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: mappedStatus,
      cashfree_payment_id:
        payment.gateway === 'cashfree'
          ? paymentDetails.paymentId || payment.cashfree_payment_id
          : payment.cashfree_payment_id,
      payment_method: paymentDetails.paymentMethod || payment.payment_method,
      webhook_payload: JSON.stringify(orderData),
    },
  });

  const refreshed = await prisma.paymentTransaction.findUnique({
    where: { id: payment.id },
  });

  if (mappedStatus === 'completed') {
    if (refreshed.type === 'membership') {
      const fulfillment = await fulfillMembershipPayment(refreshed);
      return {
        ok: true,
        data: {
          order_type: 'SUBSCRIPTION',
          payment_status: 'completed',
          ...fulfillment,
        },
      };
    }

    if (refreshed.type === 'topup') {
      const fulfillment = await fulfillWalletPayment(refreshed);
      return {
        ok: true,
        data: {
          order_type: 'WALLET',
          payment_status: 'completed',
          coins: fulfillment.coins,
        },
      };
    }
  }

  return buildVerificationResponse(refreshed, userId);
}

async function buildVerificationResponse(payment, userId) {
  const base = {
    order_type: payment.type === 'membership' ? 'SUBSCRIPTION' : 'WALLET',
    payment_status: payment.status,
    order_id: payment.gateway_ref || payment.cashfree_order_id,
    payment_id: payment.id,
  };

  if (payment.status === 'completed') {
    if (payment.type === 'membership') {
      const fulfillment = await getMembershipFulfillmentResult(userId);
      return { ok: true, data: { ...base, ...fulfillment } };
    }
    if (payment.type === 'topup') {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { coins: true },
      });
      return { ok: true, data: { ...base, coins: user?.coins ?? 0 } };
    }
    return { ok: true, data: base };
  }

  const statusMessages = {
    pending: 'Payment is pending. Please complete payment or wait for confirmation.',
    failed: 'Payment failed. Please try again.',
    cancelled: 'Payment was cancelled.',
  };

  return {
    ok: false,
    status: 402,
    message: statusMessages[payment.status] || 'Payment not completed',
    data: base,
  };
}

/**
 * Process Cashfree webhook event (idempotent).
 */
export async function processCashfreeWebhook(webhookMeta) {
  const { payload, rawBody, eventId } = webhookMeta;
  const dedupeId = eventId || `${payload?.type}:${payload?.data?.payment?.cf_payment_id || ''}`;

  const existingByEvent = dedupeId
    ? await prisma.paymentTransaction.findFirst({
        where: { webhook_event_id: dedupeId },
      })
    : null;

  if (existingByEvent?.status === 'completed') {
    return { ok: true, duplicate: true, message: 'Already processed' };
  }

  const paymentData = payload?.data?.payment || payload?.data?.order || payload?.data || {};
  const orderId =
    paymentData?.order_id ||
    paymentData?.order?.order_id ||
    payload?.data?.order?.order_id;

  if (!orderId) {
    logger.warn('Cashfree webhook missing order_id', { payload });
    return { ok: false, status: 400, message: 'Missing order_id in webhook' };
  }

  const payment = await prisma.paymentTransaction.findFirst({
    where: { cashfree_order_id: orderId },
  });

  if (!payment) {
    logger.warn('Cashfree webhook for unknown order', { orderId });
    return { ok: false, status: 404, message: 'Payment order not found' };
  }

  if (payment.status === 'completed') {
    if (dedupeId && !payment.webhook_event_id) {
      await prisma.paymentTransaction.update({
        where: { id: payment.id },
        data: { webhook_event_id: dedupeId },
      });
    }
    return { ok: true, duplicate: true, message: 'Already fulfilled' };
  }

  const eventType = String(payload?.type || payload?.event || '').toUpperCase();
  const paymentStatus = String(
    paymentData?.payment_status || paymentData?.order?.order_status || ''
  ).toUpperCase();

  let mappedStatus = 'pending';
  if (
    eventType.includes('SUCCESS') ||
    paymentStatus === 'SUCCESS' ||
    paymentStatus === 'PAID'
  ) {
    mappedStatus = 'completed';
  } else if (
    eventType.includes('FAILED') ||
    paymentStatus === 'FAILED'
  ) {
    mappedStatus = 'failed';
  } else if (
    eventType.includes('USER_DROPPED') ||
    eventType.includes('CANCEL')
  ) {
    mappedStatus = 'cancelled';
  }

  let method = payment.payment_method;
  const pm = paymentData?.payment_method;
  const pg = paymentData?.payment_group;
  if (typeof pm === 'string') {
    method = pm;
  } else if (pm && typeof pm === 'object') {
    method = Object.keys(pm)[0];
  } else if (typeof pg === 'string') {
    method = pg;
  }

  try {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: mappedStatus === 'pending' ? payment.status : mappedStatus,
        cashfree_payment_id:
          paymentData?.cf_payment_id ||
          paymentData?.payment_id ||
          payment.cashfree_payment_id,
        payment_method: method,
        webhook_event_id: dedupeId || payment.webhook_event_id,
        webhook_payload: rawBody,
      },
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return { ok: true, duplicate: true, message: 'Duplicate webhook event' };
    }
    throw err;
  }

  const refreshed = await prisma.paymentTransaction.findUnique({
    where: { id: payment.id },
  });

  if (mappedStatus !== 'completed') {
    return { ok: true, message: `Payment status updated: ${mappedStatus}` };
  }

  if (refreshed.type === 'membership') {
    await fulfillMembershipPayment(refreshed);
  } else if (refreshed.type === 'topup') {
    await fulfillWalletPayment(refreshed);
  }

  return { ok: true, message: 'Payment verified and fulfilled' };
}

export async function getPaymentHistory(userId, { limit = 50, offset = 0 } = {}) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);

  const [items, total] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take,
      skip,
    }),
    prisma.paymentTransaction.count({ where: { user_id: userId } }),
  ]);

  return {
    items: items.map(formatPaymentHistoryRow),
    total,
    limit: take,
    offset: skip,
  };
}

export async function getCurrentSubscription(userId) {
  const now = new Date();
  const memberships = await prisma.userMembership.findMany({
    where: {
      user_id: userId,
      ...activeMembershipWhere(now),
    },
    include: membershipPlanInclude,
    orderBy: [{ end_date: 'asc' }, { created_at: 'desc' }],
  });

  const formatted = memberships.map(formatMembershipResponse);
  const hasAllAccess = memberships.some((m) => m.plan.category_id === null);

  return {
    plan: memberships.length > 0 ? 'MEMBER' : 'FREE',
    memberships: formatted,
    has_all_access: hasAllAccess,
  };
}

export async function getWalletHistory(userId, { limit = 50, offset = 0 } = {}) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);

  const [items, total] = await Promise.all([
    prisma.coinTransaction.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take,
      skip,
      select: {
        id: true,
        type: true,
        amount: true,
        reason: true,
        ref_id: true,
        title: true,
        description: true,
        fiat_paise: true,
        payment_id: true,
        status: true,
        created_at: true,
      },
    }),
    prisma.coinTransaction.count({ where: { user_id: userId } }),
  ]);

  return { items, total, limit: take, offset: skip };
}
