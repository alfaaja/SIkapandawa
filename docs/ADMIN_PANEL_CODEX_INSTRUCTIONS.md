# Instruksi Codex — Panel Admin Sikapandawa

> Gunakan dokumen ini sebagai prompt kerja di task Codex baru. Tujuannya adalah **mengimplementasikan**, menguji, dan mereview panel admin Sikapandawa dengan workflow ECC. Jangan berhenti setelah membuat rencana.

> **Pembaruan scope 23 Agustus 2026:** pemilik produk telah menyetujui CRUD akun pemain melalui panel. Batas read-only di bawah berlaku sebagai catatan rancangan awal dan digantikan oleh Bagian 5.5 serta checklist terbaru. Role admin dan progres/rapor tetap tidak dapat diedit dari browser.

## 1. Misi

Bangun panel admin responsif di URL `/admin/` agar administrator dapat:

- login memakai akun Supabase Sikapandawa;
- melihat ringkasan jumlah pemain;
- melihat daftar akun yang sudah terdaftar;
- mencari pemain berdasarkan nama atau username;
- memfilter pemain berdasarkan status progres;
- melihat progres ringkas dan detail Level 1–10;
- logout dari panel admin.

Panel juga menyediakan create akun pemain, ubah nama tampilan/username, reset password, dan hapus akun melalui Edge Function terotorisasi. Admin tetap tidak boleh mereset progres, mengedit skor, atau memberi role admin melalui UI.

## 2. Otorisasi kerja

Codex boleh mengubah file lokal repo, menambah dependency pengembangan, menulis migration baru, dan menjalankan build/test lokal.

Codex **wajib meminta persetujuan pengguna** sebelum:

- menerapkan migration ke project Supabase remote;
- menjalankan SQL bootstrap admin di remote;
- deploy/publish;
- push, membuka PR, merge, atau commit bila belum diminta;
- mengubah atau menghapus data pengguna.

Jangan pernah menampilkan, mencatat, atau memasukkan `service_role`, secret key, access token, refresh token, maupun password ke source code, log, test fixture, atau bundle browser.

## 3. Gunakan workflow ECC

Gunakan agent/lane ECC berikut bila tersedia. Jalankan pekerjaan independen secara paralel, tetapi jangan biarkan dua agent mengedit file yang sama.

1. `planner`: pecah implementasi menjadi fase dan identifikasi risiko.
2. `architect` atau `database-reviewer`: review trust boundary, RLS, RPC, dan migration.
3. `tdd-guide`: siapkan test lebih dulu dan buktikan RED sebelum implementasi.
4. Implementasi oleh agent utama sesuai fase.
5. `code-reviewer`: review seluruh diff setelah implementasi.
6. `security-reviewer`: review auth, role admin, RLS, function privileges, dan kebocoran secret.
7. `e2e-runner`: verifikasi alur login, denial non-admin, daftar user, detail progres, dan logout.
8. `verification-loop`: build, typecheck, test, coverage, audit, dan diff review final.

Jika role agent tertentu tidak tersedia, jalankan checklist lane tersebut sendiri dan catat hasilnya.

## 4. Fakta repo yang harus dipertahankan

- Stack saat ini: Vite 6, TypeScript, Phaser 4, dan `@supabase/supabase-js`.
- Aplikasi utama adalah satu game Phaser dari `index.html` → `src/main.ts` → `src/game/main.ts`.
- Tidak ada router atau framework UI seperti React.
- Supabase browser client memakai:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- Local fallback hanya untuk development ketika Supabase tidak dikonfigurasi.
- Data remote yang relevan sudah tersedia di:
  - `public.profiles`
  - `public.player_progress`
  - `public.level_progress`
- RLS saat ini sengaja membatasi pemain hanya ke row miliknya sendiri.
- RPC progres pemain saat ini juga dibatasi ke `auth.uid()` dan tidak boleh diubah menjadi akses global.
- Pertahankan invariants progres: bintang, level terbuka, level selesai, dan skor terbaik bersifat monotonic/tidak boleh turun.
- Working tree mungkin sudah memuat perubahan pengguna di `package.json` dan `package-lock.json`. Jangan membuang atau menimpa perubahan tersebut.
- Gunakan npm karena `package-lock.json` adalah lockfile aktif. Commit lockfile bila dependency berubah.

## 5. Keputusan arsitektur

### 5.1 Surface UI

Buat admin sebagai **Vite multi-page DOM app** terpisah:

```text
/
└── game Phaser yang sekarang, tidak berubah perilakunya

/admin/
└── panel admin HTML/CSS/TypeScript
```

