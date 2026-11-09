---
name: Payment network identifiers
description: NOWPayments documentation examples can contain obsolete coin identifiers.
---

Check NOWPayments' current currency list and the merchant's enabled coins before trusting ticker values copied from documentation examples. A payment currency identifies both an asset and its network.

**Why:** The older OpenAPI example list included plain USDT and legacy BNB identifiers, but the current live currency list omitted them and exposed network-specific replacements. Using outdated examples can make only those coins fail while other coins work.

**How to apply:** Use the exact provider identifier through currency selection, minimum-amount requests, payment creation, and reconciliation. Never silently choose a network for a customer who selected only a generic stablecoin ticker; preserve the original network on existing payments.
