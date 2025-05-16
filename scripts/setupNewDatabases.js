import { Client } from '@notionhq/client';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import readline from 'readline';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables properly
dotenv.config({ path: resolve(__dirname, '../.env') });

// Initialize the RL interface for prompts
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify the readline question
function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

// Load database schemas
import {
  PANTRY_DATABASE_SCHEMA,
  SHOPPING_LIST_DATABASE_SCHEMA,
  INGREDIENTS_DATABASE_SCHEMA,
  RECIPE_INGREDIENTS_SCHEMA
} from '../src/types/notionSchema.js';

/**
 * Create a new top-level Notion page
 */
async function createNotionPage(notion, title, icon = '🍽️') {
  try {
    console.log(`Creating a new Notion page: "${title}"...`);

    const response = await notion.pages.create({
      parent: {
        type: "workspace",
        workspace: true
      },
      icon: {
        type: "emoji",
        emoji: icon
      },
      properties: {
        title: {
          title: [{
            text: { content: title }
          }]
        }
      },
      children: [
        {
          object: "block",
          type: "heading_2",
          heading_2: {
            rich_text: [{
              type: "text",
              text: { content: "AI Pantry Management System" }
            }]
          }
        },
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{
              type: "text",
              text: { content: "This page contains your pantry management databases managed by the AI Pantry MCP server." }
            }]
          }
        }
      ]
    });

    console.log(`✅ Created new Notion page: "${title}" (ID: ${response.id})`);
    return response.id;
  } catch (error) {
    console.error(`Error creating Notion page "${title}":`, error);
    throw error;
  }
}

/**
 * Verify if a Notion page exists and is accessible
 */
async function verifyPageExists(notion, pageId, pageName = "Notion page") {
  try {
    console.log(`Checking if ${pageName} (ID: ${pageId}) exists...`);
    await notion.pages.retrieve({ page_id: pageId });
    console.log(`✅ ${pageName} exists and is accessible!`);
    return true;
  } catch (error) {
    console.error(`❌ Error: Could not find or access ${pageName} with ID ${pageId}`);
    if (error.status === 404) {
      console.error('The page does not exist or your integration does not have access to it.');
    } else {
      console.error('Error details:', error.message);
    }
    return false;
  }
}

/**
 * Convert Notion schema to Notion API properties format
 */
function convertSchemaToNotionProperties(schema) {
  const properties = {};

  for (const [name, config] of Object.entries(schema)) {
    switch (config.type) {
      case 'title':
        properties[name] = { title: {} };
        break;
      case 'rich_text':
        properties[name] = { rich_text: {} };
        break;
      case 'number':
        properties[name] = { number: { format: config.format } };
        break;
      case 'select':
        properties[name] = {
          select: {
            options: config.options ? config.options.map(option => ({ name: option })) : []
          }
        };
        break;
      case 'multi_select':
        properties[name] = {
          multi_select: {
            options: config.options ? config.options.map(option => ({ name: option })) : []
          }
        };
        break;
      case 'date':
        properties[name] = { date: {} };
        break;
      case 'checkbox':
        properties[name] = { checkbox: {} };
        break;
      case 'relation':
        // Skip relation properties, we'll add these later
        break;
      default:
        console.warn(`Skipping unknown property type: ${config.type} for ${name}`);
    }
  }

  return properties;
}

/**
 * Create Pantry database
 */
async function createPantryDatabase(notion, pageId) {
  console.log('\nCreating Pantry database...');
  const properties = convertSchemaToNotionProperties(PANTRY_DATABASE_SCHEMA);

  try {
    const response = await notion.databases.create({
      parent: { type: "page_id", page_id: pageId },
      title: [{ type: "text", text: { content: "Pantry Items" } }],
      icon: {
        type: "emoji",
        emoji: "🧺"
      },
      properties
    });

    console.log(`✅ Pantry database created with ID: ${response.id}`);
    console.log(`Update your .env file with: NOTION_PANTRY_DB=${response.id}`);

    return response.id;
  } catch (error) {
    console.error('❌ Error creating Pantry database:', error.message);
    return null;
  }
}

/**
 * Create Shopping List database
 */
async function createShoppingListDatabase(notion, pageId) {
  console.log('\nCreating Shopping List database...');
  const properties = convertSchemaToNotionProperties(SHOPPING_LIST_DATABASE_SCHEMA);

  try {
    const response = await notion.databases.create({
      parent: { type: "page_id", page_id: pageId },
      title: [{ type: "text", text: { content: "Shopping Items" } }],
      icon: {
        type: "emoji",
        emoji: "🛒"
      },
      properties
    });

    console.log(`✅ Shopping List database created with ID: ${response.id}`);
    console.log(`Update your .env file with: NOTION_SHOPPING_LIST_DB=${response.id}`);

    return response.id;
  } catch (error) {
    console.error('❌ Error creating Shopping List database:', error.message);
    return null;
  }
}

