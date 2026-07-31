import nodemailer from 'nodemailer';
import config from './index.js';
import logger from './logger.js';

let transporter = null;

/**
 * Initialize Nodemailer transporter
 * Supports SMTP (Gmail, SendGrid, etc.) or Ethereal (testing)
 */
const initializeTransporter = async () => {
  try {
    const smtpService = String(process.env.SMTP_SERVICE || '').toLowerCase().trim();

    // Gmail App Password flow
    if (smtpService === 'gmail') {
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP_USER or SMTP_PASS missing in environment variables');
      }

      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    // Development: Use Ethereal for testing (fake SMTP)
    else if (config.nodeEnv === 'development' && !process.env.SMTP_HOST) {
      logger.warn('⚠️ No SMTP configured — creating Ethereal test account for development');
      // Create a test account and transporter for development
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        }
      });
      logger.info('Ethereal test account created', { user: testAccount.user });
    } else {
      // Production: Use configured SMTP
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        throw new Error('SMTP configuration missing in environment variables');
      }

      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    await transporter.verify();
    logger.info('✓ Email transporter initialized');
    return transporter;
  } catch (error) {
    logger.error('Failed to initialize email transporter', { error: error.message });
    throw error;
  }
};

/**
 * Get or create transporter (lazy initialization)
 */
const getTransporter = async () => {
  if (!transporter) {
    transporter = await initializeTransporter();
  }
  return transporter;
};

/**
 * Send OTP email
 * @param {string} email - User email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<void>}
 */
export const sendOtpEmail = async (email, otp) => {
  try {
    const transporter = await getTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || 'vishnu1234@gmail.com',
      to: email,
      subject: 'ALpha Minds - Verify Your Email Address',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Verify Your Email</h2>
            
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Welcome to ALpha Minds! To complete your registration, please verify your email address using the code below.
            </p>
            
            <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px;">
                ${otp}
              </div>
              <p style="margin-top: 10px; font-size: 14px;">This code expires in 10 minutes</p>
            </div>
            
            <p style="color: #999; font-size: 12px;">
              If you didn't request this code, please ignore this email. Your account will not be created unless you verify this code.
            </p>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <footer style="text-align: center; color: #999; font-size: 12px;">
              <p>© 2026 ALpha Minds. All rights reserved.</p>
            </footer>
          </div>
        </div>
      `,
      text: `Your ALpha Minds verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('✓ OTP email sent', { email, messageId: result.messageId, previewUrl: nodemailer.getTestMessageUrl(result) });
    return result;
  } catch (error) {
    logger.error('Failed to send OTP email', { email, error: error.message });
    // Don't throw - let registration continue (user can retry resend)
    // This prevents email service outages from blocking registrations
    throw error; // Actually throw for now, but log it
  }
};

/**
 * Send teacher login credentials email
 * @param {string} email - Teacher email
 * @param {string} name - Teacher name
 * @param {string} temporaryPassword - Temporary login password
 * @returns {Promise<void>}
 */
export const sendTeacherCredentialsEmail = async (email, name, temporaryPassword) => {
  try {
    const transporter = await getTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || 'vishnu1234@gmail.com',
      to: email,
      subject: 'ALpha Minds - Teacher Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Your Teacher Account Is Ready</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hello ${name || 'Teacher'}, your ALpha Minds teacher account has been created.
            </p>

            <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0 0 8px; font-size: 14px;">Login email</p>
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">${email}</div>
              <p style="margin: 0 0 8px; font-size: 14px;">Temporary password</p>
              <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">${temporaryPassword}</div>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Please sign in using these credentials and change your password after your first login if your account flow supports it.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

            <footer style="text-align: center; color: #999; font-size: 12px;">
              <p>© 2026 ALpha Minds. All rights reserved.</p>
            </footer>
          </div>
        </div>
      `,
      text: `Hello ${name || 'Teacher'},\n\nYour ALpha Minds- teacher account has been created.\n\nLogin email: ${email}\nTemporary password: ${temporaryPassword}\n\nPlease sign in and change your password after the first login if supported.`
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('✓ Teacher credentials email sent', { email, messageId: result.messageId });
    return result;
  } catch (error) {
    logger.error('Failed to send teacher credentials email', { email, error: error.message });
    throw error;
  }
};

/**
 * Send student login credentials email (Student Onboarding)
 * @param {string} email - Student email
 * @param {string} name - Student name
 * @param {string} temporaryPassword - Account password
 * @returns {Promise<void>}
 */
export const sendStudentCredentialsEmail = async (email, name, temporaryPassword) => {
  try {
    const transporter = await getTransporter();

    const mailOptions = {
      from: process.env.SMTP_FROM || 'vishnu1234@gmail.com',
      to: email,
      subject: 'Welcome to Sankalp - Student Account Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; text-align: center;">Welcome to Sankalp</h2>

            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              Hello ${name || 'Student'}, your student account has been created by your institute administrator.
            </p>

            <div style="background-color: #007bff; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
              <p style="margin: 0 0 8px; font-size: 14px;">Login Email</p>
              <div style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">${email}</div>
              <p style="margin: 0 0 8px; font-size: 14px;">Password</p>
              <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">${temporaryPassword}</div>
            </div>

            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              Log into the app using these credentials to access your assigned courses immediately.
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">

            <footer style="text-align: center; color: #999; font-size: 12px;">
              <p>© 2026 Sankalp. All rights reserved.</p>
            </footer>
          </div>
        </div>
      `,
      text: `Hello ${name || 'Student'},\n\nYour student account has been created.\n\nLogin email: ${email}\nPassword: ${temporaryPassword}\n\nPlease sign in to access your assigned courses.`
    };

    const result = await transporter.sendMail(mailOptions);
    logger.info('✓ Student credentials email sent', { email, messageId: result.messageId });
    return result;
  } catch (error) {
    logger.error('Failed to send student credentials email', { email, error: error.message });
    throw error;
  }
};

/**
 * Verify transporter connection (optional health check)
 */
export const verifyTransporter = async () => {
  try {
    const transporter = await getTransporter();
    await transporter.verify();
    logger.info('✓ Email transporter verified');
    return true;
  } catch (error) {
    logger.error('Email transporter verification failed', { error: error.message });
    return false;
  }
};

export default {
  sendOtpEmail,
  sendTeacherCredentialsEmail,
  sendStudentCredentialsEmail,
  getTransporter,
  verifyTransporter
};
