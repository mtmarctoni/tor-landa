import "server-only";
import { getConfig, type ShoeboxConfig } from "./config";
import { createMemoryService, type MemoryService } from "./memory-service";
import { createNotionGateway, createSdkClient } from "./notion-gateway";

let instance: MemoryService | null = null;

/**
 * The one lazily built gateway and service per server instance, so every
 * shoebox route shares a single two-slot limiter and verified-schema cache.
 * Call it only after the request is authenticated; it holds ids, never records.
 */
export function getMemoryService(
  config: ShoeboxConfig = getConfig(),
): MemoryService {
  if (!instance) {
    instance = createMemoryService(
      createNotionGateway({ client: createSdkClient(config.notionApiKey) }),
      { databaseId: config.notionDbId },
    );
  }
  return instance;
}
