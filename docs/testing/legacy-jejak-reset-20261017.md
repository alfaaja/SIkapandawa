# Reset skor Jejak lama — 17 Oktober 2026

Pemilik meminta reset skor Jejak lama, setelah menyimpan rekap sebelumnya dan memainkan ulang beberapa siswa. Permintaan ini mengotorisasi reset database; tidak ada deployment frontend.

## Hasil

- **16 siswa** dengan skor Jejak positif tetapi tanpa satu pun run versi 2 direset ke 0. Rincian aspek legacy mereka dikosongkan.
- **5 siswa** yang sudah mempunyai run versi 2 dipertahankan seluruh row progres dan jawaban: ananta.ventin 10, Fahmi 7, sean.arsenio 10, cakawala.vela 10, nesia.malinia 10.
- Inventaris awal menemukan dua run dan 19 target; siswa terus dimainkan selama persiapan. Snapshot pertama yang akan diterapkan ditolak karena sudah berubah. Snapshot terbaru disimpan sebelum transaksi berhasil, dengan lima run dan 16 target. Tidak ada reset terhadap run terbaru.
- Admin serta siswa yang sudah bernilai 0 tidak disentuh. Seluruh profil, level/bintang Misi, status pembukaan Jejak, intro, monitoring dan jawaban v2 dipertahankan.
- Ledger koreksi yang sudah ada dipakai agar replay total dari cache legacy tidak menaikkan lagi nilai yang direset. Audit AR terdahulu tetap menyimpan snapshot awal; alasan menyertakan nilai dan waktu koreksi sebelumnya. Permainan v2 baru tetap dapat menaikkan nilai sesuai jawaban nyata.

## Backup dan transaksi

Backup yang dipakai: `release/legacy-jejak-reset-20261017/backup-02.json` (diabaikan Git). SHA256: `569D89DF6AF5714D63471CD0E235767AE14D04025552E61A75E8AA85827C9390`.

Backup awal yang tidak diterapkan tetap ada sebagai `backup.json`. SQL operasi final disimpan pada folder `supabase/migrations/` di dalam folder backup, dibuat lewat Supabase CLI. Operasi remote menggunakan plugin Supabase `apply_migration`, nama `reset_legacy_jejak_preserve_v2`, karena dua trigger bernama dinonaktifkan sementara dalam transaksi eksklusif. Trigger kembali aktif sebelum commit. Tidak ada definisi schema/RLS/function yang diganti.

`scripts/sql/reset-legacy-jejak.template.sql` memeriksa hash progres/run/audit dan jumlah target setelah lock. Setiap siswa dengan run apa pun dikecualikan. Pemeriksaan akhir membandingkan seluruh row non-target, kolom non-Jejak pada target, dan hash Misi/profil/monitoring/run. Perubahan tak terduga membatalkan transaksi.

## Verifikasi

- **20 pemeriksaan PostgreSQL lokal** lulus (`scripts/test-legacy-jejak-reset.mjs`): pengecualian dua siswa versi baru dan admin, snapshot stale, rollback, replay cache, permainan v2 setelah reset, preservasi audit dan Misi, serta tiga trigger tetap aktif.
- Reviewer agent tidak menemukan blocker; backup diselesaikan sebelum eksekusi.
- Verifikasi remote: skor legacy positif tersisa **0**, ledger reset **16**, trigger aktif **3**, kelima skor v2 tetap 10/7/10/10/10.
- Hash seluruh run sesudah reset sama dengan snapshot sebelum reset: `544ab2f6901c58a93ca95d24776447e4`.
- Cache game lokal mungkin masih menampilkan total lama, tetapi tidak dapat menaikkan nilai database yang direset. Admin membaca nilai terbaru setelah Segarkan.

## Evaluasi hasil

| Kriteria | Nilai | Bukti / penyempurnaan |
| --- | --- | --- |
| Akurasi | 5 | Seluruh perubahan dan pengecualian diverifikasi dalam transaksi serta lewat pembacaan remote. |
| Kelengkapan | 5 | Skor lama direset, hasil baru dilindungi, backup dan fence cache tersedia. |
| Kejelasan | 4 | Jumlah target berubah karena pengguna terus bermain; hasil akhir dicatat tegas sebagai 16 reset/5 dipertahankan. |
| Dapat digunakan | 5 | Database sudah diperbarui; admin cukup disegarkan. |
| Ringkas | 4 | Operasi memakai ledger/guard yang ada, tetapi snapshot ulang diperlukan untuk menghindari kehilangan hasil baru. |

Rata-rata 4,6/5. Perbaikan berikutnya: untuk operasi serupa, lakukan pengambilan snapshot dan penerapan segera setelah review agar jeda lebih singkat; pertahankan penolakan snapshot stale. Penilaian sesuai kebutuhan pengguna karena hanya Jejak lama yang direset dan siswa yang baru dimainkan tetap aman.
