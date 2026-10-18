# Monitoring terpadu dan pembuatan guru per sekolah

17 Oktober 2026. Frontend dan backend baru selesai diuji lokal. Belum ada penerapan migration baru, deploy Edge baru, upload hosting, push, atau perubahan data pengguna pada tahap ini.

## Hasil

- Admin sekolah mendapat **Kelola guru**, hanya dapat membuat role teacher pada sekolah yang ditetapkan server. Daftar akun hanya berisi guru sekolahnya. Master mempertahankan akses pembuatan school/forum/teacher. Satu sekolah tetap maksimal satu admin sekolah, tetapi boleh beberapa guru.
- `/form/` menyediakan satu login. Identitas terverifikasi dan RPC server mengarahkan siswa ke pengamatan orang tua dan guru ke roster sekolahnya. Admin/forum/master ditolak pada portal monitoring. Metadata browser tidak menentukan role. Sesi portal terpisah dari game/admin; logout mengakhiri sesi monitoring bersama.
- `/guru/` mengalihkan ke `/form/` sambil mempertahankan query tautan lama. Observasi ortu/guru dan riwayat append-only tetap terpisah.
- MainMenu memuat Daftar, Masuk, Monitoring. Tombol baru menggunakan grafis pixel native Phaser, warna ungu, dan font Press Start 2P yang dipakai game. Monitoring juga tersedia pada LevelSelect untuk sesi siswa yang masih tersimpan.

## Verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| PostgreSQL lokal `test-staff-access.mjs` | 87 lulus, termasuk claim audit, atomic Auth provisioning, role/school tampering, rollback, ACL, dan daftar guru scoped |
| RED migration | Baseline tanpa migration baru menolak pembuatan guru oleh school dengan Master access required |
| PostgreSQL lokal `test-teacher-monitoring.mjs` | 39 lulus |
| Full unit/coverage | 332 test pada 47 file lulus; statements 92,96%, branches 84,22%, functions 87,97%, lines 95,38% |
| Full Chromium E2E sebelum perbaikan reviewer | 41 lulus |
| Focused Chromium E2E setelah perbaikan reviewer | 5 lulus: pembuatan guru scoped, menu game pada dua viewport, redirect lama, dan sesi siswa tersimpan |
| TypeScript dan build produksi terakhir | Lulus setelah helper tombol bersama dan LevelSelect diperbarui |
| Bundle syntax Edge | Lulus dengan esbuild; import Deno jsr/npm eksternal |
| Diff whitespace | Lulus; Git hanya memberi pemberitahuan konversi LF/CRLF |
| ZIP | 475 file; CRC valid; empat entry HTML; source/env tidak disertakan; pemindaian secret dan JWT nonpublik lulus |

Code-reviewer menemukan akses Monitoring hilang saat MainMenu otomatis melewati login tersimpan. Perbaikan menambahkan tombol bersama pada LevelSelect, diuji lewat klik mouse browser asli pada sesi terisolasi. Reviewer meninjau delta kembali tanpa isu actionable. Reviewer meninjau source secara read-only; hasil tes di atas dijalankan agent utama.

Pengujian memakai PostgreSQL dan data contoh lokal. Belum ada smoke test pembuatan akun asli terhadap backend remote terbaru karena penerapannya memerlukan persetujuan. Browser QA di tahap ini mencakup Chromium; tidak ada klaim verifikasi Firefox/Safari.

## Paket dan penerapan

`release/sikapandawa-monitoring-terpadu-20261017.zip` berisi build frontend, 40.637.098 byte. SHA-256: `858aafa8d2081e20bab8b021f03ba7d730a25429a0c8b8270305e978ceb7d65c`.

Bukti visual di `release/staff-teacher-preview/`: `main-menu-monitoring-1366.png`, `main-menu-monitoring-844.png`, `level-select-monitoring.png`, dan `school-teacher-management.png`. Metadata `package-unified-monitoring.json` menandai backend baru belum diterapkan.

Backend remote sebelumnya adalah admin-users v8 dan dua migration staf/monitoring yang sudah disetujui. Fitur pembuatan guru oleh admin sekolah membutuhkan persetujuan baru untuk `20261017105713_school_teacher_provisioning.sql` dan deploy admin-users terbaru. Migration baru mengganti fungsi otorisasi/provisioning; tidak mengubah skor atau catatan siswa. Setelah persetujuan, ambil baseline dan backup remote terbaru, terapkan melalui plugin Supabase, lalu verifikasi privileges, sumber Edge, dan integritas data sebelum menyatakan aktif. Frontend tetap lokal sampai pengguna mengunggah paket.

## Evaluasi mandiri

Hasil lokal memenuhi tiga permintaan; aktivasi backend remote masih menunggu izin. Nilai keseluruhan 4,0/5.

| Sumbu | Skor | Bukti dan perbaikan |
| --- | --- | --- |
| Accuracy | 4 | 332 unit, 87+39 DB, build dan E2E lulus; verifikasi remote setelah deploy masih diperlukan. |
| Completeness | 4 | Tiga alur diterapkan, termasuk sesi siswa tersimpan; backend baru belum aktif remote karena batas persetujuan repo. |
| Clarity | 4 | Label Kelola guru dan login tunggal menjelaskan peran; petunjuk penyerahan akun dapat dilengkapi saat sekolah mulai memakai. |
| Actionability | 4 | ZIP dan preview lokal siap ditinjau; penerapan remote adalah langkah berikutnya yang membutuhkan persetujuan. |
| Conciseness | 4 | Hasil singkat untuk pengguna, detail teknis dalam laporan; laporan mempertahankan rincian test agar tidak menyamakan scope full/focused run. |

Prioritas: aktivasi backend setelah persetujuan, verifikasi integritas remote, lalu upload frontend oleh pengguna. Pengguna dapat memeriksa ketiga perubahan pada preview dan screenshot; penilaian ini tidak menganggap remote sudah selesai.
