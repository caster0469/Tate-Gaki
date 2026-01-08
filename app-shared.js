const AppStorage = (() => {
  const DB_NAME = "tategakiNovelDB";
  const DB_VERSION = 1;
  const PROJECT_STORE = "projects";
  let dbPromise = null;
  let fallback = false;

  const nowIso = () => new Date().toISOString();
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const defaultSettings = () => ({
    direction: "vertical-rl",
    fontFamily: "'Hiragino Mincho ProN', 'Yu Mincho', serif",
    fontSize: 18,
    lineHeight: 1.8,
    columns: 2,
    gridColumns: 40,
    gridRows: 17,
    paragraphMode: "indent",
    autoTCY: false,
    emphStyle: "dot",
  });

  const openDb = () => {
    if (dbPromise) {
      return dbPromise;
    }
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        fallback = true;
        resolve(null);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => {
        fallback = true;
        resolve(null);
      };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
    });
    return dbPromise;
  };

  const withStore = async (mode, callback) => {
    const db = await openDb();
    if (!db) {
      return callback(null);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PROJECT_STORE, mode);
      const store = tx.objectStore(PROJECT_STORE);
      const result = callback(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  };

  const loadFallback = () => {
    const raw = localStorage.getItem(PROJECT_STORE);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("LocalStorage read failed", error);
      return [];
    }
  };

  const saveFallback = (projects) => {
    localStorage.setItem(PROJECT_STORE, JSON.stringify(projects));
  };

  const listProjects = async () => {
    if (fallback) {
      return loadFallback();
    }
    return withStore("readonly", (store) => {
      return new Promise((resolve) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  };

  const getProject = async (id) => {
    if (fallback) {
      return loadFallback().find((item) => item.id === id) || null;
    }
    return withStore("readonly", (store) => {
      return new Promise((resolve) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    });
  };

  const saveProject = async (project) => {
    const updated = { ...project, updatedAt: nowIso() };
    if (fallback) {
      const projects = loadFallback();
      const index = projects.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        projects[index] = updated;
      } else {
        projects.push(updated);
      }
      saveFallback(projects);
      return updated;
    }
    await withStore("readwrite", (store) => store.put(updated));
    return updated;
  };

  const deleteProject = async (id) => {
    if (fallback) {
      const projects = loadFallback().filter((item) => item.id !== id);
      saveFallback(projects);
      return;
    }
    await withStore("readwrite", (store) => store.delete(id));
  };

  const createProject = (title = "新しい作品") => {
    const createdAt = nowIso();
    return {
      id: uuid(),
      title,
      author: "",
      createdAt,
      updatedAt: createdAt,
      settings: defaultSettings(),
      notesHtml: "<p>メモを入力</p>",
      chapters: [
        {
          id: uuid(),
          title: "第1章",
          html: "<p>ここから書き始める。</p>",
          createdAt,
          updatedAt: createdAt,
          wordCount: 0,
        },
      ],
    };
  };

  const cloneProject = (project, suffix = "(複製)") => {
    const createdAt = nowIso();
    return {
      ...project,
      id: uuid(),
      title: `${project.title}${suffix}`,
      createdAt,
      updatedAt: createdAt,
      chapters: project.chapters.map((chapter) => ({
        ...chapter,
        id: uuid(),
        createdAt,
        updatedAt: createdAt,
      })),
    };
  };

  const exportProjectJson = (project) => JSON.stringify(project, null, 2);

  const importProjectJson = (json) => {
    const parsed = JSON.parse(json);
    const createdAt = nowIso();
    return {
      ...parsed,
      id: uuid(),
      title: `${parsed.title || "無題"}（インポート）`,
      createdAt,
      updatedAt: createdAt,
      chapters: (parsed.chapters || []).map((chapter) => ({
        ...chapter,
        id: uuid(),
        createdAt,
        updatedAt: createdAt,
      })),
    };
  };

  return {
    openDb,
    listProjects,
    getProject,
    saveProject,
    deleteProject,
    createProject,
    cloneProject,
    exportProjectJson,
    importProjectJson,
    defaultSettings,
  };
})();

const DomUtils = (() => {
  const downloadFile = (filename, content, type = "application/json") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const stripHtml = (html) => {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.innerText || "";
  };

  const debounce = (fn, delay = 400) => {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const findTextNodes = (root) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    return nodes;
  };

  return {
    downloadFile,
    stripHtml,
    debounce,
    findTextNodes,
  };
})();

const ServiceWorkerHelper = (() => {
  const register = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((error) => {
        console.warn("SW registration failed", error);
      });
    }
  };
  return { register };
})();

window.addEventListener("load", () => {
  ServiceWorkerHelper.register();
  AppStorage.openDb();
});
