// src/services/notionPantryService.ts
import { Client } from "@notionhq/client";
import {
    type PantryItem,
    type Recipe,
    type RecipeIngredient,
    type RecipeWithIngredients,
    type ShoppingListItem
} from "../types";
import { notionPageToRecipe } from "../types/recipe";

export class NotionPantryService {
    private notion: Client;
    private useDummyData: boolean;

    constructor(
        private notionToken: string,
        private pantryDbId: string,
        private recipesDbId: string,
        private shoppingListDbId: string,
        useDummyData: boolean = false
    ) {
        this.useDummyData = useDummyData;

        this.notion = new Client({
            auth: notionToken,
            fetch: (...args) => {
                // Use the global fetch with the correct binding
                return fetch(...args);
            }
        });

        console.log(`NotionPantryService initialized with${useDummyData ? ' dummy data' : ' real Notion connection'}`);
    }

    // ====== PANTRY METHODS ======

    /**
     * Delete a shopping list item
     */
    async deleteShoppingListItem(id: string): Promise<void> {
        if (this.useDummyData) {
            console.log(`[DUMMY] Deleted shopping list item: ${id}`);
            return;
        }

        try {
            await this.notion.pages.update({
                page_id: id,
                archived: true
            });
        } catch (error) {
            console.error(`Error deleting shopping list item ${id}:`, error);
            throw new Error(`Failed to delete shopping list item ${id}`);
        }
    }

