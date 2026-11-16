# Pengelolaan Services (Khusus)

> Catatan: Pengelolaan layanan sistem utama (**Nginx** & **SSL Certbot**) ditangani langsung oleh dosen/pembicara karena berisiko terhadap kestabilan dan keamanan server.

| Item | Keterangan |
|---|---|
| Ruang lingkup | Seluruh rangkaian proses build, kompilasi, pengujian, dan pengemasan distribusi Linux pada server utama |
| Layanan tercakup | `nginx` (web server / reverse proxy), `certbot` (manajemen sertifikat TLS/SSL) |
| Status | **Khusus — pengelolaan eksklusif dosen/pembicara** |
| Versi dokumen | 1.0 |

---

## 1. Tujuan

1. Mencegah konflik alokasi port jaringan (khususnya **port 80** dan **443**).
2. Menjaga integritas lingkungan build (*build environment*).
3. Menghindari kegagalan akses layanan publik pada server.
4. Menjamin stabilitas dan keamanan sistem secara menyeluruh.

---

## 2. Layanan yang Terkena Aturan

| Layanan | Fungsi | Penanggung jawab |
|---|---|---|
| **Nginx** | Web server / reverse proxy utama host | Dosen / pembicara |
| **Certbot / Let's Encrypt** | Manajemen & pembaruan sertifikat SSL/TLS | Dosen / pembicara |

---

## 3. Larangan Intervensi Layanan Inti (Host Services)

Peserta **dilarang keras**:

1. Mengakses atau memodifikasi berkas konfigurasi layanan inti.
2. Menjalankan **restart**, **reload**, **stop**, maupun **disable** terhadap layanan Nginx dan SSL Certbot.
3. Mengubah artefak di bawah direktori berikut:
   - `/etc/nginx/`
   - `/etc/letsencrypt/`

Larangan ini berlaku baik melalui **akun pengguna biasa** maupun melalui **akses sudo**.

---

## 4. Pembatasan Eksekusi Perintah Manajemen Layanan

Perintah pengendalian layanan sistem berikut **tidak diperkenankan** dijalankan peserta terhadap Nginx maupun Certbot:

```bash
# Dilarang — kontrol layanan
systemctl start|stop|restart|reload|disable|enable nginx
systemctl start|stop|restart|reload|disable|enable certbot

service nginx start|stop|restart|reload
service certbot start|stop|restart|reload

# Dilarang — perubahan langsung konfigurasi / sertifikat
# (edit, hapus, pindah, atau symlink apa pun di bawah:)
/etc/nginx/
/etc/letsencrypt/
```

**Pengecualian terbatas (read-only):** diagnosis tidak-mutasi seperti `systemctl status`, `ss -tlnp | grep -E ':80|:443'`, `nginx -t`, atau `certbot certificates` hanya untuk keperluan observasi, tanpa mengubah state apa pun. Setiap tindakan yang bersifat **mutasi** wajib dikoordinasikan lebih dahulu.

---

## 5. Wewenang Pengelolaan Eksklusif

Seluruh proses berikut ditangani **secara eksklusif** oleh dosen atau pembicara:

1. Konfigurasi awal dan pemeliharaan layanan Nginx & Certbot.
2. Pembaruan (*renewal*) dan troubleshooting sertifikat SSL/TLS.
3. Penyesuaian virtual host, direktori publikasi, dan pengaturan sertifikat.

---

## 6. Prosedur Koordinasi Kebutuhan Layanan

Apabila pada tahap **pengujian repositori paket** atau **distribusi ISO** diperlukan:

- penyesuaian jalur akses web (*virtual host*),
- direktori publikasi,
- atau pengaturan sertifikat SSL,

maka peserta **wajib berkoordinasi dan melaporkan secara langsung** kepada dosen atau pembicara untuk ditindaklanjuti.

Alur koordinasi:

```text
1. Identifikasi kebutuhan (layanan, port, path, vhost, SSL).
2. Laporkan ke dosen/pembicara beserta justifikasi teknis.
3. Tunggu persetujuan dan pelaksanaan oleh petugas berwenang.
4. Verifikasi hasil setelah perubahan diterapkan.
```

---

## 7. Ringkasan Aturan

| Sumber daya | Peserta | Dosen / Pembicara |
|---|---|---|
| `/etc/nginx/` | Dilarang modifikasi | Berwenang penuh |
| `/etc/letsencrypt/` | Dilarang modifikasi | Berwenang penuh |
| `systemctl` / `service` (nginx, certbot) | Dilarang (kecuali read-only) | Berwenang penuh |
| Port 80 / 443 | Tidak boleh diklaim/diubah | Dikelola bersama layanan |
| Virtual host / direktori publikasi / SSL | Ajukan koordinasi | Eksekusi & pemeliharaan |

---

## 8. Implementasi pada Kode (NodePanel)

Kebijakan ini ditegakkan di kode panel (`nodes/`) melalui modul `nodes/src/policy.js`:

| Komponen | Perilaku |
|---|---|
| `GET /api/services` | Menandai `protected: true` pada Nginx & Certbot + membawa `policy` |
| `POST /api/services/action` | `start`/`stop`/`restart` pada layanan terlindungi ditolak **403** (status tetap boleh) |
| `POST /api/ssl/renew` & `/issue` | Ditolak **403** (certbot terkunci) |
| `POST /api/sites/toggle`, `/config`, `/create`, `/delete` | Ditolak **403** (mutasi vhost + reload nginx terkunci) |
| UI (Services, Websites, SSL) | Tombol aksi disembunyikan/disabled + keterangan "dikelola dosen" |

### Environment variable (opsional, saat build/pengemasan)

| Variabel | Default | Fungsi |
|---|---|---|
| `PANEL_PROTECTED_SERVICES` | `nginx,certbot` | Daftar layanan terlindungi (dipisah koma) |
| `PANEL_LOCK_CERTBOT` | `1` (terkunci) | `0` untuk membuka renew/issue certbot |
| `PANEL_ALLOW_NGINX_MUTATIONS` | `0` (terkunci) | `1` untuk membuka mutasi vhost nginx |

Contoh membuka sementara (koordinasikan ke dosen/pembicara):

```bash
PANEL_ALLOW_NGINX_MUTATIONS=1 PANEL_LOCK_CERTBOT=0 npm start
```