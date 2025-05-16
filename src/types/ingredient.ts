export interface Ingredient {
    id: string;
    notionUrl?: string;
    name: string;
    units: string[];
    category: string;
    perishable: boolean;
    storage: string;
    shelfLifeDays?: number;
    notes?: string;
    aiModified?: boolean;
    createdAt: string;
    lastUpdated: string;
}

export function notionPageToIngredient(page: any): Ingredient {
    return {
        id: page.id,
        name: page.properties['Name']?.title?.[0]?.plain_text || '',
        units: page.properties['Units']?.multi_select?.map((ms: any) => ms.name) || [],
        category: page.properties['Category']?.select?.name || '',
        perishable: page.properties['Perishable']?.checkbox || false,
        storage: page.properties['Storage']?.select?.name || '',
        shelfLifeDays: page.properties['ShelfLifeDays']?.number,
        notes: page.properties['Notes']?.rich_text?.map((rt: any) => rt.plain_text).join('') || '',
        aiModified: page.properties['AI Modified']?.checkbox || false,
        createdAt: page.created_time,
        lastUpdated: page.last_edited_time
    };
}