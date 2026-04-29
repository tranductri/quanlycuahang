# Plan: Bảo vệ Data Layer — Verify Google ID Token trong Worker

## Vấn đề hiện tại
- Worker URL có trong `index.html` (public source)
- Worker không xác thực request — ai biết URL đều có thể POST dữ liệu giả vào sheet
- Auth hiện tại chỉ bảo vệ UI, không bảo vệ data layer

## Giải pháp chọn: Cách 2 — Verify token trong Cloudflare Worker

### Flow sau khi implement
```
Browser → Worker (Authorization: Bearer <id_token>) → Worker gọi tokeninfo → nếu hợp lệ → GAS
                                                      → nếu không hợp lệ → 401
```

### Các bước implement

**1. Frontend — lưu raw id_token khi login**

Trong `handleAuthSuccess`, lưu thêm `credential` vào `ca_auth`:
```js
const user = { email: info.email, name: info.name, picture: info.picture, token: credentialResponse.credential };
```

**2. Frontend — helper kiểm tra token expiry**

JWT có trường `exp` trong payload (base64 decoded). Kiểm tra trước mỗi request:
```js
function getValidToken() {
  try {
    const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
    if (!auth?.token) return null;
    const payload = JSON.parse(atob(auth.token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null; // hết hạn
    return auth.token;
  } catch { return null; }
}
```

Nếu `getValidToken()` trả về null → clear auth, show login screen.

**3. Frontend — gửi token trong mọi request**

Thêm header `Authorization: Bearer <token>` vào `fetchAllProducts`, `fetchLastShift`, `handleSubmit`.

**4. Cloudflare Worker — verify token trước khi forward**

```js
async function verifyToken(token) {
  const res  = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + token);
  const info = await res.json();
  return info.email && info.aud === GIS_CLIENT_ID ? info.email : null;
}

// Trong fetch handler:
const token = request.headers.get('Authorization')?.replace('Bearer ', '');
if (!token) return new Response('Unauthorized', { status: 401, headers: CORS });
const email = await verifyToken(token);
if (!email) return new Response('Unauthorized', { status: 401, headers: CORS });
// forward to GAS...
```

**5. Frontend — xử lý 401 response**

Nếu Worker trả về 401 → logout + redirect về login.

### Lưu ý khi implement
- Google ID token hết hạn sau **1 giờ** — user sẽ cần login lại mỗi giờ nếu dùng liên tục
- `verifyToken` trong Worker thêm ~100-200ms mỗi request (1 roundtrip đến Google)
- Có thể optimize bằng cách verify JWT signature locally (dùng Google public keys + Web Crypto API) thay vì gọi tokeninfo — phức tạp hơn nhưng nhanh hơn
- `aud` phải khớp với `GIS_CLIENT_ID` để tránh token từ app khác

### Files cần thay đổi
- `index.html` — lưu token, helper expiry, thêm header vào fetch calls, xử lý 401
- `docs/cloudflare-worker.js` + re-deploy Worker trên dashboard
