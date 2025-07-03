#!/usr/bin/env node

/**
 * Authentication Test Script
 * 
 * This script demonstrates the complete authentication flow:
 * 1. Register a new user
 * 2. Login with credentials
 * 3. Access protected routes
 * 4. Test role-based access
 * 5. Refresh tokens
 * 6. Logout
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const API_URL = `${BASE_URL}/api`;

// Test user data
const testUser = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'TestPassword123!',
  firstName: 'Test',
  lastName: 'User'
};

const adminUser = {
  email: 'admin@example.com',
  username: 'admin',
  password: 'AdminPassword123!',
  firstName: 'Admin',
  lastName: 'User',
  role: 'ADMIN'
};

let userTokens = null;
let adminTokens = null;

async function makeRequest(method, endpoint, data = null, token = null) {
  try {
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status
    };
  }
}

async function testRegistration() {
  console.log('\n🔐 Testing User Registration...');
  
  // Register regular user
  const userResult = await makeRequest('POST', '/auth/register', testUser);
  if (userResult.success) {
    console.log('✅ User registration successful');
    userTokens = userResult.data.tokens;
    console.log(`   Access Token: ${userTokens.accessToken.substring(0, 20)}...`);
  } else {
    console.log('❌ User registration failed:', userResult.error);
  }

  // Register admin user
  const adminResult = await makeRequest('POST', '/auth/register', adminUser);
  if (adminResult.success) {
    console.log('✅ Admin registration successful');
    adminTokens = adminResult.data.tokens;
  } else {
    console.log('❌ Admin registration failed:', adminResult.error);
  }
}

async function testLogin() {
  console.log('\n🔑 Testing User Login...');
  
  const result = await makeRequest('POST', '/auth/login', {
    email: testUser.email,
    password: testUser.password
  });

  if (result.success) {
    console.log('✅ Login successful');
    userTokens = result.data.tokens;
    console.log(`   User: ${result.data.user.username} (${result.data.user.role})`);
  } else {
    console.log('❌ Login failed:', result.error);
  }
}

async function testPublicRoute() {
  console.log('\n🌐 Testing Public Route...');
  
  const result = await makeRequest('GET', '/protected/public');
  
  if (result.success) {
    console.log('✅ Public route accessible');
    console.log(`   Message: ${result.data.message}`);
  } else {
    console.log('❌ Public route failed:', result.error);
  }
}

async function testProtectedRoute() {
  console.log('\n🛡️ Testing Protected Route...');
  
  // Test without token
  const noTokenResult = await makeRequest('GET', '/protected/profile');
  if (!noTokenResult.success && noTokenResult.status === 401) {
    console.log('✅ Protected route correctly rejects requests without token');
  } else {
    console.log('❌ Protected route should reject requests without token');
  }

  // Test with valid token
  if (userTokens) {
    const withTokenResult = await makeRequest('GET', '/protected/profile', null, userTokens.accessToken);
    if (withTokenResult.success) {
      console.log('✅ Protected route accessible with valid token');
      console.log(`   User: ${withTokenResult.data.user.username}`);
    } else {
      console.log('❌ Protected route failed with valid token:', withTokenResult.error);
    }
  }
}

async function testRoleBasedAccess() {
  console.log('\n👑 Testing Role-Based Access Control...');
  
  // Test admin route with regular user (should fail)
  if (userTokens) {
    const userAdminResult = await makeRequest('GET', '/protected/admin-only', null, userTokens.accessToken);
    if (!userAdminResult.success && userAdminResult.status === 403) {
      console.log('✅ Admin route correctly rejects regular user');
    } else {
      console.log('❌ Admin route should reject regular user');
    }
  }

  // Test admin route with admin user (should succeed)
  if (adminTokens) {
    const adminResult = await makeRequest('GET', '/protected/admin-only', null, adminTokens.accessToken);
    if (adminResult.success) {
      console.log('✅ Admin route accessible by admin user');
      console.log(`   Message: ${adminResult.data.message}`);
    } else {
      console.log('❌ Admin route failed for admin user:', adminResult.error);
    }
  }
}

async function testCurrentUserDecorator() {
  console.log('\n👤 Testing CurrentUser Decorator...');
  
  if (userTokens) {
    const result = await makeRequest('GET', '/protected/user-specific-data', null, userTokens.accessToken);
    if (result.success) {
      console.log('✅ CurrentUser decorator working correctly');
      console.log(`   User ID: ${result.data.userId}`);
      console.log(`   Email: ${result.data.userEmail}`);
      console.log(`   Role: ${result.data.userRole}`);
    } else {
      console.log('❌ CurrentUser decorator failed:', result.error);
    }
  }
}

async function testUserAction() {
  console.log('\n⚡ Testing User Action Endpoint...');
  
  if (userTokens) {
    const result = await makeRequest('POST', '/protected/user-action', {
      action: 'test-action',
      data: { key: 'value' }
    }, userTokens.accessToken);

    if (result.success) {
      console.log('✅ User action completed successfully');
      console.log(`   Action: ${result.data.message}`);
      console.log(`   Performed by: ${result.data.performedBy.username}`);
    } else {
      console.log('❌ User action failed:', result.error);
    }
  }
}

async function testTokenRefresh() {
  console.log('\n🔄 Testing Token Refresh...');
  
  if (userTokens && userTokens.refreshToken) {
    const result = await makeRequest('POST', '/auth/refresh', {
      refreshToken: userTokens.refreshToken
    });

    if (result.success) {
      console.log('✅ Token refresh successful');
      userTokens = result.data;
      console.log(`   New Access Token: ${userTokens.accessToken.substring(0, 20)}...`);
    } else {
      console.log('❌ Token refresh failed:', result.error);
    }
  }
}

async function testGetProfile() {
  console.log('\n📋 Testing Get Profile...');
  
  if (userTokens) {
    const result = await makeRequest('GET', '/auth/me', null, userTokens.accessToken);
    if (result.success) {
      console.log('✅ Profile retrieved successfully');
      console.log(`   Username: ${result.data.username}`);
      console.log(`   Email: ${result.data.email}`);
      console.log(`   Role: ${result.data.role}`);
    } else {
      console.log('❌ Profile retrieval failed:', result.error);
    }
  }
}

async function testLogout() {
  console.log('\n🚪 Testing Logout...');
  
  if (userTokens) {
    const result = await makeRequest('POST', '/auth/logout', {
      refreshToken: userTokens.refreshToken
    }, userTokens.accessToken);

    if (result.success) {
      console.log('✅ Logout successful');
      console.log(`   Message: ${result.data.message}`);
      
      // Test that token is now invalid
      const testResult = await makeRequest('GET', '/auth/me', null, userTokens.accessToken);
      if (!testResult.success) {
        console.log('✅ Token correctly invalidated after logout');
      } else {
        console.log('❌ Token should be invalid after logout');
      }
    } else {
      console.log('❌ Logout failed:', result.error);
    }
  }
}

async function runTests() {
  console.log('🚀 Starting Authentication Tests...');
  console.log(`📡 API URL: ${API_URL}`);
  
  try {
    await testRegistration();
    await testLogin();
    await testPublicRoute();
    await testProtectedRoute();
    await testRoleBasedAccess();
    await testCurrentUserDecorator();
    await testUserAction();
    await testTokenRefresh();
    await testGetProfile();
    await testLogout();
    
    console.log('\n✨ All tests completed!');
    console.log('\n📚 Available endpoints:');
    console.log('   POST /auth/register - User registration');
    console.log('   POST /auth/login - User login');
    console.log('   POST /auth/refresh - Refresh token');
    console.log('   POST /auth/logout - User logout');
    console.log('   GET  /auth/me - Get user profile');
    console.log('   GET  /protected/public - Public endpoint');
    console.log('   GET  /protected/profile - Protected endpoint');
    console.log('   GET  /protected/admin-only - Admin only endpoint');
    console.log('   POST /protected/user-action - User action endpoint');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status === 200) {
      console.log('✅ Server is running');
      return true;
    }
  } catch (error) {
    console.log('❌ Server is not running. Please start the server first:');
    console.log('   cd services/backend && pnpm start:dev');
    return false;
  }
}

// Main execution
async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  runTests,
  makeRequest,
  testUser,
  adminUser
};
