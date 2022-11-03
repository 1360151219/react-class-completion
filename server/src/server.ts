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

import * as path from 'path';
import { readdirSync, readFileSync } from 'fs-extra';
import { createRange, getDefinationClass, transformClassName } from './helper';
// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);
let classCompletion: CompletionItem[] = [];
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

// 当tsx保存的时候才开始重新获取（只针对当前改变的文件发生改变）
documents.onDidSave((change) => {
  const { document } = change;
  const extname = path.extname(document.uri);
  if (extname === '.tsx') {
    updateCompletion(document, document.uri);
  }
});
documents.onDidOpen(async (e) => {
  console.log('open', e);
  if (path.extname(e.document.uri) === '.scss') updateCompletion(e.document);
});
/**
 * 遍历同层级目录下的tsx/html文件
 */
async function findHtmlInDir(
  textDocument: TextDocument,
  file?: string
): Promise<CompletionItem[]> {
  const classname: string[] = [];
  if (file) {
    let filePath = file.slice(7);
    classname.push(
      ...transformClassName(readFileSync(filePath, { encoding: 'utf-8' }))
    );
  } else {
    let filePath = textDocument.uri.slice(7);
    let dirPath = path.resolve(filePath, '..');
    const files = readdirSync(dirPath).filter((file) => /tsx|html/.test(file));
    files.forEach((fileName) => {
      const targetFilePath = path.resolve(dirPath, fileName);
      classname.push(
        ...transformClassName(
          readFileSync(targetFilePath, { encoding: 'utf-8' })
        )
      );
    });
  }
  // 去重
  const set = new Set(classname);
  return [...set].map((c) => ({
    label: `.${c}`,
    kind: CompletionItemKind.Class,
    data: c,
  }));
}

async function updateCompletion(document: TextDocument, file?: string) {
  const newCompletion = await findHtmlInDir(document, file);
  // console.log(newCompletion);
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
  console.log(definationClass);

  // TODO：对应tsx中的位置
  return {
    uri: '/Applications/workplace/zjx-vsc-extension/test/index.tsx',
    range: {
      start: {
        character: 0,
        line: 0,
      },
      end: {
        character: 3,
        line: 3,
      },
    },
  };
});
documents.listen(connection);
connection.listen();
