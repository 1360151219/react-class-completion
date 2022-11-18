import {
  CompletionItem,
  CompletionItemKind,
  Definition,
  DefinitionParams,
  TextDocumentItem,
  TextDocumentContentChangeEvent,
  VersionedTextDocumentIdentifier,
  TextDocumentPositionParams,
} from 'vscode-languageserver';
import { getSCSSLanguageService } from 'vscode-css-languageservice';
import { IClassName } from './types';
import { readdirSync, readFileSync } from 'fs-extra';
import {
  getDefinationClass,
  transformClassName,
  replaceVariableClass,
  replaceByRange,
  enter,
  getLanguageId,
} from './helper';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { dirname, resolve } from 'path';

/**
 * Map\<uri:文件Uri,context:文件内容\>
 */
export class DocMap {
  docs: Map<string, string>;
  constructor() {
    this.docs = new Map();
  }
  change(
    ranges: TextDocumentContentChangeEvent[],
    vdoc: VersionedTextDocumentIdentifier
  ) {
    const originContent = this.get(vdoc.uri.slice(7));
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
   * 用于存放各个目录下tsx文件的类名信息，结构如下：
   * ```ts
   * Map<dirname, Map<uri, IClassName[]>>
   * ```
   */
  classMetas: Map<string, Map<string, IClassName[]>>;
  /**
   * 用于存放每个scss文件中已存在的类名，结构如下：
   * ```ts
   * Map<scssUri, Set<string>>
   * ```
   */
  classInScss: Map<string, Set<string>>;
  /**
   * 用于存放各个文件的内容信息
   */
  docMap: DocMap;
  constructor() {
    this.classMetas = new Map();
    this.classInScss = new Map();
    this.docMap = new DocMap();
  }
  /**
   * when open the .scss file the init function will trigger
   * @param document scss document
   */
  init(document: TextDocumentItem) {
    // 过滤掉其他格式文件以及非首次解析的scss文件
    if (
      getLanguageId(document.uri) !== 'scss' ||
      this.docMap.has(document.uri.slice(7))
    )
      return;
    this._initTsxInDir(document.uri);
    this._initScss(
      TextDocument.create(
        document.uri,
        document.languageId,
        document.version,
        document.text
      )
    );
  }

  completionProvider(params: TextDocumentPositionParams): CompletionItem[] {
    const dirName = dirname(params.textDocument.uri.slice(7));
    const dirClassMap = this.classMetas.get(dirName);
    const scssClassSet = this.classInScss.get(params.textDocument.uri.slice(7));
    if (!dirClassMap) {
      return [];
    }
    const completions = [];
    for (let v of dirClassMap.values()) {
      completions.push(
        ...v.map((c) => ({
          label: `.${c.className}`,
          kind: CompletionItemKind.Class,
          data: `.${c.className}`,
        }))
      );
    }
    return completions.filter((c) => !scssClassSet?.has(c.label));
  }
  definationProvider(item: DefinitionParams): Definition {
    const dirName = dirname(item.textDocument.uri.slice(7));
    let t =
      this.docMap.get(item.textDocument.uri.slice(7))?.split(enter())[
        item.position.line
      ] || '';
    const definationClass = getDefinationClass(t, item.position.character);
    console.log(definationClass);

    const sourceDefination = this._getFlatClassMetas(dirName).filter(
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
    const dirMap = this.classMetas.get(dirname(uri.slice(7)));
    if (!dirMap) return;
    const classname: IClassName[] = [];
    let filePath = uri.slice(7); // TODO：documentUri在不同系统下的问题
    if (!this.docMap.has(filePath)) return;
    classname.push(
      ...transformClassName(this.docMap.get(filePath) as string, uri)
    );
    dirMap.set(filePath, classname);
  }
  updateScss(cssDocument: TextDocument): void {
    this.classInScss.set(
      cssDocument.uri.slice(7),
      this._parseScss(cssDocument)
    );
  }
  /**
   * 初始化：遍历同层级目录下的tsx/html文件
   */
  _initTsxInDir(scssUri: string): void {
    let scssFilePath = scssUri.slice(7);
    let dirPath = resolve(scssFilePath, '..');
    if (this.classMetas.has(dirPath)) {
      // 如果是相同目录的scss文件，无需重新解析。
      return;
    }
    const dirMap = new Map();
    const files = readdirSync(dirPath).filter((file) => /tsx|html/.test(file));
    files.forEach((fileName) => {
      const targetFilePath = resolve(dirPath, fileName);
      const targetFileContent = readFileSync(targetFilePath, {
        encoding: 'utf-8',
      });
      this.docMap.insert(targetFilePath, targetFileContent);
      dirMap.set(
        targetFilePath,
        transformClassName(targetFileContent, targetFilePath)
      );
    });
    this.classMetas.set(dirPath, dirMap);
  }

  _initScss(cssDocument: TextDocument): void {
    this.docMap.insert(cssDocument.uri.slice(7), cssDocument.getText());
    this.classInScss.set(
      cssDocument.uri.slice(7),
      this._parseScss(cssDocument)
    );
  }
  _parseScss(cssDocument: TextDocument): Set<string> {
    const scssLanguageService = getSCSSLanguageService();
    const variablesMap = new Map();
    const scssAst = scssLanguageService.parseStylesheet(cssDocument);
    (scssAst as any).accept((node: any) => {
      if (node.type === 37) {
        // VariableDeclaration
        variablesMap.set(node.variable.getText(), node.value.getText());
      }
      if (node.type === 14) {
        // ClassSelector
        const originVal = node.getText();
        const value = replaceVariableClass(originVal, variablesMap);
        variablesMap.set(originVal, value);
        // existClass.add(value);
      }
      if (node.type === 7) {
        // SelectorCombinator: &-2
        const originVal = node.getText();
        const p = node.findAParent(20);
        const parentVal = p.getParent().selectors.getText();
        const value = originVal.replace('&', variablesMap.get(parentVal));
        variablesMap.set(originVal, value);
      }
      return true;
    });
    return new Set(variablesMap.values());
  }
  _getFlatClassMetas(dirName: string) {
    const res = [];
    for (let v of this.classMetas.get(dirName)!.values()) {
      res.push(...v);
    }
    return res;
  }
}
