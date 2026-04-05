import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, doc, onSnapshot, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ── FIREBASE CONFIG ────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyDmbv_XCzTn6elKO5x3tCxRaS7TEb9cJPQ",
  authDomain: "payment-tracker-1fcd0.firebaseapp.com",
  projectId: "payment-tracker-1fcd0",
  storageBucket: "payment-tracker-1fcd0.firebasestorage.app",
  messagingSenderId: "987660260062",
  appId: "1:987660260062:web:c2e7b1a3cc682f24faa84f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const COL = "registros";

// ── COLORS ────────────────────────────────────────────────────────────────
const COLORS={Efectivo:'#22d3ee',Cahen:'#4f9cf9',Vitatech:'#34d399',
  Coreligix:'#a78bfa',Otro:'#94a3b8'};
const GRADS={Efectivo:'gc',Cahen:'gb',Vitatech:'gg',Coreligix:'gp',Otro:'gb'};
function cc(n){return COLORS[n]||'#94a3b8';}

// ── SEED DATA ─────────────────────────────────────────────────────────────
const SEED=[
  {id:'R001',cliente:'Efectivo',factura:'EFE-01',fecha_factura:'2025-12-20',monto_pagar:200000,
    pagos:[{id:'P001',fecha:'2025-01-28',monto:200000,cuenta:'Caja',obs:''}],obs:''},
  {id:'R002',cliente:'Cahen',factura:'CAH-01',fecha_factura:'2025-12-20',monto_pagar:1187750,
    pagos:[
      {id:'P002',fecha:'2025-01-28',monto:250000,cuenta:'BBVA Cahen',obs:''},
      {id:'P003',fecha:'2026-02-04',monto:99404,cuenta:'BBVA Cahen',obs:''},
      {id:'P004',fecha:'2026-03-03',monto:100000,cuenta:'BBVA Cahen',obs:''},
    ],obs:''},
  {id:'R003',cliente:'Vitatech',factura:'VIT-01',fecha_factura:'2025-12-20',monto_pagar:3581501,
    pagos:[
      {id:'P005',fecha:'2026-02-04',monto:700000,cuenta:'Santander Vita',obs:''},
      {id:'P006',fecha:'2026-03-03',monto:700000,cuenta:'Santander Vita',obs:''},
    ],obs:''},
  {id:'R004',cliente:'Coreligix',factura:'COR-01',fecha_factura:'2025-12-20',monto_pagar:3581501,
    pagos:[],obs:'Sin pagos'},
  {id:'R006',cliente:'Cahen',factura:'CAH-02',fecha_factura:'2026-02-12',monto_pagar:664900,
    pagos:[],obs:'Factura feb 2026'},
  {id:'R007',cliente:'Vitatech',factura:'VIT-02',fecha_factura:'2026-02-12',monto_pagar:1186973,
    pagos:[],obs:'Factura feb 2026'},
];

// ── STATE ─────────────────────────────────────────────────────────────────
let data = [];
let editFacId = null;
let facMode = 'factura'; // 'factura' | 'cliente' | 'edit'

function cleanInvoiceFormat(factura) {
  if (!factura) return factura;
  return factura.replace(/^FAC-/i, ''); 
}

// ── UTILS ─────────────────────────────────────────────────────────────────
const CIRC_L=2*Math.PI*61;
const CIRC_S=2*Math.PI*34;

function fmt(n){if(n===null||n===undefined)return'—';return'$'+Number(n).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0});}
function fmtD(d){if(!d)return'—';try{const[y,m,dd]=d.split('-');const ms=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return`${parseInt(dd)} ${ms[parseInt(m)-1]} ${y}`;}catch(e){return d;}}
function paid(r){return r.pagos.reduce((s,p)=>s+(p.monto||0),0);}
function pend(r){return Math.max(0,r.monto_pagar-paid(r));}
function pct(r){if(!r.monto_pagar)return 100;return Math.min(100,(paid(r)/r.monto_pagar)*100);}
function status(r){const p=paid(r);if(p>=r.monto_pagar&&r.monto_pagar>0)return'Pagado';if(p>0)return'Parcial';return'Pendiente';}
function bclass(s){return s==='Pagado'?'bg-emerald-500/10 text-emerald-400':s==='Parcial'?'bg-amber-500/10 text-amber-400':'bg-rose-500/10 text-rose-400';}
function h2rgb(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `${r},${g},${b}`;}

