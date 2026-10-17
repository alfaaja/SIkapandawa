# Koreksi rekap Jejak — 16 Oktober 2026

Status: **diterapkan dan diverifikasi di Supabase**. Pengguna mengonfirmasi koreksi AR/ADITYA 10 → 9, lalu secara terpisah menyetujui “Ya, terapkan perlindungan dan koreksi AR”. Frontend tetap lokal.

## Sumber dan batas data

Gambar pemilik `WhatsApp Image 2026-10-16 at 19.48.52.jpeg` memuat 21 total. Pencocokan read-only menemukan 20 total sudah cocok. Satu selisih adalah AR, username ter-normalisasi `aditya`, sekolah SDN Kalibanteng Kulon 01. Dua SA dipetakan ke Shakila dan Sean Arsenio; keduanya 10.

Total sumber 192/210, rata-rata 9,142857/10 (91,42857%). Ini cakupan 21 siswa dalam gambar, bukan seluruh akun sekolah. Pada audit terdapat 24 akun siswa sekolah tersebut; tiga akun lain bernilai nol, sehingga rata-rata seluruh 24 akun setelah koreksi adalah 8/10. Jangan mengganti denominator sekolah dengan 21 tanpa label/filter yang jelas.

Gambar tidak menyediakan jawaban per soal. Tidak dibuat run/jawaban/aspek palsu. Grafik ekspor hanya merekap total sumber, bukan bukti penerapan database atau grafik lima aspek.

## Temuan sinkronisasi

`ProgressSyncService.hydrate()` mengantrekan snapshot lokal sebelum membaca remote. `enqueueSnapshot()` dapat mengirim ulang skor lama 10. `mergeProgress()` juga mempertahankan maksimum lokal. Karena itu koreksi satu baris tanpa perlindungan server dapat dibatalkan oleh browser lama.

Rancangan lokal:

- Migration `20261016130801_jejak_verified_score_corrections.sql` membuat audit privat tanpa akses browser. Migration ini sendiri tidak mengubah nilai siswa. Filename disamakan dengan versi remote yang dikembalikan Supabase.
- Trigger baru berjalan sebelum guard monotonic, membatasi kenaikan tanpa run v2 baru untuk akun yang memiliki catatan koreksi. Replay total lama menjadi no-op tanpa menggagalkan antrean atau menaikkan revision.
- RPC v2 tetap invoker/RLS, memvalidasi dan menyimpan run sebelum memperbarui total. Run baru yang sah dapat menaikkan nilai terbaik kembali; retry run sebelum koreksi tidak membukakan batas tersebut.
- `scripts/sql/correct-jejak-score.template.sql` adalah operasi terpisah. Target ditentukan oleh username + sekolah + non-admin, dengan pemeriksaan nilai/revision lama. Seluruh operasi atomik, snapshot disimpan privat, hanya dua trigger lama dinonaktifkan sementara di bawah lock tabel, lalu diaktifkan kembali sebelum commit. Hash profil, Misi, monitoring, run v2, dan progres siswa lain diperiksa tidak berubah.
- AR: koreksi 10 → 9; legacy aspek lama seluruhnya 2 dihapus menjadi NULL karena bertentangan dengan total yang dikoreksi dan tidak tersedia jawaban sumber. Snapshot sebelum koreksi tetap disimpan untuk audit. Tidak ada run v2 AR saat preflight.

Snapshot read-only dan SQL yang sudah diisi tersedia lokal di folder diabaikan Git `release/jejak-restoration-20261016/`. Preflight: revision AR 18. Bila berubah sebelum eksekusi, operasi harus berhenti dan dipreview ulang; jangan melewati pemeriksaannya.

## Verifikasi

RED: test awal gagal karena tabel `private.jejak_score_corrections` belum ada. Kesalahan fixture (display name/role insert) diperbaiki terlebih dahulu, tidak dihitung sebagai bukti RED fitur.

GREEN:

