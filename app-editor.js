const qs = new URLSearchParams(location.search);
const projectId = qs.get("id");

const backHome = document.getElementById("backHome");
const projectTitle = document.getElementById("projectTitle");
const fontSelect = document.getElementById("fontSelect");
const fontSizeInput = document.getElementById("fontSizeInput");
const lineHeightInput = document.getElementById("lineHeightInput");
const columnsInput = document.getElementById("columnsInput");
const rubyBtn = document.getElementById("rubyBtn");
const tcyBtn = document.getElementById("tcyBtn");
const emphBtn = document.getElementById("emphBtn");
const exportProjectBtn = document.getElementById("exportProject");
const exportHtmlBtn = document.getElementById("exportHtml");
const printBtn = document.getElementById("printBtn");
const searchToggle = document.getElementById("searchToggle");
const searchPanel = document.getElementById("searchPanel");
const searchInput = document.getElementById("searchInput");
const replaceInput = document.getElementById("replaceInput");
const findNextBtn = document.getElementById("findNext");
const replaceNextBtn = document.getElementById("replaceNext");
const replaceAllBtn = document.getElementById("replaceAll");
const caseSensitive = document.getElementById("caseSensitive");
const autoTcyToggle = document.getElementById("autoTcyToggle");
const paragraphSelect = document.getElementById("paragraphSelect");
const emphSelect = document.getElementById("emphSelect");

const chapterList = document.getElementById("chapterList");
const addChapterBtn = document.getElementById("addChapter");
const moveUpBtn = document.getElementById("moveUp");
const moveDownBtn = document.getElementById("moveDown");
const chapterTitleInput = document.getElementById("chapterTitle");
const editor = document.getElementById("editor");
const paper = document.getElementById("paper");
const notesEditor = document.getElementById("notesEditor");
const chapterCount = document.getElementById("chapterCount");
const projectCount = document.getElementById("projectCount");

const state = {
  project: null,
  activeChapterId: null,
  selectionRange: null,
};

const saveProjectDebounced = DomUtils.debounce(async () => {
  if (!state.project) return;
  await AppStorage.saveProject(state.project);
});

const updateCounts = () => {
  if (!state.project) return;
  const active = getActiveChapter();
  if (active) {
    active.wordCount = DomUtils.stripHtml(active.html).length;
    chapterCount.textContent = `${active.wordCount}字`;
  }
  const notesCount = DomUtils.stripHtml(state.project.notesHtml).length;
  const total = state.project.chapters.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0);
  projectCount.textContent = `合計 ${total + notesCount}字`;
};

const getActiveChapter = () => state.project?.chapters.find((c) => c.id === state.activeChapterId);

const normalizeDirection = (settings) => {
  if (settings.direction !== "vertical-rl") {
    settings.direction = "vertical-rl";
  }
};

const applySettings = () => {
  if (!state.project) return;
  const settings = state.project.settings;
  normalizeDirection(settings);
  fontSelect.value = settings.fontFamily;
  fontSizeInput.value = settings.fontSize;
  lineHeightInput.value = settings.lineHeight;
  columnsInput.value = settings.columns;
  autoTcyToggle.checked = settings.autoTCY;
  paragraphSelect.value = settings.paragraphMode;
  emphSelect.value = settings.emphStyle;

  paper.style.setProperty("--editor-font", settings.fontFamily);
  paper.style.setProperty("--editor-size", `${settings.fontSize}px`);
  paper.style.setProperty("--editor-line-height", settings.lineHeight);
  paper.style.setProperty("--editor-columns", settings.columns);
  editor.classList.remove("paragraph-indent", "paragraph-none", "paragraph-spaced");
  editor.classList.add(`paragraph-${settings.paragraphMode}`);

  editor.querySelectorAll(".emph").forEach((node) => {
    node.classList.toggle("sesame", settings.emphStyle === "sesame");
  });
};

