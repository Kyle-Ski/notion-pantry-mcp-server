import { Client } from '@notionhq/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables properly
dotenv.config({ path: resolve(__dirname, '../.env') });

// Check if the token exists
if (!process.env.NOTION_TOKEN) {
  console.error("ERROR: No Notion token found in .env file");
  console.error("Please add NOTION_TOKEN=your_integration_token to your .env file");
  process.exit(1);
}

// Debug: Print out the environment variables (redacted for security)
console.log('Environment Variables:');
console.log(`NOTION_TOKEN: ${process.env.NOTION_TOKEN ? '✓ Found' : '✗ Missing'}`);
console.log(`NOTION_PANTRY_PAGE: ${process.env.NOTION_PANTRY_PAGE || '✗ Missing'}`);
console.log(`NOTION_SHOPPING_LIST_PAGE: ${process.env.NOTION_SHOPPING_LIST_PAGE || '✗ Missing'}`);
console.log(`NOTION_RECIPES_DB: ${process.env.NOTION_RECIPES_DB || '✗ Missing'}`);

// Initialize the Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// Page IDs for your existing pages
const PANTRY_PAGE_ID = process.env.NOTION_PANTRY_PAGE;
const SHOPPING_LIST_PAGE_ID = process.env.NOTION_SHOPPING_LIST_PAGE;

// Check required variables
if (!PANTRY_PAGE_ID) {
  console.error("ERROR: No Pantry page ID found in .env file");
  console.error("Please add NOTION_PANTRY_PAGE=your_page_id to your .env file");
  process.exit(1);
}

if (!SHOPPING_LIST_PAGE_ID) {
  console.error("ERROR: No Shopping List page ID found in .env file");
  console.error("Please add NOTION_SHOPPING_LIST_PAGE=your_page_id to your .env file");
  process.exit(1);
}

// Database schemas
const PANTRY_DATABASE_SCHEMA = {
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

const SHOPPING_LIST_DATABASE_SCHEMA = {
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

async function main() {
  try {
    console.log('Setting up databases for Pantry MCP Server on existing pages...');

    // Check if the provided page IDs exist
    console.log(`Checking page ID: ${PANTRY_PAGE_ID}...`);
    try {
      await notion.pages.retrieve({ page_id: PANTRY_PAGE_ID });
      console.log('Pantry page exists!');
    } catch (error) {
      console.error(`Error: Could not find page with ID ${PANTRY_PAGE_ID}`);
      console.error('Please check your .env file and make sure the page exists and your integration has access to it.');
      console.error(error);
      return;
    }

    console.log(`Checking page ID: ${SHOPPING_LIST_PAGE_ID}...`);
    try {
      await notion.pages.retrieve({ page_id: SHOPPING_LIST_PAGE_ID });
      console.log('Shopping List page exists!');
    } catch (error) {
      console.error(`Error: Could not find page with ID ${SHOPPING_LIST_PAGE_ID}`);
      console.error('Please check your .env file and make sure the page exists and your integration has access to it.');
      console.error(error);
      return;
    }

    // Step 1: Create Pantry database on existing page
    console.log('Creating Pantry database on existing page...');
    const pantryDb = await createPantryDatabase(PANTRY_PAGE_ID);
    console.log(`Pantry database created with ID: ${pantryDb.id}`);
    console.log(`Update your .env file with: NOTION_PANTRY_PAGE=${pantryDb.id}`);

    // Step 2: Create Shopping List database on existing page
    console.log('Creating Shopping List database on existing page...');
    const shoppingDb = await createShoppingListDatabase(SHOPPING_LIST_PAGE_ID);
    console.log(`Shopping List database created with ID: ${shoppingDb.id}`);
    console.log(`Update your .env file with: NOTION_SHOPPING_LIST_PAGE=${shoppingDb.id}`);

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Error setting up Notion databases:', error);
    console.error(error.stack);
  }
}

// Function to create the Pantry database on an existing page
async function createPantryDatabase(pageId) {
  const databaseProperties = {};
  
  // Convert our schema definition to Notion API format
  for (const [name, config] of Object.entries(PANTRY_DATABASE_SCHEMA)) {
    switch (config.type) {
      case 'title':
        databaseProperties[name] = { title: {} };
        break;
      case 'rich_text':
        databaseProperties[name] = { rich_text: {} };
        break;
      case 'number':
        databaseProperties[name] = { number: { format: config.format } };
        break;
      case 'select':
        databaseProperties[name] = {
          select: {
            options: config.options.map(option => ({ name: option }))
          }
        };
        break;
      case 'multi_select':
        databaseProperties[name] = {
          multi_select: {
            options: config.options.map(option => ({ name: option }))
          }
        };
        break;
      case 'date':
        databaseProperties[name] = { date: {} };
        break;
      case 'checkbox':
        databaseProperties[name] = { checkbox: {} };
        break;
      default:
        // Skip unknown property types
        console.warn(`Skipping unknown property type: ${config.type} for ${name}`);
    }
  }
  
  return await notion.databases.create({
    parent: {
      type: "page_id",
      page_id: pageId
    },
    title: [
      {
        type: "text",
        text: {
          content: "Pantry Items",
          link: null
        }
      }
    ],
    properties: databaseProperties
  });
}

// Function to create the Shopping List database on an existing page
async function createShoppingListDatabase(pageId) {
  const databaseProperties = {};
  
  // Convert our schema definition to Notion API format
  for (const [name, config] of Object.entries(SHOPPING_LIST_DATABASE_SCHEMA)) {
    switch (config.type) {
      case 'title':
        databaseProperties[name] = { title: {} };
        break;
      case 'rich_text':
        databaseProperties[name] = { rich_text: {} };
        break;
      case 'number':
        databaseProperties[name] = { number: { format: config.format } };
        break;
      case 'select':
        databaseProperties[name] = {
          select: {
            options: config.options.map(option => ({ name: option }))
          }
        };
        break;
      case 'checkbox':
        databaseProperties[name] = { checkbox: {} };
        break;
      default:
        // Skip unknown property types
        console.warn(`Skipping unknown property type: ${config.type} for ${name}`);
    }
  }
  
  return await notion.databases.create({
    parent: {
      type: "page_id",
      page_id: pageId
    },
    title: [
      {
        type: "text",
        text: {
          content: "Shopping Items",
          link: null
        }
      }
    ],
    properties: databaseProperties
  });
}

// Run the main function
main();