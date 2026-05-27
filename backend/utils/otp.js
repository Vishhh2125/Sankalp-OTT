import bcrypt from 'bcrypt';
import crypto from 'crypto';
import Redis from 'ioredis';
import config from '../config/index.js';
import { ApiError } from './ApiError.js';
import logger from '../config/logger.js';

let redis = null;

/**
 * Get or initialize Redis client for rate limiting
 */
const getRedis = () => {
  if (!redis) {
    try {
      redis = new Redis(config.redisUrl);
      logger.info('✓ Redis initialized for OTP rate limiting');
    } catch (error) {
      logger.error('Failed to initialize Redis for OTP', { error: error.message });
      // Don't crash - rate limiting will be lenient
    }
  }
  return redis;
};

/**
 * Generate 6-digit OTP
 * @returns {string} - 6-digit numeric string (e.g., "123456")
 */
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Hash OTP using bcrypt (same as password hashing)
 * @param {string} otp - Plain OTP code
 * @returns {Promise<string>} - Hashed OTP
 */
export const hashOTP = async (otp) => {
  try {
    const salt = await bcrypt.genSalt(12);
    return await bcrypt.hash(otp, salt);
  } catch (error) {
    logger.error('Error hashing OTP', { error: error.message });
    throw new ApiError(500, 'Failed to hash OTP');
  }
};

/**
 * Compare OTP with hash
 * @param {string} plainOTP - Plain OTP from user
 * @param {string} hashedOTP - Hashed OTP from DB
 * @returns {Promise<boolean>}
 */
export const compareOTP = async (plainOTP, hashedOTP) => {
  try {
    return await bcrypt.compare(plainOTP, hashedOTP);
  } catch (error) {
    logger.error('Error comparing OTP', { error: error.message });
    throw new ApiError(500, 'Failed to verify OTP');
  }
};

/**
 * Check and enforce rate limiting for resend OTP
 * Rules:
 * - Max 1 resend per minute
 * - Max 5 resends per hour
 * @param {string} email - User email (key for rate limiting)
 * @returns {Promise<Object>} - { allowed: boolean, nextResendAt: Date?, remainingResends: number? }
 */
export const checkResendRateLimit = async (email) => {
  const redisClient = getRedis();
  
  if (!redisClient) {
    logger.warn('Redis unavailable for rate limiting - allowing resend (lenient fallback)');
    return { allowed: true, remainingResends: Infinity };
  }

  try {
    const oneMinuteKey = `otp:resend:1min:${email}`;
    const oneHourKey = `otp:resend:1hour:${email}`;
    
    // Check 1-minute limit
    const lastResendTime = await redisClient.get(oneMinuteKey);
    if (lastResendTime) {
      const secondsLeft = await redisClient.ttl(oneMinuteKey);
      logger.warn('OTP resend rate limit (1 minute)', { email, secondsLeft });
      return {
        allowed: false,
        nextResendAt: new Date(Date.now() + secondsLeft * 1000),
        error: `Please wait ${secondsLeft} seconds before requesting a new OTP`
      };
    }
    
    // Check 1-hour limit (max 5 resends)
    const resendCount = await redisClient.incr(oneHourKey);
    if (resendCount === 1) {
      // First resend in this hour - set TTL
      await redisClient.expire(oneHourKey, 3600);
    }
    
    if (resendCount > 5) {
      logger.warn('OTP resend hourly limit exceeded', { email, count: resendCount });
      return {
        allowed: false,
        error: `Too many resend attempts. Please try again after 1 hour.`,
        nextResendAt: new Date(Date.now() + 3600 * 1000)
      };
    }
    
    // Set 1-minute cooldown
    await redisClient.setex(oneMinuteKey, 60, Date.now().toString());
    
    return {
      allowed: true,
      remainingResends: 5 - resendCount,
      nextResendAt: new Date(Date.now() + 60 * 1000)
    };
  } catch (error) {
    logger.error('Rate limiting check failed (allowing resend as fallback)', { email, error: error.message });
    return { allowed: true, remainingResends: 5 };
  }
};

/**
 * Clear resend rate limit (called after successful OTP verification)
 * @param {string} email
 */
export const clearResendRateLimit = async (email) => {
  const redisClient = getRedis();
  if (!redisClient) return;
  
  try {
    await redisClient.del(`otp:resend:1min:${email}`);
    await redisClient.del(`otp:resend:1hour:${email}`);
    logger.debug('OTP rate limits cleared', { email });
  } catch (error) {
    logger.error('Failed to clear rate limits', { email, error: error.message });
  }
};

export default {
  generateOTP,
  hashOTP,
  compareOTP,
  checkResendRateLimit,
  clearResendRateLimit
};
