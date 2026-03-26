FROM ghcr.io/openclaw/openclaw:latest

COPY --chown=node:node AGENTS.md SOUL.md TOOLS.md /home/node/.openclaw/workspace/
COPY --chown=node:node skills/ /home/node/.openclaw/workspace/skills/
COPY --chown=node:node knowledge/ /home/node/.openclaw/workspace/knowledge/
COPY --chown=node:node openclaw.config.json /home/node/.openclaw/openclaw.json
