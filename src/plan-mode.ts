
/**
 *
 * @license
 * Copyright (c) 2024 - Present, Pengfei Ni
 *
 * All rights reserved. Code licensed under the ISC license
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import { ModelMessage, stepCountIs, streamText } from "ai";
import type { Stats } from "fs";
import { promises as fs } from "fs";
import path from "path";

import CodeArtViewProvider from "./codeart-view-provider";
import { logger } from "./logger";
import { getHeaders } from "./model-config";
import {
  PlanClarification,
  PlanSession,
  PlanToolExecution,
  isOpenAIOModel,
} from "./types";

const ORCHESTRATOR_SYSTEM_PROMPT = `You are the 🧠 Orchestrator within a ReWOO agent. Your job is to decide whether more details are needed before planning.
Respond **only** in JSON using one of the following structures:
{"action":"clarify","question":"<single clarifying question>","reasoning":"<why the question is needed>"}
{"action":"proceed","summary":"<one sentence summary of the task>","reasoning":"<why planning can proceed>"}
Ask at most one question per turn and wait for the user response before planning.`;

const PLANNER_SYSTEM_PROMPT = `You are the 🧠 Planner module within a ReWOO agent. Produce an actionable implementation plan using the exact alternating format:
Plan: <short reasoning sentence>
#E1 = <ToolName>[<arguments>]
Plan: <reasoning that references #E1 results when useful>
#E2 = <ToolName>[<arguments possibly containing #E1, #E2, ... substitutions>]
...
Only use the tools listed in the context. Do not execute tools or provide the final answer. Focus on concrete engineering steps that an agent can follow. Generate at least three Plan/#E pairs when possible.`;

const SOLVER_SYSTEM_PROMPT = `You are the 🧠 Solver module within a ReWOO agent. Using the task, clarified requirements, generated plan, and tool observations, synthesize a clear answer that prepares the developer to implement the solution. Provide markdown with sections: ## Summary, ## Next Steps, ## Validation. Do not restate the raw plan lines verbatim; highlight the intention behind them.`;

const TOOL_DESCRIPTIONS = `Available read-only tools:
- ListFiles[path] -> lists files and directories within the workspace path
- ReadFile[path] -> returns the contents of a file from the workspace
- SearchText[pattern | path] -> finds up to 40 matches for pattern within the path (defaults to workspace root)`;

const MAX_TOOL_OUTPUT = 2000;

interface OrchestratorDecision {
  action: "clarify" | "proceed";
  question?: string;
  summary?: string;
  reasoning?: string;
}

function sanitizeJson(text: string): string {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function parseOrchestratorDecision(raw: string): OrchestratorDecision {
  const cleaned = sanitizeJson(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed?.action === "clarify" && typeof parsed.question === "string") {
      return {
        action: "clarify",
        question: parsed.question.trim(),
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
      };
    }
    if (parsed?.action === "proceed") {
      return {
        action: "proceed",
        summary: typeof parsed.summary === "string" ? parsed.summary.trim() : undefined,
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
      };
    }
  } catch (error) {
    logger.appendLine(
      `WARN: Unable to parse orchestrator decision, falling back to proceed. Raw output: ${cleaned} Error: ${error}`,
    );
  }
  return { action: "proceed", summary: cleaned };
}

async function runModel(
  provider: CodeArtViewProvider,
  model: any,
  modelName: string,
  systemPrompt: string,
  messages: ModelMessage[],
  updateReasoning: (text: string, roundNumber?: number) => void,
  stageNumber: number,
  maxSteps: number,
): Promise<{ text: string; }> {
  const result = streamText({
    system: systemPrompt,
    model,
    messages,
    abortSignal: provider.abortController?.signal,
    headers: getHeaders(),
    stopWhen: stepCountIs(maxSteps),
    ...(isOpenAIOModel(modelName) && {
      providerOptions: {
        openai: {
          reasoningSummary: "auto",
          reasoningEffort: provider.reasoningEffort,
          ...(provider.modelConfig.maxTokens > 0 && {
            maxCompletionTokens: provider.modelConfig.maxTokens,
          }),
        },
      },
    }),
    ...(!isOpenAIOModel(modelName) && {
      maxOutputTokens:
        provider.modelConfig.maxTokens > 0
          ? provider.modelConfig.maxTokens
          : undefined,
      temperature: provider.modelConfig.temperature,
    }),
  });

  const chunks: string[] = [];
  const reasoningChunks: string[] = [];

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      chunks.push(part.text);
    } else if (part.type === "reasoning-delta") {
      reasoningChunks.push(part.text);
    }
  }

  let reasoningText = reasoningChunks.join("");
  try {
    const finalReasoning = await result.reasoningText;
    if (finalReasoning) {
      reasoningText = finalReasoning;
    }
  } catch (error) {
    // Ignore reasoning aggregation errors and fall back to streamed content.
  }

  if (reasoningText) {
    updateReasoning(reasoningText, stageNumber);
  }

  return { text: chunks.join("").trim() };
}

function buildPlannerMessages(session: PlanSession): ModelMessage[] {
  const additionalInputs = session.taskHistory
    .slice(1)
    .map((entry, index) => `Update ${index + 1}: ${entry}`)
    .join("\n");

  const clarifications = session.clarifications
    .map(
      (clarification, index) =>
        `${index + 1}. ${clarification.question}\nAnswer: ${clarification.answer}`,
    )
    .join("\n");

  const promptSections = [
    `Primary task:\n${session.task}`,
    additionalInputs ? `Additional user input:\n${additionalInputs}` : "",
    clarifications ? `Clarifications answered:\n${clarifications}` : "",
    TOOL_DESCRIPTIONS,
    "Follow the required Plan/#E alternating format and keep tools strictly read-only.",
  ].filter(Boolean);

  return [
    {
      role: "user",
      content: promptSections.join("\n\n"),
    },
  ];
}

function buildSolverMessages(session: PlanSession): ModelMessage[] {
  const clarifications = session.clarifications
    .map(
      (clarification, index) =>
        `${index + 1}. ${clarification.question}\nAnswer: ${clarification.answer}`,
    )
    .join("\n");

  const toolObservations = session.toolExecutions
    .map(
      (execution) =>
        `${execution.id} ${execution.tool}[${execution.argument}] => ${execution.error ? `ERROR: ${execution.error}` : execution.output
        }`,
    )
    .join("\n\n");

  const promptSections = [
    `Primary task:\n${session.task}`,
    session.taskHistory.length > 1
      ? `Additional user input:\n${session.taskHistory
        .slice(1)
        .map((entry, index) => `Update ${index + 1}: ${entry}`)
        .join("\n")}`
      : "",
    clarifications ? `Clarifications:\n${clarifications}` : "Clarifications: none provided.",
    session.planMarkdown ? `Plan:\n${session.planMarkdown}` : "Plan: not available.",
    toolObservations ? `Tool observations:\n${toolObservations}` : "Tool observations: none executed.",
  ].filter(Boolean);

  return [
    {
      role: "user",
      content: promptSections.join("\n\n"),
    },
  ];
}

function buildClarifyingResponse(
  question: string,
  clarifications: PlanClarification[],
): string {
  const history = clarifications
    .map(
      (entry, index) =>
        `${index + 1}. **${entry.question}**\n   - ${entry.answer}`,
    )
    .join("\n");

  const historyBlock = history ? `\n\nCurrent clarifications:\n${history}` : "";

  return `### Clarifying Question\n${question}${historyBlock}\n\nPlease reply with the requested details so the planner can continue.`;
}

function truncateOutput(value: string): string {
  if (value.length <= MAX_TOOL_OUTPUT) {
    return value;
  }
  return `${value.slice(0, MAX_TOOL_OUTPUT)}\n... (truncated ${value.length - MAX_TOOL_OUTPUT
    } characters)`;
}

async function listFiles(provider: CodeArtViewProvider, argument: string) {
  const resolved = provider.resolveWorkspacePath(argument || ".");
  if (!resolved) {
    return "Workspace folder is not available for ListFiles.";
  }

  try {
    const entries = await fs.readdir(resolved, { withFileTypes: true });
    if (!entries.length) {
      return "(empty directory)";
    }

    const workspaceRoot = provider.resolveWorkspacePath(".") || resolved;
    const relativeBase = path.relative(workspaceRoot, resolved) || ".";

    return entries
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => `${relativeBase}/${entry.name}${entry.isDirectory() ? "/" : ""}`)
      .join("\n");
  } catch (error: any) {
    return `ListFiles error: ${error?.message ?? error}`;
  }
}

async function readFile(provider: CodeArtViewProvider, argument: string) {
  const resolved = provider.resolveWorkspacePath(argument);
  if (!resolved) {
    return "Unable to resolve path for ReadFile.";
  }

  try {
    const stats = await fs.stat(resolved);
    if (stats.isDirectory()) {
      return "ReadFile error: target is a directory.";
    }
    const data = await fs.readFile(resolved, "utf8");
    return truncateOutput(data);
  } catch (error: any) {
    return `ReadFile error: ${error?.message ?? error}`;
  }
}

async function searchText(provider: CodeArtViewProvider, argument: string) {
  const [pattern, rawPath] = argument.split("|").map((part) => part.trim());
  if (!pattern) {
    return "SearchText requires a pattern argument.";
  }

  const resolvedPath = provider.resolveWorkspacePath(rawPath || ".");
  if (!resolvedPath) {
    return "Unable to resolve search path inside the workspace.";
  }

  const workspaceRoot = provider.resolveWorkspacePath(".") || resolvedPath;
  const results: string[] = [];
  const queue: string[] = [resolvedPath];
  const visited = new Set<string>();
  const skipDirectories = new Set([
    ".git",
    "node_modules",
    ".turbo",
    ".next",
    "dist",
    "build",
  ]);

  let scannedFiles = 0;
  const maxFiles = 120;
  const maxResults = 40;
  const lowerPattern = pattern.toLowerCase();
  let regex: RegExp | null = null;

  try {
    regex = new RegExp(pattern, "i");
  } catch (error) {
    regex = null;
  }

  while (queue.length > 0 && scannedFiles < maxFiles && results.length < maxResults) {
    const current = queue.shift()!;
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    let stat: Stats;
    try {
      stat = await fs.stat(current);
    } catch (error) {
      continue;
    }

    if (stat.isDirectory()) {
      let entries: string[] = [];
      try {
        entries = await fs.readdir(current);
      } catch (error) {
        continue;
      }

      for (const entry of entries) {
        if (skipDirectories.has(entry)) {
          continue;
        }
        queue.push(path.join(current, entry));
      }
    } else if (stat.isFile()) {
      if (stat.size > 200_000) {
        continue;
      }

      scannedFiles++;
      let content: string;
      try {
        content = await fs.readFile(current, "utf8");
      } catch (error) {
        continue;
      }

      const lines = content.split(/\r?\n/);
      for (let index = 0; index < lines.length && results.length < maxResults; index++) {
        const line = lines[index];
        let match = false;
        if (regex) {
          regex.lastIndex = 0;
          match = regex.test(line);
        } else {
          match = line.toLowerCase().includes(lowerPattern);
        }

        if (match) {
          const relative = path.relative(workspaceRoot, current) || path.basename(current);
          results.push(`${relative}:${index + 1}: ${line.trim()}`);
        }
      }
    }
  }

  if (!results.length) {
    return "No results from SearchText.";
  }

  return truncateOutput(results.join("\n"));
}

async function executePlanTools(
  provider: CodeArtViewProvider,
  session: PlanSession,
): Promise<PlanToolExecution[]> {
  const executions: PlanToolExecution[] = [];
  const variables: Record<string, string> = {};
  const plan = session.planMarkdown || "";
  const regex = /^#E(\d+)\s*=\s*([A-Za-z0-9_]+)\[(.*)\]\s*$/gm;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(plan)) !== null) {
    const [, id, toolNameRaw, rawArgument] = match;
    const toolName = toolNameRaw.trim().toLowerCase();
    const resolvedArgument = rawArgument.replace(/#E(\d+)/g, (_token, referenceId) => {
      return variables[referenceId] ?? `#E${referenceId}`;
    });

    const execution: PlanToolExecution = {
      id: `#E${id}`,
      tool: toolNameRaw.trim(),
      argument: resolvedArgument.trim(),
      output: "",
    };

    try {
      let output = "";
      if (toolName === "listfiles") {
        output = await listFiles(provider, resolvedArgument.trim());
      } else if (toolName === "readfile") {
        output = await readFile(provider, resolvedArgument.trim());
      } else if (toolName === "searchtext") {
        output = await searchText(provider, resolvedArgument.trim());
      } else {
        execution.error = `Unsupported tool: ${toolNameRaw}`;
      }

      if (!execution.error) {
        execution.output = output;
        variables[id] = output;
      }
    } catch (error: any) {
      execution.error = error?.message ?? String(error);
    }

    executions.push(execution);
    session.toolExecutions = executions.slice();
    provider.sendPlanSessionUpdate(session);
  }

  return executions;
}

function buildPlanDocument(session: PlanSession): string {
  const lines: string[] = [];
  lines.push(`# Plan for ${session.task}`);
  lines.push("");
  lines.push(`Generated: ${new Date(session.createdAt).toISOString()}`);
  lines.push("");

  lines.push("## Clarifications");
  if (session.clarifications.length === 0) {
    lines.push("- None provided");
  } else {
    session.clarifications.forEach((clarification, index) => {
      lines.push(`${index + 1}. ${clarification.question}`);
      lines.push(`   - ${clarification.answer}`);
    });
  }
  lines.push("");

  lines.push("## Plan");
  lines.push("```text");
  lines.push(session.planMarkdown || "(planner did not return a plan)");
  lines.push("```");
  lines.push("");

  lines.push("## Tool Observations");
  if (session.toolExecutions.length === 0) {
    lines.push("- No tools executed");
  } else {
    session.toolExecutions.forEach((execution) => {
      lines.push(`- ${execution.id} ${execution.tool}[${execution.argument}]`);
      lines.push(
        execution.error
          ? `  - ERROR: ${execution.error}`
          : `  - ${execution.output}`,
      );
    });
  }
  lines.push("");

  lines.push("## Final Summary");
  if (session.solverSummary) {
    lines.push(session.solverSummary);
  } else {
    lines.push("Summary pending");
  }

  return lines.join("\n");
}

function formatClarificationsForResponse(clarifications: PlanClarification[]): string {
  if (!clarifications.length) {
    return "(none)";
  }

  return clarifications
    .map(
      (entry, index) =>
        `${index + 1}. **${entry.question}**\n   - ${entry.answer}`,
    )
    .join("\n");
}

function formatToolObservationsForResponse(executions: PlanToolExecution[]): string {
  if (!executions.length) {
    return "No tools were executed.";
  }

  return executions
    .map((execution) => {
      const body = execution.error
        ? `ERROR: ${execution.error}`
        : truncateOutput(execution.output);
      return `- ${execution.id} ${execution.tool}[${execution.argument}]\n  ${body}`;
    })
    .join("\n");
}

function buildFinalResponse(session: PlanSession): string {
  const clarificationsBlock = formatClarificationsForResponse(session.clarifications);
  const planBlock = session.planMarkdown
    ? `\n\n### Planner Draft\n\n\`\`\`text\n${session.planMarkdown}\n\`\`\``
    : "";

  const solverBlock = session.solverSummary
    ? `\n\n### Solver Summary\n${session.solverSummary}`
    : "";

  const toolBlock = `\n\n### Tool Observations\n${formatToolObservationsForResponse(
    session.toolExecutions,
  )}`;

  const storageLine = session.planFilePath
    ? `Plan saved to \`${session.planFilePath}\` and opened for editing.`
    : "Plan saved in memory (workspace folder not detected).";

  return `## Plan ready\n${storageLine}\n\n### Clarifications\n${clarificationsBlock}${planBlock}${toolBlock}${solverBlock}`;
}

export async function planModeChat(
  provider: CodeArtViewProvider,
  question: string,
  _images: Record<string, string>,
  startResponse: () => void,
  updateResponse: (text: string) => void,
  updateReasoning: (text: string, roundNumber?: number) => void,
): Promise<void> {
  startResponse();

  const trimmedQuestion = question.trim();
  const chatMessage: ModelMessage = {
    role: "user",
    content: trimmedQuestion,
  };
  provider.chatHistory.push(chatMessage);

  let session = provider.planSession;
  if (!session || session.status === "completed") {
    session = provider.startPlanSession(trimmedQuestion);
  }

  if (session.pendingClarification) {
    session.clarifications.push({
      question: session.pendingClarification,
      answer: trimmedQuestion,
    });
    session.pendingClarification = undefined;
    session.status = "orchestrating";
  } else if (session !== provider.planSession) {
    // Fresh session already initialized with initial task history.
  } else if (session.status === "orchestrating") {
    session.taskHistory.push(trimmedQuestion);
  } else if (session.status === "awaiting_clarifications") {
    session.taskHistory.push(trimmedQuestion);
  } else {
    session = provider.startPlanSession(trimmedQuestion);
  }

  session.orchestratorMessages.push({
    role: "user",
    content: trimmedQuestion,
  });
  provider.sendPlanSessionUpdate(session);

  const planModel = provider.apiReasoning ?? provider.apiChat;
  if (!planModel) {
    throw new Error("No chat model available for plan mode.");
  }

  const modelName = provider.model ?? "";
  const baseSystemPrompt = provider.modelConfig.systemPrompt
    ? `${provider.modelConfig.systemPrompt}\n\n`
    : "";

  try {
    const orchestratorMessages = session.orchestratorMessages.slice();
    const orchestratorResult = await runModel(
      provider,
      planModel,
      modelName,
      `${baseSystemPrompt}${ORCHESTRATOR_SYSTEM_PROMPT}`,
      orchestratorMessages,
      updateReasoning,
      1,
      Math.max(4, provider.maxSteps || 4),
    );

    const decision = parseOrchestratorDecision(orchestratorResult.text);

    if (decision.action === "clarify" && decision.question) {
      session.status = "awaiting_clarifications";
      session.pendingClarification = decision.question;
      session.orchestratorMessages.push({
        role: "assistant",
        content: decision.question,
      });
      provider.sendPlanSessionUpdate(session);

      const responseText = buildClarifyingResponse(
        decision.question,
        session.clarifications,
      );
      updateResponse(responseText);
      provider.response = responseText;
      provider.chatHistory.push({
        role: "assistant",
        content: responseText,
      });
      return;
    }

    session.status = "planning";
    provider.sendPlanSessionUpdate(session);

    const plannerMessages = buildPlannerMessages(session);
    const plannerResult = await runModel(
      provider,
      planModel,
      modelName,
      `${baseSystemPrompt}${PLANNER_SYSTEM_PROMPT}`,
      plannerMessages,
      updateReasoning,
      2,
      Math.max(8, provider.maxSteps || 8),
    );

    session.planMarkdown = plannerResult.text;
    provider.sendPlanSessionUpdate(session);

    session.status = "executing_tools";
    provider.sendPlanSessionUpdate(session);
    session.toolExecutions = await executePlanTools(provider, session);
    provider.sendPlanSessionUpdate(session);

    session.status = "solving";
    provider.sendPlanSessionUpdate(session);

    const solverMessages = buildSolverMessages(session);
    const solverResult = await runModel(
      provider,
      planModel,
      modelName,
      `${baseSystemPrompt}${SOLVER_SYSTEM_PROMPT}`,
      solverMessages,
      updateReasoning,
      3,
      Math.max(6, provider.maxSteps || 6),
    );

    session.solverSummary = solverResult.text;

    const planDocument = buildPlanDocument(session);
    await provider.persistPlanContent(session, planDocument);

    session.status = "completed";
    provider.sendPlanSessionUpdate(session);

    const finalResponse = buildFinalResponse(session);
    updateResponse(finalResponse);
    provider.response = finalResponse;
    provider.chatHistory.push({
      role: "assistant",
      content: finalResponse,
    });

    logger.appendLine(
      `INFO: plan.mode response complete for question: ${trimmedQuestion}`,
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      logger.appendLine(
        `INFO: plan.mode aborted for question: ${trimmedQuestion}`,
      );
      return;
    }

    logger.appendLine(
      `ERROR: plan.mode failed for question: ${trimmedQuestion} error: ${error}`,
    );
    provider.sendMessage({
      type: "addError",
      value:
        "Plan Mode failed to generate a plan. Check logs for additional details.",
      autoScroll: provider.autoScroll,
    });
  }
}
