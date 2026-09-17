const { BaseTool } = require('./base');

/**
 * Safe Arithmetic Expression Evaluator
 * Uses a Recursive Descent Parser (No eval / No Function constructor)
 */
class SafeMathParser {
  constructor(input) {
    this.input = input.replace(/\s+/g, '');
    this.pos = 0;
  }

  peek() {
    return this.input[this.pos] || null;
  }

  getChar() {
    return this.input[this.pos++] || null;
  }

  parse() {
    if (!this.input || this.input.length === 0) {
      throw new Error('Empty mathematical expression.');
    }
    const result = this.parseExpression();
    if (this.pos < this.input.length) {
      throw new Error(`Unexpected character '${this.input[this.pos]}' at position ${this.pos}.`);
    }
    return result;
  }

  // Expression: Addition & Subtraction
  parseExpression() {
    let value = this.parseTerm();

    while (this.pos < this.input.length) {
      const op = this.peek();
      if (op === '+' || op === '-') {
        this.getChar(); // consume operator
        const right = this.parseTerm();
        if (op === '+') {
          value += right;
        } else {
          value -= right;
        }
      } else {
        break;
      }
    }
    return value;
  }

  // Term: Multiplication, Division, Modulo
  parseTerm() {
    let value = this.parseExponent();

    while (this.pos < this.input.length) {
      const op = this.peek();
      if (op === '*' && this.input[this.pos + 1] !== '*') {
        this.getChar();
        const right = this.parseExponent();
        value *= right;
      } else if (op === '/') {
        this.getChar();
        const right = this.parseExponent();
        if (right === 0) {
          throw new Error('Division by zero is undefined.');
        }
        value /= right;
      } else if (op === '%') {
        this.getChar();
        const right = this.parseExponent();
        if (right === 0) {
          throw new Error('Modulo by zero is undefined.');
        }
        value %= right;
      } else {
        break;
      }
    }
    return value;
  }

  // Exponentiation: ** or ^ (right-associative)
  parseExponent() {
    let value = this.parseFactor();

    if (this.pos < this.input.length) {
      if (this.input.startsWith('**', this.pos)) {
        this.pos += 2;
        const right = this.parseExponent(); // right-associative recursion
        value = Math.pow(value, right);
      } else if (this.peek() === '^') {
        this.getChar();
        const right = this.parseExponent();
        value = Math.pow(value, right);
      }
    }
    return value;
  }

  // Factor: Unary signs, Parentheses, Numbers
  parseFactor() {
    const char = this.peek();

    // Unary plus
    if (char === '+') {
      this.getChar();
      return this.parseFactor();
    }

    // Unary minus
    if (char === '-') {
      this.getChar();
      return -this.parseFactor();
    }

    // Parentheses
    if (char === '(') {
      this.getChar(); // consume '('
      const value = this.parseExpression();
      if (this.peek() !== ')') {
        throw new Error("Mismatched parentheses: Missing closing ')'.");
      }
      this.getChar(); // consume ')'
      return value;
    }

    // Numbers (integers or decimals)
    const startPos = this.pos;
    let hasDot = false;

    while (this.pos < this.input.length) {
      const c = this.peek();
      if (c >= '0' && c <= '9') {
        this.getChar();
      } else if (c === '.' && !hasDot) {
        hasDot = true;
        this.getChar();
      } else {
        break;
      }
    }

    if (startPos === this.pos) {
      throw new Error(`Invalid syntax near '${this.input.substring(startPos, startPos + 5)}'.`);
    }

    const numStr = this.input.substring(startPos, this.pos);
    const num = parseFloat(numStr);
    if (isNaN(num)) {
      throw new Error(`Failed to parse number '${numStr}'.`);
    }
    return num;
  }
}

class CalculatorTool extends BaseTool {
  constructor() {
    super({
      name: 'calculator',
      description: 'Safely evaluates arithmetic expressions without eval() (+, -, *, /, %, **, parentheses, decimals, negatives).',
      category: 'CALCULATOR',
    });
  }

  /**
   * Cleans and extracts arithmetic expression from query string
   */
  extractExpression(rawQuery) {
    if (!rawQuery || typeof rawQuery !== 'string') return '';
    
    // Remove query phrases like "calculate", "what is", "eval", "solve"
    let clean = rawQuery
      .replace(/^(calculate|compute|solve|what is|evaluate|how much is)\s+/i, '')
      .replace(/[?!=]+$/, '')
      .replace(/x/g, '*') // Convert multiplication 'x' to '*'
      .trim();

    return clean;
  }

  calculate(expression) {
    try {
      const cleanExpr = this.extractExpression(expression);
      const parser = new SafeMathParser(cleanExpr);
      const result = parser.parse();

      // Format clean number (avoid floating point precision quirks like 0.30000000000000004)
      const formattedResult = Number.isInteger(result)
        ? result
        : parseFloat(result.toFixed(8)).toString();

      return {
        success: true,
        expression: cleanExpr,
        result: formattedResult,
        formattedAnswer: `**${cleanExpr}** = **${Number(formattedResult).toLocaleString('en-US', { maximumFractionDigits: 8 })}**`,
      };
    } catch (err) {
      return {
        success: false,
        expression,
        error: err.message,
        formattedAnswer: `⚠️ Calculator Error: ${err.message}`,
      };
    }
  }

  async execute(params = {}) {
    const expr = params.expression || params.query || '';
    const res = this.calculate(expr);
    return {
      success: res.success,
      data: res,
      answer: res.formattedAnswer,
    };
  }
}

module.exports = {
  CalculatorTool,
  SafeMathParser,
  calculatorTool: new CalculatorTool(),
};
