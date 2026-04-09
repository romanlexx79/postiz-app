'use client';

import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';

const AI_RECEPCE_URL = process.env.NEXT_PUBLIC_AI_RECEPCE_URL || '';

// ============================================================
// Shared helpers
// ============================================================

const getAuthParam = () => {
  const auth = document.cookie.match(/auth=([^;]+)/)?.[1] || '';
  return auth ? `auth=${encodeURIComponent(auth)}` : '';
};

const fetchContext = async (path: string) => {
  const sep = path.includes('?') ? '&' : '?';
  const resp = await fetch(`${AI_RECEPCE_URL}/api/social-media/context/${path}${sep}${getAuthParam()}`);
  if (!resp.ok) throw new Error('Chyba načítání');
  return resp.json();
};

const setContext = (text: string) => {
  (window as any).__aiRecepceCtx = text;
  window.dispatchEvent(new CustomEvent('airecepce-context', { detail: text }));
};

// ============================================================
// KB Modal
// ============================================================

const KBModal: FC<{ onDone: (text: string) => void }> = ({ onDone }) => {
  const [data, setData] = useState<any>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const modal = useModals();

  useEffect(() => {
    fetchContext('kb').then(d => {
      setData(d);
      const allIds = [
        ...(d.knowledgeBases || []).map((k: any) => k.id),
        ...(d.articles || []).map((a: any) => a.id),
        ...(d.faqs || []).map((f: any) => f.id),
      ];
      setSelected(new Set(allIds));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const items = data ? [
    ...(data.knowledgeBases || []).map((k: any) => ({ id: k.id, label: k.name, sub: `Typ: ${k.type}`, group: 'KB', body: k.body })),
    ...(data.articles || []).map((a: any) => ({ id: a.id, label: a.title, sub: a.excerpt?.substring(0, 60), group: 'Článek', content: a.content })),
    ...(data.faqs || []).map((f: any) => ({ id: f.id, label: f.question, sub: f.answer?.substring(0, 60), group: 'FAQ', answer: f.answer })),
  ] : [];

  const confirm = () => {
    const sel = items.filter(i => selected.has(i.id));
    const text = sel.map(i => {
      if (i.group === 'FAQ') return `Otázka: ${i.label}\nOdpověď: ${i.answer || i.sub}`;
      if (i.group === 'Článek') return `Článek "${i.label}": ${i.content || i.sub}`;
      return `KB "${i.label}": ${i.body || ''}`;
    }).join('\n\n');
    onDone(text);
    modal.closeCurrent();
  };

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <ModalWrapperComponent title="Vybrat znalostní bázi">
      <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto">
        {loading && <div className="py-4 text-center text-textItemBlur">Načítání...</div>}
        {items.map(i => (
          <div key={i.id} onClick={() => toggle(i.id)}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg ${selected.has(i.id) ? 'bg-btnPrimary/10 border border-btnPrimary/30' : 'hover:bg-newBgLineColor'}`}>
            <input type="checkbox" checked={selected.has(i.id)} readOnly className="accent-[#E8751A] w-4 h-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{i.label}</div>
              <div className="text-xs text-textItemBlur truncate">{i.group} · {i.sub}</div>
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <button onClick={confirm} className="mt-4 w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90">
          Použít vybrané ({selected.size})
        </button>
      )}
    </ModalWrapperComponent>
  );
};

// ============================================================
// Reservations Modal — kalendáře + služby + volné termíny
// ============================================================

const ReservationsModal: FC<{ onDone: (text: string) => void }> = ({ onDone }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCal, setSelectedCal] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [slots, setSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const modal = useModals();

  useEffect(() => {
    fetchContext('reservations?period=this_week').then(d => {
      setData(d);
      if (d.calendars?.[0]) setSelectedCal(d.calendars[0].id);
      if (d.services?.[0]) setSelectedService(d.services[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Načíst volné termíny po výběru kalendáře + služby
  const loadSlots = useCallback(async () => {
    if (!selectedCal || !selectedService) return;
    setSlotsLoading(true);
    try {
      const today = new Date();
      const nextWeek = new Date(today); nextWeek.setDate(today.getDate() + 14);
      const from = today.toISOString().split('T')[0];
      const to = nextWeek.toISOString().split('T')[0];
      const d = await fetchContext(`free-slots?calendarId=${selectedCal}&serviceId=${selectedService}&from=${from}&to=${to}`);
      setSlots(d.slots || []);
      setSelectedSlots(new Set((d.slots || []).map((_: any, i: number) => String(i))));
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  }, [selectedCal, selectedService]);

  useEffect(() => { if (selectedCal && selectedService) loadSlots(); }, [selectedCal, selectedService, loadSlots]);

  const toggleSlot = (idx: string) => setSelectedSlots(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });

  const confirm = () => {
    const selSlots = slots.filter((_: any, i: number) => selectedSlots.has(String(i)));
    const calName = data?.calendars?.find((c: any) => c.id === selectedCal)?.name || '';
    const svcName = data?.services?.find((s: any) => s.id === selectedService)?.name || '';
    const text = `Volné termíny pro "${svcName}" (${calName}):\n` +
      selSlots.map((s: any) => `- ${s.label || s.date + ' ' + s.time}`).join('\n');
    onDone(text);
    modal.closeCurrent();
  };

  return (
    <ModalWrapperComponent title="Vybrat volné termíny">
      {loading ? <div className="py-4 text-center text-textItemBlur">Načítání...</div> : (
        <div className="flex flex-col gap-3">
          {/* Kalendář */}
          <div>
            <label className="text-xs font-semibold text-textItemBlur mb-1 block">Kalendář</label>
            <select value={selectedCal} onChange={e => setSelectedCal(e.target.value)}
              className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm">
              {(data?.calendars || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {/* Služba */}
          <div>
            <label className="text-xs font-semibold text-textItemBlur mb-1 block">Služba</label>
            <select value={selectedService} onChange={e => setSelectedService(e.target.value)}
              className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm">
              {(data?.services || []).map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.duration} min, {s.price} {s.currency || 'CZK'})</option>)}
            </select>
          </div>
          {/* Volné termíny */}
          <div>
            <label className="text-xs font-semibold text-textItemBlur mb-1 block">
              Volné termíny (příštích 14 dní) {slotsLoading && '— načítání...'}
            </label>
            <div className="max-h-[250px] overflow-y-auto flex flex-col gap-1">
              {slots.length === 0 && !slotsLoading && <div className="text-sm text-textItemBlur py-2">Žádné volné termíny</div>}
              {slots.map((s: any, i: number) => (
                <div key={i} onClick={() => toggleSlot(String(i))}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer rounded text-sm ${selectedSlots.has(String(i)) ? 'bg-btnPrimary/10 border border-btnPrimary/30' : 'hover:bg-newBgLineColor'}`}>
                  <input type="checkbox" checked={selectedSlots.has(String(i))} readOnly className="accent-[#E8751A] w-3.5 h-3.5" />
                  <span>{s.label || `${s.date} ${s.time}`}</span>
                </div>
              ))}
            </div>
          </div>
          {slots.length > 0 && (
            <button onClick={confirm} className="w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90">
              Použít vybrané termíny ({selectedSlots.size})
            </button>
          )}
        </div>
      )}
    </ModalWrapperComponent>
  );
};

