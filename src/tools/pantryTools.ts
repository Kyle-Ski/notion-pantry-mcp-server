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
     * Updates multiple pantry items
     */
    server.tool(
        "updatePantryItems",
        "Update quantities of multiple pantry items at once",
        {
            items: z.array(z.object({
                name: z.string().describe("Name of the item"),
                quantity: z.number().describe("Quantity to add (positive) or remove (negative)"),
                unit: z.string().describe("Unit of measurement")
            })).describe("List of items to update")
        },
        async ({ items }) => {
            try {
                const results: any[] = [];

                for (const item of items) {
                    // Find existing item
                    const pantryItems = await notionService.getPantryItems();
                    const existingItem = pantryItems.find(i =>
                        i.name.toLowerCase() === item.name.toLowerCase());

                    if (existingItem) {
                        // Calculate new quantity (can be addition or subtraction)
                        const newQuantity = Math.max(0, existingItem.quantity + item.quantity);

                        // Update the item
                        const updatedItem = await notionService.updatePantryItem(existingItem.id, {
                            quantity: newQuantity
                        });

                        results.push({
                            name: item.name,
                            previousQuantity: existingItem.quantity,
                            change: item.quantity,
                            newQuantity: updatedItem.quantity,
                            unit: updatedItem.unit
                        });
                    } else if (item.quantity > 0) {
                        // If item doesn't exist and we're adding (not subtracting)
                        const newItem = await notionService.addPantryItem({
                            name: item.name,
                            quantity: item.quantity,
                            unit: item.unit,
                            category: "Other", // Default category
                            location: "Pantry", // Default location
                            isStaple: false
                        });

                        results.push({
                            name: item.name,
                            previousQuantity: 0,
                            change: item.quantity,
                            newQuantity: newItem.quantity,
                            unit: newItem.unit
                        });
                    }
                }

                return {
                    content: [{
                        type: "text",
                        text: `# Pantry Items Updated\n\nHere are the details of the updates. You can format this information for the user.\n\n${JSON.stringify(results, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error updating pantry items:", error);
                return {
                    content: [{ type: "text", text: `Error updating pantry: ${error.message}` }]
                };
            }
        }
    );

    /**
     * Tool: Update pantry after cooking a recipe
     */
    server.tool(
        "updatePantryAfterCooking",
        "Update pantry inventory after preparing a meal",
        {
            recipeId: z.string().optional().describe("ID of the recipe used for the meal"),
            ingredients: z.array(z.object({
                name: z.string().describe("Name of the ingredient"),
                quantity: z.number().describe("Quantity used"),
                unit: z.string().describe("Unit of measurement")
            })).optional().describe("Manual list of ingredients used (if not using a recipe)"),
            addToShoppingList: z.boolean().optional().default(true).describe("Automatically add low/depleted items to shopping list")
        },
        async ({ recipeId, ingredients, addToShoppingList }) => {
            try {
                // If recipeId is provided, use existing logic
                if (recipeId) {
                    // Get recipe with ingredients
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
                }
                // If ingredients list is provided, use those directly
                else if (ingredients && ingredients.length > 0) {
                    const changes = [];
                    const addedToShoppingList = [];

                    // Get pantry before update
                    const pantryBefore = await notionService.getPantryItems();

                    for (const ingredient of ingredients) {
                        // Find matching pantry item
                        const pantryItem = pantryBefore.find(item =>
                            item.name.toLowerCase() === ingredient.name.toLowerCase());

                        if (pantryItem) {
                            // Calculate new quantity
                            const newQuantity = Math.max(0, pantryItem.quantity - ingredient.quantity);

                            // Update the item
                            await notionService.updatePantryItem(pantryItem.id, {
                                quantity: newQuantity
                            });

                            changes.push({
                                name: ingredient.name,
                                before: pantryItem.quantity,
                                after: newQuantity,
                                unit: pantryItem.unit
                            });

                            // Add to shopping list if needed
                            if (addToShoppingList && pantryItem.isStaple && pantryItem.minQuantity !== undefined &&
                                pantryItem.quantity > pantryItem.minQuantity &&
                                newQuantity <= pantryItem.minQuantity) {
                                await notionService.addToShoppingList({
                                    name: pantryItem.name,
                                    quantity: pantryItem.minQuantity,
                                    unit: pantryItem.unit,
                                    category: pantryItem.category,
                                    priority: "Medium",
                                    isPurchased: false,
                                    isAutoAdded: true
                                });

                                addedToShoppingList.push(ingredient.name);
                            }
                        }
                    }

                    // Return results
                    return {
                        content: [{
                            type: "text",
                            text: `# Pantry Update Results\n\nHere are the results of updating your pantry after cooking. You can format this information for the user.\n\n${JSON.stringify({
                                changes,
                                addedToShoppingList
                            }, null, 2)}`
                        }]
                    };
                } else {
                    return {
                        content: [{
                            type: "text",
                            text: "Error: Either a recipe ID or a list of ingredients must be provided."
                        }]
                    };
                }
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
        {
            provideSummary: z.boolean().optional().default(true).describe("Whether to provide a detailed summary of changes")
        },
        async ({ provideSummary }) => {
            try {
                // Get purchased items before they're removed
                const shoppingList = await notionService.getShoppingList();
                const purchasedItems = shoppingList.filter(item => item.isPurchased);

                if (purchasedItems.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: "No purchased items found on your shopping list."
                        }]
                    };
                }

                // Track pantry changes for summary
                const changes = [];

                // Add purchased items to pantry
                for (const item of purchasedItems) {
                    // Check if this item already exists in pantry
                    const pantryItems = await notionService.getPantryItems();
                    const existingItem = pantryItems.find(pantryItem =>
                        pantryItem.name.toLowerCase() === item.name.toLowerCase());

                    let result;
                    if (existingItem) {
                        // Update existing item quantity
                        const beforeQuantity = existingItem.quantity;
                        result = await notionService.updatePantryItem(existingItem.id, {
                            quantity: existingItem.quantity + item.quantity
                        });

                        changes.push({
                            name: item.name,
                            action: "updated",
                            before: beforeQuantity,
                            after: result.quantity,
                            unit: item.unit
                        });
                    } else {
                        // Add as new pantry item
                        result = await notionService.addPantryItem({
                            name: item.name,
                            quantity: item.quantity,
                            unit: item.unit,
                            category: item.category,
                            location: 'Pantry', // Default location
                            isStaple: false,
                            notes: item.notes
                        });

                        changes.push({
                            name: item.name,
                            action: "added",
                            quantity: item.quantity,
                            unit: item.unit
                        });
                    }

                    // Remove from shopping list
                    await notionService.deleteShoppingListItem(item.id);
                }

                // Return data for LLM to format with change details
                return {
                    content: [{
                        type: "text",
                        text: `# Purchased Items Added to Pantry\n\nHere are the details of the operation. You can format this information for the user.\n\n${JSON.stringify({
                            itemsAddedToPantry: provideSummary ? changes : purchasedItems.map(i => i.name),
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

    // A more flexible tool for updating pantry items without requiring a recipe
    server.tool(
        "updatePantryWithUsedItems",
        "Update pantry by removing ingredients you've used",
        {
            items: z.array(z.object({
                name: z.string().describe("Name of the item used"),
                quantity: z.number().describe("Quantity used"),
                unit: z.string().describe("Unit of measurement")
            })).describe("List of items used"),
            addToShoppingList: z.boolean().optional().default(true).describe("Add low/depleted staples to shopping list")
        },
        async ({ items, addToShoppingList }) => {
            try {
                const changes = [];
                const addedToShoppingList = [];
                const notFoundItems = [];

                // Get pantry items once to avoid repeated calls
                const pantryItems = await notionService.getPantryItems();

                for (const item of items) {
                    // Find matching pantry item
                    const pantryItem = pantryItems.find(p =>
                        p.name.toLowerCase() === item.name.toLowerCase());

                    if (pantryItem) {
                        // Calculate new quantity
                        const newQuantity = Math.max(0, pantryItem.quantity - item.quantity);

                        // Update the item
                        await notionService.updatePantryItem(pantryItem.id, {
                            quantity: newQuantity
                        });

                        changes.push({
                            name: item.name,
                            before: pantryItem.quantity,
                            after: newQuantity,
                            unit: pantryItem.unit,
                            used: item.quantity
                        });

                        // Add to shopping list if needed
                        if (addToShoppingList && pantryItem.isStaple && pantryItem.minQuantity !== undefined &&
                            pantryItem.quantity > pantryItem.minQuantity &&
                            newQuantity <= pantryItem.minQuantity) {
                            await notionService.addToShoppingList({
                                name: pantryItem.name,
                                quantity: pantryItem.minQuantity || 1,
                                unit: pantryItem.unit,
                                category: pantryItem.category,
                                priority: "Medium",
                                isPurchased: false,
                                isAutoAdded: true
                            });

                            addedToShoppingList.push(pantryItem.name);
                        }
                    } else {
                        notFoundItems.push(item.name);
                    }
                }

                // Return results
                return {
                    content: [{
                        type: "text",
                        text: `# Pantry Updated with Used Items\n\nHere are the details of the update. You can format this information for the user.\n\n${JSON.stringify({
                            changes,
                            addedToShoppingList,
                            notFoundItems
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error updating pantry with used items:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error updating pantry: ${error.message}`
                    }]
                };
            }
        }
    );

    server.tool(
        "removeExpiredItems",
        "Remove expired items from pantry and optionally add replacements to shopping list",
        {
            checkExpiryBefore: z.string().optional().describe("Check items expiring before this date (YYYY-MM-DD), defaults to today"),
            addToShoppingList: z.boolean().optional().default(true).describe("Add staple items to shopping list"),
            dryRun: z.boolean().optional().default(false).describe("Just report expired items without removing them")
        },
        async ({ checkExpiryBefore, addToShoppingList, dryRun }) => {
            try {
                const expiryDate = checkExpiryBefore ? new Date(checkExpiryBefore) : new Date();

                // Get all pantry items
                const pantryItems = await notionService.getPantryItems();

                // Find expired items
                const expiredItems = pantryItems.filter(item => {
                    if (!item.expiryDate) return false;
                    const itemExpiry = new Date(item.expiryDate);
                    return itemExpiry <= expiryDate;
                });

                if (expiredItems.length === 0) {
                    return {
                        content: [{
                            type: "text",
                            text: `No items found expiring before ${expiryDate.toISOString().split('T')[0]}.`
                        }]
                    };
                }

                const removedItems = [];
                const addedToShoppingList = [];

                // Process expired items
                for (const item of expiredItems) {
                    // Add to shopping list if it's a staple
                    if (addToShoppingList && item.isStaple) {
                        if (!dryRun) {
                            await notionService.addToShoppingList({
                                name: item.name,
                                quantity: item.minQuantity || item.quantity,
                                unit: item.unit,
                                category: item.category,
                                priority: "High",
                                isPurchased: false,
                                isAutoAdded: true,
                                notes: "Replacing expired item"
                            });
                        }
                        addedToShoppingList.push(item.name);
                    }

                    // Remove from pantry
                    if (!dryRun) {
                        await notionService.deletePantryItem(item.id);
                    }

                    removedItems.push({
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        expiryDate: item.expiryDate,
                        daysExpired: Math.ceil((expiryDate.getTime() - new Date(item.expiryDate!).getTime()) / (1000 * 60 * 60 * 24))
                    });
                }

                // Return results
                return {
                    content: [{
                        type: "text",
                        text: `# ${dryRun ? 'Expired Items Report' : 'Expired Items Removed'}\n\nHere are the details of the ${dryRun ? 'expired items' : 'removal operation'}. You can format this information for the user.\n\n${JSON.stringify({
                            removedItems,
                            addedToShoppingList,
                            totalRemoved: removedItems.length,
                            dryRun
                        }, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error handling expired items:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error handling expired items: ${error.message}`
                    }]
                };
            }
        }
    );
}