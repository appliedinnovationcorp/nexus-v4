'use client';

import { useState, useEffect } from 'react';
import { Button } from '@nexus/ui';
import {
  formatDate,
  formatRelativeTime,
  formatCurrency,
  formatNumber,
  truncateText,
  capitalize,
  toTitleCase,
  formatFileSize,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  validateRequiredFields,
  createApiResponse,
  isErrorResponse,
  extractApiData,
} from '@nexus/shared-utils';
import type {
  User,
  UserRole,
  UserStatus,
  HealthCheckResponse,
} from '@nexus/shared-types';

export default function IntegrationDemoPage() {
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [healthData, setHealthData] = useState<HealthCheckResponse | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    firstName: '',
    lastName: '',
  });
  const [validationResults, setValidationResults] = useState<Record<string, {
    isValid: boolean;
    errors?: string[];
    value?: string;
    missingFields?: string[];
  }>>({});

  // Demo data
  const sampleUser: User = {
    id: '1',
    email: 'john.doe@example.com',
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user' as UserRole,
    status: 'active' as UserStatus,
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-12-01T14:22:00Z',
    lastLoginAt: '2024-12-31T09:15:00Z',
  };

  const sampleNumbers = [1234.56, 999999, 42, 1000000.789];
  const sampleDates = [
    new Date('2024-01-01'),
    new Date('2024-06-15'),
    new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
  ];

  const sampleTexts = [
    'This is a short text',
    'This is a much longer text that will definitely exceed the truncation limit and should be cut off with ellipsis',
    'hello world',
    'the quick brown fox jumps over the lazy dog',
  ];

  const sampleFileSizes = [1024, 1048576, 1073741824, 512, 2048576789];

  // Simulate API call
  useEffect(() => {
    const fetchHealthCheck = async () => {
      try {
        // Simulate API call with shared utilities
        const mockResponse = createApiResponse<HealthCheckResponse>({
          status: 'ok',
          timestamp: new Date().toISOString(),
          uptime: 86400,
          version: '1.0.0',
          environment: 'development',
          services: {
            database: 'connected',
            redis: 'connected',
            external: 'connected',
          },
        });

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (isErrorResponse(mockResponse)) {
          throw new Error(mockResponse.error);
        }

        const data = extractApiData(mockResponse);
        setHealthData(data);
        setApiStatus('success');
      } catch (error) {
        console.error('Health check failed:', error);
        setApiStatus('error');
      }
    };

    fetchHealthCheck();
  }, []);

  // Handle form validation
  const handleValidation = () => {
    const results: Record<string, {
      isValid: boolean;
      errors?: string[];
      value?: string;
      missingFields?: string[];
    }> = {};

    // Email validation
    results.email = {
      isValid: isValidEmail(formData.email),
      value: formData.email,
    };

    // Username validation
    results.username = isValidUsername(formData.username);

    // Password validation
    results.password = isValidPassword(formData.password);

    // Required fields validation
    results.requiredFields = validateRequiredFields(formData, [
      'email',
      'username',
      'firstName',
      'lastName',
    ]);

    setValidationResults(results);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Shared Code Integration Demo
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            Demonstrating end-to-end monorepo integration with shared packages
          </p>
          <div className="mt-6 flex justify-center">
            <div className="flex space-x-2 text-sm text-gray-500">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">@nexus/ui</span>
              <span className="bg-green-100 text-green-800 px-2 py-1 rounded">@nexus/shared-types</span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">@nexus/shared-utils</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Integration Demo */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">API Integration</h2>
            <p className="text-gray-600 mb-6">
              Using shared types and utilities for API communication
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Health Check Status:</span>
                {apiStatus === 'loading' && (
                  <Button loading size="sm" variant="outline">
                    Checking...
                  </Button>
                )}
                {apiStatus === 'success' && (
                  <span className="text-green-600 font-semibold">✓ Connected</span>
                )}
                {apiStatus === 'error' && (
                  <span className="text-red-600 font-semibold">✗ Failed</span>
                )}
              </div>

              {healthData && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Status:</span> {healthData.status}
                    </div>
                    <div>
                      <span className="font-medium">Version:</span> {healthData.version}
                    </div>
                    <div>
                      <span className="font-medium">Environment:</span> {healthData.environment}
                    </div>
                    <div>
                      <span className="font-medium">Uptime:</span> {formatNumber(healthData.uptime)}s
                    </div>
                  </div>
                  <div className="mt-3">
                    <span className="font-medium text-sm">Services:</span>
                    <div className="flex space-x-4 mt-1">
                      {Object.entries(healthData.services).map(([service, status]) => (
                        <span
                          key={service}
                          className={`text-xs px-2 py-1 rounded ${
                            status === 'connected'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {capitalize(service)}: {status}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Data Demo */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Shared Types Demo</h2>
            <p className="text-gray-600 mb-6">
              Using shared TypeScript types across the application
            </p>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Sample User Data</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Name:</span> {sampleUser.firstName} {sampleUser.lastName}
                  </div>
                  <div>
                    <span className="font-medium">Email:</span> {sampleUser.email}
                  </div>
                  <div>
                    <span className="font-medium">Username:</span> @{sampleUser.username}
                  </div>
                  <div>
                    <span className="font-medium">Role:</span>{' '}
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                      {capitalize(sampleUser.role)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>{' '}
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      {capitalize(sampleUser.status)}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {formatDate(sampleUser.createdAt)}
                  </div>
                  <div>
                    <span className="font-medium">Last Login:</span>{' '}
                    {sampleUser.lastLoginAt && formatRelativeTime(sampleUser.lastLoginAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Formatting Utilities Demo */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Formatting Utilities</h2>
            <p className="text-gray-600 mb-6">
              Shared formatting functions for consistent data display
            </p>

            <div className="space-y-6">
              {/* Numbers */}
              <div>
                <h3 className="font-semibold mb-2">Number Formatting</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {sampleNumbers.map((num, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">{num}:</span>
                      <span className="font-mono">{formatNumber(num)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Currency */}
              <div>
                <h3 className="font-semibold mb-2">Currency Formatting</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {sampleNumbers.slice(0, 3).map((num, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">{num}:</span>
                      <span className="font-mono text-green-600">{formatCurrency(num)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div>
                <h3 className="font-semibold mb-2">Date Formatting</h3>
                <div className="space-y-1 text-sm">
                  {sampleDates.map((date, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">
                        {index < 2 ? formatDate(date) : formatRelativeTime(date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Sizes */}
              <div>
                <h3 className="font-semibold mb-2">File Size Formatting</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {sampleFileSizes.map((size, index) => (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">{formatNumber(size)} bytes:</span>
                      <span className="font-mono">{formatFileSize(size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Validation Demo */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Validation Utilities</h2>
            <p className="text-gray-600 mb-6">
              Shared validation functions for form handling
            </p>

            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email address"
                  />
                  {validationResults.email && (
                    <p className={`text-xs mt-1 ${
                      validationResults.email.isValid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {validationResults.email.isValid ? '✓ Valid email' : '✗ Invalid email format'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                  />
                  {validationResults.username && (
                    <div className="mt-1">
                      <p className={`text-xs ${
                        validationResults.username.isValid ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {validationResults.username.isValid ? '✓ Valid username' : '✗ Invalid username'}
                      </p>
                      {validationResults.username.errors && validationResults.username.errors.length > 0 && (
                        <ul className="text-xs text-red-600 mt-1 space-y-1">
                          {validationResults.username.errors?.map((error: string, index: number) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                  />
                  {validationResults.password && (
                    <div className="mt-1">
                      <p className={`text-xs ${
                        validationResults.password.isValid ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {validationResults.password.isValid ? '✓ Strong password' : '✗ Weak password'}
                      </p>
                      {validationResults.password.errors && validationResults.password.errors.length > 0 && (
                        <ul className="text-xs text-red-600 mt-1 space-y-1">
                          {validationResults.password.errors?.map((error: string, index: number) => (
                            <li key={index}>• {error}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Last name"
                    />
                  </div>
                </div>
              </div>

              <Button onClick={handleValidation} variant="primary" fullWidth>
                Validate Form
              </Button>

              {validationResults.requiredFields && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className={`text-sm font-medium ${
                    validationResults.requiredFields.isValid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {validationResults.requiredFields.isValid 
                      ? '✓ All required fields completed' 
                      : `✗ Missing required fields: ${validationResults.requiredFields.missingFields?.join(', ')}`
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Text Utilities Demo */}
          <div className="bg-white rounded-xl shadow-sm p-6 lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Text Utilities</h2>
            <p className="text-gray-600 mb-6">
              Shared text processing and formatting functions
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-3">Text Truncation</h3>
                <div className="space-y-2">
                  {sampleTexts.map((text, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600 mb-1">Original:</p>
                      <p className="text-sm mb-2">{text}</p>
                      <p className="text-sm text-gray-600 mb-1">Truncated (30 chars):</p>
                      <p className="text-sm font-mono">{truncateText(text, 30)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-3">Text Transformation</h3>
                <div className="space-y-2">
                  {sampleTexts.slice(2).map((text, index) => (
                    <div key={index} className="p-3 bg-gray-50 rounded">
                      <p className="text-sm text-gray-600 mb-1">Original:</p>
                      <p className="text-sm mb-2">{text}</p>
                      <p className="text-sm text-gray-600 mb-1">Capitalized:</p>
                      <p className="text-sm font-mono mb-2">{capitalize(text)}</p>
                      <p className="text-sm text-gray-600 mb-1">Title Case:</p>
                      <p className="text-sm font-mono">{toTitleCase(text)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-12 text-center space-x-4">
          <Button
            onClick={() => window.history.back()}
            variant="ghost"
            leftIcon={<ArrowLeftIcon />}
          >
            Back to Home
          </Button>
          <Button
            onClick={() => window.location.href = '/ui-demo'}
            variant="outline"
            rightIcon={<ComponentIcon />}
          >
            View UI Components
          </Button>
        </div>
      </div>
    </div>
  );
}

// Icon components
function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ComponentIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );
}
