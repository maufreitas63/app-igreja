-- Seed: Questionário de Perfil Ministerial (50 perguntas)
-- Gerado por scripts/generate-ministerial-profile-seed.mjs — não edite manualmente.

delete from public.ministerial_respostas;
delete from public.ministerial_resultados;
delete from public.ministerial_opcoes;
delete from public.ministerial_perguntas;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q001', 'Batistas creem que a Bíblia é a única regra de fé e prática. Como isso se reflete no seu serviço?', 'Doutrina e Escritura', 1)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q001_OPT1', 'Q001', 'Quero que tudo que ensino e prego esteja ancorado exatamente no texto bíblico.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q001_OPT2', 'Q001', 'Verifico se as práticas da nossa adoração estão de acordo com o que a Escritura ensina.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q001_OPT3', 'Q001', 'Uso a Palavra como base para aconselhar e cuidar das pessoas em crise.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q001_OPT4', 'Q001', 'Fundamento meu testemunho: só anuncio o evangelho que a Bíblia revela.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q002', 'Como você reage quando alguém na sua igreja está doutrinariamente confuso ou sendo influenciado por ensinos errados?', 'Doutrina e Escritura', 2)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q002_OPT1', 'Q002', 'Busco sentar e abrir a Bíblia para clarificar a questão ponto por ponto.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q002_OPT2', 'Q002', 'Inicio um acompanhamento de discipulado para fortalecer sua base doutrinária.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q002_OPT3', 'Q002', 'Levo ao pastor ou conselho para que a situação seja tratada com cuidado pastoral.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q002_OPT4', 'Q002', 'Oro por ele e busco estar presente com paciência até sua restauração.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q003', 'Qual dos seguintes textos mais descreve o que você quer ser como servo de Deus na sua congregação?', 'Doutrina e Escritura', 3)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q003_OPT1', 'Q003', 'Dedica-te à leitura, à exortação, ao ensino.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q003_OPT2', 'Q003', 'Ide, portanto, fazei discípulos...', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q003_OPT3', 'Q003', 'Apascentai o rebanho de Deus que está entre vós...', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q003_OPT4', 'Q003', 'Ai de mim se não pregar o evangelho!', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q004', 'A Escritura é suficiente para vida e piedade. O que você entende por isso?', 'Doutrina e Escritura', 4)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q004_OPT1', 'Q004', 'Significa que não preciso de outras autoridades além da Bíblia para ensinar.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q004_OPT2', 'Q004', 'Significa que posso discipular qualquer pessoa usando apenas a Palavra.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q004_OPT3', 'Q004', 'Significa que até nos momentos mais difíceis, a Bíblia tem respostas.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q004_OPT4', 'Q004', 'Significa que o evangelho em si é poderoso para salvar, independente de outros meios.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q005', 'Como você enxerga a relação entre doutrina e vida prática no ministério batista?', 'Doutrina e Escritura', 5)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q005_OPT1', 'Q005', 'A doutrina sólida é a base — sem ela o serviço é esforço humano sem fundamento.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q005_OPT2', 'Q005', 'A doutrina deve se traduzir em discipulado — crer e obedecer andam juntos.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q005_OPT3', 'Q005', 'A doutrina motiva o evangelismo — entender o evangelho me faz querer proclamá-lo.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q005_OPT4', 'Q005', 'A doutrina me ensina como cuidar das pessoas com sabedoria e amor genuíno.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q006', 'Qual aspecto da identidade batista histórica mais ressoa com o seu coração?', 'Identidade batista', 6)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q006_OPT1', 'Q006', 'A Sola Scriptura — a Bíblia como única e suficiente autoridade.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q006_OPT2', 'Q006', 'O compromisso missionário — William Carey e a missão transcultural.', 'EVANGELISMO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q006_OPT3', 'Q006', 'A vida congregacional — cada membro responsável pelo corpo.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q006_OPT4', 'Q006', 'O cuidado com os excluídos — a tradição batista de lutar pelos oprimidos.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q007', 'Na doutrina batista, cada crente é sacerdote diante de Deus. Como você vive isso?', 'Identidade batista', 7)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q007_OPT1', 'Q007', 'Ensino outros membros a lerem e interpretarem a Bíblia por si mesmos.', 'DISCIPULADO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q007_OPT2', 'Q007', 'Intercedo diretamente a Deus pelos membros da minha congregação.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q007_OPT3', 'Q007', 'Compartilho o evangelho diretamente, sem depender do pastor para isso.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q007_OPT4', 'Q007', 'Assumo responsabilidades de liderança na minha congregação local.', 'LIDERANCA', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q008', 'Batistas defendem a autonomia da igreja local. Como isso influencia seu serviço?', 'Identidade batista', 8)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q008_OPT1', 'Q008', 'Me comprometo com minha igreja local e suas decisões tomadas em assembleia.', 'LIDERANCA', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q008_OPT2', 'Q008', 'Dedico-me a formar membros maduros que participem com discernimento.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q008_OPT3', 'Q008', 'Ajudo a manter a doutrina sã para que a autonomia não vire independentismo.', 'PREGACAO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q008_OPT4', 'Q008', 'Cuido das pessoas para que a comunhão da igreja seja real e fraterna.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q009', 'A assembléia de membros é o órgão deliberativo máximo. Qual é o seu papel nela?', 'Identidade batista', 9)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q009_OPT1', 'Q009', 'Contribuir com discernimento bíblico nas decisões da congregação.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q009_OPT2', 'Q009', 'Liderar processos, mediar conflitos e zelar pela ordem e unidade.', 'LIDERANCA', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q009_OPT3', 'Q009', 'Garantir que os vulneráveis e os menos ouvidos tenham voz.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q009_OPT4', 'Q009', 'Propor ações missionárias e evangelísticas para votação.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q010', 'A separação entre Igreja e Estado é um princípio caro. Como isso impacta seu serviço?', 'Identidade batista', 10)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q010_OPT1', 'Q010', 'Defendo a liberdade religiosa e ensino sobre esse princípio histórico.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q010_OPT2', 'Q010', 'Cuido para que a administração da nossa igreja seja íntegra e independente.', 'LIDERANCA', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q010_OPT3', 'Q010', 'Me motiva a evangelizar sem depender de estruturas de poder — só do evangelho.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q010_OPT4', 'Q010', 'Me lembra que o reino que servimos é espiritual, não político.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q011', 'Como você enxerga a relação entre pastor e congregação na visão batista?', 'Pastorado e ordenanças', 11)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q011_OPT1', 'Q011', 'O pastor é um ensinador primeiro, que alimenta a Palavra.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q011_OPT2', 'Q011', 'O pastor é um servo-líder que ama e cuida cada ovelha.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q011_OPT3', 'Q011', 'O pastor é um coordenador de ministérios que mobiliza todo o corpo.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q011_OPT4', 'Q011', 'O pastor é um missionário que conduz a congregação ao alcance dos perdidos.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q012', 'No contexto batista, o pastor é servo-líder. O que isso significa para o seu chamado?', 'Pastorado e ordenanças', 12)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q012_OPT1', 'Q012', 'Liderar é servir com integridade, transparência e submissão à Escritura.', 'LIDERANCA', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q012_OPT2', 'Q012', 'Pastorear é conhecer cada ovelha e estar presente nas alegrias e tristezas.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q012_OPT3', 'Q012', 'Liderar significa preparar outros para servirem — multiplicar, não centralizar.', 'DISCIPULADO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q012_OPT4', 'Q012', 'O verdadeiro líder aponta constantemente para Cristo e o evangelho.', 'PREGACAO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q013', 'O batismo por imersão é central. O que esse ato representa para o seu chamado?', 'Pastorado e ordenanças', 13)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q013_OPT1', 'Q013', 'Me motiva a ensinar bem a teologia do batismo antes da cerimônia.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q013_OPT2', 'Q013', 'Me lembra que fui separado para discipular os recém-batizados.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q013_OPT3', 'Q013', 'Me impulsiona a evangelizar, pois o batismo pressupõe conversão genuína.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q013_OPT4', 'Q013', 'Me faz querer preparar e conduzir bem esse momento solene na vida da igreja.', 'LOUVOR', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q014', 'Como você prepara alguém para ser batizado?', 'Pastorado e ordenanças', 14)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q014_OPT1', 'Q014', 'Ensino cuidadosamente sobre salvação, arrependimento genuíno e o significado do batismo.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q014_OPT2', 'Q014', 'Acompanho-o de perto em um período de discipulado antes da decisão.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q014_OPT3', 'Q014', 'Converso pastoralmente para discernir se a conversão é genuína e compreendida.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q014_OPT4', 'Q014', 'Uso esse processo como oportunidade para alcançar seus familiares não-crentes.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q015', 'Batistas creem na regeneração que precede a fé. Como isso afeta seu serviço?', 'Pastorado e ordenanças', 15)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q015_OPT1', 'Q015', 'Me faz pregar o evangelho completo — arrependimento, fé e nova vida.', 'EVANGELISMO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q015_OPT2', 'Q015', 'Me leva a discipular cuidadosamente antes de recomendar o batismo.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q015_OPT3', 'Q015', 'Me motiva a ensinar com clareza o que é a salvação e o que é vida regenerada.', 'PREGACAO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q015_OPT4', 'Q015', 'Me faz cuidar pastoralmente de quem questiona sua conversão ou segurança.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q016', 'A Ceia do Senhor é celebrada como memorial. Como você contribui?', 'Vida sacramental', 16)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q016_OPT1', 'Q016', 'Preparo a mensagem que fundamenta e explica o significado da Ceia.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q016_OPT2', 'Q016', 'Cuido da organização e do serviço durante a celebração com reverência.', 'LIDERANCA', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q016_OPT3', 'Q016', 'Uso esse momento para examinar meu coração e interceder pela congregação.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q016_OPT4', 'Q016', 'Vejo como oportunidade de convidar não-crentes para testemunhar e ouvir o evangelho.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q017', 'Qual é a importância das ordenanças para a vida congregacional?', 'Vida sacramental', 17)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q017_OPT1', 'Q017', 'São os dois atos que simbolizam verdades centrais do evangelho que preciso ensinar.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q017_OPT2', 'Q017', 'São momentos para formar crentes na compreensão do que significam.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q017_OPT3', 'Q017', 'São celebrações que unem a congregação e identificam quem somos como batistas.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q017_OPT4', 'Q017', 'São oportunidades para acolher quem está descobrindo a fé e para renovar a própria.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q018', 'Um novo convertido acaba de ser batizado e precisa ser integrado. Qual é o seu instinto?', 'Vida sacramental', 18)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q018_OPT1', 'Q018', 'Convido-o para um curso de discipulado ou classe de novos membros.', 'DISCIPULADO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q018_OPT2', 'Q018', 'Apresento-o pessoalmente às famílias e cuido da sua integração relacional.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q018_OPT3', 'Q018', 'Ensino-lhe as doutrinas fundamentais da fé batista desde o início.', 'PREGACAO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q018_OPT4', 'Q018', 'Conecto-o logo com oportunidades de servir e testemunhar.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q019', 'A Grande Comissão é o mandato missionário. Onde você se encaixa nessa missão?', 'Missão e evangelismo', 19)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q019_OPT1', 'Q019', 'Ensinando a guardar tudo que Cristo ordenou — formando discípulos sólidos.', 'DISCIPULADO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q019_OPT2', 'Q019', 'Indo ao campo — bairros, cidades e nações — pregando e plantando igrejas.', 'EVANGELISMO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q019_OPT3', 'Q019', 'Liderando e coordenando as equipes missionárias da nossa congregação.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q019_OPT4', 'Q019', 'Cuidando dos que retornam do campo e dos que estão vulneráveis na missão.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q020', 'Quando você pensa em plantação de igrejas, como se imagina contribuindo?', 'Missão e evangelismo', 20)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q020_OPT1', 'Q020', 'Sendo o pregador e ensinador que fundamenta a nova congregação na Palavra.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q020_OPT2', 'Q020', 'Evangelizando e fazendo os primeiros discípulos que formarão o núcleo.', 'EVANGELISMO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q020_OPT3', 'Q020', 'Organizando, administrando e estruturando a nova congregação.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q020_OPT4', 'Q020', 'Cuidando pastoralmente das pessoas que chegam vulneráveis.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q021', 'Como você enxerga a missão da sua igreja local no bairro?', 'Missão e evangelismo', 21)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q021_OPT1', 'Q021', 'Ser farol da Palavra — um lugar onde o evangelho é pregado com fidelidade.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q021_OPT2', 'Q021', 'Alcançar cada família do bairro com o testemunho e o convite do evangelho.', 'EVANGELISMO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q021_OPT3', 'Q021', 'Ser comunidade de cuidado — atendendo os necessitados em nome de Cristo.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q021_OPT4', 'Q021', 'Ser escola — formando discípulos que vivam e levem a fé para cada esfera da vida.', 'DISCIPULADO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q022', 'Como você contribui para a cooperação missionária batista?', 'Missão e evangelismo', 22)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q022_OPT1', 'Q022', 'Participo de conferências e formo a congregação sobre a visão missionária global.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q022_OPT2', 'Q022', 'Envio e apoio missionários com oração, recursos e discipulado de retorno.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q022_OPT3', 'Q022', 'Organizo e lidero a participação da nossa igreja nas ações cooperativas.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q022_OPT4', 'Q022', 'Vou ao campo — seja em missão doméstica ou internacional.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q023', 'Se você fosse missionário, qual tipo de trabalho mais te atrairia?', 'Missão e evangelismo', 23)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q023_OPT1', 'Q023', 'Plantar igrejas e ensinar novos crentes.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q023_OPT2', 'Q023', 'Formar discípulos e líderes na nova cultura e contexto.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q023_OPT3', 'Q023', 'Trabalho humanitário com comunidades carentes.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q023_OPT4', 'Q023', 'Evangelismo itinerante e de rua.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q024', 'Qual passagem bíblica mais define o tipo de serviço que você deseja oferecer?', 'Missão e evangelismo', 24)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q024_OPT1', 'Q024', 'Pregai a palavra, sede urgentes...', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q024_OPT2', 'Q024', 'As coisas que ouviste de mim... confia-as a homens fiéis...', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q024_OPT3', 'Q024', 'Como, pois, invocarão aquele em quem não creram?', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q024_OPT4', 'Q024', 'Levai as cargas uns dos outros e assim cumprireis a lei de Cristo.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q025', 'A EBD é um dos pilares da educação cristã. Qual é o seu coração para ela?', 'Educação cristã', 25)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q025_OPT1', 'Q025', 'Quero preparar e ministrar aulas que formem crentes doutrinariamente maduros.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q025_OPT2', 'Q025', 'Quero ensinar crianças e jovens de forma que o evangelho seja claro para cada faixa.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q025_OPT3', 'Q025', 'Quero organizar e coordenar para que cada departamento funcione bem.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q025_OPT4', 'Q025', 'Quero acolher os visitantes e novos membros que chegam pela primeira vez.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q026', 'Batistas históricos valorizaram a pregação expositiva. O que você pensa?', 'Educação cristã', 26)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q026_OPT1', 'Q026', 'É exatamente meu chamado — abrir o texto e deixar a Palavra falar.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q026_OPT2', 'Q026', 'É o que forma o povo de Deus; por isso me dedico ao discipulado que nasce da Palavra.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q026_OPT3', 'Q026', 'Me motiva a levar o evangelho a lugares onde essa pregação ainda não chegou.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q026_OPT4', 'Q026', 'Me faz querer que a adoração e os hinos que cantamos também reflitam essa solidez.', 'LOUVOR', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q027', 'Como você serve as crianças e jovens da sua congregação?', 'Educação cristã', 27)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q027_OPT1', 'Q027', 'Ensino a Bíblia de forma clara, progressiva e adequada à faixa etária.', 'DISCIPULADO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q027_OPT2', 'Q027', 'Cuido do bem-estar emocional e espiritual das famílias em crise.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q027_OPT3', 'Q027', 'Envolvo-os em ações de evangelismo e missão desde cedo.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q027_OPT4', 'Q027', 'Organizo e coordeno os departamentos infantis e juvenis da igreja.', 'LIDERANCA', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q028', 'Qual tipo de livro ou conteúdo você consome com mais prazer?', 'Educação cristã', 28)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q028_OPT1', 'Q028', 'Teologia, comentários bíblicos e livros doutrinários.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q028_OPT2', 'Q028', 'Histórias de missões e depoimentos de conversão.', 'EVANGELISMO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q028_OPT3', 'Q028', 'Liderança, gestão e crescimento de ministérios.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q028_OPT4', 'Q028', 'Oração, vida devocional e formação espiritual.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q029', 'Como você costuma preparar seu coração antes de servir?', 'Educação cristã', 29)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q029_OPT1', 'Q029', 'Com leitura profunda da Bíblia e meditação nas Escrituras.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q029_OPT2', 'Q029', 'Com adoração — músicas e momentos de silêncio diante de Deus.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q029_OPT3', 'Q029', 'Com oração intensa e busca de direcionamento do Espírito.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q029_OPT4', 'Q029', 'Verificando como posso ser útil e onde as necessidades estão.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q030', 'Qual afirmação descreve como você enxerga seu lugar no Corpo de Cristo?', 'Educação cristã', 30)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q030_OPT1', 'Q030', 'Sou alguém chamado a falar — a proclamar, ensinar e expor a verdade.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q030_OPT2', 'Q030', 'Sou alguém chamado a formar — a caminhar com outros até que Cristo seja formado.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q030_OPT3', 'Q030', 'Sou alguém chamado a alcançar — a ir onde o evangelho ainda não chegou.', 'EVANGELISMO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q030_OPT4', 'Q030', 'Sou alguém chamado a cuidar — a ser a presença de Cristo para quem sofre.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q031', 'O diaconato é um ministério de serviço valorizado. Como você enxerga esse chamado?', 'Vida congregacional', 31)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q031_OPT1', 'Q031', 'Os diáconos devem conhecer bem a Palavra para servir com sabedoria.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q031_OPT2', 'Q031', 'O diaconato é cuidado prático — alimentar, assistir e visitar os necessitados.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q031_OPT3', 'Q031', 'É um ministério de gestão que organiza para que o pastor se dedique à Palavra.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q031_OPT4', 'Q031', 'O diácono também deve ser um evangelista — servir abre portas para testemunho.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q032', 'O que mais incomoda seu coração quando você olha para a sua congregação?', 'Vida congregacional', 32)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q032_OPT1', 'Q032', 'Membros sem ancoragem doutrinária, facilmente levados por ensinos errôneos.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q032_OPT2', 'Q032', 'Crentes que não crescem nem discipulam outros — a fé estagnada.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q032_OPT3', 'Q032', 'Pessoas sofrendo em silêncio, sem cuidado pastoral efetivo.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q032_OPT4', 'Q032', 'Uma igreja voltada para si mesma, sem visão pelos de fora.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q033', 'Como você lida com um membro que está se afastando da comunhão?', 'Vida congregacional', 33)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q033_OPT1', 'Q033', 'Busco abrir a Bíblia com ele sobre a importância da vida congregacional.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q033_OPT2', 'Q033', 'Inicio um acompanhamento de discipulado e restauração gradual.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q033_OPT3', 'Q033', 'Vou visitá-lo pessoalmente, ouço sua história e cuido sem julgamento.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q033_OPT4', 'Q033', 'Envolvo líderes e conselho para que a disciplina eclesiástica seja aplicada.', 'LIDERANCA', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q034', 'Quando você pensa em multiplicar seu ministério, você imagina:', 'Vida congregacional', 34)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q034_OPT1', 'Q034', 'Discipular e formar pregadores e mestres.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q034_OPT2', 'Q034', 'Treinar adoradores e músicos para servir.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q034_OPT3', 'Q034', 'Liderar uma rede de cuidado e misericórdia.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q034_OPT4', 'Q034', 'Formar equipes evangelísticas e missionárias.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q035', 'Qual é o seu papel mais natural em um pequeno grupo?', 'Vida congregacional', 35)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q035_OPT1', 'Q035', 'O que ensina e guia os estudos bíblicos.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q035_OPT2', 'Q035', 'O que cuida e acompanha cada membro individualmente.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q035_OPT3', 'Q035', 'O que coordena, organiza e mantém o grupo coeso.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q035_OPT4', 'Q035', 'O que convida novos membros e alcança os de fora.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q036', 'Em qual situação você naturalmente assume a frente?', 'Liderança e adoração', 36)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q036_OPT1', 'Q036', 'Quando preciso ensinar algo complexo de forma simples.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q036_OPT2', 'Q036', 'Quando o grupo precisa de direção e organização.', 'LIDERANCA', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q036_OPT3', 'Q036', 'Quando é hora de orar e buscar a Deus coletivamente.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q036_OPT4', 'Q036', 'Quando surge uma oportunidade de evangelizar.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q037', 'A hinologia batista tem um papel formativo. O que você pensa?', 'Liderança e adoração', 37)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q037_OPT1', 'Q037', 'Os hinos ensinam teologia; devo usá-los para formar doutrinariamente.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q037_OPT2', 'Q037', 'A música que cantamos precisa ser escolhida com sabedoria, fidelidade bíblica.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q037_OPT3', 'Q037', 'Os hinos são parte do discipulado — formam o coração das crianças.', 'DISCIPULADO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q037_OPT4', 'Q037', 'Um bom hino pode abrir o coração de um não-crente para o evangelho.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q038', 'Como você se sente em relação à adoração congregacional?', 'Liderança e adoração', 38)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q038_OPT1', 'Q038', 'Precisa estar fundamentada na Palavra.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q038_OPT2', 'Q038', 'Deve ser genuína, espontânea e que conduza pessoas à presença de Deus.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q038_OPT3', 'Q038', 'É oportunidade de interceder pela congregação em um momento solene.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q038_OPT4', 'Q038', 'É o reflexo da identidade e solidez doutrinária da nossa igreja.', 'LIDERANCA', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q039', 'O louvor da congregação é um momento que você enxerga como:', 'Liderança e adoração', 39)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q039_OPT1', 'Q039', 'Tempo de aprender — ensino verdades através dos hinos e cânticos.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q039_OPT2', 'Q039', 'Tempo de servir — ministro a Deus e conduzo a congregação.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q039_OPT3', 'Q039', 'Tempo de formar — cada cântico é uma lição que fica no coração.', 'DISCIPULADO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q039_OPT4', 'Q039', 'Tempo de alcançar — os visitantes experienciam a presença de Deus.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q040', 'Qual impacto gostaria de deixar através da música na sua congregação?', 'Liderança e adoração', 40)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q040_OPT1', 'Q040', 'Uma congregação que canta e compreende verdades teológicas profundas.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q040_OPT2', 'Q040', 'Uma comunidade que adora com reverência, beleza e fidelidade.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q040_OPT3', 'Q040', 'Discípulos cujo coração foi formado pela mensagem dos hinos desde cedo.', 'DISCIPULADO', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q040_OPT4', 'Q040', 'Visitantes que sentem a presença real de Deus na adoração.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q041', 'Um amigo está passando por uma crise profunda. Qual é a sua primeira reação?', 'Cuidado pastoral', 41)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q041_OPT1', 'Q041', 'Busco versículos e palavras que possam iluminar a situação.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q041_OPT2', 'Q041', 'Oro fervorosamente por ele.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q041_OPT3', 'Q041', 'Vou até ele pessoalmente para ouvir e estar presente.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q041_OPT4', 'Q041', 'Busco conectá-lo com recursos e pessoas que podem ajudar.', 'LIDERANCA', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q042', 'Como você reage quando alguém na sua igreja está sofrendo?', 'Cuidado pastoral', 42)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q042_OPT1', 'Q042', 'Vejo como oportunidade para compartilhar a Palavra que traz consolo.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q042_OPT2', 'Q042', 'Vejo como chamado para estar presente, ouvir e acompanhar a jornada.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q042_OPT3', 'Q042', 'Organizo o apoio da congregação — comida, visitas, recursos práticos.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q042_OPT4', 'Q042', 'Intercedo intensamente, sabendo que a verdadeira cura vem de Deus.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q043', 'Como você prefere impactar a vida das pessoas?', 'Cuidado pastoral', 43)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q043_OPT1', 'Q043', 'Transmitindo sabedoria e revelação por meio da Palavra.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q043_OPT2', 'Q043', 'Criando experiências de adoração que tocam o coração.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q043_OPT3', 'Q043', 'Liderando equipes e multiplicando líderes.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q043_OPT4', 'Q043', 'Estando presente nos momentos de dor e necessidade.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q044', 'O que te faz sentir que você está no lugar certo servindo a Deus?', 'Cuidado pastoral', 44)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q044_OPT1', 'Q044', 'Quando vejo alguém ter entendimento mais profundo da Bíblia.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q044_OPT2', 'Q044', 'Quando a adoração rompe barreiras e toca o coração.', 'LOUVOR', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q044_OPT3', 'Q044', 'Quando alguém se sente amado, acolhido e cuidado.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q044_OPT4', 'Q044', 'Quando alguém aceita Jesus ou decide voltar a Deus.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q045', 'Como você lida com crises espirituais dentro da comunidade?', 'Cuidado pastoral', 45)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q045_OPT1', 'Q045', 'Busco ministrar a Palavra como base para restauração.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q045_OPT2', 'Q045', 'Oro intensamente e busco discernimento espiritual.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q045_OPT3', 'Q045', 'Ofereço suporte emocional e prático às famílias envolvidas.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q045_OPT4', 'Q045', 'Ajudo a coordenar esforços e tomar decisões estratégicas.', 'LIDERANCA', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q046', 'Qual legado você deseja deixar como servo na sua igreja?', 'Legado e testemunho', 46)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q046_OPT1', 'Q046', 'Uma congregação solidamente formada na Palavra.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q046_OPT2', 'Q046', 'Discípulos que fazem discípulos — cadeia de multiplicação.', 'DISCIPULADO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q046_OPT3', 'Q046', 'Uma igreja conhecida no bairro por cuidar dos vulneráveis.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q046_OPT4', 'Q046', 'Igrejas plantadas e missões enviadas.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q047', 'Quando você compartilha sua fé, como isso geralmente acontece?', 'Legado e testemunho', 47)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q047_OPT1', 'Q047', 'Explico textos bíblicos e aprofundo o entendimento de outros.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q047_OPT2', 'Q047', 'Abro o coração e falo com paixão sobre o que Deus fez por mim.', 'EVANGELISMO', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q047_OPT3', 'Q047', 'Sirvo primeiro — as ações falam mais alto que palavras.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q047_OPT4', 'Q047', 'Oro com as pessoas.', 'PASTORAL', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q048', 'Como você se sente quando precisa falar diante de muitas pessoas?', 'Legado e testemunho', 48)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q048_OPT1', 'Q048', 'Sinto um ardor por dentro — é onde me sinto chamado.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q048_OPT2', 'Q048', 'Fico confortável, especialmente quando é para liderar um momento.', 'LIDERANCA', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q048_OPT3', 'Q048', 'Prefiro o contato pessoal e individual.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q048_OPT4', 'Q048', 'Fico animado, especialmente quando posso contar histórias de salvação.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q049', 'Como você reage diante de alguém que não crê ou questiona a fé?', 'Legado e testemunho', 49)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q049_OPT1', 'Q049', 'Sinto vontade de explicar a Palavra e dialogar sobre a Bíblia.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q049_OPT2', 'Q049', 'Oro por ele.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q049_OPT3', 'Q049', 'Demonstro o amor de Deus por meio de ações concretas.', 'PASTORAL', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q049_OPT4', 'Q049', 'Sinto urgência em compartilhar o evangelho imediatamente.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_perguntas (id, texto_pergunta, bloco_tema, ordem)
values ('Q050', 'O que as pessoas mais costumam reconhecer em você?', 'Legado e testemunho', 50)
on conflict (id) do update set
  texto_pergunta = excluded.texto_pergunta,
  bloco_tema = excluded.bloco_tema,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q050_OPT1', 'Q050', 'Que sou uma pessoa de estudo, reflexão e conhecimento.', 'PREGACAO', 1)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q050_OPT2', 'Q050', 'Que tenho um coração sensível e compassivo.', 'PASTORAL', 2)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q050_OPT3', 'Q050', 'Que sou um líder natural, organizado e visionário.', 'LIDERANCA', 3)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

insert into public.ministerial_opcoes (id, pergunta_id, texto_opcao, perfil_pontuado, ordem)
values ('Q050_OPT4', 'Q050', 'Que sou ousado e não tenho vergonha de falar de Jesus.', 'EVANGELISMO', 4)
on conflict (id) do update set
  texto_opcao = excluded.texto_opcao,
  perfil_pontuado = excluded.perfil_pontuado,
  ordem = excluded.ordem;

