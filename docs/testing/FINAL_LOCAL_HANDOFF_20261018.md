# Sikapandawa — serah terima pengujian lokal

18 Oktober 2026. Pengguna menyetujui aktivasi backend dan finalisasi, lalu ingin menguji sendiri sebelum upload hosting. Backend terbaru sudah aktif; frontend belum diunggah ke hosting atau GitHub. Tidak ada commit/push pada finalisasi ini.

## Backend aktif

- `admin-users` v11 ACTIVE, verify_jwt=true. Delapan source TypeScript remote cocok dengan lokal setelah normalisasi akhir baris. Upload final menyertakan deno.json dengan compilerOptions.strict=true; bundle hash identik dengan v10.
- Migration `school_teacher_account_management` remote `20261018084659` melengkapi school → CRUD guru sekolahnya. Migration master CRUD dan provisioning guru sebelumnya tetap aktif.
- Pemeriksaan read-only remote membuktikan master serta school yang sah mendapat izin pada teacher milik sekolah yang sama; school ditolak untuk target staf lain/UUID tidak dikenal. Master tidak dapat dihapus. Hak execute service-only, RLS, index satu admin sekolah, dan serialisasi per target tetap aktif.
- Endpoint create_staff/staff_update/staff_reset_password/staff_delete tanpa JWT semuanya ditolak HTTP 401.
- Runtime versi final juga menjawab OPTIONS HTTP 204 dengan Access-Control-Allow-Origin yang tepat untuk loopback proxy 127.0.0.1:8081 dan sikapandawa.com; tidak perlu mengubah aturan CORS hosting/lokal.
- Tidak membuat/menghapus akun asli atau mereset password asli untuk QA. Lifecycle mutasi lengkap diuji dengan fixture lokal. Pengguna dapat menjalankan operasi asli yang dikehendaki melalui panel.

Cadangan sebelum deploy: `release/staff-teacher-preview/before-school-teacher-crud-deploy-20261018.json`. Bukti hasil: `school-teacher-crud-deployment-20261018.json` di folder yang sama.

## Integritas

Baseline terbaru: 29 Auth users, 29 profiles, 29 player_progress, 290 level_progress, 23 Jejak runs, 3 observasi monitoring, 4 membership staf. Jumlah dan digest seluruh kumpulan tersebut identik sebelum/sesudah penerapan. Digest Auth dihitung di server tanpa mengekspor password/token/isi Auth; deploy tidak mengubah password atau metadata akun. Advisor tidak menambah temuan dibanding baseline.