const ICON_INVOICE=`<svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 opacity-60" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg>`;
const ICON_CHECK=`<svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 opacity-60" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
const ICON_CLOCK=`<svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 opacity-60" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
const ICON_TREND=`<svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 opacity-60" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>`;
const ICON_USERS=`<svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 opacity-60" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>`;
const ICON_ACTIVITY=`<svg viewBox="0 0 24 24" fill="none" class="w-6 h-6 opacity-60" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"/></svg>`;

// ── SYNC STATUS ────────────────────────────────────────────────────────────
function setSyncStatus(state, msg) {
  const el = document.getElementById('syncStatus');
  const txt = document.getElementById('syncMsg');
  const dot = el.querySelector('.sync-dot');
  
  el.className = "flex items-center gap-1.5 font-mono text-[0.65rem] px-2.5 py-1 rounded-md border text-slate-300 border-slate-700/50 bg-slate-800/40";
  if(state === 'ok') dot.className = "sync-dot w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-400";
  else if(state === 'err') dot.className = "sync-dot w-1.5 h-1.5 rounded-full shrink-0 bg-rose-400";
  else dot.className = "sync-dot w-1.5 h-1.5 rounded-full shrink-0 bg-amber-400 animate-pulse";
  
  txt.textContent = msg;
}

// ── FIREBASE INIT ──────────────────────────────────────────────────────────
async function seedIfEmpty(snapshot) {
  if (snapshot.empty) {
    setSyncStatus('loading', 'Cargando datos iniciales…');
    for (const rec of SEED) {
      await setDoc(doc(db, COL, rec.id), rec);
    }
  }
}

// ── REALTIME LISTENER ──────────────────────────────────────────────────────
onSnapshot(collection(db, COL), async (snapshot) => {
  await seedIfEmpty(snapshot);
  
  data = snapshot.docs.map(d => {
    let r = d.data();
    r.factura = cleanInvoiceFormat(r.factura);
    if(r.cliente === "EPI Sofom" || r.cliente === "Lalo") r.cliente = "Otro";
    return r;
  }).sort((a,b) => a.id.localeCompare(b.id));

  setSyncStatus('ok', 'Sincronizado');
  renderAll();
}, (err) => {
  setSyncStatus('err', 'Sin conexión');
  console.error(err);
});

// ── SAVE / DELETE ──────────────────────────────────────────────────────────
async function saveToFirebase(rec) {
  await setDoc(doc(db, COL, rec.id), rec);
}
async function deleteFromFirebase(id) {
  await deleteDoc(doc(db, COL, id));
}

