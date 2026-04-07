/**
 * Database Seeding Script
 * Seeds admin user, categories, tags, settings, membership plans, and CMS pages
 * Usage: node prisma/seed.js
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import config from '../config/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Seeding database...\n');

    // ── 1. Admin User ────────────────────────────────────────────────────────
    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@ott.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminName     = process.env.ADMIN_NAME     || 'Super Admin';

    const hashedPassword = await bcrypt.hash(adminPassword, config.bcryptRounds);

    const admin = await prisma.user.upsert({
      where:  { email: adminEmail },
      update: {},
      create: {
        email:     adminEmail,
        password:  hashedPassword,
        name:      adminName,
        role:      'ADMIN',
        plan:      null,
        coins:     0,
        isBlocked: false,
      },
    });

    logger.info('✓ Admin user ready', { id: admin.id, email: admin.email });
    console.log(`Admin user: ${adminEmail} (id: ${admin.id})`);

    // ── 2. Categories ────────────────────────────────────────────────────────
    const categoryNames = ['Popular', 'New', 'Rankings', 'Anime', 'VIP'];
    for (let i = 0; i < categoryNames.length; i++) {
      await prisma.category.upsert({
        where:  { id: (await prisma.category.findFirst({ where: { name: categoryNames[i] } }))?.id ?? '00000000-0000-0000-0000-000000000000' },
        update: {},
        create: {
          name:          categoryNames[i],
          display_order: i + 1,
          is_active:     true,
          created_by:    admin.id,
        },
      }).catch(() =>
        prisma.category.create({
          data: {
            name:          categoryNames[i],
            display_order: i + 1,
            is_active:     true,
            created_by:    admin.id,
          },
        })
      );
    }
    console.log(`Categories: ${categoryNames.join(', ')}`);

    // ── 3. Tags ──────────────────────────────────────────────────────────────
    const trendingTags = ['Romance', 'CEO', 'Thriller', 'Billionaire'];
    const allTags = [
      'Romance', 'CEO', 'Revenge', 'Comedy', 'Thriller', 'Action', 'Fantasy',
      'Strong Heroine', 'Werewolf', 'Hidden Identity', 'Billionaire',
      'Family Bonds', 'Forced Love', 'School',
    ];
    for (const tagName of allTags) {
      await prisma.tag.upsert({
        where:  { name: tagName },
        update: {},
        create: { name: tagName, is_trending: trendingTags.includes(tagName) },
      });
    }
    console.log(`Tags: ${allTags.length} created`);

    // ── 4. Settings (coin rules) ─────────────────────────────────────────────
    const settings = {
      checkin_day_1:    '10',
      checkin_day_2:    '10',
      checkin_day_3:    '20',
      checkin_day_4:    '20',
      checkin_day_5:    '25',
      checkin_day_6:    '30',
      checkin_day_7:    '50',
      default_coin_cost: '30',
    };
    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      });
    }
    console.log(`Settings: ${Object.keys(settings).length} coin rules`);

    // ── 5. Membership Plans ──────────────────────────────────────────────────
    const plans = [
      { name: 'Weekly',  duration: 'weekly',  price: 49,  currency: 'INR' },
      { name: 'Monthly', duration: 'monthly', price: 149, currency: 'INR' },
      { name: 'Annual',  duration: 'annual',  price: 999, currency: 'INR' },
    ];
    for (const plan of plans) {
      const exists = await prisma.membershipPlan.findFirst({ where: { name: plan.name } });
      if (!exists) await prisma.membershipPlan.create({ data: plan });
    }
    console.log(`Membership plans: ${plans.map(p => `${p.name} ₹${p.price}`).join(', ')}`);

    // ── 6. CMS Pages ─────────────────────────────────────────────────────────
    const pages = [
      { name: 'Privacy Policy',    slug: 'privacy-policy',  status: 'published', content: 'Your privacy is important to us.' },
      { name: 'Terms & Conditions', slug: 'terms-conditions', status: 'published', content: 'By using our platform you agree to these terms.' },
      { name: 'About Us',          slug: 'about-us',         status: 'published', content: 'We are a premium short-form drama streaming platform.' },
      { name: 'Help / FAQ',        slug: 'help-faq',         status: 'published', content: 'Q: How do I subscribe?\nA: Go to Membership and choose a plan.' },
    ];
    for (const page of pages) {
      await prisma.cmsPage.upsert({
        where:  { slug: page.slug },
        update: {},
        create: page,
      });
    }
    console.log(`CMS pages: ${pages.length} created`);

    // ── Done ─────────────────────────────────────────────────────────────────
    console.log('\n✓ Seed complete!');
    console.log(`  Admin email: ${adminEmail}`);
    console.log(`  Login at:    /api/v1/auth/login\n`);

  } catch (error) {
    logger.error('Seed failed', { error: error.message });
    console.error('Seed failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();