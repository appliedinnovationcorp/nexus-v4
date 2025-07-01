'use client';

import { Button } from '@nexus/ui';

export default function UIDemoPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            UI Components Demo
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Showcase of shared UI components from @nexus/ui package
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {/* Button Variants */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Button Variants</h2>
            <div className="flex flex-wrap gap-4">
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
          </section>

          {/* Button Sizes */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Button Sizes</h2>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
            </div>
          </section>

          {/* Button States */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Button States</h2>
            <div className="flex flex-wrap gap-4">
              <Button>Normal</Button>
              <Button loading>Loading</Button>
              <Button disabled>Disabled</Button>
            </div>
          </section>

          {/* Button with Icons */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Buttons with Icons</h2>
            <div className="flex flex-wrap gap-4">
              <Button leftIcon={<PlusIcon />}>Add Item</Button>
              <Button rightIcon={<ArrowRightIcon />}>Continue</Button>
              <Button leftIcon={<DownloadIcon />} variant="outline">
                Download
              </Button>
            </div>
          </section>

          {/* Full Width Button */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Full Width Button</h2>
            <div className="max-w-md">
              <Button fullWidth variant="primary">
                Full Width Button
              </Button>
            </div>
          </section>

          {/* Interactive Examples */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Interactive Examples</h2>
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => alert('Primary button clicked!')} variant="primary">
                Click Me
              </Button>
              <Button onClick={() => console.log('Secondary button clicked!')} variant="secondary">
                Log to Console
              </Button>
              <Button
                onClick={() => window.open('https://github.com', '_blank')}
                variant="outline"
                rightIcon={<ExternalLinkIcon />}
              >
                Open GitHub
              </Button>
            </div>
          </section>
        </div>

        {/* Navigation */}
        <div className="mt-12 text-center">
          <Button
            onClick={() => window.history.back()}
            variant="ghost"
            leftIcon={<ArrowLeftIcon />}
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}

// Simple icon components for demo purposes
function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  );
}