// ── DATE CHIP ─────────────────────────────────────────────────────────────
function updateDate(){
  const n=new Date();
  const ds=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const ms=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  document.getElementById('dchip').textContent=
    `${ds[n.getDay()]} ${n.getDate()} ${ms[n.getMonth()]} ${n.getFullYear()} · ${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

// ── TABS ──────────────────────────────────────────────────────────────────
window.showPage = function(btn){
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('bg-slate-800', 'text-white', 'shadow-md', 'shadow-black/20');
      t.classList.add('text-slate-400','hover:text-slate-200');
  });
  document.getElementById('page-'+btn.dataset.page).classList.remove('hidden');
  document.getElementById('page-'+btn.dataset.page).classList.add('block');
  
  btn.classList.add('bg-slate-800', 'text-white', 'shadow-md', 'shadow-black/20');
  btn.classList.remove('text-slate-400','hover:text-slate-200');
};

// ── DASHBOARD ─────────────────────────────────────────────────────────────
function renderDashboard(){
  const tp=data.reduce((s,r)=>s+r.monto_pagar,0);
  const tpd=data.reduce((s,r)=>s+paid(r),0);
  const tpn=data.reduce((s,r)=>s+pend(r),0);
  const p=tp>0?(tpd/tp*100):0;
  const nDone=data.filter(r=>status(r)==='Pagado').length;
  const nPend=data.filter(r=>status(r)==='Pendiente').length;
  const nPar=data.filter(r=>status(r)==='Parcial').length;
  const allPayments=data.reduce((s,r)=>s+r.pagos.length,0);
  const uniqueCli=[...new Set(data.map(r=>r.cliente))].length;

  document.getElementById('kpiGrid').innerHTML=`
    <div class="kpi hover:-translate-y-1 hover:border-[#4f9cf9]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#4f9cf9] to-[#92c5ff]"></div>
      <div class="absolute top-4 right-4 text-[#4f9cf9] transition-transform group-hover:scale-110">${ICON_INVOICE}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Total a cobrar</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#4f9cf9]">${fmt(tp)}</div>
      <div class="text-xs text-slate-500">${data.length} registros</div>
    </div>
    
    <div class="kpi hover:-translate-y-1 hover:border-[#34d399]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#34d399] to-[#86efcb]"></div>
      <div class="absolute top-4 right-4 text-[#34d399] transition-transform group-hover:scale-110">${ICON_CHECK}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Total cobrado</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#34d399]">${fmt(tpd)}</div>
      <div class="text-xs text-slate-500">${nDone} completados</div>
    </div>
    
    <div class="kpi hover:-translate-y-1 hover:border-[#f87171]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#f87171] to-[#fca5a5]"></div>
      <div class="absolute top-4 right-4 text-[#f87171] transition-transform group-hover:scale-110">${ICON_CLOCK}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Saldo pendiente</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#f87171]">${fmt(tpn)}</div>
      <div class="text-xs text-slate-500">${nPend} sin pagar</div>
    </div>
    
    <div class="kpi hover:-translate-y-1 hover:border-[#fbbf24]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#fbbf24] to-[#fde68a]"></div>
      <div class="absolute top-4 right-4 text-[#fbbf24] transition-transform group-hover:scale-110">${ICON_TREND}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Avance global</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#fbbf24]">${p.toFixed(1)}%</div>
      <div class="text-xs text-slate-500">${nPar} parciales</div>
    </div>
    
    <div class="kpi hover:-translate-y-1 hover:border-[#a78bfa]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#a78bfa] to-[#c4b5fd]"></div>
      <div class="absolute top-4 right-4 text-[#a78bfa] transition-transform group-hover:scale-110">${ICON_USERS}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Clientes únicos</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#a78bfa]">${uniqueCli}</div>
      <div class="text-xs text-slate-500">en seguimiento</div>
    </div>
    
    <div class="kpi hover:-translate-y-1 hover:border-[#22d3ee]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#22d3ee] to-[#67e8f9]"></div>
      <div class="absolute top-4 right-4 text-[#22d3ee] transition-transform group-hover:scale-110">${ICON_ACTIVITY}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Transacciones</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#22d3ee]">${allPayments}</div>
      <div class="text-xs text-slate-500">pagos registrados</div>
    </div>`;

  const ring=document.getElementById('mainRing');
  ring.style.strokeDasharray=CIRC_L;
  ring.style.strokeDashoffset=CIRC_L;
  setTimeout(()=>{ring.style.strokeDashoffset=CIRC_L*(1-p/100);},80);
  document.getElementById('mainPct').textContent=p.toFixed(1)+'%';

  document.getElementById('ringLeg').innerHTML=`
    <div class="flex justify-between items-center text-xs">
        <div class="flex items-center gap-2 text-slate-400"><div class="w-1.5 h-1.5 rounded-full bg-[#34d399]"></div>Cobrado</div>
        <div class="font-mono font-medium text-[#34d399]">${fmt(tpd)}</div>
    </div>
    <div class="flex justify-between items-center text-xs">
        <div class="flex items-center gap-2 text-slate-400"><div class="w-1.5 h-1.5 rounded-full bg-[#f87171]"></div>Pendiente</div>
        <div class="font-mono font-medium text-[#f87171]">${fmt(tpn)}</div>
    </div>
    <div class="flex justify-between items-center text-xs mt-1 pt-2 border-t border-slate-800/50">
        <div class="flex items-center gap-2 text-slate-500"><div class="w-1.5 h-1.5 rounded-full bg-slate-500"></div>Total</div>
        <div class="font-mono font-medium text-slate-400">${fmt(tp)}</div>
    </div>`;

  document.getElementById('ovStats').innerHTML=`
    <div class="bg-slate-800/40 border border-slate-700/30 rounded-lg p-3">
        <div class="text-[0.62rem] text-slate-500 uppercase tracking-wider mb-1">Completados</div>
        <div class="font-mono text-lg font-medium text-[#34d399]">${nDone}</div>
    </div>
    <div class="bg-slate-800/40 border border-slate-700/30 rounded-lg p-3">
        <div class="text-[0.62rem] text-slate-500 uppercase tracking-wider mb-1">Pendientes</div>
        <div class="font-mono text-lg font-medium text-[#f87171]">${nPend}</div>
    </div>
    <div class="bg-slate-800/40 border border-slate-700/30 rounded-lg p-3">
        <div class="text-[0.62rem] text-slate-500 uppercase tracking-wider mb-1">Parciales</div>
        <div class="font-mono text-lg font-medium text-[#fbbf24]">${nPar}</div>
    </div>
    <div class="bg-slate-800/40 border border-slate-700/30 rounded-lg p-3">
        <div class="text-[0.62rem] text-slate-500 uppercase tracking-wider mb-1">% Pendiente</div>
        <div class="font-mono text-lg font-medium text-[#f87171]">${tp>0?((tpn/tp)*100).toFixed(1):0}%</div>
    </div>`;

  const clients=[...new Set(data.map(r=>r.cliente))];
  let barsHtml='';
  for(const cli of clients){
    const recs=data.filter(r=>r.cliente===cli);
    const ctp=recs.reduce((s,r)=>s+r.monto_pagar,0);
    const cpd=recs.reduce((s,r)=>s+paid(r),0);
    const cp2=ctp>0?(cpd/ctp*100):0;
    const col=cc(cli);
    barsHtml+=`
      <div class="mb-3">
        <div class="flex justify-between text-xs mb-1.5">
          <span class="text-slate-400 font-medium">${cli}</span>
          <span class="font-mono text-[0.65rem]" style="color:${col}">${cp2.toFixed(0)}% · ${fmt(cpd)} / ${fmt(ctp)}</span>
        </div>
        <div class="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div class="h-full rounded-full transition-all duration-1000 ease-out" style="width:${cp2}%; background-color:${col}"></div>
        </div>
      </div>`;
  }
  document.getElementById('ovBars').innerHTML=barsHtml;
}

// ── CLIENT CARDS ──────────────────────────────────────────────────────────
function renderClients(){
  let html='';
  for(const rec of data){
    const p=paid(rec),pn=pend(rec),pc=pct(rec),st=status(rec);
    const col=cc(rec.cliente);
    const grad=GRADS[rec.cliente]||'gb';
    const offset=CIRC_S*(1-pc/100);
    const lastP=rec.pagos.length?rec.pagos[rec.pagos.length-1]:null;
    
    html+=`
    <div class="cc bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 hover:-translate-y-1 transition-all group relative">
      <button class="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/80 p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-white" onclick="openFactura('${rec.id}')">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
      </button>

      <div class="flex justify-between items-start mb-5">
        <div>
          <div class="font-bold text-slate-100 text-[1.05rem]">${rec.cliente}</div>
          <div class="font-mono text-[0.65rem] text-slate-400 mt-1">${rec.factura||'—'} · ${fmtD(rec.fecha_factura)}</div>
        </div>
        <span class="text-[0.6rem] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full whitespace-nowrap ${bclass(st)}">${st}</span>
      </div>
      
      <div class="grid grid-cols-[88px_1fr] gap-4 items-center">
        <div class="relative w-[88px] h-[88px] shrink-0">
          <svg viewBox="0 0 88 88" width="88" height="88" class="-rotate-90">
            <circle fill="none" stroke="currentColor" class="text-slate-800" stroke-width="9" cx="44" cy="44" r="34"/>
            <circle fill="none" stroke="url(#${grad})" stroke-width="9" stroke-linecap="round" cx="44" cy="44" r="34" 
              stroke-dasharray="${CIRC_S}" stroke-dashoffset="${CIRC_S}" class="ma transition-all duration-[1.1s] ease-out" data-t="${offset}"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <div class="font-mono text-base font-medium leading-none" style="color:${col}">${pc.toFixed(0)}%</div>
          </div>
        </div>
        
        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center bg-slate-800/40 rounded-lg px-2.5 py-1.5">
            <div class="text-[0.62rem] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 rounded-full bg-[#4f9cf9]"></div>A pagar
            </div>
            <div class="font-mono text-[0.75rem] font-medium text-[#4f9cf9]">${fmt(rec.monto_pagar)}</div>
          </div>
          <div class="flex justify-between items-center bg-slate-800/40 rounded-lg px-2.5 py-1.5">
            <div class="text-[0.62rem] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 rounded-full bg-[#34d399]"></div>Pagado
            </div>
            <div class="font-mono text-[0.75rem] font-medium text-[#34d399]">${fmt(p)||'—'}</div>
          </div>
          <div class="flex justify-between items-center bg-slate-800/40 rounded-lg px-2.5 py-1.5">
            <div class="text-[0.62rem] text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <div class="w-1.5 h-1.5 rounded-full ${pn>0?'bg-[#f87171]':'bg-slate-600'}"></div>Pendiente
            </div>
            <div class="font-mono text-[0.75rem] font-medium ${pn>0?'text-[#f87171]':'text-slate-500'}">${pn>0?fmt(pn):'$0'}</div>
          </div>
          ${lastP?`<div class="text-[0.6rem] text-slate-500 mt-1 text-right italic group-hover:text-slate-400 transition-colors">Último: ${fmtD(lastP.fecha)} <span class="font-mono ml-1 text-slate-400">${fmt(lastP.monto)}</span></div>`:'<div class="text-[0.6rem] text-slate-600 mt-1 text-right italic">Sin pagos registrados</div>'}
        </div>
      </div>
    </div>`;
  }
  document.getElementById('ccGrid').innerHTML=html;
  setTimeout(()=>{document.querySelectorAll('.ma').forEach(el=>{el.style.strokeDashoffset=el.dataset.t;});},80);
}

// ── TABLE ─────────────────────────────────────────────────────────────────
function populateFilters(){
  const clients=[...new Set(data.map(r=>r.cliente))];
  const sel=document.getElementById('fc');const cur=sel.value;
  sel.innerHTML=`<option value="">Todos los clientes</option>`+clients.map(c=>`<option ${c===cur?'selected':''}>${c}</option>`).join('');
}

window.renderTable = function(){
  const q=document.getElementById('sq').value.toLowerCase();
  const fcc=document.getElementById('fc').value;
  const fee=document.getElementById('fe').value;
  let rows=data.filter(r=>{
    const st=status(r);
    if(fcc&&r.cliente!==fcc)return false;
    if(fee&&st!==fee)return false;
    if(q&&!JSON.stringify(r).toLowerCase().includes(q))return false;
    return true;
  });
  const tbody=document.getElementById('tbody');
  
  if(!rows.length){tbody.innerHTML=`<tr class="empty"><td colspan="9" class="text-center py-12 text-slate-500 text-sm">Sin registros.</td></tr>`;return;}
  
  tbody.innerHTML=rows.map(r=>{
    const st=status(r),p=paid(r),pn=pend(r);
    const lastP=r.pagos.length?r.pagos[r.pagos.length-1]:null;
    const col=cc(r.cliente);
    
    return `
    <tr class="border-b border-slate-800/50 hover:bg-[#4f9cf9]/5 transition-colors group">
      <td class="px-4 py-3 align-middle"><span class="text-[0.65rem] font-bold px-2 py-0.5 rounded" style="background:rgba(${h2rgb(col)},.15);color:${col}">${r.cliente}</span></td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-slate-300 w-24 truncate">${r.factura||'—'}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-slate-400 whitespace-nowrap">${fmtD(r.fecha_factura)}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-[#4f9cf9] font-medium whitespace-nowrap text-right">${fmt(r.monto_pagar)}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-[#34d399] font-medium whitespace-nowrap text-right">${p?fmt(p):'—'}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] ${pn>0?'text-[#f87171]':'text-slate-500'} font-medium whitespace-nowrap text-right">${pn>0?fmt(pn):'—'}</td>
      <td class="px-4 py-3 align-middle leading-tight whitespace-nowrap">
        ${lastP?`<span class="font-mono text-xs text-slate-300">${fmtD(lastP.fecha)}</span><br><span class="font-mono text-[0.65rem] text-slate-500">${fmt(lastP.monto)}</span>`:'<span class="text-[0.7rem] text-slate-600">—</span>'}
      </td>
      <td class="px-4 py-3 align-middle"><span class="text-[0.6rem] font-bold tracking-widest uppercase px-2 py-1 rounded-full whitespace-nowrap ${bclass(st)}">${st}</span></td>
      <td class="px-4 py-3 align-middle whitespace-nowrap text-right">
        <!-- New Buttons -->
        <!-- Pago / Abonar Button -->
        <button class="inline-flex items-center justify-center bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/30 hover:bg-[#34d399] hover:text-[#060910] font-bold px-2.5 py-1 rounded transition-colors mr-1 h-[26px]" onclick="openPago('${r.id}')" title="Registrar Abono">
           <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
        </button>
        <!-- Editar Factura Button -->
        <button class="inline-flex items-center justify-center bg-slate-800 text-slate-400 border border-slate-700/50 hover:bg-slate-700 hover:text-white font-bold px-2 py-1 rounded transition-colors mr-1 h-[26px]" onclick="openFactura('${r.id}')" title="Editar Factura y Deuda">
           <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <!-- Borrar Factura e Historial -->
        <button class="inline-flex items-center justify-center bg-rose-500/10 text-rose-400 border border-transparent hover:bg-rose-500 hover:text-white font-bold px-2 py-1 rounded transition-colors opacity-0 group-hover:opacity-100 h-[26px]" onclick="delRec('${r.id}')" title="Borrar Permanente">
           <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </td>
    </tr>`;
  }).join('');
};

// ── MODALS (SEPARATED) ────────────────────────────────────────────────────

window.closeModals = function(){
  document.getElementById('ovFactura').classList.add('hidden');
  document.getElementById('ovFactura').classList.remove('flex');
  document.getElementById('ovPago').classList.add('hidden');
  document.getElementById('ovPago').classList.remove('flex');
  editFacId=null;
};

// Clics afuera cierran todo
document.getElementById('ovFactura').addEventListener('click',e=>{if(e.target===e.currentTarget)window.closeModals();});
document.getElementById('ovPago').addEventListener('click',e=>{if(e.target===e.currentTarget)window.closeModals();});

// -- HELPERS MODAL FACTURA --
function populateCliSelect(selectedValue=''){
  const clients=[...new Set(data.map(r=>r.cliente))];
  document.getElementById('mfCliSelect').innerHTML=
    `<option value="">—</option>`+clients.map(c=>`<option${c===selectedValue?' selected':''}>${c}</option>`).join('');
}

function getCliValue(){
  const inp=document.getElementById('mfCliInput');
  return inp.classList.contains('hidden')
    ? document.getElementById('mfCliSelect').value
    : inp.value.trim();
}

function showCliSelect(){ document.getElementById('mfCliSelect').classList.remove('hidden'); document.getElementById('mfCliInput').classList.add('hidden'); }
function showCliInput(){  document.getElementById('mfCliSelect').classList.add('hidden');    document.getElementById('mfCliInput').classList.remove('hidden'); }

function openFacturaModal(){
  document.getElementById('ovFactura').classList.remove('hidden');
  document.getElementById('ovFactura').classList.add('flex');
}

// Botón: Nueva Factura — cliente existente (dropdown)
window.openNuevaFactura = function(){
  facMode='factura'; editFacId=null;
  document.getElementById('mFacTitle').textContent='Nueva Factura';
  document.getElementById('mFacDesc').textContent='Selecciona el cliente y registra la nueva deuda.';
  showCliSelect(); populateCliSelect();
  ['mfNum','mfDate','mfTotal','mfObs'].forEach(i=>document.getElementById(i).value='');
  openFacturaModal();
};

// Botón: Nuevo Cliente — nombre libre + primera factura
window.openNuevoCliente = function(){
  facMode='cliente'; editFacId=null;
  document.getElementById('mFacTitle').textContent='Nuevo Cliente';
  document.getElementById('mFacDesc').textContent='Bautiza la empresa y registra su primera factura.';
  showCliInput(); document.getElementById('mfCliInput').value='';
  ['mfNum','mfDate','mfTotal','mfObs'].forEach(i=>document.getElementById(i).value='');
  openFacturaModal();
};

// -- FACTURA MODAL -- (Edición desde tarjeta/tabla)
window.openFactura = function(id=null){
  facMode='edit'; editFacId=id;
  document.getElementById('mFacTitle').textContent='Editar Factura';
  document.getElementById('mFacDesc').textContent='Modifica los datos raíz del cliente y su monto.';
  showCliSelect();
  if(id){
    const r=data.find(x=>x.id===id);
    if(r){
      populateCliSelect(r.cliente);
      document.getElementById('mfNum').value=r.factura;
      document.getElementById('mfDate').value=r.fecha_factura;
      document.getElementById('mfTotal').value=r.monto_pagar;
      document.getElementById('mfObs').value=r.obs;
    }
  }
  openFacturaModal();
};

window.saveFactura = async function() {
  const cli = getCliValue();
  const num = cleanInvoiceFormat(document.getElementById('mfNum').value);
  const fec = document.getElementById('mfDate').value;
  const mt  = parseFloat(document.getElementById('mfTotal').value)||0;
  const obs = document.getElementById('mfObs').value;

  if(!cli){toast('El cliente es obligatorio.','terr');return;}
  if(!num.trim()){toast('Debes dar un número de factura.','terr');return;}
  if(mt<=0){toast('El monto a pagar debe ser mayor a 0.','terr');return;}

  if(editFacId){
    const rec=data.find(r=>r.id===editFacId);
    if(rec){
      rec.cliente=cli; rec.factura=num; rec.fecha_factura=fec; rec.monto_pagar=mt; rec.obs=obs;
      await saveToFirebase(rec);
      toast('Factura actualizada.','tok');
    }
  } else {
    const maxR=data.reduce((m,r)=>{const n=parseInt(r.id.replace('R',''))||0;return n>m?n:m;},0);
    const nr={
      id:'R'+String(maxR+1).padStart(3,'0'),
      cliente:cli, factura:num, fecha_factura:fec, monto_pagar:mt, obs:obs, pagos:[]
    };
    await saveToFirebase(nr);
    toast(facMode==='cliente'?'Nuevo cliente creado con éxito.':'Nueva factura creada.','tok');
  }
  closeModals();
};

window.delRec = async function(id){
  if(!confirm('¿Estás seguro de eliminar permanentemente el cliente/factura y todos sus abonos? Esta acción no se puede deshacer.'))return;
  await deleteFromFirebase(id);
  toast('Registro borrado completamente.','tok');
};

// -- PAGOS MODAL -- (Registrar solo abonos al maestro)
window.openPago = function(idFactura=null){
  const selTarget = document.getElementById('mpTarget');
  selTarget.innerHTML = '';
  
  // Rellenar las facturas activas
  data.forEach(r => {
    selTarget.innerHTML += `<option value="${r.id}">${r.factura} (${r.cliente})</option>`;
  });
  
  if(idFactura) selTarget.value = idFactura;
  
  ['mpDate','mpMonto','mpCuenta'].forEach(i=>document.getElementById(i).value='');
  
  window.loadPaymentsList(); // Visualizar los antiguos para contexto
  
  document.getElementById('ovPago').classList.remove('hidden');
  document.getElementById('ovPago').classList.add('flex');
};

window.loadPaymentsList = function() {
  const mFacVal = document.getElementById('mpTarget').value;
  const r = data.find(x => x.id === mFacVal);
  const list = document.getElementById('mpHistory');
  if(!r || !r.pagos.length){
    list.innerHTML='<div class="text-[0.7rem] text-slate-500 text-center py-2 italic font-mono bg-slate-800/10 rounded border border-slate-800/50">0 pagos registrados - Pendiente total</div>';
    return;
  }
  // Se muestran read-only en este panel (solo se puede agregar)
  list.innerHTML=r.pagos.map((p,i)=>`
    <div class="flex items-center justify-between text-[0.7rem] bg-slate-800/30 border border-slate-700/50 rounded px-2.5 py-1.5 opacity-70">
      <div class="flex gap-4">
        <span class="font-mono text-slate-400 w-20">${fmtD(p.fecha)}</span>
        <span class="font-mono font-medium text-[#34d399] w-20">${fmt(p.monto)}</span>
        <span class="text-slate-400">${p.cuenta||'—'}</span>
      </div>
      <button class="text-rose-500/50 hover:text-rose-400" onclick="deletePagoEspecifco('${r.id}', ${i})" title="Remover pago">✕</button>
    </div>`).join('');
};

window.deletePagoEspecifco = async function(idFactura, indexPago) {
  if(!confirm('¿Eliminar este abono del historial?')) return;
  const rec=data.find(r=>r.id===idFactura);
  if(rec){
    rec.pagos.splice(indexPago, 1);
    await saveToFirebase(rec);
    toast('Pago eliminado.','tok');
    if(document.getElementById('ovPago').classList.contains('flex')) {
       window.loadPaymentsList(); // update vista si esta abierta
    }
  }
}

window.savePago = async function() {
  const targetId = document.getElementById('mpTarget').value;
  const fecha = document.getElementById('mpDate').value;
  const monto = parseFloat(document.getElementById('mpMonto').value)||0;
  const cuenta = document.getElementById('mpCuenta').value;
  
  if(!targetId){toast('Error: Selecciona una factura.','terr');return;}
  if(!fecha || monto<=0){toast('Debes ingresar la fecha y el monto exacto del abono.','terr');return;}

  const rec=data.find(r=>r.id===targetId);
  if(rec){
    const maxP = rec.pagos.reduce((m,p)=>{const n=parseInt((p.id||'').replace('P',''))||0;return n>m?n:m;},0);
    rec.pagos.push({id:'P'+String(maxP+1).padStart(3,'0'),fecha,monto,cuenta,obs:''});
    
    await saveToFirebase(rec);
    toast('Abono registrado maravillosamente 🎉','tok');
    closeModals();
  }
};

// ── TOAST ─────────────────────────────────────────────────────────────────
window.toast = function(msg,cls='tok'){
  const t=document.getElementById('toast');
  document.getElementById('tmsg').textContent=msg;
  t.className = `fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm flex items-center gap-3 z-[400] transition-all duration-300 shadow-xl border bg-slate-900 border-slate-700 ${cls==='tok'?'border-emerald-500/40 text-slate-200' : 'border-rose-500/40 text-rose-100'} ${t.classList.contains('translate-y-8')?'translate-y-0 opacity-100':'translate-y-0 opacity-100'}`;
  const dot = t.querySelector('.tdot');
  dot.className = `tdot w-2 h-2 rounded-full shrink-0 ${cls==='tok'?'bg-[#34d399]':'bg-[#f87171]'}`;
  t.classList.remove('translate-y-8', 'opacity-0');
  setTimeout(()=>{t.classList.add('translate-y-8', 'opacity-0');}, 3500);
};

// ── RENDER ALL ────────────────────────────────────────────────────────────
function renderAll(){
  updateDate(); renderDashboard(); renderClients(); populateFilters(); window.renderTable();
  if(document.getElementById('ovPago').classList.contains('flex')) {
       // if they happen to have it open and Firebase pushes an update, refresh list
       window.loadPaymentsList();
  }
}

updateDate();
setInterval(updateDate,30000);
