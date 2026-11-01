# Deploy Admin GoO Ninks di Hostinger

Rekomendasi untuk **repository private** `mejaviskinc/gooninks-admin` dan target `https://admin.gooninks.co.id/`.

## 1. Buat website subdomain terpisah

- Masuk https://hpanel.hostinger.com/ → Websites → **Create website / Add website**.
- Pilih jenis website **Custom PHP/HTML / Blank website** (bukan Website Builder).
- Gunakan domain `admin.gooninks.co.id`. Ini website tersendiri, **jangan pilih** `gooninks.co.id` sebagai target deploy karena berisiko menimpa website utama.

## 2. Deploy dari GitHub

- Masuk dashboard website **admin.gooninks.co.id**.
- Advanced → Git → Connect with GitHub.
- Authorize akses ke repository **`mejaviskinc/gooninks-admin`**, pilih branch `main`.
- Root directory / deployment path = direktori root **website admin saja**, biasanya `public_html` untuk website admin independen.
- Pilih Deploy dan pastikan `index.html`, `admin.js`, `admin.css`, gambar, `gn-config.js` muncul.
- Aktifkan Auto-deployment agar perubahan GitHub selanjutnya terpublikasi otomatis.

## 3. DNS dan SSL

- Pada penyedia nameserver aktif, verifikasi DNS record untuk **admin** menunjuk ke **server Hostinger** sesuai instruksi situs admin. Jika Hostinger mengonfigurasi DNS otomatis, jangan menambah record yang bertentangan.
- **JANGAN** gunakan `admin CNAME mejaviskinc.github.io` bila deployment yang dipilih adalah Hostinger; record itu hanya untuk skenario GitHub Pages.
- Jangan ubah A/AAAA/CNAME dari domain `@`, `www`, atau MX/TXT email.
- Aktifkan SSL/HTTPS di website admin Hostinger dan tes `https://admin.gooninks.co.id/`.

## 4. Supabase Auth (WAJIB sebelum login/reset)

- Supabase project untuk GoO Ninks: `etahuzvozoomklsqepyt`.
- Authentication → URL Configuration → **Redirect URLs** → tambah `https://admin.gooninks.co.id/**` (atau alamat persis `https://admin.gooninks.co.id/`).
- Jangan menghapus URL redirect lama sampai migrasi dan uji berhasil.
- Dashboard baru telah menggunakan URL subdomain tersebut untuk verifikasi pendaftaran dan reset password.
- Cek akses akun di tabel `gn_admins`; pastikan semua tabel penting menggunakan RLS/policy berbasis role, bukan hanya tampilan tersembunyi.

## 5. Tes wajib sebelum live

- Login owner/staff dan pembatasan unauthorized berhasil.
- Reset password dan verifikasi email kembali ke subdomain.
- Data pesanan, pengiriman, artikel, promo, iklan, lead dan stok bisa diakses sesuai role.
- Preview mobile, ikon dan foto tidak 404.
- Situs pelanggan tetap aktif di `gooninks.co.id`.
- Jangan hapus `gooninks.co.id/admin.html` sampai semua tes lolos.

## Catatan keamanan

Dashboard ini adalah frontend statis. Walaupun repository Private, file frontend pada hosting tetap dapat dibaca pengunjung. Jangan menyimpan Server Key Midtrans, Supabase secret/service-role, token API rahasia atau kredensial dalam repo atau JavaScript frontend. Database GoO Ninks sudah memakai RLS pada tabel utama; sebelum go-live tinjau **Security Advisor**, termasuk peringatan tentang fungsi `public.gn_set_shipping_progress_v1` dan leaked-password protection.

Dokumentasi Hostinger:
- https://www.hostinger.com/support/1583405-how-to-create-and-delete-subdomains-in-hostinger/
- https://www.hostinger.com/support/1583302-how-to-deploy-a-git-repository-in-hostinger/