    /**
    * Get all pantry items
    */
    async getPantryItems(): Promise<PantryItem[]> {
        if (this.useDummyData) {
            return this.getDummyPantryItems();
        }

        try {
            const response = await this.notion.databases.query({
                database_id: this.pantryDbId,
                sorts: [
                    {
                        property: "Name",
                        direction: "ascending"
                    }
                ]
            });

            // Map results without URLs first
            const items = response.results.map(page => this.notionPageToPantryItem(page));

            // Batch get all URLs at once
            const pageIds = items.map(item => item.id);
            const urlMap = await this.batchGetNotionPageUrls(pageIds);

            // Add URLs to items
            return items.map(item => ({
                ...item,
                notionUrl: urlMap[item.id]
            }));
        } catch (error) {
            console.error('Error fetching pantry items:', error);
            throw new Error(`Failed to fetch pantry items from Notion: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get a specific pantry item by ID
     */
    async getPantryItemById(itemId: string): Promise<PantryItem | null> {
        if (this.useDummyData) {
            const items = await this.getDummyPantryItems();
            return items.find(item => item.id === itemId) || null;
        }

        try {
            const page = await this.notion.pages.retrieve({
                page_id: itemId
            });

            const item = this.notionPageToPantryItem(page);

            const url = await this.getNotionPageUrl(itemId);
            return { ...item, notionUrl: url || undefined };
        } catch (error) {
            console.error(`Error fetching pantry item ${itemId}:`, error);
            return null;
        }
    }

    /**
     * Get pantry items by category
     */
    async getPantryItemsByCategory(category: string): Promise<PantryItem[]> {
        if (this.useDummyData) {
            const items = await this.getDummyPantryItems();
            return items.filter(item => item.category === category);
        }

        try {
            const response = await this.notion.databases.query({
                database_id: this.pantryDbId,
                filter: {
                    property: "Category",
                    select: {
                        equals: category
                    }
                },
                sorts: [
                    {
                        property: "Name",
                        direction: "ascending"
                    }
                ]
            });

            return response.results.map(page => this.notionPageToPantryItem(page));
        } catch (error) {
            console.error(`Error fetching pantry items for category ${category}:`, error);
            throw new Error(`Failed to fetch pantry items for category ${category}`);
        }
    }

    /**
     * Add a new pantry item
     */
    async addPantryItem(item: Omit<PantryItem, 'id' | 'createdAt' | 'lastUpdated'>): Promise<PantryItem> {
        if (this.useDummyData) {
            const dummyItem: PantryItem = {
                id: `dummy_${Date.now()}`,
                ...item,
                createdAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            console.log(`[DUMMY] Added pantry item: ${dummyItem.name}`);
            return dummyItem;
        }

        try {
            const response = await this.notion.pages.create({
                parent: {
                    database_id: this.pantryDbId
                },
                properties: this.pantryItemToNotionProperties(item)
            });

            return this.notionPageToPantryItem(response);
        } catch (error) {
            console.error('Error adding pantry item:', error);
            throw new Error('Failed to add pantry item to Notion');
        }
    }

    /**
     * Update a pantry item
     */
    async updatePantryItem(id: string, item: Partial<PantryItem>): Promise<PantryItem> {
        if (this.useDummyData) {
            const dummyItem: PantryItem = {
                ...this.getDummyPantryItems().find(i => i.id === id)!,
                ...item,
                lastUpdated: new Date().toISOString()
            };

            console.log(`[DUMMY] Updated pantry item: ${dummyItem.name}`);
            return dummyItem;
        }

        try {
            const response = await this.notion.pages.update({
                page_id: id,
                properties: this.pantryItemToNotionProperties(item)
            });

            return this.notionPageToPantryItem(response);
        } catch (error) {
            console.error(`Error updating pantry item ${id}:`, error);
            throw new Error(`Failed to update pantry item ${id}`);
        }
    }

    /**
     * Delete a pantry item
     */
    async deletePantryItem(id: string): Promise<void> {
        if (this.useDummyData) {
            console.log(`[DUMMY] Deleted pantry item: ${id}`);
            return;
        }

        try {
            await this.notion.pages.update({
                page_id: id,
                archived: true
            });
        } catch (error) {
            console.error(`Error deleting pantry item ${id}:`, error);
            throw new Error(`Failed to delete pantry item ${id}`);
        }
    }

    // ====== RECIPE METHODS ======

    /**
 * Get all recipes
 */
    async getRecipes(): Promise<Recipe[]> {
        if (this.useDummyData) {
            return this.getDummyRecipes();
        }

        try {
            const response = await this.notion.databases.query({
                database_id: this.recipesDbId,
                sorts: [
                    {
                        property: "Name",
                        direction: "ascending"
                    }
                ]
            });

            // Map results to Recipe objects
            const recipes = response.results.map(page => notionPageToRecipe(page));

            // Fetch URLs for each recipe
            const recipesWithUrls = await Promise.all(
                recipes.map(async (recipe) => {
                    const url = await this.getNotionPageUrl(recipe.id);
                    return { ...recipe, notionUrl: url || undefined };
                })
            );

            return recipesWithUrls;
        } catch (error) {
            console.error('Error fetching recipes:', error);
            throw new Error('Failed to fetch recipes from Notion');
        }
    }

    /**
     * Get a specific recipe by ID
     */
    async getRecipeById(recipeId: string): Promise<Recipe | null> {
        if (this.useDummyData) {
            const recipes = await this.getDummyRecipes();
            return recipes.find(recipe => recipe.id === recipeId) || null;
        }

        try {
            const page = await this.notion.pages.retrieve({
                page_id: recipeId
            });

            const recipe = notionPageToRecipe(page);

            const url = await this.getNotionPageUrl(recipeId);

            return { ...recipe, notionUrl: url || undefined };
        } catch (error) {
            console.error(`Error fetching recipe ${recipeId}:`, error);
            return null;
        }
    }

    /**
     * Get recipes by tag
     */
    async getRecipesByTag(tag: string): Promise<Recipe[]> {
        if (this.useDummyData) {
            const recipes = await this.getDummyRecipes();
            return recipes.filter(recipe => recipe.tags.includes(tag));
        }

        try {
            const response = await this.notion.databases.query({
                database_id: this.recipesDbId,
                filter: {
                    property: "Tags",
                    multi_select: {
                        contains: tag
                    }
                },
                sorts: [
                    {
                        property: "Name",
                        direction: "ascending"
                    }
                ]
            });

            return response.results.map(page => notionPageToRecipe(page));
        } catch (error) {
            console.error(`Error fetching recipes for tag ${tag}:`, error);
            throw new Error(`Failed to fetch recipes for tag ${tag}`);
        }
    }

    /**
     * Get recipes with ingredients
     */
    async getRecipesWithIngredients(): Promise<RecipeWithIngredients[]> {
        // Get recipes
        const recipes = await this.getRecipes();

        // For each recipe, get its ingredients
        return Promise.all(recipes.map(async recipe => {
            // In a real implementation, we'd fetch ingredients from a related database
            // For now, we'll use dummy ingredients
            const ingredients = this.useDummyData
                ? this.getDummyIngredientsForRecipe(recipe.id)
                : await this.generateIngredientsFromRecipeName(recipe.name, recipe.tags);

            return {
                recipe,
                ingredients
            };
        }));
    }

    /**
     * Get specific recipe with ingredients
     */
    async getRecipeWithIngredients(recipeId: string): Promise<RecipeWithIngredients | null> {
        const recipe = await this.getRecipeById(recipeId);

        if (!recipe) return null;

        // Get ingredients
        const ingredients = this.useDummyData
            ? this.getDummyIngredientsForRecipe(recipeId)
            : await this.generateIngredientsFromRecipeName(recipe.name, recipe.tags);

        return {
            recipe,
            ingredients
        };
    }

    /**
    * Mark a recipe as tried
    */
    async markRecipeAsTried(recipeId: string): Promise<Recipe | null> {
        if (this.useDummyData) {
            const recipes = this.getDummyRecipes();
            const recipeIndex = recipes.findIndex(r => r.id === recipeId);
            if (recipeIndex === -1) return null;

            const updatedRecipe = { ...recipes[recipeIndex], tried: true };
            console.log(`[DUMMY] Marked recipe as tried: ${updatedRecipe.name}`);
            return updatedRecipe;
        }

        try {
            const recipe = await this.getRecipeById(recipeId);
            if (!recipe) return null;

            // Only update if not already tried
            if (!recipe.tried) {
                const response = await this.notion.pages.update({
                    page_id: recipeId,
                    properties: {
                        'Tried?': {
                            checkbox: true
                        }
                    }
                });

                return notionPageToRecipe(response);
            }

            return recipe;
        } catch (error) {
            console.error(`Error marking recipe ${recipeId} as tried:`, error);
            return null;
        }
    }

    /**
     * Suggest meals based on available pantry ingredients
     */
    async suggestMeals(pantryItems: PantryItem[], maxResults: number = 5): Promise<RecipeWithIngredients[]> {
        // Get all recipes with ingredients
        const recipesWithIngredients = await this.getRecipesWithIngredients();

        // Calculate which recipes can be made with available ingredients
        const recipeMatches = recipesWithIngredients.map(recipe => {
            // Count how many ingredients we have for this recipe
            const availableIngredients = recipe.ingredients.filter(ingredient => {
                const pantryItem = pantryItems.find(item =>
                    item.name.toLowerCase() === ingredient.name.toLowerCase());

                // We have this ingredient if it's in our pantry with sufficient quantity
                // or if it's optional
                return ingredient.isOptional ||
                    (pantryItem && pantryItem.quantity >= ingredient.quantity);
            });

            // Calculate match percentage (how many ingredients we have)
            const matchPercentage = recipe.ingredients.length > 0
                ? availableIngredients.length / recipe.ingredients.length
                : 0;

            return {
                recipe: recipe,
                matchPercentage
            };
        });

        // Sort by match percentage (highest first)
        recipeMatches.sort((a, b) => b.matchPercentage - a.matchPercentage);

        // Return top matches
        return recipeMatches
            .slice(0, maxResults)
            .map(match => match.recipe);
    }

    /**
     * Update pantry after preparing a recipe
     */
    async updatePantryForRecipe(recipeId: string): Promise<void> {
        if (this.useDummyData) {
            console.log(`[DUMMY] Updated pantry after using recipe ${recipeId}`);
            return;
        }

        try {
            // Get recipe with ingredients
            const recipeWithIngredients = await this.getRecipeWithIngredients(recipeId);

            if (!recipeWithIngredients) {
                throw new Error(`Recipe ${recipeId} not found`);
            }

            // Get current pantry items
            const pantryItems = await this.getPantryItems();

            // Update quantities for each ingredient
            for (const ingredient of recipeWithIngredients.ingredients) {
                // Find matching pantry item
                const pantryItem = pantryItems.find(item =>
                    item.name.toLowerCase() === ingredient.name.toLowerCase());

                if (pantryItem) {
                    // Calculate new quantity
                    const newQuantity = Math.max(0, pantryItem.quantity - ingredient.quantity);

                    // Update in Notion
                    await this.updatePantryItem(pantryItem.id, {
                        quantity: newQuantity
                    });

                    // If quantity is now 0 or below minimum for staples, add to shopping list
                    if (newQuantity === 0 || (pantryItem.isStaple && pantryItem.minQuantity && newQuantity <= pantryItem.minQuantity)) {
                        await this.addToShoppingList({
                            name: pantryItem.name,
                            quantity: pantryItem.isStaple ? pantryItem.minQuantity || 1 : ingredient.quantity,
                            unit: pantryItem.unit,
                            category: pantryItem.category,
                            priority: pantryItem.isStaple ? 'High' : 'Medium',
                            isPurchased: false,
                            isAutoAdded: true
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error updating pantry for recipe ${recipeId}:`, error);
            throw new Error(`Failed to update pantry for recipe ${recipeId}`);
        }
    }

