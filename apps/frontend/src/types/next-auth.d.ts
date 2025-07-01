import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT, DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      username: string
      firstName: string
      lastName: string
      role: string
      emailVerified: boolean
    } & DefaultSession['user']
    accessToken: string
    error?: string
  }

  interface User extends DefaultUser {
    username: string
    firstName: string
    lastName: string
    role: string
    emailVerified: boolean
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    user: {
      id: string
      email: string
      username: string
      firstName: string
      lastName: string
      role: string
      emailVerified: boolean
      image?: string
    }
    error?: string
  }
}
