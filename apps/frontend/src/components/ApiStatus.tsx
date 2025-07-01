'use client';

import { useState, useEffect } from 'react';

interface ApiStatusProps {
  className?: string;
}

export function ApiStatus({ className = '' }: ApiStatusProps) {
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [responseTime, setResponseTime] = useState<number | null>(null);

  useEffect(() => {
    const checkApiStatus = async () => {
      try {
        const startTime = Date.now();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
        
        const response = await fetch(`${apiUrl}/health/ready`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const endTime = Date.now();
        const responseTimeMs = endTime - startTime;

        if (response.ok) {
          setStatus('online');
          setResponseTime(responseTimeMs);
        } else {
          setStatus('offline');
          setResponseTime(null);
        }
      } catch (error) {
        console.warn('API health check failed:', error);
        setStatus('offline');
        setResponseTime(null);
      }
    };

    checkApiStatus();
    const interval = setInterval(checkApiStatus, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-red-500';
      case 'loading':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'online':
        return `API Online${responseTime ? ` (${responseTime}ms)` : ''}`;
      case 'offline':
        return 'API Offline';
      case 'loading':
        return 'Checking API...';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
      <span className="text-sm font-medium text-gray-700">
        {getStatusText()}
      </span>
    </div>
  );
}
