'use strict';
/* GoO Ninks Admin Plus — independent modular enhancements (2026-11-01).
   Relies on existing authenticated admin.js, Supabase RLS and audited RPC. */
(()=>{
const normal=String.raw;
const baseFetchRows=fetchRows,baseRender=renderTable,baseOpen=openEditor,baseSave=saveRow,baseLoad=loadView;
schemas.inventory.fields.push(
 ['category','Kategori produk','select:Wastra|Batik|Tenun|Lurik|Ready to Wear|Aksesori|Lainnya',true],
 ['gallery_media','Galeri tambahan: URL gambar / video, satu per baris','textarea',false],
 ['preorder','Tersedia untuk Preorder (permintaan via WhatsApp)','checkbox',false],
 ['preorder_lead_days','Estimasi pengerjaan preorder (hari)','number',false],
 ['archived','Arsipkan produk / sembunyikan dari toko','checkbox',false]
);
schemas.ads.fields.push(['video_url','Video iklan (URL MP4 / WEBM)','text',false]);
schemas.archived={title:'Arsip Produk',desc:'Produk diarsipkan tidak tampil di toko. Pulihkan dengan tombol di bawah.',table:'gn_inventory',key:'sku',headline:'product_name',fields:[]};
schemas.deleted_orders={title:'Pesanan Dihapus',desc:'Arsip pesanan berikut alasan penghapusan. Pembayaran tetap tercatat dan tidak dibatalkan.',table:'gn_orders',key:'order_id',headline:'order_id',fields:[]};
schemas.customers={title:'Pelanggan',desc:'Kelola pelanggan dari checkout dan tambahkan data pelanggan secara manual.',table:'gn_orders',key:'order_id',headline:'customer_name',fields:[]};
schemas.account={title:'Pengaturan Akun',desc:'Ganti alamat email dan kata sandi akun login Anda.',table:'gn_admins',key:'user_id',headline:'user_id',fields:[]};

const sb=document.querySelector('#sidebarNav');
const menu=(name,icon,label,before)=>{
 const el=document.createElement('button');el.type='button';el.dataset.view=name;el.className='nav-link';
 const badge=document.createElement('span');badge.textContent=icon;el.append(badge,document.createTextNode(' '+label));
 sb.insertBefore(el,before||document.getElementById('teamNav'));
};
menu('archived','▧','Arsip Produk');menu('deleted_orders','▤','Pesanan Dihapus');
menu('customers','♧','Pelanggan');menu('account','⚙','Pengaturan Akun',null);
const secureUrl=x=>{try{const u=new URL(x);return u.protocol==='https:'?u.href:null}catch{return null}};
const btn=(label,attr,cls='')=>'<button type="button" class="'+cls+'" '+attr+'>'+safe(label)+'</button>';
const rowdate=d=>d?new Date(d).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'}):'—';

fetchRows=async function(view){
 if(view==='archived'){const {data,error}=await db.from('gn_inventory').select('*').eq('archived',true).order('updated_at',{ascending:false}).limit(500);if(error)throw error;return data||[]}
 if(view==='deleted_orders'){const {data,error}=await db.from('gn_orders').select('*').not('deleted_at','is',null).order('deleted_at',{ascending:false}).limit(500);if(error)throw error;return data||[]}
 if(view==='customers'){
  const [orders,profiles,inquiries]=await Promise.all([
   db.from('gn_orders').select('customer_name,customer_email,customer_phone,amount,created_at,order_id,deleted_at,status,paid_at').order('created_at',{ascending:false}).limit(500),
   db.from('gn_customer_profiles').select('*').limit(500),
   db.from('gn_leads').select('id,name,email,phone,created_at,order_id').eq('interest','Permintaan pembelian GoO Ninks').order('created_at',{ascending:false}).limit(500)
  ]);
  if(orders.error)throw orders.error;
  if(profiles.error)throw profiles.error;
  if(inquiries.error)throw inquiries.error;
  const p=new Map((profiles.data||[]).map(x=>[String(x.email).toLowerCase().trim(),x]));
  const orderIds=new Set((orders.data||[]).map(x=>x.order_id));
  return [
   ...(orders.data||[]).map(x=>({...x,_profile:p.get(String(x.customer_email).toLowerCase().trim())||null})),
   ...(inquiries.data||[]).filter(x=>!x.order_id||!orderIds.has(x.order_id)).map(x=>({
    customer_name:x.name,customer_email:x.email,customer_phone:x.phone,
    created_at:x.created_at,_inquiry:true,_profile:p.get(String(x.email).toLowerCase().trim())||null
   })),
   ...(profiles.data||[]).map(x=>({customer_email:x.email,customer_name:x.customer_name,customer_phone:x.customer_phone,_manual:true,_profile:x}))
  ];
 }
 if(view==='account')return [];
 if(view==='orders'){const {data,error}=await db.from('gn_orders').select('*').is('deleted_at',null).order('created_at',{ascending:false}).limit(500);if(error)throw error;return data||[]}
 return baseFetchRows(view);
};
function renderArchive(){
 const data=rows.filter(x=>(x.sku+' '+x.product_name+' '+x.category).toLowerCase().includes($('#searchBox').value.trim().toLowerCase()));
 $('#rowCounter').textContent=data.length+' produk diarsipkan';
 $('#records').innerHTML=data.length?'<div class="gn-plus-table"><table class="record-table"><thead><tr><th>Produk</th><th>Kategori</th><th>SKU</th><th>Arsip sejak</th><th>Aksi</th></tr></thead><tbody>'+
 data.map(x=>'<tr><td><strong>'+safe(x.product_name)+'</strong></td><td>'+safe(x.category)+'</td><td>'+safe(x.sku)+'</td><td>'+rowdate(x.updated_at)+'</td><td>'+btn('Pulihkan','data-restore-sku="'+safe(x.sku)+'"')+'</td></tr>').join('')+
 '</tbody></table></div>':'<div class="empty">Belum ada produk yang diarsipkan.</div>';
}
function renderDeletedOrders(){
 const data=rows.filter(x=>JSON.stringify(x).toLowerCase().includes($('#searchBox').value.trim().toLowerCase()));
 $('#rowCounter').textContent=data.length+' pesanan dihapus';
 $('#records').innerHTML=data.length?'<div class="gn-plus-table"><table class="record-table"><thead><tr><th>Pesanan</th><th>Pelanggan</th><th>Tanggal hapus</th><th>Alasan</th><th>Tindakan</th></tr></thead><tbody>'+
 data.map(x=>'<tr><td><strong>'+safe(x.order_id)+'</strong><small>'+rupiah(x.amount)+' • '+safe(x.status)+'</small></td><td>'+safe(x.customer_name)+'</td><td>'+rowdate(x.deleted_at)+'</td><td>'+safe(x.deleted_reason||'—')+'</td><td>'+btn('Pulihkan','data-order-action="restore" data-order-id="'+safe(x.order_id)+'"')+'</td></tr>').join('')+
 '</tbody></table></div>':'<div class="empty">Tidak ada pesanan yang dihapus.</div>';
}
function renderCustomers(){
 const m=new Map();
 for(const o of rows){
  const email=String(o.customer_email||'').toLowerCase().trim();
  const phone=String(o.customer_phone||'').trim();
  const key=email||('phone:'+phone.replace(/\D/g,''));
  if(!email&&!phone)continue;
  const prev=m.get(key)||{
   name:o.customer_name,email,phone,total:0,orders:0,requests:0,
   last:o.created_at||o._profile?.updated_at,
   customer_notes:o._profile?.customer_notes||'',customer_tags:o._profile?.customer_tags||''
  };
  if(o._profile){
   prev.name=o._profile.customer_name||prev.name;
   prev.phone=o._profile.customer_phone||prev.phone;
   prev.address=o._profile.customer_address||'';
  }
  if(o._inquiry)prev.requests++;
  else if(!o._manual)prev.orders++;
  if(o.status==='paid'){
   prev.paid_orders=(prev.paid_orders||0)+1;
   prev.total+=Math.max(0,Number(o.amount)||0);
  }
  if(o.created_at&&(!prev.last||Date.parse(o.created_at)>Date.parse(prev.last)))prev.last=o.created_at;
  m.set(key,prev);
 }
 const data=[...m.values()].filter(x=>JSON.stringify(x).toLowerCase().includes($('#searchBox').value.trim().toLowerCase()));
 $('#rowCounter').textContent=data.length+' pelanggan';
 $('#records').innerHTML=data.length?'<div class="gn-plus-table"><table class="record-table"><thead><tr><th>Pelanggan</th><th>Kontak</th><th>Pesanan / Permintaan</th><th>Belanja lunas</th><th>Terakhir</th><th>Catatan / Segmen</th><th>Aksi</th></tr></thead><tbody>'+
 data.map(x=>'<tr><td><strong>'+safe(x.name)+'</strong></td><td>'+safe(x.email)+'<small>'+safe(x.phone||'')+'</small></td><td>'+x.orders+(x.requests?' / '+x.requests+' permintaan':'')+'</td><td>'+rupiah(x.total)+'</td><td>'+rowdate(x.last)+'</td><td>'+safe(x.customer_tags||'—')+'<small>'+safe(x.customer_notes||'Belum ada catatan')+'</small></td><td>'+btn('Kelola','data-customer-edit="'+safe(x.email)+'"')+'</td></tr>').join('')+
 '</tbody></table></div>':'<div class="empty">Belum ada pelanggan. Klik Tambah pelanggan untuk memasukkan data manual.</div>';
}
function renderAccount(){
 $('#rowCounter').textContent='Akun saya';
 const email=currentUser?.email||'';
 $('#records').innerHTML='<div class="gn-plus-card"><h3>Alamat email akun</h3><form id="gnEmailForm"><label>Email baru<input name="email" type="email" value="'+safe(email)+'" required maxlength="180"></label><button class="primary small">Perbarui email</button><p>Konfirmasi perubahan mungkin dikirim ke email lama dan baru.</p></form></div>'+
 '<div class="gn-plus-card"><h3>Ubah kata sandi</h3><form id="gnPasswordForm"><label>Kata sandi baru<input name="password" type="password" required minlength="12" autocomplete="new-password"></label><label>Ulangi kata sandi<input name="repeat" type="password" required minlength="12" autocomplete="new-password"></label><button class="primary small">Simpan kata sandi</button></form></div>'+
 (currentRole==='owner'?'<div class="gn-plus-card"><h3>Akun karyawan</h3><p>Pendaftaran karyawan melalui formulir Daftar di halaman login, lalu pemilik menyetujui di menu Akun Tim. Tidak ada kata sandi karyawan yang disimpan di dashboard.</p>'+btn('Kelola akun karyawan','data-go-view="team"')+'</div>':'');
}
function decorateInventory(){
 document.querySelectorAll('#records [data-edit]').forEach(b=>{const sku=b.dataset.edit,record=rows.find(x=>x.sku===sku);if(!record)return;const cell=b.closest('tr')?.querySelector('td');if(!cell)return;
 const img=secureUrl(record.image_url);if(img&&!cell.querySelector('img')){const im=document.createElement('img');im.src=img;im.alt='';im.loading='lazy';im.className='gn-inventory-thumb';cell.prepend(im)}
 const d=document.createElement('small');d.textContent=(record.category||'Wastra')+(record.preorder?' • Preorder':'')+(record.archived?' • Diarsipkan':'');cell.append(d);
 const controls=b.closest('.actions');if(controls){const button=document.createElement('button');button.type='button';button.dataset.archiveSku=sku;button.textContent=record.archived?'Pulihkan':'Arsipkan';controls.insertBefore(button,controls.lastElementChild)}
 });
}
function decorateOrders(){
 document.querySelectorAll('#records .gn-order-card').forEach(card=>{
  const id=card.querySelector('.gn-order-number')?.textContent;const o=rows.find(x=>x.order_id===id);if(!o)return;
  const s=card.querySelector('summary');const meta=document.createElement('span');meta.className='gn-order-meta';meta.textContent=rowdate(o.created_at);s?.insertBefore(meta,s.lastElementChild);
  const body=card.querySelector('.gn-order-body>div:last-child');if(!body)return;
  const pay=document.createElement('p');pay.innerHTML='<b>Metode pembayaran:</b> '+safe(o.payment_type||'Belum dipilih / menunggu Midtrans')+'<br><b>Midtrans:</b> '+safe(o.midtrans_status||o.status);
  body.append(pay);
  if(o.edited_at){const ed=document.createElement('p');ed.className='gn-edit-marker';ed.textContent='✎ Diedit '+rowdate(o.edited_at)+' • '+(o.edit_reason||'');body.append(ed)}
  const actions=document.createElement('div');actions.className='gn-plus-actions';
  actions.innerHTML=btn('Edit data penerima','data-order-action="edit" data-order-id="'+safe(id)+'"')+
   btn('Hapus pesanan','data-order-action="soft_delete" data-order-id="'+safe(id)+'"','danger')+btn('Cetak rincian / PDF','data-print-order="'+safe(id)+'"');
  body.append(actions);
 });
}
renderTable=function(){
 if(currentView==='archived')return renderArchive();
 if(currentView==='deleted_orders')return renderDeletedOrders();
 if(currentView==='customers')return renderCustomers();
 if(currentView==='account')return renderAccount();
 baseRender();
 if(currentView==='orders')decorateOrders();
 if(currentView==='inventory')decorateInventory();
};
loadView=async function(view){await baseLoad(view);const button=$('#newButton');button.hidden=['archived','deleted_orders','account'].includes(currentView)||button.hidden;button.textContent=currentView==='customers'?'+ Tambah pelanggan':'+ Tambah baru';};
openEditor=function(row=null){
 if(currentView==='customers')return openCustomerDialog(row);
 baseOpen(row);
 if(currentView==='inventory'){
  if(!row&&$('#field_preorder_lead_days'))$('#field_preorder_lead_days').value='14';
  const f=document.createElement('label');f.className='field';
  f.innerHTML='Unggah foto/video tambahan (bisa pilih beberapa)<input name="gnMultiUpload" type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"><small>Foto maksimal 5MB per file; video maksimal 25MB. File lama tidak terhapus otomatis.</small>';
  $('#formFields').append(f);
 }
 if(currentView==='ads'){
  const f=document.createElement('label');f.className='field';
  f.innerHTML='Atau unggah video iklan<input name="gnAdUpload" type="file" accept="video/mp4,video/webm"><small>Video maksimal 25MB.</small>';
  $('#formFields').append(f);
 }
};
async function uploadMedia(file,folder){
 const allowed=['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
 if(!allowed.includes(file.type))throw Error('Tipe media tidak diizinkan');
 const video=file.type.startsWith('video/'),max=video?25*1024*1024:5*1024*1024;
 if(file.size>max)throw Error('File '+file.name+' terlalu besar');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[file.type];
 const path=folder+'/'+crypto.randomUUID()+'.'+ext;
 const {error}=await db.storage.from('gooninks-media').upload(path,file,{upsert:false,contentType:file.type});
 if(error)throw error;
 return db.storage.from('gooninks-media').getPublicUrl(path).data.publicUrl;
}
$('#editorForm').removeEventListener('submit',baseSave);
$('#editorForm').addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('#saveButton');btn.disabled=true;
 try{
  if(currentView==='promotions'){
   const percent=Number($('#field_discount_percent')?.value||0);
   if(!Number.isFinite(percent)||percent<0||percent>70)throw Error('Diskon checkout hanya boleh 0 sampai 70%.');
  }
  if(currentView==='inventory'){
   const uploads=[...e.currentTarget.querySelector('[name="gnMultiUpload"]')?.files||[]];
   if(uploads.length>15)throw Error('Maksimal 15 media per unggahan');
   if(uploads.length){
    const area=$('#field_gallery_media'),prev=area.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    for(const f of uploads){prev.push(await uploadMedia(f,'inventory'))}
    area.value=[...new Set(prev)].join('\n');
   }
   if($('#field_archived')?.checked){$('#field_visible').checked=false}
  }else if(currentView==='ads'){
   const upload=e.currentTarget.querySelector('[name="gnAdUpload"]')?.files?.[0];
   if(upload)$('#field_video_url').value=await uploadMedia(upload,'ads');
  }
  await baseSave(e);
 }catch(err){notify('Media: '+err.message,true)}finally{btn.disabled=false}
});
async function changeArchive(sku,restore){
 const record=rows.find(x=>x.sku===sku);if(!record)return;
 if(!confirm((restore?'Pulihkan':'Arsipkan')+' '+record.product_name+'?'))return;
 const payload=restore?{archived:false,visible:true}:{archived:true,visible:false};
 const {error}=await db.from('gn_inventory').update({...payload,updated_at:new Date().toISOString()}).eq('sku',sku);
 if(error)return notify(error.message,true);
 notify(restore?'Produk dipulihkan':'Produk telah diarsipkan');await loadView(currentView);
}
const modal=document.createElement('dialog');modal.className='gn-plus-modal';modal.id='gnOrderActionDialog';document.body.append(modal);
function openOrderDialog(order,action){
 const edit=action==='edit',restore=action==='restore';
 modal.innerHTML='<form method="dialog" id="gnOrderActionForm"><h3>'+(edit?'Edit penerima':restore?'Pulihkan pesanan':'Hapus pesanan')+'</h3><p>'+safe(order.order_id)+' • '+safe(order.status)+' • '+rupiah(order.amount)+'</p>'+
 (edit?'<label>Nama penerima<input name="name" required minlength="2" maxlength="100" value="'+safe(order.customer_name)+'"></label><label>Email<input name="email" type="email" required value="'+safe(order.customer_email)+'"></label><label>Telepon<input name="phone" required minlength="9" maxlength="25" value="'+safe(order.customer_phone)+'"></label><label>Alamat<textarea name="address" required minlength="10" maxlength="450">'+safe(order.customer_address)+'</textarea></label>':'')+
 '<label>Alasan '+(edit?'perubahan':restore?'pemulihan':'penghapusan')+' (wajib, minimal 8 karakter)<textarea name="reason" required minlength="8" maxlength="500" placeholder="Masukkan alasan sebagai jejak audit"></textarea></label>'+
 '<p class="gn-plus-warning">Pembayaran Midtrans dan total transaksi tidak diubah. Menghapus pesanan tidak membatalkan atau mengembalikan pembayaran.</p><div class="gn-plus-actions"><button type="button" data-close-order>Batal</button><button type="submit" class="primary small">Simpan</button></div></form>';
 modal.dataset.orderId=order.order_id;modal.dataset.action=action;modal.showModal();
 const f=modal.querySelector('form');f.addEventListener('submit',async e=>{
  e.preventDefault();const d=new FormData(f),button=f.querySelector('[type="submit"]');button.disabled=true;
  try{
   const args={p_order_id:order.order_id,p_action:action,p_reason:String(d.get('reason')||'').trim()};
   if(edit){args.p_customer_name=String(d.get('name')||'').trim();args.p_customer_email=String(d.get('email')||'').trim();args.p_customer_phone=String(d.get('phone')||'').trim();args.p_customer_address=String(d.get('address')||'').trim()}
   const {error}=await db.rpc('gn_order_admin_action_v2',args);if(error)throw error;
   modal.close();notify('Perubahan pesanan disimpan dalam audit');await loadView(currentView);
  }catch(err){notify(err.message,true)}finally{button.disabled=false}
 });
 modal.querySelector('[data-close-order]').addEventListener('click',()=>modal.close());
}
$('#records').addEventListener('click',async e=>{
 const c=e.target.closest('[data-customer-edit]');
 if(c){const record=rows.find(x=>String(x.customer_email).toLowerCase().trim()===c.dataset.customerEdit);if(record)openCustomerDialog(record);return}
 const archive=e.target.closest('[data-archive-sku],[data-restore-sku]');
 if(archive){const restore=!!archive.dataset.restoreSku;void changeArchive(restore?archive.dataset.restoreSku:archive.dataset.archiveSku,restore);return}
 const act=e.target.closest('[data-order-action]');
 if(act){const o=rows.find(x=>x.order_id===act.dataset.orderId);if(o)openOrderDialog(o,act.dataset.orderAction);return}
 const view=e.target.closest('[data-go-view]');if(view){void loadView(view.dataset.goView)}
});

/* Print a factual order summary; browser print allows Save as PDF. Do not label it as a tax invoice. */
function printOrderDetails(order){
 const popup=window.open('','_blank','width=860,height=900');
 if(!popup){notify('Pop-up diblokir browser. Izinkan pop-up untuk mencetak pesanan.',true);return}
 try{popup.opener=null}catch{}
 const items=Array.isArray(order.items)?order.items:[];
 const itemRows=items.map(item=>'<tr><td>'+safe(item.name||item.sku||'Produk')+'</td><td>'+safe(item.sku||'—')+'</td><td style="text-align:right">'+safe(item.qty||0)+'</td><td style="text-align:right">'+rupiah(item.price)+'</td><td style="text-align:right">'+rupiah((Number(item.price)||0)*(Number(item.qty)||0))+'</td></tr>').join('');
 const html='<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Rincian '+safe(order.order_id)+'</title>'+
 '<style>body{font:14px/1.55 Arial,sans-serif;color:#1c1c1c;max-width:780px;margin:30px auto;padding:0 20px}h1{font-size:24px;margin-bottom:4px}small{color:#666}table{border-collapse:collapse;width:100%;margin-top:22px}th,td{border-bottom:1px solid #ddd;padding:10px 6px;text-align:left}th{background:#f5f4f1}section{margin-top:20px}.total{font-size:20px;font-weight:bold;text-align:right}.warning{padding:12px;background:#f3eee4;margin-top:20px}@media print{body{margin:0 auto}.warning{background:#eee!important;print-color-adjust:exact}}</style></head><body>'+
 '<h1>GoO ninks</h1><small>Ringkasan pesanan — bukan faktur pajak</small><hr>'+
 '<p><b>Nomor:</b> '+safe(order.order_id)+'<br><b>Dibuat:</b> '+rowdate(order.created_at)+'<br><b>Status pembayaran:</b> '+safe(order.status)+'<br><b>Metode:</b> '+safe(order.payment_type||'Belum tersedia')+'</p>'+
 '<section><b>Penerima</b><p>'+safe(order.customer_name)+'<br>'+safe(order.customer_email)+'<br>'+safe(order.customer_phone)+'<br>'+safe(order.customer_address)+'</p></section>'+
 '<table><thead><tr><th>Produk</th><th>SKU</th><th>Qty</th><th>Harga</th><th>Subtotal</th></tr></thead><tbody>'+itemRows+'</tbody></table>'+
 '<p class="total">Total pesanan: '+rupiah(order.amount)+'</p>'+
 '<div class="warning">Dokumen ini bukan bukti pembayaran. Status lunas hanya sah setelah diverifikasi oleh Midtrans. Biaya pengiriman yang disepakati terpisah tidak termasuk jika belum tercatat dalam pesanan.</div>'+
 '</body></html>';
 popup.document.open();popup.document.write(html);popup.document.close();
 popup.addEventListener('load',()=>popup.print(),{once:true});
}
$('#records').addEventListener('click',e=>{
 const print=e.target.closest('[data-print-order]');
 if(!print)return;
 const order=rows.find(x=>x.order_id===print.dataset.printOrder);
 if(order)printOrderDetails(order);
});

$('#records').addEventListener('submit',async e=>{
 if(e.target.id==='gnEmailForm'||e.target.id==='gnPasswordForm'){
  e.preventDefault();const d=new FormData(e.target),password=String(d.get('password')||'');
  try{
   if(e.target.id==='gnEmailForm'){
    const {error}=await db.auth.updateUser({email:String(d.get('email')||'').trim().toLowerCase()});if(error)throw error;notify('Silakan cek email untuk konfirmasi perubahan');
   }else{
    if(password.length<12||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password)||password!==d.get('repeat'))throw Error('Password minimal 12 karakter dengan huruf dan angka, konfirmasi harus sama');
    const {error}=await db.auth.updateUser({password});if(error)throw error;notify('Kata sandi berhasil diperbarui');e.target.reset();
   }
  }catch(err){notify(err.message,true)}
 }
});
const customerDialog=document.createElement('dialog');customerDialog.className='gn-plus-modal';document.body.append(customerDialog);
function openCustomerDialog(record=null){
 const profile=record?._profile||{};
 customerDialog.innerHTML='<form><h3>'+(record?'Kelola pelanggan':'Tambah pelanggan')+'</h3>'+[
  ['customer_name','Nama pelanggan','text',profile.customer_name||record?.customer_name||'',100,true],
  ['email','Email','email',record?.customer_email||'',180,true],
  ['customer_phone','Nomor telepon / WhatsApp','tel',profile.customer_phone||record?.customer_phone||'',25,false],
  ['customer_address','Alamat','textarea',profile.customer_address||'',450,false],
  ['customer_tags','Segmen / label','text',profile.customer_tags||'',240,false],
  ['customer_notes','Catatan pelanggan','textarea',profile.customer_notes||'',2000,false]
 ].map(([name,label,type,value,max,required])=>'<label>'+label+(type==='textarea'?'<textarea name="'+name+'" maxlength="'+max+'">'+safe(value)+'</textarea>':'<input name="'+name+'" type="'+type+'" value="'+safe(value)+'" maxlength="'+max+'" '+(required?'required':'')+' '+(name==='email'&&record?'readonly':'')+'>')+'</label>').join('')+
 '<div class="gn-plus-actions"><button type="button" data-cancel-customer>Batal</button><button type="submit" class="primary small">Simpan pelanggan</button></div></form>';
 customerDialog.querySelector('[data-cancel-customer]').onclick=()=>customerDialog.close();
 customerDialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');button.disabled=true;
  try{
   const fields=Object.fromEntries(new FormData(form));for(const key in fields)fields[key]=String(fields[key]).trim();
   fields.email=fields.email.toLowerCase();if(fields.customer_name.length<2)throw Error('Nama pelanggan minimal 2 karakter');
   fields.updated_by=currentUser.id;fields.updated_at=new Date().toISOString();
   const query=record?db.from('gn_customer_profiles').upsert(fields,{onConflict:'email'}):db.from('gn_customer_profiles').insert(fields);
   const {data,error}=await query.select('email');if(error){if(error.code==='23505')throw Error('Email sudah terdaftar. Gunakan Kelola pada pelanggan tersebut.');throw error}
   if(!data?.length)throw Error('Data pelanggan tidak tersimpan. Periksa akses akun.');
   customerDialog.close();notify('Data pelanggan berhasil disimpan');await loadView('customers');
  }catch(error){notify(error.message,true)}finally{button.disabled=false}
 };
 customerDialog.showModal();
}
const bell=document.createElement('div');bell.className='gn-notif-wrap';
bell.innerHTML='<button type="button" class="gn-notif-bell" aria-label="Lihat notifikasi" aria-expanded="false" aria-controls="gnNotifPop" id="gnNotifBell"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="gnNotifCount" hidden>0</span></button><div class="gn-notif-pop" id="gnNotifPop" hidden><h3>Notifikasi terbaru</h3><div id="gnNotifList">Memuat…</div></div>';
document.querySelector('.top-actions')?.prepend(bell);
const bellBtn=bell.querySelector('button'),pop=bell.querySelector('#gnNotifPop'),count=bell.querySelector('#gnNotifCount');
let notificationItems=[],readKeys=new Set(),notificationUser=null,notificationLoading=false;
function paintNotifications(){
 const unread=notificationItems.filter(item=>!readKeys.has(item.key));
 count.textContent=String(unread.length);count.hidden=unread.length===0;
 bellBtn.setAttribute('aria-label',unread.length+' notifikasi belum dibaca');
 bell.querySelector('#gnNotifList').innerHTML=notificationItems.length?notificationItems.map(item=>'<button type="button" class="gn-notif-item '+(readKeys.has(item.key)?'is-read':'is-unread')+'" data-notification-key="'+safe(item.key)+'">'+safe(item.title)+'<small>'+rowdate(item.date)+(readKeys.has(item.key)?' · Sudah dibaca':' · Belum dibaca')+'</small></button>').join(''):'<p>Tidak ada notifikasi yang perlu ditindaklanjuti.</p>';
}
bellBtn.addEventListener('click',()=>{pop.hidden=!pop.hidden;bellBtn.setAttribute('aria-expanded',String(!pop.hidden));if(!pop.hidden)void refreshNotifications()});
document.addEventListener('click',event=>{if(!bell.contains(event.target)){pop.hidden=true;bellBtn.setAttribute('aria-expanded','false')}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!pop.hidden){pop.hidden=true;bellBtn.setAttribute('aria-expanded','false');bellBtn.focus()}});
pop.addEventListener('click',async event=>{
 const button=event.target.closest('[data-notification-key]');if(!button||button.disabled||!currentUser)return;
 const item=notificationItems.find(x=>x.key===button.dataset.notificationKey);if(!item)return;
 const userId=currentUser.id;button.disabled=true;
 try{
  if(!readKeys.has(item.key)){
   const {error}=await db.from('gn_notification_reads').upsert({user_id:userId,notification_key:item.key,read_at:new Date().toISOString()},{onConflict:'user_id,notification_key'});if(error)throw error;
   if(currentUser?.id!==userId)return;
   readKeys.add(item.key);paintNotifications();
  }
  pop.hidden=true;bellBtn.setAttribute('aria-expanded','false');await loadView(item.view);
 }catch(error){notify('Gagal menandai notifikasi: '+error.message,true)}finally{button.disabled=false}
});
async function refreshNotifications(){
 if(!db||!currentUser||notificationLoading)return;
 const userId=currentUser.id;notificationLoading=true;
 if(notificationUser!==userId){notificationUser=userId;readKeys=new Set();notificationItems=[];paintNotifications()}
 try{
 const [r,l,p,reads]=await Promise.all([
  db.from('gn_orders').select('order_id,customer_name,created_at,status').eq('status','pending').is('deleted_at',null).order('created_at',{ascending:false}).limit(500),
  db.from('gn_leads').select('id,name,created_at,stage').eq('stage','new').order('created_at',{ascending:false}).limit(500),
  db.from('gn_inventory').select('sku,product_name,stock,low_stock_threshold').eq('archived',false).limit(500),
  db.from('gn_notification_reads').select('notification_key').eq('user_id',userId).order('read_at',{ascending:false}).limit(1000)
 ]);
 for(const result of [r,l,p,reads])if(result.error)throw result.error;
 if(currentUser?.id!==userId)return;
 readKeys=new Set([...readKeys,...(reads.data||[]).map(x=>x.notification_key)]);
 const low=(p.data||[]).filter(x=>x.stock!==null&&x.stock<=x.low_stock_threshold);
 notificationItems=[...(r.data||[]).map(x=>({key:'order:'+x.order_id+':pending',title:'Pesanan menunggu bayar: '+x.customer_name,date:x.created_at,view:'orders'})),...(l.data||[]).map(x=>({key:'lead:'+x.id+':new',title:'Lead baru: '+x.name,date:x.created_at,view:'leads'})),...low.map(x=>({key:'stock:'+x.sku+':'+x.stock,title:'Stok menipis: '+x.product_name,date:null,view:'inventory'}))];
 paintNotifications();
 }catch(err){console.warn('Notifications unavailable:',err.message);bell.querySelector('#gnNotifList').textContent='Gagal memuat notifikasi. Buka kembali untuk mencoba lagi.'}finally{notificationLoading=false}
}

