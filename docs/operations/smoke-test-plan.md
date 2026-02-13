# Smoke Test Plan: Lisa & Carlos (gt-ops03)

**Bead:** gt-ops03 (Convoy-000 Launch Readiness)
**Purpose:** Verify Lisa and Carlos work on real repos before marketplace submission
**Last Updated:** 2026-02-13

---

## Test Repositories

Run each skill on 3 different real repositories:

1. **prductr-com** (`/home/groot/github/habitusnet/prductr-com`) - Known complex monorepo
2. **conductor** (`/home/groot/github/habitusnet/prductr-com/packages/conductor`) - Known nested package
3. **echome** (`/home/groot/github/prductr-com/echome`) - Known submodule

---

## Test 1: Lisa `/lisa:discover`

**Goal:** Extract semantic memory from each repo without errors.

### Test 1.1: prductr-com

```bash
cd /home/groot/github/habitusnet/prductr-com
# Run Lisa discover
/lisa:discover
```

**Expected Output:**
- Semantic memory file created in current directory
- No fatal errors
- Key sections populated: project purpose, architecture, recent changes, open questions

**Pass Criteria:**
- ✅ Command completes without crash
- ✅ Output file exists and is valid JSON/Markdown
- ✅ File contains meaningful content (not empty/placeholder)

### Test 1.2: conductor

```bash
cd /home/groot/github/habitusnet/prductr-com/packages/conductor
/lisa:discover
```

**Pass Criteria:** Same as 1.1

### Test 1.3: echome

```bash
cd /home/groot/github/prductr-com/echome
/lisa:discover
```

**Pass Criteria:** Same as 1.1

---

## Test 2: Carlos `/carlos:roadmap`

**Goal:** Generate strategic roadmap from existing docs without errors.

### Test 2.1: prductr-com

```bash
cd /home/groot/github/habitusnet/prductr-com
# Run Carlos roadmap
/carlos:roadmap
```

**Expected Output:**
- `scopecraft/` directory created with 6 files:
  1. VISION_AND_STAGE_DEFINITION.md
  2. ROADMAP.md
  3. EPICS_AND_STORIES.md
  4. RISKS_AND_DEPENDENCIES.md
  5. METRICS_AND_PMF.md
  6. OPEN_QUESTIONS.md
- All files have substantive content (not [TODO] placeholders)

**Pass Criteria:**
- ✅ Command completes without crash
- ✅ All 6 scopecraft files exist
- ✅ ROADMAP.md has 3-5 phases defined
- ✅ EPICS_AND_STORIES.md has 3+ epics with acceptance criteria

### Test 2.2: conductor

```bash
cd /home/groot/github/habitusnet/prductr-com/packages/conductor
/carlos:roadmap
```

**Pass Criteria:** Same as 2.1

### Test 2.3: echome

```bash
cd /home/groot/github/prductr-com/echome
/carlos:roadmap
```

**Pass Criteria:** Same as 2.1

---

## Showstopper Bugs

**Definition:** Issues that MUST be fixed before marketplace submission.

Showstoppers include:
- Skill crashes on valid repo
- Skill hangs indefinitely (>10 minutes)
- Output is empty or corrupted
- Skill overwrites critical files (README, package.json)
- Skill requires manual intervention mid-run

**Non-showstoppers** (can be deferred to Phase 8):
- Slow performance (5+ minutes)
- Minor formatting issues in output
- Missing optional sections
- Edge case failures on unusual repo structures

---

## Bug Tracking

**If a test fails:**

1. Note the error message and stack trace
2. Create GitHub issue:
   - **Repo:** `prductr-com/lisa` or `prductr-com/carlos`
   - **Label:** `bug`, `pre-launch`, `smoke-test`
   - **Title:** `[Smoke Test] <skill> fails on <repo>`
   - **Body:** Test ID, command, error output, reproduction steps

3. Fix showstoppers immediately
4. Defer non-showstoppers to backlog

---

## Critical Path Tests (Subset)

If time is limited, run ONLY these:

| Test ID | Skill | Command | Repo | Priority |
|---------|-------|---------|------|----------|
| 1.1 | Lisa | `/lisa:discover` | prductr-com | P0 |
| 2.1 | Carlos | `/carlos:roadmap` | prductr-com | P0 |

**Rationale:** prductr-com is the most complex repo (monorepo with submodules, nested packages, existing scopecraft). If skills work here, they likely work on simpler repos.

---

## Test Execution Log

**Date:** [FILL IN]
**Tester:** [FILL IN]

| Test ID | Status | Duration | Notes | Issue # |
|---------|--------|----------|-------|---------|
| 1.1 | ⏳ | - | - | - |
| 1.2 | ⏳ | - | - | - |
| 1.3 | ⏳ | - | - | - |
| 2.1 | ⏳ | - | - | - |
| 2.2 | ⏳ | - | - | - |
| 2.3 | ⏳ | - | - | - |

**Legend:**
- ⏳ Not started
- 🔄 In progress
- ✅ Pass
- ❌ Fail (showstopper)
- ⚠️ Fail (non-showstopper)

---

## Acceptance Criteria (Bead gt-ops03)

- [ ] Lisa: `/lisa:discover` runs successfully on 3 different repos
- [ ] Carlos: `/carlos:roadmap` runs successfully on 3 different repos
- [ ] All showstopper bugs fixed
- [ ] 5-10 critical path tests written for each skill
- [ ] Test results documented in this file

---

## Next Steps After Smoke Tests

1. **If all tests pass:**
   - Mark bead gt-ops03 complete
   - Proceed to convoy-003 (Marketplace Submissions)

2. **If showstoppers found:**
   - Fix bugs immediately
   - Re-run failed tests
   - Document fixes in GitHub issues

3. **Write critical path tests** (5-10 per skill):
   - Lisa: git archaeology, semantic memory extraction, timeline analysis
   - Carlos: roadmap generation, epic extraction, risk analysis
   - Use Vitest or similar framework
   - Store in `tests/` directory of each skill repo

---

## Test Repositories (Alternative)

If the primary repos are not suitable:

- **Small repo:** Simple Next.js app, single package
- **Medium repo:** Standard React app with tests
- **Large repo:** Enterprise monorepo (>100k LOC)

Examples:
- https://github.com/vercel/next.js (large)
- https://github.com/facebook/react (large)
- Any personal project repos available locally
