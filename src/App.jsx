import{useState,useEffect,useMemo,useCallback,useRef,memo,createContext,useContext}from"react";
import{Search,ShoppingCart,User,LogOut,Package,Settings,Eye,EyeOff,Edit2,Trash2,Plus,Minus,Phone,Truck,Store,Users,DollarSign,AlertTriangle,Check,X,Menu,Filter,ClipboardList,Save,ChevronDown,ChevronRight,RefreshCw,UserPlus,Clock,Shield,BarChart3,Loader2,ArrowLeft,Percent,Upload,Printer,Download,Share2,TrendingUp,Mail,MapPin,FileText,Zap}from"lucide-react";
import*as XLSX from"xlsx";
import*as API from"./api";

const BRAND_KEYS=["SAMSUNG","MOTOROLA","XIAOMI","HUAWEI","IPHONE","LG","NOKIA","SONY","TCL","ZTE","PS4","PS5","PS3"];
const CAT_COLORS={"placa de carga":"#2563eb",flex:"#7c3aed","pin de carga":"#0891b2",bandeja:"#059669",lente:"#d97706",buzzer:"#dc2626",parlante:"#dc2626","conector fpc":"#6366f1",boton:"#84cc16",membrana:"#f97316",cable:"#0d9488",antena:"#6d28d9",pulsador:"#ec4899",marco:"#78716c",pegamento:"#a3a3a3",tubo:"#a3a3a3",repuesto:"#f43f5e",microfono:"#8b5cf6",jack:"#14b8a6",ficha:"#06b6d4"};
const fmt=n=>"U$D "+Number(n||0).toFixed(2);
const fmtARS=n=>"$"+Number(n||0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:0});
const getPrice=(base,lista,pfMap,pid)=>{const k=`${pid}_${lista?.id}`;if(pfMap[k]!=null&&pfMap[k]>0)return pfMap[k];return Math.round((Number(base)||0)*(lista?.multiplicador||1)*100)/100;};
const extractBrand=cat=>{const u=(cat||"").toUpperCase();for(const b of BRAND_KEYS)if(u.includes(b))return b;return"OTROS";};
const getCatColor=cat=>{const l=(cat||"").toLowerCase();for(const[k,c]of Object.entries(CAT_COLORS))if(l.includes(k))return c;return"#64748b";};
const Ctx=createContext();

/* ═══ STABLE COMPONENTS ═══ */

const StatusBadge=({status})=>{const m={pendiente:"bg-amber-100 text-amber-700",preparando:"bg-blue-100 text-blue-700",listo:"bg-emerald-100 text-emerald-700",entregado:"bg-slate-100 text-slate-500",cancelado:"bg-red-100 text-red-600"};return<span className={`text-xs px-2 py-1 rounded-full font-medium ${m[status]||m.pendiente}`}>{status}</span>;};

