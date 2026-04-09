'use client';

import React, { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { ModalWrapperComponent } from '@gitroom/frontend/components/new-launch/modal.wrapper.component';

const AI_RECEPCE_URL = process.env.NEXT_PUBLIC_AI_RECEPCE_URL || '';

// ============================================================
// Context Selection Modal — zobrazí seznam položek s checkboxy
// ============================================================

interface ContextItem {
  id: string;
  name: string;
  description?: string;
  type?: string;
}

const ContextSelectionModal: FC<{
  title: string;
  type: string;
  onSelect: (items: ContextItem[], contextText: string) => void;
}> = ({ title, type, onSelect }) => {
  const [items, setItems] = useState<ContextItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextData, setContextData] = useState<any>(null);
  const modal = useModals();

  useEffect(() => {
    (async () => {
      try {
        // Postiz auth cookie → předat jako query param pro tenant identifikaci
        const authToken = document.cookie.match(/auth=([^;]+)/)?.[1] || '';
        const sep = type === 'reservations' ? '&' : '?';
        const url = `${AI_RECEPCE_URL}/api/social-media/context/${type}${type === 'reservations' ? '?period=this_week' : ''}${authToken ? `${type === 'reservations' ? '&' : '?'}auth=${encodeURIComponent(authToken)}` : ''}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('Chyba při načítání');
        const data = await resp.json();
        setContextData(data);

        // Mapovat data na ContextItem podle typu
        let mapped: ContextItem[] = [];
        if (type === 'kb') {
          mapped = [
            ...(data.knowledgeBases || []).map((kb: any) => ({
              id: kb.id, name: kb.name, description: `Typ: ${kb.type}`, type: 'kb',
            })),
            ...(data.articles || []).map((a: any) => ({
              id: a.id, name: a.title, description: a.excerpt?.substring(0, 60), type: 'article',
            })),
            ...(data.faqs || []).map((f: any) => ({
              id: f.id, name: f.question, description: f.answer?.substring(0, 60), type: 'faq',
            })),
          ];
        } else if (type === 'products') {
          mapped = (data.products || []).map((p: any) => ({
            id: p.id, name: p.name,
            description: p.variants?.[0]?.basePrice ? `${p.variants[0].basePrice} Kč` : p.description?.substring(0, 60),
          }));
        } else if (type === 'reservations') {
          mapped = [
            ...(data.calendars || []).map((c: any) => ({
              id: c.id, name: `Kalendář: ${c.name}`, description: `${c.startHour || 8}:00 - ${c.endHour || 18}:00`,
            })),
            ...(data.services || []).map((s: any) => ({
              id: s.id, name: s.name, description: `${s.duration} min — ${s.price} ${s.currency || 'CZK'}`,
            })),
          ];
        } else if (type === 'crm') {
          mapped = [
            { id: 'contacts', name: `Kontakty: ${data.contactCount || 0}`, description: 'Počet kontaktů v CRM' },
            { id: 'deals', name: `Obchody: ${data.dealCount || 0} (${data.wonDeals || 0} uzavřených)`, description: `Celkem: ${data.totalRevenue || 0} Kč` },
            { id: 'companies', name: `Firmy: ${data.companyCount || 0}`, description: 'Počet firem v CRM' },
            ...(data.recentDeals || []).map((d: any) => ({
              id: d.title, name: `Deal: ${d.title}`, description: `${d.value} ${d.currency || 'CZK'}`,
            })),
          ];
        }
        setItems(mapped);

        // Vybrat vše defaultně
        if (mapped.length > 0) {
          setSelected(new Set(mapped.map(m => m.id)));
        }
      } catch (e: any) {
        setError(e.message || 'Nepodařilo se načíst data');
      } finally {
        setLoading(false);
      }
    })();
  }, [type]);

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(i => i.id)));
  };

  const confirm = () => {
    const selectedItems = items.filter(i => selected.has(i.id));

    // Sestavit kontextový text z vybraných položek
    let contextText = contextData?.textForAI || '';
    if (type === 'kb' && selectedItems.length < items.length) {
      contextText = selectedItems.map(i => {
        if (i.type === 'faq') return `FAQ: ${i.name} → ${i.description}`;
        if (i.type === 'article') return `Článek: ${i.name}`;
        return `KB: ${i.name}`;
      }).join('. ');
    } else if (type === 'products' && selectedItems.length < items.length) {
      contextText = 'Vybrané produkty: ' + selectedItems.map(i => `${i.name} (${i.description})`).join(', ');
    }

    onSelect(selectedItems, contextText);
    modal.closeCurrent();
  };

  return (
    <ModalWrapperComponent title={title}>
      <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto">
        {loading && <div className="text-center py-4 text-textItemBlur">Načítání...</div>}
        {error && <div className="text-center py-4 text-red-500">{error}</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-4 text-textItemBlur">Žádná data</div>
        )}
        {items.length > 0 && (
          <div
            className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-newBgLineColor rounded-lg border-b border-newBorder"
            onClick={toggleAll}
          >
            <input
              type="checkbox"
              checked={selected.size === items.length}
              readOnly
              className="accent-[#E8751A] w-4 h-4"
            />
            <span className="text-sm font-semibold">
              {selected.size === items.length ? 'Zrušit vše' : 'Vybrat vše'}
            </span>
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer rounded-lg transition-colors ${
              selected.has(item.id) ? 'bg-btnPrimary/10 border border-btnPrimary/30' : 'hover:bg-newBgLineColor'
            }`}
            onClick={() => toggleItem(item.id)}
          >
            <input
              type="checkbox"
              checked={selected.has(item.id)}
              readOnly
              className="accent-[#E8751A] w-4 h-4 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{item.name}</div>
              {item.description && (
                <div className="text-xs text-textItemBlur truncate">{item.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <button
          onClick={confirm}
          className="mt-4 w-full bg-btnPrimary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          Použít vybrané ({selected.size})
        </button>
      )}
    </ModalWrapperComponent>
  );
};

// ============================================================
// Toolbar Buttons
// ============================================================

const contextTypes = [
  { key: 'reservations', label: 'Rezervace', icon: '📅', title: 'Vybrat rezervace a služby' },
  { key: 'kb', label: 'Znalostní báze', icon: '📚', title: 'Vybrat znalostní bázi' },
  { key: 'products', label: 'Produkty', icon: '🛍️', title: 'Vybrat produkty' },
  { key: 'crm', label: 'CRM', icon: '📊', title: 'Vybrat CRM data' },
] as const;

export const AiRecepceContextButtons: FC = () => {
  const [activeContexts, setActiveContexts] = useState<Record<string, string>>({});
  const activeContextsRef = useRef(activeContexts);
  activeContextsRef.current = activeContexts;
  const modal = useModals();

  const openContextModal = useCallback((type: string, title: string) => {
    modal.openModal({
      title,
      withCloseButton: true,
      children: (
        <ContextSelectionModal
          title={title}
          type={type}
          onSelect={(items, contextText) => {
            // Aktualizovat active state přes ref (no stale closure)
            const updated = { ...activeContextsRef.current, [type]: contextText };
            setActiveContexts(updated);

            // Dispatch custom event → editor.tsx useCopilotReadable
            const fullContext = Object.values(updated).filter(Boolean).join('\n\n');
            window.dispatchEvent(new CustomEvent('airecepce-context', { detail: fullContext }));
          }}
        />
      ),
    });
  }, [modal]);

  if (!AI_RECEPCE_URL) return null;

  return (
    <>
      {contextTypes.map(({ key, label, icon, title }) => (
        <div
          key={key}
          onClick={() => openContextModal(key, title)}
          className={`cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex px-[8px] transition-all ${
            activeContexts[key]
              ? 'bg-btnPrimary text-white'
              : 'bg-newColColor hover:bg-btnPrimary/20'
          }`}
          title={title}
        >
          <div className="flex gap-[4px] items-center">
            <span className="text-[12px]">{icon}</span>
            <span className="text-[10px] font-[600] iconBreak:hidden block">{label}</span>
          </div>
        </div>
      ))}
    </>
  );
};
