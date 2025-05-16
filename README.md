# Pantry MCP Server

A Model Context Protocol (MCP) server that connects large language models (LLMs) to your Notion pantry database, allowing for intelligent pantry management, recipe suggestions, and shopping list assistance.

## Overview

This project creates a bridge between LLMs and your Notion databases to:

- Track and manage pantry inventory
- Generate meal suggestions based on available ingredients
- Maintain shopping lists and track purchases
- Automate pantry updates after cooking meals
- Create and manage recipes with detailed ingredient relations

Built on Cloudflare Workers with the Model Context Protocol (MCP), this server enables natural language interactions with your food management system, making it easy to query your pantry data, receive recipe suggestions, and manage your shopping needs through conversation.

## Features

- **Pantry Management**: View, add, update, and organize pantry items
- **Recipe Suggestions**: Get meal recommendations based on your available ingredients
- **Shopping List Management**: Maintain a dynamic shopping list with automatic additions
- **Setup Wizard**: Includes a setup script that will create databases and relations needed
- **Intelligent Updates**: After cooking a meal, automatically update pantry quantities and add depleted items to shopping list
- **Direct Notion Integration**: All changes sync directly with your Notion databases with links back to the source pages
- **Recipe Ingredient Relations**: Smart ingredient tracking with categorization, storage recommendations (WIP), and recipe relations (_this helps with recomendations of meals if you want to use your own recipes_)
- **AI Modification Tracking**: Clear labeling of all AI-initiated changes in your Notion databases

## Requirements

- Node.js 18 or higher
- Cloudflare account
- Notion account with API access
- Basic familiarity with Notion databases

## Setup

### Notion Integration Setup

