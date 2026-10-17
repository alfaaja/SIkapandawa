# Identifikasi soal dan rata-rata Jejak Pandawa — 16 Oktober 2026

Pembaruan: pengguna kemudian menyetujui penyesuaian. Implementasi lokal versi 2 dan empat soal pengganti tercantum dalam `docs/JEJAK_PANDAWA_CLASSIFICATION.md`. Isi audit di bawah dipertahankan sebagai rekaman kondisi sebelum perbaikan; status aktivasi database dilaporkan pada catatan pengujian versi 2.

## Lingkup dan hasil

Sesuai permintaan “petakan dan identifikasi dulu”, tahap ini membaca bank soal runtime, alur pengiriman jawaban, SQL agregasi dan data Supabase; menambahkan regression test; serta menyiapkan usulan empat soal pengganti. Belum mengubah soal game, rumus Misi, skor siswa, migration remote atau hosting.

Ada dua masalah terpisah: data lama tidak memiliki rincian jawaban; beberapa soal belum cocok dengan aspek yang dilaporkan. Mengubah tinggi batang agar berbeda tidak menyelesaikan keduanya. Rata-rata yang sama tetap sah apabila hasil jawabannya memang sama.

## Mengapa kelima rata-rata saat ini sama

Snapshot Supabase terbaru untuk SDN Kalibanteng Kulon 01:

| Data | Siswa |
| --- | ---: |
| Seluruh siswa, tanpa admin | 24 |
| Memiliki `jejak_aspect_scores` dari jawaban rinci | 0 |
| Skor total lama 10 | 11 |
| Skor total lama 0 (termasuk yang belum bermain) | 3 |
| Skor total lama 1–9 tanpa rincian | 10 |

RPC yang dipakai grafik menyimpulkan 2/2 untuk setiap aspek bila total 10; 0/2 bila total 0; dan tidak memasukkan total 1–9 yang rinciannya tidak diketahui. Karena itu setiap aspek memakai penyebut 14 dan menghasilkan `(11 × 2 + 3 × 0) / 14 = 1,5714286 / 2 = 78,57%`. Ini cocok dengan respons RPC live. Snapshot awal audit sempat memuat satu akun tambahan berskor nol; angka di atas mengikuti pembacaan ulang terbaru, bukan menggabungkan snapshot yang berbeda.

Misi mempunyai bintang tersimpan untuk setiap level; dua level dapat dijumlahkan langsung untuk tiap aspek. Jejak lama hanya memiliki total terbaik. Total 7, misalnya, tidak mengungkap apakah jawaban salah berasal dari Kejujuran atau aspek lain. Rincian tersebut tidak dapat dipulihkan dari total saja.

Kode game lokal terbaru sudah mengirim `cardId` dan pilihan BAIK/BURUK untuk sepuluh jawaban melalui `record_jejak_aspect_result`. Queue menyimpan run lengkap dan mempertahankannya saat pengiriman gagal. Database saat audit belum memiliki satu pun hasil rinci tersebut. Fakta ini belum membuktikan setiap siswa memakai build lama: perlu satu permainan selesai dan sinkronisasi dari build terbaru untuk membuktikan alur pengguna sebenarnya. Build frontend baru memang belum diunggah ke hosting atas pilihan pengguna sebelumnya.

## Pemetaan seluruh bank soal saat ini

Sumber yang benar-benar tersedia: `src/game/data/jejakPandawa.ts`. Komentar sumber menyebut `docs/data/JEJAK_PANDAWA_CARDS.json`, tetapi file JSON itu tidak ditemukan di checkout saat audit. Bank runtime berisi **15 soal**; satu permainan memilih **10 soal**, dua dari tiga soal per tokoh, lalu mengacak urutannya. Nomor urut tampil tidak boleh dipakai untuk menentukan aspek.

Tabel di bawah adalah interpretasi isi untuk kebutuhan kurikulum lima aspek, bukan hasil validasi instrumen psikometrik. Jawaban BAIK/BURUK mengikuti kunci game saat ini.

