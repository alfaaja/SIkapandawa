# Verifikasi akses staf, guru, dan perbandingan monitoring

Tanggal: 17 Oktober 2026. Status: dua migration dan Edge `admin-users` versi 8 sudah diterapkan ke Supabase remote setelah persetujuan pengguna. Frontend dan ZIP tetap lokal; hosting belum diunggah. Data contoh QA terisolasi dari akun siswa asli.

## Hasil pemeriksaan

| Pemeriksaan | Hasil |
| --- | --- |
| TypeScript `tsc --noEmit` | PASS |
| Build Vite produksi | PASS; entry game, admin, form, guru |
| Vitest `run --coverage --pool=forks` | PASS; 311 tes, 45 berkas |
| Coverage statements / branches / functions / lines | 93,33% / 83,48% / 88,82% / 95,49%; ambang tetap 80% |
| PostgreSQL lokal akses staf | PASS; 74 pemeriksaan |
| PostgreSQL lokal monitoring guru/periode | PASS; 39 pemeriksaan |
| Regresi PostgreSQL Jejak v2 / koreksi / parent / sekolah | PASS; 31 / 19 / 41 / 27 pemeriksaan |
| E2E Chromium | 33 kasus terverifikasi melalui run utama dan run ulang terkait; kegagalan selector tab lama diperbaiki, 7 kasus terkait lalu 5 kasus role/guru lulus |
| Tinjauan visual | Ringkasan desktop, dialog akun seluler, dan rincian alasan perbandingan ditinjau |
| Diff whitespace | PASS; Git hanya memberi peringatan konversi LF/CRLF Windows |
| ZIP | PASS; 475 berkas, empat entry HTML, CRC valid, tanpa source SQL/TS/map/env; pemindaian secret key dan JWT non-publik lulus |

Beberapa worker Vitest gagal membaca berkas di sandbox Windows sebelum menjalankan kasus. Run final di luar pembatasan pembacaan worker berhasil dengan fork. Sebuah berkas tes mock lama sempat tertimpa saat menambah tes role: berkas lama telah dipulihkan dari HEAD tanpa perubahan isi; enam tes role baru ditempatkan di `AdminMockBackend.roles.test.ts`. Run final 311 tes mencakup keduanya. Threshold coverage tidak diturunkan.

## Penerimaan fitur

- Master hanya berasal dari membership admin Sikapandawa yang telah dipercaya; signup/username tidak dapat menaikkan role.
- Master membuat school/forum/teacher; forum melihat dan mengelola siswa lintas sekolah tanpa kewenangan membuat staf. Admin sekolah hanya mengelola siswa sekolahnya, termasuk melalui raw REST/RPC dan Edge.
- Unique constraint membatasi satu admin per sekolah kanonis. Pembuatan Auth dan membership staf atomik; temuan reviewer tentang jeda staf terbaca sebagai siswa telah ditangani dan diuji. Review independen setelah perbaikan belum tersedia karena batas penggunaan agent; pemeriksaan PostgreSQL tambahan menguji race/constraint dan metadata palsu.
- Guru memakai akun dan sesi terpisah di `/guru/`; orang tua memakai akun siswa di `/form/`. Kedua sumber append-only dan tidak saling menimpa.
- Grafik memakai sumber dan periode terpilih; pengisian berulang dirata-ratakan per siswa sebelum rata-rata sekolah. Data N/A tidak dihitung sebagai nol.
- Perbandingan berpasangan menurut siswa, aspek, titik, dan periode. Tanggal boleh berbeda. Data historis tanpa periode disimpan sebagai `legacy`, tidak ditebak.
- Aturan forward chaining `draft-1` menjelaskan R0–R3, status belum cukup, dan kebutuhan klarifikasi. Batas awal perlu validasi dosen/pakar; hasil tidak menetapkan manipulasi.
- Ringkasan, Siswa, Aspek, dan Monitoring menjadi tab agar halaman All tidak menumpuk seluruh grafik sekaligus.

