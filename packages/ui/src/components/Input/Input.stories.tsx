import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { Input } from './Input';
import { Search, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { useState } from 'react';

const meta: Meta<typeof Input> = {
  title: 'Components/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The Input component is a flexible, accessible text input that supports multiple variants, sizes, and states.
Built with proper ARIA attributes and keyboard navigation support.

## Features
- Multiple variants (default, filled, flushed)
- Various sizes (sm, default, lg)
- State management (default, error, success, warning)
- Start and end icons
- Loading state
- Label and helper text support
- Accessible by default
- Form validation support
        `,
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'filled', 'flushed'],
      description: 'Visual style variant of the input',
    },
    size: {
      control: 'select',
      options: ['sm', 'default', 'lg'],
      description: 'Size of the input',
    },
    state: {
      control: 'select',
      options: ['default', 'error', 'success', 'warning'],
      description: 'Visual state of the input',
    },
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
      description: 'HTML input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled',
    },
    loading: {
      control: 'boolean',
      description: 'Whether the input is in loading state',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    label: {
      control: 'text',
      description: 'Label text',
    },
    helperText: {
      control: 'text',
      description: 'Helper text displayed below input',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

// Basic variants
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
    onChange: action('changed'),
  },
};

export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
    onChange: action('changed'),
  },
};

export const WithHelperText: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    helperText: 'Username must be at least 3 characters long',
    onChange: action('changed'),
  },
};

export const WithError: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    type: 'email',
    error: 'Please enter a valid email address',
    onChange: action('changed'),
  },
};

// Variants
export const Filled: Story = {
  args: {
    variant: 'filled',
    label: 'Search',
    placeholder: 'Search...',
    onChange: action('changed'),
  },
};

export const Flushed: Story = {
  args: {
    variant: 'flushed',
    label: 'Name',
    placeholder: 'Enter your name',
    onChange: action('changed'),
  },
};

// Sizes
export const Small: Story = {
  args: {
    size: 'sm',
    label: 'Small Input',
    placeholder: 'Small size',
    onChange: action('changed'),
  },
};

export const Large: Story = {
  args: {
    size: 'lg',
    label: 'Large Input',
    placeholder: 'Large size',
    onChange: action('changed'),
  },
};

// States
export const Success: Story = {
  args: {
    state: 'success',
    label: 'Valid Email',
    placeholder: 'user@example.com',
    value: 'user@example.com',
    helperText: 'Email address is valid',
    onChange: action('changed'),
  },
};

export const Warning: Story = {
  args: {
    state: 'warning',
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    helperText: 'Password strength: Weak',
    onChange: action('changed'),
  },
};

// With icons
export const WithStartIcon: Story = {
  args: {
    label: 'Search',
    placeholder: 'Search...',
    startIcon: <Search className="h-4 w-4" />,
    onChange: action('changed'),
  },
};

export const WithEndIcon: Story = {
  args: {
    label: 'Email',
    type: 'email',
    placeholder: 'Enter email',
    endIcon: <Mail className="h-4 w-4" />,
    onChange: action('changed'),
  },
};

export const WithBothIcons: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    startIcon: <User className="h-4 w-4" />,
    endIcon: <Search className="h-4 w-4" />,
    onChange: action('changed'),
  },
};

// Loading state
export const Loading: Story = {
  args: {
    label: 'Checking availability...',
    placeholder: 'Enter username',
    loading: true,
    onChange: action('changed'),
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'Cannot edit',
    disabled: true,
    value: 'Disabled value',
    onChange: action('changed'),
  },
};

// Interactive examples
export const PasswordToggle: Story = {
  render: () => {
    const [showPassword, setShowPassword] = useState(false);
    const [password, setPassword] = useState('');

    return (
      <Input
        label="Password"
        type={showPassword ? 'text' : 'password'}
        placeholder="Enter your password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        startIcon={<Lock className="h-4 w-4" />}
        endIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
        helperText="Password must be at least 8 characters"
      />
    );
  },
};

export const FormValidation: Story = {
  render: () => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const validateEmail = (value: string) => {
      if (!value) {
        setError('Email is required');
      } else if (!/\S+@\S+\.\S+/.test(value)) {
        setError('Please enter a valid email address');
      } else {
        setError('');
      }
    };

    return (
      <Input
        label="Email Address"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          validateEmail(e.target.value);
        }}
        onBlur={() => validateEmail(email)}
        error={error}
        startIcon={<Mail className="h-4 w-4" />}
        state={error ? 'error' : email && !error ? 'success' : 'default'}
        helperText={!error && email && !error ? 'Email looks good!' : undefined}
      />
    );
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <Input
        variant="default"
        label="Default Variant"
        placeholder="Default input"
        onChange={action('default changed')}
      />
      <Input
        variant="filled"
        label="Filled Variant"
        placeholder="Filled input"
        onChange={action('filled changed')}
      />
      <Input
        variant="flushed"
        label="Flushed Variant"
        placeholder="Flushed input"
        onChange={action('flushed changed')}
      />
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <Input
        size="sm"
        label="Small Size"
        placeholder="Small input"
        onChange={action('small changed')}
      />
      <Input
        size="default"
        label="Default Size"
        placeholder="Default input"
        onChange={action('default changed')}
      />
      <Input
        size="lg"
        label="Large Size"
        placeholder="Large input"
        onChange={action('large changed')}
      />
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};

export const AllStates: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <Input
        label="Default State"
        placeholder="Default state"
        onChange={action('default changed')}
      />
      <Input
        state="success"
        label="Success State"
        placeholder="Success state"
        value="Valid input"
        helperText="This input is valid"
        onChange={action('success changed')}
      />
      <Input
        state="warning"
        label="Warning State"
        placeholder="Warning state"
        helperText="This needs attention"
        onChange={action('warning changed')}
      />
      <Input
        error="This field is required"
        label="Error State"
        placeholder="Error state"
        onChange={action('error changed')}
      />
    </div>
  ),
  parameters: {
    layout: 'padded',
  },
};
