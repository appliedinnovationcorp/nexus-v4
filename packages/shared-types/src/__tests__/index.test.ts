/**
 * @fileoverview Tests for shared types and type guards
 */

import {
  UserRole,
  UserStatus,
  EventCategory,
  isValidUserRole,
  isValidUserStatus,
  isValidEventCategory,
  validateUser,
  validateEvent
} from '../index';

describe('Shared Types', () => {
  describe('Type Guards', () => {
    test('isValidUserRole should validate user roles', () => {
      expect(isValidUserRole('admin')).toBe(true);
      expect(isValidUserRole('user')).toBe(true);
      expect(isValidUserRole('guest')).toBe(true);
      expect(isValidUserRole('invalid')).toBe(false);
    });

    test('isValidUserStatus should validate user status', () => {
      expect(isValidUserStatus('active')).toBe(true);
      expect(isValidUserStatus('inactive')).toBe(true);
      expect(isValidUserStatus('pending')).toBe(true);
      expect(isValidUserStatus('suspended')).toBe(true);
      expect(isValidUserStatus('invalid')).toBe(false);
    });

    test('isValidEventCategory should validate event categories', () => {
      expect(isValidEventCategory('user')).toBe(true);
      expect(isValidEventCategory('system')).toBe(true);
      expect(isValidEventCategory('business')).toBe(true);
      expect(isValidEventCategory('invalid')).toBe(false);
    });
  });

  describe('Validation Functions', () => {
    test('validateUser should validate user objects', () => {
      const validUser = {
        id: '123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user' as UserRole,
        status: 'active' as UserStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(validateUser(validUser)).toBe(true);

      const invalidUser = {
        id: '123',
        email: 'invalid-email',
        name: '',
        role: 'invalid' as any,
        status: 'active' as UserStatus,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(validateUser(invalidUser)).toBe(false);
    });

    test('validateEvent should validate event objects', () => {
      const validEvent = {
        id: '123',
        type: 'user_login',
        category: 'user' as EventCategory,
        userId: 'user123',
        timestamp: new Date(),
        properties: { ip: '127.0.0.1' }
      };

      expect(validateEvent(validEvent)).toBe(true);

      const invalidEvent = {
        id: '',
        type: '',
        category: 'invalid' as any,
        userId: '',
        timestamp: new Date(),
        properties: {}
      };

      expect(validateEvent(invalidEvent)).toBe(false);
    });
  });

  describe('Type Enums', () => {
    test('UserRole enum should have correct values', () => {
      expect(UserRole.ADMIN).toBe('admin');
      expect(UserRole.USER).toBe('user');
      expect(UserRole.GUEST).toBe('guest');
    });

    test('UserStatus enum should have correct values', () => {
      expect(UserStatus.ACTIVE).toBe('active');
      expect(UserStatus.INACTIVE).toBe('inactive');
      expect(UserStatus.PENDING).toBe('pending');
      expect(UserStatus.SUSPENDED).toBe('suspended');
    });

    test('EventCategory enum should have correct values', () => {
      expect(EventCategory.USER).toBe('user');
      expect(EventCategory.SYSTEM).toBe('system');
      expect(EventCategory.BUSINESS).toBe('business');
    });
  });
});
