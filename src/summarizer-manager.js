// Summarizer API management module
class SummarizerManager {
  constructor() {
    this._summarizer = null;
    this._summarizerInflight = null;
  }

  async getSummarizer() {
    try {
      const S = window.ai?.summarizer ?? globalThis.Summarizer;
      if (!S) {
        return { summarizer: null, status: 'unavailable' };
      }

      // Check availability
      let availability = typeof S.availability === 'function' ? await S.availability() : null;
      if (!availability && typeof S.capabilities === 'function') {
        const caps = await S.capabilities();
        availability = caps?.available === 'readily'
          ? 'available'
          : caps?.available === 'after-download'
          ? 'downloadable'
          : 'unavailable';
      }
      
      if (availability === 'unavailable' || availability === 'downloading') {
        return { summarizer: null, status: 'unavailable' };
      }
      
      if (availability === 'downloadable') {
        return { summarizer: null, status: 'needs-download' };
      }

      // Always create fresh instance with outputLanguage
      this._summarizer = null;
      this._summarizerInflight = null;
      
      const summarizer = await Promise.race([
        S.create({ outputLanguage: 'en' }),
        new Promise((_, r) => setTimeout(() => r(new Error('create-timeout')), 15000))
      ]);

      this._summarizer = summarizer;

      return { summarizer: this._summarizer, status: 'ready' };
    } catch (err) {
      this._summarizerInflight = null;
      
      if (err?.message?.includes('download') || err?.message?.includes('Download')) {
        return { summarizer: null, status: 'needs-download' };
      }
      
      return { summarizer: null, status: 'error' };
    }
  }

  async updateSummarizeControls(onNotification) {
    const summarizeBtn = document.getElementById('summarizeBtn');
    if (!summarizeBtn) return;
    
    summarizeBtn.style.display = 'inline-block';
    summarizeBtn.disabled = false;
    summarizeBtn.style.opacity = '';
    
    try {
      const S = window.ai?.summarizer ?? globalThis.Summarizer;
      
      if (!S) {
        summarizeBtn.title = 'Summarizer API not detected - will attempt on click';
        return;
      }
      
      let availability = typeof S.availability === 'function' ? await S.availability() : null;
      if (!availability && typeof S.capabilities === 'function') {
        const caps = await S.capabilities();
        availability = caps?.available === 'readily'
          ? 'available'
          : caps?.available === 'after-download'
          ? 'downloadable'
          : 'unavailable';
      }
      
      if (availability === 'unavailable' || availability === 'downloading') {
        summarizeBtn.title = 'Summarizer not available';
        summarizeBtn.disabled = false;
        return;
      }
      
      if (availability === 'downloadable') {
        summarizeBtn.title = 'Click to download summarizer model (requires user gesture)';
        return;
      }
      
      summarizeBtn.title = 'Generate AI summary of this article';
    } catch (err) {
      summarizeBtn.title = 'Click to try summarization';
    }
  }

  async summarize(text, result, markdownToHtml, onNotification) {
    try {
      let summary;
      // Always pass outputLanguage in options
      try {
        summary = await result.summarizer.summarize(text, { outputLanguage: 'en' });
      } catch (e1) {
        summary = await result.summarizer.summarize(text);
      }
      
      // If we got a summary and want longer, try requesting it with length option
      if (summary && summary.length < 200) {
        try {
          const longerSummary = await result.summarizer.summarize(text, { 
            outputLanguage: 'en',
            length: 'long'
          });
          if (longerSummary && longerSummary.length > summary.length) {
            summary = longerSummary;
          }
        } catch (e) {
          // Ignore - use the summary we already have
        }
      }
      
      // If summary is too short or contains placeholder text, enhance it using languageModel
      const hasPlaceholders = summary && /\[.*?\]|insert|placeholder|briefly describe|replace.*with/i.test(summary);
      
      if ((summary && summary.length < 200) || hasPlaceholders) {
        try {
          const LM = window.ai?.languageModel ?? globalThis.LanguageModel;
          if (LM) {
            const availability = typeof LM.availability === 'function' ? await LM.availability() : null;
            if (availability && availability !== 'unavailable') {
              const params = typeof LM.params === 'function' ? await LM.params() : null;
              const session = await LM.create({
                temperature: 0.3,
                topK: Math.min(8, params?.maxTopK ?? 8),
                outputLanguage: 'en'
              });
              
              const articlePreview = text.slice(0, 1000);
              const enhancePrompt = `Based ONLY on the following article content, create a detailed summary (200-400 words). 
              
IMPORTANT: 
- Use ONLY information from the article below
- Do NOT use placeholders like [Insert...], [Briefly describe...], or any bracketed instructions
- Do NOT invent or add information not present in the article
- Focus on the main points, key facts, and important details from the actual article

Article:
${articlePreview}

${summary && summary.length > 50 ? `\nCurrent summary (may contain errors - correct based on article):\n${summary}` : ''}

Write a clear, detailed summary based on the article content above:`;

              const enhanced = await session.prompt(enhancePrompt, { outputLanguage: 'en' });
              session.destroy?.();
              
              if (enhanced && !/\[.*?\]|insert.*here|briefly describe|replace.*with/i.test(enhanced)) {
                if (enhanced.length > summary.length || hasPlaceholders) {
                  summary = enhanced;
                }
              }
            }
          }
        } catch (e3) {
          // Ignore
        }
      }
      
      // Final validation: if summary still has placeholders, try one more time
      if (summary && /\[.*?\]|insert.*here|briefly describe/i.test(summary)) {
        try {
          const LM = window.ai?.languageModel ?? globalThis.LanguageModel;
          if (LM) {
            const availability = typeof LM.availability === 'function' ? await LM.availability() : null;
            if (availability && availability !== 'unavailable') {
              const params = typeof LM.params === 'function' ? await LM.params() : null;
              const session = await LM.create({
                temperature: 0.3,
                topK: Math.min(8, params?.maxTopK ?? 8),
                outputLanguage: 'en'
              });
              
              const articleText = text.slice(0, 2000);
              const regenPrompt = `Summarize the following article in 200-400 words. Use ONLY facts from the article. No placeholders, no [Insert...] text, no instructions.

Article:
${articleText}

Summary:`;
              
              const regen = await session.prompt(regenPrompt, { outputLanguage: 'en' });
              session.destroy?.();
              
              if (regen && !/\[.*?\]|insert|placeholder|briefly describe/i.test(regen)) {
                summary = regen;
              }
            }
          }
        } catch (e4) {
          // Ignore
        }
      }
      
      return markdownToHtml(summary);
    } catch (e) {
      console.error('Summarization error:', e);
      if (onNotification) {
        onNotification('Summarization failed');
      }
      throw e;
    }
  }

  async preloadSummarizer() {
    try {
      const result = await this.getSummarizer();
      return result.status === 'ready';
    } catch (e) {
      return false;
    }
  }
}
