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
export interface Prompt {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface PromptStore {
  prompts: Prompt[];
}

import type { ModelMessage } from "ai";

export type ChatMode = "agent" | "ask" | "plan";

export interface ChatModeDefinition {
  id: ChatMode;
  label: string;
  description: string;
  allowsEdits: boolean;
  allowsFileAttachments: boolean;
}

export const CHAT_MODE_DEFINITIONS: Record<ChatMode, ChatModeDefinition> = {
  agent: {
    id: "agent",
    label: "Agent",
    description:
      "Iterative plan-act workflow with full tool access, workspace edits, and command execution.",
    allowsEdits: true,
    allowsFileAttachments: true,
  },
  ask: {
    id: "ask",
    label: "Ask",
    description:
      "Read-only exploration for answering questions without modifying files or running tools.",
    allowsEdits: false,
    allowsFileAttachments: true,
  },
  plan: {
    id: "plan",
    label: "Plan",
    description:
      "Up-front planning assistant that drafts multi-step implementation plans without editing files.",
    allowsEdits: false,
    allowsFileAttachments: true,
  },
};

export const CHAT_MODE_SEQUENCE: ChatMode[] = ["agent", "ask", "plan"];

export function isChatMode(value: unknown): value is ChatMode {
  return value === "agent" || value === "ask" || value === "plan";
}

export function isOpenAIOModel(model: string) {
  const m = model.toLowerCase();
  return (
    m.includes("o1") ||
    m.includes("o3") ||
    m.includes("o4") ||
    m.includes("gpt-5")
  );
}

export function isReasoningModel(model: string) {
  const m = model.toLowerCase();
  return (
    isOpenAIOModel(model) ||
    m.includes("deepseek-r1") ||
    m.includes("reason") ||
    m.includes("claude-3-7") ||
    m.includes("qwen3")
  );
}

export type PlanSessionStatus =
  | "orchestrating"
  | "awaiting_clarifications"
  | "planning"
  | "executing_tools"
  | "solving"
  | "completed";

export interface PlanClarification {
  question: string;
  answer: string;
}

export interface PlanToolExecution {
  id: string;
  tool: string;
  argument: string;
  output: string;
  error?: string;
}

export interface PlanSession {
  id: string;
  createdAt: number;
  task: string;
  taskHistory: string[];
  status: PlanSessionStatus;
  clarifications: PlanClarification[];
  pendingClarification?: string;
  planMarkdown?: string;
  solverSummary?: string;
  toolExecutions: PlanToolExecution[];
  planFilePath?: string;
  orchestratorMessages: ModelMessage[];
}

// Prompt-based tool call types
export interface PromptBasedToolCall {
  id: string;
  toolName: string;
  arguments: Record<string, any>;
  rawText: string;
}

export interface PromptBasedToolResult {
  id: string;
  toolName: string;
  result: any;
  error?: string;
}

export interface PromptBasedToolConfig {
  enabled: boolean;
  toolCallPattern: string;
  maxToolCalls: number;
}
