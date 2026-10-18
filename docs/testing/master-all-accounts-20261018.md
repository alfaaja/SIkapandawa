# Master mengelola seluruh jenis akun

Status terbaru: backend diaktifkan dengan persetujuan pada 18 Oktober 2026. Dua migration serta admin-users v9 sudah aktif; data/kredensial sebelum–sesudah identik. Lihat `master-crud-deployment-20261018.md`. Catatan lokal di bawah merekam kondisi sebelum izin penerapan diberikan.

18 Oktober 2026. Koreksi scope pengguna: CRUD pada master mencakup admin sekolah, guru, forum, serta siswa melalui tab Siswa. Kartu master sendiri menyediakan edit profil/username dan reset password; hapus master tidak disediakan dan ditolak backend agar pengelolaan tidak terkunci. Setelah edit/reset akun sendiri, aplikasi logout dan meminta login ulang. Role dan sekolah tidak berubah melalui editor; maksimal satu admin sekolah per sekolah tetap berlaku.

Perubahan tetap lokal sesuai pilihan pengguna sebelumnya. Migration `20261018080114_master_staff_crud.sql` masih belum pernah diterapkan remote sehingga definisinya diperbarui sebelum rilis; tidak membuat histori migration remote palsu atau mengubah migration yang sudah diterapkan. Dua migration lokal dan Edge terbaru tetap perlu diterapkan setelah persetujuan terpisah. Tidak ada data/kredensial asli yang diubah untuk pengujian.

## Verifikasi

- RED: dua tes UI/mock baru gagal pada pembatasan lama (school ditolak, tombol master/school tidak tersedia).
- GREEN: 48 tes terkait UI/mock/handler lulus; 143 pemeriksaan PostgreSQL lokal lulus. Pemeriksaan meliputi CRUD school, profil master tetap role master, larangan hapus master, akses nonmaster ditolak, sekolah tetap sama setelah rename, serialisasi mutasi per akun, dan observasi/progres siswa tetap utuh setelah hapus guru.
- Lima E2E Chromium lulus: lifecycle admin sekolah, guru, forum (create/edit/reset/delete), perubahan profil master dan reset password master diikuti login ulang. Screenshot school/teacher desktop serta forum mobile tersedia di release/staff-teacher-preview.
- TypeScript dan build produksi lulus. Full unit 339 test dan coverage 92,76% statements berasal dari tahap sebelumnya; perubahan scope ini menjalankan ulang 48 tes terkait, bukan mengklaim coverage baru.
- Code-reviewer meninjau perluasan otorisasi, handler, UI, logout sendiri, dan claim per target. Tidak ditemukan blocker. Review source read-only, tidak menjalankan ulang tes atau menyentuh remote.

Paket terbaru `release/sikapandawa-master-semua-akun-20261018.zip`. Metadata hash, ukuran dan status backend disimpan pada `release/staff-teacher-preview/package-master-all-accounts-20261018.json`. Screenshot bukti: `master-school-crud.png`. Paket sebelumnya tetap tersedia.

## Evaluasi mandiri

| Sumbu | Skor | Bukti dan peningkatan |
| --- | --- | --- |
| Accuracy | 4 | Scope diperbaiki dengan 48 unit/143 DB/5 E2E; Auth remote belum diuji karena belum disetujui deploy. |
| Completeness | 4 | Semua jenis akun tercakup; penghapusan master ditahan agar akses terakhir tetap ada, sesuai penjelasan pengguna. |
| Clarity | 4 | Tombol konsisten pada kartu admin sekolah/guru/forum/master, dengan konfirmasi hapus dan pesan login ulang. Panduan operasional remote masih perlu saat deploy. |
| Actionability | 4 | ZIP dan screenshot siap, aktivasi backend asli tetap pending sesuai keputusan simpan lokal. |
| Conciseness | 4 | Penjelasan akhir fokus pada koreksi scope; rincian verifikasi dipisahkan dalam laporan. |

Rata-rata 4,0/5. Prioritas lanjutan: verifikasi remote hanya ketika pengguna mengizinkan penerapan. Pengguna dapat menilai perluasan lewat screenshot dan preview lokal; tidak ada klaim CRUD asli sudah aktif.
