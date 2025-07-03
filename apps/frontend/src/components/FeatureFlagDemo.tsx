import React, { useState } from 'react';
import { 
  useFeatureFlags, 
  useFeatureFlag, 
  useFeatureFlagVariant,
  FeatureFlag, 
  FeatureVariant,
  withFeatureFlag 
} from '../hooks/useFeatureFlags';
import { FeatureFlags } from '@nexus/feature-flags';

// Demo component to showcase feature flag functionality
export function FeatureFlagDemo() {
  const { flags, isLoading, error, refreshFlags } = useFeatureFlags();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFlags();
    setRefreshing(false);
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-100 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-300 rounded"></div>
            <div className="h-3 bg-gray-300 rounded w-5/6"></div>
            <div className="h-3 bg-gray-300 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-100 border border-red-400 rounded-lg">
        <h3 className="text-red-800 font-semibold mb-2">Feature Flag Error</h3>
        <p className="text-red-700">{error}</p>
        <button 
          onClick={handleRefresh}
          className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          disabled={refreshing}
        >
          {refreshing ? 'Retrying...' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-900">Feature Flag Demo</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Flags'}
          </button>
        </div>
        
        <p className="text-gray-600 mb-6">
          This demo shows how feature flags work in real-time. Toggle flags in your feature flag dashboard 
          and see the changes instantly without redeploying the application.
        </p>

        {/* Feature Flag Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <FlagStatusCard flagKey={FeatureFlags.NEW_DASHBOARD} title="New Dashboard" />
          <FlagStatusCard flagKey={FeatureFlags.DARK_MODE} title="Dark Mode" />
          <FlagStatusCard flagKey={FeatureFlags.ADVANCED_SEARCH} title="Advanced Search" />
          <FlagStatusCard flagKey={FeatureFlags.BETA_FEATURES} title="Beta Features" />
          <FlagStatusCard flagKey={FeatureFlags.PREMIUM_FEATURES} title="Premium Features" />
          <FlagStatusCard flagKey={FeatureFlags.ANALYTICS_DASHBOARD} title="Analytics Dashboard" />
        </div>

        {/* Conditional Feature Rendering */}
        <div className="space-y-6">
          <FeatureFlag flag={FeatureFlags.NEW_DASHBOARD} fallback={<OldDashboardComponent />}>
            <NewDashboardComponent />
          </FeatureFlag>

          <FeatureFlag flag={FeatureFlags.ADVANCED_SEARCH}>
            <AdvancedSearchComponent />
          </FeatureFlag>

          <FeatureFlag flag={FeatureFlags.BETA_FEATURES}>
            <BetaFeaturesComponent />
          </FeatureFlag>

          {/* A/B Testing Example */}
          <FeatureVariant
            flag={FeatureFlags.CHECKOUT_FLOW_V2}
            variants={{
              control: <CheckoutFlowV1 />,
              'variant-a': <CheckoutFlowV2A />,
              'variant-b': <CheckoutFlowV2B />,
            }}
          />

          {/* Maintenance Mode Example */}
          <FeatureFlag flag={FeatureFlags.MAINTENANCE_MODE}>
            <MaintenanceModeComponent />
          </FeatureFlag>
        </div>

        {/* All Flags Debug View */}
        <details className="mt-8">
          <summary className="cursor-pointer text-lg font-semibold text-gray-700 hover:text-gray-900">
            Debug: All Feature Flags
          </summary>
          <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
            {JSON.stringify(flags, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}

// Individual flag status card
function FlagStatusCard({ flagKey, title }: { flagKey: string; title: string }) {
  const { isEnabled } = useFeatureFlag(flagKey);
  
  return (
    <div className={`p-4 rounded-lg border-2 ${isEnabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
      </div>
      <p className={`text-sm mt-1 ${isEnabled ? 'text-green-700' : 'text-gray-600'}`}>
        {isEnabled ? 'Enabled' : 'Disabled'}
      </p>
      <code className="text-xs text-gray-500 mt-2 block">{flagKey}</code>
    </div>
  );
}

// Example components for different features
function NewDashboardComponent() {
  return (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">🆕 New Dashboard</h3>
      <p className="text-blue-800">
        This is the new dashboard with improved UI and enhanced features. 
        This component is only shown when the NEW_DASHBOARD feature flag is enabled.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="bg-blue-100 p-3 rounded text-center">
          <div className="text-2xl font-bold text-blue-900">42</div>
          <div className="text-sm text-blue-700">Active Users</div>
        </div>
        <div className="bg-blue-100 p-3 rounded text-center">
          <div className="text-2xl font-bold text-blue-900">1.2k</div>
          <div className="text-sm text-blue-700">Total Sessions</div>
        </div>
        <div className="bg-blue-100 p-3 rounded text-center">
          <div className="text-2xl font-bold text-blue-900">98%</div>
          <div className="text-sm text-blue-700">Uptime</div>
        </div>
      </div>
    </div>
  );
}

function OldDashboardComponent() {
  return (
    <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Classic Dashboard</h3>
      <p className="text-gray-700">
        This is the classic dashboard. It's shown when the NEW_DASHBOARD feature flag is disabled.
      </p>
      <div className="mt-4">
        <div className="bg-gray-100 p-4 rounded">
          <p className="text-gray-600">Basic dashboard content...</p>
        </div>
      </div>
    </div>
  );
}

function AdvancedSearchComponent() {
  return (
    <div className="p-6 bg-purple-50 border border-purple-200 rounded-lg">
      <h3 className="text-lg font-semibold text-purple-900 mb-2">🔍 Advanced Search</h3>
      <p className="text-purple-800 mb-4">
        Advanced search functionality with filters, sorting, and real-time suggestions.
      </p>
      <div className="space-y-3">
        <input 
          type="text" 
          placeholder="Search with advanced filters..." 
          className="w-full p-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">Date Range</button>
          <button className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">Category</button>
          <button className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">Status</button>
        </div>
      </div>
    </div>
  );
}

function BetaFeaturesComponent() {
  return (
    <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
      <h3 className="text-lg font-semibold text-yellow-900 mb-2">🧪 Beta Features</h3>
      <p className="text-yellow-800 mb-4">
        Experimental features available to beta users. These features are still in development.
      </p>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-yellow-800">AI-powered recommendations</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-yellow-800">Real-time collaboration</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
          <span className="text-yellow-800">Advanced analytics</span>
        </div>
      </div>
    </div>
  );
}

// A/B Testing Components
function CheckoutFlowV1() {
  return (
    <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
      <h3 className="text-lg font-semibold text-green-900 mb-2">🛒 Checkout Flow (Control)</h3>
      <p className="text-green-800">Original checkout flow with standard layout.</p>
    </div>
  );
}

function CheckoutFlowV2A() {
  return (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <h3 className="text-lg font-semibold text-blue-900 mb-2">🛒 Checkout Flow (Variant A)</h3>
      <p className="text-blue-800">Simplified checkout with fewer steps and larger buttons.</p>
    </div>
  );
}

function CheckoutFlowV2B() {
  return (
    <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
      <h3 className="text-lg font-semibold text-indigo-900 mb-2">🛒 Checkout Flow (Variant B)</h3>
      <p className="text-indigo-800">Express checkout with one-click payment options.</p>
    </div>
  );
}

function MaintenanceModeComponent() {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-lg font-semibold text-red-900 mb-2">🚧 Maintenance Mode</h3>
      <p className="text-red-800">
        The system is currently under maintenance. Some features may be unavailable.
      </p>
    </div>
  );
}

// HOC Example
const PremiumFeatureComponent = withFeatureFlag(FeatureFlags.PREMIUM_FEATURES)(
  function PremiumFeature() {
    return (
      <div className="p-6 bg-gold-50 border border-gold-200 rounded-lg">
        <h3 className="text-lg font-semibold text-gold-900 mb-2">💎 Premium Feature</h3>
        <p className="text-gold-800">This premium feature is only available to premium users.</p>
      </div>
    );
  }
);

export default FeatureFlagDemo;
