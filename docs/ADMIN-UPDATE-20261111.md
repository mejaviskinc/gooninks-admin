# GoO Ninks — update admin 11 November 2026

## Implemented

1. Inventori > Edit: satu input file untuk foto/video. Menampilkan jumlah foto, jumlah video, dan thumbnail sebelum menyimpan. Batas 15 file; foto maksimal 5 MB dan video 25 MB. Foto pertama dapat dijadikan foto utama melalui checkbox. URL foto utama tetap bisa diedit manual.
2. Input upload tunggal lama pada `image_url` diganti menjadi input URL, sehingga tidak ada dua file picker.
3. Kategori kustom: opsi “＋ Tambah kategori baru…” tersedia pada inventori. Nama 2–60 karakter disimpan di `public.gn_product_categories`, hanya admin yang dapat membaca/menambah melalui RLS. Kategori yang dipakai produk juga terlihat dalam filter kategori katalog publik karena `gn-public.js` mengambilnya langsung dari inventori.
4. Jika penyedia pembayaran mengonfirmasi `expired`, trigger `gn_orders_expiry_as_cancelled` menyimpan `cancelled`. RPC pembayaran tetap menangani pengembalian reservasi stok dan menolak pengubahan status lunas yang keliru. Kode status asli tetap dapat dilihat melalui `midtrans_status`. **Tidak membatalkan `pending` hanya berdasarkan umur pesanan**, karena hal itu berisiko membatalkan pembayaran yang masih valid. Perubahan otomatis mengikuti webhook/rekonsiliasi penyedia; belum ada polling terjadwal sebagai fallback ketika webhook tidak masuk.
5. Tab Pesanan: filter `Semua Status`, `Selesai` (pembayaran lunas), `Pending` (termasuk perlu pemeriksaan), `Dihapus`, `Dibatalkan` (termasuk gagal/kedaluwarsa), dan `Dikembalikan`.
6. Menu `Pesanan Dihapus` dihapus; data soft-delete tetap disimpan untuk audit dan bisa diakses/dipulihkan dari filter `Dihapus`.

## Files

- `admin-updates.js`: modul tanpa mengganti modul Admin Plus yang sudah berjalan.
- `admin-updates.css`: responsif untuk filter & grid preview.
- `index.html`: memuat modul dan cache-buster.
- `tests/admin-workflow.test.cjs`: pengujian tambahan.
- `.github/workflows/admin-tests.yml`: CI `npm ci && npm test`.

## Database

Migration: `gooninks_categories_and_provider_expiry_cancel` on Supabase project `etahuzvozoomklsqepyt`.

Validation: kategori seed dibuat, RLS aktif dan dua kebijakan admin ada. Trigger diaktifkan dan smoke test transaksi **sementara** memverifikasi input `expired` menjadi `cancelled` tanpa menyentuh pesanan asli.

## Deployment note

Repository kode dashboard diperbarui pada `mejaviskinc/gooninks-admin` branch `main`. Subdomain `admin.gooninks.co.id` tidak dapat diverifikasi dari sesi ini. Perubahan kode tidak menjamin bahwa hosting Hostinger otomatis memperbarui deployment. Verifikasi setelah deployment harus mencakup login admin, unggah foto/video di perangkat nyata, pembuatan kategori, filter pesanan, dan simulasi notifikasi expiry dari gateway sandbox. Pastikan webhook Midtrans menuju `gn-midtrans-webhook` di Supabase; DOKU menggunakan jalur status pembayaran berbeda dan tidak boleh menganggap gagalnya satu metode sebagai kedaluwarsanya seluruh invoice.
