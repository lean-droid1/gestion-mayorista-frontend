import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, User, LogOut, Package, Settings, Eye, EyeOff, Edit2,
  Trash2, Plus, Minus, Phone, Truck, Store, Users, DollarSign,
  AlertTriangle, Check, X, Menu, Filter, ClipboardList, Save,
  ChevronDown, RefreshCw, UserPlus, Clock, Shield,
  BarChart3, Loader2, ArrowLeft, Percent, Upload, Printer,
  Download, Copy, Share2, FileText, Image, Home, TrendingUp,
} from "lucide-react";
import * as XLSX from "xlsx";
import * as API from "./api";

// ═══════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════
const BRAND_KEYS = ["SAMSUNG","MOTOROLA","XIAOMI","HUAWEI","IPHONE","LG","NOKIA","SONY","TCL","ZTE","PS4","PS5","PS3"];

const CAT_TYPE_COLORS = {
  "placa de carga":"#2563eb","flex":"#7c3aed","pin de carga":"#0891b2","bandeja":"#059669",
  "lente":"#d97706","buzzer":"#dc2626","parlante":"#dc2626","conector fpc":"#6366f1",
  "boton":"#84cc16","membrana":"#f97316","cable":"#0d9488","antena":"#6d28d9",
  "pulsador":"#ec4899","marco":"#78716c","pegamento":"#a3a3a3","tubo":"#a3a3a3",
  "repuesto":"#f43f5e","microfono":"#8b5cf6","jack":"#14b8a6","ficha":"#06b6d4",
};

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
const fmt = (n) => "U$D " + Number(n||0).toFixed(2);
const fmtARS = (n) => "$" + Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});

const getPrice = (base, lista, pfMap, pid) => {
  const k = `${pid}_${lista?.id}`;
  if (pfMap[k] != null && pfMap[k] > 0) return pfMap[k];
  return Math.round(base * (lista?.multiplicador||1) * 100) / 100;
};

const extractBrand = (cat) => {
  const u = (cat||"").toUpperCase();
  for (const b of BRAND_KEYS) if (u.includes(b)) return b;
  return "OTROS";
};

