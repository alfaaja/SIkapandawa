# Rencana Database dan Backend Admin Sikapandawa

Status dokumen: implementasi lokal dan catatan operasi, diperbarui 23 Agustus 2026. Backend admin baca/CRUD versi sebelumnya telah diterapkan ke remote dengan persetujuan pemilik; migration rename username dan source Edge terbaru masih menunggu quality gate serta persetujuan deploy terpisah.

## 1. Bukti preflight

### Repo lokal

- Migration lokal hanya `20260726111201_p20_supabase_auth_progress_sync.sql`.
- `supabase/config.toml` mengaktifkan seed dan menunjuk `./seed.sql`, tetapi file tersebut belum ada.
- Belum ada `supabase/functions/` atau database test di `supabase/tests/`.
- Client admin sudah mengharapkan tiga RPC baca dan Edge Function `admin-users`, tetapi seluruh kontrak itu masih berupa mock/client code.

### Supabase remote `qbjkvbsdimxiglbhorre`

Audit dilakukan melalui query catalog dan metadata read-only. Tidak ada DDL atau perubahan data.

Remote mencatat lima migration:

| Versi | Nama | Jumlah statement | MD5 statement tersimpan |
| --- | --- | ---: | --- |
| `20260628090827` | `create_core_schema` | 1 | `a6a7d93fe2ebebec1f893c3b4bef1466` |
| `20260628090840` | `enable_rls_and_policies` | 1 | `f93034a05ecb419ba3cc6fa1d177f8fd` |
| `20260628090851` | `handle_new_user_trigger` | 1 | `7f3ce4e313343063ac3a5fcca18bc95d` |
| `20260628090925` | `harden_handle_new_user_execute` | 1 | `3d7921b86d05f48028215dd210f5d03e` |
| `20260726111201` | `p20_supabase_auth_progress_sync` | 1 | `5d4fbb809cf6671b04f2b096bb377aa8` |

Schema remote saat audit:

- `public.profiles`: 41 row, RLS aktif.
- `public.player_progress`: 41 row, RLS aktif.
- `public.level_progress`: 410 row, RLS aktif dan unique `(user_id, level)`.
- Policy pemain masih own-row untuk select/update progress; `profiles` hanya own-row select.
- Belum ada `private.admin_users`, RPC admin, audit ledger, atau Edge Function.
- Security Advisor: satu INFO untuk `minigame_result` yang sengaja tidak memiliki policy ([remediasi lint 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)) dan satu WARN karena [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) belum aktif.
- Performance Advisor: tidak ada temuan.

Implikasi: database lokal belum reproducible dan migration admin belum boleh ditulis di atas schema hasil tebakan.

## 2. Strategi memulihkan baseline

Urutan yang disarankan:

1. Pastikan versi dan sintaks CLI melalui `supabase --version` dan `supabase migration fetch --help`.
2. Ambil empat migration yang hilang dengan `supabase migration fetch --linked`. Jalankan dari salinan kerja/disposable directory lebih dahulu agar collision dengan file P20 yang sudah ada dapat direview sebelum menyalin hasil ke repo.
3. Bandingkan nama, versi, isi, dan hash setiap hasil fetch dengan `supabase_migrations.schema_migrations`. Jangan mengganti timestamp atau menyusun ulang SQL secara manual.
4. Jangan menjalankan `migration repair`: history remote saat ini lengkap dan konsisten. Repair hanya layak bila bukti schema dan history benar-benar berbeda.
5. Buat `supabase/seed.sql` berisi akun fixture sintetis saja. Jangan dump profil atau kredensial production.
6. Jalankan `supabase db reset` hanya ke local stack. Verifikasi chain lima migration membangun schema kosong dan seed menciptakan tepat sepuluh row level per fixture.
7. Bandingkan catalog lokal dengan remote untuk tabel, kolom, constraint, index, trigger, policy, grants, dan function signature; jangan membandingkan atau menyalin data pemain.
8. Setelah baseline hijau, buat migration admin dengan `supabase migration new admin_backend_read_model`. Jangan mengarang filename timestamp.

