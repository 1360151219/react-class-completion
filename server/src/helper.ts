import { transformFromAstSync } from '@babel/core';
import { parse } from '@babel/parser';
import path = require('path');
import { Range, TextDocument } from 'vscode-languageserver-textdocument';
import parseJsx from './plugins/parseJsx';
import { IClassName } from './types';

export function enter() {
  // switch (process.platform) { xxx
  //   case 'win32':
  //     return '\r\n';
  //   case 'linux':
  //     return '\n';
  //   case 'darwin': // macos
  //     return '\r';
  //   default:
  //     return '\n';
  // }
  return '\n';
}
export function transformClassName(code: string, file: string) {
  const ast = parse(code, {
    sourceType: 'unambiguous',
    plugins: ['typescript', 'jsx'],
  });
  const classname: IClassName[] = [];
  transformFromAstSync(ast, code, {
    plugins: [[parseJsx, { classname, file }]],
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

export function createRange(m: RegExpMatchArray) {
  const start = m.index || 0;
  const end = start + m[0].length;
  return {
    start,
    end,
  };
}
/**
 * 返回触发Defination时匹配的类名
 * @param text 该行的文本
 * @param character 触发Defination事件时光标所在的column
 * @returns
 */
export function getDefinationClass(text: string, character: number) {
  const wordReg = /\.([-_\d\w]+)/g;
  const m = text.matchAll(wordReg) || [];
  for (const i of m) {
    const range = createRange(i);
    if (character >= range.start && character <= range.end) {
      // eslint-disable-next-line prefer-destructuring
      return i[1];
    }
  }
  return 'error';
}

export function removeDuplicateClass(
  classMetas: IClassName[],
  updateMetas: IClassName[]
) {
  const existClass = classMetas.map((c) => c.className);
  return updateMetas.filter((meta) => !existClass.includes(meta.className));
}

export function getLanguageId(uri: string) {
  switch (path.extname(uri)) {
    case '.tsx': {
      return 'typescriptreact';
    }
    case '.scss': {
      return 'scss';
    }
    default: {
      return '';
    }
  }
}

export function replaceByRange(doc: TextDocument, range: Range, text: string) {
  const { start, end } = range;
  let newContent = '';
  let startOffset = doc.offsetAt(start);
  let endOffset = doc.offsetAt(end);
  const origin = doc.getText();
  const len = origin.length;
  // 新增文本时，startOffset = len
  if (startOffset >= len) {
    newContent = origin + text;
  } else {
    // 修改文本
    const preText = origin.slice(0, startOffset);
    const postText = origin.slice(endOffset);
    newContent = preText + text + postText;
  }
  // console.log(
  //   'origin',
  //   origin,
  //   'len',
  //   len,
  //   'start',
  //   startOffset,
  //   'end',
  //   endOffset,
  //   'newlen',
  //   newContent.length,
  //   'new',
  //   newContent
  // );
  return newContent;
}
