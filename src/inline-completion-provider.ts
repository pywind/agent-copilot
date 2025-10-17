import { streamText } from "ai";
import * as vscode from "vscode";
import ChatGptViewProvider from "./chatgpt-view-provider";
import { logger } from "./logger";
import { getHeaders } from "./model-config";

const MAX_BEFORE_CHARACTERS = 6000;
const MAX_AFTER_CHARACTERS = 2000;
const DEFAULT_MAX_OUTPUT_TOKENS = 256;
const INLINE_SYSTEM_PROMPT =
  "You are an AI coding assistant integrated with Visual Studio Code. " +
  "Provide concise inline code completions that seamlessly continue the user's work. " +
  "Respond with code only, without backticks or explanations, and do not repeat text that already exists after the cursor.";

function getDocumentSuffixPosition(document: vscode.TextDocument): vscode.Position {
  if (document.lineCount === 0) {
    return new vscode.Position(0, 0);
  }

  const lastLine = document.lineCount - 1;
  return document.lineAt(lastLine).range.end;
}

function truncateLeading(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) {
    return text;
  }
  return text.slice(text.length - maxCharacters);
}

function truncateTrailing(text: string, maxCharacters: number): string {
  if (text.length <= maxCharacters) {
    return text;
  }
  return text.slice(0, maxCharacters);
}

function sanitizeCompletion(completion: string, afterText: string): string {
  let sanitized = completion.replace(/\r/g, "").replace(/\u0000/g, "");

  const overlapLength = computeOverlap(sanitized, afterText);
  if (overlapLength > 0) {
    sanitized = sanitized.slice(0, sanitized.length - overlapLength);
  }

  // Avoid returning only whitespace
  if (sanitized.trim().length === 0) {
    return "";
  }

  return sanitized;
}

function computeOverlap(completion: string, afterText: string): number {
  const max = Math.min(completion.length, afterText.length);
  for (let length = max; length > 0; length--) {
    if (completion.slice(-length) === afterText.slice(0, length)) {
      return length;
    }
  }
  return 0;
}

async function requestInlineCompletion(
  viewProvider: ChatGptViewProvider,
  languageId: string,
  beforeText: string,
  afterText: string,
  abortSignal: AbortSignal,
  maxOutputTokens: number,
): Promise<string | undefined> {
  if (viewProvider.apiChat) {
    const userPrompt =
      `Continue the following ${languageId} code. ` +
      "Return only the additional code that should appear at the cursor.\n\n" +
      "<before>\n" +
      beforeText +
      "\n</before>\n" +
      "<after>\n" +
      afterText +
      "\n</after>";

    const result = streamText({
      model: viewProvider.apiChat as any,
      system: buildSystemPrompt(viewProvider),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
      maxOutputTokens,
      temperature: 0.2,
      abortSignal,
      headers: getHeaders(),
    });

    let completion = "";
    for await (const part of result.textStream) {
      completion += part;
    }

    return sanitizeCompletion(completion, afterText);
  }

  if (viewProvider.apiCompletion) {
    const completionPrompt =
      `${INLINE_SYSTEM_PROMPT}\n\n` +
      `The user is editing a ${languageId} file. Complete the code at the cursor.\n\n` +
      "Before:\n" +
      beforeText +
      "\n<cursor/>\nAfter:\n" +
      afterText +
      "\nCompletion:";

    const result = streamText({
      model: viewProvider.apiCompletion as any,
      prompt: completionPrompt,
      maxOutputTokens,
      temperature: 0.2,
      abortSignal,
      headers: getHeaders(),
    });

    let completion = "";
    for await (const part of result.textStream) {
      completion += part;
    }

    return sanitizeCompletion(completion, afterText);
  }

  return undefined;
}

function buildSystemPrompt(viewProvider: ChatGptViewProvider): string | undefined {
  const parts: string[] = [];
  if (viewProvider.modelConfig?.systemPrompt) {
    parts.push(viewProvider.modelConfig.systemPrompt);
  }
  parts.push(INLINE_SYSTEM_PROMPT);
  return parts.join("\n\n");
}

class ChatGptInlineCompletionProvider
  implements vscode.InlineCompletionItemProvider
{
  constructor(private readonly viewProvider: ChatGptViewProvider) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionList | undefined> {
    const configuration = vscode.workspace.getConfiguration("chatgpt");
    const enabled = configuration.get<boolean>("inlineCompletion.enabled", true);
    if (!enabled) {
      return undefined;
    }

    if (!(await this.viewProvider.prepareConversation())) {
      return undefined;
    }

    if (!this.viewProvider.apiChat && !this.viewProvider.apiCompletion) {
      return undefined;
    }

    const beforeRange = new vscode.Range(new vscode.Position(0, 0), position);
    const afterRange = new vscode.Range(
      position,
      getDocumentSuffixPosition(document),
    );

    const beforeText = truncateLeading(
      document.getText(beforeRange),
      MAX_BEFORE_CHARACTERS,
    );
    const afterText = truncateTrailing(
      document.getText(afterRange),
      MAX_AFTER_CHARACTERS,
    );

    if (beforeText.trim().length === 0 && afterText.trim().length === 0) {
      return undefined;
    }

    const abortController = new AbortController();
    token.onCancellationRequested(() => abortController.abort());

    const maxTokensSetting = configuration.get<number>(
      "inlineCompletion.maxTokens",
      DEFAULT_MAX_OUTPUT_TOKENS,
    );
    const maxOutputTokens = Math.max(1, maxTokensSetting || DEFAULT_MAX_OUTPUT_TOKENS);

    try {
      const completion = await requestInlineCompletion(
        this.viewProvider,
        document.languageId,
        beforeText,
        afterText,
        abortController.signal,
        maxOutputTokens,
      );

      if (!completion) {
        return undefined;
      }

      const item = new vscode.InlineCompletionItem(
        completion,
        new vscode.Range(position, position),
      );
      return new vscode.InlineCompletionList([item]);
    } catch (error) {
      if (abortController.signal.aborted) {
        return undefined;
      }
      logger.appendLine(`ERROR: inline completion failed: ${error}`);
      return undefined;
    }
  }
}

export function registerInlineCompletionProvider(
  context: vscode.ExtensionContext,
  viewProvider: ChatGptViewProvider,
): void {
  const provider = new ChatGptInlineCompletionProvider(viewProvider);
  const registration = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: "**/*" },
    provider,
  );
  context.subscriptions.push(registration);
}
