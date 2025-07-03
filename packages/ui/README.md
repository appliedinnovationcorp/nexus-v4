# @nexus/ui - Nexus Design System

A comprehensive, accessible, and well-documented design system built with React, TypeScript, and Tailwind CSS. Features design tokens, Storybook documentation, and visual regression testing with Chromatic.

## 🎨 Features

- **Design Tokens**: Centralized design decisions with Style Dictionary
- **Component Library**: Accessible React components built with Radix UI
- **Storybook Documentation**: Interactive component documentation
- **Visual Regression Testing**: Automated UI testing with Chromatic
- **Accessibility First**: WCAG 2.1 AA compliant components
- **TypeScript Support**: Full type safety and IntelliSense
- **Tailwind CSS**: Utility-first styling with custom design tokens
- **Tree Shaking**: Optimized bundle size with selective imports

## 📦 Installation

```bash
npm install @nexus/ui
# or
yarn add @nexus/ui
# or
pnpm add @nexus/ui
```

## 🚀 Quick Start

```tsx
import { Button, Input } from '@nexus/ui';
import '@nexus/ui/styles';

function App() {
  return (
    <div>
      <Input 
        label="Email" 
        type="email" 
        placeholder="Enter your email" 
      />
      <Button variant="primary" size="lg">
        Get Started
      </Button>
    </div>
  );
}
```

## 🎯 Design Tokens

The design system uses a token-based approach for consistent styling:

```tsx
import { tokens } from '@nexus/ui/tokens';

// Use design tokens directly
const customStyles = {
  color: tokens.colorPrimary500,
  fontSize: tokens.typographySizeBase,
  spacing: tokens.spacing4,
};
```

### Token Categories

- **Colors**: Primary, secondary, semantic colors with full palettes
- **Typography**: Font families, sizes, weights, and line heights
- **Spacing**: Consistent spacing scale for margins, padding, and gaps
- **Motion**: Animation durations, easing functions, and transitions

## 📚 Components

### Button

Versatile button component with multiple variants and states.

```tsx
<Button variant="primary" size="lg" loading>
  Loading...
</Button>

<Button variant="outline" leftIcon={<PlusIcon />}>
  Add Item
</Button>
```

**Props:**
- `variant`: `default` | `destructive` | `outline` | `secondary` | `ghost` | `link`
- `size`: `sm` | `default` | `lg` | `xl` | `icon`
- `loading`: boolean
- `leftIcon`, `rightIcon`: React.ReactNode
- `fullWidth`: boolean

### Input

Flexible input component with validation states and icons.

```tsx
<Input
  label="Email Address"
  type="email"
  placeholder="Enter your email"
  error="Please enter a valid email"
  startIcon={<MailIcon />}
/>
```

**Props:**
- `variant`: `default` | `filled` | `flushed`
- `size`: `sm` | `default` | `lg`
- `state`: `default` | `error` | `success` | `warning`
- `label`, `helperText`, `error`: string
- `startIcon`, `endIcon`: React.ReactNode
- `loading`: boolean

## 🎨 Storybook

Explore all components interactively in Storybook:

```bash
cd packages/ui
pnpm storybook
```

Visit [https://nexus-ui.dev/storybook](https://nexus-ui.dev/storybook) for the live documentation.

## 🧪 Testing

### Unit Tests

```bash
pnpm test
pnpm test:watch
pnpm test:coverage
```

### Visual Regression Testing

```bash
pnpm chromatic
```

### Accessibility Testing

```bash
pnpm storybook:test
```

## 🛠️ Development

### Setup

```bash
# Install dependencies
pnpm install

# Build design tokens
pnpm build:tokens

# Start development
pnpm dev

# Start Storybook
pnpm storybook
```

### Building

```bash
# Build everything
pnpm build

# Build tokens only
pnpm build:tokens

# Build Storybook
pnpm build-storybook
```

### Design Token Development

Design tokens are defined in JSON files under `tokens/`:

```json
{
  "color": {
    "primary": {
      "500": { "value": "#3b82f6" }
    }
  }
}
```

Build tokens with:

```bash
pnpm build:tokens
```

This generates:
- CSS custom properties (`dist/tokens/variables.css`)
- JavaScript/TypeScript exports (`tokens/index.js`, `tokens/index.d.ts`)
- JSON output (`dist/tokens/tokens.json`)

## 📖 Documentation

### Component Stories

Each component should have a corresponding `.stories.tsx` file:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'A versatile button component...',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline'],
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};
```

### Writing Documentation

- Use JSDoc comments for component props
- Include usage examples in stories
- Document accessibility features
- Provide interactive examples

## ♿ Accessibility

All components are built with accessibility in mind:

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA attributes and semantic HTML
- **Focus Management**: Visible focus indicators and logical tab order
- **Color Contrast**: WCAG 2.1 AA compliant color combinations
- **Motion**: Respects `prefers-reduced-motion`

### Testing Accessibility

```bash
# Run accessibility tests
pnpm storybook:test

