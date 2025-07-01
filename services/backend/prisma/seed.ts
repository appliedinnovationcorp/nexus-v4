import { PrismaClient, UserRole, UserStatus, PostStatus, Theme } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data (in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('🧹 Cleaning existing data...');
    await prisma.activity.deleteMany();
    await prisma.pageView.deleteMany();
    await prisma.like.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.post.deleteMany();
    await prisma.follow.deleteMany();
    await prisma.userSession.deleteMany();
    await prisma.userProfile.deleteMany();
    await prisma.file.deleteMany();
    await prisma.setting.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create users
  console.log('👥 Creating users...');
  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@nexus.local',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      passwordHash: await bcrypt.hash('admin123', 12),
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      bio: 'System administrator with full access to all features.',
      website: 'https://nexus.local',
      location: 'Server Room',
      profile: {
        create: {
          theme: Theme.DARK,
          language: 'en',
          timezone: 'America/New_York',
          notificationsEmail: true,
          notificationsPush: true,
          notificationsSms: false,
          profileVisible: true,
          activityVisible: false,
          socialLinks: {
            github: 'https://github.com/nexus-admin',
            linkedin: 'https://linkedin.com/in/nexus-admin'
          },
          customSettings: {
            dashboardLayout: 'grid',
            widgets: ['analytics', 'recent-posts', 'user-activity'],
            colors: {
              primary: '#3b82f6',
              secondary: '#64748b'
            }
          }
        }
      }
    }
  });

  const johnDoe = await prisma.user.create({
    data: {
      email: 'john.doe@example.com',
      username: 'johndoe',
      firstName: 'John',
      lastName: 'Doe',
      passwordHash: await bcrypt.hash('password123', 12),
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      lastLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      bio: 'Software developer passionate about modern web technologies.',
      website: 'https://johndoe.dev',
      location: 'San Francisco, CA',
      profile: {
        create: {
          theme: Theme.LIGHT,
          language: 'en',
          timezone: 'America/Los_Angeles',
          notificationsEmail: true,
          notificationsPush: false,
          notificationsSms: false,
          profileVisible: true,
          activityVisible: true,
          socialLinks: {
            github: 'https://github.com/johndoe',
            twitter: 'https://twitter.com/johndoe',
            website: 'https://johndoe.dev'
          },
          customSettings: {
            dashboardLayout: 'list',
            widgets: ['recent-posts', 'analytics'],
            colors: {
              primary: '#10b981',
              secondary: '#6b7280'
            }
          }
        }
      }
    }
  });

  const janeSmith = await prisma.user.create({
    data: {
      email: 'jane.smith@example.com',
      username: 'janesmith',
      firstName: 'Jane',
      lastName: 'Smith',
      passwordHash: await bcrypt.hash('password123', 12),
      role: UserRole.MODERATOR,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      emailVerifiedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      lastLoginAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      bio: 'Community moderator and UX designer.',
      website: 'https://janesmith.design',
      location: 'New York, NY',
      profile: {
        create: {
          theme: Theme.SYSTEM,
          language: 'en',
          timezone: 'America/New_York',
          notificationsEmail: true,
          notificationsPush: true,
          notificationsSms: true,
          profileVisible: true,
          activityVisible: true,
          socialLinks: {
            dribbble: 'https://dribbble.com/janesmith',
            behance: 'https://behance.net/janesmith',
            linkedin: 'https://linkedin.com/in/janesmith'
          }
        }
      }
    }
  });

  const testUser = await prisma.user.create({
    data: {
      email: 'test.user@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      passwordHash: await bcrypt.hash('password123', 12),
      role: UserRole.USER,
      status: UserStatus.PENDING,
      emailVerified: false,
      bio: 'Test user account for development purposes.',
      location: 'Test City',
      profile: {
        create: {
          theme: Theme.LIGHT,
          language: 'en',
          timezone: 'UTC',
          notificationsEmail: false,
          notificationsPush: false,
          notificationsSms: false,
          profileVisible: false,
          activityVisible: false
        }
      }
    }
  });

  // Create posts
  console.log('📝 Creating posts...');
  
  const welcomePost = await prisma.post.create({
    data: {
      authorId: adminUser.id,
      title: 'Welcome to Nexus Workspace',
      slug: 'welcome-to-nexus-workspace',
      content: `# Welcome to Nexus Workspace

This is a comprehensive guide to getting started with the Nexus workspace. The workspace provides a modern development environment with shared packages, TypeScript support, and database integration.

## Features

- **Modern Stack**: Built with Next.js, NestJS, and PostgreSQL
- **Shared Packages**: Reusable UI components, types, and utilities
- **Database Integration**: Prisma ORM with PostgreSQL
- **Authentication**: JWT-based authentication system
- **Real-time Features**: WebSocket support for live updates

## Getting Started

1. Clone the repository
2. Install dependencies with \`pnpm install\`
3. Set up the database with \`./scripts/db-setup.sh up\`
4. Run the development server with \`pnpm dev\`

Welcome to the future of web development!`,
      excerpt: 'A comprehensive guide to getting started with the Nexus workspace.',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      tags: ['welcome', 'getting-started', 'nexus', 'workspace'],
      categories: ['announcements', 'guides'],
      metaTitle: 'Welcome to Nexus Workspace - Getting Started Guide',
      metaDescription: 'Learn how to get started with the Nexus workspace and its powerful features.',
      viewCount: 156,
      likeCount: 12,
      commentCount: 3
    }
  });

  const modernAppsPost = await prisma.post.create({
    data: {
      authorId: johnDoe.id,
      title: 'Building Modern Web Applications',
      slug: 'building-modern-web-applications',
      content: `# Building Modern Web Applications

Learn how to build scalable web applications using Next.js, NestJS, and PostgreSQL. This post covers best practices for full-stack development.

## Architecture Overview

Modern web applications require a solid architecture that can scale with your needs. Here's what we recommend:

### Frontend
- **Next.js**: React framework with server-side rendering
- **TypeScript**: Type safety and better developer experience
- **Tailwind CSS**: Utility-first CSS framework

### Backend
- **NestJS**: Scalable Node.js framework
- **Prisma**: Modern database toolkit
- **PostgreSQL**: Reliable relational database

### Shared Code
- **Monorepo**: Shared packages and utilities
- **Type Safety**: End-to-end TypeScript
- **Code Reuse**: DRY principles applied

## Best Practices

1. **Use TypeScript everywhere** for better code quality
2. **Implement proper error handling** at all levels
3. **Write comprehensive tests** for critical functionality
4. **Follow security best practices** for authentication
5. **Optimize for performance** from day one

This approach ensures maintainable, scalable applications that can grow with your business.`,
      excerpt: 'Best practices for building scalable web applications with modern technologies.',
      status: PostStatus.PUBLISHED,
      publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      tags: ['development', 'nextjs', 'nestjs', 'postgresql', 'tutorial'],
      categories: ['development', 'tutorials'],
      metaTitle: 'Building Modern Web Applications - Best Practices',
      metaDescription: 'Learn best practices for building scalable web applications with modern technologies.',
      viewCount: 89,
      likeCount: 7,
      commentCount: 2
    }
  });

  const draftPost = await prisma.post.create({
    data: {
      authorId: janeSmith.id,
      title: 'Advanced UI/UX Design Patterns',
      slug: 'advanced-ui-ux-design-patterns',
      content: 'This post is still being written...',
      excerpt: 'Exploring advanced design patterns for modern web applications.',
      status: PostStatus.DRAFT,
      tags: ['design', 'ui', 'ux', 'patterns'],
      categories: ['design'],
      viewCount: 0,
      likeCount: 0,
      commentCount: 0
    }
  });

  // Create comments
  console.log('💬 Creating comments...');
  
  await prisma.comment.create({
    data: {
      postId: welcomePost.id,
      userId: johnDoe.id,
      content: 'Great introduction! Looking forward to exploring all the features.',
      likeCount: 2
    }
  });

  await prisma.comment.create({
    data: {
      postId: welcomePost.id,
      userId: janeSmith.id,
      content: 'The workspace setup looks very comprehensive. Thanks for the detailed guide!',
      likeCount: 1
    }
  });

  await prisma.comment.create({
    data: {
      postId: modernAppsPost.id,
      userId: adminUser.id,
      content: 'Excellent breakdown of the architecture. This will help many developers.',
      likeCount: 3
    }
  });

  // Create likes
  console.log('👍 Creating likes...');
  
  await prisma.like.createMany({
    data: [
      { userId: johnDoe.id, postId: welcomePost.id },
      { userId: janeSmith.id, postId: welcomePost.id },
      { userId: testUser.id, postId: welcomePost.id },
      { userId: adminUser.id, postId: modernAppsPost.id },
      { userId: janeSmith.id, postId: modernAppsPost.id }
    ]
  });

  // Create follows
  console.log('🤝 Creating follows...');
  
  await prisma.follow.createMany({
    data: [
      { followerId: johnDoe.id, followingId: adminUser.id },
      { followerId: janeSmith.id, followingId: adminUser.id },
      { followerId: testUser.id, followingId: johnDoe.id },
      { followerId: johnDoe.id, followingId: janeSmith.id }
    ]
  });

  // Create page views
  console.log('📊 Creating page views...');
  
  const pageViews = [];
  const paths = ['/', '/posts', '/about', '/contact'];
  const users = [adminUser, johnDoe, janeSmith, testUser];
  
  for (let i = 0; i < 50; i++) {
    const randomUser = users[Math.floor(Math.random() * users.length)];
    const randomPath = paths[Math.floor(Math.random() * paths.length)];
    const randomDate = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
    
    pageViews.push({
      userId: Math.random() > 0.3 ? randomUser.id : null, // 30% anonymous views
      path: randomPath,
      title: `Nexus - ${randomPath === '/' ? 'Home' : randomPath.slice(1)}`,
      referrer: Math.random() > 0.5 ? 'https://google.com' : null,
      userAgent: 'Mozilla/5.0 (compatible; NexusBot/1.0)',
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      createdAt: randomDate
    });
  }
  
  await prisma.pageView.createMany({ data: pageViews });

  // Create activities
  console.log('🎯 Creating activities...');
  
  await prisma.activity.createMany({
    data: [
      {
        userId: adminUser.id,
        type: 'LOGIN',
        description: 'User logged in',
        metadata: { method: 'email', success: true },
        ipAddress: '192.168.1.100',
        createdAt: new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
      },
      {
        userId: johnDoe.id,
        type: 'POST_CREATE',
        description: 'Created a new post',
        metadata: { postId: modernAppsPost.id, title: modernAppsPost.title },
        ipAddress: '192.168.1.101',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        userId: janeSmith.id,
        type: 'PROFILE_UPDATE',
        description: 'Updated profile information',
        metadata: { fields: ['bio', 'website'] },
        ipAddress: '192.168.1.102',
        createdAt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      }
    ]
  });

  // Create system settings
  console.log('⚙️ Creating system settings...');
  
  await prisma.setting.createMany({
    data: [
      {
        key: 'site_name',
        value: 'Nexus Workspace',
        description: 'The name of the website',
        category: 'general',
        isPublic: true
      },
      {
        key: 'site_description',
        value: 'A modern full-stack workspace for web development',
        description: 'The description of the website',
        category: 'general',
        isPublic: true
      },
      {
        key: 'maintenance_mode',
        value: false,
        description: 'Enable maintenance mode',
        category: 'system',
        isPublic: false
      },
      {
        key: 'registration_enabled',
        value: true,
        description: 'Allow new user registrations',
        category: 'auth',
        isPublic: false
      },
      {
        key: 'max_file_size',
        value: 10485760, // 10MB
        description: 'Maximum file upload size in bytes',
        category: 'files',
        isPublic: false
      }
    ]
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`
📊 Created:
- ${await prisma.user.count()} users
- ${await prisma.post.count()} posts
- ${await prisma.comment.count()} comments
- ${await prisma.like.count()} likes
- ${await prisma.follow.count()} follows
- ${await prisma.pageView.count()} page views
- ${await prisma.activity.count()} activities
- ${await prisma.setting.count()} settings
  `);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
