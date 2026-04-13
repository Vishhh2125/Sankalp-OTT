import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import config from '../config/index.js';
import logger from '../config/logger.js';

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Seeding database...\n');

    // ── 1. ADMIN USER ─────────────────────────────────────────
    const adminEmail    = process.env.ADMIN_EMAIL    || 'admin@ott.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminName     = process.env.ADMIN_NAME     || 'Super Admin';

    const hashedPassword = await bcrypt.hash(adminPassword, config.bcryptRounds);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'ADMIN',
      },
    });

    console.log(`✓ Admin ready → ${admin.email}`);

    // ── 2. CATEGORIES ─────────────────────────────────────────
    const categoryNames = ['Popular', 'New', 'Rankings', 'Anime', 'VIP'];

    for (let i = 0; i < categoryNames.length; i++) {
      const existing = await prisma.category.findFirst({
        where: { name: categoryNames[i] },
      });

      if (!existing) {
        await prisma.category.create({
          data: {
            name: categoryNames[i],
            display_order: i + 1,
            created_by: admin.id,
          },
        });
      }
    }

    console.log(`✓ Categories seeded`);

    // ── 3. TAGS ──────────────────────────────────────────────
    const trendingTags = ['Romance', 'CEO', 'Thriller', 'Billionaire'];

    const allTags = [
      'Romance', 'CEO', 'Revenge', 'Comedy', 'Thriller', 'Action',
      'Fantasy', 'Strong Heroine', 'Werewolf', 'Hidden Identity',
      'Billionaire', 'Family Bonds', 'Forced Love', 'School',
    ];

    for (const tag of allTags) {
      await prisma.tag.upsert({
        where: { name: tag },
        update: {},
        create: {
          name: tag,
          is_trending: trendingTags.includes(tag),
        },
      });
    }

    console.log(`✓ Tags seeded`);

    // ── 4. SETTINGS ──────────────────────────────────────────
    const settings = {
      checkin_day_1: '10',
      checkin_day_2: '10',
      checkin_day_3: '20',
      checkin_day_4: '20',
      checkin_day_5: '25',
      checkin_day_6: '30',
      checkin_day_7: '50',
      default_coin_cost: '30',
    };

    for (const [key, value] of Object.entries(settings)) {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }

    console.log(`✓ Settings seeded`);

    // ── 5. MEMBERSHIP PLANS ─────────────────────────────────
    const plans = [
      { name: 'Weekly', duration: 'weekly', price: 49 },
      { name: 'Monthly', duration: 'monthly', price: 149 },
      { name: 'Annual', duration: 'annual', price: 999 },
    ];

    for (const plan of plans) {
      const exists = await prisma.membershipPlan.findFirst({
        where: { name: plan.name },
      });

      if (!exists) {
        await prisma.membershipPlan.create({
          data: {
            name: plan.name,
            duration: plan.duration,
            price: new Prisma.Decimal(plan.price),
            currency: 'INR',
          },
        });
      }
    }

    console.log(`✓ Membership plans seeded`);

    // ── 6. CMS PAGES ─────────────────────────────────────────
    const pages = [
      {
        name: 'Privacy Policy',
        slug: 'privacy-policy',
        status: 'published',
        content: 'Your privacy is important to us.',
      },
      {
        name: 'Terms & Conditions',
        slug: 'terms-conditions',
        status: 'published',
        content: 'By using our platform you agree to these terms.',
      },
      {
        name: 'About Us',
        slug: 'about-us',
        status: 'published',
        content: 'We are a premium short-form drama streaming platform.',
      },
      {
        name: 'Help / FAQ',
        slug: 'help-faq',
        status: 'published',
        content: 'Q: How do I subscribe?\nA: Go to Membership.',
      },
    ];

    for (const page of pages) {
      await prisma.cmsPage.upsert({
        where: { slug: page.slug },
        update: {},
        create: page,
      });
    }

    console.log(`✓ CMS pages seeded`);

    // ── 7. OPTIONAL: SAMPLE SHOW + EPISODES ──────────────────
    const category = await prisma.category.findFirst();

    if (category) {
      const show = await prisma.show.create({
        data: {
          title: 'Sample Drama',
          category_id: category.id,
          synopsis: 'Demo show for testing',
        },
      });

      for (let i = 1; i <= 3; i++) {
        await prisma.episode.create({
          data: {
            show_id: show.id,
            episode_num: i,
            title: `Episode ${i}`,
            is_free: i === 1,
            coin_cost: 30,
          },
        });
      }

      console.log(`✓ Sample content created`);
    }

    console.log('\n✅ SEED COMPLETE\n');

  } catch (error) {
    logger.error('Seed failed', { error });
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();