/**
 * Create Ingredients database and Recipe-Ingredients relation database
 */
async function createIngredientDatabases(notion, pageId, recipesDbId = null) {
  // First create the Ingredients database
  console.log('\nCreating Ingredients database...');
  const ingredientProperties = convertSchemaToNotionProperties(INGREDIENTS_DATABASE_SCHEMA);

  try {
    const ingredientsDb = await notion.databases.create({
      parent: { type: "page_id", page_id: pageId },
      title: [{ type: "text", text: { content: "Recipe Ingredients" } }],
      icon: {
        type: "emoji",
        emoji: "🥕"
      },
      properties: ingredientProperties
    });

    console.log(`✅ Ingredients database created with ID: ${ingredientsDb.id}`);
    console.log(`Update your .env file with: NOTION_INGREDIENTS_DB=${ingredientsDb.id}`);

    // If we have a recipes database ID, create the relation database
    if (recipesDbId) {
      console.log('\nCreating Recipe-Ingredients relation database...');

      // Get base properties without relations
      const relationProperties = convertSchemaToNotionProperties(RECIPE_INGREDIENTS_SCHEMA);

      // Add relation properties
      relationProperties['Recipe'] = {
        relation: {
          database_id: recipesDbId
        }
      };

      relationProperties['Ingredient'] = {
        relation: {
          database_id: ingredientsDb.id
        }
      };

      const recipeIngredientsDb = await notion.databases.create({
        parent: { type: "page_id", page_id: pageId },
        title: [{ type: "text", text: { content: "Recipe-Ingredient Relations" } }],
        icon: {
          type: "emoji",
          emoji: "🔗"
        },
        properties: relationProperties
      });

      console.log(`✅ Recipe-Ingredients relation database created with ID: ${recipeIngredientsDb.id}`);
      console.log(`Update your .env file with: NOTION_RECIPE_INGREDIENTS_DB=${recipeIngredientsDb.id}`);

      return {
        ingredientsDbId: ingredientsDb.id,
        recipeIngredientsDbId: recipeIngredientsDb.id
      };
    } else {
      console.log('⚠️ Note: Recipe-Ingredients relation database was not created because no Recipes database ID was provided.');
      console.log('You can create it later after adding your Recipes database ID to your .env file.');

      return {
        ingredientsDbId: ingredientsDb.id,
        recipeIngredientsDbId: null
      };
    }
  } catch (error) {
    console.error('❌ Error creating Ingredient databases:', error.message);
    return {
      ingredientsDbId: null,
      recipeIngredientsDbId: null
    };
  }
}

/**
 * Prompt for confirmation
 */
async function promptForConfirmation(message) {
  const answer = await question(`${message} (y/N) `);
  return answer.toLowerCase() === 'y';
}

/**
 * Main setup wizard function
 */
