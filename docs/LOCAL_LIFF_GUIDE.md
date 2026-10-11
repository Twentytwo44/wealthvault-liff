# WealthVault LIFF: คู่มือทดสอบกับ backend ในเครื่อง

คู่มือนี้ใช้สำหรับ **development/test เท่านั้น**: backend ใน Docker, Next.js บนเครื่องพอร์ต 3311, และ HTTPS tunnel สำหรับเปิดใน LINE. ห้ามใช้ฐานข้อมูลหรือ Supabase ของ production. อย่านำไฟล์ `.env*`, LINE token, Supabase key, JWT secret หรือ URL ที่มี token ไป commit/แชร์.

## 0. สิ่งที่ต้องเตรียม

- Docker Desktop ทำงานอยู่ (`docker info` ต้องสำเร็จ), Node.js 22+, pnpm 11, ngrok และแอป LINE บนโทรศัพท์.
- LINE Developers account ที่สร้าง **LINE Login channel สำหรับทดสอบ** และ LIFF app ได้.
- Supabase project **แยกจาก production** พร้อม storage bucket ทดสอบ. ตรวจ project URL และ bucket ก่อนเริ่ม Docker; local volume `postgres_liff_local_data` แยกจาก volume เดิมและคำสั่งในคู่มือนี้จะไม่ลบ volume.
- เปิด terminal สองหน้าต่าง (Next.js และ ngrok). Backend ไม่จำเป็นต้องเปิด public port; tunnel ชี้ไป Next.js เท่านั้น.

> บนเครื่องนี้เปิด Docker Desktop ได้ด้วย `open '/Applications/Docker.app/Contents/MacOS/Docker Desktop.app'`. PostgreSQL, NATS, Redis และ Mailpit ถูกเปิดและตรวจ health ผ่านแล้ว. ถ้า `docker compose` ค้างตอน pull เพราะ credential helper ให้ใช้ workaround ในหัวข้อแก้ปัญหาด้านล่าง; ไม่ต้องแก้ config Docker ส่วนตัว.

## 1. ตั้งค่า backend แบบ test-only

ไปที่ `/Users/natchapon/Documents/Wealth-Vault`. ไฟล์ `.env` และ `.env` รายบริการเป็น local และถูก ignore โดย Git. ตรวจ **ชื่อ key และปลายทาง** เองโดยไม่พิมพ์ค่า secret ใน issue/chat:

| ไฟล์ | รายการที่ต้องยืนยัน |
| --- | --- |
| `.env` | `USER_PORT`, `AUTH_PORT`, `ASSET_PORT`, `NOTI_PORT`, `APP_PORT`, ชื่อฐานข้อมูลที่แยกกัน, NATS host/port |
| `services/auth-service/.auth.env` | เพิ่ม `LINE_CHANNEL_ID` ของ LINE Login channel ทดสอบ; ตั้ง `JWT_SECRET` สำหรับ local; DB ต้องชี้ PostgreSQL local |
| `services/user-service/.user.env`, `services/asset-service/.asset.env`, `api-gateway/.env` | `SUPABASE_URL`, `SUPABASE_KEY`, `BUCKET_NAME` ต้องเป็น **project/bucket ทดสอบ**; DB และ service host ต้องชี้ Docker local |
| `services/notification-service/.noti.env` | DB/NATS/auth host ชี้ Docker local; ไม่ต้องมี FCM/LINE push ที่ใช้งานได้ เพราะ `APP_ENV=local` ข้ามการส่งจริง |

Compose กำหนด `USER_HOST`/`USER_PORT` ให้ auth และ asset ถูกต้องแทนชื่อ `User_HOST`/`User_PORT` เก่า; SMTP สำหรับ local ชี้ Mailpit. หากรัน service นอก Compose ให้เปลี่ยนชื่อ key ในไฟล์ local ตาม config ด้วย. Compose เปิด PostgreSQL/NATS/Redis/Mailpit/gateway เฉพาะ `127.0.0.1`; ไม่เปิด backend ผ่าน ngrok.

**หยุดก่อน `up` หากยังไม่ยืนยัน Supabase:** ไฟล์ env ที่มีอยู่เดิมอาจชี้ project จริง. รอบตรวจบนเครื่องนี้ใช้ค่า storage ที่ใช้ไม่ได้ในไฟล์ override ชั่วคราว เพื่อทดสอบบริการโดยไม่แตะ Supabase; จึงยังไม่ถือว่าอัปโหลดไฟล์ผ่าน. เมื่อมี test project/bucket แล้วจึงใส่ค่าจริงใน local env และทดสอบไฟล์.

