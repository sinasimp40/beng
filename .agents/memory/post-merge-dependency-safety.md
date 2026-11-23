---
name: Post-merge dependency safety
description: How to preserve reliable merge setup when Replit blocks a vulnerable transitive package.
---

Keep the post-merge hook responsible for dependency installation, schema synchronization, and the production build. Do not “fix” package-firewall failures by skipping dependency installation.

**Why:** The initial hook exposed a blocked vulnerable transitive package. Updating its direct parent dependency removed the obsolete dependency chain while preserving a complete setup process for future merges.

**How to apply:** When the package firewall blocks a transitive dependency during post-merge setup, identify and update the direct parent package, then rerun the complete hook and type check.

A direct-parent patch upgrade may still retain a blocked transitive version from the lockfile. Check the resolved dependency, not just the parent's version; use a narrowly scoped compatible override when a major parent upgrade would require unrelated application changes.

**Why:** A newer Express 4 patch still permitted the locked, blocked proxy-address dependency; moving to Express 5 would also require changing existing wildcard routing.

**How to apply:** Prefer the current major's latest patch for import setup, pin the patched transitive release only when compatible, and verify both the build and runtime.