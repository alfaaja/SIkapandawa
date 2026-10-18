# Akses staf dan monitoring Sikapandawa

Implementasi 17 Oktober 2026. Dua migration dan Edge `admin-users` versi 8 telah diterapkan ke Supabase setelah persetujuan pengguna; frontend tetap lokal. Role master Sikapandawa dan pembatasan RPC/RLS sudah diperiksa. Tidak ada reset progres pada migration ini; jumlah dan digest data siswa sebelum/sesudah cocok.

Pembaruan 18 Oktober 2026: sesudah persetujuan **Ya, aktifkan backend Supabase**, migration lokal `20261017105713_school_teacher_provisioning.sql` dan `20261018080114_master_staff_crud.sql` diterapkan sebagai versi remote `20261018082314` dan `20261018082323`. Edge `admin-users` versi 9 ACTIVE, verify_jwt=true; delapan berkas source cocok dengan implementasi lokal. Admin sekolah dapat membuat akun guru sekolahnya sendiri melalui **Kelola guru**. Master mendapat edit nama/username, reset password, dan hapus untuk akun admin sekolah/guru/forum pada **Kelola admin**; kartu master sendiri menyediakan edit/reset, lalu logout untuk login ulang. Penghapusan master ditolak. Role dan sekolah tidak berubah melalui editor. Frontend tetap lokal; akun, password, skor, progres, staf, dan monitoring sebelum/sesudah deploy memiliki jumlah serta digest yang identik. Lihat `testing/master-crud-deployment-20261018.md`.

| Role | Sekolah | Kelola siswa | Kelola akun staf | Isi monitoring guru |
| --- | --- | --- | --- | --- |
| Master | Semua | Ya | Buat school/forum/teacher; edit/reset/hapus semua staf kecuali hapus master | Tidak; gunakan akun guru |
| Sekolah | Sekolah yang ditetapkan server | Ya, sekolah sendiri | Create/list/edit/reset/hapus guru sekolah sendiri | Tidak; gunakan akun guru |
| Forum/dinas | Semua | Ya | Tidak | Tidak; gunakan akun guru |
| Guru | Sekolah yang ditetapkan server | Tidak | Tidak | Ya, siswa sekolah sendiri |

Akun Sikapandawa yang **sudah** menjadi anggota admin dinaikkan menjadi master. Username/metadata signup baru tidak memberikan role. Keanggotaan berada di `private.admin_users`, tidak bisa dibaca/ditulis browser. Index unik menjamin satu admin sekolah untuk setiap nama sekolah kanonis, termasuk jika permintaan bersamaan. Guru dapat memiliki beberapa akun dalam satu sekolah.

Pembaruan final 18 Oktober 2026: setelah persetujuan **Aktifkan semua dan finalisasikan**, migration lokal `20261018083408_school_teacher_account_management.sql` diterapkan remote sebagai `20261018084659`; admin-users versi 11 ACTIVE dengan verify_jwt=true. Versi final menyertakan deno.json strict; bundle source sama dengan v10. School mendapat CRUD teacher sekolah sendiri. Target role dan sekolah diperiksa dari membership DB; admin/forum/master/siswa serta guru lintas sekolah ditolak. Delapan source TypeScript Edge cocok dan digest data sebelum/sesudah identik. Dialog master/sekolah kini membuka daftar dan pencarian terlebih dahulu, tab tambah terpisah, serta editor fokus tanpa menumpuk form. Frontend tetap lokal untuk uji penerimaan pengguna. Lihat `testing/FINAL_LOCAL_HANDOFF_20261018.md`.

## Batas keamanan

