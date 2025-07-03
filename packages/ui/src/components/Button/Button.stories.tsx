import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Button } from './Button';
import { Plus, Download, ArrowRight, Heart } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Button component is a versatile, accessible button that supports multiple variants, sizes, and states.
Built with Radix UI primitives and styled with Tailwind CSS.

## Features
- Multiple variants (default, destructive, outline, secondary, ghost, link)
- Various sizes (sm, default, lg, xl, icon)
- Loading state with spinner
- Left and right icons
- Full width option
- Accessible by default
- Keyboard navigation support
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
      description: 'Visual style variant of the button',
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg', 'xl', 'icon'],
      description: 'Size of the button',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Whether the button should take full width',
    },
    loading: {
      control: 'boolean',
      description: 'Loading state of the button',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the button is disabled',
    },
    onClick: {
      action: 'clicked',
      description: 'Function called when button is clicked',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

// Basic variants
export const Default: Story = {
  args: {
    children: 'Button',
    onClick: action('clicked'),
  },
};

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: 'Delete',
    onClick: action('clicked'),
  },
};

export const Outline: Story = {
  args: {
    variant: 'outline',
    children: 'Button',
    onClick: action('clicked'),
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Button',
    onClick: action('clicked'),
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Button',
    onClick: action('clicked'),
  },
};

export const Link: Story = {
  args: {
    variant: 'link',
    children: 'Link Button',
    onClick: action('clicked'),
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    children: 'Small Button',
    onClick: action('clicked'),
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    children: 'Large Button',
    onClick: action('clicked'),
  },
};

export const ExtraLarge: Story = {
  args: {
    size: 'xl',
    children: 'Extra Large Button',
    onClick: action('clicked'),
  },
};

// Icon button
export const IconButton: Story = {
  args: {
    size: 'icon',
    children: <Plus className="h-4 w-4" />,
    onClick: action('clicked'),
  },
};

// With icons
export const WithLeftIcon: Story = {
  args: {
    leftIcon: <Plus className="h-4 w-4" />,
    children: 'Add Item',
    onClick: action('clicked'),
  },
};

export const WithRightIcon: Story = {
  args: {
    rightIcon: <ArrowRight className="h-4 w-4" />,
    children: 'Continue',
    onClick: action('clicked'),
  },
};

export const WithBothIcons: Story = {
  args: {
    leftIcon: <Download className="h-4 w-4" />,
    rightIcon: <ArrowRight className="h-4 w-4" />,
    children: 'Download',
    onClick: action('clicked'),
  },
};

// States
export const Loading: Story = {
  args: {
    loading: true,
    children: 'Loading...',
    onClick: action('clicked'),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: 'Disabled',
    onClick: action('clicked'),
  },
};

export const FullWidth: Story = {
  args: {
    fullWidth: true,
    children: 'Full Width Button',
    onClick: action('clicked'),
  },
  parameters: {
    layout: 'padded',
  },
};

// Interactive examples
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button onClick={action('default clicked')}>Default</Button>
      <Button variant="destructive" onClick={action('destructive clicked')}>
        Destructive
      </Button>
      <Button variant="outline" onClick={action('outline clicked')}>
        Outline
      </Button>
      <Button variant="secondary" onClick={action('secondary clicked')}>
        Secondary
      </Button>
      <Button variant="ghost" onClick={action('ghost clicked')}>
        Ghost
      </Button>
      <Button variant="link" onClick={action('link clicked')}>
        Link
      </Button>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Button size="sm" onClick={action('small clicked')}>
        Small
      </Button>
      <Button onClick={action('default clicked')}>Default</Button>
      <Button size="lg" onClick={action('large clicked')}>
        Large
      </Button>
      <Button size="xl" onClick={action('xl clicked')}>
        Extra Large
      </Button>
      <Button size="icon" onClick={action('icon clicked')}>
        <Heart className="h-4 w-4" />
      </Button>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const LoadingStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button loading onClick={action('loading default clicked')}>
        Loading Default
      </Button>
      <Button variant="outline" loading onClick={action('loading outline clicked')}>
        Loading Outline
      </Button>
      <Button variant="secondary" loading onClick={action('loading secondary clicked')}>
        Loading Secondary
      </Button>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

// Accessibility story
export const Accessibility: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Keyboard Navigation</h3>
        <p className="text-sm text-gray-600 mb-4">
          Use Tab to navigate between buttons, Enter or Space to activate.
        </p>
        <div className="flex gap-2">
          <Button onClick={action('first clicked')}>First Button</Button>
          <Button variant="outline" onClick={action('second clicked')}>
            Second Button
          </Button>
          <Button variant="secondary" onClick={action('third clicked')}>
            Third Button
          </Button>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-semibold mb-2">Screen Reader Support</h3>
        <p className="text-sm text-gray-600 mb-4">
          Buttons include proper ARIA attributes and semantic HTML.
        </p>
        <div className="flex gap-2">
          <Button 
            aria-label="Add new item to your collection"
            onClick={action('add clicked')}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            aria-describedby="delete-help"
            variant="destructive"
            onClick={action('delete clicked')}
          >
            Delete Item
          </Button>
          <div id="delete-help" className="sr-only">
            This action cannot be undone
          </div>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
