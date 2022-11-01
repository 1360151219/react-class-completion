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
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import * as path from 'path';
import { readdirSync, readFileSync } from 'fs-extra';
import { transformClassName } from './helper';
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
        resolveProvider: true,
      },
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

// documents.onDidChangeContent((change) => {
//   findCssInDir(change.document);
// });
documents.onDidOpen(async (e) => {
  classCompletion = [];
  classCompletion.push(...(await findCssInDir(e.document)));
});
async function findCssInDir(
  textDocument: TextDocument
): Promise<CompletionItem[]> {
  // TODO
  let filePath = textDocument.uri.slice(7);
  let dirPath = path.resolve(filePath, '..');
  const files = readdirSync(dirPath).filter((file) => /tsx|html/.test(file));
  const classname: string[] = [];
  files.forEach((fileName) => {
    const targetFilePath = path.resolve(dirPath, fileName);
    classname.push(
      ...transformClassName(readFileSync(targetFilePath, { encoding: 'utf-8' }))
    );
  });
  return classname.map((c) => ({
    label: `.${c}`,
    kind: CompletionItemKind.Class,
    data: c,
  }));
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

documents.listen(connection);
connection.listen();