Tidak ada reset/progres/credential siswa asli yang dijalankan dalam implementasi ini. Migration ini mempertahankan catatan monitoring lama dan skor game. Pengguna menyetujui dua migration dan deploy Edge sebelum penerapan, sesuai instruksi repo bagian 2.

## Verifikasi sesudah deploy Supabase

- Remote migration `20261017091712_staff_school_access` memuat SQL lokal `20261017084335_staff_school_access.sql`; `20261017091740_teacher_monitoring_comparison` memuat SQL lokal `20261017084429_teacher_monitoring_comparison.sql`. Tool Supabase menetapkan timestamp remote; pemetaan ini tidak mengubah isi SQL.
- Edge `admin-users` naik dari versi 7 ke 8, status ACTIVE. `verify_jwt=true` dipertahankan. Seluruh delapan berkas TypeScript yang diambil kembali dari remote cocok dengan source lokal.
- Sebelum/sesudah: 26 Auth users, 26 profil, 26 progres, 260 rincian level, 23 run Jejak, dan 3 catatan monitoring. Seluruh digest isinya cocok, mengabaikan tiga kolom metadata monitoring yang baru ditambahkan. Catatan lama berstatus sumber `parent`, periode `legacy`.
- Klaim JWT master diuji dalam transaksi read-only yang diakhiri rollback: `staff_access` menghasilkan master, daftar staf berisi satu akun, RLS menampilkan 25 siswa (akun master dikecualikan), RPC aspek dan kedua sumber monitoring dapat dibaca.
- Klaim siswa yang ada diuji dalam transaksi rollback: hanya satu profil miliknya terlihat, konteks parent berhasil, akses staf/list-staf/guru ditolak. Semua policy RLS aktif; index unik sekolah dan provisioning staf atomik tersedia; browser tidak dapat memanggil RPC service-only.
- Jalur proxy lokal ke Edge terpasang berhasil: empat permintaan tanpa kredensial (`create`, `update`, `reset_password`, `delete`) ditolak 401, tidak ada request gagal. Login `/form/` juga lolos pemeriksaan fokus keyboard.
- Tab admin lokal versi terbaru dibuka ke halaman login. Pengujian create akun staf nyata melalui Auth belum dilakukan karena tidak ada akun baru nyata yang diminta; kontrak pembuatan dan duplikat sekolah diuji di PostgreSQL lokal/handler/E2E terisolasi.
- Advisor tidak menghasilkan ERROR. Peringatan RPC SECURITY DEFINER pada `staff_access` dan `admin_list_staff` disengaja: hanya metadata caller atau daftar yang digate master, tanpa grant ke anon. Lihat [penjelasan advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Tabel internal tanpa policy bersifat default-deny. Pengaturan [leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) masih nonaktif dan tidak diubah dalam scope ini.
- Bukti aggregate/ACL tersimpan di `release/staff-teacher-preview/deployment-evidence.json`; salinan Edge sebelumnya tetap tersedia untuk pemulihan. Tidak ada akun contoh atau data pengamatan palsu ditambahkan ke remote.

## Artefak lokal

- `release/sikapandawa-admin-guru-pakar-20261017.zip` — frontend produksi, 40.635.713 byte.
- SHA-256: `0fda818a6873bce9c5c00b204ccad4516a260fb1e43f4acd50585d44081c778d`.
- `release/staff-teacher-preview/` — screenshot data uji dan metadata paket.
- Preview development: `http://127.0.0.1:5173/admin/?mockAdmin=1`; data contoh ditandai di UI dan tidak masuk Supabase.
- Backend remote sudah aktif. Frontend tetap lokal sampai diminta unggah; ZIP frontend tidak berubah akibat deploy backend.

## Evaluasi mandiri

### Penyesuaian dropdown dan preview guru — 17 Oktober 2026

Kolom sekolah pada dialog staf kini berupa select wajib dari sekolah kanonis yang ada pada siswa atau staf. Opsi “Tambah sekolah baru” menampilkan input wajib terpisah; saat forum dipilih, kedua field scope dinonaktifkan. Sekolah baru yang berhasil dibuat ditambahkan ke opsi dialog. Keterangan membedakan satu admin sekolah dengan beberapa akun guru. Tes baru dibuktikan gagal sebelum implementasi, lalu 12 tes dialog, TypeScript, build, dan 6 E2E role/guru berhasil. E2E tambahan memeriksa dropdown 12 titik, kelima aspek, pilihan siswa, dan layout ponsel; contoh form guru dibuka di browser tanpa menyimpan pengamatan ke remote.

Paket terbaru: `release/sikapandawa-admin-guru-dropdown-20261017.zip`, 40.635.923 byte; SHA-256 `f231c1d5d9757a2b93a1c69c263da464a4eddf078bcb3e81157253c33b69a906`. Paket sebelumnya dipertahankan. Screenshot form desktop/ponsel berada di `release/staff-teacher-preview/teacher-form-desktop.png` dan `teacher-form-mobile.png`. Perubahan ini hanya frontend lokal, tanpa migration atau deploy Edge tambahan.

Evaluasi penyesuaian: accuracy 4/5 (12 unit dan 6 E2E lulus; select native belum diperiksa lintas browser selain Chromium), completeness 4/5 (dropdown dan preview guru tersedia; akun guru nyata tetap perlu dibuat oleh master), clarity 4/5 (alur dan scope dijelaskan; preview memakai nama siswa contoh), actionability 4/5 (tab form terbuka dan ZIP terbaru siap; hosting belum diminta), conciseness 4/5 (penjelasan pengguna ringkas, detail bukti dipisahkan dalam laporan). Rata-rata 4,0/5. Perbaikan berikutnya: uji akun guru nyata saat master membuat akun yang dibutuhkan; periksa browser tambahan bila menjadi target. Pengguna dapat melihat alur dan bentuk form sekarang; serahkan hasil lokal.

Ringkasan: 4,0/5; frontend lokal dan backend remote terverifikasi, pengujian create staf nyata serta validasi pakar masih terbuka.

| Aspek | Nilai | Bukti dan perbaikan berikutnya |
| --- | --- | --- |
| Accuracy | 4/5 | 311 tes dan 231 pemeriksaan PostgreSQL lokal lulus; source Edge remote cocok dan RLS/RPC nyata diuji, tetapi create staf Auth nyata belum diuji. Verifikasi ketika pengguna membuat akun staf yang diperlukan. |
| Completeness | 4/5 | Ketujuh permintaan diimplementasikan dan Supabase diaktifkan; batas aturan menunggu dosen. Tuntaskan tinjauan aturan, hosting hanya jika diminta. |
| Clarity | 4/5 | Matriks role, periode, sumber, dan alasan R0–R3 tersedia; belum ada panduan bergambar bagi operator sekolah. Tambahkan bila dibutuhkan saat penyerahan. |
| Actionability | 4/5 | Frontend lokal, ZIP valid, dan backend aktif tersedia; halaman lokal meminta login pengguna. Masuk sebagai Sikapandawa untuk membuat akun staf yang sebenarnya dibutuhkan. |
| Conciseness | 4/5 | Final pengguna dibatasi hasil, tautan, dan izin remote; laporan teknis sengaja terpisah. Hindari mengulang rincian tes dalam percakapan. |

Prioritas: (1) pengguna menguji pembuatan akun staf nyata yang diperlukan, (2) validasi batas aturan dengan dosen. Tidak ada sumbu ≤2. Pengguna dapat masuk lewat frontend lokal untuk mencoba backend aktif. Verdict: serahkan frontend lokal dengan backend yang sudah diterapkan; hosting tetap menunggu instruksi.
