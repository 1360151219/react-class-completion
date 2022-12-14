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
  CodeLensParams,
  CodeLens,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

import { LspProvider } from './lspService';
import { getLanguageId } from './helper';

const connection = createConnection(ProposedFeatures.all);
let lspProvider: LspProvider;
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
connection.onInitialize((params: InitializeParams) => {
  // params.rootPath
  lspProvider = new LspProvider();
  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: {
        change: TextDocumentSyncKind.Incremental,
        openClose: true,
      },
      // Tell the client that this server supports code completion.
      completionProvider: {
        triggerCharacters: ['.'],
        resolveProvider: true,
      },
      definitionProvider: true,
      codeLensProvider: {
        resolveProvider: true,
      },
    },
  };
  return result;
});

connection.onInitialized(() => {
  console.log('server initialized');
});
documents.listen(connection);
connection.listen();
// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
// Cache the settings of all open documents

// This handler provides the initial list of the completion items.
connection.onCompletion(
  (textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    return lspProvider.completionProvider(textDocumentPosition);
  }
);
// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  return lspProvider.resolveCompletion(item);
});
connection.onDefinition((item: DefinitionParams): Definition | undefined => {
  return lspProvider.definationProvider(item);
});
connection.onCodeLens((item: CodeLensParams): CodeLens[] | undefined => {
  if (getLanguageId(item.textDocument.uri) === 'scss') {
    return lspProvider.codelens;
  }
});
connection.onCodeLensResolve((params: CodeLens) => {
  console.log('===resolve', params);
  return params;
});
// ??????listen??????
connection.onDidOpenTextDocument((param) => {
  lspProvider.init(param.textDocument);
});
connection.onDidChangeTextDocument((param) => {
  lspProvider.docMap.change(param.contentChanges, param.textDocument);
  if (getLanguageId(param.textDocument.uri) === 'typescriptreact') {
    lspProvider.updateTsx(param.textDocument.uri);
  } else if (getLanguageId(param.textDocument.uri) === 'scss') {
    lspProvider.updateScss(
      TextDocument.create(
        param.textDocument.uri,
        'scss',
        param.textDocument.version,
        lspProvider.docMap.get(param.textDocument.uri.slice(7))!
      )
    );
  }
});
