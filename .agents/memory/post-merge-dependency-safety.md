---
name: Post-merge dependency safety
description: How to preserve reliable merge setup when Replit blocks a vulnerable transitive package.
---

Keep the post-merge hook responsible for dependency installation, schema synchronization, and the production build. Do not “fix” package-firewall failures by skipping dependency installation.

**Why:** The initial hook exposed a blocked vulnerable transitive package. Updating its direct parent dependency removed the obsolete dependency chain while preserving a complete setup process for future merges.

**How to apply:** When the package firewall blocks a transitive dependency during post-merge setup, identify and update the direct parent package, then rerun the complete hook and type check.