// ============================================================
// Products Modal — vyhledávání + multi-select + plné detaily
// ============================================================

const ProductsModal: FC<{ onDone: (text: string) => void }> = ({ onDone }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const modal = useModals();
  const searchTimeout = useRef<any>(null);

  const loadProducts = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const d = await fetchContext(`products?limit=50${q ? `&search=${encodeURIComponent(q)}` : ''}`);
      setProducts(d.products || []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadProducts(''); }, [loadProducts]);

  const onSearch = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => loadProducts(val), 300);
  };

  const toggle = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const confirm = () => {
    const sel = products.filter(p => selected.has(p.id));
    const text = sel.map(p => {
      const price = p.variants?.[0]?.basePrice ? `${Number(p.variants[0].basePrice)} Kč` : '';
      const imgs = (p.images || []).map((img: any) => img.url).join(', ');
      return `Produkt "${p.name}": ${p.description || 'bez popisu'}. Cena: ${price}. ${p.metaDescription || ''} ${imgs ? `Obrázky: ${imgs}` : ''}`;
    }).join('\n\n');
    onDone(text);
    modal.closeCurrent();
  };

  return (
    <ModalWrapperComponent title="Vybrat produkty">
      <div className="flex flex-col gap-3">
        <input type="text" value={search} onChange={e => onSearch(e.target.value)} placeholder="Hledat produkty..."
          className="w-full bg-newBgLineColor text-textColor border border-newBorder rounded-lg px-3 py-2 text-sm" />
        <div className="max-h-[350px] overflow-y-auto flex flex-col gap-2">
          {loading && <div className="py-4 text-center text-textItemBlur">Načítání...</div>}
          {!loading && products.length === 0 && <div className="py-4 text-center text-textItemBlur">Žádné produkty</div>}
          {products.map(p => (
            <div key={p.id} onClick={() => toggle(p.id)}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg ${selected.has(p.id) ? 'bg-btnPrimary/10 border border-btnPrimary/30' : 'hover:bg-newBgLineColor'}`}>
              <input type="checkbox" checked={selected.has(p.id)} readOnly className="accent-[#E8751A] w-4 h-4 shrink-0" />
              {p.images?.[0]?.url && <img src={p.images[0].url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-xs text-textItemBlur truncate">
                  {p.variants?.[0]?.basePrice ? `${Number(p.variants[0].basePrice)} Kč` : ''} · {p.description?.substring(0, 50) || ''}
                </div>
              </div>
            </div>
          ))}
        </div>
        {products.length > 0 && selected.size > 0 && (
          <button onClick={confirm} className="w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90">
            Použít vybrané ({selected.size})
          </button>
        )}
      </div>
    </ModalWrapperComponent>
  );
};

// ============================================================
// Toolbar Icons (SVG matching Postiz style)
// ============================================================

const CalendarIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5.33 1.33V3.33M10.67 1.33V3.33M1.33 6.33H14.67M2.67 2.67H13.33C14.07 2.67 14.67 3.26 14.67 4V13.33C14.67 14.07 14.07 14.67 13.33 14.67H2.67C1.93 14.67 1.33 14.07 1.33 13.33V4C1.33 3.26 1.93 2.67 2.67 2.67Z"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BookIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.67 12.67V3.33C2.67 2.6 3.26 2 4 2H12C12.74 2 13.33 2.6 13.33 3.33V12.67C13.33 13.4 12.74 14 12 14H4C3.26 14 2.67 13.4 2.67 12.67ZM5.33 5.33H10.67M5.33 8H8.67"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShoppingIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M1.33 1.33H3.33L5.12 9.59C5.18 9.9 5.35 10.18 5.6 10.37C5.84 10.57 6.15 10.67 6.46 10.67H12.53C12.85 10.67 13.15 10.57 13.4 10.37C13.65 10.18 13.82 9.9 13.88 9.59L14.67 5.33H4M6.67 13.33C6.67 13.7 6.37 14 6 14C5.63 14 5.33 13.7 5.33 13.33C5.33 12.96 5.63 12.67 6 12.67C6.37 12.67 6.67 12.96 6.67 13.33ZM13.33 13.33C13.33 13.7 13.04 14 12.67 14C12.3 14 12 13.7 12 13.33C12 12.96 12.3 12.67 12.67 12.67C13.04 12.67 13.33 12.96 13.33 13.33Z"
      stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ============================================================
// Main Toolbar Buttons
// ============================================================

const buttons = [
  { key: 'reservations', label: 'Rezervace', Icon: CalendarIcon },
  { key: 'kb', label: 'Znalostní báze', Icon: BookIcon },
  { key: 'products', label: 'Produkty', Icon: ShoppingIcon },
] as const;

export const AiRecepceContextButtons: FC = () => {
  const [active, setActive] = useState<Record<string, boolean>>({});
  const contextRef = useRef<Record<string, string>>({});
  const modal = useModals();

  const handleDone = useCallback((type: string, text: string) => {
    contextRef.current[type] = text;
    setActive(prev => ({ ...prev, [type]: true }));
    const full = Object.values(contextRef.current).filter(Boolean).join('\n\n');
    setContext(full);
  }, []);

  const openModal = useCallback((type: string) => {
    const ModalComponent = type === 'kb' ? KBModal
      : type === 'reservations' ? ReservationsModal
      : ProductsModal;

    modal.openModal({
      title: type === 'kb' ? 'Znalostní báze' : type === 'reservations' ? 'Rezervace' : 'Produkty',
      withCloseButton: true,
      children: <ModalComponent onDone={(text) => handleDone(type, text)} />,
    });
  }, [modal, handleDone]);

  if (!AI_RECEPCE_URL) return null;

  return (
    <>
      {buttons.map(({ key, label, Icon }) => (
        <div key={key} onClick={() => openModal(key)}
          className={`cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex px-[8px] transition-all ${
            active[key] ? 'bg-btnPrimary text-white' : 'bg-newColColor hover:bg-btnPrimary/20'
          }`} title={label}>
          <div className="flex gap-[8px] items-center">
            <Icon />
            <span className="text-[10px] font-[600] iconBreak:hidden block">{label}</span>
          </div>
        </div>
      ))}
    </>
  );
};
