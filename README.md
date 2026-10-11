# WealthVault LINE LIFF

Separate LIFF web client for WealthVault. The Kotlin Android/iOS applications and their backend are not modified by this repository.

## Implemented

- LINE in-app-browser entry, existing-account confirmation, new-account onboarding, secure server-side session cookie, and logout.
- Next.js backend-for-frontend (BFF) with a fixed route/method allowlist; browser code never receives backend access or refresh tokens.
- Redis-backed opaque sessions, idle and absolute expiry, refresh-token single-flight lock, request throttling, and readiness/liveness endpoints.
- Responsive Thai-language app shell for financial overview, assets and liabilities CRUD, profile, notifications, friend requests, groups, and explicit friend/group sharing.
- API payloads use `no-store`; no financial data is written to browser local/session storage or an offline cache.
- Container build, non-root runtime, security headers/CSP, GitHub Actions lint/typecheck/build gates.

The companion backend now includes the LINE exchange, password-based account linking, session revoke, and local Docker integration described in [BACKEND_CONTRACT.md](./BACKEND_CONTRACT.md). Live sign-in still requires a test LINE channel/LIFF ID and environment setup. Group message history is readable; live chat sending is not enabled until a cookie-authenticated WebSocket gateway is deployed. Performance targets are design goals, not yet measured or certified.

## Local setup

Requirements: Node.js 22 and pnpm 11.

1. Copy `.env.example` to `apps/liff-web/.env.local` and provide a LIFF ID, LINE channel ID, HTTPS backend URL, and Redis URL. Next.js reads local variables from the app directory.
2. Run `pnpm install`.
3. Run `pnpm dev`.

To preview the UI before LIFF credentials are available, run `NEXT_PUBLIC_LOCAL_PREVIEW=true pnpm dev`. This development-only mode opens a clearly labeled demo with in-memory sample data; it never calls LINE or the backend, and the bypass is disabled in production builds. Do not set this flag in a deployed environment.

To test against the **real local backend without LINE**, set `NEXT_PUBLIC_LOCAL_PREVIEW=false`, `NEXT_PUBLIC_LOCAL_TEST_LOGIN=true`, and `ALLOW_LOCAL_TEST_LOGIN=true` in `apps/liff-web/.env.local`, with `APP_ORIGIN=http://localhost:3311`, `WEALTHVAULT_BACKEND_URL=http://127.0.0.1:8080/api/`, `ALLOW_LOCAL_HTTP_BACKEND=true`, and local `REDIS_URL`. Restart with `pnpm --filter @wealthvault/liff-web exec next dev -H localhost -p 3311`, open `http://localhost:3311/`, and sign in with a disposable backend account. This password-based entry point only works in development on loopback; turn both local-test flags off before switching to LIFF/ngrok. See [the local guide](docs/LOCAL_LIFF_GUIDE.md).

LIFF must open in the LINE in-app browser. For local end-to-end login, use an HTTPS development tunnel and register that origin as the LIFF endpoint. In production, `APP_ORIGIN` must be the exact HTTPS origin.

For the full local Docker backend and LINE setup, follow [LOCAL_LIFF_GUIDE.md](./docs/LOCAL_LIFF_GUIDE.md).

To show a WealthVault introduction card with a tappable image and LIFF button when someone adds the LINE Official Account, see [LINE_OA_WELCOME.md](./docs/LINE_OA_WELCOME.md). The webhook and artwork are included in the frontend; publishing them requires the test OA's Messaging API credentials and webhook setting.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm build
```

`GET /api/health/live` only reports process liveness. `GET /api/health/ready` reports readiness after required environment is present and Redis responds.

## Deployment notes

- Build with `NEXT_PUBLIC_LIFF_ID` as a build argument; keep channel secrets, backend URL, and Redis credentials as runtime secrets.
- Use TLS Redis (`rediss://`) with a highly available shared deployment. App instances are stateless apart from Redis-backed sessions and can scale horizontally behind a CDN/WAF/load balancer.
- Configure the trusted ingress to overwrite `CF-Connecting-IP` or `X-Real-IP`; the app uses these only as rate-limit keys. Do not expose the app directly around the trusted ingress.
- Route `/api/health/live` to liveness and `/api/health/ready` to readiness probes. Give the load balancer enough idle timeout for the LIFF session and graceful shutdown during rolling deployments.
- The current BFF buffers bounded API bodies (1 MiB JSON, 8 MiB multipart) and responses (5 MiB). For larger documents, use backend-issued short-lived upload URLs instead of increasing these limits.
- Do not cache `/api/*` at the CDN. Static Next assets can be cached normally. Keep TLS at every public hop and enable WAF protections/rate controls at the edge.
- Run the web tier and any future realtime gateway independently. Do not infer 10,000-connection capacity from a successful build; run the load and soak gates listed in the backend contract before production rollout.

## Source map

- `apps/liff-web`: LIFF UI, BFF routes, session handling, deployment configuration.
- `packages/contracts`: runtime-validated authentication/session contracts.
- `BACKEND_CONTRACT.md`: existing endpoint inventory, required LINE/session integration, and production acceptance gates.
