import { Injectable, Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isVerified: boolean;
  roles: Role[];
  permissions: Permission[];
  tenantId: string;
  mfaEnabled: boolean;
  mfaSecret?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  tenantId: string;
  isSystem: boolean;
  createdAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
  description: string;
}

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  settings: {
    allowSelfRegistration: boolean;
    requireEmailVerification: boolean;
    passwordPolicy: PasswordPolicy;
    mfaRequired: boolean;
    sessionTimeout: number;
    maxSessions: number;
  };
  isActive: boolean;
  createdAt: Date;
}

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // days
  preventReuse: number; // number of previous passwords to check
}

export interface Session {
  id: string;
  userId: string;
  tenantId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class IAMService {
  private readonly logger = new Logger(IAMService.name);
  private users = new Map<string, User>();
  private roles = new Map<string, Role>();
  private permissions = new Map<string, Permission>();
  private tenants = new Map<string, Tenant>();
  private sessions = new Map<string, Session>();

  constructor(private jwtService: JwtService) {
    this.initializeDefaultData();
  }

  private initializeDefaultData(): void {
    // Create default tenant
    const defaultTenant: Tenant = {
      id: 'default',
      name: 'Default Tenant',
      domain: 'nexus.dev',
      settings: {
        allowSelfRegistration: true,
        requireEmailVerification: true,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        mfaRequired: false,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxSessions: 5,
      },
      isActive: true,
      createdAt: new Date(),
    };
    this.tenants.set('default', defaultTenant);

    // Create default permissions
    const defaultPermissions: Permission[] = [
      {
        id: 'users.read',
        name: 'Read Users',
        resource: 'users',
        action: 'read',
        description: 'View user information',
      },
      {
        id: 'users.write',
        name: 'Write Users',
        resource: 'users',
        action: 'write',
        description: 'Create and update users',
      },
      {
        id: 'users.delete',
        name: 'Delete Users',
        resource: 'users',
        action: 'delete',
        description: 'Delete users',
      },
      {
        id: 'roles.manage',
        name: 'Manage Roles',
        resource: 'roles',
        action: 'manage',
        description: 'Manage roles and permissions',
      },
      {
        id: 'system.admin',
        name: 'System Administration',
        resource: 'system',
        action: 'admin',
        description: 'Full system administration access',
      },
    ];

    defaultPermissions.forEach(permission => {
      this.permissions.set(permission.id, permission);
    });

    // Create default roles
    const adminRole: Role = {
      id: 'admin',
      name: 'Administrator',
      description: 'Full system access',
      permissions: defaultPermissions,
      tenantId: 'default',
      isSystem: true,
      createdAt: new Date(),
    };

    const userRole: Role = {
      id: 'user',
      name: 'User',
      description: 'Standard user access',
      permissions: [defaultPermissions[0]], // users.read only
      tenantId: 'default',
      isSystem: true,
      createdAt: new Date(),
    };

    this.roles.set('admin', adminRole);
    this.roles.set('user', userRole);

    this.logger.log('Initialized default IAM data');
  }

  // Authentication
  async authenticate(
    email: string,
    password: string,
    tenantId: string = 'default',
    mfaCode?: string
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    requiresMfa: boolean;
  }> {
    const user = Array.from(this.users.values())
      .find(u => u.email === email && u.tenantId === tenantId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password (in real implementation, compare with hashed password)
    const isPasswordValid = await bcrypt.compare(password, user.metadata.passwordHash || '');
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check MFA if enabled
    if (user.mfaEnabled) {
      if (!mfaCode) {
        return {
          user,
          accessToken: '',
          refreshToken: '',
          requiresMfa: true,
        };
      }

      const isValidMfa = speakeasy.totp.verify({
        secret: user.mfaSecret!,
        encoding: 'base32',
        token: mfaCode,
        window: 2,
      });

      if (!isValidMfa) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user);

    // Update last login
    user.lastLoginAt = new Date();
    this.users.set(user.id, user);

    return {
      user,
      accessToken,
      refreshToken,
      requiresMfa: false,
    };
  }

  // User Registration
  async registerUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    username?: string;
    tenantId?: string;
  }): Promise<User> {
    const tenantId = userData.tenantId || 'default';
    const tenant = this.tenants.get(tenantId);

    if (!tenant || !tenant.isActive) {
      throw new BadRequestException('Invalid tenant');
    }

    if (!tenant.settings.allowSelfRegistration) {
      throw new BadRequestException('Self registration not allowed');
    }

    // Check if user already exists
    const existingUser = Array.from(this.users.values())
      .find(u => u.email === userData.email && u.tenantId === tenantId);

    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    // Validate password policy
    await this.validatePassword(userData.password, tenant.settings.passwordPolicy);

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // Create user
    const userId = this.generateId();
    const user: User = {
      id: userId,
      email: userData.email,
      username: userData.username || userData.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      isActive: true,
      isVerified: !tenant.settings.requireEmailVerification,
      roles: [this.roles.get('user')!],
      permissions: [],
      tenantId,
      mfaEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { passwordHash },
    };

    this.users.set(userId, user);
    this.logger.log(`User registered: ${userData.email} (${userId})`);

    return user;
  }

