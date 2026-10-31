# R&D Self-Hosted Web Panel

> Rancangan sistem dan breakdown tugas untuk membangun web panel server yang di-host sendiri (self-hosted), dengan pilihan framework **Fastify** (Node.js) atau **Laravel** (PHP).

| Item | Keterangan |
|---|---|
| Nama kode | `Panelkit` (sementara, bebas diganti) |
| Versi dokumen | 0.1 (draft R&D) |
| Target OS | Linux berbasis systemd (Ubuntu 22.04/24.04, Debian 12) |
| Target UI | Minimalis ala Vercel: putih + hitam |
| Status | Perencanaan |

---

## 1. Tujuan dan Ruang Lingkup

### 1.1 Tujuan
1. Membangun web panel ringan yang berjalan di server yang dikelola (self-hosted).
2. Memvalidasi framework mana (Fastify atau Laravel) yang paling cocok lewat implementasi MVP yang sama.
3. Menghasilkan fondasi yang aman untuk fitur lanjutan (SSL, database manager, file manager, dan lainnya).

### 1.2 Fitur MVP (6 fitur)

| # | Fitur | Prioritas | Ringkasan |
|---|---|---|---|
| F1 | **Autentikasi (Login)** | Wajib | Login, logout, sesi aman, proteksi brute force |
| F2 | **Dashboard Health Check** | Wajib | CPU, RAM, disk, uptime + kernel, IP, OS, versi panel |
| F3 | **Services** | Wajib | Daftar service systemd, status, start/stop/restart |
| F4 | **Website** | Wajib | Tambah, edit, konfigurasi, hapus website (virtual host Nginx) |
| F5 | **Audit Log** | Pendukung | Catatan semua aksi sensitif (siapa, apa, kapan) |
| F6 | **Pengaturan Akun** | Pendukung | Ganti password, info panel, logout semua sesi |

