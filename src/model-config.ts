/* eslint-disable @typescript-eslint/naming-convention */
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

import { MCPServer } from "./mcp-server-provider";

export class ModelConfig {
  public provider;
  public apiKey: string;
  public apiBaseUrl: string;
  public maxTokens: number;
  public temperature: number;
  public topP: number;
  public organization: string;
  public systemPrompt: string;
  public systemPromptOverride: string;
  public searchGrounding: boolean;
  public enableResponsesAPI: boolean;
  public isReasoning: boolean;
  public claudeCodePath: string;
  public enabledMCPServers: MCPServer[];
  public verifySsl: boolean;
  public proxyUrl: string;
  public proxyUsername: string;
  public proxyPassword: string;

  constructor({
    provider,
    apiKey,
    apiBaseUrl,
    maxTokens,
    temperature,
    topP,
    organization,
    systemPrompt,
    systemPromptOverride,
    searchGrounding,
    enableResponsesAPI,
    isReasoning,
    claudeCodePath,
    enabledMCPServers,
    verifySsl,
    proxyUrl,
    proxyUsername,
    proxyPassword,
  }: {
    provider: string;
    apiKey: string;
    apiBaseUrl: string;
    maxTokens: number;
    temperature: number;
    topP: number;
    organization: string;
    systemPrompt: string;
    systemPromptOverride?: string;
    searchGrounding?: boolean;
    enableResponsesAPI?: boolean;
    isReasoning?: boolean;
    claudeCodePath?: string;
    enabledMCPServers?: MCPServer[];
    verifySsl?: boolean;
    proxyUrl?: string;
    proxyUsername?: string;
    proxyPassword?: string;
  }) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.apiBaseUrl = apiBaseUrl;
    this.maxTokens = maxTokens;
    this.temperature = temperature;
    this.topP = topP;
    this.organization = organization;
    this.systemPrompt = systemPrompt;
    this.systemPromptOverride = systemPromptOverride ?? "";
    this.searchGrounding = searchGrounding ?? false;
    this.enableResponsesAPI = enableResponsesAPI ?? false;
    this.isReasoning = isReasoning ?? false;
    this.claudeCodePath = claudeCodePath ?? "";
    this.enabledMCPServers = enabledMCPServers ?? [];
    this.verifySsl = verifySsl ?? true;
    this.proxyUrl = proxyUrl ?? "";
    this.proxyUsername = proxyUsername ?? "";
    this.proxyPassword = proxyPassword ?? "";
  }
}

export function getHeaders() {
  return {
    "User-Agent": "ChatGPT Copilot (VSCode Extension)",
    "X-Title": "ChatGPT Copilot (VSCode Extension)",
    "HTTP-Referer": "https://github.com/feiskyer/chatgpt-copilot",
  };
}
