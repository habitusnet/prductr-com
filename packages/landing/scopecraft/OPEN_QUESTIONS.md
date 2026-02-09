# Open Questions

## Overview

This document captures unresolved decisions, ambiguities, and open questions that could impact the prductr.com landing site roadmap. Each question includes context, potential options, impact analysis, and a recommendation.

---

## Critical Questions (Must Resolve Before MVP)

### Q1: Visual Design Approach - Simple or Custom?

**Context**:
The hero section and tool cards require visual design. We can choose between:
- **Option A**: Simple text-based design with free icons (Heroicons, Feather Icons)
- **Option B**: Custom illustrations, animations, or diagrams

**Impact**:
- **Option A**: Faster to MVP (2 days), lower cost, but may lack visual differentiation
- **Option B**: Longer to MVP (5-7 days), higher cost (designer required), but stronger branding

**Recommendation**: **Option A** for MVP. Start simple to ship quickly; enhance visuals in Phase 2 (Enhancement) based on user feedback and traffic.

**Decision Maker**: Product Owner + Designer
**Deadline**: 2 days before MVP dev work begins
**Status**: Open

---

### Q2: Analytics Platform - Plausible, Google Analytics, or PostHog?

**Context**:
We need an analytics platform to track page views, time on site, CTR, and custom events. Options:
- **Plausible**: Privacy-first, no cookies, lightweight ($9/month)
- **Google Analytics 4**: Free, feature-rich, but privacy concerns (GDPR, cookies)
- **PostHog**: Open-source, self-hosted or cloud ($0-$450/month), includes A/B testing

**Impact**:
- **Plausible**: Best for privacy compliance, simple setup, but limited features (no funnels, no heatmaps)
- **Google Analytics 4**: Most comprehensive, free, but requires cookie consent banner and GDPR compliance
- **PostHog**: Most flexible, includes A/B testing, but more complex to set up and manage

**Recommendation**: **Plausible** for MVP and Enhancement phases. Plausible is privacy-first, GDPR-compliant, and sufficient for basic metrics. Consider PostHog for Growth phase if A/B testing or advanced features are needed.

**Decision Maker**: Product Owner + Frontend Developer
**Deadline**: Before Phase 2 (Enhancement) begins
**Status**: Open

---

### Q3: Content Approval Process - Who Has Final Sign-Off?

**Context**:
Copy for hero section, tool cards, and navigation requires approval. Without a clear approval process, feedback may be conflicting or slow.

**Options**:
- **Option A**: Product owner has final sign-off (single decision-maker)
- **Option B**: Approval committee (product owner + technical lead + marketing)
- **Option C**: Asynchronous approval (stakeholders review in Google Docs; silence = approval after 24 hours)

**Impact**:
- **Option A**: Fast approvals, clear accountability, but may lack diverse perspectives
- **Option B**: More thorough review, but slower and risk of conflicting feedback
- **Option C**: Balances speed and input, but risk of missed reviews

**Recommendation**: **Option C** - Asynchronous approval with 24-hour SLA. Share copy drafts in Google Docs; stakeholders review and comment within 24 hours. Product owner has final sign-off if conflicts arise.

**Decision Maker**: Product Owner
**Deadline**: Before copy writing begins
**Status**: Open

---

### Q4: Documentation Links - Where Should They Point?

**Context**:
Navigation includes a "Documentation" link. Options:
- **Option A**: Link to Conductor GitHub README (simplest, available now)
- **Option B**: Link to dedicated documentation site (e.g., docs.prductr.com)
- **Option C**: Link to placeholder page ("Documentation coming soon") with email signup

**Impact**:
- **Option A**: Quick to implement, but README may be incomplete or not user-friendly
- **Option B**: Best user experience, but requires building documentation site (out of scope for MVP)
- **Option C**: Avoids broken expectations, but may frustrate users seeking immediate information

**Recommendation**: **Option A** for MVP - Link to Conductor GitHub README. Add note: "Comprehensive documentation site coming soon." Update links when documentation site is ready (Phase 2 or 3).

**Decision Maker**: Product Owner + Technical Writer
**Deadline**: Before navigation is implemented
**Status**: Open

---

