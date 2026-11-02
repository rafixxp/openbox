# Self-Hosted Web Panel — AI Generation Prompt

> Gunakan prompt berikut sebagai instruksi lengkap untuk menghasilkan rancangan, arsitektur, dan task breakdown pembuatan self-hosted web panel berbasis **Fastify (Node.js)** atau **Laravel (PHP)** yang di-deploy di server **Debian**.

---

## 🧠 MASTER PROMPT

```
Kamu adalah senior software engineer dan UI/UX designer yang berpengalaman membangun server management panel mirip Vercel. Bantu saya merancang dan membangun sebuah self-hosted web panel yang bisa di-deploy di server Debian. Panel ini harus memiliki minimal 5 fitur MVP berikut:

---

### STACK TEKNOLOGI (PILIH SALAH SATU)

**Opsi A — Fastify (Node.js):**
- Backend  : Fastify + @fastify/static + @fastify/session + @fastify/cookie
- Frontend : Vanilla JS + Tailwind CSS (CDN), atau Alpine.js untuk reaktivitas ringan
- Auth     : Session-based dengan bcrypt
- Sistem   : Node.js child_process / execa untuk membaca info server (CPU, RAM, disk, uptime, systemctl)
- DB       : SQLite (better-sqlite3) untuk user dan konfigurasi website

**Opsi B — Laravel (PHP):**
- Backend  : Laravel 11 (Artisan, Eloquent, Blade atau Inertia.js)
- Frontend : Blade + Tailwind CSS, atau Inertia + Vue/React
- Auth     : Laravel Breeze / Sanctum (session)
- Sistem   : PHP exec() / shell_exec() yang di-sandbox untuk membaca info server
- DB       : SQLite atau MariaDB/MySQL

---

### FITUR MVP (WAJIB DIIMPLEMENTASI)

#### 1. HALAMAN LOGIN
- Form login dengan field email/username dan password
- Validasi credential dari database
- Session management (auto redirect jika sudah login)
- Desain: kartu login di tengah layar, logo panel di atas, tombol login hitam penuh
- Error state: pesan merah jika login gagal
- Rate limiting: maksimal 5 percobaan login per 10 menit per IP

#### 2. DASHBOARD — SERVER HEALTH CHECK
Tampilkan informasi real-time server dalam bentuk card grid:

**Metrics Utama (auto-refresh setiap 5 detik via polling atau SSE):**
- CPU Usage (%) — gunakan /proc/stat atau top -bn1
- RAM Usage (used / total dalam GB dan %)
- Disk Usage per partisi (used / total dalam GB dan %)
- Uptime server (format: X hari, X jam, X menit)

**Informasi Statis (dimuat sekali saat load):**
- Hostname server
- Alamat IP (private dan public)
- Sistem operasi (nama distro + versi, misal: Debian GNU/Linux 12 Bookworm)
- Versi kernel Linux
- Versi panel (hardcoded dari config, misal: v1.0.0)
- Arsitektur CPU (x86_64 / aarch64)

**Desain Card:**
- Background putih (#FFFFFF), border abu-abu tipis (#E5E7EB)
- Label teks hitam pekat (#111827), nilai teks abu (#6B7280)
- Progress bar horizontal hitam untuk CPU, RAM, Disk
- Icon monokrom (Lucide Icons atau Heroicons outline)

**Endpoint API yang dibutuhkan:**
- GET /api/health — mengembalikan semua metrics dalam JSON
- GET /api/system-info — mengembalikan info statis server

#### 3. MENU SERVICES
Menampilkan daftar layanan sistem (systemd services) dalam bentuk tabel/list card.

**Layanan Default yang Dipantau:**
- nginx
- mysql / mariadb
- php8.x-fpm (deteksi versi otomatis)
- redis-server
- postgresql
- ssh (readonly, tidak bisa dimatikan dari panel)
- cron

**Informasi Per Service:**
- Nama service
- Status: active (hijau) / inactive (merah) / failed (oranye)
- Deskripsi singkat service
- Toggle On/Off (kecuali service yang dikunci seperti ssh)
- Tombol Restart

**Implementasi Toggle:**
- Frontend: toggle switch hitam/putih
- Backend: jalankan `systemctl start/stop/restart <service>` via subprocess
- Konfirmasi dialog sebelum mematikan service
- Permission: panel harus dijalankan sebagai user dengan sudo privileges terbatas (sudoers untuk systemctl saja)

**Endpoint API:**
- GET /api/services — list semua service dan statusnya
- POST /api/services/:name/start — start service
- POST /api/services/:name/stop — stop service
- POST /api/services/:name/restart — restart service

#### 4. MENU WEBSITE (WEBSITE MANAGER)
Manajemen virtual host / server block untuk web server (nginx atau apache).

**Fitur CRUD:**
- **Tambah Website Baru:**
  - Form: domain name, document root path, PHP version, SSL (toggle), custom nginx config
  - Generate otomatis file konfigurasi nginx di /etc/nginx/sites-available/
  - Symlink ke /etc/nginx/sites-enabled/
  - Buat direktori document root otomatis
  - Reload nginx setelah ditambahkan

- **Edit Website:**
  - Edit konfigurasi domain, document root, PHP version
  - Edit raw nginx config (textarea dengan syntax highlighting sederhana)
  - Simpan dan reload nginx

- **Konfigurasi Lanjutan:**
  - Toggle SSL/HTTPS (integrasi perintah certbot --nginx)
  - Set PHP version per site
  - Custom error pages
  - Enable/disable redirect HTTP ke HTTPS

- **Hapus Website:**
  - Konfirmasi dialog dengan nama domain
  - Hapus file konfigurasi nginx
  - Opsi: hapus atau pertahankan document root
  - Reload nginx

**Tampilan:**
- Tabel daftar website dengan kolom: Domain, Status, SSL, PHP Version, Aksi
- Status aktif: badge hijau, tidak aktif: badge merah
- Tombol aksi: Edit, Konfigurasi, Hapus (ikon, bukan teks panjang)

**Endpoint API:**
- GET /api/websites — list semua website
- POST /api/websites — tambah website baru
- PUT /api/websites/:id — update website
- DELETE /api/websites/:id — hapus website
- POST /api/websites/:id/toggle — aktif/nonaktifkan website
- POST /api/websites/:id/ssl — issue/renew SSL

#### 5. MENU SETTINGS / USER MANAGEMENT (BONUS MVP)
- Ganti password admin
- Ganti nama panel dan versi yang ditampilkan
- Whitelist IP untuk akses panel (opsional)
- Log aktivitas (audit log) sederhana: catat siapa melakukan apa dan kapan

---

### DESAIN SISTEM (UI/UX)

**Palet Warna:**
- Background utama : #FFFFFF (putih bersih)
- Background sidebar: #FAFAFA atau #F9FAFB
- Border / divider  : #E5E7EB
- Teks primer       : #111827 (hitam)
- Teks sekunder     : #6B7280 (abu-abu)
- Aksen interaktif  : #000000 (tombol, toggle aktif, link aktif)
- Status sukses     : #10B981 (hijau Emerald)
- Status error      : #EF4444 (merah)
- Status warning    : #F59E0B (oranye)

**Layout:**
- Sidebar fixed di kiri lebar 240px berisi navigasi menu utama
- Header top bar dengan nama panel, versi, dan avatar user
- Konten utama mengisi sisa lebar layar
- Font: Inter atau system-ui
- Border radius card: 8px (rounded-lg)
- Shadow card: shadow-sm (sangat subtle)

**Navigasi Sidebar:**
- Dashboard (ikon: grid)
- Services (ikon: layers)
- Websites (ikon: globe)
- Settings (ikon: settings / gear)
- Logout (ikon: log-out, di bawah)

**Komponen UI yang Dibutuhkan:**
- Card container (border, padding, rounded)
- Badge status (colored pill)
- Toggle switch (hitam/abu)
- Data table (striped atau hover highlight)
- Modal konfirmasi
- Toast notification (pojok kanan bawah)
- Progress bar horizontal
- Skeleton loading state

---

### STRUKTUR PROYEK

**Jika menggunakan Fastify:**
```
panel/
├── src/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── services.js
│   │   └── websites.js
│   ├── plugins/
│   │   ├── auth.js
│   │   └── db.js
│   ├── utils/
│   │   ├── system.js       ← baca CPU, RAM, disk, uptime
│   │   ├── nginx.js        ← generate & manage nginx config
│   │   └── systemctl.js    ← wrapper systemctl commands
│   ├── public/
│   │   ├── css/
│   │   ├── js/
│   │   └── index.html
│   └── app.js
├── database/
│   └── panel.db
├── config/
│   └── panel.json          ← versi panel, nama, settings
├── .env
└── package.json
```

**Jika menggunakan Laravel:**
```
panel/
├── app/
│   ├── Http/Controllers/
│   │   ├── AuthController.php
│   │   ├── DashboardController.php
│   │   ├── ServicesController.php
│   │   └── WebsiteController.php
│   └── Services/
│       ├── SystemInfoService.php
│       ├── NginxService.php
│       └── SystemctlService.php
├── resources/views/        ← Blade templates
├── routes/
│   ├── web.php
│   └── api.php
├── database/
│   └── migrations/
└── config/panel.php
```

---

### TASK BREAKDOWN (SPRINT BOARD)

**Sprint 1 — Fondasi & Auth:**
- [ ] Setup project (init Fastify/Laravel, install dependencies)
- [ ] Konfigurasi database SQLite + migrasi tabel users
- [ ] Implementasi halaman login (UI + validasi)
- [ ] Session management & middleware auth
- [ ] Layout dasar: sidebar, header, konten area
- [ ] Seed user admin pertama via CLI command

**Sprint 2 — Dashboard & Health Check:**
- [ ] Buat utility pembaca sistem (/proc/stat, /proc/meminfo, df, uptime)
- [ ] Endpoint GET /api/health (CPU, RAM, Disk, Uptime)
- [ ] Endpoint GET /api/system-info (OS, kernel, IP, versi panel)
- [ ] UI dashboard dengan card grid
- [ ] Implementasi auto-refresh (polling setiap 5 detik)
- [ ] Progress bar untuk CPU, RAM, Disk

**Sprint 3 — Services Manager:**
- [ ] Buat utility wrapper systemctl
- [ ] Konfigurasi sudoers untuk izin systemctl terbatas
- [ ] Endpoint GET /api/services
- [ ] Endpoint POST /api/services/:name/start|stop|restart
- [ ] UI tabel services dengan toggle dan badge status
- [ ] Modal konfirmasi sebelum stop service
- [ ] Toast notification hasil aksi

**Sprint 4 — Website Manager:**
- [ ] Desain skema database tabel websites
- [ ] Template generator konfigurasi nginx (virtual host)
- [ ] Endpoint CRUD /api/websites
- [ ] UI form tambah/edit website
- [ ] Implementasi toggle aktif/nonaktif website
- [ ] Integrasi perintah certbot untuk SSL (opsional MVP)
- [ ] Reload nginx otomatis setiap perubahan konfigurasi

**Sprint 5 — Keamanan & Polish:**
- [ ] Rate limiting endpoint login
- [ ] Input sanitization & validasi server-side
- [ ] Audit log (tabel activity_logs di DB)
- [ ] Halaman Settings: ganti password, nama panel
- [ ] Error handling global & halaman 404/500
- [ ] Responsif mobile (sidebar collapsible)
- [ ] README instalasi lengkap

---

### DEPLOYMENT DI DEBIAN

**Prasyarat Server:**
- Debian 11 (Bullseye) atau Debian 12 (Bookworm)
- Nginx (web server utama)
- Node.js 20 LTS (jika Fastify) atau PHP 8.2 + Composer (jika Laravel)
- SQLite3
- certbot (opsional, untuk SSL)
- sudo dengan konfigurasi terbatas untuk user panel

**Langkah Instalasi:**
1. Clone repository panel ke /opt/panel atau /var/www/panel
2. Install dependencies (npm install / composer install)
3. Copy .env.example ke .env dan isi konfigurasi
4. Jalankan migrasi database
5. Seed user admin pertama
6. Konfigurasi systemd service agar panel berjalan otomatis
7. Konfigurasi nginx sebagai reverse proxy ke port panel (default: 3000 Fastify / 8000 Laravel)
8. (Opsional) Issue SSL untuk domain panel dengan certbot

**Contoh Systemd Service (Fastify):**
```ini
[Unit]
Description=Self-Hosted Web Panel
After=network.target

