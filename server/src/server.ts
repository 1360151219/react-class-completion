import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
  DefinitionParams,
  Definition,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import * as path from 'path';
import { LspProvider } from './lspService';

const connection = createConnection(ProposedFeatures.all);
let lspProvider: LspProvider;
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
connection.onInitialize((params: InitializeParams) => {
  // params.rootPath
  lspProvider = new LspProvider(documents);
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

// 只针对当前改变的文件发生改变）
documents.onDidSave((change) => {
  const { document } = change;
  if (path.extname(document.uri) === '.tsx') {
    lspProvider.updateTsx(document.uri);
  }
});
documents.onDidOpen(async (e) => {
  lspProvider.init(e.document);
});

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return lspProvider.completionProvider();
  }
);
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  item.detail = item.data;
  return item;
});
connection.onDefinition((item: DefinitionParams): Definition => {
  return lspProvider.definationProvider(item);
});
documents.listen(connection);
connection.listen();
