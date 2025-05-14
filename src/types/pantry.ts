import type { NotionPageObject } from './notion';

/**
 * PantryItem interface representing an item in the pantry
 * This maps directly to a row in our Notion database
 */
export interface PantryItem {
    // Unique identifier from Notion
    id: string;

    // Name of the item (maps to Notion Title property)
    name: string;

    // Quantity of the item (maps to Notion Number property)
    quantity: number;

    // Unit of measurement (maps to Notion Select property)
    // Examples: count, oz, pounds, cups, tablespoons, etc.
    unit: string;

    // Category of the item (maps to Notion Select property)
    // Examples: Produce, Dairy & Eggs, Meat & Seafood, Pantry, etc.
    category: string;

    // Location in the pantry (maps to Notion Select property)
    // Examples: Refrigerator, Freezer, Cabinet, etc.
    location: string;

    // Expiry date of the item (maps to Notion Date property)
    // Optional: not all items have expiry dates
    expiryDate?: string;

    // Notes about the item (maps to Notion Rich Text property)
    // Optional: additional information about the item
    notes?: string;

    // Whether the item is a staple item (maps to Notion Checkbox property)
    // Staple items are automatically added to shopping list when low
    isStaple: boolean;

    // Tags for the item (maps to Notion Multi-Select property)
    // Optional: additional categorization/filtering
    tags?: string[];

    // Minimum quantity to maintain (maps to Notion Number property)
    // Optional: for staple items, the minimum quantity to keep in stock
    minQuantity?: number;

    // When the item was last updated (maps to Notion Last Edited Time property)
    lastUpdated: string;

    // When the item was created (maps to Notion Created Time property)
    createdAt: string;
}

/**
 * Recipe interface representing a recipe that uses pantry items
 * This maps directly to a row in our Notion Recipes database
 */
export interface Recipe {
    // Unique identifier from Notion
    id: string;

    // Name of the recipe (maps to Notion Title property)
    name: string;

    // Ingredients required for the recipe (maps to Notion Rich Text property)
    // This will be converted to/from a structured format
    ingredients: RecipeIngredient[];

    // Instructions for preparing the recipe (maps to Notion Rich Text property)
    instructions: string;

    // Preparation time in minutes (maps to Notion Number property)
    preparationTime: number;

    // Cooking time in minutes (maps to Notion Number property)
    cookingTime: number;

    // Total time in minutes (maps to Notion Formula property)
    // This is calculated as preparationTime + cookingTime
    totalTime: number;

    // Servings (maps to Notion Number property)
    servings: number;

    // Difficulty (maps to Notion Select property)
    // Examples: Easy, Medium, Hard
    difficulty: string;

    // Tags for the recipe (maps to Notion Multi-Select property)
    // Examples: Vegetarian, Gluten-Free, Quick, etc.
    tags: string[];

    // URL to the original recipe, if applicable (maps to Notion URL property)
    // Optional: source of the recipe
    sourceUrl?: string;

    // Image URL for the recipe (maps to Notion Files property)
    // Optional: visual representation of the finished dish
    imageUrl?: string;

    // Notes about the recipe (maps to Notion Rich Text property)
    // Optional: additional information, variations, etc.
    notes?: string;

    // When the recipe was last updated (maps to Notion Last Edited Time property)
    lastUpdated: string;

    // When the recipe was created (maps to Notion Created Time property)
    createdAt: string;
}

/**
 * RecipeIngredient interface representing an ingredient in a recipe
 * This is serialized and stored in the Notion database
 */
export interface RecipeIngredient {
    // Name of the ingredient (must match pantry item names for auto-matching)
    name: string;

    // Quantity needed for the recipe
    quantity: number;

    // Unit of measurement
    unit: string;

    // Optional notes about the ingredient (e.g., "thinly sliced")
    preparation?: string;

    // Whether this ingredient is optional
    isOptional?: boolean;
}

/**
 * ShoppingListItem interface representing an item on the shopping list
 * This maps directly to a row in our Notion Shopping List database
 */
export interface ShoppingListItem {
    // Unique identifier from Notion
    id: string;

    // Name of the item (maps to Notion Title property)
    name: string;

    // Quantity to purchase (maps to Notion Number property)
    quantity: number;

    // Unit of measurement (maps to Notion Select property)
    unit: string;

    // Category for shopping organization (maps to Notion Select property)
    category: string;

    // Priority of the purchase (maps to Notion Select property)
    // Examples: Low, Medium, High
    priority: string;

    // Whether the item has been purchased (maps to Notion Checkbox property)
    isPurchased: boolean;

    // Whether the item was automatically added from staples (maps to Notion Checkbox property)
    isAutoAdded: boolean;

    // Notes about the purchase (maps to Notion Rich Text property)
    // Optional: specific brand, size, etc.
    notes?: string;

