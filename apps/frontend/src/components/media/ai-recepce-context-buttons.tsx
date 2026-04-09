'use client';

import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';

const AI_RECEPCE_URL = process.env.NEXT_PUBLIC_AI_RECEPCE_URL || '';

const getAuthParam = () => {
  const auth = document.cookie.match(/auth=([^;]+)/)?.[1] || '';
  return auth ? `auth=${encodeURIComponent(auth)}` : '';
};

const fetchCtx = async (path: string) => {
  const sep = path.includes('?') ? '&' : '?';
  const resp = await fetch(`${AI_RECEPCE_URL}/api/social-media/context/${path}${sep}${getAuthParam()}`);
  if (!resp.ok) throw new Error(`${resp.status}`);
  return resp.json();
};

const setContext = (text: string) => {
  (window as any).__aiRecepceCtx = text;
  window.dispatchEvent(new CustomEvent('airecepce-context', { detail: text }));
};

// ============================================================
// KB Modal
// ============================================================
const KBModal: FC<{ onDone: (t: string) => void }> = ({ onDone }) => {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const modal = useModals();

  useEffect(() => {
    fetchCtx('kb').then(d => {
      setData(d);
      const ids = [...(d.knowledgeBases||[]).map((k:any)=>k.id), ...(d.articles||[]).map((a:any)=>a.id), ...(d.faqs||[]).map((f:any)=>f.id)];
      setSelected(new Set(ids));
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const items = data ? [
    ...(data.knowledgeBases||[]).map((k:any)=>({id:k.id, label:k.name, sub:`Typ: ${k.type}`, body:k.body, group:'KB'})),
    ...(data.articles||[]).map((a:any)=>({id:a.id, label:a.title, sub:a.excerpt?.substring(0,60), content:a.content, group:'Článek'})),
    ...(data.faqs||[]).map((f:any)=>({id:f.id, label:f.question, sub:f.answer?.substring(0,60), answer:f.answer, group:'FAQ'})),
  ] : [];

  const toggle = (id:string) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n});

  const confirm = () => {
    const sel = items.filter(i=>selected.has(i.id));
    const text = sel.map(i => {
      if(i.group==='FAQ') return `Otázka: ${i.label}\nOdpověď: ${i.answer||i.sub}`;
      if(i.group==='Článek') return `Článek "${i.label}": ${i.content||i.sub}`;
      return `KB "${i.label}": ${i.body||''}`;
    }).join('\n\n');
    onDone(text);
    modal.closeCurrent();
  };

  return (
    <div className="flex flex-col gap-2">
      {loading && <div className="py-4 text-center text-textItemBlur">Načítání...</div>}
      <div className="max-h-[400px] overflow-y-auto flex flex-col gap-1">
        {items.map(i=>(
          <div key={i.id} onClick={()=>toggle(i.id)} className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg ${selected.has(i.id)?'bg-btnPrimary/10 border border-btnPrimary/30':'hover:bg-newBgLineColor'}`}>
            <input type="checkbox" checked={selected.has(i.id)} readOnly className="accent-[#E8751A] w-4 h-4 shrink-0"/>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{i.label}</div>
              <div className="text-xs text-textItemBlur truncate">{i.group} · {i.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {items.length>0 && <button onClick={confirm} className="mt-2 w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90">Použít vybrané ({selected.size})</button>}
    </div>
  );
};

// ============================================================
// Reservations Modal
// ============================================================
const ReservationsModal: FC<{ onDone: (t: string) => void }> = ({ onDone }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCal, setSelectedCal] = useState('');
  const [selectedSvc, setSelectedSvc] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const today = new Date().toISOString().split('T')[0];
  const defaultEnd = new Date(Date.now() + 14*86400000).toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(defaultEnd);
  const modal = useModals();

  useEffect(() => {
    fetchCtx('reservations?period=this_week').then(d => {
      setData(d);
      if(d.calendars?.[0]) setSelectedCal(d.calendars[0].id);
      if(d.services?.[0]) setSelectedSvc(d.services[0].id);
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const loadSlots = useCallback(async()=>{
    if(!selectedCal||!selectedSvc||!dateFrom||!dateTo) return;
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlots(new Set());
    try {
      const d = await fetchCtx(`free-slots?calendarId=${selectedCal}&serviceId=${selectedSvc}&from=${dateFrom}&to=${dateTo}`);
      setSlots(d.slots||[]);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  },[selectedCal, selectedSvc, dateFrom, dateTo]);

  // No auto-load — user clicks "Načíst volné termíny" button

  const toggleSlot = (i:string) => setSelectedSlots(p=>{const n=new Set(p);n.has(i)?n.delete(i):n.add(i);return n});

  const confirm = () => {
    const sel = slots.filter((_:any,i:number)=>selectedSlots.has(String(i)));
    const calName = data?.calendars?.find((c:any)=>c.id===selectedCal)?.name||'';
    const svcName = data?.services?.find((s:any)=>s.id===selectedSvc)?.name||'';
    const text = `Volné termíny pro "${svcName}" (${calName}):\n`+sel.map((s:any)=>`- ${s.label||s.date+' '+s.time}`).join('\n');
    onDone(text);
    modal.closeCurrent();
  };

  if(loading) return <div className="py-4 text-center text-textItemBlur">Načítání...</div>;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-semibold text-textItemBlur mb-1 block">Kalendář</label>
        <select value={selectedCal} onChange={e=>setSelectedCal(e.target.value)} className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm">
          {(data?.calendars||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-textItemBlur mb-1 block">Služba</label>
        <select value={selectedSvc} onChange={e=>setSelectedSvc(e.target.value)} className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm">
          {(data?.services||[]).map((s:any)=><option key={s.id} value={s.id}>{s.name} ({s.duration} min, {s.price} {s.currency||'CZK'})</option>)}
        </select>
      </div>
      {/* Období */}
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-textItemBlur mb-1 block">Od</label>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm"/>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-textItemBlur mb-1 block">Do</label>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm"/>
        </div>
      </div>
      <button onClick={loadSlots} disabled={slotsLoading||!selectedCal||!selectedSvc} className="w-full bg-newColColor text-textColor py-2 rounded-lg text-sm font-semibold hover:bg-btnPrimary/20 disabled:opacity-50">
        {slotsLoading ? 'Načítání...' : 'Načíst volné termíny'}
      </button>
      <div>
        <label className="text-xs font-semibold text-textItemBlur mb-1 block">Volné termíny {slots.length>0&&`(${slots.length})`}</label>
        <div className="max-h-[250px] overflow-y-auto flex flex-col gap-1">
          {slots.length===0&&!slotsLoading&&<div className="text-sm text-textItemBlur py-2">Žádné volné termíny</div>}
          {slots.map((s:any,i:number)=>(
            <div key={i} onClick={()=>toggleSlot(String(i))} className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded text-sm ${selectedSlots.has(String(i))?'bg-btnPrimary/10 border border-btnPrimary/30':'hover:bg-newBgLineColor'}`}>
              <input type="checkbox" checked={selectedSlots.has(String(i))} readOnly className="accent-[#E8751A] w-3.5 h-3.5"/>
              <span>{s.label||`${s.date} ${s.time}`}</span>
            </div>
          ))}
        </div>
      </div>
      {slots.length>0&&<button onClick={confirm} className="w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90">Použít vybrané ({selectedSlots.size})</button>}
    </div>
  );
};

// ============================================================
// Products Modal
// ============================================================
const ProductsModal: FC<{ onDone: (t: string) => void }> = ({ onDone }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const modal = useModals();
  const timer = useRef<any>(null);

  const load = useCallback(async(q:string)=>{
    setLoading(true);
    try { const d=await fetchCtx(`products?limit=50${q?`&search=${encodeURIComponent(q)}`:''}`); setProducts(d.products||[]); }
    catch { setProducts([]); }
    finally { setLoading(false); }
  },[]);

  useEffect(()=>{load('')},[load]);

  const onSearch = (v:string) => { setSearch(v); clearTimeout(timer.current); timer.current=setTimeout(()=>load(v),300); };
  const toggle = (id:string) => setSelected(p=>{const n=new Set(p);n.has(id)?n.delete(id):n.add(id);return n});

  const confirm = () => {
    const sel = products.filter(p=>selected.has(p.id));
    const text = sel.map(p=>{
      const price = p.variants?.[0]?.basePrice?`${Number(p.variants[0].basePrice)} Kč`:'';
      const imgs = (p.images||[]).map((img:any)=>img.url).join(', ');
      return `Produkt "${p.name}": ${p.description||''}. Cena: ${price}. ${p.metaDescription||''} ${imgs?`Obrázky: ${imgs}`:''}`;
    }).join('\n\n');
    onDone(text);
    modal.closeCurrent();
  };

  return (
    <div className="flex flex-col gap-3">
      <input type="text" value={search} onChange={e=>onSearch(e.target.value)} placeholder="Hledat produkty..." className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm"/>
      <div className="max-h-[350px] overflow-y-auto flex flex-col gap-2">
        {loading&&<div className="py-4 text-center text-textItemBlur">Načítání...</div>}
        {!loading&&products.length===0&&<div className="py-4 text-center text-textItemBlur">Žádné produkty</div>}
        {products.map(p=>(
          <div key={p.id} onClick={()=>toggle(p.id)} className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg ${selected.has(p.id)?'bg-btnPrimary/10 border border-btnPrimary/30':'hover:bg-newBgLineColor'}`}>
            <input type="checkbox" checked={selected.has(p.id)} readOnly className="accent-[#E8751A] w-4 h-4 shrink-0"/>
            {p.images?.[0]?.url&&<img src={p.images[0].url} alt="" className="w-10 h-10 rounded object-cover shrink-0"/>}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-textItemBlur truncate">{p.variants?.[0]?.basePrice?`${Number(p.variants[0].basePrice)} Kč`:''} · {p.description?.substring(0,50)||''}</div>
            </div>
          </div>
        ))}
      </div>
      {selected.size>0&&<button onClick={confirm} className="w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90">Použít vybrané ({selected.size})</button>}
    </div>
  );
};

// ============================================================
// Icons
// ============================================================
const CalIcon: FC = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5.33 1.33V3.33M10.67 1.33V3.33M1.33 6.33H14.67M2.67 2.67H13.33C14.07 2.67 14.67 3.26 14.67 4V13.33C14.67 14.07 14.07 14.67 13.33 14.67H2.67C1.93 14.67 1.33 14.07 1.33 13.33V4C1.33 3.26 1.93 2.67 2.67 2.67Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const BookIcon: FC = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.67 12.67V3.33C2.67 2.6 3.26 2 4 2H12C12.74 2 13.33 2.6 13.33 3.33V12.67C13.33 13.4 12.74 14 12 14H4C3.26 14 2.67 13.4 2.67 12.67ZM5.33 5.33H10.67M5.33 8H8.67" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const ShopIcon: FC = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1.33 1.33H3.33L5.12 9.59C5.18 9.9 5.35 10.18 5.6 10.37C5.84 10.57 6.15 10.67 6.46 10.67H12.53C12.85 10.67 13.15 10.57 13.4 10.37C13.65 10.18 13.82 9.9 13.88 9.59L14.67 5.33H4M6.67 13.33C6.67 13.7 6.37 14 6 14S5.33 13.7 5.33 13.33 5.63 12.67 6 12.67 6.67 12.96 6.67 13.33ZM13.33 13.33C13.33 13.7 13.04 14 12.67 14S12 13.7 12 13.33 12.3 12.67 12.67 12.67 13.33 12.96 13.33 13.33Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// ============================================================
// Toolbar
// ============================================================
const btns = [
  { key:'reservations', label:'Rezervace', Icon:CalIcon, title:'Vybrat volné termíny' },
  { key:'kb', label:'Znalostní báze', Icon:BookIcon, title:'Vybrat znalostní bázi' },
  { key:'products', label:'Produkty', Icon:ShopIcon, title:'Vybrat produkty' },
] as const;

export const AiRecepceContextButtons: FC = () => {
  const [active, setActive] = useState<Record<string,boolean>>({});
  const ctxRef = useRef<Record<string,string>>({});
  const modal = useModals();

  const handleDone = useCallback((type:string, text:string) => {
    ctxRef.current[type] = text;
    setActive(p=>({...p,[type]:true}));
    setContext(Object.values(ctxRef.current).filter(Boolean).join('\n\n'));
  },[]);

  const open = useCallback((type:string, title:string) => {
    const C = type==='kb'?KBModal:type==='reservations'?ReservationsModal:ProductsModal;
    modal.openModal({ title, withCloseButton:true, children:<C onDone={t=>handleDone(type,t)}/> });
  },[modal, handleDone]);

  if(!AI_RECEPCE_URL) return null;

  return <>
    {btns.map(({key,label,Icon,title})=>(
      <div key={key} onClick={()=>open(key,title)}
        className={`cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex px-[8px] transition-all ${active[key]?'bg-btnPrimary text-white':'bg-newColColor hover:bg-btnPrimary/20'}`} title={title}>
        <div className="flex gap-[8px] items-center"><Icon/><span className="text-[10px] font-[600] iconBreak:hidden block">{label}</span></div>
      </div>
    ))}
  </>;
};
