# Monitoring orang tua dan guru

Frontend lokal memakai `/form/` sebagai pintu masuk bersama: akun siswa membuka monitoring orang tua; akun guru tersendiri membuka daftar dan pengisian siswa sekolahnya. `/guru/` mengalihkan ke `/form/`. Akun guru dapat dibuat master atau admin sekolahnya. Backend monitoring aktif sejak 17 Oktober 2026; tambahan wewenang pembuatan guru oleh admin sekolah serta CRUD master sudah diterapkan setelah persetujuan pada 18 Oktober 2026 dengan admin-users versi 9. Admin sekolah hanya membaca sekolahnya; master/forum membaca lintas sekolah. Kredensial tidak dicatat pada formulir atau hasil pengamatan.

Catatan lama tetap bersumber `parent` dengan periode `legacy` (belum diketahui), tanpa menebak periode historis. Tabel `parent_monitoring_observations` tetap dipakai untuk mempertahankan data, dengan tambahan `reporter_type` (`parent`/`teacher`), identitas pengirim guru `submitted_by`, dan `monitoring_period`. Form baru meminta periode eksplisit, default “Periode 1”; orang tua dan guru harus memakai nama periode yang sama. Setiap pengisian ulang adalah baris baru. UUID pengiriman yang sama dengan isi identik adalah retry idempotent; isi berbeda ditolak. RLS dan RPC memeriksa sekolah di server. Akun guru tidak boleh mengirim catatan orang tua atau mengakses panel admin.

## Perhitungan grafik

Grafik orang tua dan guru dipisahkan dan memakai filter periode yang sama di tab Monitoring. Pada setiap titik/aspek, pengisian berulang dirata-ratakan per siswa terlebih dahulu, kemudian antar-siswa dalam sekolah; setiap siswa memiliki bobot sama. N/A dan tidak ada pengamatan tidak pernah diubah menjadi nol. Grafik menunjukkan lima aspek dengan 12 titik masing-masing. Pilih `legacy` untuk grafik dan riwayat data sebelum pencatatan periode; hasil pakar periode itu tetap belum cukup karena belum ada pasangan guru yang sah.

## Sistem pakar forward chaining — draft-1

Aturan awal disetujui untuk prototipe oleh pengguna; batasnya tetap memerlukan validasi ahli pendidikan dan pengujian kasus sebelum dipakai sebagai instrumen penelitian tervalidasi. Sistem bukan model machine learning dan tidak menetapkan manipulasi atau ketidakjujuran.

1. Pasangkan **siswa + aspek + nomor titik + periode monitoring** yang sama, mengikuti keputusan pengguna. Tanggal pengamatan boleh berbeda. Nama periode dinormalisasi NFKC, huruf kecil, dan spasi agar perbedaan penulisan sederhana tidak memecah periode.
2. Pada setiap sumber, rata-ratakan semua skor numerik pada pasangan periode/titik/aspek tersebut. N/A diabaikan. Pasangan tanpa skor numerik di salah satu sumber dikecualikan.
3. Hitung selisih absolut, selisih bertanda (ortu dikurangi guru), dan kesamaan kedua rata-rata per periode. Pengisian berulang tidak menambah bobot pasangan atau jumlah titik.
4. Setiap analisis hanya memakai satu periode yang dipilih. Kemudian rata-ratakan antar-titik, sehingga setiap nomor titik memiliki bobot sama. Selisih absolut dihitung **sebelum** dirata-ratakan; perbedaan berlawanan arah antar-titik tidak saling menghapus.
5. **R1:** kurang dari 6 nomor titik berpasangan pada suatu aspek → **Data belum cukup**.
6. **R2:** rata-rata selisih absolut ≥2 kategori pada satu titik → **perbedaan besar** pada titik tersebut.
7. **R3:** setelah R1 terpenuhi, sedikitnya 3 titik memiliki perbedaan besar → **Perlu klarifikasi**. Selain itu → **Pola selisih besar berulang belum terdeteksi**.

UI menampilkan jejak aturan, versi, jumlah titik/periode, kesamaan rata-rata pasangan, selisih absolut, arah selisih, serta data setiap titik. Kesamaan rata-rata pasangan tidak berarti setiap penilaian mentah sama. MAE memperlakukan jarak kategori 1–4 sebagai setara; ini adalah asumsi deskriptif yang perlu disepakati pakar. Tidak ada batas kesimpulan yang disembunyikan dari peninjau.

## Verifikasi

`scripts/test-teacher-monitoring.mjs` menguji database PostgreSQL lokal (PGlite), termasuk pembatasan per sekolah, penolakan pemalsuan sumber, pemisahan riwayat, append-only, retry, N/A, pengisian berulang, pasangan berbeda tanggal dalam satu periode, serta pemisahan periode lain. Unit test `monitoringComparison.test.ts` menguji batas aturan dan bobot titik. `e2e/teacher-monitoring.spec.ts` menggunakan data contoh lokal terisolasi untuk alur ortu → guru → admin.

Mode contoh hanya untuk Vite development: `/form/?mockMonitoring=1`, akun `guru.demo` atau siswa `arjuna.pratama`, sandi uji `local-test-only`. Data contoh berada pada browser lokal dan tidak masuk Supabase. Build produksi tidak menyediakan backend contoh tersebut. Semua input periode baru berupa angka bulat positif (default 1, min 1, step 1); data periode historis tetap tersedia pada filter admin.
