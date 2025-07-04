// Core utilities
export * from './lib/utils';

// Components
export { Button, buttonVariants } from './components/Button/Button';
export type { ButtonProps } from './components/Button/Button';

export { Input, inputVariants } from './components/Input/Input';
export type { InputProps } from './components/Input/Input';

// Design tokens (re-export for convenience)
export { tokens } from './tokens';
export type { TokenName } from './tokens';

// Version
export const version = '1.0.0';
