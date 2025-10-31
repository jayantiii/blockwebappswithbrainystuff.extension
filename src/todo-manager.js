// Todo list management module
class TodoManager {
  constructor() {
    this.todos = [];
  }

  $(id) { return document.getElementById(id); }
  on(el, evt, fn, opts) { if (el) el.addEventListener(evt, fn, opts); }

  escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async loadTodos() {
    try {
      const { todoList } = await chrome.storage.local.get('todoList');
      this.todos = todoList || [];
    } catch (_) {
      this.todos = [];
    }
  }

  async saveTodos() {
    await chrome.storage.local.set({ todoList: this.todos });
  }

  wireTodoUi(onNotification) {
    const input = this.$('todoInput');
    const addBtn = this.$('todoAddBtn');
    if (!input || !addBtn) return;

    const addHandler = async () => {
      const text = (input.value || '').trim();
      if (!text) {
        if (onNotification) onNotification('Task cannot be empty!');
        return;
      }
      this.addTodo(text);
      input.value = '';
      await this.saveTodos();
      this.renderTodos();
      if (onNotification) onNotification('Task added!');
    };

    this.on(addBtn, 'click', (e) => {
      e.preventDefault();
      addHandler();
    });

    this.on(input, 'keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addHandler();
      }
    });
  }

  addTodo(text) {
    this.todos.push({ text: text.trim(), completed: false, addedDate: Date.now() });
  }

  deleteTodo(index) {
    this.todos.splice(index, 1);
  }

  toggleTodoComplete(index) {
    if (this.todos[index]) {
      this.todos[index].completed = !this.todos[index].completed;
      this.saveTodos();
      this.renderTodos();
    }
  }

  renderTodos() {
    const list = this.$('todoList');
    if (!list) return;

    list.innerHTML = '';
    this.todos.forEach((todo, index) => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      li.innerHTML = `
        <input type="checkbox" id="todo-${index}" ${todo.completed ? 'checked' : ''} aria-label="Mark task as complete">
        <label for="todo-${index}">${this.escapeHtml(todo.text)}</label>
        <button class="delete-btn" data-index="${index}" aria-label="Delete task">✕</button>
      `;
      list.appendChild(li);
    });

    this.wireTodoItemListeners();
  }

  wireTodoItemListeners() {
    const list = this.$('todoList');
    if (!list) return;

    list.querySelectorAll('.delete-btn').forEach(button => {
      button.onclick = (e) => {
        const index = parseInt(e.target.dataset.index);
        this.deleteTodo(index);
        this.saveTodos();
        this.renderTodos();
      };
    });

    list.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.onchange = (e) => {
        const index = parseInt(e.target.id.replace('todo-', ''));
        this.toggleTodoComplete(index);
      };
    });
  }

  async cleanupCompletedTodosIfNeeded() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const { lastTodoCleanupDate } = await chrome.storage.local.get('lastTodoCleanupDate');

    if (!lastTodoCleanupDate || lastTodoCleanupDate < todayStart) {
      this.todos = this.todos.filter(todo => !todo.completed);
      await this.saveTodos();
      await chrome.storage.local.set({ lastTodoCleanupDate: now.getTime() });
      this.renderTodos();
    }
  }

  alignTodoDock() {
    const todoCard = this.$('todoCard');
    const timerInfo = document.querySelector('.timer-info');
    if (todoCard && timerInfo) {
      const timerRect = timerInfo.getBoundingClientRect();
      todoCard.style.position = 'absolute';
      todoCard.style.left = `${timerRect.left - todoCard.offsetWidth - 20}px`;
      todoCard.style.top = `${timerRect.top}px`;
    }
  }

  getTodos() {
    return this.todos;
  }
}