    // ====== SHOPPING LIST METHODS ======

    /**
 * Get all shopping list items
 */
    async getShoppingList(): Promise<ShoppingListItem[]> {
        if (this.useDummyData) {
            return this.getDummyShoppingList();
        }

        try {
            const response = await this.notion.databases.query({
                database_id: this.shoppingListDbId,
                sorts: [
                    {
                        property: "Category",
                        direction: "ascending"
                    },
                    {
                        property: "Name",
                        direction: "ascending"
                    }
                ]
            });

            // Map results to shopping list items
            const items = response.results.map(page => this.notionPageToShoppingListItem(page));

            // Fetch URLs for each item
            const itemsWithUrls = await Promise.all(
                items.map(async (item) => {
                    const url = await this.getNotionPageUrl(item.id);
                    return { ...item, notionUrl: url || undefined };
                })
            );

            return itemsWithUrls;
        } catch (error) {
            console.error('Error fetching shopping list:', error);
            throw new Error('Failed to fetch shopping list from Notion');
        }
    }

    /**
     * Add item to shopping list
     */
    async addToShoppingList(item: Omit<ShoppingListItem, 'id' | 'addedAt' | 'lastUpdated'>): Promise<ShoppingListItem> {
        if (this.useDummyData) {
            const dummyItem: ShoppingListItem = {
                id: `dummy_${Date.now()}`,
                ...item,
                addedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            };

            console.log(`[DUMMY] Added to shopping list: ${dummyItem.name}`);
            return dummyItem;
        }

        try {
            const response = await this.notion.pages.create({
                parent: {
                    database_id: this.shoppingListDbId
                },
                properties: this.shoppingListItemToNotionProperties(item)
            });

            return this.notionPageToShoppingListItem(response);
        } catch (error) {
            console.error('Error adding to shopping list:', error);
            throw new Error('Failed to add item to shopping list in Notion');
        }
    }