# Manual testing with screen readers
# - macOS: VoiceOver (Cmd + F5)
# - Windows: NVDA or JAWS
# - Linux: Orca
```

## 🎯 Best Practices

### Component Development

1. **Start with Accessibility**: Design for keyboard and screen reader users
2. **Use Design Tokens**: Reference tokens instead of hardcoded values
3. **Write Stories**: Document all component variants and states
4. **Test Thoroughly**: Unit tests, visual tests, and accessibility tests
5. **Follow Conventions**: Use consistent naming and file structure

### Design Token Usage

```tsx
// ✅ Good - Use design tokens
const styles = {
  color: 'hsl(var(--primary))',
  fontSize: 'var(--text-base)',
  padding: 'var(--spacing-4)',
};

// ❌ Avoid - Hardcoded values
const styles = {
  color: '#3b82f6',
  fontSize: '16px',
  padding: '16px',
};
```

### Component API Design

```tsx
// ✅ Good - Flexible and consistent
interface ButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  loading?: boolean;
  children: React.ReactNode;
}

// ❌ Avoid - Too many boolean props
interface ButtonProps {
  isPrimary?: boolean;
  isSecondary?: boolean;
  isSmall?: boolean;
  isLarge?: boolean;
  isLoading?: boolean;
}
```

## 🔧 Configuration

### Tailwind CSS

The design system extends Tailwind CSS with custom tokens:

```js
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'hsl(var(--primary))',
        // ... other custom colors
      },
    },
  },
};
```

### Style Dictionary

Design tokens are processed with Style Dictionary:

```js
// tokens/config.js
module.exports = {
  source: ['tokens/**/*.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'dist/tokens/',
      files: [{
        destination: 'variables.css',
        format: 'css/variables'
      }]
    },
  },
};
```

## 📊 Bundle Analysis

Monitor bundle size with each build:

```bash
pnpm build
# Check dist/ folder sizes
du -sh dist/*
```

The design system is optimized for tree shaking:

```tsx
// ✅ Tree-shakable imports
import { Button } from '@nexus/ui';

// ❌ Imports entire library
import * as UI from '@nexus/ui';
```

## 🚀 Deployment

### Storybook Deployment

Storybook is automatically deployed to GitHub Pages on main branch pushes:

- **URL**: https://nexus-ui.dev/storybook
- **Trigger**: Push to `main` branch
- **Build**: `pnpm build-storybook`

### Package Publishing

```bash
# Build and publish
pnpm build
npm publish
```

### Chromatic Integration

Visual regression testing runs on every PR:

- **Service**: Chromatic
- **Trigger**: Pull requests and main branch pushes
- **Auto-accept**: Changes on main branch
- **Baseline**: Latest main branch build

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-component`
3. **Add your component** with tests and stories
4. **Run the test suite**: `pnpm test`
5. **Build and verify**: `pnpm build && pnpm storybook`
6. **Submit a pull request**

### Component Checklist

- [ ] Component implementation with TypeScript
- [ ] Comprehensive Storybook stories
- [ ] Unit tests with good coverage
- [ ] Accessibility testing
- [ ] Design token usage
- [ ] Documentation and examples
- [ ] Visual regression tests pass

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [📚 Storybook Documentation](https://nexus-ui.dev/storybook)
- [🎨 Chromatic Visual Tests](https://www.chromatic.com)
- [♿ Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [🎯 Design Tokens Specification](https://design-tokens.github.io/community-group/)
- [⚛️ Radix UI Primitives](https://www.radix-ui.com/primitives)

---

Built with ❤️ by the Nexus Team
