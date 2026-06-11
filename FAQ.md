# Perguntas e Respostas (FAQ) — App IBN

Respostas às dúvidas mais comuns sobre o aplicativo da **Igreja Batista Norte**, organizadas **por tela** e **por assunto**.

**Documentação relacionada:** [`INDICE_DOCUMENTACAO.md`](INDICE_DOCUMENTACAO.md) · [`PACOTE_1_VISAO_GERAL.md`](PACOTE_1_VISAO_GERAL.md) · [`FUNCIONALIDADES.md`](FUNCIONALIDADES.md) · [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) · [`BLUEPRINT.md`](BLUEPRINT.md)

**Atualizado em:** 22/05/2026

---

## Índice

### Por tela
1. [Login](#1-login)
2. [Cadastro inicial](#2-cadastro-inicial)
3. [Painel / Dashboard](#3-painel--dashboard)
4. [Agenda da Família](#4-agenda-da-família)
5. [Check-in e QR Code](#5-check-in-e-qr-code)
6. [SALA(S) — Kids e Teens](#6-salas--kids-e-teens)
7. [Dízimos e Ofertas](#7-dízimos-e-ofertas)
8. [Lista de Membros e Mapa](#8-lista-de-membros-e-mapa)
9. [Aniversariantes](#9-aniversariantes)
10. [Financeiro (membro)](#10-financeiro-membro)
11. [Escalas e Estacionamento](#11-escalas-e-estacionamento)
12. [Dados Cadastrais](#12-dados-cadastrais)
13. [Gerenciar Família](#13-gerenciar-família)
14. [Coração Aberto e Meus Pedidos](#14-coração-aberto-e-meus-pedidos)
15. [Termos LGPD](#15-termos-lgpd)
16. [Menu, navegação e saída](#16-menu-navegação-e-saída)
17. [Totem de check-in](#17-totem-de-check-in)
18. [Manutenção (equipe)](#18-manutenção-equipe)

### Por assunto
- [Acesso e senha](#assunto-acesso-e-senha)
- [LGPD e privacidade](#assunto-lgpd-e-privacidade)
- [Check-in e eventos](#assunto-check-in-e-eventos)
- [Família e cadastro](#assunto-família-e-cadastro)
- [Permissões e perfis](#assunto-permissões-e-perfis)
- [Financeiro](#assunto-financeiro)
- [Pastoral](#assunto-pastoral)
- [Escalas](#assunto-escalas)
- [Mapa e endereço](#assunto-mapa-e-endereço)
- [Segurança e dados](#assunto-segurança-e-dados)
- [Problemas técnicos](#assunto-problemas-técnicos)
- [Totem e quiosque](#assunto-totem-e-quiosque)

---

# Por tela

## 1. Login

**O que preciso para entrar no app?**  
Seu **número de celular** (com DDD) e sua **senha de acesso de 4 dígitos** (PIN).

**É a primeira vez que uso o app. E a senha?**  
Na primeira entrada você ainda não tem senha definitiva. Toque no ícone do **WhatsApp** ao lado do campo de senha, receba o código temporário e digite os 4 dígitos. Depois altere a senha em **Dados Cadastrais**.

**Por que o WhatsApp não abre ou dá erro?**  
O envio depende da configuração da igreja (`psw_user` / `psw_mngr` em `app_parameters`). Pode abrir no seu celular ou no do gestor. Se falhar, confira o número digitado ou peça ajuda à secretaria.

**Posso entrar sem passar pelo WhatsApp?**  
Não na primeira vez. O app exibirá *"Código necessário"* se você tentar digitar senha sem ter solicitado o PIN temporário.

**O app entra sozinho ao digitar a senha?**  
Sim. Ao completar o 4º dígito, a validação pode ocorrer automaticamente. Você também pode tocar em **Entrar**.

**Aparece "Número ou senha inválidos". O que fazer?**  
Confira os 4 dígitos. Se esqueceu, gere novo código pelo WhatsApp. Se persistir, a secretaria pode verificar seu cadastro no sistema.

**Aparece "Validação indisponível".**  
Problema no servidor (RPC `verificar_login` não instalada ou indisponível). Avise a equipe técnica da igreja.

**Aparece "Não foi possível conectar ao servidor".**  
Verifique internet (Wi‑Fi ou dados móveis) e tente de novo.

**O que é o modo totem na tela de login?**  
Quando o celular configurado é o do **totem** (`cel_totem`), a tela muda para **Totem — Check-in**: só pede senha **9999**, sem cadastro de membro.

**Por que o app abre direto no totem sem pedir login?**  
Se esse aparelho já tinha sessão do totem salva, o app restaura automaticamente. Use **Encerrar sessão** ao final do culto.

**Para que servem Instagram e YouTube na tela de login?**  
Links para as redes sociais oficiais da igreja — não fazem parte do login.

**O app lembra meu celular depois que saio?**  
Após **Sair do aplicativo** / **Encerrar sessão**, a sessão é limpa. Na web, pode ser necessário digitar celular e senha novamente.

---

## 2. Cadastro inicial

**Quando sou levado à tela de Cadastro?**  
Após o primeiro login bem-sucedido, se seu perfil ainda não completou o cadastro inicial (nome, LGPD, selfie).

**Posso alterar o telefone no cadastro?**  
Não. O telefone vem do login e aparece bloqueado — é sua identidade no sistema.

**Por que não consigo marcar "Li e aceito" nos termos?**  
É preciso: (1) preencher nome e nascimento; (2) **rolar os termos LGPD até o final** (aparece `✅ Termos lidos.`).

**E se eu marcar "Li e não concordo"?**  
O app explica as implicações da recusa. O cadastro segue conforme a política da igreja; seu aceite fica registrado.

**A câmera não abre para a selfie.**  
Permita o uso da câmera nas configurações do celular. Na **versão web**, você pode escolher uma foto do dispositivo.

**Dicas para uma boa selfie?**  
Rosto centralizado, boa iluminação, sem obstruções (óculos escuros, boné).

**O que acontece após "Cadastro inicial concluído"?**  
Você é direcionado a completar **Dados Cadastrais** ou aceitar **LGPD**, conforme o que ainda faltar.

**Recebo código de família no cadastro?**  
Sim. O sistema reserva automaticamente um `family_id` / código de família para seu perfil.

---

## 3. Painel / Dashboard

**O que é o Índice do Aplicativo?**  
Tela com **etiquetas** (atalhos) para cada módulo. Toque na etiqueta para abrir o card correspondente no Painel.

**O que é o Painel?**  
Carrossel de cards com os módulos da igreja (eventos, ofertas, pastoral, etc.). Pode ser acessado pelo Índice ou pela navegação direta.

**Como passo de um card para outro?**  
Deslize o dedo horizontalmente **ou** use os botões **‹** e **›** no rodapé (segurar avança automaticamente). O rodapé mostra a posição atual (**1 / N**).

**Por que o topo está vermelho?**  
Seu **LGPD está pendente**. Complete os termos em **Dados Cadastrais** ou na tela **LGPD**.

**Por que não vejo alguns cards?**  
Cada card depende da sua **permissão de perfil** (ACL). A igreja define quem vê Financeiro, Escalas, etc. Fale com o administrador se achar que falta algo.

**O que é o banner de "controle de acesso indisponível"?**  
O servidor de permissões não respondeu corretamente. Em produção estrita, alguns recursos podem ficar bloqueados até a equipe TI corrigir.

**Para que serve o botão Menu no rodapé?**  
Abre a tela de **atalhos** com lista de módulos e o botão de **sair**.

**Para que serve a engrenagem?**  
Abre a **Manutenção** — só aparece se você tiver permissão de equipe/administrador.

**O que é a tela de atalhos (Menu)?**  
Lista rápida: Agenda, Salas, QR Totem, Ofertas, Pastoral, Membros, etc., sem deslizar o carrossel. Cada atalho tem **ícone colorido** por módulo.

---

## 4. Agenda da Família

**O que é "audiência" ou pré-check-in?**  
Marcar na lista quem da sua família participará do evento — **antes** de apresentar o QR no totem.

**Como escolho o evento?**  
No card **Agenda da Família**, use **Trocar Evento** (chips horizontais).

**Não aparece nenhum evento.**  
Pode não haver eventos publicados no momento, ou todos estão fora da janela visível. Tente **Atualizar** ou aguarde a equipe publicar.

**O que significa "vagas"?**  
Quantidade de inscritos em relação à **capacidade máxima** do evento.

**Marquei a audiência e nada mudou no QR.**  
O card de QR só aparece no **dia do evento** e após o pré-check-in, conforme o tipo de fluxo (totem, quórum, manual).

**Posso desmarcar a audiência depois?**  
Em eventos normais, sim. Em **quórum com check-in já confirmado no totem**, a audiência pode **travar** para proteger a lista oficial.

**Evento de quórum: só posso marcar uma pessoa?**  
Sim. Apenas o **membro da sessão ativa** pode ser marcado na audiência.

**Aparece erro em vermelho no card (preCheckinGateError).**  
Falha ao consultar o pré-check-in no servidor — não significa necessariamente que você não marcou; pode ser instabilidade. Tente novamente ou avise a equipe.

**O que é check-in automático?**  
Alguns eventos registram presença direto na audiência, sem QR — o app informa isso nos textos de orientação.

---

## 5. Check-in e QR Code

**Quando o card de QR Code aparece?**  
Geralmente no **dia do evento**, com audiência marcada, evento publicado e permissão de acesso. O título pode variar: *QR Code — Check-in Totem*, *Check-in Quórum*, etc.

**O que é a "etiqueta" amarela?**  
Seu **código de família** — identificador usado no totem junto com o QR.

**Como faço check-in no culto?**  
1) Marque audiência na Agenda; 2) No dia, abra o card QR; 3) Apresente o QR na câmera do **totem** da igreja.

**O totem diz "Pré-check-in não encontrado".**  
Volte à **Agenda da Família** e marque a audiência dos participantes antes de escanear.

**O totem diz que já foi confirmado.**  
Normal — evita check-in duplicado. Sua presença já está registrada.

**Posso fazer check-in sem totem?**  
Depende da configuração do evento (manual, automático). Em eventos com totem/quórum, o QR no totem é o passo de confirmação.

**Toquei no card QR e abriu uma lista de membros.**  
É o **CheckinModal** — seleção manual auxiliar. A confirmação oficial no culto é pelo **totem** + pré-check-in na Agenda.

**Não tenho código de família / QR vazio.**  
Vincule ou confira seu código em **Dados Cadastrais** ou com a secretaria.

**Badges IBN KIDS / IBN TEENS no QR?**  
Indicam que o evento tem salas Kids e/ou Teens — informativo no card.

---

## 6. SALA(S) — Kids e Teens

**Posso marcar entrada na sala pelo meu celular?**  
**Não.** No dashboard o card **SALA(S)** é **somente leitura** — você vê quem entrou, mas não marca.

**Quem aparece na lista do meu card SALA(S)?**  
Apenas **membros da sua família** inscritos no evento (Kids ou Teens). A equipe na manutenção vê todos os inscritos.

**Quem marca a entrada na sala Kids/Teens?**  
A **equipe** na **Manutenção → Sala(s) - Check In**.

**O que significa o ✓ na lista?**  
A criança/adolescente teve **entrada na sala confirmada** pela equipe.

**Contagem "3/5" nos chips das salas?**  
Inscritos com entrada confirmada / total de inscritos naquela sala (da **sua família**, no dashboard).

**Lista vazia no card SALA(S).**  
Pode ser que ninguém da sua família esteja inscrito no evento, ou que o sistema não identificou seu código de família — confira em **Dados Cadastrais**.

---

## 7. Dízimos e Ofertas

**O card some quando o evento não tem ofertas?**  
**Não.** O card **Dízimos e Ofertas** permanece **sempre** no carrossel (se seu perfil tiver permissão ACL). A flag `parm_ofertas` do evento não controla mais a visibilidade deste card.

**Onde vejo a chave PIX?**  
No card **Dízimos e Ofertas** do Painel.

**"Chave PIX indisponível".**  
A chave ainda não foi configurada em `app_parameters` ou falhou ao carregar. Toque em **Atualizar chave PIX** ou avise a tesouraria.

**Como copio a chave PIX?**  
Toque em **Copiar chave PIX**. Mensagem de sucesso aparece por alguns segundos.

**O PIX pelo app debita automaticamente?**  
Não. O app só **exibe e copia** a chave — o pagamento é feito no app do seu banco.

---

## 8. Lista de Membros e Mapa

**O que é a Lista de Membros?**  
Consulta de membros com busca por nome, código de família e atalho WhatsApp.

**Para que serve o botão Mapa?**  
Abre o **mapa de geolocalização** (versão web/PWA) com pins por endereço/CEP.

**O mapa não abre ou está vazio no celular nativo.**  
O mapa completo funciona na **versão web (PWA)**. No app nativo pode aparecer apenas orientação para usar o navegador.

**Por que meu pin não aparece no mapa?**  
CEP ou endereço podem estar incompletos em **Dados Cadastrais**, ou a geocodificação ainda não rodou. Toque em **Atualizar mapa**.

**Filtros: Visitantes vs Com papel?**  
Visitantes são perfis marcados como visitantes no ACL; "com papel" agrupa demais perfis cadastrados.

**Posso ver telefone de qualquer membro?**  
Somente o que seu perfil tem permissão de visualizar; contato via WhatsApp quando disponível.

**Ícone de usuários na tabela.**  
Abre modal com **membros daquela família**.

---

## 9. Aniversariantes

**De onde vêm os aniversariantes?**  
Datas de nascimento cadastradas nos perfis/membros.

**Como filtro por mês?**  
Use o **seletor de mês** (Picker) no topo do card.

**Lista vazia no mês.**  
Ninguém cadastrado faz aniversário naquele mês, ou faltam datas de nascimento.

**Ícone WhatsApp.**  
Abre conversa com o aniversariante, se houver telefone.

---

## 10. Financeiro (membro)

**Posso lançar despesas/receitas pelo app?**  
**Não** na tela **Financeiro** do membro — é **somente leitura**. Lançamentos são feitos pela equipe na **Manutenção**.

**Por que alguns meses têm "(só planejado)"?**  
Há orçamento **PLANEJADO** naquele mês, mas ainda sem movimento **REALIZADO**. O resultado REALIZADO pode aparecer vazio; use a seção **Orçamento**.

**O que é "saldo acumulado até o mês"?**  
Soma de todos os lançamentos REALIZADOS até o fim do mês selecionado — não é só o movimento daquele mês.

**O que é YTD no boletim?**  
Movimento **REALIZADO** acumulado no **ano civil** até o mês selecionado.

**Seção "Planejado × Realizado" bloqueada.**  
Não há lançamentos PLANEJADO para aquele mês.

**Aviso amarelo sobre comentários.**  
Alguns comentários de lançamentos não carregaram — os valores principais ainda podem estar corretos.

**Por que não vejo o mês atual?**  
O seletor do dashboard financeiro oculta o **mês corrente** — foco em meses já encerrados para consulta.

---

## 11. Escalas e Estacionamento

**O que vejo no card Escalas?**  
Tipos de escala da igreja (vigilância, estacionamento, intercessão, etc.) e quem serve em cada data. No mesmo domingo podem aparecer **vários servos** quando o tipo permite mais de uma vaga.

**Quantos servos podem servir no mesmo domingo?**  
O limite é configurado em **Manutenção → Tipos de Escala** (`vagas_por_servico`, de 1 a 50). O mesmo servo não pode ser escalado duas vezes na mesma data.

**Como contato um servo?**  
Ícone **WhatsApp** ao lado do nome, quando houver telefone.

**Estacionamento: como identifico um veículo?**  
Selecione escala de estacionamento → **Identificar veículo** → digite a **placa** → busca vincula ao proprietário cadastrado.

**Posso alterar a escala pelo app de membro?**  
Não. Alterações são na **Manutenção → Programação de Escalas** *(staff)*.

---

## 12. Dados Cadastrais

**Não consigo ver alguns campos.**  
Permissões de **coluna** (ACL) podem ocultar CPF, alertas médicos, etc., conforme seu papel.

**"Campo protegido" ao editar.**  
Você tem visualização mas não permissão de **alteração** naquele campo.

**Como troco minha senha de 4 dígitos?**  
Seção **Senha de acesso**: senha atual, nova e confirmação.

**CEP preencheu o endereço sozinho?**  
Sim — o app consulta o servidor (`sync_profile_address_from_cep`) e sugere logradouro, bairro, cidade.

**Como cadastro veículo?**  
Na seção **Veículos**: placa, marca, modelo, cor.

**Como vinculo minha família a outra?**  
Seção **Vincular à família**: busque pelo código e solicite vínculo (conforme regras da igreja).

**Cabeçalho pede "Complete seu cadastro".**  
Faltam campos obrigatórios do onboarding (CPF, e-mail, endereço, etc.).

**Posso trocar de telefone?**  
Sim, com fluxo dedicado que atualiza perfil e sessão — use com cuidado para não perder acesso.

---

## 13. Gerenciar Família

**Quem pode gerenciar família?**  
Perfis com permissão de tela **Gerenciar família** — em geral o responsável pela conta familiar.

**Qual a diferença entre membro em `members` e perfil em `profiles`?**  
Membro da família pode existir sem app próprio; perfil com telefone pode fazer login.

**Como adiciono alguém que já está em outra família?**  
Busque pelo **nome** ou informe os dados. Se a pessoa já pertence a outra família, o app pede **confirmação de transferência** para a sua família.

**O endereço é copiado ao aceitar ou transferir?**  
**Sim.** Ao confirmar transferência, aceitar membro pendente (checkbox) ou adicionar novo membro, o app copia o **endereço completo** do gestor (CEP, rua, número, complemento, bairro, cidade, estado) para o perfil do membro — desde que o gestor tenha endereço cadastrado e o membro tenha perfil identificável (telefone ajuda).

**Endereço não foi copiado.**  
O vínculo familiar pode ter sido feito mesmo assim. Verifique se **seu** perfil tem endereço completo e se o membro tem telefone. Se persistir, avise a equipe técnica (RPC `update_profile_field` / `profiles-sync-address-from-cep-rpc.sql`).

**O que é o checkbox de aceite do membro?**  
**Reconhecimento familiar** — confirma que aquele membro pertence à sua família no sistema. Ao marcar como aceito, o endereço da família também é herdado.

**Não consigo excluir um membro.**  
O **representante legal** da conta não pode ser removido.

**"Telefone já no grupo familiar".**  
Já existe membro/perfil com esse número na mesma família.

**Kids/Teens: bolinhas coloridas.**  
Indicam faixa etária conforme parâmetros da igreja (sala Kids ou Teens).

---

## 14. Coração Aberto e Meus Pedidos

**O que é Coração Aberto?**  
Canal para pedidos de **cuidado pastoral**, oração ou intercessão.

**Qual a diferença entre Sigilo pastoral e Intercessão?**  
**Sigilo:** acesso restrito à equipe pastoral. **Intercessão:** pode ser compartilhado com grupo de intercessão (conforme política da igreja).

**Como escolho Motivo e Situação?**  
Use os **chips** na tela (categorias carregadas do servidor). Em telas estreitas, Motivo e Situação aparecem empilhados.

**Posso pedir para outra pessoa?**  
Sim — selecione beneficiário **família** ou **terceiro** e preencha os dados.

**Onde vejo pedidos enviados?**  
**Meus pedidos** (`/pastoral-history`) — histórico com status.

**Lista vazia em Meus pedidos.**  
Você ainda não enviou pedidos ou a sessão não identificou seu perfil — faça login novamente.

**Quem responde ao pedido?**  
A equipe pastoral **fora do app** (telefone, encontro pessoal, etc.). O app registra e encaminha o pedido.

---

## 15. Termos LGPD

**Por que preciso rolar até o fim dos termos?**  
Requisito de **consentimento informado** — o sistema só libera o aceite após leitura completa.

**Posso mudar de ideia depois?**  
O aceite fica em `lgpd_accepted` no perfil. Para revisar, acesse **LGPD** ou **Dados Cadastrais**.

**Recusei os termos. Posso usar o app?**  
Depende da política da igreja; o app registra sua preferência. Alguns recursos podem ficar limitados.

---

## 16. Menu, navegação e saída

**Qual a diferença entre Menu e Sair?**  
No **Painel**, **Menu** leva aos atalhos. O **Sair** / **Encerrar sessão** fica na tela de atalhos (rodapé).

**Sair fecha o app no Android?**  
Pode encerrar o aplicativo após limpar a sessão — comportamento esperado.

**Troquei de celular. O que faço?**  
**Saia** no aparelho antigo; no novo, login com celular + senha.

**Mudaram minhas permissões e um card sumiu.**  
Saia e **entre de novo** para recarregar permissões do servidor.

---

## 17. Totem de check-in

**O totem é para membros usarem no culto?**  
Não. É um **aparelho fixo da igreja** operado na entrada para **escanear** o QR das famílias.

**Senha do totem.**  
**9999** (configuração padrão do modo totem).

**Nenhum evento no totem.**  
Pode não ser o dia do evento, evento não publicado, sem flag totem/quórum, ou colunas SQL não aplicadas — mensagens na tela orientam.

**Câmera do totem não funciona na web.**  
Totem web exige **HTTPS** (ou localhost em desenvolvimento). Permita câmera no navegador.

**Devo sair do totem após o culto?**  
**Sim.** Use **Encerrar sessão** para não deixar o quiosque logado.

---

## 18. Manutenção (equipe)

**Quem acessa a Manutenção?**  
Perfis com permissão `view` em `/maintenance-dashboard` — ícone engrenagem no Painel.

**"Sem permissão" ao tocar na engrenagem.**  
Seu papel não inclui manutenção. Solicite ao `super_admin`.

**Como crio evento com totem e quórum?**  
**Programação de Eventos** → novo/editar → toggles **Ativação de Totem** e **Requer Quorum** → **Publicado**.

**Como marco entrada na sala Kids?**  
**Sala(s) - Check In** → selecione evento → checkbox por inscrição.

**Como importo financeiro?**  
**Informações Financeiras** → CSV ou colar → substituir ou acrescentar.

**Como gero escala em lote?**  
**Programação de Escalas** → preview do ciclo → confirmar → grava via `aplicar_ciclo_escala`. Configure **vagas por domingo** e **modo do ciclo** (individual ou equipe) em **Tipos de Escala**.

**Controle de Acesso: quem configura?**  
Somente **`super_admin`** — papéis e grants por perfil.

---

# Por assunto

## Assunto: Acesso e senha

| Pergunta | Resposta |
|----------|----------|
| Esqueci minha senha | WhatsApp na tela de login (PIN temporário) ou secretaria |
| Quantos dígitos tem a senha? | **4** |
| Posso usar letras na senha? | Não — apenas números |
| Mesmo celular em dois aparelhos? | Sim, com mesmo login — evite sessões simultâneas em aparelhos compartilhados |
| Preciso de e-mail para entrar? | Não — login é **celular + PIN** |

---

## Assunto: LGPD e privacidade

| Pergunta | Resposta |
|----------|----------|
| Onde ficam meus dados? | Banco **Supabase** (nuvem), projeto da igreja |
| Quem vê meu CPF? | Perfis com permissão ACL de coluna; oculto para membros comuns |
| Selfie: para que serve? | Identificação no cadastro; armazenada no Storage Supabase |
| Posso excluir minha conta pelo app? | Não há fluxo automático de exclusão — contate a secretaria |
| Aceite LGPD é obrigatório? | Fortemente recomendado; recusa é registrada |

---

## Assunto: Check-in e eventos

| Pergunta | Resposta |
|----------|----------|
| Ordem correta do check-in | Audiência → QR no dia → scan no totem |
| Check-in automático | Marca na audiência já conta presença — sem QR |
| Quórum vs totem | Quórum exige confirmação no totem e trava lista; totem pode existir sem quórum |
| Evento rascunho | Membros **não veem** — precisa **Publicado** |
| Capacidade esgotada | Inscrição pode falhar ao marcar audiência — ver vagas no card |

---

## Assunto: Família e cadastro

| Pergunta | Resposta |
|----------|----------|
| O que é family_id? | Código único da família no sistema |
| Diferença family_id e codigo_membro | Podem coincidir; usados no QR e etiqueta |
| Criança sem celular | Cadastre em **Gerenciar Família** como membro |
| Membro com celular próprio | Cadastre telefone — pode gerar perfil/login próprio |

---

## Assunto: Permissões e perfis

| Pergunta | Resposta |
|----------|----------|
| O que é ACL? | Controle de acesso — define telas, cards e campos por papel |
| Papéis comuns | member, family_acceptor, lider, events_admin, pastoral, super_admin |
| Sou membro mas não vejo Financeiro | Grant não atribuído — admin adiciona em Controle de Acesso |
| Banner ACL indisponível | RPC `profile_has_access` ausente ou erro — equipe TI |

---

## Assunto: Financeiro

| Pergunta | Resposta |
|----------|----------|
| REALIZADO vs PLANEJADO | Realizado = o que aconteceu; Planejado = orçamento previsto |
| Membro edita lançamentos? | Não |
| Esvaziar mês (manutenção) | Pode apagar só REALIZADO, só PLANEJADO ou ambos — escopo explícito |

---

## Assunto: Pastoral

| Pergunta | Resposta |
|----------|----------|
| Pedido é anônimo? | Vinculado ao seu perfil; sigilo pastoral restringe quem lê no backend/equipe |
| Urgência / emergência? | O app **não** substitui emergência (SAMU, 190) — use canais adequados |
| Editar pedido enviado? | Não pelo app — contate pastoral se precisar complementar |

---

## Assunto: Escalas

| Pergunta | Resposta |
|----------|----------|
| Como sei minha próxima escala? | Card **Escalas** no Painel |
| Ciclo em bloco | Gera vários domingos de uma vez *(staff)* — modo **individual** (cada servo em domingo distinto) ou **equipe** (até N servos no mesmo domingo) |
| Vagas por domingo | Definidas em **Tipos de Escala** (`vagas_por_servico`, 1–50). O mesmo servo não repete na mesma data |
| Domingo já ocupado | Modo individual **pula** domingos com registro; modo equipe preenche vagas restantes até o limite |

---

## Assunto: Mapa e endereço

| Pergunta | Resposta |
|----------|----------|
| Mapa mostra endereço exato? | Aproximação por **CEP** — pins podem ser agrupados |
| Atualizei CEP e mapa antigo | Toque **Atualizar mapa**; cache local é renovado |
| Visitante no mapa | Perfil marcado como visitante no ACL |

---

## Assunto: Segurança e dados

| Pergunta | Resposta |
|----------|----------|
| Senha fica salva no celular? | Só sessão (telefone + id perfil) — **não** a senha em texto |
| Conexão segura? | HTTPS com Supabase |
| Compartilhar celular logado | **Sempre saia** ao terminar |
| Quem administra permissões? | `super_admin` na Manutenção |

---

## Assunto: Problemas técnicos

| Pergunta | Resposta |
|----------|----------|
| App lento | Verifique internet; feche abas no navegador (PWA) |
| Tela branca / erro | Atualize página; limpe cache do navegador |
| Versão web vs app nativo | Mapa completo e alguns recursos são **PWA** |
| Mensagem menciona "execute script SQL" | Configuração incompleta no Supabase — equipe TI |
| Build / deploy | Igreja publica pasta `dist/` após `npm run build:web` |

---

## Assunto: Totem e quiosque

| Pergunta | Resposta |
|----------|----------|
| Membro escaneia no próprio celular? | Não — membro **mostra** QR; **totem escaneia** |
| QR de outra família | Totem confirma só quem tem pré-check-in **daquela família** |
| Vários eventos no mesmo dia | Totem seleciona evento elegível automaticamente |
| lockPastEvents | Eventos passados são bloqueados automaticamente ao operar totem |

---

## Não encontrou sua dúvida?

1. Consulte o [`MANUAL_TREINAMENTO.md`](MANUAL_TREINAMENTO.md) (passo a passo prático).
2. Anote a **mensagem exata** na tela e o **módulo** onde ocorreu.
3. Contate a **secretaria** (cadastro, família, eventos) ou **equipe técnica** (erros de servidor, permissões, SQL).

---

*FAQ — App IBN · Igreja Batista Norte*
