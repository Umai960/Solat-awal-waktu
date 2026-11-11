# Solat Awal Waktu 🕌

App Android **offline** untuk membantu solat di awal waktu.

## Ciri
- **Waktu solat dikira dalam telefon** — tiada internet diperlukan. Lokasi diambil dari GPS (atau pilih bandar).
  Kaedah: sudut Subuh 20°, Isyak 18°, mazhab Syafie (seperti JAKIM; beza ±1–2 minit adalah biasa).
- **Kiraan detik** ke solat seterusnya.
- **Notifikasi masuk waktu** (dan peringatan awal pilihan) — dijadualkan 7 hari ke hadapan.
- **Rekod solat awal waktu** — tekan solat selepas selesai; dikelaskan *Awal waktu* / *Dalam waktu* / *Lewat*.
  Statistik 7 hari dan rentetan hari penuh awal waktu.

## Cara install di telefon
1. Buka tab **Releases** repo ini (atau pergi ke `github.com/Umai960/Solat-awal-waktu/releases`).
2. Muat turun **SolatAwalWaktu.apk** dari release *terkini*.
3. Buka fail tersebut. Jika diminta, benarkan "Install unknown apps" untuk Chrome/Files.
4. Buka app, benarkan **Lokasi** dan **Notifikasi** (serta "Alarms & reminders" jika diminta).

APK dibina automatik oleh GitHub Actions setiap kali ada perubahan kod.

## Pembangunan
```bash
npm install
npm test            # uji kiraan waktu
npm run dev         # cuba dalam browser
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
```
Teknologi: [Capacitor](https://capacitorjs.com) + Vite, kiraan waktu oleh [adhan-js](https://github.com/batoulapps/adhan-js).

### Kunci tandatangan (pilihan)
Tanpa secret, setiap build guna kunci debug yang berbeza, jadi untuk update perlu **uninstall** versi lama dahulu
(rekod solat akan hilang). Untuk elak ini, tambah dua secret di *Settings → Secrets and variables → Actions*:
- `KEYSTORE_BASE64` — fail keystore (alias `solat`) dalam base64
- `KEYSTORE_PASSWORD` — kata laluan keystore