Jangan membuat panel tabel sebagai Phaser scene. Jangan menambahkan React hanya untuk fitur ini. Gunakan semantic HTML, TypeScript, dan CSS modular agar bundle admin tidak memuat Phaser.

Tambahkan entry `admin/index.html` dan daftarkan `index.html` serta `admin/index.html` pada `build.rollupOptions.input` di konfigurasi production Vite. Ingat bahwa file config berada di folder `vite/`, jadi resolve path harus menuju root repo. Dev server harus tetap membuka game di `/` dan admin di `/admin/`.

### 5.2 Trust boundary

- Browser hanya memakai publishable key.
- Browser boleh meminta data admin hanya sebagai user Supabase yang sudah login.
- Database menjadi sumber kebenaran untuk authorization.
- Menyembunyikan tombol/menu bukan authorization.
- Jangan membaca `auth.users` langsung dari browser.
- Daftar pemain berasal dari `public.profiles`, bukan Admin Auth API.
- Jangan memakai `user_metadata` untuk keputusan role.
- Jangan memasukkan `service_role` ke variable bernama `VITE_*`.

### 5.3 Role admin

Buat tabel role minimal di schema non-exposed:

```text
private.admin_users
- user_id uuid primary key references auth.users(id) on delete cascade
- created_at timestamptz not null default now()
```

Buat helper `private.is_admin()` yang:

- mengembalikan boolean berdasarkan `(select auth.uid())`;
- `stable` dan `security definer`;
- memakai `set search_path = ''`;
- menyebut schema pada setiap object;
- tidak menerima `user_id` dari caller;
- tidak mengekspos data role;
- mempunyai privilege minimum yang diperlukan untuk dipanggil dari policy.

Privilege yang dituju harus eksplisit:

- tetap revoke seluruh table privilege `private.admin_users` dari `public`, `anon`, dan `authenticated`;
- grant hanya `USAGE` pada schema `private` kepada `authenticated`, karena policy/RPC perlu resolve helper tersebut;
- revoke `EXECUTE` pada `private.is_admin()` dari `public` dan `anon`;
- grant `EXECUTE` pada `private.is_admin()` hanya kepada `authenticated`;
- jangan menambahkan schema `private` ke daftar exposed schema atau `extra_search_path` Data API.

Jangan memberi browser akses langsung ke `private.admin_users`.

Tambahkan policy `SELECT` admin pada `profiles`, `player_progress`, dan `level_progress` menggunakan `(select private.is_admin())`. Pertahankan seluruh policy pemain yang sudah ada. Jangan menambahkan policy admin untuk `INSERT`, `UPDATE`, atau `DELETE` pada MVP.

Konsekuensi desain ini harus dianggap disengaja dan diuji: karena role `authenticated` sudah mempunyai table-level `SELECT`, akun admin juga dapat membaca row ketiga base table tersebut lewat Data API, bukan hanya lewat RPC. Ini diterima untuk MVP karena tabel itu hanya berisi profil pemain dan progres yang memang berada dalam scope admin. Jangan menambahkan kolom sensitif ke tabel tersebut tanpa meninjau ulang policy/projection. RPC tetap menjadi interface UI resmi untuk validasi, agregasi, pagination, dan kontrak response.

### 5.4 Read model admin

Sediakan tiga RPC terpisah, semuanya:

- hanya untuk `authenticated`;
- `security invoker` dengan `set search_path = ''`;
- melakukan explicit admin check di awal dan melempar `insufficient_privilege` jika bukan admin;
- tetap dilindungi RLS;
- memvalidasi dan membatasi semua input;
- tidak mengembalikan email internal, password, token, metadata auth, atau secret.

Kontrak RPC:

#### `admin_dashboard_summary()`

Mengembalikan JSON:

```json
{
  "totalUsers": 0,
  "notStartedUsers": 0,
  "inProgressUsers": 0,
  "completedUsers": 0,
  "totalStarsEarned": 0,
  "generatedAt": "ISO-8601"
}
```

#### `admin_list_users(search_text, progress_status, page_size, page_offset)`

- `search_text`: opsional, trim, maksimum 80 karakter.
- `progress_status`: hanya `all`, `not_started`, `in_progress`, atau `completed`.
- `page_size`: default 25, rentang 1–100.
- `page_offset`: default 0, tidak boleh negatif.
- Urutan default: pemain terbaru lebih dulu, lalu `user_id` sebagai tie-breaker stabil.

Mengembalikan JSON:

