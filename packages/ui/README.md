# @nexus/ui

Shared UI components library for the Nexus workspace. Built with React,
TypeScript, and Tailwind CSS.

## Features

- 🎨 **Modern Design System** - Consistent, accessible components
- 🔧 **TypeScript First** - Full type safety and IntelliSense support
- 📱 **Responsive** - Mobile-first design approach
- ♿ **Accessible** - WCAG compliant components
- 🎯 **Tree Shakeable** - Import only what you need
- 🔄 **SSR Ready** - Works with Next.js and other SSR frameworks

## Installation

This package is part of the Nexus workspace and is automatically available to
all workspace projects.

For external projects:

```bash
npm install @nexus/ui
# or
pnpm add @nexus/ui
# or
yarn add @nexus/ui
```

## Usage

```tsx
import { Button } from '@nexus/ui';

function App() {
  return (
    <Button variant="primary" size="md" onClick={() => console.log('Clicked!')}>
      Click me
    </Button>
  );
}
```

## Components

### Button

A versatile button component with multiple variants, sizes, and states.

#### Props

| Prop        | Type                                                                | Default     | Description                |
| ----------- | ------------------------------------------------------------------- | ----------- | -------------------------- |
| `variant`   | `'primary' \| 'secondary' \| 'outline' \| 'ghost' \| 'destructive'` | `'primary'` | Visual style variant       |
| `size`      | `'sm' \| 'md' \| 'lg'`                                              | `'md'`      | Button size                |
| `loading`   | `boolean`                                                           | `false`     | Loading state with spinner |
| `fullWidth` | `boolean`                                                           | `false`     | Full width button          |
| `leftIcon`  | `ReactNode`                                                         | -           | Icon before text           |
| `rightIcon` | `ReactNode`                                                         | -           | Icon after text            |
| `disabled`  | `boolean`                                                           | `false`     | Disabled state             |
| `children`  | `ReactNode`                                                         | -           | Button content             |

#### Examples

**Basic Usage**

```tsx
<Button>Default Button</Button>
```

**Variants**

```tsx
<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
```

**Sizes**

```tsx
<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>
```

**With Icons**

```tsx
<Button leftIcon={<PlusIcon />}>Add Item</Button>
<Button rightIcon={<ArrowRightIcon />}>Continue</Button>
```

**Loading State**

```tsx
<Button loading>Loading...</Button>
```

**Full Width**

```tsx
<Button fullWidth>Full Width Button</Button>
```

**Custom Styling**

```tsx
<Button className="custom-class">Custom Button</Button>
```

## Styling

This package uses Tailwind CSS for styling. Make sure your project has Tailwind
CSS configured.

### Required Tailwind Classes

The components use the following Tailwind classes:

- Layout: `inline-flex`, `items-center`, `justify-center`, `gap-2`, `w-full`
- Typography: `font-medium`, `text-sm`, `text-base`, `text-lg`
- Spacing: `px-3`, `py-1.5`, `px-4`, `py-2`, `px-6`, `py-3`
- Colors: `bg-*`, `text-*`, `border-*`, `hover:*`, `focus:*`, `active:*`
- Border: `rounded-md`, `border`
- Effects: `transition-all`, `duration-200`, `animate-spin`
- States: `disabled:*`, `focus:*`, `hover:*`

### Customization

You can customize the appearance by:

1. **Overriding with className**

```tsx
<Button className="bg-purple-600 hover:bg-purple-700">Custom Color</Button>
```

2. **Extending the component**

```tsx
const CustomButton = ({ children, ...props }) => (
  <Button className="my-custom-styles" {...props}>
    {children}
  </Button>
);
```

3. **Creating new variants** (modify the source)

## Accessibility

All components follow WCAG 2.1 guidelines:

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and roles
- **Focus Management**: Visible focus indicators
- **Color Contrast**: Meets AA standards
- **Semantic HTML**: Proper HTML elements

### Button Accessibility Features

- Uses semantic `<button>` element
- Proper `disabled` and `aria-disabled` attributes
- Loading state communicated to screen readers
- Focus ring for keyboard navigation
- Appropriate color contrast ratios

## Development

### Building

```bash
pnpm build
```

### Development Mode

```bash
pnpm dev
```

### Linting

```bash
pnpm lint
pnpm lint:fix
```

### Formatting

```bash
pnpm format
pnpm format:check
```

### Type Checking

```bash
pnpm type-check
```

## Architecture

### File Structure

```
src/
├── components/
│   └── Button/
│       ├── Button.tsx          # Main component
│       ├── Button.types.ts     # TypeScript types
│       ├── Button.styles.ts    # Style definitions
│       └── index.ts           # Exports
└── index.ts                   # Main exports
```

### Design Principles

1. **Composition over Configuration** - Flexible, composable components
2. **TypeScript First** - Full type safety and developer experience
3. **Accessibility by Default** - WCAG compliant out of the box
4. **Performance Focused** - Tree-shakeable, minimal bundle impact
5. **Consistent API** - Predictable prop patterns across components

## Contributing

### Adding New Components

1. Create component directory in `src/components/`
2. Follow the established file structure:
   - `Component.tsx` - Main component
   - `Component.types.ts` - TypeScript interfaces
   - `Component.styles.ts` - Style definitions (if complex)
   - `index.ts` - Exports
3. Export from main `src/index.ts`
4. Add documentation to README
5. Follow accessibility guidelines
6. Include comprehensive TypeScript types

### Code Standards

- Use TypeScript for all components
- Follow the established ESLint and Prettier configurations
- Include JSDoc comments for props and complex logic
- Use `forwardRef` for components that should forward refs
- Follow the naming convention: PascalCase for components

### Testing

Components should be tested for:

- Rendering with different props
- Accessibility compliance
- Keyboard navigation
- Event handling
- Edge cases and error states

## Roadmap

### Planned Components

- [ ] Input
- [ ] Select
- [ ] Checkbox
- [ ] Radio
- [ ] Switch
- [ ] Modal
- [ ] Tooltip
- [ ] Card
- [ ] Badge
- [ ] Avatar
- [ ] Spinner
- [ ] Alert
- [ ] Toast

### Planned Features

- [ ] Dark mode support
- [ ] Animation system
- [ ] Form validation integration
- [ ] Storybook documentation
- [ ] Visual regression testing
- [ ] Component playground

## License

ISC License - Internal use within Nexus workspace.
