// =============================================================================
// Nexus MongoDB Database Initialization
// =============================================================================
// This script initializes the MongoDB database with collections and sample data

// Switch to the nexus database
db = db.getSiblingDB('nexus_nosql');

// =============================================================================
// Create Collections with Validation
// =============================================================================

// User sessions collection (for session storage)
db.createCollection('user_sessions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'sessionId', 'expiresAt'],
      properties: {
        userId: {
          bsonType: 'string',
          description: 'User ID must be a string and is required'
        },
        sessionId: {
          bsonType: 'string',
          description: 'Session ID must be a string and is required'
        },
        data: {
          bsonType: 'object',
          description: 'Session data object'
        },
        expiresAt: {
          bsonType: 'date',
          description: 'Expiration date must be a date and is required'
        },
        userAgent: {
          bsonType: 'string',
          description: 'User agent string'
        },
        ipAddress: {
          bsonType: 'string',
          description: 'IP address string'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update timestamp'
        }
      }
    }
  }
});

// User preferences collection (for flexible user settings)
db.createCollection('user_preferences', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId'],
      properties: {
        userId: {
          bsonType: 'string',
          description: 'User ID must be a string and is required'
        },
        preferences: {
          bsonType: 'object',
          description: 'User preferences object'
        },
        settings: {
          bsonType: 'object',
          description: 'User settings object'
        },
        customizations: {
          bsonType: 'object',
          description: 'User customizations object'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update timestamp'
        }
      }
    }
  }
});

// Activity logs collection (for user activity tracking)
db.createCollection('activity_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'action', 'timestamp'],
      properties: {
        userId: {
          bsonType: 'string',
          description: 'User ID must be a string and is required'
        },
        action: {
          bsonType: 'string',
          description: 'Action type must be a string and is required'
        },
        resource: {
          bsonType: 'string',
          description: 'Resource affected by the action'
        },
        resourceId: {
          bsonType: 'string',
          description: 'ID of the resource affected'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata about the action'
        },
        ipAddress: {
          bsonType: 'string',
          description: 'IP address of the user'
        },
        userAgent: {
          bsonType: 'string',
          description: 'User agent string'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Action timestamp must be a date and is required'
        }
      }
    }
  }
});

// Content metadata collection (for flexible content attributes)
db.createCollection('content_metadata', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['contentId', 'contentType'],
      properties: {
        contentId: {
          bsonType: 'string',
          description: 'Content ID must be a string and is required'
        },
        contentType: {
          bsonType: 'string',
          enum: ['post', 'page', 'media', 'comment'],
          description: 'Content type must be one of the allowed values'
        },
        metadata: {
          bsonType: 'object',
          description: 'Content metadata object'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Array of tag strings'
        },
        categories: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Array of category strings'
        },
        customFields: {
          bsonType: 'object',
          description: 'Custom fields object'
        },
        seoData: {
          bsonType: 'object',
          description: 'SEO metadata object'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation timestamp'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update timestamp'
        }
      }
    }
  }
});

// Analytics events collection (for event tracking)
db.createCollection('analytics_events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['eventType', 'timestamp'],
      properties: {
        eventType: {
          bsonType: 'string',
          description: 'Event type must be a string and is required'
        },
        userId: {
          bsonType: 'string',
          description: 'User ID if user is authenticated'
        },
        sessionId: {
          bsonType: 'string',
          description: 'Session ID for tracking'
        },
        properties: {
          bsonType: 'object',
          description: 'Event properties object'
        },
        context: {
          bsonType: 'object',
          description: 'Event context object'
        },
        timestamp: {
          bsonType: 'date',
          description: 'Event timestamp must be a date and is required'
        }
      }
    }
  }
});

// File uploads collection (for file metadata)
db.createCollection('file_uploads', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['filename', 'originalName', 'mimeType', 'size'],
      properties: {
        filename: {
          bsonType: 'string',
          description: 'Stored filename must be a string and is required'
        },
        originalName: {
          bsonType: 'string',
          description: 'Original filename must be a string and is required'
        },
        mimeType: {
          bsonType: 'string',
          description: 'MIME type must be a string and is required'
        },
        size: {
          bsonType: 'number',
          description: 'File size in bytes must be a number and is required'
        },
        userId: {
          bsonType: 'string',
          description: 'ID of user who uploaded the file'
        },
        path: {
          bsonType: 'string',
          description: 'File storage path'
        },
        url: {
          bsonType: 'string',
          description: 'Public URL of the file'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional file metadata'
        },
        tags: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Array of tag strings'
        },
        uploadedAt: {
          bsonType: 'date',
          description: 'Upload timestamp'
        }
      }
    }
  }
});

// =============================================================================
// Create Indexes for Performance
// =============================================================================

