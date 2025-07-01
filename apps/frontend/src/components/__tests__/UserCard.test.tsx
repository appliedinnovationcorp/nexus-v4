import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { UserCard, User, UserCardProps } from '../UserCard'

const mockUser: User = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  email: 'john.doe@example.com',
  username: 'johndoe',
  firstName: 'John',
  lastName: 'Doe',
  role: 'USER',
  status: 'ACTIVE',
  emailVerified: true,
  createdAt: '2023-01-01T00:00:00.000Z',
  bio: 'Software developer passionate about web technologies.',
  avatarUrl: 'https://example.com/avatar.jpg',
}

const defaultProps: UserCardProps = {
  user: mockUser,
}

describe('UserCard', () => {
  beforeEach(() => {
    // Mock window.confirm
    global.confirm = jest.fn(() => true)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render user information correctly', () => {
      render(<UserCard {...defaultProps} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('@johndoe')).toBeInTheDocument()
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument()
      expect(screen.getByText('Software developer passionate about web technologies.')).toBeInTheDocument()
    })

    it('should render user avatar when avatarUrl is provided', () => {
      render(<UserCard {...defaultProps} />)

      const avatar = screen.getByAltText('John Doe')
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('should render initials when no avatarUrl is provided', () => {
      const userWithoutAvatar = { ...mockUser, avatarUrl: undefined }
      render(<UserCard user={userWithoutAvatar} />)

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should render verified badge when email is verified', () => {
      render(<UserCard {...defaultProps} />)

      expect(screen.getByText('Verified')).toBeInTheDocument()
    })

    it('should not render verified badge when email is not verified', () => {
      const unverifiedUser = { ...mockUser, emailVerified: false }
      render(<UserCard user={unverifiedUser} />)

      expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    })

    it('should render role and status badges', () => {
      render(<UserCard {...defaultProps} />)

      expect(screen.getByText('USER')).toBeInTheDocument()
      expect(screen.getByText('ACTIVE')).toBeInTheDocument()
    })

    it('should render join date', () => {
      render(<UserCard {...defaultProps} />)

      expect(screen.getByText(/Joined/)).toBeInTheDocument()
    })

    it('should not render bio when not provided', () => {
      const userWithoutBio = { ...mockUser, bio: undefined }
      render(<UserCard user={userWithoutBio} />)

      expect(screen.queryByText('Software developer passionate about web technologies.')).not.toBeInTheDocument()
    })
  })

  describe('status colors', () => {
    it('should apply correct color for active status', () => {
      render(<UserCard {...defaultProps} />)

      const statusBadge = screen.getByText('ACTIVE')
      expect(statusBadge).toHaveClass('text-green-600', 'bg-green-100')
    })

    it('should apply correct color for inactive status', () => {
      const inactiveUser = { ...mockUser, status: 'INACTIVE' }
      render(<UserCard user={inactiveUser} />)

      const statusBadge = screen.getByText('INACTIVE')
      expect(statusBadge).toHaveClass('text-gray-600', 'bg-gray-100')
    })

    it('should apply correct color for suspended status', () => {
      const suspendedUser = { ...mockUser, status: 'SUSPENDED' }
      render(<UserCard user={suspendedUser} />)

      const statusBadge = screen.getByText('SUSPENDED')
      expect(statusBadge).toHaveClass('text-red-600', 'bg-red-100')
    })

    it('should apply correct color for pending status', () => {
      const pendingUser = { ...mockUser, status: 'PENDING' }
      render(<UserCard user={pendingUser} />)

      const statusBadge = screen.getByText('PENDING')
      expect(statusBadge).toHaveClass('text-yellow-600', 'bg-yellow-100')
    })
  })

  describe('role colors', () => {
    it('should apply correct color for admin role', () => {
      const adminUser = { ...mockUser, role: 'ADMIN' }
      render(<UserCard user={adminUser} />)

      const roleBadge = screen.getByText('ADMIN')
      expect(roleBadge).toHaveClass('text-purple-600', 'bg-purple-100')
    })

    it('should apply correct color for moderator role', () => {
      const moderatorUser = { ...mockUser, role: 'MODERATOR' }
      render(<UserCard user={moderatorUser} />)

      const roleBadge = screen.getByText('MODERATOR')
      expect(roleBadge).toHaveClass('text-blue-600', 'bg-blue-100')
    })

    it('should apply correct color for user role', () => {
      render(<UserCard {...defaultProps} />)

      const roleBadge = screen.getByText('USER')
      expect(roleBadge).toHaveClass('text-green-600', 'bg-green-100')
    })
  })

  describe('actions', () => {
    it('should render action buttons when showActions is true', () => {
      const props = {
        ...defaultProps,
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onViewProfile: jest.fn(),
        showActions: true,
      }
      render(<UserCard {...props} />)

      expect(screen.getByText('View Profile')).toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })

    it('should not render action buttons when showActions is false', () => {
      const props = {
        ...defaultProps,
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onViewProfile: jest.fn(),
        showActions: false,
      }
      render(<UserCard {...props} />)

      expect(screen.queryByText('View Profile')).not.toBeInTheDocument()
      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })

    it('should call onViewProfile when View Profile button is clicked', () => {
      const onViewProfile = jest.fn()
      const props = { ...defaultProps, onViewProfile }
      render(<UserCard {...props} />)

      fireEvent.click(screen.getByText('View Profile'))
      expect(onViewProfile).toHaveBeenCalledWith(mockUser.id)
    })

    it('should call onEdit when Edit button is clicked', () => {
      const onEdit = jest.fn()
      const props = { ...defaultProps, onEdit }
      render(<UserCard {...props} />)

      fireEvent.click(screen.getByText('Edit'))
      expect(onEdit).toHaveBeenCalledWith(mockUser)
    })

    it('should call onDelete when Delete button is clicked and confirmed', () => {
      const onDelete = jest.fn()
      const props = { ...defaultProps, onDelete }
      render(<UserCard {...props} />)

      fireEvent.click(screen.getByText('Delete'))
      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete johndoe?')
      expect(onDelete).toHaveBeenCalledWith(mockUser.id)
    })

    it('should not call onDelete when Delete button is clicked but not confirmed', () => {
      global.confirm = jest.fn(() => false)
      const onDelete = jest.fn()
      const props = { ...defaultProps, onDelete }
      render(<UserCard {...props} />)

      fireEvent.click(screen.getByText('Delete'))
      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete johndoe?')
      expect(onDelete).not.toHaveBeenCalled()
    })

    it('should only render buttons for provided callbacks', () => {
      const props = { ...defaultProps, onEdit: jest.fn() }
      render(<UserCard {...props} />)

      expect(screen.queryByText('View Profile')).not.toBeInTheDocument()
      expect(screen.getByText('Edit')).toBeInTheDocument()
      expect(screen.queryByText('Delete')).not.toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('should apply custom className', () => {
      const { container } = render(<UserCard {...defaultProps} className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })

    it('should apply default styling classes', () => {
      const { container } = render(<UserCard {...defaultProps} />)

      expect(container.firstChild).toHaveClass('bg-white', 'rounded-lg', 'shadow-md', 'p-6')
    })
  })
})
