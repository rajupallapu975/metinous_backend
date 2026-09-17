const { BaseTool } = require('./base');

class TimeTool extends BaseTool {
  constructor() {
    super({
      name: 'time',
      description: 'Provides exact local real-time and date for the requested timezone (default: Asia/Kolkata / IST).',
      category: 'TIME',
    });
  }

  /**
   * Retrieves current time in the specified timezone
   * @param {Object} params
   * @param {string} [params.timezone='Asia/Kolkata']
   */
  getCurrentTime(timezone = 'Asia/Kolkata') {
    const validTz = timezone || 'Asia/Kolkata';
    const now = new Date();

    try {
      // Formatter for time (e.g. 10:36 AM)
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: validTz,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });

      // Formatter for short time (e.g. 10:36 AM)
      const shortTimeFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: validTz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });

      // Formatter for full date (e.g. Tuesday, September 15, 2026)
      const dateFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: validTz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Formatter for short date (YYYY-MM-DD)
      const shortDateFormatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: validTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });

      const formattedTime = timeFormatter.format(now);
      const shortTime = shortTimeFormatter.format(now);
      const formattedDate = dateFormatter.format(now);
      const shortDate = shortDateFormatter.format(now);

      const tzAbbrev = validTz === 'Asia/Kolkata' ? 'IST' : validTz;

      return {
        time: shortTime,
        timeWithSeconds: formattedTime,
        date: formattedDate,
        shortDate: shortDate,
        timezone: validTz,
        tzAbbreviation: tzAbbrev,
        iso: now.toISOString(),
        formattedAnswer: `The current time is **${shortTime} ${tzAbbrev}** on **${formattedDate}**.`,
      };
    } catch (err) {
      // Fallback if timezone string is invalid
      const fallbackTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const fallbackDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      return {
        time: fallbackTime,
        date: fallbackDate,
        timezone: 'Local',
        tzAbbreviation: 'Local',
        iso: now.toISOString(),
        formattedAnswer: `The current local time is **${fallbackTime}** on **${fallbackDate}**.`,
      };
    }
  }

  async execute(params = {}) {
    const timezone = params.timezone || 'Asia/Kolkata';
    const result = this.getCurrentTime(timezone);

    return {
      success: true,
      data: result,
      answer: result.formattedAnswer,
    };
  }
}

module.exports = {
  TimeTool,
  timeTool: new TimeTool(),
};
