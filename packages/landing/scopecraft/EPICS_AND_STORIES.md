# Epics and Stories

## Format

Each epic includes:
- **ID**: Unique identifier (e.g., `E1.1`)
- **Title**: Brief description
- **Owner**: Responsible role/person
- **Estimate**: Time estimate in days
- **Dependencies**: Other epics that must complete first
- **Stories**: Granular tasks with acceptance criteria
- **Risk Level**: Low/Medium/High

---

## Phase 1: MVP - Functional Landing Page

### E1.1: Site Foundation

**Owner**: Frontend Developer
**Estimate**: 3 days
**Dependencies**: None
**Risk Level**: Low

#### Stories

**S1.1.1: Set up Next.js project with TypeScript and Tailwind CSS**

**Tasks**:
- Initialize Next.js 14+ project with TypeScript
- Install and configure Tailwind CSS
- Set up ESLint and Prettier for code quality
- Configure `tsconfig.json` for strict type checking
- Add base styles and CSS reset

**Acceptance Criteria**:
- `npm run dev` starts development server on port 3000
- TypeScript compilation succeeds without errors
- Tailwind CSS utility classes are functional
- Linting passes with zero warnings

---

**S1.1.2: Configure Vercel deployment pipeline**

**Tasks**:
- Create Vercel project linked to GitHub repo
- Configure build settings (`npm run build`)
- Set up environment variables (if needed)
- Enable automatic deployments on push to `main` branch
- Configure preview deployments for pull requests

**Acceptance Criteria**:
- Vercel preview URL is generated on PR creation
- Production deployment succeeds on merge to `main`
- Build logs are accessible in Vercel dashboard
- Deployment completes in under 2 minutes

---

**S1.1.3: Set up custom domain (prductr.com) with SSL**

**Tasks**:
- Purchase or configure DNS for prductr.com
- Add custom domain to Vercel project
- Configure DNS A/CNAME records
- Enable SSL certificate (automatic via Vercel)
- Test HTTPS redirect from HTTP

**Acceptance Criteria**:
- prductr.com resolves to Vercel deployment
- SSL certificate is valid and active
- HTTP requests redirect to HTTPS
- DNS propagation completes within 24 hours

---

**S1.1.4: Implement responsive layout system (mobile-first)**

**Tasks**:
- Create base layout component (`app/layout.tsx`)
- Define breakpoints in Tailwind config (mobile, tablet, desktop)
- Implement container width constraints
- Add global typography styles
- Test responsive behavior at 375px, 768px, 1024px, 1920px viewports

**Acceptance Criteria**:
- Layout adapts to mobile, tablet, and desktop breakpoints
- No horizontal scroll on any viewport size
- Typography scales appropriately across devices
- Container max-width is enforced (e.g., 1280px)

---

**S1.1.5: Add metadata for SEO (title, description, Open Graph tags)**

**Tasks**:
- Define page title: "prductr - Orchestration for Multi-Agent Development"
- Write meta description (150-160 characters)
- Add Open Graph tags (og:title, og:description, og:image)
- Add Twitter Card tags
- Generate Open Graph image (1200x630px)

**Acceptance Criteria**:
- Page title appears in browser tab
- Meta description is 150-160 characters
- Open Graph preview displays correctly in social media (Twitter, LinkedIn, Slack)
- Open Graph image is hosted and accessible

---

### E1.2: Hero Section

**Owner**: Frontend Developer + Copywriter
**Estimate**: 2 days
**Dependencies**: E1.1 (Site Foundation)
**Risk Level**: Low

#### Stories

**S1.2.1: Design hero section layout (tagline, value proposition, optional visual)**

**Tasks**:
- Create `HeroSection` component
- Implement flexbox/grid layout (centered, responsive)
- Add spacing and padding for visual balance
- Design mobile and desktop variants
- Add optional visual hook placeholder (SVG or CSS art)

**Acceptance Criteria**:
- Hero section is the first visible element on load
- Layout is centered vertically and horizontally
- Mobile layout stacks elements (text on top, visual below)
- Desktop layout places text left, visual right (or centered)

---

**S1.2.2: Write compelling tagline and value proposition**

**Tasks**:
- Draft tagline: "Orchestration for Multi-Agent Development"
- Write one-sentence value proposition (15-20 words)
- Review with stakeholders for approval
- Finalize copy for hero section

**Acceptance Criteria**:
- Tagline is clear, memorable, and under 8 words
- Value proposition is one sentence, 15-20 words
- Copy is approved by product owner
- Copy is free of jargon or buzzwords

**Example Value Proposition**:
"Coordinate autonomous agents, rescue abandoned projects, and accelerate product maturity with the prductr ecosystem."

---

