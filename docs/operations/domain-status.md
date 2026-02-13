# Domain Configuration Status

**Last Updated:** 2026-02-13
**Bead:** gt-d1001, gt-d1002, gt-d1003 (Convoy-001)

---

## Current State (As-Is)

| Domain | DNS Points To | Actual Service | Status | Issue |
|--------|---------------|----------------|--------|-------|
| `prductr.com` | Vercel (76.76.21.21) | Dashboard (control plane) | ⚠️ Wrong | Should serve landing site |
| `dashboard.prductr.com` | Vercel | Dashboard (control plane) | ✅ Correct | Working |
| `conductor.prductr.com` | Cloudflare proxy (104.x) | 308 redirect loop | ❌ Broken | Not configured |
| `echome.prductr.com` | Not configured | - | ❌ Missing | Needs Cloudflare Workers route |

**Vercel Projects:**
- `prductr-com` → https://dashboard.prductr.com (correct)
- `prductr-landing` → https://prductr-landing.vercel.app (needs prductr.com domain)

**DNS Provider:** Cloudflare (nameservers: dora.ns.cloudflare.com, ivan.ns.cloudflare.com)

---

## Target State (To-Be)

| Domain | Service | Platform | Purpose |
|--------|---------|----------|---------|
| `prductr.com` | Landing site | Vercel | Marketing, skill discovery |
| `dashboard.prductr.com` | Control plane | Vercel | Orchestration operators (existing, keep) |
| `conductor.prductr.com` | TBD | - | Reserved for future use |
| `echome.prductr.com` | echome API | Cloudflare Workers | Remote test execution |

---

## Required Actions

### 1. Fix prductr.com (P1)

**Problem:** Domain is assigned to `prductr-com` Vercel project (dashboard) but should point to `prductr-landing` project.

**Solution:**
```bash
# Option A: Remove from prductr-com, then add to prductr-landing
vercel domains rm prductr.com prductr-com
vercel domains add prductr.com prductr-landing

# Option B: Use Vercel dashboard
# 1. Go to prductr-com project > Settings > Domains
# 2. Remove prductr.com
# 3. Go to prductr-landing project > Settings > Domains
# 4. Add prductr.com
```

**DNS:** Already pointing to Vercel (76.76.21.21), no changes needed.

**Verification:**
```bash
curl -I https://prductr.com
# Expect: 200 OK, HTML content from landing site
```

---

### 2. Configure echome.prductr.com (P1)

**Problem:** echome worker has route commented out in wrangler.toml.

**Solution:**

Edit `/home/groot/github/prductr-com/echome/wrangler.toml`:
```toml
# Uncomment and update:
[routes]
pattern = "echome.prductr.com/*"
custom_domain = true
```

Then deploy:
```bash
cd /home/groot/github/prductr-com/echome/apps/api
pnpm deploy
# or: npx wrangler deploy
```

**DNS:** Add CNAME record in Cloudflare:
```
Type: CNAME
Name: echome
Target: <worker-hostname-from-deploy-output>
Proxy: Yes (orange cloud)
```

**Verification:**
```bash
curl -I https://echome.prductr.com/health
# Expect: 200 OK from echome API
```

---

### 3. Resolve conductor.prductr.com (P2)

**Problem:** Domain has 308 redirect loop, unclear purpose.

**Options:**
1. **Remove CNAME** — Delete the Cloudflare DNS record if not needed
2. **Point to dashboard** — Same as dashboard.prductr.com (alias)
3. **Point to Conductor docs** — GitHub Pages or static site
4. **Reserve for future** — Keep DNS but return 503 "Coming Soon"

**Current DNS:** CNAME pointing to Cloudflare proxy (causes loop).

**Recommended:** Remove the CNAME record for now, reserve for future use when the Conductor project website is ready.

```bash
# Via Cloudflare Dashboard:
# DNS > Records > Delete conductor.prductr.com CNAME
```

---

## Nameserver Mismatch (Low Priority)

**Issue:** Vercel domain inspect shows "intended nameservers" are `ns1.vercel-dns.com` / `ns2.vercel-dns.com`, but actual nameservers are Cloudflare.

**Impact:** None. This is informational only — Cloudflare is managing DNS correctly.

**Explanation:** The domain `prductr.com` was added to Vercel, which triggered Vercel to suggest its own nameservers. However, the domain registrar still points to Cloudflare nameservers, which is correct for our setup (Cloudflare handles DNS + CDN).

**Action:** Ignore the mismatch. Continue using Cloudflare nameservers.

---

## Rollback Plan

If domain changes break production:

1. **Landing site down** → Revert prductr.com back to prductr-com project:
   ```bash
   vercel domains rm prductr.com prductr-landing
   vercel domains add prductr.com prductr-com
   ```

2. **Echome down** → Comment out routes in wrangler.toml and redeploy:
   ```toml
   # [routes]
   # pattern = "echome.prductr.com/*"
   ```
   Then: `npx wrangler deploy`

3. **DNS issues** → Revert Cloudflare DNS records to previous state (use audit log)

---

## Dependencies

- **Convoy-002 (Landing redesign)** — Blocked by this convoy. Must fix prductr.com first.
- **Convoy-003 (Marketplace)** — Blocked by convoy-000. Marketplace listings will link to prductr.com.

---

## Next Steps

1. Execute domain reassignment (prductr.com → prductr-landing)
2. Configure and deploy echome worker with custom domain
3. Test all domains after changes
4. Update documentation with final URLs
5. Proceed to convoy-002 (landing redesign)
