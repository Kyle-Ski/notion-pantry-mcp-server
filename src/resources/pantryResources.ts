import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NotionPantryService } from "../services/notionPantryService";

export function registerPantryResources(
    server: McpServer,
    notionService: NotionPantryService
) {
    // Main pantry resource
    server.resource(
        "pantry",
        "mcp://resource/pantry",
        async (uri) => {
            try {
                const items = await notionService.getPantryItems();
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(items, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching pantry:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch pantry items" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Individual pantry item resource
    server.resource(
        "pantryItem",
        new ResourceTemplate("pantry-item://{itemId}", { list: undefined }),
        async (uri, vars) => {
            try {
                const itemId = Array.isArray(vars.itemId) ? vars.itemId[0] : vars.itemId;
                const item = await notionService.getPantryItemById(itemId);

                if (!item) {
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                text: JSON.stringify({ error: `Item with ID ${itemId} not found` }, null, 2)
                            }
                        ]
                    };
                }

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(item, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error(`Error fetching pantry item ${vars.itemId}:`, error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch pantry item" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Pantry items by category
    server.resource(
        "pantryCategory",
        new ResourceTemplate("pantry-category://{category}", { list: undefined }),
        async (uri, vars) => {
            try {
                const category = Array.isArray(vars.category) ? vars.category[0] : vars.category;
                const items = await notionService.getPantryItemsByCategory(category);

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(items, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error(`Error fetching pantry items for category ${vars.category}:`, error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch pantry items by category" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Recipe suggestions resource
    server.resource(
        "recipes",
        "mcp://resource/recipes",
        async (uri) => {
            try {
                const recipes = await notionService.suggestMeals();
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(recipes, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching recipes:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch recipe suggestions" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Individual recipe resource
    server.resource(
        "recipe",
        new ResourceTemplate("recipe://{recipeId}", { list: undefined }),
        async (uri, vars) => {
            try {
                const recipeId = Array.isArray(vars.recipeId) ? vars.recipeId[0] : vars.recipeId;
                const recipe = await notionService.getRecipeById(recipeId);

                if (!recipe) {
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                text: JSON.stringify({ error: `Recipe with ID ${recipeId} not found` }, null, 2)
                            }
                        ]
                    };
                }

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(recipe, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error(`Error fetching recipe ${vars.recipeId}:`, error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch recipe" }, null, 2)
                        }
                    ]
                };
            }
        }
    );
}