**S1.2.3: Implement hero component with accessibility features**

**Tasks**:
- Add semantic HTML (`<header>`, `<h1>`, `<p>`)
- Add ARIA labels where needed
- Ensure text has sufficient color contrast (4.5:1 minimum)
- Add focus indicators for keyboard navigation
- Test with screen reader (NVDA or VoiceOver)

**Acceptance Criteria**:
- Hero section uses semantic HTML elements
- Screen reader announces content in logical order
- Color contrast meets WCAG 2.1 AA standards (4.5:1)
- Keyboard navigation works (tab order is logical)

---

**S1.2.4: Add optional visual hook (simple SVG or CSS illustration)**

**Tasks**:
- Design or source simple SVG illustration (e.g., network diagram, agent icons)
- Optimize SVG for web (SVGO or similar tool)
- Implement illustration in hero section
- Add lazy loading if illustration is large
- Ensure illustration does not block page load

**Acceptance Criteria**:
- Illustration is visible on desktop (optional on mobile)
- SVG file size is under 20KB
- Illustration does not delay First Contentful Paint
- Illustration has descriptive `aria-label` or `<title>` element

---

### E1.3: Tool Cards (3)

**Owner**: Frontend Developer + Content Steward
**Estimate**: 3 days
**Dependencies**: E1.1 (Site Foundation)
**Risk Level**: Medium (content approval may delay)

#### Stories

**S1.3.1: Design tool card component (icon, title, description, CTA button)**

**Tasks**:
- Create `ToolCard` component with props (icon, title, description, ctaLink, ctaText)
- Design card layout (icon top, title, description, CTA button)
- Add hover and focus states (subtle shadow, border color change)
- Implement card as reusable component
- Add responsive spacing (mobile vs. desktop)

**Acceptance Criteria**:
- Card component accepts props (icon, title, description, ctaLink, ctaText)
- Card has hover state (shadow or border change)
- Card is keyboard-focusable (tab order works)
- Card layout adapts to mobile and desktop

---

**S1.3.2: Write card content for Conductor**

**Tasks**:
- Write title: "Conductor"
- Write 2-sentence description: "Multi-tenant LLM orchestration platform. Coordinate autonomous agents with task queuing, file locking, and cost tracking."
- Choose icon (e.g., network/graph icon)
- Define CTA: "View on GitHub"
- Set CTA link: `https://github.com/habitusnet/conductor`

**Acceptance Criteria**:
- Description is 2 sentences, under 40 words
- Description clearly explains Conductor's purpose
- CTA link is correct and functional

---

**S1.3.3: Write card content for Lisa**

**Tasks**:
- Write title: "Lisa"
- Write 2-sentence description: "Archaeological rescue and migration agent. Recover abandoned projects, analyze drift, and generate actionable roadmaps."
- Choose icon (e.g., magnifying glass or rescue icon)
- Define CTA: "View on GitHub"
- Set CTA link: `https://github.com/habitusnet/lisa`

**Acceptance Criteria**:
- Description is 2 sentences, under 40 words
- Description clearly explains Lisa's purpose
- CTA link is correct and functional

---

**S1.3.4: Write card content for Carlos**

**Tasks**:
- Write title: "Carlos"
- Write 2-sentence description: "AI-powered product roadmap generation. Transform MVP-era projects into enterprise-ready systems with maturity-focused roadmaps."
- Choose icon (e.g., roadmap/checklist icon)
- Define CTA: "View on GitHub"
- Set CTA link: `https://github.com/habitusnet/carlos` (or conductor repo if not separate)

**Acceptance Criteria**:
- Description is 2 sentences, under 40 words
- Description clearly explains Carlos's purpose
- CTA link is correct and functional

---

**S1.3.5: Implement card grid layout (responsive: 1 column mobile, 3 columns desktop)**

**Tasks**:
- Create `ToolGrid` component to render 3 `ToolCard` instances
- Implement CSS grid (1 column mobile, 3 columns desktop)
- Add gap between cards (e.g., 1.5rem)
- Test responsive behavior at all breakpoints
- Ensure cards are equal height (use `grid-auto-rows` or flexbox)

**Acceptance Criteria**:
- Cards stack vertically on mobile (1 column)
- Cards display in 3 columns on desktop
- All cards have equal height
- Gap between cards is consistent

---

**S1.3.6: Add hover states and focus indicators for accessibility**

**Tasks**:
- Add `:hover` styles (subtle shadow or border color change)
- Add `:focus` styles (outline or ring)
- Test keyboard navigation (tab through cards, Enter key activates CTA)
- Test with screen reader (NVDA or VoiceOver)

