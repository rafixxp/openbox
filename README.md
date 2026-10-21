# 🐧 Project Remastering Distro Linux - Openbox Server Minimalist

Repositori ini berisi konfigurasi dan skrip untuk membangun (*build*) **Distro Linux Server Minimalis** berbasis Debian Bookworm menggunakan `live-build`. 

Distro ini dirancang khusus untuk infrastruktur Virtual Machine (VM) web server yang super ringan (RAM *idle* ±80MB) dan dilengkapi *installer* otomatis ke disk.

---

## 📋 Prerequisites & Lingkungan Kerja

Sebelum mulai, **WAJIB** menggunakan OS Linux. Seluruh anggota kelompok bisa memilih salah satu dari dua opsi lingkungan berikut:

### Opsi A: Menggunakan VirtualBox (Sangat Direkomendasikan)
1. Install **VirtualBox** di laptop/PC masing-masing.
2. Buat VM baru dan install **Debian 12 (Bookworm)** atau **Ubuntu 22.04/24.04 LTS**.
3. Pastikan koneksi internet VM lancar dan memiliki alokasi *storage* minimal **15–20 GB**.

### Opsi B: Menggunakan WSL 2 (Windows Subsystem for Linux)
1. Buka PowerShell/Terminal di Windows (sebagai Administrator), lalu jalankan:
   ```bash
   wsl --install -d Debian