    /**
     * Update shopping list item
     */
    async updateShoppingListItem(id: string, item: Partial<ShoppingListItem>): Promise<ShoppingListItem> {
        if (this.useDummyData) {
            const dummyItem: ShoppingListItem = {
                ...this.getDummyShoppingList().find(i => i.id === id)!,
                ...item,
                lastUpdated: new Date().toISOString()
            };

            console.log(`[DUMMY] Updated shopping list item: ${dummyItem.name}`);
            return dummyItem;
        }

        try {
            const response = await this.notion.pages.update({
                page_id: id,
                properties: this.shoppingListItemToNotionProperties(item)
            });

            return this.notionPageToShoppingListItem(response);
        } catch (error) {
            console.error(`Error updating shopping list item ${id}:`, error);
            throw new Error(`Failed to update shopping list item ${id}`);
        }
    }

    /**
     * Mark item as purchased
     */
    async markAsPurchased(id: string): Promise<ShoppingListItem> {
        return this.updateShoppingListItem(id, { isPurchased: true });
    }

    /**
     * Add purchased items to pantry and remove from shopping list
     */
    async addPurchasedItemsToPantry(): Promise<void> {
        if (this.useDummyData) {
            console.log(`[DUMMY] Added purchased items to pantry`);
            return;
        }

        try {
            // Get purchased items from shopping list
            const shoppingList = await this.getShoppingList();
            const purchasedItems = shoppingList.filter(item => item.isPurchased);

            // For each purchased item
            for (const item of purchasedItems) {
                // Check if this item already exists in pantry
                const pantryItems = await this.getPantryItems();
                const existingItem = pantryItems.find(pantryItem =>
                    pantryItem.name.toLowerCase() === item.name.toLowerCase());

                if (existingItem) {
                    // Update existing item quantity
                    await this.updatePantryItem(existingItem.id, {
                        quantity: existingItem.quantity + item.quantity
                    });
                } else {
                    // Add as new pantry item
                    await this.addPantryItem({
                        name: item.name,
                        quantity: item.quantity,
                        unit: item.unit,
                        category: item.category,
                        location: 'Pantry', // Default location
                        isStaple: false,
                        notes: item.notes
                    });
                }

                // Remove from shopping list (archive in Notion)
                await this.notion.pages.update({
                    page_id: item.id,
                    archived: true
                });
            }
        } catch (error) {
            console.error('Error adding purchased items to pantry:', error);
            throw new Error('Failed to add purchased items to pantry');
        }
    }

    // ====== HELPER METHODS ======