/* Reconcile pending payments only after querying Midtrans from the authenticated server.
   Never release inventory simply because the checkout is old. */
const paymentReadinessOriginal=refreshPaymentReadiness;
refreshPaymentReadiness=async function(inventory){
 await paymentReadinessOriginal(inventory);
 const target=$('#paymentReadiness');
 const links=target?.querySelector('.gn-payment-readiness-links');
 if(!links||links.querySelector('#gnReconcilePayments'))return;
 const button=document.createElement('button');
 button.type='button';button.id='gnReconcilePayments';
 button.textContent='Periksa ulang pembayaran Midtrans';
 button.addEventListener('click',async()=>{
  if(button.disabled||!currentUser)return;
  button.disabled=true;button.textContent='Memverifikasi pesanan…';
  let note=target.querySelector('#gnReconcileResult');
  if(!note){note=document.createElement('p');note.className='gn-payment-readiness-summary';note.id='gnReconcileResult';target.append(note)}
  note.textContent='Memeriksa status pesanan langsung melalui Midtrans. Stok tidak akan diubah tanpa status terverifikasi.';
  try{
   const {data:session,error:sessionError}=await db.auth.getSession();
   if(sessionError||!session?.session?.access_token)throw Error('Sesi admin berakhir. Silakan login kembali.');
   const result=await fetch(cfg.url+'/functions/v1/gn-admin-reconcile-payments',{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':cfg.publishableKey,'Authorization':'Bearer '+session.session.access_token},
    body:JSON.stringify({action:'reconcile'}),cache:'no-store',signal:AbortSignal.timeout(125000)
   });
   const data=await result.json().catch(()=>({}));
   if(!result.ok)throw Error(data.error||'Server gagal menyinkronkan pembayaran (HTTP '+result.status+').');
   note.textContent='Diperiksa '+data.scanned+' pesanan: '+data.updated+' berubah sesuai status Midtrans, '+data.pending+' masih menunggu, '+data.unresolved+' belum dapat dipastikan, '+data.errors+' gagal diperiksa.';
   if(data.unresolved||data.errors)note.textContent+=' Jangan lepaskan stok untuk transaksi yang belum terverifikasi.';
   notify(data.updated?'Status pembayaran berhasil disinkronkan':'Pemeriksaan Midtrans selesai');
   if(data.updated)await loadView('overview');
  }catch(err){note.textContent='Sinkronisasi gagal: '+(err.message||'Koneksi tidak tersedia');notify('Gagal memeriksa pembayaran',true)}
  finally{button.disabled=false;button.textContent='Periksa ulang pembayaran Midtrans'}
 });
 links.append(button);
};

const _activate=activate;activate=async function(user){await _activate(user);void refreshNotifications()};
setInterval(()=>{if(currentUser&&!document.hidden)void refreshNotifications()},45000);
})();
