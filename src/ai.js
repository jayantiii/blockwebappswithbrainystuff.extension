// Chrome Prompt API integration for on-device AI brain teasers
// Exposes: window.generateAiTeaser() to be called from a user gesture
(function () {
  window.generateAiTeaser = async function () {
    const OUTPUT_LANG = 'en'; // specify output language explicitly
    const LM = window.ai?.languageModel ?? globalThis.LanguageModel;
    if (!LM) return null;

    let availability = typeof LM.availability === 'function' ? await LM.availability() : null;
    if (!availability && typeof LM.capabilities === 'function') {
      const caps = await LM.capabilities();
      availability = caps?.available === 'readily'
        ? 'available'
        : caps?.available === 'after-download'
        ? 'downloadable'
        : 'unavailable';
    }
    if (availability === 'unavailable' || availability === 'downloading') return null;

    const params = typeof LM.params === 'function' ? await LM.params() : null;
    const session = await LM.create({
      temperature: 0.7,
      topK: Math.min(8, params?.maxTopK ?? 8),
      outputLanguage: OUTPUT_LANG
    });

    try {
      const schema = {
        type: "object",
        properties: {
          type: { enum: ["riddle", "scramble", "sequence"] },
          title: { type: "string", maxLength: 40 },
          question: { type: "string", maxLength: 120 },
          answer: { type: "string", maxLength: 80 }
        },
        required: ["type", "title", "question", "answer"],
        additionalProperties: false
      };

      const system = "Create ONE concise brain teaser. The question must be under ~25 words. Return ONLY the JSON object. Output language code: en.";

      let raw;
      try {
        raw = await session.prompt(system, { responseConstraint: schema, outputLanguage: OUTPUT_LANG });
      } catch {
        raw = await session.prompt(
          'Return ONLY JSON with fields {"type":"riddle|scramble|sequence","title":"...","question":"...","answer":"..."}; question <25 words. Output language code: en.',
          { outputLanguage: OUTPUT_LANG }
        );
      }

      const data = parseFirstJson(raw);
      if (!data?.question || !data?.answer) return null;
      if (!["riddle","scramble","sequence"].includes(data.type)) data.type = "riddle";
      return data;
    } catch {
      return null;
    } finally {
      session.destroy?.();
    }

    function parseFirstJson(s) {
      if (!s) return null;
      let t = String(s).trim();
      if (t.startsWith('```')) t = t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
      const i = t.indexOf('{'), j = t.lastIndexOf('}');
      if (i < 0 || j <= i) return null;
      try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
    }
  };

  // Batched variant: returns up to `count` teasers in one call
  window.generateAiTeasers = async function (count = 5) {
    const LM = window.ai?.languageModel ?? globalThis.LanguageModel;
    if (!LM) return [];

    let availability = typeof LM.availability === 'function' ? await LM.availability() : null;
    if (!availability && typeof LM.capabilities === 'function') {
      const caps = await LM.capabilities();
      availability = caps?.available === 'readily'
        ? 'available'
        : caps?.available === 'after-download'
        ? 'downloadable'
        : 'unavailable';
    }
    if (availability === 'unavailable' || availability === 'downloading') return [];

    const params = typeof LM.params === 'function' ? await LM.params() : null;
    const session = await LM.create({
      temperature: 0.7,
      topK: Math.min(8, params?.maxTopK ?? 8),
      outputLanguage: 'en'
    });

    try {
      const schema = {
        type: "array",
        minItems: 1,
        maxItems: Math.max(1, Math.min(10, Number(count) || 5)),
        items: {
          type: "object",
          properties: {
            type: { enum: ["riddle", "scramble", "sequence"] },
            title: { type: "string", maxLength: 40 },
            question: { type: "string", maxLength: 120 },
            answer: { type: "string", maxLength: 80 }
          },
          required: ["type", "title", "question", "answer"],
          additionalProperties: false
        }
      };

      const system = `Create ${count} concise brain teasers. Each question <25 words. Return ONLY a JSON array of objects matching the schema.`;

      let raw;
      try {
        raw = await session.prompt(system, { responseConstraint: schema, outputLanguage: 'en' });
      } catch {
        raw = await session.prompt(
          `Return ONLY a JSON array of ${count} items with fields {"type":"riddle|scramble|sequence","title":"...","question":"...","answer":"..."}; question <25 words. Output language code: en.`,
          { outputLanguage: 'en' }
        );
      }

      const list = parseFirstJsonArray(raw) || [];
      return list.filter(v => v && v.question && v.answer).map(v => ({
        type: ["riddle","scramble","sequence"].includes(v.type) ? v.type : 'riddle',
        title: String(v.title || 'Brain Teaser').slice(0, 40),
        question: String(v.question || '').slice(0, 300),
        answer: String(v.answer || '').slice(0, 200)
      }));
    } catch {
      return [];
    } finally {
      session.destroy?.();
    }

    function parseFirstJsonArray(s) {
      if (!s) return null;
      let t = String(s).trim();
      if (t.startsWith('```')) t = t.replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
      const i = t.indexOf('['), j = t.lastIndexOf(']');
      if (i < 0 || j <= i) return null;
      try { return JSON.parse(t.slice(i, j + 1)); } catch { return null; }
    }
  };
})();