```sh
cd /Users/natchapon/Documents/Wealth-Vault
docker info
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

รอให้ PostgreSQL, NATS, Redis และบริการ Go แสดง `healthy`; gateway จะเริ่มหลังบริการ Go พร้อม. ตรวจแบบไม่ใช้ข้อมูลจริง:

```sh
curl -fsS http://127.0.0.1:8080/api/health
curl -fsS http://127.0.0.1:8222/healthz
```

Mailpit UI อยู่ที่ `http://127.0.0.1:8025`. ถ้าบริการไม่พร้อม ให้ดู `docker compose ps` และ `docker compose logs --tail=80 <service-name>`; **อย่าส่ง log ที่อาจมีข้อมูลส่วนตัวหรือ secret โดยไม่ตรวจ/redact ก่อน**. หยุดโดยไม่ลบข้อมูล:

```sh
docker compose stop
```

ถ้าต้องนำ container ออกแต่เก็บ volume ใช้ `docker compose down` (ไม่มี `-v`). อย่าใช้ `down -v` กับข้อมูลที่ต้องการเก็บ.

## 1.5 ทดสอบเว็บกับ backend จริงโดยไม่ใช้ LINE

ใช้เฉพาะเครื่องตัวเองและบัญชี **PostgreSQL local**. ไฟล์ `apps/liff-web/.env.local` (ถูก Git ignore) สำหรับรอบนี้ตั้ง `APP_ORIGIN=http://localhost:3311`, `WEALTHVAULT_BACKEND_URL=http://127.0.0.1:8080/api/`, `REDIS_URL=redis://127.0.0.1:6379`, `ALLOW_LOCAL_HTTP_BACKEND=true`, `NEXT_PUBLIC_LOCAL_PREVIEW=false`, `NEXT_PUBLIC_LOCAL_TEST_LOGIN=true` และ `ALLOW_LOCAL_TEST_LOGIN=true` แล้ว ไม่ต้องใส่ LIFF ID. ทางเข้าทดสอบนี้ยังตรวจอีเมล/รหัสผ่านกับ backend จริง, เก็บ session ใน Redis และรับคำขอจาก `localhost` เท่านั้น; ไม่ใช้ ngrok.

รัน `pnpm --filter @wealthvault/liff-web exec next dev -H localhost -p 3311` เพื่อให้ server ฟังเฉพาะเครื่องนี้ แล้วเปิด `http://localhost:3311/` ด้วยบัญชีทดสอบที่สร้างด้วย `POST /api/auth/register` ในขั้น 5. ตรวจ `http://localhost:3311/api/health/ready` ต้องตอบ `{"status":"ready"}`; หลังล็อกอินให้ลอง dashboard, พอร์ต, เพื่อน/กลุ่ม, notification และออกจากระบบ. การ์ดต้อง **ไม่** แสดงข้อความ “โหมดตัวอย่างในเครื่อง”. หากเคยเปิด dev server ในโหมด preview ต้องหยุดและเปิดใหม่หลังตั้งค่า env. รอบนี้ตรวจผ่าน frontend proxy แล้วทั้ง dashboard, cash CRUD, เพื่อน, กลุ่ม, notification, profile และ logout; ไฟล์ยังต้องรอ Supabase test bucket.

ก่อนกลับไปทดสอบ LINE ให้ตั้ง `NEXT_PUBLIC_LOCAL_TEST_LOGIN=false` และ `ALLOW_LOCAL_TEST_LOGIN=false`, ใส่ LIFF/Channel ID และเปลี่ยน `APP_ORIGIN` เป็น HTTPS ngrok origin จากขั้น 2–4 แล้ว restart Next. ห้ามเปิดทางเข้าทดสอบ local นี้ผ่าน tunnel.

## 2. สร้าง LINE Login channel และ LIFF app

