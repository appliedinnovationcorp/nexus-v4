import { useEffect, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../hooks/useAuth'

interface AuthGuardProps {
  children: ReactNode
  requireAuth?: boolean
  requiredRole?: string | string[]
  fallback?: ReactNode
}

export function AuthGuard({ 
  children, 
  requireAuth = true, 
  requiredRole,
  fallback 
}: AuthGuardProps) {
  const { isAuthenticated, isLoading, hasRole, user } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(router.asPath)}`)
    }
  }, [isLoading, requireAuth, isAuthenticated, router])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600">
            Please sign in to access this page.
          </p>
        </div>
      </div>
    )
  }

  // Check role requirement
  if (requiredRole && !hasRole(requiredRole)) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Access Denied
          </h2>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Required role: {Array.isArray(requiredRole) ? requiredRole.join(', ') : requiredRole}
          </p>
          <p className="text-sm text-gray-500">
            Your role: {user?.role}
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
