# Kanban — Runbook بررسی، راه‌اندازی و Provisioning

## هدف

این Runbook مرجع عملیاتی برای بررسی و راه‌اندازی پروژه Kanban روی Termux/Android و ادامه کار برای ساخت Board پروژه Yasin Chess است.

دامنه این سند فقط دو پروژه است:
- kanban
- yasin-chess

هیچ وابستگی معماری یا کاری به Yasin-Agent، YasinHub، YasinRelay، YasinPress، OpenFeed، Vercel یا پروژه‌های دیگر در این Runbook تعریف نشده است.

## وضعیت فعلی

### Kanban
- Repository: yusi20006-max/kanban
- Local path: ~/yasineco/kanban
- Branch: main
- HEAD هنگام بررسی: 9e7da60
- Release tag: v1.0.0
- Release commit: chore(release): prepare v1.0.0 (#158)
- Remote: https://github.com/yusi20006-max/kanban.git

### Yasin Chess
- Repository: yusi20006-max/yasin-chess
- Board موردنظر: Yasin Chess
- GitHub tracking issue در Kanban: #159 — Integration — Provision Yasin Chess as first Kanban-managed project

### وضعیت Board
تا پایان این بررسی، Board واقعاً در دیتابیس ساخته نشده است.

هدف نهایی Board:
1. Backlog
2. Ready
3. In Progress
4. Testing
5. PR
6. CI
7. Review
8. Verify
9. Done
10. Blocked

در این مرحله هیچ Card، Issue یا PR جدیدی برای Board ایجاد نمی‌شود.

## اصل مهم معماری

ساخت Board یک مسئولیت Kanban است، نه yasin-chess.

برای ساخت Board:
- نیازی به تغییر کد yasin-chess نیست.
- نیازی نیست برای خود پروژه یک Issue جداگانه فقط به‌خاطر ساخت Board وجود داشته باشد.
- Issue #159 صرفاً کار provisioning/integration را track می‌کند.
- زیرساخت Kanban از ابتدا برای چند Board و ستون‌های سفارشی طراحی شده است.

GitHub همچنان Source of Truth برای Repository / Issue / PR / CI است و Kanban metadata و workflow state را مدیریت می‌کند.

## مسیرهای مهم Kanban

### Domain
فایل: src/lib/kanban-domain.ts

توابع مهم:
- createBoard(userId, data)
- listBoards(userId)
- listBoard(userId, boardId)
- updateBoard(...)
- archiveBoard(...)
- upsertColumn(userId, data)

### API
فایل: src/lib/kanban-api.ts

توابع Server Function مهم:
- createBoardFn
- updateBoardFn
- archiveBoardFn
- upsertColumnFn

ساختار فعلی createBoardFn و upsertColumnFn از createServerFn، authMiddleware، validator و handler استفاده می‌کند.

### Authentication
فایل: src/lib/auth/middleware.ts

Server Functions از authMiddleware استفاده می‌کنند.

فایل: src/lib/auth/verify.server.ts

در وضعیت فعلی Termux:
- DATABASE_URL تنظیم نشده.
- Auth فعال نشده.
- requireUserId() در این حالت به user مشترک توسعه‌دهنده برمی‌گردد: dev-user

این رفتار فقط برای حالت توسعه بدون دیتابیس است.

## ساختار Board در Domain

createBoard() هنگام ایجاد Board به صورت خودکار سه ستون اولیه می‌سازد:
- todo -> Todo -> position 0
- doing -> Doing -> position 1
- done -> Done -> position 2

بعد می‌توان با upsertColumn() ستون‌ها را با ID پایدار تغییر داد.

IDهای پیشنهادی برای Board یاسین شطرنج:
- todo -> Backlog -> 0
- ready -> Ready -> 1
- doing -> In Progress -> 2
- testing -> Testing -> 3
- pr -> PR -> 4
- ci -> CI -> 5
- review -> Review -> 6
- verify -> Verify -> 7
- done -> Done -> 8
- blocked -> Blocked -> 9

این روش بهتر از حذف و درج مجدد ستون‌هاست، چون از upsertColumn موجود استفاده می‌کند و IDهای پایدار نگه داشته می‌شوند.

## Database / PGlite

فایل: src/lib/db.ts

Kanban دو مسیر Database دارد:
- اگر DATABASE_URL وجود داشته باشد: Neon/Postgres
- اگر وجود نداشته باشد: PGlite

در Termux فعلی DATABASE_URL=NOT_SET است، بنابراین Database محلی از نوع PGlite است.

PGlite فعلی با یک instance در process اجرا می‌شود و روی globalThis نگهداری می‌شود.

نکته بسیار مهم:
PGlite فعلی in-memory است، چون dataDir برای PGlite تنظیم نشده است.

بنابراین داده‌ها فقط در همان runtime/process باقی می‌مانند و با restart شدن dev server از بین می‌روند.

نتیجه عملی:
برای ساخت Board باید عملیات ایجاد Board در همان Vite/TanStack process انجام شود.

نباید یک Node process جداگانه db.ts را import کند.

نباید یک MCP process جداگانه برای ایجاد Board استفاده شود، مگر اینکه persistence جداگانه یا Database واقعی تنظیم شده باشد.

## Migrations

src/lib/db.ts migrationها را با Vite import.meta.glob می‌خواند:
import.meta.glob("/migrations/*.sql", { query: "?raw", import: "default", eager: true })

به همین دلیل اجرای مستقیم فایل db.ts با Node معمولی روش معتبری نیست.

Vite هنگام startup از plugin اختصاصی برای bootstrap کردن PGlite استفاده می‌کند:
vite.config.ts
-> pgliteBootstrapPlugin()
-> server.ssrLoadModule("/src/lib/db.ts")
-> ensureDbReady()

## Vite / TanStack Start

vite.config.ts شامل:
- @tanstack/react-start/plugin/vite
- React plugin
- Tailwind
- Nitro
- PGlite bootstrap plugin
- health preview plugin
- auth popup plugin

Dev server contract:
- host: 0.0.0.0
- port: 8080
- strictPort: true

Preview:
- host: 127.0.0.1
- port: 8081
- strictPort: true

Health endpoint:
GET /health/live

## Server Function Transport

در source مشخص است که Kanban از TanStack Start Server Functions استفاده می‌کند.

نمونه ساختار:
createServerFn({ method: "POST" })
.middleware([authMiddleware])
.validator(...)
.handler(...)

جست‌وجوی مستقیم در node_modules/@tanstack/react-start، node_modules/@tanstack/start-server-core و node_modules/@tanstack/start-client-core با عبارت‌های serverFn، server function، createServerFn و serverFnId نتیجه مشخصی نداشت.

این به معنی نبودن transport نیست؛ implementation می‌تواند در package یا generated runtime دیگری قرار داشته باشد.

بنابراین نباید endpoint مربوط به Server Function را حدس زد.

روش درست:
1. dependencyها را نصب کن.
2. Vite/TanStack runtime را بالا بیاور.
3. transport واقعی runtime را بررسی کن.
4. همان process را برای عملیات Board استفاده کن.

## MCP

Kanban MCP شامل ابزارهای مربوط به Board است:
- kanban_list_boards
- kanban_get_board
- kanban_create_board
- kanban_update_board
- kanban_archive_board
- kanban_upsert_column

فایل MCP server: src/mcp/server.ts
فایل MCP HTTP: src/mcp/http-server.ts

برای MCP این متغیرها لازم است:
- KANBAN_MCP_TOKEN
- KANBAN_MCP_USER_ID

در محیط فعلی این متغیرها تنظیم نشده‌اند.

همچنین MCP در process جداگانه اجرا می‌شود. با PGlite in-memory، استفاده از MCP جداگانه برای provisioning فعلی قابل اتکا نیست؛ چون Database آن process با Vite process یکی نیست.

## UI

جست‌وجوی source برای createBoardFn، createBoard، New Board و Create Board نشان داد:
- Domain/API وجود دارد.
- MCP registration وجود دارد.
- UI فعلی مسیر واضحی برای Create Board نشان نمی‌دهد.

فایل‌های مهم UI:
- src/components/kanban/board.tsx
- src/components/kanban/card-dialog.tsx
- src/components/kanban/card-item.tsx
- src/components/kanban/column.tsx
- src/lib/board-store.ts

Route اصلی:
- src/routes/index.tsx

## وضعیت Environment هنگام بررسی

DATABASE_URL=NOT_SET
GITHUB_TOKEN=NOT_SET
KANBAN_MCP_TOKEN=NOT_SET
KANBAN_MCP_USER_ID=NOT_SET
VITE_AUTH_ENABLED=NOT_SET

با توجه به نبود Database و نبود Auth فعال، مسیر development به dev-user fallback می‌کند.

## اولین خطای provisioning

یک اسکریپت Node جداگانه برای import کردن db.ts امتحان شد.

نتیجه:
- Permission denied
- Cannot find module

روش کنار گذاشته شد.

علت معماری مهم‌تر از خطای permission بود:
db.ts به Vite import.meta.glob وابسته است و PGlite نیز process-local است.

پس اجرای مستقیم Node روش صحیح نیست.

## مشکل /tmp در Termux

تلاش اولیه برای اجرای dev server با /tmp/kanban-dev.log و /tmp/kanban-health.json با این خطا روبه‌رو شد:
bash: /tmp/kanban-dev.log: Permission denied
bash: /tmp/kanban-health.json: Permission denied

نتیجه:
در این Termux نباید برای این Runbook روی /tmp حساب کرد.

مسیر مناسب برای log موقت:
$HOME/yasineco/kanban/.kanban-dev.log

همچنین ss روی محیط نصب نشده بود:
The program ss is not installed.
Install it by executing:
pkg install iproute2

برای health check می‌توان از curl و ps استفاده کرد و فعلاً نیازی به نصب iproute2 نیست.

## مشکل اصلی فعلی: node_modules

هنگام بررسی مشخص شد:
node --version = v26.4.0
npm --version = 11.20.0
node_modules = MISSING

Package:
app-builder-workspace

Dev script:
node scripts/with-app-env.mjs vite dev --host 0.0.0.0 --port 8080

Vite در package.json:
^8.2.0

اما node_modules وجود نداشت.

به همین دلیل:
[with-app-env] failed to run vite: spawn vite ENOENT

این خطا به معنی خراب بودن Vite یا Kanban نیست؛ dependencyهای پروژه نصب نشده‌اند.

## npm exec observation

این دستور:
npm exec -- vite --version

پیشنهاد نصب موقت داد و پس از تأیید نتیجه:
vite/8.3.3 android-arm64 node-v26.4.0

این فقط نشان داد Vite روی Android ARM64 / Termux / Node 26 قابل اجراست.

این نصب موقت نباید جایگزین نصب dependencyهای پروژه شود.

## Lockfile

در repository فایل package-lock.json وجود دارد.

اندازه هنگام بررسی: حدود 262K.

بنابراین مسیر صحیح برای نصب dependencyهای پروژه:
cd "$HOME/yasineco/kanban"
npm ci

تا لحظه ثبت این Runbook، اجرای موفق npm ci هنوز تأیید نشده است.

## روش صحیح ادامه کار

### مرحله 1 — نصب dependencyها

cd "$HOME/yasineco/kanban" || exit 1
npm ci
./node_modules/.bin/vite --version

باید Vite محلی repository قابل اجرا باشد.

### مرحله 2 — اجرای Kanban

از log داخل repo استفاده شود:

cd "$HOME/yasineco/kanban" || exit 1
rm -f "$HOME/yasineco/kanban/.kanban-dev.log"
nohup npm run dev > "$HOME/yasineco/kanban/.kanban-dev.log" 2>&1 &

Health:
curl -i http://127.0.0.1:8080/health/live

### مرحله 3 — تأیید PGlite

Dev server باید از طریق pgliteBootstrapPlugin Database را bootstrap کند.

### مرحله 4 — Provision Board

Board:
name: Yasin Chess
projectKey: yasin-chess
userId: dev-user

### مرحله 5 — تنظیم 10 ستون

0 Backlog
1 Ready
2 In Progress
3 Testing
4 PR
5 CI
6 Review
7 Verify
8 Done
9 Blocked

### مرحله 6 — Verification

با listBoard باید:
- Board وجود داشته باشد.
- projectKey = yasin-chess باشد.
- دقیقاً 10 ستون وجود داشته باشد.
- positionها 0 تا 9 باشند.
- نام ستون‌ها دقیقاً مطابق ساختار بالا باشند.

در این مرحله:
- Card نساز.
- Issue جدید نساز.
- PR جدید نساز.
- کد yasin-chess را تغییر نده.

## دستورهای تشخیص سریع

### وضعیت Git
cd "$HOME/yasineco/kanban"
git status --short
git rev-parse --short HEAD
git branch --show-current

### وضعیت dependency
test -d node_modules && echo "node_modules: EXISTS" || echo "node_modules: MISSING"
test -x node_modules/.bin/vite && echo "vite: OK" || echo "vite: MISSING"
npm ls vite --depth=0

### وضعیت server
curl -i http://127.0.0.1:8080/health/live
ps -ef | grep -E '[v]ite|[n]ode.*kanban|[n]pm.*dev'
tail -n 160 "$HOME/yasineco/kanban/.kanban-dev.log"

## قواعد مهم برای ادامه Runbook

1. هرگز db.ts را با Node معمولی مستقیم اجرا نکن.
2. برای PGlite in-memory، عملیات Database باید در همان process Kanban انجام شود.
3. MCP جداگانه را برای provisioning PGlite استفاده نکن.
4. از /tmp برای logهای این محیط استفاده نکن.
5. قبل از تغییر dependency یا source، وضعیت Git را بررسی کن.
6. Vite endpoint یا Server Function transport را حدس نزن؛ از runtime واقعی بررسی کن.
7. برای Board یاسین Chess نیازی به تغییر source پروژه yasin-chess نیست.
8. فعلاً scope فقط kanban ↔ yasin-chess است.
9. Board creation را با Card/Issue/PR creation قاطی نکن.
10. بعد از هر provisioning، Board را read-back و verify کن.

## Known Good Architecture

Kanban
|
+-- TanStack Start
|   +-- Server Functions
|   +-- authMiddleware
|   +-- createBoardFn
|   +-- upsertColumnFn
|
+-- Domain
|   +-- createBoard()
|   +-- upsertColumn()
|   +-- listBoard()
|
+-- Database
    +-- PGlite (local fallback)
    +-- Neon/Postgres (when DATABASE_URL exists)

Integration target:

Kanban
|
| projectKey = yasin-chess
v
Yasin Chess

## آخرین نقطه توقف

Kanban HEAD: 9e7da60
node_modules: MISSING
Vite dependency: declared but not installed
PGlite runtime: not currently running
Board Yasin Chess: NOT CREATED
10 columns: NOT CREATED

قدم بعدی فقط این است:
cd "$HOME/yasineco/kanban"
npm ci

سپس Vite را بالا آورده و provisioning واقعی Board را در همان runtime انجام می‌دهیم.
