// NOWPayments identifies the asset AND network, not just the ticker symbol.
// Never alias plain "usdt" to a network: the customer must choose it explicitly.
export const PAYMENT_CURRENCIES = [
  { id: "btc", name: "Bitcoin", symbol: "btc", uriPrefix: "bitcoin" },
  { id: "eth", name: "Ethereum", symbol: "eth", uriPrefix: "ethereum" },
  { id: "usdttrc20", name: "USDT (TRC20)", symbol: "usdt", uriPrefix: "usdt" },
  { id: "usdterc20", name: "USDT (ERC20)", symbol: "usdt", uriPrefix: "usdt" },
  { id: "usdtbsc", name: "USDT (BSC)", symbol: "usdt", uriPrefix: "usdt" },
  { id: "ltc", name: "Litecoin", symbol: "ltc", uriPrefix: "litecoin" },
  { id: "sol", name: "Solana", symbol: "sol", uriPrefix: "solana" },
  { id: "bnbbsc", name: "BNB (BSC)", symbol: "bnb", uriPrefix: "bnb" },
  { id: "xrp", name: "XRP", symbol: "xrp", uriPrefix: "ripple" },
  { id: "doge", name: "Dogecoin", symbol: "doge", uriPrefix: "dogecoin" },
  { id: "xmr", name: "Monero", symbol: "xmr", uriPrefix: "monero" },
] as const;

export type PaymentCurrency = (typeof PAYMENT_CURRENCIES)[number]["id"];
