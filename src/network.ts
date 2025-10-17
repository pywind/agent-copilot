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
import { Agent, Dispatcher, ProxyAgent, setGlobalDispatcher } from "undici";
import { logger } from "./logger";
import { ModelConfig } from "./model-config";

function buildProxyUrl(config: ModelConfig): string {
  let rawUrl = config.proxyUrl.trim();
  if (!rawUrl) {
    return "";
  }

  if (!rawUrl.includes("://")) {
    rawUrl = `http://${rawUrl}`;
  }

  try {
    const proxyUrl = new URL(rawUrl);
    if (!proxyUrl.username && config.proxyUsername) {
      proxyUrl.username = config.proxyUsername;
    }
    if (!proxyUrl.password && config.proxyPassword) {
      proxyUrl.password = config.proxyPassword;
    }

    return proxyUrl.toString();
  } catch (error) {
    logger.appendLine(
      `WARN: Invalid proxy URL provided: ${(error as Error).message}`,
    );
    return "";
  }
}

function createDispatcher(config: ModelConfig): Dispatcher | undefined {
  const rejectUnauthorized = config.verifySsl;
  const connectOptions = { rejectUnauthorized } as const;

  const proxyUrl = buildProxyUrl(config);
  if (proxyUrl) {
    try {
      return new ProxyAgent({
        uri: proxyUrl,
        connect: connectOptions,
      });
    } catch (error) {
      logger.appendLine(
        `WARN: Failed to configure proxy agent: ${(error as Error).message}`,
      );
    }
  }

  if (!rejectUnauthorized) {
    return new Agent({
      connect: connectOptions,
    });
  }

  return undefined;
}

export function createFetchWithNetworkOptions(
  config: ModelConfig,
): typeof fetch | undefined {
  const dispatcher = createDispatcher(config);

  if (!dispatcher) {
    return undefined;
  }

  try {
    setGlobalDispatcher(dispatcher);
  } catch (error) {
    logger.appendLine(
      `WARN: Failed to set global dispatcher: ${(error as Error).message}`,
    );
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const finalInit: RequestInit & { dispatcher?: Dispatcher } = {
      ...(init ?? {}),
      dispatcher,
    };
    return fetch(input, finalInit);
  };
}
