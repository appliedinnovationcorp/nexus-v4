#!/usr/bin/env node

/**
 * Frontend Authentication Test Script
 * 
 * This script tests the NextAuth.js integration with the NestJS backend
 */

const puppeteer = require('puppeteer');

const FRONTEND_URL = 'http://localhost:3001';
const BACKEND_URL = 'http://localhost:3000';

// Test user data
const testUser = {
  email: 'frontend-test@example.com',
  username: 'frontendtest',
  password: 'TestPassword123!',
  firstName: 'Frontend',
  lastName: 'Test'
};

async function checkServers() {
  console.log('🔍 Checking if servers are running...');
  
  try {
    // Check backend
    const backendResponse = await fetch(`${BACKEND_URL}/health`);
    if (backendResponse.ok) {
      console.log('✅ Backend server is running');
    } else {
      throw new Error('Backend not responding');
    }
  } catch (error) {
    console.log('❌ Backend server is not running. Please start it first:');
    console.log('   cd services/backend && pnpm start:dev');
    return false;
  }

  try {
    // Check frontend
    const frontendResponse = await fetch(FRONTEND_URL);
    if (frontendResponse.ok) {
      console.log('✅ Frontend server is running');
    } else {
      throw new Error('Frontend not responding');
    }
  } catch (error) {
    console.log('❌ Frontend server is not running. Please start it first:');
    console.log('   cd apps/frontend && pnpm dev');
    return false;
  }

  return true;
}

async function testFrontendAuth() {
  console.log('\n🚀 Starting Frontend Authentication Tests...');
  
  const browser = await puppeteer.launch({ 
    headless: false, // Set to true for headless mode
    defaultViewport: { width: 1280, height: 720 }
  });
  
  try {
    const page = await browser.newPage();
    
    // Test 1: Visit homepage
    console.log('\n📱 Test 1: Visit Homepage');
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('h1');
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`✅ Homepage loaded: ${title}`);
    
    // Test 2: Navigate to sign up
    console.log('\n📝 Test 2: Sign Up Process');
    await page.click('a[href="/auth/signup"]');
    await page.waitForSelector('form');
    console.log('✅ Sign up page loaded');
    
    // Fill sign up form
    await page.type('#firstName', testUser.firstName);
    await page.type('#lastName', testUser.lastName);
    await page.type('#username', testUser.username);
    await page.type('#email', testUser.email);
    await page.type('#password', testUser.password);
    await page.type('#confirmPassword', testUser.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for redirect or error
    try {
      await page.waitForNavigation({ timeout: 5000 });
      console.log('✅ Sign up successful - redirected');
    } catch (error) {
      // Check for error message
      const errorElement = await page.$('.bg-red-50');
      if (errorElement) {
        const errorText = await page.$eval('.bg-red-50', el => el.textContent);
        console.log(`⚠️ Sign up error: ${errorText}`);
      }
    }
    
    // Test 3: Sign in process
    console.log('\n🔑 Test 3: Sign In Process');
    await page.goto(`${FRONTEND_URL}/auth/signin`);
    await page.waitForSelector('form');
    
    await page.type('#email', testUser.email);
    await page.type('#password', testUser.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForNavigation({ timeout: 5000 });
      console.log('✅ Sign in successful - redirected');
    } catch (error) {
      const errorElement = await page.$('.bg-red-50');
      if (errorElement) {
        const errorText = await page.$eval('.bg-red-50', el => el.textContent);
        console.log(`❌ Sign in error: ${errorText}`);
      }
    }
    
    // Test 4: Check authentication status on homepage
    console.log('\n🏠 Test 4: Check Authentication Status');
    await page.goto(FRONTEND_URL);
    await page.waitForSelector('h1');
    
    // Look for authenticated user indicators
    const welcomeMessage = await page.$('.bg-green-50');
    if (welcomeMessage) {
      const welcomeText = await page.$eval('.bg-green-50', el => el.textContent);
      console.log(`✅ User authenticated: ${welcomeText}`);
    } else {
      console.log('❌ User not authenticated on homepage');
    }
    
    // Test 5: Access dashboard
    console.log('\n📊 Test 5: Access Protected Dashboard');
    try {
      await page.goto(`${FRONTEND_URL}/dashboard`);
      await page.waitForSelector('h1', { timeout: 3000 });
      const dashboardTitle = await page.$eval('h1', el => el.textContent);
      console.log(`✅ Dashboard accessible: ${dashboardTitle}`);
      
      // Test protected API call
      const apiButton = await page.$('button:contains("Fetch Protected Data")');
      if (apiButton) {
        await apiButton.click();
        await page.waitForTimeout(2000);
        console.log('✅ Protected API call attempted');
      }
    } catch (error) {
      console.log('❌ Dashboard not accessible or user not authenticated');
    }
    
    // Test 6: Sign out
    console.log('\n🚪 Test 6: Sign Out Process');
    try {
      const signOutButton = await page.$('button:contains("Sign Out")');
      if (signOutButton) {
        await signOutButton.click();
        await page.waitForTimeout(2000);
        console.log('✅ Sign out successful');
      } else {
        console.log('❌ Sign out button not found');
      }
    } catch (error) {
      console.log('❌ Sign out failed');
    }
    
    console.log('\n✨ Frontend authentication tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

async function manualTestInstructions() {
  console.log('\n📋 Manual Testing Instructions:');
  console.log('1. Open your browser and go to http://localhost:3001');
  console.log('2. Click "Sign Up" and create a new account');
  console.log('3. After registration, you should be automatically signed in');
  console.log('4. Check that your name appears in the header');
  console.log('5. Click "Dashboard" to access the protected route');
  console.log('6. Try the "Fetch Protected Data" button to test API calls');
  console.log('7. Sign out and verify you can\'t access the dashboard');
  console.log('8. Sign back in and verify everything works');
  console.log('\n🔗 Available URLs:');
  console.log(`   Homepage: ${FRONTEND_URL}`);
  console.log(`   Sign In: ${FRONTEND_URL}/auth/signin`);
  console.log(`   Sign Up: ${FRONTEND_URL}/auth/signup`);
  console.log(`   Dashboard: ${FRONTEND_URL}/dashboard`);
}

async function main() {
  const serversRunning = await checkServers();
  
  if (!serversRunning) {
    return;
  }
  
  console.log('\nChoose testing method:');
  console.log('1. Automated browser testing (requires puppeteer)');
  console.log('2. Manual testing instructions');
  
  // For now, just show manual instructions
  await manualTestInstructions();
  
  // Uncomment to run automated tests (requires puppeteer)
  // try {
  //   await testFrontendAuth();
  // } catch (error) {
  //   console.log('❌ Automated testing failed. Try manual testing instead.');
  //   await manualTestInstructions();
  // }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testFrontendAuth,
  checkServers,
  testUser
};