### Q5: Multi-Tool vs. Single-Tool Focus - Should All 3 Tools Have Equal Weight?

**Context**:
The landing page showcases Conductor, Lisa, and Carlos equally. However, Conductor is the most mature project. Options:
- **Option A**: Equal weight (3 tool cards, no hierarchy)
- **Option B**: Conductor-first (Conductor is primary CTA; Lisa and Carlos are secondary)
- **Option C**: Progressive disclosure (Conductor is default; Lisa and Carlos are expandable sections)

**Impact**:
- **Option A**: Fair representation, but may dilute focus if visitors are unsure where to start
- **Option B**: Clear hierarchy, easier decision-making, but may under-represent Lisa and Carlos
- **Option C**: Balances focus and completeness, but adds UI complexity

**Recommendation**: **Option A** for MVP - Equal weight. All 3 tools are valuable; visitors can choose based on their needs. If analytics show confusion (high bounce rate, low CTR), revisit in Phase 2.

**Decision Maker**: Product Owner
**Deadline**: Before MVP dev work begins
**Status**: Open

---

## High-Priority Questions (Resolve Before Phase 2)

### Q6: Use Case Examples - How Technical Should They Be?

**Context**:
Use case examples (Phase 2) need to balance technical accuracy with accessibility for general audience. Options:
- **Option A**: Simplified scenarios with minimal jargon (e.g., "Build a React app with 3 agents")
- **Option B**: Realistic scenarios with technical details (e.g., "Orchestrate agents with file locking, DAG-based task dependencies")
- **Option C**: Tiered scenarios (simple + advanced)

**Impact**:
- **Option A**: Accessible to broader audience, but may lack credibility with technical evaluators
- **Option B**: Credible with technical audience, but may alienate non-technical readers
- **Option C**: Best of both worlds, but doubles content creation effort

**Recommendation**: **Option A** for MVP use cases - Simplified scenarios. Add advanced scenarios in Phase 3 (Growth) if analytics show demand from technical audience.

**Decision Maker**: Content Steward + Product Owner
**Deadline**: Before use case content is written (Phase 2)
**Status**: Open

---

### Q7: Architecture Diagram - How Detailed Should It Be?

**Context**:
Architecture diagram (Phase 2) can range from high-level overview to detailed technical diagram. Options:
- **Option A**: High-level (3 tools + MCP protocol + agents; 5-10 elements)
- **Option B**: Detailed technical (organizations, projects, agents, tasks, file locks, event bus; 20+ elements)
- **Option C**: Interactive diagram (users can zoom, pan, click for details)

**Impact**:
- **Option A**: Easy to understand, fast to create, but may lack depth for technical evaluators
- **Option B**: Comprehensive, but may overwhelm general audience and take longer to create
- **Option C**: Best user experience, but requires development effort (JavaScript library for zoom/pan)

**Recommendation**: **Option A** for Phase 2 - High-level diagram. If analytics show high diagram engagement (40%+ views), invest in interactive diagram in Phase 3.

**Decision Maker**: Technical Writer + Designer
**Deadline**: Before diagram design begins (Phase 2)
**Status**: Open

---

### Q8: GitHub Repo Consolidation - Should Lisa and Carlos Be Separate Repos?

**Context**:
Lisa and Carlos may be part of the Conductor monorepo or separate standalone repos. This affects landing page navigation. Options:
- **Option A**: Separate repos (lisa, carlos, conductor)
- **Option B**: Consolidated repo (conductor with lisa and carlos as packages)
- **Option C**: Hybrid (conductor main repo; lisa and carlos are linked submodules)

**Impact**:
- **Option A**: Clear separation, easier to navigate, but may fragment ecosystem
- **Option B**: Unified ecosystem, easier to manage, but may confuse users seeking standalone tools
- **Option C**: Balances separation and unity, but adds technical complexity

**Recommendation**: Defer to engineering team decision. Landing page can adapt to either structure:
- If separate repos: Link tool cards to individual repos
- If consolidated repo: Link tool cards to Conductor repo with anchors (e.g., `#lisa`, `#carlos`)

**Decision Maker**: Engineering Lead (Conductor maintainer)
**Deadline**: Before tool card CTAs are implemented
**Status**: Open (external dependency)

