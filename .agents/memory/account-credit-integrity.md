---
name: Account-credit integrity
description: Durable consistency rules for balance mutations and asynchronous crypto top-ups.
---

Keep the shop's $1 minimum for account-credit top-ups, independently of any higher NOWPayments minimum.

**Why:** The user explicitly chose to keep the $1 minimum rather than allow cent-sized top-ups.

**How to apply:** Preserve the $1 floor when changing top-up validation or payment-provider checks; this is not a $1 minimum for product purchases.

Every monetary operation must have a stable idempotency key plus an operation fingerprint, and retries sharing a key must be serialized before checking the ledger. Account and order deletion must acquire the same ownership locks as balance mutations and preserve any account or order with financial history or pending obligations.

**Why:** Request retries, callback reordering, missed provider callbacks, and concurrent admin actions can otherwise duplicate funds, orphan paid top-ups, or separate audit records from their owners.

**How to apply:** For new credit operations, lock the affected user/order rows in the established order, mutate balances and ledger entries in one transaction, reject changed payloads for reused keys, and keep bounded reconciliation running for completed external payments that can later be refunded. On clients, scope each key to the current payload so changing an amount or currency starts a new operation while retrying the same payload reuses its key.

Product purchases must support cent-priced items independently of the $1 account top-up floor. Only display crypto methods whose current minimum estimate fits the amount, and only display account credit when its balance covers the purchase. Never automatically switch a customer's chosen network.

**Why:** The user asked for cent-priced products while retaining the $1 top-up floor, then explicitly asked to hide unavailable methods rather than let customers select them. The actual provider minimum depends on merchant payout configuration, so an estimate cannot guarantee acceptance. Automatically changing a network undermines an explicit customer choice.

**How to apply:** Hide methods with missing or excessive minimum estimates and require an explicit eligible selection. Explain loading, lookup failure, and no-method states. If creation rejects a currency for its minimum, hide it for that amount on retry. NOWPayments creation still enforces its actual limit; do not claim guaranteed acceptance. The API's fiat amount may be in numeric `fiat_equivalent`, not `fiat_equivalent_amount`.

External credit notifications use a transactional outbox with canonical provider statuses and at-least-once delivery; they must never share completion state with email or financial mutations.

**Why:** Polling and callbacks can observe the same transition concurrently, while a network timeout can make Telegram acceptance unknowable. Exactly-once external messaging is not available, but duplicate observations and ordinary stalled sends can be controlled.

**How to apply:** Insert one event per top-up/status in the same transaction as the state change, use leased retry workers with request timeouts shorter than the lease, and require the current lease token to acknowledge delivery.

Manual recovery of an exhausted credit notification may reset only its delivery fields, and only after any active lease has expired; it must never replay the financial operation that created the ledger row.

**Why:** Admin retries can race each other or a delayed worker. A conditional state transition prevents duplicate retry ownership while lease-token acknowledgements stop an old worker from overwriting the recovered state.

**How to apply:** Expose only terminal notifications at the attempt limit, convert stale final leases to a recoverable terminal state, and atomically reset one existing outbox record without inserting or mutating ledger, balance, top-up, refund, or order data.