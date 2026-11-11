/** Replace one generated method while leaving the vendored Java source untouched. */
export function replaceMethod(source, signature, body) {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`Missing Java method: ${signature}`);
  const open = source.indexOf('{', start);
  let depth = 1;
  let end = open + 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  return source.slice(0, open + 1) + '\n' + body + '\n    }' + source.slice(end);
}
