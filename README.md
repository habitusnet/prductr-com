# prductr Monorepo

Private development monorepo for the prductr orchestration ecosystem.

## Structure

```
prductr-com/
├── packages/
│   ├── landing/        # prductr.com landing site
│   ├── lisa/           # Archaeological rescue & migration agent
│   ├── carlos/         # AI-powered roadmap generation
│   └── conductor/      # Multi-tenant orchestration platform
├── apps/
│   └── dashboard/      # Shared dashboard UI
└── docs/               # Ecosystem documentation
```

## Public Repositories

This monorepo is **private** for development. Individual projects are published to public repos:

- **GitHub Org**: [github.com/prductr-com](https://github.com/prductr-com)
- `prductr-com/lisa` - Lisa rescue agent (public)
- `prductr-com/carlos` - Carlos roadmap generator (public)
- `prductr-com/conductor` - Multi-tenant Conductor (public)

## Quick Start

```bash
# Install dependencies
npm install

# Run all packages in dev mode
npm run dev

# Build all packages
npm run build

# Run tests
npm run test

# Type check
npm run typecheck
```

## Package Development

```bash
# Work on specific package
cd packages/lisa
npm run dev

# Build specific package
cd packages/conductor
npm run build
```

## Deployment

- **Landing Site**: prductr.com (Vercel)
- **Dashboard**: conductor.prductr.com (Vercel)
- **Database**: Cloudflare D1

## Architecture

### Components

1. **Landing** (`packages/landing`)
   - Next.js landing page
   - Introduces the ecosystem
   - Deployed to prductr.com

2. **Lisa** (`packages/lisa`)
   - Archaeological rescue agent
   - Recovers abandoned projects
   - Git timeline reconstruction

3. **Carlos** (`packages/carlos`)
   - Product roadmap generation
   - Scopecraft automation
   - PMF validation

4. **Conductor** (`packages/conductor`)
   - Multi-tenant orchestration
   - Task queuing & file locking
   - MCP protocol integration

5. **Dashboard** (`apps/dashboard`)
   - Unified web interface
   - Real-time monitoring
   - Agent management

## Contributing

This is a private monorepo. Public contributions go through the public repos under `prductr-com` organization.

## License

MIT
