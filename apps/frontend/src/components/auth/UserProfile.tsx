'use client'

import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'

export function UserProfile() {
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      await signOut({ callbackUrl: '/auth/signin' })
    } catch (error) {
      console.error('Sign out error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (status === 'unauthenticated' || !session) {
    return (
      <div className="text-center p-4">
        <p className="text-gray-600 mb-4">You are not signed in</p>
        <a
          href="/auth/signin"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Sign In
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="px-6 py-4">
        <div className="flex items-center">
          {session.user.image ? (
            <img
              className="h-12 w-12 rounded-full"
              src={session.user.image}
              alt={session.user.name || 'User avatar'}
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 font-medium">
                {session.user.name?.charAt(0) || session.user.email?.charAt(0) || 'U'}
              </span>
            </div>
          )}
          <div className="ml-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {session.user.name || `${session.user.firstName} ${session.user.lastName}`}
            </h2>
            <p className="text-sm text-gray-600">@{session.user.username}</p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Email:</span>
            <span className="text-sm text-gray-900">{session.user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Role:</span>
            <span className="text-sm text-gray-900">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                session.user.role === 'ADMIN' 
                  ? 'bg-red-100 text-red-800'
                  : session.user.role === 'MODERATOR'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}>
                {session.user.role}
              </span>
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm font-medium text-gray-500">Email Verified:</span>
            <span className="text-sm text-gray-900">
              {session.user.emailVerified ? (
                <span className="text-green-600">✓ Verified</span>
              ) : (
                <span className="text-red-600">✗ Not verified</span>
              )}
            </span>
          </div>
        </div>

        {session.error && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-2 rounded text-sm">
            Session error: {session.error}
          </div>
        )}

        <div className="mt-6 flex space-x-3">
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing out...' : 'Sign Out'}
          </button>
          <button className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium py-2 px-4 rounded-md">
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  )
}