**Acceptance Criteria**:
- Hover state is visually clear but subtle
- Focus state is prominent (visible outline or ring)
- Keyboard users can navigate to and activate cards
- Screen reader announces card content correctly

---

### E1.4: Navigation and Footer

**Owner**: Frontend Developer
**Estimate**: 2 days
**Dependencies**: E1.1 (Site Foundation)
**Risk Level**: Low

#### Stories

**S1.4.1: Implement top navigation bar with links (GitHub, Documentation, Contact)**

**Tasks**:
- Create `Navigation` component
- Add links: GitHub (link to org or main repo), Documentation (link to README or docs site), Contact (email or community channel)
- Design navigation layout (logo/title left, links right)
- Make navigation responsive (hamburger menu on mobile if needed)
- Add sticky positioning (navigation stays at top on scroll)

**Acceptance Criteria**:
- Navigation is visible at top of page
- Links are functional and open in new tabs (if external)
- Navigation is responsive (adapts to mobile)
- Navigation is keyboard-accessible

---

**S1.4.2: Design footer with links (GitHub repos, community channels, legal)**

**Tasks**:
- Create `Footer` component
- Add sections: Links (GitHub repos for Conductor, Lisa, Carlos), Community (Discord/Slack, Twitter/X), Legal (MIT license, privacy policy if needed)
- Design footer layout (centered, multi-column on desktop)
- Add copyright notice: "© 2026 prductr. Open source under MIT license."

**Acceptance Criteria**:
- Footer is visible at bottom of page
- All links are functional
- Footer is responsive (stacks on mobile)
- Copyright notice is accurate

---

**S1.4.3: Add GitHub links for all 3 repos (Conductor, Lisa, Carlos)**

**Tasks**:
- Add Conductor GitHub link: `https://github.com/habitusnet/conductor`
- Add Lisa GitHub link: `https://github.com/habitusnet/lisa` (or TBD if not separate repo)
- Add Carlos GitHub link: `https://github.com/habitusnet/carlos` (or TBD if part of Conductor)
- Verify all links are correct and functional

**Acceptance Criteria**:
- All GitHub links open in new tabs
- Links navigate to correct repos
- GitHub icon is used for visual clarity

---

**S1.4.4: Add placeholder links for documentation**

**Tasks**:
- Add Documentation link to navigation (initially links to Conductor README)
- Add placeholder for Lisa and Carlos documentation (can link to README or GitHub wiki)
- Note in code: "Replace with documentation site URL when available"

**Acceptance Criteria**:
- Documentation links are functional (even if pointing to README)
- Links are clearly labeled ("Docs" or "Documentation")
- Placeholder note is added in code for future updates

---

**S1.4.5: Add contact/community links (email, Discord, or Slack)**

**Tasks**:
- Add contact email (e.g., hello@prductr.com or maintainer email)
- Add Discord or Slack invite link (if available)
- Add Twitter/X or other social media links (if available)
- Design community section in footer

**Acceptance Criteria**:
- Contact email is a `mailto:` link
- Community links open in new tabs
- Community section is visually distinct in footer

---

### E1.5: Performance and Accessibility

**Owner**: Frontend Developer
**Estimate**: 2 days
**Dependencies**: E1.2 (Hero Section), E1.3 (Tool Cards), E1.4 (Navigation and Footer)
**Risk Level**: Medium (performance optimization may require iteration)

#### Stories

**S1.5.1: Run Lighthouse audit and optimize for 90+ score in all categories**

**Tasks**:
- Run Lighthouse audit in Chrome DevTools
- Address performance issues (largest contentful paint, cumulative layout shift)
- Address accessibility issues (missing alt text, color contrast)
- Address best practices issues (HTTPS, console errors)
- Address SEO issues (missing meta tags)

**Acceptance Criteria**:
- Lighthouse performance score: 90+
- Lighthouse accessibility score: 100
- Lighthouse best practices score: 100
- Lighthouse SEO score: 90+

---

**S1.5.2: Optimize images (use Next.js Image component, WebP format)**

**Tasks**:
- Replace `<img>` tags with Next.js `<Image>` component
- Convert images to WebP format (use Sharp or similar tool)
- Set appropriate `width` and `height` props to prevent layout shift
- Add lazy loading for below-the-fold images
- Test image loading performance

**Acceptance Criteria**:
- All images use Next.js `<Image>` component
- Images are in WebP format (with fallback)
- No cumulative layout shift caused by images
- Images load quickly (under 1 second on 3G)

---

**S1.5.3: Implement lazy loading for below-the-fold content**

**Tasks**:
- Identify below-the-fold content (tool cards, footer)
- Add `loading="lazy"` attribute to images
- Use `IntersectionObserver` for dynamic content if needed
- Test lazy loading behavior in browser