    // When the item was added to the list (maps to Notion Created Time property)
    addedAt: string;

    // When the item was last updated (maps to Notion Last Edited Time property)
    lastUpdated: string;
}

/**
 * Helper function to convert a Notion page to a PantryItem
 * This will be used when integrating with the actual Notion API
 */
export function notionPageToPantryItem(page: NotionPageObject): PantryItem {
    // Extract the properties from the Notion page
    const properties = page.properties;

    // Map Notion properties to our PantryItem interface
    return {
        id: page.id,
        name: extractTitle(properties.Name),
        quantity: extractNumber(properties.Quantity),
        unit: extractSelect(properties.Unit),
        category: extractSelect(properties.Category),
        location: extractSelect(properties.Location),
        expiryDate: extractDate(properties.Expiry),
        notes: extractRichText(properties.Notes),
        isStaple: extractCheckbox(properties.Staple),
        tags: extractMultiSelect(properties.Tags),
        minQuantity: extractNumber(properties.MinQuantity),
        lastUpdated: page.last_edited_time,
        createdAt: page.created_time
    };
}

/**
 * Helper function to convert a Notion page to a Recipe
 * This will be used when integrating with the actual Notion API
 */
export function notionPageToRecipe(page: NotionPageObject): Recipe {
    // Extract the properties from the Notion page
    const properties = page.properties;

    // Parse the ingredients from rich text to structured data
    const ingredientsText = extractRichText(properties.Ingredients);
    const ingredients = parseIngredients(ingredientsText);

    // Map Notion properties to our Recipe interface
    return {
        id: page.id,
        name: extractTitle(properties.Name),
        ingredients: ingredients,
        instructions: extractRichText(properties.Instructions),
        preparationTime: extractNumber(properties.PrepTime),
        cookingTime: extractNumber(properties.CookTime),
        totalTime: extractNumber(properties.TotalTime),
        servings: extractNumber(properties.Servings),
        difficulty: extractSelect(properties.Difficulty),
        tags: extractMultiSelect(properties.Tags),
        sourceUrl: extractUrl(properties.Source),
        imageUrl: extractFiles(properties.Image),
        notes: extractRichText(properties.Notes),
        lastUpdated: page.last_edited_time,
        createdAt: page.created_time
    };
}

// Helper functions for extracting values from Notion properties
// These will be implemented in the actual integration with Notion

function extractTitle(property: any): string {
    // Implement to extract title from Notion property
    return property?.title?.[0]?.plain_text || '';
}

function extractRichText(property: any): string {
    // Implement to extract rich text from Notion property
    return property?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
}

function extractNumber(property: any): number {
    // Implement to extract number from Notion property
    return property?.number || 0;
}

function extractSelect(property: any): string {
    // Implement to extract select value from Notion property
    return property?.select?.name || '';
}

function extractMultiSelect(property: any): string[] {
    // Implement to extract multi-select values from Notion property
    return property?.multi_select?.map((select: any) => select.name) || [];
}

function extractDate(property: any): string | undefined {
    // Implement to extract date from Notion property
    return property?.date?.start;
}

function extractCheckbox(property: any): boolean {
    // Implement to extract checkbox value from Notion property
    return property?.checkbox || false;
}

function extractUrl(property: any): string | undefined {
    // Implement to extract URL from Notion property
    return property?.url;
}

function extractFiles(property: any): string | undefined {
    // Implement to extract file URL from Notion property
    return property?.files?.[0]?.file?.url || property?.files?.[0]?.external?.url;
}

// Parse ingredients from text to structured format
function parseIngredients(ingredientsText: string): RecipeIngredient[] {
    // For now, just return a placeholder implementation
    // In the actual integration, this will parse a text format like:
    // "2 cups flour\n1 tsp salt\n3 tbsp olive oil"
    // into structured RecipeIngredient objects

    if (!ingredientsText) return [];

    const lines = ingredientsText.split('\n');
    const ingredients: RecipeIngredient[] = [];

    for (const line of lines) {
        // Simple regex to extract quantity, unit, and name
        // This is a basic implementation, will need to be more robust in production
        const match = line.match(/^([\d.\/]+)\s+(\w+)\s+(.+?)(?:\s*\((.+)\))?$/);

        if (match) {
            const [_, quantityStr, unit, name, preparation] = match;
            const quantity = parseFloat(eval(quantityStr.replace('/', '/')));

            ingredients.push({
                name: name.trim(),
                quantity,
                unit: unit.trim(),
                preparation: preparation?.trim(),
                isOptional: line.toLowerCase().includes('optional')
            });
        } else {
            // If the line doesn't match our pattern, just add it as a name
            if (line.trim()) {
                ingredients.push({
                    name: line.trim(),
                    quantity: 0,
                    unit: 'whole',
                    isOptional: line.toLowerCase().includes('optional')
                });
            }
        }
    }

    return ingredients;
}