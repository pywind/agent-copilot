/* eslint-disable eqeqeq */

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
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createReplicate } from "@ai-sdk/replicate";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createAzure } from "@quail-ai/azure-ai-provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";
import { createOllama } from "ollama-ai-provider";
import * as vscode from "vscode";
import ChatGptViewProvider from "./chatgpt-view-provider";
import { logger } from "./logger";
import { ModelConfig } from "./model-config";
import { createFetchWithNetworkOptions } from "./network";
import { isReasoningModel } from "./types";

// initClaudeCodeModel initializes the Claude Code model with the given parameters.
export async function initClaudeCodeModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  // Claude Code SDK doesn't use the traditional AI SDK model interface
  logger.appendLine(`Initializing Claude Code SDK model...`);

  // Store the model config for later use in the chat function
  viewProvider.modelConfig = config;

  // Store the Claude Code executable path if provided
  if (config.claudeCodePath) {
    viewProvider.claudeCodePath = config.claudeCodePath;
    logger.appendLine(`Claude Code path: ${config.claudeCodePath}`);
  }

  // Store the model name for Claude Code SDK
  if (!viewProvider.model) {
    viewProvider.model = "sonnet";
  }

  logger.appendLine(
    `Claude Code SDK initialized with model: ${viewProvider.model}`,
  );
}

// initClaudeModel initializes the Claude model with the given parameters.
export async function initClaudeModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.anthropic.com/v1";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createAnthropic({
    baseURL: apiBaseUrl,
    apiKey: config.apiKey,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });
  if (config.isReasoning) {
    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(
        viewProvider.reasoningModel
          ? viewProvider.reasoningModel
          : "claude-3-5-sonnet-20240620",
      ),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    viewProvider.apiChat = ai.languageModel(
      viewProvider.model ? viewProvider.model : "claude-3-5-sonnet-20240620",
    ) as any;
  }
}

// initGeminiModel initializes the Gemini model with the given parameters.
export async function initGeminiModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  let ai = createGoogleGenerativeAI({
    baseURL: apiBaseUrl,
    apiKey: config.apiKey,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "gemini-2.5-pro";
    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai(model),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });

    if (config.searchGrounding) {
      viewProvider.apiReasoning = wrapLanguageModel({
        model: ai(model),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    }
  } else {
    const model = viewProvider.model ? viewProvider.model : "gemini-2.5-pro";
    viewProvider.apiChat = ai(model);
    if (config.searchGrounding) {
      viewProvider.apiChat = ai(model);
    }
  }
}

export async function initOllamaModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "http://localhost:11434/api";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createOllama({
    baseURL: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "deepseek-r1";
    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model ? viewProvider.model : "deepseek-r1";
    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}

export async function initMistralModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.mistral.ai/v1";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createMistral({
    baseURL: apiBaseUrl,
    apiKey: config.apiKey,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(
        viewProvider.reasoningModel
          ? viewProvider.reasoningModel
          : "deepseek-r1",
      ),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    viewProvider.apiChat = ai.languageModel(
      viewProvider.model ? viewProvider.model : "deepseek-r1",
    ) as any;
  }
}

export async function initXAIModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.x.ai/v1";
  }

  // Ensure the base URL includes the /v1 path component
  if (
    apiBaseUrl &&
    !apiBaseUrl.endsWith("/v1") &&
    !apiBaseUrl.includes("/v1/")
  ) {
    apiBaseUrl = `${apiBaseUrl}/v1`;
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createXai({
    baseURL: apiBaseUrl,
    apiKey: config.apiKey,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });
  if (config.isReasoning) {
    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(
        viewProvider.reasoningModel ? viewProvider.reasoningModel : "grok-beta",
      ),
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    viewProvider.apiChat = ai.languageModel(
      viewProvider.model ? viewProvider.model : "grok-beta",
    ) as any;
  }
}

export async function initTogetherModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.together.xyz/v1";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createTogetherAI({
    apiKey: config.apiKey,
    baseURL: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "deepseek-ai/DeepSeek-R1";

    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model
      ? viewProvider.model
      : "deepseek-ai/DeepSeek-R1";

    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}

export async function initDeepSeekModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.deepseek.com/v1";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createDeepSeek({
    apiKey: config.apiKey,
    baseURL: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "deepseek-chat";

    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model ? viewProvider.model : "deepseek-chat";

    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}

export async function initGroqModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.groq.com/openai/v1";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createGroq({
    apiKey: config.apiKey,
    baseURL: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "gemma2-9b-it";

    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model ? viewProvider.model : "gemma2-9b-it";
    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}

export async function initPerplexityModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.perplexity.ai";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createPerplexity({
    apiKey: config.apiKey,
    baseURL: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  viewProvider.apiChat = ai.languageModel(
    viewProvider.model ? viewProvider.model : "sonar-pro",
  ) as any;
}

export async function initOpenRouterModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createOpenRouter({
    apiKey: config.apiKey,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "anthropic/claude-3.5-sonnet";

    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model
      ? viewProvider.model
      : "anthropic/claude-3.5-sonnet";

    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}

export async function initAzureAIModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  const azureAPIVersion = "2025-04-01-preview";
  let apiBaseUrl = config.apiBaseUrl;

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createAzure({
    apiKey: config.apiKey,
    endpoint: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
    // apiVersion: azureAPIVersion,
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "DeepSeek-R1";

    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model ? viewProvider.model : "DeepSeek-R1";
    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}

// TODO: pending https://github.com/vercel/ai/issues/4918 to support language model.
export async function initReplicateModel(
  viewProvider: ChatGptViewProvider,
  config: ModelConfig,
) {
  let apiBaseUrl = config.apiBaseUrl;
  if (!apiBaseUrl || apiBaseUrl == "https://api.openai.com/v1") {
    apiBaseUrl = "https://api.replicate.com/v1";
  }

  const fetchFn = createFetchWithNetworkOptions(config);
  const ai = createReplicate({
    apiToken: config.apiKey,
    baseURL: apiBaseUrl,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  });

  if (config.isReasoning) {
    const model = viewProvider.reasoningModel
      ? viewProvider.reasoningModel
      : "deepseek-ai/deepseek-r1";

    viewProvider.apiReasoning = wrapLanguageModel({
      model: ai.languageModel(model) as any,
      middleware: extractReasoningMiddleware({ tagName: "think" }),
    });
  } else {
    const model = viewProvider.model
      ? viewProvider.model
      : "deepseek-ai/deepseek-r1";
    if (isReasoningModel(model)) {
      viewProvider.apiChat = wrapLanguageModel({
        model: ai.languageModel(model) as any,
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      });
    } else {
      viewProvider.apiChat = ai.languageModel(model) as any;
    }
  }
}
