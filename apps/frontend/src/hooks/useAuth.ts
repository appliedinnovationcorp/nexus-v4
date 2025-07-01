import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCallback } from 'react'

export interface AuthUser {
  id: string
  email: string
  name: string
  username: string
  firstName: string
  lastName: string
  role: string
  emailVerified: boolean
  image?: string
}

export interface UseAuthReturn {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  accessToken: string | null
  error: string | null
  signOut: () => Promise<void>
  hasRole: (role: string | string[]) => boolean
  requireAuth: () => void
}

export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isLoading = status === 'loading'
  const isAuthenticated = !!session && !session.error
  const user = session?.user ? {
    id: session.user.id,
    email: session.user.email || '',
    name: session.user.name || '',
    username: session.user.username,
    firstName: session.user.firstName,
    lastName: session.user.lastName,
    role: session.user.role,
    emailVerified: session.user.emailVerified,
    image: session.user.image,
  } : null

  const accessToken = session?.accessToken || null
  const error = session?.error || null

  const handleSignOut = useCallback(async () => {
    try {
      // Call backend logout endpoint if we have an access token
      if (accessToken) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        })
      }
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      // Always sign out from NextAuth
      await signOut({ callbackUrl: '/' })
    }
  }, [accessToken])

  const hasRole = useCallback((role: string | string[]): boolean => {
    if (!user) return false
    
    if (Array.isArray(role)) {
      return role.includes(user.role)
    }
    
    return user.role === role
  }, [user])

  const requireAuth = useCallback(() => {
    if (!isAuthenticated && !isLoading) {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(router.asPath)}`)
    }
  }, [isAuthenticated, isLoading, router])

  return {
    user,
    isLoading,
    isAuthenticated,
    accessToken,
    error,
    signOut: handleSignOut,
    hasRole,
    requireAuth,
  }
}
