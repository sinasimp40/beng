---
name: Account-credit integrity
description: Durable consistency rules for balance mutations and asynchronous crypto top-ups.
---

Every monetary operation must have a stable idempotency key plus an operation fingerprint, and retries sharing a key must be serialized before checking the ledger. Account and order deletion must acquire the same ownership locks as balance mutations and preserve any account or order with financial history or pending obligations.

**Why:** Request retries, callback reordering, missed provider callbacks, and concurrent admin actions can otherwise duplicate funds, orphan paid top-ups, or separate audit records from their owners.

**How to apply:** For new credit operations, lock the affected user/order rows in the established order, mutate balances and ledger entries in one transaction, reject changed payloads for reused keys, and keep bounded reconciliation running for completed external payments that can later be refunded. On clients, scope each key to the current payload so changing an amount or currency starts a new operation while retrying the same payload reuses its key.

NOWPayments minimums must be fetched dynamically for the same source/target crypto pair with a fiat equivalent. Its live response returns the fiat amount in `fiat_equivalent` (numeric), despite documentation and older clients suggesting a separate `fiat_equivalent_amount` field.

**Why:** Hardcoded USD thresholds become stale, and assuming the wrong response field silently makes every currency minimum unknown.

**How to apply:** Cache live minimums briefly, treat unknown currencies as available rather than guessing, enforce known minimums again on the server before creating an order/top-up, and disable known-ineligible choices in the UI.

External credit notifications use a transactional outbox with canonical provider statuses and at-least-once delivery; they must never share completion state with email or financial mutations.

**Why:** Polling and callbacks can observe the same transition concurrently, while a network timeout can make Telegram acceptance unknowable. Exactly-once external messaging is not available, but duplicate observations and ordinary stalled sends can be controlled.

**How to apply:** Insert one event per top-up/status in the same transaction as the state change, use leased retry workers with request timeouts shorter than the lease, and require the current lease token to acknowledge delivery.