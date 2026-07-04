export function activeWordTokenIndex(tokens, cursor) {
  const position = Math.max(0, Number(cursor) || 0);
  return tokens.findIndex((token) => token.isWord && position < token.end);
}
