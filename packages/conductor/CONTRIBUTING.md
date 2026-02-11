# Contributing to Conductor

Thank you for your interest in contributing to Conductor! We welcome contributions from the community.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Install dependencies**: `npm install`
4. **Build the project**: `npm run build`
5. **Run tests**: `npm run test`

## Development Workflow

### Setting Up Your Environment

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/conductor.git
cd conductor

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm run test
```

### Making Changes

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. Make your changes in the relevant package(s)
3. Add tests for new functionality
4. Ensure all tests pass: `npm run test`
5. Build to check for TypeScript errors: `npm run build`
6. Commit your changes with a clear message

### Commit Message Guidelines

We follow conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions or changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

Example:
```
feat(mcp-server): add task dependency validation

- Validate task dependencies exist before creation
- Detect circular dependencies
- Add error messages for invalid dependencies
```

### Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass across all packages
4. Update CHANGELOG.md with your changes
5. Submit a pull request with a clear description

## Code Style

- Use TypeScript with strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Use Zod for schema validation
- Keep functions focused and testable

## Testing

- Write unit tests for new functionality
- Aim for high test coverage (>80%)
- Use Vitest for testing
- Test edge cases and error conditions
- Mock external dependencies appropriately

## Package Structure

Conductor is a monorepo with multiple packages:

```
packages/
├── core/           # Schemas, types, agent profiles
├── state/          # SQLite state store
├── db/             # Drizzle ORM (SQLite/PostgreSQL)
├── mcp-server/     # MCP protocol server
├── cli/            # Command-line interface
├── e2b-runner/     # E2B sandbox integration
├── connectors/     # External service integrations
├── observer/       # Autonomous monitoring
└── secrets/        # Secrets management
```

When contributing:
- Changes to schemas/types go in `@conductor/core`
- MCP tool additions go in `@conductor/mcp-server`
- CLI commands go in `@conductor/cli`
- Database changes go in `@conductor/db`

## Running Specific Package Tests

```bash
# Test a specific package
cd packages/core && npm run test

# Watch mode for development
cd packages/core && npm run test:watch
```

## Need Help?

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones
- Review the architecture documentation in README.md

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
