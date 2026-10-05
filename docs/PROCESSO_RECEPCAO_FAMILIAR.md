# Processo de Recepção Familiar

**Documento operacional e de validação ponta a ponta**
**Atualizado em:** 05/10/2026
**Escopo:** convite, formulário público, fila de Recepção Familiar, promoção, inbox de novos cadastros, Régua de Acolhimento e sticker da Home.

---

## 1. Resultado esperado

A Recepção Familiar impede que um formulário público grave pessoas diretamente no cadastro final sem revisão. O fluxo preserva o tenant e, quando conhecido, o vínculo familiar.

```text
Recepção Familiar → convite/QR/link com tenant e family_id
  → /cadastro-familia/ (celular pré-preenchido quando convidado)
  → lote pending
  → revisão e Gravar/Rejeitar
  → profiles + members + family_id
  → inbox de novos cadastros
  → régua automática somente para visitante efetivo
  → sticker da Home orienta a admissão
```

Entradas suportadas:

1. formulário público aberto por link da igreja;
2. convite individual montado na Recepção Familiar;
3. seleção **Novos Membros**, para convidar pessoa já cadastrada mantendo seu `family_id`;
4. visitante encaminhado por Pequeno Grupo para a mesma fila.

---

## 2. Atores e isolamento

| Ator | Responsabilidade |
|---|---|
| Família/convidado | Preencher o formulário sem login |
| Recepção/Secretaria | Montar convite, revisar lote, corrigir e processar/rejeitar |
| Equipe de acolhimento | Tratar inbox e tarefas D+1/D+4/D+8 |
| Pastoral | Executar acompanhamento pastoral e mudança de papel |
| Super Administrador | Auditar, resolver exceções e configurar tenant/ACL |

Todo link, lote, perfil, família, inbox e tarefa deve pertencer à igreja correta. A sessão do operador fornece `tenant_id`; o formulário público recebe o tenant no link. No Modo Ghost, telas e dados usam a identidade efetiva do alvo.

---

## 3. Convite na Recepção Familiar

### 3.1 Convite livre

1. Abra **Engrenagem → Gestão de Pessoas → Recepção Familiar**.
2. Informe nome e celular com DDD.
3. Confira a igreja ativa e a identidade exibida.
4. Gere o convite e abra o WhatsApp.
5. Antes de enviar, confira nome, igreja e celular.

O WhatsApp é apenas o canal do convite; PIN de autenticação não é enviado por WhatsApp.

### 3.2 Novos Membros

Use **Novos Membros** quando a pessoa já existe no cadastro e deve preencher/completar informações no contexto da família correta.

1. Toque em **Novos Membros**.
2. Use a busca Enxergar.
3. Selecione a pessoa correta.
4. O sistema recupera o `family_id` conhecido.
5. O convite inclui esse `family_id` e o tenant.
6. O celular é pré-preenchido no formulário; nome, igreja e celular podem ser revisados antes do envio.

Esse mecanismo evita criar uma família paralela para quem já possui código familiar. O `family_id` do convite é uma indicação a preservar; conflitos detectados continuam exigindo revisão.

---

## 4. Formulário público

### 4.1 Abertura

- URL publicada: `/cadastro-familia/`.
- Não exige sessão autenticada.
- A rota Expo `/cadastro-familia` redireciona para o standalone Vite.
- O tenant deve estar explícito no link/estado do formulário.
- Em convite individual, o celular chega pré-preenchido; o usuário confirma os dados.

### 4.2 Informante e dependentes

O informante é o Representante Legal. O formulário coleta nome, nascimento, celular, CEP/endereço e informações familiares. Dependentes recebem parentesco, nascimento, celular opcional e campos de cuidado infantil:

- restrição alimentar/alertas médicos;
- necessidades específicas;
- observações adicionais;
- data de casamento quando aplicável.

O envio cria um protocolo e um lote `pending`; ainda não cria definitivamente `profiles` e `members`.

### 4.3 Matching e família

- Nome e telefone normalizados são usados em conjunto; telefone sozinho não deve unir pessoas diferentes.
- `family_id` recebido por convite ou detectado no cadastro existente é preservado quando consistente.
- Se mais de um código familiar for detectado, o lote fica em conflito e não é promovido automaticamente.
- Celular pertencente a outro nome não autoriza anexar o perfil existente.

---

## 5. Fila de Recepção Familiar

O operador vê protocolo, data, integrantes, informante, telefone, nascimento, CEP, `family_id`, matches e conflitos.

### Revisão obrigatória

1. Confirme tenant e protocolo.
2. Confira representante e integrantes.
3. Corrija data provisória `01/01/1900`.
4. Complete CEP/endereço ausente.
5. Revise celulares compartilhados ou duplicados.
6. Confira o `family_id` sugerido.
7. Resolva conflito de família antes de promover.
8. Descarte integrante inválido sem necessariamente rejeitar todo o lote, quando a tela permitir.

### Decisões

- **Gravar selecionados:** cria/atualiza pessoas válidas e conclui o lote.
- **Rejeitar selecionados:** rejeita sem criar pessoas finais e registra a decisão.
- **Conflito:** permanece pendente/pulado até correção ou rejeição; nunca misture famílias automaticamente.

Na promoção, os integrantes recebem o mesmo `family_id`; perfis e membros são sincronizados e o endereço do responsável é aplicado conforme a regra vigente.

---

