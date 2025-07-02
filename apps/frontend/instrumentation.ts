export async function register() {
  // Validate environment variables on server startup
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateServerEnvironmentVariables } = await import('./lib/env');
    
    try {
      console.log('🔍 Validating server environment variables...');
      validateServerEnvironmentVariables();
      console.log('✅ Server environment variables validated successfully');
    } catch (error) {
      console.error('❌ Server environment validation failed');
      process.exit(1);
    }
    
    // Initialize Sentry after environment validation
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime has limited environment access
    await import('./sentry.edge.config');
  }
}
