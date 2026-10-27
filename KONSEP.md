# Konsep Paham Beneran

Dokumen ini merangkum masalah, keputusan, dan batasan di balik app ini. Ditulis untuk final project MBCL Cohort 3 (Claude for Non-Tech Professionals).

## Masalah

Saya merasa paham karena tugas open book selesai dan nilainya bagus. Tapi saya belum pernah menguji ingatan tanpa catatan. Saat diminta menjelaskan ulang beberapa hari kemudian, definisi kunci hilang dan penjelasan melompat-lompat.

Dari 4 sesi latihan (topik Good Labor Practice) dengan Fire Spiral Method:

- **Kerangka menjelaskan menempel.** Setelah memakai kerangka tetap (kesimpulan, kriteria, terapkan ke kasus, rekomendasi), struktur jawaban sudah rapi.
- **Definisi cepat hilang.** Di tes ulang tanpa catatan, 2 unsur forced labour menurut ILO terlewat. Akar masalahnya: definisi hanya diingat-ingat sekali.

Jawaban 4 calon penguji tentang cara mereka mengulang materi: baca ulang, tonton ulang video, Googling, dan kuis dari Claude. Semuanya bentuk "melihat materi lagi", dan keempatnya pernah kesulitan menjelaskan ke orang awam.

## Definisi "paham" yang dipakai

Bisa menjelaskan sebuah topik ke orang awam, beberapa hari kemudian, tanpa catatan, dan tanpa poin kunci yang terlewat.

## Cara kerja

1. **Buat topik.** Isi kelompok materi, judul, dan poin "Isi materi", masing-masing dengan sumbernya. Poin diambil dari tujuan pembelajaran, rubrik, atau feedback ujian, bukan dari ingatan.
2. **Pilih format cara menjelaskan (langkah 2 form topik).** Umum, Studi kasus, atau Grammar bahasa (poin tetap, dengan penjelasan tiap poin), atau Atur sendiri dengan nama format sendiri. Format dipilih per topik.
3. **Rekam penjelasan tanpa catatan.** Pilih untuk siapa penjelasannya (orang awam, atasan, junior, teman sekelas). Catatan disembunyikan selama merekam.
3. **Putar ulang dan centang.** Checklist dibagi dua:
   - **Isi materi:** poin dari topik itu. Bagian ini menguji ingatan.
   - **Cara menjelaskan:** 5 poin tetap yang sama untuk semua topik (kesimpulan di awal, konsep diterapkan ke contoh atau kasus, jawab keberatan pendengar, rekomendasi, bahasa bisa dipahami pendengar).
   Nilainya dipisah (misalnya "Isi 1/2 · Cara 4/5"), supaya kelihatan yang bolong itu ingatan atau cara menjelaskan.
4. **Catatan.** Kolom bebas untuk hal yang disadari sendiri atau feedback dari ChatGPT/Claude.
5. **Jadwal tes ulang.** Jeda 1, 3, 7, 14, lalu 30 hari. Kalau masih ada poin isi materi yang terlewat, tes diulang besok dengan jeda yang sama. Tanggal bisa diubah manual, misalnya menjelang ujian.
6. **Pengingat.** Tombol "Tambah ke Google Calendar" dan unduh file .ics, ditambah banner di beranda.
7. **Cek poin dengan ChatGPT/Claude.** Di form topik, ada tautan yang bisa dibuka berisi prompt siap tempel untuk memeriksa apakah poin isi materi sudah benar dan apa yang terlewat. Pengguna diminta melampirkan materi kursusnya, supaya AI membandingkan poin dengan materi itu, bukan dengan pengetahuannya sendiri. Prompt meminta AI tidak menuliskan penjelasan lengkap, supaya latihan menjelaskan tetap dilakukan sendiri. Fitur ini hanya ada saat membuat atau mengubah poin, karena gunanya mengecek checklist, bukan menilai penjelasan.

8. **Tandai selesai.** Topik yang sudah nempel atau ujiannya sudah lewat bisa ditandai selesai. Topik itu pindah ke bagian Selesai di paling bawah beranda, tidak dijadwalkan tes ulang lagi, dan riwayatnya tetap tersimpan. Bisa diaktifkan lagi kapan saja.

Di beranda, lingkaran di kiri tiap topik menunjukkan skor isi materi dari tes terakhir (misalnya 2/5), dengan cincin yang terisi sesuai skornya. Bingkai kuning berarti tes hari ini, putus-putus berarti besok.

Satu rekaman = satu percobaan untuk satu topik. Setiap topik menyimpan riwayat percobaannya (belajar awal, tes ke-1, tes ke-2, dan seterusnya), lengkap dengan rekaman, nilai, poin yang terlewat, dan catatan.

## Keputusan penting

- **Tanpa AI di dalam app.** Riset retrieval practice menunjukkan mengingat sendiri lebih kuat daripada membaca jawaban. Saat ujian atau rapat, Claude juga tidak ada. AI hanya dipakai di luar app lewat tombol salin prompt.
- **Tanpa server dan login.** Semua data, termasuk rekaman, disimpan di IndexedDB browser perangkat yang dipakai.
- **Satu topik sebaiknya 1 sampai 3 menit.** Materi besar dipecah jadi beberapa topik di bawah satu kelompok materi.

## Yang ditunda

| Fitur | Alasan ditunda |
|---|---|
| Cek checklist otomatis, roleplay, soal latihan | Butuh API AI berbayar, menjaga API key di server, dan mengirim rekaman pengguna ke layanan luar (privasi). Rekaman juga harus ditranskrip dulu. |
| Login dan sinkron antar perangkat | Butuh server dan menyimpan data pribadi. |
| Notifikasi langsung dari app | Web Push butuh server pengirim dan izin notifikasi; di iPhone situs harus ditambahkan ke Home Screen dulu. |

## Batasan yang perlu diketahui pengguna

- Rekaman hanya ada di browser perangkat itu. Ganti HP, ganti browser, atau hapus data situs berarti datanya hilang.
- Perlu izin mikrofon. Kalau ditolak atau browser tidak mendukung, tetap bisa pakai "Jelaskan tanpa rekaman".
- Penilaian checklist dilakukan sendiri, jadi butuh kejujuran pengguna.

## Teknis

- HTML, CSS, dan JavaScript biasa, tanpa build step. Bisa langsung di-deploy sebagai situs statis di Vercel.
- Perekaman: MediaRecorder API. Penyimpanan: IndexedDB, dan app meminta browser menyimpan datanya secara permanen supaya tidak mudah terhapus.
- Bisa dipasang di layar utama HP (web app manifest dan ikon).
- Versi pratinjau di Artifact claude.ai punya batasan: mikrofon diblokir (diganti unggah rekaman dari HP) dan pemilih jam bawaan diblokir (diganti daftar jam per 30 menit). Di situs asli kedua batasan ini tidak berlaku, jadi app merekam langsung dan memakai pemilih jam bawaan.
- Tema "Teh Hangat" dengan palet chamomile: `#FFFDF5`, `#FFF5CC`, `#FFEFA4`, `#F6D365`, `#525007`, `#33320F`. Font Nunito.