```json
{
  "items": [
    {
      "userId": "uuid",
      "displayName": "Nama",
      "username": "username",
      "registeredAt": "ISO-8601",
      "highestUnlockedLevel": 1,
      "completedLevelCount": 0,
      "totalStars": 0,
      "jejakPandawaUnlocked": false,
      "jejakPandawaBestScore": 0,
      "progressUpdatedAt": "ISO-8601",
      "status": "not_started"
    }
  ],
  "total": 0,
  "pageSize": 25,
  "pageOffset": 0
}
```

Status diturunkan dari jumlah level selesai:

- `0` → `not_started`
- `1–9` → `in_progress`
- `10` → `completed`

#### `admin_get_user_progress(target_user_id)`

Mengembalikan profil ringkas dan tepat 10 row level yang terurut:

```json
{
  "user": {
    "userId": "uuid",
    "displayName": "Nama",
    "username": "username"
  },
  "levels": [
    {
      "level": 1,
      "stars": 0,
      "completed": false,
      "updatedAt": "ISO-8601"
    }
  ]
}
```

Return not-found yang konsisten bila target tidak ada. Jangan bocorkan detail internal lewat error ke UI.

### 5.5 Mutasi akun pemain

- Semua mutasi melewati Edge Function `admin-users`; browser tidak pernah memegang `service_role`.
- Target admin, termasuk akun admin yang sedang login, tidak dapat diedit, direset, atau dihapus.
- Username login boleh diubah dengan optimistic check `expectedUsername`. Nilai baru harus normalized lowercase dan cocok `^[a-z0-9._-]{3,20}$`.
- Rename mempertahankan `user_id` yang sama, sehingga progres dan rapor tidak berubah. Internal Auth email dan metadata diperbarui server-side, session lama dicabut, lalu identitas profil diperbarui melalui RPC khusus `service_role`.
- Karena Auth dan Postgres bukan satu transaksi, kegagalan profil memicu rollback identitas Auth. Kegagalan rollback dilaporkan sebagai recovery failure dan wajib ditangani operator; jangan menyatakan operasi atomik.
- Rename dibatasi 5 operasi per admin per 10 menit. Delete tetap 12 per 10 menit; create/reset 5; update nama tampilan 20.
- Tidak ada endpoint untuk mengubah role admin atau progres pemain.

## 6. UI/UX MVP

### Login

- Field username dan password.
- Ekstrak `normalizeUsername` dan `buildInternalAuthEmail` dari `src/game/services/AuthService.ts` ke modul shared yang murni, lalu gunakan modul yang sama dari game dan admin. Pertahankan output algoritma agar akun lama tetap bisa login.
- Admin **tidak boleh** memanggil `AuthService.login`, karena service pemain itu memiliki local fallback, legacy migration, signup path, dan cache profil pemain. Admin harus memanggil `signInWithPassword` melalui client admin sendiri.
- Pisahkan session admin dari session game dengan storage key Supabase khusus admin jika didukung versi client yang terpasang.
- Setelah sign-in, panggil RPC admin sebagai authorization gate.
- Jika kredensial valid tetapi bukan admin: tampilkan pesan umum “Akun tidak memiliki akses admin”, lalu sign out session admin.
- Jangan membedakan “username tidak ditemukan” dan “password salah”.

### Dashboard

- Header: judul, waktu refresh terakhir, tombol Refresh, dan Logout.
- Summary cards: Total Pemain, Belum Mulai, Sedang Bermain, Selesai.
- Search input dengan debounce singkat.
- Filter status.
- Tabel responsif dengan kolom:
  - username;
  - nama tampilan;
  - tanggal daftar;
  - level tertinggi;
  - level selesai (`x/10`);
  - total bintang (`x/30`);
  - status Jejak Pandawa dan skor terbaik;
  - update progres terakhir;
  - aksi “Detail”.
- Pagination server-side, 25 row per halaman.
- Detail pemain menampilkan Level 1–10, bintang, completed, dan update terakhir.
- Sediakan state loading, empty, error, access denied, offline, dan retry.
- Gunakan teks antarmuka Bahasa Indonesia.
- Gunakan semantic elements, label form, focus states, keyboard navigation, dan kontras yang layak.
- Jangan memakai `innerHTML` untuk data pengguna. Render dengan `textContent`/DOM API.
- Manual refresh cukup untuk MVP; Realtime bukan kebutuhan fase ini.

## 7. Struktur file yang disarankan

Sesuaikan nama bila repo memberi pola yang lebih baik, tetapi jaga file tetap fokus dan umumnya 200–400 baris, maksimum 800 baris.