---

## Medium-Priority Questions (Resolve Before Phase 3)

### Q9: Interactive Playground - Which Tool Should Be Demonstrated?

**Context**:
Interactive playground (Phase 3) can demonstrate Conductor, Lisa, or Carlos. We can only build one playground initially. Options:
- **Option A**: Conductor playground (orchestration demo)
- **Option B**: Lisa playground (rescue demo)
- **Option C**: Carlos playground (roadmap generation demo)

**Impact**:
- **Option A**: Conductor is most mature and feature-rich; best demonstration of ecosystem
- **Option B**: Lisa is unique (rescue); may attract attention but harder to demo (requires abandoned project)
- **Option C**: Carlos is roadmap-focused; demo may be less interactive (output-heavy)

**Recommendation**: **Option A** - Conductor playground. Conductor is the core orchestration platform and easiest to demonstrate interactively (task assignment, agent coordination). Consider Lisa or Carlos playgrounds in later iterations if demand is high.

**Decision Maker**: Product Owner + Full-Stack Developer
**Deadline**: Before playground dev work begins (Phase 3)
**Status**: Open

---

### Q10: Blog CMS - Hosted or Markdown-Based?

**Context**:
Blog (Phase 3) can use hosted CMS (Contentful, Sanity) or markdown-based approach (MDX, GitHub as CMS). Options:
- **Option A**: Hosted CMS (Contentful, Sanity) - $0-$99/month
- **Option B**: Markdown-based (MDX files in repo, GitHub as CMS) - Free
- **Option C**: Hybrid (markdown in repo + Netlify CMS for editing) - Free

**Impact**:
- **Option A**: Non-technical content steward can publish without developer help; costs $0-$99/month
- **Option B**: Free, simple, but requires git knowledge to publish (content steward must commit markdown files)
- **Option C**: Free, user-friendly editor, but adds complexity (Netlify CMS setup)

**Recommendation**: **Option B** for MVP blog - Markdown-based (MDX files in repo). Content steward can commit markdown via GitHub UI (no git CLI required). Upgrade to hosted CMS (Option A) if content pipeline grows and non-technical contributors are added.

**Decision Maker**: Content Steward + Frontend Developer
**Deadline**: Before blog implementation begins (Phase 3)
**Status**: Open

---

### Q11: Community Platform - Discord or Slack?

**Context**:
Community channel (Phase 3) can be Discord or Slack. Options:
- **Option A**: Discord (free, popular with open-source communities, rich features)
- **Option B**: Slack (free for up to 10,000 messages, familiar to enterprise users)
- **Option C**: Both (Discord for open-source community, Slack for enterprise users)

**Impact**:
- **Option A**: Discord is free, feature-rich, and popular with developers; best for open-source community
- **Option B**: Slack is familiar to enterprise users but limited (10,000 message history on free plan)
- **Option C**: Best coverage, but splits community and doubles moderation effort

**Recommendation**: **Option A** - Discord. Discord is free, popular with open-source communities, and has no message history limits. If enterprise users request Slack, consider adding Slack workspace in future (Option C).

**Decision Maker**: Community Manager + Product Owner
**Deadline**: Before community channel setup (Phase 3)
**Status**: Open

---

### Q12: Multi-Language Support - When Should We Add Internationalization (i18n)?

**Context**:
Landing page is currently English-only. Adding i18n (Spanish, French, Chinese, etc.) increases scope. Options:
- **Option A**: Defer i18n to future (not in MVP, Enhancement, or Growth phases)
- **Option B**: Add i18n in Growth phase (Phase 3) if 10%+ traffic is non-English
- **Option C**: Add i18n in MVP (support 2-3 languages from launch)

**Impact**:
- **Option A**: Simplest; focus on English-speaking audience; revisit based on traffic analytics
- **Option B**: Data-driven decision; add i18n only if demand is proven
- **Option C**: Broadest reach, but significantly increases scope (translation, testing, maintenance)

**Recommendation**: **Option A** for MVP and Enhancement - English-only. Monitor traffic analytics in Phase 2/3; if 10%+ traffic is non-English, prioritize i18n in future roadmap (Option B).

