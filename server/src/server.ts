import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
  CompletionItemKind,
  DefinitionParams,
  Definition,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { getSCSSLanguageService } from 'vscode-css-languageservice';

import * as path from 'path';
import { readdirSync, readFileSync } from 'fs-extra';
import { getDefinationClass, transformClassName } from './helper';
import { IClassName } from './types';
const connection = createConnection(ProposedFeatures.all);
let classCompletion: CompletionItem[] = [];
// Defination：记录在原tsx文件中捕获classname的元信息
let classMetas: IClassName[] = [];
let classInScss: string[] = [];
// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
connection.onInitialize((params: InitializeParams) => {
  // params.rootPath
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      // Tell the client that this server supports code completion.
      completionProvider: {
        triggerCharacters: ['.'],
        resolveProvider: true,
      },
      definitionProvider: true,
    },
  };
  return result;
});

connection.onInitialized(() => {
  console.log('server initialized');
});

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.

// Cache the settings of all open documents

connection.onDidChangeConfiguration((change) => {});

// 只针对当前改变的文件发生改变）
documents.onDidSave((change) => {
  const { document } = change;
  if (path.extname(document.uri) === '.tsx') {
    updateCompletion(document, document.uri);
  }
});
documents.onDidOpen(async (e) => {
  if (path.extname(e.document.uri) === '.scss') {
    updateCompletion(e.document);
  }
});
/**
 * 遍历同层级目录下的tsx/html文件
 */
async function findHtmlInDir(
  textDocument: TextDocument,
  file?: string
): Promise<CompletionItem[]> {
  const classname: IClassName[] = [];
  if (file) {
    // 修改单个tsx时
    let filePath = file.slice(7);
    classname.push(
      ...transformClassName(readFileSync(filePath, { encoding: 'utf-8' }), file)
    );
  } else {
    let filePath = textDocument.uri.slice(7);
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
  }
  classMetas = classname;
  // TODO去重: 修改一下逻辑，将tsx和scss修改的更新逻辑抽离
  return classname.map((c) => ({
    label: `.${c.className}`,
    kind: CompletionItemKind.Class,
    data: c,
  }));
}
async function filterInScss(cssDocument: TextDocument): Promise<string[]> {
  const scssLanguageService = getSCSSLanguageService();
  const existClass: string[] = [];

  const scssAst = scssLanguageService.parseStylesheet(cssDocument);
  (scssAst as any).accept((node: any) => {
    // console.log('type:', node);
    // console.log(node.getText());
    if (node.type === 14) {
      // 去掉首位字符 `.`
      existClass.push(node.getText());
    }
    return true;
  });
  return existClass;
}
/**
 * 更新补全类名的数组
 * @param document
 * @param file 单个tsx文件改变时才有，只解析对应的文件ast
 */
async function updateCompletion(document: TextDocument, file?: string) {
  let newCompletion = await findHtmlInDir(document, file);
  if (!file) {
    classInScss = await filterInScss(document);
  }
  newCompletion = newCompletion.filter((c) => !classInScss.includes(c.label));
  classCompletion = newCompletion;
}

connection.onDidChangeWatchedFiles((_change) => {
  console.log('====', _change);
  // Monitored files have change in VSCode
  connection.console.log('We received an file change event');
});
// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    // The pass parameter contains the position of the text document in
    // which code complete got requested. For the example we ignore this
    // info and always provide the same completion items.
    return classCompletion;
  }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  item.detail = item.data;
  return item;
});

connection.onDefinition((item: DefinitionParams): Definition => {
  let t =
    documents.get(item.textDocument.uri)?.getText().split('\n')[
      item.position.line
    ] || '';
  const definationClass = getDefinationClass(t, item.position.character);
  // console.log(definationClass);
  const sourceDefination = classMetas.filter(
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
});
documents.listen(connection);
connection.listen();
