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
    // Find the title property (there's always one title property)
    const titleProp: any = Object.values(page.properties).find((prop: any) => prop.type === 'title');
    const titleText = titleProp?.title?.[0]?.plain_text || '';

    // Look for checkbox properties that might be the "tried" flag
    const triedProp: any = Object.entries(page.properties).find(
        ([name, prop]: [string, any]) =>
            prop.type === 'checkbox' &&
            (name.toLowerCase().includes('tried') || name === 'Tried?')
    );
    const triedValue = triedProp?.[1]?.checkbox || false;

    // Look for relation properties that might be the kitchen tools
    const toolsProp: any = Object.entries(page.properties).find(
        ([name, prop]: [string, any]) =>
            prop.type === 'relation' &&
            (name.toLowerCase().includes('tool') || name === 'Kitchen Tools')
    );
    const toolsValue = toolsProp?.[1]?.relation?.map((rel: any) => rel.id) || [];

    // Look for URL properties that might be the link
    const linkProp: any = Object.entries(page.properties).find(
        ([name, prop]: [string, any]) =>
            prop.type === 'url' &&
            (name.toLowerCase().includes('link') || name === 'Link' ||
                name.toLowerCase().includes('source') || name.toLowerCase().includes('url'))
    );
    const linkValue = linkProp?.[1]?.url || '';

    // Look for multi-select properties that might be the tags
    const tagsProp: any = Object.entries(page.properties).find(
        ([name, prop]: [string, any]) =>
            prop.type === 'multi_select' &&
            (name.toLowerCase().includes('tag') || name === 'Tags')
    );
    const tagsValue = tagsProp?.[1]?.multi_select?.map((ms: any) => ms.name) || [];

    // Look for the AI Modified property
    const aiModifiedProp: any = Object.entries(page.properties).find(
        ([name, prop]: [string, any]) =>
            prop.type === 'checkbox' &&
            (name.toLowerCase().includes('ai') || name === 'AI Modified')
    );
    const aiModifiedValue = aiModifiedProp?.[1]?.checkbox || false;

    // Return the recipe object
    return {
        id: page.id,
        name: titleText,
        tried: triedValue,
        kitchenTools: toolsValue,
        link: linkValue,
        tags: tagsValue,
        aiModified: aiModifiedValue,
        createdAt: page.created_time
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