  // Role-Based Access Control
  async assignRole(userId: string, roleId: string, assignedBy: string): Promise<void> {
    const user = this.users.get(userId);
    const role = this.roles.get(roleId);

    if (!user || !role) {
      throw new BadRequestException('User or role not found');
    }

    // Check if user already has the role
    if (user.roles.some(r => r.id === roleId)) {
      throw new BadRequestException('User already has this role');
    }

    user.roles.push(role);
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logger.log(`Role ${roleId} assigned to user ${userId} by ${assignedBy}`);
  }

  async removeRole(userId: string, roleId: string, removedBy: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.roles = user.roles.filter(r => r.id !== roleId);
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logger.log(`Role ${roleId} removed from user ${userId} by ${removedBy}`);
  }

  // Permission Checking
  async hasPermission(
    userId: string,
    resource: string,
    action: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      return false;
    }

    // Check direct permissions
    const hasDirectPermission = user.permissions.some(p => 
      p.resource === resource && p.action === action
    );

    if (hasDirectPermission) {
      return true;
    }

    // Check role-based permissions
    for (const role of user.roles) {
      const hasRolePermission = role.permissions.some(p => 
        p.resource === resource && (p.action === action || p.action === '*')
      );

      if (hasRolePermission) {
        return true;
      }
    }

