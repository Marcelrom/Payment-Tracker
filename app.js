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
const COL_USERS = "usuarios";
const DEFAULT_PASS = "1234";

// ── COLORS ────────────────────────────────────────────────────────────────
const COLORS={Efectivo:'#22d3ee',Cahen:'#4f9cf9',Vitatech:'#34d399',
  Coreligix:'#a78bfa',Otro:'#94a3b8'};
function cc(n){return COLORS[n]||'#94a3b8';}

// ── SEED DATA ─────────────────────────────────────────────────────────────
const SEED=[
  {id:'R001',cliente:'Efectivo',factura:'EFE-01',fecha_factura:'2025-12-20',monto_pagar:200000,
    pagos:[{id:'P001',fecha:'2025-01-28',monto:200000,cuenta:'Caja',obs:''}],obs:'',estado:'aprobado',creado_por:'admin'},
  {id:'R002',cliente:'Cahen',factura:'CAH-01',fecha_factura:'2025-12-20',monto_pagar:1187750,
    pagos:[
      {id:'P002',fecha:'2025-01-28',monto:250000,cuenta:'BBVA Cahen',obs:''},
      {id:'P003',fecha:'2026-02-04',monto:99404,cuenta:'BBVA Cahen',obs:''},
      {id:'P004',fecha:'2026-03-03',monto:100000,cuenta:'BBVA Cahen',obs:''},
    ],obs:'',estado:'aprobado',creado_por:'admin'},
  {id:'R003',cliente:'Vitatech',factura:'VIT-01',fecha_factura:'2025-12-20',monto_pagar:3581501,
    pagos:[
      {id:'P005',fecha:'2026-02-04',monto:700000,cuenta:'Santander Vita',obs:''},
      {id:'P006',fecha:'2026-03-03',monto:700000,cuenta:'Santander Vita',obs:''},
    ],obs:'',estado:'aprobado',creado_por:'admin'},
  {id:'R004',cliente:'Coreligix',factura:'COR-01',fecha_factura:'2025-12-20',monto_pagar:3581501,
    pagos:[],obs:'Sin pagos',estado:'aprobado',creado_por:'admin'},
  {id:'R006',cliente:'Cahen',factura:'CAH-02',fecha_factura:'2026-02-12',monto_pagar:664900,
    pagos:[],obs:'Factura feb 2026',estado:'aprobado',creado_por:'admin'},
  {id:'R007',cliente:'Vitatech',factura:'VIT-02',fecha_factura:'2026-02-12',monto_pagar:1186973,
    pagos:[],obs:'Factura feb 2026',estado:'aprobado',creado_por:'admin'},
];

const SEED_USERS=[
  {user:'admin', password:DEFAULT_PASS, rol:'admin'},
  {user:'operador', password:DEFAULT_PASS, rol:'operador'},
];

// ── STATE ─────────────────────────────────────────────────────────────────
let data = [];
let usersData = {};  // {admin:{...}, operador:{...}}
let currentUser = null; // {user, rol}
let editFacId = null;
let facMode = 'factura';
let editClientName = null;
let failedAttempts = 0;

function cleanInvoiceFormat(factura) {
  if (!factura) return factura;
  return factura.replace(/^FAC-/i, '');
}

// ── UTILS ─────────────────────────────────────────────────────────────────
function fmt(n){if(n===null||n===undefined)return'--';return'$'+Number(n).toLocaleString('es-MX',{minimumFractionDigits:0,maximumFractionDigits:0});}
function fmtD(d){if(!d)return'--';try{const[y,m,dd]=d.split('-');const ms=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];return`${parseInt(dd)} ${ms[parseInt(m)-1]} ${y}`;}catch(e){return d;}}
function paid(r){return r.pagos.reduce((s,p)=>s+(p.monto||0),0);}
function pend(r){return Math.max(0,r.monto_pagar-paid(r));}
function pct(r){if(!r.monto_pagar)return 100;return Math.min(100,(paid(r)/r.monto_pagar)*100);}
function status(r){const p=paid(r);if(p>=r.monto_pagar&&r.monto_pagar>0)return'Pagado';if(p>0)return'Parcial';return'Pendiente';}
function bclass(s){return s==='Pagado'?'bg-emerald-500/10 text-emerald-400':s==='Parcial'?'bg-amber-500/10 text-amber-400':'bg-rose-500/10 text-rose-400';}
function h2rgb(hex){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `${r},${g},${b}`;}
function isApproved(r){return !r.estado || r.estado==='aprobado';}
function isPending(r){return r.estado==='pendiente';}
function isAdmin(){return currentUser && currentUser.rol==='admin';}
function approvedData(){return data.filter(r=>isApproved(r));}

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

// ══════════════════════════════════════════════════════════════════════════
// AUTH SYSTEM
// ══════════════════════════════════════════════════════════════════════════

async function seedUsersIfEmpty(snapshot) {
  if (snapshot.empty) {
    for (const u of SEED_USERS) {
      await setDoc(doc(db, COL_USERS, u.user), u);
    }
  }
}

// Listen to users collection
onSnapshot(collection(db, COL_USERS), async (snapshot) => {
  await seedUsersIfEmpty(snapshot);
  usersData = {};
  snapshot.docs.forEach(d => { usersData[d.id] = d.data(); });
}, (err) => { console.error('Users sync error', err); });

function checkSession() {
  const saved = localStorage.getItem('pt_session');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showApp();
    } catch(e) { localStorage.removeItem('pt_session'); }
  }
}

function showApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('appMain').classList.remove('hidden');
  document.getElementById('userLabel').textContent = currentUser.user;
  document.getElementById('ddUserName').textContent = currentUser.user;
  document.getElementById('ddUserRole').textContent = currentUser.rol === 'admin' ? 'Administrador' : 'Operador';
  // Show admin-only controls
  if(isAdmin()) {
    document.getElementById('ddResetOper').classList.remove('hidden');
  } else {
    document.getElementById('ddResetOper').classList.add('hidden');
  }
  renderAll();
}

window.doLogin = function() {
  const user = document.getElementById('loginUser').value;
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');

  const userData = usersData[user];
  if (!userData) {
    errEl.textContent = 'Cargando usuarios, espera un momento...';
    errEl.classList.remove('hidden');
    return;
  }

  if (userData.password !== pass) {
    failedAttempts++;
    errEl.textContent = `Contrasena incorrecta (intento ${failedAttempts}/5)`;
    errEl.classList.remove('hidden');
    if (failedAttempts >= 5) {
      document.getElementById('btnEmergencyReset').classList.remove('hidden');
    }
    return;
  }

  failedAttempts = 0;
  errEl.classList.add('hidden');
  document.getElementById('btnEmergencyReset').classList.add('hidden');
  currentUser = { user: userData.user, rol: userData.rol };
  localStorage.setItem('pt_session', JSON.stringify(currentUser));
  showApp();
};