const getCatColor = (cat) => {
  const low = (cat||"").toLowerCase();
  for (const [key, color] of Object.entries(CAT_TYPE_COLORS)) {
    if (low.includes(key)) return color;
  }
  return "#64748b";
};

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function App() {
  // ── Auth ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [vitrina, setVitrina] = useState(false);

  // ── Data ──
  const [productos, setProductos] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [listas, setListas] = useState([]);
  const [config, setConfigState] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [preciosFijos, setPreciosFijos] = useState([]);
  const [stats, setStats] = useState(null);
  const [pendientesCount, setPendientesCount] = useState(0);
  const [dolarBlue, setDolarBlue] = useState(null);
  const [mantenimiento, setMantenimiento] = useState(null);

  // ── UI ──
  const [view, setView] = useState("catalog");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(60);
  const [showCats, setShowCats] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState([]);
  const [checkout, setCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState("retiro");
  const [checkoutAddr, setCheckoutAddr] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [editProduct, setEditProduct] = useState(null);
  const [addProdModal, setAddProdModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editTier, setEditTier] = useState(null);
  const [editOrder, setEditOrder] = useState(null);
  const [adminTab, setAdminTab] = useState("home");
  const [orderFilter, setOrderFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [presupuesto, setPresupuesto] = useState(false);

  // ── Login/Register ──
  const [authMode, setAuthMode] = useState("login");
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [regForm, setRegForm] = useState({nombre:"",apellido:"",usuario:"",password:"",telefono:""});
  const [regError, setRegError] = useState("");
  const [regMsg, setRegMsg] = useState("");

  // ── Maintenance form ──
  const [mantForm, setMantForm] = useState({activo:false,mensaje:"",countdown:""});

  const searchTimer = useRef(null);
  const isAdmin = user?.rol === "admin";

  // ── Derived ──
  const pfMap = useMemo(() => {
    const m = {};
    preciosFijos.forEach(pf => { m[`${pf.producto_id}_${pf.lista_precio_id}`] = pf.precio_fijo; });
    return m;
  }, [preciosFijos]);

  const userLista = useMemo(() => {
    if (!listas.length) return null;
    if (vitrina) return listas.find(l => l.id === config.vitrina_lista) || listas[listas.length-1];
    if (!user) return listas[0];
    return listas.find(l => l.id === user.lista_precio_id) || listas[0];
  }, [user, listas, vitrina, config]);

  const brands = useMemo(() => {
    const s = new Set(categorias.map(c => extractBrand(c)));
    return [...s].sort();
  }, [categorias]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(""), 2500); }, []);

  // ═══════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      try { const m = await API.getMaintenanceStatus(); if (m.activo) { setMantenimiento(m); setAuthLoading(false); return; } } catch {}
      if (API.isLoggedIn()) { try { const me = await API.getMe(); setUser(me); } catch { API.logout(); } }
      setAuthLoading(false);
    })();
  }, []);

  useEffect(() => { if (authLoading) return; if (mantenimiento?.activo && !isAdmin) return; loadCoreData(); }, [authLoading, user, vitrina]);

  // Dollar blue
  useEffect(() => {
    fetch("https://dolarapi.com/v1/dolares/blue").then(r=>r.json()).then(d=>setDolarBlue(d.venta)).catch(()=>{});
  }, []);

  // Shared cart from URL
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const cartData = p.get("cart");
    if (cartData) { try { setCart(JSON.parse(atob(cartData))); window.history.replaceState({}, "", window.location.pathname); } catch {} }
  }, []);

  const loadCoreData = async () => {
    try {
      const [cats, listasD, cfgD] = await Promise.all([
        API.getCategorias().catch(()=>[]),
        user ? API.getListas().catch(()=>[]) : Promise.resolve([]),
        user ? API.getConfig().catch(()=>({})) : Promise.resolve({}),
      ]);
      setCategorias(Array.isArray(cats)?cats:[]);
      if (listasD.length) setListas(listasD);
      if (Object.keys(cfgD).length) { setConfigState(cfgD); setMantForm({activo:cfgD.mantenimiento_activo==="true",mensaje:cfgD.mantenimiento_mensaje||"",countdown:cfgD.mantenimiento_countdown||""}); }
      if (user || vitrina) await loadProductos(1,"","");
      if (isAdmin) {
        const [pf,ords,usrs,pC,st] = await Promise.all([
          API.getPreciosFijos().catch(()=>[]), API.getPedidos().catch(()=>[]),
          API.getUsuarios().catch(()=>[]), API.getUsuariosPendientesCount().catch(()=>({count:0})),
          API.getStats().catch(()=>null),
        ]);
        setPreciosFijos(Array.isArray(pf)?pf:[]); setPedidos(Array.isArray(ords)?ords:[]);
        setUsuarios(Array.isArray(usrs)?usrs:[]); setPendientesCount(pC?.count||0); setStats(st);
      } else if (user) {
        const [pf,ords] = await Promise.all([API.getPreciosFijos().catch(()=>[]), API.getPedidos().catch(()=>[])]);
        setPreciosFijos(Array.isArray(pf)?pf:[]); setPedidos(Array.isArray(ords)?ords:[]);
      }
      setDataReady(true);
    } catch(e) { console.error(e); setDataReady(true); }
  };

  const loadProductos = async (pg=1,q="",cat="") => {
    setLoading(true);
    try {
      const r = await API.getProductos({q:q||undefined,categoria:cat||undefined,page:pg,limit:pageSize});
      setProductos(r.productos||r.data||r||[]); setTotalProductos(r.total??0); setPage(pg);
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  const refreshAdmin = async () => {
    if (!isAdmin) return;
    const [usrs,ords,pf,pC,st] = await Promise.all([
      API.getUsuarios().catch(()=>[]), API.getPedidos().catch(()=>[]),
      API.getPreciosFijos().catch(()=>[]), API.getUsuariosPendientesCount().catch(()=>({count:0})),
      API.getStats().catch(()=>null),
    ]);
    setUsuarios(Array.isArray(usrs)?usrs:[]); setPedidos(Array.isArray(ords)?ords:[]);
    setPreciosFijos(Array.isArray(pf)?pf:[]); setPendientesCount(pC?.count||0); setStats(st);
  };

  // Debounced search
  useEffect(() => { if (searchTimer.current) clearTimeout(searchTimer.current); searchTimer.current = setTimeout(() => setSearchDebounced(search), 400); return () => clearTimeout(searchTimer.current); }, [search]);
  useEffect(() => { if (!dataReady) return; setCatFilter(""); setBrandFilter(""); loadProductos(1,searchDebounced,""); }, [searchDebounced]);
  useEffect(() => { if (!dataReady) return; loadProductos(1,searchDebounced,catFilter); }, [catFilter, pageSize]);

  // Brand filter (client-side)
  const displayProducts = useMemo(() => {
    let list = productos;
    if (brandFilter) {
      if (brandFilter === "OTROS") list = list.filter(p => !BRAND_KEYS.some(b => (p.categoria||"").toUpperCase().includes(b)));
      else list = list.filter(p => (p.categoria||"").toUpperCase().includes(brandFilter));
    }
    if (stockFilter) list = list.filter(p => (p.stock||0) > 0);
    return list;
  }, [productos, brandFilter, stockFilter]);

  // Cross-compatibility: group by category
  const crossResults = useMemo(() => {
    if (!searchDebounced || searchDebounced.length < 2) return null;
    const cats = {};
    displayProducts.forEach(p => { if (!cats[p.categoria]) cats[p.categoria] = []; cats[p.categoria].push(p); });
    const entries = Object.entries(cats);
    if (entries.length <= 1) return null;
    return { categories: entries, total: displayProducts.length };
  }, [displayProducts, searchDebounced]);

  // ═══════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════
  const doLogin = async () => {
    setLoginError("");
    try { const u = await API.login(loginUser, loginPass); setUser(u); setLoginUser(""); setLoginPass(""); setView("catalog"); }
    catch (err) { setLoginError(err.pendiente ? "Tu cuenta está pendiente de aprobación." : (err.message||"Error")); }
  };

  const doRegister = async () => {
    setRegError("");
    if (!regForm.nombre || !regForm.apellido || !regForm.usuario || !regForm.password || !regForm.telefono) { setRegError("Todos los campos son obligatorios"); return; }
    try {
      const r = await API.register({...regForm, nombre: `${regForm.nombre} ${regForm.apellido}`});
      setRegMsg(r.mensaje || "Registro enviado. El administrador revisará tu cuenta.");
      setAuthMode("pendiente");
    } catch(e) { setRegError(e.message || "Error"); }
  };

  const doLogout = () => { API.logout(); setUser(null); setVitrina(false); setCart([]); setView("catalog"); setDataReady(false); setProductos([]); };

  // ═══════════════════════════════════════════════════
  // CART & ORDERS
  // ═══════════════════════════════════════════════════
  const addToCart = (p, qty=1) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === p.id);
      if (ex) return prev.map(c => c.id === p.id ? {...c, qty: c.qty + qty} : c);
      return [...prev, {id:p.id, categoria:p.categoria, modelo:p.modelo, precio_base:p.precio_base, qty}];
    });
    showToast("Agregado al carrito");
  };

  const cartTotal = useMemo(() => {
    if (!userLista) return 0;
    return cart.reduce((s,i) => s + getPrice(i.precio_base, userLista, pfMap, i.id) * i.qty, 0);
  }, [cart, userLista, pfMap]);

  const cartCount = cart.reduce((s,i) => s + i.qty, 0);

  const minCompra = userLista?.compra_minima || 0;
  const cartMeetsMin = minCompra <= 0 || cartTotal >= minCompra;

  const placeOrder = async () => {
    if (!cartMeetsMin) { showToast(`Compra mínima: ${fmt(minCompra)}`); return; }
    setLoading(true);
    try {
      const items = cart.map(i => ({producto_id:i.id, categoria:i.categoria, modelo:i.modelo, cantidad:i.qty, precio_unitario:getPrice(i.precio_base, userLista, pfMap, i.id)}));
      await API.createPedido({items, total:cartTotal, tipo_entrega:checkoutType, direccion:checkoutAddr, notas:checkoutNotes});
      // WhatsApp redirect
      const wa = config.whatsapp;
      if (wa) {
        const biz = config.nombre_negocio || "Mayorista";
        const msg = `Hola soy ${user?.nombre||"cliente"}, tengo un pedido por ${fmt(cartTotal)} (${cartCount} items). ${checkoutType==="retiro"?"Retiro en local":"Envío"}.`;
        window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, "_blank");
      }
      setCart([]); setCheckout(false); setShowCart(false); setCheckoutAddr(""); setCheckoutNotes("");
      showToast("¡Pedido realizado!");
      const ords = await API.getPedidos().catch(()=>[]); setPedidos(Array.isArray(ords)?ords:[]);
      await loadProductos(page, searchDebounced, catFilter);
    } catch(e) { showToast("Error: "+e.message); }
    setLoading(false);
  };

  const shareCart = () => {
    const data = btoa(JSON.stringify(cart));
    const url = `${window.location.origin}?cart=${data}`;
    navigator.clipboard.writeText(url).then(()=>showToast("Link del carrito copiado")).catch(()=>{});
  };

  const cloneOrder = (order) => {
    const items = (order.items||[]).map(i => ({id:i.producto_id||i.id, categoria:i.categoria, modelo:i.modelo, precio_base:i.precio_base||i.precio_unitario, qty:i.cantidad||i.qty}));
    setCart(items); showToast("Pedido cargado al carrito"); setView("catalog");
  };

  // ═══════════════════════════════════════════════════
  // PRINT REMITO
  // ═══════════════════════════════════════════════════
  const printRemito = (order, format="A4") => {
    const logo = config.logo || "";
    const biz = config.nombre_negocio || "Mayorista";
    const widths = {A4:"210mm","50mm":"50mm","80mm":"80mm","100mm":"100mm"};
    const w = window.open("","_blank");
    const isSmall = format !== "A4";
    const fontSize = isSmall ? "10px" : "13px";
    const items = (order.items||[]).map(i =>
      `<tr><td style="padding:2px 4px;border-bottom:1px solid #eee">${i.categoria} - ${i.modelo}</td><td style="text-align:center;border-bottom:1px solid #eee">${i.cantidad||i.qty}</td><td style="text-align:right;border-bottom:1px solid #eee">${fmt((i.precio_unitario||i.unitPrice)*(i.cantidad||i.qty))}</td></tr>`
    ).join("");
    w.document.write(`<!DOCTYPE html><html><head><title>Remito ${order.id}</title><style>@page{size:${widths[format]};margin:${isSmall?"2mm":"10mm"}}body{font-family:Arial,sans-serif;font-size:${fontSize};margin:0;padding:${isSmall?"4px":"20px"};width:${isSmall?widths[format]:"auto"}}table{width:100%;border-collapse:collapse}th{text-align:left;border-bottom:2px solid #333;padding:4px}</style></head><body>
      ${logo?`<img src="${logo}" style="max-height:${isSmall?"30px":"60px"};margin-bottom:8px">`:""}
      <h2 style="margin:0;font-size:${isSmall?"14px":"20px"}">${biz}</h2>
      <p style="margin:4px 0;color:#666">Pedido #${order.id} — ${new Date(order.fecha||order.created_at).toLocaleString("es-AR")}</p>
      <p style="margin:2px 0">${order.usuario_nombre||""} — ${order.tipo_entrega==="retiro"?"Retiro":"Envío"} ${order.direccion?("- "+order.direccion):""}</p>
      <hr style="margin:8px 0"><table><thead><tr><th>Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${items}</tbody></table>
      <p style="text-align:right;font-weight:bold;font-size:${isSmall?"13px":"18px"};margin-top:10px">TOTAL: ${fmt(order.total)}</p>
      ${order.notas?`<p style="color:#666;font-size:${isSmall?"9px":"11px"}">Notas: ${order.notas}</p>`:""}
    </body></html>`);
    w.document.close(); setTimeout(()=>w.print(),300);
  };

  // ═══════════════════════════════════════════════════
  // EXPORT ORDERS TO EXCEL
  // ═══════════════════════════════════════════════════
  const exportOrders = () => {
    const rows = [];
    pedidos.forEach(o => {
      (o.items||[]).forEach(i => {
        rows.push({Pedido:o.id, Fecha:new Date(o.fecha||o.created_at).toLocaleDateString("es-AR"), Cliente:o.usuario_nombre, Categoria:i.categoria, Modelo:i.modelo, Cantidad:i.cantidad||i.qty, PrecioUnit:i.precio_unitario||i.unitPrice, Subtotal:(i.precio_unitario||i.unitPrice)*(i.cantidad||i.qty), Total:o.total, Estado:o.estado, Entrega:o.tipo_entrega});
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, "pedidos.xlsx");
    showToast("Excel descargado");
  };

  // ═══════════════════════════════════════════════════
  // PROFIT CALCULATION
  // ═══════════════════════════════════════════════════
  const profitData = useMemo(() => {
    if (!pedidos.length) return null;
    const now = new Date();
    const calc = (filterFn) => {
      let revenue=0, cost=0;
      pedidos.filter(o => o.estado !== "cancelado" && filterFn(new Date(o.fecha||o.created_at))).forEach(o => {
        revenue += o.total||0;
        (o.items||[]).forEach(i => { cost += (i.precio_base||0) * (i.cantidad||i.qty||0); });
      });
      return {revenue, cost, profit: revenue - cost};
    };
    return {
      hoy: calc(d => d.toDateString() === now.toDateString()),
      semana: calc(d => (now-d) < 7*86400000),
      mes: calc(d => d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear()),
      año: calc(d => d.getFullYear()===now.getFullYear()),
    };
  }, [pedidos]);

  // Client ranking
  const clientRanking = useMemo(() => {
    const map = {};
    pedidos.filter(o=>o.estado!=="cancelado").forEach(o => {
      const k = o.usuario_nombre||o.usuario_id||"?";
      if (!map[k]) map[k] = {nombre:k, total:0, pedidos:0};
      map[k].total += o.total||0; map[k].pedidos++;
    });
    return Object.values(map).sort((a,b) => b.total - a.total);
  }, [pedidos]);

  // ═══════════════════════════════════════════════════
  // RENDER GUARDS
  // ═══════════════════════════════════════════════════
  if (authLoading) return <div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>;

  if (mantenimiento?.activo && !isAdmin) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <Settings className="w-16 h-16 text-amber-400 animate-spin mx-auto mb-6" style={{animationDuration:"3s"}} />
        <h1 className="text-2xl font-bold text-white mb-3">En mantenimiento</h1>
        <p className="text-blue-200">{mantenimiento.mensaje || "Volvemos pronto."}</p>
        {mantenimiento.countdown && <p className="text-sm text-blue-300/70 mt-4">{mantenimiento.countdown}</p>}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // LOGIN / REGISTER
  // ═══════════════════════════════════════════════════
  if (!user && !vitrina) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {config.logo ? <img src={config.logo} className="h-16 mx-auto mb-4 object-contain" /> :
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30"><Store className="w-8 h-8 text-white" /></div>}
          <h1 className="text-2xl font-bold text-white">{config.nombre_negocio||"Mi Depósito"}</h1>
          <p className="text-blue-300 text-sm mt-1">Sistema de Gestión</p>
        </div>
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          {authMode === "pendiente" && (
            <div className="text-center space-y-4">
              <Clock className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-white font-bold text-lg">Registro enviado</h3>
              <p className="text-blue-200 text-sm">{regMsg}</p>
              <button onClick={()=>{setAuthMode("login");setRegMsg("");}} className="w-full py-3 bg-white/10 text-white rounded-xl text-sm">Volver al login</button>
            </div>
          )}
          {authMode === "login" && (
            <div className="space-y-4">
              <div><label className="text-blue-200 text-xs font-medium mb-1 block">Usuario</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario" value={loginUser} onChange={e=>setLoginUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} /></div>
              <div><label className="text-blue-200 text-xs font-medium mb-1 block">Contraseña</label>
                <div className="relative">
                  <input type={showPass?"text":"password"} className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-11"
                    placeholder="••••" value={loginPass} onChange={e=>setLoginPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} />
                  <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white">
                    {showPass ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                  </button>
                </div>
              </div>
              {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
              <button onClick={doLogin} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">Ingresar</button>
              <button onClick={()=>{setAuthMode("register");setLoginError("");}} className="w-full py-2.5 text-blue-300 hover:text-white text-sm flex items-center justify-center gap-1.5">
                <UserPlus className="w-4 h-4" /> Crear cuenta nueva</button>
            </div>
          )}
          {authMode === "register" && (
            <div className="space-y-3">
              <button onClick={()=>{setAuthMode("login");setRegError("");}} className="text-blue-300 text-sm flex items-center gap-1 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" /> Volver</button>
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-blue-200 text-xs font-medium mb-1 block">Nombre *</label>
                  <input className="w-full px-3 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Juan" value={regForm.nombre} onChange={e=>setRegForm({...regForm,nombre:e.target.value})} /></div>
                <div className="flex-1"><label className="text-blue-200 text-xs font-medium mb-1 block">Apellido *</label>
                  <input className="w-full px-3 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Pérez" value={regForm.apellido} onChange={e=>setRegForm({...regForm,apellido:e.target.value})} /></div>
              </div>
              <div><label className="text-blue-200 text-xs font-medium mb-1 block">Usuario *</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="juanperez" value={regForm.usuario} onChange={e=>setRegForm({...regForm,usuario:e.target.value})} /></div>
              <div><label className="text-blue-200 text-xs font-medium mb-1 block">Contraseña *</label>
                <input type="password" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••" value={regForm.password} onChange={e=>setRegForm({...regForm,password:e.target.value})} /></div>
              <div><label className="text-blue-200 text-xs font-medium mb-1 block">Teléfono *</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="11-0000-0000" value={regForm.telefono} onChange={e=>setRegForm({...regForm,telefono:e.target.value})} /></div>
              {regError && <p className="text-red-400 text-sm">{regError}</p>}
              <button onClick={doRegister} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl">Registrarme</button>
              <p className="text-blue-300/60 text-xs text-center">Tu cuenta será aprobada por el administrador.</p>
            </div>
          )}
          {authMode === "login" && <div className="mt-6 pt-4 border-t border-white/10">
            <button onClick={()=>setVitrina(true)} className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-sm font-medium flex items-center justify-center gap-2"><Eye className="w-4 h-4" /> Ver Vitrina Pública</button>
          </div>}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // COMPONENTS
  // ═══════════════════════════════════════════════════

  // ── Product Card ──
  const ProductCard = ({p}) => {
    if (!userLista) return null;
    const price = getPrice(p.precio_base, userLista, pfMap, p.id);
    const inCart = cart.find(c => c.id === p.id);
    const [qty, setQty] = useState(1);
    const catColor = getCatColor(p.categoria);
    return (
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
        <div className="h-2 w-full" style={{backgroundColor: catColor, opacity:0.7}} />
        {p.imagen ? <div className="h-28 bg-slate-50 flex items-center justify-center overflow-hidden"><img src={p.imagen} alt={p.modelo} className="h-full w-full object-contain" onError={e=>e.target.style.display="none"}/></div>
         : <div className="h-10 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center"><Package className="w-5 h-5 text-slate-300"/></div>}
        <div className="p-3">
          <p className="text-[10px] font-medium uppercase tracking-wide truncate" style={{color:catColor}}>{p.categoria}</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5 truncate" title={p.modelo}>{p.modelo}</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-lg font-bold" style={{color:userLista.color}}>{fmt(price)}</p>
              {dolarBlue && <p className="text-[10px] text-slate-400">{fmtARS(price * dolarBlue)}</p>}
            </div>
            {isAdmin && <button onClick={()=>setEditProduct(p)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500"><Edit2 className="w-3.5 h-3.5"/></button>}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <input type="number" min="1" value={inCart ? inCart.qty : qty} onChange={e=>{const v=Math.max(1,parseInt(e.target.value)||1); if(inCart)setCart(prev=>prev.map(c=>c.id===p.id?{...c,qty:v}:c)); else setQty(v);}}
              className="w-14 px-1.5 py-1.5 border rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            <button onClick={()=>addToCart(p, inCart ? 0 : qty)} disabled={!!inCart}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 ${inCart?"bg-blue-100 text-blue-700":"bg-blue-600 text-white hover:bg-blue-700"}`}>
              {inCart ? <><Check className="w-3.5 h-3.5"/> En carrito</> : <><Plus className="w-3.5 h-3.5"/> Agregar</>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Category Sidebar ──
  const CatSidebar = () => (
    <div className={`fixed inset-0 z-50 ${showCats?"":"pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${showCats?"opacity-100":"opacity-0"}`} onClick={()=>setShowCats(false)} />
      <div className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl transition-transform ${showCats?"translate-x-0":"-translate-x-full"} overflow-y-auto`}>
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Categorías</h3><button onClick={()=>setShowCats(false)}><X className="w-5 h-5"/></button>
        </div>
        <button onClick={()=>{setCatFilter("");setBrandFilter("");setShowCats(false);}}
          className={`w-full text-left px-4 py-2.5 text-sm border-b ${!catFilter&&!brandFilter?"bg-blue-50 text-blue-700 font-semibold":"text-slate-700 hover:bg-slate-50"}`}>Todos los productos</button>
        <div className="px-4 py-2"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Por marca</p>
          <div className="flex flex-wrap gap-1.5 mb-3">{brands.map(b=>(
            <button key={b} onClick={()=>{setBrandFilter(brandFilter===b?"":b);setCatFilter("");setShowCats(false);}}
              className={`px-2.5 py-1 rounded-full text-xs font-medium ${brandFilter===b?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{b}</button>))}</div></div>
        <div className="px-4 pb-2"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Por categoría</p></div>
        {categorias.map(c=>(
          <button key={c} onClick={()=>{setCatFilter(c);setBrandFilter("");setShowCats(false);}}
            className={`w-full text-left px-4 py-2 text-sm border-b border-slate-50 flex items-center gap-2 ${catFilter===c?"bg-blue-50 text-blue-700 font-semibold":"text-slate-600 hover:bg-slate-50"}`}>
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:getCatColor(c)}} />
            <span className="truncate">{c}</span></button>))}
      </div>
    </div>
  );

  // ── Edit Product Modal ──
  const EditProductModal = () => {
    const p = editProduct; if (!p) return null;
    const [stk,setStk]=useState(p.stock||0); const [img,setImg]=useState(p.imagen||""); const [pb,setPb]=useState(p.precio_base||0);
    const [notas,setNotas]=useState(p.notas||""); const [sv,setSv]=useState(false);
    const [fp,setFp]=useState(()=>{const o={};preciosFijos.filter(x=>x.producto_id===p.id).forEach(x=>{o[x.lista_precio_id]=x.precio_fijo});return o;});
    const save=async()=>{setSv(true);try{
      await API.updateProducto(p.id,{stock:parseInt(stk)||0,imagen:img,precio_base:parseFloat(pb)||p.precio_base,notas});
      for(const l of listas){const v=fp[l.id];await API.setPrecioFijo(p.id,l.id,v&&v>0?v:0).catch(()=>{});}
      await loadProductos(page,searchDebounced,catFilter);const pf=await API.getPreciosFijos().catch(()=>[]);setPreciosFijos(Array.isArray(pf)?pf:[]);
      setEditProduct(null);showToast("Producto actualizado");
    }catch(e){showToast("Error: "+e.message);}setSv(false);};
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b sticky top-0 bg-white flex justify-between items-center"><h3 className="font-bold">Editar Producto</h3><button onClick={()=>setEditProduct(null)}><X className="w-5 h-5"/></button></div>
          <div className="p-4 space-y-3">
            <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">{p.categoria}</p><p className="font-bold text-slate-800">{p.modelo}</p></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">Precio base</label><input type="number" step="0.01" min="0" className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" value={pb} onChange={e=>setPb(e.target.value)}/></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">Stock</label><input type="number" min="0" className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none" value={stk} onChange={e=>setStk(e.target.value)}/></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">Imagen URL</label><input className="w-full px-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="https://..." value={img} onChange={e=>setImg(e.target.value)}/>
              {img&&<img src={img} className="mt-2 h-20 object-contain rounded-lg" onError={e=>e.target.style.display="none"}/>}</div>
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">Notas (admin)</label><input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Observaciones..." value={notas} onChange={e=>setNotas(e.target.value)}/></div>
            <div><label className="text-sm font-medium text-slate-700 mb-2 block">Precios fijos por lista</label><p className="text-xs text-slate-400 mb-2">Dejá en 0 para usar el automático</p>
              {listas.map(t=><div key={t.id} className="flex items-center gap-2 mb-2"><span className="text-xs font-medium w-28 truncate" style={{color:t.color}}>{t.nombre}</span>
                <span className="text-xs text-slate-400 w-16">Auto: {fmt((parseFloat(pb)||0)*t.multiplicador)}</span>
                <input type="number" step="0.01" min="0" className="flex-1 px-2 py-1.5 border rounded-lg text-sm" placeholder="0" value={fp[t.id]||""} onChange={e=>{const v=parseFloat(e.target.value);const n={...fp};if(v>0)n[t.id]=v;else delete n[t.id];setFp(n);}}/></div>)}</div>
            <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
              {sv?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>} {sv?"Guardando...":"Guardar"}</button>
          </div>
        </div>
      </div>);
  };

  // ── Add Product Manual Modal ──
  const AddProdModal_C = () => {
    const [f,setF]=useState({categoria:"",categoriaNew:"",modelo:"",precio_base:""}); const [sv,setSv]=useState(false);
    const save=async()=>{const cat=f.categoriaNew||f.categoria;if(!cat||!f.modelo||!f.precio_base){showToast("Completá todos los campos");return;}
      setSv(true);try{await API.createProducto({categoria:cat,modelo:f.modelo,precio_base:parseFloat(f.precio_base)||0});
      showToast("Producto creado");setAddProdModal(false);await loadProductos(page,searchDebounced,catFilter);const cats=await API.getCategorias().catch(()=>[]);setCategorias(Array.isArray(cats)?cats:[]);
    }catch(e){showToast("Error: "+e.message);}setSv(false);};
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"><div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
        <div className="flex justify-between items-center"><h3 className="font-bold">Agregar Producto</h3><button onClick={()=>setAddProdModal(false)}><X className="w-5 h-5"/></button></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Categoría existente</label>
          <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value,categoriaNew:""})}>
            <option value="">— Seleccionar —</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">O categoría nueva</label>
          <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre de categoría nueva" value={f.categoriaNew} onChange={e=>setF({...f,categoriaNew:e.target.value,categoria:""})}/></div>
        <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Modelo" value={f.modelo} onChange={e=>setF({...f,modelo:e.target.value})}/>
        <input type="number" step="0.01" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Precio base (USD)" value={f.precio_base} onChange={e=>setF({...f,precio_base:e.target.value})}/>
        <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">{sv?"Guardando...":"Crear producto"}</button>
      </div></div>);
  };

  // ── Import Excel Modal ──
  const ImportModal_C = () => {
    const [file,setFile]=useState(null);const [data,setData]=useState(null);const [upl,setUpl]=useState(false);const [res,setRes]=useState("");const [repl,setRepl]=useState(false);const fr=useRef(null);
    const handle=(e)=>{const f=e.target.files[0];if(!f)return;setFile(f);setRes("");const reader=new FileReader();
      reader.onload=(evt)=>{try{const wb=XLSX.read(evt.target.result,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
        if(!rows.length){setRes("Excel vacío");return;}const keys=Object.keys(rows[0]);
        const cC=keys.find(k=>/producto|categor|tipo/i.test(k))||keys[0];const cM=keys.find(k=>/modelo|model|nombre/i.test(k))||keys[1];const cP=keys.find(k=>/precio|price|costo/i.test(k))||keys[2];
        const prods=rows.filter(r=>r[cC]&&r[cM]).map(r=>({categoria:String(r[cC]).trim(),modelo:String(r[cM]).trim(),precio_base:parseFloat(r[cP])||0}));
        setData({productos:prods,cC,cM,cP,total:prods.length});}catch(err){setRes("Error: "+err.message);}};reader.readAsArrayBuffer(f);};
    const doUp=async()=>{if(!data?.productos?.length)return;setUpl(true);setRes("");try{
      const r=await API.bulkProductos(data.productos,repl);setRes(`✅ ${r.insertados??r.count??data.total} productos cargados`);
      setData(null);setFile(null);if(fr.current)fr.current.value="";await loadProductos(1,"","");
      const cats=await API.getCategorias().catch(()=>[]);setCategorias(Array.isArray(cats)?cats:[]);
    }catch(e){setRes("❌ "+e.message);}setUpl(false);};
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"><div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center"><h3 className="font-bold">Importar Excel</h3><button onClick={()=>setImportModal(false)}><X className="w-5 h-5"/></button></div>
        <p className="text-xs text-slate-400">Columnas: PRODUCTO (categoría), MODELO, PRECIO</p>
        <input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={handle} className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-medium file:cursor-pointer"/>
        {data&&<div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
          <p className="text-sm text-blue-800 font-medium">{data.total} productos encontrados</p>
          <p className="text-xs text-blue-600">Columnas: {data.cC} → categoría, {data.cM} → modelo, {data.cP} → precio</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={repl} onChange={e=>setRepl(e.target.checked)} className="w-4 h-4 rounded"/>Reemplazar todo (borra existentes)</label>
          <button onClick={doUp} disabled={upl} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
            {upl?<Loader2 className="w-4 h-4 animate-spin"/>:<Upload className="w-4 h-4"/>} {upl?"Cargando...":`Cargar ${data.total} productos`}</button></div>}
        {res&&<p className={`text-sm font-medium ${res.startsWith("✅")?"text-emerald-700":"text-red-600"}`}>{res}</p>}
      </div></div>);
  };

  // ── Cart Panel ──
  const CartPanel = () => (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-800">{presupuesto?"Presupuesto":"Carrito"} ({cartCount})</h3>
          <div className="flex items-center gap-2">
            <button onClick={()=>setPresupuesto(!presupuesto)} className={`text-xs px-2 py-1 rounded-full ${presupuesto?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-500"}`}>
              {presupuesto?"Modo presupuesto":"Modo pedido"}</button>
            <button onClick={()=>{setShowCart(false);setCheckout(false);}}><X className="w-5 h-5"/></button>
          </div>
        </div>
        {checkout ? (
          <div className="p-4 overflow-y-auto flex-1 space-y-4">
            <div><label className="text-sm font-medium text-slate-700 mb-2 block">Tipo de entrega</label>
              <div className="flex gap-2">
                <button onClick={()=>setCheckoutType("retiro")} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 ${checkoutType==="retiro"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}><Store className="w-4 h-4"/> Retiro</button>
                <button onClick={()=>setCheckoutType("envio")} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 ${checkoutType==="envio"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}><Truck className="w-4 h-4"/> Envío</button>
              </div></div>
            {checkoutType==="envio"&&<div><label className="text-sm font-medium text-slate-700 mb-1 block">Dirección *</label>
              <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={2} value={checkoutAddr} onChange={e=>setCheckoutAddr(e.target.value)} placeholder="Calle, número, localidad..."/></div>}
            <div><label className="text-sm font-medium text-slate-700 mb-1 block">Notas</label>
              <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={2} value={checkoutNotes} onChange={e=>setCheckoutNotes(e.target.value)} placeholder="Observaciones..."/></div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="flex justify-between text-sm"><span>Productos</span><span className="font-semibold">{cartCount}</span></div>
              <div className="flex justify-between text-lg mt-1"><span className="font-bold">Total</span><span className="font-bold text-blue-600">{fmt(cartTotal)}</span></div>
              {dolarBlue&&<div className="flex justify-between text-xs text-slate-400 mt-1"><span>En pesos</span><span>{fmtARS(cartTotal*dolarBlue)}</span></div>}
              {minCompra>0&&!cartMeetsMin&&<p className="text-xs text-red-500 mt-2">Compra mínima: {fmt(minCompra)}</p>}
            </div>
            <div className="flex gap-2">
              <button onClick={placeOrder} disabled={loading||!cartMeetsMin||(checkoutType==="envio"&&!checkoutAddr)}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>} Confirmar</button>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 p-4">
              {cart.length===0?<div className="text-center py-12 text-slate-400"><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Vacío</p></div>
              :cart.map(item=>{const price=userLista?getPrice(item.precio_base,userLista,pfMap,item.id):0;return(
                <div key={item.id} className="flex items-center gap-3 py-3 border-b border-slate-50">
                  <div className="flex-1 min-w-0"><p className="text-xs text-slate-400 truncate">{item.categoria}</p><p className="text-sm font-semibold text-slate-800 truncate">{item.modelo}</p>
                    <p className="text-sm font-bold text-blue-600">{fmt(price)} <span className="text-xs text-slate-400 font-normal">= {fmt(price*item.qty)}</span></p></div>
                  <div className="flex items-center gap-1">
                    <input type="number" min="1" value={item.qty} onChange={e=>setCart(prev=>prev.map(c=>c.id===item.id?{...c,qty:Math.max(1,parseInt(e.target.value)||1)}:c))}
                      className="w-14 px-1 py-1.5 border rounded-lg text-center text-sm"/>
                    <button onClick={()=>setCart(prev=>prev.filter(c=>c.id!==item.id))} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </div>);})}
            </div>
            {cart.length>0&&<div className="p-4 border-t bg-white shrink-0">
              <div className="flex justify-between text-lg mb-3"><span className="font-bold">Total</span><span className="font-bold text-blue-600">{fmt(cartTotal)}</span></div>
              <div className="flex gap-2">
                {!presupuesto&&<button onClick={()=>setCheckout(true)} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">Finalizar pedido</button>}
                {presupuesto&&<button onClick={()=>{printRemito({id:"PRESUP",items:cart.map(i=>({categoria:i.categoria,modelo:i.modelo,cantidad:i.qty,precio_unitario:getPrice(i.precio_base,userLista,pfMap,i.id)})),total:cartTotal,tipo_entrega:"",fecha:new Date().toISOString()},"A4")}} className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2"><Printer className="w-4 h-4"/> Imprimir presupuesto</button>}
                <button onClick={shareCart} className="py-3 px-3 bg-slate-100 hover:bg-slate-200 rounded-xl" title="Compartir carrito"><Share2 className="w-4 h-4"/></button>
                <button onClick={()=>setCart([])} className="py-3 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm">Vaciar</button>
              </div>
            </div>}
          </>
        )}
      </div>
    </div>
  );

  // ── User Modal ──
  const UserModal = () => {
    const u = editUser; if (!u) return null;
    const isPending = u.estado === "pendiente";
    const [form,setForm]=useState({nombre:u.nombre||"",usuario:u.usuario||"",telefono:u.telefono||"",rol:u.rol||"client",lista_precio_id:u.lista_precio_id||listas[0]?.id});
    const [sv,setSv]=useState(false);
    const save=async()=>{setSv(true);try{await API.updateUsuario(u.id,form);showToast("Usuario actualizado");setEditUser(null);await refreshAdmin();}catch(e){showToast("Error: "+e.message);}setSv(false);};
    const aprobar=async(lid)=>{setSv(true);try{await API.aprobarUsuario(u.id,lid);showToast("Usuario aprobado");setEditUser(null);await refreshAdmin();}catch(e){showToast("Error: "+e.message);}setSv(false);};
    const rechazar=async()=>{setSv(true);try{await API.rechazarUsuario(u.id);showToast("Rechazado");setEditUser(null);await refreshAdmin();}catch(e){showToast("Error: "+e.message);}setSv(false);};
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"><div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center"><h3 className="font-bold">{isPending?"Aprobar usuario":"Editar usuario"}</h3><button onClick={()=>setEditUser(null)}><X className="w-5 h-5"/></button></div>
        {isPending&&<div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800"><Clock className="w-4 h-4 inline mr-1"/>Pendiente de aprobación</div>}
        <div className="bg-slate-50 rounded-xl p-3"><p className="font-semibold">{u.nombre}</p><p className="text-sm text-slate-500">@{u.usuario} {u.telefono?`• ${u.telefono}`:""}</p></div>
        {isPending?(
          <div className="space-y-3"><label className="text-sm font-medium block">Asignar lista:</label>
            {listas.map(l=><button key={l.id} onClick={()=>aprobar(l.id)} disabled={sv} className="w-full py-2.5 border rounded-xl text-sm font-medium flex items-center justify-between px-3 hover:bg-blue-50 disabled:opacity-50">
              <span style={{color:l.color}}>{l.nombre}</span><span className="text-xs text-slate-400">{l.modo==="porcentaje"?`+${Math.round((l.multiplicador-1)*100)}%`:`×${l.multiplicador}`}</span></button>)}
            <button onClick={rechazar} disabled={sv} className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium">Rechazar</button></div>
        ):(
          <div className="space-y-3">
            <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre" value={form.nombre} onChange={e=>setForm({...form,nombre:e.target.value})}/>
            <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Teléfono" value={form.telefono} onChange={e=>setForm({...form,telefono:e.target.value})}/>
            <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={form.rol} onChange={e=>setForm({...form,rol:e.target.value})}><option value="client">Cliente</option><option value="admin">Admin</option></select>
            <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={form.lista_precio_id} onChange={e=>setForm({...form,lista_precio_id:e.target.value})}>
              {listas.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
            <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">{sv?"Guardando...":"Guardar"}</button>
          </div>
        )}
      </div></div>);
  };

  // ── Tier Modal ──
  const TierModal = () => {
    const isNew=editTier==="new";
    const [f,setF]=useState(isNew?{id:"",nombre:"",multiplicador:1,modo:"porcentaje",color:"#2563eb",compra_minima:0}:{...editTier,modo:editTier.modo||"multiplicador",compra_minima:editTier.compra_minima||0});
    const [inputVal,setInputVal]=useState(()=>f.modo==="porcentaje"?Math.round((f.multiplicador-1)*100):f.multiplicador);
    const [sv,setSv]=useState(false);
    const calcMult=()=>f.modo==="porcentaje"?1+inputVal/100:inputVal;
    const save=async()=>{if(!f.nombre)return;setSv(true);try{
      const obj={...f,multiplicador:calcMult()};
      const updated=isNew?[...listas,{...obj,id:f.nombre.toLowerCase().replace(/\s/g,"_")}]:listas.map(t=>t.id===f.id?obj:t);
      await API.updateListas(updated);setListas(updated);setEditTier(null);showToast("Lista guardada");
    }catch(e){showToast("Error: "+e.message);}setSv(false);};
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"><div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
        <div className="flex justify-between items-center"><h3 className="font-bold">{isNew?"Nueva Lista":"Editar Lista"}</h3><button onClick={()=>setEditTier(null)}><X className="w-5 h-5"/></button></div>
        <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})}/>
        <div><label className="text-xs text-slate-500 mb-1 block">Modo de cálculo</label>
          <div className="flex gap-2">
            <button onClick={()=>{setF({...f,modo:"porcentaje"});setInputVal(Math.round((f.multiplicador-1)*100));}} className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 ${f.modo==="porcentaje"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}>Porcentaje (+%)</button>
            <button onClick={()=>{setF({...f,modo:"multiplicador"});setInputVal(f.multiplicador);}} className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 ${f.modo==="multiplicador"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}>Multiplicador (×)</button>
          </div></div>
        <div className="flex gap-2">
          <div className="flex-1"><label className="text-xs text-slate-500 mb-1 block">{f.modo==="porcentaje"?"Porcentaje":"Multiplicador"}</label>
            <input type="number" step={f.modo==="porcentaje"?"1":"0.05"} className="w-full px-3 py-2.5 border rounded-xl text-sm" value={inputVal}
              onChange={e=>{const v=parseFloat(e.target.value)||0;setInputVal(v);setF({...f,multiplicador:f.modo==="porcentaje"?1+v/100:v});}}/></div>
          <div className="w-20"><label className="text-xs text-slate-500 mb-1 block">Color</label>
            <input type="color" className="w-full h-[42px] rounded-xl border cursor-pointer" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></div></div>
        <div><label className="text-xs text-slate-500 mb-1 block">Compra mínima (USD, 0 = sin mínimo)</label>
          <input type="number" step="1" min="0" className="w-full px-3 py-2.5 border rounded-xl text-sm" value={f.compra_minima} onChange={e=>setF({...f,compra_minima:parseFloat(e.target.value)||0})}/></div>
        <p className="text-xs text-slate-400">Base $1.00 → {f.modo==="porcentaje"?`+${inputVal}%`:""} = {fmt(1*calcMult())}</p>
        <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">{sv?"Guardando...":"Guardar"}</button>
      </div></div>);
  };

  // ── Status Badge ──
  const StatusBadge = ({status}) => {
    const m={pendiente:"bg-amber-100 text-amber-700",preparando:"bg-blue-100 text-blue-700",listo:"bg-emerald-100 text-emerald-700",entregado:"bg-slate-100 text-slate-500",cancelado:"bg-red-100 text-red-600"};
    return <span className={`text-xs px-2 py-1 rounded-full font-medium ${m[status]||m.pendiente}`}>{status}</span>;
  };

  // ═══════════════════════════════════════════════════
  // ADMIN PANEL
  // ═══════════════════════════════════════════════════
  const AdminPanel = () => {
    const [ajuste,setAjuste]=useState({porcentaje:"",categoria:""});const [ajustando,setAjustando]=useState(false);

    // Dashboard home
    if (adminTab==="home") return (
      <div className="p-4 max-w-4xl mx-auto">
        <h2 className="font-bold text-lg mb-4">Panel de Administración</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[["products","Productos",Package,"blue"],["users","Usuarios",Users,"violet"],["orders","Pedidos",ClipboardList,"amber"],["tiers","Listas",DollarSign,"emerald"],["stats","Estadísticas",BarChart3,"cyan"],["config","Configuración",Settings,"slate"]].map(([id,label,Icon,color])=>(
            <button key={id} onClick={()=>setAdminTab(id)} className="bg-white border rounded-xl p-4 text-center hover:shadow-md transition-shadow">
              <Icon className={`w-8 h-8 mx-auto mb-2 text-${color}-500`}/><p className="text-sm font-semibold text-slate-700">{label}</p>
              {id==="users"&&pendientesCount>0&&<span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full mt-1 inline-block">{pendientesCount} pendientes</span>}
            </button>))}
        </div>
      </div>);

    return (
    <div className="p-4 max-w-4xl mx-auto">
      <button onClick={()=>setAdminTab("home")} className="text-sm text-blue-600 flex items-center gap-1 mb-3 hover:underline"><ArrowLeft className="w-3.5 h-3.5"/> Volver al panel</button>
      <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
        {[["products","Productos",Package],["users","Usuarios",Users],["orders","Pedidos",ClipboardList],["tiers","Listas",DollarSign],["stats","Stats",BarChart3],["config","Config",Settings]].map(([id,label,Icon])=>(
          <button key={id} onClick={()=>setAdminTab(id)} className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 ${adminTab===id?"bg-blue-600 text-white":"bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            <Icon className="w-3.5 h-3.5"/>{label}</button>))}
      </div>

      {/* Products */}
      {adminTab==="products"&&<div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>setAddProdModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4"/>Agregar producto</button>
          <button onClick={()=>setImportModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Upload className="w-4 h-4"/>Importar Excel</button>
        </div>
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Percent className="w-4 h-4"/>Ajustar precios</h4>
          <div className="flex gap-2">
            <input type="number" placeholder="% (ej: 10, -5)" className="flex-1 px-3 py-2 border rounded-xl text-sm" value={ajuste.porcentaje} onChange={e=>setAjuste({...ajuste,porcentaje:e.target.value})}/>
            <select className="px-3 py-2 border rounded-xl text-sm" value={ajuste.categoria} onChange={e=>setAjuste({...ajuste,categoria:e.target.value})}>
              <option value="">Todas</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
          <div className="flex gap-2">
            <button disabled={ajustando||!ajuste.porcentaje} onClick={async()=>{setAjustando(true);try{await API.ajustarPrecios(parseFloat(ajuste.porcentaje),ajuste.categoria||null);showToast("Ajustado");await loadProductos(page,searchDebounced,catFilter);}catch(e){showToast("Error: "+e.message);}setAjustando(false);}}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">Aplicar</button>
            <button disabled={ajustando} onClick={async()=>{setAjustando(true);try{await API.resetPrecios();showToast("Reseteados");await loadProductos(page,searchDebounced,catFilter);}catch(e){showToast("Error: "+e.message);}setAjustando(false);}}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium disabled:opacity-50">Resetear</button></div></div>
        <div className="bg-white border border-red-200 rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-sm text-red-600 flex items-center gap-2"><AlertTriangle className="w-4 h-4"/>Zona peligrosa</h4>
          <div className="flex gap-2 flex-wrap">
            <button onClick={async()=>{if(!confirm("¿Eliminar TODOS los productos?"))return;try{await API.deleteAllProductos();showToast("Eliminados");await loadProductos(1,"","");const c=await API.getCategorias().catch(()=>[]);setCategorias(Array.isArray(c)?c:[]);}catch(e){showToast("Error: "+e.message);}}}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium">Borrar todos</button>
          </div></div>
      </div>}

      {/* Users */}
      {adminTab==="users"&&<div>
        <button onClick={refreshAdmin} className="mb-3 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Actualizar</button>
        {usuarios.filter(u=>u.estado==="pendiente").length>0&&<div className="mb-4"><h4 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4"/>Pendientes</h4>
          <div className="space-y-2">{usuarios.filter(u=>u.estado==="pendiente").map(u=>(
            <div key={u.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
              <div><p className="font-semibold text-sm">{u.nombre}</p><p className="text-xs text-slate-500">@{u.usuario} {u.telefono?`• ${u.telefono}`:""}</p></div>
              <button onClick={()=>setEditUser(u)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Revisar</button></div>))}</div></div>}
        <div className="space-y-2">{usuarios.filter(u=>u.estado!=="pendiente").map(u=>(
          <div key={u.id} className="flex items-center justify-between bg-white border rounded-xl p-3">
            <div><p className="font-semibold text-sm">{u.nombre}</p>
              <p className="text-xs text-slate-500">@{u.usuario} • {u.rol==="admin"?"Admin":listas.find(l=>l.id===u.lista_precio_id)?.nombre||u.lista_precio_id}</p></div>
            <div className="flex gap-1">
              <button onClick={()=>setEditUser(u)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"><Edit2 className="w-3.5 h-3.5"/></button>
              {u.rol!=="admin"&&<button onClick={async()=>{try{await API.deleteUsuario(u.id);showToast("Eliminado");await refreshAdmin();}catch(e){showToast("Error: "+e.message);}}}
                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}
            </div></div>))}</div>
        {/* Client ranking */}
        {clientRanking.length>0&&<div className="mt-6"><h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5"><TrendingUp className="w-4 h-4"/>Ranking de clientes</h4>
          <div className="space-y-1">{clientRanking.slice(0,10).map((c,i)=>(
            <div key={c.nombre} className="flex items-center justify-between bg-white border rounded-lg p-2">
              <span className="text-sm"><span className="font-bold text-slate-400 mr-2">#{i+1}</span>{c.nombre}</span>
              <span className="text-sm font-bold text-blue-600">{fmt(c.total)} <span className="text-xs text-slate-400 font-normal">({c.pedidos})</span></span></div>))}</div></div>}
      </div>}

      {/* Orders */}
      {adminTab==="orders"&&<div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1 overflow-x-auto">{["all","pendiente","preparando","listo","entregado","cancelado"].map(s=>(
            <button key={s} onClick={()=>setOrderFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${orderFilter===s?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}>{s==="all"?"Todos":s}</button>))}</div>
          <button onClick={exportOrders} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-medium flex items-center gap-1"><Download className="w-3 h-3"/>Excel</button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">{pedidos.filter(o=>orderFilter==="all"||o.estado===orderFilter).map(o=>(
          <div key={o.id} className="bg-white border rounded-xl p-3">
            <div className="flex justify-between items-start mb-2">
              <div><p className="font-semibold text-sm">{o.usuario_nombre||"—"}</p>
                <p className="text-xs text-slate-500">{new Date(o.fecha||o.created_at).toLocaleString("es-AR")} • {o.tipo_entrega==="retiro"?"Retiro":"Envío"}</p>
                {o.direccion&&<p className="text-xs text-slate-500">📍 {o.direccion}</p>}</div>
              <div className="text-right"><p className="font-bold text-blue-600">{fmt(o.total)}</p><StatusBadge status={o.estado}/>
                {o.items&&<p className="text-[10px] text-emerald-600 mt-0.5">Ganancia: {fmt(o.total - (o.items||[]).reduce((s,i)=>(s+(i.precio_base||0)*(i.cantidad||i.qty||0)),0))}</p>}</div>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5 mb-2">{(o.items||[]).map((i,idx)=><p key={idx}>{i.categoria} - {i.modelo} ×{i.cantidad||i.qty} = {fmt((i.precio_unitario||i.unitPrice)*(i.cantidad||i.qty))}</p>)}</div>
            {o.notas&&<p className="text-xs text-slate-500 italic mb-2">Nota: {o.notas}</p>}
            <div className="flex gap-1 flex-wrap">
              {["pendiente","preparando","listo","entregado","cancelado"].filter(s=>s!==o.estado).map(s=>(
                <button key={s} onClick={async()=>{try{await API.updatePedido(o.id,{estado:s});const ords=await API.getPedidos().catch(()=>[]);setPedidos(Array.isArray(ords)?ords:[]);showToast("Actualizado");}catch(e){showToast("Error: "+e.message);}}}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600">→ {s}</button>))}
              <button onClick={()=>cloneOrder(o)} className="px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-600">Repetir</button>
              <div className="relative group">
                <button className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600 flex items-center gap-1"><Printer className="w-3 h-3"/>Imprimir</button>
                <div className="absolute bottom-full right-0 mb-1 bg-white border rounded-lg shadow-lg p-1 hidden group-hover:block z-10">
                  {["A4","80mm","50mm","100mm"].map(f=><button key={f} onClick={()=>printRemito(o,f)} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 whitespace-nowrap">{f}</button>)}
                </div></div>
            </div>
          </div>))}
          {pedidos.filter(o=>orderFilter==="all"||o.estado===orderFilter).length===0&&<p className="text-center text-slate-400 py-8 text-sm">Sin pedidos</p>}
        </div>
      </div>}

      {/* Tiers */}
      {adminTab==="tiers"&&<div>
        <button onClick={()=>setEditTier("new")} className="mb-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4"/>Nueva lista</button>
        <div className="space-y-2">{listas.map(t=>(
          <div key={t.id} className="flex items-center justify-between bg-white border rounded-xl p-3">
            <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{backgroundColor:t.color}}/>
              <div><p className="font-semibold text-sm">{t.nombre}</p>
                <p className="text-xs text-slate-500">{t.modo==="porcentaje"?`+${Math.round((t.multiplicador-1)*100)}%`:`×${t.multiplicador}`} • Base $1 → {fmt(1*t.multiplicador)}
                  {t.compra_minima>0&&` • Mín: ${fmt(t.compra_minima)}`}</p></div></div>
            <div className="flex gap-1">
              <button onClick={()=>setEditTier(t)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"><Edit2 className="w-3.5 h-3.5"/></button>
              {listas.length>1&&<button onClick={async()=>{try{const u=listas.filter(x=>x.id!==t.id);await API.updateListas(u);setListas(u);showToast("Eliminada");}catch(e){showToast("Error: "+e.message);}}}
                className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}
            </div></div>))}</div></div>}

      {/* Stats */}
      {adminTab==="stats"&&<div className="space-y-4">
        <button onClick={refreshAdmin} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Actualizar</button>
        {stats&&<div className="grid grid-cols-2 gap-3">
          {[["Productos",stats.total_productos,Package],["Con stock",stats.con_stock,Check],["Usuarios",stats.total_usuarios,Users],["Pedidos",stats.total_pedidos,ClipboardList]].map(([l,v,Icon])=>(
            <div key={l} className="bg-white border rounded-xl p-4 text-center"><Icon className="w-6 h-6 mx-auto mb-2 text-blue-500"/><p className="text-2xl font-bold">{v??"—"}</p><p className="text-xs text-slate-500">{l}</p></div>))}</div>}
        {profitData&&<div className="bg-white border rounded-xl p-4">
          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4"/>Ganancias estimadas</h4>
          <div className="grid grid-cols-2 gap-3">
            {[["Hoy",profitData.hoy],["Semana",profitData.semana],["Mes",profitData.mes],["Año",profitData.año]].map(([label,d])=>(
              <div key={label} className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{label}</p>
                <p className="text-lg font-bold text-emerald-600">{fmt(d.profit)}</p>
                <p className="text-[10px] text-slate-400">Vendido: {fmt(d.revenue)}</p></div>))}
          </div></div>}
      </div>}

      {/* Config */}
      {adminTab==="config"&&<div className="space-y-4">
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Nombre del negocio</label>
          <input className="w-full px-3 py-2.5 border rounded-xl text-sm" value={config.nombre_negocio||""} onChange={e=>setConfigState({...config,nombre_negocio:e.target.value})}/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">WhatsApp (sin +)</label>
          <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="5491100000000" value={config.whatsapp||""} onChange={e=>setConfigState({...config,whatsapp:e.target.value})}/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Logo</label>
          <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setConfigState({...config,logo:ev.target.result});r.readAsDataURL(f);}}
            className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-medium file:cursor-pointer"/>
          {config.logo&&<img src={config.logo} className="mt-2 h-16 object-contain rounded-lg"/>}</div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Lista para Vitrina</label>
          <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={config.vitrina_lista||""} onChange={e=>setConfigState({...config,vitrina_lista:e.target.value})}>
            {listas.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Info de pagos (visible para clientes)</label>
          <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={3} value={config.info_pagos||""} onChange={e=>setConfigState({...config,info_pagos:e.target.value})} placeholder="Métodos de pago, datos bancarios..."/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Info de envíos (visible para clientes)</label>
          <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={3} value={config.info_envios||""} onChange={e=>setConfigState({...config,info_envios:e.target.value})} placeholder="Política de envíos, zonas, costos..."/></div>
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4"/>Mantenimiento</h4>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={mantForm.activo} onChange={e=>setMantForm({...mantForm,activo:e.target.checked})} className="w-4 h-4 rounded"/>Activar mantenimiento</label>
          <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Mensaje" value={mantForm.mensaje} onChange={e=>setMantForm({...mantForm,mensaje:e.target.value})}/>
          <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Estimado (ej: 30 min)" value={mantForm.countdown} onChange={e=>setMantForm({...mantForm,countdown:e.target.value})}/>
          <button onClick={async()=>{try{await API.setMaintenanceMode(mantForm.activo,mantForm.mensaje,mantForm.countdown);showToast(mantForm.activo?"Mantenimiento ON":"Mantenimiento OFF");}catch(e){showToast("Error: "+e.message);}}}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium">Guardar mantenimiento</button></div>
        <button onClick={()=>API.updateConfig(config).then(()=>showToast("Config guardada")).catch(e=>showToast("Error: "+e.message))}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"><Save className="w-4 h-4"/>Guardar configuración</button>
      </div>}
    </div>);
  };

  // ── Orders View (client) ──
  const OrdersView = () => {
    const myOrders = isAdmin ? pedidos : pedidos.filter(o=>o.usuario_id===user?.id);
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <h2 className="font-bold text-lg text-slate-800 mb-4">{isAdmin?"Todos los Pedidos":"Mis Pedidos"}</h2>
        {myOrders.length===0?<div className="text-center py-12 text-slate-400"><ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Sin pedidos</p></div>
        :myOrders.map(o=>(
          <div key={o.id} className="bg-white border rounded-xl p-3 mb-2">
            <div className="flex justify-between items-start mb-2">
              <div><p className="text-xs text-slate-500">{new Date(o.fecha||o.created_at).toLocaleString("es-AR")}</p>
                <p className="text-xs text-slate-500 mt-0.5">{o.tipo_entrega==="retiro"?"📦 Retiro":"🚚 Envío"}{o.direccion?` - ${o.direccion}`:""}</p></div>
              <div className="text-right"><p className="font-bold text-blue-600">{fmt(o.total)}</p><StatusBadge status={o.estado}/></div>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">{(o.items||[]).map((i,idx)=><p key={idx}>{i.categoria} - {i.modelo} ×{i.cantidad||i.qty}</p>)}</div>
            <button onClick={()=>cloneOrder(o)} className="mt-2 text-xs text-blue-600 hover:underline">Repetir este pedido</button>
          </div>))}
      </div>);
  };

  // ═══════════════════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {config.logo?<img src={config.logo} className="h-6 object-contain"/>:<Store className="w-4 h-4"/>}
          <span className="font-bold text-sm">{config.nombre_negocio||"Mi Depósito"}</span>
          {vitrina&&<span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium">VITRINA</span>}
          {dolarBlue&&<span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded-full">USD Blue: {fmtARS(dolarBlue)}</span>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {!vitrina&&user&&<>
            <span className="hidden sm:inline text-blue-200">{user.nombre}</span>
            {userLista&&<span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{backgroundColor:userLista.color+"33",color:userLista.color}}>{userLista.nombre}</span>}
          </>}
          <button onClick={doLogout} className="p-1.5 rounded-lg hover:bg-white/10"><LogOut className="w-4 h-4"/></button>
        </div>
      </div>

      {/* Search header */}
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="flex items-center gap-2 px-3 py-2">
          <button onClick={()=>setShowCats(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 shrink-0"><Menu className="w-5 h-5 text-slate-700"/></button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <input className="w-full pl-9 pr-3 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
              placeholder="Buscar producto o modelo..." value={search} onChange={e=>setSearch(e.target.value)}/>
            {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400"/></button>}
          </div>
          <button onClick={()=>setShowCart(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 shrink-0 relative">
            <ShoppingCart className="w-5 h-5 text-slate-700"/>
            {cartCount>0&&<span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        </div>
        {(catFilter||brandFilter)&&<div className="px-3 pb-2 flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtro:</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium truncate max-w-[200px]">{catFilter||brandFilter}</span>
          <button onClick={()=>{setCatFilter("");setBrandFilter("");}} className="text-xs text-red-500 underline">limpiar</button>
        </div>}
      </header>

      <main>
        {view==="catalog"&&(
          <div className="p-3">
            {loading&&productos.length===0?<div className="text-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3"/></div>
            :displayProducts.length===0?<div className="text-center py-16 text-slate-400"><Search className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Sin resultados</p>
              <button onClick={()=>{setSearch("");setCatFilter("");setBrandFilter("");}} className="mt-3 text-sm text-blue-600 underline">Ver todos</button></div>
            :<>
              {/* Cross-search results banner */}
              {crossResults&&<div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                <p className="text-sm text-blue-800 font-medium">"{searchDebounced}" encontrado en {crossResults.categories.length} categorías ({crossResults.total} productos)</p>
                <div className="flex flex-wrap gap-1 mt-2">{crossResults.categories.map(([cat,items])=>(
                  <button key={cat} onClick={()=>{setCatFilter(cat);setBrandFilter("");}} className="text-xs px-2 py-1 rounded-full bg-white border border-blue-200 text-blue-700 hover:bg-blue-100">
                    <span className="w-2 h-2 rounded-full inline-block mr-1" style={{backgroundColor:getCatColor(cat)}}/>{cat} ({items.length})</button>))}</div></div>}

              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">{totalProductos} productos</p>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setStockFilter(!stockFilter)} className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${stockFilter?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}>
                    <Filter className="w-3 h-3"/>{stockFilter?"Con stock":"Stock"}</button>
                  <select className="text-xs px-2 py-1 border rounded-lg" value={pageSize} onChange={e=>{setPageSize(parseInt(e.target.value));setPage(1);}}>
                    {[60,100,200].map(n=><option key={n} value={n}>{n}/pág</option>)}</select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">{displayProducts.map(p=><ProductCard key={p.id} p={p}/>)}</div>
              {totalProductos>pageSize&&<div className="flex items-center justify-center gap-2 mt-4 py-4">
                <button disabled={page<=1||loading} onClick={()=>loadProductos(page-1,searchDebounced,catFilter)} className="px-4 py-2 bg-white border rounded-xl text-sm font-medium disabled:opacity-30">← Anterior</button>
                <span className="text-sm text-slate-500">Pág. {page}</span>
                <button disabled={displayProducts.length<pageSize||loading} onClick={()=>loadProductos(page+1,searchDebounced,catFilter)} className="px-4 py-2 bg-white border rounded-xl text-sm font-medium disabled:opacity-30">Siguiente →</button>
              </div>}
            </>}
          </div>
        )}
        {view==="admin"&&isAdmin&&<AdminPanel/>}
        {view==="orders"&&<OrdersView/>}
        {view==="account"&&!vitrina&&(
          <div className="p-4 max-w-md mx-auto">
            <div className="bg-white rounded-2xl border p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><User className="w-8 h-8 text-blue-600"/></div>
              <h3 className="font-bold text-lg">{user?.nombre}</h3><p className="text-sm text-slate-500 mt-1">@{user?.usuario}</p>
              {userLista&&<div className="mt-2 inline-flex px-3 py-1 rounded-full text-sm font-medium" style={{backgroundColor:userLista.color+"15",color:userLista.color}}>{userLista.nombre}</div>}
              {/* Client info */}
              {(config.info_pagos||config.info_envios)&&<div className="mt-4 text-left space-y-3">
                {config.info_pagos&&<div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-bold text-slate-500 mb-1">Métodos de pago</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{config.info_pagos}</p></div>}
                {config.info_envios&&<div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-bold text-slate-500 mb-1">Envíos</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{config.info_envios}</p></div>}
              </div>}
              <button onClick={doLogout} className="w-full mt-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2"><LogOut className="w-4 h-4"/>Cerrar sesión</button>
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-30 px-2 pb-safe">
        <div className="flex justify-around py-1.5">
          {[["catalog","Catálogo",Package],...(isAdmin?[["admin","Admin",Settings]]:[]),["orders","Pedidos",ClipboardList],...(!vitrina?[["account","Cuenta",User]]:[])].map(([id,label,Icon])=>(
            <button key={id} onClick={()=>{setView(id);if(id==="admin")setAdminTab("home");}}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${view===id?"text-blue-600":"text-slate-400"}`}>
              <Icon className="w-5 h-5"/><span className="text-[10px] font-medium">{label}</span></button>))}
        </div>
      </nav>

      {/* Floating cart */}
      {cartCount>0&&!showCart&&<button onClick={()=>setShowCart(true)}
        className="fixed bottom-20 right-4 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-3 shadow-lg shadow-blue-600/30 flex items-center gap-2">
        <ShoppingCart className="w-5 h-5"/><span className="font-bold text-sm">{cartCount}</span><span className="text-xs opacity-80">|</span><span className="font-bold text-sm">{fmt(cartTotal)}</span></button>}

      {/* Modals */}
      <CatSidebar/>{showCart&&<CartPanel/>}{editProduct&&<EditProductModal/>}{addProdModal&&<AddProdModal_C/>}{importModal&&<ImportModal_C/>}
      {editUser&&<UserModal/>}{editTier&&<TierModal/>}

      {/* Toast */}
      {toast&&<div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
    </div>
  );
}
