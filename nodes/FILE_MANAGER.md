# File Manager — Peta Kebutuhan & Implementasi

Dokumen ini menjelaskan hasil pencocokan kebutuhan antarmuka/fungsi file manager
dengan kode yang sudah ada di `nodes/`, serta tambahan yang dibuat tanpa mengubah
logika autentikasi (`src/auth.js`) atau perilaku route lama.

## Ringkasan kecocokan

| Kebutuhan | Status | Lokasi |
| --- | --- | --- |
| Path direktori ringkas | Ditambahkan | `public/app.js` — breadcrumb root chip + path absolut di tooltip + tombol **Salin path** |
| Navigasi intuitif | Ditambahkan | Input **Lompat ke path**, klik breadcrumb, baris `..`, double-click folder, drag item ke folder |
| Buat file multi-format | Ditambahkan | Modal **+ File** dengan preset `.txt`, `.md`, `.json`, `.js`, `.ts`, `.css`, `.html`, `.php`, `.py`, `.sh`, `.yml`, `.xml`, `.ini`, `.conf`, `.env` |
| Edit file | Sudah ada + ditingkatkan | Editor modal CodeMirror; double-click file teks untuk membuka editor |
| Hapus file + konfirmasi | Ditambahkan | Modal konfirmasi async (`confirmDialog`) — bukan `confirm()` bawaan |
| Rename + validasi | Ditambahkan | Validasi kosong, spasi tepi, `/ \ null`, `.`/`..`, trailing dot, duplikat |
| Buat folder | Sudah ada + validasi | Tombol **+ Folder** |
| Pindah file/folder | Ditambahkan | Tombol **Pindah** (input folder tujuan) + drag-and-drop antar baris |
| Hapus folder kosong/tidak | Sudah ada | `POST /api/files/delete` memakai `rm -r` untuk folder |
| Kelola permission folder | Sudah ada + ditingkatkan | Chmod recursive + preset `644/755/700/775/600` |
| Upload maks 100MB/file | Ditambahkan | Validasi frontend + endpoint `POST /api/files/upload` baru dengan multer limit 100MB |
| Drag-and-drop upload | Ditambahkan | Dropzone pada tabel; drop ke folder baris tertentu juga didukung |
| Integrasi Google Drive/OneDrive | Ditambahkan | Modul `src/routes/cloud.js` + modal **Cloud** (OAuth, browse, impor, ekspor) |
| Tombol Paste + clipboard history | Ditambahkan | Riwayat 20 item di `localStorage` (`np-clipboard-history`), modal **Riwayat** |
| RESTful API | Sudah ada | Semua operasi file memakai endpoint `/api/files/*` |
| Autentikasi JWT | **Tidak diubah** | Proyek memakai session cookie HttpOnly `np_sid`; lihat catatan di bawah |
| Logging setiap aksi | Ditambahkan | `src/audit.js` menulis JSONL ke `storage/logs/actions.log`; viewer admin di tombol **Log** |
| Async handling | Sudah ada + ditingkatkan | Semua operasi baru memakai `async/await`; upload berurutan agar memori stabil |

## File yang ditambahkan

- `src/audit.js` — middleware audit log + endpoint admin `/api/audit`.
- `src/routes/cloud.js` — OAuth & transfer Google Drive/OneDrive.
- `src/routes/files-extra.js` — endpoint upload dengan batas keras 100MB.
- `FILE_MANAGER.md` — dokumen ini.

## File yang diubah (minimal, aditif)

- `server.js` — mount audit, upload baru, dan cloud. Route lama tetap utuh.
- `public/app.js` — enhancement file manager.
- `public/style.css` — style untuk dropzone, clipboard, cloud, log.
- `.gitignore` — menambahkan `nodes/storage` (token cloud & log).

## API baru

### Upload

```
POST /api/files/upload
Content-Type: multipart/form-data
field: file, path, root
```

Batas: 100MB/file. Response `413` jika melebihi.

### Audit

```
GET /api/audit?limit=100&action=files&user=...&ok=1
```

Hanya administrator. Contoh response:

