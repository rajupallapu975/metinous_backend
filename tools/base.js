/**
 * Base Tool Interface for Metinous AI Tool Ecosystem
 */

class BaseTool {
  constructor({ name, description, category }) {
    if (!name || !description) {
      throw new Error('Tool must have a name and description.');
    }
    this.name = name;
    this.description = description;
    this.category = category || name.toUpperCase();
  }

  /**
   * Execute the tool with given parameters
   * @param {Object} params - Tool parameters
   * @param {Object} context - Execution context (history, user, broadcaster)
   * @returns {Promise<Object>} Structured tool result
   */
  async execute(params = {}, context = {}) {
    throw new Error(`Tool ${this.name} must implement execute() method.`);
  }
}

module.exports = {
  BaseTool,
};
