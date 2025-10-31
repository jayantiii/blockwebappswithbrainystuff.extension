// Subtitle quote rotator module
class SubtitleRotator {
  constructor() {
    this.quoteInterval = null;
  }

  $(id) { return document.getElementById(id); }

  async start() {
    const subtitleText = this.$('subtitleText');
    if (!subtitleText) return;

    const quotes = [
      "Stay focused, learn something amazing!",
      "The mind is everything. What you think you become. – Buddha",
      "The best way to predict the future is to create it. – Peter Drucker",
      "Innovation distinguishes between a leader and a follower. – Steve Jobs",
      "The only way to do great work is to love what you do. – Steve Jobs",
      "Believe you can and you're halfway there. – Theodore Roosevelt",
      "The future belongs to those who believe in the beauty of their dreams. – Eleanor Roosevelt",
      "It is during our darkest moments that we must focus to see the light. – Aristotle Onassis",
      "Concentration is the root of all the higher abilities in man. – Bruce Lee",
      "The successful warrior is the average man, with laser-like focus. – Bruce Lee",
      "Your life is controlled by what you focus on. – Tony Robbins",
      "Focus on the journey, not the destination. Joy is found not in finishing an activity but in doing it. – Greg Anderson"
    ];

    let currentQuoteIndex = 0;
    const rotateQuote = () => {
      subtitleText.textContent = quotes[currentQuoteIndex];
      currentQuoteIndex = (currentQuoteIndex + 1) % quotes.length;
    };

    rotateQuote();
    this.quoteInterval = setInterval(rotateQuote, 10000);
  }

  stop() {
    if (this.quoteInterval) {
      clearInterval(this.quoteInterval);
      this.quoteInterval = null;
    }
  }
}
