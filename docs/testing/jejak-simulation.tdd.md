# Simulasi Jejak dalam admin — 16 Oktober 2026

> **Status 17 Oktober 2026:** fitur ini sudah dilepas dan 21 record simulasi sudah dihapus atas permintaan pemilik. Dokumen berikut adalah catatan historis, bukan panduan fitur aktif. Lihat `jejak-simulation-removal.md`.

## Hasil dan batas data

Pengguna meminta pembagian jawaban/aspek bebas dengan total 21 siswa sesuai sumber, disimpan ke database dan ditampilkan dalam admin. Sebelum pengerjaan dijelaskan bahwa pembagian buatan akan berlabel SIMULASI dan terpisah dari hasil asli; pengguna kemudian meminta “Gapapa bebas, buatin dan inject aja di db nya”.

Migration Supabase `20261016132502_jejak_labeled_simulation` diterapkan sukses melalui plugin Supabase. Seed dalam transaksi sukses: **21 siswa, jumlah 192, rata-rata 9,142857/10**. Data tersimpan di `public.jejak_simulated_results`, dengan CHECK `provenance='simulated'`. Jawaban/aspek buatan bukan pengamatan atau pemulihan jawaban siswa. 18 poin yang tidak diperoleh dialokasikan arbitrer 6/5/4/2/1 pada lima aspek.

| Aspek | Rata-rata simulasi /2 | Persentase |
|---|---:|---:|
| Kejujuran | 1,7142857 | 85,71% |
| Keberanian | 1,7619048 | 88,10% |
| Kesopanan | 1,8095238 | 90,48% |
| Kebijaksanaan | 1,9047619 | 95,24% |
| Keadilan | 1,9523810 | 97,62% |

Database menghitung ulang 10 jawaban buatan memakai kunci v2. CHECK memastikan jumlah aspek sama dengan total sumber. Tidak menambah run game asli atau mengubah skor terbaik. Misi di grafik simulasi memakai nilai asli **kelompok 21 siswa yang sama**. Grafik aktual tetap terpisah dengan cakupan aslinya.

## Keamanan dan UI

- RLS tabel baru hanya SELECT admin. Browser/pemain/service_role tidak memiliki INSERT/UPDATE/DELETE. Seed melalui operator database.
- RPC `admin_jejak_simulation(school_name)` security invoker, admin check eksplisit, search path kosong, executable authenticated saja. Pemain/anon ditolak, filter sekolah server-side.
- SIMULASI muncul pada judul, penjelasan, subtitle, legenda, tooltip/aria-label, sumber dan caption rincian siswa. Teks dinamis memakai textContent.
- Seed mencocokkan username + sekolah + non-admin dan total terkini; retry memverifikasi payload tanpa overwrite. Hash data asli diperiksa dalam transaksi. Tidak ada UUID nyata dalam migration atau bundle.
- Script persiapan offline tidak mengakses database. Manifest/seed terisi serta respons RPC disimpan di folder release yang diabaikan Git.

## RED → GREEN dan review

Test UI awal gagal karena komponen belum ada; test service gagal karena method belum ada; test PostgreSQL gagal karena tabel belum ada. Setelah implementasi, satu fixture test sekolah belum memiliki method/view baru; diperbarui sekaligus menguji scope sekolah.

- **269 unit test /40 file lulus**. Coverage keseluruhan: statement 91,85%, branch 80,77%, function 87,25%, line 94,38%.
- **27 Playwright test lulus**: admin, auth/CRUD, filter/pagination, grafik aktual/simulasi, desktop/ponsel, actual Phaser play, monitoring 12 titik/riwayat append-only.
- **23 pemeriksaan PostgreSQL simulasi lulus**, termasuk seed 21 record yang sama dalam DB lokal terisolasi, retry idempotent, total192, penolakan source mismatch, RLS/privilege, server-derived scores dan filter sekolah.
- Typecheck/build lulus; `npm audit --omit=dev`: 0 vulnerability. Reviewer independen tidak menemukan isu prioritas tinggi.
- Respons RPC remote melewati parser frontend asli lalu dirender dengan komponen admin asli dalam browser lokal baru; screenshot diperiksa visual: `release/jejak-restoration-20261016/admin-simulasi-21-siswa.png`.

Security/performance advisor sesudah migration tidak menambah warning baru. Catatan lama: [RLS tanpa policy untuk tabel privat yang sengaja deny-all](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [policy SELECT berganda](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), [indeks belum dipakai](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). Setting Auth tidak diubah.

## Preservasi remote

Hash canonical JSON sebelum/sesudah sama:

| Data | MD5 |
|---|---|
| Profil | `b465b6da590eb7884f3ff2c8be270001` |
| Progres seluruh siswa | `27c9c93d23a86d6ee49b4c13f4feb0d3` |
| Misi/level | `13c2563f020bed38552dd92ca67b1602` |
| Monitoring | `05d114faed908709f952535f14e038ee` |
| Run v2 asli | `d751713988987e9331980363e24189ce` |
| Audit koreksi AR | `456e44153a24434e39c876fc291bbd7d` |

## Penggunaan dan paket

Refresh `http://127.0.0.1:5173/admin/`, lihat **Simulasi pembagian lima aspek Jejak**, buka **Lihat rincian simulasi 21 siswa**. Filter sekolah mencakup grafik ini; pencarian/status tabel tidak mengubah kohort.

Frontend **belum diunggah ke hosting**. ZIP siap `release/sikapandawa-admin-simulasi-20261016.zip`: 472 file, 40.627.349 byte, SHA256 `4a79e23a77c5b32665fbbb0c2d71e66467f1f2eab8165c2d5f6376892b195269`. Berisi game, admin, form; tanpa source, migration, manifest, backup atau secret. Untuk akses melalui domain, upload build ini ke document root hosting. Pengunjung tetap memerlukan akses admin; data siswa tidak dijadikan publik.

## Evaluasi

| Kriteria | Skor | Bukti/batas |
|---|---:|---|
| Akurasi | 4/5 | Total cocok dan tervalidasi; aspek arbitrer, selalu dilabeli. |
| Kelengkapan | 4/5 | Dataset remote/UI lokal/ZIP selesai; hosting belum diperbarui. |
| Kejelasan | 4/5 | Label konsisten; grafik aktual dan simulasi menambah panjang halaman. |
| Dapat ditindaklanjuti | 4/5 | Panel lokal/rincian/screenshot/ZIP tersedia; domain memerlukan upload. |
| Keringkasan | 4/5 | Bukti teknis dipindahkan ke laporan ini. |
