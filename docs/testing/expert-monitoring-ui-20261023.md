# Redesign monitoring & sistem pakar — 23 Oktober 2026

Permintaan: perbaikan tampilan monitoring admin dan analisis per siswa untuk demonstrasi PIMNAS. Scope hanya UI; tidak ada perubahan aturan, RPC, authorization, data Supabase, maupun game. Skill UI UX Pro Max digunakan secara eksplisit sesuai permintaan pengguna.

## Desain dan perilaku

- Tab Monitoring menampilkan identitas metode Forward chaining, alur empat langkah dan tombol menuju daftar siswa. Grafik sekolah orang tua/guru berdampingan di desktop lebar dan tersusun vertikal pada layar kecil. Seluruh 12 titik tetap tersedia.
- Detail Monitoring siswa mendahulukan hasil sistem pakar: periode, ringkasan jumlah aspek per status, lima aspek, rata-rata selisih absolut (rentang 0–3), persentase pasangan bernilai sama, dan jumlah titik berselisih besar.
- Strip 12 titik dilengkapi nomor, label dan tabel alternatif. Rincian yang dapat diperluas menunjukkan jejak aturan yang berasal langsung dari evaluator serta nilai rata-rata setiap sumber pada titik yang sama. N/A tetap tidak dihitung sebagai nol.
- Grafik dan riwayat asli tidak dihapus: dipindahkan ke disclosure Grafik & riwayat pengamatan. Penanda data uji dari catatan yang dimuat tetap ditampilkan. Bila riwayat belum dimuat seluruhnya, pemberitahuan meminta peninjauan sumber/catatan sebelumnya; tidak mengklaim seluruh periode bebas data uji berdasarkan satu halaman riwayat.
- Status tetap Data belum cukup / Perlu klarifikasi / Pola selisih besar berulang belum terdeteksi. UI tidak menuduh siswa/orang tua/guru berbohong atau memanipulasi data. Aturan draft-1 dan kebutuhan validasi pakar terlihat dalam panel.

Pencarian skill awal menghasilkan arahan landing/glass yang kurang sesuai; pencarian terfokus gaya menghasilkan Data-Dense Dashboard, dan pencarian paired ratings menyarankan tabel/grouped bar untuk nilai presisi. Implementasi mengambil hierarki metrik, warna semantik, disclosure dan tabel bukti; mempertahankan merek hijau/krem, font yang ada, TypeScript DOM/CSS. Tidak menambah framework/dependency atau membuat klaim live/AI/ML baru.

## Verifikasi

- TDD: tes komponen baru gagal sebelum implementasi, kemudian lulus. Full unit: **349 tes, 48 berkas**. Coverage: statements 92,76%; branches 84,1%; functions 88,17%; lines 95,43%. Komponen MonitoringExpertView: statements/lines/functions 100%, branches 96,96% pada run coverage.
- Browser Chromium: **8 tes terkait lulus**, termasuk alur pengisian terpisah ortu/guru, periode, tiga viewport desain dan konsistensi dialog. Setelah perbaikan terakhir, tes desain 375/768/1440px diuji ulang. Landscape 844×390 dan reduced motion tercakup.
- Axe WCAG A/AA pada dialog dengan bukti diperluas: **0 pelanggaran otomatis** pada ketiga ukuran. Ini bukan sertifikasi seluruh WCAG/screen reader.
- TypeScript, build produksi, git diff --check lulus. Diff pada classifier, layanan, Supabase dan game kosong. Endpoint lokal /admin/ menjawab 200 dan menyertakan stylesheet baru.
- Reviewer independen: temuan provenance halaman pertama diperbaiki dengan klaim terbatas dan pemberitahuan riwayat parsial; tidak ada temuan actionable tersisa.
- Screenshot ditinjau manual. Tidak ada baseline visual otomatis untuk desain baru: visual regression **INCONCLUSIVE**. Core Web Vitals produksi dan browser selain Chromium belum diverifikasi. Verdict **SHIP untuk preview lokal dan paket hosting**; hosting tidak diunggah pada pekerjaan ini.

## Preview dan paket

Pada http://127.0.0.1:5173/admin/ buka tab Monitoring. Untuk data uji Arya di UNIMUS pilih periode 9001 (tanpa pola selisih besar) atau 9002 (Perlu klarifikasi), terapkan, lalu buka Monitoring akun Arya dari daftar Siswa. Desain baru memakai data yang sudah tersedia; tidak melakukan penambahan atau reset data.

Paket: `release/sikapandawa-sistem-pakar-ui-20261023.zip`. Metadata CRC, SHA256 dan kecocokan dist: `release/staff-teacher-preview/expert-ui-package-20261023.json`. Paket frontend saja, tidak menyertakan environment, source, SQL, secret key atau mock development. Paket 18 Oktober dipertahankan.

Cuplikan di `release/expert-monitoring-ui-20261023/` memakai fixture sintetis berlabel DATA UJI. Panel analisis desktop diperluas hanya untuk pengambilan screenshot, lalu ukuran dialog dikembalikan; tidak mengubah data atau perilaku produksi. Cuplikan ini adalah bahan antarmuka untuk poster, bukan data penelitian.

## Evaluasi mandiri

Accuracy 4/5: evaluator tidak berubah dan hasil diperiksa tes; aturan tetap draf yang memerlukan validasi pakar. Completeness 4/5: overview, detail, bukti, responsif, preview dan paket tersedia; hosting sengaja tidak disentuh. Clarity 4/5: metode, sumber dan status lebih mudah ditinjau; keterbacaan poster akhir bergantung ukuran cetak. Actionability 5/5: URL, periode contoh, paket dan screenshot disediakan. Conciseness 4/5: bukti rinci terpisah dari jawaban pengguna. Rata-rata 4,2/5. Peningkatan berikutnya: review poster pada ukuran cetak sebenarnya dan uji browser target lain bila diperlukan. Penilaian dibatasi pada verifikasi yang tercatat.
