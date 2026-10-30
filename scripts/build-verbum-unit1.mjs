import { writeFileSync } from 'node:fs';

function q(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonb(value) {
  return `${q(JSON.stringify(value))}::jsonb`;
}

function rot(words) {
  return words.length < 2 ? [...words] : [...words.slice(1), words[0]];
}

function match(pairs, lemma, ref, en, pt) {
  return {
    type: 'MATCH_PAIRS',
    prompt: 'Ligue cada palavra ao sentido.',
    ref,
    en,
    pt,
    payload: { pairs, lemma },
  };
}

function fill(sentence, options, answer, lemma, ref, en, pt) {
  return {
    type: 'FILL_BLANK',
    prompt: 'Complete o versículo.',
    ref,
    en,
    pt,
    payload: { sentence, options, answer, lemma },
  };
}

function order(answer, lemma, ref, en, pt) {
  return {
    type: 'ORDER_WORDS',
    prompt: 'Monte a frase na ordem do versículo.',
    ref,
    en,
    pt,
    payload: { shuffled: rot(answer), answer, lemma },
  };
}

function pack(ref, en, pt, pairsA, pairsB, fills, orders) {
  return [
    match(pairsA, pairsA[0].en, ref, en, pt),
    fill(fills[0].sentence, fills[0].options, fills[0].answer, fills[0].lemma, ref, en, pt),
    order(orders[0].answer, orders[0].lemma, ref, en, pt),
    fill(fills[1].sentence, fills[1].options, fills[1].answer, fills[1].lemma, ref, en, pt),
    match(pairsB, pairsB[0].en, ref, en, pt),
    order(orders[1].answer, orders[1].lemma, ref, en, pt),
    fill(fills[2].sentence, fills[2].options, fills[2].answer, fills[2].lemma, ref, en, pt),
    order(orders[2].answer, orders[2].lemma, ref, en, pt),
  ];
}

const pair = (en, pt) => ({ en, pt });

const units = [
  {
    book: 1,
    sectionOrder: 1,
    cefr: 'A1',
    sectionTitle: 'Seção 1: O Princípio — Nível A1',
    sectionDescription: 'A criação contada em inglês, do princípio ao descanso.',
    color: '#10b981',
    unitTitle: 'Unidade 1: The Voice of Creation (Gênesis 1-2)',
    theme: 'A palavra que cria, separa, anima, faz à imagem e descansa',
    nodes: [
      {
        title: 'Let There Be Light',
        type: 'LESSON',
        lessons: [
          {
            title: 'Beginning and Created',
            summary: 'No princípio Deus cria. Beginning e created abrem a história.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:1',
              'In the beginning God created the heavens and the earth.',
              'No princípio criou Deus os céus e a terra.',
              [pair('Beginning', 'Princípio'), pair('Created', 'Criou'), pair('Heavens', 'Céus'), pair('Earth', 'Terra')],
              [pair('God', 'Deus'), pair('Said', 'Disse'), pair('Light', 'Luz'), pair('Good', 'Bom')],
              [
                { sentence: 'In the _____ God created the heavens and the earth.', options: ['beginning', 'end', 'middle'], answer: 'beginning', lemma: 'beginning' },
                { sentence: 'God _____ the heavens and the earth.', options: ['created', 'hid', 'bought'], answer: 'created', lemma: 'created' },
                { sentence: 'And God saw that it was _____.', options: ['good', 'bad', 'void'], answer: 'good', lemma: 'good' },
              ],
              [
                { answer: ['In', 'the', 'beginning', 'God', 'created'], lemma: 'beginning' },
                { answer: ['God', 'created', 'the', 'heavens'], lemma: 'heavens' },
                { answer: ['God', 'created', 'the', 'earth'], lemma: 'earth' },
              ]
            ),
          },
          {
            title: 'Heavens and Earth',
            summary: 'Céus e terra recebem nome. Heavens e earth são o cenário da criação.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:1',
              'In the beginning God created the heavens and the earth.',
              'No princípio criou Deus os céus e a terra.',
              [pair('Heavens', 'Céus'), pair('Earth', 'Terra'), pair('Beginning', 'Princípio'), pair('Created', 'Criou')],
              [pair('Darkness', 'Escuridão'), pair('Deep', 'Abismo'), pair('God', 'Deus'), pair('Light', 'Luz')],
              [
                { sentence: 'God created the _____ and the earth.', options: ['heavens', 'rivers', 'houses'], answer: 'heavens', lemma: 'heavens' },
                { sentence: 'Darkness was upon the _____.', options: ['deep', 'hill', 'wall'], answer: 'deep', lemma: 'deep' },
                { sentence: 'The earth was without _____.', options: ['form', 'gold', 'rain'], answer: 'form', lemma: 'form' },
              ],
              [
                { answer: ['God', 'created', 'the', 'heavens', 'and', 'the', 'earth'], lemma: 'earth' },
                { answer: ['Darkness', 'was', 'upon', 'the', 'deep'], lemma: 'darkness' },
                { answer: ['In', 'the', 'beginning', 'God', 'created'], lemma: 'created' },
              ]
            ),
          },
          {
            title: 'Light, Said and Good',
            summary: 'Deus fala e a luz existe. Said, light e good andam juntos.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:3',
              'And God said, Let there be light: and there was light.',
              'E disse Deus: Haja luz. E houve luz.',
              [pair('Light', 'Luz'), pair('Said', 'Disse'), pair('Good', 'Bom'), pair('Darkness', 'Escuridão')],
              [pair('God', 'Deus'), pair('Created', 'Criou'), pair('Earth', 'Terra'), pair('Heavens', 'Céus')],
              [
                { sentence: 'Let there be _____.', options: ['light', 'night', 'dust'], answer: 'light', lemma: 'light' },
                { sentence: 'And God _____ , Let there be light.', options: ['said', 'ate', 'ran'], answer: 'said', lemma: 'said' },
                { sentence: 'And there was _____.', options: ['light', 'rain', 'snow'], answer: 'light', lemma: 'light' },
              ],
              [
                { answer: ['And', 'God', 'said', 'Let', 'there', 'be', 'light'], lemma: 'said' },
                { answer: ['God', 'saw', 'the', 'light'], lemma: 'light' },
                { answer: ['the', 'light', 'was', 'good'], lemma: 'good' },
              ]
            ),
          },
        ],
      },
      {
        title: 'Sky, Waters and Firmament',
        type: 'LESSON',
        lessons: [
          {
            title: 'God Divided the Waters',
            summary: 'Deus separa as águas. Divided é o verbo da separação.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:6',
              'And God said, Let there be a firmament in the midst of the waters.',
              'E disse Deus: Haja um firmamento no meio das águas.',
              [pair('Waters', 'Águas'), pair('Divided', 'Separou'), pair('Sky', 'Céu'), pair('Firmament', 'Firmamento')],
              [pair('Above', 'Acima'), pair('Below', 'Abaixo'), pair('Called', 'Chamou'), pair('God', 'Deus')],
              [
                { sentence: 'God _____ the waters.', options: ['divided', 'mixed', 'hid'], answer: 'divided', lemma: 'divided' },
                { sentence: 'Let there be a _____ in the midst of the waters.', options: ['firmament', 'garden', 'city'], answer: 'firmament', lemma: 'firmament' },
                { sentence: 'God called the firmament _____.', options: ['Heaven', 'Night', 'Sea'], answer: 'Heaven', lemma: 'heaven' },
              ],
              [
                { answer: ['God', 'divided', 'the', 'waters'], lemma: 'divided' },
                { answer: ['Let', 'there', 'be', 'a', 'firmament'], lemma: 'firmament' },
                { answer: ['God', 'called', 'the', 'firmament', 'Heaven'], lemma: 'called' },
              ]
            ),
          },
          {
            title: 'Above and Below',
            summary: 'O céu fica acima e as águas abaixo. Above e below marcam o lugar.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:7',
              'And God made the firmament, and divided the waters which were under the firmament from the waters which were above the firmament.',
              'E fez Deus o firmamento, e separou as águas que estavam debaixo do firmamento das águas que estavam sobre o firmamento.',
              [pair('Above', 'Acima'), pair('Below', 'Abaixo'), pair('Under', 'Debaixo'), pair('Waters', 'Águas')],
              [pair('Sky', 'Céu'), pair('Divided', 'Separou'), pair('Firmament', 'Firmamento'), pair('Called', 'Chamou')],
              [
                { sentence: 'The sky is _____ the waters.', options: ['above', 'below', 'inside'], answer: 'above', lemma: 'above' },
                { sentence: 'The deep waters stayed _____.', options: ['below', 'above', 'before'], answer: 'below', lemma: 'below' },
                { sentence: 'God divided the waters _____ the firmament.', options: ['under', 'after', 'without'], answer: 'under', lemma: 'under' },
              ],
              [
                { answer: ['The', 'sky', 'is', 'above', 'the', 'waters'], lemma: 'above' },
                { answer: ['The', 'waters', 'were', 'below', 'the', 'sky'], lemma: 'below' },
                { answer: ['God', 'divided', 'the', 'waters'], lemma: 'divided' },
              ]
            ),
          },
          {
            title: 'Day and Night',
            summary: 'Deus chama a luz de dia e as trevas de noite.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:5',
              'And God called the light Day, and the darkness he called Night.',
              'E Deus chamou à luz Dia; e às trevas chamou Noite.',
              [pair('Day', 'Dia'), pair('Night', 'Noite'), pair('Called', 'Chamou'), pair('Light', 'Luz')],
              [pair('Darkness', 'Escuridão'), pair('God', 'Deus'), pair('Sky', 'Céu'), pair('Waters', 'Águas')],
              [
                { sentence: 'God called the light _____.', options: ['Day', 'Night', 'Sea'], answer: 'Day', lemma: 'day' },
                { sentence: 'The darkness he called _____.', options: ['Night', 'Day', 'Sky'], answer: 'Night', lemma: 'night' },
                { sentence: 'And God _____ the light Day.', options: ['called', 'lost', 'broke'], answer: 'called', lemma: 'called' },
              ],
              [
                { answer: ['God', 'called', 'the', 'light', 'Day'], lemma: 'day' },
                { answer: ['the', 'darkness', 'he', 'called', 'Night'], lemma: 'night' },
                { answer: ['And', 'the', 'evening', 'and', 'the', 'morning'], lemma: 'called' },
              ]
            ),
          },
        ],
      },
      {
        title: 'Living Creatures of Land and Sea',
        type: 'LESSON',
        lessons: [
          {
            title: 'Birds and Fish',
            summary: 'Pássaros e peixes enchem o céu e o mar. Os plurais nomeiam a vida.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:20',
              'Let the waters bring forth the moving creature, and fowl that may fly above the earth.',
              'Produzam as águas abundantemente répteis de alma vivente; e voem as aves sobre a face da terra.',
              [pair('Birds', 'Pássaros'), pair('Fish', 'Peixes'), pair('Sea', 'Mar'), pair('Fly', 'Voar')],
              [pair('Creatures', 'Criaturas'), pair('Earth', 'Terra'), pair('Waters', 'Águas'), pair('God', 'Deus')],
              [
                { sentence: 'God created the _____ that fly.', options: ['birds', 'stones', 'walls'], answer: 'birds', lemma: 'birds' },
                { sentence: 'The _____ live in the sea.', options: ['fish', 'lamps', 'hills'], answer: 'fish', lemma: 'fish' },
                { sentence: 'Birds fly above the _____.', options: ['earth', 'night', 'word'], answer: 'earth', lemma: 'earth' },
              ],
              [
                { answer: ['God', 'created', 'the', 'birds'], lemma: 'birds' },
                { answer: ['Fish', 'live', 'in', 'the', 'sea'], lemma: 'fish' },
                { answer: ['Birds', 'fly', 'above', 'the', 'earth'], lemma: 'birds' },
              ]
            ),
          },
          {
            title: 'The Sea and Living Creatures',
            summary: 'O mar se enche de criaturas vivas. Sea e creatures crescem juntos.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:21',
              'And God created great whales, and every living creature that moveth.',
              'E Deus criou as grandes baleias, e todo réptil de alma vivente.',
              [pair('Sea', 'Mar'), pair('Creatures', 'Criaturas'), pair('Living', 'Vivas'), pair('Whales', 'Baleias')],
              [pair('Fish', 'Peixes'), pair('Birds', 'Pássaros'), pair('Waters', 'Águas'), pair('God', 'Deus')],
              [
                { sentence: 'God created every living _____.', options: ['creature', 'house', 'stone'], answer: 'creature', lemma: 'creature' },
                { sentence: 'The waters brought forth living _____.', options: ['creatures', 'crowns', 'gates'], answer: 'creatures', lemma: 'creatures' },
                { sentence: 'Great whales live in the _____.', options: ['sea', 'tent', 'field'], answer: 'sea', lemma: 'sea' },
              ],
              [
                { answer: ['God', 'created', 'every', 'living', 'creature'], lemma: 'creature' },
                { answer: ['living', 'creatures', 'filled', 'the', 'sea'], lemma: 'sea' },
                { answer: ['The', 'waters', 'brought', 'forth', 'life'], lemma: 'waters' },
              ]
            ),
          },
          {
            title: 'Cattle and Creeping Things',
            summary: 'Gado e répteis enchem a terra. Os plurais da terra.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:24',
              'Let the earth bring forth the living creature, cattle, and creeping thing.',
              'Produza a terra alma vivente conforme a sua espécie; gado, e répteis.',
              [pair('Cattle', 'Gado'), pair('Creeping', 'Répteis'), pair('Beast', 'Animal'), pair('Earth', 'Terra')],
              [pair('Animals', 'Animais'), pair('Birds', 'Pássaros'), pair('Fish', 'Peixes'), pair('Sea', 'Mar')],
              [
                { sentence: 'Let the earth bring forth the _____.', options: ['cattle', 'crowns', 'lamps'], answer: 'cattle', lemma: 'cattle' },
                { sentence: 'Creeping things move on the _____.', options: ['earth', 'sky', 'word'], answer: 'earth', lemma: 'earth' },
                { sentence: 'God made the _____ of the earth.', options: ['animals', 'altars', 'angels'], answer: 'animals', lemma: 'animals' },
              ],
              [
                { answer: ['Let', 'the', 'earth', 'bring', 'forth', 'cattle'], lemma: 'cattle' },
                { answer: ['creeping', 'things', 'move', 'on', 'the', 'earth'], lemma: 'creeping' },
                { answer: ['God', 'made', 'the', 'animals'], lemma: 'animals' },
              ]
            ),
          },
        ],
      },
      {
        title: 'Image and Likeness',
        type: 'LESSON',
        lessons: [
          {
            title: 'In Our Image',
            summary: 'Deus fala no plural: façamos o homem à nossa imagem. Our aponta para Deus.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:26',
              'And God said, Let us make man in our image, after our likeness.',
              'E disse Deus: Façamos o homem à nossa imagem, conforme a nossa semelhança.',
              [pair('Man', 'Homem'), pair('Image', 'Imagem'), pair('Our', 'Nossa'), pair('Us', 'Nós')],
              [pair('God', 'Deus'), pair('Likeness', 'Semelhança'), pair('Make', 'Façamos'), pair('Said', 'Disse')],
              [
                { sentence: 'Let us make man in _____ image.', options: ['our', 'my', 'your'], answer: 'our', lemma: 'our' },
                { sentence: 'God said, Let _____ make man.', options: ['us', 'me', 'them'], answer: 'us', lemma: 'us' },
                { sentence: 'Man is made in the _____ of God.', options: ['image', 'house', 'garden'], answer: 'image', lemma: 'image' },
              ],
              [
                { answer: ['Let', 'us', 'make', 'man'], lemma: 'man' },
                { answer: ['in', 'our', 'image'], lemma: 'image' },
                { answer: ['God', 'said', 'Let', 'us', 'make', 'man'], lemma: 'said' },
              ]
            ),
          },
          {
            title: 'Likeness and Rule',
            summary: 'Semelhança e domínio. Likeness e rule mostram o chamado humano.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:26',
              'And let them have dominion over the fish of the sea.',
              'E domine sobre os peixes do mar.',
              [pair('Likeness', 'Semelhança'), pair('Rule', 'Domínio'), pair('Them', 'Eles'), pair('His', 'Seu')],
              [pair('Fish', 'Peixes'), pair('Sea', 'Mar'), pair('Man', 'Homem'), pair('Image', 'Imagem')],
              [
                { sentence: 'Man is made after Gods _____.', options: ['likeness', 'shadow', 'city'], answer: 'likeness', lemma: 'likeness' },
                { sentence: 'Let them _____ over the fish of the sea.', options: ['rule', 'sleep', 'fall'], answer: 'rule', lemma: 'rule' },
                { sentence: 'God created man in _____ own image.', options: ['his', 'her', 'their'], answer: 'his', lemma: 'his' },
              ],
              [
                { answer: ['after', 'our', 'likeness'], lemma: 'likeness' },
                { answer: ['Let', 'them', 'rule', 'the', 'fish'], lemma: 'rule' },
                { answer: ['in', 'his', 'own', 'image'], lemma: 'his' },
              ]
            ),
          },
          {
            title: 'Blessed and Fruitful',
            summary: 'Deus abençoa o homem e a mulher. Blessed e fruitful são a missão.',
            xp: 15,
            talents: 5,
            exercises: pack(
              'Genesis 1:28',
              'And God blessed them, and God said unto them, Be fruitful, and multiply.',
              'E Deus os abençoou, e Deus lhes disse: Frutificai e multiplicai-vos.',
              [pair('Blessed', 'Abençoou'), pair('Fruitful', 'Frutificai'), pair('Them', 'Eles'), pair('Multiply', 'Multiplicai')],
              [pair('God', 'Deus'), pair('Man', 'Homem'), pair('Image', 'Imagem'), pair('Rule', 'Domínio')],
              [
                { sentence: 'God _____ them.', options: ['blessed', 'forgot', 'sold'], answer: 'blessed', lemma: 'blessed' },
                { sentence: 'Be _____ and multiply.', options: ['fruitful', 'silent', 'empty'], answer: 'fruitful', lemma: 'fruitful' },
                { sentence: 'God said unto _____.', options: ['them', 'it', 'me'], answer: 'them', lemma: 'them' },
              ],
              [
                { answer: ['God', 'blessed', 'them'], lemma: 'blessed' },
                { answer: ['Be', 'fruitful', 'and', 'multiply'], lemma: 'fruitful' },
                { answer: ['God', 'said', 'unto', 'them'], lemma: 'them' },
              ]
            ),
          },
        ],
      },
      {
        title: 'The Sabbath Rest',
        type: 'UNIT_BOSS',
        lessons: [
          {
            title: 'The Seventh Day',
            summary: 'Deus descansa, abençoa o sétimo dia e coroa a unidade.',
            xp: 40,
            talents: 50,
            exercises: [
              match([pair('Rested', 'Descansou'), pair('Seventh', 'Sétimo'), pair('Blessed', 'Abençoou'), pair('Day', 'Dia')], 'rested', 'Genesis 2:2', 'And on the seventh day God ended his work and he rested.', 'E no sétimo dia Deus acabou a sua obra e descansou.'),
              fill('On the seventh day God _____.', ['rested', 'ran', 'forgot'], 'rested', 'rested', 'Genesis 2:2', 'And he rested on the seventh day from all his work.', 'E descansou no sétimo dia de toda a sua obra.'),
              order(['God', 'rested', 'on', 'the', 'seventh', 'day'], 'rested', 'Genesis 2:2', 'God rested on the seventh day.', 'Deus descansou no sétimo dia.'),
              fill('God _____ the seventh day.', ['blessed', 'broke', 'hid'], 'blessed', 'blessed', 'Genesis 2:3', 'And God blessed the seventh day.', 'E abençoou Deus o dia sétimo.'),
              order(['God', 'blessed', 'the', 'seventh', 'day'], 'blessed', 'Genesis 2:3', 'God blessed the seventh day.', 'Deus abençoou o sétimo dia.'),
              fill('The heavens and the earth were _____.', ['finished', 'empty', 'lost'], 'finished', 'finished', 'Genesis 2:1', 'Thus the heavens and the earth were finished.', 'Assim os céus e a terra foram acabados.'),
              order(['In', 'the', 'beginning', 'God', 'created'], 'created', 'Genesis 1:1', 'In the beginning God created the heavens and the earth.', 'No princípio criou Deus os céus e a terra.'),
              fill('God made man in his _____.', ['image', 'tent', 'river'], 'image', 'image', 'Genesis 1:27', 'So God created man in his own image.', 'E criou Deus o homem à sua imagem.'),
              match([pair('Light', 'Luz'), pair('Waters', 'Águas'), pair('Birds', 'Pássaros'), pair('Good', 'Bom')], 'light', 'Genesis 1:4', 'And God saw the light, that it was good.', 'E viu Deus que era boa a luz.'),
              order(['And', 'God', 'said', 'Let', 'there', 'be', 'light'], 'said', 'Genesis 1:3', 'And God said, Let there be light.', 'E disse Deus: Haja luz.'),
              fill('The sky is _____ the waters.', ['above', 'below', 'after'], 'above', 'above', 'Genesis 1:7', 'The waters which were above the firmament.', 'As águas que estavam sobre o firmamento.'),
              order(['God', 'divided', 'the', 'waters'], 'divided', 'Genesis 1:7', 'And divided the waters.', 'E separou as águas.'),
              fill('Be _____ and multiply.', ['fruitful', 'silent', 'empty'], 'fruitful', 'fruitful', 'Genesis 1:28', 'Be fruitful, and multiply.', 'Frutificai e multiplicai-vos.'),
              order(['God', 'blessed', 'them'], 'blessed', 'Genesis 1:28', 'And God blessed them.', 'E Deus os abençoou.'),
              match([pair('Earth', 'Terra'), pair('Sea', 'Mar'), pair('Image', 'Imagem'), pair('Night', 'Noite')], 'earth', 'Genesis 2:1', 'Thus the heavens and the earth were finished.', 'Assim os céus e a terra foram acabados.'),
            ],
          },
        ],
      },
    ],
  },
  {
    book: 2,
    sectionOrder: 2,
    cefr: 'A2',
    sectionTitle: 'Seção 2: A Saída — Nível A2',
    sectionDescription: 'Deus revela o seu nome e envia Moisés.',
    color: '#2563eb',
    unitTitle: 'Unidade 2: I AM (Êxodo 3)',
    theme: 'O nome de Deus revelado a Moisés',
    nodes: [
      {
        title: 'I AM the Lord',
        type: 'LESSON',
        lessons: [
          {
            title: 'I AM hath sent me',
            summary: 'Deus diz o seu nome: I AM. O envio de Moisés começa aqui.',
            xp: 15,
            talents: 10,
            exercises: pack(
              'Exodus 3:14',
              'And God said unto Moses, I AM THAT I AM.',
              'E disse Deus a Moisés: EU SOU O QUE SOU.',
              [pair('Lord', 'Senhor'), pair('Name', 'Nome'), pair('Sent', 'Enviou'), pair('People', 'Povo')],
              [pair('Moses', 'Moisés'), pair('God', 'Deus'), pair('AM', 'SOU'), pair('Said', 'Disse')],
              [
                { sentence: 'I _____ that I AM.', options: ['AM', 'is', 'are'], answer: 'AM', lemma: 'am' },
                { sentence: 'God _____ Moses.', options: ['sent', 'sold', 'shut'], answer: 'sent', lemma: 'sent' },
                { sentence: 'Go to my _____.', options: ['people', 'palace', 'river'], answer: 'people', lemma: 'people' },
              ],
              [
                { answer: ['I', 'AM', 'the', 'Lord'], lemma: 'lord' },
                { answer: ['God', 'sent', 'Moses'], lemma: 'sent' },
                { answer: ['I', 'AM', 'hath', 'sent', 'me'], lemma: 'sent' },
              ]
            ),
          },
        ],
      },
    ],
  },
];

