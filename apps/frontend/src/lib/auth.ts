import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { JWT } from 'next-auth/jwt'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

interface AuthResponse {
  user: {
    id: string
    email: string
    username: string
    firstName: string
    lastName: string
    role: string
    emailVerified: boolean
    avatarUrl?: string
  }
  tokens: {
    accessToken: string
    refreshToken: string
    expiresIn: number
    tokenType: string
  }
}

interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: token.refreshToken,
      }),
    })

    const refreshedTokens: RefreshTokenResponse = await response.json()

    if (!response.ok) {
      throw refreshedTokens
    }

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken ?? token.refreshToken,
      accessTokenExpires: Date.now() + refreshedTokens.expiresIn * 1000,
    }
  } catch (error) {
    console.error('Error refreshing access token:', error)
    return {
      ...token,
      error: 'RefreshAccessTokenError',
    }
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'credentials',
      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'user@example.com',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.message || 'Authentication failed')
          }

          const authResponse: AuthResponse = await response.json()

          return {
            id: authResponse.user.id,
            email: authResponse.user.email,
            name: `${authResponse.user.firstName} ${authResponse.user.lastName}`,
            username: authResponse.user.username,
            firstName: authResponse.user.firstName,
            lastName: authResponse.user.lastName,
            role: authResponse.user.role,
            emailVerified: authResponse.user.emailVerified,
            image: authResponse.user.avatarUrl,
            accessToken: authResponse.tokens.accessToken,
            refreshToken: authResponse.tokens.refreshToken,
            accessTokenExpires: Date.now() + authResponse.tokens.expiresIn * 1000,
          }
        } catch (error) {
          console.error('Authentication error:', error)
          throw new Error(error instanceof Error ? error.message : 'Authentication failed')
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: user.accessTokenExpires,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            emailVerified: user.emailVerified,
            image: user.image,
          },
        }
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.user?.id,
          username: token.user?.username,
          firstName: token.user?.firstName,
          lastName: token.user?.lastName,
          role: token.user?.role,
          emailVerified: token.user?.emailVerified,
        }
        session.accessToken = token.accessToken as string
        session.error = token.error as string
      }

      return session
    },
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}