[Service]
Type=simple
User=paneluser
WorkingDirectory=/opt/panel
ExecStart=/usr/bin/node src/app.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Konfigurasi Sudoers Terbatas:**
```
paneluser ALL=(ALL) NOPASSWD: /bin/systemctl start nginx, /bin/systemctl stop nginx, /bin/systemctl restart nginx, /bin/systemctl start mysql, /bin/systemctl stop mysql, /bin/systemctl restart mysql, /bin/nginx -t, /bin/nginx -s reload
```

---

### OUTPUT YANG DIHARAPKAN DARI AI

Hasilkan output berikut secara berurutan:
1. Struktur direktori lengkap proyek
2. File konfigurasi utama (.env.example, package.json / composer.json)
3. Kode semua route/controller untuk 5 fitur MVP
4. Kode utility untuk membaca info sistem (CPU, RAM, Disk, Uptime, OS)
5. Template HTML/Blade untuk setiap halaman (Login, Dashboard, Services, Websites, Settings)
6. CSS/Tailwind classes untuk komponen UI (Card, Badge, Toggle, Table)
7. Script instalasi bash (install.sh) untuk Debian
8. README.md lengkap dengan instruksi instalasi dan penggunaan

Prioritaskan keamanan: jangan pernah expose shell command langsung dari input user. Selalu validasi dan sanitasi semua input sebelum dieksekusi di sistem.
```

---

## 📋 CARA MENGGUNAKAN PROMPT INI

1. **Pilih stack** terlebih dahulu: Fastify (lebih ringan, cocok untuk server RAM kecil) atau Laravel (lebih mature, ekosistem lebih lengkap).
2. **Paste prompt di atas** ke model AI (Claude, GPT-4, dsb.) dan tambahkan konteks stack yang dipilih.
3. **Generate per sprint** — minta AI generate kode Sprint 1 dulu, test, baru lanjut Sprint 2.
4. **Iterasi desain** — setelah kode dasar jalan, minta AI untuk mempoles UI agar lebih mirip Vercel.

---

## ⚖️ PERBANDINGAN SINGKAT: FASTIFY vs LARAVEL

| Aspek | Fastify | Laravel |
|---|---|---|
| RAM Server | ~50–80 MB | ~120–200 MB |
| Kecepatan Dev | Lebih cepat setup | Lebih banyak boilerplate |
| Ekosistem | Lebih kecil | Sangat mature |
| Performa | Sangat cepat | Cukup cepat |
| Cocok untuk | VPS RAM ≤ 1GB | VPS RAM ≥ 1GB |
| Bahasa | JavaScript/TypeScript | PHP |

**Rekomendasi:** Untuk server Debian dengan RAM terbatas (512MB–1GB), gunakan **Fastify**. Untuk kemudahan pengembangan jangka panjang dan tim yang familiar PHP, gunakan **Laravel**.

---

*Generated for: Self-Hosted Web Panel R&D — Teknik Informatika Universitas Siliwangi*
