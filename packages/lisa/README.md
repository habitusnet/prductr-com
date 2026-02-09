# @prductr/lisa

Archaeological rescue & migration agent for abandoned projects.

## Overview

Lisa reconstructs lost context from abandoned codebases and generates executable migration plans. Through git archaeology, semantic analysis, and strategic planning, Lisa transforms dormant projects into well-structured, actionable roadmaps.

## Features

- **🔬 Rescue** - Full pipeline combining all capabilities
- **📊 Research** - Git archaeology and timeline analysis
- **🧠 Discover** - Semantic memory extraction from codebase
- **🗺️ Plan** - Roadmap generation with scopecraft docs
- **📦 Structure** - Work item (bead) and bundle (convoy) creation
- **🔄 Reconcile** - Multi-project alignment analysis

## Installation

```bash
npm install @prductr/lisa
```

## CLI Usage

```bash
# Full rescue pipeline
npx lisa rescue

# Individual commands
npx lisa research          # Git archaeology
npx lisa discover          # Extract semantic memory
npx lisa plan              # Generate roadmap
npx lisa structure         # Create work items
npx lisa reconcile ./p1 ./p2  # Align multiple projects
```

## Programmatic API

```typescript
import { rescue, research, discover, plan, structure, reconcile } from '@prductr/lisa';

const config = {
  projectRoot: '/path/to/project',
  outputDir: '.gt',
  scopecraftDir: 'scopecraft',
  excludePatterns: ['node_modules', 'dist', '.git']
};

// Full rescue
const result = await rescue(config);

// Individual stages
const researchOutput = await research(config);
const semanticMemory = await discover(config);
const planning = await plan(config, semanticMemory);
const structureOutput = await structure(config, planning);

// Multi-project reconciliation
const alignment = await reconcile(config, ['/path/p1', '/path/p2']);
```

## Output Structure

Lisa creates two output directories:

### `.gt/` - Work Structure
```
.gt/
├── beads/          # Individual work items
│   ├── gt-phase-1-001.json
│   └── gt-phase-1-002.json
├── convoys/        # Work bundles
│   ├── convoy-001.json
│   └── convoy-002.json
├── memory/         # Semantic memory
│   └── semantic.json
└── research/       # Git archaeology
    └── timeline.json
```

### `scopecraft/` - Planning Docs
```
scopecraft/
├── ROADMAP.md                      # Phased roadmap
├── VISION_AND_STAGE_DEFINITION.md  # Vision & completion criteria
└── OPEN_QUESTIONS.md               # Blocking questions
```

## Workflow

1. **Rescue** → Analyzes abandoned project and creates complete migration plan
2. **Research** → Examines git history to understand project timeline
3. **Discover** → Extracts semantic memory (stack, architecture, patterns)
4. **Plan** → Generates phased roadmap with scopecraft documentation
5. **Structure** → Creates executable work items (beads) and bundles (convoys)
6. **Reconcile** → Aligns multiple projects in an ecosystem

## Configuration

```typescript
interface LisaConfig {
  projectRoot: string;           // Project root directory
  outputDir: string;             // Output directory (default: .gt)
  scopecraftDir: string;         // Scopecraft directory (default: scopecraft)
  excludePatterns: string[];     // Patterns to exclude from analysis
}
```

## Project Stages

Lisa recognizes seven maturity stages:

1. `abandoned` - Dormant project needing rescue
2. `mvp` - Minimum viable product
3. `alpha` - Internal testing
4. `beta` - External testing
5. `early-release` - Limited public release
6. `stable` - Production-ready
7. `mature` - Enterprise-grade

## Public Repository

Will be published to: `prductr-com/lisa`

## License

MIT