| ID | Isi soal | Kunci | Aspek laporan saat ini | Identifikasi isi |
| --- | --- | --- | --- | --- |
| yudhistira-01 | Menyerahkan uang Rp10.000 yang ditemukan kepada guru | BAIK | Kejujuran | Sesuai: tidak mengambil milik orang lain |
| yudhistira-02 | Memberikan sontekan agar disukai teman | BURUK | Kejujuran | Sesuai: integritas saat ulangan |
| yudhistira-03 | Memaafkan dan menolong teman yang menyipratkan lumpur | BAIK | Kejujuran | Kurang sesuai: kesabaran/empati, bukan indikator langsung kejujuran |
| bima-01 | Pura-pura tidak melihat adik kelas dipalak | BURUK | Keberanian | Sesuai: keberanian bertindak saat melihat pemalakan |
| bima-02 | Menolak ajakan membolos dengan berani | BAIK | Keberanian | Sesuai: berani menolak tekanan teman |
| bima-03 | Ikut mencoret tembok agar dianggap gaul | BURUK | Keberanian | Dapat dipakai untuk ketegasan menolak tekanan teman; penjelasan kurikulum perlu menyebut konteks itu |
| arjuna-01 | Menggebrak meja dan berteriak saat antre | BURUK | Kesopanan | Sesuai: cara menyampaikan keinginan |
| arjuna-02 | Berpamitan dan mencium tangan orang tua | BAIK | Kesopanan | Sesuai: etika kepada orang tua |
| arjuna-03 | Mengucapkan permisi saat melewati orang lebih tua | BAIK | Kesopanan | Sesuai: tutur kata sopan |
| nakula-01 | Menolak mencoba rokok dan mengingatkan bahayanya | BAIK | Kebijaksanaan | Dapat dipakai: mempertimbangkan dampak dan memilih tindakan aman |
| nakula-02 | Menggunakan uang jajan untuk judi slot | BURUK | Kebijaksanaan | Dapat dipakai: keputusan penggunaan uang dan pertimbangan akibat |
| nakula-03 | Ikut balap liar malam hari karena takut diejek | BURUK | Kebijaksanaan | Dapat dipakai: menimbang risiko sebelum bertindak |
| sadewa-01 | Menyembunyikan debu/sampah agar piket cepat selesai | BURUK | Keadilan | Kurang sesuai: tanggung jawab dan kejujuran; pembagian hak/tugas tidak dinyatakan |
| sadewa-02 | Memindahkan botol penyumbat selokan ke tempat sampah | BAIK | Keadilan | Kurang sesuai: kebersihan/kepedulian lingkungan |
| sadewa-03 | Mencuci tangan sebelum makan | BAIK | Keadilan | Kurang sesuai: kebiasaan sehat |

Pengelompokan sebelumnya berdasarkan `characterId`, sehingga semua kartu Sadewa otomatis dilaporkan sebagai Keadilan. Mengganti tag tanpa memeriksa teks soal tidak membuatnya menjadi soal keadilan.

## Usulan revisi minimum yang bisa ditinjau

Pertahankan sebelas soal lain dan sediakan ID baru untuk empat pengganti berikut. Ini masih draft; belum dipasang ke game atau database.

| Menggantikan | Usulan teks baru | Kunci | Aspek |
| --- | --- | --- | --- |
| yudhistira-03 | Mengakui kepada guru bahwa kita yang tidak sengaja merusakkan penggaris kelas. | BAIK | Kejujuran |
| sadewa-01 | Menyuruh teman mengerjakan seluruh tugas piket, sementara kita tidak ikut membantu. | BURUK | Keadilan |
| sadewa-02 | Membagi tugas kelompok dengan adil agar setiap anggota mendapat bagian yang sesuai. | BAIK | Keadilan |
| sadewa-03 | Bergiliran memakai alat permainan supaya semua teman mendapat kesempatan. | BAIK | Keadilan |

