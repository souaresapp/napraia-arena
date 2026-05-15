import { useState, useMemo } from "react";


// ─── SESSION (5 min timeout) ─────────────────────────────────────────────────
const SESSION_KEY = "napraia_user";
const SESSION_MS  = 5 * 60 * 1000;
function saveSession(u) { try { localStorage.setItem(SESSION_KEY, JSON.stringify({u, ts:Date.now()})); } catch(e){} }
function loadSession() { try { const r=localStorage.getItem(SESSION_KEY); if(!r) return null; const {u,ts}=JSON.parse(r); if(Date.now()-ts>SESSION_MS){localStorage.removeItem(SESSION_KEY);return null;} return u; } catch(e){return null;} }
function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch(e){} }

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COURTS = [
  { id: "sicoob",   name: "Quadra Sicoob",      color: "#00a86b" },
  { id: "tropical", name: "Quadra Tropical Net", color: "#f97316" },
];
const SPORTS     = ["Beach Tennis", "Futvolei", "Vôlei"];
const ALL_HOURS  = Array.from({ length: 17 }, (_, i) => `${String(i + 6).padStart(2, "0")}:00`); // 06:00–22:00
const DAYS_SHORT = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
const DAYS_FULL  = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
const MONTHS     = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

// Hours available for a given date string (Sex=5, Sáb=6 go until 22:00, others until 21:00)
function getHoursForDate(dateStr) {
  const dow = new Date(dateStr).getDay();
  const lastHour = (dow === 5 || dow === 6) ? "22:00" : "21:00";
  const idx = ALL_HOURS.indexOf(lastHour);
  return ALL_HOURS.slice(0, idx + 1);
}
// For seed/analytics where we need all possible hours
const HOURS = ALL_HOURS;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function fmt(d) { return d.toISOString().slice(0, 10); }
function getAge(birth) {
  const b = new Date(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--;
  return a;
}
function getWeekDates(offset = 0) {
  const today = new Date();
  const d = new Date(today);
  d.setDate(today.getDate() + offset * 7 - today.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d); x.setDate(d.getDate() + i); return x;
  });
}
function isRegularSlot(user, date, hour) {
  if (!user?.isRegular) return false;
  // Support new multi-slot format: regularSlots = [{dow, hour, duration}, ...]
  const slots = user.regularSlots || (
    user.regularDow !== "" && user.regularHour
      ? [{ dow: user.regularDow, hour: user.regularHour, duration: 1 }]
      : []
  );
  if (!slots.length) return false;
  const dow = new Date(date).getDay();
  return slots.some(s => {
    if (String(s.dow) !== String(dow)) return false;
    const startIdx = HOURS.indexOf(s.hour);
    if (startIdx === -1) return false;
    const hIdx = HOURS.indexOf(hour);
    return hIdx >= startIdx && hIdx < startIdx + (Number(s.duration) || 1);
  });
}
function sportIcon(s) { return s === "Beach Tennis" ? "🎾" : s === "Futvolei" ? "⚽" : "🏐"; }
function nameInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase() + ".";
  const first = parts[0][0].toUpperCase() + ".";
  const last  = parts[parts.length - 1];
  return `${first} ${last}`;
}

