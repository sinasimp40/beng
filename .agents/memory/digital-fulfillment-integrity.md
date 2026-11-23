---
name: Digital fulfillment integrity
description: Durable concurrency rule for paid digital-stock delivery.
---

Paid digital-stock fulfillment must claim all order lines atomically and must acquire a separate durable database lease before sending the consolidated delivery email.

**Why:** Process-local locks cannot prevent duplicate credentials or duplicate delivery messages across restarts and concurrent app instances; partial claims must roll back as a unit.

**How to apply:** Any future fulfillment path must reuse the existing transactional stock claim and database-owned delivery dispatch state rather than consuming stock or sending credentials directly.

Once fulfillment owns an order, delayed payment-provider states must not overwrite the fulfillment status; only the lease-aware delivery path may complete or fail it.

**Why:** Provider callbacks and polls can arrive out of order after stock is claimed. A stale non-terminal payment state can otherwise invalidate an active email lease and strand credentials that were already removed from inventory.

**How to apply:** Centralize provider-state mapping, accept non-terminal transitions only before fulfillment starts, route settled payments through fulfillment, and keep a database predicate that rejects stale status writes after ownership changes.