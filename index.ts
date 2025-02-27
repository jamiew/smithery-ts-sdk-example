import Anthropic from "@anthropic-ai/sdk";
import type { PromptCachingBetaMessageParam } from "@anthropic-ai/sdk/src/resources/beta/prompt-caching/index.js";
import { MultiClient } from "@smithery/sdk";
import { AnthropicChatAdapter } from "@smithery/sdk/integrations/llm/anthropic.js";
import { WebSocketClientTransport } from "@modelcontextprotocol/sdk/client/websocket.js";
import { createSmitheryUrl } from "@smithery/sdk/config.js";
import dotenv from "dotenv";

async function main() {
  dotenv.config();

  if (!process.env.EXA_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("Missing required environment variables (.env)");
    process.exit(1);
  }

  // Using sample code from:
  // https://smithery.ai/server/exa
  const url = createSmitheryUrl("https://server.smithery.ai/exa/ws", {
    exaApiKey: process.env.EXA_API_KEY,
  });
  const exaTransport = new WebSocketClientTransport(url);

  // Initialize a multi-client connection
  const client = new MultiClient();
  await client.connectAll({
    exa: exaTransport,
    // You can add more connections here...
  });
  console.log("MultiClient connected");

  // Example conversation with tool usage
  let isDone = false;

  const chatState = {
    type: "anthropic" as const,
    llm: new Anthropic(),
    messages: [] as PromptCachingBetaMessageParam[],
  };

  chatState.messages.push({
    role: "user",
    content:
      "What are some AI events happening in Singapore and how many days until the next one?",
  });

  while (!isDone) {
    const adapter = new AnthropicChatAdapter(client);

    const tools = await adapter.listTools();
    console.log("Available tools", JSON.stringify(tools, null, 2));

    const response = await chatState.llm.beta.promptCaching.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      messages: chatState.messages,
      tools,
    });
    chatState.messages.push({
      role: response.role,
      content: response.content,
    });
    console.log("Chat response:", response.content);

    const toolMessages = await adapter.callTool(response);
    chatState.messages.push(...toolMessages);
    console.log("Tool messages:", toolMessages);

    isDone = toolMessages.length === 0;

    console.log("messages", JSON.stringify(chatState.messages, null, 2));
  }

  // Print the final conversation
  console.log("\nFinal conversation:");
  chatState.messages.forEach((msg) => {
    console.log(`\n${msg.role.toUpperCase()}:`);
    console.log(msg.content);
  });

  await client.close();
  process.exit(0);
}

// Run the example
main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
