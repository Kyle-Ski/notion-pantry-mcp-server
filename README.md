# Pantry MCP Server

A Model Context Protocol (MCP) server that connects large language models (LLMs) to your Notion pantry database, allowing for intelligent pantry management, recipe suggestions, and shopping list assistance.

## Overview

This project creates a bridge between LLMs and your Notion databases to:

- Track and manage pantry inventory
- Generate meal suggestions based on available ingredients
- Maintain shopping lists and track purchases
- Automate pantry updates after cooking meals

Built on Cloudflare Workers with the Model Context Protocol (MCP), this server enables natural language interactions with your food management system, making it easy to query your pantry data, receive recipe suggestions, and manage your shopping needs through conversation.

## Features

- **Pantry Management**: View, add, update, and organize pantry items
- **Recipe Suggestions**: Get meal recommendations based on your available ingredients
- **Shopping List Management**: Maintain a dynamic shopping list with automatic additions
- **Intelligent Updates**: After cooking a meal, automatically update pantry quantities and add depleted items to shopping list
- **Direct Notion Integration**: All changes sync directly with your Notion databases with links back to the source pages

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

2. Create Notion Databases:
   - You'll need three databases:
     - **Pantry**: Stores pantry items and quantities
     - **Recipes**: Contains your recipe collection
     - **Shopping List**: Manages items to purchase
     - I have some [scripts](https://github.com/Kyle-Ski/notion-pantry-mcp-server/tree/main/scripts) to help create the Pantry and Shopping List Database

3. Share your databases with your integration:
   - Open each database in Notion
   - Click "Share" in the top right
   - Enter your integration name and click "Invite"

4. Set up database structure:
   This project includes helper scripts to set up your databases with the correct schema:

   ```bash
   # First, create a .env file with:
   NOTION_TOKEN=your_integration_token_here
   NOTION_PANTRY_DB=your_pantry_page_id
   NOTION_SHOPPING_LIST_DB=your_shopping_list_page_id
   NOTION_RECIPES_DB=your_existing_recipe_db_id
   # Then run:
   node scripts/setupNewDatabases.js

This will create the necessary database structure on your existing pages.

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
  "NOTION_SHOPPING_LIST_DB": "your_shopping_list_db_id"
```

4. Deploy to Cloudflare Workers:
   
```bash
npm run deploy
```

## MCP Tools

The server provides several tools for LLMs to interact with your pantry:

`getPantryInfo`
View comprehensive information about your pantry inventory, including:

* Expiring items
* Staples running low
* Items organized by category
* Links to Notion pages

`getPantryAndRecipes`
Get structured data about your pantry and recipes for meal planning, including:

* Available ingredients
* Recipe details with ingredients
* Tags and cooking status

`updatePantryAfterCooking`
After preparing a meal, update your pantry by:

* Decreasing quantities of used ingredients
* Automatically adding depleted staples to shopping list
* Marking recipes as tried

`addPantryItem`
Add new items to your pantry or update existing ones, tracking:

* Quantity and units
* Category and location
* Expiry dates
* Staple status

`manageShoppingList`
Manage your shopping list with actions to:

* View current shopping needs
* Add new items
* Mark items as purchased
* Transfer purchased items to pantry

## Example Usage
Here are some examples of how to interact with the MCP server:

### **Adding Items to Pantry**
```
"I'd like to add 2 pounds of ground beef, 1 gallon of milk, and a dozen eggs to my pantry."
```
The LLM will use the `addPantryItem` tool to add each item to your Notion database.

### **Meal Planning**
```
"What types of lunches can I make with the items I have in my pantry?"
```
The LLM will use getPantryAndRecipes to analyze your pantry contents and suggest suitable lunch recipes.

### **Shopping for a Recipe**
```
"I'd like to make Chicken Parmesan. What ingredients do I need to add to my shopping list?"
```
The LLM will check your pantry inventory, identify missing ingredients, and add them to your shopping list.

## Database Structure

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

### Recipe Database

This project adapts to your existing recipe database structure, typically using:

| Property | Type | Description |
|----------|------|-------------|
| **Name** | Title | Recipe name |
| **Tags** | Multi-select | Categories like "Breakfast", "Dinner", etc. |
| **Tried?** | Checkbox | Whether you've made it before |
| **Link** | URL | URL to recipe source |
| **Kitchen Tools** | Relation | Optional relation to kitchen tools |
| **Created On** | Created time | When the recipe was added |

## Known Limitations

* Currently, recipe ingredients aren't stored in Notion - they're generated based on recipe name and tags
* Expiration dates, notes, and tags aren't fully utilized in all operations
* New categories might be created that don't match existing database categories

## Future Enhancements

* Add server prompts to improve LLM interactions with tools and resources
* Implement authentication for multi-user support
* Create a dedicated ingredients database linked to recipes
* Enable smarter category management based on existing categories
* Support for more detailed recipe information

## Troubleshooting
If you encounter any issues:

* Check that your Notion integration has proper access to all databases
* Verify your environment variables match your Notion database IDs
* Ensure your database structure matches the expected schema
* Submit an issue on GitHub: [https://github.com/Kyle-Ski/notion-pantry-mcp-server/issues](https://github.com/Kyle-Ski/notion-pantry-mcp-server/issues)

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

* Built with [Cloudflare Workers](https://workers.cloudflare.com/)
* Integrates with [Notion API](https://developers.notion.com/)
* Utalizes the [Model Context Protocol](https://modelcontextprotocol.io/introduction) (MCP)
