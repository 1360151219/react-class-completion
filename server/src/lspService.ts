import {
  CompletionItem,
  CompletionItemKind,
  Definition,
  DefinitionParams,
  TextDocumentItem,
  TextDocumentContentChangeEvent,
  VersionedTextDocumentIdentifier,
} from 'vscode-languageserver';
import { getSCSSLanguageService } from 'vscode-css-languageservice';
import { IClassName } from './types';
import * as path from 'path';
import { readdirSync, readFileSync } from 'fs-extra';
import {
  getDefinationClass,
  transformClassName,
  removeDuplicateClass,
  replaceByRange,
  enter,
  getLanguageId,
} from './helper';
import { TextDocument } from 'vscode-languageserver-textdocument';

export class DocMap {
  /**
   * Map\<uri:文件Uri,context:文件内容\>
   */
  docs: Map<string, string>;
  constructor() {
    this.docs = new Map();
  }
  change(
    ranges: TextDocumentContentChangeEvent[],
    vdoc: VersionedTextDocumentIdentifier
  ) {
    const originContent = this.get(vdoc.uri);
    if (!originContent) {
      return;
    }
    let newContent = '';
    ranges.forEach((range) => {
      if (TextDocumentContentChangeEvent.isIncremental(range)) {
        const document = TextDocument.create(
          vdoc.uri,
          getLanguageId(vdoc.uri),
          vdoc.version,
          originContent
        );
        newContent = replaceByRange(document, range.range, range.text);
      }
    });
    this.insert(vdoc.uri.slice(7), newContent);
  }
  insert(uri: string, content: string) {
    this.docs.set(uri, content);
  }
  get(uri: string) {
    return this.docs.get(uri);
  }
  has(uri: string) {
    return this.docs.has(uri);
  }
}
export class LspProvider {
  /**
   * Defination：记录在原tsx文件中捕获classname的元信息
   */
  classMetas: IClassName[];
  classInScss: string[];
  docMap: DocMap;
  constructor() {
    this.classMetas = [];
    this.classInScss = [];
    this.docMap = new DocMap();
  }
  /**
   * when open the .scss file the init function will trigger
   * @param document scss document
   */
  init(document: TextDocumentItem) {
    this._parseTsxInDir(document.uri);
    this._parseScss(
      TextDocument.create(
        document.uri,
        document.languageId,
        document.version,
        document.text
      )
    );
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
      this.docMap.get(item.textDocument.uri.slice(7))?.split(enter())[
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
    let filePath = uri.slice(7); // TODO：documentUri在不同系统下的问题
    if (!this.docMap.has(filePath)) return;
    classname.push(
      ...transformClassName(this.docMap.get(filePath) as string, uri)
    );
    // TODO：解决修改类名时要将原本类名删除的问题。
    // resolve：对单独文件进行重新parse，因此需要对classMetas表重构为： Map<uri,IClassName[]>
    this.classMetas.push(...removeDuplicateClass(this.classMetas, classname));
  }
  /**
   * 初始化：遍历同层级目录下的tsx/html文件
   */
  _parseTsxInDir(uri: string): void {
    const classname: IClassName[] = [];
    let filePath = uri.slice(7);
    let dirPath = path.resolve(filePath, '..');
    const files = readdirSync(dirPath).filter((file) => /tsx|html/.test(file));
    files.forEach((fileName) => {
      const targetFilePath = path.resolve(dirPath, fileName);
      const targetFileContent = readFileSync(targetFilePath, {
        encoding: 'utf-8',
      });
      this.docMap.insert(targetFilePath, targetFileContent);
      classname.push(...transformClassName(targetFileContent, targetFilePath));
    });
    this.classMetas = classname;
  }

  _parseScss(cssDocument: TextDocument): void {
    this.docMap.insert(cssDocument.uri.slice(7), cssDocument.getText());
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
