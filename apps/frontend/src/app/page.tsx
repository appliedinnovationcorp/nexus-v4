'use client'

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Button } from '@nexus/ui';
import { ApiStatus } from '../components/ApiStatus';
import { FeatureCard } from '../components/FeatureCard';

export default function HomePage() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">N</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Nexus Frontend</h1>
            </div>
            <div className="flex items-center space-x-4">
              {status === 'authenticated' && session ? (
                <>
                  <div className="flex items-center space-x-2">
                    {session.user.image ? (
                      <img
                        className="h-8 w-8 rounded-full"
                        src={session.user.image}
                        alt="User avatar"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
                        </span>
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700">
                      {session.user.name || `${session.user.firstName} ${session.user.lastName}`}
                    </span>
                  </div>
                  <Link href="/dashboard">
                    <Button variant="primary" size="sm">
                      Dashboard
                    </Button>
                  </Link>
                </>
              ) : status === 'unauthenticated' ? (
                <>
                  <Link href="/auth/signin">
                    <Button variant="outline" size="sm">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button variant="primary" size="sm">
                      Sign Up
                    </Button>
                  </Link>
                </>
              ) : (
                <div className="animate-pulse">
                  <div className="h-8 w-20 bg-gray-200 rounded"></div>
                </div>
              )}
              <Link href="/integration-demo">
                <Button variant="outline" size="sm">
                  Integration Demo
                </Button>
              </Link>
              <Link href="/ui-demo">
                <Button variant="outline" size="sm">
                  UI Demo
                </Button>
              </Link>
              <ApiStatus />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Nexus Workspace</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            A modern full-stack application built with Next.js, NestJS, TypeScript, and Tailwind
            CSS. Experience the power of a well-architected monorepo workspace with shared UI
            components, types, and utilities - now with secure authentication!
          </p>
          
          {/* Authentication Status */}
          {status === 'authenticated' && session && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 max-w-md mx-auto">
              <p className="text-green-800 font-medium">
                Welcome back, {session.user.firstName || session.user.name}!
              </p>
              <p className="text-green-600 text-sm">
                You're signed in as {session.user.role.toLowerCase()}
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {status === 'authenticated' ? (
              <>
                <Link href="/dashboard">
                  <Button variant="primary" size="lg" rightIcon={<DashboardIcon />}>
                    Go to Dashboard
                  </Button>
                </Link>
                <Link href="/integration-demo">
                  <Button variant="outline" size="lg" rightIcon={<IntegrationIcon />}>
                    View Integration Demo
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="primary" size="lg" rightIcon={<LoginIcon />}>
                    Sign In to Continue
                  </Button>
                </Link>
                <Link href="/integration-demo">
                  <Button variant="outline" size="lg" rightIcon={<IntegrationIcon />}>
                    View Integration Demo
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          <FeatureCard
            title="Secure Authentication"
            description="NextAuth.js integration with NestJS backend, JWT tokens, role-based access control, and automatic token refresh."
            icon="🔐"
          />
          <FeatureCard
            title="Next.js 15"
            description="Built with the latest Next.js featuring App Router, Server Components, and Turbopack for lightning-fast development."
            icon="⚡"
          />
          <FeatureCard
            title="TypeScript"
            description="Full TypeScript support with strict mode, shared types across the workspace, and excellent developer experience."
            icon="🔷"
          />
          <FeatureCard
            title="Tailwind CSS"
            description="Modern utility-first CSS framework for rapid UI development with responsive design and dark mode support."
            icon="🎨"
          />
          <FeatureCard
            title="Shared Packages"
            description="Centralized UI components (@nexus/ui), shared types (@nexus/shared-types), and utilities (@nexus/shared-utils) for consistent development."
            icon="📦"
          />
          <FeatureCard
            title="NestJS Backend"
            description="Robust backend API built with NestJS, featuring health checks, Swagger documentation, and production-ready configuration."
            icon="🚀"
          />
        </div>

        {/* Authentication Features */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-16">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Authentication Features
          </h3>
          <p className="text-gray-600 text-center mb-8">
            Comprehensive authentication system with NextAuth.js and NestJS backend
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">🔑</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">JWT Tokens</h4>
              <p className="text-sm text-gray-600">
                Secure JWT authentication with automatic refresh and session management
              </p>
            </div>

            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="w-12 h-12 bg-green-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">🛡️</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Protected Routes</h4>
              <p className="text-sm text-gray-600">
                Role-based access control with automatic route protection
              </p>
            </div>

            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="w-12 h-12 bg-purple-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">👤</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">User Management</h4>
              <p className="text-sm text-gray-600">
                Complete user registration, login, and profile management
              </p>
            </div>

            <div className="text-center p-6 bg-orange-50 rounded-lg">
              <div className="w-12 h-12 bg-orange-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">🔄</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Token Refresh</h4>
              <p className="text-sm text-gray-600">
                Automatic token refresh with secure session persistence
              </p>
            </div>
          </div>

          <div className="text-center">
            {status === 'authenticated' ? (
              <Link href="/dashboard">
                <Button variant="outline" rightIcon={<ArrowRightIcon />}>
                  View Your Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/auth/signin">
                <Button variant="outline" rightIcon={<ArrowRightIcon />}>
                  Try Authentication
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Shared Packages Showcase */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-16">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Shared Package Ecosystem
          </h3>
          <p className="text-gray-600 text-center mb-8">
            Experience true monorepo benefits with shared code across all applications
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">UI</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">@nexus/ui</h4>
              <p className="text-sm text-gray-600 mb-4">
                Shared UI components with consistent design system and accessibility
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm">Primary</Button>
                <Button variant="outline" size="sm">Outline</Button>
              </div>
            </div>

            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="w-12 h-12 bg-green-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">TS</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">@nexus/shared-types</h4>
              <p className="text-sm text-gray-600 mb-4">
                TypeScript interfaces and types shared between frontend and backend
              </p>
              <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                User, ApiResponse, HealthCheck
              </div>
            </div>

            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="w-12 h-12 bg-purple-600 rounded-lg mx-auto mb-4 flex items-center justify-center">
                <span className="text-white font-bold">FN</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">@nexus/shared-utils</h4>
              <p className="text-sm text-gray-600 mb-4">
                Utility functions for formatting, validation, and API communication
              </p>
              <div className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                formatDate, validateEmail, apiRequest
              </div>
            </div>
          </div>

          <div className="text-center">
            <Link href="/integration-demo">
              <Button variant="outline" rightIcon={<ArrowRightIcon />}>
                See All Packages in Action
              </Button>
            </Link>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Technology Stack</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6">
            {[
              { name: 'Next.js', color: 'bg-black' },
              { name: 'React', color: 'bg-blue-500' },
              { name: 'TypeScript', color: 'bg-blue-600' },
              { name: 'Tailwind', color: 'bg-cyan-500' },
              { name: 'NextAuth', color: 'bg-purple-500' },
              { name: 'NestJS', color: 'bg-red-500' },
              { name: 'pnpm', color: 'bg-orange-500' },
            ].map(tech => (
              <div key={tech.name} className="text-center">
                <div
                  className={`${tech.color} w-12 h-12 rounded-lg mx-auto mb-2 flex items-center justify-center`}
                >
                  <span className="text-white font-bold text-sm">{tech.name.charAt(0)}</span>
                </div>
                <span className="text-sm font-medium text-gray-700">{tech.name}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2025 Nexus Workspace. Built with ❤️ using modern web technologies.</p>
            <p className="mt-2 text-sm">
              Demonstrating end-to-end monorepo integration with secure authentication
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Icon components
function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function IntegrationIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
    </svg>
  );
}
