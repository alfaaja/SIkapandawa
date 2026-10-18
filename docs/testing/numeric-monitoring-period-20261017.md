# Input periode berupa angka

17 Oktober 2026. Periode di form ortu, form guru, dan filter admin menjadi input number dengan nilai awal 1, min 1, step 1, batas integer aman JavaScript, serta spinner native yang terlihat di Chromium. Pengguna dapat mengetik angka atau memakai panah naik/turun. Bukan batas 12: nomor periode berbeda dari nomor titik observasi.

Input 1 diserialisasi ke identifier `periode 1` yang sudah dipakai database. Tidak ada penomoran ulang maupun pengubahan catatan asli. Riwayat `legacy` tetap dapat dibuka melalui tombol Catatan lama. Periode historis dengan nama bebas tetap tersedia sebagai tombol pada arsip periode; pembuatan/pemilihan periode baru memakai angka. Tidak ada migration atau deploy remote dalam perubahan ini.

Tes RED awal membuktikan input sebelumnya text dan helper angka belum tersedia. Setelah implementasi: 21 unit/UI test terkait lulus, 5 E2E Chromium lulus pada desktop/tablet/ponsel, TypeScript dan build produksi lulus. E2E menguji ArrowUp/ArrowDown, input angka pada ketiga surface, penyimpanan parent/guru, filter admin, dan perbandingan berdasarkan periode. Validasi menolak kosong, nol, negatif, pecahan, eksponen dan angka tidak aman. Full suite 319 unit dan 37 E2E tercatat pada tahap desain sebelumnya; tahap ini menjalankan tes terkait perubahan. `git diff --check` lulus.

Preview guru diperbarui di browser memakai data contoh terisolasi. Bukti input dan panah: `release/staff-teacher-preview/period-number-1366.png`. Build terbaru `release/sikapandawa-periode-angka-20261017.zip`: 475 berkas, 40.637.521 byte; CRC valid, empat entry HTML, source/env tidak ikut dan pemindaian secret/JWT nonpublik lulus. SHA-256 `826fa1a4f4430b0e2e3ef622913c2c6d58830930d3c731868adfc22f0f810f63`. Paket sebelumnya dipertahankan; hosting belum diunggah.

Evaluasi mandiri: 4,0/5.

| Sumbu | Skor | Bukti dan perbaikan |
| --- | --- | --- |
| Accuracy | 4 | Konversi, batas angka dan 5 E2E lulus; perilaku spinner visual baru diperiksa Chromium. Uji browser lain bila menjadi target. |
| Completeness | 4 | Ketiga input periode berubah dan arsip dipertahankan; native spinner dapat berbeda bentuk antarplatform. |
| Clarity | 4 | Nilai awal 1 dan bantuan teks menerangkan nomor periode; penjelasan nomor periode vs titik tersedia di laporan. |
| Actionability | 4 | Preview sudah terbuka dan ZIP siap; frontend belum diunggah karena scope tetap lokal. |
| Conciseness | 4 | Penjelasan pengguna singkat, detail kompatibilitas dipisahkan dalam laporan. |

Prioritas berikutnya: pemeriksaan browser tambahan jika diperlukan saat penyerahan. Tidak ada sumbu ≤2. Pengguna dapat memeriksa input angka langsung di preview; hasil siap diserahkan.
