const { withSentryConfig } = require('@sentry/nextjs');
const { validateAllEnvironmentVariables } = require('./lib/env');

// Validate environment variables at build time
try {
  console.log('🔍 Validating environment variables...');
  validateAllEnvironmentVariables();
  console.log('✅ Environment variables validated successfully');
} catch (error) {
  console.error('❌ Environment validation failed during build');
  process.exit(1);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  output: 'standalone',
  
  // Experimental features
  experimental: {
    // Enable server components
    serverComponentsExternalPackages: [],
    // Enable instrumentation for environment validation
    instrumentationHook: true,
  },

  // Transpile shared packages from the monorepo
  transpilePackages: [
    '@nexus/shared-types',
    '@nexus/shared-utils',
    '@nexus/ui',
  ],

  // Environment variables validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Public runtime config
  publicRuntimeConfig: {
    // Will be available on both server and client
    staticFolder: '/static',
  },

  // Server runtime config
  serverRuntimeConfig: {
    // Will only be available on the server side
    mySecret: process.env.MY_SECRET,
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },

  // Webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Custom webpack config
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }

    return config;
  },

  // Headers configuration
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      // Basic redirect
      // {
      //   source: '/about',
      //   destination: '/',
      //   permanent: true,
      // },
    ];
  },

  // Rewrites
  async rewrites() {
    return [
      // API proxy to backend
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'}/:path*`,
      },
    ];
  },

  // Compression
  compress: true,

  // Power by header
  poweredByHeader: false,

  // React strict mode
  reactStrictMode: true,

  // SWC minification
  swcMinify: true,

  // ESLint configuration
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: false,
  },

  // TypeScript configuration
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: false,
  },
};

// Sentry webpack plugin options
const sentryWebpackPluginOptions = {
  // Additional config options for the Sentry webpack plugin. Keep in mind that
  // the following options are set automatically, and overriding them is not
  // recommended:
  //   release, url, configFile, stripPrefix, urlPrefix, include, ignore
  
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // An auth token is required for uploading source maps.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  silent: true, // Suppresses source map uploading logs during build
  
  // Upload source maps during build
  widenClientFileUpload: true,
  
  // Automatically create releases and associate commits
  setCommits: {
    auto: true,
    ignoreMissing: true,
    ignoreEmpty: true,
  },
  
  // Deploy notifications
  deploy: {
    env: process.env.NODE_ENV || 'development',
  },
};

// Export the config wrapped with Sentry
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