**Decision Maker**: Product Owner + Growth Marketer
**Deadline**: Before MVP scope is finalized
**Status**: Open

---

## Low-Priority Questions (Nice to Resolve, Not Blocking)

### Q13: Open Graph Image - Custom or Generated?

**Context**:
Open Graph image (1200x630px) for social media previews can be custom-designed or generated programmatically. Options:
- **Option A**: Custom-designed image (static, high-quality, requires designer)
- **Option B**: Generated image (dynamic, uses Next.js OG image generation, no designer needed)
- **Option C**: No custom image (use default Next.js favicon)

**Impact**:
- **Option A**: Best visual quality, but requires designer time and is static (cannot personalize per page)
- **Option B**: Dynamic, easy to update, but may lack polish
- **Option C**: Simplest, but poor social media previews (hurts click-through rate)

**Recommendation**: **Option A** for MVP - Custom-designed static image. Use simple design (prductr logo + tagline) to minimize designer effort. Consider Option B (generated images) in Phase 3 if blog posts need personalized previews.

**Decision Maker**: Designer + Frontend Developer
**Deadline**: Before metadata is implemented
**Status**: Open

---

### Q14: Legal Pages - Do We Need Privacy Policy or Terms of Service?

**Context**:
Landing page may require legal pages (privacy policy, terms of service) depending on data collection and jurisdiction. Options:
- **Option A**: No legal pages (minimal data collection; Plausible is privacy-first)
- **Option B**: Privacy policy only (explain analytics data collection)
- **Option C**: Privacy policy + terms of service (comprehensive legal coverage)

**Impact**:
- **Option A**: Simplest, but may not comply with GDPR or CCPA if users request data transparency
- **Option B**: Covers analytics data collection; sufficient for GDPR compliance
- **Option C**: Most comprehensive, but may be overkill for static landing page (no user accounts, no transactions)

**Recommendation**: **Option B** for MVP - Privacy policy only. Explain Plausible Analytics data collection (anonymous, no cookies) and link to Plausible's privacy policy. Add terms of service in Phase 3 if interactive playground or user accounts are added.

**Decision Maker**: Product Owner + Legal Advisor (if available)
**Deadline**: Before MVP launch
**Status**: Open

---

### Q15: Contact Method - Email, Form, or Community Channel?

**Context**:
Landing page needs a contact method for inquiries. Options:
- **Option A**: Email link (mailto:hello@prductr.com)
- **Option B**: Contact form (hosted on landing page)
- **Option C**: Community channel link (Discord, Slack)

**Impact**:
- **Option A**: Simplest, no spam protection, may receive low-quality inquiries
- **Option B**: Professional, can add spam protection (CAPTCHA), but requires form implementation
- **Option C**: Encourages community engagement, but may not be suitable for private inquiries

**Recommendation**: **Option A + Option C** - Email link (mailto:hello@prductr.com) in footer + Discord invite widget for community inquiries. Defer contact form (Option B) to Phase 3 if email volume becomes unmanageable.

**Decision Maker**: Product Owner
**Deadline**: Before footer is implemented
**Status**: Open

---

### Q16: Favicon and App Icons - Custom or Default?

**Context**:
Favicon (browser tab icon) and app icons (mobile home screen) can be custom-designed or use default Next.js icons. Options:
- **Option A**: Custom-designed icons (requires designer)
- **Option B**: Default Next.js icons (simplest)
- **Option C**: Generated from logo (use Figma or online tool)

**Impact**:
- **Option A**: Best branding, but requires designer time
- **Option B**: Simplest, but generic and unprofessional
- **Option C**: Good balance (branded, minimal effort)

**Recommendation**: **Option C** for MVP - Generate favicon and app icons from prductr logo using online tool (Favicon Generator, RealFaviconGenerator). Defer custom icons to Phase 2 if branding refresh is needed.

**Decision Maker**: Designer + Frontend Developer
**Deadline**: Before metadata is implemented
**Status**: Open

---

## Decision Log

As questions are resolved, document decisions here for reference.

