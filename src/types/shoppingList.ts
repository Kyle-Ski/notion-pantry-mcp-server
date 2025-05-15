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
 * Helper function to convert a Notion page to a ShoppingListItem
 */
export function notionPageToShoppingListItem(page: any): ShoppingListItem {
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
 * Convert a ShoppingListItem to Notion properties for updates
 */
export function shoppingListItemToNotionProperties(item: Partial<ShoppingListItem>): any {
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