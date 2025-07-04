# Authentication System Documentation

**Date:** 2025-07-01  
**Task:** Implement JWT-based authentication in NestJS (login/register). Implement NextAuth.js on the frontend to manage sessions and call the backend.

## ✅ Comprehensive JWT Authentication System Successfully Implemented

**Objective:**
Implement a complete JWT-based authentication system with NestJS backend and NextAuth.js frontend integration for secure user authentication and session management.

## 🔐 Backend Authentication (NestJS + JWT)

### Authentication Module Architecture

#### Core Components
- **AuthModule**: Main authentication module with JWT configuration
- **AuthService**: Business logic for authentication operations
- **AuthController**: HTTP endpoints for authentication
- **JWT Strategy**: Passport strategy for JWT token validation
- **Local Strategy**: Passport strategy for username/password authentication
- **Guards**: Authentication and authorization guards
- **DTOs**: Data transfer objects with validation

#### JWT Configuration
```typescript
JwtModule.registerAsync({
  imports: [ConfigModule],
  useFactory: async (configService: ConfigService) => ({
    secret: configService.get<string>('JWT_SECRET'),
    signOptions: {
      expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
      issuer: configService.get<string>('JWT_ISSUER', 'nexus-api'),
      audience: configService.get<string>('JWT_AUDIENCE', 'nexus-app'),
    },
  }),
  inject: [ConfigService],
})
```

### Authentication Endpoints

#### POST /auth/login
- **Purpose**: User authentication with email/password
- **Input**: LoginDto (email, password)
- **Output**: AuthResponse (user info + JWT tokens)
- **Features**: 
  - Password validation with bcrypt
  - Account status verification
  - Last login timestamp update
  - Activity logging

#### POST /auth/register
- **Purpose**: New user registration
- **Input**: RegisterDto (email, username, firstName, lastName, password, etc.)
- **Output**: AuthResponse (user info + JWT tokens)
- **Features**:
  - Email/username uniqueness validation
  - Strong password requirements
  - Automatic profile creation
  - Auto-login after registration

#### POST /auth/refresh
- **Purpose**: Refresh expired access tokens
- **Input**: RefreshTokenDto (refreshToken)
- **Output**: AuthTokens (new access + refresh tokens)
- **Features**:
  - Refresh token validation
  - Token rotation for security
  - Database token verification

#### POST /auth/logout
- **Purpose**: User logout and token revocation
- **Input**: Optional refresh token
- **Output**: Success message
- **Features**:
  - Single or all token revocation
  - Activity logging

#### POST /auth/change-password
- **Purpose**: Change user password
- **Input**: ChangePasswordDto (currentPassword, newPassword)
- **Output**: Success message
- **Features**:
  - Current password verification
  - All refresh tokens revocation
  - Password strength validation

#### GET /auth/me
- **Purpose**: Get current user profile
- **Output**: User profile with preferences
- **Features**:
  - JWT token validation
  - Complete user information

### Security Features

#### Password Security
```typescript
// Strong password hashing with bcrypt
const hashedPassword = await bcrypt.hash(password, 12)

// Password validation regex
@Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
  message: 'Password must contain uppercase, lowercase, number, and special character',
})
```

#### Token Management
- **Access Tokens**: Short-lived (15 minutes) for API access
- **Refresh Tokens**: Long-lived (7 days) for token renewal
- **Token Rotation**: New refresh token issued on each refresh
- **Token Revocation**: Database-tracked token invalidation

#### Database Schema
```prisma
model RefreshToken {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  userAgent String?  @map("user_agent")
  ipAddress String?  @map("ip_address")
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PasswordReset {
  id        String   @id @default(uuid())
  userId    String   @map("user_id")
  token     String   @unique
  expiresAt DateTime @map("expires_at")
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## 🎨 Frontend Authentication (NextAuth.js)

### NextAuth.js Configuration

#### Credentials Provider
```typescript
CredentialsProvider({
  id: 'credentials',
  name: 'credentials',
  credentials: {
    email: { label: 'Email', type: 'email' },
    password: { label: 'Password', type: 'password' },
  },
  async authorize(credentials) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })

    const authResponse = await response.json()
    
    if (!response.ok) {
      throw new Error(authResponse.message || 'Authentication failed')
    }

    return {
      id: authResponse.user.id,
      email: authResponse.user.email,
      name: `${authResponse.user.firstName} ${authResponse.user.lastName}`,
      // ... other user properties
      accessToken: authResponse.tokens.accessToken,
      refreshToken: authResponse.tokens.refreshToken,
      accessTokenExpires: Date.now() + authResponse.tokens.expiresIn * 1000,
    }
  },
})
```

#### Token Refresh Logic
```typescript
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: token.refreshToken }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) throw refreshedTokens

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      refreshToken: refreshedTokens.refreshToken ?? token.refreshToken,
      accessTokenExpires: Date.now() + refreshedTokens.expiresIn * 1000,
    }
  } catch (error) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}
