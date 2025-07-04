/**
 * @fileoverview Tests for Input component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Input } from '../components/Input/Input';

describe('Input Component', () => {
  test('renders input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  test('handles value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test value' } });
    
    expect(handleChange).toHaveBeenCalled();
  });

  test('applies variant classes correctly', () => {
    render(<Input variant="filled" placeholder="Filled input" />);
    const input = screen.getByPlaceholderText('Filled input');
    expect(input).toHaveClass('bg-muted');
  });

  test('applies size classes correctly', () => {
    render(<Input size="lg" placeholder="Large input" />);
    const input = screen.getByPlaceholderText('Large input');
    expect(input).toHaveClass('h-12');
  });

  test('applies state classes correctly', () => {
    render(<Input state="error" placeholder="Error input" />);
    const input = screen.getByPlaceholderText('Error input');
    expect(input).toHaveClass('border-destructive');
  });

  test('can be disabled', () => {
    render(<Input disabled placeholder="Disabled input" />);
    const input = screen.getByPlaceholderText('Disabled input');
    expect(input).toBeDisabled();
    expect(input).toHaveClass('opacity-50');
  });

  test('renders with label', () => {
    render(<Input label="Email Address" placeholder="Enter email" />);
    expect(screen.getByText('Email Address')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
  });

  test('renders with helper text', () => {
    render(<Input helperText="Enter a valid email address" />);
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument();
  });

  test('renders with error message', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  test('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  test('applies custom className', () => {
    render(<Input className="custom-input" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-input');
  });

  test('supports different input types', () => {
    const { rerender } = render(<Input type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    
    rerender(<Input type="password" />);
    expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'password');
  });

  test('supports all input variants', () => {
    const variants = ['default', 'filled', 'flushed'];
    
    variants.forEach(variant => {
      const { unmount } = render(<Input variant={variant as any} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      unmount();
    });
  });

  test('supports all input sizes', () => {
    const sizes = ['sm', 'default', 'lg'];
    
    sizes.forEach(size => {
      const { unmount } = render(<Input size={size as any} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      unmount();
    });
  });

  test('supports all input states', () => {
    const states = ['default', 'error', 'success', 'warning'];
    
    states.forEach(state => {
      const { unmount } = render(<Input state={state as any} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      unmount();
    });
  });
});