**Acceptance Criteria**:
- Below-the-fold content loads only when user scrolls
- First Contentful Paint is not delayed by below-the-fold content
- Lazy loading does not cause layout shift

---

**S1.5.4: Run accessibility audit (WAVE, axe DevTools) and fix issues**

**Tasks**:
- Run WAVE accessibility audit in browser
- Run axe DevTools audit in Chrome DevTools
- Fix all errors (missing alt text, color contrast, ARIA labels)
- Fix critical warnings (heading order, landmark roles)
- Test with screen reader (NVDA or VoiceOver)

**Acceptance Criteria**:
- Zero WAVE errors
- Zero axe DevTools errors
- Screen reader announces content in logical order
- Keyboard navigation works for all interactive elements

---

**S1.5.5: Add alt text for all images**

**Tasks**:
- Write descriptive alt text for hero section visual (if present)
- Write alt text for tool card icons
- Write alt text for any footer or navigation icons
- Ensure alt text is concise (under 150 characters) and descriptive

**Acceptance Criteria**:
- All images have alt text
- Alt text describes image content accurately
- Decorative images have empty alt text (`alt=""`)

---

**S1.5.6: Ensure color contrast ratios meet WCAG 2.1 AA standards**

**Tasks**:
- Check color contrast ratios for all text (use WebAIM Contrast Checker)
- Ensure text has at least 4.5:1 contrast ratio (normal text) or 3:1 (large text)
- Adjust colors if contrast is insufficient
- Test with browser developer tools (Lighthouse, axe)

**Acceptance Criteria**:
- All text meets WCAG 2.1 AA contrast ratios (4.5:1 for normal text, 3:1 for large text)
- Links are visually distinguishable from body text
- Focus indicators have sufficient contrast

---

## Phase 2: Enhancement - Depth and Engagement

### E2.1: Use Case Examples

**Owner**: Content Steward + Frontend Developer
**Estimate**: 4 days
**Dependencies**: E1.3 (Tool Cards)
**Risk Level**: Medium (content approval may delay)

#### Stories

**S2.1.1: Write use case example for Conductor (multi-agent coordination scenario)**

**Tasks**:
- Define scenario: "A team of 3 agents (Claude, Gemini, Codex) collaborates on a Next.js refactor"
- Write workflow steps: Task assignment, file locking, conflict resolution, cost tracking
- Write outcome: "Refactor completed in 2 hours with zero conflicts"
- Review with stakeholders for approval

**Acceptance Criteria**:
- Use case is 200-300 words
- Scenario is realistic and relatable
- Workflow steps are clear and actionable
- Outcome demonstrates value

---

**S2.1.2: Write use case example for Lisa (rescue/migration workflow)**

**Tasks**:
- Define scenario: "A 2-year-old abandoned React project needs migration to Next.js 14"
- Write workflow steps: Code analysis, dependency audit, drift detection, roadmap generation
- Write outcome: "Project rescued in 1 day with actionable 3-week roadmap"
- Review with stakeholders for approval

**Acceptance Criteria**:
- Use case is 200-300 words
- Scenario is realistic and relatable
- Workflow steps are clear and actionable
- Outcome demonstrates value

---

**S2.1.3: Write use case example for Carlos (roadmap generation workflow)**

**Tasks**:
- Define scenario: "An MVP product needs enterprise-ready roadmap (security, scalability, observability)"
- Write workflow steps: Maturity audit, risk register, sequenced epics, PMF metrics
- Write outcome: "Roadmap generated in 1 hour with 3 phases and 12 epics"
- Review with stakeholders for approval

**Acceptance Criteria**:
- Use case is 200-300 words
- Scenario is realistic and relatable
- Workflow steps are clear and actionable
- Outcome demonstrates value

---

**S2.1.4: Design use case section layout (cards or expandable sections)**

**Tasks**:
- Create `UseCaseSection` component
- Design layout: cards or expandable sections (accordion)
- Add icons or visual separators for each use case
- Implement responsive design (stacks on mobile)
- Test readability and scannability

**Acceptance Criteria**:
- Use case section is visually distinct from tool cards
- Layout is scannable (headings, bullet points, visual breaks)
- Mobile layout stacks use cases vertically
- Desktop layout displays use cases in grid or columns

---

**S2.1.5: Implement use case components with code snippets or diagrams**

**Tasks**:
- Add code snippets for key steps (e.g., `conductor task claim <id>`)
- Add syntax highlighting (use Prism or Highlight.js)
- Add copy-to-clipboard buttons for code snippets
- Add diagrams if needed (e.g., workflow diagram)
- Test component responsiveness

**Acceptance Criteria**:
- Code snippets are syntax-highlighted
- Copy-to-clipboard buttons work
- Diagrams (if present) are readable on mobile and desktop
- Use case components are accessible (keyboard-navigable)