Temuan advisor yang sudah ada tidak diubah dalam scope ini: [RLS tanpa policy pada tabel internal/service-only](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [RPC SECURITY DEFINER yang sengaja memeriksa actor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), dan [leaked-password protection belum aktif](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Verifikasi build final

Source frontend tidak berubah setelah run final berikut sehingga tidak mengulang test yang sama hanya untuk finalisasi backend:

| Pemeriksaan | Hasil |
| --- | --- |
| Full unit | 345 test / 47 file lulus |
| Coverage | Statements 92,73%; branches 83,87%; functions 88,63%; lines 95,43% |
| Full Chromium E2E | 50 lulus, termasuk master, school CRUD guru/siswa, forum, login guru/ortu, monitoring, grafik, dan game |
| PostgreSQL staf/monitoring | 172 + 39 pemeriksaan lulus |
| TypeScript, build produksi, syntax bundle Edge, diff check | Lulus |
| axe pengelolaan akun | 18 audit × mode/viewport; nol pelanggaran otomatis, 0 pageerror |
| Server lokal | /, /admin/, /form/, /guru/ dapat diakses pada port 5173 |

Chromium diuji pada 390/768/1366px untuk CRUD guru; menu game juga diuji landscape. Screenshot ditinjau manual. Baseline visual otomatis untuk layout baru belum tersedia; hasil visual regression otomatis INCONCLUSIVE. Tidak mengklaim seluruh WCAG, screen-reader, Firefox/Safari, atau Core Web Vitals produksi terverifikasi.

## Lokasi uji

- Game: http://127.0.0.1:5173/
- Admin: http://127.0.0.1:5173/admin/
- Portal ortu/guru: http://127.0.0.1:5173/form/
- Tautan lama /guru/ mengalihkan ke /form/.

Panel lokal normal terhubung ke Supabase asli. Preview fixture terisolasi tersedia melalui `/admin/?mockAdmin=1&mockRole=school` untuk UI guru dan `/admin/?mockAdmin=1&mockRole=master` untuk UI master; login fixture admin.demo dengan password uji local-test-only. Fixture tidak aktif dalam build produksi.

## Checklist penerimaan pengguna

Gunakan akun khusus uji bila ingin mencoba perubahan/hapus tanpa menyentuh akun siswa/pengelola yang sedang digunakan.

1. Master: buat admin sekolah/forum/guru, edit profil/username, reset password, konfirmasi hapus akun uji. Coba edit/reset akun sendiri dan periksa login ulang.
2. Admin sekolah: buat/edit/reset/hapus guru sekolahnya dan akun siswa sekolahnya; periksa sekolah terkunci serta akun sekolah lain tidak muncul.
3. Forum: periksa data lintas sekolah dan tidak ada menu kelola staf.
4. /form/: akun siswa membuka form ortu; akun guru membuka roster sekolah lalu form guru. Periksa logout dan login bergantian.
5. Monitoring: isi nomor periode/titik, simpan observasi kedua pada titik yang sama, pastikan keduanya tetap di riwayat. Lihat grafik ortu/guru dan detail siswa pada admin.
6. Game: Daftar/Masuk dan Monitoring di bawahnya; coba Jejak dan Misi, lalu periksa total serta aspek siswa di admin.
7. Sistem pakar: pasangan berasal dari nomor titik/aspek/periode yang sama, tanggal boleh berbeda; data belum cukup tetap diberi status itu. Aturan draft masih mengikuti kesepakatan sebelumnya dan belum dianggap instrumen pakar tervalidasi.

Paket final terbaru: `release/sikapandawa-final-v2-20261018.zip` (menghapus menu Catatan lama setelah data legacy testing dibersihkan). Paket final sebelumnya tetap disimpan. Isi ZIP langsung memiliki index.html, admin/, form/, guru/, dan aset; environment/source/migration tidak disertakan. Hash serta status backend ada di `release/staff-teacher-preview/package-final-v2-20261018.json`. Upload hosting dilakukan pengguna setelah uji penerimaan; backend tidak perlu diunggah lewat cPanel.

Pembaruan finalisasi hosting: data uji Arya / UNIMUS tetap dipertahankan sesuai permintaan pengguna pada periode 9001/9002 dengan label DATA UJI; rincian ada di `arya-monitoring-test-data-20261018.md`. Build dan TypeScript kembali lulus, dan seluruh isi ZIP v2 terbukti identik dengan build terbaru, sehingga tidak perlu membuat paket duplikat. Panduan upload tersedia di `docs/HOSTING_CPANEL.md`; bukti pemeriksaan ulang ada di `release/staff-teacher-preview/hosting-final-verification-20261018.json`. Hosting dan GitHub belum diubah.

## Evaluasi mandiri

| Sumbu | Skor | Bukti dan peningkatan |
| --- | --- | --- |
| Accuracy | 4 | v11/source/ACL/digest remote terverifikasi; mutasi Auth asli tidak dijalankan sekadar untuk smoke test. |
| Completeness | 4 | Backend aktif dan build final siap; uji penerimaan pengguna serta hosting memang tahap berikutnya. |
| Clarity | 4 | URL, status nyata vs fixture dan checklist dicatat; panduan operasional lintas sekolah dapat diperluas ketika dipakai. |
| Actionability | 4 | Paket frontend dan checklist dapat langsung dipakai; kredensial asli tetap dikelola pengguna. |
| Conciseness | 4 | Ringkasan pengguna fokus hasil dan tautan; detail audit di laporan. |

Rata-rata 4,0/5. Verdict: **SHIP untuk pengujian lokal pengguna**, backend aktif. Hosting belum diunggah. Tidak ada klaim uji penerimaan pengguna sudah selesai.
