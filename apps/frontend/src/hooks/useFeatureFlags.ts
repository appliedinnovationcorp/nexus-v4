import { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { FeatureFlags, UserContext } from '@nexus/feature-flags';

// Feature flag context
interface FeatureFlagContextType {
  flags: Record<string, any>;
  isLoading: boolean;
  error: string | null;
  isEnabled: (flagKey: string | FeatureFlags, defaultValue?: boolean) => boolean;
  getVariant: (flagKey: string | FeatureFlags, defaultValue?: string) => string;
  getString: (flagKey: string | FeatureFlags, defaultValue?: string) => string;
  getNumber: (flagKey: string | FeatureFlags, defaultValue?: number) => number;
  refreshFlags: () => Promise<void>;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | null>(null);

// Feature flag provider component
interface FeatureFlagProviderProps {
  children: React.ReactNode;
  userContext?: UserContext;
  refreshInterval?: number;
}

export function FeatureFlagProvider({ 
  children, 
  userContext, 
  refreshInterval = 60000 // 1 minute default
}: FeatureFlagProviderProps) {
  const [flags, setFlags] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      setError(null);
      
      const response = await fetch('/api/feature-flags/all', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch feature flags: ${response.statusText}`);
      }

      const data = await response.json();
      setFlags(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching feature flags:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [userContext]);

  const refreshFlags = useCallback(async () => {
    setIsLoading(true);
    await fetchFlags();
  }, [fetchFlags]);

  // Initial load
  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  // Periodic refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchFlags, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchFlags, refreshInterval]);

  const isEnabled = useCallback((flagKey: string | FeatureFlags, defaultValue: boolean = false): boolean => {
    const flag = flags[flagKey];
    
    if (flag === undefined || flag === null) {
      return defaultValue;
    }
    
    if (typeof flag === 'boolean') {
      return flag;
    }
    
    if (typeof flag === 'object' && flag.enabled !== undefined) {
      return flag.enabled;
    }
    
    return defaultValue;
  }, [flags]);

  const getVariant = useCallback((flagKey: string | FeatureFlags, defaultValue: string = 'control'): string => {
    const flag = flags[flagKey];
    
    if (flag === undefined || flag === null) {
      return defaultValue;
    }
    
    if (typeof flag === 'string') {
      return flag;
    }
    
    if (typeof flag === 'object' && flag.variant) {
      return flag.variant;
    }
    
    return defaultValue;
  }, [flags]);

  const getString = useCallback((flagKey: string | FeatureFlags, defaultValue: string = ''): string => {
    const flag = flags[flagKey];
    
    if (flag === undefined || flag === null) {
      return defaultValue;
    }
    
    return String(flag);
  }, [flags]);

  const getNumber = useCallback((flagKey: string | FeatureFlags, defaultValue: number = 0): number => {
    const flag = flags[flagKey];
    
    if (flag === undefined || flag === null) {
      return defaultValue;
    }
    
    if (typeof flag === 'number') {
      return flag;
    }
    
    if (typeof flag === 'string') {
      const parsed = parseFloat(flag);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    
    return defaultValue;
  }, [flags]);

  const contextValue: FeatureFlagContextType = {
    flags,
    isLoading,
    error,
    isEnabled,
    getVariant,
    getString,
    getNumber,
    refreshFlags,
  };

  return (
    <FeatureFlagContext.Provider value={contextValue}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

// Hook to use feature flags
export function useFeatureFlags(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext);
  
  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  
  return context;
}

// Hook for individual feature flag
export function useFeatureFlag(
  flagKey: string | FeatureFlags, 
  defaultValue: boolean = false
): {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
} {
  const { isEnabled, isLoading, error } = useFeatureFlags();
  
  return {
    isEnabled: isEnabled(flagKey, defaultValue),
    isLoading,
    error,
  };
}

// Hook for feature flag variant
export function useFeatureFlagVariant(
  flagKey: string | FeatureFlags,
  defaultValue: string = 'control'
): {
  variant: string;
  isLoading: boolean;
  error: string | null;
} {
  const { getVariant, isLoading, error } = useFeatureFlags();
  
  return {
    variant: getVariant(flagKey, defaultValue),
    isLoading,
    error,
  };
}

// Hook for conditional rendering based on feature flags
export function useFeatureFlaggedComponent<T>(
  flagKey: string | FeatureFlags,
  enabledComponent: T,
  disabledComponent?: T,
  defaultValue: boolean = false
): T | undefined {
  const { isEnabled } = useFeatureFlag(flagKey, defaultValue);
  
  return isEnabled ? enabledComponent : disabledComponent;
}

// Hook for A/B testing
export function useABTest(
  flagKey: string | FeatureFlags,
  variants: Record<string, any>,
  defaultVariant: string = 'control'
): any {
  const { variant } = useFeatureFlagVariant(flagKey, defaultVariant);
  
  return variants[variant] || variants[defaultVariant];
}

// Higher-order component for feature flag gating
export function withFeatureFlag<P extends object>(
  flagKey: string | FeatureFlags,
  defaultValue: boolean = false
) {
  return function <T extends React.ComponentType<P>>(Component: T): React.ComponentType<P> {
    return function FeatureFlaggedComponent(props: P) {
      const { isEnabled, isLoading } = useFeatureFlag(flagKey, defaultValue);
      
      if (isLoading) {
        return <div>Loading...</div>; // Or your loading component
      }
      
      if (!isEnabled) {
        return null;
      }
      
      return <Component {...props} />;
    };
  };
}

// Component for conditional rendering
interface FeatureFlagProps {
  flag: string | FeatureFlags;
  defaultValue?: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function FeatureFlag({ flag, defaultValue = false, children, fallback }: FeatureFlagProps) {
  const { isEnabled, isLoading } = useFeatureFlag(flag, defaultValue);
  
  if (isLoading) {
    return <>{fallback || null}</>;
  }
  
  return isEnabled ? <>{children}</> : <>{fallback || null}</>;
}

// Component for variant-based rendering
interface FeatureVariantProps {
  flag: string | FeatureFlags;
  variants: Record<string, React.ReactNode>;
  defaultVariant?: string;
}

export function FeatureVariant({ flag, variants, defaultVariant = 'control' }: FeatureVariantProps) {
  const { variant, isLoading } = useFeatureFlagVariant(flag, defaultVariant);
  
  if (isLoading) {
    return <>{variants[defaultVariant] || null}</>;
  }
  
  return <>{variants[variant] || variants[defaultVariant] || null}</>;
}
