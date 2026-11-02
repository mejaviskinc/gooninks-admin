'use strict';
/* GoO ninks admin-managed tracking. Reuses verified payment and shipping statuses. */
(()=>{
 schemas.tracking={title:'Lacak Pesanan',desc:'Kelola perjalanan paket, tulis pembaruan untuk pelanggan, dan bagikan tautan pelacakan pribadi. Status pengiriman mengikuti alur pembayaran dan pengemasan.',table:'gn_shipments',key:'order_id',headline:'order_id',fields:[]};
 const nav=document.createElement('button');
 nav.className='nav-link';nav.type='button';nav.dataset.view='tracking';
 nav.innerHTML='<span>◉</span> Lacak Pesanan';
 const shippingNav=document.querySelector('#sidebarNav [data-view="shipping"]');
 if(shippingNav)shippingNav.after(nav);else document.querySelector('#sidebarNav')?.append(nav);
 const originalFetch=fetchRows,originalRender=renderTable,originalLoad=loadView;
 fetchRows=async function(view){return originalFetch(view==='tracking'?'shipping':view)};
 renderTable=function(){
   if(currentView==='tracking'){
     $('#rowCounter').textContent=rows.length+' pesanan dengan status pengiriman';
     const keyword=$('#searchBox').value.trim().toLowerCase();
     const filtered=rows.filter(s=>(s.order_id+' '+s._order?.customer_name+' '+s.tracking_number+' '+s.carrier).toLowerCase().includes(keyword));
     renderShippingQueue(filtered);
     return;
   }
   return originalRender();
 };
 loadView=async function(view){
  await originalLoad(view);
  if(view==='tracking')$('#newButton').hidden=true;
 };
 const shippingRenderer=renderShippingQueue;
 renderShippingQueue=function(data){
  shippingRenderer(data);
  document.querySelectorAll('#records .gn-order-card').forEach(card=>{
   const orderId=card.querySelector('.gn-order-number')?.textContent?.trim();
   const record=data.find(x=>x.order_id===orderId);
   if(!record)return;
   const body=card.querySelector('.gn-order-body > div:last-child');
   if(!body)return;
   const section=document.createElement('section');section.className='gn-tracking-admin-actions';
   const title=document.createElement('h4');title.textContent='Lacak Pesanan • dikelola admin';
   const text=document.createElement('p');text.textContent='Bagikan tautan pribadi agar pembeli dapat melihat kurir, resi, dan riwayat perjalanan. Tautan lama akan diganti bila dibuat ulang.';
   section.append(title,text);
   const controls=document.createElement('div');controls.className='gn-tracking-buttons';
   const mk=(label,action)=>{
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.trackingAction=action;button.dataset.orderId=orderId;
    return button;
   };
   const issue=mk('Buat / perbarui tautan','issue');
   const history=mk('Riwayat pengiriman','history');
   const note=mk('Tambah pembaruan','note');
   if(record._order?.status!=='paid'){note.disabled=true;note.title='Perlu pembayaran lunas untuk mencatat perjalanan paket';}
   controls.append(issue,history,note);section.append(controls);
   const output=document.createElement('div');output.className='gn-tracking-admin-output';section.append(output);
   body.append(section);
  });
 };
 async function call(action,orderId,fields={}){
  const {data:session,error:sessionError}=await db.auth.getSession();
  const token=session?.session?.access_token;
  if(sessionError||!token)throw Error('Sesi admin tidak tersedia. Login kembali.');
  const response=await fetch(cfg.url+'/functions/v1/gn-order-tracking',{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:cfg.publishableKey,authorization:'Bearer '+token},
   body:JSON.stringify({action,order_id:orderId,...fields}),
   cache:'no-store',signal:AbortSignal.timeout(22000)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Permintaan pelacakan gagal (HTTP '+response.status+').');
  return data;
 }
 const fmt=d=>d?new Date(d).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'})+' WIB':'—';
 const label={awaiting_payment:'Menunggu pembayaran',ready_to_pack:'Siap dikemas',packing:'Dikemas',ready_to_ship:'Siap dikirim',shipped:'Dikirim',delivered:'Diterima',cancelled:'Dibatalkan',review:'Perlu pemeriksaan'};
 function showHistory(output,data){
  output.replaceChildren();
  const title=document.createElement('p');title.textContent='Riwayat pembaruan ('+(data.history?.length||0)+')';title.className='gn-tracking-title';output.append(title);
  if(!data.history?.length){const empty=document.createElement('p');empty.textContent='Belum ada riwayat. Tahap akan tercatat saat admin memperbarui status pengiriman.';output.append(empty);return}
  const ol=document.createElement('ol');ol.className='gn-tracking-timeline';
  for(const ev of data.history){
   const li=document.createElement('li');
   const heading=document.createElement('strong');heading.textContent=ev.kind==='admin_update'?'Pembaruan admin':label[ev.status]||'Status diperbarui';
   const description=document.createElement('p');description.textContent=ev.message;
   const time=document.createElement('small');time.textContent=fmt(ev.created_at);
   li.append(heading,description,time);ol.append(li);
  }
  output.append(ol);
 }
 function showLink(output,url){
  const parsed=new URL(url);
  if(parsed.origin!=='https://gooninks.co.id'||parsed.pathname!=='/tracking.html'||!parsed.hash.includes('code='))throw Error('Server mengembalikan tautan tidak valid');
  output.replaceChildren();
  const p=document.createElement('p');p.textContent='Tautan khusus pelanggan (tautan sebelumnya, jika ada, sudah tidak berlaku):';output.append(p);
  const row=document.createElement('div');row.className='gn-tracking-share';
  const input=document.createElement('input');input.readOnly=true;input.value=parsed.href;input.setAttribute('aria-label','Tautan pelacakan pesanan');
  const copy=document.createElement('button');copy.type='button';copy.textContent='Salin tautan';
  copy.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(input.value);notify('Tautan pelacakan disalin');}
   catch{input.focus();input.select();notify('Pilih dan salin tautan pelacakan secara manual');}
  });
  const wa=document.createElement('a');wa.target='_blank';wa.rel='noopener noreferrer';wa.textContent='Bagikan lewat WhatsApp';
  wa.href='https://api.whatsapp.com/send?text='+encodeURIComponent('Halo, berikut tautan pelacakan pesanan GoO ninks Anda: '+parsed.href);
  row.append(input,copy,wa);output.append(row);
 }
 const editor=document.createElement('dialog');editor.className='gn-tracking-dialog';
 editor.innerHTML='<form id="gnTrackingNoteForm"><h2>Pembaruan perjalanan paket</h2><p id="gnTrackingTarget"></p><label>Keterangan untuk pelanggan<textarea name="message" minlength="8" maxlength="280" required rows="5" placeholder="Contoh: Paket sedang menunggu penjemputan oleh pihak ekspedisi."></textarea></label><p class="gn-track-hint">Pembaruan ini ditulis oleh tim GoO ninks dan tidak dianggap sebagai bukti pelacakan otomatis ekspedisi.</p><div class="gn-tracking-buttons"><button type="button" id="gnTrackingCancel">Batal</button><button type="submit" class="primary">Simpan pembaruan</button></div></form>';
 document.body.append(editor);
 editor.querySelector('#gnTrackingCancel').addEventListener('click',()=>editor.close());
 let activeNote=null;
 editor.querySelector('form').addEventListener('submit',async e=>{
  e.preventDefault();if(!activeNote)return;
  const button=e.currentTarget.querySelector('[type=submit]'),value=String(new FormData(e.currentTarget).get('message')||'').trim();
  if(value.length<8||value.length>280)return notify('Keterangan harus 8–280 karakter',true);
  button.disabled=true;
  try{
   await call('note',activeNote.orderId,{message:value});
   editor.close();notify('Pembaruan perjalanan berhasil disimpan');
   const history=await call('history',activeNote.orderId);
   if(activeNote.output?.isConnected)showHistory(activeNote.output,history);
  }catch(error){notify(error.message||'Gagal menambah pembaruan',true)}
  finally{button.disabled=false}
 });
 $('#records').addEventListener('click',async event=>{
  const button=event.target.closest('[data-tracking-action]');
  if(!button)return;
  const action=button.dataset.trackingAction,orderId=button.dataset.orderId;
  const section=button.closest('.gn-tracking-admin-actions'),output=section?.querySelector('.gn-tracking-admin-output');
  if(!output)return;
  if(action==='note'){
   activeNote={orderId,output};editor.querySelector('#gnTrackingTarget').textContent=orderId;
   editor.querySelector('form').reset();editor.showModal();return;
  }
  if(action==='issue'&&!confirm('Buat tautan pelacakan untuk '+orderId+'? Tautan sebelumnya (jika ada) akan tidak berlaku.'))return;
  button.disabled=true;
  try{
   const response=await call(action,orderId);
   if(action==='issue'){showLink(output,response.tracking_url);notify('Tautan pelacakan dibuat');}
   else showHistory(output,response);
  }catch(error){notify('Pelacakan: '+(error.message||'Gagal'),true)}
  finally{button.disabled=false}
 });
})();
