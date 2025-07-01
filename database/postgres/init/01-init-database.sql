-- =============================================================================
-- Nexus PostgreSQL Database Initialization
-- =============================================================================
-- This script initializes the PostgreSQL database with basic schema and data

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS nexus_core;
CREATE SCHEMA IF NOT EXISTS nexus_auth;
CREATE SCHEMA IF NOT EXISTS nexus_content;
CREATE SCHEMA IF NOT EXISTS nexus_analytics;

-- Set search path
SET search_path TO nexus_core, nexus_auth, nexus_content, nexus_analytics, public;

-- =============================================================================
-- Core Tables
-- =============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS nexus_auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user', 'guest')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User profiles table
CREATE TABLE IF NOT EXISTS nexus_auth.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
    bio TEXT,
    website VARCHAR(255),
    location VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    theme VARCHAR(20) DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    notifications_email BOOLEAN DEFAULT TRUE,
    notifications_push BOOLEAN DEFAULT TRUE,
    notifications_sms BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE IF NOT EXISTS nexus_auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content tables
CREATE TABLE IF NOT EXISTS nexus_content.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES nexus_auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    content TEXT,
    excerpt TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Analytics tables
CREATE TABLE IF NOT EXISTS nexus_analytics.page_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES nexus_auth.users(id) ON DELETE SET NULL,
    path VARCHAR(255) NOT NULL,
    referrer VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    session_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON nexus_auth.users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON nexus_auth.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON nexus_auth.users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON nexus_auth.users(status);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON nexus_auth.users(created_at);

-- User profiles indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON nexus_auth.user_profiles(user_id);

-- Sessions indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON nexus_auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON nexus_auth.sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON nexus_auth.sessions(expires_at);

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON nexus_content.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_slug ON nexus_content.posts(slug);
CREATE INDEX IF NOT EXISTS idx_posts_status ON nexus_content.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON nexus_content.posts(published_at);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON nexus_content.posts(created_at);

-- Full-text search indexes
CREATE INDEX IF NOT EXISTS idx_posts_title_search ON nexus_content.posts USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_posts_content_search ON nexus_content.posts USING gin(to_tsvector('english', content));

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON nexus_analytics.page_views(user_id);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON nexus_analytics.page_views(path);
CREATE INDEX IF NOT EXISTS idx_page_views_created_at ON nexus_analytics.page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_session_id ON nexus_analytics.page_views(session_id);

-- =============================================================================
-- Triggers for Updated At
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON nexus_auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON nexus_auth.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON nexus_content.posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Sample Data for Development
-- =============================================================================

-- Insert sample users
INSERT INTO nexus_auth.users (email, username, first_name, last_name, password_hash, role, status, email_verified) VALUES
    ('admin@nexus.local', 'admin', 'Admin', 'User', crypt('admin123', gen_salt('bf')), 'admin', 'active', true),
    ('john.doe@example.com', 'johndoe', 'John', 'Doe', crypt('password123', gen_salt('bf')), 'user', 'active', true),
    ('jane.smith@example.com', 'janesmith', 'Jane', 'Smith', crypt('password123', gen_salt('bf')), 'moderator', 'active', true),
    ('test.user@example.com', 'testuser', 'Test', 'User', crypt('password123', gen_salt('bf')), 'user', 'pending', false)
ON CONFLICT (email) DO NOTHING;

-- Insert sample user profiles
INSERT INTO nexus_auth.user_profiles (user_id, bio, website, location, timezone, language, theme)
SELECT 
    u.id,
    CASE 
        WHEN u.username = 'admin' THEN 'System administrator with full access to all features.'
        WHEN u.username = 'johndoe' THEN 'Software developer passionate about modern web technologies.'
        WHEN u.username = 'janesmith' THEN 'Community moderator and UX designer.'
        WHEN u.username = 'testuser' THEN 'Test user account for development purposes.'
    END,
    CASE 
        WHEN u.username = 'johndoe' THEN 'https://johndoe.dev'
        WHEN u.username = 'janesmith' THEN 'https://janesmith.design'
        ELSE NULL
    END,
    CASE 
        WHEN u.username = 'admin' THEN 'Server Room'
        WHEN u.username = 'johndoe' THEN 'San Francisco, CA'
        WHEN u.username = 'janesmith' THEN 'New York, NY'
        WHEN u.username = 'testuser' THEN 'Test City'
    END,
    'America/New_York',
    'en',
    'system'
FROM nexus_auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM nexus_auth.user_profiles p WHERE p.user_id = u.id
);

-- Insert sample posts
INSERT INTO nexus_content.posts (user_id, title, slug, content, excerpt, status, published_at)
SELECT 
    u.id,
    'Welcome to Nexus Workspace',
    'welcome-to-nexus-workspace',
    'This is a comprehensive guide to getting started with the Nexus workspace. The workspace provides a modern development environment with shared packages, TypeScript support, and database integration.',
    'A comprehensive guide to getting started with the Nexus workspace.',
    'published',
    CURRENT_TIMESTAMP - INTERVAL '1 day'
FROM nexus_auth.users u
WHERE u.username = 'admin'
AND NOT EXISTS (
    SELECT 1 FROM nexus_content.posts p WHERE p.slug = 'welcome-to-nexus-workspace'
);

INSERT INTO nexus_content.posts (user_id, title, slug, content, excerpt, status, published_at)
SELECT 
    u.id,
    'Building Modern Web Applications',
    'building-modern-web-applications',
    'Learn how to build scalable web applications using Next.js, NestJS, and PostgreSQL. This post covers best practices for full-stack development.',
    'Best practices for building scalable web applications.',
    'published',
    CURRENT_TIMESTAMP - INTERVAL '2 hours'
FROM nexus_auth.users u
WHERE u.username = 'johndoe'
AND NOT EXISTS (
    SELECT 1 FROM nexus_content.posts p WHERE p.slug = 'building-modern-web-applications'
);

-- =============================================================================
-- Database Information
-- =============================================================================

-- Create a view for database information
CREATE OR REPLACE VIEW nexus_core.database_info AS
SELECT 
    'PostgreSQL' as database_type,
    version() as version,
    current_database() as database_name,
    current_user as current_user,
    inet_server_addr() as server_address,
    inet_server_port() as server_port,
    CURRENT_TIMESTAMP as initialized_at;

-- Grant permissions
GRANT USAGE ON SCHEMA nexus_core TO PUBLIC;
GRANT USAGE ON SCHEMA nexus_auth TO PUBLIC;
GRANT USAGE ON SCHEMA nexus_content TO PUBLIC;
GRANT USAGE ON SCHEMA nexus_analytics TO PUBLIC;

GRANT SELECT ON nexus_core.database_info TO PUBLIC;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Nexus PostgreSQL database initialized successfully!';
    RAISE NOTICE 'Schemas created: nexus_core, nexus_auth, nexus_content, nexus_analytics';
    RAISE NOTICE 'Sample data inserted for development';
    RAISE NOTICE 'Database ready for use';
END $$;
