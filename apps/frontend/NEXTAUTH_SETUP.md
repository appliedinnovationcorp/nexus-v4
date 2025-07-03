# NextAuth.js Integration with NestJS Backend

This document explains the complete NextAuth.js setup for the Nexus Frontend application, integrated with the NestJS backend authentication system.

## 🔧 Installation & Setup

### Dependencies Installed
```bash
pnpm add next-auth
```

### Environment Variables
Add these to your `.env.local` file:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=your-nextauth-secret-key-here

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## 📁 File Structure

```
src/
├── pages/api/auth/
│   └── [...nextauth].ts          # NextAuth API route
├── lib/
│   └── auth.ts                   # NextAuth configuration
├── components/
│   ├── providers/
│   │   └── SessionProvider.tsx   # Session provider wrapper
│   └── auth/
│       ├── SignInForm.tsx        # Sign in form component
│       ├── SignUpForm.tsx        # Sign up form component
│       └── UserProfile.tsx       # User profile component
├── app/
│   ├── layout.tsx                # Root layout with SessionProvider
│   ├── page.tsx                  # Homepage with auth status
│   ├── dashboard/
│   │   └── page.tsx              # Protected dashboard page
│   └── auth/
│       ├── signin/page.tsx       # Sign in page
│       ├── signup/page.tsx       # Sign up page
│       └── error/page.tsx        # Auth error page
└── types/
    └── next-auth.d.ts            # NextAuth type extensions
```

## 🔐 Authentication Flow

### 1. NextAuth Configuration (`src/lib/auth.ts`)

The auth configuration includes:
- **CredentialsProvider**: Integrates with NestJS `/auth/login` endpoint
- **JWT Strategy**: Handles token storage and refresh
- **Session Callbacks**: Manages user session data
- **Automatic Token Refresh**: Refreshes expired access tokens

Key features:
```typescript
// Credentials authentication
CredentialsProvider({
  async authorize(credentials) {
    // Calls NestJS /auth/login endpoint
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    })
    // Returns user data with tokens
  }
})

// Automatic token refresh
async function refreshAccessToken(token: JWT): Promise<JWT> {
  // Calls NestJS /auth/refresh endpoint
  // Returns new access and refresh tokens
}
```

### 2. Session Provider Wrapper

The app is wrapped with `SessionProvider` in the root layout:

```typescript
// src/app/layout.tsx
import { SessionProvider } from '../components/providers/SessionProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

### 3. Authentication Components

#### Sign In Form (`SignInForm.tsx`)
- Email/password form
- Calls `signIn('credentials', { email, password })`
- Handles authentication errors
- Redirects on successful login

#### Sign Up Form (`SignUpForm.tsx`)
- Registration form with validation
- Calls NestJS `/auth/register` endpoint directly
- Automatically signs in after successful registration

#### User Profile (`UserProfile.tsx`)
- Displays authenticated user information
- Shows user role, email verification status
- Provides sign out functionality

## 🛡️ Protected Routes

### Using `useSession` Hook

```typescript
'use client'
import { useSession } from 'next-auth/react'

export default function ProtectedPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <div>Loading...</div>
  if (status === 'unauthenticated') return <div>Access Denied</div>

  return <div>Welcome {session.user.name}!</div>
}
```

### Dashboard Example

The dashboard page (`/dashboard`) demonstrates:
- Session-based route protection
- API calls with authentication headers
- User profile display
- Protected data fetching

```typescript
// Making authenticated API calls
const response = await fetch(`${API_BASE_URL}/protected/profile`, {
  headers: {
    'Authorization': `Bearer ${session.accessToken}`,
    'Content-Type': 'application/json',
  },
})
```

## 🔄 Token Management

### Access Tokens
- Short-lived (15 minutes)
- Stored in session
- Automatically included in API calls
- Refreshed automatically when expired

### Refresh Tokens
- Long-lived (7 days)
- Used to obtain new access tokens
- Handled automatically by NextAuth

### Token Refresh Flow
1. Access token expires
2. NextAuth automatically calls refresh endpoint
3. New tokens are obtained and stored
4. User session continues seamlessly

## 📱 Pages & Routes

### Public Routes
- `/` - Homepage (shows auth status)
- `/auth/signin` - Sign in page
- `/auth/signup` - Sign up page
- `/auth/error` - Authentication error page

### Protected Routes
- `/dashboard` - User dashboard (requires authentication)

### API Routes
- `/api/auth/[...nextauth]` - NextAuth API endpoints
  - `/api/auth/signin` - Sign in
  - `/api/auth/signout` - Sign out
  - `/api/auth/session` - Get session
  - `/api/auth/csrf` - CSRF token

## 🎨 UI Components

### Authentication Status Display
The homepage shows different content based on authentication status:

```typescript
const { data: session, status } = useSession()

