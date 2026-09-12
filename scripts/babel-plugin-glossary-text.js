/**
 * Reescreve `import { Text } from 'react-native'` para o Text com dicionário,
 * cobrindo os textos estáticos da UI sem editar cada tela.
 * Pasta `components/glossary` e o provider usam o Text nativo.
 */
module.exports = function glossaryTextPlugin({ types: t }) {
  const SOURCES = new Set(['react-native', 'react-native-web']);
  const REPLACEMENT = '@/components/glossary/GlossaryText';

  function shouldSkipFile(filename) {
    if (!filename) return false;
    const normalized = String(filename).replace(/\\/g, '/');
    return (
      normalized.includes('/components/glossary/')
      || normalized.includes('/context/GlossaryContext')
    );
  }

  function isTextSpecifier(spec) {
    if (!t.isImportSpecifier(spec)) return false;
    if (spec.importKind === 'type') return false;
    const imported = spec.imported;
    if (t.isIdentifier(imported)) return imported.name === 'Text';
    if (t.isStringLiteral(imported)) return imported.value === 'Text';
    return false;
  }

  return {
    name: 'glossary-text',
    visitor: {
      ImportDeclaration(path, state) {
        if (shouldSkipFile(state.filename)) return;
        if (path.node.importKind === 'type') return;
        if (!SOURCES.has(path.node.source.value)) return;

        const textSpecs = [];
        const otherSpecs = [];

        for (const spec of path.node.specifiers) {
          if (isTextSpecifier(spec)) {
            textSpecs.push(spec);
          } else {
            otherSpecs.push(spec);
          }
        }

        if (!textSpecs.length) return;

        const glossaryImport = t.importDeclaration(
          textSpecs,
          t.stringLiteral(REPLACEMENT)
        );

        if (otherSpecs.length) {
          path.node.specifiers = otherSpecs;
          path.insertAfter(glossaryImport);
        } else {
          path.replaceWith(glossaryImport);
        }
      },
    },
  };
};