`db pull` bukan langkah pertama yang tepat pada kondisi ini: remote sudah mempunyai statement migration lengkap, sedangkan repo kehilangan empat file historis. `migration fetch` mempertahankan chronology asli; schema pull baru dipakai bila sesudah fetch masih terbukti ada drift di luar history.

## 3. Sumber kebenaran dan trust boundary

| Concern | Sumber kebenaran | Akses browser |
| --- | --- | --- |
| Identitas login/password | Supabase Auth `auth.users` | Hanya Auth API normal |
| Username/nama tampilan | `public.profiles` | Own-row pemain; all-row admin via RLS select |
| Progres agregat | `public.player_progress` | Own-row pemain; all-row admin via RLS select |
| Progres Level 1–10 | `public.level_progress` | Own-row pemain; all-row admin via RLS select |
| Role admin | `private.admin_users` | Tidak ada akses tabel langsung |
| Mutasi Auth Admin | Edge Function `admin-users` | JWT admin wajib; secret hanya di server |
| Idempotency/audit mutasi | `public.admin_account_operations` | Tidak ada policy/grant browser; service role saja |

Publishable key tetap satu-satunya key dalam bundle browser. Secret/service-role key hanya tersedia di environment Edge Function dan tidak boleh dicatat di log atau response.

Status progres (`not_started`, `in_progress`, `completed`) bukan status akun. Untuk v1, akun efektif `active` selama row Auth ada dan menjadi `deleted` untuk login/refresh baru setelah hard delete. Access token yang sudah terbit dapat tetap valid sampai expiry; row profil/progres sudah terhapus sehingga token itu tidak mendapatkan data own-row, tetapi TTL JWT remote tetap harus direview. Jangan membuat boolean `is_active` publik yang tidak menonaktifkan login. Bila fitur suspend ditambahkan kelak, gunakan Auth Admin `ban_duration` sebagai enforcement dan rancang rekonsiliasi khusus; jangan mengandalkan flag UI/database saja.

## 4. Schema role admin

```sql
create schema if not exists private;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.admin_users enable row level security;
```

Tidak ada policy pada tabel ini. Defense berlapis:

- revoke seluruh privilege tabel dari `public`, `anon`, dan `authenticated`;
- schema `private` tidak masuk exposed schemas/extra search path;
- grant `usage` schema `private` ke `authenticated` hanya agar policy/RPC dapat resolve helper;
- browser tidak pernah dapat select/insert/update/delete `private.admin_users`;
- pemberian/pencabutan role tidak tersedia di UI CRUD pemain.

Helper tunggal:

```sql
private.is_admin() returns boolean
language sql stable security definer set search_path = ''
```

Helper harus membaca `(select auth.uid())`, tidak menerima user ID, dan fully-qualify `private.admin_users`. Revoke execute dari `public`/`anon`; grant execute hanya ke `authenticated`. Owner helper tidak boleh role yang dapat dipilih browser.

Bootstrap pertama tetap langkah manual terpisah: preview satu profil berdasarkan `normalized_username`, minta persetujuan, lalu insert idempotent. Jangan menyimpan username environment nyata dalam migration atau seed.

## 5. RLS baca admin

Tambahkan policy `SELECT` admin pada tiga tabel tanpa mengubah policy pemain:

```sql
using ((select private.is_admin()))
```

Policy berlaku `to authenticated` pada:

- `public.profiles`;
- `public.player_progress`;
- `public.level_progress`.

Jangan menambahkan policy admin untuk insert/update/delete. Existing grants juga harus tetap membatasi `profiles` ke select dan progress ke select/update own-row. Karena policy bersifat OR, akun pemain tetap hanya melihat row sendiri, sedangkan admin dapat melihat seluruh row untuk kebutuhan baca. Admin browser tetap tidak dapat menulis row pemain lain.

