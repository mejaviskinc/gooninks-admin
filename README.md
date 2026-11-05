# GoO Ninks — Admin Studio

Dashboard terpisah untuk rencana alamat **https://admin.gooninks.co.id/**.

## Status
Repository ini disiapkan dari kode dashboard resmi GoO Ninks pada repository `mejaviskinc/GoO-ninks`. Dashboard belum otomatis online hanya karena repository dibuat atau kode diunggah.

## Arsitektur
- Website pelanggan: https://gooninks.co.id/
- Dashboard admin: https://admin.gooninks.co.id/
- Data: Supabase project GoO Ninks yang sama, dengan RLS yang membatasi akses berdasarkan `gn_admins`.

## Pengaturan subdomain
1. Siapkan deployment static dari isi root repo (`index.html` menjadi halaman awal); Hostinger/static hosting lebih cocok untuk portal admin. GitHub Pages **tidak direkomendasikan untuk data/login sensitif** menurut dokumentasinya, dan pada paket GitHub Free tidak tersedia untuk repo private.
2. Di DNS domain yang authoritative, buat record `CNAME` bernama `admin` ke host yang ditentukan platform deployment. Jika GitHub Pages tersedia dan dipilih, target untuk akun `mejaviskinc` adalah `mejaviskinc.github.io`.
3. Set domain `admin.gooninks.co.id` di pengaturan deployment dan aktifkan HTTPS sebelum dipakai.
4. Di **Supabase Dashboard > Authentication > URL Configuration**, masukkan `https://admin.gooninks.co.id/**` ke Redirect URLs. Dashboard ini memakai `https://admin.gooninks.co.id/` untuk verifikasi akun dan reset password.
5. Periksa login, role admin, RLS `gn_admins`, seluruh modul data, dan pengembalian akses saat lupa password sebelum pindah.
6. Jangan menghapus `gooninks.co.id/admin.html` sebelum dashboard baru aktif dan diuji.

## Keamanan
- `gn-config.js` hanya berisi Supabase publishable key, **bukan service role atau server key**.
- Semua operasi admin harus dilindungi RLS / backend. Login dan antarmuka tidak merupakan pengganti otorisasi.
- Jangan menyalin Midtrans Server Key ke repository, HTML, atau JavaScript browser.
- Private repository tidak otomatis membuat URL website private jika dipublikasikan sebagai Pages.
- Pastikan HTTPS, MFA untuk akun admin jika tersedia, dan redirect URL Supabase dibatasi.

## Deploy Github Pages (hanya bila paket mendukung dan risiko dinilai)
Repository > Settings > Pages > Deploy from branch > `main` / `(root)` > Save. Kemudian Settings > Pages > Custom domain: `admin.gooninks.co.id`. Atur DNS sesuai instruksi host dan aktifkan Enforce HTTPS. Jangan mengubah konfigurasi repository website utama.

Referensi:
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site

### Admin update — 6 November 2026

- Notification clicks persist read status per authenticated admin. The bell counts unread items; read failures retain the count and show an error.
- Customers can be entered manually, including name, email, phone, address, labels and notes. Profiles and checkout history merge by email; manual entries never create payment orders or revenue.
- Pengiriman & Pelacakan is one workspace. It includes only non-deleted orders with confirmed `paid` status, with packing, courier, tracking number, shipment history and private tracking links. The previous `tracking` view is an alias.
- Database change record: `docs/ADMIN-UPDATE-20261106.sql`. Existing profile admin RLS is retained; notification reads require both admin authorization and the current user's ID.
- Regression checks: `npm ci && npm test` (DOM tests with mocked API). Database checks were also run under authenticated admin/non-admin roles and rolled back. These tests do not simulate real payments or courier delivery.