---

### E2.2: Getting Started Guide

**Owner**: Content Steward + Frontend Developer
**Estimate**: 3 days
**Dependencies**: E1.3 (Tool Cards)
**Risk Level**: Low

#### Stories

**S2.2.1: Write quick start instructions for Conductor**

**Tasks**:
- Write prerequisites: Node.js 18+, npm, SQLite
- Write installation steps: `npm install @conductor/cli`, `conductor init`
- Write first task: `conductor task create "Build feature X"`
- Write next steps: "Learn more in the documentation"
- Keep under 300 words

**Acceptance Criteria**:
- Quick start is under 300 words
- Prerequisites are clearly listed
- Installation steps are numbered and easy to follow
- First task is actionable and simple

---

**S2.2.2: Write quick start instructions for Lisa**

**Tasks**:
- Write prerequisites: Node.js 18+, npm, Git
- Write installation steps: `npm install lisa-rescue`, `lisa rescue <repo-url>`
- Write first rescue: "Analyze abandoned React project"
- Write next steps: "View generated roadmap in `lisa-report.md`"
- Keep under 300 words

**Acceptance Criteria**:
- Quick start is under 300 words
- Prerequisites are clearly listed
- Installation steps are numbered and easy to follow
- First rescue is actionable and simple

---

**S2.2.3: Write quick start instructions for Carlos**

**Tasks**:
- Write prerequisites: Node.js 18+, npm
- Write installation steps: `npm install carlos-roadmap`, `carlos generate`
- Write first roadmap: "Generate roadmap for MVP project"
- Write next steps: "View roadmap in `scopecraft/` directory"
- Keep under 300 words

**Acceptance Criteria**:
- Quick start is under 300 words
- Prerequisites are clearly listed
- Installation steps are numbered and easy to follow
- First roadmap generation is actionable and simple

---

**S2.2.4: Design getting started section layout (tabs or accordion)**

**Tasks**:
- Create `GettingStartedSection` component
- Implement tabs (3 tabs: Conductor, Lisa, Carlos) or accordion
- Add copy-to-clipboard buttons for all code snippets
- Ensure keyboard-accessible (tab navigation works)
- Test responsive design (mobile vs. desktop)

**Acceptance Criteria**:
- Getting started section has tabs or accordion
- Active tab is visually clear
- Copy-to-clipboard buttons work for all commands
- Keyboard navigation works (arrow keys or tab)

---

**S2.2.5: Implement getting started components with copy-to-clipboard for commands**

**Tasks**:
- Add `CopyButton` component for code snippets
- Implement clipboard API (`navigator.clipboard.writeText()`)
- Add success feedback (e.g., "Copied!" tooltip)
- Test copy functionality in all major browsers
- Test accessibility (screen reader announces copy action)

**Acceptance Criteria**:
- Copy-to-clipboard buttons work in Chrome, Firefox, Safari, Edge
- Success feedback is displayed after copy
- Screen reader announces copy action
- Copy button is keyboard-accessible

---

### E2.3: Architecture Diagram

**Owner**: Technical Writer + Designer
**Estimate**: 3 days
**Dependencies**: E1.3 (Tool Cards)
**Risk Level**: Medium (diagram complexity may require iteration)

#### Stories

**S2.3.1: Design high-level architecture diagram (Conductor, Lisa, Carlos, MCP protocol)**

**Tasks**:
- Sketch diagram showing Conductor, Lisa, Carlos, and MCP protocol relationships
- Show how agents connect via MCP
- Show multi-tenancy model (organizations, projects, agents)
- Review with technical stakeholders for accuracy
- Iterate based on feedback

**Acceptance Criteria**:
- Diagram shows all 3 tools and their relationships
- Diagram shows MCP protocol as connection layer
- Diagram is technically accurate
- Diagram is simple enough for general audience

---

**S2.3.2: Create diagram in SVG format (editable, scalable)**

**Tasks**:
- Create diagram in design tool (Figma, Sketch, or Excalidraw)
- Export as SVG
- Optimize SVG for web (SVGO or similar tool)
- Ensure SVG is under 50KB
- Test SVG rendering in browsers

**Acceptance Criteria**:
- Diagram is in SVG format
- SVG file size is under 50KB
- SVG is editable (source file saved in repo)
- SVG renders correctly in all major browsers

---

**S2.3.3: Write explanation text for diagram (how tools interact, multi-tenant model)**

**Tasks**:
- Write 100-150 word explanation of diagram
- Explain how Conductor coordinates agents
- Explain how Lisa rescues projects and Carlos generates roadmaps
- Explain MCP protocol role
- Explain multi-tenancy (organizations, projects)