Tambahkan index stabil untuk daftar pemain:

```sql
create index profiles_admin_registered_order_idx
  on public.profiles (created_at desc, id desc);
```

Index `(user_id, level)` sudah tersedia. Dengan 41 pemain, index trigram search belum diperlukan; ukur dengan `explain (analyze, buffers)` sebelum menambah extension/index search.

## 6. Kontrak RPC baca

Ketiga function berada di `public` agar dapat dipanggil Data API, `security invoker`, `stable`, dan `set search_path = ''`. Semua function:

1. memeriksa `private.is_admin()` di awal;
2. melempar SQLSTATE `42501` dengan pesan umum bila bukan admin;
3. hanya dapat dieksekusi `authenticated`;
4. tetap melewati RLS;
5. tidak mengembalikan email internal, password, token, metadata Auth, atau audit data.

### `public.admin_dashboard_summary()`

Return `jsonb`:

- `totalUsers`;
- `notStartedUsers`;
- `inProgressUsers`;
- `completedUsers`;
- `totalStarsEarned`;
- `generatedAt`.

Status dihitung dari jumlah `level_progress.completed = true`, bukan hanya array agregat, agar summary sama dengan rapor level.

### `public.admin_list_users(search_text, progress_status, page_size, page_offset)`

Validasi:

- trim search, maksimum 80 karakter;
- status hanya `all`, `not_started`, `in_progress`, `completed`;
- page size 1–100, default 25;
- offset >= 0, default 0;
- wildcard `%`, `_`, dan `\\` pada search diperlakukan literal;
- order `profiles.created_at desc, profiles.id desc`.

Response camelCase harus sama dengan `AdminUserListResponse` di TypeScript. `total` dihitung sesudah search/filter dan sebelum limit/offset.

### `public.admin_get_user_progress(target_user_id uuid)`

- Tolak null/invalid melalui typing/validasi.
- Bila profil tidak ada, SQLSTATE `P0002` dengan pesan umum.
- Return profil ringkas, fakta summary, dan tepat 10 level terurut.
- Gunakan `generate_series(1, 10)` lalu left join agar kontrak tetap sepuluh row; test integritas terpisah tetap mendeteksi row progress yang hilang.
- Return fakta mentah untuk rapor: completed count, total stars, average stars, highest unlocked, intro seen, Jejak unlocked, dan best score.

`grade` dan `jejakTier` sebaiknya dihitung di client memakai `src/shared/game/reporting.ts`, karena label/ranking adalah aturan produk game. Saat ini parser admin mengharapkan kedua field dari RPC; implementasi harus memilih salah satu secara eksplisit: ubah parser agar menurunkan label dari fakta mentah (disarankan), atau dokumentasikan duplikasi aturan di SQL dan tambahkan parity test.

## 7. Audit dan idempotency CRUD akun

Gunakan ledger service-only pada schema exposed dengan RLS tanpa policy agar Edge Function dapat mengaksesnya melalui service client tanpa mengekspos schema `private`:

```text
public.admin_account_operations
- operation_id uuid primary key
- actor_user_id uuid not null
- action text check create/update/rename_username/reset_password/delete
- target_user_id uuid null
- target_username text not null
- request_fingerprint text not null
- request_details jsonb not null default '{}'
- status text check pending/succeeded/failed
- error_code text null
- created_at timestamptz not null
- completed_at timestamptz null
```

Aturan keamanan:

