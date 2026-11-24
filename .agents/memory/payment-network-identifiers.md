---
name: Payment network identifiers
description: NOWPayments documentation examples can contain obsolete coin identifiers.
---

Check NOWPayments' current currency list and the merchant's enabled coins before trusting ticker values copied from documentation examples. A payment currency identifies both an asset and its network.

**Why:** The older OpenAPI example list included plain USDT and legacy BNB identifiers, but the current live currency list omitted them and exposed network-specific replacements. Using outdated examples can make only those coins fail while other coins work.

**How to apply:** Use the exact provider identifier through currency selection, minimum-amount requests, payment creation, and reconciliation. Never silently choose a network for a customer who selected only a generic stablecoin ticker; preserve the original network on existing payments.

Present USDT as one currency choice with a separate explicit BSC (BEP20), ERC20, or TRC20 network choice. Keep native BNB separate.

**Why:** The user asked to combine the repeated USDT options while retaining a choice of network.

**How to apply:** Use this grouping in checkout and top-ups without sending a generic USDT identifier or changing a customer's network automatically.

NOWPayments status lookup can temporarily return `404 NOT_FOUND` for a payment immediately after successful creation.

**Why:** Live unpaid creation checks returned valid waiting payments, but their first status reads returned not found; later reads of those same payments succeeded with the expected currency and unpaid state.

**How to apply:** Do not interpret the first not-found response as payment failure or recreate the invoice automatically. Keep bounded polling and distinguish temporary lookup failure from a terminal provider payment status.
