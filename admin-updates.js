'use strict';
/* GoO Ninks: inventory media UX, reusable product categories and consolidated order filters.
   Works with existing Admin Plus. Auth/RLS remain enforced by Supabase. */
(()=>{
 const $=selector=>document.querySelector(selector);
 const productNameIndex=schemas.inventory.fields.findIndex(field=>field[0]==='product_name');
 if(!schemas.inventory.fields.some(field=>field[0]==='description'))
   schemas.inventory.fields.splice(productNameIndex+1,0,['description','Deskripsi produk','textarea',false]);
 const categoryField=schemas.inventory.fields.find(field=>field[0]==='image_url');
 // Keep the URL field for manual editing, but only one file-upload input.
 categoryField[1]='Foto utama (URL; terisi otomatis saat unggah)';
 categoryField[2]='url';
 delete schemas.deleted_orders;
 document.querySelector('#sidebarNav [data-view="deleted_orders"]')?.remove();

 const oldFetch=fetchRows;
 fetchRows=async view=>{
   if(view!=='orders')return oldFetch(view);
   const {data,error}=await db.from('gn_orders').select('*').order('created_at',{ascending:false}).limit(500);
   if(error)throw error;
   return data||[];
 };

 const filter=document.createElement('label');
 filter.className='gn-status-filter';
 filter.hidden=true;
 filter.innerHTML='<span>Filter Status</span><select id="gnOrderStatusFilter" aria-label="Filter status pesanan">'+
  [['all','Semua Status'],['paid','Selesai'],['pending','Pending'],['deleted','Dihapus'],['cancelled','Dibatalkan'],['refunded','Dikembalikan']]
   .map(([code,label])=>'<option value="'+code+'">'+label+'</option>').join('')+'</select>';
 $('#moduleScreen .toolbar').insertBefore(filter,$('#rowCounter'));
 const statusSelect=filter.querySelector('select');
 const matchOrder=order=>{
   const selected=statusSelect.value;
   if(selected==='deleted')return Boolean(order.deleted_at);
   if(order.deleted_at)return false;
   if(selected==='paid')return order.status==='paid';
   if(selected==='pending')return ['pending','review'].includes(order.status);
   if(selected==='cancelled')return ['cancelled','expired','failed'].includes(order.status);
   if(selected==='refunded')return order.status==='refunded';
   return true;
 };
 const statusLabel=order=>{
   if(order.deleted_at)return 'Dihapus';
   if(order.status==='paid')return 'Selesai';
   if(order.status==='refunded')return 'Dikembalikan';
   if(['cancelled','expired','failed'].includes(order.status))return 'Dibatalkan';
   if(order.status==='review')return 'Pending · periksa pembayaran';
   return 'Pending';
 };
 const previousRender=renderTable;
 renderTable=function(){
   if(currentView!=='orders')return previousRender();
   const all=rows;
   rows=all.filter(matchOrder);
   try{previousRender()}finally{rows=all}
   $('#rowCounter').textContent=all.filter(matchOrder).length+' pesanan';
   for(const card of document.querySelectorAll('#records .gn-order-card')){
     const id=card.querySelector('.gn-order-number')?.textContent;
     const order=all.find(item=>item.order_id===id);
     if(!order)continue;
     const pill=card.querySelector('summary .pill');
     if(pill){
       pill.textContent=statusLabel(order);
       pill.classList.toggle('on',order.status==='paid'&&!order.deleted_at);
       pill.classList.toggle('off',order.status!=='paid'||Boolean(order.deleted_at));
     }
     if(order.deleted_at){
       card.querySelector('[data-order-action="edit"]')?.remove();
       const action=card.querySelector('[data-order-action="soft_delete"]');
       if(action){
         action.dataset.orderAction='restore';
         action.textContent='Pulihkan pesanan';
         action.classList.remove('danger');
       }
       const details=card.querySelector('.gn-order-body>div:last-child');
       if(details){
         const reason=document.createElement('p');
         reason.className='gn-edit-marker';
         reason.textContent='Dihapus: '+(order.deleted_reason||'Tidak ada alasan')+'. Penghapusan ini tidak membatalkan pembayaran.';
         details.prepend(reason);
       }
     }
   }
 };
 statusSelect.addEventListener('change',()=>{if(currentView==='orders')renderTable()});
 const previousLoad=loadView;
 loadView=async function(view){
   await previousLoad(view);
   filter.hidden=currentView!=='orders';
 };

 const ADD_NEW='__gn_category_add_new__';
 let previewUrls=[];
 let queuedFiles=[];
 let existingMedia=[];
 const removedExisting=new Set();
 const uploadedUrls=new Map();
 const fileKey=f=>[f.name,f.size,f.lastModified,f.type].join(':');
 function addFiles(input){
   const chosen=Array.from(input.files||[]);
   input.value=''; // Keep previous picks when Android returns one photo at a time.
   if(!chosen.length)return;
   const accepted=['image/jpeg','image/png','image/webp'];
   const invalid=chosen.find(f=>!accepted.includes(f.type)||!f.size||f.size>5*1024*1024);
   if(invalid)return notify('Format atau ukuran tidak sesuai: '+invalid.name,true);
   const merged=new Map(queuedFiles.map(f=>[fileKey(f),f]));
   chosen.forEach(f=>merged.set(fileKey(f),f));
   if(merged.size>15)return notify('Maksimal 15 foto produk dalam satu penyimpanan.',true);
   queuedFiles=Array.from(merged.values());
   renderUploadPreview();
 }
 const revokePreviews=()=>{previewUrls.forEach(url=>URL.revokeObjectURL(url));previewUrls=[]};
 $('#editorDialog').addEventListener('close',revokePreviews);
 function categoryToggle(){
   const field=$('#gnNewCategoryWrap'),choice=$('#field_category');
   if(!field||!choice)return;
   field.hidden=choice.value!==ADD_NEW;
   field.querySelector('input').required=!field.hidden;
 }
 async function populateCategories(saved){
   const choice=$('#field_category');
   if(!choice)return;
   const {data,error}=await db.from('gn_product_categories').select('name').order('name',{ascending:true}).limit(200);
   if(error)throw error;
   if(!choice.isConnected)return;
   const selected=choice.value||saved||'Wastra';
   const values=new Set([...Array.from(choice.options).map(x=>x.value).filter(x=>x!==ADD_NEW),...(data||[]).map(x=>x.name),saved].filter(Boolean));
   choice.replaceChildren();
   for(const value of values){
     const opt=document.createElement('option');opt.value=value;opt.textContent=value;choice.append(opt);
   }
   const add=document.createElement('option');add.value=ADD_NEW;add.textContent='＋ Tambah kategori baru…';choice.append(add);
   choice.value=selected;categoryToggle();
 }
 function renderUploadPreview(){
   revokePreviews();
   const files=queuedFiles;
   const summary=$('#gnUploadCount'),grid=$('#gnUploadPreview');
   summary.textContent=files.length+' dari 15 foto dipilih';
   if(files.length>15)summary.textContent+=' · Maksimal 15 file';
   grid.replaceChildren();
   for(const file of files.slice(0,15)){
     const node=document.createElement('div');
     node.className='gn-preview-item';
     const url=URL.createObjectURL(file);
     previewUrls.push(url);
     const media=document.createElement('img');
     media.src=url;
     media.alt=file.name;
     const caption=document.createElement('small');caption.textContent=file.name;
     const remove=document.createElement('button');
     remove.type='button';remove.className='gn-preview-remove';remove.textContent='Hapus';
     remove.setAttribute('aria-label','Hapus '+file.name);
     remove.addEventListener('click',event=>{
       event.preventDefault();event.stopPropagation();
       queuedFiles=queuedFiles.filter(f=>fileKey(f)!==fileKey(file));
       renderUploadPreview();
     });
     node.append(media,caption,remove);grid.append(node);
   }
 }
 function renderExistingMedia(){
   const grid=$('#gnExistingMedia'),summary=$('#gnExistingCount');
   if(!grid||!summary)return;
   const remaining=existingMedia.filter(item=>!removedExisting.has(item.url)).length;
   summary.textContent=existingMedia.length
     ?remaining+' foto tersimpan · '+removedExisting.size+' akan dihapus'
     :'Belum ada foto tersimpan';
   grid.replaceChildren();
   existingMedia.forEach((item,index)=>{
     const removed=removedExisting.has(item.url);
     const card=document.createElement('div');
     card.className='gn-preview-item gn-existing-item';
     card.classList.toggle('gn-existing-removed',removed);
     const video=/\.(mp4|webm|mov)(?:[?#]|$)/i.test(item.url);
     const media=document.createElement(video?'video':'img');
     if(/^https?:\/\//i.test(item.url)){
       media.src=item.url;
       if(video)media.preload='metadata';
       else media.alt=item.cover?'Foto utama tersimpan':'Foto galeri tersimpan';
     }
     const caption=document.createElement('small');
     caption.textContent=(item.cover?'Foto utama':'Foto galeri '+index)+(removed?' · Akan dihapus':'');
     const action=document.createElement('button');
     action.type='button';
     action.className='gn-preview-remove';
     action.textContent=removed?'Urungkan':'Hapus foto';
     action.setAttribute('aria-label',(removed?'Urungkan hapus foto tersimpan ':'Hapus foto tersimpan ')+(index+1));
     action.addEventListener('click',()=>{
       if(removed)removedExisting.delete(item.url);else removedExisting.add(item.url);
       renderExistingMedia();
     });
     card.append(media,caption,action);grid.append(card);
   });
 }
 const previousOpen=openEditor;
 openEditor=function(row=null){
   revokePreviews();queuedFiles=[];uploadedUrls.clear();removedExisting.clear();
   previousOpen(row);
   if(currentView!=='inventory')return;
   const description=$('#field_description');
   if(description){description.rows=6;description.placeholder='Tulis detail produk, bahan, potongan, dan perawatan…';}
   const originalCover=String(row?.image_url||'').trim();
   const originalGallery=String(row?.gallery_media||'').split(/\r?\n/).map(url=>url.trim()).filter(Boolean);
   existingMedia=[...new Set([originalCover,...originalGallery].filter(Boolean))]
     .map(url=>({url,cover:url===originalCover}));

   // Existing uploader from Admin Plus remains; the former single-image input
   // is prevented by setting the image_url schema kind to URL above.
   const input=$('#formFields [name="gnMultiUpload"]');
   const uploadField=input?.closest('.field');
   if(input&&uploadField){
     uploadField.classList.add('gn-one-upload');
     input.multiple=true;
     uploadField.firstChild.textContent='Upload foto produk (bisa pilih lebih dari satu)';
     input.setAttribute('accept','image/jpeg,image/png,image/webp');
     const count=document.createElement('div');count.id='gnUploadCount';
     count.className='gn-upload-counter';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
     count.textContent='0 dari 15 foto dipilih';
     const cover=document.createElement('label');cover.className='gn-cover-choice';
     cover.innerHTML='<input type="checkbox" id="gnUseCover" '+(!row?.image_url?'checked':'')+'> Jadikan foto pertama sebagai foto utama';
     const gallery=document.createElement('div');gallery.id='gnUploadPreview';gallery.className='gn-upload-preview';
     const existingTitle=document.createElement('p');existingTitle.className='gn-existing-title';
     existingTitle.textContent='Foto yang sudah tersimpan';
     const existingHint=document.createElement('p');existingHint.className='gn-existing-hint';
     existingHint.textContent='Pilih Hapus foto, lalu klik Simpan perubahan. Bisa diurungkan sebelum disimpan.';
     const existingCount=document.createElement('div');existingCount.id='gnExistingCount';
     existingCount.className='gn-upload-counter';existingCount.setAttribute('role','status');
     existingCount.setAttribute('aria-live','polite');
     const existingGrid=document.createElement('div');existingGrid.id='gnExistingMedia';
     existingGrid.className='gn-upload-preview gn-existing-media';
     const options=document.createElement('div');options.className='gn-upload-options';
     const saveStatus=document.createElement('p');saveStatus.id='gnMediaSaveStatus';
     saveStatus.className='gn-media-save-status';saveStatus.setAttribute('role','status');
     saveStatus.setAttribute('aria-live','polite');saveStatus.hidden=true;
     options.append(existingTitle,existingHint,existingCount,existingGrid,count,cover,gallery,saveStatus);
     uploadField.after(options);
     // Preserve existing values for saving without displaying other photo entry paths.
     const main=$('#field_image_url')?.closest('.field');
     const media=$('#field_gallery_media')?.closest('.field');
     if(main&&media){
       const hiddenFields=document.createElement('div');hiddenFields.hidden=true;
       hiddenFields.className='gn-media-data-only';
       hiddenFields.append(main,media);options.after(hiddenFields);
     }
     input.addEventListener('change',()=>addFiles(input));
     renderExistingMedia();
     renderUploadPreview();
   }
   const select=$('#field_category');
   if(select){
     if(row?.category&&!Array.from(select.options).some(x=>x.value===row.category)){
       const opt=document.createElement('option');opt.value=row.category;opt.textContent=row.category;select.append(opt);
     }
     if(row?.category)select.value=row.category;
     const opt=document.createElement('option');opt.value=ADD_NEW;opt.textContent='＋ Tambah kategori baru…';select.append(opt);
     const custom=document.createElement('label');custom.id='gnNewCategoryWrap';custom.className='field';
     custom.hidden=true;
     custom.innerHTML='Nama kategori baru<input id="gnNewCategory" type="text" minlength="2" maxlength="60" autocomplete="off" placeholder="Contoh: Outerwear"><small>Disimpan di daftar kategori agar dapat dipakai kembali.</small>';
     select.closest('.field').after(custom);
     select.addEventListener('change',categoryToggle);
     void populateCategories(row?.category).catch(error=>notify('Kategori: '+error.message,true));
   }
 };
 async function uploadMedia(file){
   const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
   if(!types[file.type])throw Error('Format '+file.name+' tidak diizinkan');
   const sizeLimit=5*1024*1024;
   if(file.size>sizeLimit)throw Error('Ukuran '+file.name+' melebihi batas');
   const path='inventory/'+crypto.randomUUID()+'.'+types[file.type];
   const {error}=await db.storage.from('gooninks-media').upload(path,file,{upsert:false,contentType:file.type});
   if(error)throw error;
   return db.storage.from('gooninks-media').getPublicUrl(path).data.publicUrl;
 }
 // Inventory media must be persisted with its SKU and verified before reporting success.
 // Capture submission ahead of the legacy Admin Plus handler, retaining other modules.
 $('#editorForm').addEventListener('submit',async event=>{
   if(currentView!=='inventory')return;
   event.preventDefault();event.stopImmediatePropagation();
   const form=event.currentTarget,save=$('#saveButton');
   if(save.disabled)return;
   save.disabled=true;save.textContent='Menyimpan…';
   const saveStatus=$('#gnMediaSaveStatus');
   if(saveStatus){saveStatus.hidden=true;saveStatus.textContent='';}
   try{
     const category=$('#field_category');
     if(category?.value===ADD_NEW){
       const name=String($('#gnNewCategory')?.value||'').replace(/\s+/g,' ').trim();
       if(name.length<2||name.length>60)throw Error('Nama kategori wajib 2 sampai 60 karakter.');
       const {error}=await db.from('gn_product_categories').insert({name});
       if(error&&error.code!=='23505')throw error;
       const option=document.createElement('option');option.value=name;option.textContent=name;
       category.add(option);category.value=name;categoryToggle();
     }
     const files=queuedFiles.slice();
     if(files.length>15)throw Error('Maksimal 15 foto dalam satu penyimpanan.');
     for(const file of files){
       const max=5*1024*1024;
       if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>max)
         throw Error('Periksa format/ukuran file: '+file.name);
     }
     const gallery=$('#field_gallery_media');
     const previous=String(gallery?.value||'').split(/\r?\n/)
       .map(x=>x.trim()).filter(url=>url&&!removedExisting.has(url));
     const main=$('#field_image_url');
     const previousCover=String(main?.value||'').trim();
     let nextCover=removedExisting.has(previousCover)?'':previousCover;
     const wantCover=Boolean($('#gnUseCover')?.checked||!nextCover);
     const cover=wantCover?files.find(file=>file.type.startsWith('image/')):null;
     for(let i=0;i<files.length;i++){
       const file=files[i],key=fileKey(file);
       save.textContent='Mengunggah '+(i+1)+'/'+files.length+'…';
       let url=uploadedUrls.get(key);
       if(!url){url=await uploadMedia(file);uploadedUrls.set(key,url)}
       if(file===cover)nextCover=url;
       else previous.push(url);
     }
     if(!nextCover){
       const replacementIndex=previous.findIndex(url=>!/\.(mp4|webm|mov)(?:[?#]|$)/i.test(url));
       if(replacementIndex>=0)nextCover=previous.splice(replacementIndex,1)[0];
     }
     if(nextCover!==previousCover&&previousCover&&!removedExisting.has(previousCover))
       previous.unshift(previousCover);
     const finalGallery=[...new Set(previous.filter(url=>url&&url!==nextCover&&!removedExisting.has(url)))].join('\n');
     if(main)main.value=nextCover;
     if(gallery)gallery.value=finalGallery;
     if($('#field_archived')?.checked)$('#field_visible').checked=false;

     // Build the payload from the same inventory schema, but verify the actual
     // database response. Previously saveRow swallowed errors and the uploader
     // treated unsuccessful database writes as if photos were attached.
     const formData=new FormData(form),payload={};
     for(const [name,,kind,required] of schemas.inventory.fields){
       let value;
       if(kind==='checkbox')value=formData.get(name)==='on';
       else if(kind==='number'){
         const raw=String(formData.get(name)||'').trim();
         value=raw===''&&name==='stock'?null:Number(raw||0);
         if(name==='preorder_lead_days'&&value===0)value=14;
       }else value=String(formData.get(name)||'').trim();
       if(required&&(value===''||value===null||Number.isNaN(value)))
         throw Error('Lengkapi kolom wajib: '+name);
       payload[name]=value;
     }
     if(!payload.image_url&&!payload.gallery_media&&files.length)
       throw Error('URL gambar tidak berhasil disiapkan.');
     const currentSku=editing?.sku||payload.sku;
     if(!currentSku)throw Error('SKU produk tidak ditemukan.');
     if(payload.sku.length<2||payload.sku.length>80)throw Error('Kode produk wajib 2 sampai 80 karakter.');
      const newSku=payload.sku;
     payload.updated_at=new Date().toISOString();
     save.textContent='Menyimpan data produk…';
     const command=editing
       ?db.from('gn_inventory').update(payload).eq('sku',currentSku)
       :db.from('gn_inventory').insert(payload);
     const {data,error}=await command.select('sku,image_url,gallery_media,description');
     if(error){if(error.code==='23505')throw Error('Kode produk sudah digunakan. Pilih kode lain.');throw Error('Database menolak penyimpanan: '+(error.message||'Tidak diketahui'));}
     if(!Array.isArray(data)||data.length!==1||data[0].sku!==newSku)
       throw Error('Database tidak mengonfirmasi produk '+currentSku+'. Foto belum ditautkan.');
     if(data[0].image_url!==payload.image_url||data[0].gallery_media!==payload.gallery_media)
       throw Error('Galeri produk belum sama dengan data yang dikirim. Simpan lagi.');
     if(data[0].description!==payload.description)
       throw Error('Deskripsi produk belum sama dengan data yang dikirim. Simpan lagi.');
     const removedCount=removedExisting.size;
     queuedFiles=[];uploadedUrls.clear();removedExisting.clear();
     $('#editorDialog').close();
     notify('Foto dan data '+newSku+' berhasil disimpan'+(removedCount?' · '+removedCount+' foto dihapus dari produk':''));
     await loadView('inventory');
   }catch(error){
     const canRetry=uploadedUrls.size?' Foto yang sudah terunggah tetap tersimpan; cukup klik Simpan lagi, tidak perlu upload ulang.':'';
     const message='Inventori: '+(error.message||'Gagal menyimpan')+canRetry;
     if(saveStatus){saveStatus.hidden=false;saveStatus.textContent=message;}
     notify(message,true);
   }finally{
     save.disabled=false;save.textContent='Simpan perubahan';
   }
 },true);
})();