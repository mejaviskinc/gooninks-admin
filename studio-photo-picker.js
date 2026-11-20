'use strict';
/* GoO Ninks studio photo picker. Extends the existing Inventory editor only.
   Assignments are saved with the existing authenticated inventory form. */
(()=>{
const groups={"01":["dsc09273","dsc09274","dsc09275","dsc09276","dsc09277","dsc09278","dsc09279","dsc09280","dsc09281","dsc09282","dsc09283","dsc09284","dsc09285","dsc09286","dsc09287","dsc09288","dsc09289","dsc09290","dsc09291","dsc09292","dsc09293","dsc09294","dsc09295","dsc09296","dsc09297","dsc09298","dsc09299","dsc09300","dsc09301","dsc09302","dsc09303","dsc09304","dsc09305","dsc09306","dsc09307","dsc09308","dsc09309","dsc09310","dsc09311","dsc09312","dsc09313","dsc09314","dsc09315","dsc09316","dsc09317","dsc09318","dsc09319","dsc09320","dsc09322","dsc09324","dsc09325","dsc09326","dsc09327","dsc09328"],"02":["dsc09413","dsc09533","dsc09534","dsc09535","dsc09536","dsc09537","dsc09538","dsc09539","dsc09540","dsc09541","dsc09542","dsc09543","dsc09544","dsc09545","dsc09546","dsc09547","dsc09548","dsc09549","dsc09550","dsc09551","dsc09552","dsc09553","dsc09554","dsc09555","dsc09556","dsc09557","dsc09558","dsc09559","dsc09560","dsc09562","dsc09563","dsc09564","dsc09565","dsc09566","dsc09567","dsc09568","dsc09570","dsc09571","dsc09573","dsc09574","dsc09575","dsc09576","dsc09577","dsc09578","dsc09579","dsc09580","dsc09582","dsc09583","dsc09584","dsc09585","dsc09586","dsc09587","dsc09588","dsc09589","dsc09590","dsc09591","dsc09592"],"03":["dsc09738","dsc09739","dsc09740","dsc09741","dsc09742","dsc09743","dsc09744","dsc09745","dsc09746","dsc09747","dsc09748","dsc09749","dsc09750","dsc09751","dsc09752","dsc09753","dsc09754","dsc09755","dsc09756","dsc09757","dsc09758","dsc09759","dsc09760","dsc09761","dsc09762","dsc09763","dsc09764","dsc09765","dsc09766","dsc09767","dsc09768","dsc09769","dsc09770","dsc09771","dsc09772","dsc09773","dsc09774","dsc09775","dsc09776","dsc09777","dsc09778","dsc09780","dsc09782","dsc09783","dsc09784","dsc09785","dsc09786","dsc09787"],"04":["dsc09928","dsc09929","dsc09931","dsc09932","dsc09933","dsc09934","dsc09935","dsc09936","dsc09937","dsc09938","dsc09939","dsc09940","dsc09941","dsc09942","dsc09944","dsc09945","dsc09946","dsc09947","dsc09948","dsc09949","dsc09950","dsc09951","dsc09952","dsc09953","dsc09954","dsc09955","dsc09956","dsc09957","dsc09958","dsc09959","dsc09960","dsc09961","dsc09962","dsc09963","dsc09964","dsc09965","dsc09966","dsc09967","dsc09968","dsc09969","dsc09970","dsc09972","dsc09973","dsc09974","dsc09975","dsc09976","dsc09977","dsc09978","dsc09979","dsc09980","dsc09981","dsc09983","dsc09984","dsc09985"],"05":["dsc00001","dsc00002","dsc00003","dsc00004","dsc00005","dsc00006","dsc00007","dsc00008","dsc00009","dsc00010","dsc00011","dsc00013","dsc00014","dsc00015","dsc00016","dsc00017","dsc00018","dsc00019","dsc00020","dsc00021","dsc00022","dsc00023","dsc00025","dsc00026","dsc00027","dsc00028","dsc00029","dsc00031","dsc00032","dsc00033","dsc00034","dsc00035","dsc00036","dsc00037","dsc00038","dsc00039","dsc00040","dsc00041","dsc00042","dsc00043","dsc00044","dsc00045","dsc00046","dsc00047","dsc00048","dsc00049","dsc00050","dsc00051","dsc00052","dsc00053","dsc00054","dsc00055","dsc00056","dsc00057","dsc00058","dsc00059","dsc00060","dsc00061","dsc00063","dsc00064","dsc00065","dsc09990","dsc09991","dsc09992","dsc09993","dsc09994","dsc09995","dsc09996","dsc09998","dsc09999"],"06":["dsc00202","dsc00203","dsc00204","dsc00205","dsc00206","dsc00207","dsc00208","dsc00209","dsc00210","dsc00211","dsc00212","dsc00213","dsc00214","dsc00215","dsc00216","dsc00217","dsc00218","dsc00219","dsc00220","dsc00221","dsc00222","dsc00223","dsc00224","dsc00225","dsc00226","dsc00227","dsc00228","dsc00229","dsc00231","dsc00233","dsc00235","dsc00236","dsc00237","dsc00239","dsc00240","dsc00241","dsc00242","dsc00243","dsc00244"]};
const photoURL=(group,name)=>'https://gooninks.co.id/assets/gooninks-lookbook/'+group+'/'+name+'.webp';
const make=(tag,cls,txt)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el};
const originalOpenEditor=openEditor;
openEditor=function(record=null){
 originalOpenEditor(record);
 if(currentView!=='inventory')return;
 const fields=document.getElementById('formFields');
 const coverField=document.getElementById('field_image_url');
 const galleryField=document.getElementById('field_gallery_media');
 if(!fields||!coverField||!galleryField)return;
 const tool=make('details','gn-studio-tool');
 const summary=make('summary',null,'📷 Pilih foto dari 322 foto studio yang sudah tersedia');
 tool.append(summary);
 tool.append(make('p','gn-studio-helper','Pilih foto yang benar-benar sesuai dengan produk ini. Foto yang dipilih masuk ke produk setelah menekan Simpan perubahan.'));
 const controls=make('div','gn-studio-filter');
 const folder=make('select');folder.setAttribute('aria-label','Folder foto studio');
 Object.keys(groups).forEach(id=>{const o=make('option',null,'Studio '+id+' · '+groups[id].length+' foto');o.value=id;folder.append(o)});
 const search=make('input');search.type='search';search.placeholder='Cari nama file DSC…';search.setAttribute('aria-label','Cari nama foto');
 controls.append(folder,search);tool.append(controls);
 const grid=make('div','gn-studio-photo-grid');
 const status=make('p','gn-studio-status','0 foto dipilih');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const actions=make('div','gn-studio-actions');
 const primary=make('button','primary small','Jadikan utama + tambahkan galeri');
 const secondary=make('button','ghost','Tambahkan ke galeri saja');
 const clear=make('button','ghost','Bersihkan pilihan');
 [primary,secondary,clear].forEach(b=>{b.type='button';actions.append(b)});
 tool.append(grid,status,actions);
 const selected=new Set();
 const refresh=()=>{
   grid.replaceChildren();
   const filter=search.value.trim().toLowerCase();
   groups[folder.value].filter(name=>name.includes(filter)).forEach(name=>{
     const url=photoURL(folder.value,name);
     const item=make('button','gn-studio-photo'+(selected.has(url)?' is-selected':''));
     item.type='button';item.title=name.toUpperCase();item.setAttribute('aria-pressed',String(selected.has(url)));
     const image=make('img');image.src=url;image.alt='Foto '+name.toUpperCase();image.loading='lazy';image.decoding='async';
     const caption=make('small',null,name.toUpperCase()+'.WEBP');
     item.append(image,caption);
     item.addEventListener('click',()=>{
       if(selected.has(url))selected.delete(url);
       else if(selected.size<15)selected.add(url);
       else status.textContent='Maksimal 15 foto per pilihan. Tambahkan dahulu ke galeri, lalu pilih lagi.';
       refresh();
     });
     grid.append(item);
   });
   status.textContent=selected.size+' foto dipilih. Klik tombol pilihan, lalu Simpan perubahan.';
   primary.disabled=secondary.disabled=clear.disabled=selected.size===0;
 };
 const add=(asCover)=>{
   if(!selected.size)return;
   const urls=[...selected];
   const current=galleryField.value.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
   const cover=coverField.value.trim();
   const newCover=(asCover||!cover)?urls.shift():cover;
   coverField.value=newCover;
   galleryField.value=[...new Set([...current,...urls].filter(x=>x!==newCover))].join('\n');
   selected.clear();refresh();
   status.textContent='Foto siap disimpan ke produk ini. Tekan Simpan perubahan agar tampil di toko.';
 };
 primary.addEventListener('click',()=>add(true));
 secondary.addEventListener('click',()=>add(false));
 clear.addEventListener('click',()=>{selected.clear();refresh()});
 folder.addEventListener('change',refresh);
 search.addEventListener('input',refresh);
 galleryField.closest('.field')?.insertAdjacentElement('afterend',tool);
 refresh();
};
})();
