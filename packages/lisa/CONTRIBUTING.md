# Contributing to Lisa

Thank you for your interest in contributing to Lisa! We welcome contributions from the community.

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
git clone https://github.com/YOUR_USERNAME/lisa.git
cd lisa

# Install dependencies
npm install

# Build
npm run build

# Run tests in watch mode
npm run test:watch
```

### Making Changes

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/my-new-feature
   ```

2. Make your changes and add tests
3. Ensure all tests pass: `npm run test`
4. Build to check for TypeScript errors: `npm run build`
5. Commit your changes with a clear message

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
feat: add support for monorepo git archaeology

- Extract git history across multiple packages
- Handle workspace dependencies
- Add tests for monorepo detection
```

### Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md with your changes
5. Submit a pull request with a clear description

## Code Style

- Use TypeScript with strict mode
- Follow existing code patterns
- Add JSDoc comments for public APIs
- Use meaningful variable and function names
- Keep functions focused and testable

## Testing

- Write unit tests for new functionality
- Aim for high test coverage (>80%)
- Use descriptive test names
- Test edge cases and error conditions

## Project Structure

```
src/
├── rescue/         # Full rescue pipeline
├── research/       # Git archaeology
├── discover/       # Semantic memory extraction
├── plan/           # Roadmap generation
├── structure/      # Bead/convoy creation
├── reconcile/      # Multi-project alignment
├── types.ts        # Type definitions
└── cli.ts          # CLI interface
```

## Need Help?

- Open an issue for bugs or feature requests
- Join discussions in GitHub Discussions
- Check existing issues before creating new ones

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
