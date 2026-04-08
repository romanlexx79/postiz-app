'use client';

import React, { FC, useState } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const AI_RECEPCE_URL = process.env.NEXT_PUBLIC_AI_RECEPCE_URL || '';

interface ContextData {
  textForAI: string;
  [key: string]: any;
}

const contextTypes = [
  { key: 'reservations', label: 'Rezervace', icon: '📅', param: '?period=this_week' },
  { key: 'kb', label: 'Znalostní báze', icon: '📚', param: '' },
  { key: 'products', label: 'Produkty', icon: '🛍️', param: '' },
  { key: 'crm', label: 'CRM', icon: '📊', param: '' },
] as const;

export const AiRecepceContextButtons: FC = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const t = useT();

  const loadContext = async (type: string, param: string) => {
    if (!AI_RECEPCE_URL) return;
    setLoading(type);
    try {
      const authCookie = document.cookie.match(/auth=([^;]+)/)?.[1] || '';
      const resp = await fetch(`${AI_RECEPCE_URL}/api/social-media/context/${type}${param}`, {
        headers: { 'Authorization': `Bearer ${authCookie}` },
      });
      const data: ContextData = await resp.json();
      if (data.textForAI) {
        // Store context for CopilotKit to read
        (window as any).__aiRecepceContext = data.textForAI;
        (window as any).__aiRecepceContextData = data;
        setActiveContext(type);
      }
    } catch (e) {
      console.error(`Failed to load ${type} context:`, e);
    } finally {
      setLoading(null);
    }
  };

  if (!AI_RECEPCE_URL) return null;

  return (
    <>
      {contextTypes.map(({ key, label, icon, param }) => (
        <div
          key={key}
          onClick={() => loadContext(key, param)}
          className={`cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex px-[8px] transition-colors ${
            activeContext === key
              ? 'bg-btnPrimary text-white'
              : 'bg-newColColor hover:bg-btnPrimary/20'
          } ${loading === key ? 'opacity-50 pointer-events-none' : ''}`}
          title={`${t('load_context', 'Načíst kontext')}: ${label}`}
        >
          <div className="flex gap-[4px] items-center">
            <span className="text-[12px]">{icon}</span>
            <span className="text-[10px] font-[600] iconBreak:hidden block">
              {loading === key ? '...' : label}
            </span>
          </div>
        </div>
      ))}
    </>
  );
};