const renderChapterList = () => {
  chapterList.innerHTML = "";
  state.project.chapters.forEach((chapter, index) => {
    const item = document.createElement("div");
    item.className = "chapter-item";
    item.draggable = true;
    if (chapter.id === state.activeChapterId) {
      item.classList.add("active");
    }
    item.dataset.id = chapter.id;

    const title = document.createElement("span");
    title.className = "title";
    title.textContent = chapter.title || `第${index + 1}章`;

    const actions = document.createElement("div");
    actions.className = "chapter-actions";

    const renameBtn = document.createElement("button");
    renameBtn.className = "btn small";
    renameBtn.textContent = "名前";
    renameBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const next = prompt("章タイトル", chapter.title || "");
      if (next) {
        chapter.title = next;
        renderChapterList();
        saveProjectDebounced();
      }
    });

    const cloneBtn = document.createElement("button");
    cloneBtn.className = "btn small";
    cloneBtn.textContent = "複製";
    cloneBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const createdAt = new Date().toISOString();
      const cloned = {
        ...chapter,
        id: crypto.randomUUID ? crypto.randomUUID() : `chapter-${Date.now()}`,
        title: `${chapter.title || "章"}(複製)`,
        createdAt,
        updatedAt: createdAt,
      };
      state.project.chapters.splice(index + 1, 0, cloned);
      renderChapterList();
      saveProjectDebounced();
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn small";
    deleteBtn.textContent = "削除";
    deleteBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      if (confirm("章を削除しますか？")) {
        state.project.chapters = state.project.chapters.filter((c) => c.id !== chapter.id);
        if (state.activeChapterId === chapter.id) {
          state.activeChapterId = state.project.chapters[0]?.id || null;
        }
        renderChapterList();
        loadChapter();
        saveProjectDebounced();
      }
    });

    actions.append(renameBtn, cloneBtn, deleteBtn);
    item.append(title, actions);

    item.addEventListener("click", () => {
      if (state.activeChapterId !== chapter.id) {
        saveCurrentChapter();
        state.activeChapterId = chapter.id;
        loadChapter();
      }
    });

    item.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", chapter.id);
    });

    item.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    item.addEventListener("drop", (event) => {
      event.preventDefault();
      const sourceId = event.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === chapter.id) return;
      const sourceIndex = state.project.chapters.findIndex((c) => c.id === sourceId);
      const targetIndex = state.project.chapters.findIndex((c) => c.id === chapter.id);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const [moved] = state.project.chapters.splice(sourceIndex, 1);
      state.project.chapters.splice(targetIndex, 0, moved);
      renderChapterList();
      saveProjectDebounced();
    });

    chapterList.appendChild(item);
  });
};

const loadChapter = () => {
  const chapter = getActiveChapter();
  if (!chapter) {
    editor.innerHTML = "";
    chapterTitleInput.value = "";
    return;
  }
  chapterTitleInput.value = chapter.title || "";
  editor.innerHTML = chapter.html || "<p></p>";
  updateCounts();
  renderChapterList();
};

const saveCurrentChapter = () => {
  const chapter = getActiveChapter();
  if (!chapter) return;
  chapter.title = chapterTitleInput.value || chapter.title || "";
  chapter.html = editor.innerHTML;
  chapter.updatedAt = new Date().toISOString();
  updateCounts();
};

const updateNotes = () => {
  if (!state.project) return;
  state.project.notesHtml = notesEditor.innerHTML;
  updateCounts();
  saveProjectDebounced();
};

const ensureParagraphs = () => {
  if (!editor.innerHTML.trim()) {
    editor.innerHTML = "<p></p>";
    return;
  }
  const blockTags = ["P", "DIV", "H1", "H2", "H3"];
  if (!editor.firstElementChild || !blockTags.includes(editor.firstElementChild.tagName)) {
    const text = editor.innerHTML;
    editor.innerHTML = `<p>${text}</p>`;
  }
};

const applyRangeWrapper = (wrapper) => {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return;
  range.surroundContents(wrapper);
  selection.removeAllRanges();
  selection.addRange(range);
};

const insertRuby = () => {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return;
  const text = range.toString();
  const reading = prompt("ルビを入力", "");
  if (!reading) return;
  const ruby = document.createElement("ruby");
  const rb = document.createElement("rb");
  const rt = document.createElement("rt");
  rb.textContent = text;
  rt.textContent = reading;
  ruby.append(rb, rt);
  range.deleteContents();
  range.insertNode(ruby);
  selection.removeAllRanges();
};

