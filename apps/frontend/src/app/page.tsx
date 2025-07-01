import { Metadata } from 'next';
import { ApiStatus } from '../components/ApiStatus';
import { FeatureCard } from '../components/FeatureCard';

export const metadata: Metadata = {
  title: 'Nexus Frontend - Modern Full-Stack Application',
  description: 'A comprehensive Next.js frontend built with TypeScript, Tailwind CSS, and modern best practices.',
};

export default function HomePage() {
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
            <ApiStatus />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Nexus Workspace
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            A modern full-stack application built with Next.js, NestJS, TypeScript, and Tailwind CSS.
            Experience the power of a well-architected monorepo workspace.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors">
              Get Started
            </button>
            <button className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-3 rounded-lg font-semibold transition-colors">
              View Documentation
            </button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
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
            title="NestJS Backend"
            description="Robust backend API built with NestJS, featuring health checks, Swagger documentation, and production-ready configuration."
            icon="🚀"
          />
          <FeatureCard
            title="Monorepo Workspace"
            description="Organized pnpm workspace with Turbo for efficient builds, shared packages, and scalable development."
            icon="📦"
          />
          <FeatureCard
            title="Production Ready"
            description="Docker containerization, environment configuration, health monitoring, and deployment-ready setup."
            icon="🏗️"
          />
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Technology Stack
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {[
              { name: 'Next.js', color: 'bg-black' },
              { name: 'React', color: 'bg-blue-500' },
              { name: 'TypeScript', color: 'bg-blue-600' },
              { name: 'Tailwind', color: 'bg-cyan-500' },
              { name: 'NestJS', color: 'bg-red-500' },
              { name: 'pnpm', color: 'bg-orange-500' },
            ].map((tech) => (
              <div key={tech.name} className="text-center">
                <div className={`${tech.color} w-12 h-12 rounded-lg mx-auto mb-2 flex items-center justify-center`}>
                  <span className="text-white font-bold text-sm">
                    {tech.name.charAt(0)}
                  </span>
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
          </div>
        </div>
      </footer>
    </div>
  );
}
