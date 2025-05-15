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

// Helper functions for extracting values from Notion properties
function extractTitle(property: any): string {
    return property?.title?.[0]?.plain_text || '';
}

function extractRichText(property: any): string {
    return property?.rich_text?.map((rt: any) => rt.plain_text).join('') || '';
}

function extractNumber(property: any): number {
    return property?.number || 0;
}

function extractSelect(property: any): string {
    return property?.select?.name || '';
}

function extractMultiSelect(property: any): string[] {
    return property?.multi_select?.map((select: any) => select.name) || [];
}

function extractDate(property: any): string | undefined {
    return property?.date?.start;
}

function extractCheckbox(property: any): boolean {
    return property?.checkbox || false;
}