    /**
     * Convert Notion page to PantryItem
     */
    private notionPageToPantryItem(page: any): PantryItem {
        return {
            id: page.id,
            name: page.properties['Name']?.title?.[0]?.plain_text || '',
            quantity: page.properties['Quantity']?.number || 0,
            unit: page.properties['Unit']?.select?.name || '',
            category: page.properties['Category']?.select?.name || '',
            location: page.properties['Location']?.select?.name || '',
            expiryDate: page.properties['Expiry']?.date?.start,
            notes: page.properties['Notes']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
            isStaple: page.properties['Staple']?.checkbox || false,
            tags: page.properties['Tags']?.multi_select?.map((ms: any) => ms.name) || [],
            minQuantity: page.properties['MinQuantity']?.number,
            lastUpdated: page.last_edited_time,
            createdAt: page.created_time
        };
    }

    /**
     * Convert PantryItem to Notion properties
     */
    private pantryItemToNotionProperties(item: Partial<PantryItem>): any {
        const properties: any = {};

        if (item.name !== undefined) {
            properties['Name'] = {
                title: [
                    {
                        text: {
                            content: item.name
                        }
                    }
                ]
            };
        }

        if (item.quantity !== undefined) {
            properties['Quantity'] = {
                number: item.quantity
            };
        }

        if (item.unit !== undefined) {
            properties['Unit'] = {
                select: {
                    name: item.unit
                }
            };
        }

        if (item.category !== undefined) {
            properties['Category'] = {
                select: {
                    name: item.category
                }
            };
        }

        if (item.location !== undefined) {
            properties['Location'] = {
                select: {
                    name: item.location
                }
            };
        }

        if (item.expiryDate !== undefined) {
            properties['Expiry'] = {
                date: item.expiryDate ? {
                    start: item.expiryDate
                } : null
            };
        }

        if (item.notes !== undefined) {
            properties['Notes'] = {
                rich_text: item.notes ? [
                    {
                        text: {
                            content: item.notes
                        }
                    }
                ] : []
            };
        }

        if (item.isStaple !== undefined) {
            properties['Staple'] = {
                checkbox: item.isStaple
            };
        }

        if (item.tags !== undefined) {
            properties['Tags'] = {
                multi_select: item.tags.map(tag => ({
                    name: tag
                }))
            };
        }

        if (item.minQuantity !== undefined) {
            properties['MinQuantity'] = {
                number: item.minQuantity
            };
        }

        return properties;
    }

    /**
     * Convert Notion page to ShoppingListItem
     */
    private notionPageToShoppingListItem(page: any): ShoppingListItem {
        return {
            id: page.id,
            name: page.properties['Name']?.title?.[0]?.plain_text || '',
            quantity: page.properties['Quantity']?.number || 0,
            unit: page.properties['Unit']?.select?.name || '',
            category: page.properties['Category']?.select?.name || '',
            priority: page.properties['Priority']?.select?.name || 'Medium',
            isPurchased: page.properties['Purchased']?.checkbox || false,
            isAutoAdded: page.properties['AutoAdded']?.checkbox || false,
            notes: page.properties['Notes']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
            addedAt: page.created_time,
            lastUpdated: page.last_edited_time
        };
    }

    /**
     * Convert ShoppingListItem to Notion properties
     */
    private shoppingListItemToNotionProperties(item: Partial<ShoppingListItem>): any {
        const properties: any = {};

        if (item.name !== undefined) {
            properties['Name'] = {
                title: [
                    {
                        text: {
                            content: item.name
                        }
                    }
                ]
            };
        }

        if (item.quantity !== undefined) {
            properties['Quantity'] = {
                number: item.quantity
            };
        }

        if (item.unit !== undefined) {
            properties['Unit'] = {
                select: {
                    name: item.unit
                }
            };
        }

        if (item.category !== undefined) {
            properties['Category'] = {
                select: {
                    name: item.category
                }
            };
        }

        if (item.priority !== undefined) {
            properties['Priority'] = {
                select: {
                    name: item.priority
                }
            };
        }

        if (item.isPurchased !== undefined) {
            properties['Purchased'] = {
                checkbox: item.isPurchased
            };
        }

        if (item.isAutoAdded !== undefined) {
            properties['AutoAdded'] = {
                checkbox: item.isAutoAdded
            };
        }

        if (item.notes !== undefined) {
            properties['Notes'] = {
                rich_text: item.notes ? [
                    {
                        text: {
                            content: item.notes
                        }
                    }
                ] : []
            };
        }

        return properties;
    }

    /**
 * Get the Notion URL for a specific page
 */
    async getNotionPageUrl(pageId: string): Promise<string | null> {
        if (this.useDummyData) {
            // For dummy data, generate a fake URL
            return `https://www.notion.so/Dummy-Page-${pageId}`;
        }

        try {
            const page = await this.notion.pages.retrieve({ page_id: pageId });
            // @ts-ignore: Notion’s runtime response includes `url`
            return page.url;
        } catch (error) {
            console.error(`Error getting page URL for ${pageId}:`, error);
            return null;
        }
    }

