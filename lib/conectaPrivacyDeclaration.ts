export const CONECTA_PRIVACY_DECLARATION_BUTTON_LABEL =
  'Declaração de Privacidade e Segurança de Dados (LGPD)';

export type ConectaPrivacySection = {
  title: string;
  lead: string;
  regra: string;
  inviolabilidade: string;
};

export type ConectaPrivacyDeclaration = {
  title: string;
  subtitle: string;
  intro: string[];
  sections: ConectaPrivacySection[];
  closing: string;
};

export const CONECTA_PRIVACY_DECLARATION: ConectaPrivacyDeclaration = {
  title: 'DECLARAÇÃO DE PRIVACIDADE E SEGURANÇA DE DADOS DO APLICATIVO CONECTA+',
  subtitle: 'Compromisso da Plataforma com a Confidencialidade e Inviolabilidade das Informações',
  intro: [
    'Esta declaração estabelece as regras, salvaguardas e diretrizes de privacidade aplicadas diretamente na arquitetura de banco de dados e no código-fonte do aplicativo Conecta+. Como plataforma de tecnologia, afirmamos formalmente que o aplicativo foi desenvolvido sob o princípio de "privacidade por padrão" (privacy by design) e não realiza nenhuma publicação, divulgação pública, venda ou exposição não autorizada de dados pessoais, familiares ou financeiros de seus usuários.',
    'Abaixo, detalhamos como a tecnologia do aplicativo blinda e protege as suas informações em cada módulo do sistema:',
  ],
  sections: [
    {
      title: '1. Isolamento Absoluto de Dados (Arquitetura Multi-Tenant)',
      lead: 'O Conecta+ opera em uma estrutura de banco de dados estritamente isolada por igreja (tenant_id).',
      regra:
        'As informações cadastrais, históricos de presença, dados familiares e relatórios financeiros são acessados apenas sob chaves de sessão autenticadas e restritas à congregação do usuário.',
      inviolabilidade:
        'É tecnicamente impossível que dados de membros, registros pastorais ou dízimos vazem, se misturem ou sejam consultados por outras igrejas que também utilizam a plataforma.',
    },
    {
      title: '2. Blindagem de Contatos no Mural de Generosidade',
      lead: 'O aplicativo promove a ajuda mútua entre irmãos, mas sem expor a privacidade de quem doa ou de quem pede.',
      regra:
        'Ao publicar uma doação ou um pedido de empréstimo de item no Mural de Generosidade, o aplicativo proíbe e remove a exibição pública de telefones, e-mails ou WhatsApps no feed geral do sistema.',
      inviolabilidade:
        'Todo o fluxo de interesse é tratado de forma intermediada e segura. Nenhuma informação de contato pessoal é disponibilizada em "texto aberto" para que terceiros ou membros comuns coletem dados indevidamente.',
    },
    {
      title: '3. Inexistência de "Vitrine Pública" de Perfis e Dons',
      lead: 'O Conecta+ estimula o serviço voluntário focado nos talentos de cada um, mas respeita a individualidade do membro.',
      regra:
        'O Mural de Oportunidades e os dados resultantes do Perfil Ministerial (Lição 5.1 da Trilha) são de uso estritamente privado para matching de vagas internas.',
      inviolabilidade:
        'O aplicativo não possui nenhuma tela de "vitrine pública de membros", lista aberta de dons ou diretório de perfis visível para a comunidade geral. Apenas a liderança ministerial autorizada por permissões de Controle de Acesso (ACL) pode realizar buscas ativas para convites privados de serviço.',
    },
    {
      title: '4. QR Code Familiar Livre de Dados Pessoais',
      lead: 'O QR Code gerado pelo aplicativo é utilizado exclusivamente para agilizar a entrada nos cultos e a segurança das crianças.',
      regra:
        'O código QR exibido na Carteirinha Digital ou na Agenda da Família carrega unicamente o código identificador seguro do núcleo familiar.',
      inviolabilidade:
        'Em caso de leitura por qualquer dispositivo comum ou exposição visual da tela do celular, absolutamente nenhum dado pessoal (como CPF, telefone, e-mail ou endereço residencial) é exposto ou transmitido, mantendo a família completamente protegida contra rastreamento social.',
    },
    {
      title: '5. Proteção de Endereços Físicos no Mapa',
      lead: 'O aplicativo utiliza o CEP dos usuários para calcular de forma inteligente quais pequenas células estão mais próximas da sua residência.',
      regra:
        'Embora o sistema gere um mapa de dispersão geográfica para fins demográficos da liderança, a visualização do pin detalhado e o endereço completo de qualquer usuário são estritamente bloqueados para membros comuns.',
      inviolabilidade:
        'Nenhum membro comum consegue navegar pelo mapa do aplicativo e descobrir onde outros membros moram, limitando essa consulta apenas à pastoral e aos administradores autorizados pelas chaves de segurança ACL da igreja.',
    },
    {
      title: '6. Confidencialidade Absoluta Pastoral (Coração Aberto)',
      lead: 'Os pedidos de oração e aconselhamentos que envolvem momentos delicados da vida do usuário são tratados com o máximo rigor de sigilo.',
      regra:
        'Ao enviar um pedido de oração sob a marcação de "Sigilo Pastoral", o conteúdo é gravado no banco de dados com criptografia de acesso e direcionado de forma restrita e exclusiva ao painel do gabinete de pastores.',
      inviolabilidade:
        'Graças ao sistema de permissões fail-closed, voluntários de equipes de intercessão comum ou secretários operacionais não possuem permissões técnicas no banco para visualizar esses pedidos, blindando a integridade do gabinete pastoral.',
    },
    {
      title: '7. Governança de TI com Proteção Contra Alterações',
      lead: 'Para evitar abusos administrativos, o aplicativo possui travas de segurança profundas em seu código-fonte.',
      regra:
        'Todas as consultas, alterações e cadastros importantes do aplicativo são protegidos por travas de banco de dados (SECURITY DEFINER) amarradas ao perfil autenticado da sessão.',
      inviolabilidade:
        'O sistema possui o Escudo de Proteção do Super Administrador (super admin shield). Isso significa que mesmo um usuário com papel de Gestor de Controle de Acesso é proibido por código de visualizar, alterar ou editar as contas da liderança máxima e do Super Administrador, blindando a hierarquia de segurança do ecossistema.',
    },
  ],
  closing:
    'O aplicativo Conecta+ reitera seu papel como uma ferramenta de tecnologia ética, segura e focada em ligar pessoas a Deus de forma digna, tratando cada dado e registro de banco como um ativo confidencial e protegido contra qualquer tipo de exposição pública inadequada.',
};