### 1.3 Di luar MVP (backlog)
- SSL otomatis (Let's Encrypt / certbot)
- Manajemen database (MySQL/PostgreSQL)
- File manager dan terminal web
- Multi-user dengan role
- Backup dan restore
- Firewall (ufw) dan manajemen cron
- Notifikasi (email/Telegram) saat resource kritis

---

## 2. Perbandingan Framework

| Aspek | Fastify (Node.js) | Laravel (PHP) |
|---|---|---|
| Footprint resource | Sangat ringan (puluhan MB RAM) | Lebih berat (butuh PHP-FPM + web server) |
| Kecepatan membangun CRUD | Perlu rakit sendiri (ORM, auth, validasi) | Sangat cepat (Eloquent, validasi, auth, migration siap pakai) |
| Eksekusi perintah sistem | `child_process.execFile` | `Symfony\Process` |
| Data realtime (polling/SSE/WebSocket) | Native dan mudah | Perlu Reverb/Pusher/polling |
| Library info sistem | `systeminformation`, `os`, baca `/proc` | Baca `/proc`, `shell` via Process |
| Isolasi dari website yang dikelola | Panel berjalan di runtime terpisah (Node) dari PHP-FPM milik website | Panel berbagi runtime PHP dengan website, risiko konflik versi |
| Kurva belajar tim | Tergantung pengalaman JS/TS | Tergantung pengalaman PHP |
| Ekosistem UI | React/Vue/Svelte atau SSR + htmx | Blade + Livewire/Inertia |
| Deployment | Single binary-like (Node + systemd) | Composer, PHP-FPM, Nginx config tambahan |

### 2.1 Rekomendasi
**Default: Fastify (TypeScript) + SQLite**, dengan alasan:
- Panel berjalan di server yang sama dengan yang dikelola, sehingga footprint kecil itu penting.
- Tidak bergantung pada versi PHP yang mungkin sedang diubah oleh fitur website.
- Pengambilan metrik berkala dan streaming status lebih natural.

**Pilih Laravel jika:** tim lebih menguasai PHP, ingin MVP CRUD secepat mungkin, dan footprint bukan prioritas.

> Dokumen ini ditulis agar **netral framework**. Bagian yang spesifik ditandai `[Fastify]` dan `[Laravel]`.

---

## 3. Arsitektur Sistem

### 3.1 Gambaran Umum

```
┌──────────────┐   HTTPS    ┌─────────────────────────────────────────┐
│   Browser    │ ─────────▶ │  Nginx (reverse proxy panel, port 443)  │
└──────────────┘            └───────────────────┬─────────────────────┘
                                                │ 127.0.0.1:8443
                            ┌───────────────────▼─────────────────────┐
                            │  Panel App (user non-root: `panelkit`)  │
                            │  - Auth / Session                       │
                            │  - REST API + UI                        │
                            │  - Validasi input                       │
                            └───────┬───────────────────┬─────────────┘
                                    │                   │
                          ┌─────────▼────────┐  ┌───────▼───────────────┐
                          │ DB internal      │  │ Privileged Helper     │
                          │ (SQLite/MySQL)   │  │ (root, Unix socket    │
                          └──────────────────┘  │  atau sudoers terbatas)│
                                                └───────┬───────────────┘
                                                        │
                                   ┌────────────────────▼───────────────────┐
                                   │ systemctl · nginx -t · nginx reload ·  │
                                   │ tulis /etc/nginx/sites-available/*     │
                                   └────────────────────────────────────────┘
```

### 3.2 Prinsip Keamanan (penting untuk panel server)
1. **Panel tidak berjalan sebagai root.** Gunakan user khusus `panelkit`.
2. **Pemisahan hak istimewa.** Aksi yang butuh root (systemctl, tulis vhost, reload nginx) hanya lewat *privileged helper* atau `sudoers` dengan **whitelist perintah yang spesifik**.
3. **Tanpa string shell.** Selalu panggil perintah dengan argumen array (`execFile` / `Process([...])`), tidak pernah menyambung input pengguna ke string perintah.
4. **Whitelist service.** Hanya service yang terdaftar di konfigurasi yang bisa dikontrol.
5. **Service terlindungi.** Panel itu sendiri dan `sshd` tidak boleh di-stop dari UI.
6. **Validasi domain ketat** (regex dan panjang), cegah path traversal pada root direktori website.
7. **Validasi konfigurasi sebelum terapkan.** Jalankan `nginx -t`, jika gagal lakukan rollback otomatis.
8. **Hardening web:** cookie `HttpOnly` + `Secure` + `SameSite=Lax`, proteksi CSRF, header keamanan (CSP, HSTS), rate limit pada login.
9. **Password hash** memakai Argon2id (atau bcrypt cost ≥ 12).
10. **Audit log** untuk semua aksi mutasi.

### 3.3 Sumber Data Health Check

| Data | Cara pengambilan (Linux) |
|---|---|
| Penggunaan CPU | Baca `/proc/stat` dua kali (selisih interval 1 detik), hitung persentase |
| Jumlah core dan load average | `/proc/cpuinfo`, `/proc/loadavg` |
| RAM (total, terpakai, tersedia) | `/proc/meminfo` (`MemTotal`, `MemAvailable`) |
| Disk (total, terpakai, persen) | `statvfs("/")` atau `df -B1 /` |
| Uptime | `/proc/uptime` |
| Kernel | `uname -r` atau `os.release()` |
| Sistem operasi | `/etc/os-release` (`PRETTY_NAME`) |
| Alamat IP | Interface jaringan (IP lokal) + IP publik (opsional, opsi konfigurasi) |
| Hostname | `os.hostname()` / `hostname` |
| Versi panel | Dari `package.json` `[Fastify]` / `config('app.version')` `[Laravel]` |

---

## 4. Rancangan Fitur Detail

### F1. Autentikasi (Login)

**Alur**
1. Pengguna membuka `/login`, mengisi username dan password.
2. Server memverifikasi hash, membuat sesi, lalu redirect ke `/dashboard`.
3. Logout menghapus sesi di server dan cookie di browser.

**Aturan**
- Rate limit: maksimal 5 percobaan per menit per IP + username, lalu lockout sementara.
- Pesan error generik ("Username atau password salah").
- Akun admin awal dibuat lewat CLI saat instalasi (`panelkit admin:create`), bukan lewat halaman publik.
- Sesi kedaluwarsa setelah idle (misal 2 jam), opsi "ingat saya" maksimal 7 hari.
- Rotasi ID sesi setelah login.

**Kriteria selesai**
- [ ] Login valid masuk ke dashboard, tidak valid ditolak
- [ ] Halaman terproteksi mengarahkan ke login jika belum autentikasi
- [ ] Rate limit teruji
- [ ] Logout membatalkan sesi

---

### F2. Dashboard Health Check

**Tampilan**
- **Kartu metrik utama:** CPU %, RAM (terpakai/total + %), Disk (terpakai/total + %), Uptime (format `12d 4j 33m`).
- **Kartu info sistem:** Hostname, OS, Kernel, Alamat IP, Versi Panel.
- **Pembaruan data:** polling setiap 5 detik (opsional: SSE).
- **Indikator status:** hitam (normal), abu-abu tebal (waspada ≥ 70%), garis/ikon peringatan (kritis ≥ 90%). Tetap monokrom agar konsisten dengan tema.
- (Opsional) sparkline riwayat 5 menit terakhir untuk CPU dan RAM.

**Contoh respons API**
```json
{
  "cpu": { "usagePercent": 12.4, "cores": 4, "load": [0.21, 0.30, 0.28] },
  "memory": { "totalBytes": 8185733120, "usedBytes": 2310000000, "usedPercent": 28.2 },
  "disk": { "mount": "/", "totalBytes": 52710469632, "usedBytes": 18200000000, "usedPercent": 34.5 },
  "uptimeSeconds": 1043290,
  "system": {
    "hostname": "srv-01",
    "os": "Ubuntu 24.04.1 LTS",
    "kernel": "6.8.0-45-generic",
    "ip": { "local": "10.0.0.12", "public": null },
    "panelVersion": "0.1.0"
  },
  "collectedAt": "2026-10-31T09:00:00Z"
}
```

**Kriteria selesai**
- [ ] Semua metrik tampil dan akurat dibanding `htop`, `free -m`, `df -h`
- [ ] Informasi kernel, IP, OS, versi panel tampil
- [ ] Auto-refresh tanpa reload halaman
- [ ] Gagal baca metrik tidak merusak halaman (tampilkan "N/A")

---

### F3. Services

**Tampilan:** tabel layanan dengan kolom **Nama**, **Deskripsi**, **Status** (Running/Stopped/Failed), **Autostart saat boot**, dan **Aksi**.

**Daftar default (whitelist, bisa diubah di config)**

| Service | Unit systemd |
|---|---|
| Nginx | `nginx.service` |
| MySQL / MariaDB | `mysql.service` / `mariadb.service` |
| PHP-FPM | `php*-fpm.service` |
| Redis | `redis-server.service` |
| PostgreSQL | `postgresql.service` |
| Fail2ban | `fail2ban.service` |
| SSH (dilindungi, tanpa tombol stop) | `ssh.service` |
| Panel (dilindungi) | `panelkit.service` |

**Aksi per service**
- **Toggle ON/OFF** (start/stop)
- **Restart**
- **Autostart** (enable/disable saat boot)
- **Lihat log singkat** (opsional, `journalctl -u <unit> -n 50`)

**Perintah di balik layar** (lewat helper berprivilege)
```
systemctl is-active <unit>
systemctl is-enabled <unit>
systemctl start|stop|restart <unit>
systemctl enable|disable <unit>
```

**Aturan UX**
- Konfirmasi (modal) sebelum **stop** dan **restart** service penting.
- Tombol toggle menunjukkan state loading, lalu verifikasi ulang status dari `systemctl`.
- Service tidak terpasang ditampilkan sebagai "Not installed" dan toggle dinonaktifkan.

**Kriteria selesai**
- [ ] Status sinkron dengan `systemctl status`
- [ ] Start/stop/restart berfungsi dan tercatat di audit log
- [ ] Service di luar whitelist ditolak (HTTP 403)
- [ ] Service terlindungi tidak bisa dihentikan

---

### F4. Website

**Fungsi**

| Aksi | Deskripsi |
|---|---|
| **Tambah** | Isi domain, tipe (static / PHP / reverse proxy), root direktori (otomatis), versi PHP (opsional) |
| **Edit** | Ubah domain, root, tipe, status aktif |
| **Konfigurasi** | Editor vhost (form terstruktur + mode lanjutan teks), `index`, `client_max_body_size`, redirect www, PHP version, proxy pass |
| **Hapus** | Konfirmasi dengan mengetik nama domain; opsi hapus file website atau hanya konfigurasi |
| **Aktif/Nonaktif** | Aktifkan atau nonaktifkan vhost (symlink di `sites-enabled`) |

**Alur Tambah Website**
1. Validasi domain (regex, unik, tidak ada path berbahaya).
2. Buat direktori `/var/www/<domain>/public` dengan kepemilikan sesuai.
3. Render template vhost Nginx dari data form.
4. Simpan ke `/etc/nginx/sites-available/<domain>.conf`.
5. Buat symlink ke `sites-enabled`.
6. Jalankan `nginx -t`.
   - **Gagal:** rollback (hapus symlink dan konfigurasi baru), tampilkan error ke UI.
   - **Berhasil:** `systemctl reload nginx`.
7. Simpan metadata ke database dan catat audit log.

**Template vhost (contoh static)**
```nginx
server {
    listen 80;
    server_name {{domain}} {{#if www}}www.{{domain}}{{/if}};

    root {{root}};
    index index.html index.htm;

    client_max_body_size {{maxBody}}m;

    location / {
        try_files $uri $uri/ =404;
    }

    access_log /var/log/nginx/{{domain}}.access.log;
    error_log  /var/log/nginx/{{domain}}.error.log;
}
```

**Validasi**
- Domain: `^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$`
- Root harus berada di dalam `/var/www/` (resolve path, tolak `..` dan symlink keluar).
- Nilai konfigurasi (angka, daftar index) divalidasi, **tidak boleh** memasukkan teks bebas ke template tanpa escaping.
- Mode editor teks mentah: hanya untuk admin, wajib lolos `nginx -t`, dan simpan backup versi sebelumnya.

**Kriteria selesai**
- [ ] Tambah website membuat vhost yang bisa diakses (uji dengan `curl -H "Host: ..."`)
- [ ] Edit dan konfigurasi tersimpan, `nginx -t` dijalankan sebelum reload
- [ ] Konfigurasi rusak tidak merusak Nginx (rollback berfungsi)
- [ ] Hapus membersihkan vhost, symlink, dan metadata
- [ ] Semua aksi masuk audit log

---

### F5. Audit Log (pendukung)
- Mencatat: waktu, pengguna, IP, aksi (`service.stop`, `website.create`, dst.), target, hasil (sukses/gagal).
- Halaman daftar dengan filter dan pagination.
- Log tidak bisa diedit dari UI.

### F6. Pengaturan Akun (pendukung)
- Ganti password (verifikasi password lama).
- Lihat info panel (versi, uptime panel, lokasi data).
- Logout dari semua perangkat.

---

## 5. Rancangan Data

### 5.1 Skema Database (SQLite untuk MVP)

```
users
  id (PK)             INTEGER
  username            TEXT UNIQUE NOT NULL
  password_hash       TEXT NOT NULL
  role                TEXT DEFAULT 'admin'
  last_login_at       DATETIME
  created_at          DATETIME

sessions                          -- jika tidak memakai session store framework
  id (PK)             TEXT
  user_id (FK)        INTEGER
  ip_address          TEXT
  user_agent          TEXT
  expires_at          DATETIME
  created_at          DATETIME

websites
  id (PK)             INTEGER
  domain              TEXT UNIQUE NOT NULL
  type                TEXT NOT NULL      -- static | php | proxy
  root_path           TEXT
  php_version         TEXT NULL
  proxy_target        TEXT NULL
  options_json        TEXT               -- client_max_body_size, index, www redirect, dll
  is_enabled          BOOLEAN DEFAULT 1
  created_at          DATETIME
  updated_at          DATETIME

audit_logs
  id (PK)             INTEGER
  user_id (FK)        INTEGER NULL
  action              TEXT NOT NULL
  target              TEXT
  status              TEXT NOT NULL      -- success | failed
  detail_json         TEXT
  ip_address          TEXT
  created_at          DATETIME

settings
  key (PK)            TEXT
  value               TEXT
```

### 5.2 Konfigurasi (file `.env`)
```
APP_PORT=8443
APP_SECRET=<random-64-char>
DB_PATH=/var/lib/panelkit/panel.db
MANAGED_SERVICES=nginx,mysql,php8.3-fpm,redis-server,fail2ban,ssh
PROTECTED_SERVICES=ssh,panelkit
WEB_ROOT=/var/www
NGINX_SITES_AVAILABLE=/etc/nginx/sites-available
NGINX_SITES_ENABLED=/etc/nginx/sites-enabled
METRICS_POLL_INTERVAL_MS=5000
```

---

## 6. Rancangan API (REST)

Semua endpoint selain `/api/auth/login` memerlukan sesi valid. Mutasi (POST/PUT/PATCH/DELETE) memerlukan token CSRF.

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET | `/api/auth/me` | Info pengguna saat ini |
| GET | `/api/dashboard/metrics` | CPU, RAM, disk, uptime |
| GET | `/api/dashboard/system` | OS, kernel, IP, versi panel |
| GET | `/api/services` | Daftar service + status |
| POST | `/api/services/:name/start` | Jalankan service |
| POST | `/api/services/:name/stop` | Hentikan service |
| POST | `/api/services/:name/restart` | Restart service |
| POST | `/api/services/:name/enable` | Aktifkan autostart |
| POST | `/api/services/:name/disable` | Nonaktifkan autostart |
| GET | `/api/websites` | Daftar website |
| POST | `/api/websites` | Tambah website |
| GET | `/api/websites/:id` | Detail website |
| PUT | `/api/websites/:id` | Edit website |
| PATCH | `/api/websites/:id/config` | Ubah konfigurasi |
| POST | `/api/websites/:id/toggle` | Aktif/nonaktif |
| DELETE | `/api/websites/:id` | Hapus website |
| GET | `/api/audit-logs` | Daftar audit log |
| POST | `/api/account/password` | Ganti password |

**Format error standar**
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Domain tidak valid", "fields": { "domain": "Format domain salah" } } }
```

---

## 7. Rancangan UI/UX (Gaya Vercel)

### 7.1 Prinsip Desain
- **Monokrom:** latar putih, teks/ikon/informasi hitam, abu-abu netral untuk elemen sekunder.
- Banyak ruang kosong, tipografi tegas, border tipis, hampir tanpa bayangan.
- Tombol primer **hitam solid** (teks putih), tombol sekunder **outline**.
- Tanpa warna aksen mencolok. Status dibedakan lewat ikon, bobot teks, dan label (bukan hanya warna).

### 7.2 Design Tokens

```css
:root {
  --background: #ffffff;
  --foreground: #000000;

  --gray-50:  #fafafa;   /* latar kartu/hover */
  --gray-100: #f5f5f5;
  --gray-200: #eaeaea;   /* border default */
  --gray-300: #d4d4d4;   /* border hover */
  --gray-500: #737373;   /* teks sekunder */
  --gray-700: #404040;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;

  --font-sans: "Geist", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, monospace;

  --shadow-sm: 0 1px 2px rgba(0,0,0,0.04);
}
```

| Elemen | Gaya |
|---|---|
| Heading halaman | 24-32px, weight 600, letter-spacing sedikit rapat |
| Teks isi | 14px, weight 400, warna hitam |
| Teks sekunder | 13px, `--gray-500` |
| Kartu | Border 1px `--gray-200`, radius 8-12px, latar putih |
| Input | Tinggi 36-40px, border `--gray-200`, fokus: ring hitam 1-2px |
| Tombol primer | Latar `#000`, teks `#fff`, radius 6-8px |
| Tombol sekunder | Latar putih, border `--gray-200`, hover `--gray-50` |
| Tombol bahaya | Outline hitam + teks "Delete", konfirmasi lewat modal |
| Badge status | Titik (●) + label; Running = titik penuh, Stopped = titik kosong (○) |
| Toggle | Track hitam saat ON, abu-abu saat OFF |
| Ikon | Garis tipis (stroke 1.5px), set Lucide atau Geist icons, warna hitam |
| Progress bar | Track `--gray-200`, isi hitam; ≥ 90% tampil dengan pola/garis agar tetap terbaca tanpa warna |

### 7.3 Layout Global

```
┌────────────────────────────────────────────────────────────────────┐
│ ▲ Panelkit                                 srv-01      [Admin ▾]   │  ← Topbar (border-bottom)
├───────────────┬────────────────────────────────────────────────────┤
│  ▣ Dashboard  │                                                    │
│  ◉ Services   │                  Konten halaman                    │
│  ◈ Websites   │                                                    │
│  ≡ Audit Log  │                                                    │
│  ⚙ Settings   │                                                    │
│               │                                                    │
│  v0.1.0       │                                                    │
└───────────────┴────────────────────────────────────────────────────┘
```
Responsif: sidebar menjadi drawer di layar < 768px.

### 7.4 Wireframe Per Halaman

**Login**
```
              ┌───────────────────────────────┐
              │            ▲ Panelkit         │
              │                               │
              │  Masuk ke panel               │
              │                               │
              │  Username                     │
              │  [__________________________] │
              │  Password                     │
              │  [__________________________] │
              │                               │
              │  [        Masuk (hitam)     ] │
              └───────────────────────────────┘
```

**Dashboard**
```
Dashboard                                   Diperbarui 5 detik lalu
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ CPU        │ │ RAM        │ │ Disk       │ │ Uptime     │
│ 12.4%      │ │ 2.1 / 7.6GB│ │ 17 / 49 GB │ │ 12d 1j 48m │
│ ▓▓░░░░░░░░ │ │ ▓▓▓░░░░░░░ │ │ ▓▓▓▓░░░░░░ │ │            │
└────────────┘ └────────────┘ └────────────┘ └────────────┘

┌──────────────────────────────────────────────────────────┐
│ Informasi Sistem                                         │
│ Hostname       srv-01                                    │
│ Sistem Operasi Ubuntu 24.04.1 LTS                        │
│ Kernel         6.8.0-45-generic                          │
│ Alamat IP      10.0.0.12                                 │
│ Versi Panel    0.1.0                                     │
└──────────────────────────────────────────────────────────┘
```

**Services**
```
Services                                       [ Refresh ]
┌──────────────────────────────────────────────────────────┐
│ Nama        Status        Autostart   Aksi               │
├──────────────────────────────────────────────────────────┤
│ nginx       ● Running     [ON ]       ( ON●) [Restart]   │
│ mysql       ● Running     [ON ]       ( ON●) [Restart]   │
│ redis       ○ Stopped     [OFF]       (●OFF) [Restart]   │
│ ssh         ● Running     [ON ]       (terlindungi)      │
└──────────────────────────────────────────────────────────┘
```

**Websites**
```
Websites                                    [ + Tambah Website ]
┌──────────────────────────────────────────────────────────┐
│ Domain           Tipe     Status      Dibuat     Aksi    │
├──────────────────────────────────────────────────────────┤
│ example.com      PHP      ● Aktif     12 Okt     ⋯       │  ⋯ = Edit | Konfigurasi | Nonaktifkan | Hapus
│ blog.example.com Static   ○ Nonaktif  20 Okt     ⋯       │
└──────────────────────────────────────────────────────────┘
```

**Detail Website (tab):** `Ringkasan` · `Konfigurasi` · `Log` (opsional)

---

## 8. Struktur Proyek

### 8.1 `[Fastify]` (TypeScript)
```
panelkit/
├── src/
│   ├── app.ts                 # inisialisasi Fastify, plugin
│   ├── server.ts
│   ├── config/                # env loader (zod)
│   ├── plugins/               # auth, csrf, rate-limit, helmet
│   ├── modules/
│   │   ├── auth/              # routes, service, schema
│   │   ├── dashboard/         # metrics collector
│   │   ├── services/          # systemd adapter
│   │   ├── websites/          # CRUD + nginx renderer
│   │   └── audit/
│   ├── infra/
│   │   ├── db/                # Drizzle/Kysely + migrations
│   │   ├── system/            # /proc reader, os-release
│   │   └── privileged/        # client untuk helper (Unix socket)
│   └── templates/nginx/       # template vhost
├── web/                       # frontend (React/Vite atau SSR)
├── helper/                    # privileged helper (root, whitelist aksi)
├── scripts/                   # install.sh, admin:create
└── tests/
```
**Paket yang disarankan:** `fastify`, `@fastify/cookie`, `@fastify/session`, `@fastify/csrf-protection`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/static`, `zod` (atau TypeBox), `argon2`, `better-sqlite3` + `drizzle-orm`, `vitest`.

### 8.2 `[Laravel]`
```
panelkit/
├── app/
│   ├── Http/Controllers/      # Auth, Dashboard, Service, Website
│   ├── Http/Requests/         # Form Request validasi
│   ├── Services/
│   │   ├── SystemMetrics.php
│   │   ├── SystemdManager.php
│   │   └── NginxManager.php
│   ├── Models/                # User, Website, AuditLog
│   └── Support/PrivilegedRunner.php
├── resources/views/           # Blade + Livewire / Inertia
├── database/migrations/
├── routes/web.php
├── config/panelkit.php
├── tests/Feature/
└── scripts/                   # install.sh, artisan panelkit:admin
```
**Paket yang disarankan:** `laravel/breeze` (autentikasi), `livewire/livewire` atau `inertiajs/inertia-laravel`, `symfony/process`, Pest/PHPUnit.

---

## 9. Breakdown Tugas

> Estimasi untuk 1 developer. Ukuran: **S** ≤ 0,5 hari, **M** 1 hari, **L** 2-3 hari. Total perkiraan: **±5-6 minggu**.

### Fase 0: Riset dan Persiapan (Minggu 1)
- [ ] **T0.1** Finalisasi pilihan framework berdasarkan perbandingan (Bagian 2) dan uji spike kecil (M)
- [ ] **T0.2** Spike: baca metrik dari `/proc` dan tampilkan lewat endpoint sederhana (M)
- [ ] **T0.3** Spike: eksekusi `systemctl` aman via helper berprivilege (sudoers vs Unix socket) dan pilih satu (L)
- [ ] **T0.4** Spike: render vhost Nginx + `nginx -t` + rollback (M)
- [ ] **T0.5** Siapkan VM uji (Ubuntu 24.04 + Nginx + MySQL + PHP-FPM) (S)
- [ ] **T0.6** Setup repository, linting, formatter, CI dasar (S)
- [ ] **T0.7** Siapkan design tokens dan komponen dasar (Button, Input, Card, Badge, Toggle, Modal, Table) (M)

### Fase 1: Fondasi dan Autentikasi, F1 (Minggu 2)
- [ ] **T1.1** Inisialisasi proyek dan struktur modul (S)
- [ ] **T1.2** Loader konfigurasi `.env` dengan validasi (S)
- [ ] **T1.3** Migrasi database: `users`, `audit_logs`, `settings` (S)
- [ ] **T1.4** Perintah CLI pembuat admin awal (S)
- [ ] **T1.5** Endpoint login/logout/me + hashing Argon2id (M)
- [ ] **T1.6** Manajemen sesi dan cookie aman, middleware proteksi rute (M)
- [ ] **T1.7** Proteksi CSRF, header keamanan, rate limit login (M)
- [ ] **T1.8** UI halaman login sesuai wireframe (M)
- [ ] **T1.9** Layout global: sidebar, topbar, halaman 404 dan error (M)
- [ ] **T1.10** Tes: login sukses/gagal, lockout, akses tanpa sesi (S)

### Fase 2: Dashboard Health Check, F2 (Minggu 2-3)
- [ ] **T2.1** Modul pembaca CPU (selisih `/proc/stat`) (M)
- [ ] **T2.2** Modul pembaca RAM, disk, uptime (M)
- [ ] **T2.3** Modul info sistem: OS, kernel, hostname, IP, versi panel (M)
- [ ] **T2.4** Endpoint `/api/dashboard/metrics` dan `/system` + caching singkat (S)
- [ ] **T2.5** UI kartu metrik + progress bar + ambang peringatan (M)
- [ ] **T2.6** UI kartu informasi sistem (S)
- [ ] **T2.7** Auto-refresh (polling 5 detik), tangani error/N/A (S)
- [ ] **T2.8** (Opsional) Sparkline riwayat 5 menit (M)
- [ ] **T2.9** Tes unit parser `/proc` memakai fixture + verifikasi manual vs `htop`/`free`/`df` (S)

### Fase 3: Services, F3 (Minggu 3-4)
- [ ] **T3.1** Implementasi privileged helper: aksi `status`, `start`, `stop`, `restart`, `enable`, `disable` dengan whitelist (L)
- [ ] **T3.2** Adapter `SystemdManager` (parsing `is-active`, `is-enabled`) (M)
- [ ] **T3.3** Konfigurasi daftar service terkelola dan terlindungi (S)
- [ ] **T3.4** Endpoint daftar + aksi service, validasi nama, respons 403 untuk non-whitelist (M)
- [ ] **T3.5** Pencatatan audit log tiap aksi (S)
- [ ] **T3.6** UI tabel services, toggle ON/OFF, tombol restart, state loading (M)
- [ ] **T3.7** Modal konfirmasi stop/restart + penanganan error (S)
- [ ] **T3.8** (Opsional) Panel log singkat via `journalctl` (M)
- [ ] **T3.9** Tes integrasi di VM: start/stop nginx, service tidak terpasang, service terlindungi (M)

### Fase 4: Website, F4 (Minggu 4-5)
- [ ] **T4.1** Migrasi tabel `websites` (S)
- [ ] **T4.2** Validator domain dan path (anti traversal) (S)
- [ ] **T4.3** Template vhost Nginx: static, PHP-FPM, reverse proxy (M)
- [ ] **T4.4** `NginxManager`: tulis konfigurasi, symlink, `nginx -t`, reload, **rollback otomatis** (L)
- [ ] **T4.5** Endpoint tambah website + pembuatan direktori root dan halaman indeks default (M)
- [ ] **T4.6** Endpoint edit dan ubah konfigurasi (terstruktur) + backup versi konfigurasi (M)
- [ ] **T4.7** Endpoint toggle aktif/nonaktif (S)
- [ ] **T4.8** Endpoint hapus (opsi hapus file) + konfirmasi nama domain (M)
- [ ] **T4.9** UI daftar website + modal/halaman tambah (M)
- [ ] **T4.10** UI halaman detail: tab Ringkasan dan Konfigurasi, form opsi vhost (L)
- [ ] **T4.11** (Opsional) Editor teks mentah vhost dengan validasi `nginx -t` (M)
- [ ] **T4.12** Tes: domain tidak valid, duplikat, konfigurasi rusak (rollback), hapus bersih (M)

### Fase 5: Audit Log dan Pengaturan, F5-F6 (Minggu 5)
- [ ] **T5.1** Endpoint dan halaman audit log (filter, pagination) (M)
- [ ] **T5.2** Halaman pengaturan akun: ganti password, logout semua sesi (M)
- [ ] **T5.3** Tampilkan versi panel dan info build (S)

### Fase 6: Hardening, Packaging, dan Evaluasi (Minggu 6)
- [ ] **T6.1** Audit keamanan: injeksi perintah, path traversal, CSRF, header, brute force (L)
- [ ] **T6.2** Skrip instalasi `install.sh` (user, direktori, systemd unit panel, sudoers/helper, reverse proxy) (L)
- [ ] **T6.3** Unit systemd untuk panel dengan sandboxing (`NoNewPrivileges`, `ProtectSystem`, dll.) (M)
- [ ] **T6.4** Uji performa: konsumsi RAM/CPU panel saat idle dan saat polling (S)
- [ ] **T6.5** Uji UI lintas browser dan responsif (S)
- [ ] **T6.6** Dokumentasi: README, panduan instalasi, panduan pengembangan (M)
- [ ] **T6.7** **Laporan evaluasi R&D** (lihat Bagian 11) (M)

---

## 10. Strategi Pengujian

| Level | Cakupan | Alat |
|---|---|---|
| Unit | Parser `/proc`, validator domain, renderer template | Vitest `[Fastify]` / Pest `[Laravel]` |
| Integrasi | Endpoint + database, helper systemd di VM | Supertest/`fastify.inject` / Laravel Feature Test |
| End-to-end | Login → dashboard → toggle service → tambah website | Playwright |
| Keamanan | Fuzz input domain, uji injeksi, uji akses tanpa sesi | Skrip manual + `npm audit` / `composer audit` |
| Manual | Bandingkan metrik dengan `htop`, `free -m`, `df -h`, `uptime` | VM uji |

---

## 11. Metrik Evaluasi R&D (Fastify vs Laravel)

Gunakan tabel ini di laporan akhir bila kedua framework sama-sama dicoba:

| Kriteria | Bobot | Fastify | Laravel |
|---|---|---|---|
| Waktu pengerjaan MVP (jam) | 20% | | |
| RAM panel saat idle (MB) | 20% | | |
| Penggunaan CPU saat polling (%) | 10% | | |
| Kemudahan implementasi keamanan | 15% | | |
| Kemudahan eksekusi perintah sistem dengan aman | 15% | | |
| Kemudahan instalasi/deploy | 10% | | |
| Kemudahan pengembangan fitur lanjutan | 10% | | |
| **Total** | 100% | | |

---

## 12. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Injeksi perintah lewat input domain/nama service | Server terambil alih | Argumen array, whitelist, validasi ketat |
| Konfigurasi Nginx salah mematikan semua website | Downtime | `nginx -t` wajib, rollback otomatis, backup konfigurasi |
| Panel berjalan sebagai root | Eskalasi hak istimewa | User non-root + helper terbatas |
| Admin mematikan service kritis (SSH/panel) | Kehilangan akses | Daftar service terlindungi |
| Panel terekspos publik tanpa HTTPS | Kredensial bocor | Wajib reverse proxy TLS, opsi bind ke `127.0.0.1` |
| Perbedaan distro (nama service berbeda) | Fitur gagal | Mapping nama unit per distro, deteksi otomatis |
| Brute force login | Akun diambil alih | Rate limit, lockout, opsi 2FA (backlog) |

---

## 13. Definition of Done (MVP)

- [ ] Keenam fitur (F1-F6) berfungsi sesuai kriteria selesai masing-masing
- [ ] Tidak ada input pengguna yang masuk ke shell sebagai string
- [ ] Panel berjalan sebagai non-root dan terinstal lewat satu skrip
- [ ] UI konsisten dengan tema putih-hitam ala Vercel dan responsif
- [ ] Tes otomatis lulus; uji manual di VM Ubuntu 24.04 berhasil
- [ ] Dokumentasi instalasi dan laporan evaluasi R&D selesai

---

## 14. Roadmap Pasca-MVP

1. SSL otomatis (Let's Encrypt) dan perpanjangan otomatis
2. Manajemen database dan user database
3. File manager dan editor berkas
4. Multi-user, role, dan 2FA
5. Backup terjadwal dan restore
6. Firewall (ufw), cron manager, dan monitoring histori
7. Notifikasi saat ambang resource terlampaui
