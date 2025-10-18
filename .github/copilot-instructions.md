# CodeArt VS Code Extension - AI Agent Guidelines

## Project Overview

CodeArt is a VS Code extension providing AI-powered code assistance with support for 15+ providers (OpenAI, Anthropic, Google, GitHub Copilot, etc.). The extension implements three distinct chat modes (Agent, Ask, Plan) with Model Context Protocol (MCP) integration and specialized features like DeepClaude (reasoning + chat) and Claude Code integration.

## Architecture & Key Components

### Core Extension Structure

- **Entry Point**: `src/extension.ts` - Activates extension, registers commands, and initializes providers
- **Main Provider**: `src/codeart-view-provider.ts` (2055 lines) - Central orchestrator managing chat state, model initialization, and webview communication
- **Webview UI**: `media/main.js` + `media/main.css` - Client-side rendering with marked.js for markdown, highlight.js for syntax highlighting

### Chat Mode System (3 Modes)

Defined in `src/types.ts`:

- **Agent Mode**: Full tool access with iterative plan-act-observe loop (ReAct-style)
- **Ask Mode**: Read-only exploration without file modifications
- **Plan Mode**: ReWOO-style planning that drafts multi-step plans before execution

Mode switching via `setChatMode()` in `codeart-view-provider.ts` triggers MCP server lifecycle management (closes/reopens servers when toggling between tool-enabled and read-only modes).

### Multi-Provider Model Initialization

Models are initialized through provider-specific functions in `src/llms.ts`:

- Each provider has `init{Provider}Model()` function (e.g., `initClaudeModel()`, `initGeminiModel()`)
- Special providers: `chatClaudeCode()` in `src/claude-code.ts`, `chatCopilot()` in `src/github-copilot.ts`
- Configuration via `ModelConfig` class (`src/model-config.ts`) with proxy support, search grounding, and reasoning flags

### Tool System & MCP Integration

- **MCP Setup**: `src/mcp.ts` - Creates tool sets from MCP servers (stdio, SSE, streamable-http transports)
- **Tool Utilities**: `src/tool-utils.ts` - Adds web search tools (Google Search, Anthropic Web Search) when `searchGrounding` enabled
- **Prompt-Based Tools**: `src/prompt-based-tools.ts` - XML-based tool call parsing for models without native tool support (uses `<tool_use>` tags)
- MCP servers configured via webview UI (`src/mcp-server-provider.ts`), stored in extension global state

### Specialized Modes

- **DeepClaude**: `src/deepclaude.ts` - Two-stage reasoning: (1) reasoning model generates thoughts, (2) chat model uses reasoning for response
- **Plan Mode**: `src/plan-mode.ts` - ReWOO implementation with Orchestrator → Planner → Solver workflow, read-only tool execution
- **Claude Code**: `src/claude-code.ts` - SOLO mode integration converting VS Code messages to Claude Code SDK format

### Webview Communication Pattern

Extension ↔ Webview via `postMessage`:

- **Extension→Webview**: `sendMessage()` method with typed messages (`addResponse`, `addQuestion`, `showInProgress`, etc.)
- **Webview→Extension**: `onDidReceiveMessage()` handlers in `resolveWebviewView()`
- Message queuing system in `media/main.js` ensures ordered processing using sequence numbers
- Context includes file attachments (text + images as base64) stored in `conversationContext.files`

## Development Workflows

### Build & Watch

```bash
# Build once (with sourcemaps)
yarn build

# Watch mode (auto-rebuild on changes)
yarn watch

# Format + lint + typecheck
yarn fmt
```

TypeScript compiles `src/extension.ts` to `out/extension.js` via esbuild (bundle mode, CommonJS). Extension activates with `onStartupFinished` event.

### Running the Extension

Press **F5** in VS Code to launch Extension Development Host. The extension appears in the activity bar with CodeArt icon. Set API keys via settings (search `@ext:pywind.codeart`).

### Key Configuration Points

Located in `package.json` contributes section:

