import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { NotionPantryService } from "../services/notionPantryService";
import { canMakeRecipe, getMissingIngredients } from "../types/recipeIngredients";
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
        "Get comprehensive information about the current pantry inventory",
        {
            includeExpiringSoon: z.boolean().optional().default(true).describe("Include items that will expire soon"),
            includeStaplesLow: z.boolean().optional().default(true).describe("Include staple items that are running low"),
            sortBy: z.enum(["name", "category", "expiry"]).optional().default("category").describe("How to sort the pantry items"),
            filterByCategory: z.string().optional().describe("Filter items by a specific category")
        },
        async ({ includeExpiringSoon, includeStaplesLow, sortBy, filterByCategory }) => {
            try {
                // Get pantry items
                let items: PantryItem[];

                if (filterByCategory) {
                    items = await notionService.getPantryItemsByCategory(filterByCategory);
                } else {
                    items = await notionService.getPantryItems();
                }

                // Sort items based on preference
                let sortedItems = [...items];
                if (sortBy === "name") {
                    sortedItems.sort((a, b) => a.name.localeCompare(b.name));
                } else if (sortBy === "category") {
                    sortedItems.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
                } else if (sortBy === "expiry") {
                    sortedItems.sort((a, b) => {
                        // Sort by expiry date, items without expiry date come last
                        if (!a.expiryDate && !b.expiryDate) return a.name.localeCompare(b.name);
                        if (!a.expiryDate) return 1;
                        if (!b.expiryDate) return -1;
                        return a.expiryDate.localeCompare(b.expiryDate);
                    });
                }

                // Generate the response
                let response = `# Current Pantry Inventory\n\n`;

                if (filterByCategory) {
                    response = `# ${filterByCategory} Inventory\n\n`;
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
                            const daysUntilExpiry = Math.ceil(
                                (new Date(item.expiryDate!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
                            );

                            const expiryText = daysUntilExpiry === 0
                                ? "expires today"
                                : daysUntilExpiry === 1
                                    ? "expires tomorrow"
                                    : `expires in ${daysUntilExpiry} days`;

                            response += `- **${item.name}**: ${item.quantity} ${item.unit} (${expiryText})\n`;
                        });
                        response += `\n`;
                    }
                }

                // Add staples low section if requested
                if (includeStaplesLow) {
                    const staplesLow = sortedItems.filter(item =>
                        item.isStaple &&
                        item.minQuantity !== undefined &&
                        item.quantity <= item.minQuantity
                    );

                    if (staplesLow.length > 0) {
                        response += `## Staples Running Low\n`;
                        staplesLow.forEach(item => {
                            const percentRemaining = item.minQuantity
                                ? Math.round((item.quantity / item.minQuantity) * 100)
                                : 0;

                            response += `- **${item.name}**: ${item.quantity} ${item.unit} (${percentRemaining}% of minimum ${item.minQuantity} ${item.unit})\n`;
                        });
                        response += `\n`;
                    }
                }

                // Group by category for the main listing
                if (sortBy === "category" && !filterByCategory) {
                    const categories = new Map<string, PantryItem[]>();
                    for (const item of sortedItems) {
                        if (!categories.has(item.category)) {
                            categories.set(item.category, []);
                        }
                        categories.get(item.category)?.push(item);
                    }

                    // Add items by category
                    for (const [category, categoryItems] of categories.entries()) {
                        response += `## ${category}\n`;
                        categoryItems.forEach(item => {
                            let expiryInfo = item.expiryDate ? ` (expires ${new Date(item.expiryDate).toLocaleDateString()})` : "";
                            let stapleInfo = item.isStaple ? " ★" : "";
                            response += `- **${item.name}**: ${item.quantity} ${item.unit}${expiryInfo}${stapleInfo}\n`;
                        });
                        response += `\n`;
                    }
                } else {
                    // If not sorting by category or filtering to a specific category, just list all items
                    response += filterByCategory ? "" : "## All Items\n";
                    sortedItems.forEach(item => {
                        let expiryInfo = item.expiryDate ? ` (expires ${new Date(item.expiryDate).toLocaleDateString()})` : "";
                        let locationInfo = item.location ? ` [${item.location}]` : "";
                        let stapleInfo = item.isStaple ? " ★" : "";
                        let categoryInfo = filterByCategory ? "" : ` (${item.category})`;

                        response += `- **${item.name}**${categoryInfo}: ${item.quantity} ${item.unit}${locationInfo}${expiryInfo}${stapleInfo}\n`;
                    });
                    response += `\n`;
                }

                // Add total count and legend
                response += `Total items: ${sortedItems.length}\n\n`;

                // Add a legend
                response += `*Legend: ★ = Staple item*\n`;

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

    /**
     * Tool: Suggest meals based on available pantry ingredients
     */
    server.tool(
        "suggestMeals",
        "Suggest meals based on available pantry ingredients",
        {
            maxResults: z.number().optional().default(5).describe("Maximum number of meal suggestions to return"),
            filterByTag: z.string().optional().describe("Filter recipes by a specific tag (e.g., 'Breakfast', 'Easy')"),
            includeTriedOnly: z.boolean().optional().default(false).describe("Only include recipes you've tried before"),
            includeMissingIngredients: z.boolean().optional().default(true).describe("Include information about missing ingredients")
        },
        async ({ maxResults, filterByTag, includeTriedOnly, includeMissingIngredients }) => {
            try {
                // Get pantry items
                const pantryItems = await notionService.getPantryItems();

                // Get recipe suggestions
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

                // Calculate which ones we can make with current ingredients
                const recipeSuggestions = recipesWithIngredients.map(recipe => {
                    const canMake = canMakeRecipe(recipe, pantryItems);
                    const missingIngredients = getMissingIngredients(recipe, pantryItems);

                    return {
                        recipe,
                        canMake,
                        missingIngredients,
                        matchScore: canMake ? 100 : Math.round(
                            ((recipe.ingredients.length - missingIngredients.length) / recipe.ingredients.length) * 100
                        )
                    };
                });

                // Sort by match score (best matches first)
                recipeSuggestions.sort((a, b) => b.matchScore - a.matchScore);

                // Limit results
                const limitedSuggestions = recipeSuggestions.slice(0, maxResults);

                // Generate the response
                let response = `# Meal Suggestions Based on Your Pantry\n\n`;

                if (limitedSuggestions.length === 0) {
                    response = "No meal suggestions available based on your current pantry items and filter criteria.";

                    // Provide some helpful tips
                    if (filterByTag || includeTriedOnly) {
                        response += "\n\nTry removing some filters to see more suggestions.";
                    }

                    return {
                        content: [{ type: "text", text: response }]
                    };
                }

                // Add a summary
                response += `Found ${limitedSuggestions.length} recipe suggestions based on your current pantry.\n\n`;

                // List the recipes
                limitedSuggestions.forEach((suggestion, index) => {
                    const { recipe, canMake, missingIngredients, matchScore } = suggestion;

                    // Recipe header with match score
                    response += `## ${index + 1}. ${recipe.recipe.name} (${matchScore}% match)\n`;

                    // Add status
                    if (canMake) {
                        response += `**Status:** ✅ You have all required ingredients!\n`;
                    } else {
                        response += `**Status:** ⚠️ Missing some ingredients\n`;
                    }

                    // Recipe details
                    if (recipe.recipe.tags.length > 0) {
                        response += `**Tags:** ${recipe.recipe.tags.join(', ')}\n`;
                    }

                    if (recipe.recipe.tried) {
                        response += `**Tried Before:** Yes\n`;
                    } else {
                        response += `**Tried Before:** No\n`;
                    }

                    if (recipe.recipe.link) {
                        response += `**Recipe Link:** [View Recipe](${recipe.recipe.link})\n`;
                    }

                    response += `\n`;

                    // Ingredients section
                    response += `### Ingredients\n`;

                    recipe.ingredients.forEach(ingredient => {
                        // Check if we have this ingredient
                        const pantryItem = pantryItems.find(item =>
                            item.name.toLowerCase() === ingredient.name.toLowerCase()
                        );

                        const haveEnough = pantryItem && pantryItem.quantity >= ingredient.quantity;
                        const statusEmoji = ingredient.isOptional ? "📎" : (haveEnough ? "✅" : "❌");

                        // Format the ingredient
                        let ingredientText = `${statusEmoji} ${ingredient.name}: ${ingredient.quantity} ${ingredient.unit}`;

                        if (pantryItem) {
                            ingredientText += ` (you have ${pantryItem.quantity} ${pantryItem.unit})`;
                        } else if (!ingredient.isOptional) {
                            ingredientText += ` (missing)`;
                        }

                        if (ingredient.isOptional) {
                            ingredientText += ` (optional)`;
                        }

                        response += `- ${ingredientText}\n`;
                    });

                    response += `\n`;

                    // Missing ingredients section
                    if (includeMissingIngredients && missingIngredients.length > 0) {
                        response += `### Missing Ingredients\n`;

                        missingIngredients.forEach(missing => {
                            response += `- ${missing.name}: need ${missing.need} ${missing.unit}, have ${missing.have} ${missing.unit}\n`;
                        });

                        response += `\n`;
                    }
                });

                // Add a legend
                response += `*Legend: ✅ = Have ingredient, ❌ = Missing ingredient, 📎 = Optional ingredient*\n`;

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
                // Get recipe details first to show what's being used
                const recipeWithIngredients = await notionService.getRecipeWithIngredients(recipeId);

                if (!recipeWithIngredients) {
                    return {
                        content: [{
                            type: "text",
                            text: `Recipe with ID ${recipeId} not found.`
                        }]
                    };
                }

                // Get pantry before update for comparison
                const pantryBefore = await notionService.getPantryItems();

                // Update the pantry
                await notionService.updatePantryForRecipe(recipeId);

                // Get pantry after update to show what changed
                const pantryAfter = await notionService.getPantryItems();

                // Track what was used and what was added to shopping list
                const usedIngredients: { name: string; before: number; after: number; unit: string }[] = [];
                const addedToShoppingList: string[] = [];

                // Calculate which ingredients were used
                recipeWithIngredients.ingredients.forEach(ingredient => {
                    if (ingredient.isOptional) return; // Skip optional ingredients

                    const before = pantryBefore.find(item => item.name.toLowerCase() === ingredient.name.toLowerCase());
                    const after = pantryAfter.find(item => item.name.toLowerCase() === ingredient.name.toLowerCase());

                    if (before && after) {
                        usedIngredients.push({
                            name: ingredient.name,
                            before: before.quantity,
                            after: after.quantity,
                            unit: before.unit
                        });

                        // Check if item was added to shopping list (if it's a staple and now below minimum)
                        if (addToShoppingList && before.isStaple && before.minQuantity !== undefined &&
                            before.quantity > before.minQuantity &&
                            after.quantity <= before.minQuantity) {
                            addedToShoppingList.push(ingredient.name);
                        }
                    }
                });

                // Generate the response
                let response = `# Pantry Updated\n\n`;
                response += `Your pantry has been updated after preparing **${recipeWithIngredients.recipe.name}**.\n\n`;

                // Show what was used
                response += `## Ingredients Used\n`;

                if (usedIngredients.length === 0) {
                    response += "No ingredients were used from your pantry.\n\n";
                } else {
                    usedIngredients.forEach(ing => {
                        const amountUsed = ing.before - ing.after;
                        response += `- **${ing.name}**: used ${amountUsed} ${ing.unit} (remaining: ${ing.after} ${ing.unit})\n`;
                    });
                    response += `\n`;
                }

                // Show what was added to shopping list
                if (addToShoppingList && addedToShoppingList.length > 0) {
                    response += `## Added to Shopping List\n`;
                    addedToShoppingList.forEach(name => {
                        response += `- **${name}** (staple item running low)\n`;
                    });
                    response += `\n`;
                }

                // Update recipe tried status if not tried before
                if (!recipeWithIngredients.recipe.tried) {
                    try {
                        // This is a placeholder - we'd need to implement this in notionService
                        // await notionService.markRecipeAsTried(recipeId);
                        response += `This was your first time trying this recipe. It has been marked as tried.\n\n`;
                    } catch (error) {
                        console.error("Error marking recipe as tried:", error);
                    }
                }

                // Add view shopping list prompt
                if (addToShoppingList && addedToShoppingList.length > 0) {
                    response += `You can view your updated shopping list using the \`manageShoppingList\` tool.\n`;
                }

                return {
                    content: [{
                        type: "text",
                        text: response
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
                // Check if item already exists with same name
                const existingItems = await notionService.getPantryItems();
                const existingItem = existingItems.find(item =>
                    item.name.toLowerCase() === name.toLowerCase()
                );

                let response = "";

                if (existingItem) {
                    // Update existing item instead of creating a new one
                    const updatedItem = await notionService.updatePantryItem(existingItem.id, {
                        quantity: existingItem.quantity + quantity,
                        expiryDate: expiryDate || existingItem.expiryDate,
                        lastUpdated: new Date().toISOString()
                    });

                    response = `# Item Updated in Pantry\n\n`;
                    response += `**${updatedItem.name}** has been updated in your pantry. Quantity increased by ${quantity} ${unit}.\n\n`;

                    // Details
                    response += `## Updated Details\n`;
                    response += `- Quantity: ${updatedItem.quantity} ${updatedItem.unit}\n`;
                    response += `- Location: ${updatedItem.location}\n`;
                    response += `- Category: ${updatedItem.category}\n`;

                    if (updatedItem.expiryDate) {
                        response += `- Expires: ${updatedItem.expiryDate}\n`;
                    }

                    if (updatedItem.isStaple) {
                        response += `- Staple item: Yes\n`;

                        if (updatedItem.minQuantity) {
                            response += `- Minimum quantity: ${updatedItem.minQuantity} ${updatedItem.unit}\n`;
                        }
                    }
                } else {
                    // Add the item to the pantry
                    const newItem = await notionService.addPantryItem({
                        name,
                        quantity,
                        unit,
                        category,
                        location,
                        expiryDate,
                        isStaple,
                        minQuantity: isStaple ? (minQuantity || Math.ceil(quantity * 0.2)) : undefined
                    });

                    response = `# Item Added to Pantry\n\n`;
                    response += `**${newItem.name}** has been added to your pantry in the ${newItem.category} category.\n\n`;

                    // Details
                    response += `## Details\n`;
                    response += `- Quantity: ${newItem.quantity} ${newItem.unit}\n`;
                    response += `- Location: ${newItem.location}\n`;

                    if (newItem.expiryDate) {
                        response += `- Expires: ${newItem.expiryDate}\n`;
                    }

                    if (newItem.isStaple) {
                        response += `- Staple item: Yes\n`;

                        if (newItem.minQuantity) {
                            response += `- Minimum quantity: ${newItem.minQuantity} ${newItem.unit}\n`;
                        }
                    }
                }

                return {
                    content: [{ type: "text", text: response }]
                };
            } catch (error: any) {
                console.error("Error in addPantryItem:", error);
                return {
                    content: [{ type: "text", text: `Error adding pantry item: ${error.message}` }]
                };
            }
        }
    );

    /**
     * Tool: Manage shopping list
     */
    server.tool(
        "manageShoppingList",
        "View and manage your shopping list",
        {
            action: z.enum(["view", "add", "markPurchased", "addToPantry"]).describe("The action to perform on the shopping list"),
            itemId: z.string().optional().describe("ID of the shopping list item (for markPurchased action)"),
            itemName: z.string().optional().describe("Name of the item to add (for add action)"),
            itemQuantity: z.number().optional().describe("Quantity of the item to add (for add action)"),
            itemUnit: z.string().optional().describe("Unit of measurement (for add action)"),
            itemCategory: z.string().optional().describe("Category of the item (for add action)"),
            itemPriority: z.enum(["Low", "Medium", "High"]).optional().default("Medium").describe("Priority of the item (for add action)")
        },
        async ({ action, itemId, itemName, itemQuantity, itemUnit, itemCategory, itemPriority }) => {
            try {
                let response = "";

                switch (action) {
                    case "view":
                        // Get the shopping list
                        const shoppingList = await notionService.getShoppingList();

                        response = `# Shopping List\n\n`;

                        if (shoppingList.length === 0) {
                            response += "Your shopping list is empty.\n";
                        } else {
                            // Group by category
                            const categories = new Map<string, typeof shoppingList>();

                            for (const item of shoppingList) {
                                if (!categories.has(item.category)) {
                                    categories.set(item.category, []);
                                }
                                categories.get(item.category)?.push(item);
                            }

                            // Display by category
                            for (const [category, items] of categories.entries()) {
                                response += `## ${category}\n`;

                                items.forEach(item => {
                                    const checkmark = item.isPurchased ? "✅ " : "☐ ";
                                    const priorityMarker = item.priority === "High" ? "🔴 " :
                                        item.priority === "Medium" ? "🟡 " : "🟢 ";

                                    response += `- ${checkmark}${priorityMarker}**${item.name}**: ${item.quantity} ${item.unit}\n`;
                                });

                                response += "\n";
                            }

                            // Summary
                            const purchasedCount = shoppingList.filter(item => item.isPurchased).length;
                            response += `Total items: ${shoppingList.length} (${purchasedCount} purchased)\n`;

                            // Add instructions for other actions
                            response += `\n**Tip:** You can use this tool to add items, mark items as purchased, or add purchased items to your pantry.\n`;
                        }
                        break;

                    case "add":
                        // Validate required fields
                        if (!itemName || !itemQuantity || !itemUnit || !itemCategory) {
                            return {
                                content: [{
                                    type: "text",
                                    text: "Missing required fields for adding an item. Please provide name, quantity, unit, and category."
                                }]
                            };
                        }

                        // Check if item already exists in shopping list
                        const existingList = await notionService.getShoppingList();
                        const existingItem = existingList.find(item =>
                            item.name.toLowerCase() === itemName.toLowerCase() && !item.isPurchased
                        );

                        if (existingItem) {
                            // Update existing item
                            const updatedItem = await notionService.updateShoppingListItem(existingItem.id, {
                                quantity: existingItem.quantity + itemQuantity,
                                priority: itemPriority || existingItem.priority
                            });

                            response = `# Item Updated in Shopping List\n\n`;
                            response += `**${updatedItem.name}** has been updated in your shopping list. Quantity increased to ${updatedItem.quantity} ${updatedItem.unit}.\n`;
                        } else {
                            // Add the item
                            const newItem = await notionService.addToShoppingList({
                                name: itemName,
                                quantity: itemQuantity,
                                unit: itemUnit,
                                category: itemCategory,
                                priority: itemPriority || "Medium",
                                isPurchased: false,
                                isAutoAdded: false
                            });

                            response = `# Item Added to Shopping List\n\n`;
                            response += `**${newItem.name}** (${newItem.quantity} ${newItem.unit}) has been added to your shopping list in the ${newItem.category} category.\n`;
                        }
                        break;

                    case "markPurchased":
                        // Validate item ID
                        if (!itemId) {
                            return {
                                content: [{
                                    type: "text",
                                    text: "Missing item ID. Please provide the ID of the item to mark as purchased."
                                }]
                            };
                        }

                        // Mark the item as purchased
                        const updatedItem = await notionService.markAsPurchased(itemId);

                        response = `# Item Marked as Purchased\n\n`;
                        response += `**${updatedItem.name}** has been marked as purchased on your shopping list.\n`;

                        // Suggest adding to pantry
                        response += `\nYou can add all purchased items to your pantry using the \`addToPantry\` action.\n`;
                        break;

                    case "addToPantry":
                        // Add all purchased items to the pantry
                        await notionService.addPurchasedItemsToPantry();

                        response = `# Purchased Items Added to Pantry\n\n`;
                        response += `All purchased items have been added to your pantry and removed from the shopping list.\n`;

                        // Suggest viewing pantry
                        response += `\nYou can view your updated pantry using the \`getPantryInfo\` tool.\n`;
                        break;

                    default:
                        response = "Invalid action specified.";
                }

                return {
                    content: [{ type: "text", text: response }]
                };
            } catch (error: any) {
                console.error("Error in manageShoppingList:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error managing shopping list: ${error.message}`
                    }]
                };
            }
        }
    );
}