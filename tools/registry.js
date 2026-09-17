const { timeTool } = require('./time_tool');
const { calculatorTool } = require('./calculator_tool');
const { webSearchTool } = require('./web_search');
const { webFetchTool } = require('./web_fetch');
const { memoryTool } = require('./memory');
const { imageSearchTool } = require('./image_search');

/**
 * Central Tool Registry for Metinous AI
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();

    // Register primary foundational tools
    this.registerTool('time', timeTool);
    this.registerTool('calculator', calculatorTool);
    this.registerTool('web_search', webSearchTool);
    this.registerTool('web_fetch', webFetchTool);
    this.registerTool('memory', memoryTool);
    this.registerTool('image_search', imageSearchTool);
  }

  registerTool(name, toolInstance) {
    const key = name.toLowerCase();
    this.tools.set(key, toolInstance);
  }

  getTool(name) {
    const key = (name || '').toLowerCase();
    return this.tools.get(key) || null;
  }

  hasTool(name) {
    return this.tools.has((name || '').toLowerCase());
  }

  listTools() {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.description,
      category: tool.category,
    }));
  }

  async executeTool(name, params = {}, context = {}) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool '${name}' is not registered in TOOL_REGISTRY.`);
    }
    return await tool.execute(params, context);
  }
}

const toolRegistry = new ToolRegistry();

const TOOL_REGISTRY = {
  time: timeTool,
  calculator: calculatorTool,
  web_search: webSearchTool,
  web_fetch: webFetchTool,
  memory: memoryTool,
  image_search: imageSearchTool,
};

module.exports = {
  ToolRegistry,
  toolRegistry,
  TOOL_REGISTRY,
};
