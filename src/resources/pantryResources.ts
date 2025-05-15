import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NotionPantryService } from "../services/notionPantryService";

export function registerPantryResources(
    server: McpServer,
    notionService: NotionPantryService
) {
    // === PANTRY RESOURCES ===

    // Main pantry resource - provides summary of pantry inventory
    server.resource(
        "pantry",
        "mcp://resource/pantry",
        async (uri) => {
            try {
                const items = await notionService.getPantryItems();

                // Calculate stats for the pantry
                const categories = new Map<string, number>();
                let expiringItems = 0;
                let lowStapleItems = 0;

                // Calculate one week from now for expiry checking
                const oneWeekFromNow = new Date();
                oneWeekFromNow.setDate(oneWeekFromNow.getDate() + 7);

                items.forEach(item => {
                    // Count by category
                    categories.set(
                        item.category,
                        (categories.get(item.category) || 0) + 1
                    );

                    // Check for expiring items
                    if (item.expiryDate) {
                        const expiryDate = new Date(item.expiryDate);
                        if (expiryDate <= oneWeekFromNow) {
                            expiringItems++;
                        }
                    }

                    // Check for low staple items
                    if (item.isStaple && item.minQuantity && item.quantity <= item.minQuantity) {
                        lowStapleItems++;
                    }
                });

                // Convert categories map to object
                const categoryObj: Record<string, number> = {};
                categories.forEach((count, category) => {
                    categoryObj[category] = count;
                });

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    total: items.length,
                                    categories: Object.keys(categoryObj),
                                    categoryCounts: categoryObj,
                                    stapleCount: items.filter(item => item.isStaple).length,
                                    expiringItemsCount: expiringItems,
                                    lowStapleItemsCount: lowStapleItems,
                                    items: items.map(item => ({
                                        id: item.id,
                                        name: item.name,
                                        quantity: `${item.quantity} ${item.unit}`,
                                        category: item.category,
                                        location: item.location,
                                        expiry: item.expiryDate || "No expiry"
                                    }))
                                },
                                null,
                                2
                            )
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

    // Pantry statistics resource - provides analytics about the pantry
    server.resource(
        "pantryStats",
        "mcp://resource/pantry/stats",
        async (uri) => {
            try {
                const items = await notionService.getPantryItems();

                // Calculate statistics
                const totalItems = items.length;
                const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
                const averageQuantity = totalQuantity / totalItems;

                // Count by category
                const categories = new Map<string, number>();
                items.forEach(item => {
                    categories.set(
                        item.category,
                        (categories.get(item.category) || 0) + 1
                    );
                });

                // Count by location
                const locations = new Map<string, number>();
                items.forEach(item => {
                    locations.set(
                        item.location,
                        (locations.get(item.location) || 0) + 1
                    );
                });

                // Calculate expiring soon items
                const today = new Date();
                const oneWeekLater = new Date();
                oneWeekLater.setDate(today.getDate() + 7);

                const expiringSoon = items.filter(item => {
                    if (!item.expiryDate) return false;
                    const expiryDate = new Date(item.expiryDate);
                    return expiryDate <= oneWeekLater && expiryDate >= today;
                });

                // Calculate staples low
                const staplesLow = items.filter(item =>
                    item.isStaple &&
                    item.minQuantity !== undefined &&
                    item.quantity <= item.minQuantity
                );

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    totalItems,
                                    totalQuantity,
                                    averageQuantity,
                                    categoryBreakdown: Object.fromEntries(categories),
                                    locationBreakdown: Object.fromEntries(locations),
                                    expiringSoonCount: expiringSoon.length,
                                    staplesLowCount: staplesLow.length,
                                    expiringSoon: expiringSoon.map(item => ({
                                        name: item.name,
                                        expiryDate: item.expiryDate
                                    })),
                                    staplesLow: staplesLow.map(item => ({
                                        name: item.name,
                                        quantity: item.quantity,
                                        minQuantity: item.minQuantity
                                    }))
                                },
                                null,
                                2
                            )
                        }
                    ]
                };
            } catch (error) {
                console.error("Error generating pantry stats:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to generate pantry statistics" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Pantry categories resource - list all categories
    server.resource(
        "pantryCategories",
        "mcp://resource/pantry/categories",
        async (uri) => {
            try {
                const items = await notionService.getPantryItems();
                const categories = [...new Set(items.map(item => item.category))];

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(categories, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching pantry categories:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch pantry categories" }, null, 2)
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

                // Format the response in a more readable way
                const formattedItem = {
                    ...item,
                    formattedQuantity: `${item.quantity} ${item.unit}`,
                    formattedExpiry: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "No expiry date",
                    stapleStatus: item.isStaple
                        ? (item.minQuantity && item.quantity <= item.minQuantity
                            ? "Low (needs to be replenished)"
                            : "Good")
                        : "Not a staple item"
                };

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(formattedItem, null, 2)
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
                            text: JSON.stringify(
                                {
                                    category,
                                    count: items.length,
                                    items: items.map(item => ({
                                        id: item.id,
                                        name: item.name,
                                        quantity: `${item.quantity} ${item.unit}`,
                                        location: item.location,
                                        expiry: item.expiryDate || "No expiry"
                                    }))
                                },
                                null,
                                2
                            )
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

    // === RECIPE RESOURCES ===

    // Recipe list resource
    server.resource(
        "recipes",
        "mcp://resource/recipes",
        async (uri) => {
            try {
                const recipes = await notionService.getRecipes();
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    total: recipes.length,
                                    tags: [...new Set(recipes.flatMap(recipe => recipe.tags))],
                                    recipes: recipes.map(recipe => ({
                                        id: recipe.id,
                                        name: recipe.name,
                                        tags: recipe.tags,
                                        tried: recipe.tried ? "Yes" : "No",
                                        link: recipe.link || "No link"
                                    }))
                                },
                                null,
                                2
                            )
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching recipes:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch recipes" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // Recipe suggestions resource
    server.resource(
        "recipeSuggestions",
        "mcp://resource/recipes/suggestions",
        async (uri) => {
            try {
                const pantryItems = await notionService.getPantryItems();
                const suggestions = await notionService.suggestMeals(pantryItems, 5);

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    count: suggestions.length,
                                    suggestions: suggestions.map(suggestion => ({
                                        id: suggestion.recipe.id,
                                        name: suggestion.recipe.name,
                                        tags: suggestion.recipe.tags,
                                        tried: suggestion.recipe.tried ? "Yes" : "No",
                                        ingredients: suggestion.ingredients.map(ing => ({
                                            name: ing.name,
                                            quantity: `${ing.quantity} ${ing.unit}`,
                                            optional: ing.isOptional ? "Yes" : "No"
                                        }))
                                    }))
                                },
                                null,
                                2
                            )
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching recipe suggestions:", error);
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

    // Recipe tags resource
    server.resource(
        "recipeTags",
        "mcp://resource/recipes/tags",
        async (uri) => {
            try {
                const recipes = await notionService.getRecipes();
                const tags = [...new Set(recipes.flatMap(recipe => recipe.tags))];

                // Count recipes per tag
                const tagCounts: Record<string, number> = {};
                tags.forEach(tag => {
                    tagCounts[tag] = recipes.filter(recipe => recipe.tags.includes(tag)).length;
                });

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    tags,
                                    counts: tagCounts
                                },
                                null,
                                2
                            )
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching recipe tags:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch recipe tags" }, null, 2)
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
                const recipeWithIngredients = await notionService.getRecipeWithIngredients(recipeId);

                if (!recipeWithIngredients) {
                    return {
                        contents: [
                            {
                                uri: uri.href,
                                text: JSON.stringify({ error: `Recipe with ID ${recipeId} not found` }, null, 2)
                            }
                        ]
                    };
                }

                // Get pantry info for checking ingredient availability
                const pantryItems = await notionService.getPantryItems();

                // Check which ingredients we have
                const ingredientsWithAvailability = recipeWithIngredients.ingredients.map(ingredient => {
                    const pantryItem = pantryItems.find(item =>
                        item.name.toLowerCase() === ingredient.name.toLowerCase()
                    );

                    return {
                        name: ingredient.name,
                        quantity: `${ingredient.quantity} ${ingredient.unit}`,
                        optional: ingredient.isOptional ? "Yes" : "No",
                        available: pantryItem
                            ? (pantryItem.quantity >= ingredient.quantity ? "Yes" : "Insufficient")
                            : "No",
                        haveQuantity: pantryItem ? `${pantryItem.quantity} ${pantryItem.unit}` : "0"
                    };
                });

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    id: recipeWithIngredients.recipe.id,
                                    name: recipeWithIngredients.recipe.name,
                                    tags: recipeWithIngredients.recipe.tags,
                                    tried: recipeWithIngredients.recipe.tried ? "Yes" : "No",
                                    link: recipeWithIngredients.recipe.link || "No link",
                                    createdAt: recipeWithIngredients.recipe.createdAt,
                                    ingredients: ingredientsWithAvailability,
                                    canMake: ingredientsWithAvailability.every(ing =>
                                        ing.optional === "Yes" || ing.available === "Yes"
                                    )
                                },
                                null,
                                2
                            )
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

    // Recipes by tag resource
    server.resource(
        "recipesByTag",
        new ResourceTemplate("recipes-by-tag://{tag}", { list: undefined }),
        async (uri, vars) => {
            try {
                const tag = Array.isArray(vars.tag) ? vars.tag[0] : vars.tag;
                const recipes = await notionService.getRecipesByTag(tag);

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(
                                {
                                    tag,
                                    count: recipes.length,
                                    recipes: recipes.map(recipe => ({
                                        id: recipe.id,
                                        name: recipe.name,
                                        tags: recipe.tags,
                                        tried: recipe.tried ? "Yes" : "No",
                                        link: recipe.link || "No link"
                                    }))
                                },
                                null,
                                2
                            )
                        }
                    ]
                };
            } catch (error) {
                console.error(`Error fetching recipes for tag ${vars.tag}:`, error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch recipes by tag" }, null, 2)
                        }
                    ]
                };
            }
        }
    );

    // === SHOPPING LIST RESOURCES ===

    // Shopping list resource
    server.resource(
        "shoppingList",
        "mcp://resource/shopping-list",
        async (uri) => {
            try {
                const shoppingList = await notionService.getShoppingList();

                // Group by category
                const categories = new Map<string, typeof shoppingList>();
                shoppingList.forEach(item => {
                    if (!categories.has(item.category)) {
                        categories.set(item.category, []);
                    }
                    categories.get(item.category)?.push(item);
                });

                // Format result
                const result: any = {
                    total: shoppingList.length,
                    purchased: shoppingList.filter(item => item.isPurchased).length,
                    categories: Object.fromEntries(
                        Array.from(categories.entries()).map(([category, items]) => [
                            category,
                            items.map(item => ({
                                id: item.id,
                                name: item.name,
                                quantity: `${item.quantity} ${item.unit}`,
                                priority: item.priority,
                                purchased: item.isPurchased ? "Yes" : "No",
                                autoAdded: item.isAutoAdded ? "Yes" : "No"
                            }))
                        ])
                    )
                };

                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            } catch (error) {
                console.error("Error fetching shopping list:", error);
                return {
                    contents: [
                        {
                            uri: uri.href,
                            text: JSON.stringify({ error: "Failed to fetch shopping list" }, null, 2)
                        }
                    ]
                };
            }
        }
    );
}