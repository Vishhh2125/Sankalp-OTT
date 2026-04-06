const { prisma } = require('./client');
const bcrypt = require('bcrypt');
const config = require('../config');

async function seed() {
  console.log('Seeding database...\n');

  // 1. Create admin user
  const adminPassword = await bcrypt.hash('Admin@123', config.bcryptRounds);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ott.com' },
    update: {},
    create: {
      email: 'admin@ott.com',
      password_hash: adminPassword,
      name: 'Super Admin',
      role: 'admin',
    },
  });
  console.log(`Admin user: admin@ott.com / Admin@123 (id: ${admin.id})`);

  // 2. Create navbar categories
  const categories = ['Popular', 'New', 'Rankings', 'Anime', 'VIP'];
for (let i = 0; i < categories.length; i++) {
  await prisma.category.create({
    data: {
      name: categories[i],
      display_order: i + 1,
      is_active: true,
      created_by: admin.id,
    },
  });
}
  console.log(`Categories: ${categories.join(', ')}`);

  // 3. Create drama tags
  const tags = [
    'Romance', 'CEO', 'Revenge', 'Comedy', 'Thriller', 'Action', 'Fantasy',
    'Strong Heroine', 'Werewolf', 'Hidden Identity', 'Billionaire',
    'Family Bonds', 'Forced Love', 'School',
  ];
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName, is_trending: ['Romance', 'CEO', 'Thriller', 'Billionaire'].includes(tagName) },
    });
  }
  console.log(`Tags: ${tags.length} created`);

  // 4. Create settings (coin rules + defaults)
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
  console.log(`Settings: ${Object.keys(settings).length} coin rules`);

  // 5. Create membership plans
  const plans = [
    { name: 'Weekly', duration: 'weekly', price: 49, currency: 'INR' },
    { name: 'Monthly', duration: 'monthly', price: 149, currency: 'INR' },
    { name: 'Annual', duration: 'annual', price: 999, currency: 'INR' },
  ];
  for (const plan of plans) {
    await prisma.membershipPlan.create({ data: plan });
  }
  console.log(`Membership plans: ${plans.map(p => `${p.name} ₹${p.price}`).join(', ')}`);

  // 6. Create CMS pages
  const pages = [
    { name: 'Privacy Policy', slug: 'privacy-policy', status: 'published', content: 'Your privacy is important to us.' },
    { name: 'Terms & Conditions', slug: 'terms-conditions', status: 'published', content: 'By using our platform you agree to these terms.' },
    { name: 'About Us', slug: 'about-us', status: 'published', content: 'We are a premium short-form drama streaming platform.' },
    { name: 'Help / FAQ', slug: 'help-faq', status: 'published', content: 'Q: How do I subscribe?\nA: Go to Membership and choose a plan.' },
  ];
  for (const page of pages) {
    await prisma.cmsPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
  }
  console.log(`CMS pages: ${pages.length} created`);

  console.log('\nSeed complete!');
}

seed()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('Seed failed:', err);
    prisma.$disconnect();
    process.exit(1);
  });
