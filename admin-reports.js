'use strict';
/* Financial reporting over confirmed Midtrans orders. No synthetic revenue or profit estimates. */
(()=>{
 const previousFetch=fetchRows,previousRender=renderTable,previousLoad=loadView;
 schemas.reports={title:'Keuangan & Laporan',desc:'Rekap pembayaran terverifikasi, transaksi pending, serta ekspor CSV. Semua angka berasal dari pesanan asli.',table:'gn_orders',key:'order_id',headline:'order_id',fields:[]};
 const nav=document.createElement('button');
 nav.type='button';nav.className='nav-link';nav.dataset.view='reports';
 nav.innerHTML='<span>▥</span> Keuangan & Laporan';
 const shipping=document.querySelector('#sidebarNav [data-view="shipping"]');
 if(shipping)shipping.after(nav);else document.querySelector('#sidebarNav')?.append(nav);
 fetchRows=async function(view){
  if(view!=='reports')return previousFetch(view);
  const {data,error}=await db.from('gn_orders').select('order_id,amount,status,created_at,paid_at,payment_type,items,deleted_at').order('created_at',{ascending:false}).limit(1000);
  if(error)throw error;
  return data||[];
 };
 let days='30d';
 const currency=n=>'Rp'+new Intl.NumberFormat('id-ID').format(Math.round(Number(n)||0));
 const fmt=d=>d?new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',timeZone:'Asia/Jakarta'}):'—';
 const localDay=d=>new Date(d).toLocaleDateString('sv-SE',{timeZone:'Asia/Jakarta'});
 const label={paid:'Lunas',pending:'Menunggu bayar',expired:'Kedaluwarsa',cancelled:'Dibatalkan',failed:'Gagal',refunded:'Refund',review:'Perlu pemeriksaan'};
 function filtered(){
  const now=Date.now(),today=localDay(now),needle=($('#searchBox')?.value||'').trim().toLowerCase();
  return rows.filter(x=>{
   const date=x.status==='paid'?(x.paid_at||x.created_at):x.created_at;
   const ts=new Date(date).getTime();
   if(days==='today'&&localDay(date)!==today)return false;
   if(['7d','30d','90d'].includes(days)&&(!Number.isFinite(ts)||ts<now-Number(days.slice(0,-1))*86400000))return false;
   return !needle||(String(x.order_id)+' '+String(x.payment_type||'')+' '+String(x.status)).toLowerCase().includes(needle);
  });
 }
 function report(){
  const data=filtered();
  const paid=data.filter(x=>x.status==='paid'),refund=data.filter(x=>x.status==='refunded');
  const turnover=paid.reduce((n,x)=>n+(Number(x.amount)||0),0);
  const pending=data.filter(x=>x.status==='pending');
  const paidMonth=new Map(),products=new Map();
  for(const order of paid){
   const month=localDay(order.paid_at||order.created_at).slice(0,7);
   paidMonth.set(month,(paidMonth.get(month)||0)+Number(order.amount||0));
   for(const item of Array.isArray(order.items)?order.items:[]){
    if(!item||!item.sku||item.sku==='GN-DISCOUNT'||!(Number(item.qty)>0))continue;
    const previous=products.get(item.sku)||{name:item.name||item.sku,qty:0,sales:0};
    previous.qty+=Number(item.qty);
    previous.sales+=Number(item.price||0)*Number(item.qty);
    products.set(item.sku,previous);
   }
  }
  const months=[...paidMonth.entries()].sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);
  const peak=Math.max(1,...months.map(x=>x[1]));
  $('#rowCounter').textContent=data.length+' transaksi';
  const root=$('#records');
  root.innerHTML='<div class="gn-report-controls"><label>Periode <select id="gnReportPeriod">'+
   [['today','Hari ini'],['7d','7 hari'],['30d','30 hari'],['90d','90 hari'],['all','Semua']].map(x=>'<option value="'+x[0]+'" '+(days===x[0]?'selected':'')+'>'+x[1]+'</option>').join('')+
   '</select></label><button id="gnExportReport" type="button">Ekspor laporan CSV</button></div>'+
   '<div class="gn-report-metrics">'+
   [['Penjualan lunas',currency(turnover),'Pembayaran berhasil'],['Pesanan lunas',paid.length+'','Jumlah transaksi'],['Menunggu pembayaran',pending.length+'','Tidak dihitung sebagai omzet'],['Refund',refund.length+'','Dikeluarkan dari penjualan lunas']].map(x=>'<div class="gn-plus-card"><small>'+safe(x[0])+'</small><strong>'+safe(x[1])+'</strong><small>'+safe(x[2])+'</small></div>').join('')+'</div>'+
   '<div class="gn-plus-card"><h3>Penjualan lunas per bulan</h3><div class="gn-report-bars">'+(months.length?months.map(x=>'<div class="gn-report-bar"><span>'+safe(x[0])+'</span><div><i style="width:'+Math.max(1,100*x[1]/peak)+'%"></i></div><b>'+currency(x[1])+'</b></div>').join(''):'<p>Belum ada pembayaran berhasil pada periode ini.</p>')+'</div></div>'+
   '<div class="gn-plus-card"><h3>Produk terjual (pesanan lunas)</h3>'+
   ([...products.values()].sort((a,b)=>b.qty-a.qty).slice(0,8).map(x=>'<p>'+safe(x.name)+' — '+x.qty+' pcs · '+currency(x.sales)+'</p>').join('')||'<p>Belum ada produk terjual.</p>')+'</div>'+
   '<div class="gn-plus-card"><h3>Daftar transaksi</h3><div class="gn-plus-table"><table class="record-table"><thead><tr><th>ID Pesanan</th><th>Tanggal</th><th>Status</th><th>Metode</th><th>Total</th></tr></thead><tbody>'+
   data.slice(0,250).map(x=>'<tr><td>'+safe(x.order_id)+'</td><td>'+fmt(x.created_at)+'</td><td>'+safe(label[x.status]||x.status)+'</td><td>'+safe(x.payment_type||'—')+'</td><td>'+currency(x.amount)+'</td></tr>').join('')+
   '</tbody></table></div></div>'+
   '<p class="gn-report-disclaimer">Omzet hanya menghitung transaksi lunas saat ini. Biaya gateway, modal, ongkir, pajak, dan laba bersih belum dihitung. Pesanan berstatus refunded tidak dihitung sebagai penjualan lunas. Data dibatasi maksimal 1.000 pesanan terbaru; gunakan sistem akuntansi bila volume melampaui batas ini.</p>';
 }
 renderTable=function(){if(currentView==='reports')return report();return previousRender()};
 loadView=async function(view){await previousLoad(view);if(view==='reports')$('#newButton').hidden=true};
 const csvValue=value=>{
  const raw=String(value??'');
  const protectedValue=/^[=+\-@]/.test(raw)?"'"+raw:raw;
  return '"'+protectedValue.replace(/"/g,'""')+'"';
 };
 $('#records').addEventListener('change',e=>{if(e.target?.id==='gnReportPeriod'){days=e.target.value;report()}});
 $('#records').addEventListener('click',e=>{
  if(e.target?.id!=='gnExportReport')return;
  const list=[['ID Pesanan','Dibuat','Lunas','Status','Metode','Nominal'],...filtered().map(x=>[x.order_id,x.created_at,x.paid_at||'',x.status,x.payment_type||'',x.amount])];
  const csv='\uFEFF'+list.map(row=>row.map(csvValue).join(',')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='gooninks-laporan-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
})();
