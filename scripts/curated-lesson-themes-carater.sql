-- Temas do eixo carater enviados no seed (99 linhas). Reexecutar substitui só esta categoria.
-- Aplica: npx supabase db query --linked -f scripts/curated-lesson-themes-carater.sql

delete from public.curated_lesson_themes
 where category = 'carater';

insert into public.curated_lesson_themes (category, title, bible_passage, core_lesson, activity_suggestion) values
('carater', 'A Palavra que Vale mais que Ouro', 'Provérbios 12:22', 'Os lábios mentirosos são abominação ao Senhor, mas os que agem com verdade são o Seu deleite.', 'O Jogo da Verdade: Situar escolhas do cotidiano e votar qual é a atitude honesta e correta a tomar.'),
('carater', 'O Poder do Perdão', 'Colossenses 3:13', 'Suportai-vos uns aos outros e perdoai-vos mutuamente, assim como o Senhor vos perdoou.', 'O Abraço do Perdão: Reconciliar duplas que brincam de fazer as pazes com sorrisos e um abraço.'),
('carater', 'A Generosidade que Transborda', 'Provérbios 22:9', 'Quem tem o olhar generoso é abençoado, porque reparte o seu pão com o necessitado.', 'Partilha de Lanches: Simular a partilha de um lanche ou fruta, entendendo a alegria de dividir com o colega.'),
('carater', 'A Mansidão que Desarma a Raiva', 'Provérbios 15:1', 'A resposta branda desvia o furor, mas a palavra dura suscita a ira.', 'O Pote de Palavras Doces: Escrever palavras gentis em papéis coloridos e colocar em um pote para sortear.'),
('carater', 'A Paciente Espera', 'Salmos 37:7', 'Descansa no Senhor e espera nele; não te indignes por causa daquele que prospera em seu caminho.', 'Respiração da Calma: Praticar inspirar contando até três e expirar devagar para exercitar a paciência.'),
('carater', 'O Domínio Próprio Diário', 'Provérbios 25:28', 'Como cidade derribada, que não tem muros, assim é o hombre que não pode dominar seu espírito.', 'Estátua de Cristal: Brincar de estátua onde todos devem ficar bem firmes e autocontrolados.'),
('carater', 'A Humildade que Eleva', 'Tiago 4:10', 'Humilhai-vos perante o Senhor, e ele vos exaltará.', 'Lavando as Mãos (Simbólico): Simular o ato de serviço lavando simbolicamente as mãos com carinho em uma bacia com água.'),
('carater', 'A Diligência no Fazer o Bem', 'Colossenses 3:23', 'Tudo quanto fizerdes, fazei-o de todo o coração, como para o Senhor e não para os homens.', 'A Tarefa Caprichada: Organizar os materiais da sala com capricho, mostrando zelo pelo que fazemos.'),
('carater', 'A Gratidão em Todo Tempo', '1 Tessalonicenses 5:18', 'Em tudo dai graças, porque esta é a vontade de Deus em Cristo Jesus para convosco.', 'A Ciranda da Gratidão: Cada criança diz rapidamente uma coisa pela qual agradece a Deus hoje em roda.'),
('carater', 'A Honestidade nas Pequenas Coisas', 'Lucas 16:10', 'Quem é fiel no pouco, também é fiel no mucho; quem é injusto no pouco, também é injusto no mucho.', 'Contando Moedinhas: Brincadeira de organizar objetos em fileiras corretas para treinar o capricho e a integridade.'),
('carater', 'A Bondade que Surpreende', 'Gálatas 6:10', 'Por isso, enquanto temos oportunidade, façamos o bem a todos, mas principalmente aos da família da fé.', 'Cartão Surpresa: Desenhar um recado carinhoso para entregar a um funcionário da igreja ou familiar.'),
('carater', 'A Coragem de Ser Íntegro', 'Provérbios 11:3', 'A integridade dos retos os guia, mas a perversidade dos desleais os destrói.', 'Caminho Reto: Desenhar uma linha reta no chão e caminhar equilibrando um livrinho na cabeça.'),
('carater', 'A Justiça e a Equidade', 'Miqueias 6:8', 'Ele te declarou, ó homem, o que é bom; e que é o que o Senhor pede de ti: que pratiques a justiça.', 'Dividindo o Tesouro: Distribuir igualmente doces ou blocos entre grupos, exercitando a justiça e a equidade.'),
('carater', 'A Paciência com os Defeitos dos Outros', 'Efésios 4:2', 'Com toda a humildade e mansidão, com longanimidade, suportando-vos uns aos outros em amor.', 'O Abraço Coletivo: Fazer uma roda e dar um abraço coletivo, celebrando as diferenças e exercitando a paciência.'),
('carater', 'A Responsabilidade com o que é dos Outros', 'Êxodo 22:10', 'Se alguém der ao seu próximo um animal para guardar, e este morrer...', 'O Jogo do Cuidado: Cuidar de um objeto frágil emprestado por um colega por cinco minutos.'),
('carater', 'A Lealdade na Amizade', 'Provérbios 17:17', 'Em todo tempo ama o amigo, e para a angústia nasce o irmão.', 'Rede de Lã: Passar umnovelo de lã entre as crianças para formar uma teia de amizade leal e forte.'),
('carater', 'A Pureza nas Intenções', 'Salmos 51:10', 'Cria em mim, ó Deus, um coração puro, e renova dentro de mim um espírito inabalável.', 'Água Limpa no Copo: Jogar água suja fora e encher o copo com água limpa, ilustrando a intenção pura.'),
('carater', 'A Obedecência Pronta e Alegre', 'Efésios 6:1', 'Filhos, obedecei a vossos pais no Senhor, pois isto é justo.', 'O Eco da Obediência: O professor diz uma regra boa e as crianças repetem em coro obedecendo com alegria.'),
('carater', 'A Contentamento sem Reclamação', 'Filipenses 4:11', 'Aprendi a contentar-me com o que tenho, seja qual for a minha situação.', 'O Pote do Contente: Listar coisas simples que nos trazem alegria sem precisar de bens materiais.'),
('carater', 'A Hospitalidade com Alegria', 'Romanos 12:13', 'Praticai a hospitalidade com alegria, repartindo o espaço e o afeto com quem chega.', 'Cadeira do Acolhimento: Convidar um colega para sentar no centro e receber boas-vindas calorosas.'),
('carater', 'O Cuidado com a Língua', 'Tiago 3:5', 'Assim também a língua é um pequeno membro, e se gacta de grandes coisas. Vede quão grande bosque um pequeno fogo incendeia.', 'O Tubo de Pasta de Dente: Tentar colocar o creme dental de volta no tubo após espremê-lo, mostrando que palavras ditas não voltam.'),
('carater', 'A Perseverança diante dos Obstáculos', 'Gálatas 6:9', 'E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido.', 'Torre de Blocos: Montar uma torre alta e reconstruí-la caso caia, aprendendo a persistir.'),
('carater', 'A Misericórdia com o Errado', 'Lucas 6:36', 'Sede, pois, misericordiosos, assim como também vosso Pai é misericordioso.', 'O Abraço do Recomeço: Perdoar uma brincadeira boba e dar um abraço de paz no colega.'),
('carater', 'A Modéstia e a Simplicidade', '1 Pedro 3:3-4', 'O adorno deles não seja o exterior... mas o homem encoberto no coração, com incorruptível traço de espírito manso e quieto.', 'Desfile de Atitudes: Simular passos elegantes de bondade e mansidão pela sala.'),
('carater', 'A Fuga da Fofoca', 'Provérbios 16:28', 'O homem perverso instiga a contenda, e o difamador separa os maiores amigos.', 'Telefone sem Fio Cuidadoso: Passar uma mensagem de elogio real e construtiva na rodinha.'),
('carater', 'O Trabalho em Equipe Harmonioso', 'Eclesiastes 4:9', 'Melhor é serem dois do que um, porque têm melhor paga do seu trabalho.', 'Caminhada em Duplas Amarradas: Caminhar levemente com os pés levemente próximos em duplas.'),
('carater', 'A Resposta Sábia', 'Provérbios 15:23', 'O homem se alegra com a resposta da sua boca, e a palavra a seu tempo, quão boa é!', 'A Caixa de Respostas: Retirar perguntas de papel e treinar respostas gentis e bondosas.'),
('carater', 'A Pontualidade e o Zelo pelo Tempo', 'Efésios 5:16', 'Remindo o tempo, porquanto os dias são maus.', 'O Relógio Vivo: Brincar com os ponteiros do relógio usando os braços para entender a importância do compromisso.'),
('carater', 'A Coragem de Pedir Perdão', 'Tiago 5:16', 'Confessai as vossas culpas uns aos outros, e orai uns pelos outros, para que sareis.', 'O Cartão de Desculpas: Escrever um bilhete simbólico de "Me desculpe" para alguém querido.'),
('carater', 'A Generosidade com o Tempo', 'Gálatas 5:13', 'Porque vós, irmãos, fostes chamados à liberdade. Não useis da liberdade para dar ocasião à carne, mas sede servos uns dos outros pelo amor.', 'O Favor do Dia: Oferecer ajuda voluntária para organizar os livros da sala.'),
('carater', 'A Pureza nos Pensamentos', 'Filipenses 4:8', 'Quanto ao mais, irmãos, tudo o que é verdadeiro, tudo o que é honesto, tudo o que é justo...', 'Caça às Palavras Boas: Encontrar cartões espalhados com pensamentos edificantes.'),
('carater', 'A Lealdade às Leis e Regras', 'Romanos 13:1', 'Toda alma esteja sujeita às autoridades superiores; porque não há autoridade que não venha de Deus.', 'O Jogo das Placas: Brincar de seguir regras de trânsito simuladas na sala para treinar a obediência civil.'),
('carater', 'A Moderação em Tudo', 'Provérbios 25:16', 'Achaste mel? Come o que te basta, para que não te fartes dele e o vomites.', 'O Equilíbrio do Copo: Encher um copo d’água exatamente até a borda sem derramar.'),
('carater', 'A Entrega da Ansiedade', '1 Pedro 5:7', 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.', 'A Caixa de Preocupações: Escrever anotações de medos num papel e deixá-las numa caixa.'),
('carater', 'O Respeito aos Idosos e Pais', 'Levítico 19:32', 'Diante das carras levantate-te, e honra a face do velho, e teme ao teu Deus.', 'Mensagem aos Avós: Desenhar um cartão especial para entregar aos avós ou pais em casa.'),
('carater', 'A Justiça com o Oprimido', 'Isaías 1:17', 'Aprendei a fazer o bem; busque a justiça, acudida o oprimido, fazei justiça ao órfão, pleiteai a causa da viúva.', 'A Ponte de Ajuda: Construir uma ponte de blocos para ajudar bonequinhos a atravessarem.'),
('carater', 'O Cultivo da Paz', 'Romanos 12:18', 'Se for possível, quanto estiver em vós, tende paz com todos os homens.', 'A Corrente da Paz: Dar as mãos em roda e transmitir um aperto leve de mão sucessivamente.'),
('carater', 'A Alegria na Vitória do Irmão', 'Romanos 12:15', 'Alegrai-vos com os que se alegram; chorai com os que choram.', 'Aplauso Coletivo: Bater palmas com entusiasmo para o colega que ganhou um pequeno desafio na aula.'),
('carater', 'A Fuga da Cobiça', 'Êxodo 20:17', 'Não cobiçarás a casa do teu próximo... nem coisa alguma que seja do teu próximo.', 'O Jogo do Contente com o que Tenho: Trocar elogios sobre o que cada um tem de legal sem focar em bens.'),
('carater', 'A Serenidade nas Crises', 'Provérbios 17:22', 'O coração alegre serve de bom remédio, mas o espírito abatido seca os ossos.', 'Sorriso no Rosto: Fazer caretas engraçadas e depois sorrir, lembrando que a alegria fortalece o ânimo.'),
('carater', 'A Hospitalidade com Estrangeiros', 'Levítico 19:34', 'O estrangeiro que habitar convosco será como o natural entre vós; amá-lo-ás como a ti mesmo.', 'Cadeira do Novo Amigo: Cumprimentar efusivamente quem é novo na turma.'),
('carater', 'A Franqueza com Amor', 'Efésios 4:15', 'Antes, seguindo a verdade em amor, cresçamos em tudo naquele que é a cabeça, Cristo.', 'Conversa em Duplas: Praticar falar a verdade com carinho e tom de voz suave.'),
('carater', 'A Prontidão para Servir', 'Mateus 20:28', 'Bem assim o Filho do Homem não veio para ser servido, mas para servir, e para dar a sua vida em resgate por muitos.', 'O Servidor Secreto: Cada criança tira o nome de um colega para ajudar discretamente durante a aula.'),
('carater', 'A Justiça nos Negócios e Brincadeiras', 'Provérbios 16:11', 'O peso e a balança justa são do Senhor; obra sua são todas as pedras do saco.', 'Brincadeira Justa: Revisar regras de um jogo para garantir que todos tenham chances iguais.'),
('carater', 'A Paciência no Trânsito e nas Filas', 'Eclesiastes 7:8', 'Melhor é o fim das coisas do que o princípio delas; melhor é o paciente do que o arrogante.', 'A Fila Perfeita: Organizar uma fila indiana calma e harmoniosa para sair da sala.'),
('carater', 'A Gratidão aos Líderes', '1 Tessalonicenses 5:12-13', 'E rogamo-vos, irmãos, que reconheçais os que trabalham entre vós... e que os estimeis muito em amor.', 'Cartão de Agradecimento aos Professores: Fazer um desenho coletivo para os líderes da turma.'),
('carater', 'A Discrição no Fazer o Bem', 'Mateus 6:3', 'Mas, quando tu deres esmola, não saiba a tua mão esquerda o que faz a tua direita.', 'A Ação Secreta: Fazer uma boa ação sem contar para ninguém até o final do dia.'),
('carater', 'A Firmeza contra o Mal', 'Salmos 97:10', 'Vós que amais ao Senhor, odiai o mal; ele guarda as almas dos seus santos.', 'O Escudo da Firmeza: Ficar em posição firme de braços cruzados com sorrisos de coragem contra as más escolhas.'),
('carater', 'A Benevolência com os Animais', 'Provérbios 12:10', 'O justo atenta para a vida dos seus animais, mas as entranhas dos ímpios são cruéis.', 'História de Cuidado: Conversar sobre como cuidar bem de pets e da natureza ao nosso redor.'),
('carater', 'A Pureza de Expressão', 'Efésios 4:29', 'Não saia da vossa boca nenhuma palavra torpe, mas só a que seja boa para edificação.', 'O Pote de Palavras Edificantes: Retirar bilhetes com adjetivos bons para falar aos colegas.'),
('carater', 'A Sóbria Moderação', 'Tito 2:12', 'Ensinando-nos que, renunciando à impiedade e às concupiscências mundanas, vivamos neste presente século sóbria, justa e piamente.', 'Postura Firme: Exercitar a postura corporal equilibrada e atenta.'),
('carater', 'O Zelo pela Casa de Deus', 'Salmos 27:4', 'Uma coisa pedi ao Senhor, e a buscarei: que possa habitar na casa do Senhor todos os dias da minha vida.', 'Organização do Espaço: Arrumar as cadeiras e materiais da sala com capricho e respeito.'),
('carater', 'A Mansidão na Correção', 'Provérbios 15:5', 'O insensato despreza a correção de seu pai, mas o que atende à repreensão prudente se adorna.', 'O Ouvido Atento: Brincar de ouvir instruções com atenção e sem reclamar de correções.'),
('carater', 'A Alegria na Lei do Senhor', 'Salmos 1:2', 'Antes tem o seu prazer na lei do Senhor, e na sua lei medita de dia e de noite.', 'Manuseio da Bíblia: Localizar versículos rapidamente com alegria e entusiasmo.'),
('carater', 'A Perseverança na Oração', 'Lucas 18:1', 'E contou-lhes também uma parábola sobre o dever de orar sempre, e nunca desfalecer.', 'Cadeia de Orações: Cada criança faz uma preces rapidinha em sequência pela turma.'),
('carater', 'A Modéstia no Vestir e Agir', '1 Timóteo 2:9', 'Que do mesmo modo as mulheres se ataviem em traje honesto, com pudor e modéstia.', 'Desfile de Boas Maneiras: Caminhar pela sala demonstrando cortesia e respeito.'),
('carater', 'A Recompensa da Integridade', 'Provérbios 20:7', 'O justo anda na sua integridade; bem-aventurados serão os seus filhos depois dele.', 'A Trilha da Honra: Seguir um caminho desenhado no chão cheio de desafios de caráter.'),
('carater', 'A Cortesia com Todos', '1 Pedro 2:17', 'Honrai a todos. Amai os irmãos. Temei a Deus. Honrai ao rei.', 'Cumprimentos Educados: Praticar dizer "Por favor", "Com licença" e "Muito obrigado".'),
('carater', 'A Prontidão para Perdoar Imediatamente', 'Efésios 4:26', 'Irai-vos, e não pequeis; não se ponha o sol sobre a vossa ira.', 'O Abraço Rápido: Fazer as pazes imediatamente após qualquer pequeno desentendimento na dinâmica.'),
('carater', 'A Abstenção de Julgamentos Precipitado', 'Mateus 7:1', 'Não julgueis, para que não sejais julgados.', 'O Jogo da Empatia: Tentar entender o lado do colega antes de emitir qualquer opinião.'),
('carater', 'A Fuga da Preguiça', 'Provérbios 6:6', 'Vai ter com a formiga, ó preguiçoso; olha para os seus caminhos, e sábia.', 'Dança da Formiguinha: Brincadeira dinâmica de movimentar-se com agilidade e disposição.'),
('carater', 'A Confiança Mútua', 'Provérbios 3:5', 'Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento.', 'Caminhada Cega com Guia: Caminhar de olhos fechados segurando no ombro do colega com total confiança.'),
('carater', 'A Justiça na Distribuição de Tarefas', 'Deuteronômio 16:20', 'A justiça, a justiça seguirás, para que vivas e possuas a terra que o Senhor teu Deus te dá.', 'Sorteio Justo: Organizar tarefas da sala através de um sorteio transparente.'),
('carater', 'A Mansidão diante da Provocação', '1 Pedro 3:9', 'Não pagando mal com mal, ou injúria por injúria; antes, pelo contrário, bendizendo.', 'O Escudo do Bem: Responder a uma crítica simulada com um elogio ou sorriso.'),
('carater', 'A Paciência no Estudo da Palavra', 'Salmos 119:18', 'Abre tu os meus olhos para que veja as maravilhas da tua lei.', 'Caça aos Detalhes Bíblicos: Investigar histórias na Bíblia com lupas de papel.'),
('carater', 'A Generosidade com Elogios', 'Provérbios 16:24', 'As palavras agradáveis são como favo de mel, doçura para a alma e saúde para os ossos.', 'Chuva de Elogios: Cada criança recebe um papel para os colegas escreverem qualidades dela.'),
('carater', 'A Retidão nos Acordos', 'Salmos 15:4', 'Aquele a quem os olhos do rejeitado é desprezado, mas honra os que temem ao Senhor; aquele que jura com dano seu, e não muda.', 'O Aperto de Mãos de Palavra: Cumprimentar o colega firmando um compromisso de bondade.'),
('carater', 'A Pureza de Olhar', 'Mateus 6:22', 'A candeia do corpo são os olhos; de sorte que, se os teus olhos forem bons, todo o teu corpo terá luz.', 'Binóculos da Bondade: Fazer binóculos com rolinhos de papel higiênico para procurar coisas boas ao redor.'),
('carater', 'A Humildade no Ganhar e Perder', 'Filipenses 2:3', 'Nada façais por contenda ou por vanglória, mas por humildade; considere cada um os outros superiores a si mesmo.', 'Jogo de Tabuleiro Coletivo: Brincar de um jogo onde todos ganham juntos se ajudando.'),
('carater', 'A Prudência nas Promessas', 'Eclesiastes 5:5', 'Melhor é que não faças votos do que que faças votos e não os cumpras.', 'Promessa de Amizade: Conversar sobre cumprirmos o que prometemos aos amigos e pais.'),
('carater', 'A Alegria na Comunhão', 'Salmos 133:1', 'Oh! Quão bom e quão suave é que os irmãos vivam em união!', 'Roda de Abraços: Dar as mãos e cantar uma música alegre de união.'),
('carater', 'A Diligência nos Deveres', 'Romanos 12:11', 'No zelo, não sejais preguiçosos; ecônomos no espírito, servindo ao Senhor.', 'Organização Relâmpago: Guardar todos os materiais da sala em tempo recorde com alegria.'),
('carater', 'A Mansidão no Tratar os Menores', 'Mateus 18:10', 'Vede, não desprezeis a um destes pequeninos, porque eu vos digo que os seus anjos nos céus...', 'Cuidado com os Menores: Ensinar os maiores a ajudarem os novatos ou crianças menores.'),
('carater', 'A Paciência nas Enfermidades', 'Tiago 5:14', 'Está alguém entre vós doente? Chame os presbíteros da igreja, e orem sobre ele...', 'Oração pelos Doentes: Escrever o nome de pessoas doentes em post-its para interceder por elas.'),
('carater', 'A Fuga da Vaidade', 'Jeremias 9:23', 'Não se glorie o sábio na sua sabedoria, nem se glorie o forte na sua força...', 'Espelho do Coração: Olhar no espelho e lembrar que o valor vem de dentro, do caráter em Cristo.'),
('carater', 'A Coragem de Testemunhar a Verdade', 'Atos 4:20', 'Porque não podemos deixar de falar do que temos visto e ouvido.', 'Testemunho em 10 Segundos: Contar rapidamente uma boa atitude que teve na escola.'),
('carater', 'A Generosidade com os Recursos', 'Atos 20:35', 'Mais bem-aventurada coisa é dar do que receber.', 'Doação Simbólica: Trazer um brinquedo ou alimento não perecível para doação em uma campanha da igreja.'),
('carater', 'A Retidão de Consciência', 'Atos 24:16', 'E por isso exrcito-me em ter sempre uma consciência sem ofensa tanto para com Deus como para com os homens.', 'O Exame do Coração: Momento de silêncio para refletir sobre as atitudes do dia.'),
('carater', 'A Mansidão na Resposta a Críticas', 'Provérbios 15:1', 'A resposta branda desvia o furor, mas a palavra dura suscita a ira.', 'Dinâmica do Tom de Voz: Praticar falar sussurrado e calmo quando houver desentendimento.'),
('carater', 'A Paciência no Esperar em Deus', 'Salmos 40:1', 'Esperei com paciência no Senhor, e ele se inclinou para mim, e ouviu o meu clamor.', 'Círculo de Silêncio: Ouvir um som de alarme tocar após um período de calmaria e oração.'),
('carater', 'A Pureza de Lábios', 'Salmos 19:14', 'Sejam aceitáveis as palavras da minha boca e a meditação do meu coração perante a tua face.', 'O Filtro das Palavras: Usar um coador de papel de mentirinha para filtrar palavras ruins antes de falar.'),
('carater', 'A Humildade que Admite Erros', 'Provérbios 28:13', 'O que encobre as suas transgressões nunca prosperará, mas o que as confessa e deixa, alcançará misericórdia.', 'O Papel Amassado e Alisado: Amassar um erro e depois tentar desamassar para pedir perdão.'),
('carater', 'A Justiça com os Empregados e Colegas', 'Colossenses 4:1', 'Vós, senhores, fazei o que é justo e equitativo a vossos servos, sabendo que também tendes um Senhor nos céus.', 'Trabalho Justo: Dividir tarefas de grupo de forma justa entre todos os participantes.'),
('carater', 'A Paz Familiar', 'Efésios 6:4', 'E vós, pais, não provoqueis a vira a vossos filhos, mas criai-os na doutrina e admoestação do Senhor.', 'Abraço nos Pais: Enviar um abraço especial gravado ou falado para os pais ao chegar em casa.'),
('carater', 'A Perseverança na Corrida Cristã', 'Hebreus 12:1', 'Portanto nós também, pois que estamos rodeados de uma tão grande nuvem de testemunhas, deixemos todo o peso...', 'Corrida de Obstáculos Leve: Desviar de cones leves na sala sem derrubá-los, simbolizando foco.'),
('carater', 'A Generosidade no Perdão Sem Limites', 'Mateus 18:22', 'Jesus lhe disse: Não te digo até sete vezes, mas até setenta vezes sete.', 'Contando Até Setenta: Brincadeira de multiplicar sorrisos e abraços de perdão na turma.'),
('carater', 'A Retidão nas Intenções Secretas', 'Provérbios 21:2', 'Todo o caminho do homem é reto aos seus olhos, mas o Senhor pesa os corações.', 'A Balança do Coração: Desenhar uma balança de papel para pesar atitudes boas e más.'),
('carater', 'A Mansidão na Liderança', 'Mateus 11:29', 'Tomai sobre vós o meu jugo, e aprendei de mim, que sou manso e humilde de coração; e achareis descanso.', 'Liderança Servidora: Um aluno lidera os outros a ajudarem a organizar a sala de aula.'),
('carater', 'A Paciência nas Tribulações', 'Romanos 12:12', 'Alegrai-vos na esperança, sede pacientes na tribulação, orai na perseverança.', 'Mural de Esperança: Fixar post-its coloridos com pedidos de força e paciência.'),
('carater', 'A Pureza de Ações', '1 João 3:18', 'Meus filhinhos, não amemos de palavra, nem de língua, mas por obra e em verdade.', 'A Mão que Ajuda: Carimbar as mãos em papel com tinta lavável para firmar o compromisso de fazer o bem.'),
('carater', 'A Humildade no Receber Elogios', 'Provérbios 27:2', 'Louve-te o estranho e não a tua boca; o alheio, e não os teus lábios.', 'O Elogio Cruzado: Cada criança recebe um elogio sincero do colega ao lado e agradece com modéstia.'),
('carater', 'A Justiça na Defesa do Fraco', 'Provérbios 31:8-9', 'Abre a tua boca a favor do mudo, pela causa de todos os desamparados.', 'Defendendo o Colega: Encenar uma situação onde alguém protege o colega que sofreu bullying com amor.'),
('carater', 'A Paz que Excede o Entendimento', 'Filipenses 4:7', 'E a paz de Deus, que excede todo o entendimento, guardará os vossos corações e os vossos sentimentos em Cristo Jesus.', 'Respiração de Paz: Fechar os olhos e respirar fundo sentindo a paz de Deus na sala.'),
('carater', 'A Perseverança no Fazer o Bem', 'Gálatas 6:9', 'E não nos cansemos de fazer o bem, porque a seu tempo ceifaremos, se não houvermos desfalecido.', 'Sementinha da Constância: Regar o vasinho de feijão na sala para ver o crescimento contínuo.'),
('carater', 'A Generosidade de Compartilhar Dons', '1 Pedro 4:10', 'Cada um administre aos outros o dom como o recebeu, como bons despenseiros da multiforme graça de Deus.', 'A Apresentação de Dons: Cada criança mostra um talento simples (cantar, desenhar, sorrir) para abençoar a turma.'),
('carater', 'A Retidão nas Promessas Cumpridas', 'Números 30:2', 'Quando um homem fizer voto ao Senhor, ou fizer juramento ligando a sua alma com obrigação, não quebrará a sua palavra.', 'O Juramento da Bondade: Prometer em roda cuidar uns dos outros durante a semana.'),
('carater', 'A Mansidão no Responder a Ofensas', 'Provérbios 15:1', 'A resposta branda desvia o furor, mas a palavra dura suscita a ira.', 'Teatro de Fantoches: Encenar fantoches resolvendo um conflito com mansidão e palavras doces.'),
('carater', 'A Paciência no Aguardar a Resposta', 'Salmos 27:14', 'Espera no Senhor, anima-te, e ele fortalecerá o teu coração; espera, pois, no Senhor.', 'O Alarme da Paciência: Esperar trinta segundos em silêncio absoluto antes de começar uma atividade.'),
('carater', 'A Pureza de Pensamentos e Olhares', 'Salmos 101:3', 'Não porei coisa injusta diante dos meus olhos; aborreço a obra dos desviados; a nada me apegará.', 'O Óculos da Pureza: Fazer um óculos de papel colorido para focar apenas no que é bom e puro.');

do $$
declare
  n integer;
  incompletos integer;
begin
  select count(*) into n
    from public.curated_lesson_themes
   where category = 'carater';

  select count(*) into incompletos
    from public.curated_lesson_themes
   where category = 'carater'
     and (
       length(btrim(title)) < 2
       or length(btrim(bible_passage)) < 1
       or length(btrim(core_lesson)) < 1
       or length(btrim(activity_suggestion)) < 1
     );

  if incompletos <> 0 or n <> 99 then
    raise exception 'Seed de carater inválido: % temas, % incompletos.', n, incompletos;
  end if;
end;
$$;
