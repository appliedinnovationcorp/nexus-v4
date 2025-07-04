const path = require('path');
const fs = require('fs-extra');
const { pascalCase, camelCase, kebabCase, snakeCase } = require('change-case');

/**
 * Plop.js Configuration for Nexus Code Generation
 * Provides interactive generators for components, modules, and services
 */
module.exports = function (plop) {
  // Set base path for templates
  plop.setDefaultInclude({ generators: true });
  
  // Register custom helpers
  plop.setHelper('pascalCase', (text) => pascalCase(text));
  plop.setHelper('camelCase', (text) => camelCase(text));
  plop.setHelper('kebabCase', (text) => kebabCase(text));
  plop.setHelper('snakeCase', (text) => snakeCase(text));
  plop.setHelper('upperCase', (text) => text.toUpperCase());
  plop.setHelper('lowerCase', (text) => text.toLowerCase());
  plop.setHelper('currentYear', () => new Date().getFullYear());
  plop.setHelper('currentDate', () => new Date().toISOString().split('T')[0]);
  
  // Custom helper for generating imports
  plop.setHelper('generateImports', (dependencies) => {
    if (!dependencies || dependencies.length === 0) return '';
    return dependencies.map(dep => `import ${dep.import} from '${dep.from}';`).join('\n');
  });

  // Custom helper for generating exports
  plop.setHelper('generateExports', (exports) => {
    if (!exports || exports.length === 0) return '';
    return exports.map(exp => `export { ${exp.name} } from './${exp.path}';`).join('\n');
  });

  // Register custom actions
  plop.setActionType('updatePackageJson', function (answers, config, plop) {
    const packageJsonPath = path.resolve(config.path, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = fs.readJsonSync(packageJsonPath);
      
      // Update package.json with new dependencies or scripts
      if (config.dependencies) {
        packageJson.dependencies = { ...packageJson.dependencies, ...config.dependencies };
      }
      
      if (config.devDependencies) {
        packageJson.devDependencies = { ...packageJson.devDependencies, ...config.devDependencies };
      }
      
      if (config.scripts) {
        packageJson.scripts = { ...packageJson.scripts, ...config.scripts };
      }
      
      fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
      return 'Updated package.json';
    }
    
    return 'package.json not found';
  });

  plop.setActionType('updateIndexFile', function (answers, config, plop) {
    const indexPath = path.resolve(config.path, 'index.ts');
    const exportLine = `export { ${answers.name} } from './${kebabCase(answers.name)}';`;
    
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      if (!content.includes(exportLine)) {
        fs.appendFileSync(indexPath, `\n${exportLine}`);
      }
    } else {
      fs.writeFileSync(indexPath, exportLine);
    }
    
    return 'Updated index.ts';
  });

  // React Component Generator
  plop.setGenerator('react-component', {
    description: 'Generate a new React component with TypeScript, tests, and Storybook',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Component name:',
        validate: (input) => {
          if (!input) return 'Component name is required';
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(input)) {
            return 'Component name must be PascalCase (e.g., MyComponent)';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'type',
        message: 'Component type:',
        choices: [
          { name: 'Functional Component (with hooks)', value: 'functional' },
          { name: 'Compound Component', value: 'compound' },
          { name: 'Higher-Order Component', value: 'hoc' },
          { name: 'Render Props Component', value: 'render-props' }
        ],
        default: 'functional'
      },
      {
        type: 'list',
        name: 'styling',
        message: 'Styling approach:',
        choices: [
          { name: 'Tailwind CSS + CVA', value: 'tailwind-cva' },
          { name: 'CSS Modules', value: 'css-modules' },
          { name: 'Styled Components', value: 'styled-components' },
          { name: 'Emotion', value: 'emotion' }
        ],
        default: 'tailwind-cva'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { name: 'TypeScript interfaces', value: 'typescript', checked: true },
          { name: 'Unit tests (Jest + Testing Library)', value: 'tests', checked: true },
          { name: 'Storybook stories', value: 'storybook', checked: true },
          { name: 'Accessibility features', value: 'a11y', checked: true },
          { name: 'Animation support', value: 'animation' },
          { name: 'Form integration', value: 'form' },
          { name: 'Analytics tracking', value: 'analytics' }
        ]
      },
      {
        type: 'input',
        name: 'description',
        message: 'Component description:',
        default: (answers) => `${answers.name} component`
      },
      {
        type: 'confirm',
        name: 'addToDesignSystem',
        message: 'Add to design system package?',
        default: true
      }
    ],
    actions: (data) => {
      const actions = [];
      const componentPath = data.addToDesignSystem 
        ? 'packages/ui/src/components/{{pascalCase name}}'
        : 'components/{{pascalCase name}}';

      // Main component file
      actions.push({
        type: 'add',
        path: `${componentPath}/{{pascalCase name}}.tsx`,
        templateFile: 'templates/react-component/component.hbs'
      });

      // TypeScript interfaces
      if (data.features.includes('typescript')) {
        actions.push({
          type: 'add',
          path: `${componentPath}/{{pascalCase name}}.types.ts`,
          templateFile: 'templates/react-component/types.hbs'
        });
      }

      // Styling files
      if (data.styling === 'css-modules') {
        actions.push({
          type: 'add',
          path: `${componentPath}/{{pascalCase name}}.module.css`,
          templateFile: 'templates/react-component/styles.css.hbs'
        });
      } else if (data.styling === 'styled-components') {
        actions.push({
          type: 'add',
          path: `${componentPath}/{{pascalCase name}}.styles.ts`,
          templateFile: 'templates/react-component/styled-components.hbs'
        });
      }

      // Unit tests
      if (data.features.includes('tests')) {
        actions.push({
          type: 'add',
          path: `${componentPath}/{{pascalCase name}}.test.tsx`,
          templateFile: 'templates/react-component/test.hbs'
        });
      }

      // Storybook stories
      if (data.features.includes('storybook')) {
        actions.push({
          type: 'add',
          path: `${componentPath}/{{pascalCase name}}.stories.tsx`,
          templateFile: 'templates/react-component/stories.hbs'
        });
      }

      // Index file
      actions.push({
        type: 'add',
        path: `${componentPath}/index.ts`,
        templateFile: 'templates/react-component/index.hbs'
      });

      // Update parent index file
      if (data.addToDesignSystem) {
        actions.push({
          type: 'updateIndexFile',
          path: 'packages/ui/src/components',
          name: data.name
        });
      }

      return actions;
    }
  });

  // API Endpoint Generator
  plop.setGenerator('api-endpoint', {
    description: 'Generate a new API endpoint with validation, tests, and documentation',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Endpoint name (e.g., user, secret, incident):',
        validate: (input) => {
          if (!input) return 'Endpoint name is required';
          if (!/^[a-z][a-zA-Z0-9]*$/.test(input)) {
            return 'Endpoint name must be camelCase';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'version',
        message: 'API version:',
        default: 'v1'
      },
      {
        type: 'checkbox',
        name: 'methods',
        message: 'HTTP methods to implement:',
        choices: [
          { name: 'GET (list/retrieve)', value: 'get', checked: true },
          { name: 'POST (create)', value: 'post', checked: true },
          { name: 'PUT (update)', value: 'put' },
          { name: 'PATCH (partial update)', value: 'patch' },
          { name: 'DELETE (remove)', value: 'delete' }
        ]
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Backend framework:',
        choices: [
          { name: 'Express.js', value: 'express' },
          { name: 'Fastify', value: 'fastify' },
          { name: 'NestJS', value: 'nestjs' },
          { name: 'Koa.js', value: 'koa' }
        ],
        default: 'express'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { name: 'Input validation (Zod)', value: 'validation', checked: true },
          { name: 'Authentication middleware', value: 'auth', checked: true },
          { name: 'Rate limiting', value: 'rateLimit' },
          { name: 'Caching', value: 'cache' },
          { name: 'Analytics tracking', value: 'analytics' },
          { name: 'OpenAPI documentation', value: 'openapi', checked: true },
          { name: 'Unit tests', value: 'tests', checked: true },
          { name: 'Integration tests', value: 'integration', checked: true }
        ]
      },
      {
        type: 'input',
        name: 'description',
        message: 'Endpoint description:',
        default: (answers) => `${answers.name} management endpoints`
      }
    ],
    actions: (data) => {
      const actions = [];
      const endpointPath = `services/backend/src/routes/${data.version}/${kebabCase(data.name)}`;

      // Main router file
      actions.push({
        type: 'add',
        path: `${endpointPath}/index.ts`,
        templateFile: `templates/api-endpoint/${data.framework}/router.hbs`
      });

      // Controller
      actions.push({
        type: 'add',
        path: `${endpointPath}/controller.ts`,
        templateFile: `templates/api-endpoint/${data.framework}/controller.hbs`
      });

      // Service layer
      actions.push({
        type: 'add',
        path: `${endpointPath}/service.ts`,
        templateFile: 'templates/api-endpoint/service.hbs'
      });

      // Validation schemas
      if (data.features.includes('validation')) {
        actions.push({
          type: 'add',
          path: `${endpointPath}/validation.ts`,
          templateFile: 'templates/api-endpoint/validation.hbs'
        });
      }

      // Types
      actions.push({
        type: 'add',
        path: `${endpointPath}/types.ts`,
        templateFile: 'templates/api-endpoint/types.hbs'
      });

      // Unit tests
      if (data.features.includes('tests')) {
        actions.push({
          type: 'add',
          path: `${endpointPath}/__tests__/controller.test.ts`,
          templateFile: 'templates/api-endpoint/tests/controller.test.hbs'
        });

        actions.push({
          type: 'add',
          path: `${endpointPath}/__tests__/service.test.ts`,
          templateFile: 'templates/api-endpoint/tests/service.test.hbs'
        });
      }

      // Integration tests
      if (data.features.includes('integration')) {
        actions.push({
          type: 'add',
          path: `${endpointPath}/__tests__/integration.test.ts`,
          templateFile: 'templates/api-endpoint/tests/integration.test.hbs'
        });
      }

      // OpenAPI documentation
      if (data.features.includes('openapi')) {
        actions.push({
          type: 'add',
          path: `${endpointPath}/openapi.yaml`,
          templateFile: 'templates/api-endpoint/openapi.hbs'
        });
      }

      return actions;
    }
  });

  // Package Generator
  plop.setGenerator('package', {
    description: 'Generate a new package with TypeScript, tests, and build configuration',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Package name (without @nexus/ prefix):',
        validate: (input) => {
          if (!input) return 'Package name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(input)) {
            return 'Package name must be lowercase with hyphens';
          }
          return true;
        }
      },
      {
        type: 'input',
        name: 'description',
        message: 'Package description:',
        default: (answers) => `${answers.name} package`
      },
      {
        type: 'list',
        name: 'type',
        message: 'Package type:',
        choices: [
          { name: 'Library (TypeScript)', value: 'library' },
          { name: 'React Components', value: 'react' },
          { name: 'Node.js Service', value: 'service' },
          { name: 'CLI Tool', value: 'cli' },
          { name: 'Configuration', value: 'config' }
        ],
        default: 'library'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { name: 'TypeScript', value: 'typescript', checked: true },
          { name: 'Jest testing', value: 'jest', checked: true },
          { name: 'ESLint', value: 'eslint', checked: true },
          { name: 'Prettier', value: 'prettier', checked: true },
          { name: 'Rollup bundling', value: 'rollup', checked: true },
          { name: 'Storybook (for React)', value: 'storybook' },
          { name: 'GitHub Actions', value: 'github-actions', checked: true },
          { name: 'Documentation', value: 'docs', checked: true }
        ]
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:',
        default: 'Nexus Team'
      }
    ],
    actions: (data) => {
      const actions = [];
      const packagePath = `packages/${kebabCase(data.name)}`;

      // Package.json
      actions.push({
        type: 'add',
        path: `${packagePath}/package.json`,
        templateFile: 'templates/package/package.json.hbs'
      });

      // TypeScript configuration
      if (data.features.includes('typescript')) {
        actions.push({
          type: 'add',
          path: `${packagePath}/tsconfig.json`,
          templateFile: 'templates/package/tsconfig.json.hbs'
        });
      }

      // Main source file
      actions.push({
        type: 'add',
        path: `${packagePath}/src/index.ts`,
        templateFile: `templates/package/${data.type}/index.hbs`
      });

      // Jest configuration
      if (data.features.includes('jest')) {
        actions.push({
          type: 'add',
          path: `${packagePath}/jest.config.js`,
          templateFile: 'templates/package/jest.config.js.hbs'
        });

        actions.push({
          type: 'add',
          path: `${packagePath}/src/__tests__/index.test.ts`,
          templateFile: 'templates/package/test.hbs'
        });
      }

      // ESLint configuration
      if (data.features.includes('eslint')) {
        actions.push({
          type: 'add',
          path: `${packagePath}/.eslintrc.js`,
          templateFile: 'templates/package/.eslintrc.js.hbs'
        });
      }

      // Rollup configuration
      if (data.features.includes('rollup')) {
        actions.push({
          type: 'add',
          path: `${packagePath}/rollup.config.js`,
          templateFile: 'templates/package/rollup.config.js.hbs'
        });
      }

      // README
      if (data.features.includes('docs')) {
        actions.push({
          type: 'add',
          path: `${packagePath}/README.md`,
          templateFile: 'templates/package/README.md.hbs'
        });
      }

      // GitHub Actions workflow
      if (data.features.includes('github-actions')) {
        actions.push({
          type: 'add',
          path: `.github/workflows/${kebabCase(data.name)}-ci.yml`,
          templateFile: 'templates/package/github-workflow.hbs'
        });
      }

      return actions;
    }
  });

  // Service Generator
  plop.setGenerator('service', {
    description: 'Generate a new microservice with Docker, tests, and deployment configuration',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Service name:',
        validate: (input) => {
          if (!input) return 'Service name is required';
          if (!/^[a-z][a-z0-9-]*$/.test(input)) {
            return 'Service name must be lowercase with hyphens';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'type',
        message: 'Service type:',
        choices: [
          { name: 'REST API', value: 'api' },
          { name: 'GraphQL API', value: 'graphql' },
          { name: 'Background Worker', value: 'worker' },
          { name: 'Event Processor', value: 'event-processor' },
          { name: 'Cron Job', value: 'cron' }
        ],
        default: 'api'
      },
      {
        type: 'list',
        name: 'framework',
        message: 'Framework:',
        choices: [
          { name: 'Express.js', value: 'express' },
          { name: 'Fastify', value: 'fastify' },
          { name: 'NestJS', value: 'nestjs' }
        ],
        default: 'express'
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select features to include:',
        choices: [
          { name: 'Database integration (PostgreSQL)', value: 'database', checked: true },
          { name: 'Redis caching', value: 'redis' },
          { name: 'Authentication middleware', value: 'auth', checked: true },
          { name: 'Rate limiting', value: 'rateLimit' },
          { name: 'Logging (Winston)', value: 'logging', checked: true },
          { name: 'Metrics (Prometheus)', value: 'metrics', checked: true },
          { name: 'Health checks', value: 'health', checked: true },
          { name: 'Docker configuration', value: 'docker', checked: true },
          { name: 'Kubernetes manifests', value: 'k8s', checked: true },
          { name: 'CI/CD pipeline', value: 'cicd', checked: true }
        ]
      },
      {
        type: 'input',
        name: 'port',
        message: 'Default port:',
        default: '3000'
      },
      {
        type: 'input',
        name: 'description',
        message: 'Service description:',
        default: (answers) => `${answers.name} microservice`
      }
    ],
    actions: (data) => {
      const actions = [];
      const servicePath = `services/${kebabCase(data.name)}`;

      // Package.json
      actions.push({
        type: 'add',
        path: `${servicePath}/package.json`,
        templateFile: 'templates/service/package.json.hbs'
      });

      // Main application file
      actions.push({
        type: 'add',
        path: `${servicePath}/src/app.ts`,
        templateFile: `templates/service/${data.framework}/app.hbs`
      });

      // Server entry point
      actions.push({
        type: 'add',
        path: `${servicePath}/src/server.ts`,
        templateFile: `templates/service/${data.framework}/server.hbs`
      });

      // Configuration
      actions.push({
        type: 'add',
        path: `${servicePath}/src/config/index.ts`,
        templateFile: 'templates/service/config.hbs'
      });

      // Database configuration
      if (data.features.includes('database')) {
        actions.push({
          type: 'add',
          path: `${servicePath}/src/config/database.ts`,
          templateFile: 'templates/service/database.hbs'
        });
      }

      // Health checks
      if (data.features.includes('health')) {
        actions.push({
          type: 'add',
          path: `${servicePath}/src/routes/health.ts`,
          templateFile: 'templates/service/health.hbs'
        });
      }

      // Docker configuration
      if (data.features.includes('docker')) {
        actions.push({
          type: 'add',
          path: `${servicePath}/Dockerfile`,
          templateFile: 'templates/service/Dockerfile.hbs'
        });

        actions.push({
          type: 'add',
          path: `${servicePath}/docker-compose.yml`,
          templateFile: 'templates/service/docker-compose.yml.hbs'
        });
      }

      // Kubernetes manifests
      if (data.features.includes('k8s')) {
        actions.push({
          type: 'add',
          path: `${servicePath}/k8s/deployment.yaml`,
          templateFile: 'templates/service/k8s/deployment.hbs'
        });

        actions.push({
          type: 'add',
          path: `${servicePath}/k8s/service.yaml`,
          templateFile: 'templates/service/k8s/service.hbs'
        });
      }

      // CI/CD pipeline
      if (data.features.includes('cicd')) {
        actions.push({
          type: 'add',
          path: `.github/workflows/${kebabCase(data.name)}-service.yml`,
          templateFile: 'templates/service/github-workflow.hbs'
        });
      }

      // README
      actions.push({
        type: 'add',
        path: `${servicePath}/README.md`,
        templateFile: 'templates/service/README.md.hbs'
      });

      return actions;
    }
  });

  // Database Migration Generator
  plop.setGenerator('migration', {
    description: 'Generate a new database migration',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Migration name (e.g., create_users_table, add_email_index):',
        validate: (input) => {
          if (!input) return 'Migration name is required';
          if (!/^[a-z][a-z0-9_]*$/.test(input)) {
            return 'Migration name must be snake_case';
          }
          return true;
        }
      },
      {
        type: 'list',
        name: 'type',
        message: 'Migration type:',
        choices: [
          { name: 'Create Table', value: 'create_table' },
          { name: 'Alter Table', value: 'alter_table' },
          { name: 'Add Index', value: 'add_index' },
          { name: 'Add Foreign Key', value: 'add_foreign_key' },
          { name: 'Custom SQL', value: 'custom' }
        ]
      },
      {
        type: 'input',
        name: 'tableName',
        message: 'Table name:',
        when: (answers) => ['create_table', 'alter_table', 'add_index', 'add_foreign_key'].includes(answers.type)
      }
    ],
    actions: (data) => {
      const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0];
      const migrationName = `${timestamp}_${data.name}`;
      
      return [
        {
          type: 'add',
          path: `services/backend/src/migrations/${migrationName}.ts`,
          templateFile: `templates/migration/${data.type}.hbs`
        }
      ];
    }
  });
};
