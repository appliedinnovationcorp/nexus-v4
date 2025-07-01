import { ButtonSize, ButtonVariant } from './Button.types';

/**
 * Base button styles that apply to all variants
 */
export const baseStyles = [
  'inline-flex',
  'items-center',
  'justify-center',
  'gap-2',
  'font-medium',
  'rounded-md',
  'border',
  'transition-all',
  'duration-200',
  'focus:outline-none',
  'focus:ring-2',
  'focus:ring-offset-2',
  'disabled:opacity-50',
  'disabled:cursor-not-allowed',
  'disabled:pointer-events-none',
].join(' ');

/**
 * Variant-specific styles
 */
export const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-blue-600',
    'text-white',
    'border-blue-600',
    'hover:bg-blue-700',
    'hover:border-blue-700',
    'focus:ring-blue-500',
    'active:bg-blue-800',
  ].join(' '),

  secondary: [
    'bg-gray-100',
    'text-gray-900',
    'border-gray-300',
    'hover:bg-gray-200',
    'hover:border-gray-400',
    'focus:ring-gray-500',
    'active:bg-gray-300',
  ].join(' '),

  outline: [
    'bg-transparent',
    'text-blue-600',
    'border-blue-600',
    'hover:bg-blue-50',
    'hover:text-blue-700',
    'focus:ring-blue-500',
    'active:bg-blue-100',
  ].join(' '),

  ghost: [
    'bg-transparent',
    'text-gray-700',
    'border-transparent',
    'hover:bg-gray-100',
    'hover:text-gray-900',
    'focus:ring-gray-500',
    'active:bg-gray-200',
  ].join(' '),

  destructive: [
    'bg-red-600',
    'text-white',
    'border-red-600',
    'hover:bg-red-700',
    'hover:border-red-700',
    'focus:ring-red-500',
    'active:bg-red-800',
  ].join(' '),
};

/**
 * Size-specific styles
 */
export const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

/**
 * Loading spinner styles
 */
export const spinnerStyles = [
  'animate-spin',
  'rounded-full',
  'border-2',
  'border-current',
  'border-t-transparent',
].join(' ');

/**
 * Full width styles
 */
export const fullWidthStyles = 'w-full';
