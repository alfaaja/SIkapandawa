# CRUD guru/forum oleh master dan menu Monitoring dua baris

Pembaruan setelah koreksi pengguna: scope CRUD diperluas ke admin sekolah; master sendiri mendapat edit/reset dengan login ulang dan tanpa hapus master. Lihat `master-all-accounts-20261018.md` untuk hasil pengujian terbaru. Catatan di bawah merekam tahap sebelum perluasan tersebut.

18 Oktober 2026. Implementasi lokal sesuai permintaan terakhir; pengguna sebelumnya memilih **Simpan lokal dulu**, sehingga tidak ada migration, deploy, perubahan kredensial/data remote, commit, push, atau upload hosting.

## Hasil

- Kelola admin pada master menampilkan create/list serta edit nama/username, reset password dengan konfirmasi, dan hapus dengan ketik username untuk akun teacher/forum. Role/sekolah tidak berubah. Akun master/admin sekolah dilindungi dari tiga mutasi baru ini. Admin sekolah tetap hanya membuat guru sekolahnya, sesuai scope sebelumnya.
- Layanan frontend memakai action staf eksplisit. Handler memverifikasi master, DB service-only memverifikasi actor/target lagi, dan audit memuat penanda managedStaff tanpa kredensial. Username berubah melalui saga Auth/profil dengan optimistic CAS dan pencabutan sesi. Reset/hapus juga mencabut sesi.
- Reviewer menemukan race dua rename paralel dengan rollback yang dapat menimpa identitas hasil rename sebelumnya. Claim database per target sekarang menolak operasi berbeda selama ledger pending; lock transaksi menserialisasi claim, dan pending bertahan sampai mutasi/rollback/finalisasi selesai. Snapshot Auth baru dibaca setelah claim. Reviewer meninjau ulang tanpa blocker. Jika finalisasi gagal, pending menahan perubahan berikutnya sampai pemulihan operator.
- Hapus guru mempertahankan observasi siswa melalui submitted_by ON DELETE SET NULL. Nama pengamat/nilai/periode tetap tersimpan, sebagaimana diuji lokal.
- Menu awal kembali dua baris: Daftar dan Masuk sejajar di x558/x738 y535, Monitoring di tengah x648 y610. Sprite asli Daftar/Masuk dipertahankan; Monitoring memakai grafis pixel/font game. Tombol LevelSelect untuk sesi siswa tersimpan tetap ada.

## Bukti pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| RED sebelum implementasi | Dua tes baru handler/mock gagal karena staff actions belum tersedia (HTTP 400, Player not found) |
| Full Vitest | 339 test, 47 file lulus |
| Coverage Istanbul | Statements 92,76%; branches 84,61%; functions 88,31%; lines 95,52% |
| PostgreSQL staf lokal | 140 pemeriksaan lulus, termasuk actor/target rejection, CAS, pending rename/delete exclusion, pelepasan setelah finish, ACL, serta observasi/progres tetap ada setelah hapus guru |
| PostgreSQL monitoring | 39 pemeriksaan lulus |
| Chromium E2E terkait | 7 lulus: dua lifecycle CRUD (teacher/forum), create guru sekolah, dua viewport menu game, redirect guru, sesi siswa tersimpan |
| TypeScript/build | Lulus |
| Edge syntax bundle | Lulus, jsr/npm dieksternalkan; bukan klaim runtime Deno remote |
| Diff check | Lulus |

Percobaan E2E pertama menjalankan CRUD sampai selesai, tetapi dua assertion terakhir memakai innerText sebelum dibandingkan ke textContent sehingga berbeda kapitalisasi CSS/spasi. Assertion diperbaiki agar membandingkan representasi yang sama, kemudian tujuh tes lulus. Tidak ada pengubahan data untuk meloloskan tes.

Bukti visual terbaru pada `release/staff-teacher-preview/`: main-menu-monitoring-1366.png, main-menu-monitoring-844.png, master-teacher-crud.png, master-forum-crud.png. Semua memakai fixture development yang terisolasi; backend contoh tidak aktif pada build produksi.

Paket `release/sikapandawa-crud-staf-monitoring-20261018.zip` berisi frontend saja. Hash/jumlah berkas/CRC dan status backend dicatat pada `release/staff-teacher-preview/package-staff-crud-20261018.json`. Paket sebelumnya dipertahankan. Agar CRUD akun asli aktif nanti, perlu menerapkan dua migration lokal yang masih pending dan admin-users terbaru setelah persetujuan. Build ini belum diunggah ke hosting.

## Evaluasi mandiri

Hasil lokal memenuhi perubahan yang diminta. Skor keseluruhan 4,0/5.

| Sumbu | Skor | Bukti dan peningkatan berikutnya |
| --- | --- | --- |
| Accuracy | 4 | Tes unit/DB/E2E, review dan build lulus; runtime Auth remote baru dapat diperiksa setelah izin deploy. |
| Completeness | 4 | CRUD guru/forum dan dua baris menu selesai; aktivasi akun asli sengaja belum dilakukan sesuai pilihan pengguna. |
| Clarity | 4 | Label tombol dan konfirmasi sesuai operasi; panduan pemulihan pending perlu dilengkapi bila backend akan dioperasikan. |
| Actionability | 4 | Preview development dan ZIP siap; pengguna perlu mengaktifkan backend sebelum memakai CRUD asli. |
| Conciseness | 4 | Ringkasan pengguna singkat; detail verifikasi dan batas penerapan ditempatkan di laporan ini. |

Prioritas lanjutan saat pengguna meminta deploy: baseline/backup remote terbaru, penerapan dengan plugin Supabase, pemeriksaan integritas/ACL/source Edge, lalu uji Auth terkontrol. Pengguna dapat memeriksa UI melalui preview lokal; laporan tidak menganggap fitur telah aktif di produksi.