1. ใน [LINE Developers Console](https://developers.line.biz/console/) สร้าง provider และ **LINE Login channel ใหม่สำหรับทดสอบ**. จด Channel ID (ไม่ใช่ Channel secret) เพื่อใส่ทั้ง `LINE_CHANNEL_ID` ของ auth service และ `WEALTHVAULT_LIFF_CHANNEL_ID` ของ Next.js. ห้ามใช้ channel production.
2. ในแท็บ LIFF ของ channel เพิ่ม LIFF app, ขนาด `Full` และ Endpoint URL ชั่วคราวเป็น HTTPS ngrok URL จากขั้น 4 เช่น `https://<your-tunnel>.ngrok-free.app/`.
3. เลือก scope `openid` (จำเป็นต่อ `liff.getIDToken()`); `profile` เพิ่มได้. Scope `email` เป็นตัวเลือกและ LINE อาจกำหนดการขอสิทธิ์เพิ่ม; ระบบยังให้ผู้ใช้กรอกอีเมลเองได้.
4. จด LIFF ID เช่น `1234567890-xxxx` เพื่อใส่ `NEXT_PUBLIC_LIFF_ID`. ทดสอบด้วย LIFF URL `https://liff.line.me/<LIFF_ID>` ในแอป LINE. ไม่ต้องส่ง LINE profile จาก browser ไปเป็นหลักฐานล็อกอิน—server ตรวจ raw ID token กับ LINE.

LINE กำหนด [Endpoint URL เป็น HTTPS และ `openid` สำหรับ ID token](https://developers.line.biz/en/docs/liff/registering-liff-apps/) และแนะนำให้ [ส่ง token ไปตรวจฝั่ง server](https://developers.line.biz/en/docs/liff/using-user-profile/). Backend ใช้ [Verify ID token API](https://developers.line.biz/en/reference/line-login/) กับ Channel ID ที่ตั้งค่าใน server.

## 3. ตั้งค่า Next.js/Redis local

เมื่อต้องทดสอบ LINE ให้ **แก้ไฟล์เดิม** `/Users/natchapon/Documents/wealthvault-line-liff/apps/liff-web/.env.local` โดยไม่ทับค่าที่เตรียมไว้ (Next.js อ่าน `.env.local` จาก **app directory**):

| Key | ค่าที่ใช้ใน local |
| --- | --- |
| `NEXT_PUBLIC_LIFF_ID` | LIFF ID ของ app ทดสอบ |
| `NEXT_PUBLIC_LOCAL_PREVIEW` | `false` เพื่อทดสอบข้อมูลจริง |
| `NEXT_PUBLIC_LOCAL_TEST_LOGIN`, `ALLOW_LOCAL_TEST_LOGIN` | `false` ทั้งคู่เมื่อเปิดผ่าน LINE/ngrok |
| `APP_ORIGIN` | HTTPS origin ของ ngrok ปัจจุบัน **ไม่มี path** เช่น `https://<your-tunnel>.ngrok-free.app` |
| `WEALTHVAULT_LIFF_CHANNEL_ID` | Channel ID เดียวกับ auth service |
| `WEALTHVAULT_BACKEND_URL` | `http://127.0.0.1:8080/api/` |
| `ALLOW_LOCAL_HTTP_BACKEND` | `true` เฉพาะ `pnpm dev`; production ยังคงบังคับ HTTPS |
| `REDIS_URL` | `redis://127.0.0.1:6379` |
| `SESSION_IDLE_TTL_SECONDS`, `SESSION_ABSOLUTE_TTL_SECONDS` | ใช้ค่าตัวอย่างเดิมได้ |

```sh
cd /Users/natchapon/Documents/wealthvault-line-liff
# ทำเฉพาะเมื่อยังไม่มีไฟล์ .env.local
cp -n .env.example apps/liff-web/.env.local
pnpm install
pnpm --filter @wealthvault/liff-web exec next dev -p 3311
```

แก้ค่าจริงใน `.env.local` ด้วย editor ส่วนตัวก่อนเริ่ม Next. ถ้า Next กำลังรันที่ 3311 อยู่แล้ว ต้อง **หยุดและเปิดใหม่** หลังแก้ env. ตรวจ `http://127.0.0.1:3311/api/health/ready`: ควรได้ `{"status":"ready"}` เมื่อ env, Redis และ backend พร้อม. `GET /api/health/live` ตรวจเพียง process.

## 4. เปิด HTTPS tunnel และตั้ง Endpoint URL

อีก terminal:

```sh
ngrok http 3311
```

นำ HTTPS URL ที่ ngrok แสดงไปใส่ `APP_ORIGIN` (เฉพาะ origin) และตั้งเป็น Endpoint URL ของ LIFF app ใน LINE Developers Console. จากนั้น restart Next. เมื่อ ngrok URL เปลี่ยน ให้แก้ **ทั้งสองจุด** แล้ว restart Next ทุกครั้ง. เปิด `https://liff.line.me/<LIFF_ID>` จากแอป LINE บนโทรศัพท์; ไม่ใช้ `http://localhost:3311` หรือหน้า preview เป็นหลักฐานว่าล็อกอินจริง.

## 5. บัญชีทดสอบและ expected results

- ผู้ใช้ใหม่: เปิด LIFF ใน LINE → กรอกอีเมลทดสอบ, username และรหัสผ่าน (อย่างน้อย 8 ตัว) → เห็น dashboard; เปิดอีกครั้งต้องกลับเข้า session ได้. หากมีอีเมลเดิม ระบบจะสลับไปยืนยันบัญชีเดิม.
- ผู้ใช้เดิม: สร้างบัญชี local ด้วย `POST http://127.0.0.1:8080/api/auth/register` และ JSON `{"email":"<test-email>","password":"<test-password>"}` (ใช้เฉพาะข้อมูลทดสอบ) → เปิด LIFF → เลือกเชื่อมบัญชีเดิม → ใส่รหัสผ่าน → เห็นข้อมูลเดิม. อย่าใช้บัญชีจริง.
- Logout: กดออกจากระบบแล้ว session cookie ถูกลบและ refresh session ถูก revoke. เปิด LIFF ใหม่จะแลก ID token อีกครั้ง.
- Dashboard/CRUD: เพิ่ม แก้ไข ลบเงินสดและสินทรัพย์แต่ละประเภท; แนบรูป/PDF ขนาดเล็กไปยัง test bucket; โหลดหน้าใหม่แล้วข้อมูลยังอยู่. ไฟล์ multipart ใช้ช่อง `files`.
- Social: เพิ่มเพื่อน, ลองปฏิเสธ (`DECLINE`) แล้วตรวจว่าไม่กลายเป็นเพื่อน; เพิ่มกลุ่ม, แชร์สินทรัพย์ให้เพื่อน/กลุ่ม, ยกเลิกแชร์, อ่าน notification รายการเดียวและทั้งหมด.
- Refresh: ปล่อยไว้เกิน 15 นาทีแล้วเรียก API; หน้าเว็บควรต่อ session ได้โดยไม่ต้อง login ซ้ำ. คำขอพร้อมกันควรใช้การ refresh รอบเดียวต่อ session.

รันชุดตรวจโค้ด:

```sh
cd /Users/natchapon/Documents/Wealth-Vault/services/auth-service && go test ./...
cd /Users/natchapon/Documents/Wealth-Vault/api-gateway && go test ./...
cd /Users/natchapon/Documents/Wealth-Vault/services/user-service && go test ./...
cd /Users/natchapon/Documents/Wealth-Vault/services/notification-service && go test ./...
cd /Users/natchapon/Documents/wealthvault-line-liff && pnpm lint && pnpm typecheck && pnpm build
```

ผลตรวจล่าสุด (4 ต.ค. 2026): auth-service, api-gateway และ notification-service ผ่าน `go test ./...`; frontend ผ่าน lint, typecheck และ build. user-service ยังมี **test failures** ใน deleted-asset preview และ mock/SQL expectations ของ repository, group/share/chat; การแสดงสินทรัพย์ที่เพิ่งลบเป็น ghost หรือซ่อนทันทีต้องยืนยันพฤติกรรมที่ต้องการก่อนเปลี่ยนโค้ด. บริการ build และ local smoke test ใช้งานได้ แต่ยังถือว่าชุด Go test ทั้งหมดไม่ผ่าน. บัญชีทดสอบใน PostgreSQL local ทดสอบ login เดิม, dashboard, cash CRUD, เพื่อน, กลุ่ม, แชร์/ยกเลิกแชร์, notification และ refresh พร้อมกันแล้ว. หน้า Next ที่พอร์ต 3311 ตอบ `ready` ในโหมด local test และทดสอบ login, dashboard, cash CRUD, เพื่อน, กลุ่ม, notification, profile, logout ผ่าน BFF แล้ว; LINE Developers Console ยังต้องให้เจ้าของบัญชีล็อกอิน. ยังไม่ได้ทดสอบ LINE บนโทรศัพท์หรือไฟล์ใน Supabase test bucket.

## 6. เมื่อมีข้อผิดพลาด

| อาการ | ตรวจ |
| --- | --- |
| `Cannot connect to Docker daemon` | เปิด/ซ่อม Docker Desktop ก่อน; `docker info` ต้องผ่าน. อย่าแก้โดยชี้ Docker ไป production. |
| Docker ค้างตอน `Pulling` บนเครื่องนี้ | หลังตรวจว่า env ทุกบริการชี้ระบบทดสอบแล้ว ใช้ standalone Compose โดยไม่ใช้ credential helper: `DOCKER_HOST=unix:///Users/natchapon/.docker/run/docker.sock DOCKER_CONFIG=/private/tmp docker-compose up --build -d`. ค่านี้มีผลแค่คำสั่งนั้น ไม่แก้ `~/.docker/config.json`. หากยังไม่มี Supabase test project ให้เปิดเฉพาะ infra ด้วยคำสั่งเดียวกันแต่ต่อท้าย `postgres nats-server redis mailpit`; อย่ารัน stack เต็มกับ env ที่อาจชี้ production. |
| Gateway ยังไม่เริ่ม | `docker compose ps` ดู service ที่ไม่ `healthy`; ตรวจ PostgreSQL/NATS ก่อน และตรวจว่า `USER_PORT` ตรงกับ user-service. |
| `auth_not_configured` หรือไม่มี LIFF ID | ใส่ LIFF ID, Channel ID ทั้งสองฝั่ง แล้ว restart Next/auth service. |
| `line_verification_failed`, `liff.getIDToken()` ว่าง | ตรวจว่า LIFF อยู่ใน LINE Login channel เดียวกัน, เปิด `openid`, ใช้ LINE app และเปิดผ่าน LIFF URL. |
| `invalid_origin` / cross-origin error | `APP_ORIGIN` ต้องตรง HTTPS ngrok origin เป๊ะ; ตั้ง Endpoint URL ใหม่และ restart Next. |
| `session_unavailable` หรือ readiness 503 | Redis ต้อง `healthy`, `REDIS_URL` ต้องเป็น local, backend `/api/health` ต้องตอบ. |
| Upload ล้มเหลว | ตรวจ Supabase **test** project/bucket/key, ชนิด/ขนาดไฟล์, และอย่าใช้ production key. |
| อีเมลไม่มา | ดู Mailpit UI; local ไม่ส่งอีเมลออกจริง. รุ่นนี้ใช้รหัสผ่านสำหรับผูกบัญชี ไม่ใช้ OTP. |

## ขอบเขตที่ยังไม่ใช่ production-ready

ยังไม่มีการส่งแชทสดและยังไม่ได้วัด performance. ก่อน production ต้องแยก audit เรื่อง credentials ที่ฝังใน Compose, CORS, gateway request limit, สิทธิ์ WebSocket, migration ของข้อมูลเดิม และการทดสอบบนโทรศัพท์จริง. ห้ามนำ local Compose/HTTP override นี้ไป deploy ตรง ๆ.

## การแจ้งเตือนผ่าน LINE OA

หน้า **การแจ้งเตือน** มีสวิตช์ให้ผู้ใช้เปิดรับ LINE แยกจากการแจ้งเตือนในแอป ค่าเริ่มต้นคือปิด หลังเปิดแล้วระบบส่งเฉพาะคำขอเป็นเพื่อน การตอบรับเพื่อน คำเชิญกลุ่ม การแชร์ทรัพย์สิน และการเตือนประกัน พร้อมลิงก์กลับ LIFF โดยไม่ใส่ชื่อทรัพย์สินหรือยอดเงินในข้อความ LINE

- `services/notification-service/.noti.env` ต้องมี `CHANNEL_ACCESS_TOKEN` ของ LINE OA, `LINE_NOTIFICATIONS_ENABLED=true` และ `LINE_LIFF_URL=https://liff.line.me/<LIFF_ID>`; ห้ามใส่ token ในไฟล์ที่ commit หรือใน browser
- LINE Login channel ที่ใช้ LIFF กับ Messaging API channel ของ OA ต้องอยู่ภายใต้ **provider เดียวกัน** มิฉะนั้น LINE user ID อาจไม่ตรงกันและ push ไม่ถึงผู้รับ
- ผู้รับต้องเป็นเพื่อนกับ OA และต้องเปิดสวิตช์ใน WealthVault เอง การล็อกอิน LIFF อย่างเดียวไม่ถือเป็นการยินยอมรับ push
- ทดสอบด้วยบัญชี LINE ทดสอบสองบัญชี: บัญชี A ส่งคำขอเพื่อนหรือแชร์ทรัพย์สินให้ B; B เปิดสวิตช์และเป็นเพื่อนกับ OA จากนั้นควรเห็นทั้งรายการในแอปและข้อความในแชท OA. ถ้าไม่ถึง ให้ตรวจสถานะ response ของ notification service โดยไม่พิมพ์ token หรือ LINE user ID ใน log
- การส่ง LINE มี retry key และ retry ชั่วคราว แต่ NATS consumer ปัจจุบันยังไม่ใช่ durable outbox จึงยังไม่รับประกันการส่งทุกเหตุการณ์เมื่อ service หยุดกลางคัน
