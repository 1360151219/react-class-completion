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
  return /"[\d\w]+"/.test(str) ? str.slice(1, str.length - 1) : str;
}