const lines = [];
lines.push('-- Trilha da Unidade 1: seções, nós e lições curtas.');
lines.push('begin;');
lines.push('');
for (const unit of units) {
  lines.push(`insert into public.verbum_course_sections (cefr_level, order_index, title, description, color_hex)
values (${q(unit.cefr)}, ${unit.sectionOrder}, ${q(unit.sectionTitle)}, ${q(unit.sectionDescription)}, ${q(unit.color)})
on conflict (order_index) do update
  set cefr_level = excluded.cefr_level,
      title = excluded.title,
      description = excluded.description,
      color_hex = excluded.color_hex;`);
}
lines.push('');
lines.push(`insert into public.verbum_curriculum_units (
  bible_book_id, division, cefr_level, order_index, title, theological_theme, icon_name
)
select b.id, b.division, 'A2', 1, 'Unidade 2: I AM (Êxodo 3)', 'O nome de Deus revelado a Moisés', 'scroll'
from public.verbum_bible_books b
where b.order_index = 2
  and not exists (
    select 1 from public.verbum_curriculum_units u
    where u.bible_book_id = b.id and u.order_index = 1
  );`);
lines.push('');
for (const unit of units) {
  lines.push(`update public.verbum_curriculum_units u
set title = ${q(unit.unitTitle)},
    theological_theme = ${q(unit.theme)},
    cefr_level = ${q(unit.cefr)},
    section_id = (select id from public.verbum_course_sections where order_index = ${unit.sectionOrder})
from public.verbum_bible_books b
where u.bible_book_id = b.id and b.order_index = ${unit.book} and u.order_index = 1;`);
}
lines.push('');
lines.push(`delete from public.verbum_unit_crowns c
using public.verbum_curriculum_units u, public.verbum_bible_books b
where c.unit_id = u.id and u.bible_book_id = b.id and u.order_index = 1 and b.order_index in (1, 2);`);
lines.push(`delete from public.verbum_lessons l
using public.verbum_curriculum_units u, public.verbum_bible_books b
where l.unit_id = u.id and u.bible_book_id = b.id and u.order_index = 1 and b.order_index in (1, 2);`);
lines.push(`delete from public.verbum_path_nodes n
using public.verbum_curriculum_units u, public.verbum_bible_books b
where n.unit_id = u.id and u.bible_book_id = b.id and u.order_index = 1 and b.order_index in (1, 2);`);
lines.push('');

