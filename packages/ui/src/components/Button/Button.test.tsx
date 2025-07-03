import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';
import { Plus } from 'lucide-react';

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('handles click events', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('can be disabled', () => {
    render(<Button disabled>Disabled button</Button>);
    const button = screen.getByRole('button');
    
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('disabled');
  });

  it('shows loading state', () => {
    render(<Button loading>Loading button</Button>);
    const button = screen.getByRole('button');
    
    expect(button).toBeDisabled();
    expect(screen.getByText('Loading button')).toBeInTheDocument();
    // Check for loading spinner
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('renders with left icon', () => {
    render(
      <Button leftIcon={<Plus data-testid="plus-icon" />}>
        Add item
      </Button>
    );
    
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    expect(screen.getByText('Add item')).toBeInTheDocument();
  });

  it('renders with right icon', () => {
    render(
      <Button rightIcon={<Plus data-testid="plus-icon" />}>
        Add item
      </Button>
    );
    
    expect(screen.getByTestId('plus-icon')).toBeInTheDocument();
    expect(screen.getByText('Add item')).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<Button variant="destructive">Button</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('bg-destructive');

    rerender(<Button variant="outline">Button</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('border', 'border-input');

    rerender(<Button variant="ghost">Button</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('hover:bg-accent');
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Button</Button>);
    let button = screen.getByRole('button');
    expect(button).toHaveClass('h-9');

    rerender(<Button size="lg">Button</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-11');

    rerender(<Button size="icon">Button</Button>);
    button = screen.getByRole('button');
    expect(button).toHaveClass('h-10', 'w-10');
  });

  it('applies fullWidth class when specified', () => {
    render(<Button fullWidth>Full width button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('w-full');
  });

  it('forwards ref correctly', () => {
    const ref = jest.fn();
    render(<Button ref={ref}>Button</Button>);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLButtonElement));
  });

  it('supports keyboard navigation', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Button</Button>);
    const button = screen.getByRole('button');
    
    button.focus();
    expect(button).toHaveFocus();
    
    await user.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalledTimes(1);
    
    await user.keyboard(' ');
    expect(handleClick).toHaveBeenCalledTimes(2);
  });

  it('prevents click when loading', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup();
    
    render(<Button loading onClick={handleClick}>Loading</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    );
    
    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/test');
    expect(link).toHaveTextContent('Link button');
  });

  it('applies custom className', () => {
    render(<Button className="custom-class">Button</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('passes through additional props', () => {
    render(
      <Button data-testid="custom-button" aria-label="Custom button">
        Button
      </Button>
    );
    
    const button = screen.getByTestId('custom-button');
    expect(button).toHaveAttribute('aria-label', 'Custom button');
  });

  describe('accessibility', () => {
    it('has proper ARIA attributes when disabled', () => {
      render(<Button disabled>Disabled button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('has proper ARIA attributes when loading', () => {
      render(<Button loading>Loading button</Button>);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('aria-disabled', 'true');
    });

    it('supports custom ARIA labels', () => {
      render(
        <Button aria-label="Close dialog" size="icon">
          ×
        </Button>
      );
      
      const button = screen.getByRole('button', { name: /close dialog/i });
      expect(button).toBeInTheDocument();
    });
  });
});
