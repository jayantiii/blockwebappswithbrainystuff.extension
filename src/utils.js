// Lightweight DOM and timing utilities exposed globally
(function () {
  function $(id) { return document.getElementById(id); }
  function on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
  function debounce(fn, wait = 250, ctx) {
    let t;
    return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(ctx || this, args), wait); };
  }

  window.AppUtils = { $, on, debounce };
})();


