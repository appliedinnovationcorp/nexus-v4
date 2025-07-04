// Design tokens export
import colorTokens from './color.json';
import typographyTokens from './typography.json';
import spacingTokens from './spacing.json';
import motionTokens from './motion.json';

export const tokens = {
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  motion: motionTokens,
} as const;

export type TokenName = keyof typeof tokens;

export default tokens;
