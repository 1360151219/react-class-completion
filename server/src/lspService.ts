import {
  CompletionItem,
  CompletionItemKind,
  Definition,
  DefinitionParams,
  TextDocuments,
} from 'vscode-languageserver';
import { getSCSSLanguageService } from 'vscode-css-languageservice';
import { IClassName } from './types';
import * as path from 'path';
import { readdirSync, readFileSync } from 'fs-extra';
import { getDefinationClass, transformClassName } from './helper';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class DocText {
  /**
   * Map\<uri:文件Uri,context:文件内容\>
   */
  docs: Map<String, String>;
  constructor() {
    this.docs = new Map();
  }
  // change(range, uri, text) {}
  insert(uri: string, content: string) {}
  get(uri: string) {
    return this.docs.get(uri);
  }
}

export class LspProvider {
  classMetas: IClassName[];
  classInScss: string[];
  documents: TextDocuments<TextDocument>;
  constructor(documents: TextDocuments<TextDocument>) {
    // Defination：记录在原tsx文件中捕获classname的元信息
    this.classMetas = [];
    this.classInScss = [];
    this.documents = documents;
  }
  /**
   * when open the .scss file the init function will trigger
   * @param document scss document
   */
  init(document: TextDocument) {
    this._findHtmlInDir(document.uri);
    this._filterInScss(document);
  }

  completionProvider(): CompletionItem[] {
    return this.classMetas
      .map((c) => ({
        label: `.${c.className}`,
        kind: CompletionItemKind.Class,
        data: c,
      }))
      .filter((c) => !this.classInScss.includes(c.label));
  }
  definationProvider(item: DefinitionParams): Definition {
    let t =
      this.documents.get(item.textDocument.uri)?.getText().split('\n')[
        item.position.line
      ] || '';
    const definationClass = getDefinationClass(t, item.position.character);
    const sourceDefination = this.classMetas.filter(
      (c) => c.className === definationClass
    );
    return sourceDefination.map((defination) => ({
      uri: defination.file,
      range: {
        start: {
          character: defination.range!.start.column || 0,
          line: defination.range!.start.line - 1,
        },
        end: {
          character: defination.range!.end.column || 0,
          line: defination.range!.end.line - 1,
        },
      },
    }));
  }

  updateTsx(uri: string) {
    // 修改单个tsx时
    const classname: IClassName[] = [];
    let filePath = uri.slice(7);
    classname.push(
      ...transformClassName(readFileSync(filePath, { encoding: 'utf-8' }), uri)
    );
    return classname.map((c) => ({
      label: `.${c.className}`,
      kind: CompletionItemKind.Class,
      data: c,
    }));
  }
  /**
   * 遍历同层级目录下的tsx/html文件
   */
  _findHtmlInDir(uri: string): void {
    const classname: IClassName[] = [];
    let filePath = uri.slice(7);
    let dirPath = path.resolve(filePath, '..');
    const files = readdirSync(dirPath).filter((file) => /tsx|html/.test(file));
    files.forEach((fileName) => {
      const targetFilePath = path.resolve(dirPath, fileName);
      classname.push(
        ...transformClassName(
          readFileSync(targetFilePath, { encoding: 'utf-8' }),
          targetFilePath
        )
      );
    });
    this.classMetas = classname;
  }
  _filterInScss(cssDocument: TextDocument): void {
    const scssLanguageService = getSCSSLanguageService();
    const existClass: string[] = [];
    const scssAst = scssLanguageService.parseStylesheet(cssDocument);
    (scssAst as any).accept((node: any) => {
      if (node.type === 14) {
        existClass.push(node.getText());
      }
      return true;
    });
    this.classInScss = existClass;
  }
}
