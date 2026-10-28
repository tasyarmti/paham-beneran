# Paham Beneran

Web app untuk menguji pemahaman materi kursus dengan cara menjelaskan ulang tanpa catatan (teach-back), mengecek poin yang terlewat, lalu mengulanginya dengan jeda (spaced repetition).

**Coba langsung:** https://paham-beneran.pages.dev

**Untuk siapa:** orang yang belajar sendiri lewat kursus online (misalnya ESG, bahasa, atau Excel) dan sering merasa sudah paham karena tugas open book selesai, tapi kesulitan menjelaskan ulang materinya beberapa hari kemudian tanpa catatan.

Alurnya: buat topik dan poin penting → rekam penjelasan tanpa catatan → putar ulang dan centang checklist → tulis catatan → dapat jadwal tes ulang 1, 3, 7, 14, 30 hari, plus pengingat ke Google Calendar.

Latar belakang, keputusan desain, dan fitur yang ditunda ada di [KONSEP.md](KONSEP.md).

## Menjalankan di komputer

Tidak perlu install apa pun. Jalankan server statis di folder ini, misalnya:

```bash
python3 -m http.server 8000
```

Lalu buka http://localhost:8000. Mikrofon hanya bisa dipakai di `localhost` atau situs HTTPS.

## Deploy ke Vercel

1. Di Vercel, pilih **Add New → Project**, lalu impor repo ini.
2. Framework Preset: **Other**. Build command dan output directory dibiarkan kosong.
3. Klik **Deploy**.

## Deploy ke Cloudflare Pages

1. Di Cloudflare, buka **Workers & Pages → Create → Pages → Connect to Git**, lalu pilih repo ini.
2. Framework preset: **None**. Build command dikosongkan, build output directory diisi `/`.
3. Klik **Save and Deploy**.

## Pasang di layar utama HP

Buka situsnya, lalu pilih **Tambahkan ke Layar Utama** (Safari: tombol Bagikan; Chrome: menu titik tiga). App akan terbuka seperti aplikasi biasa dengan ikon bunga chamomile.

## Data

Semua topik, hasil, dan rekaman disimpan di browser perangkat yang dipakai (IndexedDB). Tidak ada server, login, atau AI di dalam app.
