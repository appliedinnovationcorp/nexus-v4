# Authentication Module

A comprehensive authentication system for NestJS with JWT tokens, role-based access control, and protected routes.

## Features

- ✅ User registration and login
- ✅ JWT access and refresh tokens
- ✅ Password hashing with bcrypt
- ✅ Role-based access control (RBAC)
- ✅ Protected routes with guards
- ✅ Password change and reset functionality
- ✅ User activity logging
- ✅ Token refresh mechanism
- ✅ Logout with token revocation
- ✅ Public route decorator
- ✅ Current user decorator
- ✅ Comprehensive validation with DTOs

## Installation

The required dependencies are already installed:

```bash
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt bcrypt @types/bcrypt
```

## Environment Variables

Add these variables to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-here
JWT_REFRESH_EXPIRES_IN=7d
JWT_ISSUER=nexus-api
JWT_AUDIENCE=nexus-app
```

## API Endpoints

### Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | User registration | No |
| POST | `/auth/login` | User login | No |
| POST | `/auth/refresh` | Refresh access token | No |
| POST | `/auth/logout` | User logout | Yes |
| POST | `/auth/change-password` | Change password | Yes |
| POST | `/auth/forgot-password` | Request password reset | No |
| POST | `/auth/reset-password` | Reset password with token | No |
| GET | `/auth/me` | Get current user profile | Yes |
| GET | `/auth/verify-token` | Verify token validity | Yes |

### Example Requests

#### Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "johndoe",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

#### Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

#### Access Protected Route
```bash
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Usage in Controllers

### Basic Protected Route

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('example')
export class ExampleController {
  
  @Get('protected')
  @UseGuards(JwtAuthGuard)
  getProtectedData(@CurrentUser() user: any) {
    return {
      message: 'This is protected data',
      user: user.username
    }
  }
}
```

### Public Route (Skip Authentication)

```typescript
import { Controller, Get } from '@nestjs/common'
import { Public } from '../auth/decorators/public.decorator'

@Controller('example')
export class ExampleController {
  
  @Get('public')
  @Public()
  getPublicData() {
    return { message: 'This is public data' }
  }
}
```

### Role-Based Access Control

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { UserRole } from '@prisma/client'

@Controller('admin')
export class AdminController {
  
  @Get('dashboard')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAdminDashboard() {
    return { message: 'Admin only content' }
  }
  
  @Get('moderator-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  getModeratorContent() {
    return { message: 'Moderator and Admin content' }
  }
}
```

### Using CurrentUser Decorator

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../auth/decorators/current-user.decorator'

@Controller('user')
export class UserController {
  
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getUserProfile(
    @CurrentUser() user: any,           // Full user object
    @CurrentUser('id') userId: string,  // Just the user ID
    @CurrentUser('email') email: string // Just the email
  ) {
    return {
      fullUser: user,
      userId,
      email
    }
  }
}
```

## Guards

### JwtAuthGuard
- Validates JWT tokens
- Automatically applied globally (configured in AppModule)
- Can be bypassed with `@Public()` decorator

### RolesGuard
- Checks user roles against required roles
- Must be used with `@Roles()` decorator
- Requires JwtAuthGuard to be applied first

### LocalAuthGuard
- Used for username/password authentication
- Typically used in login endpoints

## Decorators

### @Public()
Marks a route as public, bypassing JWT authentication:
```typescript
@Get('public-endpoint')
@Public()
getPublicData() {
  return { message: 'No auth required' }
}
```

### @Roles(...roles)
Restricts access to specific user roles:
```typescript
@Get('admin-only')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
getAdminData() {
  return { message: 'Admin only' }
}
```

### @CurrentUser(property?)
Injects the current user or a specific property:
```typescript
@Get('profile')
@UseGuards(JwtAuthGuard)
getProfile(
  @CurrentUser() user: any,
  @CurrentUser('id') userId: string
) {
  // user contains full user object
  // userId contains just the ID
}
```

## Token Management

### Access Tokens
- Short-lived (default: 15 minutes)
- Used for API authentication
- Include user information in payload

### Refresh Tokens
- Long-lived (default: 7 days)
- Used to obtain new access tokens
- Stored in database for revocation
- Automatically revoked on logout

### Token Payload
```typescript
interface JwtPayload {
  sub: string      // User ID
  email: string    // User email
  username: string // Username
  role: string     // User role
  iat?: number     // Issued at
  exp?: number     // Expires at
  iss?: string     // Issuer
  aud?: string     // Audience
}
```

## Security Features

### Password Security
- Passwords hashed with bcrypt (12 rounds)
- Password strength validation in DTOs
- Secure password reset with time-limited tokens

### Token Security
- JWT tokens signed with secret keys
- Refresh tokens stored in database for revocation
- Token expiration and validation
- Issuer and audience validation

### Activity Logging
- Login/logout events logged
- Password changes tracked
- Failed authentication attempts can be monitored

## Error Handling

The AuthModule provides comprehensive error handling:

- `401 Unauthorized`: Invalid credentials or expired tokens
- `403 Forbidden`: Insufficient permissions (role-based)
- `409 Conflict`: Email or username already exists
- `400 Bad Request`: Invalid input data

## Testing

Example test for protected routes:

```typescript
describe('Protected Routes', () => {
  let app: INestApplication
  let accessToken: string

  beforeAll(async () => {
    // Setup test app and get access token
  })

  it('should access protected route with valid token', async () => {
    return request(app.getHttpServer())
      .get('/protected/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
  })

  it('should reject access without token', async () => {
    return request(app.getHttpServer())
      .get('/protected/profile')
      .expect(401)
  })
})
```

## Best Practices

1. **Always use HTTPS in production** to protect tokens in transit
2. **Store refresh tokens securely** on the client side
3. **Implement proper token rotation** using refresh tokens
4. **Use role-based access control** for fine-grained permissions
5. **Log authentication events** for security monitoring
6. **Validate input data** using DTOs and validation pipes
7. **Handle errors gracefully** without exposing sensitive information
8. **Use environment variables** for configuration
9. **Implement rate limiting** to prevent brute force attacks
10. **Regular security audits** of authentication logic

## Troubleshooting

### Common Issues

1. **"Invalid or expired token"**
   - Check if JWT_SECRET is set correctly
   - Verify token hasn't expired
   - Ensure token is sent in Authorization header

2. **"Insufficient permissions"**
   - Check user role in database
   - Verify @Roles decorator has correct roles
   - Ensure RolesGuard is applied

3. **"User not found or inactive"**
   - Check user status in database
   - Verify user exists and is ACTIVE

### Debug Mode

Enable debug logging by setting LOG_LEVEL=debug in your environment variables.
