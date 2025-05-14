// This service will eventually connect to Notion, but for now it uses dummy data

export interface PantryItem {
    id: string;
    name: string;
    quantity: number;
    unit: string;
    category: string;
    expiryDate?: string;
    lastUpdated: string;
}

export interface Recipe {
    id: string;
    name: string;
    ingredients: {
        name: string;
        quantity: number;
        unit: string;
    }[];
    instructions: string;
    preparationTime: number; // in minutes
}

export class NotionPantryService {
    constructor(
        private notionToken: string,
        private pantryDbId: string,
        private useDummyData: boolean = false
    ) {
        console.log(`NotionPantryService initialized with${useDummyData ? ' dummy data' : ' real Notion connection'}`);
    }

    // Get all pantry items
    async getPantryItems(): Promise<PantryItem[]> {
        if (this.useDummyData) {
            return this.getDummyPantryItems();
        }

        // TODO add API calls
        throw new Error("Real Notion integration not implemented yet");
    }

    // Get a specific pantry item by ID
    async getPantryItemById(itemId: string): Promise<PantryItem | null> {
        const items = await this.getPantryItems();
        return items.find(item => item.id === itemId) || null;
    }

    // Get pantry items by category
    async getPantryItemsByCategory(category: string): Promise<PantryItem[]> {
        const items = await this.getPantryItems();
        return items.filter(item => item.category === category);
    }

    // Get suggested meals based on available ingredients
    async suggestMeals(): Promise<Recipe[]> {
        if (this.useDummyData) {
            return this.getDummyRecipes();
        }

        // TODO add API calls
        throw new Error("Real recipe suggestion not implemented yet");
    }

    // Get a specific recipe by ID
    async getRecipeById(recipeId: string): Promise<Recipe | null> {
        const recipes = await this.suggestMeals();
        return recipes.find(recipe => recipe.id === recipeId) || null;
    }

    // Update pantry after using ingredients for a meal
    async updatePantryForRecipe(recipeId: string): Promise<void> {
        if (this.useDummyData) {
            console.log(`[DUMMY] Updated pantry after using recipe ${recipeId}`);
            return;
        }

        // TODO add API calls
        throw new Error("Real pantry updating not implemented yet");
    }

    // Dummy data methods
    private getDummyPantryItems(): PantryItem[] {
        return [
            {
                id: "item_1",
                name: "Eggs",
                quantity: 12,
                unit: "count",
                category: "Dairy & Eggs",
                expiryDate: "2025-06-01",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_2",
                name: "Milk",
                quantity: 1,
                unit: "gallon",
                category: "Dairy & Eggs",
                expiryDate: "2025-05-20",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_3",
                name: "Bread",
                quantity: 1,
                unit: "loaf",
                category: "Bakery",
                expiryDate: "2025-05-18",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_4",
                name: "Apples",
                quantity: 6,
                unit: "count",
                category: "Produce",
                expiryDate: "2025-05-25",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_5",
                name: "Chicken Breast",
                quantity: 2,
                unit: "pounds",
                category: "Meat & Seafood",
                expiryDate: "2025-05-16",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_6",
                name: "Rice",
                quantity: 3,
                unit: "pounds",
                category: "Grains",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_7",
                name: "Onions",
                quantity: 4,
                unit: "count",
                category: "Produce",
                lastUpdated: new Date().toISOString()
            },
            {
                id: "item_8",
                name: "Garlic",
                quantity: 1,
                unit: "bulb",
                category: "Produce",
                lastUpdated: new Date().toISOString()
            }
        ];
    }

    private getDummyRecipes(): Recipe[] {
        return [
            {
                id: "recipe_1",
                name: "Simple Breakfast Sandwich",
                ingredients: [
                    { name: "Eggs", quantity: 2, unit: "count" },
                    { name: "Bread", quantity: 2, unit: "slices" }
                ],
                instructions: "1. Toast bread. 2. Fry eggs. 3. Assemble sandwich.",
                preparationTime: 10
            },
            {
                id: "recipe_2",
                name: "Chicken and Rice",
                ingredients: [
                    { name: "Chicken Breast", quantity: 0.5, unit: "pounds" },
                    { name: "Rice", quantity: 1, unit: "cup" },
                    { name: "Onions", quantity: 0.5, unit: "count" },
                    { name: "Garlic", quantity: 2, unit: "cloves" }
                ],
                instructions: "1. Cook rice according to package. 2. Sauté diced onions and garlic. 3. Add diced chicken and cook until done. 4. Mix with rice and serve.",
                preparationTime: 30
            },
            {
                id: "recipe_3",
                name: "Apple Cinnamon Oatmeal",
                ingredients: [
                    { name: "Apples", quantity: 1, unit: "count" },
                    { name: "Milk", quantity: 1, unit: "cup" }
                ],
                instructions: "1. Dice apple. 2. Combine with milk in a pot. 3. Heat and enjoy.",
                preparationTime: 15
            }
        ];
    }
}