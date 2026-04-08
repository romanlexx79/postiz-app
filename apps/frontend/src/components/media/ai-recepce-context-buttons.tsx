'use client';

import React, { FC, useState } from 'react';

const AI_RECEPCE_URL = process.env.NEXT_PUBLIC_AI_RECEPCE_URL || '';

const contextTypes = [
  { key: 'reservations', label: 'Rezervace', icon: '📅', prompt: 'Načti volné termíny z rezervačního systému a napiš příspěvek o dostupných časech tento týden.' },
  { key: 'kb', label: 'Znalostní báze', icon: '📚', prompt: 'Načti články ze znalostní báze a napiš informační příspěvek na základě obsahu.' },
  { key: 'products', label: 'Produkty', icon: '🛍️', prompt: 'Načti produkty z e-shopu a napiš propagační příspěvek o nabídce.' },
  { key: 'crm', label: 'CRM', icon: '📊', prompt: 'Načti CRM data (zákazníky, obchody) a napiš příspěvek o úspěších firmy.' },
] as const;

export const AiRecepceContextButtons: FC = () => {
  const [activeContext, setActiveContext] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [loadedText, setLoadedText] = useState<string | null>(null);

  const handleClick = async (key: string, prompt: string) => {
    setLoading(key);
    setLoadedText(null);

    try {
      const resp = await fetch(`${AI_RECEPCE_URL}/api/social-media/context/${key}${key === 'reservations' ? '?period=this_week' : ''}`);

      if (resp.ok) {
        const data = await resp.json();
        const contextText = data.textForAI || '';

        // Uložit kontext pro CopilotKit readable
        (window as any).__aiRecepceContext = contextText;

        // Předvyplnit chatbot input s kontextem
        const fullPrompt = contextText
          ? `Na základě těchto dat: "${contextText.substring(0, 300)}" — ${prompt}`
          : prompt;

        const chatInput = document.querySelector('input[placeholder*="message"], textarea[placeholder*="message"]') as HTMLInputElement;
        if (chatInput) {
          // React-friendly way to set value
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          nativeInputValueSetter?.call(chatInput, fullPrompt);
          chatInput.dispatchEvent(new Event('input', { bubbles: true }));
          chatInput.focus();
        }

        setActiveContext(key);
        setLoadedText(contextText ? contextText.substring(0, 80) + '...' : 'Data načtena');
        return;
      }
    } catch (e) {
      // Fetch failed — fallback: just prefill prompt for CopilotKit
    }

    // Fallback: vložit prompt bez dat — CopilotKit backend tool si data načte sám
    const chatInput = document.querySelector('input[placeholder*="message"], textarea[placeholder*="message"]') as HTMLInputElement;
    if (chatInput) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(chatInput, prompt);
      chatInput.dispatchEvent(new Event('input', { bubbles: true }));
      chatInput.focus();
    }
    setActiveContext(key);
    setLoadedText('Zeptej se AI asistenta →');
    setLoading(null);
  };

  if (!AI_RECEPCE_URL) return null;

  return (
    <>
      {contextTypes.map(({ key, label, icon, prompt }) => (
        <div
          key={key}
          onClick={() => handleClick(key, prompt)}
          className={`cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex px-[8px] transition-all ${
            activeContext === key
              ? 'bg-btnPrimary text-white scale-95'
              : 'bg-newColColor hover:bg-btnPrimary/20'
          } ${loading === key ? 'opacity-50 animate-pulse pointer-events-none' : ''}`}
          title={label}
        >
          <div className="flex gap-[4px] items-center">
            <span className="text-[12px]">{icon}</span>
            <span className="text-[10px] font-[600] iconBreak:hidden block">
              {loading === key ? '...' : label}
            </span>
          </div>
        </div>
      ))}
      {loadedText && (
        <div className="absolute bottom-[45px] left-0 right-0 bg-btnPrimary/10 border border-btnPrimary/30 rounded-md px-3 py-1.5 text-[10px] text-textColor mx-2 animate-fadeIn">
          ✓ {loadedText}
        </div>
      )}
    </>
  );
};