// User sessions indexes
db.user_sessions.createIndex({ 'userId': 1 });
db.user_sessions.createIndex({ 'sessionId': 1 }, { unique: true });
db.user_sessions.createIndex({ 'expiresAt': 1 }, { expireAfterSeconds: 0 });

// User preferences indexes
db.user_preferences.createIndex({ 'userId': 1 }, { unique: true });

// Activity logs indexes
db.activity_logs.createIndex({ 'userId': 1 });
db.activity_logs.createIndex({ 'action': 1 });
db.activity_logs.createIndex({ 'timestamp': -1 });
db.activity_logs.createIndex({ 'userId': 1, 'timestamp': -1 });

// Content metadata indexes
db.content_metadata.createIndex({ 'contentId': 1 }, { unique: true });
db.content_metadata.createIndex({ 'contentType': 1 });
db.content_metadata.createIndex({ 'tags': 1 });
db.content_metadata.createIndex({ 'categories': 1 });

// Analytics events indexes
db.analytics_events.createIndex({ 'eventType': 1 });
db.analytics_events.createIndex({ 'userId': 1 });
db.analytics_events.createIndex({ 'sessionId': 1 });
db.analytics_events.createIndex({ 'timestamp': -1 });
db.analytics_events.createIndex({ 'eventType': 1, 'timestamp': -1 });

// File uploads indexes
db.file_uploads.createIndex({ 'filename': 1 }, { unique: true });
db.file_uploads.createIndex({ 'userId': 1 });
db.file_uploads.createIndex({ 'mimeType': 1 });
db.file_uploads.createIndex({ 'uploadedAt': -1 });
db.file_uploads.createIndex({ 'tags': 1 });

// =============================================================================
// Insert Sample Data for Development
// =============================================================================

// Sample user preferences
db.user_preferences.insertMany([
  {
    userId: 'admin-user-id',
    preferences: {
      theme: 'dark',
      language: 'en',
      timezone: 'America/New_York',
      notifications: {
        email: true,
        push: true,
        sms: false
      },
      dashboard: {
        layout: 'grid',
        widgets: ['analytics', 'recent-posts', 'user-activity']
      }
    },
    settings: {
      privacy: {
        profileVisible: true,
        activityVisible: false
      },
      security: {
        twoFactorEnabled: true,
        sessionTimeout: 3600
      }
    },
    customizations: {
      colors: {
        primary: '#3b82f6',
        secondary: '#64748b'
      },
      fonts: {
        primary: 'Inter',
        secondary: 'JetBrains Mono'
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    userId: 'john-doe-user-id',
    preferences: {
      theme: 'light',
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: false,
        sms: false
      },
      dashboard: {
        layout: 'list',
        widgets: ['recent-posts', 'analytics']
      }
    },
    settings: {
      privacy: {
        profileVisible: true,
        activityVisible: true
      },
      security: {
        twoFactorEnabled: false,
        sessionTimeout: 7200
      }
    },
    customizations: {
      colors: {
        primary: '#10b981',
        secondary: '#6b7280'
      }
    },
    createdAt: new Date(),
    updatedAt: new Date()
  }
]);

// Sample activity logs
db.activity_logs.insertMany([
  {
    userId: 'admin-user-id',
    action: 'login',
    resource: 'auth',
    metadata: {
      method: 'email',
      success: true
    },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    timestamp: new Date(Date.now() - 3600000) // 1 hour ago
  },
  {
    userId: 'john-doe-user-id',
    action: 'create_post',
    resource: 'post',
    resourceId: 'post-123',
    metadata: {
      title: 'Building Modern Web Applications',
      status: 'published'
    },
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    timestamp: new Date(Date.now() - 7200000) // 2 hours ago
  },
  {
    userId: 'admin-user-id',
    action: 'update_settings',
    resource: 'user_profile',
    metadata: {
      fields: ['theme', 'notifications'],
      changes: {
        theme: { from: 'light', to: 'dark' },
        notifications: { email: true }
      }
    },
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    timestamp: new Date(Date.now() - 1800000) // 30 minutes ago
  }
]);

// Sample content metadata
db.content_metadata.insertMany([
  {
    contentId: 'post-welcome-to-nexus',
    contentType: 'post',
    metadata: {
      readingTime: 5,
      wordCount: 1200,
      featured: true,
      sticky: false
    },
    tags: ['welcome', 'getting-started', 'nexus', 'workspace'],
    categories: ['announcements', 'guides'],
    customFields: {
      headerImage: '/images/welcome-banner.jpg',
      excerpt: 'A comprehensive guide to getting started with the Nexus workspace.',
      socialSharing: true
    },
    seoData: {
      metaTitle: 'Welcome to Nexus Workspace - Getting Started Guide',
      metaDescription: 'Learn how to get started with the Nexus workspace and its powerful features.',
      keywords: ['nexus', 'workspace', 'getting started', 'guide'],
      ogImage: '/images/welcome-og.jpg'
    },
    createdAt: new Date(Date.now() - 86400000), // 1 day ago
    updatedAt: new Date(Date.now() - 86400000)
  },
  {
    contentId: 'post-building-modern-apps',
    contentType: 'post',
    metadata: {
      readingTime: 8,
      wordCount: 2000,
      featured: false,
      sticky: false
    },
    tags: ['development', 'nextjs', 'nestjs', 'postgresql', 'tutorial'],
    categories: ['development', 'tutorials'],
    customFields: {
      headerImage: '/images/modern-apps-banner.jpg',
      excerpt: 'Best practices for building scalable web applications.',
      socialSharing: true,
      codeExamples: true
    },
    seoData: {
      metaTitle: 'Building Modern Web Applications - Best Practices',
      metaDescription: 'Learn best practices for building scalable web applications with modern technologies.',
      keywords: ['web development', 'nextjs', 'nestjs', 'best practices'],
      ogImage: '/images/modern-apps-og.jpg'
    },
    createdAt: new Date(Date.now() - 7200000), // 2 hours ago
    updatedAt: new Date(Date.now() - 7200000)
  }
]);

// Sample analytics events
db.analytics_events.insertMany([
  {
    eventType: 'page_view',
    userId: 'john-doe-user-id',
    sessionId: 'session-123',
    properties: {
      page: '/',
      title: 'Nexus Workspace - Home',
      referrer: 'https://google.com',
      path: '/'
    },
    context: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '192.168.1.101',
      screen: {
        width: 1920,
        height: 1080
      },
      viewport: {
        width: 1200,
        height: 800
      }
    },
    timestamp: new Date(Date.now() - 3600000) // 1 hour ago
  },
  {
    eventType: 'button_click',
    userId: 'john-doe-user-id',
    sessionId: 'session-123',
    properties: {
      buttonText: 'View Integration Demo',
      buttonId: 'integration-demo-btn',
      page: '/',
      section: 'hero'
    },
    context: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ipAddress: '192.168.1.101'
    },
    timestamp: new Date(Date.now() - 3500000) // 58 minutes ago
  },
  {
    eventType: 'form_submit',
    sessionId: 'session-456',
    properties: {
      formId: 'validation-demo-form',
      formName: 'Validation Demo',
      page: '/integration-demo',
      fields: ['email', 'username', 'password', 'firstName', 'lastName'],
      success: true
    },
    context: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      ipAddress: '192.168.1.102'
    },
    timestamp: new Date(Date.now() - 1800000) // 30 minutes ago
  }
]);

