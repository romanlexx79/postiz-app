import {
  AgentToolInterface,
} from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { Injectable } from '@nestjs/common';
import z from 'zod';

const AI_RECEPCE_URL = process.env.NEXT_PUBLIC_AI_RECEPCE_URL || process.env.FRONTEND_URL || '';

@Injectable()
export class AiRecepceContextTool implements AgentToolInterface {
  name = 'aiRecepceContext';

  run() {
    return createTool({
      id: 'aiRecepceContext',
      description: `Load business context from AI Recepce (reservations, knowledge base, products, CRM).
Use this tool when the user wants to create posts based on their business data:
- "reservations" for available appointment slots and services
- "kb" for knowledge base articles and FAQs
- "products" for e-shop product catalog
- "crm" for customer/deal statistics
- "summary" for complete business overview`,
      inputSchema: z.object({
        type: z.enum(['reservations', 'kb', 'products', 'crm', 'summary']).describe('Type of business context to load'),
        search: z.string().optional().describe('Optional search term for KB or products'),
        period: z.string().optional().describe('For reservations: "today", "this_week", or "next_week"'),
      }),
      mcp: {
        annotations: {
          title: 'Load AI Recepce Business Context',
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      outputSchema: z.object({
        context: z.string(),
        data: z.any().optional(),
      }),
      execute: async (inputData) => {
        const { type, search, period } = inputData as { type: string; search?: string; period?: string };

        let url = `${AI_RECEPCE_URL}/api/social-media/context/${type}`;
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (period) params.set('period', period);
        if (params.toString()) url += `?${params.toString()}`;

        try {
          const resp = await fetch(url, {
            headers: {
              'Authorization': `Bearer sk-proxy-via-airecepce`,
            },
            signal: AbortSignal.timeout(10000),
          });

          if (!resp.ok) {
            return { context: `Failed to load ${type} context: ${resp.status}` };
          }

          const data = await resp.json();
          return {
            context: data.textForAI || JSON.stringify(data),
            data,
          };
        } catch (e: any) {
          return { context: `Error loading ${type}: ${e.message}` };
        }
      },
    });
  }
}