window.doLogout = function() {
  currentUser = null;
  localStorage.removeItem('pt_session');
  document.getElementById('appMain').classList.add('hidden');
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('userDropdown').classList.add('hidden');
};

window.emergencyReset = async function() {
  if (usersData.admin) {
    usersData.admin.password = DEFAULT_PASS;
    await setDoc(doc(db, COL_USERS, 'admin'), usersData.admin);
  }
  failedAttempts = 0;
  document.getElementById('btnEmergencyReset').classList.add('hidden');
  const errEl = document.getElementById('loginError');
  errEl.textContent = 'Contrasena de admin restaurada a: ' + DEFAULT_PASS;
  errEl.classList.remove('hidden');
  errEl.classList.remove('text-rose-400');
  errEl.classList.add('text-amber-400');
  setTimeout(() => { errEl.classList.remove('text-amber-400'); errEl.classList.add('text-rose-400'); }, 5000);
};

window.toggleUserMenu = function() {
  document.getElementById('userDropdown').classList.toggle('hidden');
};

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const dd = document.getElementById('userDropdown');
  const btn = document.getElementById('userMenuBtn');
  if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
    dd.classList.add('hidden');
  }
});

// Change password
window.openChangePassword = function() {
  document.getElementById('userDropdown').classList.add('hidden');
  ['cpCurrent','cpNew','cpConfirm'].forEach(i => document.getElementById(i).value = '');
  document.getElementById('ovPassword').classList.remove('hidden');
  document.getElementById('ovPassword').classList.add('flex');
};

window.savePassword = async function() {
  const cur = document.getElementById('cpCurrent').value;
  const nw = document.getElementById('cpNew').value;
  const conf = document.getElementById('cpConfirm').value;

  const userData = usersData[currentUser.user];
  if (!userData || userData.password !== cur) { toast('Contrasena actual incorrecta.','terr'); return; }
  if (nw.length < 4) { toast('La nueva contrasena debe tener al menos 4 caracteres.','terr'); return; }
  if (nw !== conf) { toast('Las contrasenas no coinciden.','terr'); return; }

  userData.password = nw;
  await setDoc(doc(db, COL_USERS, currentUser.user), userData);
  toast('Contrasena actualizada correctamente.','tok');
  closeModals();
};

// Admin: reset operador password
window.resetOperadorPassword = async function() {
  document.getElementById('userDropdown').classList.add('hidden');
  if (!confirm('Se restaurara la contrasena del operador a: ' + DEFAULT_PASS + '\n\nConfirmar?')) return;
  if (usersData.operador) {
    usersData.operador.password = DEFAULT_PASS;
    await setDoc(doc(db, COL_USERS, 'operador'), usersData.operador);
    toast('Password del operador reseteada a: ' + DEFAULT_PASS, 'tok');
  }
};

// ══════════════════════════════════════════════════════════════════════════
// FIREBASE DATA
// ══════════════════════════════════════════════════════════════════════════

async function seedIfEmpty(snapshot) {
  if (snapshot.empty) {
    setSyncStatus('loading', 'Cargando datos iniciales...');
    for (const rec of SEED) { await setDoc(doc(db, COL, rec.id), rec); }
  }
}

async function saveToFirebase(rec) { await setDoc(doc(db, COL, rec.id), rec); }
async function deleteFromFirebase(id) { await deleteDoc(doc(db, COL, id)); }

onSnapshot(collection(db, COL), async (snapshot) => {
  await seedIfEmpty(snapshot);
  data = snapshot.docs.map(d => {
    let r = d.data();
    r.factura = cleanInvoiceFormat(r.factura);
    if(r.cliente === "EPI Sofom" || r.cliente === "Lalo") r.cliente = "Otro";
    // Migrate old records without estado
    if (!r.estado) r.estado = 'aprobado';
    if (!r.creado_por) r.creado_por = 'admin';
    return r;
  }).sort((a,b) => a.id.localeCompare(b.id));
  setSyncStatus('ok', 'Sincronizado');
  if (currentUser) renderAll();
}, (err) => {
  setSyncStatus('err', 'Sin conexion');
  console.error(err);
});