    /**
    * A more efficient method to get Notion URLs for multiple pages at once
    */
    async batchGetNotionPageUrls(pageIds: string[]): Promise<Record<string, string>> {
        if (this.useDummyData) {
            // Generate dummy URLs for all IDs
            return Object.fromEntries(
                pageIds.map(id => [id, `https://www.notion.so/Dummy-Page-${id}`])
            );
        }

        // Use Promise.all to fetch all pages in parallel
        const results = await Promise.all(
            pageIds.map(async (id) => {
                try {
                    const page = await this.notion.pages.retrieve({ page_id: id });
                    // @ts-ignore: Notion’s runtime response includes `url`
                    return [id, page.url];
                } catch (error) {
                    console.error(`Error getting page URL for ${id}:`, error);
                    return [id, null];
                }
            })
        );

        // Filter out any failed requests and convert to an object
        return Object.fromEntries(
            results.filter(([_, url]) => url !== null) as [string, string][]
        );
    }

    /**
     * Generate ingredients based on recipe name and tags
     * This creates consistent ingredients for the same recipe each time
     */
    private async generateIngredientsFromRecipeName(recipeName: string, recipeTags: string[] = []): Promise<RecipeIngredient[]> {
        const ingredients: RecipeIngredient[] = [];

        // Common ingredients based on recipe types
        const breakfastIngredients = [
            { name: "Eggs", quantity: 2, unit: "count" },
            { name: "Milk", quantity: 1, unit: "cup" },
            { name: "Bread", quantity: 2, unit: "slices" },
            { name: "Butter", quantity: 1, unit: "tablespoon" }
        ];

        const lunchIngredients = [
            { name: "Bread", quantity: 2, unit: "slices" },
            { name: "Cheese", quantity: 2, unit: "slices" },
            { name: "Lettuce", quantity: 1, unit: "cup" },
            { name: "Tomato", quantity: 1, unit: "count" }
        ];

        const dinnerIngredients = [
            { name: "Chicken Breast", quantity: 1, unit: "pounds" },
            { name: "Rice", quantity: 1, unit: "cup" },
            { name: "Onions", quantity: 1, unit: "count" },
            { name: "Garlic", quantity: 2, unit: "cloves" }
        ];

        const dessertIngredients = [
            { name: "Sugar", quantity: 1, unit: "cup" },
            { name: "Flour", quantity: 2, unit: "cups" },
            { name: "Butter", quantity: 0.5, unit: "cup" },
            { name: "Eggs", quantity: 2, unit: "count" }
        ];

        // Determine base ingredients by meal type tags
        let baseIngredients: { name: string, quantity: number, unit: string }[] = [];

        if (recipeTags.includes("Breakfast")) {
            baseIngredients = [...breakfastIngredients];
        } else if (recipeTags.includes("Lunch")) {
            baseIngredients = [...lunchIngredients];
        } else if (recipeTags.includes("Dinner")) {
            baseIngredients = [...dinnerIngredients];
        } else if (recipeTags.includes("Dessert")) {
            baseIngredients = [...dessertIngredients];
        } else {
            // Default to dinner ingredients if no meal type tag
            baseIngredients = [...dinnerIngredients];
        }

        // Add ingredients based on recipe name words
        const recipeLower = recipeName.toLowerCase();

        // Add recipe-specific ingredients
        const specificIngredients: { [key: string]: { name: string, quantity: number, unit: string } } = {
            "chicken": { name: "Chicken Breast", quantity: 1, unit: "pounds" },
            "beef": { name: "Ground Beef", quantity: 1, unit: "pounds" },
            "pork": { name: "Pork Chops", quantity: 2, unit: "count" },
            "fish": { name: "Salmon Fillets", quantity: 2, unit: "count" },
            "rice": { name: "Rice", quantity: 1, unit: "cup" },
            "pasta": { name: "Pasta", quantity: 8, unit: "ounces" },
            "potato": { name: "Potatoes", quantity: 3, unit: "count" },
            "tomato": { name: "Tomatoes", quantity: 2, unit: "count" },
            "cheese": { name: "Cheese", quantity: 1, unit: "cup" },
            "spinach": { name: "Spinach", quantity: 2, unit: "cups" },
            "mushroom": { name: "Mushrooms", quantity: 8, unit: "ounces" },
            "avocado": { name: "Avocado", quantity: 1, unit: "count" },
            "egg": { name: "Eggs", quantity: 2, unit: "count" },
            "milk": { name: "Milk", quantity: 1, unit: "cup" },
            "yogurt": { name: "Yogurt", quantity: 1, unit: "cup" },
            "butter": { name: "Butter", quantity: 2, unit: "tablespoons" },
            "apple": { name: "Apples", quantity: 2, unit: "count" },
            "banana": { name: "Bananas", quantity: 2, unit: "count" },
            "berry": { name: "Mixed Berries", quantity: 1, unit: "cup" },
            "chocolate": { name: "Chocolate Chips", quantity: 1, unit: "cup" },
            "sandwich": { name: "Bread", quantity: 2, unit: "slices" },
            "salad": { name: "Lettuce", quantity: 1, unit: "head" },
            "soup": { name: "Chicken Broth", quantity: 4, unit: "cups" },
            "stir fry": { name: "Soy Sauce", quantity: 2, unit: "tablespoons" },
            "cake": { name: "Flour", quantity: 2, unit: "cups" },
            "cookie": { name: "Sugar", quantity: 1, unit: "cup" },
            "bread": { name: "Flour", quantity: 3, unit: "cups" },
            "oatmeal": { name: "Oats", quantity: 1, unit: "cup" },
            "pancake": { name: "Pancake Mix", quantity: 1, unit: "cup" },
            "waffle": { name: "Waffle Mix", quantity: 1, unit: "cup" }
        };

        // Add ingredients based on recipe name
        Object.entries(specificIngredients).forEach(([keyword, ingredient]) => {
            if (recipeLower.includes(keyword) &&
                !baseIngredients.some(i => i.name.toLowerCase() === ingredient.name.toLowerCase())) {
                baseIngredients.push(ingredient);
            }
        });

        // Convert to RecipeIngredient objects
        const recipeId = this.generateConsistentId(recipeName);
        ingredients.push(...baseIngredients.map(ing => ({
            recipeId,
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.unit,
            isOptional: false
        })));

        // Add 1-2 optional ingredients
        const optionalIngredients = [
            { name: "Salt", quantity: 1, unit: "teaspoon" },
            { name: "Pepper", quantity: 0.5, unit: "teaspoon" },
            { name: "Olive Oil", quantity: 2, unit: "tablespoons" },
            { name: "Garlic", quantity: 2, unit: "cloves" },
            { name: "Lemon", quantity: 1, unit: "count" },
            { name: "Herbs", quantity: 1, unit: "tablespoon" }
        ];

        // Using recipe name as seed to consistently select the same optional ingredients
        const seed = recipeName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        const rng = (n: number) => (seed % n);

        const optionalCount = 1 + (seed % 2); // 1 or 2 optional ingredients

        for (let i = 0; i < optionalCount; i++) {
            const idx = rng(optionalIngredients.length - i);
            const optional = optionalIngredients.splice(idx, 1)[0];

            if (optional && !ingredients.some(ing => ing.name === optional.name)) {
                ingredients.push({
                    recipeId,
                    name: optional.name,
                    quantity: optional.quantity,
                    unit: optional.unit,
                    isOptional: true
                });
            }
        }

        return ingredients;
    }