- Policy SELECT lama diganti agar scoped RLS berlaku pada profil, Misi, Jejak, monitoring, serta tabel simulasi historis. Semua staf dikecualikan dari populasi siswa, termasuk caller sendiri. RPC lama tetap mengikuti RLS tersebut.
- Admin sekolah dapat membuat, mengedit, mereset password dan menghapus siswa sekolahnya melalui Edge terotorisasi. Role/scope tidak diambil dari payload frontend. Forum punya cakupan global siswa tetapi tidak bisa membuat staf.
- Edge memakai JWT terverifikasi dan pemeriksaan DB service-only sebelum operasi Auth Admin. Scope diperiksa lagi saat claim audit/idempotency.
- Saat Auth membuat staf, trusted app_metadata dicocokkan dengan actor yang berwenang dan operasi pending di server. School hanya dapat membuat teacher pada sekolahnya sendiri; master tetap dapat membuat school/forum/teacher. Pemeriksaan role/sekolah berlaku pada Edge, claim audit, assignment, dan trigger Auth. Signup trigger memasukkan membership dalam transaksi yang sama dengan Auth/profil. Tidak ada jeda staf dianggap siswa. Klaim tidak sah atau duplikat admin sekolah membatalkan seluruh pembuatan akun.
- Trigger juga memeriksa sekolah aktual pada pembuatan siswa oleh versi Edge lama yang belum membawa schoolName ke audit, sehingga rollback Edge tidak membuka mutasi lintas sekolah.
- Kredensial hanya diteruskan ke Supabase Auth melalui Edge; tidak disimpan dalam audit, source, maupun data monitoring. Password form dibersihkan setelah operasi atau penutupan dialog.
- Endpoint `staff_update`, `staff_reset_password`, dan `staff_delete` hanya menerima master terverifikasi dengan target school/teacher/forum. Master sendiri dapat update/reset; target master ditolak untuk delete. Target siswa memakai endpoint siswa lama yang tetap menolak semua staf. Perubahan username mempertahankan sinkronisasi Auth/profil dan memakai pemeriksaan username sebelumnya. Claim per target mencegah dua mutasi staf berjalan bersamaan hingga saga dan rollback selesai. Operasi pending akibat kegagalan finalisasi memerlukan pemulihan operator sebelum mutasi selanjutnya, agar tidak menjalankan perubahan yang tumpang tindih.
- Hapus guru memutus referensi pengirim (`submitted_by` menjadi NULL) tanpa menghapus observasi siswa. Nama pengamat, nilai, periode, serta progres siswa tetap tersedia. Penghapusan meminta pengetikan username tepat; password baru meminta konfirmasi.
- `/form/` adalah pintu masuk bersama: akun siswa diarahkan ke monitoring orang tua; akun guru ke daftar siswa dan form guru. `/guru/` mengalihkan ke `/form/` untuk tautan lama. Role ditentukan lewat identitas Auth terverifikasi dan RPC server, bukan metadata browser. Observasi terpisah berdasarkan sumber dan periode, append-only. Batas role juga berlaku pada raw REST, bukan hanya UI.

## Kriteria penerimaan

1. Master dapat membuat tiga jenis staf. School hanya dapat membuat teacher pada sekolah sendiri; school tidak dapat membuat admin/forum atau guru lintas sekolah. Forum/teacher/student ditolak saat mencoba membuat staf melalui API. Daftar staf bagi school hanya memuat guru sekolahnya.
2. School A tidak dapat membaca/mengubah siswa B melalui tabel, RPC lama/baru, maupun Edge. Forum/master dapat membaca kedua sekolah; teacher hanya roster dan observasi sekolahnya.
3. Dua permintaan admin untuk sekolah kanonis sama menghasilkan maksimal satu membership tanpa akun Auth sisa dari kegagalan constraint.
4. Pengamatan ortu/guru dengan UUID baru tetap disimpan terpisah; retry identik tidak menggandakan data, sumber palsu ditolak.
5. Grafik dan analisis memakai periode yang dipilih; tanggal berbeda dalam periode yang sama dipasangkan. Periode berbeda dan N/A tidak dicampur.
6. Draf forward chaining menjelaskan aturan dan alasan, mempertahankan status belum cukup, dan tidak memberikan vonis manipulasi.
7. Ringkasan, Siswa, Aspek, dan Monitoring berupa tab terpisah yang dapat digunakan lewat keyboard dan ponsel.

Verifikasi: unit/UI test, E2E Chromium terisolasi, `scripts/test-staff-access.mjs` dan `scripts/test-teacher-monitoring.mjs`. Tinjauan pakar pendidikan tetap diperlukan untuk memvalidasi batas draft-1, sebagaimana disepakati pengguna. Lihat `TEACHER_MONITORING_COMPARISON.md`.