1. Create a Notion integration:
   - Go to [https://www.notion.so/my-integrations](https://www.notion.so/my-integrations)
   - Click "New integration"
   - Give it a name like "Pantry Manager"
   - Select the capabilities: "Read content", "Update content", "Insert content"
   - Save and copy your integration token

2. Run the Setup Wizard:
   The project includes an interactive setup wizard to create all necessary databases in your Notion workspace:

   ```bash
   # First, create a .env file with:
   NOTION_TOKEN=your_integration_token_here
   
   # Then run the setup wizard:
   node scripts/setupNewDatabases.js
   ```

   The wizard will:
   - Create a new AI Pantry Management page if needed
   - Guide you through setting up all necessary databases
   - Provide you with the database IDs to add to your .env file

3. Update your .env file with the database IDs from the setup wizard:
   ```
   NOTION_TOKEN=your_integration_token_here
   NOTION_PANTRY_DB=your_pantry_db_id
   NOTION_SHOPPING_LIST_DB=your_shopping_list_db_id
   NOTION_RECIPES_DB=your_recipes_db_id
   NOTION_INGREDIENTS_DB=your_ingredients_db_id
   NOTION_RECIPE_INGREDIENTS_DB=your_recipe_ingredients_db_id
   ```

## Project Setup

1. Clone the repository:

```bash
git clone https://github.com/Kyle-Ski/notion-pantry-mcp-server
cd notion-pantry-mcp-server
```
2. Install dependencies:
```bash
npm install
```
3. Configure your environment:
   
_Update `.dev.vars with your Notion credentials:_
```bash
  "NOTION_TOKEN": "your_integration_token_here",
  "NOTION_PANTRY_DB": "your_pantry_db_id",
  "NOTION_RECIPES_DB": "your_recipes_db_id",
  "NOTION_SHOPPING_LIST_DB": "your_shopping_list_db_id",
  "NOTION_INGREDIENTS_DB": "your_ingredients_db_id",
  "NOTION_RECIPE_INGREDIENTS_DB": "your_recipe_ingredients_db_id"
```

4. Deploy to Cloudflare Workers:
   
```bash
npm run deploy
```

## Database Structure

The system uses five interconnected Notion databases:

### Pantry Database

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Item name |
| **Quantity** | Number | Amount available |
| **Unit** | Select | Measurement unit (count, oz, pounds, etc.) |
| **Category** | Select | Food category (Produce, Dairy, etc.) |
| **Location** | Select | Storage location (Fridge, Pantry, etc.) |
| **Expiry** | Date | Expiration date |
| **Staple** | Checkbox | Whether it's a staple item |
| **MinQuantity** | Number | Minimum quantity to maintain for staples |
| **Notes** | Rich Text | Additional information about the item |
| **Tags** | Multi-select | Additional categorization |
| **AI Modified** | Checkbox | Whether item was added/updated by AI |

### Shopping List Database

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Item name |
| **Quantity** | Number | Amount to purchase |
| **Unit** | Select | Measurement unit |
| **Category** | Select | Food category |
| **Priority** | Select | Shopping priority (Low, Medium, High) |
| **Purchased** | Checkbox | Whether it's been purchased |
| **AutoAdded** | Checkbox | Whether it was automatically added |
| **Notes** | Rich Text | Additional notes about purchase |
| **AI Modified** | Checkbox | Whether item was added/updated by AI |

### Recipe Database

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Recipe name |
| **Ingredients** | Rich Text | Legacy text list of ingredients |
| **Instructions** | Rich Text | Step-by-step instructions |
| **PrepTime** | Number | Preparation time in minutes |
| **CookTime** | Number | Cooking time in minutes |
| **Tags** | Multi-select | Categories like "Breakfast", "Dinner", etc. |
| **Tried?** | Checkbox | Whether you've made it before |
| **Link** | URL | URL to recipe source |
| **AI Modified** | Checkbox | Whether item was added/updated by AI |

### Recipe Ingredients Database

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Ingredient name |
| **Units** | Multi-select | Common units this ingredient uses |
| **Category** | Select | Food category |
| **Perishable** | Checkbox | Whether it's perishable |
| **Storage** | Select | How it should be stored |
| **ShelfLifeDays** | Number | Approximate shelf life in days |
| **Notes** | Rich Text | Additional notes |
| **AI Modified** | Checkbox | Whether item was added/updated by AI |

### Recipe-Ingredient Relations Database

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Relation reference (e.g., "Recipe - Ingredient") |
| **Recipe** | Relation | Reference to specific recipe |
| **Ingredient** | Relation | Reference to specific ingredient |
| **Quantity** | Number | Amount needed |
| **Unit** | Select | Unit of measurement |
| **Optional** | Checkbox | Whether ingredient is optional |
| **Preparation** | Rich Text | How to prepare (e.g., "chopped") |
| **AI Modified** | Checkbox | Whether relation was added by AI |

## MCP Tools

The server provides the following tools for LLMs to interact with your pantry system:

| Tool | Description | Key Features |
|------|-------------|--------------|
| `getPantryInfo` | View comprehensive information about your pantry inventory | • Complete item listing with quantities<br>• Expiring items within the next week<br>• Staples running low<br>• Category distribution<br>• Notion page links |
| `getPantryAndRecipes` | Get pantry inventory and recipes for meal planning | • Current pantry inventory<br>• Recipe details with ingredients<br>• Recipe tags and tried status<br>• Recipe source links<br>• Ingredient matching with relations |
| `updatePantryItems` | Update quantities of multiple pantry items at once | • Batch update/add multiple items<br>• Support for both adding and removing quantities<br>• Automatically adds new items if needed<br>• Detailed before/after report |
| `updatePantryAfterCooking` | Update pantry after preparing a meal | • Update via recipe ID or ingredient list<br>• Auto-decrease used ingredients<br>• Add depleted staples to shopping list<br>• Mark recipes as tried<br>• Detailed change report |
| `updatePantryWithUsedItems` | Update pantry by removing ingredients you've used | • Direct quantity reduction for ad-hoc cooking<br>• Tracks items not found in pantry<br>• Adds staples to shopping list when low<br>• Provides before/after comparison |
| `addPantryItem` | Add or update pantry items | • Quantity, unit, category tracking<br>• Expiry date management<br>• Staple item flagging with auto-calculated minimums<br>• Smart duplicate handling |
| `getShoppingList` | View current shopping list | • Items organized by category<br>• Purchase status tracking<br>• Priority levels<br>• Auto-added vs manual items |
| `addToShoppingList` | Add items to shopping list | • Quantity, unit, category tracking<br>• Priority assignment<br>• Smart duplicate handling |
| `markItemAsPurchased` | Mark shopping list items as purchased | • Update purchase status<br>• Prepare for pantry transfer |
| `addPurchasedItemsToPantry` | Transfer purchased items to pantry | • Bulk transfer of purchased items<br>• Update existing pantry quantities<br>• Remove from shopping list<br>• Optional detailed summary |
| `removeExpiredItems` | Remove expired items from pantry | • Optional custom expiry date check<br>• Add staples to shopping list<br>"Dry run" mode for checking without removing<br>• Detailed expiry report |
| `convertCookingUnits` | Convert between different cooking units | • Support for volume and weight conversions<br>• Ingredient-specific conversions<br>• Handles unit aliases<br>• Multi-step conversions |
| `getCookingEquivalents` | Get common cooking equivalents | • Volume conversion tables<br>• Weight conversion tables<br>• Ingredient-specific equivalents |
| `addNewRecipe` | Add a new recipe to your Notion database | • Creates recipe with instructions<br>• Sets up ingredient relations<br>• AI categorizes ingredients by type<br>• Sets storage recommendations<br>• Marks as AI modified |

## Example Usage
Here are some examples of how to interact with the MCP server:

### **Adding Items to Pantry**
```
"I'd like to add 2 pounds of ground beef, 1 gallon of milk, and a dozen eggs to my pantry."
```
The LLM will use the `addPantryItem` tool to add each item to your Notion database.

### **Meal Planning and Recipe Creation**
```
User: "What things can I make for lunch?"
LLM: "Based on your pantry, you can make a Mediterranean Chickpea Bowl, Tuna Salad Sandwich, or Simple Avocado Toast with the items you have on hand."

User: "Can you show me the recipe for the Mediterranean Chickpea Bowl and add it to my recipe box?"
LLM: "Here's the recipe for Mediterranean Chickpea Bowl:

Ingredients:
- 1 can garbanzo beans (chickpeas), drained and rinsed
- 2 cups spring mix salad
- 2.5 tbsp feta cheese crumbles
- 1 tbsp olive oil
- 2 tbsp Greek dressing
- 1/4 tsp each of salt, pepper, garlic powder, and oregano
- 1 tsp lemon juice (optional)

Instructions:
1. Place the spring salad mix in a bowl as your base.
2. Add the drained and rinsed chickpeas on top.
3. Sprinkle the feta cheese crumbles over everything.
4. Drizzle with olive oil and Greek dressing.
5. Season with salt, pepper, garlic powder, and oregano.
6. Add a squeeze of lemon juice if available.
7. Toss everything together and enjoy!

I've added this recipe to your Notion recipe box with appropriate ingredient relations."
```

### **Shopping for a Recipe**
```
"I'd like to make Chicken Parmesan. What ingredients do I need to add to my shopping list?"
```
The LLM will check your pantry inventory, identify missing ingredients, and add them to your shopping list.

### **Adding Purchased Items to Pantry**
```
"I just finished shopping, can you add all of the purchased items to my pantry?"
```
The LLM will look at your shopping list for purchased items, and add all of them to your pantry.

## Known Limitations

* Expiration dates, notes, and tags aren't fully utilized in all operations
* New categories might be created that don't match existing database categories
* Recipe-to-ingredient relations require the Recipe and Ingredients databases to be set up
* The ingredient categorization is based on the LLM's knowledge and may occasionally need correction

## Future Enhancements

* Add server prompts to improve LLM interactions with tools and resources
* Implement authentication for multi-user support
* Enable smarter category management based on existing categories
* Support for more detailed recipe information
* Improve unit conversion between different measurement systems
* Add meal planning for multiple days with shopping list generation

## Troubleshooting
If you encounter any issues:

* Check that your Notion integration has proper access to all databases
* Verify your environment variables match your Notion database IDs
* Ensure your database structure matches the expected schema
* Try running the setup wizard again to recreate databases if needed
* Submit an issue on GitHub: [https://github.com/Kyle-Ski/notion-pantry-mcp-server/issues](https://github.com/Kyle-Ski/notion-pantry-mcp-server/issues)

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

* Built with [Cloudflare Workers](https://workers.cloudflare.com/)
* Integrates with [Notion API](https://developers.notion.com/)
* Utilizes the [Model Context Protocol](https://modelcontextprotocol.io/introduction) (MCP)
