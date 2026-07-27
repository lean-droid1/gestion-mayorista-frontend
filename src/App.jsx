import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search, ShoppingCart, User, LogOut, Package, Settings, Eye, Edit2,
  Trash2, Plus, Minus, Phone, Truck, Store, Users, DollarSign,
  AlertTriangle, Check, X, Menu, Filter, ClipboardList, Save,
  ChevronDown, ChevronRight, RefreshCw, UserPlus, Clock, Shield,
  BarChart3, Loader2, WifiOff, ArrowLeft, Percent, Upload,
} from "lucide-react";
import * as API from "./api";

// ═══════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════
const fmt = (n) => "U$D " + Number(n || 0).toFixed(2);

const getPrice = (precioBase, lista, preciosFijosMap, productoId) => {
  const key = `${productoId}_${lista.id}`;
  if (preciosFijosMap[key] != null) return preciosFijosMap[key];
  return Math.round(precioBase * lista.multiplicador * 100) / 100;
};

const BRAND_KEYS = [
  "SAMSUNG","MOTOROLA","XIAOMI","HUAWEI","IPHONE","LG",
  "NOKIA","SONY","TCL","ZTE","PS4","PS5","PS3",
];
const extractBrand = (cat) => {
  const up = cat.toUpperCase();
  for (const b of BRAND_KEYS) if (up.includes(b)) return b;
  return "OTROS";
};

