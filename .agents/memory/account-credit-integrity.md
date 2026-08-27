---
name: Account-credit integrity
description: Durable consistency rules for balance mutations and asynchronous crypto top-ups.
---

Every monetary operation must have a stable idempotency key plus an operation fingerprint, and retries sharing a key must be serialized before checking the ledger. Account and order deletion must acquire the same ownership locks as balance mutations and preserve any account or order with financial history or pending obligations.

**Why:** Request retries, callback reordering, missed provider callbacks, and concurrent admin actions can otherwise duplicate funds, orphan paid top-ups, or separate audit records from their owners.

**How to apply:** For new credit operations, lock the affected user/order rows in the established order, mutate balances and ledger entries in one transaction, reject changed payloads for reused keys, and keep bounded reconciliation running for completed external payments that can later be refunded.