for (const unit of units) {
  unit.nodes.forEach((node, nodeIndex) => {
    lines.push(`insert into public.verbum_path_nodes (unit_id, order_index, node_type, title, total_levels)
select u.id, ${nodeIndex + 1}, ${q(node.type)}, ${q(node.title)}, ${node.lessons.length}
from public.verbum_curriculum_units u
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = ${unit.book} and u.order_index = 1;`);
  });
}

lines.push('');
for (const unit of units) {
  let lessonOrder = 0;
  unit.nodes.forEach((node, nodeIndex) => {
    node.lessons.forEach((lesson, levelIndex) => {
      lessonOrder += 1;
      lines.push(`insert into public.verbum_lessons (
  unit_id, node_id, order_index, level_index, title, xp_reward, talents_reward, theological_summary
)
select u.id, n.id, ${lessonOrder}, ${levelIndex + 1}, ${q(lesson.title)}, ${lesson.xp}, ${lesson.talents}, ${q(lesson.summary)}
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = ${unit.book} and u.order_index = 1 and n.order_index = ${nodeIndex + 1};`);
      lesson.exercises.forEach((exercise) => {
        lines.push(`insert into public.verbum_exercises (
  lesson_id, exercise_type, prompt, bible_passage_ref, verse_target_en, verse_target_pt, payload
)
select l.id, ${q(exercise.type)}, ${q(exercise.prompt)}, ${q(exercise.ref)}, ${q(exercise.en)}, ${q(exercise.pt)}, ${jsonb(exercise.payload)}
from public.verbum_lessons l
join public.verbum_path_nodes n on n.id = l.node_id
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
where b.order_index = ${unit.book} and u.order_index = 1 and n.order_index = ${nodeIndex + 1} and l.level_index = ${levelIndex + 1};`);
      });
    });
  });
}

lines.push('');
lines.push('commit;');
lines.push(`select b.order_index as book, n.order_index as node, count(distinct l.id) as lessons, count(e.id) as exercises
from public.verbum_path_nodes n
join public.verbum_curriculum_units u on u.id = n.unit_id
join public.verbum_bible_books b on b.id = u.bible_book_id
left join public.verbum_lessons l on l.node_id = n.id
left join public.verbum_exercises e on e.lesson_id = l.id
where b.order_index in (1, 2) and u.order_index = 1
group by b.order_index, n.order_index
order by b.order_index, n.order_index;`);

writeFileSync(new URL('./verbum-unit1-nodes.sql', import.meta.url), `${lines.join('\n')}\n`);
console.log(`exercises ${units.reduce((sum, unit) => sum + unit.nodes.reduce((nodeSum, node) => nodeSum + node.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.exercises.length, 0), 0), 0)}`);
