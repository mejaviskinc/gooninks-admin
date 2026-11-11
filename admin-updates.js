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
 function renderUploadPreview(input){
   revokePreviews();
   const files=Array.from(input.files||[]);
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
     node.append(media,caption);grid.append(node);
   }
 }
 const previousOpen=openEditor;
 openEditor=function(row=null){
   revokePreviews();
   previousOpen(row);
   if(currentView!=='inventory')return;

   // Existing uploader from Admin Plus remains; the former single-image input
   // is prevented by setting the image_url schema kind to URL above.
   const input=$('#formFields [name="gnMultiUpload"]');
   const uploadField=input?.closest('.field');
   if(input&&uploadField){
     uploadField.classList.add('gn-one-upload');
     uploadField.firstChild.textContent='Unggah foto & video produk (pilih beberapa sekaligus)';
     const count=document.createElement('div');count.id='gnUploadCount';
     count.className='gn-upload-counter';count.setAttribute('role','status');count.setAttribute('aria-live','polite');
     count.textContent='0 foto, 0 video dipilih';
     const cover=document.createElement('span');cover.className='gn-cover-choice';
     cover.innerHTML='<input type="checkbox" id="gnUseCover" checked> Gunakan foto pertama yang dipilih sebagai foto utama';
     const gallery=document.createElement('div');gallery.id='gnUploadPreview';gallery.className='gn-upload-preview';
     uploadField.append(count,cover,gallery);
     input.addEventListener('change',()=>renderUploadPreview(input));
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
     const input=$('#formFields [name="gnMultiUpload"]'),files=Array.from(input?.files||[]);
     if(files.length>15)throw Error('Maksimal 15 file sekali unggah.');
     for(const file of files){
       const max=file.type.startsWith('image/')?5*1024*1024:25*1024*1024;
       if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(file.type)||file.size>max)
         throw Error('Periksa format/ukuran file: '+file.name);
     }
     const gallery=$('#field_gallery_media'),previous=String(gallery?.value||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
     const cover=$('#gnUseCover')?.checked?files.find(file=>file.type.startsWith('image/')):null;
     for(const file of files){
       const url=await uploadMedia(file);
       if(file===cover)$('#field_image_url').value=url;
       else previous.push(url);
     }
     if(gallery)gallery.value=[...new Set(previous)].join('\n');
     if($('#field_archived')?.checked)$('#field_visible').checked=false;
     await saveRow(event);
   }catch(error){notify('Inventori: '+(error.message||'Gagal menyimpan'),true)}
   finally{save.disabled=false;save.textContent='Simpan perubahan'}
 },true);
})();