    // Helper function to generate a consistent ID from a string
    private generateConsistentId(str: string): string {
        const hash = str.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
        return `recipe_${hash.toString(16)}`;
    }

    // ====== DUMMY DATA METHODS ======

    private getDummyPantryItems(): PantryItem[] {
        return [
            {
                id: "item_1",
                name: "Eggs",
                quantity: 12,
                unit: "count",
                category: "Dairy & Eggs",
                location: "Refrigerator",
                expiryDate: "2025-06-01",
                isStaple: true,
                minQuantity: 6,
                tags: ["Breakfast"],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_2",
                name: "Milk",
                quantity: 1,
                unit: "gallon",
                category: "Dairy & Eggs",
                location: "Refrigerator",
                expiryDate: "2025-05-20",
                isStaple: true,
                minQuantity: 1,
                tags: ["Breakfast"],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_3",
                name: "Bread",
                quantity: 1,
                unit: "loaf",
                category: "Bakery",
                location: "Pantry",
                expiryDate: "2025-05-18",
                isStaple: true,
                minQuantity: 1,
                tags: [],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_4",
                name: "Apples",
                quantity: 6,
                unit: "count",
                category: "Produce",
                location: "Refrigerator",
                expiryDate: "2025-05-25",
                isStaple: false,
                tags: ["Snack"],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_5",
                name: "Chicken Breast",
                quantity: 2,
                unit: "pounds",
                category: "Meat & Seafood",
                location: "Freezer",
                expiryDate: "2025-05-16",
                isStaple: false,
                tags: ["Dinner"],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_6",
                name: "Rice",
                quantity: 3,
                unit: "pounds",
                category: "Grains",
                location: "Pantry",
                isStaple: true,
                minQuantity: 1,
                tags: [],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_7",
                name: "Onions",
                quantity: 4,
                unit: "count",
                category: "Produce",
                location: "Pantry",
                isStaple: true,
                minQuantity: 2,
                tags: [],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            },
            {
                id: "item_8",
                name: "Garlic",
                quantity: 1,
                unit: "bulb",
                category: "Produce",
                location: "Pantry",
                isStaple: true,
                minQuantity: 1,
                tags: [],
                lastUpdated: new Date().toISOString(),
                createdAt: new Date().toISOString()
            }
        ];
    }

