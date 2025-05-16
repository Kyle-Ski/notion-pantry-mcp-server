/**
 * Recipe interface based on your actual Notion database
 */
export interface Recipe {
    /**
     * Unique identifier from Notion
     */
    id: string;

    /**
     *  Url for the Notion page 
     */
    notionUrl?: string;

    /**
     * Recipe name (maps to Notion "Name" title property)
     */
    name: string;

    /**
     * Whether the recipe has been tried (maps to Notion "Tried?" checkbox)
     */
    tried: boolean;

    /**
     * Kitchen tools needed for the recipe (maps to Notion "Kitchen Tools" relation)
     * This is an array of related object IDs
     */
    kitchenTools: string[];

    /**
     * URL link to the recipe source (maps to Notion "Link" URL property)
     */
    link: string;

    /**
     * Tags for the recipe (maps to Notion "Tags" multi-select property)
     */
    tags: string[];

    /**
     * When the recipe was created (maps to Notion "Created On" created_time property)
     */
    createdAt: string;

    /**
     * Was the item created or updated by our LLM?
     */
    aiModified?: boolean;
}

/**
 * Convert a Notion page to a Recipe object
 */
export function notionPageToRecipe(page: any): Recipe {
    return {
        id: page.id,
        name: page.properties['Name']?.title?.[0]?.plain_text || '',
        tried: page.properties['Tried?']?.checkbox || false,
        kitchenTools: page.properties['Kitchen Tools']?.relation?.map((rel: any) => rel.id) || [],
        link: page.properties['Link']?.url || '',
        tags: page.properties['Tags']?.multi_select?.map((ms: any) => ms.name) || [],
        createdAt: page.properties['Created On']?.created_time || '',
        aiModified: page.properties['AI Modified']?.checkbox || false,
    };
}

/**
 * Convert a Recipe object to Notion properties for updates
 */
export function recipeToNotionProperties(recipe: Partial<Recipe>): any {
    const properties: any = {};

    if (recipe.name !== undefined) {
        properties['Name'] = {
            title: [
                {
                    text: {
                        content: recipe.name
                    }
                }
            ]
        };
    }

    if (recipe.tried !== undefined) {
        properties['Tried?'] = {
            checkbox: recipe.tried
        };
    }

    if (recipe.kitchenTools !== undefined) {
        properties['Kitchen Tools'] = {
            relation: recipe.kitchenTools.map(id => ({ id }))
        };
    }

    if (recipe.link !== undefined) {
        properties['Link'] = {
            url: recipe.link
        };
    }

    if (recipe.tags !== undefined) {
        properties['Tags'] = {
            multi_select: recipe.tags.map(tag => ({ name: tag }))
        };
    }

    if (recipe.aiModified !== undefined) {
        properties['AI Modified'] = {
            checkbox: recipe.aiModified
        };
    }

    return properties;
}