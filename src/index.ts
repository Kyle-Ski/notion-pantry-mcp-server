import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Import Pantry-specific resources and tools (TODO: work on these resources)
import { registerPantryResources } from "./resources/pantryResources";
import { registerPantryTools } from "./tools/pantryTools";
import { NotionPantryService } from "./services/notionPantryService";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";

// Environment variables
export interface Env {
    PantryMcpServer: DurableObjectNamespace; // Durable Object for our agent
    NOTION_TOKEN: string;                   // Notion API token
    NOTION_PANTRY_DB: string;               // Notion database ID for pantry
}

// Simple state structure for our agent
type State = {
    requestCounter: number;
    lastUpdated: string;
};

export class PantryMcpServer extends McpAgent<Env, State> {
    
    server = new McpServer({
        name: "Pantry MCP Server",
        version: "0.1.0",
        description: "A server that helps manage your pantry and suggest meals"
    });

    // Initial state for the Durable Object
    initialState: State = {
        requestCounter: 0,
        lastUpdated: new Date().toISOString()
    };

    // Initialize the agent with resources and tools
    async init() {
        console.log("Initializing Pantry MCP Agent");

        const notionService = new NotionPantryService(
            this.env.NOTION_TOKEN,
            this.env.NOTION_PANTRY_DB,
            true // useDummyData flag - set to true for now
        );

        registerPantryResources(this.server, notionService);

        registerPantryTools(this.server, notionService);

        console.log("Pantry MCP Agent initialized successfully");
    }
}

// Export the mount function for the Durable Object
export default {
    fetch: PantryMcpServer.mount("/mcp", { binding: "PantryMcpServer" })
};