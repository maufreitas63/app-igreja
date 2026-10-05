# Pacotes de funcionalidades — Conecta+

**Atualizado em:** 05/10/2026
**Finalidade:** referência comercial do produto publicado. Os pacotes são cumulativos: **Padrão inclui Básico** e **Avançado inclui Padrão**.

A navegação considerada é **Início + menu + Eu quero… + Perfil + engrenagem**. Cards congelados do antigo Painel não integram a oferta.

---

## Pacote Básico — Comunidade conectada

Para colocar uma igreja em operação digital com identidade, família, comunicação, eventos e cuidado essencial.

### Acesso e instância
- login por celular e PIN;
- primeiro acesso e recuperação por e-mail;
- sessão persistente e encerramento seguro;
- seleção da igreja para usuários multi-instância;
- identidade visual, contatos, redes e site da instância;
- App Ativo/Inativo e mensagem de indisponibilidade.

### Cadastro e família
- cadastro inicial com nome, nascimento, celular e CEP;
- LGPD por instância, texto próprio, aceite e selfie quando ativo;
- Perfil, Dados Cadastrais, Carteirinha Digital e alteração de PIN;
- Gerenciar Família, parentesco, representante e código familiar;
- campos de cuidado infantil e data de casamento.

### Início e participação
- próximos eventos e avisos;
- Agenda da Família e audiência;
- calendário Google/ICS;
- aniversários pessoais e de casamento do dia;
- Eu quero… com Dízimos/Ofertas e Cuidado Pastoral;
- Documentos oficiais, Redes Sociais, Sobre e Como faço…?.

### Operação mínima
- Programação de Eventos e Manutenção de Avisos;
- Cadastro de Usuário;
- Mudança entre Visitante, Congregado e Membro;
- ACL mínima e isolamento por igreja.

---

## Pacote Padrão — Operação integrada

Tudo do Básico, mais automações de secretaria, culto, pastoral, voluntariado e finanças.

### Pessoas e acolhimento
- Recepção Familiar e formulário público;
- convite WhatsApp com tenant, `family_id` e celular pré-preenchido;
- Novos Membros, fila, conflitos, gravação/rejeição;
- inbox de novos cadastros e sticker de admissão;
- Lista de Membros, Lista de Famílias e mapa;
- Aniversariantes e Cadastro Rápido de visitantes;
- Régua de Acolhimento D+1/D+4/D+8 somente para visitante efetivo.

### Culto, presença e crianças
- capacidade, público, publicação, salas e quórum;
- totem QR e presença;
- check-in automático por geofence;
- Espaço Infantil com entrada/saída segura;
- restrições alimentares, necessidades específicas e observações;
- Cronograma de Eventos e orquestrador.

### Comunidade e discipulado
- Minha Célula e Gestão de Pequenos Grupos;
- Escalas, tipos, disponibilidade, geração em bloco e trocas;
- Mural de Oportunidades e Mural de Generosidade;
- Apoio Mútuo e publicação de serviços;
- Livros doados e Cantinho da Leitura;
- Trilha de Discipulado e Perfil Ministerial;
- Sugestões e melhorias.

### Pastoral e finanças
- fila de Cuidados Pastorais, sigilo/intercessão, responsável e slots;
- histórico e cancelamento; Excluir por Super Administrador após solicitação;
- Financeiro do membro;
- Informações Financeiras, importação, orçamento e comentários;
- RD/Reembolsos e conciliação;
- Gestão de Campanhas, PIX identificado e Primícias;
- Administrativo e autorização de imagem e voz.

### Papéis
- Secretaria, Tesoureiro, Equipe Pastoral e funções delegadas por grants.

---

## Pacote Avançado — Governança, inteligência e rede

Tudo do Padrão, mais governança multi-tenant, auditoria, IA e comercial SaaS.

### Governança e segurança
- matriz completa de ACL por tela, card, tabela e coluna;
- Controle de Acesso por pessoa, papel e recurso;
- Atribuições operacionais;
- Gestor de Controle de Acesso com blindagem total do Super Administrador e de PIN/senha;
- Acessos de Usuários e histórico de sessões;
- Modo Ghost com identidade efetiva do alvo;
- transferência entre igrejas e governança multi-tenant;
- relatórios autorizados e trilhas de auditoria.

### Inteligência e IA
- Abigail no Início para liderança autorizada;
- chave Gemini por igreja, armazenada no Supabase;
- auditoria de interações conforme grant;
- Modelo Preditivo;
- Temas, Reconhecimentos e Reset da Trilha.

### Rede e comercial
- Instâncias (Igrejas), alternância e isolamento por `tenant_id`;
- planos, contratos, capacidade, checkout e portal Stripe;
- Gestão Liberada por tenant;
- Aliança Conecta Reino e Indicados;
- configuração de URL Ao sair e totem por instância.

---

## Mapa rápido

| Capacidade | Pacote mínimo |
|---|---|
| Login, e-mail de PIN, perfil, LGPD, família | Básico |
| Início, avisos, Agenda e contribuições | Básico |
| Cuidado Pastoral do membro | Básico |
| Eventos e avisos de manutenção | Básico |
| Recepção, inbox, régua e sticker | Padrão |
| Totem, geofence, quórum e Espaço Infantil | Padrão |
| Células, escalas, murais, Apoio Mútuo e livros | Padrão |
| Pastoral operacional, tesouraria, campanhas, Primícias e RD | Padrão |
| Controle de Acesso completo e Atribuições | Avançado |
| Modo Ghost e Acessos de Usuários | Avançado |
| Abigail e Modelo Preditivo | Avançado |
| Multi-tenant administrativo, Stripe, Gestão Liberada e Aliança | Avançado |

---

## Premissas comerciais

- A disponibilidade real continua condicionada a papel, grant, tenant e configuração.
- Gestão Liberada remove o bloqueio comercial; não concede permissão funcional.
- Stripe e capacidade são por contrato/instância.
- Dados e parametrizações de uma igreja não são compartilhados automaticamente com outra.
- Recursos “em breve” não são contabilizados.

## Fora dos pacotes publicados

Não vender ou treinar como funcionalidade ativa:

- o carrossel antigo `/(tabs)/dashboard`;
- `/(tabs)/explore` e `/explore`;
- cards congelados de QR, salas, estacionamento, escala avulsa e demais itens listados em `FROZEN_DASHBOARD_CARD_CONTENTS`;
- recursos marcados `coming_soon`.

Minha Célula e Mural de Oportunidades permanecem publicados em rotas dedicadas.

*Conecta+ · Pacotes de funcionalidades · revisão de 05/10/2026.*
