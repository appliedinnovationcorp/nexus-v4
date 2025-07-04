'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@nexus/ui';
import { Bell, Settings, User } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { NotificationDropdown } from '@/components/ui/NotificationDropdown';
import { UserDropdown } from '@/components/ui/UserDropdown';

export function DashboardHeader() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center justify-between space-y-2">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}!
        </h2>
        <p className="text-muted-foreground">
          Here's what's happening with your business today.
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        <ThemeToggle />
        
        <NotificationDropdown>
          <Button variant="ghost" size="sm" className="relative">
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full text-xs flex items-center justify-center text-white">
              3
            </span>
          </Button>
        </NotificationDropdown>
        
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
        
        <UserDropdown>
          <Button variant="ghost" size="sm">
            <User className="h-4 w-4" />
          </Button>
        </UserDropdown>
      </div>
    </div>
  );
}
