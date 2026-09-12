import {
  glossaryHasMatch,
  lookupGlossaryTerm,
  type GlossaryMatcher,
} from '@/lib/glossary/glossaryMatch';
import type { GlossaryTermPublic } from '@/lib/glossary/glossaryApi';
import { useGlossaryHighlight, useGlossarySkip } from '@/context/GlossaryContext';
import { MINIMAL_UI } from '@/lib/minimalUiTheme';
import React, { forwardRef, memo, type ComponentProps } from 'react';
import { Text as RNText, type TextStyle } from 'react-native';

type RNTextProps = ComponentProps<typeof RNText>;

const MARK_STYLE: TextStyle = {
  textDecorationLine: 'underline',
  fontWeight: '700',
  color: MINIMAL_UI.accent,
};

function splitHighlighted(
  text: string,
  matcher: GlossaryMatcher,
  openTerm: (term: GlossaryTermPublic) => void
): React.ReactNode {
  matcher.regex.lastIndex = 0;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = matcher.regex.exec(text)) !== null) {
    const raw = match[1] ?? match[0];
    const start = match[0] === raw ? match.index : match.index + (match[0].length - raw.length);

    if (start < lastIndex) {
      break;
    }

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const term = lookupGlossaryTerm(raw, matcher);
    if (term) {
      nodes.push(
        <RNText
          key={`g-${key++}`}
          onPress={() => openTerm(term)}
          style={MARK_STYLE}
          suppressHighlighting
          accessibilityRole="button"
          accessibilityLabel={`Definição de ${term.term}`}
        >
          {raw}
        </RNText>
      );
    } else {
      nodes.push(raw);
    }

    lastIndex = start + raw.length;
    if (match.index === matcher.regex.lastIndex) {
      matcher.regex.lastIndex += 1;
    }
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  matcher.regex.lastIndex = 0;
  return nodes.length === 1 ? nodes[0] : nodes;
}

function highlightNode(
  children: React.ReactNode,
  matcher: GlossaryMatcher,
  openTerm: (term: GlossaryTermPublic) => void
): React.ReactNode {
  if (typeof children === 'string' || typeof children === 'number') {
    const text = String(children);
    if (!text || !glossaryHasMatch(text, matcher)) {
      return children;
    }
    return splitHighlighted(text, matcher, openTerm);
  }

  if (Array.isArray(children)) {
    let changed = false;
    const next = children.map((child) => {
      const highlighted = highlightNode(child, matcher, openTerm);
      if (highlighted !== child) changed = true;
      return highlighted;
    });
    return changed ? next : children;
  }

  return children;
}

function GlossaryTextInner(props: RNTextProps, ref: React.Ref<RNText>) {
  const skip = useGlossarySkip();
  const { enabled, matcher, openTerm } = useGlossaryHighlight();
  const canMark = !skip && enabled && matcher != null;

  const nextChildren = canMark
    ? highlightNode(props.children, matcher, openTerm)
    : props.children;

  return (
    <RNText ref={ref} {...props}>
      {nextChildren}
    </RNText>
  );
}

/** Substitui o `Text` do React Native quando o Babel reescreve o import. */
export const Text = memo(forwardRef(GlossaryTextInner));
Text.displayName = 'GlossaryText';

export const GlossaryText = Text;
