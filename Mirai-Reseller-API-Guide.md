# Mirai Reseller API — Hướng dẫn tích hợp cho Bot Đại lý

> **Chọn ngôn ngữ / Choose language / 选择语言：**
> [🇻🇳 Tiếng Việt](#tiếng-việt) · [🇬🇧 English](#english) · [🇨🇳 中文](#中文)

---

<a id="tiếng-việt"></a>
# 🇻🇳 TIẾNG VIỆT

## Mục lục

1. [Đây là gì? Dành cho ai?](#vn-1)
2. [Thuật ngữ cần biết (cho người không chuyên IT)](#vn-2)
3. [Bước 1 — Đăng ký đại lý & lấy API key](#vn-3)
4. [Bước 2 — Nạp tiền vào ví](#vn-4)
5. [Bước 3 — Gọi API từ bot/backend của bạn](#vn-5)
6. [Danh sách đầy đủ các endpoint](#vn-6)
7. [Chi tiết từng endpoint (kèm ví dụ)](#vn-7)
8. [Bảng giá gói & số lượng mua](#vn-8)
9. [Quy trình bán hàng mẫu cho bot đại lý](#vn-9)
10. [Retry & idempotency — không bao giờ trừ tiền 2 lần](#vn-10)
11. [Rate limit & bảng mã lỗi](#vn-11)
12. [Checklist bảo mật](#vn-12)
13. [Code mẫu hoàn chỉnh (cURL + Python)](#vn-13)
14. [Câu hỏi thường gặp (FAQ)](#vn-14)

---

<a id="vn-1"></a>
## 1. Đây là gì? Dành cho ai?

**Mirai Reseller API** cho phép bạn vận hành **bot bán hàng của riêng bạn** (Telegram bot, website, app…) tự động mua gói API của Mirai theo **giá sỉ theo hạng** (Bạc giảm 5% / Vàng 7% khi doanh số tháng trước ≥ $50 / Kim cương 10% khi ≥ $100), rồi bạn tự đặt giá bán lại cho khách.

Một lần gọi `POST /orders` sẽ làm hết mọi việc trong một giao dịch duy nhất:

1. Kiểm tra API key của đại lý.
2. Kiểm tra số dư ví.
3. Tính giá sỉ theo hạng hiện tại của đại lý (giá lẻ × 95/93/90%).
4. Trừ ví đúng một lần.
5. Tạo đơn + phát hành **N redeem code độc lập** (N = số lượng mua).
6. Trả kết quả ngay để bot bạn giao mã cho khách.

> ⚠️ API này chỉ dành cho **backend server/bot của đại lý**. Tuyệt đối không nhúng reseller API key vào app mobile, website frontend hay Telegram Mini App.

---

<a id="vn-2"></a>
## 2. Thuật ngữ cần biết (cho người không chuyên IT)

| Thuật ngữ | Nghĩa đơn giản |
|---|---|
| **API key đại lý** (reseller credential) | "Mật khẩu" của bot đại lý — dùng để gọi API mua hàng. Dạng `MR-...`. **Chỉ hiển thị 1 lần** khi tạo. |
| **Ví (wallet)** | Tài khoản trả trước của bạn trong bot Mirai. Nạp tiền trước, mỗi đơn API trừ dần. |
| **Package / gói** | Sản phẩm bán cho khách: một khối lượng **quota token** + **thời hạn** dùng. Ví dụ `FULL_100M` = 100 triệu token, dùng trong 3 ngày. |
| **Quota / token** | Đơn vị dung lượng AI. Khách xài đến đâu trừ đến đó. |
| **Redeem code** | Mã kích hoạt dạng `MR-XXXX...`. Khách của bạn nhận mã này rồi đổi lấy **API key (`sk-...`)** để xài. 1 mã chỉ đổi được 1 lần. |
| **API key của khách (`sk-...`)** | Key cuối cùng khách dùng trong tool AI (OpenAI-compatible). Sinh ra khi đổi redeem code. |
| **Idempotency-Key** | "Số biên lai" do bạn tự đặt cho mỗi đơn. Nếu bị timeout và gọi lại đúng số này, server trả lại đơn cũ chứ **không tạo đơn mới/trừ tiền lần hai**. |
| **external_order_id** | Mã đơn hàng trong hệ thống CỦA BẠN (ví dụ `BOT-A-ORDER-849138`). Dùng để tra cứu đơn sau này. |

---

<a id="vn-3"></a>
## 3. Bước 1 — Đăng ký đại lý & lấy API key

Làm ngay trong bot Telegram Mirai, không cần code:

1. Mở bot → vào menu **🤝 Đại lý**.
2. Bấm **📝 Đăng ký làm đại lý** → hệ thống tạo tài khoản đại lý ngay lập tức.
3. Bấm **🔑 Tạo API Key mới** → xác nhận.
4. Bot gửi credential dạng `MR-...` — **⚠️ chỉ hiển thị ĐÚNG 1 LẦN**. Copy và lưu ngay vào file `.env`/secret của backend.

```
MIRAI_RESELLER_API_KEY=MR-dán-key-của-bạn-vào-đây
```

- Quên/mất key → bấm **Tạo API Key mới** lần nữa (key cũ tự vô hiệu).
- Nghi lộ key → bấm **🚫 Thu hồi API Key** ngay, rồi tạo key mới.
- Mỗi đại lý có thể giữ nhiều credential; mỗi credential có **rate limit riêng** (50 req/phút).

---

<a id="vn-4"></a>
## 4. Bước 2 — Nạp tiền vào ví

Ví đại lý **dùng chung** với ví Mirai của bạn trong bot:

1. Menu **💰 Ví của tôi** → **💳 Nạp tiền**.
2. Chọn: chuyển khoản ngân hàng (VietQR), USDT BEP20/Polygon, hoặc Binance ID.
3. Sau khi tiền vào, kiểm tra số dư qua API: `GET /balance` (mục 7.1).

Ví phải đủ tiền **trước** khi `POST /orders`; thiếu tiền server trả `409` và không tạo đơn.

---

<a id="vn-5"></a>
## 5. Bước 3 — Gọi API từ bot/backend của bạn

**Base URL chuẩn:**

```text
https://api.miraiapi.com/api/reseller/v1
```

> Path cũ `https://api.miraiapi.com/api/reseller` (không có `/v1`) vẫn hoạt động tương thích. Tích hợp mới nên dùng `/v1`.

**Header bắt buộc cho mọi request reseller:**

```http
Authorization: Bearer <MIRAI_RESELLER_API_KEY>
Accept: application/json
User-Agent: TenBotCuaBan/1.0
Content-Type: application/json    (chỉ cho POST có body)
Idempotency-Key: <mã-duy-nhất>    (BẮT BUỘC cho POST /orders và POST /redeem-codes)
```

- ❌ Không dùng `X-Reseller-Key` — chỉ `Authorization: Bearer`.
- Nên set `User-Agent` rõ ràng (một số lớp WAF chặn client để UA trống).
- Mọi response có dạng `{ "success": true|false, "data": ..., "message": "..." }`.

---

<a id="vn-6"></a>
## 6. Danh sách đầy đủ các endpoint

### 6.1 Endpoint cần API key đại lý (`Authorization: Bearer`)

| Method | Path | Việc |
|---|---|---|
| `GET` | `/api/reseller/v1/balance` | Xem số dư ví + mức chiết khấu |
| `GET` | `/api/reseller/v1/packages` | Lấy toàn bộ catalog (15 SKU + giá sỉ của bạn) |
| `POST` | `/api/reseller/v1/orders` | **Mua hàng** — trừ ví, trả ngay redeem code |
| `GET` | `/api/reseller/v1/orders/{external_order_id}` | Tra cứu đơn sau timeout |
| `POST` | `/api/reseller/v1/redeem-codes` | Mua nhanh 1 mã của một gói (tương đương orders với quantity=1) |

### 6.2 Endpoint public (không cần credential — bot/khách đều gọi được)

| Method | Path | Việc |
|---|---|---|
| `GET` | `/api/redeem/preview?code=MR-...` | Xem thông tin redeem code (không đánh dấu đã dùng) |
| `POST` | `/api/redeem/new` | Đổi redeem code → phát hành API key `sk-...` mới |
| `POST` | `/api/redeem/renew` | Cộng quota từ redeem code vào API key cũ (cùng group) |
| `POST` | `/api/usage/check` | Kiểm tra quota/thời hạn còn lại của một `sk-` key |

### 6.3 Endpoint khách cuối dùng

| Method | Path | Việc |
|---|---|---|
| `*` | `https://api.miraiapi.com/v1/...` | OpenAI-compatible (`/v1/chat/completions`, `/v1/models`…) — khách dùng key `sk-...` |
| Web | `https://miraiapi.com/usage/` | Trang khách tự check usage/đổi code |

---

<a id="vn-7"></a>
## 7. Chi tiết từng endpoint (kèm ví dụ)

### 7.1 `GET /balance` — số dư + chiết khấu

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/balance \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Accept: application/json" -H "User-Agent: MyBot/1.0"
```

```json
{"success": true, "data": {"balance_vnd": 1000000, "discount_bps": 1000}}
```

`discount_bps` phụ thuộc hạng tháng trước: `500` = Bạc 5%, `700` = Vàng 7% (doanh số ≥ $50/tháng), `1000` = Kim cương 10% (≥ $100/tháng; ví dụ trên là hạng Kim cương). Response còn kèm `tier`, `month_spend_vnd`, `next_tier`, `next_tier_gap_vnd`.

### 7.2 `GET /packages` — catalog động

Luôn lấy catalog từ đây để dựng menu — **đừng hard-code giá** trong code.

```json
{"success": true, "data": [
  {
    "code": "FULL_100M",
    "group": "full",
    "name": "Full GPT + Claude 100M tokens · 3D",
    "quota_tokens": 100000000,
    "duration_seconds": 259200,
    "retail_price_vnd": 80000,
    "reseller_price_vnd": 72000,
    "discount_bps": 1000,
    "models": ["claude-opus-5", "gpt-6-sol", "..."],
    "preset_quantities": [1, 2, 3, 5, 10],
    "custom_quantity": true,
    "min_quantity": 1,
    "max_quantity": 10000,
    "remaining_today": 0,
    "unlimited": true
  }
]}
```

- `unlimited: true` = không giới hạn tồn kho (`remaining_today` trả `0`); `remaining_today` chỉ có nghĩa với gói có hạn ngày.
- `models` = danh sách model đúng của gói — dùng luôn để hiển thị cho khách, đừng tự gõ.

### 7.3 `POST /orders` — mua hàng (endpoint quan trọng nhất)

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/orders \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: bot-order-849138" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "User-Agent: MyBot/1.0" \
  --data '{"external_order_id":"BOT-A-ORDER-849138","package_code":"FULL_100M","quantity":2}'
```

**Body:**

| Field | Bắt buộc | Ý nghĩa |
|---|---|---|
| `external_order_id` | ✅ | Mã đơn của hệ thống bạn — **duy nhất**, để tra cứu |
| `package_code` | ✅ | Mã gói lấy từ `GET /packages` (vd `FULL_100M`) |
| `quantity` | — | Số lượng suất, `1`–`10000`. Bỏ trống/`0` = mặc định `1` |

**Response `200` khi `status=fulfilled`:**

```json
{"success": true, "data": {
  "order_code": "MO-...",
  "external_order_id": "BOT-A-ORDER-849138",
  "package_code": "FULL_100M",
  "quantity": 2,
  "quota_tokens": 200000000,
  "duration_seconds": 259200,
  "unit_price_vnd": 72000,
  "amount_vnd": 144000,
  "balance_before": 1000000,
  "balance_after": 856000,
  "redeem_code": "MR-CODE-1",
  "redeem_codes": ["MR-CODE-1", "MR-CODE-2"],
  "status": "fulfilled"
}}
```

- ⚠️ **`redeem_codes` (số nhiều) mới là danh sách đầy đủ** — `quantity=N` trả N mã độc lập, mỗi mã đúng 1 suất gói. `redeem_code` (số ít) chỉ = **mã đầu tiên**, giữ để tương thích cũ. Bot phải giao **toàn bộ `redeem_codes`**, không chỉ đọc trường số ít khi `quantity > 1`.
- `quantity` nhân quota và tiền, nhưng **không** nhân thời hạn (mỗi mã vẫn hạn gốc của gói).
- Mã chưa đổi sống **30 ngày** kể từ phát hành; thời hạn gói chỉ bắt đầu chạy khi khách **đổi mã**.
- Client tương thích server cũ có thể dùng `data.redeem_codes ?? [data.redeem_code]`; đừng suy số mã từ `quantity` của đơn lịch sử.

### 7.4 `GET /orders/{external_order_id}` — tra cứu sau timeout

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/orders/BOT-A-ORDER-849138 \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY"
```

Trả đúng order (kèm `redeem_codes` đã lưu, cùng thứ tự) — dùng để recovery khi `POST /orders` timeout.

### 7.5 `POST /redeem-codes` — mua nhanh 1 mã

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/redeem-codes \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: rc-849138" \
  -H "Content-Type: application/json" \
  --data '{"package_code":"GPT_50M"}'
```

```json
{"success": true, "data": {"redeem_code": "MR-...", "package_code": "GPT_50M"}}
```

Tương đương `POST /orders` với `quantity=1` (vẫn trừ ví). Hầu hết bot chỉ cần `/orders`.

### 7.6 Public — đổi code & kiểm tra key

**Preview code (chưa tiêu):**

```bash
curl -sS "https://api.miraiapi.com/api/redeem/preview?code=MR-XXXX"
# → {code_prefix, status, package_code, package_name, quota_tokens, duration_seconds, expires_at}
```

**Đổi code → API key mới** (khách hoặc bot bạn đều gọi được):

```bash
curl -sS https://api.miraiapi.com/api/redeem/new \
  -X POST -H "Content-Type: application/json" \
  --data '{"redeem_code":"MR-XXXX"}'
# → {"api_key":"sk-...","quota_tokens":50000000,"expires_at":...,"recovered":false}
```

**Renew — cộng quota vào key cũ cùng group** (GPT chỉ cộng được bằng code GPT, v.v.):

```bash
curl -sS https://api.miraiapi.com/api/redeem/renew \
  -X POST -H "Content-Type: application/json" \
  --data '{"redeem_code":"MR-YYYY","api_key":"sk-..."}'
# → {api_key (masked), quota_before, quota_after, expires_at}
```

**Check usage của một `sk-` key:**

```bash
curl -sS https://api.miraiapi.com/api/usage/check \
  -X POST -H "Content-Type: application/json" \
  --data '{"api_key":"sk-..."}'
# → {quota_total, quota_remaining, requests_24h, error_rate_24h, success_rate_24h, expires_at}
```

### 7.7 Khách cuối dùng key `sk-...` như thế nào

```bash
curl -sS https://api.miraiapi.com/v1/chat/completions \
  -H "Authorization: Bearer sk-key-cua-khach" \
  -H "Content-Type: application/json" \
  --data '{"model":"claude-sonnet-5","messages":[{"role":"user","content":"hi"}]}'
```

Base URL cho mọi client OpenAI-compatible: `https://api.miraiapi.com/v1` · Key check usage tay: https://miraiapi.com/usage/

---

<a id="vn-8"></a>
## 8. Bảng giá gói & số lượng mua

**Giá sỉ = giá lẻ × (100% − giảm theo hạng)**: Bạc 5% / Vàng 7% / Kim cương 10%, tính trên doanh số `POST /orders` fulfilled của tháng trước (giờ VN). Bảng dưới minh họa giá ở hạng **Kim cương (−10%)**. Đại lý tự đặt giá bán cho khách — Mirai chỉ thu giá sỉ.

| Group | `package_code` | Quota | Thời hạn | Giá lẻ | **Giá sỉ bạn trả (KC −10%)** |
|---|---|---:|---|---:|---:|
| 🚀 GPT | `GPT_10M` | 10M token | 1 ngày | 7.000đ | **6.300đ** |
| 🚀 GPT | `GPT_50M` | 50M token | 2 ngày | 35.000đ | **31.500đ** |
| 🚀 GPT | `GPT_100M` | 100M token | 3 ngày | 70.000đ | **63.000đ** |
| 🚀 GPT | `GPT_500M` | 500M token | 6 ngày | 325.000đ | **292.500đ** |
| 🤖 Claude | `CLAUDE_10M` | 10M token | 1 ngày | 7.500đ | **6.750đ** |
| 🤖 Claude | `CLAUDE_50M` | 50M token | 2 ngày | 37.500đ | **33.750đ** |
| 🤖 Claude | `CLAUDE_100M` | 100M token | 3 ngày | 75.000đ | **67.500đ** |
| 🤖 Claude | `CLAUDE_500M` | 500M token | 6 ngày | 350.000đ | **315.000đ** |
| 💎 Full (GPT+Claude) | `FULL_10M` | 10M token | 1 ngày | 8.000đ | **7.200đ** |
| 💎 Full | `FULL_50M` | 50M token | 2 ngày | 40.000đ | **36.000đ** |
| 💎 Full | `FULL_100M` | 100M token | 3 ngày | 80.000đ | **72.000đ** |
| 💎 Full | `FULL_500M` | 500M token | 6 ngày | 375.000đ | **337.500đ** |
| 🇨🇳 Trung Quốc | `TAU_50M` | 50M token | 2 ngày | 20.000đ | **18.000đ** |
| 🇨🇳 Trung Quốc | `TAU_100M` | 100M token | 4 ngày | 40.000đ | **36.000đ** |
| 🇨🇳 Trung Quốc | `TAU_500M` | 500M token | 7 ngày | 190.000đ | **171.000đ** |

**Group chứa model nào** (lấy trực tiếp từ field `models` của `GET /packages`; list dưới để tham khảo):

- **GPT**: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6.1-sol`, `swe-2`
- **Claude**: `claude-opus-4.6/4.7/4.8`, `claude-sonnet-5`, `claude-opus-5`, `claude-fable-5`, `claude-fable-5.1`, `ccmax-claude-opus-5.5`, `claude-opus-5.5`, `claude-sonnet-5.5`, `swe-2`
- **Full**: toàn bộ GPT + Claude + `gemini-4-argon` + `swe-2` (không gồm lane Trung Quốc)
- **Trung Quốc (TAU)**: `kimi-k3`, `qwen3.8-max`, `hy3`, `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-v4.1-flash`, `glm-5.3-flash`

**Số lượng (`quantity`):**

- Preset khuyến nghị trong bot: `1, 2, 3, 5, 10`; custom cho phép `1`–`10000`.
- `quantity=N` → trừ ví `giá_sỉ × N` → trả **N redeem code độc lập**.
- Tất cả gói **không giới hạn tồn kho**.

---

<a id="vn-9"></a>
## 9. Quy trình bán hàng mẫu cho bot đại lý

```text
Khách /start bot của bạn
  → Backend gọi GET /packages (cache 5-15 phút)
  → Hiển thị menu group: GPT / Claude / Full / Trung Quốc
  → Khách chọn gói + số lượng (preset hoặc tự nhập)
  → Bot bạn THU TIỀN khách theo giá bạn tự đặt
  → Backend sinh external_order_id + Idempotency-Key, LƯU LẠI
  → POST /orders
      ├── 200 + status=fulfilled → gửi khách toàn bộ redeem_codes ✅
      ├── timeout/5xx → retry CÙNG key+payload hoặc GET /orders/{id}
      └── 4xx → đọc message, sửa request, KHÔNG retry mù
Khách nhận code → đổi tại POST /api/redeem/new (hoặc trang usage)
  → Nhận sk-key → xài tại https://api.miraiapi.com/v1
```

---

<a id="vn-10"></a>
## 10. Retry & idempotency — không bao giờ trừ tiền 2 lần

- Mỗi đơn **bắt buộc** 2 mã duy nhất: `external_order_id` (mã đơn của bạn) + `Idempotency-Key` (header).
- Server nhớ cặp này. Gọi lại **cùng key + cùng payload** → trả lại đúng đơn cũ + đúng danh sách code cũ, **không trừ ví lần hai**.
- Cùng `Idempotency-Key` nhưng **payload khác** → `409 idempotency payload mismatch`.
- Timeout → **không được sinh mã mới**: retry `POST /orders` y hệt, hoặc `GET /orders/{external_order_id}`.
- Bị `429` → chờ vài giây (theo `Retry-After` nếu có) rồi retry cùng key.

---

<a id="vn-11"></a>
## 11. Rate limit & bảng mã lỗi

**Rate limit:** 50 request/phút cho **mỗi credential**. Tạo credential thứ hai = bucket riêng.

| HTTP | Ý nghĩa | Xử lý |
|---:|---|---|
| `200` | Thành công | Lưu order + giao `redeem_codes` |
| `400` | Thiếu/sai JSON, field, hoặc `Idempotency-Key` | Sửa request, không retry mù |
| `401` | Thiếu/sai/đã revoke credential | Kiểm tra Bearer key trong bot |
| `403` | Credential thiếu scope `redeem:write` | Liên hệ admin `@mirai_api` |
| `404` | Không thấy reseller/wallet/order | Kiểm tra URL + `external_order_id` |
| `409` | Thiếu số dư / package sai / idempotency conflict / mismatch | Đọc `message`; không tự tạo đơn mới |
| `429` | Quá 50 req/phút | Backoff vài giây rồi retry cùng key |
| `5xx`/timeout | Lỗi tạm | Retry cùng key hoặc GET order |

---

<a id="vn-12"></a>
## 12. Checklist bảo mật

- ✅ Chỉ gọi API từ **backend server** của bạn — không frontend, không Mini App, không mobile app.
- ✅ Key để trong env/secret manager — **không commit Git**, không paste vào chat.
- ✅ Không log `Authorization` hay toàn bộ redeem code.
- ✅ Mỗi khách/đơn một `external_order_id` riêng.
- ✅ Chỉ giao code khi `status=fulfilled` — và giao **đúng khách** (code = tiền).
- ✅ Nghi lộ key → **Thu hồi** trong bot ngay rồi rotate.

---

<a id="vn-13"></a>
## 13. Code mẫu hoàn chỉnh

### cURL — mua 3 gói `GPT_50M`

```bash
export MIRAI_RESELLER_API_KEY="MR-key-cua-ban"

curl -sS https://api.miraiapi.com/api/reseller/v1/orders \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: order-$(date +%s)" \
  -H "Content-Type: application/json" -H "User-Agent: MyBot/1.0" \
  --data '{"external_order_id":"BOT-ORDER-'"$(date +%s)"'","package_code":"GPT_50M","quantity":3}'
```

### Python — flow tối thiểu (stdlib only)

```python
import json, os, uuid, urllib.request

BASE = "https://api.miraiapi.com/api/reseller/v1"
KEY = os.environ["MIRAI_RESELLER_API_KEY"]

def call(method, path, body=None, idem=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
    )
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "MyBot/1.0")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if idem:
        req.add_header("Idempotency-Key", idem)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

# 1. Xem số dư + catalog
print(call("GET", "/balance"))
packages = call("GET", "/packages")["data"]

# 2. Mua 2 gói FULL_100M — idempotent, retry an toàn
idem = "order-" + uuid.uuid4().hex[:16]
ext = "BOT-ORDER-" + uuid.uuid4().hex[:12]
order = call("POST", "/orders",
             {"external_order_id": ext, "package_code": "FULL_100M", "quantity": 2},
             idem=idem)

# 3. Giao mã cho khách
if order["success"] and order["data"]["status"] == "fulfilled":
    for code in order["data"]["redeem_codes"]:   # LUÔN dùng redeem_codes (số nhiều)
        send_to_customer(code)
```

---

<a id="vn-14"></a>
## 14. Câu hỏi thường gặp (FAQ)

**Tôi không biết code — làm đại lý được không?**
Đăng ký + lấy key + nạp ví làm được trong bot không cần code. Nhưng để *bán tự động* bạn cần một backend gọi API — thuê dev hoặc dùng file này làm tài liệu cho họ. File này chính là thứ bạn đưa cho dev.

**Mất API key làm sao?**
Vào 🤝 Đại lý → 🔑 Tạo API Key mới (key cũ vô hiệu ngay). Key chỉ hiện 1 lần nên lưu kỹ.

**Khách đổi code ở đâu?**
Bot bạn có thể tự gọi `POST /api/redeem/new` để lấy `sk-` key giao cho khách; hoặc bảo khách đổi tay tại https://miraiapi.com/usage/.

**Một redeem code dùng mấy lần?**
Đúng 1 lần. Code chưa đổi sống 30 ngày; hết hạn không dùng được nữa.

**`quantity=5` nhận mấy mã?**
5 mã độc lập trong `redeem_codes` — mỗi mã đúng quota+thời hạn của 1 suất gói.

**Nạp ví ở đâu?**
Trong bot: 💰 Ví của tôi → 💳 Nạp tiền. Ví này trả cho cả mua lẻ lẫn đơn đại lý qua API.

**Server báo lỗi tiếng Anh khó hiểu?**
Tra bảng mã lỗi mục 11; `message` trong response luôn nói rõ nguyên nhân.

**Cần hỗ trợ?**
Telegram: `@mirai_api` (trong bot: 💬 Hỗ trợ → Chat với admin).

---
---

<a id="english"></a>
# 🇬🇧 ENGLISH

## Contents

1. [What is this? Who is it for?](#en-1)
2. [Glossary (for non-developers)](#en-2)
3. [Step 1 — Register & get your API key](#en-3)
4. [Step 2 — Top up your wallet](#en-4)
5. [Step 3 — Call the API from your bot/backend](#en-5)
6. [Full endpoint list](#en-6)
7. [Endpoint details with examples](#en-7)
8. [Package pricing & quantities](#en-8)
9. [Recommended reseller bot flow](#en-9)
10. [Retries & idempotency — never double-charge](#en-10)
11. [Rate limit & error codes](#en-11)
12. [Security checklist](#en-12)
13. [Complete code samples (cURL + Python)](#en-13)
14. [FAQ](#en-14)

---

<a id="en-1"></a>
## 1. What is this? Who is it for?

**Mirai Reseller API** lets you run **your own sales bot** (Telegram bot, website, app…) that automatically buys Mirai API packages at a **tiered wholesale price** (Silver −5% / Gold −7% when last month's sales ≥ $50 / Diamond −10% when ≥ $100). You set your own resale price for customers.

A single `POST /orders` call does everything in one atomic transaction:

1. Verifies your reseller API key.
2. Checks your wallet balance.
3. Computes the wholesale price for your current tier (retail × 95/93/90%).
4. Debits the wallet exactly once.
5. Creates the order + issues **N independent redeem codes** (N = quantity).
6. Returns the result immediately so your bot can deliver codes to the customer.

> ⚠️ This API is for **your reseller backend/bot only**. Never embed the reseller API key in a mobile app, website frontend, or Telegram Mini App.

---

<a id="en-2"></a>
## 2. Glossary (for non-developers)

| Term | Plain meaning |
|---|---|
| **Reseller API key** (credential) | Your bot's "password" for the purchase API — looks like `MR-...`. **Shown only once** when created. |
| **Wallet** | Your prepaid balance in the Mirai bot. Top up first; every API order debits it. |
| **Package** | The product you sell: a block of **token quota** + a **validity period**. E.g. `FULL_100M` = 100M tokens valid for 3 days. |
| **Quota / token** | The unit of AI usage. Customers consume it as they call models. |
| **Redeem code** | An activation code like `MR-XXXX...`. Your customer trades it for an **`sk-...` API key**. One code redeems once. |
| **Customer API key (`sk-...`)** | The final key customers use in OpenAI-compatible tools. Minted at redemption. |
| **Idempotency-Key** | A "receipt number" you assign each order. If a call times out and you retry with the same key, the server returns the old order — **no duplicate charge**. |
| **external_order_id** | The order ID in YOUR system (e.g. `BOT-A-ORDER-849138`). Used for later lookups. |

---

<a id="en-3"></a>
## 3. Step 1 — Register & get your API key

All inside the Mirai Telegram bot — no code needed:

1. Open the bot → **🤝 Reseller** menu.
2. Tap **📝 Register as Reseller** → your reseller account is created instantly.
3. Tap **🔑 Create API Key** → confirm.
4. The bot sends a credential like `MR-...` — **⚠️ shown EXACTLY ONCE**. Copy it into your backend's `.env`/secret store immediately.

```
MIRAI_RESELLER_API_KEY=MR-paste-your-key-here
```

- Lost the key → tap **Create API Key** again (the old one is invalidated automatically).
- Suspect a leak → tap **🚫 Revoke API Key** immediately, then create a new one.
- You may hold multiple credentials; each gets its **own rate-limit bucket** (50 req/min).

---

<a id="en-4"></a>
## 4. Step 2 — Top up your wallet

Your reseller wallet is the **same wallet** as your normal Mirai bot wallet:

1. **💰 My Wallet** → **💳 Top Up**.
2. Pick: bank transfer (VietQR), USDT BEP20/Polygon, or Binance ID.
3. After funds arrive, verify via `GET /balance` (section 7.1).

The wallet must hold enough balance **before** `POST /orders`; insufficient funds returns `409` and creates nothing.

---

<a id="en-5"></a>
## 5. Step 3 — Call the API from your bot/backend

**Canonical base URL:**

```text
https://api.miraiapi.com/api/reseller/v1
```

> The legacy path `https://api.miraiapi.com/api/reseller` (no `/v1`) still works for compatibility. New integrations should use `/v1`.

**Required headers on every reseller request:**

```http
Authorization: Bearer <MIRAI_RESELLER_API_KEY>
Accept: application/json
User-Agent: YourBotName/1.0
Content-Type: application/json    (only for POSTs with a body)
Idempotency-Key: <unique-id>      (REQUIRED for POST /orders and POST /redeem-codes)
```

- ❌ Do not use `X-Reseller-Key` — only `Authorization: Bearer`.
- Set a clear `User-Agent` (some WAF layers reject empty/default clients).
- Every response is shaped `{ "success": true|false, "data": ..., "message": "..." }`.

---

<a id="en-6"></a>
## 6. Full endpoint list

### 6.1 Reseller-authenticated (`Authorization: Bearer`)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/reseller/v1/balance` | Wallet balance + your discount tier |
| `GET` | `/api/reseller/v1/packages` | Full catalog (15 SKUs + your wholesale prices) |
| `POST` | `/api/reseller/v1/orders` | **Purchase** — debit wallet, get redeem codes instantly |
| `GET` | `/api/reseller/v1/orders/{external_order_id}` | Look up an order after a timeout |
| `POST` | `/api/reseller/v1/redeem-codes` | Quick-buy a single code (equivalent to orders with quantity=1) |

### 6.2 Public endpoints (no credential — callable by your bot or customers)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/redeem/preview?code=MR-...` | Inspect a redeem code without consuming it |
| `POST` | `/api/redeem/new` | Redeem a code → mint a new `sk-...` API key |
| `POST` | `/api/redeem/renew` | Add a code's quota onto an existing key (same group) |
| `POST` | `/api/usage/check` | Check remaining quota/expiry of an `sk-` key |

### 6.3 End-customer endpoints

| Method | Path | Purpose |
|---|---|---|
| `*` | `https://api.miraiapi.com/v1/...` | OpenAI-compatible (`/v1/chat/completions`, `/v1/models`…) with the `sk-...` key |
| Web | `https://miraiapi.com/usage/` | Self-service usage/redeem page |

---

<a id="en-7"></a>
## 7. Endpoint details with examples

### 7.1 `GET /balance` — balance + discount

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/balance \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Accept: application/json" -H "User-Agent: MyBot/1.0"
```

```json
{"success": true, "data": {"balance_vnd": 1000000, "discount_bps": 1000}}
```

`discount_bps` follows your monthly tier: `500` = Silver 5%, `700` = Gold 7% (last month's sales ≥ $50), `1000` = Diamond 10% (≥ $100; the example above shows Diamond). The response also carries `tier`, `month_spend_vnd`, `next_tier`, `next_tier_gap_vnd`.

### 7.2 `GET /packages` — the live catalog

Always build your menu from this — **never hard-code prices**.

```json
{"success": true, "data": [
  {
    "code": "FULL_100M",
    "group": "full",
    "name": "Full GPT + Claude 100M tokens · 3D",
    "quota_tokens": 100000000,
    "duration_seconds": 259200,
    "retail_price_vnd": 80000,
    "reseller_price_vnd": 72000,
    "discount_bps": 1000,
    "models": ["claude-opus-5", "gpt-6-sol", "..."],
    "preset_quantities": [1, 2, 3, 5, 10],
    "custom_quantity": true,
    "min_quantity": 1,
    "max_quantity": 10000,
    "remaining_today": 0,
    "unlimited": true
  }
]}
```

- `unlimited: true` = no stock cap (`remaining_today` returns `0`); `remaining_today` only matters for daily-capped packages.
- `models` = the exact allow-list for that package — display it verbatim instead of hand-typing.

### 7.3 `POST /orders` — purchase (the key endpoint)

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/orders \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: bot-order-849138" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "User-Agent: MyBot/1.0" \
  --data '{"external_order_id":"BOT-A-ORDER-849138","package_code":"FULL_100M","quantity":2}'
```

**Body:**

| Field | Required | Meaning |
|---|---|---|
| `external_order_id` | ✅ | Your system's order ID — **unique**, used for lookup |
| `package_code` | ✅ | From `GET /packages` (e.g. `FULL_100M`) |
| `quantity` | — | Units, `1`–`10000`. Empty/`0` defaults to `1` |

**`200` response with `status=fulfilled`:**

```json
{"success": true, "data": {
  "order_code": "MO-...",
  "external_order_id": "BOT-A-ORDER-849138",
  "package_code": "FULL_100M",
  "quantity": 2,
  "quota_tokens": 200000000,
  "duration_seconds": 259200,
  "unit_price_vnd": 72000,
  "amount_vnd": 144000,
  "balance_before": 1000000,
  "balance_after": 856000,
  "redeem_code": "MR-CODE-1",
  "redeem_codes": ["MR-CODE-1", "MR-CODE-2"],
  "status": "fulfilled"
}}
```

- ⚠️ **`redeem_codes` (plural) is the full list** — `quantity=N` returns N independent codes, each worth one package unit. `redeem_code` (singular) is **only the first code**, kept for compatibility. Your bot must deliver **all of `redeem_codes`**, not just the singular field when `quantity > 1`.
- `quantity` multiplies quota and price but **not** validity (each code keeps the package duration).
- An unredeemed code lives **30 days** from issuance; the package validity only starts when the customer **redeems** it.
- For legacy servers you may use `data.redeem_codes ?? [data.redeem_code]`; do not infer code count from an old order's `quantity`.

### 7.4 `GET /orders/{external_order_id}` — lookup after timeout

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/orders/BOT-A-ORDER-849138 \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY"
```

Returns the stored order (with the same `redeem_codes` in the same order) — your recovery path after a `POST /orders` timeout.

### 7.5 `POST /redeem-codes` — quick single-code purchase

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/redeem-codes \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: rc-849138" \
  -H "Content-Type: application/json" \
  --data '{"package_code":"GPT_50M"}'
```

```json
{"success": true, "data": {"redeem_code": "MR-...", "package_code": "GPT_50M"}}
```

Equivalent to `POST /orders` with `quantity=1` (still debits the wallet). Most bots only need `/orders`.

### 7.6 Public — redeem & inspect keys

**Preview a code (non-consuming):**

```bash
curl -sS "https://api.miraiapi.com/api/redeem/preview?code=MR-XXXX"
# → {code_prefix, status, package_code, package_name, quota_tokens, duration_seconds, expires_at}
```

**Redeem → new API key** (callable by you or the customer):

```bash
curl -sS https://api.miraiapi.com/api/redeem/new \
  -X POST -H "Content-Type: application/json" \
  --data '{"redeem_code":"MR-XXXX"}'
# → {"api_key":"sk-...","quota_tokens":50000000,"expires_at":...,"recovered":false}
```

**Renew — add quota to an existing key of the same group** (a GPT code only tops up a GPT key, etc.):

```bash
curl -sS https://api.miraiapi.com/api/redeem/renew \
  -X POST -H "Content-Type: application/json" \
  --data '{"redeem_code":"MR-YYYY","api_key":"sk-..."}'
# → {api_key (masked), quota_before, quota_after, expires_at}
```

**Check an `sk-` key's usage:**

```bash
curl -sS https://api.miraiapi.com/api/usage/check \
  -X POST -H "Content-Type: application/json" \
  --data '{"api_key":"sk-..."}'
# → {quota_total, quota_remaining, requests_24h, error_rate_24h, success_rate_24h, expires_at}
```

### 7.7 How the end customer uses `sk-...`

```bash
curl -sS https://api.miraiapi.com/v1/chat/completions \
  -H "Authorization: Bearer sk-customer-key" \
  -H "Content-Type: application/json" \
  --data '{"model":"claude-sonnet-5","messages":[{"role":"user","content":"hi"}]}'
```

Base URL for any OpenAI-compatible client: `https://api.miraiapi.com/v1` · Manual usage page: https://miraiapi.com/usage/

---

<a id="en-8"></a>
## 8. Package pricing & quantities

**Wholesale = retail × (100% − tier discount)**: Silver 5% / Gold 7% / Diamond 10%, computed from last month's fulfilled `POST /orders` sales (Vietnam time). The table below shows **Diamond (−10%)** prices. You set your own customer prices — Mirai only collects the wholesale amount.

| Group | `package_code` | Quota | Validity | Retail | **Your wholesale (Diamond −10%)** |
|---|---|---:|---|---:|---:|
| 🚀 GPT | `GPT_10M` | 10M tokens | 1 day | 7,000đ | **6,300đ** |
| 🚀 GPT | `GPT_50M` | 50M tokens | 2 days | 35,000đ | **31,500đ** |
| 🚀 GPT | `GPT_100M` | 100M tokens | 3 days | 70,000đ | **63,000đ** |
| 🚀 GPT | `GPT_500M` | 500M tokens | 6 days | 325,000đ | **292,500đ** |
| 🤖 Claude | `CLAUDE_10M` | 10M tokens | 1 day | 7,500đ | **6,750đ** |
| 🤖 Claude | `CLAUDE_50M` | 50M tokens | 2 days | 37,500đ | **33,750đ** |
| 🤖 Claude | `CLAUDE_100M` | 100M tokens | 3 days | 75,000đ | **67,500đ** |
| 🤖 Claude | `CLAUDE_500M` | 500M tokens | 6 days | 350,000đ | **315,000đ** |
| 💎 Full (GPT+Claude) | `FULL_10M` | 10M tokens | 1 day | 8,000đ | **7,200đ** |
| 💎 Full | `FULL_50M` | 50M tokens | 2 days | 40,000đ | **36,000đ** |
| 💎 Full | `FULL_100M` | 100M tokens | 3 days | 80,000đ | **72,000đ** |
| 💎 Full | `FULL_500M` | 500M tokens | 6 days | 375,000đ | **337,500đ** |
| 🇨🇳 Chinese | `TAU_50M` | 50M tokens | 2 days | 20,000đ | **18,000đ** |
| 🇨🇳 Chinese | `TAU_100M` | 100M tokens | 4 days | 40,000đ | **36,000đ** |
| 🇨🇳 Chinese | `TAU_500M` | 500M tokens | 7 days | 190,000đ | **171,000đ** |

**Models per group** (source of truth = the `models` field in `GET /packages`; this list is for reference):

- **GPT**: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-6-astra`, `gpt-6-sol`, `gpt-6.1-sol`, `swe-2`
- **Claude**: `claude-opus-4.6/4.7/4.8`, `claude-sonnet-5`, `claude-opus-5`, `claude-fable-5`, `claude-fable-5.1`, `ccmax-claude-opus-5.5`, `claude-opus-5.5`, `claude-sonnet-5.5`, `swe-2`
- **Full**: all GPT + Claude models + `gemini-4-argon` + `swe-2` (excludes the Chinese lane)
- **Chinese (TAU)**: `kimi-k3`, `qwen3.8-max`, `hy3`, `deepseek-v4-pro`, `deepseek-v4-flash`, `deepseek-v4.1-flash`, `glm-5.3-flash`

**Quantity (`quantity`):**

- Suggested bot presets: `1, 2, 3, 5, 10`; custom allowed from `1` to `10000`.
- `quantity=N` → debits `wholesale × N` → returns **N independent redeem codes**.
- All packages are **unlimited stock**.

---

<a id="en-9"></a>
## 9. Recommended reseller bot flow

```text
Customer /start on YOUR bot
  → Backend calls GET /packages (cache 5–15 min)
  → Show group menu: GPT / Claude / Full / Chinese
  → Customer picks package + quantity (preset or custom)
  → YOUR bot collects payment at YOUR price
  → Backend generates external_order_id + Idempotency-Key, STORES them
  → POST /orders
      ├── 200 + status=fulfilled → deliver all redeem_codes to the customer ✅
      ├── timeout/5xx → retry with SAME key+payload or GET /orders/{id}
      └── 4xx → read message, fix request, never blind-retry
Customer redeems at POST /api/redeem/new (or the usage page)
  → receives sk-key → uses https://api.miraiapi.com/v1
```

---

<a id="en-10"></a>
## 10. Retries & idempotency — never double-charge

- Every order **requires** two unique values: `external_order_id` (your order ID) + `Idempotency-Key` (header).
- The server remembers the pair. Retrying with the **same key + same payload** returns the original order and original codes — **no second wallet debit**.
- Same `Idempotency-Key` with a **different payload** → `409 idempotency payload mismatch`.
- On timeout → **never mint a new ID**: retry `POST /orders` as-is, or `GET /orders/{external_order_id}`.
- On `429` → wait a few seconds (honor `Retry-After` if present), then retry with the same key.

---

<a id="en-11"></a>
## 11. Rate limit & error codes

**Rate limit:** 50 requests/minute **per credential**. A second credential gets its own bucket.

| HTTP | Meaning | Action |
|---:|---|---|
| `200` | Success | Store the order + deliver `redeem_codes` |
| `400` | Bad JSON/fields or missing `Idempotency-Key` | Fix the request; no blind retry |
| `401` | Missing/wrong/revoked credential | Check the Bearer key in the bot |
| `403` | Credential lacks `redeem:write` scope | Contact admin `@mirai_api` |
| `404` | Reseller/wallet/order not found | Check URL + `external_order_id` |
| `409` | Insufficient balance / bad package / idempotency conflict | Read `message`; don't fabricate a new order |
| `429` | Over 50 req/min | Back off a few seconds, retry same key |
| `5xx`/timeout | Transient error | Retry same key or GET the order |

---

<a id="en-12"></a>
## 12. Security checklist

- ✅ Call the API only from **your backend server** — no frontend, Mini App, or mobile app.
- ✅ Keep the key in env/secret manager — **never commit to Git**, never paste into chats.
- ✅ Never log `Authorization` headers or full redeem codes.
- ✅ Unique `external_order_id` per customer/order.
- ✅ Deliver codes only when `status=fulfilled` — and only to the **right customer** (codes = money).
- ✅ Suspected leak → **Revoke** in the bot immediately, then rotate.

---

<a id="en-13"></a>
## 13. Complete code samples

### cURL — buy 3 × `GPT_50M`

```bash
export MIRAI_RESELLER_API_KEY="MR-your-key"

curl -sS https://api.miraiapi.com/api/reseller/v1/orders \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: order-$(date +%s)" \
  -H "Content-Type: application/json" -H "User-Agent: MyBot/1.0" \
  --data '{"external_order_id":"BOT-ORDER-'"$(date +%s)"'","package_code":"GPT_50M","quantity":3}'
```

### Python — minimal flow (stdlib only)

```python
import json, os, uuid, urllib.request

BASE = "https://api.miraiapi.com/api/reseller/v1"
KEY = os.environ["MIRAI_RESELLER_API_KEY"]

def call(method, path, body=None, idem=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
    )
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "MyBot/1.0")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if idem:
        req.add_header("Idempotency-Key", idem)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

# 1. Balance + catalog
print(call("GET", "/balance"))
packages = call("GET", "/packages")["data"]

# 2. Buy 2 × FULL_100M — idempotent, safe to retry
idem = "order-" + uuid.uuid4().hex[:16]
ext = "BOT-ORDER-" + uuid.uuid4().hex[:12]
order = call("POST", "/orders",
             {"external_order_id": ext, "package_code": "FULL_100M", "quantity": 2},
             idem=idem)

# 3. Deliver codes to the customer
if order["success"] and order["data"]["status"] == "fulfilled":
    for code in order["data"]["redeem_codes"]:   # ALWAYS use redeem_codes (plural)
        send_to_customer(code)
```

---

<a id="en-14"></a>
## 14. FAQ

**I can't code — can I still be a reseller?**
Registration, key creation and top-up need no code — all in the bot. But automated selling requires a backend calling this API; hand this file to your developer, it's the complete spec.

**Lost my API key?**
🤝 Reseller → 🔑 Create API Key (the old key dies instantly). Keys show once, so store it well.

**Where does my customer redeem a code?**
Your bot can call `POST /api/redeem/new` itself and hand over the `sk-` key; or send customers to https://miraiapi.com/usage/.

**How many times can a redeem code be used?**
Exactly once. An unredeemed code lives 30 days, then expires.

**`quantity=5` — how many codes come back?**
5 independent codes inside `redeem_codes`, each with one unit's quota + validity.

**Where do I top up?**
In the bot: 💰 My Wallet → 💳 Top Up. The same wallet pays both retail purchases and API orders.

**Confusing English error?**
See the error table in section 11; the response `message` always states the cause.

**Support?**
Telegram: `@mirai_api` (in the bot: 💬 Support → Chat with admin).

---
---

<a id="中文"></a>
# 🇨🇳 中文

## 目录

1. [这是什么？适合谁？](#zh-1)
2. [术语表（非技术人员也能看懂）](#zh-2)
3. [第一步 — 注册经销商并获取 API 密钥](#zh-3)
4. [第二步 — 充值钱包](#zh-4)
5. [第三步 — 从您的机器人/后端调用 API](#zh-5)
6. [完整端点列表](#zh-6)
7. [各端点详解（含示例）](#zh-7)
8. [套餐价格与购买数量](#zh-8)
9. [推荐的销售流程](#zh-9)
10. [重试与幂等 — 绝不重复扣款](#zh-10)
11. [限流与错误码](#zh-11)
12. [安全检查清单](#zh-12)
13. [完整代码示例（cURL + Python）](#zh-13)
14. [常见问题（FAQ）](#zh-14)

---

<a id="zh-1"></a>
## 1. 这是什么？适合谁？

**Mirai 经销商 API** 让您运营**自己的销售机器人**（Telegram bot、网站、App……），以**分等级批发价**自动购买 Mirai API 套餐（白银 95 折 / 上月销售额 ≥ $50 为黄金 93 折 / ≥ $100 为钻石 9 折）。卖给客户的价格由您自定。

一次 `POST /orders` 调用在同一事务中完成所有步骤：

1. 校验您的经销商 API 密钥。
2. 检查钱包余额。
3. 按当前等级计算批发价（零售价 × 95/93/90%）。
4. 恰好扣款一次。
5. 创建订单并发放 **N 个独立兑换码**（N = 数量）。
6. 立即返回结果，供您的机器人将兑换码交付客户。

> ⚠️ 此 API 仅供**经销商的后端服务器/机器人**使用。切勿将经销商密钥嵌入移动应用、网站前端或 Telegram Mini App。

---

<a id="zh-2"></a>
## 2. 术语表（非技术人员也能看懂）

| 术语 | 通俗解释 |
|---|---|
| **经销商 API 密钥**（credential） | 您机器人调购买接口的"密码"——形如 `MR-...`。**创建时仅显示一次**。 |
| **钱包（wallet）** | 您在 Mirai 机器人里的预付余额。先充值，每笔 API 订单从中扣款。 |
| **套餐（package）** | 卖给客户的商品：一块 **token 配额** + **有效期**。例如 `FULL_100M` = 1 亿 token，3 天有效。 |
| **配额 / token** | AI 用量单位，客户调用模型就消耗。 |
| **兑换码（redeem code）** | 形如 `MR-XXXX...` 的激活码。客户用它换 `sk-...` API key。一码仅可兑换一次。 |
| **客户 API key（`sk-...`）** | 客户在 OpenAI 兼容工具里实际使用的最终密钥，兑换时生成。 |
| **Idempotency-Key** | 您为每个订单指定的"流水号"。超时后用同一 key 重试，服务器返回旧订单——**绝不重复扣款**。 |
| **external_order_id** | 您自己系统里的订单号（如 `BOT-A-ORDER-849138`），用于事后查询。 |

---

<a id="zh-3"></a>
## 3. 第一步 — 注册经销商并获取 API 密钥

全程在 Mirai Telegram 机器人内完成，无需写代码：

1. 打开机器人 → 进入 **🤝 经销商** 菜单。
2. 点击 **📝 注册为经销商** → 即刻创建经销商账户。
3. 点击 **🔑 创建 API 密钥** → 确认。
4. 机器人发送形如 `MR-...` 的凭证——**⚠️ 仅显示一次**。请立即复制保存到后端的 `.env`/密钥管理中。

```
MIRAI_RESELLER_API_KEY=MR-粘贴您的密钥
```

- 密钥丢失 → 再次点击 **创建 API 密钥**（旧密钥自动失效）。
- 怀疑泄露 → 立即点击 **🚫 撤销 API 密钥**，再新建。
- 一个经销商可持有多个凭证，每个凭证有**独立的限流桶**（50 次/分钟）。

---

<a id="zh-4"></a>
## 4. 第二步 — 充值钱包

经销商钱包与您在机器人里的普通钱包**是同一个**：

1. **💰 我的钱包** → **💳 充值**。
2. 选择：银行转账（VietQR）、USDT BEP20/Polygon 或 Binance ID。
3. 到账后可用 `GET /balance` 查询余额（见 7.1）。

调用 `POST /orders` **之前**钱包必须有足够余额；余额不足返回 `409`，不会创建订单。

---

<a id="zh-5"></a>
## 5. 第三步 — 从您的机器人/后端调用 API

**标准 Base URL：**

```text
https://api.miraiapi.com/api/reseller/v1
```

> 旧路径 `https://api.miraiapi.com/api/reseller`（无 `/v1`）仍兼容可用，新集成请用 `/v1`。

**每个经销商请求必须携带的 header：**

```http
Authorization: Bearer <MIRAI_RESELLER_API_KEY>
Accept: application/json
User-Agent: YourBotName/1.0
Content-Type: application/json    （仅带 body 的 POST）
Idempotency-Key: <唯一值>         （POST /orders 和 POST /redeem-codes 必填）
```

- ❌ 不要使用 `X-Reseller-Key` —— 只认 `Authorization: Bearer`。
- 请设置明确的 `User-Agent`（某些 WAF 会拒绝空 UA 的客户端）。
- 所有响应统一为 `{ "success": true|false, "data": ..., "message": "..." }`。

---

<a id="zh-6"></a>
## 6. 完整端点列表

### 6.1 需经销商密钥（`Authorization: Bearer`）

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/reseller/v1/balance` | 查询钱包余额与折扣 |
| `GET` | `/api/reseller/v1/packages` | 获取完整目录（15 个 SKU + 您的批发价） |
| `POST` | `/api/reseller/v1/orders` | **下单购买** —— 扣钱包，立即返回兑换码 |
| `GET` | `/api/reseller/v1/orders/{external_order_id}` | 超时后查询订单 |
| `POST` | `/api/reseller/v1/redeem-codes` | 快速购买 1 个码（等价于 quantity=1 的 orders） |

### 6.2 公共端点（无需凭证 —— 您的机器人或客户均可调用）

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/redeem/preview?code=MR-...` | 预览兑换码信息（不消耗） |
| `POST` | `/api/redeem/new` | 兑换码 → 生成新的 `sk-...` API key |
| `POST` | `/api/redeem/renew` | 将兑换码配额充入同组旧 key |
| `POST` | `/api/usage/check` | 查询 `sk-` key 的剩余配额/有效期 |

### 6.3 终端客户使用的端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `*` | `https://api.miraiapi.com/v1/...` | OpenAI 兼容（`/v1/chat/completions`、`/v1/models` 等），使用 `sk-...` key |
| Web | `https://miraiapi.com/usage/` | 客户自助查询/兑换页面 |

---

<a id="zh-7"></a>
## 7. 各端点详解（含示例）

### 7.1 `GET /balance` —— 余额与折扣

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/balance \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Accept: application/json" -H "User-Agent: MyBot/1.0"
```

```json
{"success": true, "data": {"balance_vnd": 1000000, "discount_bps": 1000}}
```

`discount_bps` 取决于上月等级：`500` = 白银 95 折，`700` = 黄金 93 折（上月销售额 ≥ $50），`1000` = 钻石 9 折（≥ $100；上例为钻石）。响应还包含 `tier`、`month_spend_vnd`、`next_tier`、`next_tier_gap_vnd`。

### 7.2 `GET /packages` —— 实时目录

菜单请始终从这里构建——**不要在代码里写死价格**。

```json
{"success": true, "data": [
  {
    "code": "FULL_100M",
    "group": "full",
    "name": "Full GPT + Claude 100M tokens · 3D",
    "quota_tokens": 100000000,
    "duration_seconds": 259200,
    "retail_price_vnd": 80000,
    "reseller_price_vnd": 72000,
    "discount_bps": 1000,
    "models": ["claude-opus-5", "gpt-6-sol", "..."],
    "preset_quantities": [1, 2, 3, 5, 10],
    "custom_quantity": true,
    "min_quantity": 1,
    "max_quantity": 10000,
    "remaining_today": 0,
    "unlimited": true
  }
]}
```

- `unlimited: true` = 不限库存（`remaining_today` 返回 `0`）；`remaining_today` 仅对每日限量套餐有意义。
- `models` 是该套餐精确的可用模型列表——直接展示，不要手写。

### 7.3 `POST /orders` —— 下单（核心端点）

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/orders \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: bot-order-849138" \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -H "User-Agent: MyBot/1.0" \
  --data '{"external_order_id":"BOT-A-ORDER-849138","package_code":"FULL_100M","quantity":2}'
```

**请求体：**

| 字段 | 必填 | 含义 |
|---|---|---|
| `external_order_id` | ✅ | 您系统的订单号——**唯一**，用于查询 |
| `package_code` | ✅ | 来自 `GET /packages`（如 `FULL_100M`） |
| `quantity` | — | 数量 `1`–`10000`，留空/`0` 默认 `1` |

**`200` 且 `status=fulfilled` 的响应：**

```json
{"success": true, "data": {
  "order_code": "MO-...",
  "external_order_id": "BOT-A-ORDER-849138",
  "package_code": "FULL_100M",
  "quantity": 2,
  "quota_tokens": 200000000,
  "duration_seconds": 259200,
  "unit_price_vnd": 72000,
  "amount_vnd": 144000,
  "balance_before": 1000000,
  "balance_after": 856000,
  "redeem_code": "MR-CODE-1",
  "redeem_codes": ["MR-CODE-1", "MR-CODE-2"],
  "status": "fulfilled"
}}
```

- ⚠️ **`redeem_codes`（复数）才是完整列表** —— `quantity=N` 返回 N 个独立码，每个码一份套餐配额。`redeem_code`（单数）仅为**第一个码**，保留是为了兼容。`quantity > 1` 时必须交付**全部 `redeem_codes`**，不能只读单数字段。
- `quantity` 会放大配额与金额，但**不会**放大有效期（每个码仍是套餐原有效期）。
- 未兑换的码自发放起 **30 天**有效；套餐有效期从客户**兑换时**才开始计算。
- 兼容旧服务器可用 `data.redeem_codes ?? [data.redeem_code]`；不要从历史订单的 `quantity` 推断码数。

### 7.4 `GET /orders/{external_order_id}` —— 超时后查询

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/orders/BOT-A-ORDER-849138 \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY"
```

返回已存储的订单（含相同顺序的 `redeem_codes`）——`POST /orders` 超时后的恢复途径。

### 7.5 `POST /redeem-codes` —— 快速购买单码

```bash
curl -sS https://api.miraiapi.com/api/reseller/v1/redeem-codes \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: rc-849138" \
  -H "Content-Type: application/json" \
  --data '{"package_code":"GPT_50M"}'
```

```json
{"success": true, "data": {"redeem_code": "MR-...", "package_code": "GPT_50M"}}
```

等价于 `quantity=1` 的 `POST /orders`（同样扣钱包）。多数机器人只需用 `/orders`。

### 7.6 公共端点 —— 兑换与查询

**预览兑换码（不消耗）：**

```bash
curl -sS "https://api.miraiapi.com/api/redeem/preview?code=MR-XXXX"
# → {code_prefix, status, package_code, package_name, quota_tokens, duration_seconds, expires_at}
```

**兑换 → 新 API key**（您或客户都可调用）：

```bash
curl -sS https://api.miraiapi.com/api/redeem/new \
  -X POST -H "Content-Type: application/json" \
  --data '{"redeem_code":"MR-XXXX"}'
# → {"api_key":"sk-...","quota_tokens":50000000,"expires_at":...,"recovered":false}
```

**续费 —— 给同组旧 key 加配额**（GPT 码只能充 GPT key，依此类推）：

```bash
curl -sS https://api.miraiapi.com/api/redeem/renew \
  -X POST -H "Content-Type: application/json" \
  --data '{"redeem_code":"MR-YYYY","api_key":"sk-..."}'
# → {api_key（掩码）, quota_before, quota_after, expires_at}
```

**查询 `sk-` key 用量：**

```bash
curl -sS https://api.miraiapi.com/api/usage/check \
  -X POST -H "Content-Type: application/json" \
  --data '{"api_key":"sk-..."}'
# → {quota_total, quota_remaining, requests_24h, error_rate_24h, success_rate_24h, expires_at}
```

### 7.7 终端客户如何使用 `sk-...`

```bash
curl -sS https://api.miraiapi.com/v1/chat/completions \
  -H "Authorization: Bearer sk-客户key" \
  -H "Content-Type: application/json" \
  --data '{"model":"claude-sonnet-5","messages":[{"role":"user","content":"hi"}]}'
```

OpenAI 兼容客户端的 Base URL：`https://api.miraiapi.com/v1` · 手动查询页：https://miraiapi.com/usage/

---

<a id="zh-8"></a>
## 8. 套餐价格与购买数量

**批发价 = 零售价 ×（1 − 等级折扣）**：白银 5% / 黄金 7% / 钻石 10%，按上月 `POST /orders` 已完成销售额（越南时间）计算。下表为**钻石（9 折）**示例价。客户售价由您自定——Mirai 只收批发价。

| 分组 | `package_code` | 配额 | 有效期 | 零售价 | **您的批发价（钻石 9 折）** |
|---|---|---:|---|---:|---:|
| 🚀 GPT | `GPT_10M` | 10M token | 1 天 | 7,000đ | **6,300đ** |
| 🚀 GPT | `GPT_50M` | 50M token | 2 天 | 35,000đ | **31,500đ** |
| 🚀 GPT | `GPT_100M` | 100M token | 3 天 | 70,000đ | **63,000đ** |
| 🚀 GPT | `GPT_500M` | 500M token | 6 天 | 325,000đ | **292,500đ** |
| 🤖 Claude | `CLAUDE_10M` | 10M token | 1 天 | 7,500đ | **6,750đ** |
| 🤖 Claude | `CLAUDE_50M` | 50M token | 2 天 | 37,500đ | **33,750đ** |
| 🤖 Claude | `CLAUDE_100M` | 100M token | 3 天 | 75,000đ | **67,500đ** |
| 🤖 Claude | `CLAUDE_500M` | 500M token | 6 天 | 350,000đ | **315,000đ** |
| 💎 Full (GPT+Claude) | `FULL_10M` | 10M token | 1 天 | 8,000đ | **7,200đ** |
| 💎 Full | `FULL_50M` | 50M token | 2 天 | 40,000đ | **36,000đ** |
| 💎 Full | `FULL_100M` | 100M token | 3 天 | 80,000đ | **72,000đ** |
| 💎 Full | `FULL_500M` | 500M token | 6 天 | 375,000đ | **337,500đ** |
| 🇨🇳 中国模型 | `TAU_50M` | 50M token | 2 天 | 20,000đ | **18,000đ** |
| 🇨🇳 中国模型 | `TAU_100M` | 100M token | 4 天 | 40,000đ | **36,000đ** |
| 🇨🇳 中国模型 | `TAU_500M` | 500M token | 7 天 | 190,000đ | **171,000đ** |

**各分组包含的模型**（以 `GET /packages` 的 `models` 字段为准，以下供参考）：

- **GPT**：`gpt-5.6-luna`、`gpt-5.6-terra`、`gpt-5.6-sol`、`gpt-6-astra`、`gpt-6-sol`、`gpt-6.1-sol`、`swe-2`
- **Claude**：`claude-opus-4.6/4.7/4.8`、`claude-sonnet-5`、`claude-opus-5`、`claude-fable-5`、`claude-fable-5.1`、`ccmax-claude-opus-5.5`、`claude-opus-5.5`、`claude-sonnet-5.5`、`swe-2`
- **Full**：全部 GPT + Claude 模型 + `gemini-4-argon` + `swe-2`（不含中国模型线）
- **中国模型（TAU）**：`kimi-k3`、`qwen3.8-max`、`hy3`、`deepseek-v4-pro`、`deepseek-v4-flash`、`deepseek-v4.1-flash`、`glm-5.3-flash`

**数量（`quantity`）：**

- 机器人常用预设：`1, 2, 3, 5, 10`；自定义允许 `1`–`10000`。
- `quantity=N` → 扣除 `批发价 × N` → 返回 **N 个独立兑换码**。
- 全部套餐**不限库存**。

---

<a id="zh-9"></a>
## 9. 推荐的销售流程

```text
客户在您的机器人 /start
  → 后端调用 GET /packages（可缓存 5–15 分钟）
  → 展示分组菜单：GPT / Claude / Full / 中国模型
  → 客户选套餐 + 数量（预设或自定义）
  → 您的机器人按您自定价格收款
  → 后端生成 external_order_id + Idempotency-Key 并保存
  → POST /orders
      ├── 200 + status=fulfilled → 将全部 redeem_codes 交付客户 ✅
      ├── timeout/5xx → 用相同 key+payload 重试，或 GET /orders/{id}
      └── 4xx → 读 message 修请求，切勿盲目重试
客户在 POST /api/redeem/new（或 usage 页面）兑换
  → 获得 sk-key → 在 https://api.miraiapi.com/v1 使用
```

---

<a id="zh-10"></a>
## 10. 重试与幂等 — 绝不重复扣款

- 每个订单**必须**有两个唯一值：`external_order_id`（您的订单号）+ `Idempotency-Key`（header）。
- 服务器记住这对组合。**相同 key + 相同 payload** 重试 → 返回原订单与原码——**不会二次扣款**。
- 相同 `Idempotency-Key` 但 **payload 不同** → `409 idempotency payload mismatch`。
- 超时 → **不要生成新单号**：原样重试 `POST /orders`，或 `GET /orders/{external_order_id}`。
- `429` → 等几秒（遵循 `Retry-After`）后用同一 key 重试。

---

<a id="zh-11"></a>
## 11. 限流与错误码

**限流：** 每个凭证 50 次/分钟。第二个凭证有独立桶。

| HTTP | 含义 | 处理 |
|---:|---|---|
| `200` | 成功 | 存订单 + 交付 `redeem_codes` |
| `400` | JSON/字段错误或缺 `Idempotency-Key` | 修请求，勿盲目重试 |
| `401` | 凭证缺失/错误/已撤销 | 在机器人里检查 Bearer key |
| `403` | 凭证缺 `redeem:write` scope | 联系管理员 `@mirai_api` |
| `404` | 经销商/钱包/订单不存在 | 检查 URL 与 `external_order_id` |
| `409` | 余额不足/套餐无效/幂等冲突 | 读 `message`；不要造新单 |
| `429` | 超过 50 次/分钟 | 退避几秒后以相同 key 重试 |
| `5xx`/超时 | 临时错误 | 相同 key 重试或 GET 订单 |

---

<a id="zh-12"></a>
## 12. 安全检查清单

- ✅ 仅从**您的后端服务器**调用 API —— 不要前端、Mini App 或移动应用。
- ✅ 密钥放 env/密钥管理 —— **不要提交 Git**，不要发到聊天里。
- ✅ 不要记录 `Authorization` 或完整兑换码。
- ✅ 每个客户/订单一个独立 `external_order_id`。
- ✅ 仅在 `status=fulfilled` 时发码 —— 且只发给**对应客户**（码 = 钱）。
- ✅ 怀疑泄露 → 立即在机器人里**撤销**并轮换。

---

<a id="zh-13"></a>
## 13. 完整代码示例

### cURL —— 购买 3 份 `GPT_50M`

```bash
export MIRAI_RESELLER_API_KEY="MR-您的key"

curl -sS https://api.miraiapi.com/api/reseller/v1/orders \
  -X POST \
  -H "Authorization: Bearer $MIRAI_RESELLER_API_KEY" \
  -H "Idempotency-Key: order-$(date +%s)" \
  -H "Content-Type: application/json" -H "User-Agent: MyBot/1.0" \
  --data '{"external_order_id":"BOT-ORDER-'"$(date +%s)"'","package_code":"GPT_50M","quantity":3}'
```

### Python —— 最小流程（仅标准库）

```python
import json, os, uuid, urllib.request

BASE = "https://api.miraiapi.com/api/reseller/v1"
KEY = os.environ["MIRAI_RESELLER_API_KEY"]

def call(method, path, body=None, idem=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
    )
    req.add_header("Authorization", f"Bearer {KEY}")
    req.add_header("Accept", "application/json")
    req.add_header("User-Agent", "MyBot/1.0")
    if body is not None:
        req.add_header("Content-Type", "application/json")
    if idem:
        req.add_header("Idempotency-Key", idem)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)

# 1. 余额 + 目录
print(call("GET", "/balance"))
packages = call("GET", "/packages")["data"]

# 2. 购买 2 份 FULL_100M —— 幂等，可安全重试
idem = "order-" + uuid.uuid4().hex[:16]
ext = "BOT-ORDER-" + uuid.uuid4().hex[:12]
order = call("POST", "/orders",
             {"external_order_id": ext, "package_code": "FULL_100M", "quantity": 2},
             idem=idem)

# 3. 交付兑换码给客户
if order["success"] and order["data"]["status"] == "fulfilled":
    for code in order["data"]["redeem_codes"]:   # 始终用 redeem_codes（复数）
        send_to_customer(code)
```

---

<a id="zh-14"></a>
## 14. 常见问题（FAQ）

**我不会编程，能做经销商吗？**
注册、创建密钥、充值在机器人里都能完成，无需代码。但*自动销售*需要一个调用 API 的后端——把本文件交给您的开发者即可，它就是完整规格说明。

**密钥丢了怎么办？**
🤝 经销商 → 🔑 创建 API 密钥（旧密钥立即失效）。密钥只显示一次，请妥善保存。

**客户在哪里兑换码？**
您的机器人可自行调用 `POST /api/redeem/new` 拿 `sk-` key 交付客户；或让客户去 https://miraiapi.com/usage/ 手动兑换。

**一个兑换码能用几次？**
恰好一次。未兑换的码 30 天内有效，过期作废。

**`quantity=5` 返回几个码？**
`redeem_codes` 里 5 个独立码，每码一份套餐配额 + 有效期。

**在哪里充值？**
机器人内：💰 我的钱包 → 💳 充值。同一钱包同时支付零售购买和 API 订单。

**看不懂英文报错？**
查第 11 节错误码表；响应中的 `message` 总是写明原因。

**需要支持？**
Telegram：`@mirai_api`（机器人内：💬 客服 → 联系管理员）。

---

> 📌 **提示**：本文件同时是代码仓库中 `mirai/bot/` 包的 README，也是机器人"📚 API 指南"里可下载的同一份文档。价格/模型以 `GET /packages` 实时返回为准。
