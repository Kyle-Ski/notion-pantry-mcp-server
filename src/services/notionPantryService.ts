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
     * Get all pantry items
     */
    async getPantryItems(): Promise<PantryItem[]> {
        if (this.useDummyData) {
            return this.getDummyPantryItems();
        }

        try {
            // Ensure we're using the bound version of the notion client
            const notionClient = this.notion;

            // Use a properly bound call to databases.query
            const response = await notionClient.databases.query({
                database_id: this.pantryDbId,
                sorts: [
                    {
                        property: "Name",
                        direction: "ascending"
                    }
                ]
            });

            // Return the mapped results
            return response.results.map(page => this.notionPageToPantryItem(page));
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

            return this.notionPageToPantryItem(page);
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

            return response.results.map(page => notionPageToRecipe(page));
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

            return notionPageToRecipe(page);
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
     * Note: This is using dummy ingredient data since we don't have ingredients in your recipe DB
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
                : await this.generateIngredientsFromRecipeName(recipe.name);

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
            : await this.generateIngredientsFromRecipeName(recipe.name);

        return {
            recipe,
            ingredients
        };
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

            return response.results.map(page => this.notionPageToShoppingListItem(page));
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
     * Generate dummy ingredients based on recipe name 
     * In a real implementation, we would parse this from recipe content
     */
    private async generateIngredientsFromRecipeName(recipeName: string): Promise<RecipeIngredient[]> {
        // This is a very basic placeholder implementation
        // In a real scenario, you'd have a proper ingredients database or parse recipe text
        const pantryItems = await this.getPantryItems();
        const randomIngredients: RecipeIngredient[] = [];

        // Pick 3-5 random ingredients from pantry
        const numIngredients = Math.floor(Math.random() * 3) + 3;
        const shuffledItems = [...pantryItems].sort(() => 0.5 - Math.random());

        for (let i = 0; i < Math.min(numIngredients, shuffledItems.length); i++) {
            const item = shuffledItems[i];
            randomIngredients.push({
                recipeId: 'unknown',
                name: item.name,
                quantity: Math.min(item.quantity, Math.floor(Math.random() * 3) + 1),
                unit: item.unit,
                isOptional: Math.random() > 0.8
            });
        }

        return randomIngredients;
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