| Question | Decision | Date | Decision Maker | Rationale |
|----------|----------|------|----------------|-----------|
| Q1: Visual Design Approach | [TBD] | [TBD] | Product Owner + Designer | [TBD] |
| Q2: Analytics Platform | [TBD] | [TBD] | Product Owner + Frontend Developer | [TBD] |
| Q3: Content Approval Process | [TBD] | [TBD] | Product Owner | [TBD] |
| Q4: Documentation Links | [TBD] | [TBD] | Product Owner + Technical Writer | [TBD] |
| Q5: Multi-Tool Focus | [TBD] | [TBD] | Product Owner | [TBD] |
| Q6: Use Case Technicality | [TBD] | [TBD] | Content Steward + Product Owner | [TBD] |
| Q7: Architecture Diagram Detail | [TBD] | [TBD] | Technical Writer + Designer | [TBD] |
| Q8: GitHub Repo Consolidation | [TBD] | [TBD] | Engineering Lead | [TBD] |
| Q9: Playground Focus | [TBD] | [TBD] | Product Owner + Full-Stack Developer | [TBD] |
| Q10: Blog CMS | [TBD] | [TBD] | Content Steward + Frontend Developer | [TBD] |
| Q11: Community Platform | [TBD] | [TBD] | Community Manager + Product Owner | [TBD] |
| Q12: Multi-Language Support | [TBD] | [TBD] | Product Owner + Growth Marketer | [TBD] |
| Q13: Open Graph Image | [TBD] | [TBD] | Designer + Frontend Developer | [TBD] |
| Q14: Legal Pages | [TBD] | [TBD] | Product Owner + Legal Advisor | [TBD] |
| Q15: Contact Method | [TBD] | [TBD] | Product Owner | [TBD] |
| Q16: Favicon and App Icons | [TBD] | [TBD] | Designer + Frontend Developer | [TBD] |

---

## Process for Resolving Open Questions

### Step 1: Identify Decision Maker

Each question has a designated decision maker (product owner, engineering lead, content steward, etc.). Decision maker is responsible for gathering input and making final call.

### Step 2: Set Deadline

Assign deadline based on when decision is needed (before MVP, before Phase 2, before Phase 3). Critical questions (Q1-Q5) must be resolved before MVP dev work begins.

### Step 3: Gather Input

Decision maker solicits input from relevant stakeholders (team members, advisors, users). Use asynchronous methods (Google Docs comments, Slack polls) to avoid meeting overhead.

### Step 4: Make Decision

Decision maker evaluates options, considers impact, and makes final decision. Document decision in Decision Log with rationale.

### Step 5: Communicate Decision

Share decision with team and stakeholders via Slack, email, or project management tool. Update relevant roadmap or epic documents.

### Step 6: Execute

Implement decision in code, content, or design. Validate decision was correct based on metrics or user feedback.

---

## Escalation Process

If decision maker cannot resolve question or if stakeholders disagree:

1. **Escalate to Product Owner**: Product owner has final sign-off on all strategic decisions.
2. **Schedule Decision Meeting**: If asynchronous discussion does not converge, schedule 30-minute meeting with decision maker and stakeholders.
3. **Document Outcome**: After meeting, document decision and rationale in Decision Log.

---

## New Questions

As new questions emerge during development, add them to this document:

**Format**:
- **Question ID**: Q[number]
- **Title**: Brief description
- **Context**: Background and options
- **Impact**: How each option affects timeline, cost, or user experience
- **Recommendation**: Suggested option with rationale
- **Decision Maker**: Who owns the decision
- **Deadline**: When decision is needed
- **Status**: Open, In Progress, or Resolved

**Process**:
1. Add new question to this document (use next available Q number)
2. Notify decision maker via Slack or email
3. Set deadline based on urgency (critical, high, medium, low priority)
4. Follow resolution process (Steps 1-6 above)

---

## Review Cadence

Open questions are reviewed in weekly roadmap meetings:

**Owner**: Product Owner
**Attendees**: All stakeholders
**Duration**: 10 minutes

**Agenda**:
1. Review new questions added this week
2. Review questions approaching deadline
3. Escalate blocked questions
4. Update Decision Log

**Output**: Updated OPEN_QUESTIONS.md with resolved decisions and new questions
