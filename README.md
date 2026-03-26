# Agente de Triagem e Referência - MultiVacinas 💉

Este repositório contém o código e a base de conhecimento do agente conversacional de IA para a **MultiVacinas**. O agente foi projetado para atuar na linha de frente do atendimento ao cliente via WhatsApp, oferecendo informações precisas sobre vacinas, calendários vacinais e procedimentos clínicos, com foco em uma experiência humanizada e segura.

## 🚀 Arquitetura e Tecnologia

O projeto utiliza o framework **OpenClaw** como gateway de IA e integra-se ao **Chatwoot** para fornecer um painel gerencial completo para a equipe humana.

- **[OpenClaw](https://openclaw.ai/):** Gerencia a lógica do agente, as sessões de chat e a execução de ferramentas (RAG).
- **[Chatwoot](https://www.chatwoot.com/):** Interface de atendimento humano, dashboard de métricas e controle de handover.
- **RAG (Retrieval-Augmented Generation):** O agente consulta arquivos PDF e manuais clínicos na pasta `/knowledge` para responder com precisão "zero-alucinação".

## 📁 Estrutura do Projeto

- `/knowledge`: Repositório de documentos clínicos, bulas e calendários vacinais (PDFs).
- `AGENTS.md`: O "Manual de Regras" do robô (restrições médicas, filtros de leads e lógica de handover).
- `SOUL.md`: Definição da personalidade e tom de voz (atendimento humanizado e acolhedor).
- `TOOLS.md`: Especificação técnica das ferramentas disponíveis para o agente (Pesquisa de PDF, Handover).
- `.env.example`: Modelo de configuração das chaves de API e variáveis de ambiente.

## 🤖 Fluxo de Atendimento

1. **Recepção:** O bot identifica de qual loja (`loja1` ou `loja2`) a mensagem veio através do `accountId` e responde com os horários e endereços corretos.
2. **Triagem:** O bot tira dúvidas técnicas usando a base de conhecimento.
3. **Conversão/Handover:** Ao identificar uma intenção clara de compra, agendamento imediato ou dúvida clínica complexa, o bot dispara o marcador `[HANDOVER]`.
4. **Intervenção Humana:** O Chatwoot detecta o gatilho, silencia o robô e notifica a equipe da clínica para assumir a conversa no dashboard.

## 🛠️ Instalação e Configuração

### Pré-requisitos
- Node.js (v18+)
- Uma instância do Chatwoot (ou conectado via Evolution API)

### Configuração Inicial
1. Clone o repositório:
   ```bash
   git clone https://github.com/Senisse19/agente-multivacinas.git
   cd agente-multivacinas
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure as variáveis de ambiente:
   - Renomeie `.env.example` para `.env`
   - Preencha suas chaves (OpenAI Key, Chatwoot Access Token, etc.).

4. Inicie o agente:
   ```bash
   npm start
   ```

## 🔒 Segurança e Anti-Alucinação

Este agente segue regras estritas de segurança:
- Nunca inventa preços ou contraindicações.
- Se a informação não estiver na `/knowledge`, ele delega para um humano.
- Segue rigorosamente as diretrizes da Anvisa mencionadas nos documentos.

---

*Desenvolvido para MultiVacinas — Excelência em Imunização.*
