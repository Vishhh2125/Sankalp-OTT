/**
 * Admin Seeding Script
 * Creates the first admin user if it doesn't exist
 * Usage: node scripts/seed-admin.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'Admin';

    if (!adminEmail || !adminPassword) {
      logger.error('Please set ADMIN_EMAIL and ADMIN_PASSWORD in .env file');
      process.exit(1);
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (existingAdmin) {
      logger.info('Admin user already exists', { email: adminEmail });
      process.exit(0);
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    // Create admin user
    const admin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: passwordHash,
        role: 'ADMIN',
        plan: null,
        coins: 0,
        isBlocked: false
      }
    });

    logger.info('✓ Admin user created successfully', { 
      id: admin.id, 
      email: admin.email,
      name: admin.name
    });

    console.log('\n✓ Admin setup complete!');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Name: ${admin.name}`);
    console.log(`  Role: ${admin.role}`);
    console.log('\nYou can now login with these credentials at /api/v1/auth/login\n');

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin', { error: error.message });
    console.error('Failed to seed admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