// ═══════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════
export default function App() {
  // ── Auth ──
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [vitrina, setVitrina] = useState(false);

  // ── Core data from API ──
  const [productos, setProductos] = useState([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [categorias, setCategorias] = useState([]);
  const [listas, setListas] = useState([]);
  const [config, setConfig] = useState({});
  const [usuarios, setUsuarios] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [preciosFijos, setPreciosFijos] = useState([]);
  const [stats, setStats] = useState(null);
  const [pendientesCount, setPendientesCount] = useState(0);

  // ── Maintenance ──
  const [mantenimiento, setMantenimiento] = useState(null);

  // ── UI state ──
  const [view, setView] = useState("catalog");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [showCats, setShowCats] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [cart, setCart] = useState([]);
  const [checkout, setCheckout] = useState(false);
  const [checkoutType, setCheckoutType] = useState("retiro");
  const [checkoutAddr, setCheckoutAddr] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");
  const [editProduct, setEditProduct] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [editTier, setEditTier] = useState(null);
  const [adminTab, setAdminTab] = useState("products");
  const [orderFilter, setOrderFilter] = useState("all");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // ── Login / Register form ──
  const [authMode, setAuthMode] = useState("login"); // login | register | pendiente
  const [loginUser, setLoginUser] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginError, setLoginError] = useState("");
  const [regForm, setRegForm] = useState({ nombre: "", usuario: "", password: "", telefono: "" });
  const [regError, setRegError] = useState("");
  const [regMsg, setRegMsg] = useState("");

  // ── Maintenance admin form ──
  const [mantForm, setMantForm] = useState({ activo: false, mensaje: "", countdown: "" });

  const searchTimer = useRef(null);
  const isAdmin = user?.rol === "admin";

  // ── Precios fijos as lookup map ──
  const pfMap = useMemo(() => {
    const m = {};
    preciosFijos.forEach(pf => { m[`${pf.producto_id}_${pf.lista_precio_id}`] = pf.precio_fijo; });
    return m;
  }, [preciosFijos]);

  // ── User's current lista ──
  const userLista = useMemo(() => {
    if (vitrina) return listas.find(l => l.id === config.vitrina_lista) || listas[listas.length - 1];
    if (!user) return listas[0];
    return listas.find(l => l.id === user.lista_precio_id) || listas[0];
  }, [user, listas, vitrina, config]);

  // ── Brands from categorias ──
  const brands = useMemo(() => {
    const set = new Set(categorias.map(c => extractBrand(c)));
    return [...set].sort();
  }, [categorias]);

  // ── Toast helper ──
  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  // ═══════════════════════════════════════════════════
  // INITIAL LOAD
  // ═══════════════════════════════════════════════════
  useEffect(() => {
    (async () => {
      // 1) Check maintenance
      try {
        const m = await API.getMaintenanceStatus();
        if (m.activo) { setMantenimiento(m); setAuthLoading(false); return; }
      } catch { /* ignore – API down? */ }

      // 2) Check existing session
      if (API.isLoggedIn()) {
        try {
          const me = await API.getMe();
          setUser(me);
        } catch {
          API.logout();
        }
      }
      setAuthLoading(false);
    })();
  }, []);

  // ── Load core data after auth resolves ──
  useEffect(() => {
    if (authLoading) return;
    if (mantenimiento?.activo && !isAdmin) return;
    loadCoreData();
  }, [authLoading, user, vitrina]);

  const loadCoreData = async () => {
    try {
      const [cats, listasData, cfgData] = await Promise.all([
        API.getCategorias().catch(() => []),
        user ? API.getListas().catch(() => []) : Promise.resolve([]),
        user ? API.getConfig().catch(() => ({})) : Promise.resolve({}),
      ]);
      setCategorias(Array.isArray(cats) ? cats : []);
      if (listasData.length) setListas(listasData);
      if (Object.keys(cfgData).length) {
        setConfig(cfgData);
        setMantForm({
          activo: cfgData.mantenimiento_activo === "true",
          mensaje: cfgData.mantenimiento_mensaje || "",
          countdown: cfgData.mantenimiento_countdown || "",
        });
      }

      // Public data (vitrina or logged in)
      if (user || vitrina) {
        await loadProductos(1, "", "");
      }

      // Admin extras
      if (user?.rol === "admin") {
        const [pf, ords, usrs, pCount] = await Promise.all([
          API.getPreciosFijos().catch(() => []),
          API.getPedidos().catch(() => []),
          API.getUsuarios().catch(() => []),
          API.getUsuariosPendientesCount().catch(() => ({ count: 0 })),
        ]);
        setPreciosFijos(Array.isArray(pf) ? pf : []);
        setPedidos(Array.isArray(ords) ? ords : []);
        setUsuarios(Array.isArray(usrs) ? usrs : []);
        setPendientesCount(pCount?.count || 0);
      } else if (user) {
        // Client: load their orders + precios fijos for price display
        const [pf, ords] = await Promise.all([
          API.getPreciosFijos().catch(() => []),
          API.getPedidos().catch(() => []),
        ]);
        setPreciosFijos(Array.isArray(pf) ? pf : []);
        setPedidos(Array.isArray(ords) ? ords : []);
      }

      setDataReady(true);
    } catch (err) {
      console.error("loadCoreData:", err);
      setDataReady(true);
    }
  };

  // ── Load products (with search/filter/pagination) ──
  const loadProductos = async (pg = 1, q = "", cat = "") => {
    setLoading(true);
    try {
      const res = await API.getProductos({ q: q || undefined, categoria: cat || undefined, page: pg, limit: 60 });
      setProductos(res.productos || res.data || res || []);
      setTotalProductos(res.total ?? (res.productos || res.data || res || []).length);
      setPage(pg);
    } catch (err) {
      console.error("loadProductos:", err);
    }
    setLoading(false);
  };

  // ── Debounced search ──
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchDebounced(search);
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  useEffect(() => {
    if (!dataReady) return;
    setCatFilter("");
    setBrandFilter("");
    loadProductos(1, searchDebounced, "");
  }, [searchDebounced]);

  // ── Reload products on filter change ──
  useEffect(() => {
    if (!dataReady) return;
    loadProductos(1, searchDebounced, catFilter);
  }, [catFilter]);

  // ── Filter by brand (client-side on current page) ──
  const displayProducts = useMemo(() => {
    let list = productos;
    if (brandFilter) {
      if (brandFilter === "OTROS") {
        list = list.filter(p => !BRAND_KEYS.some(b => (p.categoria || "").toUpperCase().includes(b)));
      } else {
        list = list.filter(p => (p.categoria || "").toUpperCase().includes(brandFilter));
      }
    }
    if (stockFilter) {
      list = list.filter(p => (p.stock || 0) > 0);
    }
    return list;
  }, [productos, brandFilter, stockFilter]);

  // ═══════════════════════════════════════════════════
  // AUTH ACTIONS
  // ═══════════════════════════════════════════════════
  const doLogin = async () => {
    setLoginError("");
    try {
      const u = await API.login(loginUser, loginPass);
      setUser(u);
      setLoginUser("");
      setLoginPass("");
      setView("catalog");
    } catch (err) {
      if (err.pendiente) {
        setLoginError("Tu cuenta está pendiente de aprobación por el administrador.");
      } else {
        setLoginError(err.message || "Error de login");
      }
    }
  };

  const doRegister = async () => {
    setRegError("");
    setRegMsg("");
    try {
      const res = await API.register(regForm);
      setRegMsg(res.mensaje || "Registro exitoso. Tu cuenta será revisada por el administrador.");
      setAuthMode("pendiente");
    } catch (err) {
      setRegError(err.message || "Error al registrar");
    }
  };

  const doLogout = () => {
    API.logout();
    setUser(null);
    setVitrina(false);
    setCart([]);
    setView("catalog");
    setDataReady(false);
    setProductos([]);
    setPedidos([]);
    setUsuarios([]);
    setPreciosFijos([]);
    setStats(null);
  };

  // ═══════════════════════════════════════════════════
  // CART / ORDERS
  // ═══════════════════════════════════════════════════
  const addToCart = (product) => {
    setCart(prev => {
      const ex = prev.find(c => c.id === product.id);
      if (ex) return prev.map(c => c.id === product.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, {
        id: product.id,
        categoria: product.categoria,
        modelo: product.modelo,
        precio_base: product.precio_base,
        qty: 1,
      }];
    });
    showToast("Agregado al carrito");
  };

  const cartTotal = useMemo(() => {
    if (!userLista) return 0;
    return cart.reduce((sum, item) =>
      sum + getPrice(item.precio_base, userLista, pfMap, item.id) * item.qty, 0);
  }, [cart, userLista, pfMap]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const placeOrder = async () => {
    setLoading(true);
    try {
      const items = cart.map(i => ({
        producto_id: i.id,
        categoria: i.categoria,
        modelo: i.modelo,
        cantidad: i.qty,
        precio_unitario: getPrice(i.precio_base, userLista, pfMap, i.id),
      }));
      await API.createPedido({
        items,
        total: cartTotal,
        tipo_entrega: checkoutType,
        direccion: checkoutAddr,
        notas: checkoutNotes,
      });
      setCart([]);
      setCheckout(false);
      setShowCart(false);
      setCheckoutAddr("");
      setCheckoutNotes("");
      showToast("¡Pedido realizado!");
      // Refresh orders & products (stock may have changed)
      const [ords] = await Promise.all([
        API.getPedidos().catch(() => []),
        loadProductos(page, searchDebounced, catFilter),
      ]);
      setPedidos(Array.isArray(ords) ? ords : []);
    } catch (err) {
      showToast("Error: " + err.message);
    }
    setLoading(false);
  };

  const sendWhatsApp = () => {
    if (!userLista) return;
    const items = cart.map(i =>
      `• ${i.categoria} - ${i.modelo} x${i.qty} = ${fmt(getPrice(i.precio_base, userLista, pfMap, i.id) * i.qty)}`
    ).join("\n");
    const biz = config.nombre_negocio || "Mi Depósito";
    const msg = `*Nuevo Pedido - ${biz}*\n\n${items}\n\n*Total: ${fmt(cartTotal)}*\n\n*Entrega:* ${checkoutType === "retiro" ? "Retiro en local" : "Envío a: " + checkoutAddr}\n${checkoutNotes ? "*Notas:* " + checkoutNotes : ""}`;
    window.open(`https://wa.me/${config.whatsapp}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  // ═══════════════════════════════════════════════════
  // ADMIN ACTIONS
  // ═══════════════════════════════════════════════════
  const refreshAdmin = async () => {
    if (!isAdmin) return;
    try {
      const [usrs, ords, pf, pCount, st] = await Promise.all([
        API.getUsuarios().catch(() => []),
        API.getPedidos().catch(() => []),
        API.getPreciosFijos().catch(() => []),
        API.getUsuariosPendientesCount().catch(() => ({ count: 0 })),
        API.getStats().catch(() => null),
      ]);
      setUsuarios(Array.isArray(usrs) ? usrs : []);
      setPedidos(Array.isArray(ords) ? ords : []);
      setPreciosFijos(Array.isArray(pf) ? pf : []);
      setPendientesCount(pCount?.count || 0);
      setStats(st);
    } catch {}
  };

  // ═══════════════════════════════════════════════════
  // RENDER: LOADING SPINNER
  // ═══════════════════════════════════════════════════
  if (authLoading) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-slate-500">Conectando...</p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: MAINTENANCE MODE (non-admin)
  // ═══════════════════════════════════════════════════
  if (mantenimiento?.activo && !isAdmin) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Settings className="w-10 h-10 text-amber-400 animate-spin" style={{ animationDuration: "3s" }} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">En mantenimiento</h1>
        <p className="text-blue-200 mb-6">{mantenimiento.mensaje || "Estamos mejorando el sistema, volvemos pronto."}</p>
        {mantenimiento.countdown && (
          <p className="text-sm text-blue-300/70">Estimado: {mantenimiento.countdown}</p>
        )}
        {API.isLoggedIn() && (
          <button onClick={() => { setMantenimiento(null); }}
            className="mt-6 px-4 py-2 bg-white/10 text-white rounded-xl text-sm hover:bg-white/20">
            Soy admin, entrar igual
          </button>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: LOGIN / REGISTER
  // ═══════════════════════════════════════════════════
  if (!user && !vitrina) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">{config.nombre_negocio || "Mi Depósito"}</h1>
          <p className="text-blue-300 text-sm mt-1">Sistema de Gestión</p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
          {/* ── Pending approval message ── */}
          {authMode === "pendiente" && (
            <div className="text-center space-y-4">
              <Clock className="w-12 h-12 text-amber-400 mx-auto" />
              <h3 className="text-white font-bold text-lg">Registro enviado</h3>
              <p className="text-blue-200 text-sm">{regMsg || "Tu cuenta será revisada por el administrador. Te avisaremos cuando esté aprobada."}</p>
              <button onClick={() => { setAuthMode("login"); setRegMsg(""); }}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm">
                Volver al login
              </button>
            </div>
          )}

          {/* ── Login form ── */}
          {authMode === "login" && (
            <div className="space-y-4">
              <div>
                <label className="text-blue-200 text-xs font-medium mb-1 block">Usuario</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="usuario" value={loginUser} onChange={e => setLoginUser(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doLogin()} />
              </div>
              <div>
                <label className="text-blue-200 text-xs font-medium mb-1 block">Contraseña</label>
                <input type="password" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && doLogin()} />
              </div>
              {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
              <button onClick={doLogin} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all">
                Ingresar
              </button>
              <button onClick={() => { setAuthMode("register"); setLoginError(""); }}
                className="w-full py-2.5 text-blue-300 hover:text-white text-sm flex items-center justify-center gap-1.5 transition-all">
                <UserPlus className="w-4 h-4" /> Crear cuenta nueva
              </button>
            </div>
          )}

          {/* ── Register form ── */}
          {authMode === "register" && (
            <div className="space-y-4">
              <button onClick={() => { setAuthMode("login"); setRegError(""); }}
                className="text-blue-300 text-sm flex items-center gap-1 hover:text-white">
                <ArrowLeft className="w-3.5 h-3.5" /> Volver al login
              </button>
              <div>
                <label className="text-blue-200 text-xs font-medium mb-1 block">Nombre completo</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tu nombre o razón social" value={regForm.nombre}
                  onChange={e => setRegForm({ ...regForm, nombre: e.target.value })} />
              </div>
              <div>
                <label className="text-blue-200 text-xs font-medium mb-1 block">Usuario</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="nombre de usuario" value={regForm.usuario}
                  onChange={e => setRegForm({ ...regForm, usuario: e.target.value })} />
              </div>
              <div>
                <label className="text-blue-200 text-xs font-medium mb-1 block">Contraseña</label>
                <input type="password" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••" value={regForm.password}
                  onChange={e => setRegForm({ ...regForm, password: e.target.value })} />
              </div>
              <div>
                <label className="text-blue-200 text-xs font-medium mb-1 block">Teléfono (opcional)</label>
                <input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="11-0000-0000" value={regForm.telefono}
                  onChange={e => setRegForm({ ...regForm, telefono: e.target.value })} />
              </div>
              {regError && <p className="text-red-400 text-sm">{regError}</p>}
              <button onClick={doRegister} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-all">
                Registrarme
              </button>
              <p className="text-blue-300/60 text-xs text-center">Tu cuenta será aprobada por el administrador antes de poder ingresar.</p>
            </div>
          )}

          {/* ── Vitrina button ── */}
          {authMode === "login" && (
            <div className="mt-6 pt-4 border-t border-white/10">
              <button onClick={() => setVitrina(true)}
                className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all">
                <Eye className="w-4 h-4" /> Ver Vitrina Pública
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════
  // RENDER: LOGGED IN / VITRINA
  // ═══════════════════════════════════════════════════

  // ── Category Sidebar ──
  const CatSidebar = () => (
    <div className={`fixed inset-0 z-50 ${showCats ? "" : "pointer-events-none"}`}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${showCats ? "opacity-100" : "opacity-0"}`} onClick={() => setShowCats(false)} />
      <div className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl transition-transform ${showCats ? "translate-x-0" : "-translate-x-full"} overflow-y-auto`}>
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Categorías</h3>
          <button onClick={() => setShowCats(false)} className="p-1"><X className="w-5 h-5" /></button>
        </div>
        <button onClick={() => { setCatFilter(""); setBrandFilter(""); setShowCats(false); }}
          className={`w-full text-left px-4 py-2.5 text-sm border-b ${!catFilter && !brandFilter ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
          Todos los productos
        </button>

        {/* Brands */}
        <div className="px-4 py-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Por marca</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {brands.map(b => (
              <button key={b} onClick={() => { setBrandFilter(brandFilter === b ? "" : b); setCatFilter(""); setShowCats(false); }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${brandFilter === b ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="px-4 pb-2"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Por categoría</p></div>
        {categorias.map(c => (
          <button key={c} onClick={() => { setCatFilter(c); setBrandFilter(""); setShowCats(false); }}
            className={`w-full text-left px-4 py-2 text-sm border-b border-slate-50 ${catFilter === c ? "bg-blue-50 text-blue-700 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
            <span className="truncate">{c}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Product Card ──
  const ProductCard = ({ p }) => {
    if (!userLista) return null;
    const price = getPrice(p.precio_base, userLista, pfMap, p.id);
    const stock = p.stock || 0;
    const inCart = cart.find(c => c.id === p.id);

    return (
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
        {p.imagen ? (
          <div className="h-28 bg-slate-50 flex items-center justify-center overflow-hidden">
            <img src={p.imagen} alt={p.modelo} className="h-full w-full object-contain" onError={e => e.target.style.display = "none"} />
          </div>
        ) : (
          <div className="h-14 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
            <Package className="w-6 h-6 text-slate-300" />
          </div>
        )}
        <div className="p-3">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide truncate">{p.categoria}</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5 truncate" title={p.modelo}>{p.modelo}</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <p className="text-lg font-bold" style={{ color: userLista.color }}>{fmt(price)}</p>
              {isAdmin && userLista.multiplicador !== 1 && (
                <p className="text-[10px] text-slate-400">Base: {fmt(p.precio_base)}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {stock > 0 ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{stock}</span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-50 text-slate-400">s/s</span>
              )}
              {isAdmin && (
                <button onClick={() => setEditProduct(p)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <button onClick={() => addToCart(p)}
            className={`w-full mt-2 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              inCart ? "bg-blue-100 text-blue-700 hover:bg-blue-200" : "bg-blue-600 text-white hover:bg-blue-700"
            }`}>
            {inCart ? <><Check className="w-3.5 h-3.5" /> En carrito ({inCart.qty})</> : <><Plus className="w-3.5 h-3.5" /> Agregar</>}
          </button>
        </div>
      </div>
    );
  };

  // ── Edit Product Modal (admin) ──
  const EditProductModal = () => {
    const p = editProduct;
    if (!p) return null;
    const [stock, setStk] = useState(p.stock || 0);
    const [img, setImgUrl] = useState(p.imagen || "");
    const [precioBase, setPrecioBase] = useState(p.precio_base || 0);
    const [fixedPrices, setFP] = useState(() => {
      const fp = {};
      preciosFijos.filter(pf => pf.producto_id === p.id).forEach(pf => { fp[pf.lista_precio_id] = pf.precio_fijo; });
      return fp;
    });
    const [saving, setSaving] = useState(false);

    const save = async () => {
      setSaving(true);
      try {
        // Update product
        await API.updateProducto(p.id, {
          stock: parseInt(stock) || 0,
          imagen: img,
          precio_base: parseFloat(precioBase) || p.precio_base,
        });
        // Update fixed prices
        for (const lista of listas) {
          const val = fixedPrices[lista.id];
          if (val != null && val > 0) {
            await API.setPrecioFijo(p.id, lista.id, val);
          } else {
            // Remove fixed price (set to 0 or null)
            await API.setPrecioFijo(p.id, lista.id, 0).catch(() => {});
          }
        }
        // Refresh
        await loadProductos(page, searchDebounced, catFilter);
        const pf = await API.getPreciosFijos().catch(() => []);
        setPreciosFijos(Array.isArray(pf) ? pf : []);
        setEditProduct(null);
        showToast("Producto actualizado");
      } catch (err) {
        showToast("Error: " + err.message);
      }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b sticky top-0 bg-white flex justify-between items-center">
            <h3 className="font-bold text-slate-800">Editar Producto</h3>
            <button onClick={() => setEditProduct(null)} className="p-1"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs text-slate-500">{p.categoria}</p>
              <p className="font-bold text-slate-800">{p.modelo}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Precio base (mayorista)</label>
              <input type="number" step="0.01" min="0" className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={precioBase} onChange={e => setPrecioBase(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Stock</label>
              <input type="number" min="0" className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={stock} onChange={e => setStk(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">URL de imagen</label>
              <input className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                placeholder="https://..." value={img} onChange={e => setImgUrl(e.target.value)} />
              {img && <img src={img} className="mt-2 h-20 object-contain rounded-lg" onError={e => e.target.style.display = "none"} />}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Precios fijos por lista (opcional)</label>
              <p className="text-xs text-slate-400 mb-2">Dejá en 0 para usar el multiplicador automático</p>
              {listas.map(t => (
                <div key={t.id} className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium w-28 truncate" style={{ color: t.color }}>{t.nombre}</span>
                  <span className="text-xs text-slate-400 w-16">Auto: {fmt((parseFloat(precioBase) || 0) * t.multiplicador)}</span>
                  <input type="number" step="0.01" min="0" className="flex-1 px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="0" value={fixedPrices[t.id] || ""}
                    onChange={e => {
                      const v = parseFloat(e.target.value);
                      const fp = { ...fixedPrices };
                      if (v > 0) fp[t.id] = v; else delete fp[t.id];
                      setFP(fp);
                    }} />
                </div>
              ))}
            </div>
            <button onClick={save} disabled={saving}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Cart Panel ──
  const CartPanel = () => (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-800">Carrito ({cartCount})</h3>
          <button onClick={() => { setShowCart(false); setCheckout(false); }}><X className="w-5 h-5" /></button>
        </div>

        {checkout ? (
          <div className="p-4 overflow-y-auto flex-1">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Tipo de entrega</label>
                <div className="flex gap-2">
                  <button onClick={() => setCheckoutType("retiro")}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 transition-all ${
                      checkoutType === "retiro" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                    }`}><Store className="w-4 h-4" /> Retiro</button>
                  <button onClick={() => setCheckoutType("envio")}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 transition-all ${
                      checkoutType === "envio" ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"
                    }`}><Truck className="w-4 h-4" /> Envío</button>
                </div>
              </div>
              {checkoutType === "envio" && (
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Dirección de envío</label>
                  <textarea className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" rows={2}
                    value={checkoutAddr} onChange={e => setCheckoutAddr(e.target.value)} placeholder="Calle, número, localidad..." />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Notas (opcional)</label>
                <textarea className="w-full px-3 py-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm" rows={2}
                  value={checkoutNotes} onChange={e => setCheckoutNotes(e.target.value)} placeholder="Observaciones..." />
              </div>
              <div className="bg-slate-50 rounded-xl p-3">
                <div className="flex justify-between text-sm"><span className="text-slate-600">Productos</span><span className="font-semibold">{cartCount}</span></div>
                <div className="flex justify-between text-lg mt-1"><span className="font-bold text-slate-800">Total</span><span className="font-bold text-blue-600">{fmt(cartTotal)}</span></div>
              </div>
              <div className="flex gap-2">
                <button onClick={placeOrder} disabled={loading}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {loading ? "Enviando..." : "Confirmar"}
                </button>
                {config.whatsapp && (
                  <button onClick={sendWhatsApp} className="py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
                    <Phone className="w-4 h-4" /> WA
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 p-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>El carrito está vacío</p>
                </div>
              ) : cart.map(item => {
                const price = userLista ? getPrice(item.precio_base, userLista, pfMap, item.id) : 0;
                return (
                  <div key={item.id} className="flex items-center gap-3 py-3 border-b border-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 truncate">{item.categoria}</p>
                      <p className="text-sm font-semibold text-slate-800 truncate">{item.modelo}</p>
                      <p className="text-sm font-bold text-blue-600">{fmt(price)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: Math.max(1, c.qty - 1) } : c))}
                        className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="w-8 text-center text-sm font-bold">{item.qty}</span>
                      <button onClick={() => setCart(prev => prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))}
                        className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center hover:bg-slate-200"><Plus className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setCart(prev => prev.filter(c => c.id !== item.id))}
                        className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 text-red-500 ml-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            {cart.length > 0 && (
              <div className="p-4 border-t bg-white shrink-0">
                <div className="flex justify-between text-lg mb-3">
                  <span className="font-bold text-slate-800">Total</span>
                  <span className="font-bold text-blue-600">{fmt(cartTotal)}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setCheckout(true)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">
                    Finalizar pedido
                  </button>
                  <button onClick={() => setCart([])}
                    className="py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl text-sm">
                    Vaciar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── User Modal (admin) ──
  const UserModal = () => {
    const u = editUser;
    if (!u) return null;
    const isPending = u.estado === "pendiente";
    const [form, setForm] = useState({ nombre: u.nombre || "", usuario: u.usuario || "", rol: u.rol || "client", lista_precio_id: u.lista_precio_id || listas[0]?.id });
    const [saving, setSaving] = useState(false);

    const save = async () => {
      setSaving(true);
      try {
        await API.updateUsuario(u.id, form);
        showToast("Usuario actualizado");
        setEditUser(null);
        const usrs = await API.getUsuarios().catch(() => []);
        setUsuarios(Array.isArray(usrs) ? usrs : []);
      } catch (err) { showToast("Error: " + err.message); }
      setSaving(false);
    };

    const aprobar = async (listaId) => {
      setSaving(true);
      try {
        await API.aprobarUsuario(u.id, listaId);
        showToast("Usuario aprobado");
        setEditUser(null);
        const [usrs, pCount] = await Promise.all([
          API.getUsuarios().catch(() => []),
          API.getUsuariosPendientesCount().catch(() => ({ count: 0 })),
        ]);
        setUsuarios(Array.isArray(usrs) ? usrs : []);
        setPendientesCount(pCount?.count || 0);
      } catch (err) { showToast("Error: " + err.message); }
      setSaving(false);
    };

    const rechazar = async () => {
      setSaving(true);
      try {
        await API.rechazarUsuario(u.id);
        showToast("Usuario rechazado");
        setEditUser(null);
        const [usrs, pCount] = await Promise.all([
          API.getUsuarios().catch(() => []),
          API.getUsuariosPendientesCount().catch(() => ({ count: 0 })),
        ]);
        setUsuarios(Array.isArray(usrs) ? usrs : []);
        setPendientesCount(pCount?.count || 0);
      } catch (err) { showToast("Error: " + err.message); }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">{isPending ? "Aprobar usuario" : "Editar usuario"}</h3>
            <button onClick={() => setEditUser(null)}><X className="w-5 h-5" /></button>
          </div>

          {isPending && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <Clock className="w-4 h-4 inline mr-1" /> Este usuario está pendiente de aprobación.
            </div>
          )}

          <div className="bg-slate-50 rounded-xl p-3">
            <p className="font-semibold">{u.nombre}</p>
            <p className="text-sm text-slate-500">@{u.usuario} {u.telefono ? `• ${u.telefono}` : ""}</p>
          </div>

          {isPending ? (
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-700 block">Asignar lista de precios:</label>
              {listas.map(l => (
                <button key={l.id} onClick={() => aprobar(l.id)} disabled={saving}
                  className="w-full py-2.5 border rounded-xl text-sm font-medium flex items-center justify-between px-3 hover:bg-blue-50 disabled:opacity-50">
                  <span style={{ color: l.color }}>{l.nombre}</span>
                  <span className="text-xs text-slate-400">×{l.multiplicador}</span>
                </button>
              ))}
              <button onClick={rechazar} disabled={saving}
                className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-xl text-sm">
                Rechazar registro
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre"
                value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
              <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={form.rol}
                onChange={e => setForm({ ...form, rol: e.target.value })}>
                <option value="client">Cliente</option><option value="admin">Admin</option>
              </select>
              <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={form.lista_precio_id}
                onChange={e => setForm({ ...form, lista_precio_id: e.target.value })}>
                {listas.map(l => <option key={l.id} value={l.id}>{l.nombre} (×{l.multiplicador})</option>)}
              </select>
              <button onClick={save} disabled={saving}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Tier Modal (admin) ──
  const TierModal = () => {
    const isNew = editTier === "new";
    const [form, setForm] = useState(isNew
      ? { id: "", nombre: "", multiplicador: 1, color: "#2563eb" }
      : { ...editTier }
    );
    const [saving, setSaving] = useState(false);

    const save = async () => {
      if (!form.nombre || !form.multiplicador) return;
      setSaving(true);
      try {
        const updated = isNew
          ? [...listas, { ...form, id: form.nombre.toLowerCase().replace(/\s/g, "_") }]
          : listas.map(t => t.id === form.id ? form : t);
        await API.updateListas(updated);
        setListas(updated);
        setEditTier(null);
        showToast("Lista guardada");
      } catch (err) { showToast("Error: " + err.message); }
      setSaving(false);
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center">
        <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-bold">{isNew ? "Nueva Lista" : "Editar Lista"}</h3>
            <button onClick={() => setEditTier(null)}><X className="w-5 h-5" /></button>
          </div>
          <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre"
            value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-slate-500 mb-1 block">Multiplicador</label>
              <input type="number" step="0.05" min="0.1" className="w-full px-3 py-2.5 border rounded-xl text-sm"
                value={form.multiplicador} onChange={e => setForm({ ...form, multiplicador: parseFloat(e.target.value) || 1 })} />
            </div>
            <div className="w-24">
              <label className="text-xs text-slate-500 mb-1 block">Color</label>
              <input type="color" className="w-full h-[42px] rounded-xl border cursor-pointer"
                value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-slate-400">Ej: si base es U$D 1.00, con ×{form.multiplicador} → {fmt(1 * form.multiplicador)}</p>
          <button onClick={save} disabled={saving}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    );
  };

  // ── Order Status Badge ──
  const StatusBadge = ({ status }) => {
    const m = {
      pendiente: "bg-amber-100 text-amber-700",
      preparando: "bg-blue-100 text-blue-700",
      listo: "bg-emerald-100 text-emerald-700",
      entregado: "bg-slate-100 text-slate-500",
      cancelado: "bg-red-100 text-red-600",
    };
    return <span className={`text-xs px-2 py-1 rounded-full font-medium ${m[status] || m.pendiente}`}>{status}</span>;
  };

  // ═══════════════════════════════════════════════════
  // ADMIN PANEL
  // ═══════════════════════════════════════════════════
  const AdminPanel = () => {
    const [ajuste, setAjuste] = useState({ porcentaje: "", categoria: "" });
    const [ajustando, setAjustando] = useState(false);

    return (
      <div className="p-4 max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {[
            ["products", "Productos", Package],
            ["users", "Usuarios", Users, pendientesCount],
            ["orders", "Pedidos", ClipboardList],
            ["tiers", "Listas", DollarSign],
            ["stats", "Stats", BarChart3],
            ["config", "Config", Settings],
          ].map(([id, label, Icon, badge]) => (
            <button key={id} onClick={() => { setAdminTab(id); if (id === "stats") refreshAdmin(); }}
              className={`px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap flex items-center gap-1.5 transition-all relative ${
                adminTab === id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Products tab ── */}
        {adminTab === "products" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Usá el ícono de edición en cada producto del catálogo para editar stock, imagen y precios.</p>

            {/* Price adjustment */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Percent className="w-4 h-4" /> Ajustar precios</h4>
              <div className="flex gap-2">
                <input type="number" placeholder="% (ej: 10, -5)" className="flex-1 px-3 py-2 border rounded-xl text-sm"
                  value={ajuste.porcentaje} onChange={e => setAjuste({ ...ajuste, porcentaje: e.target.value })} />
                <select className="px-3 py-2 border rounded-xl text-sm" value={ajuste.categoria}
                  onChange={e => setAjuste({ ...ajuste, categoria: e.target.value })}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button disabled={ajustando || !ajuste.porcentaje} onClick={async () => {
                  setAjustando(true);
                  try {
                    await API.ajustarPrecios(parseFloat(ajuste.porcentaje), ajuste.categoria || null);
                    showToast("Precios ajustados");
                    await loadProductos(page, searchDebounced, catFilter);
                  } catch (e) { showToast("Error: " + e.message); }
                  setAjustando(false);
                }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                  Aplicar ajuste
                </button>
                <button disabled={ajustando} onClick={async () => {
                  setAjustando(true);
                  try {
                    await API.resetPrecios();
                    showToast("Precios reseteados");
                    await loadProductos(page, searchDebounced, catFilter);
                  } catch (e) { showToast("Error: " + e.message); }
                  setAjustando(false);
                }} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium disabled:opacity-50">
                  Resetear precios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Users tab ── */}
        {adminTab === "users" && (
          <div>
            <button onClick={refreshAdmin} className="mb-3 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>

            {/* Pending users */}
            {usuarios.filter(u => u.estado === "pendiente").length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-1.5">
                  <Clock className="w-4 h-4" /> Pendientes de aprobación
                </h4>
                <div className="space-y-2">
                  {usuarios.filter(u => u.estado === "pendiente").map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div>
                        <p className="font-semibold text-sm">{u.nombre}</p>
                        <p className="text-xs text-slate-500">@{u.usuario} {u.telefono ? `• ${u.telefono}` : ""}</p>
                      </div>
                      <button onClick={() => setEditUser(u)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">
                        Revisar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Active users */}
            <div className="space-y-2">
              {usuarios.filter(u => u.estado !== "pendiente").map(u => (
                <div key={u.id} className="flex items-center justify-between bg-white border rounded-xl p-3">
                  <div>
                    <p className="font-semibold text-sm">{u.nombre}</p>
                    <p className="text-xs text-slate-500">
                      @{u.usuario} • {u.rol === "admin" ? "Admin" : listas.find(l => l.id === u.lista_precio_id)?.nombre || u.lista_precio_id}
                      {u.estado === "rechazado" && <span className="text-red-500 ml-1">(rechazado)</span>}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditUser(u)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {u.rol !== "admin" && (
                      <button onClick={async () => {
                        try { await API.deleteUsuario(u.id); showToast("Usuario eliminado"); refreshAdmin(); }
                        catch (e) { showToast("Error: " + e.message); }
                      }} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Orders tab ── */}
        {adminTab === "orders" && (
          <div>
            <div className="flex gap-1 mb-3 overflow-x-auto">
              {["all", "pendiente", "preparando", "listo", "entregado", "cancelado"].map(s => (
                <button key={s} onClick={() => setOrderFilter(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${orderFilter === s ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {s === "all" ? "Todos" : s}
                </button>
              ))}
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {pedidos.filter(o => orderFilter === "all" || o.estado === orderFilter).map(o => (
                <div key={o.id} className="bg-white border rounded-xl p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-sm">{o.usuario_nombre || "—"}</p>
                      <p className="text-xs text-slate-500">{new Date(o.fecha || o.created_at).toLocaleString("es-AR")} • {o.tipo_entrega === "retiro" ? "Retiro" : "Envío"}</p>
                      {o.direccion && <p className="text-xs text-slate-500 mt-0.5">📍 {o.direccion}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-600">{fmt(o.total)}</p>
                      <StatusBadge status={o.estado} />
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5 mb-2">
                    {(o.items || []).map((i, idx) => (
                      <p key={idx}>{i.categoria} - {i.modelo} ×{i.cantidad || i.qty} = {fmt((i.precio_unitario || i.unitPrice) * (i.cantidad || i.qty))}</p>
                    ))}
                  </div>
                  {o.notas && <p className="text-xs text-slate-500 italic mb-2">Nota: {o.notas}</p>}
                  <div className="flex gap-1 flex-wrap">
                    {["pendiente", "preparando", "listo", "entregado", "cancelado"].filter(s => s !== o.estado).map(s => (
                      <button key={s} onClick={async () => {
                        try {
                          await API.updatePedido(o.id, { estado: s });
                          const ords = await API.getPedidos().catch(() => []);
                          setPedidos(Array.isArray(ords) ? ords : []);
                          showToast("Estado actualizado");
                        } catch (e) { showToast("Error: " + e.message); }
                      }} className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-600">
                        → {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {pedidos.filter(o => orderFilter === "all" || o.estado === orderFilter).length === 0 && (
                <p className="text-center text-slate-400 py-8 text-sm">Sin pedidos</p>
              )}
            </div>
          </div>
        )}

        {/* ── Tiers tab ── */}
        {adminTab === "tiers" && (
          <div>
            <button onClick={() => setEditTier("new")} className="mb-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nueva lista
            </button>
            <div className="space-y-2">
              {listas.map(t => (
                <div key={t.id} className="flex items-center justify-between bg-white border rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: t.color }} />
                    <div>
                      <p className="font-semibold text-sm">{t.nombre}</p>
                      <p className="text-xs text-slate-500">×{t.multiplicador} • Ej: $1.00 → {fmt(1 * t.multiplicador)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditTier(t)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"><Edit2 className="w-3.5 h-3.5" /></button>
                    {listas.length > 1 && (
                      <button onClick={async () => {
                        try {
                          const updated = listas.filter(x => x.id !== t.id);
                          await API.updateListas(updated);
                          setListas(updated);
                          showToast("Lista eliminada");
                        } catch (e) { showToast("Error: " + e.message); }
                      }} className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stats tab ── */}
        {adminTab === "stats" && (
          <div className="space-y-3">
            <button onClick={refreshAdmin} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
            {stats ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["Productos", stats.total_productos, Package, "blue"],
                  ["Con stock", stats.con_stock, Check, "emerald"],
                  ["Usuarios", stats.total_usuarios, Users, "violet"],
                  ["Pedidos", stats.total_pedidos, ClipboardList, "amber"],
                ].map(([label, val, Icon, color]) => (
                  <div key={label} className="bg-white border rounded-xl p-4 text-center">
                    <Icon className={`w-6 h-6 mx-auto mb-2 text-${color}-500`} />
                    <p className="text-2xl font-bold text-slate-800">{val ?? "—"}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm text-center py-8">Cargando stats...</p>
            )}
          </div>
        )}

        {/* ── Config tab ── */}
        {adminTab === "config" && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Nombre del negocio</label>
              <input className="w-full px-3 py-2.5 border rounded-xl text-sm" value={config.nombre_negocio || ""}
                onChange={e => setConfig({ ...config, nombre_negocio: e.target.value })}
                onBlur={() => API.updateConfig(config).catch(() => {})} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">WhatsApp (con código país, sin +)</label>
              <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="5491100000000" value={config.whatsapp || ""}
                onChange={e => setConfig({ ...config, whatsapp: e.target.value })}
                onBlur={() => API.updateConfig(config).catch(() => {})} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Lista de precios para Vitrina</label>
              <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={config.vitrina_lista || ""}
                onChange={e => {
                  const c = { ...config, vitrina_lista: e.target.value };
                  setConfig(c);
                  API.updateConfig(c).catch(() => {});
                }}>
                {listas.map(l => <option key={l.id} value={l.id}>{l.nombre} (×{l.multiplicador})</option>)}
              </select>
            </div>

            {/* Maintenance mode */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4" /> Modo mantenimiento</h4>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mantForm.activo}
                    onChange={e => setMantForm({ ...mantForm, activo: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300" />
                  <span className="text-sm">Activar mantenimiento</span>
                </label>
              </div>
              <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Mensaje para usuarios"
                value={mantForm.mensaje} onChange={e => setMantForm({ ...mantForm, mensaje: e.target.value })} />
              <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Countdown (ej: 30 minutos)"
                value={mantForm.countdown} onChange={e => setMantForm({ ...mantForm, countdown: e.target.value })} />
              <button onClick={async () => {
                try {
                  await API.setMaintenanceMode(mantForm.activo, mantForm.mensaje, mantForm.countdown);
                  showToast(mantForm.activo ? "Mantenimiento activado" : "Mantenimiento desactivado");
                } catch (e) { showToast("Error: " + e.message); }
              }} className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium">
                Guardar mantenimiento
              </button>
            </div>

            <button onClick={() => API.updateConfig(config).then(() => showToast("Config guardada")).catch(e => showToast("Error: " + e.message))}
              className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
              <Save className="w-4 h-4" /> Guardar configuración
            </button>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // ORDERS VIEW (client)
  // ═══════════════════════════════════════════════════
  const OrdersView = () => {
    const myOrders = isAdmin ? pedidos : pedidos.filter(o => o.usuario_id === user?.id);
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <h2 className="font-bold text-lg text-slate-800 mb-4">{isAdmin ? "Todos los Pedidos" : "Mis Pedidos"}</h2>
        {myOrders.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay pedidos todavía</p>
          </div>
        ) : myOrders.map(o => (
          <div key={o.id} className="bg-white border rounded-xl p-3 mb-2">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-slate-500">{new Date(o.fecha || o.created_at).toLocaleString("es-AR")}</p>
                <p className="text-xs text-slate-500 mt-0.5">{o.tipo_entrega === "retiro" ? "📦 Retiro" : "🚚 Envío"}{o.direccion ? ` - ${o.direccion}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-600">{fmt(o.total)}</p>
                <StatusBadge status={o.estado} />
              </div>
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              {(o.items || []).map((i, idx) => (
                <p key={idx}>{i.categoria} - {i.modelo} ×{i.cantidad || i.qty}</p>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════
  // MAIN LAYOUT
  // ═══════════════════════════════════════════════════
  const header = (
    <header className="sticky top-0 z-40 bg-white border-b">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={() => setShowCats(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 shrink-0">
          <Menu className="w-5 h-5 text-slate-700" />
        </button>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="w-full pl-9 pr-3 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            placeholder="Buscar producto o modelo..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400" /></button>}
        </div>
        <button onClick={() => setShowCart(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 shrink-0 relative">
          <ShoppingCart className="w-5 h-5 text-slate-700" />
          {cartCount > 0 && <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
        </button>
      </div>
      {(catFilter || brandFilter) && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <span className="text-xs text-slate-500">Filtro:</span>
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium truncate max-w-[200px]">{catFilter || brandFilter}</span>
          <button onClick={() => { setCatFilter(""); setBrandFilter(""); }} className="text-xs text-red-500 underline">limpiar</button>
        </div>
      )}
    </header>
  );

  const bottomNav = (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-30 px-2 pb-safe">
      <div className="flex justify-around py-1.5">
        {[
          ["catalog", "Catálogo", Package],
          ...(isAdmin ? [["admin", "Admin", Settings]] : []),
          ["orders", "Pedidos", ClipboardList],
          ...(!vitrina ? [["account", "Cuenta", User]] : []),
        ].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${view === id ? "text-blue-600" : "text-slate-400"}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-slate-800 to-blue-900 text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4" />
          <span className="font-bold text-sm">{config.nombre_negocio || "Mi Depósito"}</span>
          {vitrina && <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-medium">VITRINA</span>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {!vitrina && user && (
            <>
              <span className="hidden sm:inline text-blue-200">{user.nombre}</span>
              {userLista && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: userLista.color + "33", color: userLista.color }}>
                  {userLista.nombre}
                </span>
              )}
            </>
          )}
          <button onClick={doLogout} className="p-1.5 rounded-lg hover:bg-white/10">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {header}

      {/* Content */}
      <main>
        {view === "catalog" && (
          <div className="p-3">
            {loading && productos.length === 0 ? (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
                <p className="text-slate-400 text-sm">Cargando productos...</p>
              </div>
            ) : displayProducts.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No se encontraron productos</p>
                <button onClick={() => { setSearch(""); setCatFilter(""); setBrandFilter(""); }}
                  className="mt-3 text-sm text-blue-600 underline">Ver todos</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">{totalProductos} productos{stockFilter ? " (con stock)" : ""}</p>
                  <button onClick={() => setStockFilter(!stockFilter)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${stockFilter ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                    <Filter className="w-3 h-3" /> {stockFilter ? "Con stock" : "Stock"}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {displayProducts.map(p => <ProductCard key={p.id} p={p} />)}
                </div>

                {/* Pagination */}
                {totalProductos > 60 && (
                  <div className="flex items-center justify-center gap-2 mt-4 py-4">
                    <button disabled={page <= 1 || loading} onClick={() => loadProductos(page - 1, searchDebounced, catFilter)}
                      className="px-4 py-2 bg-white border rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-slate-50">
                      ← Anterior
                    </button>
                    <span className="text-sm text-slate-500">Pág. {page}</span>
                    <button disabled={displayProducts.length < 60 || loading} onClick={() => loadProductos(page + 1, searchDebounced, catFilter)}
                      className="px-4 py-2 bg-white border rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-slate-50">
                      Siguiente →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {view === "admin" && isAdmin && <AdminPanel />}
        {view === "orders" && <OrdersView />}
        {view === "account" && !vitrina && (
          <div className="p-4 max-w-md mx-auto">
            <div className="bg-white rounded-2xl border p-6 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg">{user?.nombre}</h3>
              <p className="text-sm text-slate-500 mt-1">@{user?.usuario}</p>
              {userLista && (
                <div className="mt-2 inline-flex px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: userLista.color + "15", color: userLista.color }}>
                  {userLista.nombre}
                </div>
              )}
              <div className="mt-6 space-y-2">
                <button onClick={doLogout}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2">
                  <LogOut className="w-4 h-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {bottomNav}

      {/* Floating cart button */}
      {cartCount > 0 && !showCart && (
        <button onClick={() => setShowCart(true)}
          className="fixed bottom-20 right-4 z-30 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-4 py-3 shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all">
          <ShoppingCart className="w-5 h-5" />
          <span className="font-bold text-sm">{cartCount}</span>
          <span className="text-xs opacity-80">|</span>
          <span className="font-bold text-sm">{fmt(cartTotal)}</span>
        </button>
      )}

      {/* Modals */}
      <CatSidebar />
      {showCart && <CartPanel />}
      {editProduct && <EditProductModal />}
      {editUser && <UserModal />}
      {editTier && <TierModal />}

      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-bounce">
          {toast}
        </div>
      )}
    </div>
  );
}
