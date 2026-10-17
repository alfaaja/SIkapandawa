# Reset password siswa — 17 Oktober 2026

Pengguna secara eksplisit meminta seluruh password akun siswa disamakan ke password pilihannya. Password asli tidak dicatat dalam dokumen, source, SQL tersimpan, fixture, atau bundle.

## Hasil

- **28 akun siswa di semua sekolah** direset, **1 admin Sikapandawa dikecualikan**.
- Pemilihan akun menggunakan langsung `private.admin_users`, bukan `private.admin_profile_is_admin(uuid)`: helper tersebut bergantung pada JWT caller dan tidak tepat untuk klasifikasi dari SQL operator tanpa JWT admin.
- Masing-masing akun memakai hash bcrypt cost 10 dengan salt berbeda. Hash dibuat di memori lokal dan diberikan ke operasi SQL; tidak disimpan ke repo.
- Tidak ada Auth Admin API pada tool plugin yang tersedia. Digunakan transaksi operator melalui plugin Supabase, tanpa menambah endpoint, migration, atau privilege browser. Perilaku reset mengikuti [implementasi Auth resmi](https://github.com/supabase/auth/blob/master/internal/models/user.go): ganti hash, kosongkan pending confirmation/recovery/change/reauthentication token, hapus one-time tokens, refresh tokens dan sesi siswa. Identitas/email/role/admin tidak diubah.
- Sebelum reset terdapat 58 sesi siswa; segera setelah reset terverifikasi 0 sesi, 0 refresh token, 0 one-time token siswa. Access JWT yang sudah diterbitkan masih dapat berlaku sampai expiry; jangan mengklaim seluruh access token langsung tidak berlaku.
- Sesi pengujian dibuat lewat login Auth sungguhan untuk **ayudia.inara** dan **fahmi**; kedua login berhasil memakai password pilihan pengguna, lalu masing-masing sesi pengujian langsung ditutup.

## Proteksi dan verifikasi

Template operator `scripts/sql/reset-student-passwords.template.sql` tidak berisi password atau hash nyata. Target roster/count diperiksa lagi, membership admin dikunci selama transaksi, baris Auth siswa dikunci, dan seluruh operasi rollback bila ada count/payload atau data terlindungi yang berbeda.

Pemeriksaan dalam transaksi memastikan Auth admin dan akun di luar target, identities, profil, progres, level, monitoring dan run Jejak tetap utuh. Seluruh field Auth siswa di luar hash/updated_at/pending tokens juga dibandingkan sebelum/sesudah.

Verifikasi remote sesudah reset:

- Jumlah akun siswa 28 dan jumlah hash berbeda 28.
- Auth admin MD5 sebelum/sesudah: `f6417bee26a4f6240929b5296a4583f1`.
- Hash gabungan seluruh data game sebelum/sesudah: `59aa0562a7c39cdab324521408d9262b`.
- **12 pemeriksaan PostgreSQL lokal lulus** melalui `scripts/test-student-password-reset.mjs`: roster berubah, admin dalam manifest dan hash tidak valid ditolak; admin dan akun Auth tanpa profil utuh; token/sesi siswa terhapus; data game utuh.
- Reviewer independen tidak menemukan blocker prioritas tinggi pada template. Reviewer mengingatkan batas masa berlaku access JWT, yang dicatat di atas.

Rujukan penyimpanan bcrypt: [Supabase password security](https://supabase.com/docs/guides/auth/password-security). Tidak ada perubahan frontend, deployment, atau reset progres. Dependency bcrypt untuk persiapan lokal berada di folder release yang diabaikan Git.

## Evaluasi

| Kriteria | Skor | Bukti/batas |
|---|---:|---|
| Akurasi | 4/5 | Reset 28 hash tervalidasi dan login dua sampel berhasil; tidak login ulang seluruh 28 akun. |
| Kelengkapan | 4/5 | Seluruh target berubah, admin/data utuh dan sesi dicabut; access JWT lama tetap menunggu expiry. |
| Kejelasan | 4/5 | Scope semua sekolah dan pengecualian admin disebutkan; rincian teknis disimpan di sini. |
| Dapat ditindaklanjuti | 5/5 | Pengguna dapat langsung login dengan username siswa dan password yang telah dipilih. |
| Keringkasan | 4/5 | Jawaban pengguna singkat; bukti operator dipisahkan ke laporan ini. |
