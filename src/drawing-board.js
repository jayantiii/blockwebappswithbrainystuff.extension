// Drawing board (calm board) module
class DrawingBoard {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    this.drawColor = '#4c6ef5';
    this.drawSize = 6;
    this.drawMode = 'pen';
  }

  $(id) { return document.getElementById(id); }
  on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }
  debounce(fn, wait = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), wait); };
  }

  init(onNotification) {
    const calmBtn = this.$('calmBtn');
    const calmCard = this.$('calmCard');
    const articleCard = this.$('articleCard');
    const teaserCard = this.$('teaserCard');
    const canvas = this.$('calmCanvas');
    const penBtn = this.$('calmPenBtn');
    const eraserBtn = this.$('calmEraserBtn');
    const colorInput = this.$('calmColor');
    const sizeInput = this.$('calmSize');
    const clearBtn = this.$('calmClearBtn');
    const statusEl = this.$('calmStatus');
    const swatches = document.querySelectorAll('.calm-swatch');

    if (!calmBtn || !calmCard || !canvas) return;

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });

    const hideAllContent = () => {
      if (articleCard) articleCard.style.display = 'none';
      if (teaserCard) teaserCard.style.display = 'none';
      calmCard.style.display = 'block';
    };

    const hideBoard = () => { if (calmCard.style.display === 'block') calmCard.style.display = 'none'; };
    this.on(this.$('newArticleBtn'), 'click', hideBoard);
    this.on(this.$('shuffleBtn'), 'click', hideBoard);

    calmBtn.onclick = () => {
      if (calmCard.style.display === 'block') {
        calmCard.style.display = 'none';
        if (window.articleDisplay && window.articleDisplay.isTeaserMode) {
          if (teaserCard) teaserCard.style.display = 'block';
        } else {
          if (articleCard) articleCard.style.display = 'block';
        }
      } else {
        hideAllContent();
        this.restore();
      }
    };

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const img = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
      canvas.width = Math.max(300, Math.floor(rect.width));
      canvas.height = Math.max(180, Math.floor(rect.height));
      try { this.ctx.putImageData(img, 0, 0); } catch (_) {}
    };

    const saveImmediate = async () => {
      try {
        const data = canvas.toDataURL('image/png');
        await chrome.storage.local.set({ calmPad: data });
        if (statusEl) statusEl.textContent = 'Saved ✨';
        setTimeout(() => { if (statusEl) statusEl.textContent = 'Relax and draw ✨'; }, 1000);
      } catch (_) {}
    };
    const save = this.debounce(saveImmediate, 300);

    const restore = async () => {
      try {
        const { calmPad } = await chrome.storage.local.get('calmPad');
        if (calmPad) {
          const img = new Image();
          img.onload = () => { this.ctx.drawImage(img, 0, 0, canvas.width, canvas.height); };
          img.src = calmPad;
        }
      } catch (_) {}
    };
    this.restore = restore;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX || e.touches[0].clientX) - rect.left,
        y: (e.clientY || e.touches[0].clientY) - rect.top
      };
    };

    const startDrawing = (e) => {
      this.isDrawing = true;
      const { x, y } = getPos(e);
      this.lastX = x;
      this.lastY = y;
      this.ctx.beginPath();
      this.ctx.moveTo(this.lastX, this.lastY);
    };

    const draw = (e) => {
      if (!this.isDrawing) return;
      const { x, y } = getPos(e);

      this.ctx.lineTo(x, y);
      this.ctx.strokeStyle = this.drawMode === 'pen' ? this.drawColor : '#ffffff';
      this.ctx.lineWidth = this.drawSize;
      this.ctx.lineCap = 'round';
      this.ctx.lineJoin = 'round';
      this.ctx.stroke();

      this.lastX = x;
      this.lastY = y;
      save();
    };

    const stopDrawing = () => {
      this.isDrawing = false;
      this.ctx.closePath();
      saveImmediate();
    };

    this.on(canvas, 'mousedown', startDrawing);
    this.on(canvas, 'mousemove', draw);
    this.on(canvas, 'mouseup', stopDrawing);
    this.on(canvas, 'mouseout', stopDrawing);
    this.on(canvas, 'touchstart', startDrawing);
    this.on(canvas, 'touchmove', draw);
    this.on(canvas, 'touchend', stopDrawing);
    this.on(canvas, 'touchcancel', stopDrawing);

    if (penBtn) penBtn.onclick = () => { this.drawMode = 'pen'; penBtn.classList.add('active'); eraserBtn.classList.remove('active'); };
    if (eraserBtn) eraserBtn.onclick = () => { this.drawMode = 'eraser'; eraserBtn.classList.add('active'); penBtn.classList.remove('active'); };
    if (colorInput) colorInput.onchange = (e) => { this.drawColor = e.target.value; };
    if (sizeInput) sizeInput.onchange = (e) => { this.drawSize = parseInt(e.target.value); };
    if (clearBtn) clearBtn.onclick = () => {
      this.ctx.clearRect(0, 0, canvas.width, canvas.height);
      saveImmediate();
      if (onNotification) onNotification('Board cleared!');
    };
    swatches.forEach(swatch => {
      this.on(swatch, 'click', (e) => {
        this.drawColor = e.target.dataset.color;
        if (colorInput) colorInput.value = this.drawColor;
        this.drawMode = 'pen';
        if (penBtn) penBtn.classList.add('active');
        if (eraserBtn) eraserBtn.classList.remove('active');
      });
    });

    new ResizeObserver(() => resize()).observe(canvas.parentElement);
    window.addEventListener('resize', resize);
  }
}
