import { agentStatus } from '../../utils/agent';

// O agente local está rodando no mesmo computador que o servidor?
export default defineEventHandler(() => agentStatus());
