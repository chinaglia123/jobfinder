# Agente local do JobFinder

Programa pequeno que roda no seu computador e busca vagas no **Indeed** e no **Glassdoor**
(via [JobSpy](https://github.com/speedyapply/JobSpy)) — sites que bloqueiam servidores na nuvem,
mas funcionam normalmente a partir da sua internet de casa.

## Como usar

1. Instale o **Python 3.10 ou mais novo**: https://www.python.org/downloads/
   (no Windows, marque *Add python.exe to PATH* na instalação).
2. **Windows:** dê dois cliques em `iniciar.bat`.
   **Mac/Linux:** abra o terminal nesta pasta e rode `sh iniciar.sh`.
3. Na primeira vez ele instala o que precisa (1–2 minutos). Depois aparece:
   `Agente do JobFinder rodando em http://127.0.0.1:8765`
4. Deixe a janela aberta e use o JobFinder normalmente. Em *Empresas e fontes* o agente aparece como **Conectado**.

## Privacidade e segurança

- Escuta só em `127.0.0.1` (não fica acessível para outros computadores da rede).
- Só aceita pedidos do JobFinder rodando neste computador e do endereço configurado em
  `JOBFINDER_ORIGENS` (o zip baixado do site já vem com isso preenchido).
- Não guarda nada e não envia seus dados para ninguém: só consulta os sites de vagas e devolve a lista.

## Configurações opcionais

| Variável | Para que serve | Padrão |
|---|---|---|
| `JOBFINDER_AGENTE_PORTA` | Porta local do agente | `8765` |
| `JOBFINDER_ORIGENS` | Endereços extras do JobFinder autorizados (separados por vírgula) | — |