// ── DATE CHIP ─────────────────────────────────────────────────────────────
function updateDate(){
  const n=new Date();
  const ds=['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
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

// ══════════════════════════════════════════════════════════════════════════
// DASHBOARD (only approved records)
// ══════════════════════════════════════════════════════════════════════════

function renderDashboard(){
  const ad = approvedData();
  const tp=ad.reduce((s,r)=>s+r.monto_pagar,0);
  const tpd=ad.reduce((s,r)=>s+paid(r),0);
  const tpn=ad.reduce((s,r)=>s+pend(r),0);
  const p=tp>0?(tpd/tp*100):0;
  const nDone=ad.filter(r=>status(r)==='Pagado').length;
  const nPend=ad.filter(r=>status(r)==='Pendiente').length;
  const nPar=ad.filter(r=>status(r)==='Parcial').length;
  const allPayments=ad.reduce((s,r)=>s+r.pagos.length,0);
  const uniqueCli=[...new Set(ad.map(r=>r.cliente))].length;

  document.getElementById('kpiGrid').innerHTML=`
    <div class="kpi hover:-translate-y-1 hover:border-[#4f9cf9]/50 transition-all cursor-default bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
      <div class="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#4f9cf9] to-[#92c5ff]"></div>
      <div class="absolute top-4 right-4 text-[#4f9cf9] transition-transform group-hover:scale-110">${ICON_INVOICE}</div>
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Total a cobrar</div>
      <div class="font-mono text-2xl font-medium leading-none mb-1.5 text-[#4f9cf9]">${fmt(tp)}</div>
      <div class="text-xs text-slate-500">${ad.length} registros</div>
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
      <div class="text-[0.65rem] font-semibold text-slate-400 tracking-wider uppercase mb-2">Clientes unicos</div>
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

  // Stat pills
  document.getElementById('ovStats').innerHTML=`
    <span class="font-mono text-[0.65rem] px-2.5 py-1 rounded-md bg-[#34d399]/10 text-[#34d399] border border-[#34d399]/20">${nDone} completados</span>
    <span class="font-mono text-[0.65rem] px-2.5 py-1 rounded-md bg-[#f87171]/10 text-[#f87171] border border-[#f87171]/20">${nPend} sin pagar</span>
    <span class="font-mono text-[0.65rem] px-2.5 py-1 rounded-md bg-[#fbbf24]/10 text-[#fbbf24] border border-[#fbbf24]/20">${nPar} parciales</span>`;

  // Client cards in 2-col grid
  const clients=[...new Set(ad.map(r=>r.cliente))];
  let barsHtml='';
  for(const cli of clients){
    const recs=ad.filter(r=>r.cliente===cli);
    const ctp=recs.reduce((s,r)=>s+r.monto_pagar,0);
    const cpd=recs.reduce((s,r)=>s+paid(r),0);
    const cp2=ctp>0?(cpd/ctp*100):0;
    const col=cc(cli);

    let invoicesHtml='';
    for(const rec of recs){
      const rtp=rec.monto_pagar, rpd=paid(rec), rpc=rtp>0?(rpd/rtp*100):0, rst=status(rec);
      const badgeCol=rst==='Pagado'?'text-[#34d399] bg-[#34d399]/10 border-[#34d399]/20':
                     rst==='Parcial'?'text-[#fbbf24] bg-[#fbbf24]/10 border-[#fbbf24]/20':
                     'text-[#f87171] bg-[#f87171]/10 border-[#f87171]/20';
      invoicesHtml+=`
        <div class="pl-3 border-l-2 border-slate-700/50">
          <div class="flex justify-between items-center gap-2 mb-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="font-mono text-[0.65rem] text-slate-300">${rec.factura}</span>
              <span class="font-mono text-[0.55rem] px-1.5 py-0.5 rounded border ${badgeCol}">${rst}</span>
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono text-[0.62rem] text-slate-400">${fmt(rpd)}</span>
              <span class="font-mono text-[0.58rem] text-slate-600"> / ${fmt(rtp)}</span>
            </div>
          </div>
          <div class="h-1 w-full bg-slate-800 rounded-full overflow-hidden mb-2.5">
            <div class="h-full rounded-full transition-all duration-1000 ease-out" style="width:${rpc}%;background-color:${col};opacity:0.7"></div>
          </div>
        </div>`;
    }

    barsHtml+=`
      <div class="bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
        <!-- Client header -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full" style="background:${col}"></div>
            <span class="font-bold text-[0.8rem] uppercase tracking-wide" style="color:${col}">${cli}</span>
            <span class="font-mono text-[0.6rem] text-slate-500">${recs.length} factura(s)</span>
          </div>
          <div class="text-right">
            <span class="font-mono text-[0.72rem] font-semibold" style="color:${col}">${cp2.toFixed(0)}%</span>
            <span class="font-mono text-[0.6rem] text-slate-500 ml-1">${fmt(cpd)} / ${fmt(ctp)}</span>
          </div>
        </div>
        <!-- Client aggregate bar -->
        <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
          <div class="h-full rounded-full transition-all duration-1000 ease-out" style="width:${cp2}%;background-color:${col}"></div>
        </div>
        <!-- Invoice sub-rows -->
        <div class="flex flex-col gap-0">
          ${invoicesHtml}
        </div>
      </div>`;
  }
  document.getElementById('ovBars').innerHTML=barsHtml||'<div class="col-span-2 text-center text-slate-500 text-sm py-8">Sin datos aprobados.</div>';
}

// ══════════════════════════════════════════════════════════════════════════
// CLIENTES TAB — Grouped by client
// ══════════════════════════════════════════════════════════════════════════

function renderClients(){
  const clients=[...new Set(data.map(r=>r.cliente))];
  let html='';

  for(const cli of clients){
    const recs=data.filter(r=>r.cliente===cli).sort((a,b)=>(a.fecha_factura||'').localeCompare(b.fecha_factura||''));
    const col=cc(cli);
    const ctp=recs.filter(r=>isApproved(r)).reduce((s,r)=>s+r.monto_pagar,0);
    const cpd=recs.filter(r=>isApproved(r)).reduce((s,r)=>s+paid(r),0);
    const cp2=ctp>0?(cpd/ctp*100):0;
    html+=`
    <div class="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <!-- ── NIVEL CLIENTE: Header ── -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-slate-800/50 bg-slate-900">
        <div class="flex items-center gap-3">
          <div class="w-3 h-3 rounded-full" style="background:${col}"></div>
          <div class="font-bold text-[1.05rem] text-slate-100 uppercase tracking-wide">${cli}</div>
          <span class="font-mono text-[0.62rem] text-slate-500">${recs.length} factura(s) · ${cp2.toFixed(0)}% cobrado</span>
        </div>
        <div class="flex gap-1.5">
          <button class="text-[0.7rem] font-medium px-3 py-1 rounded-md text-[#4f9cf9] border border-[#4f9cf9]/30 hover:bg-[#4f9cf9]/10 hover:text-white transition-colors" onclick="openNuevaFacturaParaCliente('${cli}')">
            <svg class="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Nueva Factura
          </button>
          <button class="text-[0.7rem] font-medium px-3 py-1 rounded-md text-rose-400 border border-rose-500/20 hover:bg-rose-500/10 hover:text-rose-300 transition-colors" onclick="delCliente('${cli}')">
            <svg class="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>Borrar Cliente
          </button>
        </div>
      </div>

      <!-- ── NIVEL FACTURA: Tarjetas individuales ── -->
      <div class="p-4 flex flex-col gap-3">`;

    for(const rec of recs){
      const p=paid(rec), pn=pend(rec), pc=pct(rec), st=status(rec);
      const pending = isPending(rec);
      const pendingBadge = pending ? `<span class="font-mono text-[0.58rem] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">Pendiente aprobacion</span>` : '';
      const approveBtn = pending && isAdmin() ? `
        <button class="text-[0.65rem] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-colors" onclick="approveRec('${rec.id}')">Aprobar</button>
        <button class="text-[0.65rem] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-colors" onclick="rejectRec('${rec.id}')">Rechazar</button>` : '';
      const numPagos = rec.pagos.length;

      html+=`
        <div class="bg-slate-800/30 border border-slate-700/40 rounded-xl p-4 hover:border-slate-600/50 transition-colors group ${pending?'opacity-70':''}">
          <!-- Factura header -->
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2 flex-wrap">
              <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>
              <span class="font-mono text-[0.82rem] font-semibold text-slate-200">${rec.factura||'--'}</span>
              <span class="text-[0.6rem] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full ${bclass(st)}">${st}</span>
              ${pendingBadge}
            </div>
            <div class="flex items-center gap-1.5">
              ${approveBtn}
            </div>
          </div>

          <!-- Factura details -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-[0.7rem]">
            <div>
              <div class="text-[0.58rem] text-slate-500 uppercase tracking-wider mb-0.5">Fecha Factura</div>
              <div class="font-mono text-slate-300">${fmtD(rec.fecha_factura)}</div>
            </div>
            <div>
              <div class="text-[0.58rem] text-slate-500 uppercase tracking-wider mb-0.5">Monto Total</div>
              <div class="font-mono font-medium" style="color:${col}">${fmt(rec.monto_pagar)}</div>
            </div>
            <div>
              <div class="text-[0.58rem] text-slate-500 uppercase tracking-wider mb-0.5">Cobrado</div>
              <div class="font-mono text-[#34d399]">${fmt(p)}</div>
            </div>
            <div>
              <div class="text-[0.58rem] text-slate-500 uppercase tracking-wider mb-0.5">Pendiente</div>
              <div class="font-mono text-[#f87171]">${fmt(pn)}</div>
            </div>
          </div>

          <!-- Progress bar -->
          <div class="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
            <div class="h-full rounded-full transition-all duration-700 ease-out" style="width:${pc}%; background-color:${col}"></div>
          </div>

          ${rec.obs ? `<div class="text-[0.65rem] text-slate-500 italic mb-3">${rec.obs}</div>` : ''}

          <!-- Factura actions -->
          <div class="flex items-center justify-between pt-2 border-t border-slate-700/30">
            <span class="font-mono text-[0.6rem] text-slate-500">${numPagos} pago(s) registrado(s)</span>
            <div class="flex items-center gap-1.5">
              <button class="text-[0.68rem] font-medium px-2.5 py-1 rounded-md text-[#34d399] border border-[#34d399]/25 hover:bg-[#34d399]/10 transition-colors flex items-center gap-1" onclick="openPago('${rec.id}')">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>Agregar Pago
              </button>
              <button class="text-[0.68rem] font-medium px-2.5 py-1 rounded-md text-[#4f9cf9] border border-[#4f9cf9]/25 hover:bg-[#4f9cf9]/10 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100" onclick="openFactura('${rec.id}')">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>Editar Factura
              </button>
            </div>
          </div>
        </div>`;
    }

    html+=`</div></div>`;
  }

  document.getElementById('clientesGrouped').innerHTML = html || '<div class="text-center text-slate-500 py-12">No hay clientes registrados.</div>';
}

// ══════════════════════════════════════════════════════════════════════════
// PAGOS TAB — Payment operations only
// ══════════════════════════════════════════════════════════════════════════

function populateFilters(){
  const clients=[...new Set(data.map(r=>r.cliente))];
  const sel=document.getElementById('fc');const cur=sel.value;
  sel.innerHTML=`<option value="">Todos los clientes</option>`+clients.map(c=>`<option ${c===cur?'selected':''}>${c}</option>`).join('');
}

window.renderTable = function(){
  const q=document.getElementById('sq').value.toLowerCase();
  const fcc=document.getElementById('fc').value;
  const fee=document.getElementById('fe').value;
  const tbody=document.getElementById('tbody');

  // Build flat list: one row per individual payment
  let rows=[];
  for(const r of data){
    if(!isApproved(r)) continue; // Only approved invoices
    for(let i=0;i<r.pagos.length;i++){
      const p=r.pagos[i];
      const pagoEstado = p.estado || 'aprobado';
      // Filters
      if(fcc && r.cliente!==fcc) continue;
      if(fee && pagoEstado!==fee) continue;
      if(q){
        const txt = `${r.cliente} ${r.factura} ${p.fecha} ${p.monto} ${p.cuenta||''} ${p.creado_por||''}`.toLowerCase();
        if(!txt.includes(q)) continue;
      }
      rows.push({rec:r, pago:p, idx:i, pagoEstado});
    }
  }

  // Sort by date descending (most recent first)
  rows.sort((a,b)=>(b.pago.fecha||'').localeCompare(a.pago.fecha||''));

  if(!rows.length){tbody.innerHTML=`<tr><td colspan="9" class="text-center py-12 text-slate-500 text-sm">Sin pagos registrados.</td></tr>`;return;}

  tbody.innerHTML=rows.map(({rec:r, pago:p, idx:i, pagoEstado})=>{
    const col=cc(r.cliente);
    const isPend = pagoEstado==='pendiente';
    const isPendDel = pagoEstado==='pendiente_borrar';
    const estadoBadge = isPendDel
      ? '<span class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">Borrado pendiente</span>'
      : isPend
      ? '<span class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">Pendiente</span>'
      : '<span class="text-[0.58rem] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Aprobado</span>';

    const approveHtml = (isPend||isPendDel) && isAdmin() ? `
        <button class="inline-flex items-center justify-center bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white font-bold px-2 py-1 rounded transition-colors h-[26px]" onclick="approvePago('${r.id}',${i})" title="Aprobar">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
        </button>
        <button class="inline-flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white font-bold px-2 py-1 rounded transition-colors h-[26px]" onclick="rejectPago('${r.id}',${i})" title="Rechazar">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>` : '';

    const esquemaBadge = p.esquema ? `<span class="text-[0.58rem] font-medium px-1.5 py-0.5 rounded bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20 whitespace-nowrap">${p.esquema}</span>` : '<span class="text-[0.65rem] text-slate-600">--</span>';

    return `
    <tr class="border-b border-slate-800/50 hover:bg-[#4f9cf9]/5 transition-colors group ${(isPend||isPendDel)?'opacity-60':''}">
      <td class="px-4 py-3 align-middle"><span class="text-[0.65rem] font-bold px-2 py-0.5 rounded" style="background:rgba(${h2rgb(col)},.15);color:${col}">${r.cliente}</span></td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-slate-300">${r.factura||'--'}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-slate-400 whitespace-nowrap">${fmtD(p.fecha)}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.7rem] text-[#34d399] font-medium whitespace-nowrap text-right">${fmt(p.monto)}</td>
      <td class="px-4 py-3 align-middle text-[0.7rem] text-slate-400">${p.cuenta||'--'}</td>
      <td class="px-4 py-3 align-middle">${esquemaBadge}</td>
      <td class="px-4 py-3 align-middle font-mono text-[0.65rem] text-slate-500">${p.creado_por||'admin'}</td>
      <td class="px-4 py-3 align-middle">${estadoBadge}</td>
      <td class="px-4 py-3 align-middle whitespace-nowrap text-right">
        <div class="flex items-center justify-end gap-1">
          ${approveHtml}
          <button class="inline-flex items-center justify-center bg-[#4f9cf9]/10 text-[#4f9cf9] border border-[#4f9cf9]/30 hover:bg-[#4f9cf9] hover:text-white font-bold px-2 py-1 rounded transition-colors h-[26px] opacity-0 group-hover:opacity-100" onclick="editPago('${r.id}',${i})" title="Editar monto">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
          <button class="inline-flex items-center justify-center bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500 hover:text-white font-bold px-2 py-1 rounded transition-colors h-[26px] opacity-0 group-hover:opacity-100" onclick="deletePagoEspecifico('${r.id}',${i})" title="Borrar pago">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
};

// ══════════════════════════════════════════════════════════════════════════
// MODALS
// ══════════════════════════════════════════════════════════════════════════

window.closeModals = function(){
  ['ovFactura','ovPago','ovPassword','ovRenameClient'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
    document.getElementById(id).classList.remove('flex');
  });
  editFacId=null;
  editClientName=null;
};

// Click outside closes modals
['ovFactura','ovPago','ovPassword','ovRenameClient'].forEach(id => {
  document.getElementById(id).addEventListener('click',e=>{if(e.target===e.currentTarget)window.closeModals();});
});

// ── FACTURA MODAL HELPERS ──
function populateCliSelect(selectedValue=''){
  const clients=[...new Set(data.map(r=>r.cliente))];
  document.getElementById('mfCliSelect').innerHTML=
    `<option value="">--</option>`+clients.map(c=>`<option${c===selectedValue?' selected':''}>${c}</option>`).join('');
}
function getCliValue(){
  const stat=document.getElementById('mfCliStatic');
  if(!stat.classList.contains('hidden')) return stat.dataset.client;
  const inp=document.getElementById('mfCliInput');
  return inp.classList.contains('hidden') ? document.getElementById('mfCliSelect').value : inp.value.trim();
}
function hideAllCliFields(){ document.getElementById('mfCliSelect').classList.add('hidden'); document.getElementById('mfCliInput').classList.add('hidden'); document.getElementById('mfCliStatic').classList.add('hidden'); }
function showCliSelect(){ hideAllCliFields(); document.getElementById('mfCliSelect').classList.remove('hidden'); }
function showCliInput(){ hideAllCliFields(); document.getElementById('mfCliInput').classList.remove('hidden'); }

function openFacturaModal(){
  document.getElementById('ovFactura').classList.remove('hidden');
  document.getElementById('ovFactura').classList.add('flex');
}

// ── NUEVO CLIENTE (con su primera factura) ──
window.openNuevoCliente = function(){
  facMode='cliente'; editFacId=null;
  document.getElementById('mFacTitle').textContent='Nuevo Cliente';
  document.getElementById('mFacDesc').textContent='Crea el cliente con su primera factura.';
  showCliInput(); document.getElementById('mfCliInput').value='';
  ['mfNum','mfDate','mfTotal','mfObs'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('btnDelFactura').classList.add('hidden');
  document.getElementById('mfExistentes').classList.add('hidden');
  openFacturaModal();
};

// ── SUGERIR SIGUIENTE NÚMERO DE FACTURA ──
function suggestNextFactura(cli){
  const facturas = data
    .filter(r => r.cliente.toUpperCase() === cli.toUpperCase())
    .map(r => r.factura);
  if(!facturas.length) return '';
  let maxNum = 0, prefix = '', numLen = 2;
  for(const f of facturas){
    const match = f.match(/^(.+?)(\d+)$/);
    if(match){
      const num = parseInt(match[2]);
      if(num > maxNum){
        maxNum = num;
        prefix = match[1];
        numLen = match[2].length;
      }
    }
  }
  if(!prefix) return '';
  return prefix + String(maxNum + 1).padStart(numLen, '0');
}

// ── NUEVA FACTURA PARA CLIENTE EXISTENTE ──
window.openNuevaFacturaParaCliente = function(cli){
  facMode='factura_cliente'; editFacId=null;
  document.getElementById('mFacTitle').textContent='Nueva Factura';
  document.getElementById('mFacDesc').textContent='Nueva factura para ' + cli;
  // Hide both selects, show client name as static label
  document.getElementById('mfCliSelect').classList.add('hidden');
  document.getElementById('mfCliInput').classList.add('hidden');
  document.getElementById('mfCliStatic').textContent = cli;
  document.getElementById('mfCliStatic').classList.remove('hidden');
  document.getElementById('mfCliStatic').dataset.client = cli;
  ['mfDate','mfTotal','mfObs'].forEach(i=>document.getElementById(i).value='');
  // Pre-fill suggested invoice number
  const suggestion = suggestNextFactura(cli);
  document.getElementById('mfNum').value = suggestion;
  document.getElementById('btnDelFactura').classList.add('hidden');

  // Show existing invoices for this client
  const existentes = data.filter(r=>r.cliente.toUpperCase()===cli.toUpperCase());
  const exDiv = document.getElementById('mfExistentes');
  const exLista = document.getElementById('mfExistentesLista');
  if(existentes.length){
    exLista.innerHTML = existentes.map(r=>
      `<span class="font-mono text-[0.65rem] px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600/40">${r.factura}</span>`
    ).join('');
    exDiv.classList.remove('hidden');
  } else {
    exDiv.classList.add('hidden');
  }

  openFacturaModal();
};

// ── EDITAR FACTURA ──
window.openFactura = function(id=null){
  facMode='edit'; editFacId=id;
  document.getElementById('mFacTitle').textContent='Editar Factura';
  document.getElementById('mFacDesc').textContent='Modifica los datos de la factura.';
  document.getElementById('mfExistentes').classList.add('hidden');
  showCliSelect();
  document.getElementById('mfCliSelect').disabled = false;
  const btnDel=document.getElementById('btnDelFactura');
  if(id){
    const r=data.find(x=>x.id===id);
    if(r){
      populateCliSelect(r.cliente);
      document.getElementById('mfNum').value=r.factura;
      document.getElementById('mfDate').value=r.fecha_factura;
      document.getElementById('mfTotal').value=r.monto_pagar;
      document.getElementById('mfObs').value=r.obs;
    }
    btnDel.classList.remove('hidden');
  } else {
    btnDel.classList.add('hidden');
  }
  openFacturaModal();
};

// ── GUARDAR FACTURA ──
window.saveFactura = async function() {
  const cli = getCliValue();
  const num = cleanInvoiceFormat(document.getElementById('mfNum').value);
  const fec = document.getElementById('mfDate').value;
  const mt = parseFloat(document.getElementById('mfTotal').value)||0;
  const obs = document.getElementById('mfObs').value;

  if(!cli){toast('El cliente es obligatorio.','terr');return;}
  if(!num.trim()){toast('Debes dar un numero de factura.','terr');return;}
  if(mt<=0){toast('El monto a pagar debe ser mayor a 0.','terr');return;}

  // Validate duplicate invoice per client (skip if editing the same record)
  const duplicate = data.find(r => r.cliente.toUpperCase()===cli.toUpperCase() && r.factura.toUpperCase()===num.toUpperCase() && r.id!==editFacId);
  if(duplicate){toast('Esta factura ya existe para el cliente '+cli+'. Usa un numero diferente.','terr');return;}

  const estado = isAdmin() ? 'aprobado' : 'pendiente';
  const creado_por = currentUser.user;

  if(editFacId){
    const rec=data.find(r=>r.id===editFacId);
    if(rec){
      rec.cliente=cli; rec.factura=num; rec.fecha_factura=fec; rec.monto_pagar=mt; rec.obs=obs;
      if(!isAdmin() && isApproved(rec)) { rec.estado='pendiente'; rec.creado_por=creado_por; }
      await saveToFirebase(rec);
      toast('Factura actualizada.','tok');
    }
  } else {
    const maxR=data.reduce((m,r)=>{const n=parseInt(r.id.replace('R',''))||0;return n>m?n:m;},0);
    const nr={
      id:'R'+String(maxR+1).padStart(3,'0'),
      cliente:cli, factura:num, fecha_factura:fec, monto_pagar:mt, obs:obs, pagos:[],
      estado, creado_por
    };
    await saveToFirebase(nr);
    const msg = estado==='pendiente' ? 'Solicitud enviada. Pendiente de aprobacion.' : (facMode==='cliente'?'Nuevo cliente creado.':'Nueva factura creada.');
    toast(msg,'tok');
  }
  document.getElementById('mfCliSelect').disabled = false;
  closeModals();
};

// ── BORRAR FACTURA ──
window.delFactura = async function(id){
  // If called from modal without argument, use editFacId
  if(!id && editFacId) id = editFacId;
  if(!id) return;
  const rec=data.find(r=>r.id===id);
  const numPagos = rec ? rec.pagos.length : 0;
  const msg = numPagos > 0
    ? `Se eliminara esta factura y sus ${numPagos} pago(s) asociados.\n\nEsta accion no se puede deshacer. Continuar?`
    : `Se eliminara esta factura.\n\nEsta accion no se puede deshacer. Continuar?`;
  if(!confirm(msg))return;
  await deleteFromFirebase(id);
  toast('Factura eliminada.','tok');
  closeModals();
};

// ── BORRAR CLIENTE (todas sus facturas) ──
window.delCliente = async function(cli){
  const facturas=data.filter(r=>r.cliente===cli);
  const totalPagos=facturas.reduce((s,r)=>s+r.pagos.length,0);
  const msg = `ATENCION: Se eliminara el cliente "${cli}" junto con:\n\n` +
    `  - ${facturas.length} factura(s)\n` +
    `  - ${totalPagos} pago(s) asociados\n\n` +
    `Esta accion no se puede deshacer. Continuar?`;
  if(!confirm(msg))return;
  await Promise.all(facturas.map(r=>deleteFromFirebase(r.id)));
  toast(`Cliente "${cli}" eliminado (${facturas.length} factura(s)).`,'tok');
};

// ── RENOMBRAR CLIENTE ──
window.openRenameClient = function(cli){
  editClientName = cli;
  document.getElementById('rcOldName').value = cli;
  document.getElementById('rcNewName').value = cli;

  // Populate existing invoices
  const facturas = data.filter(r => r.cliente === cli);
  const lista = document.getElementById('rcFacturasList');
  if(facturas.length){
    lista.innerHTML = facturas.map(r => {
      const st = status(r);
      const dotCol = st==='Pagado'?'#34d399':st==='Parcial'?'#fbbf24':'#f87171';
      return `<span class="font-mono text-[0.65rem] px-2 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600/40 flex items-center gap-1">
        <span class="w-1.5 h-1.5 rounded-full inline-block" style="background:${dotCol}"></span>${r.factura}
      </span>`;
    }).join('');
  } else {
    lista.innerHTML = '<span class="text-[0.65rem] text-slate-600 italic">Sin facturas aun</span>';
  }

  document.getElementById('ovRenameClient').classList.remove('hidden');
  document.getElementById('ovRenameClient').classList.add('flex');
};

// "Nueva Factura" button inside the edit-client modal
window.rcAgregarFactura = function(){
  const cli = editClientName;
  closeModals();
  // Small delay so the modal close animates before opening the next
  setTimeout(() => openNuevaFacturaParaCliente(cli), 80);
};

window.saveRenameClient = async function(){
  const newName = document.getElementById('rcNewName').value.trim().toUpperCase();
  if(!newName){ toast('El nombre no puede estar vacio.','terr'); return; }
  if(newName === editClientName){ closeModals(); return; }

  const recs = data.filter(r=>r.cliente===editClientName);
  for(const rec of recs){
    rec.cliente = newName;
    await saveToFirebase(rec);
  }
  toast(`Cliente renombrado: ${editClientName} -> ${newName}`,'tok');
  closeModals();
};

// ══════════════════════════════════════════════════════════════════════════
// APPROVAL SYSTEM
// ══════════════════════════════════════════════════════════════════════════

window.approveRec = async function(id){
  const rec = data.find(r=>r.id===id);
  if(!rec) return;
  rec.estado = 'aprobado';
  await saveToFirebase(rec);
  toast('Registro aprobado.','tok');
};

window.rejectRec = async function(id){
  if(!confirm('Rechazar y eliminar este registro?')) return;
  await deleteFromFirebase(id);
  toast('Registro rechazado y eliminado.','tok');
};

function updatePendingBadge(){
  if(!isAdmin()){ document.getElementById('pendingBadge').classList.add('hidden'); return; }

  const pendingRecs = data.filter(r => isPending(r));

  // Distinguish: client pending = no other approved record for that client
  //              invoice pending = client already has approved records
  const approvedClients = new Set(data.filter(r => isApproved(r)).map(r => r.cliente));
  let pendingClientes = 0, pendingFacturas = 0;
  for(const r of pendingRecs){
    if(approvedClients.has(r.cliente)) pendingFacturas++;
    else pendingClientes++;
  }

  // Pending payments within any invoice
  let pendingPagos = 0;
  for(const r of data){
    pendingPagos += r.pagos.filter(p => p.estado==='pendiente' || p.estado==='pendiente_borrar').length;
  }

  const total = pendingClientes + pendingFacturas + pendingPagos;
  const badge = document.getElementById('pendingBadge');

  if(total > 0){
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    const parts = [];
    if(pendingClientes > 0) parts.push(`Clientes (${pendingClientes})`);
    if(pendingFacturas > 0) parts.push(`Facturas (${pendingFacturas})`);
    if(pendingPagos > 0)    parts.push(`Pagos (${pendingPagos})`);
    document.getElementById('pendingSummary').textContent = parts.join(' · ');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}

// Click badge: go to Clientes if facturas pending, else Pagos
window.pendingBadgeClick = function(){
  const pendingRecs = data.filter(r => isPending(r)).length;
  const tab = pendingRecs > 0 ? 'clientes' : 'pagos';
  showPage(document.querySelector(`[data-page=${tab}]`));
};

// ══════════════════════════════════════════════════════════════════════════
// PAGOS MODAL
// ══════════════════════════════════════════════════════════════════════════

window.toggleEsquemaOtro = function(){
  const val = document.getElementById('mpEsquema').value;
  const wrap = document.getElementById('mpEsquemaOtroWrap');
  if(val === 'Otros'){
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
  } else {
    wrap.classList.add('hidden');
    wrap.classList.remove('flex');
    document.getElementById('mpEsquemaOtro').value = '';
  }
};

window.openPago = function(idFactura=null){
  const selTarget = document.getElementById('mpTarget');
  selTarget.innerHTML = '';
  data.filter(r=>isApproved(r)).forEach(r => {
    selTarget.innerHTML += `<option value="${r.id}">${r.factura} (${r.cliente})</option>`;
  });
  if(idFactura) selTarget.value = idFactura;
  ['mpDate','mpMonto','mpCuenta'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('mpEsquema').value = '';
  document.getElementById('mpEsquemaOtro').value = '';
  document.getElementById('mpEsquemaOtroWrap').classList.add('hidden');
  document.getElementById('mpEsquemaOtroWrap').classList.remove('flex');
  // Reset edit-hide elements to visible (default mode = Abonar)
  document.querySelectorAll('#ovPago .edit-hide').forEach(el=>el.classList.remove('hidden'));
  // Reset title/desc
  document.getElementById('ovPago').querySelector('.font-serif').textContent = 'Registrar Abono';
  document.querySelectorAll('#ovPago .text-\\[0\\.76rem\\]')[0].textContent = 'Agrega un pago a una factura existente.';
  window.loadPaymentsList();
  document.getElementById('ovPago').classList.remove('hidden');
  document.getElementById('ovPago').classList.add('flex');
};

// Open historial (same modal but focused on viewing)
window.openHistorial = function(idFactura){
  window.openPago(idFactura);
};

// Open edit mode for payments (same modal, hides new payment fields)
window.openEditarPagos = function(idFactura){
  window.openPago(idFactura);
  // Hide the new payment form, keep only the historial with edit/delete
  document.querySelectorAll('#ovPago .edit-hide').forEach(el=>el.classList.add('hidden'));
  document.getElementById('ovPago').querySelector('.font-serif').textContent = 'Editar Pagos';
  document.getElementById('ovPago').querySelectorAll('.text-\\[0\\.76rem\\]')[0].textContent = 'Modifica o elimina pagos existentes.';
};

window.loadPaymentsList = function() {
  const mFacVal = document.getElementById('mpTarget').value;
  const r = data.find(x => x.id === mFacVal);
  const list = document.getElementById('mpHistory');
  if(!r || !r.pagos.length){
    list.innerHTML='<div class="text-[0.7rem] text-slate-500 text-center py-2 italic font-mono bg-slate-800/10 rounded border border-slate-800/50">0 pagos registrados</div>';
    return;
  }
  list.innerHTML=r.pagos.map((p,i)=>{
    const isPendPago = p.estado==='pendiente' || p.estado==='pendiente_borrar';
    const pendLabel = p.estado==='pendiente_borrar' ? '<span class="text-[0.55rem] px-1 py-0.5 rounded bg-rose-500/15 text-rose-400 border border-rose-500/20">borrado pendiente</span>' : isPendPago ? '<span class="text-[0.55rem] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">pendiente</span>' : '';
    const approveHtml = isPendPago && isAdmin() ? `
      <button class="text-emerald-400 hover:text-emerald-300 text-[0.6rem] font-bold" onclick="approvePago('${r.id}',${i})" title="Aprobar">&#10003;</button>
      <button class="text-rose-400 hover:text-rose-300 text-[0.6rem] font-bold" onclick="rejectPago('${r.id}',${i})" title="Rechazar">&#10007;</button>` : '';
    return `
    <div class="flex items-center justify-between text-[0.7rem] bg-slate-800/30 border border-slate-700/50 rounded px-2.5 py-1.5 ${isPendPago?'opacity-60':''}">
      <div class="flex gap-3 items-center flex-wrap">
        <span class="font-mono text-slate-400 w-20">${fmtD(p.fecha)}</span>
        <span class="font-mono font-medium text-[#34d399] w-20">${fmt(p.monto)}</span>
        <span class="text-slate-400">${p.cuenta||'--'}</span>
        ${p.esquema ? `<span class="text-[0.55rem] px-1.5 py-0.5 rounded bg-[#a78bfa]/10 text-[#a78bfa] border border-[#a78bfa]/20">${p.esquema}</span>` : ''}
        ${pendLabel}
      </div>
      <div class="flex items-center gap-1.5">
        ${approveHtml}
        <button class="text-[#4f9cf9]/50 hover:text-[#4f9cf9] transition-colors" onclick="editPago('${r.id}',${i})" title="Editar pago">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
        </button>
        <button class="text-rose-500/50 hover:text-rose-400 transition-colors" onclick="deletePagoEspecifico('${r.id}',${i})" title="Borrar pago">
          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
};

// ── EDIT PAGO MODAL ──────────────────────────────────────────────────────
let _editPagoFacturaId = null;
let _editPagoIndex = null;

window.toggleEpEsquemaOtro = function(){
  const val = document.getElementById('epEsquema').value;
  const wrap = document.getElementById('epEsquemaOtroWrap');
  if(val === 'Otros'){
    wrap.classList.remove('hidden');
    wrap.classList.add('flex');
  } else {
    wrap.classList.add('hidden');
    wrap.classList.remove('flex');
    document.getElementById('epEsquemaOtro').value = '';
  }
};

window.editPago = function(idFactura, indexPago) {
  const rec = data.find(r=>r.id===idFactura);
  if(!rec) return;
  const pago = rec.pagos[indexPago];

  _editPagoFacturaId = idFactura;
  _editPagoIndex = indexPago;

  // Populate fields
  document.getElementById('epFecha').value = pago.fecha || '';
  document.getElementById('epMonto').value = pago.monto || '';
  document.getElementById('epCuenta').value = pago.cuenta || '';

  // Handle esquema — detect if it's a custom "Otros" value
  const esquemaOpts = ['Asimilados','Prestamo x Mutuo','Efectivo','Transferencia a Terceros','Otros'];
  const esqVal = pago.esquema || '';
  const isOtros = esqVal && !esquemaOpts.includes(esqVal);
  const selectVal = isOtros ? 'Otros' : esqVal;
  document.getElementById('epEsquema').value = selectVal;
  if(isOtros || selectVal === 'Otros'){
    document.getElementById('epEsquemaOtroWrap').classList.remove('hidden');
    document.getElementById('epEsquemaOtroWrap').classList.add('flex');
    document.getElementById('epEsquemaOtro').value = isOtros ? esqVal : '';
  } else {
    document.getElementById('epEsquemaOtroWrap').classList.add('hidden');
    document.getElementById('epEsquemaOtroWrap').classList.remove('flex');
    document.getElementById('epEsquemaOtro').value = '';
  }

  document.getElementById('epDesc').textContent =
    `Factura: ${rec.factura} · Cliente: ${rec.cliente}`;

  document.getElementById('ovEditPago').classList.remove('hidden');
  document.getElementById('ovEditPago').classList.add('flex');
};

window.closeEditPago = function(){
  document.getElementById('ovEditPago').classList.add('hidden');
  document.getElementById('ovEditPago').classList.remove('flex');
  _editPagoFacturaId = null;
  _editPagoIndex = null;
};

window.saveEditPago = async function(){
  const rec = data.find(r=>r.id===_editPagoFacturaId);
  if(!rec) return;
  const pago = rec.pagos[_editPagoIndex];

  const fecha = document.getElementById('epFecha').value;
  const monto = parseFloat(document.getElementById('epMonto').value)||0;
  const cuenta = document.getElementById('epCuenta').value.trim();
  const esquemaVal = document.getElementById('epEsquema').value;
  const esquemaOtro = document.getElementById('epEsquemaOtro').value.trim();
  const esquema = esquemaVal === 'Otros' ? (esquemaOtro || 'Otros') : esquemaVal;

  if(!fecha){toast('La fecha es obligatoria.','terr');return;}
  if(monto<=0){toast('El monto debe ser mayor a 0.','terr');return;}

  if(isAdmin()){
    pago.fecha = fecha;
    pago.monto = monto;
    pago.cuenta = cuenta;
    pago.esquema = esquema;
    await saveToFirebase(rec);
    toast('Pago actualizado.','tok');
  } else {
    pago.fecha = fecha;
    pago.monto = monto;
    pago.cuenta = cuenta;
    pago.esquema = esquema;
    pago.estado = 'pendiente';
    pago.creado_por = currentUser.user;
    await saveToFirebase(rec);
    toast('Cambio enviado. Pendiente de aprobacion.','tok');
  }
  window.closeEditPago();
  if(document.getElementById('ovPago').classList.contains('flex')) window.loadPaymentsList();
  window.renderTable();
};

window.deletePagoEspecifico = async function(idFactura, indexPago) {
  if(!confirm('Eliminar este abono del historial?')) return;
  const rec=data.find(r=>r.id===idFactura);
  if(!rec) return;

  if(isAdmin()){
    rec.pagos.splice(indexPago, 1);
    await saveToFirebase(rec);
    toast('Pago eliminado.','tok');
  } else {
    rec.pagos[indexPago].estado = 'pendiente_borrar';
    rec.pagos[indexPago].creado_por = currentUser.user;
    await saveToFirebase(rec);
    toast('Solicitud de borrado enviada. Pendiente de aprobacion.','tok');
  }
  if(document.getElementById('ovPago').classList.contains('flex')) window.loadPaymentsList();
};

window.approvePago = async function(idFactura, indexPago) {
  const rec = data.find(r=>r.id===idFactura);
  if(!rec) return;
  const pago = rec.pagos[indexPago];
  if(pago.estado==='pendiente_borrar'){
    rec.pagos.splice(indexPago, 1);
    await saveToFirebase(rec);
    toast('Borrado de pago aprobado.','tok');
  } else {
    delete pago.estado;
    await saveToFirebase(rec);
    toast('Pago aprobado.','tok');
  }
  if(document.getElementById('ovPago').classList.contains('flex')) window.loadPaymentsList();
};

window.rejectPago = async function(idFactura, indexPago) {
  const rec = data.find(r=>r.id===idFactura);
  if(!rec) return;
  const pago = rec.pagos[indexPago];
  if(pago.estado==='pendiente_borrar'){
    delete pago.estado;
    await saveToFirebase(rec);
    toast('Solicitud de borrado rechazada.','tok');
  } else {
    rec.pagos.splice(indexPago, 1);
    await saveToFirebase(rec);
    toast('Pago rechazado y eliminado.','tok');
  }
  if(document.getElementById('ovPago').classList.contains('flex')) window.loadPaymentsList();
};

window.savePago = async function() {
  const targetId = document.getElementById('mpTarget').value;
  const fecha = document.getElementById('mpDate').value;
  const monto = parseFloat(document.getElementById('mpMonto').value)||0;
  const cuenta = document.getElementById('mpCuenta').value;
  const esquemaVal = document.getElementById('mpEsquema').value;
  const esquemaOtro = document.getElementById('mpEsquemaOtro').value.trim();
  const esquema = esquemaVal === 'Otros' ? (esquemaOtro || 'Otros') : esquemaVal;

  if(!targetId){toast('Selecciona una factura.','terr');return;}
  if(!fecha || monto<=0){toast('Ingresa la fecha y el monto del abono.','terr');return;}

  const rec=data.find(r=>r.id===targetId);
  if(rec){
    const maxP = rec.pagos.reduce((m,p)=>{const n=parseInt((p.id||'').replace('P',''))||0;return n>m?n:m;},0);
    const newPago = {id:'P'+String(maxP+1).padStart(3,'0'), fecha, monto, cuenta, esquema, obs:'', creado_por: currentUser.user};

    if(isAdmin()){
      rec.pagos.push(newPago);
      await saveToFirebase(rec);
      toast('Abono registrado.','tok');
    } else {
      // Operador: pago queda pendiente
      newPago.estado = 'pendiente';
      rec.pagos.push(newPago);
      await saveToFirebase(rec);
      toast('Abono enviado. Pendiente de aprobacion.','tok');
    }
    closeModals();
  }
};

// ══════════════════════════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════════════════════════

window.toast = function(msg,cls='tok'){
  const t=document.getElementById('toast');
  document.getElementById('tmsg').textContent=msg;
  t.className = `fixed bottom-6 right-6 px-4 py-3 rounded-lg text-sm flex items-center gap-3 z-[400] transition-all duration-300 shadow-xl border bg-slate-900 border-slate-700 ${cls==='tok'?'border-emerald-500/40 text-slate-200':'border-rose-500/40 text-rose-100'} translate-y-0 opacity-100`;
  const dot = t.querySelector('.tdot');
  dot.className = `tdot w-2 h-2 rounded-full shrink-0 ${cls==='tok'?'bg-[#34d399]':'bg-[#f87171]'}`;
  t.classList.remove('translate-y-8', 'opacity-0');
  setTimeout(()=>{t.classList.add('translate-y-8', 'opacity-0');}, 3500);
};

// ══════════════════════════════════════════════════════════════════════════
// RENDER ALL
// ══════════════════════════════════════════════════════════════════════════

function renderAll(){
  updateDate(); renderDashboard(); renderClients(); populateFilters(); window.renderTable(); updatePendingBadge();
  if(document.getElementById('ovPago').classList.contains('flex')) window.loadPaymentsList();
}

updateDate();
setInterval(updateDate,30000);

// Auto-login from session
setTimeout(checkSession, 500);
