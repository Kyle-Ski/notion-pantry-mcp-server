export interface RecipeIngredientRelation {
    id: string;
    name: string;
    recipeId: string;
    ingredientId: string;
    quantity: number;
    unit: string;
    isOptional: boolean;
    preparation?: string;
    aiModified?: boolean;
    createdAt: string;
    lastUpdated: string;
}

export function notionPageToRecipeIngredientRelation(page: any): RecipeIngredientRelation {
    return {
        id: page.id,
        name: page.properties['Name']?.title?.[0]?.plain_text || '',
        recipeId: page.properties['Recipe']?.relation?.[0]?.id || '',
        ingredientId: page.properties['Ingredient']?.relation?.[0]?.id || '',
        quantity: page.properties['Quantity']?.number || 0,
        unit: page.properties['Unit']?.select?.name || '',
        isOptional: page.properties['Optional']?.checkbox || false,
        preparation: page.properties['Preparation']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
        aiModified: page.properties['AI Modified']?.checkbox || false,
        createdAt: page.created_time,
        lastUpdated: page.last_edited_time
    };
}