**Acceptance Criteria**:
- Explanation is 100-150 words
- Explanation is clear and jargon-free
- Explanation aligns with diagram content

---

**S2.3.4: Implement diagram section with zoom/pan functionality (optional)**

**Tasks**:
- Add diagram to landing page (in dedicated section)
- Add zoom/pan functionality if diagram is complex (use SVG pan-zoom library)
- Add descriptive text alternative for screen readers
- Test accessibility (keyboard navigation, screen reader)

**Acceptance Criteria**:
- Diagram is visible and readable on mobile and desktop
- Zoom/pan functionality works (if implemented)
- Diagram has descriptive text alternative (`aria-label` or `<title>`)
- Diagram section is accessible

---

### E2.4: Analytics Integration

**Owner**: Frontend Developer
**Estimate**: 1 day
**Dependencies**: E1.1 (Site Foundation)
**Risk Level**: Low

#### Stories

**S2.4.1: Set up Plausible Analytics account**

**Tasks**:
- Create Plausible account at plausible.io
- Add prductr.com site to Plausible dashboard
- Copy Plausible script snippet
- Note: Plausible is privacy-first (no cookies, GDPR-compliant)

**Acceptance Criteria**:
- Plausible account is active
- prductr.com site is added to dashboard
- Script snippet is available

---

**S2.4.2: Add Plausible script to Next.js app**

**Tasks**:
- Add Plausible script to `app/layout.tsx` in `<head>`
- Verify script loads on page load (check browser DevTools)
- Test page views are tracked in Plausible dashboard
- Ensure no console errors

**Acceptance Criteria**:
- Plausible script loads on page load
- Page views are tracked in Plausible dashboard
- No console errors or warnings

---

**S2.4.3: Configure custom events (CTA clicks, use case views, getting started views)**

**Tasks**:
- Add custom event for tool card CTA clicks: `plausible('Tool Card CTA', {props: {tool: 'Conductor'}})`
- Add custom event for use case views: `plausible('Use Case View', {props: {tool: 'Lisa'}})`
- Add custom event for getting started views: `plausible('Getting Started View', {props: {tool: 'Carlos'}})`
- Test custom events fire in Plausible dashboard

**Acceptance Criteria**:
- Custom events fire when user interacts with tool cards, use cases, or getting started sections
- Events are visible in Plausible dashboard
- Event properties (tool name) are captured correctly

---

**S2.4.4: Create analytics dashboard to track success metrics**

**Tasks**:
- Create dashboard view in Plausible showing:
  - Page views
  - Unique visitors
  - Bounce rate
  - Time on site
  - Top pages
  - Custom events (CTA clicks, use case views)
- Share dashboard access with product owner and content steward

**Acceptance Criteria**:
- Dashboard shows all key metrics
- Dashboard is accessible to product owner and content steward
- Dashboard updates in real-time (or near real-time)

---

## Phase 3: Growth - Community and Adoption

### E3.1: Interactive Demos

**Owner**: Full-Stack Developer + DevOps
**Estimate**: 10 days
**Dependencies**: E2.1 (Use Case Examples)
**Risk Level**: High (security, performance, abuse prevention)

#### Stories

**S3.1.1: Design embedded playground for Conductor (live task orchestration demo)**

**Tasks**:
- Design playground UI (code editor, output panel, controls)
- Define example scenarios (e.g., "Orchestrate 3 agents to refactor code")
- Sketch playground layout (responsive: mobile and desktop)
- Review with stakeholders for approval

**Acceptance Criteria**:
- Playground design is clear and intuitive
- Example scenarios are realistic and valuable
- Layout is responsive (adapts to mobile and desktop)

---

**S3.1.2: Implement sandbox environment (E2B or Docker-based)**

**Tasks**:
- Choose sandbox provider (E2B or self-hosted Docker)
- Set up sandbox infrastructure (API keys, rate limiting)
- Implement sandbox creation and teardown
- Test sandbox security (isolate user code, prevent abuse)
- Document sandbox architecture

**Acceptance Criteria**:
- Sandbox creates isolated environments for user code
- Sandbox resets after 5 minutes of inactivity or on user request
- Sandbox prevents abuse (no network access, no file system writes outside sandbox)
- Sandbox API is functional and responsive

---

**S3.1.3: Create example orchestration flows (3-5 scenarios)**

**Tasks**:
- Write example 1: "Orchestrate 2 agents to build a React component"
- Write example 2: "Orchestrate 3 agents to refactor a Next.js app"
- Write example 3: "Orchestrate agents with file locking and conflict resolution"
- Write 2 more examples (optional)
- Test examples in sandbox

