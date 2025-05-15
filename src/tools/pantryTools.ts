import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NotionPantryService } from "../services/notionPantryService";
import type { PantryItem } from "../types/pantry";

export function registerPantryTools(
    server: McpServer,
    notionService: NotionPantryService
) {
    /**
     * Tool: Get comprehensive information about the pantry
     */
    server.tool(
        "getPantryInfo",
        "Get information about the current pantry inventory",
        {
            filterByCategory: z.string().optional().describe("Filter items by a specific category"),
            includeMetadata: z.boolean().optional().default(true).describe("Include metadata like expiring items and staples running low")
        },
        async ({ filterByCategory, includeMetadata }) => {
            try {
                // Get pantry items
                let items = filterByCategory
                    ? await notionService.getPantryItemsByCategory(filterByCategory)
                    : await notionService.getPantryItems();

                // Create response object with the correct type
                interface PantryInfoResponse {
                    items: PantryItem[];
                    metadata?: {
                        totalCount: number;
                        expiringItems: Array<{
                            name: string;
                            expiryDate?: string;
                            daysUntilExpiry: number;
                        }>;
                        staplesLow: Array<{
                            name: string;
                            quantity: number;
                            minQuantity?: number;
                            unit: string;
                        }>;
                        categoryCounts: Array<[string, number]>;
                    }
                }

                // Initialize with items
                const response: PantryInfoResponse = {
                    items: items
                };

                // Add metadata if requested
                if (includeMetadata) {
                    const today = new Date();
                    const oneWeekLater = new Date(today);
                    oneWeekLater.setDate(today.getDate() + 7);

                    // Calculate expiring items
                    const expiringItems = items
                        .filter(item => {
                            if (!item.expiryDate) return false;
                            const expiryDate = new Date(item.expiryDate);
                            return expiryDate <= oneWeekLater && expiryDate >= today;
                        })
                        .map(item => ({
                            name: item.name,
                            expiryDate: item.expiryDate,
                            daysUntilExpiry: Math.ceil(
                                (new Date(item.expiryDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                            )
                        }));

                    // Calculate staples running low
                    const staplesLow = items
                        .filter(item =>
                            item.isStaple &&
                            item.minQuantity !== undefined &&
                            item.quantity <= item.minQuantity
                        )
                        .map(item => ({
                            name: item.name,
                            quantity: item.quantity,
                            minQuantity: item.minQuantity,
                            unit: item.unit
                        }));

                    // Create category counts with proper typing
                    const categoryCountsObj: Record<string, number> = {};
                    items.forEach(item => {
                        categoryCountsObj[item.category] = (categoryCountsObj[item.category] || 0) + 1;
                    });

                    // Add to response
                    response.metadata = {
                        totalCount: items.length,
                        expiringItems,
                        staplesLow,
                        categoryCounts: Object.entries(categoryCountsObj)
                    };
                }

                return {
                    content: [{
                        type: "text",
                        text: `# Pantry Inventory Data\n\nHere is your current pantry inventory. You can format and analyze this data to provide insights about the pantry contents.\n\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in getPantryInfo:", error);
                return {
                    content: [{ type: "text", text: `Error retrieving pantry information: ${error.message}` }]
                };
            }
        }
    );

    /**
     * Tool: Suggest meals based on available pantry ingredients
     */
    server.tool(
        "getPantryAndRecipes",
        "Get pantry inventory and available recipes for meal planning",
        {
            filterByTag: z.string().optional().describe("Filter recipes by a specific tag (e.g., 'Breakfast', 'Easy')"),
            includeTriedOnly: z.boolean().optional().default(false).describe("Only include recipes you've tried before"),
            maxRecipes: z.number().optional().default(10).describe("Maximum number of recipes to return")
        },
        async ({ filterByTag, includeTriedOnly, maxRecipes }) => {
            try {
                // Get pantry items
                const pantryItems = await notionService.getPantryItems();

                // Get recipes with ingredients
                let recipesWithIngredients = await notionService.getRecipesWithIngredients();

                // Apply filters
                if (filterByTag) {
                    recipesWithIngredients = recipesWithIngredients.filter(r =>
                        r.recipe.tags.includes(filterByTag)
                    );
                }

                if (includeTriedOnly) {
                    recipesWithIngredients = recipesWithIngredients.filter(r => r.recipe.tried);
                }

                // Limit the number of recipes to avoid overwhelming the LLM
                recipesWithIngredients = recipesWithIngredients.slice(0, maxRecipes);

                // Format the data for the LLM to process
                const response = {
                    pantry: pantryItems.map(item => ({
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        category: item.category,
                        expiry: item.expiryDate
                    })),

                    recipes: recipesWithIngredients.map(r => ({
                        id: r.recipe.id,
                        name: r.recipe.name,
                        tried: r.recipe.tried,
                        tags: r.recipe.tags,
                        link: r.recipe.link,
                        notionUrl: r.recipe.notionUrl, // Add Notion URL here
                        ingredients: r.ingredients.map(ing => ({
                            name: ing.name,
                            quantity: ing.quantity,
                            unit: ing.unit,
                            optional: ing.isOptional
                        }))
                    }))
                };

                // Return structured data for the LLM to reason about
                return {
                    content: [{
                        type: "text",
                        text: `# Pantry and Recipe Data\n\nHere is the current pantry inventory and available recipes. You can analyze this data to suggest meals that can be made with available ingredients.\n\n${JSON.stringify(response, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in getPantryAndRecipes:", error);
                return {
                    content: [{ type: "text", text: `Error retrieving pantry and recipe data: ${error.message}` }]
                };
            }
        }
    )

    /**
     * Tool: Update pantry after cooking a recipe
     */
    server.tool(
        "updatePantryAfterCooking",
        "Update pantry inventory after preparing a meal",
        {
            recipeId: z.string().describe("ID of the recipe used for the meal"),
            addToShoppingList: z.boolean().optional().default(true).describe("Automatically add low/depleted items to shopping list")
        },
        async ({ recipeId, addToShoppingList }) => {
            try {
                // Get recipe details
                const recipeWithIngredients = await notionService.getRecipeWithIngredients(recipeId);

                if (!recipeWithIngredients) {
                    return {
                        content: [{
                            type: "text",
                            text: `Recipe with ID ${recipeId} not found.`
                        }]
                    };
                }

                // Get pantry before update
                const pantryBefore = await notionService.getPantryItems();

                // Update the pantry
                await notionService.updatePantryForRecipe(recipeId);

                // Get pantry after update
                const pantryAfter = await notionService.getPantryItems();

                // Calculate changes
                const changes: any[] = [];
                const addedToShoppingList: any[] = [];

                recipeWithIngredients.ingredients.forEach(ingredient => {
                    if (ingredient.isOptional) return;

                    const before = pantryBefore.find(item => item.name.toLowerCase() === ingredient.name.toLowerCase());
                    const after = pantryAfter.find(item => item.name.toLowerCase() === ingredient.name.toLowerCase());

                    if (before && after) {
                        changes.push({
                            name: ingredient.name,
                            before: before.quantity,
                            after: after.quantity,
                            unit: before.unit
                        });

                        if (addToShoppingList && before.isStaple && before.minQuantity !== undefined &&
                            before.quantity > before.minQuantity &&
                            after.quantity <= before.minQuantity) {
                            addedToShoppingList.push(ingredient.name);
                        }
                    }
                });

                // Update recipe tried status if not tried before
                let triedStatusUpdated = false;
                if (!recipeWithIngredients.recipe.tried) {
                    try {
                        await notionService.markRecipeAsTried(recipeId);
                        triedStatusUpdated = true;
                    } catch (error) {
                        console.error("Error marking recipe as tried:", error);
                    }
                }

                // Return data for LLM to format
                return {
                    content: [{
                        type: "text",
                        text: `# Pantry Update Results\n\nHere are the results of updating your pantry after cooking. You can format this information for the user.\n\n${JSON.stringify({
                            recipe: {
                                id: recipeWithIngredients.recipe.id,
                                name: recipeWithIngredients.recipe.name,
                                notionUrl: recipeWithIngredients.recipe.notionUrl,
                                triedStatusUpdated
                            },
                            changes,
                            addedToShoppingList
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in updatePantryAfterCooking:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error updating pantry: ${error.message}`
                    }]
                };
            }
        }
    );

    /**
     * Tool: Add item to pantry
     */
    server.tool(
        "addPantryItem",
        "Add a new item to the pantry inventory",
        {
            name: z.string().describe("Name of the item"),
            quantity: z.number().describe("Quantity of the item"),
            unit: z.string().describe("Unit of measurement"),
            category: z.string().describe("Category of the item"),
            location: z.string().optional().default("Pantry").describe("Where the item is stored"),
            expiryDate: z.string().optional().describe("Expiry date of the item (YYYY-MM-DD)"),
            isStaple: z.boolean().optional().default(false).describe("Whether this is a staple item to always keep in stock"),
            minQuantity: z.number().optional().describe("Minimum quantity to maintain (for staple items)")
        },
        async ({ name, quantity, unit, category, location, expiryDate, isStaple, minQuantity }) => {
            try {
                // Check if item already exists
                const existingItems = await notionService.getPantryItems();
                const existingItem = existingItems.find(item =>
                    item.name.toLowerCase() === name.toLowerCase()
                );

                let result;
                let wasUpdated = false;

                if (existingItem) {
                    // Update existing item
                    wasUpdated = true;
                    result = await notionService.updatePantryItem(existingItem.id, {
                        quantity: existingItem.quantity + quantity,
                        expiryDate: expiryDate || existingItem.expiryDate,
                        lastUpdated: new Date().toISOString()
                    });
                } else {
                    // Add new item
                    result = await notionService.addPantryItem({
                        name,
                        quantity,
                        unit,
                        category,
                        location,
                        expiryDate,
                        isStaple,
                        minQuantity: isStaple ? (minQuantity || Math.ceil(quantity * 0.2)) : undefined
                    });
                }

                // Return data for LLM to format
                return {
                    content: [{
                        type: "text",
                        text: `# Pantry Item ${wasUpdated ? 'Updated' : 'Added'}\n\nHere are the details of the ${wasUpdated ? 'updated' : 'new'} pantry item. You can format this information for the user.\n\n${JSON.stringify({
                            wasUpdated,
                            quantityAdded: quantity,
                            item: result
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in addPantryItem:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error adding/updating pantry item: ${error.message}`
                    }]
                };
            }
        }
    );

    // View shopping list
    server.tool(
        "getShoppingList",
        "Get the current shopping list",
        {},
        async () => {
            try {
                const shoppingList = await notionService.getShoppingList();

                // Group by category
                const groupedByCategory: Record<string, typeof shoppingList> = {};

                // Populate the groups
                shoppingList.forEach(item => {
                    if (!groupedByCategory[item.category]) {
                        groupedByCategory[item.category] = [];
                    }
                    groupedByCategory[item.category].push(item);
                });

                return {
                    content: [{
                        type: "text",
                        text: `# Shopping List Data\n\nHere is your current shopping list. You can format this information for the user.\n\n${JSON.stringify({
                            items: shoppingList,
                            groupedByCategory,
                            totalCount: shoppingList.length,
                            purchasedCount: shoppingList.filter(item => item.isPurchased).length
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in getShoppingList:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error retrieving shopping list: ${error.message}`
                    }]
                };
            }
        }
    );

    // Add item to shopping list
    server.tool(
        "addToShoppingList",
        "Add an item to the shopping list",
        {
            name: z.string().describe("Name of the item"),
            quantity: z.number().describe("Quantity to purchase"),
            unit: z.string().describe("Unit of measurement"),
            category: z.string().describe("Category of the item"),
            priority: z.enum(["Low", "Medium", "High"]).optional().default("Medium").describe("Priority of the item")
        },
        async ({ name, quantity, unit, category, priority }) => {
            try {
                // Check if item already exists
                const existingList = await notionService.getShoppingList();
                const existingItem = existingList.find(item =>
                    item.name.toLowerCase() === name.toLowerCase() && !item.isPurchased
                );

                let result;
                let wasUpdated = false;

                if (existingItem) {
                    // Update existing item
                    wasUpdated = true;
                    result = await notionService.updateShoppingListItem(existingItem.id, {
                        quantity: existingItem.quantity + quantity,
                        priority: priority || existingItem.priority
                    });
                } else {
                    // Add new item
                    result = await notionService.addToShoppingList({
                        name,
                        quantity,
                        unit,
                        category,
                        priority: priority || "Medium",
                        isPurchased: false,
                        isAutoAdded: false
                    });
                }

                // Return data for LLM to format
                return {
                    content: [{
                        type: "text",
                        text: `# Shopping List Item ${wasUpdated ? 'Updated' : 'Added'}\n\nHere are the details of the ${wasUpdated ? 'updated' : 'new'} shopping list item. You can format this information for the user.\n\n${JSON.stringify({
                            wasUpdated,
                            quantityAdded: quantity,
                            item: result
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in addToShoppingList:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error adding/updating shopping list item: ${error.message}`
                    }]
                };
            }
        }
    );

    // Mark item as purchased
    server.tool(
        "markItemAsPurchased",
        "Mark a shopping list item as purchased",
        {
            itemId: z.string().describe("ID of the shopping list item to mark as purchased")
        },
        async ({ itemId }) => {
            try {
                // Mark the item as purchased
                const updatedItem = await notionService.markAsPurchased(itemId);

                // Return data for LLM to format
                return {
                    content: [{
                        type: "text",
                        text: `# Item Marked as Purchased\n\nHere are the details of the updated shopping list item. You can format this information for the user.\n\n${JSON.stringify(updatedItem, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in markItemAsPurchased:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error marking item as purchased: ${error.message}`
                    }]
                };
            }
        }
    );

    // Add purchased items to pantry
    server.tool(
        "addPurchasedItemsToPantry",
        "Add all purchased items to pantry and remove from shopping list",
        {},
        async () => {
            try {
                // Get purchased items before they're removed
                const shoppingList = await notionService.getShoppingList();
                const purchasedItems = shoppingList.filter(item => item.isPurchased);

                // Add purchased items to pantry
                await notionService.addPurchasedItemsToPantry();

                // Return data for LLM to format
                return {
                    content: [{
                        type: "text",
                        text: `# Purchased Items Added to Pantry\n\nHere are the details of the operation. You can format this information for the user.\n\n${JSON.stringify({
                            itemsAddedToPantry: purchasedItems,
                            count: purchasedItems.length
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error in addPurchasedItemsToPantry:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error adding purchased items to pantry: ${error.message}`
                    }]
                };
            }
        }
    );
}