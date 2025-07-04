// Design tokens export
import colorTokens from '../../tokens/color.json';
import typographyTokens from '../../tokens/typography.json';
import spacingTokens from '../../tokens/spacing.json';
import motionTokens from '../../tokens/motion.json';

export const tokens = {
  color: colorTokens,
  typography: typographyTokens,
  spacing: spacingTokens,
  motion: motionTokens,
} as const;

export type TokenName = keyof typeof tokens;

export default tokens;
