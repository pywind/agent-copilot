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
import ChatGptViewProvider from "./chatgpt-view-provider";
import { getHeaders } from "./model-config";
import { isOpenAIOModel } from "./types";
import { logger } from "./logger";

const PLAN_MODE_INSTRUCTIONS = `You are operating in Plan Mode. Your job is to draft an actionable implementation plan before any code is written.

Follow these rules:
- Ask clarifying questions first if critical details are missing. Wait for answers before finalising the plan.
- Do not write or modify code, run commands, or reference future diffs. Plans must stay high-level and descriptive.
- Summarise the objective, outline numbered execution steps, and note validation or testing ideas.
- Keep tooling recommendations read-only (search, analysis). Reserve edits and command execution for Agent Mode.
- Reference any provided context files by path, noting whether more inspection is required.
- Respond in markdown with the sections: ## Summary, ## Plan Steps, ## Validation.
`;

export async function planModeChat(
  provider: ChatGptViewProvider,
  question: string,
  images: Record<string, string>,
  startResponse: () => void,
  updateResponse: (text: string) => void,
  updateReasoning: (text: string, roundNumber?: number) => void,
): Promise<void> {
  startResponse();

  const planPrompt = `Task:\n${question.trim()}\n\nRemember: produce only the plan described above.`;

  const chatMessage: ModelMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text: planPrompt,
      },
    ],
  };

  Object.entries(images).forEach(([_, content]) => {
    (chatMessage.content as any[]).push({
      type: "image",
      image: content,
    });
  });

  provider.chatHistory.push(chatMessage);

  const modelName = provider.model ?? "";
  const planModel = provider.apiReasoning ?? provider.apiChat;
  if (!planModel) {
    throw new Error("No chat model available for plan mode.");
  }

  const systemPrompt = provider.modelConfig.systemPrompt
    ? `${provider.modelConfig.systemPrompt}\n\n${PLAN_MODE_INSTRUCTIONS}`
    : PLAN_MODE_INSTRUCTIONS;

  try {
    const chunks: string[] = [];
    const reasonChunks: string[] = [];

    const result = streamText({
      system: systemPrompt,
      model: planModel as any,
      messages: provider.chatHistory,
      abortSignal: provider.abortController?.signal,
      headers: getHeaders(),
      stopWhen: stepCountIs(provider.maxSteps || 6),
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

    for await (const part of result.fullStream) {
      switch (part.type) {
        case "text-delta": {
          updateResponse(part.text);
          chunks.push(part.text);
          break;
        }
        case "reasoning-delta": {
          updateReasoning(part.text, 1);
          reasonChunks.push(part.text);
          break;
        }
        default: {
          logger.appendLine(
            `INFO: plan.mode model: ${provider.model} streamed part: ${JSON.stringify(part)}`,
          );
          break;
        }
      }
    }

    provider.response = chunks.join("");
    if (reasonChunks.length > 0) {
      provider.reasoning = reasonChunks.join("");
    }

    const reasoning = await result.reasoningText;
    if (reasoning && reasoning !== "") {
      provider.reasoning = reasoning;
      updateReasoning(reasoning, 1);
    }

    const assistantResponse: ModelMessage = {
      role: "assistant",
      content: provider.response,
    };
    provider.chatHistory.push(assistantResponse);

    logger.appendLine(
      `INFO: plan.mode response complete for question: ${question.trim()}`,
    );
  } catch (error) {
    logger.appendLine(
      `ERROR: plan.mode failed for question: ${question.trim()} error: ${error}`,
    );
    provider.sendMessage({
      type: "addError",
      value:
        "Plan Mode failed to generate a plan. Check logs for additional details.",
      autoScroll: provider.autoScroll,
    });
  }
}
