# WealthVault LIFF — backend contract and rollout gates

This repository contains only the new LIFF web client/BFF. It intentionally does not change the Kotlin application or the backend. The existing production base URL found in the Kotlin app is `https://wealth.narutchai.com/api/`.

## New LINE identity and session endpoints

### `POST /v2/auth/line/exchange`

The LIFF browser sends its raw LINE ID token only to the same-origin BFF. The BFF sends it to this endpoint with the configured channel ID. The backend must verify the ID token with LINE (signature or official verification endpoint), including issuer, audience/channel, expiry, and subject. Never accept a browser-provided LINE profile as proof of identity.

Return exactly one outcome:

```json
{
  "status": "authenticated",
  "user": { "id": "user-id", "displayName": "Name" },
  "accessToken": "backend-access-token",
  "refreshToken": "backend-refresh-token",
  "accessTokenExpiresIn": 900
}
```

or a one-use, short-lived challenge:

```json
{ "status": "link_required", "challengeId": "opaque-one-use-challenge" }
```

```json
{ "status": "onboarding_required", "challengeId": "opaque-one-use-challenge" }
```

If the LINE subject matches an existing WealthVault identity, authenticate that identity. If only an email matches an existing account, return `link_required`; do not silently link by email. Store challenges server-side, bind them to the verified LINE subject/channel, expire them after at most five minutes, and accept them once.

### `POST /v2/auth/line/challenge/complete`

The LIFF BFF sends the challenge ID and one of these explicit actions:

- `link`: email plus existing password, or email plus a six-digit OTP.
- `register`: email, username, password, and optional first/last name.

The backend must verify the supplied credentials/OTP, atomically attach the verified LINE subject to the exact account, or create a new account attached to that subject. Enforce unique identity/email constraints inside the transaction. Return the same `authenticated` response as above; never return refresh credentials to the browser.

### Refresh and revoke

- Existing refresh endpoint: `POST /auth/refresh` with `{ "refreshtoken": "..." }`.
- Return rotated access and refresh tokens and add `access_token_expires_in` (seconds). Rotation must be atomic and tolerate concurrent refresh attempts without invalidating the session that won the rotation.
- Add `POST /v2/auth/session/revoke` with `{ "refreshToken": "..." }` for logout. Revoke the token family/session, not just the current access token.
- Return generic authentication failures; do not reveal whether an email exists. Keep short-lived rate limits for exchange, link, OTP, registration, and password recovery.

## Existing endpoints consumed by the BFF

The paths below are the app's current legacy API contract. Keep their request/response JSON or multipart field names compatible during migration; the BFF exposes only these routes and methods.

| Area | Paths and methods |
| --- | --- |
| Dashboard | `GET /dashboard` |
| Bank accounts | `GET/POST /asset/account/`; `GET/PATCH/DELETE /asset/account/{id}/` |
| Cash | `GET/POST /asset/cash`; `GET/PATCH/DELETE /asset/cash/{id}/` |
| Investments | `GET/POST /asset/invest`; `GET/PATCH/DELETE /asset/invest/{id}/` |
| Insurance | `GET/POST /asset/insurance/`; `GET/PATCH/DELETE /asset/insurance/{id}/` |
| Land | `GET/POST /asset/land/`; `GET/PATCH/DELETE /asset/land/{id}/` |
| Buildings | `GET/POST /asset/building/`; `GET/PATCH/DELETE /asset/building/{id}/` |
| Liabilities | `GET/POST /lia/`; `GET/PATCH/DELETE /lia/{id}` |
| Profile | `GET /user/`; `PATCH /user` (multipart); `GET/POST /closefriend` |
| Friends | `GET/POST /friend/`; `GET /friend/pending`; `POST /friend/accept`; `DELETE /friend/{id}`; `POST /user/search` |
| Friend data | `GET /friend/{id}/profile`; `GET /friend/{id}/msg/`; `GET /friend/{id}/item/`; `DELETE /friend/item/{id}/` |
| Groups | `GET/POST /group/`; `GET /group/detail/{id}`; `GET /group/member/{id}/`; `PATCH/DELETE /group/{id}/`; `POST /group/{id}/addmember`; `POST /group/{id}/grantaccess/`; `DELETE /group/{id}/removemember`; `DELETE /group/{id}/leave` |
| Group data | `GET /group/{id}/msg/`; `GET /group/{id}/item/`; `DELETE /group/item/{id}/` |
| Sharing | `GET /share/{friend\|group}/{id}/selection`; `POST /share/item/`; `GET /share/item/{type}/{id}/shared-targets` |
| Notifications | `GET /notifications/`; `PUT /notifications/{id}`; `PUT /notifications/read-all` |

