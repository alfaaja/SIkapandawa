# Rapor aspek Jejak per siswa — 17 Oktober 2026

Permintaan: koreksi “sontekan” menjadi “contekan”, hilangkan lima label aspek dari hasil permainan, dan tampilkan meter aspek dalam detail rapor siswa di admin.

## Perubahan

- Ejaan soal diperbaiki tanpa mengganti ID/kunci/kategori.
- Layar hasil Jejak tetap menampilkan total, predikat, pesan, kembali dan ulangi. `recordJejakResult` tetap menerima seluruh jawaban sebelum perpindahan scene.
- Bagian **Aspek Jejak Pandawa** berada setelah kartu Level 1–10 dalam rapor siswa. Lima meter kuning/oranye menunjukkan nilai terbaik masing-masing aspek, 0–2 poin. Nilai 0 ditampilkan sebagai nol, bukan data kosong.
- Pembacaan menggunakan tabel aktual `jejak_aspect_runs`, filter UUID siswa dan kurikulum 2. Setiap aspek diurutkan numerik menurun di server dan diambil satu maksimum, sehingga tidak terpotong batas halaman 1.000 row. Hasil divalidasi integer 0–2; tidak ada perhitungan dari total lama. Semua SELECT tunduk pada RLS yang sudah ada.
- Jika belum ada run, admin memberikan keterangan rincian belum tersedia dan mempertahankan ringkasan total lama. Nilai terbaik aspek dapat berasal dari run berbeda, konsisten dengan grafik sekolah.
- Tidak ada migration, perubahan akun/nilai, atau deployment pada pekerjaan ini. Frontend tetap lokal.

## Verifikasi

1. RED: tiga pengujian awal gagal karena belum ada metode pembacaan/meter; 16 pengujian lama tetap lulus.
2. GREEN: 73 pengujian terarah, kemudian seluruh **270 unit test dalam 39 file** lulus. Coverage: statements 91,71%, branches 80,49%, functions 86,62%, lines 94,46%.
3. `tsc --noEmit` dan build production lulus. `git diff --check` tanpa error whitespace.
4. Tiga E2E Chromium lulus: grafik aktual, rapor meter desktop/390px termasuk nilai nol/kosong, dan bermain sepuluh kartu Phaser. Hasil game hanya total 6/10, sementara sepuluh jawaban unik tetap terkirim dengan rincian 2/0/1/2/1.
5. Screenshot desktop, mobile, dan hasil game ditinjau visual. Data screenshot otomatis merupakan fixture browser terisolasi, bukan nilai siswa asli.
6. Pemeriksaan read-only pada panel lokal yang sudah login: rapor ANANTA berhasil memuat kelima meter dari data aktual, masing-masing 2/2; ringkasan Misi 16/30 dan Jejak 10/10 tetap ada. Tidak ada permainan atau perubahan data asli dilakukan dalam pengujian ini.
7. Reviewer agent tidak menemukan temuan actionable pada pemilihan maksimum, RLS, validasi data, maupun preservasi jawaban.

Catatan proses: satu proses coverage lama bertabrakan dengan keluaran proses coverage kedua (`coverage/.tmp`). Proses kedua selesai dengan seluruh pengujian dan threshold coverage lulus. Percobaan E2E awal dalam sandbox dihentikan; pengujian lokal dengan izin eksekusi browser berhasil. Hasil di atas merujuk proses yang selesai dengan exit code 0.

Paket `release/sikapandawa-meter-jejak-20261017.zip` berisi 472 file build dengan root game, admin dan form. Integritas ZIP dan pengecualian source/env/SQL diperiksa. Belum diunggah ke hosting.

## Evaluasi hasil

| Kriteria | Nilai | Bukti / penyempurnaan |
| --- | --- | --- |
| Akurasi | 5 | Maksimum per aspek, rentang, null, nol, dan jawaban Phaser diuji; query nyata berhasil lewat UI admin. |
| Kelengkapan | 5 | Ketiga permintaan selesai, data aktual terjaga, build lokal dan ZIP tersedia. |
| Kejelasan | 4 | Skala dan asal nilai dijelaskan; catatan terbaik lintas permainan cukup panjang di ponsel dan bisa dipersingkat pada iterasi desain berikutnya. |
| Dapat digunakan | 5 | Lokal aktif; tombol Rapor membuka meter dan ZIP siap untuk deployment yang diotorisasi berikutnya. |
| Ringkas | 4 | Lima SELECT menjaga maksimum tanpa migration; RPC agregat dapat mengurangi request jika kelak dibutuhkan pada skala lebih besar. |

Rata-rata 4,6/5. Perbaikan lanjutan berdasarkan dampak: ringkas penjelasan pada layar kecil; pertimbangkan agregasi server tunggal hanya bila pengukuran menunjukkan latensi berarti. Penilaian sesuai kebutuhan pengguna: perubahan terlihat lokal dan tidak mengarang rincian nilai siswa.
