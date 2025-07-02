# 🎭 End-to-End Testing Suite

Comprehensive E2E testing suite for the Nexus Workspace using Playwright. This package contains tests that simulate real user journeys and validate the entire application stack.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- pnpm >= 8.0.0
- Running Nexus applications (frontend and backend)

### Installation

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install
```

### Configuration

1. Copy the environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Update the environment variables:
   ```bash
   # Application URLs
   E2E_BASE_URL=http://localhost:3000
   E2E_API_URL=http://localhost:3001/api
   
   # Test database
   E2E_DATABASE_URL=postgresql://test:test@localhost:5432/nexus_test
   
   # Test user credentials
   E2E_TEST_USER_EMAIL=test@example.com
   E2E_TEST_USER_PASSWORD=TestPassword123!
   ```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in headed mode (see browser)
pnpm test:headed

# Run tests with UI mode
pnpm test:ui

# Run specific test suites
pnpm test:smoke      # Critical path tests
pnpm test:auth       # Authentication tests
pnpm test:regression # Full regression suite

# Run tests in parallel
pnpm test:parallel

# Debug tests
pnpm test:debug
```

## 📁 Test Structure

```
tests/
├── auth/                    # Authentication tests
│   ├── auth.setup.ts       # Authentication setup
│   ├── login.spec.ts       # Login functionality
│   ├── registration.spec.ts # User registration
│   └── logout.spec.ts      # Logout functionality
├── user-journeys/          # Complete user workflows
│   └── complete-user-journey.spec.ts
├── api/                    # API testing
│   └── api.spec.ts
├── visual/                 # Visual regression tests
│   └── visual-regression.spec.ts
└── smoke/                  # Critical path tests
    └── smoke.spec.ts
```

## 🎯 Test Categories

### 🔥 Smoke Tests (`@smoke`)
Critical path tests that verify core functionality:
- Application loads and basic navigation
- User authentication (login/logout)
- API health checks
- Core page accessibility

### 🔐 Authentication Tests
Comprehensive authentication flow testing:
- Login with valid/invalid credentials
- User registration and validation
- Password reset functionality
- Session management
- Logout and session cleanup

### 🚶 User Journey Tests
End-to-end user workflows:
- New user registration to first action
- Returning user advanced workflows
- Mobile user experience
- Error recovery scenarios

### 🔌 API Tests
Backend API validation:
- Authentication endpoints
- CRUD operations
- Error handling
- Performance testing
- Rate limiting

### 👁️ Visual Regression Tests (`@visual`)
Screenshot-based visual testing:
- Page layout consistency
- Component visual states
- Responsive design validation
- Theme and styling verification

### 📱 Mobile Tests (`@mobile`)
Mobile-specific functionality:
- Touch interactions
- Responsive layouts
- Mobile navigation
- Device-specific features

## 🛠️ Configuration

### Playwright Configuration

The test suite is configured in `playwright.config.ts` with:

- **Multiple Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Parallel Execution**: Configurable worker count
- **Screenshots & Videos**: Captured on failure
- **Trace Files**: Detailed debugging information
- **Global Setup/Teardown**: Database and authentication setup

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `E2E_BASE_URL` | Frontend application URL | Yes |
| `E2E_API_URL` | Backend API URL | Yes |
| `E2E_DATABASE_URL` | Test database connection | Yes |
| `E2E_TEST_USER_EMAIL` | Test user email | Yes |
| `E2E_TEST_USER_PASSWORD` | Test user password | Yes |
| `E2E_HEADLESS` | Run tests in headless mode | No |
| `E2E_WORKERS` | Number of parallel workers | No |

## 🐳 Docker Testing

Run tests in isolated Docker environment:

```bash
# Build and run test environment
pnpm test:docker

# Or use docker-compose directly
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

The Docker setup includes:
- PostgreSQL test database
- Redis for caching
- Backend service
- Frontend service
- E2E test runner
- MailHog for email testing

## 📊 Test Reports

### HTML Report
```bash
# Generate and view HTML report
pnpm test:report
```

### Test Results
- **JUnit XML**: `test-results/junit.xml`
- **JSON Results**: `test-results/results.json`
- **Screenshots**: `test-results/`
- **Videos**: `test-results/`
- **Traces**: `test-results/`

## 🔧 Debugging

### Debug Mode
```bash
# Run tests in debug mode
pnpm test:debug

# Debug specific test
pnpm exec playwright test tests/auth/login.spec.ts --debug
```

### Trace Viewer
```bash
# View trace files
pnpm test:trace
```

### Code Generation
```bash
# Generate test code by recording actions
pnpm test:codegen
```

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      
      - name: Run E2E tests
        run: pnpm test:ci
        env:
          E2E_BASE_URL: http://localhost:3000
          E2E_API_URL: http://localhost:3001/api
      
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### Test Commands for CI

```bash
# CI-optimized test run
pnpm test:ci

# Smoke tests only (fast)
pnpm test:smoke

# Parallel execution
pnpm test:parallel
```

## 📝 Writing Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup for each test
    await page.goto('/feature');
  });

  test('should do something @smoke', async ({ page }) => {
    // Test implementation
    await expect(page.locator('[data-testid="element"]')).toBeVisible();
  });
});
```

### Best Practices

1. **Use data-testid attributes** for reliable element selection
2. **Tag tests appropriately** (`@smoke`, `@regression`, `@visual`)
3. **Write descriptive test names** that explain the expected behavior
4. **Use Page Object Model** for complex pages
5. **Handle async operations** with proper waits
6. **Clean up test data** in teardown hooks

### Test Data Management

```typescript
// Use unique identifiers for test data
const timestamp = Date.now();
const testUser = {
  email: `test.${timestamp}@example.com`,
  password: 'TestPassword123!',
};
```

## 🔍 Troubleshooting

### Common Issues

1. **Tests timing out**
   - Increase timeout in `playwright.config.ts`
   - Check if applications are running
   - Verify network connectivity

2. **Element not found**
   - Ensure `data-testid` attributes exist
   - Check element visibility timing
   - Use proper wait conditions

3. **Authentication failures**
   - Verify test user credentials
   - Check authentication setup
   - Ensure database is seeded

4. **Visual test failures**
   - Update baseline screenshots if intentional
   - Check for dynamic content
   - Verify consistent test environment

### Debug Commands

```bash
# Run single test with debug
pnpm exec playwright test login.spec.ts --debug

# Show test trace
pnpm exec playwright show-trace test-results/trace.zip

# Generate test report
pnpm exec playwright show-report
```

## 📈 Performance Testing

Performance tests are included to ensure:
- Page load times < 5 seconds
- API response times < 1 second
- Navigation transitions < 2 seconds
- Search operations < 3 seconds

```bash
# Run performance tests
pnpm exec playwright test --grep @performance
```

## 🤝 Contributing

1. **Add new tests** in appropriate directories
2. **Follow naming conventions** for test files
3. **Use proper test tags** for categorization
4. **Update documentation** for new features
5. **Ensure tests are stable** and not flaky

## 📚 Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices Guide](https://playwright.dev/docs/best-practices)
- [API Reference](https://playwright.dev/docs/api/class-playwright)
- [Debugging Guide](https://playwright.dev/docs/debug)

---

This E2E testing suite provides comprehensive coverage of the Nexus Workspace application, ensuring reliability and quality through automated testing of real user scenarios.
