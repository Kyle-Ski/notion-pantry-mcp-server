import type { PantryItem } from './pantry';
import type { Recipe } from './recipe';

/**
 * RecipeIngredient interface for representing ingredients needed in a recipe
 * This will be stored separately since it's not in the main Recipe database
 */
export interface RecipeIngredient {
    /**
     * Reference to the recipe
     */
    recipeId: string;

    /**
     * Name of the ingredient (should match pantry item names when possible)
     */
    name: string;

    /**
     * Quantity needed for the recipe
     */
    quantity: number;

    /**
     * Unit of measurement
     */
    unit: string;

    /**
     * Optional preparation instructions (e.g., "finely chopped")
     */
    preparation?: string;

    /**
     * Whether this ingredient is optional
     */
    isOptional?: boolean;
}

/**
 * RecipeWithIngredients combines a Recipe with its ingredients
 */
export interface RecipeWithIngredients {
    /**
     * Base recipe information
     */
    recipe: Recipe;

    /**
     * List of ingredients needed for the recipe
     */
    ingredients: RecipeIngredient[];
}

/**
 * Checks if we have all the ingredients for a recipe
 */
export function canMakeRecipe(recipe: RecipeWithIngredients, pantry: PantryItem[]): boolean {
    // For each required ingredient
    const missingIngredients = recipe.ingredients.filter(ingredient => {
        // Skip optional ingredients
        if (ingredient.isOptional) return false;

        // Find matching pantry item
        const pantryItem = pantry.find(item =>
            item.name.toLowerCase() === ingredient.name.toLowerCase()
        );

        // If we don't have it or don't have enough, it's missing
        return !pantryItem || pantryItem.quantity < ingredient.quantity;
    });

    // Can make recipe if no required ingredients are missing
    return missingIngredients.length === 0;
}

/**
 * Calculates which ingredients are missing or insufficient for a recipe
 */
export function getMissingIngredients(recipe: RecipeWithIngredients, pantry: PantryItem[]): { name: string; have: number; need: number; unit: string }[] {

    return recipe.ingredients
        .filter(ingredient => !ingredient.isOptional) // Only check required ingredients
        .map(ingredient => {
            // Find matching pantry item
            const pantryItem = pantry.find(item =>
                item.name.toLowerCase() === ingredient.name.toLowerCase()
            );

            const have = pantryItem ? pantryItem.quantity : 0;
            const need = ingredient.quantity;

            // Only include if we don't have enough
            if (have >= need) return null;

            return {
                name: ingredient.name,
                have,
                need,
                unit: ingredient.unit
            };
        })
        .filter(item => item !== null) as { name: string; have: number; need: number; unit: string }[];
}

/**
 * Updates pantry quantities after making a recipe
 */
export function updatePantryAfterCooking(recipe: RecipeWithIngredients, pantry: PantryItem[]): PantryItem[] {
    // Create a copy of the pantry to avoid mutating the original
    const updatedPantry = [...pantry];

    // For each ingredient in the recipe
    recipe.ingredients.forEach(ingredient => {
        // Find the matching pantry item
        const index = updatedPantry.findIndex(item =>
            item.name.toLowerCase() === ingredient.name.toLowerCase()
        );

        // If we have this item, update its quantity
        if (index !== -1) {
            const newQuantity = Math.max(0, updatedPantry[index].quantity - ingredient.quantity);
            updatedPantry[index] = {
                ...updatedPantry[index],
                quantity: newQuantity,
                lastUpdated: new Date().toISOString()
            };
        }
    });

    return updatedPantry;
}