const insertTcy = () => {
  const span = document.createElement("span");
  span.className = "tcy";
  applyRangeWrapper(span);
};

const insertEmph = () => {
  const span = document.createElement("span");
  span.className = "emph";
  if (state.project.settings.emphStyle === "sesame") {
    span.classList.add("sesame");
  }
  applyRangeWrapper(span);
};

const searchInEditor = () => {
  const query = searchInput.value;
  if (!query) return null;
  const nodes = DomUtils.findTextNodes(editor);
  const flags = caseSensitive.checked ? "g" : "gi";
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  for (const node of nodes) {
    const match = regex.exec(node.textContent);
    if (match) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      return range;
    }
  }
  return null;
};

const highlightRange = (range) => {
  if (!range) return;
  const selection = document.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
};

const replaceInRange = (range, replacement) => {
  if (!range) return false;
  range.deleteContents();
  range.insertNode(document.createTextNode(replacement));
  return true;
};

const replaceAll = () => {
  const query = searchInput.value;
  if (!query) return;
  const nodes = DomUtils.findTextNodes(editor);
  const flags = caseSensitive.checked ? "g" : "gi";
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  nodes.forEach((node) => {
    node.textContent = node.textContent.replace(regex, replaceInput.value);
  });
};

const applyAutoTcy = () => {
  if (!state.project.settings.autoTCY) return;
  const nodes = DomUtils.findTextNodes(editor);
  const regex = /\b\d{2,6}\b/g;
  nodes.forEach((node) => {
    const fragments = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(node.textContent))) {
      const before = node.textContent.slice(lastIndex, match.index);
      if (before) fragments.push(document.createTextNode(before));
      const span = document.createElement("span");
      span.className = "tcy";
      span.textContent = match[0];
      fragments.push(span);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex === 0) return;
    const after = node.textContent.slice(lastIndex);
    if (after) fragments.push(document.createTextNode(after));
    const parent = node.parentNode;
    fragments.forEach((frag) => parent.insertBefore(frag, node));
    parent.removeChild(node);
  });
};

const exportProject = () => {
  DomUtils.downloadFile(`${state.project.title || "project"}.json`, AppStorage.exportProjectJson(state.project));
};

