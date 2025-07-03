'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { UserProfile } from '../../components/auth/UserProfile'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface ProtectedData {
  message: string
  user: {
    id: string
    username: string
    role: string
  }
  timestamp: string
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [protectedData, setProtectedData] = useState<ProtectedData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  const fetchProtectedData = async () => {
    if (!session?.accessToken) return

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/protected/profile`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch protected data')
      }

      const data = await response.json()
      setProtectedData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Welcome to your protected dashboard</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* User Profile */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Profile</h2>
            <UserProfile />
          </div>

          {/* Protected API Test */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Protected API Test</h2>
            <div className="bg-white shadow rounded-lg p-6">
              <button
                onClick={fetchProtectedData}
                disabled={loading}
                className="mb-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Fetch Protected Data'}
              </button>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {protectedData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">Protected Data Retrieved:</h3>
                  <pre className="text-sm text-green-700 whitespace-pre-wrap">
                    {JSON.stringify(protectedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Session Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Session Debug Info</h2>
            <div className="bg-white shadow rounded-lg p-6">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto">
                {JSON.stringify(session, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
