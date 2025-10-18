/**
 *
 * @license
 * Copyright (c) 2022 - 2023, Ali Gençay
 * Copyright (c) 2024 - Present, Pengfei Ni
 *
 * All rights reserved. Code licensed under the ISC license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import * as vscode from "vscode";
import CodeArtViewProvider from "./codeart-view-provider";
// import { registerMCPToolsWithVSCode } from './github-copilot';
import { registerInlineCompletionProvider } from "./inline-completion-provider";
import MCPServerProvider from "./mcp-server-provider";
import PromptManagerProvider from "./prompt-manager-provider";
import { PromptStore } from "./types";

const menuCommands = [
  "addTests",
  "findProblems",
  "optimize",
  "explain",
  "addComments",
  "completeCode",
  "generateCode",
  "customPrompt1",
  "customPrompt2",
  "adhoc",
];

export async function activate(context: vscode.ExtensionContext) {
  let adhocCommandPrefix: string =
    context.globalState.get("codeart-adhoc-prompt") || "";

  const provider = new CodeArtViewProvider(context);

  registerInlineCompletionProvider(context, provider);

  const view = vscode.window.registerWebviewViewProvider(
    "codeart.view",
    provider,
    {
      webviewOptions: {
        retainContextWhenHidden: true,
      },
    },
  );

  const freeText = vscode.commands.registerCommand(
    "codeart.freeText",
    async () => {
      const value = await vscode.window.showInputBox({
        prompt: "Ask anything...",
      });

      if (value) {
        provider?.sendApiRequest(value, { command: "freeText" });
      }
    },
  );

  const resetThread = vscode.commands.registerCommand(
    "codeart.clearConversation",
    async () => {
      provider?.sendMessage({ type: "clearConversation" }, true);
    },
  );

  const exportConversation = vscode.commands.registerCommand(
    "codeart.exportConversation",
    async () => {
      provider?.sendMessage({ type: "exportConversation" }, true);
    },
  );

  const clearSession = vscode.commands.registerCommand(
    "codeart.clearSession",
    () => {
      context.globalState.update("codeart-session-token", null);
      context.globalState.update("codeart-clearance-token", null);
      context.globalState.update("codeart-user-agent", null);
      context.globalState.update("codeart-gpt3-apiKey", null);
      provider?.clearSession();
      provider?.sendMessage({ type: "clearConversation" }, true);
    },
  );

  const configChanged = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration("codeart.response.showNotification")) {
      provider.subscribeToResponse =
        vscode.workspace
          .getConfiguration("codeart")
          .get("response.showNotification") || false;
    }

    if (e.affectsConfiguration("codeart.response.autoScroll")) {
      provider.autoScroll = !!vscode.workspace
        .getConfiguration("codeart")
        .get("response.autoScroll");
    }

    if (e.affectsConfiguration("codeart.gpt.model")) {
      provider.model = vscode.workspace
        .getConfiguration("codeart")
        .get("gpt.model");
    }

    if (e.affectsConfiguration("codeart.gpt.customModel")) {
      if (provider.model === "custom") {
        provider.model = vscode.workspace
          .getConfiguration("codeart")
          .get("gpt.customModel");
      }
    }

    if (
      e.affectsConfiguration("codeart.gpt.provider") ||
      e.affectsConfiguration("codeart.gpt.apiBaseUrl") ||
      e.affectsConfiguration("codeart.gpt.model") ||
      e.affectsConfiguration("codeart.gpt.apiKey") ||
      e.affectsConfiguration("codeart.gpt.customModel") ||
      e.affectsConfiguration("codeart.gpt.organization") ||
      e.affectsConfiguration("codeart.gpt.maxTokens") ||
      e.affectsConfiguration("codeart.gpt.temperature") ||
      e.affectsConfiguration("codeart.gpt.claudeCodePath") ||
      e.affectsConfiguration("codeart.gpt.reasoning.provider") ||
      e.affectsConfiguration("codeart.reasoning.model") ||
      e.affectsConfiguration("codeart.reasoning.apiKey") ||
      e.affectsConfiguration("codeart.reasoning.enabled") ||
      e.affectsConfiguration("codeart.systemPrompt") ||
      e.affectsConfiguration("codeart.gpt.top_p")
    ) {
      provider.prepareConversation(true);
    }

    if (
      e.affectsConfiguration("codeart.promptTemplates") ||
      e.affectsConfiguration("codeart.contextMenu.enabledActions") ||
      e.affectsConfiguration("codeart.gpt.generateCode-enabled") ||
      e.affectsConfiguration("codeart.gpt.model")
    ) {
      setContext();
    }
  });

  const adhocCommand = vscode.commands.registerCommand(
    "codeart.adhoc",
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const selection = editor.document.getText(editor.selection);
      let dismissed = false;
      if (selection) {
        await vscode.window
          .showInputBox({
            title: "Add prefix to your ad-hoc command",
            prompt:
              "Prefix your code with your custom prompt. i.e. Explain this",
            ignoreFocusOut: true,
            placeHolder: "Ask anything...",
            value: adhocCommandPrefix,
          })
          .then((value) => {
            if (!value) {
              dismissed = true;
              return;
            }

            adhocCommandPrefix = value.trim() || "";
            context.globalState.update(
              "codeart-adhoc-prompt",
              adhocCommandPrefix,
            );
          });

        if (!dismissed && adhocCommandPrefix?.length > 0) {
          provider?.sendApiRequest(adhocCommandPrefix, {
            command: "adhoc",
            code: selection,
          });
        }
      }
    },
  );

  const generateCodeCommand = vscode.commands.registerCommand(
    `codeart.generateCode`,
    () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        return;
      }

      const selection = editor.document.getText(editor.selection);
      if (selection) {
        provider?.sendApiRequest(selection, {
          command: "generateCode",
          language: editor.document.languageId,
        });
      }
    },
  );

  // Skip AdHoc - as it was registered earlier
  const registeredCommands = menuCommands
    .filter((command) => command !== "adhoc" && command !== "generateCode")
    .map((command) =>
      vscode.commands.registerCommand(`codeart.${command}`, () => {
        const config = vscode.workspace.getConfiguration("codeart");
        const enabledActions = config.get<string[]>("contextMenu.enabledActions", [
          "generateCode", "addTests", "findProblems", "optimize", "explain", "addComments", "completeCode", "adhoc"
        ]);

        // Check if this action is enabled
        if (!enabledActions.includes(command)) {
          return;
        }

        const promptTemplates = config.get<Record<string, string>>("promptTemplates", {
          "addTests": "Implement tests for the following code",
          "findProblems": "Find problems with the following code",
          "optimize": "Optimize the following code",
          "explain": "Explain the following code",
          "addComments": "Add comments for the following code",
          "completeCode": "Complete the following code"
        });

        const prompt = promptTemplates[command];
        const editor = vscode.window.activeTextEditor;

        if (!editor) {
          return;
        }

        const selection = editor.document.getText(editor.selection);
        if (selection && prompt) {
          provider?.sendApiRequest(prompt, {
            command,
            code: selection,
            language: editor.document.languageId,
          });
        }
      }),
    );

  const promptManager = new PromptManagerProvider(context);
  const promptManagerView = vscode.window.registerWebviewViewProvider(
    "codeart.promptManager",
    promptManager,
  );

  const managePrompts = vscode.commands.registerCommand(
    "codeart.managePrompts",
    async () => {
      await vscode.commands.executeCommand(
        "codeart.promptManager.focus",
      );
    },
  );

  const debugPrompts = vscode.commands.registerCommand(
    "codeart.debugPrompts",
    async () => {
      const prompts = context.globalState.get<PromptStore>("prompts");
      vscode.window.showInformationMessage(
        `Stored prompts: ${JSON.stringify(prompts, null, 2)}`,
      );
    },
  );

  const togglePromptManager = vscode.commands.registerCommand(
    "codeart.togglePromptManager",
    async () => {
      const panel = vscode.window.createWebviewPanel(
        "codeart.promptManager",
        "CodeArt: Prompt Manager",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [context.extensionUri],
        },
      );

      const promptManager = new PromptManagerProvider(context);
      promptManager.setPanel(panel);
      panel.webview.html = promptManager.getWebviewContent(panel.webview);

      panel.webview.onDidReceiveMessage(async (data) => {
        switch (data.type) {
          case "addPrompt":
            promptManager.addPrompt(data.prompt);
            break;
          case "updatePrompt":
            promptManager.updatePrompt(data.prompt);
            break;
          case "deletePrompt":
            promptManager.deletePrompt(data.id);
            break;
          case "getPrompts":
            panel.webview.postMessage({
              type: "updatePrompts",
              prompts: promptManager.getPrompts(),
            });
            break;
        }
      });

      panel.onDidDispose(() => {
        promptManager.setPanel(undefined);
      });
    },
  );

  let addCurrentFileCommand = vscode.commands.registerCommand(
    "codeart.addCurrentFile",
    () => {
      provider.addCurrentFileToContext();
    },
  );

  const mcpServerProvider = new MCPServerProvider(context);
  const mcpServerView = vscode.window.registerWebviewViewProvider(
    "codeart.mcpServers",
    mcpServerProvider,
  );

  const openMCPServers = vscode.commands.registerCommand(
    "codeart.openMCPServers",
    () => {
      const panel = vscode.window.createWebviewPanel(
        "codeart.mcpServers",
        "CodeArt: MCP Servers",
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [context.extensionUri],
        },
      );

      panel.webview.html = mcpServerProvider.getWebviewContent(panel.webview);
      mcpServerProvider.setPanel(panel);

      panel.onDidDispose(() => {
        mcpServerProvider.setPanel(undefined);
      });

      panel.webview.onDidReceiveMessage(async (data) => {
        switch (data.type) {
          case "addServer":
            mcpServerProvider.addServer(data.server);
            break;
          case "updateServer":
            mcpServerProvider.updateServer(data.server);
            break;
          case "deleteServer":
            mcpServerProvider.deleteServer(data.id);
            break;
          case "toggleServerEnabled":
            mcpServerProvider.toggleServerEnabled(data.id);
            break;
          case "getServers":
            panel.webview.postMessage({
              type: "updateServers",
              servers: mcpServerProvider.getServers(),
            });
            break;
        }
      });
    },
  );

  const openSettings = vscode.commands.registerCommand(
    "codeart.openSettings",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.openSettings",
        "@ext:pywind.codeart",
      );
    },
  );

  const setAgentMode = vscode.commands.registerCommand(
    "codeart.setMode.agent",
    () => provider.setChatMode("agent"),
  );

  const setAskMode = vscode.commands.registerCommand(
    "codeart.setMode.ask",
    () => provider.setChatMode("ask"),
  );

  const setPlanMode = vscode.commands.registerCommand(
    "codeart.setMode.plan",
    () => provider.setChatMode("plan"),
  );

  const cycleMode = vscode.commands.registerCommand(
    "codeart.cycleChatMode",
    () => provider.cycleChatMode(),
  );

  context.subscriptions.push(
    view,
    freeText,
    resetThread,
    exportConversation,
    clearSession,
    configChanged,
    adhocCommand,
    generateCodeCommand,
    ...registeredCommands,
    promptManagerView,
    managePrompts,
    debugPrompts,
    togglePromptManager,
    addCurrentFileCommand,
    mcpServerView,
    openMCPServers,
    openSettings,
    setAgentMode,
    setAskMode,
    setPlanMode,
    cycleMode,
  );

  const setContext = () => {
    const config = vscode.workspace.getConfiguration("codeart");
    const enabledActions = config.get<string[]>("contextMenu.enabledActions", [
      "generateCode", "addTests", "findProblems", "optimize", "explain", "addComments", "completeCode", "adhoc"
    ]);

    menuCommands.forEach((command) => {
      if (command === "generateCode") {
        const enabledByMenu = enabledActions.includes(command);
        const modelName = config.get<string>("gpt.model") || "";
        const generateCodeEnabled =
          enabledByMenu && modelName.startsWith("code-");
        vscode.commands.executeCommand(
          "setContext",
          "generateCode-enabled",
          generateCodeEnabled,
        );
      } else {
        const enabled = enabledActions.includes(command);
        vscode.commands.executeCommand(
          "setContext",
          `${command}-enabled`,
          enabled,
        );
      }
    });
  };

  setContext();
}

export function deactivate() { }
