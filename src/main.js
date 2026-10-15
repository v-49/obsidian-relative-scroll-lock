"use strict";

const { Plugin, Notice, setIcon, getLanguage } = require("obsidian");

const messages = {
  zh: {
    toggle: "锁紧 / 松开", unlock: "松开", control: "滚动锁：锁紧 / 松开",
    ready: "滚动锁已就绪：分别定位左右两栏，再点底部「滚动锁：松开」锁紧。",
    layout: "请在主区域保留左右两栏笔记，再点滚动锁。支持同一笔记、阅读和编辑模式。",
    closed: "视图已关闭，滚动锁已松开。",
    lockedNotice: "已锁紧：两栏从当前位置一起滚动。按住 Alt 可单独调整。",
    unlockedNotice: "已松开：分别调整左右位置，再点一次锁紧。",
    changed: "笔记、布局或显示模式已切换，滚动锁已松开；定位后可重新锁紧。",
    temporary: "滚动锁：临时松开", locked: "滚动锁：锁紧", unlocked: "滚动锁：松开",
    lockedTitle: "点击松开，分别调整位置；按住 Alt 可临时单独滚动",
    unlockedTitle: "先分别定位左右两栏，点击从当前位置锁紧同步",
  },
  en: {
    toggle: "Lock / unlock", unlock: "Unlock", control: "Scroll lock: lock / unlock",
    ready: "Scroll lock is ready. Position both panes, then click “Scroll lock: unlocked” in the status bar.",
    layout: "Open exactly two Markdown panes side by side in the main workspace. The same note and reading/editing modes are supported.",
    closed: "A pane was closed. Scroll lock is now unlocked.",
    lockedNotice: "Locked at the current positions. Hold Alt to scroll one pane independently.",
    unlockedNotice: "Unlocked. Adjust either pane, then click again to lock.",
    changed: "The note, layout, or view mode changed. Reposition the panes and lock again.",
    temporary: "Scroll lock: temporarily unlocked", locked: "Scroll lock: locked", unlocked: "Scroll lock: unlocked",
    lockedTitle: "Click to unlock; hold Alt while scrolling to adjust one pane independently",
    unlockedTitle: "Position both panes first, then click to lock without jumping",
  },
};

// Each scroll container retains its own position. No file offsets or note
// contents are read, written, or shared between the two views.
class RelativeScrollSession {
  constructor(panes, onState = () => {}, onInvalid = () => {}) {
    this.panes = panes;
    this.onState = onState;
    this.onInvalid = onInvalid;
    this.positions = panes.map((pane) => pane.scrollTop);
    this.disposers = [];
    this.alt = false;
    this.independent = panes.map(() => ({ until: 0, enabled: false }));
    this.disposed = false;
    this.propagating = false;
    panes.forEach((pane, index) => {
      this.listen(pane, "scroll", () => this.scroll(index), { passive: true });
      this.listen(pane, "wheel", (event) => {
        this.independent[index] = { enabled: event.altKey, until: Date.now() + 220 };
        this.setAlt(event.altKey);
      }, { passive: true, capture: true });
    });
    const windows = new Set(panes.map((pane) => pane.ownerDocument.defaultView));
    for (const win of windows) {
      this.listen(win, "keydown", (event) => this.setAlt(event.altKey), true);
      this.listen(win, "keyup", (event) => this.setAlt(event.altKey), true);
      this.listen(win, "blur", () => {
        this.setAlt(false);
        this.independent.forEach((state) => { state.enabled = false; });
      });
    }
  }

  listen(target, name, fn, options) {
    target.addEventListener(name, fn, options);
    this.disposers.push(() => target.removeEventListener(name, fn, options));
  }

  setAlt(value) {
    if (this.alt !== value) {
      this.alt = value;
      this.onState(value);
    }
  }

  scroll(index) {
    if (this.disposed) return;
    if (this.panes.some((pane) => !pane.isConnected)) {
      this.onInvalid();
      return;
    }
    const source = this.panes[index];
    const delta = source.scrollTop - this.positions[index];
    this.positions[index] = source.scrollTop;
    const gesture = this.independent[index];
    const independent = this.alt || (gesture.enabled && Date.now() < gesture.until);
    if (this.propagating || independent || Math.abs(delta) < 0.01) return;
    const targetIndex = 1 - index;
    const target = this.panes[targetIndex];
    const max = Math.max(0, target.scrollHeight - target.clientHeight);
    this.propagating = true;
    try {
      target.scrollTop = Math.min(max, Math.max(0, target.scrollTop + delta));
      // Update before the asynchronously dispatched scroll event. Its echo
      // then has zero delta, preventing recursion and bounce at boundaries.
      this.positions[targetIndex] = target.scrollTop;
    } finally {
      this.propagating = false;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const dispose of this.disposers.splice(0)) dispose();
  }
}

