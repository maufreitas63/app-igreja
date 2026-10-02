export const ABIGAIL_NAME = 'Abigail';

type GreetingFn = (name: string) => string;

const ABIGAIL_GREETINGS: readonly GreetingFn[] = [
  (name) => `Oi, ${name}! Eu sou a Abigail. Bora organizar o dia da igreja? Pode perguntar.`,
  (name) => `E aí, ${name}! Abigail na área. Em que eu te ajudo agora?`,
  (name) => `Cheguei. Abigail aqui — eventos, gente, finanças... tô por aqui, ${name}. Manda a dúvida.`,
  (name) => `Olá, ${name}! Sou a Abigail. Sem formalidade: o que você precisa resolver hoje?`,
  (name) => `Fala, ${name}! Abigail pronta pra ajudar. Manda a pergunta que a gente despacha.`,
  (name) => `Oi, oi, ${name}! Abigail no chat. Quer olhar números, eventos ou o pessoal da instância?`,
  (name) => `Salve, ${name}! Eu sou a Abigail. Tô aqui pra desenrolar a gestão com você.`,
  (name) => `Opa, ${name}! Abigail na escuta. Pode perguntar à vontade — eu ajudo.`,
  (name) => `Bom te ver por aqui, ${name}. Abigail, à disposição. Por onde começamos?`,
  (name) => `Ei, ${name}! Sou a Abigail. Relaxa e me conta o que você quer saber da igreja.`,
  (name) => `Abigail presente, ${name}. Sem rodeio: em que posso dar uma mão?`,
  (name) => `Oi, ${name}. Abigail no plantão. Manda ver a dúvida.`,
  (name) => `Hey, ${name}! Abigail no recado. Se for gestão da instância, pode deixar comigo.`,
  (name) => `Cheguei sorrindo, ${name}. Abigail aqui. Quer um empurrão com o que estiver emperrado?`,
  (name) => `Fala comigo, ${name}. Sou a Abigail e tô pronta pra ajudar no que você precisar.`,
];

let lastGreetingIndex = -1;

export function pickAbigailGreeting(firstName?: string | null) {
  const name = firstName?.trim() || 'usuário';

  if (ABIGAIL_GREETINGS.length === 1) {
    return ABIGAIL_GREETINGS[0](name);
  }

  let next = Math.floor(Math.random() * ABIGAIL_GREETINGS.length);

  if (next === lastGreetingIndex) {
    next = (next + 1) % ABIGAIL_GREETINGS.length;
  }

  lastGreetingIndex = next;
  return ABIGAIL_GREETINGS[next](name);
}

/** Resposta otimista enquanto a Edge Function / IA ainda não devolveu o texto. */
const ABIGAIL_OPTIMISTIC_REPLIES: readonly string[] = [
  'Recebi sua mensagem! Deixa comigo que já estou organizando tudo por aqui. Só um segundinho...',
  'Opa, anotei o pedido. Já estou vasculhando as informações para te entregar mastigadinho. Já te chamo!',
  'Mensagem lida com sucesso! Deixe-me cruzar os dados aqui para te dar a resposta certa. Daqui a pouco retorno...',
  'Entendido! Já estou reunindo o material com todo o cuidado. Só um instante que já te respondo.',
  'Legal, recebi por aqui. Deixa eu checar os detalhes no sistema para te passar a melhor resposta. Fica por perto!',
  'Anotado! Estou processando as informações agora mesmo para não faltar nenhum detalhe. Já te dou um alô.',
  'Chegou por aqui! Deixa comigo que já estou preparando uma resposta bem completinha para você. Um minutinho...',
  'Perfeito! Já estou puxando os dados necessários para organizar essa resposta para você. Rapidinho estou de volta.',
  'Recebido! Já estou juntando as pontas por aqui para te dar um retorno bem preciso. Segura aí que é rápido.',
  'Mensagem anotada na hora! Deixa eu estruturar as informações com calma para te responder da melhor forma. Já te retorno!',
];

let lastOptimisticIndex = -1;

export function pickAbigailOptimisticReply() {
  if (ABIGAIL_OPTIMISTIC_REPLIES.length === 1) {
    return ABIGAIL_OPTIMISTIC_REPLIES[0];
  }

  let next = Math.floor(Math.random() * ABIGAIL_OPTIMISTIC_REPLIES.length);

  if (next === lastOptimisticIndex) {
    next = (next + 1) % ABIGAIL_OPTIMISTIC_REPLIES.length;
  }

  lastOptimisticIndex = next;
  return ABIGAIL_OPTIMISTIC_REPLIES[next];
}