```text
admin/
└── index.html

src/admin/
├── main.ts
├── styles.css
├── types.ts
├── services/
│   ├── AdminSupabaseClient.ts
│   ├── AdminAuthService.ts
│   └── AdminDashboardService.ts
├── ui/
│   ├── LoginView.ts
│   ├── DashboardView.ts
│   └── UserProgressDialog.ts
└── utils/
    ├── formatters.ts
    └── progressStatus.ts

src/shared/auth/
└── username.ts

supabase/migrations/
└── <generated_timestamp>_admin_read_panel.sql

e2e/
└── admin.spec.ts
```

Jangan mengimpor `src/game/main.ts` atau Phaser dari entry admin. Reuse hanya helper murni yang memang aman dibagi; jangan membuat admin tergantung localStorage progress pemain.

## 8. Fase implementasi wajib

### Fase 0 — Preflight dan schema reproducibility gate

1. Jalankan `git status --short`; inventaris perubahan pengguna dan jangan menghapusnya.
2. Baca `package.json`, lockfile, Vite configs, Supabase client/services, migration, dan call site progres.
3. Cek changelog dan dokumentasi Supabase terbaru sebelum merancang SQL.
4. Gunakan Supabase MCP/CLI read-only untuk membandingkan schema remote dan migration history bila koneksi tersedia.
5. Verifikasi fakta penting: repo hanya memiliki satu migration P20 yang bergantung pada tabel legacy yang tidak dibuat dalam migration tersebut, sementara `supabase/config.toml` merujuk `supabase/seed.sql` yang tidak ada.
6. Jangan menjalankan `supabase db reset` dan jangan mengarang baseline schema. Bila schema lokal tidak reproducible, hentikan **jalur database/integration saja**, laporkan bukti, lalu minta persetujuan untuk menarik/merekonsiliasi baseline remote terlebih dahulu. Sambil menunggu jawaban, lanjutkan test dan implementasi UI/client terhadap kontrak RPC menggunakan mock; jangan mengklaim fitur end-to-end selesai.
7. Setelah baseline direkonsiliasi dan disetujui, buat migration admin hanya melalui `supabase migration new <nama>`; jangan menebak timestamp filename.

### Fase 1 — Fondasi test (RED)

Repo belum memiliki test/lint runner. Tambahkan fondasi minimum:

- Vitest untuk unit test;
- coverage provider;
- DOM test environment bila diperlukan;
- Playwright untuk E2E;
- scripts `test`, `test:coverage`, dan `test:e2e`;
- coverage minimal 80% untuk seluruh modul baru/berubah pada surface admin.

Tulis test sebelum implementasi dan jalankan untuk membuktikan RED. Jangan membuat test palsu yang langsung hijau.

### Fase 2 — Authorization dan read model database

1. Buat `private.admin_users` dan `private.is_admin()`.
2. Tambahkan policy SELECT admin tanpa melonggarkan write policy pemain.
3. Buat ketiga RPC beserta validasi, pagination, sorting stabil, dan explicit denial.
4. Terapkan `USAGE` schema dan revoke/grant function/table privileges persis sesuai trust boundary pada Bagian 5.3.
5. Tambahkan komentar SQL pada object keamanan penting.
6. Uji sebagai anon, pemain biasa, admin, serta target user yang tidak ada.
7. Jalankan Supabase database/security advisors bila tersedia dan perbaiki temuan relevan.

### Fase 3 — Admin client dan login

1. Buat Supabase client admin dengan publishable key dan session storage terisolasi.
2. Implement login/logout/restore session.
3. Panggil RPC admin sebagai server-enforced authorization gate.
4. Tangani expired session, offline, rate-limit, dan generic error.

### Fase 4 — Dashboard

1. Implement summary cards.
2. Implement pencarian, filter, pagination, dan refresh.
3. Implement tabel dan detail Level 1–10.
4. Pastikan request lama tidak menimpa hasil request baru ketika search/filter berubah cepat; gunakan cancellation atau request token.
5. Pastikan semua data pengguna dirender sebagai teks, bukan HTML.

### Fase 5 — Vite multi-page integration

1. Tambahkan entry `/admin/` pada build production dan dev flow.
2. Pastikan `dist/index.html` dan `dist/admin/index.html` sama-sama terbuat.
3. Pastikan `/` tetap menjalankan game seperti sebelumnya.
4. Pastikan halaman admin tidak memuat chunk Phaser.

### Fase 6 — Review dan verification

