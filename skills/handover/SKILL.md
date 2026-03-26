---
name: chatwoot-handover
description: Transfers the current WhatsApp conversation to a human agent via the Chatwoot API, disabling bot responses for that conversation.
user-invocable: false
---

# Chatwoot Handover Skill

This skill executes a human handover by calling the Chatwoot REST API. It is invoked automatically when the agent detects a hot-lead trigger (see AGENTS.md).

## Prerequisites

The following environment variables must be set in the gateway config:

- `CHATWOOT_BASE_URL` — Chatwoot instance URL (e.g. `https://chat.multivacinas.com.br`)
- `CHATWOOT_API_TOKEN` — User Access Token (Settings → Profile → Access Token)
- `CHATWOOT_ACCOUNT_ID` — Numeric account ID from Chatwoot URL (e.g. `1`)
- `CHATWOOT_TEAM_ID` — *(optional)* ID of the human team to assign to

## How to execute the handover

When the handover is triggered, perform the following steps using the `exec` tool:

### Step 1 — Resolve the Chatwoot conversation ID

The Chatwoot conversation ID is injected into the session context by the channel integration. It is available as `{{context.chatwootConversationId}}` or via the session metadata. If not available, skip to Step 3 and log a warning.

### Step 2 — Assign to human team (if CHATWOOT_TEAM_ID is set)

```bash
curl -s -X POST "$CHATWOOT_BASE_URL/api/v1/accounts/$CHATWOOT_ACCOUNT_ID/conversations/{{CONVERSATION_ID}}/assignments" \
  -H "api_access_token: $CHATWOOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"team_id": '"$CHATWOOT_TEAM_ID"'}'
```

### Step 3 — Set conversation status to "open" (removes bot, queues for human)

```bash
curl -s -X PATCH "$CHATWOOT_BASE_URL/api/v1/accounts/$CHATWOOT_ACCOUNT_ID/conversations/{{CONVERSATION_ID}}" \
  -H "api_access_token: $CHATWOOT_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "open", "assignee_id": null}'
```

### Step 4 — Disable the Agent Bot for this conversation

```bash
curl -s -X DELETE "$CHATWOOT_BASE_URL/api/v1/accounts/$CHATWOOT_ACCOUNT_ID/conversations/{{CONVERSATION_ID}}/assignments/agent_bot" \
  -H "api_access_token: $CHATWOOT_API_TOKEN"
```

### Step 5 — Confirm and stop responding

After receiving HTTP 200 from Step 3:
1. Do NOT send any more messages to the user in this conversation.
2. The human team will see the conversation in the Chatwoot inbox.

If any step returns a non-2xx status, log the error and retry once. If it fails again, send the fallback message defined in TOOLS.md.

## Direct WhatsApp mode (without Chatwoot)

If the deployment uses OpenClaw connected directly to WhatsApp (no Chatwoot integration), the handover must:
1. Send the user a message with the clinic phone number.
2. Mark the conversation as ended in the session by storing a flag: write a line `HANDOVER_DONE=true` to `./sessions/{{SESSION_ID}}.flag` using the `write` tool.
3. Refuse to respond to further messages from this user until the flag is cleared by a human operator.