const ProductCard=memo(function ProductCard({p}){
  const{userLista,pfMap,cart,addToCart,isAdmin,setEditProduct,dolarBlue}=useContext(Ctx);
  const[qty,setQty]=useState(1);
  if(!userLista)return null;
  const price=getPrice(p.precio_base,userLista,pfMap,p.id);const inCart=cart.find(c=>c.id===p.id);const cc=getCatColor(p.categoria);
  return(<div className="bg-white rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
    <div className="h-2 w-full" style={{backgroundColor:cc,opacity:.7}}/>
    {p.imagen?<div className="h-28 bg-slate-50 flex items-center justify-center overflow-hidden"><img src={p.imagen} alt={p.modelo} className="h-full w-full object-contain" onError={e=>e.target.style.display="none"}/></div>
     :<div className="h-10 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center"><Package className="w-5 h-5 text-slate-300"/></div>}
    <div className="p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide truncate" style={{color:cc}}>{p.categoria}</p>
      <p className="text-sm font-bold text-slate-800 mt-0.5 truncate" title={p.modelo}>{p.modelo}</p>
      <div className="flex items-center justify-between mt-2">
        <div><p className="text-lg font-bold" style={{color:userLista.color}}>{fmt(price)}</p>{dolarBlue&&<p className="text-[10px] text-slate-400">{fmtARS(price*dolarBlue)}</p>}</div>
        {isAdmin&&<button onClick={()=>setEditProduct(p)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500"><Edit2 className="w-3.5 h-3.5"/></button>}</div>
      <div className="flex items-center gap-1.5 mt-2">
        <input type="number" min="1" value={inCart?inCart.qty:qty} onChange={e=>{const v=Math.max(1,parseInt(e.target.value)||1);if(!inCart)setQty(v);}} onBlur={e=>{if(inCart){const v=Math.max(1,parseInt(e.target.value)||1);const{setCart}=window.__ctx;setCart(prev=>prev.map(c=>c.id===p.id?{...c,qty:v}:c));}}}
          className="w-14 px-1.5 py-1.5 border rounded-lg text-center text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"/>
        <button onClick={()=>addToCart(p,inCart?0:qty)} disabled={!!inCart}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 ${inCart?"bg-blue-100 text-blue-700":"bg-blue-600 text-white hover:bg-blue-700"}`}>
          {inCart?<><Check className="w-3.5 h-3.5"/>En carrito</>:<><Plus className="w-3.5 h-3.5"/>Agregar</>}</button></div>
    </div></div>);
});

/* ── Edit Product ── */
function EditProductModal({product,onClose}){
  const{listas,preciosFijos,showToast,loadProductos,page,searchDebounced,catFilter,setPreciosFijos}=useContext(Ctx);const p=product;
  const[stk,setStk]=useState(p.stock||0);const[img,setImg]=useState(p.imagen||"");const[pb,setPb]=useState(p.precio_base||0);
  const[modelo,setModelo]=useState(p.modelo||"");const[notas,setNotas]=useState(p.notas||"");const[sv,setSv]=useState(false);
  const[fp,setFp]=useState(()=>{const o={};preciosFijos.filter(x=>x.producto_id===p.id).forEach(x=>{o[x.lista_precio_id]=x.precio_fijo});return o;});
  const save=async()=>{setSv(true);try{await API.updateProducto(p.id,{stock:parseInt(stk)||0,imagen:img,precio_base:parseFloat(pb)||p.precio_base,modelo,notas});
    for(const l of listas){const v=fp[l.id];await API.setPrecioFijo(p.id,l.id,v&&v>0?v:0).catch(()=>{});}
    await loadProductos(page,searchDebounced,catFilter);const pf=await API.getPreciosFijos().catch(()=>[]);setPreciosFijos(Array.isArray(pf)?pf:[]);onClose();showToast("Actualizado");
  }catch(e){showToast("Error: "+e.message);}setSv(false);};
  return(<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-4 border-b sticky top-0 bg-white flex justify-between items-center"><h3 className="font-bold">Editar Producto</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
      <div className="p-4 space-y-3">
        <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs text-slate-500">{p.categoria}</p></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Modelo / Nombre</label><input className="w-full px-3 py-2.5 border rounded-xl" value={modelo} onChange={e=>setModelo(e.target.value)}/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Precio base</label><input type="number" step="0.01" className="w-full px-3 py-2.5 border rounded-xl" value={pb} onChange={e=>setPb(e.target.value)}/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Stock</label><input type="number" min="0" className="w-full px-3 py-2.5 border rounded-xl" value={stk} onChange={e=>setStk(e.target.value)}/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Imagen URL</label><input className="w-full px-3 py-2.5 border rounded-xl text-sm" value={img} onChange={e=>setImg(e.target.value)}/>
          {img&&<img src={img} className="mt-2 h-20 object-contain rounded-lg" onError={e=>e.target.style.display="none"}/>}</div>
        <div><label className="text-sm font-medium text-slate-700 mb-1 block">Notas</label><input className="w-full px-3 py-2.5 border rounded-xl text-sm" value={notas} onChange={e=>setNotas(e.target.value)}/></div>
        <div><label className="text-sm font-medium text-slate-700 mb-2 block">Precios fijos</label>
          {listas.map(t=><div key={t.id} className="flex items-center gap-2 mb-2"><span className="text-xs font-medium w-28 truncate" style={{color:t.color}}>{t.nombre}</span>
            <span className="text-xs text-slate-400 w-16">{fmt((parseFloat(pb)||0)*t.multiplicador)}</span>
            <input type="number" step="0.01" className="flex-1 px-2 py-1.5 border rounded-lg text-sm" placeholder="0" value={fp[t.id]||""} onChange={e=>{const v=parseFloat(e.target.value);const n={...fp};if(v>0)n[t.id]=v;else delete n[t.id];setFp(n);}}/></div>)}</div>
        <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
          {sv?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{sv?"Guardando...":"Guardar"}</button>
      </div></div></div>);
}

/* ── Add Product ── */
function AddProdModal({onClose}){
  const{categorias,showToast,loadProductos,setCategorias}=useContext(Ctx);
  const[f,setF]=useState({categoria:"",categoriaNew:"",modelo:"",precio_base:""});const[sv,setSv]=useState(false);
  const save=async()=>{const cat=f.categoriaNew||f.categoria;if(!cat||!f.modelo||!f.precio_base){showToast("Completá todos los campos");return;}
    setSv(true);try{await API.createProducto({categoria:cat,modelo:f.modelo,precio_base:parseFloat(f.precio_base)||0});showToast("Creado");onClose();
    await loadProductos(1,"","");const cats=await API.getCategorias().catch(()=>[]);setCategorias(Array.isArray(cats)?cats:[]);}catch(e){showToast("Error: "+e.message);}setSv(false);};
  return(<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
      <div className="flex justify-between items-center"><h3 className="font-bold">Agregar Producto</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
      <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={f.categoria} onChange={e=>setF({...f,categoria:e.target.value,categoriaNew:""})}>
        <option value="">— Categoría existente —</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="O categoría nueva" value={f.categoriaNew} onChange={e=>setF({...f,categoriaNew:e.target.value,categoria:""})}/>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Modelo *" value={f.modelo} onChange={e=>setF({...f,modelo:e.target.value})}/>
      <input type="number" step="0.01" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Precio base USD *" value={f.precio_base} onChange={e=>setF({...f,precio_base:e.target.value})}/>
      <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">{sv?"Guardando...":"Crear"}</button>
    </div></div>);
}

/* ── Import Excel ── */
function ImportModal({onClose}){
  const{showToast,loadProductos,setCategorias}=useContext(Ctx);
  const[data,setData]=useState(null);const[upl,setUpl]=useState(false);const[res,setRes]=useState("");const[repl,setRepl]=useState(false);const fr=useRef(null);
  const handle=e=>{const file=e.target.files[0];if(!file)return;setRes("");const reader=new FileReader();
    reader.onload=evt=>{try{const wb=XLSX.read(evt.target.result,{type:"array"});const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      if(!rows.length){setRes("Excel vacío");return;}const keys=Object.keys(rows[0]);
      const cC=keys.find(k=>/producto|categor|tipo/i.test(k))||keys[0];const cM=keys.find(k=>/modelo|model|nombre/i.test(k))||keys[1];const cP=keys.find(k=>/precio|price|costo/i.test(k))||keys[2];
      const prods=rows.filter(r=>r[cC]&&r[cM]).map(r=>({categoria:String(r[cC]).trim(),modelo:String(r[cM]).trim(),precio_base:parseFloat(r[cP])||0}));
      setData({productos:prods,cC,cM,cP,total:prods.length});}catch(err){setRes("Error: "+err.message);}};reader.readAsArrayBuffer(file);};
  const doUp=async()=>{if(!data?.productos?.length)return;setUpl(true);setRes("");try{const r=await API.bulkProductos(data.productos,repl);setRes(`✅ ${r.insertados??r.count??data.total} cargados`);
    setData(null);if(fr.current)fr.current.value="";await loadProductos(1,"","");const cats=await API.getCategorias().catch(()=>[]);setCategorias(Array.isArray(cats)?cats:[]);
  }catch(e){setRes("❌ "+e.message);}setUpl(false);};
  return(<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
      <div className="flex justify-between items-center"><h3 className="font-bold">Importar Excel</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
      <input ref={fr} type="file" accept=".xlsx,.xls,.csv" onChange={handle} className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-medium file:cursor-pointer"/>
      {data&&<div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2"><p className="text-sm text-blue-800 font-medium">{data.total} productos</p>
        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={repl} onChange={e=>setRepl(e.target.checked)} className="w-4 h-4 rounded"/>Reemplazar todo</label>
        <button onClick={doUp} disabled={upl} className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
          {upl?<Loader2 className="w-4 h-4 animate-spin"/>:<Upload className="w-4 h-4"/>}{upl?"Cargando...":`Cargar ${data.total}`}</button></div>}
      {res&&<p className={`text-sm font-medium ${res.startsWith("✅")?"text-emerald-700":"text-red-600"}`}>{res}</p>}
    </div></div>);
}

/* ── User Modal (edit/create/approve) — includes direccion ── */
function UserModal({u,isNew,onClose}){
  const{listas,showToast,refreshAdmin}=useContext(Ctx);
  const isPending=u?.estado==="pendiente";
  const[f,setF]=useState(isNew
    ?{nombre:"",usuario:"",password:"",telefono:"",email:"",direccion:"",rol:"client",lista_precio_id:listas[0]?.id||""}
    :{nombre:u?.nombre||"",usuario:u?.usuario||"",password:"",telefono:u?.telefono||"",email:u?.email||"",direccion:u?.direccion||"",rol:u?.rol||"client",lista_precio_id:u?.lista_precio_id||listas[0]?.id||""});
  const[sv,setSv]=useState(false);
  const save=async()=>{if(!f.nombre||!f.usuario){showToast("Nombre y usuario obligatorios");return;}setSv(true);try{
    const datos=isNew?{...f,activo:true}:{...u,...f,activo:u?.activo??true};delete datos.id;delete datos.created_at;delete datos.updated_at;if(!datos.password)delete datos.password;
    if(isNew)await API.register(datos);else await API.updateUsuario(u.id,datos);
    showToast(isNew?"Creado":"Actualizado");onClose();await refreshAdmin();
  }catch(e){showToast("Error: "+e.message);}setSv(false);};
  const aprobar=async lid=>{setSv(true);try{await API.aprobarUsuario(u.id,lid);showToast("Aprobado");
    if(u.telefono){const msg=`Hola ${u.nombre}, tu cuenta en ${document.title||"el catálogo"} ya está activa. Tu usuario es: *${u.usuario}*`;openWA(`54${u.telefono.replace(/\D/g,"")}`,msg);}
    onClose();await refreshAdmin();}catch(e){showToast("Error: "+e.message);}setSv(false);};
  const rechazar=async()=>{setSv(true);try{await API.rechazarUsuario(u.id);showToast("Rechazado");onClose();await refreshAdmin();}catch(e){showToast("Error: "+e.message);}setSv(false);};
  return(<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3 max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center"><h3 className="font-bold">{isNew?"Nuevo usuario":isPending?"Aprobar":"Editar usuario"}</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
      {isPending&&<div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800"><Clock className="w-4 h-4 inline mr-1"/>Pendiente</div>}
      {!isNew&&<div className="bg-slate-50 rounded-xl p-3"><p className="font-semibold">{u.nombre}</p><p className="text-sm text-slate-500">@{u.usuario} {u.telefono?`• ${u.telefono}`:""} {u.email?`• ${u.email}`:""}</p></div>}
      {isPending?(<div className="space-y-3"><label className="text-sm font-medium block">Asignar lista:</label>
        {listas.map(l=><button key={l.id} onClick={()=>aprobar(l.id)} disabled={sv} className="w-full py-2.5 border rounded-xl text-sm font-medium flex items-center justify-between px-3 hover:bg-blue-50 disabled:opacity-50">
          <span style={{color:l.color}}>{l.nombre}</span><span className="text-xs text-slate-400">{l.modo==="porcentaje"?`+${Math.round((l.multiplicador-1)*100)}%`:`×${l.multiplicador}`}</span></button>)}
        <button onClick={rechazar} disabled={sv} className="w-full py-2.5 bg-red-50 text-red-600 rounded-xl text-sm font-medium">Rechazar</button></div>
      ):(<div className="space-y-3">
        <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre completo *" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})}/>
        <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Usuario *" value={f.usuario} onChange={e=>setF({...f,usuario:e.target.value})}/>
        <input type="password" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder={isNew?"Contraseña *":"Nueva contraseña (vacío=no cambiar)"} value={f.password} onChange={e=>setF({...f,password:e.target.value})}/>
        <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Teléfono / WhatsApp *" value={f.telefono} onChange={e=>setF({...f,telefono:e.target.value})}/>
        <input type="email" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Email *" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
        <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Dirección" value={f.direccion} onChange={e=>setF({...f,direccion:e.target.value})}/>
        <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={f.rol} onChange={e=>setF({...f,rol:e.target.value})}><option value="client">Cliente</option><option value="admin">Admin</option></select>
        <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={f.lista_precio_id} onChange={e=>setF({...f,lista_precio_id:e.target.value})}>
          {listas.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select>
        {!isNew&&<label className="flex items-center gap-3 py-2 cursor-pointer"><input type="checkbox" checked={f.activo!==false&&f.activo!=="false"} onChange={e=>setF({...f,activo:e.target.checked})} className="w-5 h-5 rounded"/>
          <span className="text-sm font-medium">{f.activo!==false&&f.activo!=="false"?"✅ Cuenta activa":"🔴 Cuenta suspendida"}</span></label>}
        <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">{sv?"Guardando...":"Guardar"}</button>
      </div>)}
    </div></div>);
}

/* ── Tier Modal ── */
function TierModal({tier,isNew,onClose}){
  const{listas,setListas,showToast}=useContext(Ctx);
  const[f,setF]=useState(isNew?{id:"",nombre:"",multiplicador:1,modo:"porcentaje",color:"#2563eb",compra_minima:0,promo_msg:""}
    :{...tier,modo:tier.modo||"multiplicador",compra_minima:tier.compra_minima||0,promo_msg:tier.promo_msg||""});
  const[iv,setIv]=useState(()=>f.modo==="porcentaje"?Math.round((f.multiplicador-1)*100):f.multiplicador);const[sv,setSv]=useState(false);
  const calcM=()=>f.modo==="porcentaje"?1+iv/100:iv;
  const save=async()=>{if(!f.nombre)return;setSv(true);try{const obj={...f,multiplicador:calcM()};
    const upd=isNew?[...listas,{...obj,id:f.nombre.toLowerCase().replace(/\s/g,"_")}]:listas.map(t=>t.id===f.id?obj:t);
    await API.updateListas(upd);setListas(upd);onClose();showToast("Guardada");}catch(e){showToast("Error: "+e.message);}setSv(false);};
  return(<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl p-4 space-y-3">
      <div className="flex justify-between items-center"><h3 className="font-bold">{isNew?"Nueva Lista":"Editar Lista"}</h3><button onClick={onClose}><X className="w-5 h-5"/></button></div>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})}/>
      <div className="flex gap-2">
        <button onClick={()=>{setF({...f,modo:"porcentaje"});setIv(Math.round((f.multiplicador-1)*100));}} className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 ${f.modo==="porcentaje"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}>% Porcentaje</button>
        <button onClick={()=>{setF({...f,modo:"multiplicador"});setIv(f.multiplicador);}} className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 ${f.modo==="multiplicador"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}>× Multiplicador</button></div>
      <div className="flex gap-2">
        <div className="flex-1"><label className="text-xs text-slate-500 mb-1 block">{f.modo==="porcentaje"?"% Porcentaje":"Multiplicador"}</label>
          <input type="number" step={f.modo==="porcentaje"?"1":"0.05"} className="w-full px-3 py-2.5 border rounded-xl text-sm" value={iv}
            onChange={e=>{const v=parseFloat(e.target.value)||0;setIv(v);setF({...f,multiplicador:f.modo==="porcentaje"?1+v/100:v});}}/></div>
        <div className="w-20"><label className="text-xs text-slate-500 mb-1 block">Color</label><input type="color" className="w-full h-[42px] rounded-xl border cursor-pointer" value={f.color} onChange={e=>setF({...f,color:e.target.value})}/></div></div>
      <div><label className="text-xs text-slate-500 mb-1 block">Compra mínima (USD) — 0 = sin mínimo</label><input type="number" min="0" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="0" value={f.compra_minima||""} onChange={e=>setF({...f,compra_minima:parseFloat(e.target.value)||0})}/></div>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Mensaje promo (opcional)" value={f.promo_msg} onChange={e=>setF({...f,promo_msg:e.target.value})}/>
      <p className="text-xs text-slate-400">Base $1.00 → {fmt(calcM())}</p>
      <button onClick={save} disabled={sv} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl disabled:opacity-50">{sv?"Guardando...":"Guardar"}</button>
    </div></div>);
}

/* ── Order Detail Modal (with editing) ── */
function OrderDetailModal({order,onClose,onUpdate,onPrint,onClone}){
  const{productos:allProds,userLista,pfMap,showToast}=useContext(Ctx);
  const o=order;if(!o)return null;
  const orderNum=typeof o.id==="number"?`#${String(o.id).padStart(4,"0")}`:`#${o.id}`;
  const[editing,setEditing]=useState(false);
  const[items,setItems]=useState((o.items||[]).map(i=>({...i,qty:i.cantidad||i.qty||1})));
  const[addSearch,setAddSearch]=useState("");
  const[saving,setSaving]=useState(false);
  const editTotal=items.reduce((s,i)=>s+(Number(i.precio_unitario)||0)*(i.qty||0),0);
  const searchResults=addSearch.length>=2?allProds.filter(p=>(p.modelo||"").toLowerCase().includes(addSearch.toLowerCase())||(p.categoria||"").toLowerCase().includes(addSearch.toLowerCase())).slice(0,8):[];

  const saveEdit=async()=>{setSaving(true);try{
    const newItems=items.map(i=>({producto_id:i.producto_id||i.id,categoria:i.categoria,modelo:i.modelo,nombre_producto:`${i.categoria} - ${i.modelo}`,cantidad:i.qty,precio_unitario:Number(i.precio_unitario)||0,precio_base:Number(i.precio_base)||0}));
    await onUpdate(o.id,{items:newItems,total:editTotal});setEditing(false);showToast("Pedido actualizado");
  }catch(e){showToast("Error: "+(e?.message||e));}setSaving(false);};

  const addItem=(p)=>{const price=userLista?getPrice(p.precio_base,userLista,pfMap,p.id):p.precio_base;
    setItems(prev=>{const ex=prev.find(i=>(i.producto_id||i.id)===p.id);if(ex)return prev.map(i=>(i.producto_id||i.id)===p.id?{...i,qty:i.qty+1}:i);
    return[...prev,{producto_id:p.id,categoria:p.categoria,modelo:p.modelo,precio_unitario:price,precio_base:p.precio_base,qty:1}];});setAddSearch("");};

  return(<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-4 border-b sticky top-0 bg-white flex justify-between items-center"><h3 className="font-bold">Pedido {orderNum}</h3>
        <div className="flex items-center gap-2">{!editing&&<button onClick={()=>setEditing(true)} className="text-xs px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full font-medium flex items-center gap-1"><Edit2 className="w-3 h-3"/>Editar</button>}
          <button onClick={onClose}><X className="w-5 h-5"/></button></div></div>
      <div className="p-4 space-y-3">
        <div className="flex justify-between items-start"><div><p className="font-semibold">{o.usuario_nombre||"—"}</p>
          <p className="text-xs text-slate-500">{new Date(o.fecha||o.created_at).toLocaleString("es-AR")}</p>
          <p className="text-xs text-slate-500">{o.tipo_entrega==="retiro"?"📦 Retiro":"🚚 Envío"} {o.direccion||""}</p></div>
          <div className="text-right"><p className="text-xl font-bold text-blue-600">{editing?fmt(editTotal):fmt(o.total)}</p><StatusBadge status={o.estado}/>
            <p className={`text-xs font-medium mt-1 ${o.estado_pago==="pagado"?"text-emerald-600":"text-red-500"}`}>{o.estado_pago==="pagado"?"💰 Pagado":"⏳ Impago"}</p></div></div>
        <div className="flex gap-2"><button onClick={()=>onUpdate(o.id,{estado_pago:o.estado_pago==="pagado"?"pendiente":"pagado"})}
          className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 ${o.estado_pago==="pagado"?"border-emerald-500 bg-emerald-50 text-emerald-700":"border-red-300 bg-red-50 text-red-600"}`}>
          {o.estado_pago==="pagado"?"✅ Pagado — marcar impago":"❌ Impago — marcar pagado"}</button></div>
        {o.notas&&<p className="text-sm text-slate-500 italic bg-slate-50 rounded-lg p-2">Nota: {o.notas}</p>}

        {/* Items table */}
        {editing?<div className="space-y-2">
          {items.map((i,idx)=><div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
            <div className="flex-1 min-w-0"><p className="text-xs text-slate-500 truncate">{i.categoria}</p><p className="text-sm font-medium truncate">{i.modelo}</p>
              <p className="text-xs text-blue-600">{fmt(Number(i.precio_unitario)||0)}</p></div>
            <input type="number" min="1" value={i.qty} onChange={e=>setItems(prev=>prev.map((x,j)=>j===idx?{...x,qty:Math.max(1,parseInt(e.target.value)||1)}:x))}
              className="w-14 px-1 py-1.5 border rounded-lg text-center text-sm"/>
            <button onClick={()=>setItems(prev=>prev.filter((_,j)=>j!==idx))} className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="w-3.5 h-3.5"/></button></div>)}
          {/* Add product search */}
          <div className="relative"><input className="w-full px-3 py-2 border rounded-xl text-sm" placeholder="Buscar producto para agregar..." value={addSearch} onChange={e=>setAddSearch(e.target.value)}/>
            {searchResults.length>0&&<div className="absolute left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
              {searchResults.map(p=><button key={p.id} onClick={()=>addItem(p)} className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-50">
                <span className="text-xs text-slate-400">{p.categoria}</span> — <span className="font-medium">{p.modelo}</span></button>)}</div>}</div>
          <div className="flex gap-2"><button onClick={saveEdit} disabled={saving||!items.length} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5">
              {saving?<Loader2 className="w-4 h-4 animate-spin"/>:<Save className="w-4 h-4"/>}{saving?"Guardando...":"Guardar cambios"}</button>
            <button onClick={()=>{setItems((o.items||[]).map(i=>({...i,qty:i.cantidad||i.qty||1})));setEditing(false);}} className="py-2.5 px-4 bg-slate-100 rounded-xl text-sm">Cancelar</button></div>
        </div>
        :<table className="w-full text-sm"><thead><tr className="border-b"><th className="text-left py-1">Producto</th><th className="text-center">Cant</th><th className="text-right">Subtotal</th></tr></thead>
          <tbody>{(o.items||[]).map((i,idx)=><tr key={idx} className="border-b border-slate-50"><td className="py-1.5">{i.categoria} - {i.modelo}</td>
            <td className="text-center">{i.cantidad||i.qty}</td><td className="text-right">{fmt((Number(i.precio_unitario)||0)*(i.cantidad||i.qty))}</td></tr>)}</tbody></table>}

        {!editing&&<><div className="flex gap-2 flex-wrap">
          {["pendiente","preparando","listo","entregado","cancelado"].filter(s=>s!==o.estado).map(s=>
            <button key={s} onClick={()=>onUpdate(o.id,{estado:s})} className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium">→ {s}</button>)}
          <button onClick={()=>onClone(o)} className="px-2 py-1 rounded-lg bg-blue-50 text-xs font-medium text-blue-600">Repetir</button></div>
        <div className="flex gap-2">
          {["A4","80mm","50mm","100mm"].map(f=><button key={f} onClick={()=>onPrint(o,f)} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-medium flex items-center justify-center gap-1"><Printer className="w-3 h-3"/>{f}</button>)}</div></>}
      </div></div></div>);
}

/* ── Price Adjustment Panel (stable, local state) ── */
function PriceAdjustPanel(){
  const{categorias,showToast,loadProductos}=useContext(Ctx);
  const[pct,setPct]=useState("");const[cat,setCat]=useState("");const[busy,setBusy]=useState(false);
  const apply=async()=>{if(!pct)return;setBusy(true);try{await API.ajustarPrecios(parseFloat(pct),cat||null);showToast("Precios ajustados");await loadProductos(1,"","");}catch(e){showToast("Error: "+e.message);}setBusy(false);};
  const reset=async()=>{setBusy(true);try{await API.resetPrecios();showToast("Precios reseteados al original");await loadProductos(1,"","");}catch(e){showToast("Error: "+e.message);}setBusy(false);};
  return(<div className="bg-white border rounded-xl p-4 space-y-3"><h4 className="font-semibold text-sm flex items-center gap-2"><Percent className="w-4 h-4"/>Ajustar precios base</h4>
    <div className="flex gap-2"><input type="number" placeholder="% (ej: 10, -5)" className="flex-1 px-3 py-2 border rounded-xl text-sm" value={pct} onChange={e=>setPct(e.target.value)}/>
      <select className="px-3 py-2 border rounded-xl text-sm" value={cat} onChange={e=>setCat(e.target.value)}>
        <option value="">Todas las categorías</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select></div>
    <div className="flex gap-2"><button disabled={busy||!pct} onClick={apply} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">Aplicar {pct?`${pct}%`:""}</button>
      <button disabled={busy} onClick={reset} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium disabled:opacity-50">Resetear precios</button></div></div>);
}

/* ── Config Panel (local state) ── */
function ConfigPanel(){
  const{config:gc,setConfig:sgc,listas,showToast,mantForm:gm,setMantForm:smf}=useContext(Ctx);
  const[c,setC]=useState({...gc});const[m,setM]=useState({...gm});
  useEffect(()=>{setC({...gc});},[gc]);useEffect(()=>{setM({...gm});},[gm]);
  const saveAll=async()=>{try{await API.updateConfig(c);sgc(c);showToast("Config guardada");}catch(e){showToast("Error: "+e.message);}};
  return(<div className="space-y-4">
    <div><label className="text-sm font-medium text-slate-700 mb-1 block">Nombre del negocio</label><input className="w-full px-3 py-2.5 border rounded-xl text-sm" value={c.nombre_negocio||""} onChange={e=>setC({...c,nombre_negocio:e.target.value})}/></div>
    <div><label className="text-sm font-medium text-slate-700 mb-1 block">WhatsApp (sin +)</label><input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="5491100000000" value={c.whatsapp||""} onChange={e=>setC({...c,whatsapp:e.target.value})}/></div>
    <div><label className="text-sm font-medium text-slate-700 mb-1 block">Logo</label>
      <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>setC({...c,logo:ev.target.result});r.readAsDataURL(f);}} className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-blue-600 file:text-white file:font-medium file:cursor-pointer"/>
      {c.logo&&<img src={c.logo} className="mt-2 h-16 object-contain rounded-lg"/>}</div>
    <div><label className="text-sm font-medium text-slate-700 mb-1 block">Lista para Vitrina</label>
      <select className="w-full px-3 py-2.5 border rounded-xl text-sm" value={c.vitrina_lista||""} onChange={e=>setC({...c,vitrina_lista:e.target.value})}>{listas.map(l=><option key={l.id} value={l.id}>{l.nombre}</option>)}</select></div>
    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={c.mostrar_stock!=="false"} onChange={e=>setC({...c,mostrar_stock:e.target.checked?"true":"false"})} className="w-4 h-4 rounded"/>Mostrar botón stock en catálogo</label>
    <div className="bg-white border rounded-xl p-4 space-y-3"><h4 className="font-semibold text-sm flex items-center gap-2"><Zap className="w-4 h-4"/>Banner publicitario</h4>
      <p className="text-xs text-slate-400">Se muestra al pie del catálogo. Dejá vacío para ocultar.</p>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Texto del banner (ej: ¿Querés tu propio catálogo?)" value={c.banner_texto||""} onChange={e=>setC({...c,banner_texto:e.target.value})}/>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="WhatsApp del banner (ej: 5491122525568)" value={c.banner_wa||""} onChange={e=>setC({...c,banner_wa:e.target.value})}/></div>
    <div><label className="text-sm font-medium text-slate-700 mb-1 block">Info de pagos (para clientes)</label>
      <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={3} value={c.info_pagos||""} onChange={e=>setC({...c,info_pagos:e.target.value})}/></div>
    <div><label className="text-sm font-medium text-slate-700 mb-1 block">Info de envíos (para clientes)</label>
      <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={3} value={c.info_envios||""} onChange={e=>setC({...c,info_envios:e.target.value})}/></div>
    <div className="bg-white border rounded-xl p-4 space-y-3"><h4 className="font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4"/>Mantenimiento</h4>
      <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={m.activo} onChange={e=>setM({...m,activo:e.target.checked})} className="w-4 h-4 rounded"/>Activar</label>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Mensaje" value={m.mensaje} onChange={e=>setM({...m,mensaje:e.target.value})}/>
      <button onClick={async()=>{try{await API.setMaintenanceMode(m.activo,m.mensaje,m.countdown);smf(m);showToast(m.activo?"Mantenimiento ON":"OFF");}catch(e){showToast("Error: "+e.message);}}}
        className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium">Guardar mantenimiento</button></div>
    <button onClick={saveAll} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"><Save className="w-4 h-4"/>Guardar configuración</button>
  </div>);
}

/* ── Account self-edit ── */
function AccountPanel({user,userLista,config,doLogout}){
  const{showToast}=useContext(Ctx);
  const[editing,setEditing]=useState(false);
  const[f,setF]=useState({nombre:user.nombre||"",telefono:user.telefono||"",email:user.email||"",direccion:user.direccion||""});
  const[pw,setPw]=useState("");const[sv,setSv]=useState(false);
  const saveProfile=async()=>{setSv(true);try{const d={...f};if(pw)d.password=pw;await API.updateMe(d);showToast("Datos actualizados");setEditing(false);setPw("");}catch(e){showToast("Error: "+e.message);}setSv(false);};
  return(<div className="p-4 max-w-md mx-auto"><div className="bg-white rounded-2xl border p-6">
    <div className="text-center"><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3"><User className="w-8 h-8 text-blue-600"/></div>
      <h3 className="font-bold text-lg">{user.nombre}</h3><p className="text-sm text-slate-500">@{user.usuario}</p>
      {userLista&&<div className="mt-2 inline-flex px-3 py-1 rounded-full text-sm font-medium" style={{backgroundColor:userLista.color+"15",color:userLista.color}}>{userLista.nombre}</div>}</div>
    {!editing?<div className="mt-4 space-y-2 text-left">
      {user.telefono&&<p className="text-sm text-slate-600 flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400"/>{user.telefono}</p>}
      {user.email&&<p className="text-sm text-slate-600 flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400"/>{user.email}</p>}
      {user.direccion&&<p className="text-sm text-slate-600 flex items-center gap-2"><MapPin className="w-4 h-4 text-slate-400"/>{user.direccion}</p>}
      <button onClick={()=>setEditing(true)} className="w-full mt-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-medium text-sm flex items-center justify-center gap-2"><Edit2 className="w-4 h-4"/>Editar mis datos</button>
    </div>:<div className="mt-4 space-y-2 text-left">
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nombre" value={f.nombre} onChange={e=>setF({...f,nombre:e.target.value})}/>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Teléfono / WhatsApp" value={f.telefono} onChange={e=>setF({...f,telefono:e.target.value})}/>
      <input type="email" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Email" value={f.email} onChange={e=>setF({...f,email:e.target.value})}/>
      <input className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Dirección" value={f.direccion} onChange={e=>setF({...f,direccion:e.target.value})}/>
      <input type="password" className="w-full px-3 py-2.5 border rounded-xl text-sm" placeholder="Nueva contraseña (vacío=no cambiar)" value={pw} onChange={e=>setPw(e.target.value)}/>
      <div className="flex gap-2"><button onClick={saveProfile} disabled={sv} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium disabled:opacity-50">{sv?"...":"Guardar"}</button>
        <button onClick={()=>{setEditing(false);setPw("");}} className="py-2.5 px-4 bg-slate-100 rounded-xl text-sm">Cancelar</button></div></div>}
    {(config.info_pagos||config.info_envios)&&<div className="mt-4 space-y-3 text-left">
      {config.info_pagos&&<div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-bold text-slate-500 mb-1">Pagos</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{config.info_pagos}</p></div>}
      {config.info_envios&&<div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-bold text-slate-500 mb-1">Envíos</p><p className="text-sm text-slate-700 whitespace-pre-wrap">{config.info_envios}</p></div>}</div>}
    <button onClick={doLogout} className="w-full mt-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium flex items-center justify-center gap-2"><LogOut className="w-4 h-4"/>Cerrar sesión</button>
  </div></div>);
}

/* ═══════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════ */
export default function App(){
  const[user,setUser]=useState(null);const[authLoading,setAuthLoading]=useState(true);const[vitrina,setVitrina]=useState(false);
  const[productos,setProductos]=useState([]);const[totalProductos,setTotalProductos]=useState(0);const[categorias,setCategorias]=useState([]);
  const[listas,setListas]=useState([]);const[config,setConfig]=useState({});const[usuarios,setUsuarios]=useState([]);
  const[pedidos,setPedidos]=useState([]);const[preciosFijos,setPreciosFijos]=useState([]);const[stats,setStats]=useState(null);
  const[pendientesCount,setPendientesCount]=useState(0);const[dolarBlue,setDolarBlue]=useState(null);const[mantenimiento,setMantenimiento]=useState(null);
  const[view,setView]=useState("catalog");const[search,setSearch]=useState("");const[searchDebounced,setSearchDebounced]=useState("");
  const[catFilter,setCatFilter]=useState("");const[brandFilter,setBrandFilter]=useState("");const[stockFilter,setStockFilter]=useState(false);
  const[page,setPage]=useState(1);const[pageSize,setPageSize]=useState(60);const[showCats,setShowCats]=useState(false);
  const[showCart,setShowCart]=useState(false);const[cart,setCart]=useState([]);const[checkout,setCheckout]=useState(false);
  const[checkoutType,setCheckoutType]=useState("retiro");const[checkoutAddr,setCheckoutAddr]=useState("");const[checkoutNotes,setCheckoutNotes]=useState("");
  const[editProduct,setEditProduct]=useState(null);const[addProdModal,setAddProdModal]=useState(false);const[importModal,setImportModal]=useState(false);
  const[editUser,setEditUser]=useState(null);const[newUserModal,setNewUserModal]=useState(false);const[editTier,setEditTier]=useState(null);
  const[viewOrder,setViewOrder]=useState(null);
  const[adminTab,setAdminTab]=useState("home");const[orderFilter,setOrderFilter]=useState("all");const[toast,setToast]=useState("");
  const[loading,setLoading]=useState(false);const[dataReady,setDataReady]=useState(false);const[presupuesto,setPresupuesto]=useState(false);
  const[authMode,setAuthMode]=useState("login");const[loginUser,setLoginUser]=useState("");const[loginPass,setLoginPass]=useState("");
  const[loginError,setLoginError]=useState("");const[showPass,setShowPass]=useState(false);
  const[regForm,setRegForm]=useState({nombre:"",apellido:"",usuario:"",password:"",telefono:"",email:""});
  const[regError,setRegError]=useState("");const[regMsg,setRegMsg]=useState("");
  const[mantForm,setMantForm]=useState({activo:false,mensaje:"",countdown:""});
  const[expandedCat,setExpandedCat]=useState("");
  const searchTimer=useRef(null);const isAdmin=user?.rol==="admin";

  const pfMap=useMemo(()=>{const m={};preciosFijos.forEach(pf=>{m[`${pf.producto_id}_${pf.lista_precio_id}`]=pf.precio_fijo});return m;},[preciosFijos]);
  const userLista=useMemo(()=>{if(!listas.length)return null;if(vitrina)return listas.find(l=>l.id===config.vitrina_lista)||listas[listas.length-1];if(!user)return listas[0];return listas.find(l=>l.id===user.lista_precio_id)||listas[0];},[user,listas,vitrina,config]);
  const brands=useMemo(()=>[...new Set(categorias.map(extractBrand))].sort(),[categorias]);
  const showToast=useCallback(msg=>{setToast(msg);setTimeout(()=>setToast(""),2500);},[]);
  const minCompra=userLista?.compra_minima||0;
  const cartTotal=useMemo(()=>!userLista?0:cart.reduce((s,i)=>s+getPrice(i.precio_base,userLista,pfMap,i.id)*i.qty,0),[cart,userLista,pfMap]);
  const cartCount=cart.reduce((s,i)=>s+i.qty,0);const cartMeetsMin=minCompra<=0||cartTotal>=minCompra;
  const showStockBtn=config.mostrar_stock!=="false";

  useEffect(()=>{(async()=>{try{const m=await API.getMaintenanceStatus();if(m.activo){setMantenimiento(m);setAuthLoading(false);return;}}catch{}
    if(API.isLoggedIn()){try{setUser(await API.getMe());}catch{API.logout();}}setAuthLoading(false);})();},[]);
  useEffect(()=>{if(authLoading)return;if(mantenimiento?.activo&&!isAdmin)return;loadCoreData();},[authLoading,user,vitrina]);
  useEffect(()=>{fetch("https://dolarapi.com/v1/dolares/blue").then(r=>r.json()).then(d=>setDolarBlue(d.venta)).catch(()=>{});},[]);
  useEffect(()=>{const p=new URLSearchParams(window.location.search);const cd=p.get("cart");if(cd){try{setCart(JSON.parse(atob(cd)));window.history.replaceState({},"",window.location.pathname);}catch{}};},[]);

  const loadCoreData=async()=>{try{const[cats,listasD,cfgD]=await Promise.all([API.getCategorias().catch(()=>[]),user?API.getListas().catch(()=>[]):Promise.resolve([]),user?API.getConfig().catch(()=>({})):Promise.resolve({})]);
    setCategorias(Array.isArray(cats)?cats:[]);if(listasD.length)setListas(listasD);
    if(Object.keys(cfgD).length){setConfig(cfgD);setMantForm({activo:cfgD.mantenimiento_activo==="true",mensaje:cfgD.mantenimiento_mensaje||"",countdown:cfgD.mantenimiento_countdown||""});}
    if(user||vitrina)await loadProductos(1,"","");
    if(isAdmin){const[pf,ords,usrs,pC,st]=await Promise.all([API.getPreciosFijos().catch(()=>[]),API.getPedidos().catch(()=>[]),API.getUsuarios().catch(()=>[]),API.getUsuariosPendientesCount().catch(()=>({count:0})),API.getStats().catch(()=>null)]);
      setPreciosFijos(Array.isArray(pf)?pf:[]);setPedidos(Array.isArray(ords)?ords:[]);setUsuarios(Array.isArray(usrs)?usrs:[]);setPendientesCount(pC?.count||0);setStats(st);
    }else if(user){const[pf,ords]=await Promise.all([API.getPreciosFijos().catch(()=>[]),API.getPedidos().catch(()=>[])]);setPreciosFijos(Array.isArray(pf)?pf:[]);setPedidos(Array.isArray(ords)?ords:[]);}
    setDataReady(true);}catch(e){console.error(e);setDataReady(true);}};

  const loadProductos=useCallback(async(pg=1,q="",cat="")=>{setLoading(true);try{const r=await API.getProductos({q:q||undefined,categoria:cat||undefined,page:pg,limit:pageSize});
    setProductos(r.productos||r.data||r||[]);setTotalProductos(r.total??0);setPage(pg);}catch(e){console.error(e);}setLoading(false);},[pageSize]);

  const refreshAdmin=useCallback(async()=>{if(!isAdmin)return;try{const[usrs,ords,pf,pC,st]=await Promise.all([API.getUsuarios(),API.getPedidos(),API.getPreciosFijos(),API.getUsuariosPendientesCount(),API.getStats()]);
    setUsuarios(Array.isArray(usrs)?usrs:[]);setPedidos(Array.isArray(ords)?ords:[]);setPreciosFijos(Array.isArray(pf)?pf:[]);setPendientesCount(pC?.count||0);setStats(st);showToast("Actualizado");}catch(e){showToast("Error: "+e.message);}},[isAdmin,showToast]);

  useEffect(()=>{if(searchTimer.current)clearTimeout(searchTimer.current);searchTimer.current=setTimeout(()=>setSearchDebounced(search),400);return()=>clearTimeout(searchTimer.current);},[search]);
  useEffect(()=>{if(!dataReady)return;setCatFilter("");setBrandFilter("");loadProductos(1,searchDebounced,"");},[searchDebounced]);
  useEffect(()=>{if(!dataReady)return;loadProductos(1,searchDebounced,catFilter);},[catFilter,pageSize]);

  const displayProducts=useMemo(()=>{let list=productos;if(brandFilter){if(brandFilter==="OTROS")list=list.filter(p=>!BRAND_KEYS.some(b=>(p.categoria||"").toUpperCase().includes(b)));else list=list.filter(p=>(p.categoria||"").toUpperCase().includes(brandFilter));}if(stockFilter)list=list.filter(p=>(p.stock||0)>0);return list;},[productos,brandFilter,stockFilter]);
  const crossResults=useMemo(()=>{if(!searchDebounced||searchDebounced.length<2)return null;const cats={};displayProducts.forEach(p=>{if(!cats[p.categoria])cats[p.categoria]=[];cats[p.categoria].push(p);});const e=Object.entries(cats);if(e.length<=1)return null;return{categories:e,total:displayProducts.length};},[displayProducts,searchDebounced]);

  const addToCart=useCallback((p,qty=1)=>{if(qty===0)return;setCart(prev=>{const ex=prev.find(c=>c.id===p.id);if(ex)return prev.map(c=>c.id===p.id?{...c,qty:c.qty+qty}:c);return[...prev,{id:p.id,categoria:p.categoria,modelo:p.modelo,precio_base:p.precio_base,qty}];});showToast("Agregado");},[showToast]);
  // Expose setCart for ProductCard onBlur
  window.__ctx={setCart};

  const doLogin=async()=>{setLoginError("");try{const u=await API.login(loginUser.toLowerCase().trim(),loginPass);setUser(u);setLoginUser("");setLoginPass("");setView("catalog");}catch(e){setLoginError(e.pendiente?"Pendiente de aprobación.":(e.message||"Error"));}};
  const doRegister=async()=>{setRegError("");if(!regForm.nombre||!regForm.apellido||!regForm.usuario||!regForm.password||!regForm.telefono||!regForm.email){setRegError("Todos los campos son obligatorios");return;}
    try{const r=await API.register({...regForm,nombre:`${regForm.nombre} ${regForm.apellido}`});setRegMsg(r.mensaje||"Enviado. El admin revisará tu cuenta.");setAuthMode("pendiente");
      const adminWa=config.whatsapp||"";if(adminWa){openWA(adminWa,`Hola, me registré en el catálogo:\nNombre: ${regForm.nombre} ${regForm.apellido}\nUsuario: ${regForm.usuario}\nTel: ${regForm.telefono}\nQuedo a la espera de aprobación`);}
    }catch(e){setRegError(e.message||"Error");}};
  const doLogout=()=>{API.logout();setUser(null);setVitrina(false);setCart([]);setView("catalog");setDataReady(false);setProductos([]);};

  const placeOrder=async()=>{if(!cartMeetsMin)return;setLoading(true);try{
    const items=cart.map(i=>{const pu=getPrice(i.precio_base,userLista,pfMap,i.id);return{producto_id:i.id,categoria:i.categoria,modelo:i.modelo,nombre_producto:`${i.categoria} - ${i.modelo}`,nombre:i.modelo,cantidad:i.qty,precio_unitario:pu,precio_base:i.precio_base,subtotal:pu*i.qty};});
    const res=await API.createPedido({items,total:cartTotal,tipo_entrega:checkoutType,direccion:checkoutAddr,notas:checkoutNotes,estado_pago:"pendiente"});
    const ordId=res?.id||res?.pedido?.id||"";const ordNum=ordId?`#${String(ordId).padStart(4,"0")}`:"";
    if(config.whatsapp){const msg=`Hola soy *${user?.nombre||"cliente"}*\nPedido ${ordNum}\nTotal: *${fmt(cartTotal)}* (${cartCount} items)\nEntrega: ${checkoutType==="retiro"?"Retiro en local":"Envío"}`;openWA(config.whatsapp,msg);}
    setCart([]);setCheckout(false);setShowCart(false);setCheckoutAddr("");setCheckoutNotes("");showToast("¡Pedido realizado!");
    const ords=await API.getPedidos().catch(()=>[]);setPedidos(Array.isArray(ords)?ords:[]);await loadProductos(page,searchDebounced,catFilter);
  }catch(e){showToast("Error: "+e.message);}setLoading(false);};

  const shareCart=()=>{navigator.clipboard.writeText(`${window.location.origin}?cart=${btoa(JSON.stringify(cart))}`).then(()=>showToast("Link copiado")).catch(()=>{});};
  const cloneOrder=o=>{setCart((o.items||[]).map(i=>({id:i.producto_id||i.id,categoria:i.categoria,modelo:i.modelo,precio_base:i.precio_base||i.precio_unitario,qty:i.cantidad||i.qty})));showToast("Cargado al carrito");setView("catalog");setViewOrder(null);};

  const printRemito=(order,format="A4")=>{const biz=config.nombre_negocio||"Mayorista";const logo=config.logo||"";const isS=format!=="A4";
    const items=(order.items||[]).map(i=>`<tr><td style="padding:3px 4px;border-bottom:1px solid #eee;font-size:${isS?"9px":"12px"}">${i.categoria} - ${i.modelo}</td><td style="text-align:center;border-bottom:1px solid #eee">${i.cantidad||i.qty}</td><td style="text-align:right;border-bottom:1px solid #eee">${fmt((Number(i.precio_unitario)||0)*(i.cantidad||i.qty))}</td></tr>`).join("");
    const orderNum=typeof order.id==="number"?`#${String(order.id).padStart(4,"0")}`:`#${order.id}`;
    const w=window.open("","_blank");w.document.write(`<!DOCTYPE html><html><head><title>Remito ${orderNum}</title><style>@page{size:${format==="A4"?"A4 portrait":format+" auto"};margin:${isS?"3mm":"15mm"}}body{font-family:Arial,sans-serif;font-size:${isS?"10px":"13px"};margin:0;padding:${isS?"4px":"20px"};max-width:${isS?format:"auto"}}table{width:100%;border-collapse:collapse}th{text-align:left;border-bottom:2px solid #333;padding:4px;font-size:${isS?"9px":"12px"}}</style></head><body>
    ${logo?`<img src="${logo}" style="max-height:${isS?"25px":"50px"};margin-bottom:8px">`:""}
    <h2 style="margin:0;font-size:${isS?"13px":"20px"}">${biz}</h2>
    <p style="margin:4px 0;color:#666;font-size:${isS?"9px":"12px"}">Pedido ${orderNum} — ${new Date(order.fecha||order.created_at).toLocaleString("es-AR")}</p>
    <p style="margin:2px 0;font-size:${isS?"9px":"12px"}">${order.usuario_nombre||""} — ${order.tipo_entrega==="retiro"?"Retiro":"Envío"} ${order.direccion||""}</p><hr>
    <table><thead><tr><th>Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${items}</tbody></table>
    <p style="text-align:right;font-weight:bold;font-size:${isS?"14px":"20px"};margin-top:12px">TOTAL: ${fmt(order.total)}</p>
    ${order.notas?`<p style="color:#666;font-size:${isS?"8px":"11px"};margin-top:8px">Notas: ${order.notas}</p>`:""}
    </body></html>`);w.document.close();setTimeout(()=>w.print(),400);};

  const exportOrders=()=>{const rows=[];pedidos.forEach(o=>(o.items||[]).forEach(i=>{rows.push({Pedido:o.id,Fecha:new Date(o.fecha||o.created_at).toLocaleDateString("es-AR"),Cliente:o.usuario_nombre,Producto:i.categoria+" - "+i.modelo,Cantidad:i.cantidad||i.qty,Precio:i.precio_unitario,Subtotal:(Number(i.precio_unitario)||0)*(i.cantidad||i.qty),Total:o.total,Estado:o.estado});}));
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Pedidos");XLSX.writeFile(wb,"pedidos.xlsx");showToast("Excel descargado");};

  const updateOrder=async(id,data)=>{try{await API.updatePedido(id,data);const ords=await API.getPedidos().catch(()=>[]);setPedidos(Array.isArray(ords)?ords:[]);showToast("Actualizado");if(viewOrder?.id===id)setViewOrder(prev=>({...prev,...data}));}catch(e){showToast("Error: "+e.message);}};

  const profitData=useMemo(()=>{if(!pedidos.length)return null;const now=new Date();
    const calc=fn=>{let rev=0,cost=0;pedidos.filter(o=>o.estado!=="cancelado"&&fn(new Date(o.fecha||o.created_at))).forEach(o=>{rev+=Number(o.total)||0;(o.items||[]).forEach(i=>{cost+=(Number(i.precio_base)||0)*(i.cantidad||i.qty||0);});});return{revenue:rev,cost,profit:rev-cost};};
    return{hoy:calc(d=>d.toDateString()===now.toDateString()),semana:calc(d=>(now-d)<7*864e5),mes:calc(d=>d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()),año:calc(d=>d.getFullYear()===now.getFullYear())};},[pedidos]);

  const clientRanking=useMemo(()=>{const m={};pedidos.filter(o=>o.estado!=="cancelado").forEach(o=>{const k=o.usuario_nombre||"?";if(!m[k])m[k]={nombre:k,total:0,pedidos:0};m[k].total+=Number(o.total)||0;m[k].pedidos++;});return Object.values(m).sort((a,b)=>b.total-a.total);},[pedidos]);

  // WhatsApp helper — anchor click works better on mobile than window.open
  const openWA=(number,text)=>{const a=document.createElement("a");a.href=`https://wa.me/${number}?text=${encodeURIComponent(text)}`;a.target="_blank";a.rel="noopener noreferrer";document.body.appendChild(a);a.click();document.body.removeChild(a);};

  const ctxVal=useMemo(()=>({userLista,pfMap,cart,setCart,addToCart,isAdmin,setEditProduct,dolarBlue,showToast,listas,setListas,preciosFijos,setPreciosFijos,
    loadProductos,page,searchDebounced,catFilter,categorias,setCategorias,refreshAdmin,config,setConfig,mantForm,setMantForm,productos}),[userLista,pfMap,cart,addToCart,isAdmin,dolarBlue,listas,preciosFijos,page,searchDebounced,catFilter,categorias,config,mantForm,productos]);

  const[darkMode,setDarkMode]=useState(()=>localStorage.getItem("darkMode")==="true");
  const toggleDark=useCallback(()=>{const v=!darkMode;setDarkMode(v);localStorage.setItem("darkMode",v?"true":"false");},[darkMode]);
  const matchingCats=useMemo(()=>{if(!searchDebounced||searchDebounced.length<2)return[];return categorias.filter(c=>c.toLowerCase().includes(searchDebounced.toLowerCase())).filter(c=>!catFilter||c!==catFilter);},[searchDebounced,categorias,catFilter]);

  if(authLoading)return<div className="flex items-center justify-center h-screen bg-slate-50"><Loader2 className="w-10 h-10 text-blue-600 animate-spin"/></div>;
  if(mantenimiento?.activo&&!isAdmin)return<div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4"><div className="text-center max-w-md"><Settings className="w-16 h-16 text-amber-400 animate-spin mx-auto mb-6" style={{animationDuration:"3s"}}/><h1 className="text-2xl font-bold text-white mb-3">En mantenimiento</h1><p className="text-blue-200">{mantenimiento.mensaje||"Volvemos pronto."}</p></div></div>;

  /* LOGIN */
  if(!user&&!vitrina)return(
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4"><div className="w-full max-w-sm">
      <div className="text-center mb-8">{config.logo?<img src={config.logo} className="h-16 mx-auto mb-4 object-contain"/>:<div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-600/30"><Store className="w-8 h-8 text-white"/></div>}
        <h1 className="text-2xl font-bold text-white">{config.nombre_negocio||"Mi Depósito"}</h1></div>
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
        {authMode==="pendiente"&&<div className="text-center space-y-4"><Clock className="w-12 h-12 text-amber-400 mx-auto"/><h3 className="text-white font-bold">Registro enviado</h3><p className="text-blue-200 text-sm">{regMsg}</p><button onClick={()=>{setAuthMode("login");setRegMsg("");}} className="w-full py-3 bg-white/10 text-white rounded-xl text-sm">Volver</button></div>}
        {authMode==="login"&&<div className="space-y-4">
          <div><label className="text-blue-200 text-xs font-medium mb-1 block">Usuario</label><input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="usuario" value={loginUser} onChange={e=>setLoginUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/></div>
          <div><label className="text-blue-200 text-xs font-medium mb-1 block">Contraseña</label><div className="relative"><input type={showPass?"text":"password"} className="w-full px-4 py-3 pr-11 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="••••" value={loginPass} onChange={e=>setLoginPass(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()}/>
            <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300 hover:text-white">{showPass?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button></div></div>
          {loginError&&<p className="text-red-400 text-sm">{loginError}</p>}
          <button onClick={doLogin} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl">Ingresar</button>
          <button onClick={()=>{setAuthMode("register");setLoginError("");}} className="w-full py-2.5 text-blue-300 hover:text-white text-sm flex items-center justify-center gap-1.5"><UserPlus className="w-4 h-4"/>Crear cuenta</button></div>}
        {authMode==="register"&&<div className="space-y-3">
          <button onClick={()=>{setAuthMode("login");setRegError("");}} className="text-blue-300 text-sm flex items-center gap-1 hover:text-white"><ArrowLeft className="w-3.5 h-3.5"/>Volver</button>
          <div className="flex gap-2"><div className="flex-1"><label className="text-blue-200 text-xs font-medium mb-1 block">Nombre *</label><input className="w-full px-3 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={regForm.nombre} onChange={e=>setRegForm({...regForm,nombre:e.target.value})}/></div>
            <div className="flex-1"><label className="text-blue-200 text-xs font-medium mb-1 block">Apellido *</label><input className="w-full px-3 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={regForm.apellido} onChange={e=>setRegForm({...regForm,apellido:e.target.value})}/></div></div>
          <div><label className="text-blue-200 text-xs font-medium mb-1 block">Usuario *</label><input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={regForm.usuario} onChange={e=>setRegForm({...regForm,usuario:e.target.value})}/></div>
          <div><label className="text-blue-200 text-xs font-medium mb-1 block">Contraseña *</label><input type="password" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={regForm.password} onChange={e=>setRegForm({...regForm,password:e.target.value})}/></div>
          <div><label className="text-blue-200 text-xs font-medium mb-1 block">Tel / WhatsApp *</label><input className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={regForm.telefono} onChange={e=>setRegForm({...regForm,telefono:e.target.value})}/></div>
          <div><label className="text-blue-200 text-xs font-medium mb-1 block">Email *</label><input type="email" className="w-full px-4 py-3 bg-white/10 border border-white/10 rounded-xl text-white placeholder-blue-300/50 focus:outline-none focus:ring-2 focus:ring-blue-500" value={regForm.email} onChange={e=>setRegForm({...regForm,email:e.target.value})}/></div>
          {regError&&<p className="text-red-400 text-sm">{regError}</p>}
          <button onClick={doRegister} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl">Registrarme</button></div>}
        {authMode==="login"&&<div className="mt-6 pt-4 border-t border-white/10"><button onClick={()=>setVitrina(true)} className="w-full py-3 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl text-sm font-medium flex items-center justify-center gap-2"><Eye className="w-4 h-4"/>Vitrina Pública</button></div>}
      </div></div></div>);

  /* ═══ MAIN VIEW ═══ */
  return(<Ctx.Provider value={ctxVal}><div className={`min-h-screen pb-20 ${darkMode?"bg-slate-900 text-slate-100":"bg-slate-50"}`}>
    <style>{darkMode?`
      .bg-white{background:#1e293b!important;color:#e2e8f0!important}
      .bg-slate-50,.bg-slate-100{background:#0f172a!important}
      .border,.border-b,.border-t,.border-slate-100,.border-slate-50{border-color:#334155!important}
      .text-slate-800,.text-slate-700,.text-slate-600{color:#e2e8f0!important}
      .text-slate-500,.text-slate-400{color:#94a3b8!important}
      .bg-gradient-to-r{background:linear-gradient(to right,#0f172a,#1e3a5f)!important}
      input,select,textarea{background:#1e293b!important;color:#e2e8f0!important;border-color:#475569!important}
      .hover\\:shadow-md:hover{box-shadow:0 4px 6px rgba(0,0,0,.3)!important}
    `:""}</style>
    <div className="bg-gradient-to-r from-slate-800 to-blue-900 text-white px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2">{config.logo?<img src={config.logo} className="h-6 object-contain"/>:<Store className="w-4 h-4"/>}
        <span className="font-bold text-sm">{config.nombre_negocio||"Mi Depósito"}</span>
        {vitrina&&<span className="text-[10px] bg-amber-500 px-1.5 py-0.5 rounded-full font-medium">VITRINA</span>}
        {dolarBlue&&<span className="text-[10px] bg-white/15 px-1.5 py-0.5 rounded-full">Blue: {fmtARS(dolarBlue)}</span>}</div>
      <div className="flex items-center gap-2 text-xs">{!vitrina&&user&&<>{userLista&&<span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{backgroundColor:userLista.color+"33",color:userLista.color}}>{userLista.nombre}</span>}</>}
        <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-white/10" title="Modo oscuro">{darkMode?"☀️":"🌙"}</button>
        <button onClick={doLogout} className="p-1.5 rounded-lg hover:bg-white/10"><LogOut className="w-4 h-4"/></button></div></div>

    <header className="sticky top-0 z-40 bg-white border-b"><div className="flex items-center gap-2 px-3 py-2">
      <button onClick={()=>setShowCats(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 shrink-0"><Menu className="w-5 h-5 text-slate-700"/></button>
      <div className="flex-1 relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
        <input className="w-full pl-9 pr-3 py-2.5 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white" placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/>
        {search&&<button onClick={()=>setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-4 h-4 text-slate-400"/></button>}</div>
      <button onClick={()=>setShowCart(true)} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 shrink-0 relative"><ShoppingCart className="w-5 h-5 text-slate-700"/>
        {cartCount>0&&<span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}</button></div>
      {(catFilter||brandFilter)&&<div className="px-3 pb-2 flex items-center gap-2"><span className="text-xs text-slate-500">Filtro:</span><span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium truncate max-w-[200px]">{catFilter||brandFilter}</span>
        <button onClick={()=>{setCatFilter("");setBrandFilter("");}} className="text-xs text-red-500 underline">limpiar</button></div>}
      {userLista?.promo_msg&&<div className="px-3 pb-2"><p className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full font-medium inline-block">{userLista.promo_msg}</p></div>}
    </header>

    <main>
      {view==="catalog"&&<div className="p-3">
        {/* Info pagos/envíos arriba */}
        {(config.info_pagos||config.info_envios)&&<div className="flex gap-2 mb-3 overflow-x-auto">
          {config.info_pagos&&<div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-xs text-blue-800 whitespace-nowrap flex-shrink-0"><span className="font-bold">💳 Pagos:</span> {config.info_pagos}</div>}
          {config.info_envios&&<div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 whitespace-nowrap flex-shrink-0"><span className="font-bold">🚚 Envíos:</span> {config.info_envios}</div>}</div>}
        {loading&&!productos.length?<div className="text-center py-16"><Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto"/></div>
        :displayProducts.length===0?<div className="text-center py-16 text-slate-400"><Search className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Sin resultados</p>
          {matchingCats.length>0&&<div className="mt-3"><p className="text-sm text-slate-500 mb-2">Categorías que coinciden:</p>{matchingCats.map(c=><button key={c} onClick={()=>{setCatFilter(c);setSearch("");}} className="text-sm px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 mr-1 mb-1">{c}</button>)}</div>}
          <button onClick={()=>{setSearch("");setCatFilter("");setBrandFilter("");}} className="mt-3 text-sm text-blue-600 underline">Ver todos</button></div>
        :<>
          {/* Matching categories suggestions */}
          {matchingCats.length>0&&!catFilter&&<div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3"><p className="text-xs text-blue-800 font-medium mb-1.5">Categorías con "{searchDebounced}":</p>
            <div className="flex flex-wrap gap-1">{matchingCats.map(c=><button key={c} onClick={()=>{setCatFilter(c);setBrandFilter("");}} className="text-xs px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-700 hover:bg-blue-100"><span className="w-2 h-2 rounded-full inline-block mr-1" style={{backgroundColor:getCatColor(c)}}/>{c}</button>)}</div></div>}
          {crossResults&&<div className="bg-slate-100 rounded-xl p-2.5 mb-3"><div className="flex flex-wrap gap-1">{crossResults.categories.map(([cat,items])=><button key={cat} onClick={()=>{setCatFilter(cat);setBrandFilter("");}} className="text-xs px-2 py-1 rounded-full bg-white border text-slate-700 hover:bg-blue-50">{cat} ({items.length})</button>)}</div></div>}
          <div className="flex items-center justify-between mb-2"><p className="text-xs text-slate-400">{totalProductos} productos</p>
            <div className="flex items-center gap-2">
              {showStockBtn&&<button onClick={()=>setStockFilter(!stockFilter)} className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${stockFilter?"bg-emerald-100 text-emerald-700":"bg-slate-100 text-slate-500"}`}><Filter className="w-3 h-3"/>{stockFilter?"Con stock":"Stock"}</button>}
              <select className="text-xs px-2 py-1 border rounded-lg" value={pageSize} onChange={e=>{setPageSize(parseInt(e.target.value));setPage(1);}}>
                {[60,100,200,9999].map(n=><option key={n} value={n}>{n===9999?"Todos":`${n}/pág`}</option>)}</select></div></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">{displayProducts.map(p=><ProductCard key={p.id} p={p}/>)}</div>
          {totalProductos>pageSize&&pageSize<9999&&<div className="flex items-center justify-center gap-2 mt-4 py-4">
            <button disabled={page<=1} onClick={()=>loadProductos(page-1,searchDebounced,catFilter)} className="px-4 py-2 bg-white border rounded-xl text-sm font-medium disabled:opacity-30">←</button>
            <span className="text-sm text-slate-500">Pág. {page}</span>
            <button disabled={displayProducts.length<pageSize} onClick={()=>loadProductos(page+1,searchDebounced,catFilter)} className="px-4 py-2 bg-white border rounded-xl text-sm font-medium disabled:opacity-30">→</button></div>}
          {/* Banner promo */}
          {config.banner_texto&&<div className="mt-6 mb-2"><a href={`https://wa.me/${config.banner_wa||config.whatsapp||""}`} target="_blank" rel="noopener noreferrer"
            className="block bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-xl p-4 text-center hover:from-blue-700 hover:to-blue-900 transition-all">
            <Zap className="w-5 h-5 mx-auto mb-1"/>
            <p className="text-sm font-semibold">{config.banner_texto}</p>
            <p className="text-xs text-blue-200 mt-1">Tocá acá para contactarnos →</p></a></div>}
        </>}</div>}

      {/* ADMIN */}
      {view==="admin"&&isAdmin&&<div className="p-4 max-w-4xl mx-auto">
        {adminTab==="home"?<><h2 className="font-bold text-lg mb-4">Panel de Administración</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[["products","Productos",Package],["users","Usuarios",Users],["orders","Pedidos",ClipboardList],["tiers","Listas",DollarSign],["stats","Estadísticas",BarChart3],["config","Config",Settings]].map(([id,label,Icon])=>(
            <button key={id} onClick={()=>{setAdminTab(id);if(id==="stats"||id==="users"||id==="orders")refreshAdmin();}} className="bg-white border rounded-xl p-4 text-center hover:shadow-md relative">
              <Icon className="w-8 h-8 mx-auto mb-2 text-blue-500"/><p className="text-sm font-semibold text-slate-700">{label}</p>
              {id==="users"&&pendientesCount>0&&<span className="absolute top-2 right-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">{pendientesCount}</span>}</button>))}</div></>
        :<>
          <button onClick={()=>setAdminTab("home")} className="text-sm text-blue-600 flex items-center gap-1 mb-3 hover:underline"><ArrowLeft className="w-3.5 h-3.5"/>Panel</button>

          {adminTab==="products"&&<div className="space-y-3">
            <div className="flex gap-2 flex-wrap"><button onClick={()=>setAddProdModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4"/>Agregar</button>
              <button onClick={()=>setImportModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Upload className="w-4 h-4"/>Excel</button></div>
            {/* Price adjustment */}
            <PriceAdjustPanel/>
            <div className="bg-white border rounded-xl overflow-hidden"><h4 className="font-semibold text-sm p-3 border-b">Categorías → Productos</h4>
              <div className="max-h-[50vh] overflow-y-auto">{categorias.map(cat=>{const prods=productos.filter(p=>p.categoria===cat);const isExp=expandedCat===cat;
                return<div key={cat}><button onClick={()=>setExpandedCat(isExp?"":cat)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 border-b border-slate-50">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor:getCatColor(cat)}}/><span className="text-sm font-medium">{cat}</span></div>
                  <div className="flex items-center gap-2"><span className="text-xs text-slate-400">{prods.length}</span>{isExp?<ChevronDown className="w-3.5 h-3.5"/>:<ChevronRight className="w-3.5 h-3.5"/>}</div></button>
                  {isExp&&<div className="bg-slate-50">{prods.map(p=><div key={p.id} className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100 text-sm">
                    <span className="truncate flex-1">{p.modelo}</span><span className="text-xs text-slate-400 mx-2">{fmt(p.precio_base)}</span>
                    <button onClick={()=>setEditProduct(p)} className="p-1 rounded bg-white hover:bg-slate-200"><Edit2 className="w-3 h-3"/></button></div>)}
                    {!prods.length&&<p className="px-4 py-2 text-xs text-slate-400">Sin productos</p>}</div>}</div>;})}</div></div>
            <div className="bg-white border border-red-200 rounded-xl p-4 space-y-3"><h4 className="font-semibold text-sm text-red-600 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4"/>Peligro</h4>
              <div className="flex gap-2 flex-wrap items-end">
                <div className="flex-1"><label className="text-xs text-slate-500 mb-1 block">Borrar categoría</label>
                  <div className="flex gap-1"><select id="delCatSel" className="flex-1 px-2 py-2 border rounded-xl text-sm"><option value="">— Elegir —</option>{categorias.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    <button onClick={async()=>{const sel=document.getElementById("delCatSel").value;if(!sel||!confirm(`¿Eliminar toda la categoría "${sel}"?`))return;try{await API.deleteCategoria(sel);showToast("Categoría eliminada");await loadProductos(1,"","");setCategorias(await API.getCategorias().catch(()=>[]));}catch(e){showToast("Error: "+e.message);}}}
                      className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-medium">Borrar</button></div></div>
                <button onClick={async()=>{if(!confirm("¿Eliminar TODOS los productos?"))return;try{await API.deleteAllProductos();showToast("Eliminados");await loadProductos(1,"","");setCategorias(await API.getCategorias().catch(()=>[]));}catch(e){showToast("Error: "+e.message);}}}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-medium">Borrar TODOS</button>
              </div></div></div>}

          {adminTab==="users"&&<div>
            <div className="flex gap-2 mb-3"><button onClick={()=>setNewUserModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><UserPlus className="w-4 h-4"/>Nuevo</button>
              <button onClick={refreshAdmin} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Actualizar</button></div>
            {usuarios.filter(u=>u.estado==="pendiente").length>0&&<div className="mb-4"><h4 className="text-sm font-bold text-amber-700 mb-2"><Clock className="w-4 h-4 inline mr-1"/>Pendientes</h4>
              {usuarios.filter(u=>u.estado==="pendiente").map(u=><div key={u.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl p-3 mb-2">
                <div><p className="font-semibold text-sm">{u.nombre}</p><p className="text-xs text-slate-500">@{u.usuario} {u.telefono?`• ${u.telefono}`:""}</p></div>
                <button onClick={()=>setEditUser(u)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Revisar</button></div>)}</div>}
            {usuarios.filter(u=>u.estado!=="pendiente").map(u=>{const activo=u.activo!==false&&u.activo!=="false";return<div key={u.id} className={`flex items-center justify-between border rounded-xl p-3 mb-2 ${activo?"bg-white":"bg-red-50 border-red-200"}`}>
              <div><p className="font-semibold text-sm flex items-center gap-1.5">{u.nombre} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activo?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-600"}`}>{activo?"activo":"suspendido"}</span></p>
                <p className="text-xs text-slate-500">@{u.usuario} • {u.rol==="admin"?"Admin":listas.find(l=>l.id===u.lista_precio_id)?.nombre||""}</p></div>
              <div className="flex gap-1"><button onClick={()=>setEditUser(u)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"><Edit2 className="w-3.5 h-3.5"/></button>
                {u.rol!=="admin"&&<button onClick={async(ev)=>{ev.stopPropagation();if(!confirm(`¿Eliminar ${u.nombre}?`))return;try{await API.deleteUsuario(u.id);setUsuarios(prev=>prev.filter(x=>x.id!==u.id));showToast("Eliminado");setTimeout(()=>refreshAdmin(),500);}catch(err){showToast("Error: "+err.message);}}}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}</div></div>})}            {clientRanking.length>0&&<div className="mt-6"><h4 className="text-sm font-bold text-slate-700 mb-2"><TrendingUp className="w-4 h-4 inline mr-1"/>Ranking</h4>
              {clientRanking.slice(0,10).map((c,i)=><div key={c.nombre} className="flex items-center justify-between bg-white border rounded-lg p-2 mb-1">
                <span className="text-sm"><span className="font-bold text-slate-400 mr-2">#{i+1}</span>{c.nombre}</span>
                <span className="text-sm font-bold text-blue-600">{fmt(c.total)} <span className="text-xs text-slate-400 font-normal">({c.pedidos})</span></span></div>)}</div>}
          </div>}

          {adminTab==="orders"&&<div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex gap-1 overflow-x-auto">{["all","pendiente","preparando","listo","entregado","cancelado"].map(s=><button key={s} onClick={()=>setOrderFilter(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${orderFilter===s?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}>{s==="all"?"Todos":s}</button>)}</div>
              <button onClick={exportOrders} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-medium flex items-center gap-1"><Download className="w-3 h-3"/>Excel</button></div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">{pedidos.filter(o=>orderFilter==="all"||o.estado===orderFilter).map(o=>{
              const orderNum=typeof o.id==="number"?`#${String(o.id).padStart(4,"0")}`:`#${o.id}`;
              return<div key={o.id} className="bg-white border rounded-xl p-3 cursor-pointer hover:shadow-md" onClick={()=>setViewOrder(o)}>
                <div className="flex justify-between items-start">
                  <div><p className="font-semibold text-sm">{orderNum} — {o.usuario_nombre||"—"}</p>
                    <p className="text-xs text-slate-500">{new Date(o.fecha||o.created_at).toLocaleString("es-AR")} • {o.tipo_entrega==="retiro"?"Retiro":"Envío"}</p></div>
                  <div className="text-right"><p className="font-bold text-blue-600">{fmt(o.total)}</p><StatusBadge status={o.estado}/></div></div>
                <p className="text-xs text-slate-400 mt-1">{(o.items||[]).length} productos — Tocá para ver detalle</p></div>;})}
              {pedidos.filter(o=>orderFilter==="all"||o.estado===orderFilter).length===0&&<p className="text-center text-slate-400 py-8 text-sm">Sin pedidos</p>}
            </div></div>}

          {adminTab==="tiers"&&<div>
            <button onClick={()=>setEditTier("new")} className="mb-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"><Plus className="w-4 h-4"/>Nueva lista</button>
            {listas.map(t=><div key={t.id} className="flex items-center justify-between bg-white border rounded-xl p-3 mb-2">
              <div className="flex items-center gap-2"><div className="w-4 h-4 rounded-full" style={{backgroundColor:t.color}}/>
                <div><p className="font-semibold text-sm">{t.nombre}</p>
                  <p className="text-xs text-slate-500">{t.modo==="porcentaje"?`+${Math.round((t.multiplicador-1)*100)}%`:`×${t.multiplicador}`} → $1={fmt(t.multiplicador)}{t.compra_minima>0?` | Mín: ${fmt(t.compra_minima)}`:""}</p>
                  {t.promo_msg&&<p className="text-xs text-emerald-600">{t.promo_msg}</p>}</div></div>
              <div className="flex gap-1"><button onClick={()=>setEditTier(t)} className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200"><Edit2 className="w-3.5 h-3.5"/></button>
                {listas.length>1&&<button onClick={async()=>{try{const u=listas.filter(x=>x.id!==t.id);await API.updateListas(u);setListas(u);showToast("Eliminada");}catch(e){showToast("Error: "+e.message);}}}
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>}</div></div>)}</div>}

          {adminTab==="stats"&&<div className="space-y-4">
            <button onClick={refreshAdmin} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/>Actualizar</button>
            {stats&&<div className="grid grid-cols-2 gap-3">{[["Productos",stats.total_productos,Package],["Con stock",stats.con_stock,Check],["Usuarios",stats.total_usuarios,Users],["Pedidos",stats.total_pedidos,ClipboardList]].map(([l,v,Icon])=>
              <div key={l} className="bg-white border rounded-xl p-4 text-center"><Icon className="w-6 h-6 mx-auto mb-2 text-blue-500"/><p className="text-2xl font-bold">{v??"—"}</p><p className="text-xs text-slate-500">{l}</p></div>)}</div>}
            {profitData&&<div className="bg-white border rounded-xl p-4"><h4 className="font-semibold text-sm mb-3"><TrendingUp className="w-4 h-4 inline mr-1"/>Ganancias</h4>
              <div className="grid grid-cols-2 gap-3">{[["Hoy",profitData.hoy],["Semana",profitData.semana],["Mes",profitData.mes],["Año",profitData.año]].map(([label,d])=>
                <div key={label} className="bg-slate-50 rounded-lg p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold text-emerald-600">{fmt(d.profit)}</p><p className="text-[10px] text-slate-400">Vendido: {fmt(d.revenue)}</p></div>)}</div></div>}
          </div>}

          {adminTab==="config"&&<ConfigPanel/>}
        </>}
      </div>}

      {view==="orders"&&<div className="p-4 max-w-2xl mx-auto"><h2 className="font-bold text-lg mb-4">Mis Pedidos</h2>
        {(isAdmin?pedidos:pedidos.filter(o=>o.usuario_id===user?.id)).map(o=>{const orderNum=typeof o.id==="number"?`#${String(o.id).padStart(4,"0")}`:`#${o.id}`;
          return<div key={o.id} className="bg-white border rounded-xl p-3 mb-2 cursor-pointer hover:shadow-md" onClick={()=>setViewOrder(o)}>
            <div className="flex justify-between items-start"><div><p className="font-semibold text-sm">{orderNum}</p><p className="text-xs text-slate-500">{new Date(o.fecha||o.created_at).toLocaleString("es-AR")}</p></div>
              <div className="text-right"><p className="font-bold text-blue-600">{fmt(o.total)}</p><StatusBadge status={o.estado}/></div></div>
            <p className="text-xs text-slate-400 mt-1">{(o.items||[]).length} productos — Tocá para ver</p></div>;})}
      </div>}

      {view==="account"&&!vitrina&&user&&<AccountPanel user={user} userLista={userLista} config={config} doLogout={doLogout}/>}
    </main>

    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-30 px-2 pb-safe"><div className="flex justify-around py-1.5">
      {[["catalog","Catálogo",Package],...(isAdmin?[["admin","Admin",Settings]]:[]),["orders","Pedidos",ClipboardList],...(!vitrina?[["account","Cuenta",User]]:[])].map(([id,label,Icon])=>
        <button key={id} onClick={()=>{setView(id);if(id==="admin")setAdminTab("home");}} className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl ${view===id?"text-blue-600":"text-slate-400"}`}>
          <Icon className="w-5 h-5"/><span className="text-[10px] font-medium">{label}</span></button>)}</div></nav>

    {cartCount>0&&!showCart&&<button onClick={()=>setShowCart(true)} className="fixed bottom-20 right-4 z-30 bg-blue-600 text-white rounded-2xl px-4 py-3 shadow-lg shadow-blue-600/30 flex items-center gap-2">
      <ShoppingCart className="w-5 h-5"/><span className="font-bold text-sm">{cartCount}</span><span className="text-xs opacity-80">|</span><span className="font-bold text-sm">{fmt(cartTotal)}</span></button>}

    {/* Sidebar */}
    <div className={`fixed inset-0 z-50 ${showCats?"":"pointer-events-none"}`}><div className={`absolute inset-0 bg-black/50 transition-opacity ${showCats?"opacity-100":"opacity-0"}`} onClick={()=>setShowCats(false)}/>
      <div className={`absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl transition-transform ${showCats?"translate-x-0":"-translate-x-full"} overflow-y-auto`}>
        <div className="p-4 border-b sticky top-0 bg-white z-10 flex items-center justify-between"><h3 className="font-bold">Categorías</h3><button onClick={()=>setShowCats(false)}><X className="w-5 h-5"/></button></div>
        <button onClick={()=>{setCatFilter("");setBrandFilter("");setShowCats(false);}} className={`w-full text-left px-4 py-2.5 text-sm border-b ${!catFilter&&!brandFilter?"bg-blue-50 text-blue-700 font-semibold":"text-slate-700 hover:bg-slate-50"}`}>Todos</button>
        <div className="px-4 py-2"><p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Marcas</p>
          <div className="flex flex-wrap gap-1.5">{brands.map(b=><button key={b} onClick={()=>{setBrandFilter(brandFilter===b?"":b);setCatFilter("");setShowCats(false);}}
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${brandFilter===b?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}>{b}</button>)}</div></div>
        {categorias.map(c=><button key={c} onClick={()=>{setCatFilter(c);setBrandFilter("");setShowCats(false);}}
          className={`w-full text-left px-4 py-2 text-sm border-b border-slate-50 flex items-center gap-2 ${catFilter===c?"bg-blue-50 text-blue-700 font-semibold":"text-slate-600 hover:bg-slate-50"}`}>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:getCatColor(c)}}/><span className="truncate">{c}</span></button>)}
      </div></div>

    {/* Cart */}
    {showCart&&<div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={e=>e.target===e.currentTarget&&(()=>{setShowCart(false);setCheckout(false);})()}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center shrink-0"><h3 className="font-bold">{presupuesto?"Presupuesto":"Carrito"} ({cartCount})</h3>
          <div className="flex items-center gap-2"><button onClick={()=>setPresupuesto(!presupuesto)} className={`text-xs px-2 py-1 rounded-full ${presupuesto?"bg-amber-100 text-amber-700":"bg-slate-100 text-slate-500"}`}>{presupuesto?"Presupuesto":"Pedido"}</button>
            <button onClick={()=>{setShowCart(false);setCheckout(false);}}><X className="w-5 h-5"/></button></div></div>
        {checkout?<div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div className="flex gap-2"><button onClick={()=>setCheckoutType("retiro")} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 ${checkoutType==="retiro"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}><Store className="w-4 h-4"/>Retiro</button>
            <button onClick={()=>setCheckoutType("envio")} className={`flex-1 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 border-2 ${checkoutType==="envio"?"border-blue-600 bg-blue-50 text-blue-700":"border-slate-200"}`}><Truck className="w-4 h-4"/>Envío</button></div>
          {checkoutType==="envio"&&<textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={2} placeholder="Dirección *" value={checkoutAddr} onChange={e=>setCheckoutAddr(e.target.value)}/>}
          <textarea className="w-full px-3 py-2.5 border rounded-xl text-sm" rows={2} placeholder="Notas (opcional)" value={checkoutNotes} onChange={e=>setCheckoutNotes(e.target.value)}/>
          <div className="bg-slate-50 rounded-xl p-3"><div className="flex justify-between text-lg"><span className="font-bold">Total</span><span className="font-bold text-blue-600">{fmt(cartTotal)}</span></div>
            {dolarBlue&&<p className="text-xs text-slate-400 text-right">{fmtARS(cartTotal*dolarBlue)}</p>}
            {minCompra>0&&!cartMeetsMin&&<p className="text-xs text-red-500 mt-1">Mínimo: {fmt(minCompra)}</p>}</div>
          <button onClick={placeOrder} disabled={loading||!cartMeetsMin} className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Check className="w-4 h-4"/>}Confirmar</button>
        </div>:<>
          <div className="overflow-y-auto flex-1 p-4">{cart.length===0?<div className="text-center py-12 text-slate-400"><ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30"/><p>Vacío</p></div>
            :cart.map(item=>{const price=userLista?getPrice(item.precio_base,userLista,pfMap,item.id):0;return(
              <div key={item.id} className="flex items-center gap-3 py-3 border-b border-slate-50"><div className="flex-1 min-w-0"><p className="text-xs text-slate-400 truncate">{item.categoria}</p><p className="text-sm font-semibold truncate">{item.modelo}</p>
                <p className="text-sm font-bold text-blue-600">{fmt(price)} <span className="text-xs text-slate-400 font-normal">= {fmt(price*item.qty)}</span></p></div>
                <div className="flex items-center gap-1"><input type="number" min="1" value={item.qty} onChange={e=>setCart(prev=>prev.map(c=>c.id===item.id?{...c,qty:Math.max(1,parseInt(e.target.value)||1)}:c))}
                  className="w-14 px-1 py-1.5 border rounded-lg text-center text-sm"/>
                  <button onClick={()=>setCart(prev=>prev.filter(c=>c.id!==item.id))} className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-red-500"><Trash2 className="w-3.5 h-3.5"/></button></div></div>);})}</div>
          {cart.length>0&&<div className="p-4 border-t shrink-0"><div className="flex justify-between text-lg mb-3"><span className="font-bold">Total</span><span className="font-bold text-blue-600">{fmt(cartTotal)}</span></div>
            <div className="flex gap-2">{!presupuesto&&<button onClick={()=>setCheckout(true)} className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl">Finalizar</button>}
              {presupuesto&&<button onClick={()=>printRemito({id:"PRESUP",items:cart.map(i=>({categoria:i.categoria,modelo:i.modelo,cantidad:i.qty,precio_unitario:getPrice(i.precio_base,userLista,pfMap,i.id)})),total:cartTotal,tipo_entrega:"",fecha:new Date().toISOString()},"A4")}
                className="flex-1 py-3 bg-amber-600 text-white font-semibold rounded-xl flex items-center justify-center gap-2"><Printer className="w-4 h-4"/>Imprimir</button>}
              <button onClick={shareCart} className="py-3 px-3 bg-slate-100 rounded-xl"><Share2 className="w-4 h-4"/></button>
              <button onClick={()=>setCart([])} className="py-3 px-3 bg-red-50 text-red-600 rounded-xl text-sm">Vaciar</button></div></div>}
        </>}
      </div></div>}

    {/* Modals */}
    {editProduct&&<EditProductModal product={editProduct} onClose={()=>setEditProduct(null)}/>}
    {addProdModal&&<AddProdModal onClose={()=>setAddProdModal(false)}/>}
    {importModal&&<ImportModal onClose={()=>setImportModal(false)}/>}
    {editUser&&<UserModal u={editUser} isNew={false} onClose={()=>setEditUser(null)}/>}
    {newUserModal&&<UserModal u={null} isNew={true} onClose={()=>setNewUserModal(false)}/>}
    {editTier&&<TierModal tier={editTier==="new"?null:editTier} isNew={editTier==="new"} onClose={()=>setEditTier(null)}/>}
    {viewOrder&&<OrderDetailModal order={viewOrder} onClose={()=>setViewOrder(null)} onUpdate={updateOrder} onPrint={printRemito} onClone={cloneOrder}/>}

    {toast&&<div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] bg-slate-800 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
  </div></Ctx.Provider>);
}
