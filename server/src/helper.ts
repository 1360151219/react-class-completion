import { transformFromAstSync } from '@babel/core';
import { parse } from '@babel/parser';
import parseJsx from './plugins/parseJsx';
export function transformClassName(code: string) {
  const ast = parse(code, {
    sourceType: 'unambiguous',
    plugins: ['typescript', 'jsx'],
  });
  const classname: string[] = [];
  transformFromAstSync(ast, code, {
    plugins: [[parseJsx, { classname }]],
  });
  return classname;
}

export function removeQuota(str: string) {
  return /(["'])[\d\w]+\1/.test(str) ? str.slice(1, str.length - 1) : str;
}
export function removeTemplateLiteral(str: string) {
  const m = /\{`([-_\d\w]+)`\}/.exec(str); //'{`foo3`}' {`foo_foo-4`}
  // console.log(m, str);
  if (m) {
    return m[1];
  } else {
    return str;
  }
}
