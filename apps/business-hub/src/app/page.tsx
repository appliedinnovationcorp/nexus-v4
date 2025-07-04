import { Suspense } from 'react';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { QuickActions } from '@/components/dashboard/QuickActions';
import { BusinessInsights } from '@/components/dashboard/BusinessInsights';
import { IntegrationStatus } from '@/components/dashboard/IntegrationStatus';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function HomePage() {
  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <DashboardHeader />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Suspense fallback={<LoadingSpinner />}>
          <DashboardStats />
        </Suspense>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4">
          <Suspense fallback={<LoadingSpinner />}>
            <BusinessInsights />
          </Suspense>
        </div>
        <div className="col-span-3 space-y-4">
          <Suspense fallback={<LoadingSpinner />}>
            <RecentActivity />
          </Suspense>
          <Suspense fallback={<LoadingSpinner />}>
            <IntegrationStatus />
          </Suspense>
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<LoadingSpinner />}>
          <QuickActions />
        </Suspense>
      </div>
    </div>
  );
}