    return false;
  }

  // Multi-Factor Authentication
  async enableMFA(userId: string): Promise<{
    secret: string;
    qrCodeUrl: string;
    backupCodes: string[];
  }> {
    const user = this.users.get(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Nexus (${user.email})`,
      issuer: 'Nexus Platform',
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);
    const backupCodes = this.generateBackupCodes();

    user.mfaSecret = secret.base32;
    user.metadata.backupCodes = backupCodes;
    this.users.set(userId, user);

    return {
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
    };
  }

  async confirmMFA(userId: string, token: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user || !user.mfaSecret) {
      throw new BadRequestException('MFA setup not found');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token,
      window: 2,
    });

    if (!isValid) {
      throw new BadRequestException('Invalid MFA token');
    }

    user.mfaEnabled = true;
    user.updatedAt = new Date();
    this.users.set(userId, user);

    this.logger.log(`MFA enabled for user ${userId}`);
  }

  // Session Management
  async createSession(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<Session> {
    const user = this.users.get(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const tenant = this.tenants.get(user.tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    // Check session limits
    const userSessions = Array.from(this.sessions.values())
      .filter(s => s.userId === userId && s.isActive);

    if (userSessions.length >= tenant.settings.maxSessions) {
      // Remove oldest session
      const oldestSession = userSessions.sort((a, b) => 
        a.createdAt.getTime() - b.createdAt.getTime()
      )[0];
      
      await this.revokeSession(oldestSession.id);
    }

    const sessionId = this.generateId();
    const { accessToken, refreshToken } = await this.generateTokens(user);

    const session: Session = {
      id: sessionId,
      userId,
      tenantId: user.tenantId,
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + tenant.settings.sessionTimeout),
      ipAddress,
      userAgent,
      isActive: true,
      createdAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      this.sessions.set(sessionId, session);
      this.logger.log(`Session revoked: ${sessionId}`);
    }
  }

  // Tenant Management
  async createTenant(tenantData: {
    name: string;
    domain: string;
    settings?: Partial<Tenant['settings']>;
  }): Promise<Tenant> {
    const tenantId = this.generateId();
    
    const tenant: Tenant = {
      id: tenantId,
      name: tenantData.name,
      domain: tenantData.domain,
      settings: {
        allowSelfRegistration: true,
        requireEmailVerification: true,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSpecialChars: true,
          maxAge: 90,
          preventReuse: 5,
        },
        mfaRequired: false,
        sessionTimeout: 24 * 60 * 60 * 1000,
        maxSessions: 5,
        ...tenantData.settings,
      },
      isActive: true,
      createdAt: new Date(),
    };

    this.tenants.set(tenantId, tenant);
    this.logger.log(`Tenant created: ${tenantData.name} (${tenantId})`);

    return tenant;
  }

  // OAuth Integration
  async handleOAuthCallback(
    provider: string,
    profile: any,
    tenantId: string = 'default'
  ): Promise<{
    user: User;
    accessToken: string;
    refreshToken: string;
    isNewUser: boolean;
  }> {
    let user = Array.from(this.users.values())
      .find(u => u.email === profile.email && u.tenantId === tenantId);

    let isNewUser = false;

    if (!user) {
      // Create new user from OAuth profile
      const userId = this.generateId();
      user = {
        id: userId,
        email: profile.email,
        username: profile.username || profile.email,
        firstName: profile.firstName || profile.name?.givenName || '',
        lastName: profile.lastName || profile.name?.familyName || '',
        isActive: true,
        isVerified: true, // OAuth users are pre-verified
        roles: [this.roles.get('user')!],
        permissions: [],
        tenantId,
        mfaEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          oauthProvider: provider,
          oauthId: profile.id,
        },
      };

      this.users.set(userId, user);
      isNewUser = true;
      this.logger.log(`OAuth user created: ${profile.email} via ${provider}`);
    }

    const { accessToken, refreshToken } = await this.generateTokens(user);

    return {
      user,
      accessToken,
      refreshToken,
      isNewUser,
    };
  }

  // Private helper methods
  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles.map(r => r.name),
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  }

  private async validatePassword(password: string, policy: PasswordPolicy): Promise<void> {
    if (password.length < policy.minLength) {
      throw new BadRequestException(`Password must be at least ${policy.minLength} characters`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      throw new BadRequestException('Password must contain uppercase letters');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      throw new BadRequestException('Password must contain lowercase letters');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      throw new BadRequestException('Password must contain numbers');
    }

    if (policy.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      throw new BadRequestException('Password must contain special characters');
    }
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBackupCodes(): string[] {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substr(2, 8).toUpperCase());
    }
    return codes;
  }

  // Public API methods
  async getUser(userId: string): Promise<User | undefined> {
    return this.users.get(userId);
  }

  async getUserByEmail(email: string, tenantId: string): Promise<User | undefined> {
    return Array.from(this.users.values())
      .find(u => u.email === email && u.tenantId === tenantId);
  }

  async getAllUsers(tenantId: string): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(u => u.tenantId === tenantId);
  }

  async getAllRoles(tenantId: string): Promise<Role[]> {
    return Array.from(this.roles.values())
      .filter(r => r.tenantId === tenantId);
  }

  async getAllPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  async getTenant(tenantId: string): Promise<Tenant | undefined> {
    return this.tenants.get(tenantId);
  }
}
