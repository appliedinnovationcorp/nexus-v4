import React from 'react'

export interface User {
  id: string
  email: string
  username: string
  firstName: string
  lastName: string
  role: string
  status: string
  emailVerified: boolean
  createdAt: string
  avatarUrl?: string
  bio?: string
}

export interface UserCardProps {
  user: User
  onEdit?: (user: User) => void
  onDelete?: (userId: string) => void
  onViewProfile?: (userId: string) => void
  showActions?: boolean
  className?: string
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onDelete,
  onViewProfile,
  showActions = true,
  className = '',
}) => {
  const handleEdit = () => {
    onEdit?.(user)
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${user.username}?`)) {
      onDelete?.(user.id)
    }
  }

  const handleViewProfile = () => {
    onViewProfile?.(user.id)
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-100'
      case 'inactive':
        return 'text-gray-600 bg-gray-100'
      case 'suspended':
        return 'text-red-600 bg-red-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'text-purple-600 bg-purple-100'
      case 'moderator':
        return 'text-blue-600 bg-blue-100'
      case 'user':
        return 'text-green-600 bg-green-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex-shrink-0">
            {user.avatarUrl ? (
              <img
                className="h-12 w-12 rounded-full object-cover"
                src={user.avatarUrl}
                alt={`${user.firstName} ${user.lastName}`}
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-gray-600 font-medium text-lg">
                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {user.firstName} {user.lastName}
              </h3>
              {user.emailVerified && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                  Verified
                </span>
              )}
            </div>
            
            <p className="text-sm text-gray-600 truncate">@{user.username}</p>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            
            {user.bio && (
              <p className="text-sm text-gray-700 mt-2 line-clamp-2">{user.bio}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2">
          <div className="flex space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
              {user.role}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(user.status)}`}>
              {user.status}
            </span>
          </div>
          
          <p className="text-xs text-gray-500">
            Joined {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {showActions && (
        <div className="mt-4 flex justify-end space-x-2">
          {onViewProfile && (
            <button
              onClick={handleViewProfile}
              className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              View Profile
            </button>
          )}
          
          {onEdit && (
            <button
              onClick={handleEdit}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Edit
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={handleDelete}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}
