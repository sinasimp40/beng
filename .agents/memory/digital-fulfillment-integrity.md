---
name: Digital fulfillment integrity
description: Durable concurrency rule for paid digital-stock delivery.
---

Paid digital-stock fulfillment must claim all order lines atomically and must acquire a separate durable database lease before sending the consolidated delivery email.

**Why:** Process-local locks cannot prevent duplicate credentials or duplicate delivery messages across restarts and concurrent app instances; partial claims must roll back as a unit.

**How to apply:** Any future fulfillment path must reuse the existing transactional stock claim and database-owned delivery dispatch state rather than consuming stock or sending credentials directly.