Jalankan seluruh quality gate dan perbaiki issue Critical/High sebelum selesai.

## 9. Test matrix minimum

### Unit

- normalisasi/validasi username admin login;
- derive status progres untuk 0, 1, 9, dan 10 level;
- clamping/pagination input;
- format tanggal dan fallback invalid date;
- rendering data pengguna sebagai text, termasuk string mirip HTML;
- stale request tidak menimpa request terbaru.

### Database/integration

- anon tidak dapat mengeksekusi RPC admin;
- authenticated non-admin ditolak;
- admin dapat melihat semua pemain;
- policy own-row pemain tetap bekerja setelah policy admin ditambahkan;
- admin tidak dapat update/delete progres milik pengguna lain dan surface UI admin tidak mengirim operasi write;
- search, filter, count, pagination, dan stable ordering benar;
- RPC tidak mengembalikan kolom sensitif;
- target user tidak ada menghasilkan kontrak error yang konsisten;
- role tidak dapat dibuat sendiri oleh browser user.

### E2E

- `/admin/` menampilkan login ketika belum ada session;
- kredensial salah menghasilkan error umum;
- pemain biasa ditolak dan di-sign-out;
- admin melihat summary dan daftar user;
- search/filter/pagination bekerja;
- detail menampilkan 10 level;
- refresh dan empty/error state bekerja;
- logout kembali ke login;
- `/` masih memuat game dan flow login pemain tidak rusak.

Gunakan data test terisolasi. Jangan menjalankan E2E write test terhadap data produksi.

## 10. Bootstrap admin pertama

Jangan otomatis menjalankan langkah ini. Setelah migration sudah direview dan pengguna menyetujui perubahan remote, admin pertama dapat dipilih dari akun pemain yang sudah terdaftar melalui SQL terkontrol:

```sql
insert into private.admin_users (user_id)
select id
from public.profiles
where normalized_username = lower('<GANTI_DENGAN_USERNAME_ADMIN>')
on conflict (user_id) do nothing;
```

Sebelum menjalankan:

- ganti placeholder secara manual;
- preview target `id`, `username`, dan `display_name`;
- pastikan tepat satu row cocok;
- minta persetujuan pengguna;
- jangan menyimpan username nyata ke migration/seed bila itu data lingkungan tertentu.

## 11. Definition of Done

Fitur selesai hanya bila seluruh kondisi ini terpenuhi:

- [ ] Game di `/` tetap berfungsi.
- [ ] Panel tersedia di `/admin/` pada dev dan production build.
- [ ] Tidak ada secret/service-role key di source atau bundle.
- [ ] Non-admin ditolak oleh database, bukan hanya UI.
- [ ] Admin dapat melihat summary, daftar, search, filter, pagination, dan detail progres.
- [ ] CRUD akun hanya tersedia melalui Edge Function dan target admin terlindungi.
- [ ] Rename username mempertahankan user ID/progres, mencabut session lama, dan mempunyai compensation path.
- [ ] Existing player RLS tests tetap hijau.
- [ ] Unit, integration, dan E2E tests lulus.
- [ ] Coverage surface admin minimal 80%.
- [ ] `npx tsc --noEmit` lulus.
- [ ] `npm run build-nolog` lulus.
- [ ] `npm audit` tidak memiliki vulnerability high/critical yang belum diputuskan.
- [ ] Database/security advisors sudah direview.
- [ ] Code review dan security review tidak memiliki issue Critical/High tersisa.
- [ ] Diff hanya berisi perubahan yang terkait fitur dan perubahan pengguna sebelumnya tetap utuh.

## 12. Format laporan akhir Codex

Laporkan secara singkat namun berbukti:

1. Outcome dan URL panel.
2. Arsitektur yang dipilih.
3. File utama yang berubah.
4. Migration/RLS/RPC yang ditambahkan.
5. Hasil build, typecheck, tests, coverage, audit, dan security advisors.
6. Langkah manual yang masih perlu dilakukan pengguna.
7. Hal yang sengaja tidak masuk MVP.
8. Jangan mengklaim migration remote/deploy/commit berhasil bila tindakan tersebut belum benar-benar dilakukan.

## 13. Referensi resmi

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase RBAC/custom claims: https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Supabase function security: https://supabase.com/docs/guides/database/functions
- Supabase API security: https://supabase.com/docs/guides/api/securing-your-api
- Supabase changelog: https://supabase.com/changelog?types=breaking-change
- Vite 6 multi-page build: https://v6.vite.dev/guide/build#multi-page-app
