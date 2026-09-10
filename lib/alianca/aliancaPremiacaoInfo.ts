export const ALIANCA_PREMIACAO_INFO_TITLE = 'Premiação por indicação de novas igrejas';

export type AliancaPremiacaoInfoSection = {
  title: string;
  body: string;
};

export const ALIANCA_PREMIACAO_INFO_SECTIONS: AliancaPremiacaoInfoSection[] = [
  {
    title: 'O que é a Aliança Conecta Reino',
    body:
      'É o programa de indicação entre instâncias do Conecta+. Quando uma igreja (igreja mãe) indica outra igreja (igreja filha) e essa filha contrata e paga a assinatura da plataforma, nasce um direito de oferta de apoio ministerial para a mãe. Esse valor não entra no livro caixa do culto: é passivo da operação Conecta+, separado do dízimo e das ofertas da congregação.',
  },
  {
    title: 'Como a indicação é registrada',
    body:
      'Somente o Super Administrador vincula a igreja mãe em Instâncias, no campo «Igreja mãe (indicação Aliança)». Uma igreja não pode indicar a si mesma nem fechar um ciclo na árvore (A indica B, B indica A). Cada igreja filha tem no máximo uma parceria ativa. Remover a indicação só é permitido se não houver oferta Aliança em aberto.',
  },
  {
    title: 'Quando nasce o direito à premiação',
    body:
      'O direito não nasce no cadastro da igreja, e sim no pagamento real da fatura Stripe da igreja filha (evento invoice.paid). Cada fatura paga, nas condições abaixo, gera uma oferta de 40% sobre o valor efetivamente pago. Fatura com valor zero não gera oferta. A mesma fatura não gera duas ofertas (o sistema é idempotente).',
  },
  {
    title: 'O valor da oferta (40%)',
    body:
      'A oferta é sempre 40% do valor pago naquela fatura da assinatura Conecta+ da igreja filha. Exemplo: se a filha paga R$ 1.000,00 no trimestre, a mãe tem direito a R$ 400,00 de oferta de apoio ministerial. O vencimento dessa oferta é 30 dias após a data em que a fatura foi paga.',
  },
  {
    title: 'Até 4 ciclos, em até 12 meses',
    body:
      'A parceria vale por 12 meses a partir do início e por no máximo quatro ofertas quitadas. Cada baixa manual («Pago / Oferta efetivada») avança um ciclo (1/4, 2/4, 3/4). No quarto pagamento, a parceria é encerrada. Depois disso, novas faturas da filha não geram mais passivo para aquela mãe. Se a fatura chegar depois do prazo de 12 meses, a parceria também encerra sem gerar nova oferta.',
  },
  {
    title: 'Adimplência das duas igrejas',
    body:
      'Mãe e filha precisam estar ativas e adimplentes na assinatura. Se a filha falhar no pagamento (invoice.payment_failed) ou qualquer uma das duas estiver inadimplente, a parceria fica suspensa e aquela fatura não gera oferta. Quando ambas voltam a ficar em dia, a parceria pode reativar nas próximas faturas, desde que ainda caiba no prazo de 12 meses e nos 4 ciclos.',
  },
  {
    title: 'A baixa é manual — o Stripe não paga a mãe',
    body:
      'O cartão da igreja filha quita a assinatura Conecta+ automaticamente. Os 40% da Aliança não são transferidos pelo Stripe. O Super Administrador, nesta tela, confirma a oferta de apoio ministerial («Marcar como paga»). Sem essa baixa, o passivo permanece em «A pagar» e a igreja mãe não recebe. A igreja mãe acompanha o recorte no Financeiro (seção Aliança), mas não efetiva a oferta.',
  },
  {
    title: 'O que aparece neste demonstrativo',
    body:
      'Receitas brutas: o que as igrejas pagaram de assinatura. A pagar (passivo): 40% ainda não quitados. Ofertas efetivadas: o que já foi marcado como pago. Saldo líquido (realizado): receita bruta menos o que já foi efetivado. O saldo «se todas as ofertas em aberto forem pagas» antecipa o efeito de quitar o passivo restante.',
  },
  {
    title: 'Encerramento',
    body:
      'A parceria encerra no 4º ciclo quitado, ao vencer o prazo de 12 meses, ou se a indicação for removida sem ciclos pagos e sem ofertas já pagas. Enquanto houver oferta em aberto, a mãe não pode ser desvinculada: é preciso quitar ou manter o vínculo.',
  },
];
