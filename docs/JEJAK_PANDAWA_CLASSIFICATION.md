# Klasifikasi Jejak Pandawa versi 2

Versi ini mengikuti lima aspek Misi Pandawa. Bank mempunyai 15 soal (tiga kandidat per aspek); setiap permainan mengambil dua soal per aspek sehingga totalnya sepuluh. Urutan tampil diacak. Kategori mengikuti ID/aspek soal yang eksplisit, bukan nomor tampil atau tebakan dari skor total.

| Aspek | Tokoh | Pasangan Misi | Skor Jejak per permainan |
| --- | --- | --- | --- |
| Kejujuran | Yudhistira | Level 1–2 | 0–2 |
| Keberanian | Bima | Level 3–4 | 0–2 |
| Kesopanan | Arjuna | Level 5–6 | 0–2 |
| Kebijaksanaan | Nakula | Level 7–8 | 0–2 |
| Keadilan | Sadewa | Level 9–10 | 0–2 |

## Seluruh soal aktif

Jawaban BAIK/BURUK adalah kunci klasifikasi perilaku. Setiap jawaban benar mendapat satu poin pada aspek soal tersebut.

| ID | Aspek | Soal | Kunci |
| --- | --- | --- | --- |
| yudhistira-01 | Kejujuran | Menyerahkan uang Rp10.000 yang ditemukan di lantai kelas kepada guru. | BAIK |
| yudhistira-02 | Kejujuran | Memberikan contekan saat ulangan agar disukai teman. | BURUK |
| yudhistira-04 | Kejujuran | Mengakui kepada guru bahwa kita yang tidak sengaja merusakkan penggaris kelas. | BAIK |
| bima-01 | Keberanian | Pura-pura tidak melihat saat adik kelas dipalak oleh kakak kelas. | BURUK |
| bima-02 | Keberanian | Menolak dengan berani saat diajak teman membolos pelajaran. | BAIK |
| bima-03 | Keberanian | Ikut mencoret tembok sekolah agar dianggap gaul. | BURUK |
| arjuna-01 | Kesopanan | Menggebrak meja kantin dan berteriak karena tidak sabar mengantre. | BURUK |
| arjuna-02 | Kesopanan | Berpamitan dan mencium tangan orang tua sebelum berangkat sekolah. | BAIK |
| arjuna-03 | Kesopanan | Mengucapkan permisi saat lewat di depan orang yang lebih tua. | BAIK |
| nakula-01 | Kebijaksanaan | Menolak saat ditawari mencoba merokok dan mengingatkan bahayanya. | BAIK |
| nakula-02 | Kebijaksanaan | Menggunakan uang jajan untuk top-up judi slot online. | BURUK |
| nakula-03 | Kebijaksanaan | Ikut balap sepeda liar pada malam hari karena takut diejek teman. | BURUK |
| sadewa-04 | Keadilan | Menyuruh teman mengerjakan seluruh tugas piket, sementara kita tidak ikut membantu. | BURUK |
| sadewa-05 | Keadilan | Membagi tugas kelompok dengan adil agar setiap anggota mendapat bagian yang sesuai. | BAIK |
| sadewa-06 | Keadilan | Bergiliran memakai alat permainan supaya semua teman mendapat kesempatan. | BAIK |

Empat ID baru menggantikan yudhistira-03 serta sadewa-01/02/03. ID dan kunci lama dipertahankan pada RPC versi lama agar antrean dari game lama tetap dapat diproses. Klasifikasi ini merupakan rancangan konten pendidikan dalam game, bukan klaim instrumen pengukuran psikometrik tervalidasi.

## Hasil dan rata-rata

Server memeriksa sepuluh ID unik, dua soal pada setiap aspek dan pilihan BAIK/BURUK. Server menghitung skor sendiri dan menyimpan jawaban lengkap dalam catatan run versi 2. Pengiriman ulang UUID yang sama tidak membuat duplikat; permainan baru memakai UUID baru.

Seperti bintang terbaik Misi, nilai siswa pada setiap aspek merupakan nilai terbaik aspek itu dari seluruh permainan versi 2 miliknya. Satu siswa tetap memiliki satu nilai per aspek ketika menghitung rata-rata sekolah. Contoh hasil satu permainan yang benar adalah Kejujuran 2/2, Keberanian 0/2, Kesopanan 1/2, Kebijaksanaan 2/2, Keadilan 1/2. Kelima skor dapat berbeda atau sama sesuai jawaban.

Layar hasil game hanya menampilkan skor total dan predikat. Lima meter aspek (masing-masing 0–2 poin) tersedia di admin melalui tombol Rapor pada siswa, setelah kartu Level 1–10. Admin mengambil maksimum setiap aspek dari seluruh run versi 2 milik siswa melalui SELECT yang tetap tunduk pada RLS. Skor total lama tidak dipakai sebagai pengganti rincian yang belum tersedia. Perubahan tampilan ini tidak mengubah ID soal, kunci jawaban, atau proses penyimpanannya.

Grafik gabungan tetap menampilkan pasangan ungu Misi dan kuning Jejak pada lima aspek. Misi dinormalisasi dari 6 poin dan Jejak dari 2 poin ke persentase. Grafik menjelaskan cakupan siswa yang sudah memiliki data versi 2. Bila belum ada, tampilkan tanda belum tersedia; jangan mengganti dengan skor total lama dibagi lima.

Skor total lama, progres Misi dan monitoring orang tua tetap dipertahankan. Total lama 10 tidak membuktikan hasil sempurna pada soal revisi. Siswa perlu memainkan Jejak versi 2 untuk masuk ke penghitungan aspeknya. Sebelum seluruh siswa memainkan versi ini, cakupan grafik belum seluruh siswa sekolah.

## Data aktual saja

Pada 17 Oktober 2026, atas permintaan pemilik, seluruh 21 record dataset simulasi dihapus dari database dan fitur simulasinya dilepas dari admin. Grafik kini hanya membaca hasil Jejak versi 2 yang tercatat dari permainan. Siswa perlu memainkan soal versi terbaru agar rinciannya tersedia. Riwayat migration dipertahankan; tabel simulasi kosong tidak lagi dibaca aplikasi. Lihat `docs/testing/jejak-simulation-removal.md`.
