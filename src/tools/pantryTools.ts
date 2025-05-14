import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NotionPantryService } from "../services/notionPantryService";

export function registerPantryTools(
    server: McpServer,
    notionService: NotionPantryService
) {

    server.tool(
        "getPantryInfo",
        "Get comprehensive information about the current pantry inventory",
        {
            includeExpiringSoon: z.boolean().optional().default(true).describe("Include items that will expire soon"),
            sortBy: z.enum(["name", "category", "expiry"]).optional().default("category").describe("How to sort the pantry items")
        },
        async ({ includeExpiringSoon, sortBy }) => {
            try {
                // Get pantry items
                const items = await notionService.getPantryItems();

                // Sort items based on preference
                let sortedItems = [...items];
                if (sortBy === "name") {
                    sortedItems.sort((a, b) => a.name.localeCompare(b.name));
                } else if (sortBy === "category") {
                    sortedItems.sort((a, b) => a.category.localeCompare(b.category));
                } else if (sortBy === "expiry") {
                    sortedItems.sort((a, b) => {
                        // Sort by expiry date, items without expiry date come last
                        if (!a.expiryDate && !b.expiryDate) return 0;
                        if (!a.expiryDate) return 1;
                        if (!b.expiryDate) return -1;
                        return a.expiryDate.localeCompare(b.expiryDate);
                    });
                }

                // Generate the response
                let response = `# Current Pantry Inventory\n\n`;

                // Group by category for easier reading
                const categories = new Map<string, typeof sortedItems>();
                for (const item of sortedItems) {
                    if (!categories.has(item.category)) {
                        categories.set(item.category, []);
                    }
                    categories.get(item.category)?.push(item);
                }

                // Add expiring soon section if requested
                if (includeExpiringSoon) {
                    const today = new Date();
                    const oneWeekLater = new Date();
                    oneWeekLater.setDate(today.getDate() + 7);

                    const expiringSoon = sortedItems.filter(item => {
                        if (!item.expiryDate) return false;
                        const expiryDate = new Date(item.expiryDate);
                        return expiryDate <= oneWeekLater && expiryDate >= today;
                    });

                    if (expiringSoon.length > 0) {
                        response += `## Expiring Soon\n`;
                        expiringSoon.forEach(item => {
                            response += `- **${item.name}**: ${item.quantity} ${item.unit} (expires ${item.expiryDate})\n`;
                        });
                        response += `\n`;
                    }
                }

                // Add items by category
                for (const [category, items] of categories.entries()) {
                    response += `## ${category}\n`;
                    items.forEach(item => {
                        let expiryInfo = item.expiryDate ? ` (expires ${item.expiryDate})` : "";
                        response += `- **${item.name}**: ${item.quantity} ${item.unit}${expiryInfo}\n`;
                    });
                    response += `\n`;
                }

                // Add total count
                response += `Total items: ${sortedItems.length}\n`;

                return {
                    content: [{ type: "text", text: response }]
                };
            } catch (error: any) {
                console.error("Error in getPantryInfo:", error);
                return {
                    content: [{ type: "text", text: `Error retrieving pantry information: ${error.message}` }]
                };
            }
        }
    );

    // Just a stub for now TODO: update
    server.tool(
        "suggestMeals",
        "Suggest meals based on available pantry ingredients",
        {
            maxResults: z.number().optional().default(3).describe("Maximum number of meal suggestions to return")
        },
        async ({ maxResults }) => {
            try {
                // Get recipe suggestions
                const recipes = await notionService.suggestMeals();
                const limitedRecipes = recipes.slice(0, maxResults);

                // Generate the response
                let response = `# Meal Suggestions Based on Your Pantry\n\n`;

                limitedRecipes.forEach((recipe, index) => {
                    response += `## ${index + 1}. ${recipe.name}\n`;
                    response += `**Preparation Time:** ${recipe.preparationTime} minutes\n\n`;

                    response += `### Ingredients\n`;
                    recipe.ingredients.forEach(ing => {
                        response += `- ${ing.quantity} ${ing.unit} ${ing.name}\n`;
                    });
                    response += `\n`;

                    response += `### Instructions\n${recipe.instructions}\n\n`;
                });

                if (recipes.length === 0) {
                    response = "No meal suggestions available based on your current pantry items.";
                }

                return {
                    content: [{ type: "text", text: response }]
                };
            } catch (error: any) {
                console.error("Error in suggestMeals:", error);
                return {
                    content: [{ type: "text", text: `Error generating meal suggestions: ${error.message}` }]
                };
            }
        }
    );

    // Just a stub for now TODO: update this
    server.tool(
        "updatePantryForRecipe",
        "Updates the pantry inventory after preparing a meal",
        {
            recipeId: z.string().describe("ID of the recipe used for the meal")
        },
        async ({ recipeId }) => {
            try {
                // Call our service
                await notionService.updatePantryForRecipe(recipeId);

                return {
                    content: [{
                        type: "text",
                        text: "Pantry has been updated successfully after preparing the recipe."
                    }]
                };
            } catch (error: any) {
                console.error("Error in updatePantryForRecipe:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error updating pantry: ${error.message}`
                    }]
                };
            }
        }
    );
}