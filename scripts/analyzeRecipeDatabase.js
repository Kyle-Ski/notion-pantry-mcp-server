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
console.log(`NOTION_RECIPES_DB: ${process.env.NOTION_RECIPES_DB || '✗ Missing'}`);

// Initialize the Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

// Database ID for your recipe database
const RECIPE_DB_ID = process.env.NOTION_RECIPES_DB;

async function analyzeRecipeDatabase() {
  if (!RECIPE_DB_ID) {
    console.error('Recipe database ID not found. Set NOTION_RECIPES_DB in your .env file.');
    return;
  }

  try {
    // Retrieve the database
    const database = await notion.databases.retrieve({
      database_id: RECIPE_DB_ID
    });

    console.log('Recipe Database Analysis:');
    console.log('------------------------');
    console.log(`Database Name: ${database.title?.[0]?.plain_text || 'Unnamed'}`);
    console.log(`Database ID: ${database.id}`);
    console.log('');

    // Display the properties
    console.log('Properties:');
    console.log('-----------');
    
    for (const [name, property] of Object.entries(database.properties)) {
      console.log(`- ${name} (${property.type})`);
      
      // Display select options if applicable
      if (property.type === 'select' && property.select?.options) {
        console.log('  Options:');
        property.select.options.forEach(option => {
          console.log(`  - ${option.name} (${option.color})`);
        });
      }
      
      // Display multi-select options if applicable
      if (property.type === 'multi_select' && property.multi_select?.options) {
        console.log('  Options:');
        property.multi_select.options.forEach(option => {
          console.log(`  - ${option.name} (${option.color})`);
        });
      }
      
      // Display formula expression if applicable
      if (property.type === 'formula' && property.formula) {
        console.log(`  Expression: ${property.formula.expression}`);
      }
    }
    
    // Generate Recipe object structure based on the actual database
    console.log('\nGenerated Recipe Object Structure:');
    console.log('--------------------------------');
    
    console.log(`
/**
 * Recipe object based on your actual Notion database structure
 * Database: ${database.title?.[0]?.plain_text || 'Unnamed'}
 */
const RecipeSchema = {`);

    for (const [name, property] of Object.entries(database.properties)) {
      // Format the property name to camelCase for JavaScript
      const propName = name
        .replace(/\s+(.)/g, (_, char) => char.toUpperCase())
        .replace(/\s/g, '')
        .replace(/^(.)/, (_, char) => char.toLowerCase());
      
      console.log(`  /**\n   * Maps to Notion "${name}" (${property.type}) property\n   */`);
      console.log(`  ${propName}: null,`);
    }
    
    console.log(`  /**\n   * Original Notion page ID\n   */`);
    console.log(`  id: null`);
    
    console.log(`}`);
    
    // Also create mapping function template
    console.log('\nMapping Function Template:');
    console.log('------------------------');
    
    console.log(`
/**
 * Convert a Notion page to a Recipe object
 */
function notionPageToRecipe(page) {
  return {
    id: page.id,`);
    
    for (const [name, property] of Object.entries(database.properties)) {
      // Format the property name to camelCase for JavaScript
      const propName = name
        .replace(/\s+(.)/g, (_, char) => char.toUpperCase())
        .replace(/\s/g, '')
        .replace(/^(.)/, (_, char) => char.toLowerCase());
      
      switch (property.type) {
        case 'title':
          console.log(`    ${propName}: page.properties['${name}']?.title?.[0]?.plain_text || '',`);
          break;
        case 'rich_text':
          console.log(`    ${propName}: page.properties['${name}']?.rich_text?.map(rt => rt.plain_text).join('') || '',`);
          break;
        case 'number':
          console.log(`    ${propName}: page.properties['${name}']?.number || 0,`);
          break;
        case 'select':
          console.log(`    ${propName}: page.properties['${name}']?.select?.name || '',`);
          break;
        case 'multi_select':
          console.log(`    ${propName}: page.properties['${name}']?.multi_select?.map(ms => ms.name) || [],`);
          break;
        case 'date':
          console.log(`    ${propName}: page.properties['${name}']?.date?.start || null,`);
          break;
        case 'checkbox':
          console.log(`    ${propName}: page.properties['${name}']?.checkbox || false,`);
          break;
        case 'url':
          console.log(`    ${propName}: page.properties['${name}']?.url || '',`);
          break;
        case 'files':
          console.log(`    ${propName}: page.properties['${name}']?.files?.map(f => ({`);
          console.log(`      name: f.name,`);
          console.log(`      url: f.file?.url || f.external?.url || '',`);
          console.log(`    })) || [],`);
          break;
        case 'formula':
          if (property.formula?.type === 'number') {
            console.log(`    ${propName}: page.properties['${name}']?.formula?.number || 0,`);
          } else if (property.formula?.type === 'boolean') {
            console.log(`    ${propName}: page.properties['${name}']?.formula?.boolean || false,`);
          } else if (property.formula?.type === 'date') {
            console.log(`    ${propName}: page.properties['${name}']?.formula?.date?.start || null,`);
          } else {
            console.log(`    ${propName}: page.properties['${name}']?.formula?.string || '',`);
          }
          break;
        case 'created_time':
          console.log(`    ${propName}: page.properties['${name}']?.created_time || '',`);
          break;
        case 'last_edited_time':
          console.log(`    ${propName}: page.properties['${name}']?.last_edited_time || '',`);
          break;
        default:
          console.log(`    // Unknown type for ${name} (${property.type})`);
          console.log(`    ${propName}: null,`);
      }
    }
    
    console.log(`  };`);
    console.log(`}`);

    // Generate recipe sample data
    console.log('\nQuery Sample Data:');
    console.log('---------------');
    
    console.log(`
// Sample code to query your Recipe database
async function getRecipes() {
  try {
    const response = await notion.databases.query({
      database_id: "${RECIPE_DB_ID}",
      page_size: 3, // Just get a few recipes as a sample
    });
    
    // Map Notion pages to Recipe objects
    const recipes = response.results.map(page => notionPageToRecipe(page));
    console.log(JSON.stringify(recipes, null, 2));
    
    return recipes;
  } catch (error) {
    console.error('Error querying recipes:', error);
    return [];
  }
}

// Uncomment to run this function
// getRecipes();
`);

  } catch (error) {
    console.error('Error analyzing Recipe database:', error);
    console.error(error.stack);
  }
}

// Run the analysis
analyzeRecipeDatabase();