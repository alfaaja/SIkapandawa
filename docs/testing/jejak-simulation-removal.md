# Penghapusan simulasi Jejak — 17 Oktober 2026

Pengguna memilih memainkan akun siswa secara manual dan meminta simulasi dihilangkan agar hanya data asli yang ditampilkan. Penghapusan data simulasi merupakan permintaan eksplisit pengguna; tidak ada reset password atau perubahan hasil permainan asli.

## Hasil

- **21 record** dengan `source_key='pkm-rekap-20261016'` dan `provenance='simulated'` dihapus dari Supabase. Verifikasi: seluruh tabel simulasi kini **0 record**.
- Backup lengkap sebelum penghapusan: `release/removed-simulation-20261017/backup.json`. SQL operasi tersimpan di folder yang sama. Catatan yang dihapus dapat dipulihkan operator dari backup jika diperlukan.
- Penghapusan dalam transaksi memeriksa hash payload simulasi yang sudah dipreview, jumlah yang dihapus harus tepat 21, dan hash data asli harus tetap sama. Schema/migration historis tidak dihapus atau diubah.
- Komponen, mode grafik, pemanggilan RPC simulasi, mock, styles, tipe, serta script generator/preview dilepas. Hanya grafik aktual v2 tetap aktif. Flag lama `mockSimulation=1` tidak mengaktifkan fitur lagi.
- Belum ada run v2 aktual pada verifikasi remote. Grafik menampilkan keterangan belum tersedia sampai siswa memainkan Jejak terbaru. Total lama dan koreksi AR tetap tersimpan.

## Preservasi remote

Hash sebelum dan sesudah sama:

| Data | MD5 |
|---|---|
| Profil | `96b690a3c1b832ee48420bc1ebe1f898` |
| Progres | `d245296a4d10c4eebd45861d8addb03a` |
| Level Misi | `8efde9bd22d288bc94409cb96675f94b` |
| Monitoring | `05d114faed908709f952535f14e038ee` |
| Run v2 | `d751713988987e9331980363e24189ce` |
| Audit koreksi | `456e44153a24434e39c876fc291bbd7d` |

## Verifikasi aplikasi

- Typecheck dan production build lulus.
- **49 unit test** pada controller, service, dashboard, grafik aspek dan filter sekolah lulus.
- **3 Playwright test** lulus: dashboard hanya data aktual walau memakai flag simulasi lama; grafik lima aspek/filter/responsif; actual Phaser play menghitung 10 jawaban dan lima hasil aspek berbeda.
- Tidak ada referensi simulasi dalam source `src/admin`. Diff check lulus.
- Code reviewer independen tidak menemukan blocker atau referensi aplikasi yang tertinggal. Review remote mengacu pada hasil verifikasi agent utama.
- Frontend tetap lokal. Build baru siap untuk dipaketkan/diunggah terpisah; tidak ada deployment atau commit.

## Password

Script lama `bulk-seed-students.mjs` membuat password acak unik untuk tiap akun yang dibuatnya. File catatan yang dirujuk script (`sikapandawa-player-credentials.csv.local` dan `sikapandawa-bulk-import-state.json.local`) tidak ditemukan dalam workspace. Tidak ada dasar untuk menyatakan seluruh siswa memakai satu password.

Password asli tidak dapat dibaca kembali dari Supabase Auth. Pengguna dapat mengatur password baru melalui aksi Reset password pada akun siswa di admin. Reset belum dilakukan karena permintaan saat ini hanya menanyakan password lama. Jangan menjalankan ulang script bulk seed atau injection untuk mencari password; script dapat membuat akun/mengubah progres.

## Evaluasi

| Kriteria | Skor | Bukti/batas |
|---|---:|---|
| Akurasi | 4/5 | Nol record simulasi dan hash data asli sama; password lama tidak tersedia untuk dipastikan. |
| Kelengkapan | 4/5 | UI/data simulasi dihapus dan backup tersedia; password membutuhkan catatan eksternal atau reset oleh pemilik. |
| Kejelasan | 4/5 | Status grafik asli dan kebutuhan bermain versi terbaru dijelaskan; schema historis tetap ada untuk reproduksi. |
| Dapat ditindaklanjuti | 4/5 | Admin lokal siap dan Reset password tersedia; reset memerlukan keputusan pemilik. |
| Keringkasan | 4/5 | Bukti teknis dicatat di sini agar jawaban pengguna tetap singkat. |