// Sample file uploads
db.file_uploads.insertMany([
  {
    filename: 'welcome-banner-2024-01-01-abc123.jpg',
    originalName: 'welcome-banner.jpg',
    mimeType: 'image/jpeg',
    size: 245760,
    userId: 'admin-user-id',
    path: '/uploads/images/2024/01/',
    url: '/uploads/images/2024/01/welcome-banner-2024-01-01-abc123.jpg',
    metadata: {
      width: 1200,
      height: 600,
      format: 'JPEG',
      quality: 85,
      exif: {
        camera: 'Canon EOS R5',
        lens: 'RF 24-70mm f/2.8L IS USM'
      }
    },
    tags: ['banner', 'welcome', 'hero'],
    uploadedAt: new Date(Date.now() - 86400000) // 1 day ago
  },
  {
    filename: 'user-avatar-john-doe-def456.png',
    originalName: 'profile-photo.png',
    mimeType: 'image/png',
    size: 51200,
    userId: 'john-doe-user-id',
    path: '/uploads/avatars/2024/01/',
    url: '/uploads/avatars/2024/01/user-avatar-john-doe-def456.png',
    metadata: {
      width: 256,
      height: 256,
      format: 'PNG',
      hasAlpha: true
    },
    tags: ['avatar', 'profile'],
    uploadedAt: new Date(Date.now() - 43200000) // 12 hours ago
  }
]);

// =============================================================================
// Create Database Information Collection
// =============================================================================

db.createCollection('database_info');

db.database_info.insertOne({
  databaseType: 'MongoDB',
  version: db.version(),
  databaseName: 'nexus_nosql',
  collections: db.getCollectionNames(),
  initializedAt: new Date(),
  description: 'Nexus NoSQL database for flexible document storage',
  features: [
    'User sessions and preferences',
    'Activity logging',
    'Content metadata',
    'Analytics events',
    'File upload tracking'
  ]
});

// =============================================================================
// Success Message
// =============================================================================

print('=============================================================================');
print('Nexus MongoDB database initialized successfully!');
print('Collections created with validation schemas and indexes');
print('Sample data inserted for development');
print('Database ready for use');
print('=============================================================================');

// List all collections
print('Available collections:');
db.getCollectionNames().forEach(function(collection) {
  print('- ' + collection);
});

print('=============================================================================');
