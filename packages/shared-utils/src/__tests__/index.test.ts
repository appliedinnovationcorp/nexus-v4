/**
 * @fileoverview Comprehensive tests for shared utilities
 */

import {
  formatDate,
  formatCurrency,
  generateId,
  validateEmail,
  validateUrl,
  debounce,
  throttle,
  deepMerge,
  pick,
  omit,
  capitalize,
  slugify,
  truncate,
  isEmptyObject,
  retry,
  sleep,
  createLogger,
  Logger
} from '../index';

describe('Shared Utils', () => {
  describe('Date Utilities', () => {
    test('formatDate should format dates correctly', () => {
      const date = new Date('2023-12-25T10:30:00Z');
      expect(formatDate(date)).toMatch(/2023-12-25/);
      expect(formatDate(date, 'MM/dd/yyyy')).toBe('12/25/2023');
    });
  });

  describe('Currency Utilities', () => {
    test('formatCurrency should format currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56');
    });
  });

  describe('ID Generation', () => {
    test('generateId should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toHaveLength(21); // nanoid default length
    });
  });

  describe('Validation Utilities', () => {
    test('validateEmail should validate email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    test('validateUrl should validate URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true);
      expect(validateUrl('http://localhost:3000')).toBe(true);
      expect(validateUrl('invalid-url')).toBe(false);
    });
  });

  describe('Function Utilities', () => {
    test('debounce should delay function execution', async () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(mockFn).not.toHaveBeenCalled();
      
      await sleep(150);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('throttle should limit function calls', async () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      
      await sleep(150);
      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Object Utilities', () => {
    test('deepMerge should merge objects deeply', () => {
      const obj1 = { a: 1, b: { c: 2 } };
      const obj2 = { b: { d: 3 }, e: 4 };
      const result = deepMerge(obj1, obj2);
      
      expect(result).toEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4
      });
    });

    test('pick should select specified properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(pick(obj, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    test('omit should exclude specified properties', () => {
      const obj = { a: 1, b: 2, c: 3 };
      expect(omit(obj, ['b'])).toEqual({ a: 1, c: 3 });
    });

    test('isEmptyObject should detect empty objects', () => {
      expect(isEmptyObject({})).toBe(true);
      expect(isEmptyObject({ a: 1 })).toBe(false);
    });
  });

  describe('String Utilities', () => {
    test('capitalize should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('HELLO')).toBe('Hello');
    });

    test('slugify should create URL-friendly slugs', () => {
      expect(slugify('Hello World!')).toBe('hello-world');
      expect(slugify('Test & Example')).toBe('test-example');
    });

    test('truncate should truncate long strings', () => {
      expect(truncate('Hello World', 5)).toBe('Hello...');
      expect(truncate('Hi', 10)).toBe('Hi');
    });
  });

  describe('Async Utilities', () => {
    test('retry should retry failed operations', async () => {
      let attempts = 0;
      const failingFn = async () => {
        attempts++;
        if (attempts < 3) throw new Error('Failed');
        return 'Success';
      };

      const result = await retry(failingFn, 3);
      expect(result).toBe('Success');
      expect(attempts).toBe(3);
    });

    test('sleep should delay execution', async () => {
      const start = Date.now();
      await sleep(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Logger', () => {
    test('createLogger should create logger instance', () => {
      const logger = createLogger('test');
      expect(logger).toBeInstanceOf(Logger);
    });

    test('logger should log messages', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const logger = createLogger('test');
      
      logger.info('Test message');
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
