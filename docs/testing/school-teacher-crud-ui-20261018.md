# CRUD guru oleh admin sekolah dan perapian pengelolaan akun

Status final: izin remote diberikan pada 18 Oktober 2026. Migration ini sudah aktif sebagai `20261018084659`, admin-users v11 ACTIVE, source cocok dan integritas data identik. Frontend tetap lokal untuk pengujian pengguna. Catatan pending di bawah merekam kondisi sebelum persetujuan; status terkini ada di `FINAL_LOCAL_HANDOFF_20261018.md`.

18 Oktober 2026. Pengguna meminta admin sekolah dapat CRUD akun guru sekolahnya dan UI pengelolaan akun dirapikan. Frontend/SQL/Edge terbaru selesai lokal. Backend aktif sebelumnya adalah admin-users v9; tambahan izin pada tahap ini masih menunggu persetujuan migration/deploy baru. Tidak ada perubahan akun, password, data siswa atau hosting remote pada tahap implementasi lokal ini.

## Perilaku

- School dapat create/list/edit nama serta username/reset password/delete teacher sekolahnya. Verifikasi actor/target berasal dari membership DB, bukan field sekolah dari browser. Teacher lintas sekolah, role master/school/forum, dan siswa ditolak dari endpoint staff. Batas master dan endpoint siswa lama dipertahankan.
- Handler memakai callback canManageStaff terverifikasi, lalu mutation port, claim operasi, serta RPC identity memeriksa ulang otorisasi. Lock per target dan pending audit tetap melindungi saga rename lintas actor/tab. Sekolah serta role akun tidak diubah oleh editor.
- UI school menyaring respons daftar sekali lagi ke teacher pada sekolah kanonisnya. School mendapat konteks Guru + nama sekolah sebagai teks, tanpa dropdown nonaktif yang memanjangkan form.
- Dialog membuka **Daftar guru/Daftar akun** terlebih dahulu dengan pencarian; **Tambah guru/Tambah akun** berada pada tab terpisah. Edit/reset/delete memakai satu tampilan fokus dengan **Kembali ke daftar**, tombol tutup tetap di kanan atas. Kartu dua kolom pada desktop dan satu kolom pada ponsel.
- Mutasi pending menonaktifkan navigasi, pencarian dan aksi lain; tombol tutup tetap tersedia. Guard programatik dan sequence mencegah penumpukan editor maupun respons async lama. Password dibersihkan sesudah operasi, ganti tampilan, kembali, dan tutup. Hapus meminta ketik username tepat; reset meminta konfirmasi.

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| RED awal | Handler/mock menolak CRUD school dengan 403; PostgreSQL menolak Staff target denied |
| Full unit/coverage | 345 test, 47 file lulus; statements 92,73%, branches 83,87%, functions 88,63%, lines 95,43% |
| PostgreSQL staf lokal | 172 lulus, termasuk school ownteacher CRUD, larangan target/actor lain, dan konflik claim master–school |
| PostgreSQL monitoring | 39 lulus; observasi tetap terpisah dan append-only |
| Chromium baru | Tiga lifecycle school CRUD pada 390/768/1366px lulus, 0 pageerror dan 0 HTTP 4xx/5xx |
| Full Chromium E2E | 50 test lulus dalam 1,7 menit |
| TypeScript, build, bundle syntax Edge | Lulus |
| Review source | Reviewer tidak menemukan isu actionable pada backend maupun UI; review read-only, bukan klaim reviewer menjalankan tes |
| axe lokal | 18 audit (6 mode × 3 viewport), 0 pelanggaran WCAG otomatis setelah perbaikan kontras tab/username; incomplete tetap perlu tinjauan manual |

Regresi pending create terbukti gagal sebelum guard dan lulus sesudahnya: pengguna tidak dapat membuka editor lain saat create belum selesai, sehingga completion tidak menumpuk daftar dan editor. Audit axe pertama menemukan kontras rendah pada tab nonaktif dan username; warna diperbaiki hanya pada pengelolaan staf. Script audit disajikan lewat route same-origin di browser terisolasi agar CSP aplikasi tetap berlaku; tidak menonaktifkan CSP aplikasi.

Full E2E mencakup seluruh alur admin/game/monitoring dan lulus. Screenshot terbaru pada `release/staff-teacher-preview/school-accounts-{390,768,1366}.png` dan `school-editor-{390,768,1366}.png`. Perbandingan visual otomatis terhadap baseline belum tersedia untuk layout baru (INCONCLUSIVE); screenshot ditinjau manual. Audit ini tidak mengklaim seluruh WCAG atau Core Web Vitals produksi terverifikasi; metrik performa produksi/screen-reader pass tidak dijalankan.

## Paket dan aktivasi

`release/sikapandawa-kelola-guru-ui-20261018.zip` berisi build frontend saja; metadata hash/ukuran/status pada `release/staff-teacher-preview/package-school-teacher-crud-ui-20261018.json`. Paket sebelumnya dipertahankan. Tambahan backend membutuhkan `20261018083408_school_teacher_account_management.sql` dan deploy admin-users baru melalui plugin Supabase. Version 9 dan dua migration sebelumnya tetap aktif; izin sebelumnya tidak dianggap otomatis mencakup perluasan school CRUD terbaru.

ZIP: 475 berkas, 40.639.400 byte, CRC valid; SHA-256 `f2cb8190f5142ac572198f623f2bea402d79d90051d4c23583645eba35c2024e`. Source/env tidak disertakan; pemindaian secret dan JWT nonpublik lulus.

Verdict: **SHIP untuk preview lokal**; aktivasi akun asli menunggu persetujuan remote. Tidak menguji reset/delete akun asli hanya untuk QA.

## Evaluasi mandiri

| Sumbu | Skor | Bukti dan peningkatan |
| --- | --- | --- |
| Accuracy | 4 | 345 unit, 172+39 DB dan audit lokal lulus; runtime backend terbaru belum aktif remote. |
| Completeness | 4 | School CRUD dan redesign lengkap; penerapan hak akses nyata menunggu persetujuan. |
| Clarity | 4 | Daftar/tambah/editor dipisah dan scope sekolah terlihat; panduan penggunaan dapat ditambahkan saat penyerahan sekolah. |
| Actionability | 4 | Preview dan ZIP siap ditinjau; satu migration dan Edge dibutuhkan untuk akun asli. |
| Conciseness | 4 | Penjelasan pengguna singkat; rincian verifikasi disimpan di laporan. |

Rata-rata 4,0/5. Prioritas berikutnya: penerapan backend setelah izin, baseline/integritas terbaru, dan verifikasi actor/ACL/source remote. Pengguna dapat memeriksa desain dengan screenshot; laporan membedakan hasil lokal dari backend yang telah aktif.