module.exports = class ScrollLockPlugin extends Plugin {
  onload() {
    const language = typeof getLanguage === "function" ? getLanguage() : "en";
    this.text = messages[String(language).startsWith("zh") ? "zh" : "en"];
    this.session = null;
    this.binding = null;
    this.actions = new Map();
    this.loaded = true;
    this.ribbon = this.addRibbonIcon("unlock", this.text.control, () => this.toggle());
    this.status = this.addStatusBarItem();
    this.status.classList.add("relative-scroll-lock-status");
    this.status.setAttribute("role", "button");
    this.status.setAttribute("tabindex", "0");
    this.registerDomEvent(this.status, "click", () => this.toggle());
    this.registerDomEvent(this.status, "keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.toggle();
      }
    });
    this.addCommand({
      id: "toggle", name: this.text.toggle,
      callback: () => this.toggle(),
    });
    this.addCommand({ id: "unlock", name: this.text.unlock, callback: () => this.unlock() });
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.app.workspace.onLayoutReady(() => {
      if (!this.loaded) return;
      this.refresh();
      new Notice(this.text.ready, 7000);
    });
    this.render();
  }

  visibleLeaves() {
    const workspace = this.app.workspace;
    return workspace.getLeavesOfType("markdown").filter((leaf) => {
      if (typeof leaf.getRoot === "function" && leaf.getRoot() !== workspace.rootSplit) return false;
      const el = leaf.view.containerEl;
      if (!el.isConnected || !el.getClientRects().length) return false;
      const rect = el.getBoundingClientRect();
      const style = el.ownerDocument.defaultView.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    });
  }

  findPair() {
    const leaves = this.visibleLeaves();
    if (leaves.length !== 2) return null;
    leaves.sort((a, b) => a.view.containerEl.getBoundingClientRect().left - b.view.containerEl.getBoundingClientRect().left);
    const left = leaves[0].view.containerEl.getBoundingClientRect();
    const right = leaves[1].view.containerEl.getBoundingClientRect();
    const overlap = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
    if (right.left < left.right - 8 || overlap < Math.min(left.height, right.height) / 2) return null;
    if (!leaves.every((leaf) => leaf.view.file && this.scroller(leaf.view))) return null;
    return leaves;
  }

  scroller(view) {
    const reading = view.getMode() === "preview";
    const root = view.contentEl || view.containerEl;
    return root.querySelector(reading ? ".markdown-preview-view" : ".cm-scroller");
  }

  releaseNativeLink(pair) {
    if (pair[0].group && pair[0].group === pair[1].group) {
      for (const leaf of pair) leaf.setGroup(null);
      this.app.workspace.requestSaveLayout?.();
    }
  }

  toggle() {
    if (this.session) {
      this.unlock();
      return;
    }
    const pair = this.findPair();
    if (!pair) {
      new Notice(this.text.layout);
      return;
    }
    this.releaseNativeLink(pair);
    this.binding = pair.map((leaf) => ({ leaf, view: leaf.view, path: leaf.view.file.path, scroller: this.scroller(leaf.view) }));
    this.session = new RelativeScrollSession(
      this.binding.map((item) => item.scroller),
      () => this.render(),
      () => this.unlock(this.text.closed),
    );
    this.render();
    new Notice(this.text.lockedNotice, 3500);
  }

  unlock(message) {
    const wasLocked = Boolean(this.session);
    this.session?.dispose();
    this.session = null;
    this.binding = null;
    this.render();
    if (message) new Notice(message);
    else if (wasLocked) new Notice(this.text.unlockedNotice, 2500);
  }

  refresh() {
    if (!this.loaded) return;
    if (this.binding) {
      const visible = this.findPair();
      const valid = visible && this.binding.every(({ leaf, view, path, scroller }) =>
        visible.includes(leaf) && leaf.view === view && view.file?.path === path && this.scroller(view) === scroller);
      if (!valid) this.unlock(this.text.changed);
    }
    const all = this.app.workspace.getLeavesOfType("markdown");
    for (const [view, button] of this.actions) {
      if (!all.some((leaf) => leaf.view === view) || !button.isConnected) {
        button.remove();
        this.actions.delete(view);
      }
    }
    for (const leaf of all) {
      const view = leaf.view;
      if (!this.actions.has(view) && typeof view.addAction === "function") {
        const button = view.addAction("unlock", this.text.control, () => this.toggle());
        button.classList.add("relative-scroll-lock-action");
        this.actions.set(view, button);
      }
    }
    this.render();
  }

  render() {
    const locked = Boolean(this.session);
    const temporary = locked && this.session.alt;
    const text = temporary ? this.text.temporary : locked ? this.text.locked : this.text.unlocked;
    const title = locked ? this.text.lockedTitle : this.text.unlockedTitle;
    const icon = locked && !temporary ? "lock" : "unlock";
    if (this.status) {
      this.status.textContent = text;
      this.status.setAttribute("title", title);
      this.status.setAttribute("aria-label", `${text}。${title}`);
      this.status.setAttribute("aria-pressed", String(locked));
      this.status.classList.toggle("is-locked", locked);
    }
    for (const button of [this.ribbon, ...this.actions.values()]) {
      if (!button) continue;
      setIcon(button, icon);
      button.setAttribute("aria-label", `${text}。${title}`);
      button.setAttribute("aria-pressed", String(locked));
      button.classList.toggle("is-active", locked);
    }
  }

  onunload() {
    this.loaded = false;
    this.session?.dispose();
    this.session = null;
    for (const button of this.actions.values()) button.remove();
    this.actions.clear();
  }
};

// Also exposed for regression tests; Obsidian loads the default class above.
module.exports.RelativeScrollSession = RelativeScrollSession;
