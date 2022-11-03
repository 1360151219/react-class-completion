import { DocumentUri } from 'vscode-languageserver';
interface SourceLocation {
  start: {
    line: number;
    column: number;
  };
  end: {
    line: number;
    column: number;
  };
}
/**
 * 记录在原tsx文件中捕获classname的元信息
 */
export interface IClassName {
  /**
   * 最终编译的classname
   */
  className: string;
  /**
   * 原classname
   */
  originName: string;
  /**
   * 原文件中的位置信息
   */
  range?: null | SourceLocation;
  /**
   * 源文件的地址
   */
  file: DocumentUri;
}
