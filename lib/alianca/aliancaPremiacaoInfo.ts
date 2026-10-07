export const ALIANCA_PREMIACAO_INFO_TITLE = 'Cashback por indicação de novas igrejas';

export type AliancaPremiacaoInfoSection = {
  title: string;
  body: string;
};

export const ALIANCA_PREMIACAO_INFO_SECTIONS: AliancaPremiacaoInfoSection[] = [
  {
    title: 'O que é a Aliança Conecta Reino',
    body:
      'É o programa de indicação entre instâncias do Conecta+. Quando uma igreja indica outra e a igreja indicada paga o pacote, a igreja que indicou recebe 10% perpétuo de cashback/desconto na própria fatura. O valor não entra no livro caixa do culto.',
  },
  {
    title: 'Como a indicação é registrada',
    body:
      'Somente o Super Administrador vincula a igreja mãe em Instâncias. Uma igreja não indica a si mesma nem fecha ciclo na árvore. Cada igreja indicada tem uma parceria. O cálculo usa o tenant de cada igreja, sem misturar instâncias.',
  },
  {
    title: 'Quando nasce o desconto',
    body:
      'O desconto nasce no pagamento real da fatura da igreja indicada. A base é 10% do valor do pacote assinado por ela. A mesma fatura não gera dois créditos. Não há corte de um ano nem limite de ciclos.',
  },
  {
    title: 'As duas igrejas precisam estar ativas',
    body:
      'O benefício é perpétuo, mas só enquanto a igreja que indicou e a igreja indicada estão ativas e com a assinatura em dia. Se uma das duas for desativada ou ficar inadimplente, o percentual de 10% fica suspenso na hora.',
  },
  {
    title: 'Teto de 100%',
    body:
      'A soma do cashback em aberto da igreja que indicou não passa de 100% do valor do pacote assinado por ela. O que exceder esse teto não entra na fatura.',
  },
  {
    title: 'Como o desconto chega na fatura',
    body:
      'O crédito fica no cliente Stripe da igreja que indicou e abate a próxima fatura dela. Não há quitação manual em 30 dias. Repasses antigos de 40%, se ainda existirem como «A pagar», continuam com a baixa manual desta tela.',
  },
  {
    title: 'O que aparece neste demonstrativo',
    body:
      'Receitas brutas: o que as igrejas pagaram de assinatura. Cashback a abater: 10% ainda não usado na fatura, só de pares ativos. Descontos na fatura: o que já foi abatido, inclusive ofertas antigas já pagas. A receita após descontos desconta esse abatimento.',
  },
];
