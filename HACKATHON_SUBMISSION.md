# Focus the Unfocus

## Inspiration

Many of us struggle with getting distracted in the browser—Instagram, social media, and other time-wasting sites constantly pull our attention away from important work. At the same time, we want to learn more and keep our brains engaged. I could never find the perfect solution that combined productivity with learning, so I decided to build it myself.

## What it does

Focus the Unfocus is a Chrome extension that gamifies focus and learning. When you visit a distracting website, it blocks it and redirects you to a focused learning environment. Here's how it works:

- **12-minute focus sessions**: Stay focused for 12 minutes reading articles, solving brain teasers, or drawing
- **5-minute break reward**: Complete a focus session to earn 5 minutes of access to blocked sites—just enough time to check messages, then get back to work
- **Rich content library**: Automatically scrapes and curates articles from diverse sources including science, technology, space exploration, and more
- **Interactive features**: 
  - Brain teasers (both AI-generated and built-in) to keep your mind sharp
  - A calming drawing board for creative breaks
  - A persistent to-do list to track your tasks

The beauty of this approach is that by the time your break unlocks, you're often already engaged in learning something new and naturally return to focused work.

## How we built it

- **Tech Stack**: HTML, CSS, JavaScript
- **Chrome Extension APIs**: 
  - Chrome Storage API for persistence
  - Chrome Declarative Net Request for website blocking
  - Chrome Built-in AI APIs (Summarizer, Language Model) for intelligent features
- **Development Process**: Lots of problem-solving, iterative coding, and leveraging Chrome's powerful built-in capabilities

## Challenges we ran into

Working with Chrome's built-in AI APIs presented exciting challenges:
- **Summarizer API**: Figuring out the proper configuration and handling edge cases like placeholder text in AI-generated summaries
- **Language Model API**: Implementing structured output for brain teasers with JSON schemas and handling availability states
- **API Integration**: Managing async operations, caching strategies, and fallback mechanisms when AI features aren't available
- **State Management**: Ensuring smooth user experience with persistent timers, to-do lists, and article caching across browser sessions

## Accomplishments that we're proud of

I'm proud that I've been using this extension myself for weeks, and it genuinely works. It fulfills the vision I started with—transforming distractions into learning opportunities. The gamification element actually motivates me to stay focused, and the diverse content keeps the experience fresh and engaging every time.

What's truly remarkable is that within minutes of using the extension, I naturally find myself returning to my work. I've never actually reached the end of the timer because the content is so engaging that it successfully redirects my attention and gets me back into a productive mindset. This validates the core design principle: by the time you're immersed in learning something interesting, you're already refocused and ready to work.

Some technical achievements:
- Seamless integration of multiple Chrome APIs
- Intelligent article deduplication to prevent repetition
- Real-time AI-powered features that work offline when possible
- A modular, maintainable codebase that's easy to extend

## What we learned

This project taught me:
- **Chrome Built-in AI APIs**: How to effectively use Chrome's on-device AI capabilities (Summarizer, Language Model) for real-world applications
- **Caching Strategies**: Implementing smart caching for articles and AI-generated content to improve performance and reduce API calls
- **Robust Error Handling**: Building fallback mechanisms and graceful degradation when APIs are unavailable
- **Extension Architecture**: Designing scalable Chrome extensions with proper separation of concerns and modular code structure

## What's next for Focus the Unfocus

There's so much potential for improvement! Ideas for future enhancements:

- **Language Translation**: Integrate Chrome's Language Translator API to translate article summaries, making quality content accessible in multiple languages
- **Custom Focus Times**: Allow users to customize focus session and break durations
- **Analytics Dashboard**: Track focus streaks, articles read, and productivity metrics
- **More Content Sources**: Expand the article library with more niche topics and personalized recommendations
- **Social Features**: Share achievements and compete with friends (optional)
- **Mobile Support**: Extend the concept to mobile browsers

The foundation is solid, and I'm excited to see how this can evolve to help even more people transform their distractions into opportunities for growth.