- `scripts/test-jejak-correction.mjs`: **19 pemeriksaan PostgreSQL lulus**. Termasuk SQL operasi yang sama, revision berbeda ditolak, pengulangan koreksi ditolak, replay legacy/direct UPDATE/UUID run lama tidak menaikkan skor/revision, snapshot audit akurat, semua guard kembali aktif, UUID konflik rollback, v2 baru 10 diterima, dan akun lain/Misi tetap sesuai.
- Jejak v2: 31 lulus; aspek lama: 27 lulus; monitoring: 41 lulus; sekolah: 27 lulus. Total **145 pemeriksaan PostgreSQL lulus** dengan seluruh migration lokal.
- Code reviewer independen tidak menemukan blocker prioritas tinggi; saran retry UUID lama ditambahkan dan lulus.
- Grafik PNG diperiksa visual; SVG juga tersedia. 21 batang, jumlah 192, rata-rata 9,14. Tidak ada perubahan frontend, deployment, atau commit pada pekerjaan koreksi ini.

Rujukan resmi diperiksa: [keamanan fungsi](https://supabase.com/docs/guides/database/functions), changelog 16 Oktober 2026 dan [upgrade minor PostgreSQL](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). Perubahan terkait ltree/pgcrypto/operator tidak dipakai dalam migration ini.

## Hasil penerapan remote

Kedua operasi menggunakan plugin Supabase `apply_migration`, masing-masing mengembalikan `success: true`:

1. `20261016130801_jejak_verified_score_corrections`.
2. `20261016130810_correct_aditya_jejak_best_from_source`. SQL data khusus lingkungan disimpan pada folder release yang diabaikan Git, tidak dijadikan seed atau migration berisi identitas siswa dalam source.

Preflight diulang tepat sebelum eksekusi dan masih revision 18, nilai 10, belum ada run v2. Setelah operasi: nilai 9, legacy aspek NULL, revision 19, timestamp `2026-10-16T13:08:10.914324Z`. Ketiga guard aktif normal. Snapshot sebelum koreksi dan alasan tersimpan dalam ledger privat. **21/21** nilai kini cocok sumber, jumlah **192**.

Hash sebelum–sesudah sama:

| Data | MD5 canonical JSON |
|---|---|
| Profil | `b465b6da590eb7884f3ff2c8be270001` |
| Misi/level | `13c2563f020bed38552dd92ca67b1602` |
| Monitoring | `05d114faed908709f952535f14e038ee` |
| Run Jejak v2 | `d751713988987e9331980363e24189ce` |
| Progres selain AR | `c7775014fdb927e74f8420710fb2e9ba` |

Tidak membuat submission game palsu di produksi untuk menguji fence; pengujian mutasi replay dilakukan pada PostgreSQL lokal terisolasi. Cache perangkat lama mungkin masih menampilkan 10 pada layar game lama, tetapi tidak dapat menaikkan kembali total server tanpa run v2 baru yang tervalidasi.

Security/performance advisor diperiksa sesudah penerapan. Satu INFO baru RLS tanpa policy pada tabel audit privat adalah deny-all yang disengaja: seluruh privilege browser/service_role dicabut. [Penjelasan linter RLS tanpa policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Peringatan lama [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [policy SELECT berganda](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies), dan [indeks belum dipakai](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index) tidak diubah dalam koreksi ini.

## Evaluasi hasil lokal

| Kriteria | Skor | Bukti dan batas |
|---|---:|---|
| Akurasi | 4/5 | 145 pemeriksaan lulus dan 21/21 total remote cocok sumber; rincian aspek historis tidak tersedia. |
| Kelengkapan | 4/5 | Backup, repair, fence, review, dan grafik selesai; layar game lama dapat masih memegang cache lokal 10. |
| Kejelasan | 4/5 | Total historis dibedakan dari rincian aspek yang tidak tersedia; alur koreksi memerlukan dua operasi database. |
| Dapat ditindaklanjuti | 4/5 | Grafik PNG/SVG, backup, dan receipt tersedia; grafik lima aspek memerlukan jawaban asli atau permainan v2 baru. |
| Keringkasan | 4/5 | Penjelasan utama singkat; detail audit dipindahkan ke dokumen ini. |
