const {JSDOM}=require('jsdom');const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
const dom=new JSDOM(fs.readFileSync('index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,''),{url:'https://admin.example.test',runScripts:'outside-only'});const w=dom.window,ctx=dom.getInternalVMContext();w.setInterval=()=>0;w.confirm=()=>true;w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
const run=s=>vm.runInContext(s,ctx);const $=s=>w.document.querySelector(s);const click=s=>$(s).click();const tick=()=>new Promise(r=>setTimeout(r,10));const fill=(s,v)=>$(s).value=v;const submit=()=> $('dialog[open] form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
(async()=>{
run(fs.readFileSync('gn-config.js','utf8'));run(fs.readFileSync('admin.js','utf8').replace('events();initTurnstile();boot();','events();'));
run("window.testData={gn_orders:[{order_id:'PAID',customer_name:'Pembeli Lunas',customer_email:'buyer@example.test',status:'paid',amount:300000,created_at:'2026-11-05',deleted_at:null,items:[]},{order_id:'PENDING',customer_name:'Belum Bayar',status:'pending',created_at:'2026-11-05',deleted_at:null},{order_id:'DELETED',customer_name:'Dihapus',status:'paid',deleted_at:'2026-11-05'}],gn_shipments:[{order_id:'PAID',status:'packing'},{order_id:'PENDING',status:'awaiting_payment'},{order_id:'DELETED',status:'packing'}],gn_customer_profiles:[],gn_notification_reads:[],gn_leads:[{id:'lead1',name:'Lead Baru',stage:'new',created_at:'2026-11-05'}],gn_product_categories:[{name:'Wastra'},{name:'Tenun'}],gn_inventory:[{sku:'LOW',stock:1,low_stock_threshold:3,archived:false,product_name:'Batik',price:250000,image_url:'https://media.test/old-cover.webp',gallery_media:'https://media.test/old-gallery.webp',visible:true,category:'Wastra',preorder:false,preorder_lead_days:14}]};window.failRead=false;\n db={from(table){let filters=[],operation=null,payload=null;const q={select(columns){if(table==='gn_shipments'&&columns.includes('!inner'))q.join=true;return q},order(){return q},limit(){return q},eq(k,v){filters.push(x=>k.includes('.')?x[k.split('.')[0]]?.[k.split('.')[1]]===v:x[k]===v);return q},is(k,v){filters.push(x=>k.includes('.')?x[k.split('.')[0]]?.[k.split('.')[1]]===v:x[k]===v);return q},not(k,op,v){filters.push(x=>x[k]!==v);return q},insert(p){operation='insert';payload=p;return q},upsert(p){operation='upsert';payload=p;return q},update(p){operation='update';payload=p;return q},then(resolve){if(operation==='update'){const selected=testData[table].filter(x=>filters.every(f=>f(x)));selected.forEach(x=>Object.assign(x,payload));return Promise.resolve({data:selected,error:null}).then(resolve)}if(operation){if(table==='gn_notification_reads'&&window.failRead)return Promise.resolve({error:{message:'Simulasi gagal'}}).then(resolve);const key=table==='gn_customer_profiles'?'email':'notification_key';const existing=testData[table].find(x=>x[key]===payload[key]);if(existing&&operation==='insert')return Promise.resolve({error:{code:'23505'}}).then(resolve);if(existing)Object.assign(existing,payload);else testData[table].push(payload);return Promise.resolve({data:[payload],error:null}).then(resolve)}return Promise.resolve({data:testData[table].map(x=>q.join?{...x,_order:testData.gn_orders.find(o=>o.order_id===x.order_id)}:x).filter(x=>filters.every(f=>f(x))),error:null}).then(resolve)}};return q}};\n currentUser={id:'admin-test',email:'admin@example.test'};currentRole='owner';document.querySelector('#appShell').hidden=false;document.querySelector('#authScreen').hidden=true;");

for(const f of ['admin-plus.js','admin-updates.js','admin-reports.js','admin-tracking.js'])run(fs.readFileSync(f,'utf8'));
run("testData.gn_leads.push({id:'manual1',name:'Pemesan WhatsApp',email:'manual-order@example.test',phone:'081277788899',interest:'Permintaan pembelian GoO Ninks',source:'website',stage:'contacted',created_at:'2026-11-06'})");
await run("loadView('customers')");assert.match($('#records').textContent,/Pemesan WhatsApp/);assert.match($('#records').textContent,/1 permintaan/);click('#newButton');fill('dialog[open] [name=customer_name]','Pelanggan Manual');fill('dialog[open] [name=email]','MANUAL@example.test');fill('dialog[open] [name=customer_phone]','081234567890');fill('dialog[open] [name=customer_address]','Yogyakarta');submit();await tick();assert.match($('#records').textContent,/Pelanggan Manual/);assert.match($('#rowCounter').textContent,/3 pelanggan/);
click('[data-customer-edit="manual@example.test"]');fill('dialog[open] [name=customer_notes]','Pelanggan offline');submit();await tick();assert.match($('#records').textContent,/Pelanggan offline/);
click('#newButton');fill('dialog[open] [name=customer_name]','Duplikat');fill('dialog[open] [name=email]','manual@example.test');submit();await tick();assert.match($('#toast').textContent,/Email sudah/);assert.ok($('dialog[open]'));click('dialog[open] [data-cancel-customer]');
click('#gnNotifBell');await tick();assert.equal($('#gnNotifCount').textContent,'3');click('[data-notification-key="lead:lead1:new"]');await tick();assert.equal($('#gnNotifCount').textContent,'2');click('#gnNotifBell');await tick();assert.ok($('[data-notification-key="lead:lead1:new"]').classList.contains('is-read'));assert.equal($('#gnNotifCount').textContent,'2');
w.failRead=true;click('[data-notification-key="order:PENDING:pending"]');await tick();assert.match($('#toast').textContent,/Gagal menandai/);assert.equal($('#gnNotifCount').textContent,'2');w.failRead=false;click('[data-notification-key="order:PENDING:pending"]');await tick();assert.equal($('#gnNotifCount').textContent,'1');click('#gnNotifBell');await tick();click('[data-notification-key="stock:LOW:1"]');await tick();assert.ok($('#gnNotifCount').hidden);
await run("loadView('tracking')");assert.equal(run('currentView'),'shipping');assert.equal(w.document.querySelectorAll('[data-view=tracking]').length,0);assert.equal(w.document.querySelectorAll('.gn-order-card').length,1);assert.match($('#records').textContent,/PAID/);assert.equal(w.document.querySelectorAll('[data-tracking-action=issue]').length,1);assert.equal(w.document.querySelectorAll('[data-shipping-form]').length,1);
await run("loadView('orders')");
assert.equal($('#gnOrderStatusFilter').options.length,6);
assert.equal(w.document.querySelectorAll('.gn-order-card').length,2,'default excludes soft-deleted orders');
$('#gnOrderStatusFilter').value='deleted';$('#gnOrderStatusFilter').dispatchEvent(new w.Event('change'));
assert.equal(w.document.querySelectorAll('.gn-order-card').length,1);
assert.match($('#records').textContent,/Pulihkan pesanan/);
$('#gnOrderStatusFilter').value='paid';$('#gnOrderStatusFilter').dispatchEvent(new w.Event('change'));
assert.equal(w.document.querySelectorAll('.gn-order-card').length,1);
$('#gnOrderStatusFilter').value='pending';$('#gnOrderStatusFilter').dispatchEvent(new w.Event('change'));
assert.equal(w.document.querySelectorAll('.gn-order-card').length,1);
await run("loadView('inventory')");
click('#records [data-edit="LOW"]');await tick();
assert.equal($('#editorDialog [name="gnMultiUpload"]')?.type,'file');
assert.equal($('#editorDialog').querySelectorAll('input[type=file]').length,1,'exactly one upload input');
assert.ok($('#gnUploadCount')&&$('#gnUploadPreview'));
assert.ok($('#field_category').querySelector('option[value="__gn_category_add_new__"]'));
$('#field_category').value='__gn_category_add_new__';$('#field_category').dispatchEvent(new w.Event('change'));
assert.equal($('#gnNewCategoryWrap').hidden,false);
assert.equal($('#gnNewCategory').required,true);
w.URL.createObjectURL=()=> 'blob:mock';w.URL.revokeObjectURL=()=>{};
const chosen=[
 new w.File(['test'],'primary.png',{type:'image/png'}),
 new w.File(['test'],'extra.png',{type:'image/png'})
];
const more=[
 new w.File(['test'],'third.png',{type:'image/png'}),
 new w.File(['test'],'clip.mp4',{type:'video/mp4'})
];
const photoInput=$('#editorDialog [name="gnMultiUpload"]');
Object.defineProperty(photoInput,'files',{value:chosen,configurable:true});
photoInput.dispatchEvent(new w.Event('change'));
assert.match($('#gnUploadCount').textContent,/2 foto, 0 video/);
assert.equal($('#gnUploadPreview').children.length,2);
Object.defineProperty(photoInput,'files',{value:more,configurable:true});
photoInput.dispatchEvent(new w.Event('change'));
assert.match($('#gnUploadCount').textContent,/3 foto, 1 video/);
assert.equal($('#gnUploadPreview').children.length,4,'separate picker openings must accumulate');
Object.defineProperty(photoInput,'files',{value:[chosen[0]],configurable:true});
photoInput.dispatchEvent(new w.Event('change'));
assert.equal($('#gnUploadPreview').children.length,4,'reselecting same image must not duplicate it');
click('#gnUploadPreview [aria-label="Hapus clip.mp4"]');
assert.match($('#gnUploadCount').textContent,/3 foto, 0 video/);
assert.equal($('#gnUploadPreview').children.length,3);
assert.equal($('#gnUseCover').checked,false,'editing should not replace an existing cover by default');
$('#field_category').value='Wastra';$('#field_category').dispatchEvent(new w.Event('change'));
w.crypto.randomUUID=(()=>{let n=0;return ()=>'uuid-'+(++n)})();
run(`window.uploadedNames=[];
db.storage={
  from(){
    return {
      upload: async function(path,file){window.uploadedNames.push(file.name);return {error:null}},
      getPublicUrl: function(path){return {data:{publicUrl:'https://media.test/'+path}}}
    };
  }
};`);
submit();
await new Promise(r=>setTimeout(r,100));
assert.equal($('#editorDialog').open,false,'multiple uploads and database save must close the editor');
assert.deepEqual(Array.from(w.uploadedNames),['primary.png','extra.png','third.png']);
assert.equal(run('testData.gn_inventory[0].image_url'),'https://media.test/old-cover.webp');
const savedGallery=run('testData.gn_inventory[0].gallery_media');
assert.match(savedGallery,/old-gallery.webp/);
assert.equal(savedGallery.split('\n').length,4,'all three new images should be saved in gallery');
await run("loadView('inventory')");
click('#records [data-edit="LOW"]');await tick();
assert.equal($('#gnUseCover').checked,false);
$('#gnUseCover').checked=true;
const newCover=[new w.File(['new-cover'],'replacement.png',{type:'image/png'})];
const nextInput=$('#editorDialog [name="gnMultiUpload"]');
Object.defineProperty(nextInput,'files',{value:newCover,configurable:true});
nextInput.dispatchEvent(new w.Event('change'));
submit();await new Promise(r=>setTimeout(r,100));
assert.match(run('testData.gn_inventory[0].image_url'),/inventory\/uuid-4.png/);
assert.match(run('testData.gn_inventory[0].gallery_media'),/old-cover.webp/,'previous main image must stay available in gallery');
assert.equal($('#editorDialog').open,false);
console.log('PASS: manual customer create/edit/duplicate; notification decrease/persistence/error/zero; paid-only shipping excludes pending and deleted; merged packing and tracking with legacy alias');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exit(1)});