const exportAsHtml = () => {
  const settings = state.project.settings;
  const chapterHtml = state.project.chapters
    .map((chapter) => `
      <section class="chapter">
        <h2>${chapter.title || ""}</h2>
        <div class="chapter-body">${chapter.html || ""}</div>
      </section>
    `)
    .join("\n");

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>${state.project.title || "作品"}</title>
<style>
  body { margin: 0; padding: 24px; font-family: ${settings.fontFamily}; }
  .paper { background: #f5f1e8; color: #1c1b16; padding: 24px; }
  .chapter { page-break-after: always; }
  .chapter:last-child { page-break-after: auto; }
  .chapter-body {
    writing-mode: ${settings.direction};
    text-orientation: mixed;
    font-size: ${settings.fontSize}px;
    line-height: ${settings.lineHeight};
    column-count: ${settings.columns};
    column-gap: 2.5em;
    direction: rtl;
  }
  .chapter-body > * { direction: ltr; }
  .tcy { text-combine-upright: all; -webkit-text-combine: horizontal; }
  .emph { text-emphasis: ${settings.emphStyle === "sesame" ? "sesame" : "filled dot"}; text-emphasis-position: over right; }
  .paragraph-indent p { text-indent: 1em; margin: 0 0 0.5em; }
  .paragraph-none p { text-indent: 0; margin: 0 0 0.5em; }
  .paragraph-spaced p { text-indent: 0; margin: 0 0 1.5em; }
</style>
</head>
<body>
  <div class="paper paragraph-${settings.paragraphMode}">
    <h1>${state.project.title || "作品"}</h1>
    ${chapterHtml}
  </div>
</body>
</html>`;

  DomUtils.downloadFile(`${state.project.title || "project"}.html`, html, "text/html");
};

const updateSettings = () => {
  const settings = state.project.settings;
  settings.fontFamily = fontSelect.value;
  settings.fontSize = Number(fontSizeInput.value || 18);
  settings.lineHeight = Number(lineHeightInput.value || 1.8);
  settings.columns = Number(columnsInput.value || 1);
  settings.autoTCY = autoTcyToggle.checked;
  settings.paragraphMode = paragraphSelect.value;
  settings.emphStyle = emphSelect.value;
  applySettings();
  saveProjectDebounced();
};

const moveChapter = (direction) => {
  const currentIndex = state.project.chapters.findIndex((c) => c.id === state.activeChapterId);
  if (currentIndex < 0) return;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= state.project.chapters.length) return;
  const [chapter] = state.project.chapters.splice(currentIndex, 1);
  state.project.chapters.splice(nextIndex, 0, chapter);
  renderChapterList();
  saveProjectDebounced();
};

const handleShortcut = (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
    exportAsHtml();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    window.print();
  }
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "r") {
    event.preventDefault();
    insertRuby();
  }
  if (event.ctrlKey && event.altKey && event.key.toLowerCase() === "t") {
    event.preventDefault();
    insertTcy();
  }
  if (event.ctrlKey && event.key.toLowerCase() === "f") {
    event.preventDefault();
    searchPanel.classList.remove("hidden");
    searchInput.focus();
  }
};

const loadProject = async () => {
  const project = await AppStorage.getProject(projectId);
  if (!project) {
    alert("作品が見つかりません");
    location.href = "index.html";
    return;
  }
  state.project = project;
  state.activeChapterId = project.chapters[0]?.id || null;
  projectTitle.textContent = project.title || "無題";
  notesEditor.innerHTML = project.notesHtml || "<p></p>";
  applySettings();
  renderChapterList();
  loadChapter();
  updateCounts();
};

backHome.addEventListener("click", () => location.href = "index.html");

addChapterBtn.addEventListener("click", () => {
  const createdAt = new Date().toISOString();
  const newChapter = {
    id: crypto.randomUUID ? crypto.randomUUID() : `chapter-${Date.now()}`,
    title: `第${state.project.chapters.length + 1}章`,
    html: "<p></p>",
    createdAt,
    updatedAt: createdAt,
    wordCount: 0,
  };
  state.project.chapters.push(newChapter);
  state.activeChapterId = newChapter.id;
  renderChapterList();
  loadChapter();
  saveProjectDebounced();
});

moveUpBtn.addEventListener("click", () => moveChapter(-1));
moveDownBtn.addEventListener("click", () => moveChapter(1));

chapterTitleInput.addEventListener("input", () => {
  saveCurrentChapter();
  renderChapterList();
  saveProjectDebounced();
});

editor.addEventListener("input", () => {
  ensureParagraphs();
  saveCurrentChapter();
  saveProjectDebounced();
});

notesEditor.addEventListener("input", updateNotes);

[rubyBtn, tcyBtn, emphBtn].forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn === rubyBtn) insertRuby();
    if (btn === tcyBtn) insertTcy();
    if (btn === emphBtn) insertEmph();
    saveCurrentChapter();
    saveProjectDebounced();
  });
});

searchToggle.addEventListener("click", () => {
  searchPanel.classList.toggle("hidden");
});

findNextBtn.addEventListener("click", () => {
  const range = searchInEditor();
  highlightRange(range);
});

replaceNextBtn.addEventListener("click", () => {
  const range = searchInEditor();
  if (replaceInRange(range, replaceInput.value)) {
    saveCurrentChapter();
    saveProjectDebounced();
  }
});

replaceAllBtn.addEventListener("click", () => {
  replaceAll();
  saveCurrentChapter();
  saveProjectDebounced();
});

[fontSelect, fontSizeInput, lineHeightInput, columnsInput, autoTcyToggle, paragraphSelect, emphSelect]
  .forEach((el) => el.addEventListener("change", updateSettings));

exportProjectBtn.addEventListener("click", exportProject);
exportHtmlBtn.addEventListener("click", exportAsHtml);
printBtn.addEventListener("click", () => window.print());

window.addEventListener("keydown", handleShortcut);
window.addEventListener("beforeunload", () => {
  saveCurrentChapter();
  applyAutoTcy();
  AppStorage.saveProject(state.project);
});

editor.addEventListener("blur", () => {
  saveCurrentChapter();
  applyAutoTcy();
});

notesEditor.addEventListener("blur", updateNotes);

loadProject();
