# Upload Sikapandawa ke cPanel

Paket terbaru siap upload: `release/sikapandawa-sistem-pakar-ui-20261023.zip` (40.643.278 byte, sekitar 38,8 MiB), berisi redesign monitoring dan detail sistem pakar per siswa. Verifikasi 23 Oktober 2026: TypeScript dan build produksi lulus; 475 berkas ZIP identik dengan build terbaru, CRC valid, seluruh entry game/admin/form/guru tersedia. Tidak ada source, migration, environment, private key, atau fixture/proxy development dalam paket. Bukti mesin: `release/staff-teacher-preview/expert-ui-package-20261023.json`. Paket sebelumnya tetap disimpan.

## Langkah upload

1. Di cPanel File Manager, buka document root domain sikapandawa.com. Pada hosting sebelumnya lokasinya `/home/sikapand/public_html`; pastikan domain masih menunjuk folder tersebut.
2. Buat cadangan file website lama dan simpan di luar document root agar dapat dipulihkan.
3. Upload ZIP final dan ekstrak langsung ke document root. File `index.html` serta folder `admin/`, `form/`, `guru/`, dan aset harus berada langsung di dalam document root, bukan di dalam folder `dist/` tambahan. Izinkan penggantian file aplikasi lama dengan file dari paket. Pertahankan konfigurasi hosting dan file lain yang tidak termasuk aplikasi.
4. Setelah ekstraksi berhasil, pindahkan ZIP keluar dari document root atau hapus hanya ZIP upload tersebut. Bersihkan cache hosting/CDN bila digunakan, lalu buka situs dengan Ctrl+F5.
5. Periksa game di `/`, admin di `/admin/`, dan portal ortu/guru di `/form/`. Tautan `/guru/` tetap mengalihkan ke portal bersama.

Supabase sudah aktif. Database/Edge Function tidak perlu diunggah melalui cPanel dan tidak disertakan dalam ZIP. Hosting frontend belum diubah oleh proses finalisasi lokal ini. Tidak ada commit/push GitHub.

## Data uji dan pemeriksaan setelah upload

Data uji Arya di UNIMUS tetap berada di Supabase, berlabel DATA UJI. Periode 9001 berisi 12 titik ortu dan 12 titik guru yang selaras; periode 9002 berisi 12 titik per sumber dengan selisih besar dan hasil Perlu klarifikasi. Pilih periode pada tab Monitoring, terapkan, lalu buka Monitoring siswa Arya dan bagian Perbandingan ortu–guru. Periode 1 dan skor permainan dipertahankan. Selisih besar memerlukan klarifikasi dan bukan bukti manipulasi.

Coba login master, admin sekolah, guru, serta siswa/ortu memakai akun yang sesuai. Pastikan akses sekolah dibatasi, guru dapat mengisi monitoring dari `/form/`, dan monitoring baru tersimpan. Aturan forward chaining tetap versi draf yang bisa ditinjau dosen.

## Evaluasi finalisasi

Accuracy 4/5: build, typecheck, kecocokan seluruh berkas dan pemeriksaan isi ZIP lulus; perilaku hosting baru belum diuji karena upload dilakukan pengguna. Completeness 4/5: paket, backend aktif, dan data uji tersedia; smoke test domain dilakukan setelah upload. Clarity 5/5: paket dan tujuan ekstraksi disebutkan eksplisit. Actionability 5/5: langkah upload dan verifikasi tersedia. Conciseness 4/5: rincian teknis dipisahkan dari jawaban singkat pengguna. Rata-rata 4,4/5. Peningkatan utama: jalankan smoke test pada domain sesudah pengguna mengunggah. Penilaian dibatasi pada bukti lokal dan backend yang sudah diuji.
