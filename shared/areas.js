// Áreas de atuação usadas na busca (tela e servidor).
// Cada área vira um conjunto de cargos: os 3 primeiros são buscados nas fontes;
// todos servem para reconhecer se o título da vaga pertence à área.
export const AREA_GROUPS = [
  {
    id: 'tec', label: 'Tecnologia', areas: [
      { id: 'tec-suporte', label: 'Suporte / Help Desk', queries: ['suporte técnico', 'help desk', 'analista de suporte', 'service desk', 'técnico de informática'] },
      { id: 'tec-dev', label: 'Desenvolvimento', queries: ['desenvolvedor', 'programador', 'software engineer', 'front-end', 'back-end'] },
      { id: 'tec-dados', label: 'Dados / BI', queries: ['analista de dados', 'BI', 'engenheiro de dados', 'cientista de dados'] },
      { id: 'tec-infra', label: 'Infra / Cloud / DevOps', queries: ['infraestrutura', 'devops', 'cloud', 'analista de redes', 'SRE'] },
      { id: 'tec-qa', label: 'QA / Testes', queries: ['QA', 'analista de testes', 'quality assurance'] },
      { id: 'tec-produto', label: 'Produto', queries: ['product manager', 'product owner', 'analista de produto'] },
      { id: 'tec-seg', label: 'Segurança da informação', queries: ['segurança da informação', 'cybersecurity', 'analista SOC'] },
    ],
  },
  {
    id: 'mkt', label: 'Marketing', areas: [
      { id: 'mkt-digital', label: 'Marketing digital', queries: ['marketing digital', 'analista de marketing', 'assistente de marketing'] },
      { id: 'mkt-crm', label: 'CRM / Retenção', queries: ['CRM', 'analista de CRM', 'e-mail marketing', 'lifecycle', 'automação de marketing'] },
      { id: 'mkt-social', label: 'Social media / Conteúdo', queries: ['social media', 'redes sociais', 'conteúdo', 'copywriter', 'redator'] },
      { id: 'mkt-performance', label: 'Performance / Tráfego', queries: ['tráfego pago', 'performance', 'mídia paga'] },
      { id: 'mkt-seo', label: 'SEO', queries: ['SEO', 'analista de SEO'] },
      { id: 'mkt-growth', label: 'Growth', queries: ['growth', 'growth marketing'] },
      { id: 'mkt-branding', label: 'Branding / Comunicação', queries: ['branding', 'comunicação', 'endomarketing', 'relações públicas'] },
      { id: 'mkt-produto', label: 'Marketing de produto', queries: ['product marketing', 'marketing de produto'] },
      { id: 'mkt-trade', label: 'Trade marketing', queries: ['trade marketing', 'merchandising'] },
    ],
  },
  {
    id: 'ven', label: 'Vendas e atendimento', areas: [
      { id: 'ven-vendas', label: 'Vendas / SDR', queries: ['vendas', 'SDR', 'inside sales', 'BDR', 'executivo de contas'] },
      { id: 'ven-cs', label: 'Customer Success', queries: ['customer success', 'sucesso do cliente', 'CS'] },
      { id: 'ven-atend', label: 'Atendimento / SAC', queries: ['atendimento ao cliente', 'SAC', 'customer service'] },
      { id: 'ven-comercial', label: 'Comercial / Pré-vendas', queries: ['comercial', 'pré-vendas', 'representante comercial'] },
    ],
  },
  {
    id: 'adm', label: 'Administrativo e finanças', areas: [
      { id: 'adm-adm', label: 'Administrativo', queries: ['assistente administrativo', 'auxiliar administrativo', 'back office', 'secretária'] },
      { id: 'adm-fin', label: 'Financeiro', queries: ['financeiro', 'contas a pagar', 'contas a receber', 'tesouraria'] },
      { id: 'adm-cont', label: 'Contábil / Fiscal', queries: ['contábil', 'fiscal', 'contabilidade'] },
      { id: 'adm-compras', label: 'Compras / Logística', queries: ['compras', 'logística', 'suprimentos', 'supply chain'] },
    ],
  },
  {
    id: 'rh', label: 'Pessoas (RH)', areas: [
      { id: 'rh-recrut', label: 'Recrutamento', queries: ['recrutamento', 'talent acquisition', 'tech recruiter'] },
      { id: 'rh-dp', label: 'Departamento pessoal', queries: ['departamento pessoal', 'folha de pagamento'] },
      { id: 'rh-bp', label: 'RH generalista / BP', queries: ['recursos humanos', 'analista de RH', 'business partner'] },
    ],
  },
  {
    id: 'des', label: 'Design', areas: [
      { id: 'des-uxui', label: 'UX / UI', queries: ['UX designer', 'UI designer', 'product designer'] },
      { id: 'des-grafico', label: 'Design gráfico / Motion', queries: ['designer gráfico', 'motion designer', 'design'] },
    ],
  },
  {
    id: 'out', label: 'Outras', areas: [
      { id: 'out-projetos', label: 'Projetos / PMO', queries: ['gerente de projetos', 'analista de projetos', 'PMO', 'scrum master'] },
      { id: 'out-juridico', label: 'Jurídico', queries: ['jurídico', 'advogado', 'paralegal'] },
      { id: 'out-ecommerce', label: 'E-commerce / Marketplace', queries: ['e-commerce', 'marketplace', 'loja virtual'] },
    ],
  },
];

export const AREAS_BY_ID = Object.fromEntries(AREA_GROUPS.flatMap((g) => g.areas.map((a) => [a.id, { ...a, group: g.label }])));

/** Nome curto para mostrar (ex: "Marketing › CRM / Retenção") */
export const areaLabel = (id) => (AREAS_BY_ID[id] ? `${AREAS_BY_ID[id].group} › ${AREAS_BY_ID[id].label}` : id);
