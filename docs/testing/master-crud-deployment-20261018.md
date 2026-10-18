# Aktivasi backend CRUD staf

18 Oktober 2026. Pengguna menyetujui **Ya, aktifkan backend Supabase** setelah diagnosis menunjukkan Edge v8 belum mengenali staff_reset_password/staff_delete. Penerapan memakai plugin Supabase pada sikapandawaGame (`qbjkvbsdimxiglbhorre`). Frontend tetap lokal. Tidak ada akun dibuat/dihapus atau password diganti dalam proses deploy/verifikasi ini.

## Hasil penerapan

| Lokal | Remote | Hasil |
| --- | --- | --- |
| 20261017105713_school_teacher_provisioning.sql | 20261018082314, school_teacher_provisioning | Berhasil |
| 20261018080114_master_staff_crud.sql | 20261018082323, master_staff_crud | Berhasil |
| admin-users | v8 → v9 | ACTIVE, verify_jwt=true; kedelapan berkas source remote cocok dengan source lokal setelah normalisasi akhir baris |

Cadangan source Edge v8 dan definisi fungsi sebelum deploy berada di `release/staff-teacher-preview/before-master-crud-deploy-20261018.json`. Bukti hasil/ACL/integritas di `master-crud-deployment-20261018.json` pada folder yang sama. Metadata ZIP terbaru diperbarui tanpa mengubah arsip frontend.

## Integritas data

Digest seluruh baris dihitung di server dan hanya agregatnya disimpan, tanpa mengekspor isi Auth/password. Sebelum–sesudah deploy cocok persis untuk semua kumpulan berikut:

| Data | Jumlah |
| --- | ---: |
| Auth users | 28 |
| Profiles | 28 |
| Player progress | 28 |
| Level progress | 280 |
| Jejak aspect runs | 23 |
| Monitoring observations | 3 |
| Staff memberships | 3 |

Kesamaan digest Auth membuktikan deploy tidak mengganti password/metadata akun pada interval pemeriksaan. Kesamaan digest progres/observasi membuktikan tidak ada pengubahan skor atau catatan oleh penerapan ini.

## Verifikasi remote

- Pemeriksaan read-only dengan actor yang sudah ada membuktikan master diizinkan melakukan update/rename/reset/delete pada staf school/teacher yang sudah ada, serta update/reset sendiri; delete master ditolak. Tidak ada target forum asli pada baseline ini; jalur forum memakai pemeriksaan role yang sama dan lifecycle fixture lokal sudah lulus.
- Admin sekolah dapat provision teacher sekolahnya, ditolak untuk forum/lintas sekolah dan mutasi master. RPC school dengan role authenticated hanya mengembalikan guru sekolahnya (1 akun pada saat pemeriksaan).
- Fungsi rename staf, claim audit, assignment, serta authorize service-only tidak bisa dieksekusi oleh browser/anon. Service_role dapat rename; RLS tabel siswa tetap aktif; index satu admin per sekolah tetap ada; definisi claim menyertakan serialisasi per target.
- HTTP POST tanpa token pada staff_update, staff_reset_password, staff_delete semuanya ditolak 401. Tidak mengirim password asli maupun token ke log/fixture.
- Tidak melakukan round trip reset/delete akun asli untuk pengujian. Lifecycle Auth lengkap telah diuji dengan fixture lokal; pengguna dapat mencoba operasi yang memang dikehendaki pada panel setelah refresh/login ulang.

## Advisor

Tidak ada temuan baru dibanding baseline. Temuan lama tetap: empat tabel RLS tanpa policy (termasuk tabel privat/service-only), dua RPC SECURITY DEFINER authenticated yang memiliki pemeriksaan actor eksplisit, serta leaked-password protection belum aktif. Tidak mengubah konfigurasi Auth di luar scope. Referensi: [RLS tanpa policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [SECURITY DEFINER callable](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Evaluasi mandiri

| Sumbu | Skor | Bukti dan peningkatan |
| --- | --- | --- |
| Accuracy | 4 | Status ACTIVE, source cocok, ACL dan digest remote diverifikasi; tidak mengklaim reset/delete akun asli telah dilakukan. |
| Completeness | 4 | Kedua migration dan Edge aktif; frontend sengaja tetap lokal, pengujian kredensial asli diserahkan pada operasi yang diinginkan pengguna. |
| Clarity | 4 | Diagnosis membedakan frontend lokal dan backend remote; laporan mencatat batas smoke test secara eksplisit. |
| Actionability | 4 | Pengguna dapat refresh/login ulang dan memakai CRUD; jika perlu pemulihan, source/fungsi sebelumnya dicadangkan. |
| Conciseness | 4 | Ringkasan pengguna singkat, bukti rinci di laporan ini. |

Rata-rata 4,0/5. Prioritas selanjutnya adalah pengguna mencoba perubahan akun yang memang diperlukan; tidak mengubah kredensial asli hanya demi membuktikan tombol. Status deploy terverifikasi dan tidak memerlukan persetujuan tambahan dalam scope yang sudah diberikan.