```

### Authentication Pages

#### Sign In Page (`/auth/signin`)
- **Features**:
  - Email/password form with validation
  - Loading states and error handling
  - Redirect to intended page after login
  - CSRF token protection
  - Responsive design with Tailwind CSS

#### Sign Up Page (`/auth/signup`)
- **Features**:
  - Complete registration form
  - Client-side validation
  - Password strength requirements
  - Auto-login after successful registration
  - Error handling and user feedback

### Custom Hooks

#### useAuth Hook
```typescript
export function useAuth(): UseAuthReturn {
  const { data: session, status } = useSession()
  const router = useRouter()

  const isLoading = status === 'loading'
  const isAuthenticated = !!session && !session.error
  const user = session?.user ? {
    id: session.user.id,
    email: session.user.email || '',
    username: session.user.username,
    role: session.user.role,
    // ... other properties
  } : null

  const hasRole = useCallback((role: string | string[]): boolean => {
    if (!user) return false
    return Array.isArray(role) ? role.includes(user.role) : user.role === role
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
    accessToken: session?.accessToken || null,
    error: session?.error || null,
    signOut: handleSignOut,
    hasRole,
    requireAuth,
  }
}
```

#### useAuthenticatedApi Hook
```typescript
export function useAuthenticatedApi(): AuthenticatedApiClient {
  const { accessToken, isAuthenticated, requireAuth } = useAuth()

  const createAuthenticatedRequest = useCallback(
    async <T>(method: string, endpoint: string, data?: any, options: RequestInit = {}) => {
      if (!isAuthenticated || !accessToken) {
        requireAuth()
        throw new ApiError({ message: 'Authentication required', status: 401 })
      }

      const authHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      }

      // Make authenticated API call with automatic token refresh handling
      return await apiClient[method.toLowerCase()](endpoint, data, { ...options, headers: authHeaders })
    },
    [accessToken, isAuthenticated, requireAuth]
  )

  return { get, post, put, patch, delete: deleteRequest }
}
```

### Authentication Components

#### AuthGuard Component
```typescript
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

  // Loading, authentication, and role validation logic
  return <>{children}</>
}
```

#### SessionProvider Component
```typescript
export function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider session={session} refetchInterval={5 * 60}>
      {children}
    </NextAuthSessionProvider>
  )
}
```

## 🔒 Security Implementation

### Backend Security
- **Password Hashing**: bcrypt with salt rounds of 12
- **JWT Security**: Signed tokens with secret key rotation capability
- **Token Expiration**: Short-lived access tokens (15 minutes)
- **Refresh Token Rotation**: New refresh token on each use
- **Account Status Validation**: Active account requirement
- **Rate Limiting**: Throttling for authentication endpoints
- **Input Validation**: Comprehensive DTO validation with class-validator

### Frontend Security
- **CSRF Protection**: NextAuth.js built-in CSRF tokens
- **Secure Storage**: HTTP-only cookies for session management
- **Token Refresh**: Automatic token renewal before expiration
- **Route Protection**: Authentication guards for protected pages
- **Error Handling**: Secure error messages without information leakage

### Environment Variables
```bash
# Backend (.env)
JWT_SECRET=your-super-secret-jwt-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=nexus-api
JWT_AUDIENCE=nexus-app

# Frontend (.env.local)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

## 🧪 Testing Implementation

### Backend Tests
- **AuthService Tests**: Complete business logic validation
- **AuthController Tests**: HTTP endpoint testing
- **JWT Strategy Tests**: Token validation testing
- **Guard Tests**: Authentication and authorization testing
- **Integration Tests**: End-to-end authentication flow

### Frontend Tests
- **Hook Tests**: useAuth and useAuthenticatedApi testing
- **Component Tests**: Authentication page and guard testing
- **API Integration Tests**: Backend communication testing

## 📊 Usage Examples

### Backend Usage
```typescript
// Protected endpoint
@UseGuards(JwtAuthGuard)
@Get('profile')
async getProfile(@CurrentUser() user: User) {
  return user
}

// Role-based protection
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('admin-only')
async adminEndpoint() {
  return { message: 'Admin access granted' }
}

// Public endpoint
@Public()
@Get('public')
async publicEndpoint() {
  return { message: 'Public access' }
}
```

### Frontend Usage
```typescript
// Protected page
export default function ProtectedPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  
  if (isLoading) return <div>Loading...</div>
  if (!isAuthenticated) return <div>Please sign in</div>
  
  return <div>Welcome, {user.name}!</div>
}

// Authenticated API call
function UserProfile() {
  const api = useAuthenticatedApi()
  
  const updateProfile = async (data) => {
    try {
      const response = await api.patch('/users/me', data)
      console.log('Profile updated:', response.data)
    } catch (error) {
      console.error('Update failed:', error)
    }
  }
  
  return <ProfileForm onSubmit={updateProfile} />
}

// Role-based rendering
function AdminPanel() {
  const { hasRole } = useAuth()
  
  if (!hasRole(['ADMIN', 'MODERATOR'])) {
    return <div>Access denied</div>
  }
  
  return <AdminDashboard />
}
```

This comprehensive authentication system provides secure, scalable, and user-friendly authentication for the Nexus application with proper JWT token management, session handling, and security best practices.
