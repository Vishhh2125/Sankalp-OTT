const app = require('./app');
const config = require('./config');
const { prisma } = require('./prisma/client');

async function start() {
  // Test database connection
  try {
    await prisma.$connect();
    console.log('Database connected');
  } catch (err) {
    console.error('Database connection failed:', err.message);
    console.error('Make sure Docker is running: cd docker && docker compose -f docker-compose.dev.yml up -d');
    process.exit(1);
  }

  // Start HTTP server
  app.listen(config.port, () => {
    console.log(`\nOTT API running on http://localhost:${config.port}/api`);
    console.log(`Health check: http://localhost:${config.port}/api/health`);
    console.log(`Environment: ${config.nodeEnv}\n`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
