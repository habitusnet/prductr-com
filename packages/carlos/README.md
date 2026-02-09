# @prductr/carlos

AI-powered product roadmap generation and market fit assessment.

## Overview

Carlos generates comprehensive product roadmaps, assesses market fit, prioritizes features, and audits technical debt. Through intelligent analysis of project docs and codebase, Carlos creates actionable scopecraft documentation for product teams.

## Features

- **🗺️ Roadmap** - Generate phased product roadmap with epics
- **📊 Market Fit** - Assess product-market fit with scoring
- **📋 Backlog** - Prioritize features using RICE framework
- **🔍 Technical Audit** - Identify technical debt and quality issues

## Installation

```bash
npm install @prductr/carlos
```

## CLI Usage

```bash
# Generate roadmap
npx carlos roadmap

# Assess market fit
npx carlos market-fit

# Prioritize backlog
npx carlos backlog

# Technical audit
npx carlos audit

# Complete analysis
npx carlos full
```

## Programmatic API

```typescript
import {
  generateRoadmap,
  assessMarketFit,
  prioritizeFeatures,
  auditTechnical,
} from '@prductr/carlos';

const config = {
  projectRoot: '/path/to/project',
  outputDir: 'scopecraft',
  docsDir: 'docs',
  includeMarketFit: true,
  includeTechnicalAudit: true,
};

// Generate roadmap
const roadmap = await generateRoadmap(config);

// Assess market fit
const assessment = await assessMarketFit(config);

// Prioritize features
const features = ['Feature A', 'Feature B', 'Feature C'];
const backlog = await prioritizeFeatures(config, features);

// Technical audit
const audit = await auditTechnical(config);
```

## Output Structure

Carlos creates scopecraft documentation:

```
scopecraft/
├── ROADMAP.md              # Phased roadmap with epics
├── METRICS_AND_PMF.md      # Market fit assessment
├── PRODUCT_BACKLOG.md      # Prioritized features (Now/Next/Later)
└── TECHNICAL_AUDIT.md      # Technical debt report
```

## Features

### Roadmap Generation

- Automatic stage detection (idea → prototype → mvp → growth → mature)
- 3 phased roadmap with objectives and milestones
- Epic creation with effort estimates
- Timeline estimation
- North star metric identification

### Market Fit Assessment

- PMF scoring (0-100)
- Target audience identification
- Problem-solution fit analysis
- Competitive landscape mapping
- Differentiator identification
- Risk and opportunity analysis

### Feature Prioritization

- RICE scoring framework (Reach, Impact, Confidence, Effort)
- Now/Next/Later categorization
- Priority score calculation
- Automated recommendations

### Technical Audit

- Code quality assessment
- Architecture evaluation
- Test coverage analysis
- Security vulnerability scan
- Dependency health check
- Technical debt prioritization

## Product Stages

Carlos recognizes nine product stages:

1. `idea` - Concept validation
2. `prototype` - Proof of concept
3. `mvp` - Minimum viable product
4. `alpha` - Internal testing
5. `beta` - External testing
6. `early-release` - Limited public release
7. `growth` - Scaling phase
8. `mature` - Established product
9. `enterprise` - Enterprise-grade

## Scoring Systems

### PMF Score (0-100)

- Clear target audience: 20 pts
- Problem statement: 20 pts
- Solution description: 20 pts
- Unique value proposition: 20 pts
- Differentiators: 15 pts
- Competition factor: 5 pts

### Technical Health (0-100)

Averages four category scores:
- Code Quality
- Architecture
- Test Coverage
- Security

## Configuration

```typescript
interface CarlosConfig {
  projectRoot: string;              // Project root directory
  outputDir: string;                // Output directory (default: scopecraft)
  docsDir: string;                  // Documentation directory (default: docs)
  includeMarketFit: boolean;        // Include market fit analysis
  includeTechnicalAudit: boolean;   // Include technical audit
}
```

## Examples

### Generate roadmap for current project
```bash
cd ~/projects/my-app
npx carlos roadmap
```

### Run complete analysis
```bash
npx carlos full
```

### Analyze specific project
```bash
npx carlos roadmap ./path/to/project
```

## Public Repository

Will be published to: `prductr-com/carlos`

## License

MIT
