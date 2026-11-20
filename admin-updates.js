'use strict';
/* GoO Ninks: inventory media UX, reusable product categories and consolidated order filters.
   Works with existing Admin Plus. Auth/RLS remain enforced by Supabase. */
(()=>{
 const $=selector=>document.querySelector(selector);
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
 let recoveredUrls=new Set();
 const uploadedUrls=new Map();
 const fileKey=f=>[f.name,f.size,f.lastModified,f.type].join(':');
 function addFiles(input){
   const chosen=Array.from(input.files||[]);
   input.value=''; // Keep previous picks when Android returns one photo at a time.
   if(!chosen.length)return;
   const accepted=['image/jpeg','image/png','image/webp','video/mp4','video/webm'];
   const invalid=chosen.find(f=>!accepted.includes(f.type)||!f.size||f.size>(f.type.startsWith('video/')?25:5)*1024*1024);
   if(invalid)return notify('Format atau ukuran tidak sesuai: '+invalid.name,true);
   const merged=new Map(queuedFiles.map(f=>[fileKey(f),f]));
   chosen.forEach(f=>merged.set(fileKey(f),f));
   if(merged.size>15)return notify('Maksimal 15 foto/video per produk dalam satu penyimpanan.',true);
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
   const photos=files.filter(file=>file.type.startsWith('image/')).length;
   const summary=$('#gnUploadCount'),grid=$('#gnUploadPreview');
   summary.textContent=photos+' foto, '+(files.length-photos)+' video dipilih ('+files.length+' file)';
   if(files.length>15)summary.textContent+=' · Maksimal 15 file';
   grid.replaceChildren();
   for(const file of files.slice(0,15)){
     const node=document.createElement('div');
     node.className='gn-preview-item';
     const url=URL.createObjectURL(file);
     previewUrls.push(url);
     const media=document.createElement(file.type.startsWith('image/')?'img':'video');
     media.src=url;
     if(media.tagName==='IMG')media.alt=file.name;
     else {media.muted=true;media.controls=true;media.preload='metadata'}
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
 const previousOpen=openEditor;
 openEditor=function(row=null){
   revokePreviews();queuedFiles=[];uploadedUrls.clear();recoveredUrls.clear();
   previousOpen(row);
   if(currentView!=='inventory')return;

   // Existing uploader from Admin Plus remains; the former single-image input
   // is prevented by setting the image_url schema kind to URL above.
   const input=$('#formFields [name="gnMultiUpload"]');
   const uploadField=input?.closest('.field');
   if(input&&uploadField){
     uploadField.classList.add('gn-one-upload');
     input.multiple=true;
     uploadField.firstChild.textContent='Unggah foto produk (pilih banyak atau satu per satu)';
     const count=document.createElement('div');count.id='gnUploadCount';
     count.className='gn-upload-counter';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
     count.textContent='0 foto, 0 video dipilih';
     const cover=document.createElement('label');cover.className='gn-cover-choice';
     cover.innerHTML='<input type="checkbox" id="gnUseCover" '+(!row?.image_url?'checked':'')+'> Jadikan foto pertama sebagai foto utama';
     const gallery=document.createElement('div');gallery.id='gnUploadPreview';gallery.className='gn-upload-preview';
     const options=document.createElement('div');options.className='gn-upload-options';
     options.append(count,cover,gallery);uploadField.after(options);
     // Manual URL fields are advanced settings, not a second uploader.
     const main=$('#field_image_url')?.closest('.field');
     const media=$('#field_gallery_media')?.closest('.field');
     if(main&&media){
       const manual=document.createElement('details');manual.className='gn-media-manual';
       const heading=document.createElement('summary');heading.textContent='Pengaturan URL foto & galeri (opsional)';
       manual.append(heading,main,media);options.after(manual);
     }
     input.addEventListener('change',()=>addFiles(input));
     renderUploadPreview();
     const rescue=document.createElement('details');
     rescue.id='gnRecoveryPanel';rescue.className='gn-recovery-panel';
     const heading=document.createElement('summary');
     heading.textContent='Pulihkan foto yang sudah terunggah tetapi belum masuk produk';
     const hint=document.createElement('p');
     hint.textContent='Pilih foto yang memang milik produk ini. Foto yang belum terhubung ke produk lain bisa dimasukkan tanpa mengunggah ulang.';
     const grid=document.createElement('div');grid.className='gn-recovery-grid';
     const info=document.createElement('p');info.className='gn-recovery-message';info.setAttribute('role','status');
     rescue.append(heading,hint,info,grid);options.append(rescue);
     let loadingRecovery=false,loadedRecovery=false;
     rescue.addEventListener('toggle',async()=>{
       if(!rescue.open||loadingRecovery||loadedRecovery||!db)return;
       loadingRecovery=true;info.textContent='Memeriksa foto yang belum terhubung…';
       try{
         const [filesResult,inventoryResult]=await Promise.all([
           db.storage.from('gooninks-media').list('inventory',{limit:100,sortBy:{column:'created_at',order:'desc'}}),
           db.from('gn_inventory').select('image_url,gallery_media').limit(500)
         ]);
         if(filesResult.error)throw filesResult.error;
         if(inventoryResult.error)throw inventoryResult.error;
         const attached=new Set();
         for(const row of inventoryResult.data||[]){
           if(row.image_url)attached.add(row.image_url.trim());
           for(const url of String(row.gallery_media||'').split(/\r?\n/))if(url.trim())attached.add(url.trim());
         }
         const recent=Date.now()-7*86400000;
         const results=(filesResult.data||[]).filter(file=>{
           return file.name&&/\.(jpe?g|png|webp)$/i.test(file.name)&&
             (!file.created_at||Date.parse(file.created_at)>=recent);
         }).map(file=>({
           url:db.storage.from('gooninks-media').getPublicUrl('inventory/'+file.name).data.publicUrl,
           name:file.name
         })).filter(file=>!attached.has(file.url)).slice(0,40);
         grid.replaceChildren();
         for(const file of results){
           const button=document.createElement('button');button.type='button';button.className='gn-recovery-item';
           const img=document.createElement('img');img.src=file.url;img.alt='Foto belum tersimpan';img.loading='lazy';
           const mark=document.createElement('small');mark.textContent='Pilih foto';
           button.append(img,mark);
           button.addEventListener('click',()=>{
             if(recoveredUrls.has(file.url))recoveredUrls.delete(file.url);
             else if(queuedFiles.length+recoveredUrls.size<15)recoveredUrls.add(file.url);
             else return notify('Maksimal 15 foto dalam satu penyimpanan.',true);
             button.classList.toggle('is-selected',recoveredUrls.has(file.url));
             button.setAttribute('aria-pressed',String(recoveredUrls.has(file.url)));
             info.textContent=recoveredUrls.size+' foto pemulihan dipilih';
           });
           grid.append(button);
         }
         info.textContent=results.length?results.length+' foto belum tertaut ditemukan.':'Belum ada foto yang bisa dipulihkan.';
         loadedRecovery=true;
       }catch(error){info.textContent='Gagal memuat foto sebelumnya: '+(error.message||'Periksa koneksi');}
       finally{loadingRecovery=false}
     });
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
   const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'};
   if(!types[file.type])throw Error('Format '+file.name+' tidak diizinkan');
   const sizeLimit=file.type.startsWith('image/')?5*1024*1024:25*1024*1024;
   if(file.size>sizeLimit)throw Error('Ukuran '+file.name+' melebihi batas');
   const path='inventory/'+crypto.randomUUID()+'.'+types[file.type];
   const {error}=await db.storage.from('gooninks-media').upload(path,file,{upsert:false,contentType:file.type});
   if(error)throw error;
   return db.storage.from('gooninks-media').getPublicUrl(path).data.publicUrl;
 }
 // Capture the inventory submit before the older Admin Plus submit listener.
 // All non-inventory handlers (ads, promotions, etc.) retain existing behavior.
 $('#editorForm').addEventListener('submit',async event=>{
   if(currentView!=='inventory')return;
   event.preventDefault();event.stopImmediatePropagation();
   const form=event.currentTarget;
   const save=$('#saveButton');save.disabled=true;save.textContent='Menyimpan…';
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
     if(files.length>15)throw Error('Maksimal 15 file sekali unggah.');
     for(const file of files){
       const max=file.type.startsWith('image/')?5*1024*1024:25*1024*1024;
       if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type)||file.size>max)
         throw Error('Periksa format/ukuran file: '+file.name);
     }
     const gallery=$('#field_gallery_media'),previous=String(gallery?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
     const main=$('#field_image_url');
     const previousCover=String(main?.value||'').trim();
     const cover=($('#gnUseCover')?.checked||!previousCover)?files.find(file=>file.type.startsWith('image/')):null;
     let nextCover=previousCover;
     for(let i=0;i<files.length;i++){
       const file=files[i],key=fileKey(file);
       save.textContent='Mengunggah '+(i+1)+'/'+files.length+'…';
       let url=uploadedUrls.get(key);
       if(!url){url=await uploadMedia(file);uploadedUrls.set(key,url)}
       if(file===cover)nextCover=url;
       else previous.push(url);
     }
     if(nextCover!==previousCover&&previousCover)previous.unshift(previousCover);
     if(main)main.value=nextCover;
     if(gallery)gallery.value=[...new Set(previous.filter(url=>url!==nextCover))].join('\n');
     if($('#field_archived')?.checked)$('#field_visible').checked=false;
     // Do not reuse event.currentTarget after async uploads; DOM clears it.
     save.textContent='Menyimpan produk…';
     await saveRow({preventDefault(){},currentTarget:form});
     // Keep selected files after failed DB saves, without uploading them twice.
     if(!$('#editorDialog').open){queuedFiles=[];uploadedUrls.clear()}
   }catch(error){notify('Inventori: '+(error.message||'Gagal menyimpan'),true)}
   finally{save.disabled=false;save.textContent='Simpan perubahan'}
 },true);
})();