```json
{
  "entries": [
    {
      "ts": "2026-11-14T...",
      "user": "zyrens",
      "ip": "127.0.0.1",
      "action": "files.save",
      "method": "POST",
      "path": "/api/files/save",
      "target": "/home/zyrens/contoh.txt",
      "status": 200,
      "ok": true,
      "durationMs": 12
    }
  ]
}
```

Log disimpan di `nodes/storage/logs/actions.log` (JSON Lines) dan dirotasi
otomatis saat melewati 5MB (dapat diubah lewat `PANEL_LOG_MAX_BYTES`).

### Cloud

```
GET  /api/cloud/providers
GET  /api/cloud/:provider/connect
GET  /api/cloud/:provider/callback
POST /api/cloud/:provider/disconnect
GET  /api/cloud/:provider/items?folderId=
POST /api/cloud/:provider/import   { id, name, path, root, mime }
POST /api/cloud/:provider/export   { path, root, name, parentId }
```

Provider: `google`, `onedrive`.

## Konfigurasi cloud

Set environment variable berikut sebelum menjalankan panel:

```bash
# Google Drive
export GOOGLE_CLIENT_ID="..."
export GOOGLE_CLIENT_SECRET="..."
# opsional; default: <public-url>/api/cloud/google/callback
export GOOGLE_REDIRECT_URI="https://panel.example.com/api/cloud/google/callback"

# OneDrive
export ONEDRIVE_CLIENT_ID="..."
export ONEDRIVE_CLIENT_SECRET="..."
# opsional; default: <public-url>/api/cloud/onedrive/callback
export ONEDRIVE_REDIRECT_URI="https://panel.example.com/api/cloud/onedrive/callback"

# opsional
export PANEL_PUBLIC_URL="https://panel.example.com"
export PANEL_CLOUD_TOKENS="/path/aman/cloud-tokens.json"
```

Daftarkan redirect URI di konsol Google Cloud / Azure App Registration.
Selama kredensial belum diisi, tombol provider menampilkan status
“belum dikonfigurasi” dan tidak akan error.

Token OAuth disimpan di `nodes/storage/cloud-tokens.json` dengan mode `600`.
File ini masuk `.gitignore`; jangan commit.

### Catatan OAuth & cookie

Cookie sesi panel memakai `SameSite=Strict`. Cookie tersebut tidak ikut pada
redirect lintas situs dari Google/Microsoft. Karena itu:

1. Route `callback` tidak memakai `requireUser`; identitas user diambil dari
   `state` OAuth acak, sekali pakai, berumur 10 menit.
2. Setelah token ditukar, callback mengembalikan halaman kecil yang melakukan
   navigasi same-site ke `/#/files`, sehingga cookie sesi kembali terkirim.

Pendekatan ini menghindari perubahan pada `src/auth.js`.

## Catatan JWT

Kebutuhan menyebut autentikasi JWT. Proyek yang ada memakai session cookie
`HttpOnly` + `SameSite=Strict` (`src/auth.js`). Sesuai instruksi untuk tidak
mengubah kode sensitif, autentikasi **tidak diganti**. Untuk browser SPA,
session HttpOnly umumnya lebih aman daripada menyimpan JWT di `localStorage`.
Jika JWT tetap dibutuhkan untuk klien API eksternal, sebaiknya dibuat sebagai
modul opt-in terpisah dan didiskusikan karena menyentuh middleware auth inti.

## Cara mencoba

```bash
cd nodes
npm install
sudo node server.js
# buka http://localhost:3000
```

Login memakai akun Linux lokal. Buka menu **File Manager**, lalu uji:

1. Buat file lewat **+ File** dan pilih format.
2. Rename file dengan nama yang mengandung `/` — validasi menolak.
3. Drag file dari OS ke tabel — upload berjalan; file >100MB ditolak.
4. Salin/potong item, buka folder lain, klik **Tempel** atau **Riwayat**.
5. Pindahkan item lewat tombol **Pindah** atau drag ke baris folder.
6. Buka **Izin** untuk chmod recursive.
7. Admin dapat membuka **Log** untuk melihat audit trail.
8. Isi env cloud, restart, lalu hubungkan Google Drive/OneDrive dari tombol **Cloud**.