async function setupWizard() {
  try {
    console.log('=======================================');
    console.log('🍽️  AI Pantry Management Setup Wizard');
    console.log('=======================================');

    // Check for Notion token
    if (!process.env.NOTION_TOKEN) {
      console.error("❌ ERROR: No Notion token found in .env file");
      console.error("Please add NOTION_TOKEN=your_integration_token to your .env file");
      rl.close();
      return;
    }

    // Initialize Notion client
    const notion = new Client({
      auth: process.env.NOTION_TOKEN
    });

    console.log('\n✅ Notion token found. Initializing setup...');

    // Check for or create required pages
    let mainPageId = process.env.NOTION_PANTRY_PAGE;
    if (!mainPageId) {
      console.log('No Pantry page ID found in .env file.');
      const createNewPage = await promptForConfirmation('Would you like to create a new AI Pantry Management page in Notion?');

      if (createNewPage) {
        mainPageId = await createNotionPage(notion, "AI Pantry Management");
        console.log(`Update your .env file with: NOTION_PANTRY_PAGE=${mainPageId}`);
      } else {
        console.error("❌ A Pantry page ID is required to continue setup.");
        rl.close();
        return;
      }
    } else {
      // Verify the main page exists
      const pageExists = await verifyPageExists(notion, mainPageId, "AI Pantry Management page");
      if (!pageExists) {
        const createNewPage = await promptForConfirmation('Would you like to create a new AI Pantry Management page instead?');
        if (createNewPage) {
          mainPageId = await createNotionPage(notion, "AI Pantry Management");
          console.log(`Update your .env file with: NOTION_PANTRY_PAGE=${mainPageId}`);
        } else {
          console.error("❌ A valid Pantry page ID is required to continue setup.");
          rl.close();
          return;
        }
      }
    }

    // Get recipes database ID if available
    const recipesDbId = process.env.NOTION_RECIPES_DB;
    if (recipesDbId) {
      console.log('\nRecipes database ID found in .env file.');
      const recipeDbExists = await verifyPageExists(notion, recipesDbId, "Recipes database");
      if (!recipeDbExists) {
        console.log('⚠️ Warning: The Recipes database ID in your .env file appears to be invalid.');
        console.log('You can still proceed, but recipe-ingredient relations will not be created.');
      }
    } else {
      console.log('\n⚠️ No Recipes database ID found in .env file.');
      console.log('You can still proceed, but recipe-ingredient relations will not be created.');
    }

    // Display setup options
    console.log('\nWhat would you like to set up?');
    console.log('1. Set up all databases (recommended)');
    console.log('2. Set up Pantry database only');
    console.log('3. Set up Shopping List database only');
    console.log('4. Set up Ingredient databases (Ingredients and Recipe-Ingredients)');
    console.log('5. Exit setup wizard');

    const choice = await question('\nEnter your choice (1-5): ');

    // Database setup results
    let pantryDbId = null;
    let shoppingListDbId = null;
    let ingredientsDbId = null;
    let recipeIngredientsDbId = null;
    let ingredientResults;
    // Process user choice
    switch (choice) {
      case '1': // All databases
        pantryDbId = await createPantryDatabase(notion, mainPageId);
        shoppingListDbId = await createShoppingListDatabase(notion, mainPageId);
        ingredientResults = await createIngredientDatabases(notion, mainPageId, recipesDbId);
        ingredientsDbId = ingredientResults.ingredientsDbId;
        recipeIngredientsDbId = ingredientResults.recipeIngredientsDbId;
        break;

      case '2': // Pantry only
        pantryDbId = await createPantryDatabase(notion, mainPageId);
        break;

      case '3': // Shopping List only
        shoppingListDbId = await createShoppingListDatabase(notion, mainPageId);
        break;

      case '4': // Ingredient databases
        ingredientResults = await createIngredientDatabases(notion, mainPageId, recipesDbId);
        ingredientsDbId = ingredientResults.ingredientsDbId;
        recipeIngredientsDbId = ingredientResults.recipeIngredientsDbId;
        break;

      case '5': // Exit
        console.log('Exiting setup wizard...');
        break;

      default:
        console.log('❌ Invalid choice. Exiting setup wizard...');
    }

    // Display setup summary
    console.log('\n=======================================');
    console.log('📋 Setup Summary');
    console.log('=======================================');
    console.log('Databases created:');
    console.log(`- Pantry: ${pantryDbId ? '✅' : '❌'}`);
    console.log(`- Shopping List: ${shoppingListDbId ? '✅' : '❌'}`);
    console.log(`- Ingredients: ${ingredientsDbId ? '✅' : '❌'}`);
    console.log(`- Recipe-Ingredient Relations: ${recipeIngredientsDbId ? '✅' : '❌'}`);

    // Provide next steps
    if (pantryDbId || shoppingListDbId || ingredientsDbId || recipeIngredientsDbId) {
      console.log('\n🔄 Next Steps:');
      console.log('1. Update your .env file with the database IDs listed above');
      console.log('2. Update your wrangler.toml file with the same values');
      console.log('3. Deploy your server using `npm run deploy`');
    }

    console.log('\n✨ Setup wizard complete! ✨');
  } catch (error) {
    console.error('❌ Error during setup:', error);
  } finally {
    rl.close();
  }
}

// For future web UI integration, export modular functions
export {
  createNotionPage,
  verifyPageExists,
  createPantryDatabase,
  createShoppingListDatabase,
  createIngredientDatabases
};

// Non-interactive setup function for web UI
export async function setupDatabases(options) {
  const {
    notionToken,
    mainPageId,
    createPantry = false,
    createShoppingList = false,
    createIngredients = false,
    recipesDbId = null
  } = options;

  // Initialize Notion client
  const notion = new Client({ auth: notionToken });

  // Track created database IDs
  const results = {
    pantryDbId: null,
    shoppingListDbId: null,
    ingredientsDbId: null,
    recipeIngredientsDbId: null
  };

  // Create databases based on options
  if (createPantry) {
    results.pantryDbId = await createPantryDatabase(notion, mainPageId);
  }

  if (createShoppingList) {
    results.shoppingListDbId = await createShoppingListDatabase(notion, mainPageId);
  }

  if (createIngredients) {
    const ingredientResults = await createIngredientDatabases(notion, mainPageId, recipesDbId);
    results.ingredientsDbId = ingredientResults.ingredientsDbId;
    results.recipeIngredientsDbId = ingredientResults.recipeIngredientsDbId;
  }

  return results;
}

// Run the setup wizard when this script is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setupWizard();
}