**Acceptance Criteria**:
- Each example is under 100 lines of code
- Examples are realistic and demonstrate orchestration value
- Examples run successfully in sandbox

---

**S3.1.4: Add "Try It" buttons to tool cards linking to demos**

**Tasks**:
- Add "Try It" button to Conductor tool card
- Link button to playground (e.g., `/playground?demo=conductor`)
- Add "Try It" buttons for Lisa and Carlos (if playgrounds available)
- Test button functionality

**Acceptance Criteria**:
- "Try It" buttons are visible on tool cards
- Buttons link to playground with correct demo pre-loaded
- Buttons are accessible (keyboard-navigable)

---

**S3.1.5: Implement rate limiting and abuse prevention for sandbox**

**Tasks**:
- Implement rate limiting: max 10 runs per IP per hour
- Implement abuse detection (e.g., excessive CPU, long-running processes)
- Add error messages for rate limit exceeded or abuse detected
- Log abuse attempts for monitoring
- Test rate limiting and abuse detection

**Acceptance Criteria**:
- Rate limiting prevents excessive sandbox usage
- Abuse detection blocks malicious code
- Error messages are clear and helpful
- Logs are accessible for monitoring

---

### E3.2: Blog and Content Hub

**Owner**: Content Steward + Frontend Developer
**Estimate**: 8 days
**Dependencies**: E1.1 (Site Foundation)
**Risk Level**: Medium (content pipeline sustainability)

#### Stories

**S3.2.1: Set up blog CMS (Contentful, Sanity, or markdown-based)**

**Tasks**:
- Choose CMS (Contentful for hosted, markdown for simple)
- Set up CMS account and project
- Define content model (title, date, author, body, tags)
- Integrate CMS with Next.js (fetch posts at build time or runtime)
- Test CMS integration

**Acceptance Criteria**:
- CMS is functional and accessible
- Content model is defined and tested
- Next.js fetches posts from CMS successfully
- CMS allows content steward to publish posts without developer assistance

---

**S3.2.2: Design blog layout (list view, post view)**

**Tasks**:
- Create blog list page (`/blog`)
- Design post list layout (title, date, excerpt, tags)
- Create blog post page (`/blog/[slug]`)
- Design post layout (title, date, author, body, tags)
- Add pagination for blog list (if needed)

**Acceptance Criteria**:
- Blog list page displays all posts
- Blog post page displays full post content
- Layout is responsive (mobile and desktop)
- Pagination works (if implemented)

---

**S3.2.3: Write first 3 blog posts (release notes, technical article, case study)**

**Tasks**:
- Write post 1: "Announcing prductr.com and the orchestration ecosystem"
- Write post 2: "How MCP protocol enables multi-agent coordination"
- Write post 3: "Case study: Rescuing an abandoned React project with Lisa"
- Review with stakeholders for approval
- Publish posts to CMS

**Acceptance Criteria**:
- Each post is 500-1000 words
- Posts are well-formatted (headings, code snippets, images)
- Posts are approved and published to CMS

---

**S3.2.4: Implement RSS feed for blog**

**Tasks**:
- Generate RSS feed XML from blog posts
- Add RSS feed endpoint (`/blog/rss.xml`)
- Test RSS feed in feed readers (Feedly, Inoreader)
- Add RSS feed link to blog page and footer

**Acceptance Criteria**:
- RSS feed is valid XML
- RSS feed includes all published posts
- RSS feed is discoverable (linked from blog page and footer)
- RSS feed works in feed readers

---

**S3.2.5: Add blog link to navigation**

**Tasks**:
- Add "Blog" link to top navigation
- Link to `/blog`
- Test navigation link functionality
- Ensure navigation is accessible

**Acceptance Criteria**:
- "Blog" link is visible in navigation
- Link navigates to `/blog`
- Link is keyboard-accessible

---

### E3.3: Community Features

**Owner**: Community Manager + Frontend Developer
**Estimate**: 5 days
**Dependencies**: E1.4 (Navigation and Footer)
**Risk Level**: Medium (moderation and sustainability)

#### Stories

**S3.3.1: Set up Discord or Slack community channel**

**Tasks**:
- Create Discord server or Slack workspace
- Set up channels (general, support, contributors, announcements)
- Create community guidelines and code of conduct
- Appoint moderators
- Generate invite link

**Acceptance Criteria**:
- Discord server or Slack workspace is active
- Channels are set up and named clearly
- Community guidelines are posted
- Moderators are appointed

---

**S3.3.2: Add community invite widget to landing page**

**Tasks**:
- Create `CommunityInvite` component
- Add invite link and description
- Design widget layout (prominent but not intrusive)
- Add to landing page (above or below tool cards)
- Test invite link functionality