    private getDummyRecipes(): Recipe[] {
        return [
            {
                id: "recipe_1",
                name: "Simple Breakfast Sandwich",
                tried: true,
                kitchenTools: [],
                link: "https://example.com/breakfast-sandwich",
                tags: ["Breakfast", "Easy"],
                createdAt: new Date().toISOString()
            },
            {
                id: "recipe_2",
                name: "Chicken and Rice",
                tried: true,
                kitchenTools: [],
                link: "https://example.com/chicken-rice",
                tags: ["Dinner", "Easy"],
                createdAt: new Date().toISOString()
            },
            {
                id: "recipe_3",
                name: "Apple Cinnamon Oatmeal",
                tried: false,
                kitchenTools: [],
                link: "https://example.com/apple-oatmeal",
                tags: ["Breakfast", "Want to Try"],
                createdAt: new Date().toISOString()
            }
        ];
    }

    private getDummyIngredientsForRecipe(recipeId: string): RecipeIngredient[] {
        switch (recipeId) {
            case "recipe_1": // Breakfast Sandwich
                return [
                    { recipeId, name: "Eggs", quantity: 2, unit: "count" },
                    { recipeId, name: "Bread", quantity: 2, unit: "slices" },
                    { recipeId, name: "Cheese", quantity: 1, unit: "slice", isOptional: true },
                    { recipeId, name: "Salt", quantity: 1, unit: "pinch" },
                    { recipeId, name: "Pepper", quantity: 1, unit: "pinch" }
                ];
            case "recipe_2": // Chicken and Rice
                return [
                    { recipeId, name: "Chicken Breast", quantity: 0.5, unit: "pounds" },
                    { recipeId, name: "Rice", quantity: 1, unit: "cup" },
                    { recipeId, name: "Onions", quantity: 0.5, unit: "count" },
                    { recipeId, name: "Garlic", quantity: 2, unit: "cloves" },
                    { recipeId, name: "Chicken Broth", quantity: 2, unit: "cups", isOptional: true },
                    { recipeId, name: "Salt", quantity: 1, unit: "teaspoon" },
                    { recipeId, name: "Pepper", quantity: 0.5, unit: "teaspoon" }
                ];
            case "recipe_3": // Apple Cinnamon Oatmeal
                return [
                    { recipeId, name: "Apples", quantity: 1, unit: "count" },
                    { recipeId, name: "Oats", quantity: 1, unit: "cup" },
                    { recipeId, name: "Milk", quantity: 1, unit: "cup" },
                    { recipeId, name: "Cinnamon", quantity: 1, unit: "teaspoon" },
                    { recipeId, name: "Brown Sugar", quantity: 2, unit: "tablespoons", isOptional: true },
                    { recipeId, name: "Salt", quantity: 1, unit: "pinch" }
                ];
            default:
                return [];
        }
    }

    private getDummyShoppingList(): ShoppingListItem[] {
        return [
            {
                id: "shopping_1",
                name: "Tomatoes",
                quantity: 4,
                unit: "count",
                category: "Produce",
                priority: "Medium",
                isPurchased: false,
                isAutoAdded: false,
                addedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            },
            {
                id: "shopping_2",
                name: "Pasta",
                quantity: 1,
                unit: "box",
                category: "Grains",
                priority: "Low",
                isPurchased: false,
                isAutoAdded: false,
                addedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            },
            {
                id: "shopping_3",
                name: "Cheese",
                quantity: 1,
                unit: "package",
                category: "Dairy & Eggs",
                priority: "High",
                isPurchased: true,
                isAutoAdded: true,
                addedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString()
            }
        ];
    }
}