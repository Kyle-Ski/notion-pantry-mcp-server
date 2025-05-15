export type NotionPropertyType =
    | 'title'
    | 'rich_text'
    | 'number'
    | 'select'
    | 'multi_select'
    | 'date'
    | 'people'
    | 'files'
    | 'checkbox'
    | 'url'
    | 'email'
    | 'phone_number'
    | 'formula'
    | 'relation'
    | 'rollup'
    | 'created_time'
    | 'created_by'
    | 'last_edited_time'
    | 'last_edited_by';

// Simplified representation of Notion's response structure
export interface NotionResponse<T> {
    object: string;
    results: T[];
    next_cursor: string | null;
    has_more: boolean;
}

// Interface for working with Notion database records
export interface NotionPageObject {
    id: string;
    created_time: string;
    last_edited_time: string;
    parent: {
        type: string;
        database_id: string;
    };
    properties: Record<string, NotionProperty>;
}

// Union type for different Notion property values
export type NotionProperty =
    | NotionTitleProperty
    | NotionRichTextProperty
    | NotionNumberProperty
    | NotionSelectProperty
    | NotionMultiSelectProperty
    | NotionDateProperty
    | NotionCheckboxProperty
    | NotionCreatedTimeProperty
    | NotionLastEditedTimeProperty;

// Title property (used for item name)
export interface NotionTitleProperty {
    id: string;
    type: 'title';
    title: Array<{
        type: 'text';
        text: {
            content: string;
            link: null | { url: string };
        };
        annotations: {
            bold: boolean;
            italic: boolean;
            strikethrough: boolean;
            underline: boolean;
            code: boolean;
            color: string;
        };
        plain_text: string;
        href: null | string;
    }>;
}

// Rich text property (used for notes)
export interface NotionRichTextProperty {
    id: string;
    type: 'rich_text';
    rich_text: Array<{
        type: 'text';
        text: {
            content: string;
            link: null | { url: string };
        };
        annotations: {
            bold: boolean;
            italic: boolean;
            strikethrough: boolean;
            underline: boolean;
            code: boolean;
            color: string;
        };
        plain_text: string;
        href: null | string;
    }>;
}

// Number property (used for quantity)
export interface NotionNumberProperty {
    id: string;
    type: 'number';
    number: number | null;
}

// Select property (used for unit, category)
export interface NotionSelectProperty {
    id: string;
    type: 'select';
    select: {
        id: string;
        name: string;
        color: string;
    } | null;
}

// Multi-select property (used for tags)
export interface NotionMultiSelectProperty {
    id: string;
    type: 'multi_select';
    multi_select: Array<{
        id: string;
        name: string;
        color: string;
    }>;
}

// Date property (used for expiry date)
export interface NotionDateProperty {
    id: string;
    type: 'date';
    date: {
        start: string;
        end: string | null;
        time_zone: string | null;
    } | null;
}

// Checkbox property (used for boolean flags)
export interface NotionCheckboxProperty {
    id: string;
    type: 'checkbox';
    checkbox: boolean;
}

// Created time property
export interface NotionCreatedTimeProperty {
    id: string;
    type: 'created_time';
    created_time: string;
}

// Last edited time property
export interface NotionLastEditedTimeProperty {
    id: string;
    type: 'last_edited_time';
    last_edited_time: string;
}