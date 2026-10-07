// Pure renderer shared by dataset generation and regression tests. Published
// datasets store its output, so a future renderer cannot rewrite old answers.
export const cumulativeOptions = {
  variables: ['c_style', 'python_style', 'java_style', 'pascal_style'],
  blocks: ['block_braces', 'block_indent', 'block_begin_end'],
  loops: ['loop_while', 'loop_for_counter', 'loop_for_range'],
  conditionals: ['condition_parenthesized', 'condition_plain', 'condition_then'],
  assignments: ['assignment_explicit', 'assignment_compound', 'assignment_colon'],
  logical: ['logic_symbols', 'logic_words'],
  functions: ['function_function', 'function_def', 'function_fun'],
};
const indent = code => code.split('\n').map(line => line ? `  ${line}` : '').join('\n');
export function declarations(style) {
  return { c_style: 'int i = 0;\nint total = 0;', python_style: 'i = 0\ntotal = 0',
    java_style: 'var i = 0;\nvar total = 0;', pascal_style: 'i: Integer := 0;\ntotal: Integer := 0;' }[style];
}
export function renderCumulativeCode(styles) {
  const block = (header, body) => {
    if (styles.blocks === 'block_indent') return `${header}:\n${indent(body)}`;
    if (styles.blocks === 'block_begin_end') return `${header}\nbegin\n${indent(body)}\nend;`;
    return `${header} {\n${indent(body)}\n}`;
  };
  const variables = declarations(styles.variables);
  if (!variables) throw new Error('Unknown declaration style');
  if (!styles.blocks) return variables;
  let body = variables;
  if (styles.loops) {
    let action = { assignment_explicit: 'total = total + i;', assignment_compound: 'total += i;',
      assignment_colon: 'total := total + i;' }[styles.assignments || 'assignment_explicit'];
    if (styles.conditionals) {
      let condition = 'i % 2 == 0';
      if (styles.logical === 'logic_symbols') condition += ' && !(i >= 8)';
      if (styles.logical === 'logic_words') condition += ' and not (i >= 8)';
      const header = { condition_parenthesized: `if (${condition})`, condition_plain: `if ${condition}`,
        condition_then: `if ${condition} then` }[styles.conditionals];
      action = block(header, action);
    }
    const loop = styles.loops === 'loop_while' ? block('while (i < 10)', `${action}\ni = i + 1;`)
      : styles.loops === 'loop_for_counter' ? block('for (; i < 10; i = i + 1)', action)
      : block('for i in 0..<10', action);
    body += `\n\n${loop}`;
  }
  body += '\n\nreturn total;';
  const keyword = { function_function: 'function ', function_def: 'def ', function_fun: 'fun ' }[styles.functions] || '';
  return block(`${keyword}somarPares()`, body);
}
