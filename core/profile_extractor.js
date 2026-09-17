/**
 * Metinous AI — User Profile & Entity Extractor
 * Automatically extracts persistent user attributes (Name, College, Location, Job, Preferences)
 * across multi-turn and cross-chat conversations.
 */

class ProfileExtractor {
  extractProfileFacts(text = '') {
    if (!text || typeof text !== 'string') return [];

    const clean = text.trim();
    const facts = [];

    // 1. Name Extraction
    const namePatterns = [
      /(?:my name is|call me|myself|i am called)\s+([A-Za-z\s.'-]+?)(?:\s+(?:\band\b|\bi study\b|\bi work\b|\bi live\b|\bnice to meet\b|\bpleased\b|\bhow are you\b|\bwho are you\b|\bbye\b)|[.,!?;:]|$)/i,
      /^(?:i am|i'm)\s+([A-Za-z\s.'-]+?)(?:\s+(?:\band\b|\bi study\b|\bi work\b|\bfrom\b|\bliving in\b)|[.,!?;:]|$)/i,
      /^(?:this is)\s+([A-Za-z\s.'-]+?)(?:\s+(?:\band\b|\bi study\b|\bfrom\b)|[.,!?;:]|$)/i,
      /(?:name\s*:\s*)([A-Za-z\s.'-]+?)(?:\s+(?:\band\b|\bcollege\b)|[.,!?;:]|$)/i,
    ];

    const invalidNameTokens = [
      'happy', 'fine', 'good', 'sad', 'trying', 'here', 'ready', 'asking', 
      'an ai', 'a bot', 'confused', 'curious', 'student', 'engineer', 'developer', 
      'boy', 'girl', 'human', 'doing', 'learning', 'studying', 'working', 'going',
      'thinking', 'wondering', 'not sure', 'online', 'busy', 'free', 'ok', 'okay'
    ];

    for (const pattern of namePatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        let candidate = match[1].trim().replace(/^[,\s.-]+|[.,!?;:\s-]+$/g, '');
        const candLower = candidate.toLowerCase();

        // Validate candidate name
        if (
          candidate.length >= 2 &&
          candidate.length <= 45 &&
          !invalidNameTokens.includes(candLower) &&
          !candLower.startsWith('a ') &&
          !candLower.startsWith('an ') &&
          !candLower.startsWith('the ') &&
          !candLower.startsWith('very ') &&
          !candLower.startsWith('just ')
        ) {
          const formattedName = candidate
            .split(/\s+/)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');

          facts.push({
            key: 'USER_PROFILE_NAME',
            label: 'Name',
            value: formattedName,
            content: `User Name: ${formattedName}`,
            type: 'PROFILE',
            tags: ['profile', 'name', 'identity'],
          });
          break;
        }
      }
    }

    // 2. College / Education Extraction
    const collegePatterns = [
      /(?:i study at|i am studying at|i am a student at|i am studying in|my college is|my university is|my school is|i'm studying at)\s+([A-Za-z0-9\s.,'&-]+?)(?:\s+(?:\band\b|\bi live\b|\bmy branch\b|\bmy major\b)|[.,!?;:]|$)/i,
    ];

    for (const pattern of collegePatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        let candidate = match[1].trim().replace(/^[,\s.-]+|[.,!?;:\s-]+$/g, '');
        if (candidate.length >= 3 && candidate.length <= 80) {
          facts.push({
            key: 'USER_PROFILE_COLLEGE',
            label: 'College/University',
            value: candidate,
            content: `User College / Education: ${candidate}`,
            type: 'PROFILE',
            tags: ['profile', 'college', 'education'],
          });
          break;
        }
      }
    }

    // 3. Location Extraction
    const locationPatterns = [
      /(?:i live in|i stay in|i am from|my hometown is|i reside in|i am based in)\s+([A-Za-z\s.'-]+?)(?:\s+(?:\band\b|\bi study\b|\bi work\b)|[.,!?;:]|$)/i,
    ];

    for (const pattern of locationPatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        let candidate = match[1].trim().replace(/^[,\s.-]+|[.,!?;:\s-]+$/g, '');
        if (candidate.length >= 3 && candidate.length <= 60) {
          facts.push({
            key: 'USER_PROFILE_LOCATION',
            label: 'Location',
            value: candidate,
            content: `User Location / Hometown: ${candidate}`,
            type: 'PROFILE',
            tags: ['profile', 'location', 'hometown'],
          });
          break;
        }
      }
    }

    // 4. Profession / Work Extraction
    const jobPatterns = [
      /(?:i work as|i am working as|i work at|my job is|my profession is)\s+([A-Za-z0-9\s.,'&-]+?)(?:\s+(?:\band\b|\bi live\b)|[.,!?;:]|$)/i,
    ];

    for (const pattern of jobPatterns) {
      const match = clean.match(pattern);
      if (match && match[1]) {
        let candidate = match[1].trim().replace(/^[,\s.-]+|[.,!?;:\s-]+$/g, '');
        if (candidate.length >= 3 && candidate.length <= 60) {
          facts.push({
            key: 'USER_PROFILE_PROFESSION',
            label: 'Profession',
            value: candidate,
            content: `User Profession: ${candidate}`,
            type: 'PROFILE',
            tags: ['profile', 'profession', 'job'],
          });
          break;
        }
      }
    }

    return facts;
  }
}

const profileExtractor = new ProfileExtractor();

module.exports = {
  ProfileExtractor,
  profileExtractor,
};
