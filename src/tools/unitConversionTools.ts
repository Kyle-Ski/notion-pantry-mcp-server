import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register unit conversion tools for cooking and recipe measurements
 */
export function registerUnitConversionTools(server: McpServer) {
    // Unit conversion constants
    const unitConversions: Record<string, number> = {
        // Volume
        "tbsp_to_oz": 0.5,
        "tsp_to_oz": 0.1667,
        "cup_to_oz": 8,
        "cup_to_ml": 236.59,
        "oz_to_ml": 29.57,
        "cup_to_tbsp": 16,
        "cup_to_tsp": 48,
        "tbsp_to_tsp": 3,
        "pint_to_cup": 2,
        "quart_to_cup": 4,
        "gallon_to_cup": 16,
        
        // Weight
        "pound_to_oz": 16,
        "kg_to_pound": 2.20462,
        "g_to_oz": 0.03527396,
        
        // Ingredient-specific weight conversions
        "cup_flour_to_oz": 4.25,
        "cup_sugar_to_oz": 7.05,
        "cup_brown_sugar_to_oz": 7.5,
        "cup_rice_to_oz": 6.53,  // uncooked
        "cup_oats_to_oz": 2.65,  // dry oats
        "cup_milk_to_oz": 8.6,
        "cup_butter_to_oz": 8,
        "cup_oil_to_oz": 7.63,
        "cup_honey_to_oz": 12,
        "cup_yogurt_to_oz": 8.6,
        
        // Common ingredient by tablespoon
        "tbsp_honey_to_oz": 0.75,
        "tbsp_oil_to_oz": 0.5,
        "tbsp_butter_to_oz": 0.5,
        "tbsp_flour_to_oz": 0.27,
        "tbsp_sugar_to_oz": 0.44,
        
        // Common count conversions
        "dozen_to_count": 12,
        "half_dozen_to_count": 6,
        
        // Common package/container conversions
        "stick_butter_to_oz": 4,
        "can_to_oz": 14.5, // Standard can size
        "package_to_oz": 16, // Common package size
    };

    /**
     * Normalize unit names to handle common variations
     */
    function normalizeUnit(unit: string): string {
        unit = unit.toLowerCase().trim();
        
        // Handle volume units
        if (['tablespoon', 'tablespoons', 'tbsp', 'tbs', 'tb'].includes(unit)) return 'tbsp';
        if (['teaspoon', 'teaspoons', 'tsp', 'ts'].includes(unit)) return 'tsp';
        if (['cup', 'cups', 'c'].includes(unit)) return 'cup';
        if (['fluid ounce', 'fluid oz', 'fl oz', 'fl. oz.'].includes(unit)) return 'oz';
        if (['pint', 'pints', 'pt'].includes(unit)) return 'pint';
        if (['quart', 'quarts', 'qt'].includes(unit)) return 'quart';
        if (['gallon', 'gallons', 'gal'].includes(unit)) return 'gallon';
        if (['milliliter', 'milliliters', 'ml'].includes(unit)) return 'ml';
        if (['liter', 'liters', 'l'].includes(unit)) return 'liter';
        
        // Handle weight units
        if (['ounce', 'ounces', 'oz'].includes(unit)) return 'oz';
        if (['pound', 'pounds', 'lb', 'lbs'].includes(unit)) return 'pound';
        if (['gram', 'grams', 'g'].includes(unit)) return 'g';
        if (['kilogram', 'kilograms', 'kg'].includes(unit)) return 'kg';
        
        // Handle count units
        if (['each', 'ea', 'count', 'ct', 'piece', 'pieces', ''].includes(unit)) return 'count';
        if (['dozen', 'doz'].includes(unit)) return 'dozen';
        
        // Handle container units
        if (['can', 'cans'].includes(unit)) return 'can';
        if (['package', 'packages', 'pkg', 'pack'].includes(unit)) return 'package';
        if (['bottle', 'bottles', 'btl'].includes(unit)) return 'bottle';
        if (['box', 'boxes'].includes(unit)) return 'box';
        if (['jar', 'jars'].includes(unit)) return 'jar';
        if (['stick', 'sticks'].includes(unit)) return 'stick';
        
        // If no normalization found, return the original
        return unit;
    }

    /**
     * Convert between common cooking units
     */
    function convertUnit(value: number, fromUnit: string, toUnit: string, ingredient?: string): number | null {
        // Normalize units to handle aliases
        const fromUnitNorm = normalizeUnit(fromUnit);
        const toUnitNorm = normalizeUnit(toUnit);
        
        // Direct conversion if units are the same
        if (fromUnitNorm === toUnitNorm) return value;
        
        // Try ingredient-specific conversion first
        if (ingredient) {
            const ingNorm = ingredient.toLowerCase().trim();
            const specificKey = `${fromUnitNorm}_${ingNorm}_to_oz`;
            
            // Special case for common ingredients with cup measurements
            if (fromUnitNorm === 'cup' && toUnitNorm === 'oz' && unitConversions[specificKey]) {
                return value * unitConversions[specificKey];
            }
            
            // Special case for common ingredients with tablespoon measurements
            if (fromUnitNorm === 'tbsp' && toUnitNorm === 'oz') {
                const tbspKey = `tbsp_${ingNorm}_to_oz`;
                if (unitConversions[tbspKey]) {
                    return value * unitConversions[tbspKey];
                }
            }
        }
        
        // Check if we have a direct conversion
        const conversionKey = `${fromUnitNorm}_to_${toUnitNorm}`;
        if (unitConversions[conversionKey]) {
            return value * unitConversions[conversionKey];
        }
        
        // Try reverse conversion
        const reverseKey = `${toUnitNorm}_to_${fromUnitNorm}`;
        if (unitConversions[reverseKey]) {
            return value / unitConversions[reverseKey];
        }
        
        // Multi-step conversions via intermediate units
        
        // Volume conversions via oz
        if (['tbsp', 'tsp', 'cup', 'pint', 'quart', 'gallon'].includes(fromUnitNorm) && 
            ['tbsp', 'tsp', 'cup', 'pint', 'quart', 'gallon'].includes(toUnitNorm)) {
            // Convert to oz first, then to target unit
            const toOzKey = `${fromUnitNorm}_to_oz`;
            const fromOzKey = `${toUnitNorm}_to_oz`;
            
            if (unitConversions[toOzKey] && unitConversions[fromOzKey]) {
                const ozValue = value * unitConversions[toOzKey];
                return ozValue / unitConversions[fromOzKey];
            }
        }
        
        // Volume/weight via ml/g
        if (['ml', 'liter'].includes(fromUnitNorm) && ['oz', 'cup'].includes(toUnitNorm)) {
            const mlValue = fromUnitNorm === 'liter' ? value * 1000 : value;
            return mlValue / unitConversions['oz_to_ml'] * (toUnitNorm === 'cup' ? (1/8) : 1);
        }
        
        // Weight conversions via oz
        if (['g', 'kg', 'pound'].includes(fromUnitNorm) && 
            ['g', 'kg', 'pound', 'oz'].includes(toUnitNorm)) {
            // Convert everything to oz first
            let ozValue = value;
            
            if (fromUnitNorm === 'g') ozValue = value * unitConversions['g_to_oz'];
            if (fromUnitNorm === 'kg') ozValue = value * unitConversions['kg_to_pound'] * unitConversions['pound_to_oz'];
            if (fromUnitNorm === 'pound') ozValue = value * unitConversions['pound_to_oz'];
            
            // Then convert oz to target
            if (toUnitNorm === 'g') return ozValue / unitConversions['g_to_oz'];
            if (toUnitNorm === 'kg') return ozValue / unitConversions['pound_to_oz'] / unitConversions['kg_to_pound'];
            if (toUnitNorm === 'pound') return ozValue / unitConversions['pound_to_oz'];
            return ozValue; // oz
        }
        
        // Cannot convert
        return null;
    }

    /**
     * Tool: Convert between cooking units and measurements
     */
    server.tool(
        "convertCookingUnits",
        "Convert between cooking units and measurements",
        {
            value: z.number().describe("The numerical value to convert"),
            fromUnit: z.string().describe("The source unit (e.g., 'cup', 'tbsp', 'oz')"),
            toUnit: z.string().describe("The target unit to convert to"),
            ingredient: z.string().optional().describe("Optional: specific ingredient for more accurate conversion (e.g., 'flour', 'sugar')")
        },
        async ({ value, fromUnit, toUnit, ingredient }) => {
            try {
                const convertedValue = convertUnit(value, fromUnit, toUnit, ingredient);
                
                if (convertedValue !== null) {
                    // Format the converted value nicely
                    let formattedValue = convertedValue;
                    
                    // Round to 2 decimal places for most values
                    if (convertedValue > 0.1) {
                        formattedValue = Math.round(convertedValue * 100) / 100;
                    }
                    // Use more precision for very small values
                    else {
                        formattedValue = Math.round(convertedValue * 1000) / 1000;
                    }
                    
                    return {
                        content: [{
                            type: "text",
                            text: `# Unit Conversion Result\n\n${value} ${fromUnit}${ingredient ? ` of ${ingredient}` : ''} = ${formattedValue} ${toUnit}`
                        }]
                    };
                } else {
                    return {
                        content: [{
                            type: "text",
                            text: `Unable to convert ${value} ${fromUnit} to ${toUnit}${ingredient ? ` for ${ingredient}` : ''}. This conversion is not supported. Try using common units like cups, tablespoons, ounces, or grams.`
                        }]
                    };
                }
            } catch (error: any) {
                console.error("Error in unit conversion:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error converting units: ${error.message}`
                    }]
                };
            }
        }
    );

    /**
     * Tool: Get common cooking equivalents
     */
    server.tool(
        "getCookingEquivalents",
        "Get common cooking unit equivalents and conversion table",
        {
            category: z.enum(["volume", "weight", "ingredients"]).optional()
                .describe("Optional: filter by category (volume, weight, or ingredients)")
        },
        async ({ category }) => {
            try {
                // Prepare common conversion tables
                const volumeEquivalents = [
                    { from: "1 tablespoon (tbsp)", to: "3 teaspoons (tsp)" },
                    { from: "1 fluid ounce (fl oz)", to: "2 tablespoons (tbsp)" },
                    { from: "1 cup", to: "8 fluid ounces (fl oz)" },
                    { from: "1 cup", to: "16 tablespoons (tbsp)" },
                    { from: "1 cup", to: "48 teaspoons (tsp)" },
                    { from: "1 cup", to: "237 milliliters (ml)" },
                    { from: "1 pint", to: "2 cups" },
                    { from: "1 quart", to: "2 pints" },
                    { from: "1 quart", to: "4 cups" },
                    { from: "1 gallon", to: "4 quarts" },
                    { from: "1 gallon", to: "16 cups" },
                    { from: "1 liter", to: "4.22 cups" },
                    { from: "1 liter", to: "1000 milliliters (ml)" }
                ];
                
                const weightEquivalents = [
                    { from: "1 pound (lb)", to: "16 ounces (oz)" },
                    { from: "1 kilogram (kg)", to: "2.2 pounds (lb)" },
                    { from: "1 ounce (oz)", to: "28.35 grams (g)" },
                    { from: "1 pound (lb)", to: "453.6 grams (g)" }
                ];
                
                const ingredientEquivalents = [
                    { ingredient: "All-purpose flour", amount: "1 cup", equivalents: "4.25 oz / 120g" },
                    { ingredient: "Granulated sugar", amount: "1 cup", equivalents: "7.05 oz / 200g" },
                    { ingredient: "Brown sugar", amount: "1 cup", equivalents: "7.5 oz / 213g" },
                    { ingredient: "Butter", amount: "1 cup", equivalents: "8 oz / 227g" },
                    { ingredient: "Butter", amount: "1 stick", equivalents: "4 oz / 113g / 1/2 cup" },
                    { ingredient: "Vegetable oil", amount: "1 cup", equivalents: "7.63 oz / 216g" },
                    { ingredient: "Honey", amount: "1 cup", equivalents: "12 oz / 340g" },
                    { ingredient: "Milk", amount: "1 cup", equivalents: "8.6 oz / 244g" },
                    { ingredient: "Water", amount: "1 cup", equivalents: "8.3 oz / 236g" },
                    { ingredient: "Quick oats", amount: "1 cup", equivalents: "2.65 oz / 75g" },
                    { ingredient: "Rice (uncooked)", amount: "1 cup", equivalents: "6.53 oz / 185g" },
                    { ingredient: "Salt", amount: "1 tbsp", equivalents: "0.63 oz / 18g" }
                ];
                
                // Filter based on category if provided
                let responseData: any = {};
                
                if (!category || category === "volume") {
                    responseData.volumeEquivalents = volumeEquivalents;
                }
                
                if (!category || category === "weight") {
                    responseData.weightEquivalents = weightEquivalents;
                }
                
                if (!category || category === "ingredients") {
                    responseData.ingredientEquivalents = ingredientEquivalents;
                }
                
                const title = category 
                    ? `# Common ${category.charAt(0).toUpperCase() + category.slice(1)} Cooking Equivalents`
                    : "# Common Cooking Equivalents";
                
                return {
                    content: [{
                        type: "text",
                        text: `${title}\n\nUse these common conversion tables to help with your cooking and pantry management.\n\n${JSON.stringify(responseData, null, 2)}`
                    }]
                };
            } catch (error: any) {
                console.error("Error getting cooking equivalents:", error);
                return {
                    content: [{
                        type: "text",
                        text: `Error retrieving cooking equivalents: ${error.message}`
                    }]
                };
            }
        }
    );
}