// Loading state
if (status === 'loading') return <LoadingSpinner />

// Unauthenticated state
if (status === 'unauthenticated') return (
  <div>
    <Link href="/auth/signin">Sign In</Link>
    <Link href="/auth/signup">Sign Up</Link>
  </div>
)

// Authenticated state
if (status === 'authenticated') return (
  <div>
    Welcome, {session.user.name}!
    <Link href="/dashboard">Dashboard</Link>
  </div>
)
```

### User Profile Display
Shows comprehensive user information:
- Name and username
- Email and verification status
- User role with color coding
- Avatar or initials
- Sign out functionality

## 🔧 TypeScript Integration

### Extended NextAuth Types (`src/types/next-auth.d.ts`)

```typescript
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
```

## 🚀 Usage Examples

### Basic Authentication Check
```typescript
import { useSession } from 'next-auth/react'

function MyComponent() {
  const { data: session } = useSession()
  
  if (session) {
    return <p>Signed in as {session.user.email}</p>
  }
  return <p>Not signed in</p>
}
```

### Sign In/Out Buttons
```typescript
import { signIn, signOut, useSession } from 'next-auth/react'

function AuthButton() {
  const { data: session } = useSession()
  
  if (session) {
    return (
      <button onClick={() => signOut()}>
        Sign out {session.user.name}
      </button>
    )
  }
  return (
    <button onClick={() => signIn()}>
      Sign in
    </button>
  )
}
```

### Protected API Calls
```typescript
import { useSession } from 'next-auth/react'

function useProtectedAPI() {
  const { data: session } = useSession()
  
  const callAPI = async (endpoint: string) => {
    if (!session?.accessToken) return null
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${session.accessToken}`,
        'Content-Type': 'application/json',
      },
    })
    
    return response.json()
  }
  
  return { callAPI }
}
```

## 🔍 Debugging

### Session Debug Info
In development mode, the dashboard shows session debug information:

```typescript
{process.env.NODE_ENV === 'development' && (
  <div>
    <h3>Session Debug Info</h3>
    <pre>{JSON.stringify(session, null, 2)}</pre>
  </div>
)}
```

### Common Issues & Solutions

1. **"Invalid credentials" error**
   - Check API_BASE_URL in environment variables
   - Verify NestJS backend is running on correct port
   - Check network requests in browser dev tools

2. **Session not persisting**
   - Verify NEXTAUTH_SECRET is set
   - Check NEXTAUTH_URL matches your domain
   - Clear browser cookies and try again

3. **Token refresh failing**
   - Check JWT_REFRESH_SECRET in backend
   - Verify refresh token endpoint is working
   - Check token expiration times

## 🎯 Integration Benefits

### Seamless Backend Integration
- Direct integration with NestJS authentication endpoints
- Automatic token management
- Consistent user data across frontend and backend

### Developer Experience
- Type-safe authentication with TypeScript
- Automatic session management
- Built-in error handling
- Comprehensive debugging tools

### Security Features
- Secure token storage
- Automatic token refresh
- CSRF protection
- Session timeout handling

## 🚀 Getting Started

1. **Start the backend**:
   ```bash
   cd services/backend
   pnpm start:dev
   ```

2. **Start the frontend**:
   ```bash
   cd apps/frontend
   pnpm dev
   ```

3. **Test the authentication**:
   - Visit `http://localhost:3001`
   - Click "Sign Up" to create an account
   - Sign in with your credentials
   - Access the protected dashboard

The NextAuth.js integration is now complete and ready for production use!