- RLS enabled, tanpa policy browser.
- Revoke seluruh privilege dari `public`, `anon`, `authenticated`.
- Service role hanya memperoleh select/insert/update; tidak memperoleh delete.
- `operation_id` dibuat browser dengan `crypto.randomUUID()` dan wajib dikirim untuk setiap logical mutation.
- `request_fingerprint` adalah HMAC-SHA-256 atas canonical request memakai secret Edge khusus `ADMIN_IDEMPOTENCY_SECRET`; ini memungkinkan deteksi reuse operation ID dengan payload berbeda tanpa menyimpan password atau hash password yang bisa ditebak offline.
- Trigger menjaga actor/action/target/request immutable dan hanya mengizinkan transisi `pending -> succeeded|failed`.
- `request_details` hanya berisi field non-secret seperti nama field yang berubah; password, internal email, JWT, refresh/access token, dan secret tidak pernah disimpan.
- Index `(actor_user_id, created_at desc)` untuk rate limit dan `(target_user_id, created_at desc)` untuk audit target.
- Retention belum diotomasi; putuskan kebijakan retensi sebelum production.

Sediakan RPC service-only berikut:

```text
public.admin_begin_account_operation(uuid, uuid, text, uuid, text, text, jsonb)
  -- operation id, actor id, action, target id, target username,
  -- request fingerprint, sanitized details

public.admin_finish_account_operation(uuid, text, text, uuid)
  -- operation id, final status, sanitized error code, resulting target id

public.admin_target_is_protected(uuid)
  -- target id; true bila target adalah admin
```

Ketiganya `security invoker` dengan `set search_path = ''`, revoke dari `public`/`anon`/`authenticated`, dan grant hanya `service_role`. Beri service role `usage` pada schema private serta `select` saja pada `private.admin_users`; schema tetap tidak diekspos Data API. Dengan demikian target helper publik dapat membaca role sebagai service invoker tanpa membuat security-definer function di exposed schema. Begin memakai advisory transaction lock per actor, memeriksa rate limit, lalu insert operation. Duplicate `operation_id` dan fingerprint yang sama mengembalikan object sebelumnya (`operationId`, `status`, `targetUserId`, `errorCode`) tanpa membuat row baru. Fingerprint berbeda untuk operation ID yang sama ditolak SQLSTATE `22023` dan dipetakan Edge menjadi HTTP 409.

Semantik retry:

- create: Admin API menyimpan marker operation ID di `app_metadata` hanya untuk rekonsiliasi (bukan authorization). Konflik Auth pada retry hanya dianggap sukses bila internal email, profil, dan marker operation cocok;
- update display name: set-to-value bersifat idempotent;
- reset password: pending retry menetapkan kembali password yang sama; fingerprint HMAC memastikan payload sama tanpa menyimpan password;
- delete: target yang sudah tidak ada dianggap sukses hanya jika ledger operation yang sama sebelumnya sudah/pending menghapus target tersebut;
- operation ID yang sama untuk action/target berbeda ditolak `409 idempotency_conflict`.

## 8. Edge Function `admin-users`

Endpoint menerima `POST` dan action `create`, `update`, `reset_password`, atau `delete`. Action `update` memilih update nama tampilan biasa atau jalur internal ledger `rename_username` ketika username berubah.

Urutan wajib:

1. CORS allowlist dan preflight; jangan gunakan wildcard untuk production.
2. Platform JWT verification tetap aktif.
3. Validasi body schema, content type, ukuran body, operation ID, UUID, username, display name, dan password.
4. Verifikasi JWT menjadi user dengan Supabase Auth server-side; jangan percaya `actorUserId` dari body.
5. Jalankan RPC user-scoped admin sebagai authorization gate. Bila gagal, kembalikan error umum 403.
6. Mulai operation idempotent dan rate-limited menggunakan service-only RPC.
7. Tolak target yang terdapat di `private.admin_users`, termasuk self. Karena schema private tidak diekspos, lakukan check melalui helper service-only `public.admin_target_is_protected(uuid)`: security invoker, empty search path, fully-qualified objects, revoke dari `public`/`anon`/`authenticated`, grant hanya `service_role`.
8. Jalankan satu Auth Admin operation server-side.
9. Finalisasi audit tanpa secret dan kembalikan envelope konsisten.

Mapping action:

