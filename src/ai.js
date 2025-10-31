// Chrome Prompt API integration for on-device AI brain teasers
// Exposes: window.generateAiTeasers() to be called from a user gesture
(function () {
  // --- helpers for normalization and similarity ---
  function normalizeQuestion(text) {
    if (!text) return '';
    return String(text)
      .toLowerCase()
      .replace(/[`~!@#$%^&*()_+\-={}\[\]\\|;:'",.<>/?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  function jaccardSimilarity(a, b) {
    const as = new Set(a.split(' ').filter(Boolean));
    const bs = new Set(b.split(' ').filter(Boolean));
    let inter = 0;
    for (const w of as) if (bs.has(w)) inter++;
    const union = as.size + bs.size - inter || 1;
    return inter / union;
  }

  // Batched variant: returns up to `count` teasers in one call
  window.generateAiTeasers = async function (count = 10, avoidList = []) {
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
        maxItems: Math.max(1, Math.min(10, Number(count) || 10)),
        items: {
          type: "object",
          properties: {
            type: { enum: ["riddle", "scramble", "sequence", "pattern", "logic", "lateral", "wordplay", "analogy", "math"] },
            title: { type: "string", maxLength: 40 },
            question: { type: "string", maxLength: 120 },
            answer: { type: "string", maxLength: 80 }
          },
          required: ["type", "title", "question", "answer"],
          additionalProperties: false
        }
      };

      const avoidText = Array.isArray(avoidList) && avoidList.length
        ? `Avoid creating items that are similar to any of these phrases: ${avoidList.slice(-10).map(s => JSON.stringify(String(s).slice(0,60))).join(', ')}`
        : '';
      const system = `Create ${count} concise brain teasers with varied types (riddle, wordplay, sequence, pattern, logic, lateral, analogy, math). Each question <100 words. ${avoidText} Return ONLY a JSON array of objects matching the schema.`;

      let raw;
      try {
        raw = await session.prompt(system, { responseConstraint: schema, outputLanguage: 'en' });
      } catch {
        raw = await session.prompt(
          `Return ONLY a JSON array of ${count} items with fields {"type":"riddle|scramble|sequence|pattern|logic|lateral|wordplay|analogy|math","title":"...","question":"...","answer":"..."}; question <25 words. ${avoidText} Output language code: en.`,
          { outputLanguage: 'en' }
        );
      }

      const list = parseFirstJsonArray(raw) || [];
      const avoidNorm = Array.isArray(avoidList) ? avoidList.map(normalizeQuestion) : [];

      // Normalize, enforce schema defaults, drop empties
      const cleaned = [];
      for (const v of list) {
        if (!v || !v.question || !v.answer) continue;
        const type = ["riddle","scramble","sequence","pattern","logic","lateral","wordplay","analogy","math"].includes(v.type)
          ? v.type : 'riddle';
        const title = String(v.title || 'Brain Teaser').slice(0, 40);
        const question = String(v.question || '').slice(0, 300);
        const answer = String(v.answer || '').slice(0, 200);
        const qn = normalizeQuestion(question);
        if (!qn) continue;
        // skip if too similar to any avoid
        if (avoidNorm.some(an => jaccardSimilarity(qn, an) >= 0.75)) continue;
        cleaned.push({ type, title, question, answer, _qn: qn });
      }

      // In-batch similarity filter to keep diverse items
      const unique = [];
      for (const item of cleaned) {
        const tooSimilar = unique.some(u => jaccardSimilarity(item._qn, u._qn) >= 0.75);
        if (!tooSimilar) unique.push(item);
      }

      // Type quotas: try to distribute across categories
      const quotas = { riddle:2, wordplay:2, sequence:2, pattern:2, logic:2, lateral:1, analogy:1, math:2 };
      const perType = new Map();
      for (const it of unique) {
        if (!perType.has(it.type)) perType.set(it.type, []);
        perType.get(it.type).push(it);
      }
      const out = [];
      // First pass: fill quotas
      for (const [t, q] of Object.entries(quotas)) {
        const arr = perType.get(t) || [];
        for (let i = 0; i < q && out.length < count && i < arr.length; i++) out.push(arr[i]);
      }
      // Second pass: top up if needed with any remaining diverse items
      if (out.length < count) {
        for (const it of unique) {
          if (out.length >= count) break;
          if (!out.some(u => jaccardSimilarity(u._qn, it._qn) >= 0.75)) out.push(it);
        }
      }

      // Strip helpers
      return out.map(({ type, title, question, answer }) => ({ type, title, question, answer }));
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


