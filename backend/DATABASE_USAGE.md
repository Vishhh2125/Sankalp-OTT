# Database Usage Guide

Production-grade database best practices for your OTT platform

## 📌 Quick Reference

### Using Prisma in Your Code

```javascript
const { getPrismaClient } = require('../config/database');
const logger = require('../config/logger');

const prisma = getPrismaClient();

// Create
const user = await prisma.user.create({
  data: { email, name }
});

// Read
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// Update
const user = await prisma.user.update({
  where: { id: userId },
  data: { name: 'new name' }
});

// Delete
await prisma.user.delete({
  where: { id: userId }
});
```

## ✅ Best Practices

### 1. Always Use Error Handling

```javascript
async function getUser(userId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      logger.warn('User not found', { userId });
      return null;
    }
    
    return user;
  } catch (error) {
    logger.error('Database error', { userId, error: error.message });
    throw error;
  }
}
```

### 2. Use Transactions for Multiple Operations

```javascript
// Good: Atomic operation
const [user, profile] = await prisma.$transaction([
  prisma.user.create({ data: userData }),
  prisma.profile.create({ data: profileData })
]);

// Bad: Two separate calls (not atomic)
const user = await prisma.user.create({ data: userData });
const profile = await prisma.profile.create({ data: profileData });
```

### 3. Select Only Needed Fields

```javascript
// Good: Select specific fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { id: true, email: true, name: true }
});

// Bad: Fetch all fields when not needed
const user = await prisma.user.findUnique({
  where: { id: userId }
});
```

### 4. Use Pagination for Large Result Sets

```javascript
// Good: Pagination
const users = await prisma.user.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: 'desc' }
});

// Bad: Fetch all records
const users = await prisma.user.findMany();
```

### 5. Always Log Important Operations

```javascript
async function deleteUser(userId) {
  try {
    const user = await prisma.user.delete({
      where: { id: userId }
    });
    
    logger.info('User deleted', { userId, email: user.email });
    return user;
  } catch (error) {
    logger.error('Failed to delete user', { userId, error: error.message });
    throw error;
  }
}
```

## 🏗️ Creating New Models

### 1. Update Prisma Schema

Edit `prisma/schema.prisma`:

```prisma
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  content   String
  published Boolean @default(false)
  
  authorId  Int
  author    User    @relation(fields: [authorId], references: [id])
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([authorId])
}

model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  
  posts Post[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2. Generate and Migrate

```bash
npm run generate
npm run migrate -- --name add_posts
```

### 3. Create a Module

```javascript
const { getPrismaClient } = require('../config/database');
const logger = require('../config/logger');

const prisma = getPrismaClient();

async function createPost(title, content, authorId) {
  try {
    const post = await prisma.post.create({
      data: { title, content, authorId }
    });
    logger.info('Post created', { postId: post.id, authorId });
    return post;
  } catch (error) {
    logger.error('Failed to create post', { error: error.message });
    throw error;
  }
}

module.exports = { createPost };
```

## 🔍 Common Patterns

### Pattern 1: Find or Create

```javascript
const user = await prisma.user.upsert({
  where: { email },
  update: { name },
  create: { email, name }
});
```

### Pattern 2: Count Records

```javascript
const count = await prisma.user.count({
  where: { email: { contains: 'example.com' } }
});
```

### Pattern 3: Group By Aggregation

```javascript
const stats = await prisma.user.groupBy({
  by: ['createdAt'],
  _count: { id: true }
});
```

### Pattern 4: Raw SQL Queries

```javascript
const result = await prisma.$queryRaw`
  SELECT * FROM "User" WHERE "email" LIKE ${emailPattern}
`;
```

### Pattern 5: Load Relations

```javascript
const user = await prisma.user.findUnique({
  where: { id: userId },
  include: {
    posts: {
      where: { published: true },
      select: { id: true, title: true }
    }
  }
});
```

## 🚨 Error Handling

### Database Errors You'll Encounter

```javascript
const Prisma = require('@prisma/client').Prisma;

try {
  await prisma.user.create({ data: { email: 'duplicate@test.com' } });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      logger.error('Email already exists');
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    // Validation error
    logger.error('Invalid data provided');
  }
}
```

Common Error Codes:
- `P2002`: Unique constraint violation
- `P2025`: Record not found
- `P2003`: Foreign key constraint violation
- `P2014`: Relation violation
- `P2018`: Required relation missing

## 📊 Performance Tips

1. **Use indexes** for frequently queried fields
```prisma
model User {
  id    Int @id @default(autoincrement())
  email String @unique      // Index created automatically
  name  String
  
  @@index([name])           // Add index for name searches
}
```

2. **Batch operations** instead of loops
```javascript
// Good
await prisma.user.createMany({
  data: [user1, user2, user3]
});

// Bad
for (const user of users) {
  await prisma.user.create({ data: user });
}
```

3. **Use `.include()` or `.select()`** to avoid N+1 queries
4. **Monitor slow queries** using DEBUG_QUERIES=true

## 🔗 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs/)
- [Data Modeling](https://www.prisma.io/docs/concepts/components/prisma-schema/data-model)
- [Query Guide](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)
- [Relations](https://www.prisma.io/docs/concepts/components/prisma-schema/relations)
