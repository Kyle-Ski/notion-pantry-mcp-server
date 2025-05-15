/**
 * Response format for MCP tools and resources
 */
export interface MealSuggestion {
    recipe: {
        id: string;
        name: string;
        tags: string[];
    };
    matchPercentage: number;
    missingIngredients: {
        name: string;
        have: number;
        need: number;
        unit: string;
    }[];
}

/**
 * Type for pantry statistics
 */
export interface PantryStats {
    totalItems: number;
    categories: {
        [category: string]: number;
    };
    expiringItems: number;
    lowStapleItems: number;
}