Dengan revisi ini bank kembali mempunyai tiga kandidat yang sejalan per aspek, dan setiap permainan tetap mengambil dua per aspek. Gaya game serta struktur dua keranjang tidak perlu berubah. Pemetaan perlu eksplisit per ID soal dan versi, bukan bergantung pada tokoh atau nomor urut tampil.

## Model penilaian mengikuti pola Misi

- Misi tetap memakai dua level per aspek dan skor terbaik yang sudah benar; tidak perlu diubah.
- Jejak memberi 1 poin untuk jawaban benar pada masing-masing soal. Dua soal per aspek berarti skor 0–2; bukan skor total dibagi lima.
- Seperti bintang terbaik Misi, skor terbaik tiap aspek dapat dipertahankan untuk versi kurikulum yang sama. Jika siswa pernah sempurna pada versi tersebut, semua aspek 2 memang sah dan tidak perlu dipaksa turun.
- Simpan hasil/jawaban dan versi supaya asal nilai dapat ditelusuri. Rerata sekolah dihitung dari nilai per siswa per aspek dengan jumlah data yang tersedia ditampilkan jelas.
- Total historis dipertahankan, tetapi nilai total lama 10 tidak otomatis membuktikan jawaban sempurna pada **soal revisi**. Hasil versi lama dan baru perlu dibedakan; jangan menginterpretasikan ulang jawaban lama seolah-olah menjawab teks baru.
- Ketika revisi dipasang, beri ID baru dan pertahankan kunci lama untuk antrean offline/klien lama. Jangan menimpa makna ID yang sudah pernah dikirim.
- Siswa dengan skor lama tanpa rincian perlu memainkan versi yang mencatat detail untuk memperoleh nilai lima aspek yang dapat dipertanggungjawabkan. Sebelum itu tampilkan keterbatasan, bukan membuat angka berbeda secara acak.

## Bukti pengujian dan review

`scripts/test-aspect-migration.mjs` ditambah kasus siswa baru dengan sepuluh jawaban campuran. Pada data uji terisolasi, RPC benar-benar menghasilkan `{kejujuran:2, keberanian:0, kesopanan:1, kebijaksanaan:2, keadilan:1}` dan total 6. Setelah digabung dengan dua siswa uji lain, rerata sekolah menjadi `[5/3, 1, 4/3, 5/3, 4/3]`, bukan satu angka yang disalin lima kali. Semua **27 pemeriksaan PostgreSQL** lulus. Ini membuktikan mekanisme hitung dapat membedakan aspek, bukan membuktikan isi soal lama telah sesuai.

Code-reviewer independen mengonfirmasi akar data legacy dan empat soal yang perlu ditinjau. Review membaca source; perhitungan/snapshot live terbaru diperiksa oleh agent utama. Tidak ada mutasi produksi, permainan siswa, akun, atau data monitoring yang diubah selama audit.

## Evaluasi keluaran

| Aspek | Skor | Bukti / batas |
| --- | --- | --- |
| Akurasi | 4/5 | Respons RPC live dan kasus campuran lokal cocok; klasifikasi isi merupakan penilaian kurikulum, belum validasi ahli. |
| Kelengkapan | 5/5 | Seluruh 15 soal, penyebab angka sama, perbandingan dengan Misi, dan empat draft pengganti sudah dipetakan sesuai permintaan identifikasi terlebih dahulu. |
| Kejelasan | 4/5 | Memisahkan masalah data lama dari kesesuaian isi; detail teknis disimpan di laporan ini. |
| Dapat ditindaklanjuti | 4/5 | Empat draft konkret tersedia; implementasi versi soal dan penyimpanan baru masih merupakan langkah berikutnya. |
| Keringkasan | 4/5 | Tabel lengkap diperlukan untuk peninjauan konten; ringkasan pengguna dapat lebih singkat. |

Rata-rata 4,2/5. Prioritas berikutnya adalah meninjau empat draft isi, kemudian memasang versi dan penghitungan per soal tanpa mengubah Misi atau menebak rincian historis. Self-check: pengguna dapat melihat mengapa batang saat ini sama dan mana soal yang benar-benar perlu disesuaikan.
