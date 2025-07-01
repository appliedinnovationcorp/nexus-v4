import { forwardRef } from 'react';
import { clsx } from 'clsx';

import {
  baseStyles,
  fullWidthStyles,
  sizeStyles,
  spinnerStyles,
  variantStyles,
} from './Button.styles';
import { ButtonProps } from './Button.types';

/**
 * LoadingSpinner component for the loading state
 */
const LoadingSpinner = ({ size }: { size: string }) => (
  <div
    className={clsx(spinnerStyles, {
      'h-3 w-3': size === 'sm',
      'h-4 w-4': size === 'md',
      'h-5 w-5': size === 'lg',
    })}
    aria-hidden="true"
  />
);

/**
 * Button component with multiple variants, sizes, and states
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md" onClick={handleClick}>
 *   Click me
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={clsx(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && fullWidthStyles,
          className,
        )}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading && <LoadingSpinner size={size} />}
        {!loading && leftIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {children && <span>{children}</span>}
        {!loading && rightIcon && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';
