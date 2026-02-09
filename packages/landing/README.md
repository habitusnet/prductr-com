# prductr.com Landing Site

Official landing page for the prductr orchestration ecosystem.

## Overview

A clean, modern landing page that introduces visitors to the prductr ecosystem:
- **Conductor**: Multi-tenant LLM orchestration platform
- **Lisa**: Archaeological rescue & migration agent
- **Carlos**: AI-powered product roadmap generation

## Tech Stack

- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Utility-first styling
- **Vercel** - Deployment platform

## Development

```bash
# Install dependencies
npm install

# Run dev server (port 3200)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

Deployed to Vercel at **prductr.com**

### Deploy to Vercel

```bash
# Deploy to production
vercel --prod
```

### DNS Configuration

Point `prductr.com` A record to Vercel:
- **Type**: A
- **Name**: @
- **Value**: 76.76.21.21
- **Proxy**: Enabled (Cloudflare)

## Phase 1 MVP Features ✅

- [x] Hero section with clear value proposition
- [x] Three tool cards (Conductor, Lisa, Carlos)
- [x] Responsive navigation
- [x] Call-to-action section
- [x] Footer with links
- [x] Mobile-responsive design
- [x] Fast load times (<2s)
- [x] Clean, professional aesthetic

## Performance Targets

- **Lighthouse Score**: 90+
- **Bounce Rate**: <60%
- **Time on Site**: >45 seconds
- **GitHub CTR**: >20%

## Project Structure

```
prductr-landing/
├── app/
│   ├── layout.tsx      # Root layout
│   ├── page.tsx        # Home page
│   └── globals.css     # Global styles
├── components/
│   ├── Navigation.tsx  # Top navigation
│   └── ToolCard.tsx    # Tool showcase cards
├── public/             # Static assets
├── scopecraft/         # Product roadmap docs
└── docs/               # Project documentation
```

## Roadmap

See `scopecraft/ROADMAP.md` for the complete 3-phase plan.

## License

MIT