// ─── SEED DATA ────────────────────────────────────────────────────────────────
function seedBookings() {
  const prices = { common: 90, regular: 80 };
  const bk = {};
  const baseUsers = [
    { name:"Ana Silva",      gender:"F", birth:"1990-05-12", isRegular:true,  regularDow:2, regularHour:"09:00" },
    { name:"Carlos Souza",   gender:"M", birth:"1985-03-20", isRegular:false },
    { name:"Beatriz Lima",   gender:"F", birth:"1998-07-08", isRegular:true,  regularDow:4, regularHour:"10:00" },
    { name:"Rafael Costa",   gender:"M", birth:"2000-11-25", isRegular:false },
    { name:"Fernanda Rocha", gender:"F", birth:"1992-01-14", isRegular:true,  regularDow:6, regularHour:"08:00" },
    { name:"Marcos Alves",   gender:"M", birth:"1988-09-30", isRegular:false },
  ];
  const sports = ["Beach Tennis","Beach Tennis","Futvolei","Vôlei","Beach Tennis","Futvolei"];
  const now = new Date();
  let id = 1;
  for (let m = 3; m >= 0; m--) {
    for (let day = 1; day <= 28; day += 2 + Math.floor(Math.random() * 3)) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, day);
      if (d > now) continue;
      const dateStr = fmt(d);
      COURTS.forEach((c, ci) => {
        const hour = HOURS[Math.floor(Math.random() * HOURS.length)];
        const key  = `${c.id}-${dateStr}-${hour}`;
        if (!bk[key]) {
          const u   = baseUsers[(id + ci) % baseUsers.length];
          const reg = isRegularSlot(u, dateStr, hour);
          // ~10% admin-created bookings
          const byAdmin = Math.random() < 0.10;
          bk[key] = {
            id: String(id++), courtId: c.id, date: dateStr, hour,
            name: u.name, gender: u.gender, birth: u.birth,
            sport: sports[(id + ci) % sports.length],
            isRegular: !!u.isRegular, regularSlot: reg,
            byAdmin,
            paid: Math.random() > 0.35, paidLater: false,
            amount: reg ? prices.regular : prices.common,
          };
        }
      });
    }
  }
  return bk;
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App() {
  const [prices, setPrices]           = useState({ common: 90, regular: 80 });
  const [view, setView]               = useState("home");
  const [bookings, setBookings]       = useState(seedBookings);
  const [regUsers, setRegUsers]       = useState({});         // email → user profile
  const [weekOffset, setWeekOffset]   = useState(0);
  const [selDate, setSelDate]         = useState(fmt(new Date()));
  const [toast, setToast]             = useState(null);

  // ── Booking flow ──────────────────────────────────────────────────────────
  const [bookStep, setBookStep]       = useState(1);  // 1 auth | 2 slot | 3 sport | 4 pix
  const [me, setMe]                   = useState(()=>loadSession());
  const [selSlot, setSelSlot]         = useState(null);
  const [selSport, setSelSport]       = useState(null);
  const [isLogin, setIsLogin]         = useState(true);
  const [loginEmail, setLoginEmail]   = useState(()=>loadSession()?.email||"");
  const [regForm, setRegForm]         = useState({
    name:"", email:"", phone:"", birth:"", gender:"", city:"",
    isRegular:false, regularSlots:[],
  });

  // ── Admin ────────────────────────────────────────────────────────────────
  const [adminOk, setAdminOk]         = useState(false);
  const [adminPass, setAdminPass]     = useState("");
  const [adminTab, setAdminTab]       = useState("reservas");
  const [pEdit, setPEdit]             = useState({ common:90, regular:80 });

  // Admin email settings
  const [adminEmail, setAdminEmail]   = useState("gestor@napraia.com.br");
  const [partnerEmails, setPartnerEmails] = useState([]);
  const [newPartner, setNewPartner]   = useState("");
  const [editingAdminEmail, setEditingAdminEmail] = useState(false);
  const [adminEmailDraft, setAdminEmailDraft] = useState("");

  // Last login memory (simulated localStorage)
  const [lastLogin, setLastLogin]     = useState("gestor@napraia.com.br");

  // Payment edit modal
  const [editPayModal, setEditPayModal] = useState(null);
  const [analyticsPeriod, setAnalyticsPeriod] = useState("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd]     = useState("");
 // booking key
  const [reportGenerated, setReportGenerated] = useState(null);

  // Admin manual booking form
  const [manForm, setManForm] = useState({
    name:"", sport:"Beach Tennis", courtId:"sicoob", hour:"", paid:false,
  });
  const [manMsg, setManMsg] = useState("");

  const weekDates = getWeekDates(weekOffset);
  const today     = fmt(new Date());

  // ── Utils ────────────────────────────────────────────────────────────────
  function toast_(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }
  function isBooked(courtId, date, hour) { return bookings[`${courtId}-${date}-${hour}`]; }

  // ── Auth handlers ────────────────────────────────────────────────────────
  function doLogin() {
    if (!loginEmail.includes("@")) { toast_("Email inválido","error"); return; }
    const u = regUsers[loginEmail];
    if (!u) { toast_("Email não encontrado. Crie uma conta.","error"); return; }
    setMe(u); setBookStep(2);
  }
  function doRegister() {
    const { name,email,phone,birth,gender,city,isRegular,regularSlots } = regForm;
    if (!name||!email.includes("@")||!phone||!birth||!gender||!city) {
      toast_("Preencha todos os campos obrigatórios","error"); return;
    }
    if (isRegular && (!regularSlots.length || regularSlots.some(s=>!s.dow&&s.dow!==0||!s.hour))) {
      toast_("Adicione ao menos um dia/horário fixo para uso regular","error"); return;
    }
    const u = { ...regForm };
    setRegUsers(p => ({ ...p, [email]: u }));
    saveSession(u); setMe(u); setBookStep(2);
    toast_("Cadastro realizado!");
  }

  // ── Booking handlers ─────────────────────────────────────────────────────
  function pickSlot(courtId, date, hour) {
    if (isBooked(courtId,date,hour)) return;
    setSelSlot({ courtId,date,hour });
  }
  function confirmBooking() {
    if (!selSport) { toast_("Selecione o esporte","error"); return; }
    const { courtId,date,hour } = selSlot;
    const key = `${courtId}-${date}-${hour}`;
    const qualifies = me?.isRegular && isRegularSlot(me, date, hour);
    setBookings(b => ({ ...b, [key]: {
      id: Date.now().toString(), courtId, date, hour,
      name:me.name, email:me.email, phone:me.phone,
      birth:me.birth, gender:me.gender, city:me.city,
      sport:selSport, isRegular:!!me.isRegular, regularSlot:qualifies,
      byAdmin:false,
      paid:false, paidLater:false,
      amount: qualifies ? prices.regular : prices.common,
    }}));
    setBookStep(4);
  }
  function resetFlow() {
    setBookStep(1); setMe(null); setSelSlot(null); setSelSport(null);
    setLoginEmail(""); setIsLogin(true);
    setRegForm({ name:"",email:"",phone:"",birth:"",gender:"",city:"",isRegular:false,regularSlots:[] });
  }

  // ── Admin handlers ───────────────────────────────────────────────────────
  function doAdminLogin() {
    if (adminPass==="admin123") setAdminOk(true);
    else toast_("Senha incorreta","error");
  }
  function markPaid(key) {
    setBookings(b=>({...b,[key]:{...b[key],paid:true,paidLater:false}}));
    toast_("Marcado como pago!");
  }
  function markPaidLater(key) {
    setBookings(b=>({...b,[key]:{...b[key],paid:false,paidLater:true}}));
    toast_("Marcado como 'pago depois'");
  }
  function markNotPaid(key) {
    setBookings(b=>({...b,[key]:{...b[key],paid:false,paidLater:false}}));
    toast_("Marcado como não pago");
  }
  function setPaymentStatus(key, status) {
    // status: 'paid' | 'later' | 'unpaid' | 'error'
    const map = {
      paid:   { paid:true,  paidLater:false, payError:false },
      later:  { paid:false, paidLater:true,  payError:false },
      unpaid: { paid:false, paidLater:false, payError:false },
      error:  { paid:false, paidLater:false, payError:true  },
    };
    setBookings(b=>({...b,[key]:{...b[key],...map[status]}}));
    setEditPayModal(null);
    toast_("Status atualizado!");
  }
  function savePrices() {
    const c=Number(pEdit.common), r=Number(pEdit.regular);
    if (!c||!r||c<1||r<1) { toast_("Valores inválidos","error"); return; }
    setPrices({common:c,regular:r});
    toast_("Preços atualizados!");
  }

  // Admin manual booking
  function doAdminBook() {
    if (!manForm.name.trim()) { toast_("Informe o nome da pessoa","error"); return; }
    if (!manForm.hour)        { toast_("Selecione o horário","error"); return; }
    const key=`${manForm.courtId}-${selDate}-${manForm.hour}`;
    if (isBooked(manForm.courtId,selDate,manForm.hour)) {
      toast_("Este horário já está ocupado","error"); return;
    }
    setBookings(b=>({...b,[key]:{
      id:Date.now().toString(), courtId:manForm.courtId, date:selDate, hour:manForm.hour,
      name:manForm.name, gender:"-", birth:"", city:"",
      sport:manForm.sport, isRegular:false, regularSlot:false,
      byAdmin:true,
      paid:manForm.paid, paidLater:false,
      amount:prices.common,
    }}));
    setManMsg(`✅ Reserva criada para ${manForm.name} às ${manForm.hour}`);
    setManForm(f=>({...f,name:"",hour:"",paid:false}));
    toast_("Reserva manual criada!");
    setTimeout(()=>setManMsg(""),4000);
  }

  const court = selSlot ? COURTS.find(c=>c.id===selSlot.courtId) : null;
  const allBk = Object.values(bookings);

  // ── Analytics ─────────────────────────────────────────────────────────

  function getDateRange(period) {
    const now = new Date(); const t = fmt(now);
    switch(period) {
      case "30d": { const s=new Date(now); s.setDate(s.getDate()-30); return {start:fmt(s),end:t}; }
      case "month": return {start:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,end:t};
      case "year":  return {start:`${now.getFullYear()}-01-01`,end:t};
      case "lastyear": { const y=now.getFullYear()-1; return {start:`${y}-01-01`,end:`${y}-12-31`}; }
      case "custom": return {start:customStart||"2020-01-01",end:customEnd||t};
      default: return {start:"2020-01-01",end:t};
    }
  }

  const { start: pStart, end: pEnd } = getDateRange(analyticsPeriod);
  const filteredBk = allBk.filter(b => b.date >= pStart && b.date <= pEnd);
  const analytics = useMemo(() => {
    const byMonth={}, byGender={M:0,F:0}, byCourtTotal={}, bySportTotal={},
          byHour={}, byDow={}, ageArr={}, bySource={admin:0,online:0};
    filteredBk.forEach(b=>{
      const d=new Date(b.date);
      const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      const ml=`${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
      if(!byMonth[mk]) byMonth[mk]={label:ml,count:0,revenue:0,byAdmin:0};
      byMonth[mk].count++;
      if(b.byAdmin) byMonth[mk].byAdmin++;
      if(b.paid||b.paidLater) byMonth[mk].revenue+=b.amount;
      byGender[b.gender]=(byGender[b.gender]||0)+1;
      byCourtTotal[b.courtId]=(byCourtTotal[b.courtId]||0)+1;
      bySportTotal[b.sport]=(bySportTotal[b.sport]||0)+1;
      byHour[b.hour]=(byHour[b.hour]||0)+1;
      byDow[d.getDay()]=(byDow[d.getDay()]||0)+1;
      if(b.birth){if(!ageArr[mk])ageArr[mk]=[];ageArr[mk].push(getAge(b.birth));}
      if(b.byAdmin) bySource.admin++; else bySource.online++;
    });
    const avgAge={};
    Object.entries(ageArr).forEach(([mk,ages])=>{
      avgAge[mk]=Math.round(ages.reduce((a,b)=>a+b,0)/ages.length);
    });
    return {byMonth,byGender,byCourtTotal,bySportTotal,byHour,byDow,avgAge,bySource};
  },[filteredBk]);

  const sortedMo   = Object.keys(analytics.byMonth).sort();
  const totalRev   = Object.values(analytics.byMonth).reduce((s,m)=>s+m.revenue,0);
  const totalBk    = allBk.length;
  const maxHour    = Object.entries(analytics.byHour).sort((a,b)=>b[1]-a[1])[0];
  const minHour    = Object.entries(analytics.byHour).sort((a,b)=>a[1]-b[1])[0];

  // ── PDF Report ───────────────────────────────────────────────────────────
  function generatePDF() {
    const now = new Date();
    const ts  = now.toLocaleString("pt-BR");
    const bkList = Object.entries(bookings).sort((a,b)=>a[1].date.localeCompare(b[1].date));
    const totalPaid   = allBk.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
    const totalLater  = allBk.filter(b=>b.paidLater).reduce((s,b)=>s+b.amount,0);
    const totalUnpaid = allBk.filter(b=>!b.paid&&!b.paidLater).reduce((s,b)=>s+b.amount,0);

    const rows = bkList.map(([,b])=>{
      const c = COURTS.find(x=>x.id===b.courtId);
      const status = b.paid?"✓ Pago":b.paidLater?"⏳ Pago depois":b.payError?"❌ Erro":"⚠ Pendente";
      return `<tr style="border-bottom:1px solid #eee">
        <td style="padding:6px 10px">${b.date}</td>
        <td style="padding:6px 10px">${b.hour}</td>
        <td style="padding:6px 10px">${b.name}</td>
        <td style="padding:6px 10px">${c?.name||""}</td>
        <td style="padding:6px 10px">${b.sport}</td>
        <td style="padding:6px 10px;text-align:right">R$ ${b.amount},00</td>
        <td style="padding:6px 10px;color:${b.paid?"#16a34a":b.paidLater?"#2563eb":b.payError?"#dc2626":"#d97706"}">${status}</td>
        <td style="padding:6px 10px;font-size:11px">${b.byAdmin?"🛠 Gestor":"📱 Online"}</td>
      </tr>`;
    }).join("");

    const sportDist = SPORTS.map(s=>{
      const cnt = allBk.filter(b=>b.sport===s).length;
      const pct = totalBk>0?Math.round(cnt/totalBk*100):0;
      return `<tr><td style="padding:5px 10px">${s}</td><td style="padding:5px 10px;text-align:right">${cnt}</td><td style="padding:5px 10px;text-align:right">${pct}%</td></tr>`;
    }).join("");

    const courtDist = COURTS.map(c=>{
      const cnt = allBk.filter(b=>b.courtId===c.id).length;
      const rev = allBk.filter(b=>b.courtId===c.id&&(b.paid||b.paidLater)).reduce((s,b)=>s+b.amount,0);
      return `<tr><td style="padding:5px 10px">${c.name}</td><td style="padding:5px 10px;text-align:right">${cnt}</td><td style="padding:5px 10px;text-align:right">R$ ${rev.toLocaleString("pt-BR")}</td></tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
    <title>Relatório Na Praia — ${ts}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:32px}
      h1{color:#f97316;font-size:28px;margin-bottom:4px}
      h2{color:#1a1a1a;font-size:16px;margin:24px 0 10px;border-bottom:2px solid #f97316;padding-bottom:4px}
      .sub{color:#888;font-size:13px;margin-bottom:24px}
      .kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
      .kpi{background:#f9f9f9;border:1px solid #eee;border-radius:10px;padding:16px;text-align:center}
      .kpi .v{font-size:24px;font-weight:900;color:#f97316}
      .kpi .l{font-size:12px;color:#888;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      thead tr{background:#f97316;color:#fff}
      thead th{padding:8px 10px;text-align:left}
      tbody tr:nth-child(even){background:#fafafa}
      .section{margin-bottom:32px}
      .badge-paid{color:#16a34a;font-weight:700}
      .badge-later{color:#2563eb;font-weight:700}
      .badge-pend{color:#d97706;font-weight:700}
      .badge-err{color:#dc2626;font-weight:700}
      @media print{body{padding:16px}}
    </style></head><body>
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">
      <div><h1>📊 Relatório de Gestão</h1>
      <div class="sub">Na Praia — Arena Multi Esportiva · Dionísio - MG<br>Gerado em: ${ts}</div></div>
    </div>

    <h2>Resumo Financeiro</h2>
    <div class="kpi-grid">
      <div class="kpi"><div class="v">${totalBk}</div><div class="l">Total Reservas</div></div>
      <div class="kpi"><div class="v" style="color:#16a34a">R$ ${totalPaid.toLocaleString("pt-BR")}</div><div class="l">Recebido (pago)</div></div>
      <div class="kpi"><div class="v" style="color:#2563eb">R$ ${totalLater.toLocaleString("pt-BR")}</div><div class="l">A receber (pago depois)</div></div>
      <div class="kpi"><div class="v" style="color:#d97706">R$ ${totalUnpaid.toLocaleString("pt-BR")}</div><div class="l">Pendente</div></div>
    </div>

    <h2>Por Esporte</h2>
    <div class="section"><table>
      <thead><tr><th>Esporte</th><th style="text-align:right">Reservas</th><th style="text-align:right">%</th></tr></thead>
      <tbody>${sportDist}</tbody>
    </table></div>

    <h2>Por Quadra</h2>
    <div class="section"><table>
      <thead><tr><th>Quadra</th><th style="text-align:right">Reservas</th><th style="text-align:right">Faturamento</th></tr></thead>
      <tbody>${courtDist}</tbody>
    </table></div>

    <h2>Todas as Reservas — Controle de Pagamento</h2>
    <div class="section"><table>
      <thead><tr><th>Data</th><th>Horário</th><th>Nome</th><th>Quadra</th><th>Esporte</th><th style="text-align:right">Valor</th><th>Status</th><th>Origem</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>

    <div style="margin-top:40px;padding-top:16px;border-top:1px solid #eee;color:#aaa;font-size:11px;text-align:center">
      Relatório gerado pelo sistema Na Praia Arena · ${ts}
    </div>
    </body></html>`;

    const blob = new Blob([html], { type:"text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `napraia-relatorio-${fmt(now)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast_("Relatório gerado! Abra o arquivo e use Ctrl+P → Salvar como PDF");
    setReportGenerated(ts);
  }

  // ── Excel (CSV) ──────────────────────────────────────────────────────────
  function generateExcel() {
    const now  = new Date();
    const bkList = Object.entries(bookings).sort((a,b)=>a[1].date.localeCompare(b[1].date));
    const header = ["Data","Hora Ini","Hora Fin","Tempo Total","Quadra","Esporte","Nome","Pago (Sim/Não)","Valor Pago","Status","Tipo","Origem","Email","Telefone","Cidade"];
    const rows = bkList.map(([,b])=>{
      const court = COURTS.find(x=>x.id===b.courtId);
      const status = b.paid?"Pago":b.paidLater?"Pago depois":b.payError?"Erro":"Pendente";
      const paidYN = (b.paid||b.paidLater)?"Sim":"Não";
      const startIdx = ALL_HOURS.indexOf(b.hour);
      const endHour = startIdx>=0&&startIdx<ALL_HOURS.length-1?ALL_HOURS[startIdx+1]:b.hour;
      return [
        b.date, b.hour, endHour, "01:00",
        court?.name||"", b.sport, b.name||"",
        paidYN, b.amount||0, status,
        b.regularSlot?"Regular":"Avulso", b.byAdmin?"Gestor":"Online",
        b.email||"", b.phone||"", b.city||""
      ];
    });
    const csv = [header, ...rows]
      .map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(";"))
      .join("\n");
    const bom = "\uFEFF"; // UTF-8 BOM for Excel
    const blob = new Blob([bom+csv], { type:"text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `napraia-pagamentos-${fmt(now)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast_("Planilha Excel gerada com sucesso!");
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={S.app}>
      <style>{CSS}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.hInner}>
          <div style={S.logo} onClick={()=>{setView("home");resetFlow();}}>
            <img src="data:image/jpeg;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/Z"
              alt="Na Praia Logo"
              style={{height:52,width:"auto",objectFit:"contain"}}
              onError={e=>{e.target.style.display="none";}}
            />
          </div>
          <nav style={{...S.nav,flex:1,justifyContent:"center"}}>
            {[
              {id:"home",      l:"Início"},
              {id:"book",      l:"Reservar"},
              {id:"availability",l:"Disponibilidade"},
              {id:"minha",     l:"Minhas Reservas"},
            ].map(n=>(
              <button key={n.id}
                style={{...S.navBtn,...(view===n.id?S.navAct:{})}}
                onClick={()=>{
                  setView(n.id);
                  setSelDate(fmt(new Date()));
                  setWeekOffset(0);
                  if(n.id==="book") resetFlow();
                }}>
                {n.l}
              </button>
            ))}
          </nav>
          <button style={{...S.adminBadge,marginLeft:"auto"}} title="Área do Gestor" onClick={()=>setView("admin")}>⚙</button>
        </div>
      </header>

      {/* TOAST */}
      {toast&&(
        <div style={{...S.toast,
          background:toast.type==="error"?"#ef4444":toast.type==="info"?"#3b82f6":"#22c55e"}}>
          {toast.msg}
        </div>
      )}

      <main style={S.main}>

        {/* ══════ HOME ══════ */}
        {view==="home"&&(
          <div className="fi">
            <div style={S.hero}>
              <div style={S.heroTag}>Arena Multi Esportiva · Dionísio - MG</div>
              <h1 style={S.heroTitle}>Bem-vindo à<br/><span style={{color:"#f97316"}}>Na Praia</span></h1>
              <p style={S.heroDesc}>Reserve online, pague via Pix e jogue sem filas. Beach Tennis, Futvolei e Vôlei em Dionísio - MG.</p>
              <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                <button style={S.btnO} onClick={()=>setView("book")}>Reservar Agora</button>
                <button style={S.btnG} onClick={()=>setView("availability")}>Ver Disponibilidade</button>
              </div>
            </div>
            {/* Price banner */}
            <div style={S.priceBanner}>
              <div style={S.priceBannerItem}>
                <div style={{fontSize:20}}>💵</div>
                <div>
                  <div style={{fontWeight:800,color:"#fff",fontSize:16}}>R$ {prices.common},00/h</div>
                  <div style={{color:"#666",fontSize:12}}>Usuário avulso</div>
                </div>
              </div>
              <div style={{width:1,background:"#2a2a2a",alignSelf:"stretch"}}/>
              <div style={S.priceBannerItem}>
                <div style={{fontSize:20}}>⭐</div>
                <div>
                  <div style={{fontWeight:800,color:"#f97316",fontSize:16}}>R$ {prices.regular},00/h</div>
                  <div style={{color:"#666",fontSize:12}}>Usuário regular semanal</div>
                </div>
              </div>
            </div>
            <div style={S.homeCards}>
              {COURTS.map(c=>(
                <div key={c.id} style={{...S.courtCard,borderColor:c.color}}>
                  <div style={{width:10,height:10,borderRadius:"50%",background:c.color,marginBottom:10}}/>
                  <div style={{fontWeight:800,fontSize:17,color:"#fff",marginBottom:4}}>{c.name}</div>
                  <div style={{color:"#666",fontSize:13,marginBottom:14}}>Quadra de areia · Iluminação noturna</div>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {SPORTS.map(s=><span key={s} style={{...S.chip,background:c.color+"22",color:c.color}}>{s}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ══════ BOOK ══════ */}
        {view==="book"&&(
          <div className="fi">
            <h2 style={S.pageTitle}>Nova Reserva</h2>
            {/* Steps */}
            <div style={S.stepsBar}>
              {["Cadastro","Horário","Esporte","Pagamento"].map((s,i)=>(
                <div key={i} style={S.stepW}>
                  <div style={{...S.stepC,
                    background:bookStep>i+1?"#22c55e":bookStep===i+1?"#f97316":"#222",
                    color:bookStep>=i+1?"#fff":"#555"}}>
                    {bookStep>i+1?"✓":i+1}
                  </div>
                  <div style={{fontSize:10,color:bookStep===i+1?"#f97316":"#555",marginTop:3}}>{s}</div>
                </div>
              ))}
            </div>

            {/* STEP 1 — Auth */}
            {bookStep===1&&(
              <div style={{maxWidth:440}}>
                <div style={S.tabSwitch}>
                  <button style={{...S.tabBtn,...(isLogin?S.tabAct:{})}} onClick={()=>setIsLogin(true)}>Entrar</button>
                  <button style={{...S.tabBtn,...(!isLogin?S.tabAct:{})}} onClick={()=>setIsLogin(false)}>Criar Conta</button>
                </div>
                {isLogin?(
                  <div>
                    <F label="Email" type="email" v={loginEmail} set={e=>setLoginEmail(e.target.value)} ph="seu@email.com"/>
                    <button style={{...S.btnO,width:"100%",marginTop:8}} onClick={doLogin}>Entrar</button>
                    <p style={{color:"#555",fontSize:12,marginTop:10,textAlign:"center"}}>
                      Não tem conta? <span style={{color:"#f97316",cursor:"pointer"}} onClick={()=>setIsLogin(false)}>Cadastre-se</span>
                    </p>
                  </div>
                ):(
                  <div>
                    <F label="Nome completo *" v={regForm.name} set={e=>setRegForm(f=>({...f,name:e.target.value}))} ph="Nome completo"/>
                    <F label="Email *" type="email" v={regForm.email} set={e=>setRegForm(f=>({...f,email:e.target.value}))} ph="seu@email.com"/>
                    <F label="Telefone *" v={regForm.phone} set={e=>setRegForm(f=>({...f,phone:e.target.value}))} ph="(11) 99999-9999"/>
                    <F label="Data de nascimento *" type="date" v={regForm.birth} set={e=>setRegForm(f=>({...f,birth:e.target.value}))}/>
                    <div style={S.fg}>
                      <label style={S.lbl}>Sexo *</label>
                      <div style={{display:"flex",gap:8}}>
                        {[{v:"M",l:"Masculino"},{v:"F",l:"Feminino"}].map(({v,l})=>(
                          <button key={v}
                            style={{...S.gBtn,...(regForm.gender===v?{background:"#f97316",color:"#fff",borderColor:"#f97316"}:{})}}
                            onClick={()=>setRegForm(f=>({...f,gender:v}))}>{l}</button>
                        ))}
                      </div>
                    </div>
                    <F label="Cidade *" v={regForm.city} set={e=>setRegForm(f=>({...f,city:e.target.value}))} ph="Sua cidade"/>

                    {/* Regular toggle — multi-slot */}
                    <div style={{...S.regBox,borderColor:regForm.isRegular?"#f97316":"#2a2a2a"}}>
                      <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:regForm.isRegular?16:0}}>
                        <div style={{...S.toggle,background:regForm.isRegular?"#f97316":"#222"}}
                          onClick={()=>setRegForm(f=>({...f,isRegular:!f.isRegular}))}>
                          {regForm.isRegular&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
                        </div>
                        <div>
                          <div style={{fontWeight:700,color:"#fff",fontSize:14}}>Quero ser usuário regular ⭐</div>
                          <div style={{color:"#888",fontSize:12,marginTop:2}}>
                            Jogo toda semana em dias/horários fixos — R$ {prices.common - prices.regular} de desconto/hora
                          </div>
                        </div>
                      </div>
                      {regForm.isRegular&&(
                        <div>
                          {/* existing slots */}
                          {regForm.regularSlots.map((s,i)=>(
                            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr auto",gap:8,marginBottom:8,alignItems:"end"}}>
                              <div style={S.fg}>
                                {i===0&&<label style={S.lbl}>Dia da semana</label>}
                                <select style={{...S.inp,cursor:"pointer"}} value={s.dow}
                                  onChange={e=>setRegForm(f=>({...f,regularSlots:f.regularSlots.map((x,j)=>j===i?{...x,dow:e.target.value}:x)}))}>
                                  <option value="">Dia...</option>
                                  {DAYS_FULL.map((d,di)=><option key={di} value={di}>{d}</option>)}
                                </select>
                              </div>
                              <div style={S.fg}>
                                {i===0&&<label style={S.lbl}>Horário início</label>}
                                <select style={{...S.inp,cursor:"pointer"}} value={s.hour}
                                  onChange={e=>setRegForm(f=>({...f,regularSlots:f.regularSlots.map((x,j)=>j===i?{...x,hour:e.target.value}:x)}))}>
                                  <option value="">Hora...</option>
                                  {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
                                </select>
                              </div>
                              <div style={S.fg}>
                                {i===0&&<label style={S.lbl}>Duração</label>}
                                <select style={{...S.inp,cursor:"pointer"}} value={s.duration}
                                  onChange={e=>setRegForm(f=>({...f,regularSlots:f.regularSlots.map((x,j)=>j===i?{...x,duration:Number(e.target.value)}:x)}))}>
                                  {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}h</option>)}
                                </select>
                              </div>
                              <button style={{background:"#2a1010",border:"1px solid #6b2020",color:"#ef4444",borderRadius:8,padding:"8px 10px",cursor:"pointer",fontSize:14,height:42,alignSelf:"flex-end"}}
                                onClick={()=>setRegForm(f=>({...f,regularSlots:f.regularSlots.filter((_,j)=>j!==i)}))}>✕</button>
                            </div>
                          ))}
                          {/* add slot button */}
                          {regForm.regularSlots.length < 7 && (
                            <button style={{...S.btnG,fontSize:13,padding:"8px 14px",marginTop:4}}
                              onClick={()=>setRegForm(f=>({...f,regularSlots:[...f.regularSlots,{dow:"",hour:"",duration:1}]}))}>
                              + Adicionar dia
                            </button>
                          )}
                          {regForm.regularSlots.length===0&&(
                            <p style={{color:"#888",fontSize:12,marginTop:4}}>Clique em "+ Adicionar dia" para configurar seus horários fixos.</p>
                          )}
                        </div>
                      )}
                    </div>
                    <button style={{...S.btnO,width:"100%",marginTop:12}} onClick={doRegister}>Criar Conta</button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2 — Pick slot */}
            {bookStep===2&&(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
                  <span style={{color:"#ccc",fontSize:14}}>Olá, <strong style={{color:"#f97316"}}>{me?.name}</strong></span>
                  {me?.isRegular&&(
                    <span style={{...S.chip,background:"#2a1800",color:"#f97316"}}>
                      ⭐ {me.regularSlots?.length||0} horário(s) fixo(s) cadastrado(s)
                    </span>
                  )}
                </div>
                {me?.isRegular&&(
                  <div style={{...S.infoBox,marginBottom:14}}>
                    ⭐ Seus horários fixos aparecem destacados em verde-limão. Ao reservá-los, o valor será R$ {prices.regular},00. Para outros slots, R$ {prices.common},00.
                    {me.regularSlots?.length>0&&(
                      <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap"}}>
                        {me.regularSlots.map((s,i)=>(
                          <span key={i} style={{...S.chip,background:"#1a2800",color:"#a3e635"}}>
                            {DAYS_FULL[s.dow]} {s.hour} ({s.duration}h)
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <WeekNav wd={weekDates} sel={selDate} off={weekOffset} setOff={setWeekOffset} setSel={setSelDate} ac="#f97316"/>
                <AvGrid bookings={bookings} selDate={selDate} selSlot={selSlot} onPick={pickSlot} me={me} adminMode={false}/>
                {selSlot&&(()=>{
                  const q=me?.isRegular&&isRegularSlot(me,selSlot.date,selSlot.hour);
                  return (
                    <div style={{...S.slotBanner,borderColor:q?"#f97316":"#22c55e",background:q?"#2a1800":"#1a2e1a"}}>
                      ✅ <strong>{COURTS.find(c=>c.id===selSlot.courtId)?.name}</strong> · {selSlot.date} · {selSlot.hour}
                      <span style={{marginLeft:10,fontWeight:800,color:q?"#f97316":"#22c55e"}}>
                        R$ {q?prices.regular:prices.common},00{q?" (desconto regular ⭐)":""}
                      </span>
                    </div>
                  );
                })()}
                <div style={{display:"flex",gap:12,marginTop:16}}>
                  <button style={S.btnG} onClick={()=>setBookStep(1)}>← Voltar</button>
                  <button style={S.btnO} disabled={!selSlot} onClick={()=>setBookStep(3)}>Próximo →</button>
                </div>
              </div>
            )}

            {/* STEP 3 — Sport */}
            {bookStep===3&&(
              <div style={{maxWidth:440}}>
                <p style={{color:"#ccc",fontSize:14,marginBottom:14}}>
                  <strong style={{color:court?.color}}>{court?.name}</strong> · {selSlot?.date} · {selSlot?.hour}
                </p>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {SPORTS.map(s=>(
                    <button key={s}
                      style={{...S.sportBtn,...(selSport===s?{borderColor:"#f97316",background:"#2a1800",color:"#f97316"}:{})}}
                      onClick={()=>setSelSport(s)}>
                      <span style={{fontSize:22}}>{sportIcon(s)}</span>
                      <span style={{fontWeight:700}}>{s}</span>
                      {selSport===s&&<span style={{marginLeft:"auto"}}>✓</span>}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",gap:12,marginTop:22}}>
                  <button style={S.btnG} onClick={()=>setBookStep(2)}>← Voltar</button>
                  <button style={S.btnO} disabled={!selSport} onClick={confirmBooking}>Confirmar</button>
                </div>
              </div>
            )}

            {/* STEP 4 — Pix */}
            {bookStep===4&&(()=>{
              const q=me?.isRegular&&isRegularSlot(me,selSlot?.date,selSlot?.hour);
              const amt=q?prices.regular:prices.common;
              const bkC=COURTS.find(c=>c.id===selSlot?.courtId);
              return (
                <div style={{maxWidth:500}}>
                  <div style={S.confirmBox}>
                    <div style={{fontSize:42,marginBottom:10}}>🎉</div>
                    <h3 style={{fontWeight:900,fontSize:22,color:"#fff",marginBottom:16}}>Reserva Confirmada!</h3>
                    <div style={S.confDets}>
                      <div>🏟 <strong>{bkC?.name}</strong></div>
                      <div>📅 {selSlot?.date} · ⏰ {selSlot?.hour}</div>
                      <div>{sportIcon(selSport)} {selSport}</div>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontWeight:900,fontSize:20,color:"#f97316"}}>💰 R$ {amt},00</span>
                        {q&&<span style={{...S.chip,background:"#2a1800",color:"#f97316"}}>⭐ Desconto regular</span>}
                      </div>
                    </div>
                    {/* Pix block */}
                    <div style={{background:"#111",borderRadius:14,padding:20,textAlign:"center",marginTop:16}}>
                      <p style={{color:"#ccc",fontSize:14,fontWeight:700,marginBottom:4}}>Pagamento via Pix</p>
                      <p style={{color:"#555",fontSize:12,marginBottom:14}}>
                        {q
                          ? "Como usuário regular, você pode pagar antes ou após jogar — sem multa."
                          : "Realize o pagamento para garantir sua reserva."}
                      </p>
                      <PixQR/>
                      <p style={{color:"#555",fontSize:12,marginTop:12}}>
                        Envie o comprovante via WhatsApp após o pagamento.
                        {q&&<><br/><span style={{color:"#f97316"}}>⭐ Usuário regular pode pagar após o jogo também.</span></>}
                      </p>
                    </div>
                    <div style={{display:"flex",gap:10,marginTop:18,flexWrap:"wrap"}}>
                      <button style={S.btnO} onClick={resetFlow}>Nova Reserva</button>
                      <button style={S.btnG} onClick={()=>{setView("minha");resetFlow();}}>Minhas Reservas</button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════ AVAILABILITY ══════ */}
        {view==="availability"&&(
          <div className="fi">
            <h2 style={S.pageTitle}>Disponibilidade das Quadras</h2>
            <WeekNav wd={weekDates} sel={selDate} off={weekOffset} setOff={setWeekOffset} setSel={setSelDate} ac="#f97316"/>
            <AvGrid bookings={bookings} selDate={selDate} selSlot={null}
              onPick={(cId,date,hour)=>{
                if(isBooked(cId,date,hour)) return;
                setSelSlot({courtId:cId,date,hour});
                setView("book"); setBookStep(me?2:1);
              }}
              me={null} adminMode={false}/>
            <div style={S.legend}>
              <span style={{color:"#22c55e"}}>● Livre — clique para reservar</span>
              <span style={{color:"#ef4444"}}>● Ocupado</span>
            </div>
          </div>
        )}

        {/* ══════ MINHAS ══════ */}
        {view==="minha"&&(
          <div className="fi">
            <h2 style={S.pageTitle}>Minhas Reservas</h2>
            <div style={{maxWidth:400,marginBottom:22}}>
              <F label="Seu email" type="email" v={loginEmail} set={e=>setLoginEmail(e.target.value)} ph="seu@email.com"/>
            </div>
            {(()=>{
              if(!loginEmail.includes("@")) return null;
              const mine=Object.entries(bookings).filter(([,b])=>b.email===loginEmail);
              if(!mine.length) return <div style={S.infoBox}>Nenhuma reserva encontrada.</div>;
              return (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {mine.map(([key,b])=>{
                    const c=COURTS.find(x=>x.id===b.courtId);
                    return (
                      <div key={key} style={{...S.bookCard,borderColor:c?.color}}>
                        <div style={{color:c?.color,fontWeight:700,marginBottom:4}}>{c?.name}</div>
                        <div style={{color:"#ccc",fontSize:14}}>📅 {b.date} · ⏰ {b.hour}</div>
                        <div style={{color:"#888",fontSize:13,marginTop:2}}>{sportIcon(b.sport)} {b.sport}</div>
                        <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap"}}>
                          <span style={{...S.chip,
                            background:b.paid?"#14532d":b.paidLater?"#1e3a5f":"#450a0a",
                            color:b.paid?"#22c55e":b.paidLater?"#60a5fa":"#ef4444"}}>
                            {b.paid?"✓ Pago":b.paidLater?"⏳ Pago depois":"⚠ Pendente"}
                          </span>
                          {b.regularSlot&&<span style={{...S.chip,background:"#2a1800",color:"#f97316"}}>⭐ R${b.amount}</span>}
                          {!b.regularSlot&&<span style={{...S.chip,background:"#1a1a1a",color:"#666"}}>R${b.amount}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ══════ ADMIN ══════ */}
        {view==="admin"&&(
          <div className="fi">
            {!adminOk?(
              <div style={{maxWidth:340}}>
                <h2 style={S.pageTitle}>🔐 Área do Gestor</h2>
                {lastLogin&&(
                  <div style={{...S.infoBox,marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:18}}>👤</span>
                    <div>
                      <div style={{color:"#888",fontSize:11}}>Último acesso</div>
                      <div style={{color:"#f97316",fontWeight:700,fontSize:14}}>{lastLogin}</div>
                    </div>
                  </div>
                )}
                <PwdInput label="Senha" v={adminPass} set={e=>setAdminPass(e.target.value)} ph="Senha de acesso"/>
                <button style={{...S.btnO,width:"100%",marginTop:8}} onClick={()=>{
                  if (adminPass==="admin123") { setAdminOk(true); setLastLogin(adminEmail); }
                  else toast_("Senha incorreta","error");
                }}>Entrar como Gestor</button>
                <p style={{color:"#333",fontSize:11,marginTop:8}}>Demo: <code style={{color:"#f97316"}}>admin123</code></p>
              </div>
            ):(
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
                  <h2 style={S.pageTitle}>Painel do Gestor</h2>
                  <button style={{...S.btnG,fontSize:12,padding:"7px 14px"}} onClick={()=>{setAdminOk(false);setView("home");}}>Sair</button>
                </div>

                <div style={S.adminTabs}>
                  {[{id:"reservas",l:"📋 Reservas"},{id:"manual",l:"✍️ Reserva Manual"},{id:"precos",l:"💰 Preços"},{id:"gestao",l:"📊 Gestão"},{id:"heatmap",l:"🔥 Horários"},{id:"relatorios",l:"📄 Relatórios"},{id:"config",l:"⚙️ Config"}].map(t=>(
                    <button key={t.id}
                      style={{...S.adminTabBtn,...(adminTab===t.id?S.adminTabAct:{})}}
                      onClick={()=>setAdminTab(t.id)}>{t.l}</button>
                  ))}
                </div>

                {/* ─── TAB RESERVAS ─── */}
                {adminTab==="reservas"&&(
                  <div>
                    <WeekNav wd={weekDates} sel={selDate} off={weekOffset} setOff={setWeekOffset} setSel={setSelDate} ac="#a855f7"/>
                    <AvGrid bookings={bookings} selDate={selDate} selSlot={null}
                      onPick={()=>{}} me={null} adminMode={true}
                      onMarkPaid={markPaid} onMarkLater={markPaidLater}/>
                    <div style={{...S.legend,marginTop:8}}>
                      <span style={{color:"#22c55e"}}>■ Pago</span>
                      <span style={{color:"#3b82f6"}}>■ Pago depois</span>
                      <span style={{color:"#ef4444"}}>■ Não pago</span>
                      <span style={{color:"#f97316"}}>⭐ Regular</span>
                      <span style={{color:"#a855f7"}}>🛠 Admin</span>
                    </div>
                  </div>
                )}

                {/* ─── TAB RESERVA MANUAL ─── */}
                {adminTab==="manual"&&(
                  <div style={{maxWidth:520}}>
                    <Section title="✍️ Reservar em nome de alguém">
                      <div style={{...S.infoBox,marginBottom:20}}>
                        Use para registrar reservas feitas verbalmente ou por telefone. A reserva aparecerá marcada como <span style={{color:"#a855f7"}}>🛠 Reserva pelo Gestor</span> nos relatórios.
                      </div>

                      <WeekNav wd={weekDates} sel={selDate} off={weekOffset} setOff={setWeekOffset} setSel={setSelDate} ac="#a855f7"/>

                      <F label="Nome da pessoa *" v={manForm.name} set={e=>setManForm(f=>({...f,name:e.target.value}))} ph="Nome completo"/>

                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                        <div style={S.fg}>
                          <label style={S.lbl}>Quadra</label>
                          <select style={{...S.inp,cursor:"pointer"}} value={manForm.courtId}
                            onChange={e=>setManForm(f=>({...f,courtId:e.target.value}))}>
                            {COURTS.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div style={S.fg}>
                          <label style={S.lbl}>Horário</label>
                          <select style={{...S.inp,cursor:"pointer"}} value={manForm.hour}
                            onChange={e=>setManForm(f=>({...f,hour:e.target.value}))}>
                            <option value="">Selecione...</option>
                            {getHoursForDate(selDate).filter(h=>!isBooked(manForm.courtId,selDate,h)).map(h=><option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={S.fg}>
                        <label style={S.lbl}>Esporte</label>
                        <select style={{...S.inp,cursor:"pointer"}} value={manForm.sport}
                          onChange={e=>setManForm(f=>({...f,sport:e.target.value}))}>
                          {SPORTS.map(s=><option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div style={{...S.regBox,borderColor:manForm.paid?"#22c55e":"#2a2a2a",marginBottom:16}}>
                        <div style={{display:"flex",gap:12,alignItems:"center"}}>
                          <div style={{...S.toggle,background:manForm.paid?"#22c55e":"#222"}}
                            onClick={()=>setManForm(f=>({...f,paid:!f.paid}))}>
                            {manForm.paid&&<span style={{color:"#fff",fontSize:11,fontWeight:700}}>✓</span>}
                          </div>
                          <div>
                            <div style={{fontWeight:700,color:"#fff",fontSize:14}}>Já pagou</div>
                            <div style={{color:"#888",fontSize:12}}>Marque se o pagamento já foi realizado</div>
                          </div>
                        </div>
                      </div>

                      <div style={S.fg}>
                        <label style={S.lbl}>Data selecionada</label>
                        <div style={{...S.inp,color:"#f97316",fontWeight:700,cursor:"default"}}>{selDate}</div>
                      </div>

                      <button style={{...S.btnO,width:"100%"}} onClick={doAdminBook}>
                        🛠 Criar Reserva Manual
                      </button>
                      {manMsg&&(
                        <div style={{...S.infoBox,marginTop:12,color:"#22c55e",borderColor:"#22c55e"}}>
                          {manMsg}
                        </div>
                      )}

                      {/* Show occupied slots for chosen court/date */}
                      <div style={{marginTop:24}}>
                        <p style={{color:"#666",fontSize:13,marginBottom:10}}>
                          Horários já ocupados em {selDate} — {COURTS.find(c=>c.id===manForm.courtId)?.name}:
                        </p>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {getHoursForDate(selDate).map(h=>{
                            const b=isBooked(manForm.courtId,selDate,h);
                            return (
                              <span key={h} style={{...S.chip,
                                background:b?"#2a1010":"#141414",
                                color:b?"#ef4444":"#2a2a2a",
                                border:`1px solid ${b?"#6b2020":"#222"}`}}>
                                {h} {b?`(${b.name?.split(" ")[0]})`:""}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </Section>
                  </div>
                )}

                {/* ─── TAB PREÇOS ─── */}
                {adminTab==="precos"&&(
                  <div style={{maxWidth:500}}>
                    <Section title="💰 Valores cobrados por hora">
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:16,marginBottom:16}}>
                        {[
                          {key:"common",  label:"Usuário Avulso",  icon:"📲", color:"#fff"},
                          {key:"regular", label:"Usuário Regular", icon:"⭐", color:"#f97316"},
                        ].map(({key,label,icon,color})=>(
                          <div key={key} style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:14,padding:20}}>
                            <div style={{fontSize:22,marginBottom:8}}>{icon}</div>
                            <div style={{fontWeight:700,color,marginBottom:4}}>{label}</div>
                            <div style={{color:"#888",fontSize:12,marginBottom:14}}>
                              {key==="common"?"Reservas sem vínculo regular":"Reservas no dia/hora fixo cadastrado"}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{color:"#888",fontSize:16,fontWeight:700}}>R$</span>
                              <input type="number" min="1"
                                style={{...S.inp,width:80,fontSize:20,fontWeight:900,textAlign:"center",color}}
                                value={pEdit[key]}
                                onChange={e=>setPEdit(p=>({...p,[key]:e.target.value}))}/>
                              <span style={{color:"#555",fontSize:13}}>/hora</span>
                            </div>
                            <div style={{color:"#444",fontSize:11,marginTop:8}}>Atual: R$ {prices[key]},00</div>
                          </div>
                        ))}
                      </div>
                      <div style={S.infoBox}>
                        💡 O desconto de regular é aplicado automaticamente quando o usuário reserva exatamente no dia da semana e horário que escolheu no cadastro.
                      </div>
                      <button style={{...S.btnO,marginTop:16}} onClick={savePrices}>Salvar Preços</button>
                    </Section>
                  </div>
                )}

                {/* ─── TAB GESTÃO ─── */}
                {adminTab==="gestao"&&(
                  <div>
                    <PeriodSelector period={analyticsPeriod} setPeriod={setAnalyticsPeriod} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}/>
                    {(()=>{
                      const concl=filteredBk.filter(b=>b.date<fmt(new Date())).length;
                      const rec=filteredBk.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0);
                      const arec=filteredBk.filter(b=>!b.paid).reduce((s,b)=>s+b.amount,0);
                      const tCourt=Object.entries(analytics.byCourtTotal).sort((a,b)=>b[1]-a[1])[0];
                      const tSport=Object.entries(analytics.bySportTotal).sort((a,b)=>b[1]-a[1])[0];
                      return <div style={S.kpiGrid}>
                        <KPI icon="📋" label="Reservas" v={filteredBk.length}/>
                        <KPI icon="✅" label="Concluídos" v={concl}/>
                        <KPI icon="💰" label="Faturamento" v={`R$${(rec+arec).toLocaleString("pt-BR")}`}/>
                        <KPI icon="💚" label="Recebido" v={`R$${rec.toLocaleString("pt-BR")}`}/>
                        <KPI icon="⏳" label="A Receber" v={`R$${arec.toLocaleString("pt-BR")}`}/>
                        <KPI icon="🏆" label="Quadra +" v={tCourt?.[0]==="sicoob"?"Sicoob":"Trop. Net"}/>
                        <KPI icon="🎾" label="Esporte +" v={tSport?.[0]||"-"}/>
                        <KPI icon="🛠" label="Gestor" v={analytics.bySource.admin}/>
                        <KPI icon="📱" label="Online" v={analytics.bySource.online}/>
                      </div>;
                    })()}

                    <Section title="📈 Faturamento por Mês">
                      <Bar data={sortedMo.map(mk=>({label:analytics.byMonth[mk].label.slice(0,6),value:analytics.byMonth[mk].revenue}))} color="#f97316" unit="R$"/>
                    </Section>

                    <Section title="📊 Reservas por Mês (online vs gestor)">
                      <div style={{overflowX:"auto",display:"flex",gap:4,alignItems:"flex-end",height:130,paddingBottom:24}}>
                        {sortedMo.map(mk=>{
                          const m=analytics.byMonth[mk];
                          const mxAll=Math.max(...sortedMo.map(k=>analytics.byMonth[k].count),1);
                          return (
                            <div key={mk} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:"0 0 auto",minWidth:48}}>
                              <div style={{fontSize:9,color:"#888",marginBottom:2}}>{m.count}</div>
                              <div style={{width:32,display:"flex",flexDirection:"column",justifyContent:"flex-end",height:80}}>
                                <div style={{background:"#a855f7",borderRadius:"2px 2px 0 0",height:Math.max(m.byAdmin/Math.max(m.count,1)*m.count/mxAll*80,m.byAdmin>0?3:0)}}/>
                                <div style={{background:"#60a5fa",height:Math.max((m.count-m.byAdmin)/mxAll*80,(m.count-m.byAdmin)>0?3:0)}}/>
                              </div>
                              <div style={{fontSize:9,color:"#555",marginTop:3,transform:"rotate(-30deg)",whiteSpace:"nowrap"}}>{m.label.slice(0,6)}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{...S.legend,marginTop:4}}>
                        <span style={{color:"#60a5fa"}}>■ Online</span>
                        <span style={{color:"#a855f7"}}>■ Via Gestor</span>
                      </div>
                    </Section>

                    <Section title="🎾 Distribuição por Esporte">
                      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                        {SPORTS.map(s=>{
                          const cnt=analytics.bySportTotal[s]||0;
                          const pct=totalBk>0?Math.round(cnt/totalBk*100):0;
                          return (
                            <div key={s} style={S.pieCard}>
                              <div style={{fontSize:24}}>{sportIcon(s)}</div>
                              <div style={{fontWeight:900,fontSize:26,color:"#fff"}}>{pct}%</div>
                              <div style={{color:"#888",fontSize:12}}>{s}</div>
                              <div style={{color:"#555",fontSize:11,marginBottom:8}}>{cnt} reservas</div>
                              <div style={{background:"#1a1a1a",borderRadius:4,height:4,overflow:"hidden"}}>
                                <div style={{height:"100%",background:"#f97316",width:`${pct}%`}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>

                    <Section title="👥 Gênero dos Praticantes">
                      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                        {[{g:"F",l:"Feminino",col:"#ec4899"},{g:"M",l:"Masculino",col:"#3b82f6"}].map(({g,l,col})=>{
                          const cnt=analytics.byGender[g]||0;
                          const pct=totalBk>0?Math.round(cnt/totalBk*100):0;
                          return (
                            <div key={g} style={{...S.pieCard,flex:1,minWidth:120}}>
                              <div style={{fontSize:24}}>{g==="F"?"👩":"👨"}</div>
                              <div style={{fontWeight:900,fontSize:26,color:col}}>{pct}%</div>
                              <div style={{color:"#888",fontSize:12}}>{l}</div>
                              <div style={{color:"#555",fontSize:11,marginBottom:8}}>{cnt} reservas</div>
                              <div style={{background:"#1a1a1a",borderRadius:4,height:4,overflow:"hidden"}}>
                                <div style={{height:"100%",background:col,width:`${pct}%`}}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>

                    <Section title="📅 Idade Média por Mês">
                      <Bar data={sortedMo.filter(mk=>analytics.avgAge[mk]).map(mk=>({label:analytics.byMonth[mk]?.label.slice(0,6),value:analytics.avgAge[mk]}))} color="#a855f7" unit=""/>
                    </Section>

                    <Section title="🏟 Desempenho por Quadra">
                      <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
                        {COURTS.map(c=>{
                          const cnt=analytics.byCourtTotal[c.id]||0;
                          const rev=Object.values(bookings).filter(b=>b.courtId===c.id&&(b.paid||b.paidLater)).reduce((s,b)=>s+b.amount,0);
                          return (
                            <div key={c.id} style={{...S.pieCard,flex:1,minWidth:160,borderColor:c.color}}>
                              <div style={{color:c.color,fontWeight:800,marginBottom:6}}>{c.name}</div>
                              <div style={{fontWeight:900,fontSize:28,color:"#fff"}}>{cnt}</div>
                              <div style={{color:"#888",fontSize:12}}>reservas</div>
                              <div style={{color:"#22c55e",fontWeight:800,fontSize:16,marginTop:6}}>R$ {rev.toLocaleString("pt-BR")}</div>
                            </div>
                          );
                        })}
                      </div>
                    </Section>
                  </div>
                )}

                {/* ─── TAB HEATMAP ─── */}
                {adminTab==="heatmap"&&(
                  <div>
                    <PeriodSelector period={analyticsPeriod} setPeriod={setAnalyticsPeriod} customStart={customStart} setCustomStart={setCustomStart} customEnd={customEnd} setCustomEnd={setCustomEnd}/>
                    <Section title="🔥 Mapa de Calor — Dia × Horário">
                      <p style={{color:"#555",fontSize:13,marginBottom:14}}>Número de reservas por combinação de dia e horário. Mais intenso = mais reservas.</p>
                      <div style={{overflowX:"auto"}}>
                        <table style={{borderCollapse:"separate",borderSpacing:3}}>
                          <thead>
                            <tr>
                              <th style={{padding:"4px 8px",color:"#444",fontSize:11,textAlign:"left",fontWeight:400}}></th>
                              {DAYS_SHORT.map(d=><th key={d} style={{padding:"4px 8px",color:"#888",fontSize:12,fontWeight:700,textAlign:"center"}}>{d}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {HOURS.map(h=>{
                              const row=Array.from({length:7},(_,dow)=>allBk.filter(b=>new Date(b.date).getDay()===dow&&b.hour===h).length);
                              const mx=Math.max(...row,1);
                              return (
                                <tr key={h}>
                                  <td style={{padding:"2px 8px",color:"#555",fontSize:11,whiteSpace:"nowrap"}}>{h}</td>
                                  {row.map((cnt,dow)=>(
                                    <td key={dow}>
                                      <div style={{width:42,height:32,background:cnt===0?"#111":`rgba(249,115,22,${0.08+cnt/mx*0.92})`,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:cnt>0?"#fff":"#2a2a2a",fontWeight:700}}>
                                        {cnt||"·"}
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Section>

                    <Section title="📊 Horários mais e menos populares">
                      <div style={{display:"flex",gap:12,marginBottom:20,flexWrap:"wrap"}}>
                        {maxHour&&<div style={{...S.insCard,borderColor:"#22c55e",flex:1,minWidth:140}}>
                          <div style={{color:"#22c55e",fontWeight:700,marginBottom:4}}>🔝 Mais alugado</div>
                          <div style={{fontWeight:900,fontSize:26,color:"#fff"}}>{maxHour[0]}</div>
                          <div style={{color:"#888",fontSize:13}}>{maxHour[1]} reservas</div>
                        </div>}
                        {minHour&&<div style={{...S.insCard,borderColor:"#ef4444",flex:1,minWidth:140}}>
                          <div style={{color:"#ef4444",fontWeight:700,marginBottom:4}}>🔻 Menos alugado</div>
                          <div style={{fontWeight:900,fontSize:26,color:"#fff"}}>{minHour[0]}</div>
                          <div style={{color:"#888",fontSize:13}}>{minHour[1]} reservas</div>
                        </div>}
                      </div>
                      <Bar data={HOURS.map(h=>({label:h,value:analytics.byHour[h]||0}))} color="#f97316" unit=""/>
                    </Section>

                    <Section title="📆 Dias da semana">
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
                        {DAYS_SHORT.map((d,i)=>{
                          const cnt=analytics.byDow[i]||0;
                          const mx=Math.max(...Object.values(analytics.byDow),1);
                          return (
                            <div key={d} style={{...S.insCard,flex:1,minWidth:60,textAlign:"center",borderColor:`rgba(249,115,22,${cnt/mx+0.1})`}}>
                              <div style={{color:"#888",fontSize:11}}>{d}</div>
                              <div style={{fontWeight:900,fontSize:22,color:"#fff"}}>{cnt}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div style={S.infoBox}>
                        💡 <strong>Estratégia:</strong> Crie promoções nos horários e dias com menor movimento para aumentar a ocupação total da arena.
                      </div>
                    </Section>
                  </div>
                )}

                {/* ─── TAB RELATÓRIOS ─── */}
                {adminTab==="relatorios"&&(
                  <div style={{maxWidth:600}}>
                    <Section title="📄 Gerar Relatórios">
                      <div style={{...S.infoBox,marginBottom:20}}>
                        Os relatórios refletem o estado atual do sistema até este exato momento: <strong style={{color:"#f97316"}}>{new Date().toLocaleString("pt-BR")}</strong>
                      </div>

                      {/* Summary cards */}
                      <div style={S.kpiGrid}>
                        <KPI icon="📋" label="Total Reservas" v={totalBk}/>
                        <KPI icon="✅" label="Pagas" v={allBk.filter(b=>b.paid).length}/>
                        <KPI icon="⏳" label="Pago depois" v={allBk.filter(b=>b.paidLater).length}/>
                        <KPI icon="⚠️" label="Pendentes" v={allBk.filter(b=>!b.paid&&!b.paidLater&&!b.payError).length}/>
                        <KPI icon="❌" label="Erro pag." v={allBk.filter(b=>b.payError).length}/>
                        <KPI icon="💰" label="Recebido" v={`R$${allBk.filter(b=>b.paid).reduce((s,b)=>s+b.amount,0).toLocaleString("pt-BR")}`}/>
                      </div>

                      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:24}}>
                        {/* PDF */}
                        <div style={{...S.reportCard,borderColor:"#ef4444"}}>
                          <div style={{fontSize:36,marginBottom:10}}>📄</div>
                          <div style={{fontWeight:800,color:"#fff",fontSize:16,marginBottom:6}}>Relatório de Gestão</div>
                          <div style={{color:"#888",fontSize:13,marginBottom:16,lineHeight:1.5}}>
                            Relatório completo com KPIs, distribuição por esporte e quadra, e tabela detalhada de todos os agendamentos com status de pagamento.
                          </div>
                          <div style={{...S.chip,background:"#2a1010",color:"#ef4444",marginBottom:12,display:"inline-block"}}>
                            Formato HTML → abra e salve como PDF (Ctrl+P)
                          </div>
                          <button style={{...S.btnO,width:"100%"}} onClick={generatePDF}>
                            📥 Baixar Relatório PDF
                          </button>
                        </div>

                        {/* Excel */}
                        <div style={{...S.reportCard,borderColor:"#22c55e"}}>
                          <div style={{fontSize:36,marginBottom:10}}>📊</div>
                          <div style={{fontWeight:800,color:"#fff",fontSize:16,marginBottom:6}}>Planilha de Pagamentos</div>
                          <div style={{color:"#888",fontSize:13,marginBottom:16,lineHeight:1.5}}>
                            Planilha com data, horário, nome, quadra, esporte, valor e status de pagamento. Compatível com Excel e Google Sheets.
                          </div>
                          <div style={{...S.chip,background:"#132a1a",color:"#22c55e",marginBottom:12,display:"inline-block"}}>
                            Formato CSV — abre diretamente no Excel
                          </div>
                          <button style={{...S.btnO,width:"100%",background:"#16a34a"}} onClick={generateExcel}>
                            📥 Baixar Planilha Excel
                          </button>
                        </div>
                      </div>

                      {reportGenerated&&(
                        <div style={{...S.infoBox,borderColor:"#22c55e",color:"#22c55e"}}>
                          ✅ Último relatório gerado em: <strong>{reportGenerated}</strong>
                        </div>
                      )}
                    </Section>

                    <Section title="✏️ Editar Status de Pagamento">
                      <p style={{color:"#888",fontSize:13,marginBottom:14}}>
                        Clique no status de qualquer reserva para editar. Útil para corrigir erros ou registrar pagamentos manuais.
                      </p>
                      <div style={{maxHeight:400,overflowY:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                          <thead>
                            <tr style={{background:"#1a1a1a"}}>
                              {["Data","Horário","Nome","Valor","Status","Ação"].map(h=>(
                                <th key={h} style={{padding:"8px 10px",textAlign:"left",color:"#888",fontWeight:600,borderBottom:"1px solid #2a2a2a"}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(bookings).sort((a,b)=>a[1].date.localeCompare(b[1].date)).map(([key,b])=>{
                              const status = b.paid?"✅ Pago":b.paidLater?"⏳ Pago depois":b.payError?"❌ Erro":"⚠️ Pendente";
                              const statusColor = b.paid?"#22c55e":b.paidLater?"#60a5fa":b.payError?"#ef4444":"#f59e0b";
                              return (
                                <tr key={key} style={{borderBottom:"1px solid #1a1a1a"}}>
                                  <td style={{padding:"7px 10px",color:"#ccc"}}>{b.date}</td>
                                  <td style={{padding:"7px 10px",color:"#ccc"}}>{b.hour}</td>
                                  <td style={{padding:"7px 10px",color:"#fff",fontWeight:600}}>{b.name}</td>
                                  <td style={{padding:"7px 10px",color:"#f97316"}}>R$ {b.amount}</td>
                                  <td style={{padding:"7px 10px",color:statusColor,fontWeight:600}}>{status}</td>
                                  <td style={{padding:"7px 10px"}}>
                                    <button style={{...S.aBlue,fontSize:11}} onClick={()=>setEditPayModal(key)}>✏️ Editar</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Section>
                  </div>
                )}

                {/* ─── TAB CONFIG ─── */}
                {adminTab==="config"&&(
                  <div style={{maxWidth:500}}>
                    <Section title="📧 E-mail do Administrador">
                      <div style={{...S.infoBox,marginBottom:16}}>
                        Este e-mail receberá os relatórios e é o identificador do gestor no sistema.
                      </div>
                      {editingAdminEmail?(
                        <div>
                          <F label="Novo e-mail do administrador" type="email" v={adminEmailDraft} set={e=>setAdminEmailDraft(e.target.value)} ph="admin@napraia.com.br"/>
                          <div style={{display:"flex",gap:8,marginTop:4}}>
                            <button style={{...S.btnO,fontSize:13,padding:"9px 16px"}} onClick={()=>{
                              if(!adminEmailDraft.includes("@")){toast_("Email inválido","error");return;}
                              setAdminEmail(adminEmailDraft); setEditingAdminEmail(false); setAdminEmailDraft(""); toast_("E-mail atualizado!");
                            }}>Salvar</button>
                            <button style={{...S.btnG,fontSize:13,padding:"9px 16px"}} onClick={()=>setEditingAdminEmail(false)}>Cancelar</button>
                          </div>
                        </div>
                      ):(
                        <div style={{display:"flex",alignItems:"center",gap:12,background:"#1a1a1a",borderRadius:10,padding:"14px 16px"}}>
                          <span style={{fontSize:20}}>📧</span>
                          <span style={{color:"#f97316",fontWeight:700,flex:1}}>{adminEmail}</span>
                          <button style={{...S.aBlue,fontSize:12}} onClick={()=>{setAdminEmailDraft(adminEmail);setEditingAdminEmail(true);}}>✏️ Editar</button>
                        </div>
                      )}
                    </Section>

                    <Section title="👥 E-mails de Sócios / Co-gestores">
                      <div style={{...S.infoBox,marginBottom:16}}>
                        Estes e-mails também receberão os relatórios gerados. Apenas para referência — o envio automático estará disponível em breve.
                      </div>
                      {partnerEmails.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:14}}>
                          {partnerEmails.map((em,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:"#1a1a1a",borderRadius:8,padding:"10px 14px"}}>
                              <span style={{fontSize:16}}>👤</span>
                              <span style={{color:"#ccc",flex:1,fontSize:14}}>{em}</span>
                              <button style={{background:"#2a1010",border:"none",color:"#ef4444",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}
                                onClick={()=>setPartnerEmails(p=>p.filter((_,j)=>j!==i))}>✕ Remover</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{display:"flex",gap:8}}>
                        <input style={{...S.inp,flex:1}} type="email" placeholder="socio@email.com" value={newPartner}
                          onChange={e=>setNewPartner(e.target.value)}/>
                        <button style={{...S.btnO,padding:"11px 16px",fontSize:13,flexShrink:0}} onClick={()=>{
                          if(!newPartner.includes("@")){toast_("Email inválido","error");return;}
                          if(partnerEmails.includes(newPartner)){toast_("Email já adicionado","error");return;}
                          setPartnerEmails(p=>[...p,newPartner]); setNewPartner(""); toast_("Sócio adicionado!");
                        }}>+ Adicionar</button>
                      </div>
                    </Section>

                    <Section title="🔒 Segurança">
                      <div style={S.infoBox}>
                        Para alterar a senha de acesso ao painel do gestor, entre em contato com o suporte técnico do sistema.
                      </div>
                    </Section>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PAYMENT EDIT MODAL ── */}
        {editPayModal&&(()=>{
          const b=bookings[editPayModal];
          if(!b) return null;
          const c=COURTS.find(x=>x.id===b.courtId);
          return (
            <div style={S.modalOverlay} onClick={()=>setEditPayModal(null)}>
              <div style={S.modalBox} onClick={e=>e.stopPropagation()}>
                <div style={{fontWeight:900,fontSize:18,color:"#fff",marginBottom:4}}>✏️ Editar Status de Pagamento</div>
                <div style={{color:"#888",fontSize:13,marginBottom:20}}>
                  {b.name} · {c?.name} · {b.date} {b.hour}
                  <span style={{marginLeft:8,color:"#f97316",fontWeight:700}}>R$ {b.amount},00</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {[
                    {s:"paid",   label:"✅ Pago",            desc:"Pagamento confirmado",             col:"#22c55e"},
                    {s:"later",  label:"⏳ Pago depois",     desc:"Vai pagar após jogar",             col:"#60a5fa"},
                    {s:"unpaid", label:"⚠️ Pendente",        desc:"Aguardando pagamento",             col:"#f59e0b"},
                    {s:"error",  label:"❌ Erro no pagamento",desc:"Problema ao pagar — verificar",   col:"#ef4444"},
                  ].map(({s,label,desc,col})=>{
                    const current = s==="paid"?b.paid:s==="later"?b.paidLater:s==="error"?b.payError:(!b.paid&&!b.paidLater&&!b.payError);
                    return (
                      <button key={s} onClick={()=>setPaymentStatus(editPayModal,s)}
                        style={{display:"flex",alignItems:"center",gap:12,background:current?"#1a1a1a":"#141414",border:`1px solid ${current?col:"#2a2a2a"}`,borderRadius:10,padding:"12px 16px",cursor:"pointer",textAlign:"left",width:"100%"}}>
                        <span style={{fontWeight:700,color:col,fontSize:15,flex:1}}>{label}</span>
                        <span style={{color:"#666",fontSize:12}}>{desc}</span>
                        {current&&<span style={{color:col,fontSize:18}}>●</span>}
                      </button>
                    );
                  })}
                </div>
                <button style={{...S.btnG,width:"100%",marginTop:16,fontSize:13}} onClick={()=>setEditPayModal(null)}>Fechar</button>
              </div>
            </div>
          );
        })()}
      </main>

      <footer style={S.footer}>
        <span>🏖️ Na Praia — Arena Multi Esportiva · Dionísio - MG</span>
        <span style={{color:"#2a2a2a"}}>Quadra Sicoob · Quadra Tropical Net</span>
      </footer>
    </div>
  );
}

// ─── AVAILABILITY GRID ────────────────────────────────────────────────────────
function AvGrid({ bookings, selDate, selSlot, onPick, me, adminMode, onMarkPaid, onMarkLater }) {
  function isBooked(cId, date, hour) { return bookings[`${cId}-${date}-${hour}`]; }
  const hours = getHoursForDate(selDate);
  return (
    <div style={S.avGrid}>
      <div style={S.avHCol}>
        <div style={S.avCorner}/>
        {hours.map(h=><div key={h} style={S.avHLbl}>{h}</div>)}
      </div>
      {COURTS.map(c=>(
        <div key={c.id} style={{flex:1,display:"flex",flexDirection:"column",minWidth: adminMode?155:120}}>
          <div style={{...S.avHdr,color:c.color,borderBottom:`2px solid ${c.color}`}}>{c.name}</div>
          {hours.map(h=>{
            const b=isBooked(c.id,selDate,h);
            const key=`${c.id}-${selDate}-${h}`;
            const sel=selSlot?.courtId===c.id&&selSlot?.date===selDate&&selSlot?.hour===h;
            const myReg=me?.isRegular&&isRegularSlot(me,selDate,h);

            if (adminMode) {
              return (
                <div key={h} style={{...S.adminCell,
                  background:b?(b.paid?"#0d2a18":b.paidLater?"#0f1e3a":"#2a1010"):"#111",
                  borderColor:b?(b.paid?"#22c55e":b.paidLater?"#3b82f6":"#ef4444"):"#1a1a1a"}}>
                  {b?(
                    <>
                      <div style={{fontWeight:700,color:"#fff",fontSize:12}}>
                        {b.name}
                        {b.byAdmin&&<span style={{color:"#a855f7",marginLeft:4,fontSize:10}}>🛠</span>}
                        {b.regularSlot&&<span style={{color:"#f97316",marginLeft:4,fontSize:10}}>⭐</span>}
                      </div>
                      <div style={{fontSize:11,color:"#888",marginBottom:2}}>{b.sport} · R${b.amount}</div>
                      <div style={{fontSize:10,marginBottom:5,
                        color:b.paid?"#22c55e":b.paidLater?"#60a5fa":"#ef4444"}}>
                        {b.paid?"✓ Pago":b.paidLater?"⏳ Pago depois":"⚠ Não pago"}
                      </div>
                      {!b.paid&&!b.paidLater&&(
                        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
                          <button style={S.aGreen} onClick={()=>onMarkPaid(key)}>✓ Pago</button>
                          <button style={S.aBlue}  onClick={()=>onMarkLater(key)}>⏳ Depois</button>
                        </div>
                      )}
                      {b.paidLater&&<button style={S.aGreen} onClick={()=>onMarkPaid(key)}>✓ Confirmar Pago</button>}
                    </>
                  ):<span style={{color:"#2a2a2a",fontSize:11}}>— Livre —</span>}
                </div>
              );
            }

            return (
              <div key={h} onClick={()=>!b&&onPick(c.id,selDate,h)}
                style={{...S.avCell,
                  background:sel?"#f97316":b?"#2a1515":myReg?"#1a2800":"#152215",
                  borderColor:sel?"#f97316":b?"#6b2020":myReg?"#4a7a00":"#1a4a1a",
                  color:sel?"#fff":b?"#ef4444":myReg?"#a3e635":"#22c55e",
                  cursor:b?"not-allowed":"pointer"}}>
                {sel?"✓ Sel":b?(
                  <><span>● Ocp</span><div style={{fontSize:9,color:"#a66"}}>{nameInitials(b.name)}</div></>
                ):myReg?"⭐ Seu":"● Livre"}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── PIX QR ──────────────────────────────────────────────────────────────────
function PixQR() {
  return (
    <div style={{background:"#fff",borderRadius:10,padding:14,display:"inline-block",boxShadow:"0 0 30px rgba(249,115,22,0.12)"}}>
      <img src="data:image/jpeg;base64,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"
        alt="QR Code Pix Na Praia Arena"
        style={{width:180,height:180,display:"block",borderRadius:4}}
      />
    </div>
  );
}

// ─── REUSABLE COMPONENTS ──────────────────────────────────────────────────────

function PwdInput({label, v, set, ph}) {
  const [show, setShow] = useState(false);
  return (
    <div style={S.fg}>
      {label&&<label style={S.lbl}>{label}</label>}
      <div style={{position:"relative"}}>
        <input style={{...S.inp,paddingRight:44}} type={show?"text":"password"} value={v} onChange={set} placeholder={ph}/>
        <button type="button" onClick={()=>setShow(s=>!s)}
          style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#888",fontSize:18,padding:2,lineHeight:1}}>
          {show?"🙈":"👁️"}
        </button>
      </div>
    </div>
  );
}

function F({label,type="text",v,set,ph}) {
  return (
    <div style={S.fg}>
      {label&&<label style={S.lbl}>{label}</label>}
      <input style={S.inp} type={type} value={v} onChange={set} placeholder={ph}/>
    </div>
  );
}

function PeriodSelector({period, setPeriod, customStart, setCustomStart, customEnd, setCustomEnd}) {
  const opts = [{v:"30d",l:"Últ. 30 dias"},{v:"month",l:"Mês atual"},{v:"year",l:"Ano atual"},{v:"lastyear",l:"Ano anterior"},{v:"custom",l:"Personalizado"}];
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
        {opts.map(o=>(
          <button key={o.v} onClick={()=>setPeriod(o.v)}
            style={{background:period===o.v?"#f97316":"#1a1a1a",color:period===o.v?"#fff":"#888",
              border:`1px solid ${period===o.v?"#f97316":"#2a2a2a"}`,borderRadius:8,
              padding:"6px 12px",cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>
            {o.l}
          </button>
        ))}
      </div>
      {period==="custom"&&(
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <input type="date" style={{...S.inp,width:"auto",fontSize:13}} value={customStart} onChange={e=>setCustomStart(e.target.value)}/>
          <span style={{color:"#666"}}>até</span>
          <input type="date" style={{...S.inp,width:"auto",fontSize:13}} value={customEnd} onChange={e=>setCustomEnd(e.target.value)}/>
        </div>
      )}
    </div>
  );
}

function WeekNav({wd,sel,off,setOff,setSel,ac="#f97316"}) {
  const today=fmt(new Date());
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:18}}>
      <button style={S.wBtn} onClick={()=>setOff(o=>o-1)}>‹</button>
      <div style={{display:"flex",gap:4,flex:1,overflowX:"auto"}}>
        {wd.map((d,i)=>{
          const ds=fmt(d),past=d<new Date(new Date().setHours(0,0,0,0));
          return (
            <button key={i} disabled={past} onClick={()=>setSel(ds)}
              style={{...S.dBtn,...(sel===ds?{background:ac,color:"#fff",borderColor:ac}:{}),...(past?{opacity:.3,cursor:"not-allowed"}:{})}}>
              <div style={{fontSize:9}}>{DAYS_SHORT[d.getDay()]}</div>
              <div style={{fontWeight:700,fontSize:12}}>{String(d.getDate()).padStart(2,"0")}/{String(d.getMonth()+1).padStart(2,"0")}</div>
              {ds===today&&<div style={{fontSize:8,color:sel===ds?"#fff":ac}}>Hoje</div>}
            </button>
          );
        })}
      </div>
      <button style={S.wBtn} onClick={()=>setOff(o=>o+1)}>›</button>
    </div>
  );
}
function KPI({icon,label,v}) {
  return (
    <div style={S.kpiCard}>
      <div style={{fontSize:20,marginBottom:4}}>{icon}</div>
      <div style={{fontWeight:900,fontSize:19,color:"#fff"}}>{v}</div>
      <div style={{color:"#666",fontSize:11,marginTop:2}}>{label}</div>
    </div>
  );
}
function Section({title,children}) {
  return (
    <div style={{marginBottom:30}}>
      <h3 style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:14,paddingBottom:8,borderBottom:"1px solid #1e1e1e"}}>{title}</h3>
      {children}
    </div>
  );
}
function Bar({data,color,unit}) {
  const mx=Math.max(...data.map(d=>d.value),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:110,padding:"0 0 22px",overflowX:"auto"}}>
      {data.map((d,i)=>(
        <div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",flex:"0 0 auto",minWidth:36}}>
          <div style={{fontSize:9,color:"#888",marginBottom:2,whiteSpace:"nowrap"}}>{unit}{d.value}</div>
          <div style={{width:28,background:color,borderRadius:"3px 3px 0 0",height:Math.max(d.value/mx*72,d.value>0?3:0),opacity:.88}}/>
          <div style={{fontSize:8,color:"#555",marginTop:3,transform:"rotate(-30deg)",whiteSpace:"nowrap"}}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S = {
  app:{minHeight:"100vh",background:"#0c0c0c",color:"#e5e5e5",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column"},
  header:{background:"#111",borderBottom:"1px solid #1e1e1e",position:"sticky",top:0,zIndex:50},
  hInner:{maxWidth:1200,margin:"0 auto",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"},
  logo:{cursor:"pointer",display:"flex",alignItems:"center",flexShrink:0},
  logoTitle:{fontWeight:900,fontSize:18,letterSpacing:3,color:"#fff"},
  logoSub:{fontSize:8,color:"#f97316",letterSpacing:2,textTransform:"uppercase"},
  nav:{display:"flex",gap:2,flexWrap:"wrap"},
  navBtn:{background:"none",border:"none",color:"#666",cursor:"pointer",padding:"8px 12px",borderRadius:8,fontSize:13,fontFamily:"inherit"},
  navAct:{background:"#1a1a1a",color:"#f97316"},
  adminBadge:{background:"#1a1a1a",border:"1px solid #222",color:"#444",cursor:"pointer",width:32,height:32,borderRadius:8,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  main:{flex:1,maxWidth:1200,margin:"0 auto",width:"100%",padding:"28px 20px"},
  hero:{marginBottom:28},
  heroTag:{display:"inline-block",background:"#1a1a1a",border:"1px solid #f97316",color:"#f97316",borderRadius:100,padding:"4px 14px",fontSize:11,letterSpacing:2,textTransform:"uppercase",marginBottom:14},
  heroTitle:{fontSize:"clamp(28px,5vw,50px)",fontWeight:900,lineHeight:1.1,color:"#fff",marginBottom:12},
  heroDesc:{color:"#666",fontSize:15,marginBottom:22,maxWidth:440},
  priceBanner:{display:"flex",gap:16,background:"#141414",border:"1px solid #222",borderRadius:14,padding:"16px 22px",marginBottom:24,flexWrap:"wrap",alignItems:"center"},
  priceBannerItem:{display:"flex",alignItems:"center",gap:12,flex:1,minWidth:150},
  homeCards:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16},
  courtCard:{background:"#141414",border:"1px solid #222",borderRadius:16,padding:22},
  chip:{borderRadius:100,padding:"3px 10px",fontSize:11,fontWeight:600},
  pageTitle:{fontSize:22,fontWeight:900,color:"#fff",marginBottom:20},
  stepsBar:{display:"flex",gap:8,marginBottom:24,flexWrap:"wrap"},
  stepW:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flex:"0 0 auto",minWidth:60},
  stepC:{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700,fontSize:12},
  tabSwitch:{display:"flex",background:"#1a1a1a",borderRadius:10,padding:3,marginBottom:18},
  tabBtn:{flex:1,background:"none",border:"none",color:"#666",padding:"9px 0",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13},
  tabAct:{background:"#f97316",color:"#fff"},
  fg:{marginBottom:14},
  lbl:{display:"block",color:"#888",fontSize:12,marginBottom:5},
  inp:{width:"100%",background:"#141414",border:"1px solid #2a2a2a",color:"#fff",borderRadius:10,padding:"11px 13px",fontSize:14,fontFamily:"inherit",outline:"none",boxSizing:"border-box"},
  gBtn:{flex:1,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",borderRadius:8,padding:"10px 0",cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:13},
  regBox:{background:"#141414",border:"1px solid #2a2a2a",borderRadius:12,padding:16,marginTop:4,marginBottom:14,transition:"border-color .2s"},
  toggle:{width:22,height:22,borderRadius:6,border:"1px solid #444",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2,transition:"background .2s"},
  btnO:{background:"#f97316",color:"#fff",border:"none",padding:"11px 22px",borderRadius:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14},
  btnG:{background:"transparent",color:"#ccc",border:"1px solid #2a2a2a",padding:"11px 22px",borderRadius:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit",fontSize:14},
  sportBtn:{display:"flex",alignItems:"center",gap:12,background:"#141414",border:"1px solid #2a2a2a",color:"#ccc",borderRadius:12,padding:"14px 16px",cursor:"pointer",fontFamily:"inherit",fontSize:15,width:"100%"},
  avGrid:{display:"flex",border:"1px solid #1a1a1a",borderRadius:12,overflow:"hidden",marginBottom:14},
  avHCol:{display:"flex",flexDirection:"column",minWidth:52,background:"#0e0e0e"},
  avCorner:{height:44,borderBottom:"1px solid #1a1a1a"},
  avHLbl:{height:42,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:8,fontSize:11,color:"#333",borderTop:"1px solid #141414"},
  avHdr:{padding:"10px 8px",fontWeight:700,fontSize:12,textAlign:"center",background:"#141414",height:44,display:"flex",alignItems:"center",justifyContent:"center",boxSizing:"border-box"},
  avCell:{height:42,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600,borderTop:"1px solid #111",borderLeft:"1px solid #1a1a1a",transition:"all .15s"},
  adminCell:{minHeight:78,display:"flex",flexDirection:"column",justifyContent:"center",padding:"5px 7px",border:"1px solid #111",borderTop:"1px solid #1a1a1a",fontSize:11},
  aGreen:{background:"#14532d",color:"#22c55e",border:"none",borderRadius:5,padding:"3px 7px",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:700,marginBottom:2},
  aBlue:{background:"#1e3a5f",color:"#60a5fa",border:"none",borderRadius:5,padding:"3px 7px",cursor:"pointer",fontFamily:"inherit",fontSize:10,fontWeight:700},
  slotBanner:{borderRadius:10,padding:"12px 16px",fontSize:13,marginTop:14},
  confirmBox:{background:"#141414",border:"1px solid #222",borderRadius:18,padding:28},
  confDets:{display:"flex",flexDirection:"column",gap:8,color:"#ccc",fontSize:14,marginBottom:8},
  bookCard:{background:"#141414",border:"1px solid #222",borderRadius:14,padding:18,marginBottom:4},
  infoBox:{background:"#141414",border:"1px solid #222",borderRadius:10,padding:"12px 16px",color:"#666",fontSize:13},
  kpiGrid:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:26},
  kpiCard:{background:"#141414",border:"1px solid #1e1e1e",borderRadius:14,padding:16,textAlign:"center"},
  pieCard:{background:"#141414",border:"1px solid #222",borderRadius:14,padding:18,minWidth:110},
  insCard:{background:"#141414",border:"1px solid #222",borderRadius:12,padding:14},
  legend:{display:"flex",gap:14,fontSize:11,color:"#555",flexWrap:"wrap"},
  adminTabs:{display:"flex",gap:4,marginBottom:20,flexWrap:"wrap"},
  adminTabBtn:{background:"#1a1a1a",border:"1px solid #222",color:"#666",padding:"8px 13px",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12},
  adminTabAct:{background:"#a855f7",color:"#fff",border:"1px solid #a855f7"},
  wBtn:{background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",width:34,height:34,borderRadius:8,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},
  dBtn:{background:"#141414",border:"1px solid #222",color:"#aaa",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12,minWidth:36,textAlign:"center",fontFamily:"inherit"},
  toast:{position:"fixed",top:72,right:20,color:"#fff",padding:"11px 18px",borderRadius:10,fontWeight:700,fontSize:13,zIndex:200,boxShadow:"0 4px 24px rgba(0,0,0,.6)"},
  footer:{background:"#080808",borderTop:"1px solid #141414",padding:"16px 20px",display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:8,fontSize:12,color:"#333"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:20},
  modalBox:{background:"#1a1a1a",border:"1px solid #333",borderRadius:18,padding:28,maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"},
  reportCard:{background:"#141414",border:"1px solid #222",borderRadius:16,padding:24,flex:1,minWidth:220},
};

const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  .fi{animation:fi .3s ease;}
  @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  button:hover:not(:disabled){opacity:.82;transform:translateY(-1px);}
  input:focus,select:focus{border-color:#f97316!important;outline:none;}
  select option{background:#1a1a1a;color:#fff;}
  ::-webkit-scrollbar{width:3px;height:3px;}
  ::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:2px;}
`;