For every endpoint, the backend remains responsible for user ownership, friend/group membership, object-level authorization, validation, and audit records. Never infer ownership from IDs posted by the web client. Preserve the existing multipart fields used by the Kotlin app, including `files`, `profile_image`, location fields, indexed share targets, and the legacy financial form fields.

## Backend work needed for production scale and full parity

1. **Bounded reads:** add cursor pagination, stable sorting, and filters for portfolio, notification, friends, groups, members, and chat history. Enforce a maximum page size and response size server-side.
2. **Mutation safety:** honor the `Idempotency-Key` forwarded by the BFF for creates/updates, validate request ownership, and use optimistic versioning or ETags where concurrent edits can overwrite financial data.
3. **Uploads:** validate file size, MIME signature, extension, and ownership. For documents above the BFF's 8 MiB request limit, issue short-lived scoped object-storage upload URLs and scan files asynchronously.
4. **Sharing:** the backend already supports `DELETE /group/item/{group_item_id}/`. The LIFF UI resolves the share record by matching `asset_detail.id` from `GET /group/{id}/item/` to the asset ID in the selection response; keep `group_item_id` and `asset_detail.id` present in that response. The selection endpoint may continue exposing `is_shared` without a share-record ID.
5. **Notifications:** publish from a transactional outbox/queue and deliver in-app plus LINE Official Account notifications without making portfolio writes wait on LINE API calls. Add retries, deduplication, and dead-letter handling.
6. **Realtime chat:** the Kotlin client connects to `wss://wealth.narutchai.com/api/ws` with an `Authorization: Bearer` header and sends `{"action":"JOIN","group_id":"…"}`. Browsers cannot safely attach the server-held bearer token. Deploy a same-origin WebSocket gateway at `/api/realtime` (or teach the backend to authenticate the opaque secure session cookie), validate Origin/session/group membership, connect upstream with the bearer header, enforce payload limits and heartbeats, and horizontally scale with shared pub/sub. If users can send text messages, define and authorize a `SEND` protocol; the current Kotlin contract only clearly defines `JOIN` and inbound messages.
7. **Operational controls:** maintain TLS-only API/WSS, rotate signing keys/secrets, expose readiness/metrics, set per-user and per-IP quotas, propagate trace IDs, and redact tokens, account numbers, file URLs, and personal data from logs.

## Required rollout and performance gates

These targets are not certified by this repository's build. Before enabling general access, test against a staging backend and production-like infrastructure:

- Load and soak: 10,000 concurrent signed-in sessions/connections, 1,000 API requests/second sustained, plus bursts and rolling restarts. Include refresh storms, reconnects, slow clients, Redis failover, and backend timeouts.
- Read API P95 below 300 ms at the target throughput; track P50/P95/P99, error rate, queue depth, event-loop lag, Redis latency, CPU, and memory by service.
- 99.9% availability objective with multi-zone app/Redis/backend dependencies, documented recovery, and alerts.
- Verify no private API response is cached at CDN; no access/refresh token or financial data is stored in browser persistence; logout/revocation and account linking survive parallel requests and replay attempts.
- Run real browser/LIFF smoke checks for login, account link, onboarding, portfolio CRUD, notifications, profile, friends, groups, sharing, and chat before each release.
