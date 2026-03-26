'use strict';

/**
 * MultiVacinas — Chatwoot ↔ OpenClaw Bridge
 *
 * Recebe webhooks do Chatwoot, encaminha para o OpenClaw (API /v1/chat/completions)
 * e devolve a resposta como mensagem outgoing no Chatwoot.
 *
 * Variáveis de ambiente necessárias: veja .env.example na raiz do projeto.
 */

const crypto = require('crypto');
const express = require('express');

const {
  CHATWOOT_BASE_URL,
  CHATWOOT_API_TOKEN,
  CHATWOOT_ACCOUNT_ID,
  CHATWOOT_TEAM_ID,
  CHATWOOT_INBOX_LOJA1_ID,
  CHATWOOT_INBOX_LOJA2_ID,
  CHATWOOT_WEBHOOK_SECRET,
  OPENCLAW_GATEWAY_URL = 'http://localhost:18789',
  OPENCLAW_GATEWAY_TOKEN,
  PORT = 3001,
} = process.env;

// Validação de variáveis obrigatórias na inicialização
const required = [
  'CHATWOOT_BASE_URL',
  'CHATWOOT_API_TOKEN',
  'CHATWOOT_ACCOUNT_ID',
  'OPENCLAW_GATEWAY_TOKEN',
];
for (const v of required) {
  if (!process.env[v]) {
    console.error(`[bridge] Variável de ambiente obrigatória não definida: ${v}`);
    process.exit(1);
  }
}

const app = express();
// Captura o raw body para verificação de assinatura do Chatwoot
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// ─── Helpers Chatwoot ────────────────────────────────────────────────────────

async function chatwootRequest(method, path, body = null) {
  const res = await fetch(
    `${CHATWOOT_BASE_URL}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        'api_access_token': CHATWOOT_API_TOKEN,
      },
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatwoot ${method} ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function getConversationMessages(conversationId) {
  const data = await chatwootRequest('GET', `/conversations/${conversationId}/messages`);
  return (data.payload || [])
    .filter((m) => m.content_type === 'text' && m.content)
    .slice(-20) // contexto das últimas 20 mensagens
    .map((m) => ({
      role: m.message_type === 'incoming' ? 'user' : 'assistant',
      content: m.content,
    }));
}

async function sendMessage(conversationId, content) {
  return chatwootRequest('POST', `/conversations/${conversationId}/messages`, {
    content,
    message_type: 'outgoing',
    private: false,
  });
}

async function performHandover(conversationId) {
  console.log(`[bridge] Handover solicitado para conversa #${conversationId}`);

  // Coloca a conversa na fila aberta (sem agente atribuído → humano assume)
  await chatwootRequest('PATCH', `/conversations/${conversationId}`, {
    status: 'open',
    assignee_id: null,
  });

  // Atribui ao time humano, se configurado
  if (CHATWOOT_TEAM_ID) {
    await chatwootRequest(
      'POST',
      `/conversations/${conversationId}/assignments`,
      { team_id: Number(CHATWOOT_TEAM_ID) },
    );
  }
}

// ─── Helpers OpenClaw ────────────────────────────────────────────────────────

async function askOpenClaw(messages, accountId) {
  const res = await fetch(`${OPENCLAW_GATEWAY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}`,
    },
    body: JSON.stringify({
      model: 'default',
      stream: false,
      messages: [
        // Injeta o contexto de loja como primeira mensagem de sistema
        { role: 'system', content: `Contexto do canal: accountId=${accountId}` },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenClaw API → HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? null;
}

// ─── Identificação de loja ────────────────────────────────────────────────────

function resolveAccountId(inboxId) {
  const id = String(inboxId);
  if (CHATWOOT_INBOX_LOJA2_ID && id === String(CHATWOOT_INBOX_LOJA2_ID)) return 'loja2';
  if (CHATWOOT_INBOX_LOJA1_ID && id === String(CHATWOOT_INBOX_LOJA1_ID)) return 'loja1';
  // Fallback: loja1 se não configurado
  return 'loja1';
}

// ─── Webhook ─────────────────────────────────────────────────────────────────

app.post('/webhook', async (req, res) => {
  // Verifica assinatura do Chatwoot se o segredo estiver configurado
  if (CHATWOOT_WEBHOOK_SECRET && req.rawBody) {
    const signature = req.headers['x-chatwoot-signature'];
    const expected = crypto
      .createHmac('sha256', CHATWOOT_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest('hex');
    if (signature !== expected) {
      console.warn('[bridge] Webhook com assinatura inválida — ignorado');
      return res.sendStatus(401);
    }
  }
  // Responde 200 imediatamente para o Chatwoot não retentar
  res.sendStatus(200);

  const { event, conversation, message } = req.body;

  // Só processa mensagens recebidas do cliente
  if (event !== 'message_created') return;
  if (!message || message.message_type !== 'incoming') return;
  if (!message.content || message.content_type !== 'text') return;

  const conversationId = conversation.id;

  // Se já tem um agente humano atribuído, o bot não interfere
  if (conversation.meta?.assignee) {
    console.log(`[bridge] Conversa #${conversationId} já tem humano — ignorando`);
    return;
  }

  const accountId = resolveAccountId(conversation.inbox_id);
  console.log(`[bridge] Conversa #${conversationId} | inbox ${conversation.inbox_id} → ${accountId}`);

  try {
    const messages = await getConversationMessages(conversationId);
    const reply = await askOpenClaw(messages, accountId);

    if (!reply) {
      console.warn(`[bridge] OpenClaw retornou resposta vazia para conversa #${conversationId}`);
      return;
    }

    // Detecta marcador de handover: o agente prefixará com [HANDOVER] quando precisar repassar
    const isHandover = reply.trimStart().startsWith('[HANDOVER]');
    const cleanReply = isHandover ? reply.replace('[HANDOVER]', '').trim() : reply;

    // Envia a mensagem de resposta ao cliente
    if (cleanReply) {
      await sendMessage(conversationId, cleanReply);
    }

    // Executa o handover após enviar a mensagem de transição
    if (isHandover) {
      await performHandover(conversationId);
    }
  } catch (err) {
    console.error(`[bridge] Erro na conversa #${conversationId}:`, err.message);
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[bridge] MultiVacinas bridge rodando na porta ${PORT}`);
  console.log(`[bridge] OpenClaw: ${OPENCLAW_GATEWAY_URL}`);
  console.log(`[bridge] Chatwoot: ${CHATWOOT_BASE_URL}`);
});
