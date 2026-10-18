# Konsistensi desain admin dan monitoring

17 Oktober 2026. Permintaan: dropdown periode admin, tombol tutup kanan atas, konsistensi desain, dan perbaikan form guru. Perubahan frontend disimpan lokal. Tidak ada migration, deploy Edge, pengisian monitoring remote, atau unggah hosting dalam penyesuaian ini.

## Perubahan

- Filter periode admin menjadi select: periode yang tersimpan, Periode 1, catatan lama (`legacy`), serta opsi periode lain dengan input tervalidasi. Penamaan dinormalisasi; pilihan tetap terjaga ketika data dimuat ulang. Kegagalan daftar periode tidak menghalangi grafik yang lain.
- Daftar periode dibaca dari kolom `monitoring_period` melalui client terautentikasi dan RLS yang sudah aktif. Query tidak mengambil skor, nama, atau isi catatan. Cursor nilai periode melewati pengisian berulang tanpa bergantung pada jumlah maksimal baris API. Backend contoh menerapkan scope yang sama melalui cohort lokal.
- Dialog Kelola admin memakai `.dialog-header` dan `.icon-button` yang sama dengan dialog akun/rapor. Dialog monitoring juga memakai tombol × dengan label aksesibel. Header dialog tetap terlihat saat digulir. Lebar dialog Kelola admin dikoreksi dengan specificity yang cukup agar tidak ditimpa stylesheet dialog akun yang lebih sempit.
- Form guru dan ortu memakai struktur bersama: identitas/waktu, konteks, lima aspek, dan arahan. Grid dua kolom desktop berubah satu kolom pada ponsel; skala penilaian dan append-only tidak berubah. Tombol ganti siswa/keluar ditempatkan dalam header. Ganti siswa tetap berfungsi sesudah penyimpanan dan ditahan saat penyimpanan berlangsung.
- Login guru serta pilihan siswa mengikuti header, warna, spacing, radius, dan font portal monitoring. Tidak ada perubahan role atau cakupan data.

## Verifikasi

- RED awal: tes select periode dan pembacaan period cursor gagal pada implementasi sebelumnya.
- TypeScript: PASS. Build produksi: PASS, empat entry HTML.
- Unit final: 319 tes, 45 berkas, PASS. Coverage statements 92,89%; branches 83,58%; functions 87,91%; lines 95,36%. Ambang tetap 80%.
- E2E Chromium: 37/37 PASS. Termasuk parent/guru/admin, alur simpan/perbandingan, duplikat sekolah, pengubahan/hapus/reset akun contoh, serta gameplay Jejak.
- Kasus desain pada 390/768/1366 px memeriksa posisi dan ukuran tombol × setelah scroll, overflow dialog, dropdown periode, navigasi guru, grid desktop, dan form ponsel. Screenshot desktop guru dan dialog ponsel ditinjau secara visual.
- Tes navigasi guru sesudah submit tetap lulus. Satu fixture controller sekolah perlu menambahkan method daftar periode baru; fixture diperbarui tanpa menghapus assertion regresi.
- `git diff --check`: PASS; hanya peringatan LF/CRLF Git Windows.

Artefak: `release/sikapandawa-desain-konsisten-20261017.zip`, 475 berkas, 40.637.156 byte; CRC valid, empat entry, tanpa source/env/SQL/map dan tanpa secret key/JWT nonpublik yang terdeteksi. SHA-256 `141828ff0a4c6c4da3e7986ccd4d9a35470488d7725cfd95e6d4999abb1b9c93`. Build lama tetap tersedia. Screenshot bukti berada di `release/staff-teacher-preview/teacher-form-1366.png`, `teacher-form-390.png`, `admin-dialog-390.png`, dan `period-dropdown-1366.png`.

## Evaluasi mandiri

Ringkasan: 4,0/5; seluruh permintaan desain ditangani lokal dan diverifikasi.

| Sumbu | Skor | Bukti dan peluang perbaikan |
| --- | --- | --- |
| Accuracy | 4/5 | 319 unit dan 37 E2E lolos; pemeriksaan visual otomatis memakai Chromium, belum mencakup Safari. |
| Completeness | 4/5 | Dropdown, tiga jenis dialog, form guru/ortu dan tiga breakpoint diperiksa; halaman yang hanya tersedia setelah login staf nyata belum diulang dengan akun produksi baru. |
| Clarity | 4/5 | Bagian form diberi judul, legacy berlabel catatan lama, tombol × memiliki nama aksesibel; daftar periode bebas mengikuti nama yang disepakati sekolah sehingga perlu konsistensi penamaan operator. |
| Actionability | 4/5 | Preview guru terbuka dan ZIP terbaru tersedia; hosting tetap lokal sesuai batas tugas. |
| Conciseness | 4/5 | Penjelasan pengguna ringkas dan bukti teknis terpisah; laporan lengkap disimpan untuk tindak lanjut. |

Perbaikan berikutnya: uji browser tambahan bila menjadi target, lalu gunakan akun guru nyata yang dibuat master untuk penerimaan sekolah. Tidak ada sumbu ≤2. Pengguna dapat melihat perbaikan langsung di preview lokal; hasil siap diserahkan dalam scope frontend lokal.