**Acceptance Criteria**:
- Community invite widget is visible on landing page
- Invite link is functional (opens Discord or Slack)
- Widget is accessible (keyboard-navigable)

---

**S3.3.3: Create contributor showcase section (highlight top contributors)**

**Tasks**:
- Design contributor showcase layout (avatars, names, links to profiles)
- Fetch contributor data from GitHub API (top contributors by commits)
- Implement contributor showcase component
- Add to landing page (footer or dedicated section)
- Test component responsiveness

**Acceptance Criteria**:
- Contributor showcase displays top 5-10 contributors
- Avatars, names, and links are accurate
- Component is responsive (mobile and desktop)
- Component is accessible

---

**S3.3.4: Design event calendar for meetups or office hours**

**Tasks**:
- Set up event calendar (Google Calendar or similar)
- Embed calendar on landing page
- Add upcoming events (meetups, office hours, webinars)
- Test calendar embedding and responsiveness

**Acceptance Criteria**:
- Event calendar is embedded on landing page
- Upcoming events are visible
- Calendar is responsive (mobile and desktop)
- Calendar is accessible

---

**S3.3.5: Add community guidelines and code of conduct**

**Tasks**:
- Write community guidelines (respectful communication, no spam, etc.)
- Write code of conduct (based on Contributor Covenant or similar)
- Add guidelines to Discord/Slack and landing page
- Link to guidelines from footer

**Acceptance Criteria**:
- Community guidelines are clear and concise
- Code of conduct is comprehensive
- Guidelines are linked from footer and Discord/Slack

---

### E3.4: SEO and Growth Optimization

**Owner**: Growth Marketer + Frontend Developer
**Estimate**: 4 days
**Dependencies**: E1.1 (Site Foundation)
**Risk Level**: Medium (SEO results may take time)

#### Stories

**S3.4.1: Conduct keyword research for orchestration, multi-agent systems, MCP protocol**

**Tasks**:
- Use keyword research tools (Ahrefs, SEMrush, Google Keyword Planner)
- Identify target keywords (e.g., "multi-agent orchestration", "MCP protocol", "AI agent coordination")
- Analyze search volume and competition
- Create keyword list for content optimization

**Acceptance Criteria**:
- Keyword list includes 10-20 target keywords
- Keywords have measurable search volume
- Keywords are relevant to prductr ecosystem

---

**S3.4.2: Optimize page titles, meta descriptions, and headings for SEO**

**Tasks**:
- Update page title to include target keywords
- Update meta description to include target keywords (under 160 characters)
- Update headings (`<h1>`, `<h2>`) to include target keywords
- Test SEO optimization with tools (Yoast, Moz)

**Acceptance Criteria**:
- Page title includes primary keyword
- Meta description includes primary keyword and is under 160 characters
- Headings are optimized for SEO (keyword-rich, clear)
- SEO score improves (measure with Yoast or Moz)

---

**S3.4.3: Submit sitemap to Google Search Console**

**Tasks**:
- Generate sitemap XML (`/sitemap.xml`)
- Verify site ownership in Google Search Console
- Submit sitemap to Google Search Console
- Monitor indexing status

**Acceptance Criteria**:
- Sitemap is generated and accessible at `/sitemap.xml`
- Site ownership is verified in Google Search Console
- Sitemap is submitted and indexed by Google
- Indexing status is monitored weekly

---

**S3.4.4: Set up A/B testing framework for hero section and CTA buttons**

**Tasks**:
- Choose A/B testing tool (Google Optimize, Vercel Edge Config, or custom)
- Define A/B test variants (e.g., hero tagline, CTA button text)
- Implement A/B testing logic in Next.js
- Track conversion rates for each variant
- Test A/B testing framework functionality

**Acceptance Criteria**:
- A/B testing framework is functional
- Variants are served to users randomly
- Conversion rates are tracked for each variant
- A/B testing dashboard is accessible to product owner

---

**S3.4.5: Create social media promotion plan**

**Tasks**:
- Define social media channels (Twitter/X, LinkedIn, Reddit, Hacker News)
- Create promotion calendar (e.g., 1 post per week)
- Write social media posts for launch, blog posts, and updates
- Schedule posts using social media management tool (Buffer, Hootsuite)
- Track social media traffic in Plausible Analytics

**Acceptance Criteria**:
- Social media promotion plan is documented
- Posts are scheduled for launch and updates
- Social media traffic is tracked in Plausible
- Social media posts drive measurable traffic (10%+ of total visits)

---

## Risk Register

See `RISKS_AND_DEPENDENCIES.md` for full risk analysis and mitigation strategies.

---

## Open Questions

See `OPEN_QUESTIONS.md` for prioritization decisions that block epic execution.