- `codeart.gpt.provider`: Provider selection (Auto/OpenAI/Anthropic/etc.)
- `codeart.gpt.model`: Model name with 60+ options
- `codeart.gpt.apiKey`: API key for provider
- `codeart.systemPrompt`: System prompt override
- `codeart.gpt.searchGrounding`: Enable web search tools

## Project-Specific Patterns

### Multi-Model Reasoning Pattern

When `reasoningChat()` is invoked (DeepClaude mode):

1. Stream from reasoning model (DeepSeek R1 or o1) with `thinking` blocks
2. Extract reasoning text and add to chat history as assistant message
3. Stream from chat model (Claude) using reasoning context
4. Update UI with both reasoning (collapsible) and response

See `src/deepclaude.ts:60-150` for implementation.

### Prompt-Based Tool Calls

For models without native tool support, tools are described in XML format, then parsed from responses:

```typescript
// Tool description injected into system prompt
generateToolDescriptions(toolSet); // → XML schema

// Parse response for <tool_use> tags
parseToolCalls(text); // → PromptBasedToolCall[]

// Execute and return <tool-result>
executePromptToolCall(toolCall, toolSet);
```

Implemented in `src/prompt-based-tools.ts`. Enabled when model doesn't support native tool calling.

### Chat History Management

`chatHistory: ModelMessage[]` maintained in `CodeArtViewProvider`:

- User messages include text + optional images (as base64 data URLs)
- Assistant messages include tool calls and text responses
- File attachments merged into user message before sending
- Clear with "Reset session" command

### Inline Completions

`src/inline-completion-provider.ts` provides tab-completion suggestions using the configured model. Triggered on typing, respects debounce timing from settings.

## Critical Integration Points

### Vercel AI SDK

Extension uses Vercel AI SDK v5.x (`ai` package) for unified model interface:

- `streamText()` for streaming responses with tool support
- Compatible with both v1 and v2 language models via `CompatibleLanguageModel` type
- Special handling for reasoning models (o1/o3, DeepSeek R1) with `reasoningEffort` parameter

### MCP Server Lifecycle

When changing between modes or updating MCP settings:

1. Close existing MCP clients via `closeMCPServers()`
2. Re-initialize with `createToolSet()` if mode allows tools
3. Send `mcpServersUpdate` message to webview with tool count

See `setChatMode()` and `prepareConversation()` in `codeart-view-provider.ts`.

### GitHub Copilot Integration

When provider is `GitHubCopilot`:

- Uses VS Code's native `vscode.lm` API
- Model selection via `vscode.lm.selectChatModels()` with family/version filtering
- Streaming via `model.sendRequest()` with tool support
- Implemented in `src/github-copilot.ts`

## Common Gotchas

1. **Model Name Mapping**: Azure models strip dots (`.` → ``), handle in provider initialization
2. **Tool Mode Gates**: Always check `modeAllowsTools()` before accessing `toolSet`
3. **Message Ordering**: Webview uses sequence numbers (`contentSequence`) to ensure in-order rendering, especially for tool results
4. **Reasoning Models**: Detect via `isReasoningModel()` to disable temperature/top_p and enable special handling
5. **Claude Code Sessions**: Persistent via `claudeCodeSessionId`, requires manual `.quit` file for termination

## Testing & Validation

- Run `yarn test` (executes lint + typecheck, no unit tests currently)
- Manual testing via Extension Development Host (F5)
- Check logs in "CodeArt" output channel for debugging
- Use "CodeArt: Debug Stored Prompts" command to inspect prompt storage

## Additional Context

- **Prompt Manager**: Separate webview panel for managing custom prompts, searchable with `#` in chat
- **Export Conversations**: Downloads full chat history as markdown with metadata
- **Context Menu Actions**: 10 configurable quick actions (generate code, add tests, find bugs, etc.)
- **Keyboard Shortcuts**: `Ctrl+.` cycles through chat modes, `Ctrl+Shift+A` generates code from selection