- create: `auth.admin.createUser` dengan internal email hasil algoritma shared, `email_confirm: true`, user metadata `display_name`, `username`, `normalized_username`, serta marker idempotency di app metadata; trigger existing membuat profile dan sepuluh row level. Tambahkan parity test Edge terhadap `buildInternalAuthEmail` agar hash email tidak pernah drift.
- update tanpa rename: update `public.profiles.display_name` memakai service context.
- update dengan rename: validasi `expectedUsername`, tolak target admin, cabut session target, ubah internal Auth email + metadata dengan `auth.admin.updateUserById`, lalu panggil RPC service-only `admin_service_update_profile_identity`. RPC memakai advisory lock dan optimistic check, mempertahankan `user_id` serta semua row progres. Bila update profil gagal, Edge mencoba mengembalikan email/metadata Auth; bila compensation gagal, operasi ditandai gagal dan response tetap generik.
- reset password: `auth.admin.updateUserById(target, { password })`.
- delete: verifikasi `expectedUsername`, lalu hard delete Auth user; FK cascade membersihkan profil dan progres.

Create/delete melintasi Auth service dan Postgres sehingga bukan satu transaksi ACID. Ledger dan retry reconciliation di atas wajib; jangan mengklaim transaksi lintas layanan.

Migration harus memberi service role privilege eksplisit yang diperlukan saja, termasuk `select` dan `update(display_name)` pada `public.profiles` serta privilege ledger. Jangan bergantung pada broad default grant.

Response tidak membedakan username/email internal yang sensitif dan tidak meneruskan pesan mentah Auth/SQL. Log server hanya boleh memuat operation ID, action, actor ID, target ID, status, dan error code terkontrol.

## 9. Pengujian dan gate

SQL contract matrix tersedia di `supabase/tests/database/admin_backend.contract.test.sql`. File tersebut sengaja menjadi RED sampai baseline dan migration admin tersedia.

Setelah implementasi:

1. `supabase db reset` local;
2. `supabase test db --local`;
3. `supabase db lint --local --level error`;
4. unit test handler Edge untuk auth denial, validation, idempotency, rate limit, dan redaction;
5. integration test Edge terhadap local stack dengan akun fixture sintetis;
6. test E2E browser terhadap local stack, tidak terhadap data production;
7. security/performance advisors setelah migration diterapkan ke environment yang disetujui;
8. `npm audit`, typecheck, build, unit coverage, dan E2E existing.

Leaked-password protection remote saat audit masih nonaktif. Aktivasi adalah perubahan konfigurasi Auth dan harus diminta terpisah, tetapi disarankan sebelum CRUD/reset password dipakai production.

## 10. Batas persetujuan

Tahap lokal yang aman: fetch migration read-only, membuat seed sintetis, local reset, menulis migration, test, dan Edge Function lokal.

Tetap perlu persetujuan eksplisit sebelum:

- apply/push migration ke remote;
- deploy Edge Function;
- bootstrap admin pertama;
- mengubah konfigurasi Auth seperti leaked-password protection;
- membuat, mereset password, atau menghapus akun remote;
- commit/push repository.

### Catatan deploy rename username

Urutan produksi yang diwajibkan:

1. semua unit, coverage, typecheck, build, E2E, audit, code review, dan security review hijau;
2. apply migration `20260823113402_admin_username_rename.sql` ke project yang disetujui;
3. deploy ulang Edge Function `admin-users` dengan JWT verification aktif;
4. verifikasi grant RPC hanya `service_role`, CORS hanya origin produksi + development yang disetujui, dan Database/Security Advisors;
5. smoke test read-only serta CORS tanpa mengganti username akun nyata;
6. uji mutasi akun nyata hanya pada akun target yang disebut dan disetujui pemilik.

Referensi resmi:

- https://supabase.com/docs/guides/local-development/cli-workflows
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
- https://supabase.com/docs/guides/functions/auth
- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
- https://supabase.com/docs/guides/database/testing