## 6. Inbox de novos cadastros

Cada novo `profile` elegível gera um registro operacional na inbox da igreja, incluindo:

- perfil e tenant;
- data/hora de entrada;
- nome, telefone e papel efetivo;
- estado visto/não visto;
- origem e vínculo com a régua, quando aplicável.

A inbox não é sinônimo da fila da Recepção:

- **fila:** submissão ainda pendente de promoção;
- **inbox:** perfil já criado, aguardando triagem/admissão operacional.

A equipe pode marcar o item como visto. Criar perfil fora da Recepção também pode gerar inbox, desde que atenda às regras do servidor.

---

## 7. Régua automática: somente visitante efetivo

A régua não deve ser iniciada para todo perfil novo. O servidor só cria a jornada automática quando, no momento da avaliação, a pessoa:

1. pertence ao tenant;
2. possui perfil mínimo concluído, nome válido e telefone utilizável;
3. possui papel `visitantes`;
4. **não** possui `congregado`, `member` ou `super_admin`.

Essa é a definição de **visitante efetivo**. Membro, congregado ou Super Administrador jamais deve receber uma régua automática de visitante apenas porque foi criado recentemente.

### Jornada padrão

| Marco | Tarefa |
|---|---|
| D+1 | WhatsApp de boas-vindas |
| D+4 | Convite para célula/pequeno grupo |
| D+8 | Ligação/verificação pastoral e retorno ao culto |

Dependente sem telefone próprio não recebe ciclo individual. Ao promover o visitante para congregado ou membro, a régua correspondente é interrompida/concluída. O quadro permite responsável, vencimento, conclusão e observações.

---

## 8. Sticker de novos registros na Home

`HomeAdmissionSticker` é a etiqueta amarela retrátil da Home.

Prioridade e destino:

1. havendo lote pendente na Recepção Familiar, abre a fila de Recepção;
2. sem lote prioritário, havendo visitante novo na inbox, abre **Mudança Papéis** já filtrada em **Visitante**;
3. sem pendência, informa que não há novos registros.

Visibilidade:

- Super Administrador: permanece visível mesmo sem pendência;
- secretaria/pastoral autorizada: aparece quando existe pendência;
- demais perfis: somente com grant explícito.

Marcar inbox como vista não deve promover papel automaticamente. Recepção, triagem e mudança de papel são decisões distintas.

---

## 9. Primeiro acesso depois da promoção

1. O usuário informa celular.
2. Primeiro PIN ou recuperação é enviado por **e-mail**.
3. O onboarding verifica cadastro mínimo e LGPD da instância.
4. Com LGPD ativo, exige texto da igreja, aceite e selfie quando configurado.
5. Ao concluir, abre o Início.

Depois disso, a família usa **Início → evento → Agenda da Família**, marca audiência e apresenta QR no totem/Espaço Infantil quando aplicável. A Recepção não confirma presença por si só.

---

## 10. Espaço Infantil

O Cadastro Rápido pode criar/preservar `family_id`, registrar responsável e crianças e gerar QR/crachá. Os dados de cuidado acompanham a criança. Na sala:

1. equipe seleciona evento/sala;
2. lê o QR familiar;
3. confirma entrada;
4. na retirada, lê/valida novamente e registra saída.

A família vê apenas seus integrantes; a equipe autorizada vê a operação da sala.

---

## 11. Cenários mínimos de validação

### Família nova
- convite/link da igreja correta;
- formulário com representante, cônjuge e criança;
- lote aparece no tenant correto;
- promoção cria um único `family_id`;
- inbox nasce para os perfis elegíveis;
- régua nasce somente para visitante efetivo com telefone próprio;
- sticker abre a pendência correta.

### Pessoa já cadastrada — Novos Membros
- selecionar pessoa por Enxergar;
- convite contém `family_id` e celular pré-preenchido;
- submissão reutiliza a família;
- não cria núcleo paralelo.

### Pessoa já membro/congregado
- perfil novo/atualizado pode aparecer na inbox conforme regra;
- não recebe régua automática de visitante.

### Conflito
- celulares apontam para famílias diferentes;
- lote é sinalizado e não grava;
- nenhuma união automática ocorre.

### Sticker
- fila de Recepção tem prioridade;
- sem fila, visitante novo abre Mudança Papéis filtrada;
- Super Administrador vê estado vazio.

### Multi-tenant e Ghost
- link A não grava na igreja B;
- operador só lista lotes da igreja ativa;
- no Ghost, identidade efetiva governa ACL e dados; billing continua com operador real.

---

## 12. Referência técnica

| Peça | Referência |
|---|---|
| Formulário | `standalone/cadastro-familia/`, `FamilyRegistrationForm.tsx` |
| Fila | `MaintenanceFamilyReceptionCard.tsx` |
| Recepção SQL | `scripts/recepcao-cadastro-familiar.sql` e patches multi-tenant |
| Régua | `scripts/visitor-followup-regua.sql` e patches de visitante efetivo |
| Menu | `lib/appDrawerMenu.ts` (`family_reception`, `visitor_followup`) |
| Sticker | `HomeAdmissionSticker` e inbox de novos cadastros |
| Sessão efetiva | `loadEffectiveSessionProfile`, `resolveEffectiveProfileId` |
| Totem | `app/totem-checkin.tsx`, RPCs de check-in |

---

*Conecta+ · Processo de Recepção Familiar · revisão de 05/10/2026.*
