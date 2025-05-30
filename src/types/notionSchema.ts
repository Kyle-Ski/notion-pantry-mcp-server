/**
 * Definition of our Notion Pantry Database schema
 * This helps document the expected structure and property types
 */
export const PANTRY_DATABASE_SCHEMA = {
    Name: {
        type: 'title',
        description: 'The name of the pantry item'
    },
    Quantity: {
        type: 'number',
        description: 'The quantity of the item',
        format: 'number'
    },
    Unit: {
        type: 'select',
        description: 'The unit of measurement',
        options: [
            'count', 'oz', 'pounds', 'grams', 'kilograms',
            'cups', 'tablespoons', 'teaspoons',
            'milliliters', 'liters', 'gallons', 'quarts',
            'slices', 'loaf', 'bunch', 'bulb', 'head',
            'can', 'box', 'package', 'bottle'
        ]
    },
    Category: {
        type: 'select',
        description: 'The category of the item',
        options: [
            'Produce', 'Dairy & Eggs', 'Meat & Seafood',
            'Bakery', 'Grains', 'Canned Goods', 'Frozen',
            'Snacks', 'Beverages', 'Condiments & Sauces',
            'Baking & Spices', 'Other'
        ]
    },
    Location: {
        type: 'select',
        description: 'Where the item is stored',
        options: [
            'Refrigerator', 'Freezer', 'Pantry',
            'Cabinet', 'Spice Rack', 'Counter'
        ]
    },
    Expiry: {
        type: 'date',
        description: 'The expiry date of the item'
    },
    Notes: {
        type: 'rich_text',
        description: 'Additional notes about the item'
    },
    Staple: {
        type: 'checkbox',
        description: 'Whether this is a staple item to always keep in stock'
    },
    Tags: {
        type: 'multi_select',
        description: 'Tags for filtering and organizing',
        options: [
            'Organic', 'Gluten-Free', 'Dairy-Free',
            'Vegan', 'Vegetarian', 'Low-Carb', 'Keto',
            'Paleo', 'Breakfast', 'Lunch', 'Dinner', 'Snack'
        ]
    },
    MinQuantity: {
        type: 'number',
        description: 'The minimum quantity to maintain for staple items',
        format: 'number'
    }
};

/**
 * Definition of our Notion Recipes Database schema
 * This helps document the expected structure and property types
 */
export const RECIPES_DATABASE_SCHEMA = {
    Name: {
        type: 'title',
        description: 'The name of the recipe'
    },
    Ingredients: {
        type: 'rich_text',
        description: 'The ingredients required for the recipe'
    },
    Instructions: {
        type: 'rich_text',
        description: 'Step-by-step instructions for preparing the recipe'
    },
    PrepTime: {
        type: 'number',
        description: 'Preparation time in minutes',
        format: 'number'
    },
    CookTime: {
        type: 'number',
        description: 'Cooking time in minutes',
        format: 'number'
    },
    TotalTime: {
        type: 'formula',
        description: 'Total time (prep + cooking) in minutes',
        formula: 'prop("PrepTime") + prop("CookTime")'
    },
    Servings: {
        type: 'number',
        description: 'Number of servings',
        format: 'number'
    },
    Difficulty: {
        type: 'select',
        description: 'The difficulty level of the recipe',
        options: ['Easy', 'Medium', 'Hard']
    },
    Tags: {
        type: 'multi_select',
        description: 'Tags for filtering and categorizing recipes',
        options: [
            'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack',
            'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free',
            'Quick', 'Slow-Cooker', 'One-Pot', 'Meal Prep',
            'Low-Carb', 'Keto', 'Paleo', 'High-Protein'
        ]
    },
    Source: {
        type: 'url',
        description: 'URL to the original recipe source'
    },
    Image: {
        type: 'files',
        description: 'Image of the prepared dish'
    },
    Notes: {
        type: 'rich_text',
        description: 'Additional notes, variations, or tips'
    }
};

/**
 * Definition of our Notion Shopping List Database schema
 * This helps document the expected structure and property types
 */
export const SHOPPING_LIST_DATABASE_SCHEMA = {
    Name: {
        type: 'title',
        description: 'The name of the item to purchase'
    },
    Quantity: {
        type: 'number',
        description: 'The quantity to purchase',
        format: 'number'
    },
    Unit: {
        type: 'select',
        description: 'The unit of measurement',
        options: [
            'count', 'oz', 'pounds', 'grams', 'kilograms',
            'cups', 'tablespoons', 'teaspoons',
            'milliliters', 'liters', 'gallons', 'quarts',
            'slices', 'loaf', 'bunch', 'bulb', 'head',
            'can', 'box', 'package', 'bottle'
        ]
    },
    Category: {
        type: 'select',
        description: 'The category for shopping organization',
        options: [
            'Produce', 'Dairy & Eggs', 'Meat & Seafood',
            'Bakery', 'Grains', 'Canned Goods', 'Frozen',
            'Snacks', 'Beverages', 'Condiments & Sauces',
            'Baking & Spices', 'Other'
        ]
    },
    Priority: {
        type: 'select',
        description: 'The priority of the purchase',
        options: ['Low', 'Medium', 'High']
    },
    Purchased: {
        type: 'checkbox',
        description: 'Whether the item has been purchased'
    },
    AutoAdded: {
        type: 'checkbox',
        description: 'Whether the item was automatically added from staples'
    },
    Notes: {
        type: 'rich_text',
        description: 'Additional notes about the purchase'
    }
};