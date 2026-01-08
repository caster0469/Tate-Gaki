const projectList = document.getElementById("projectList");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const createProjectBtn = document.getElementById("createProject");
const importBtn = document.getElementById("importProject");
const importFile = document.getElementById("importFile");
const exportAllBtn = document.getElementById("exportAll");

const state = {
  projects: [],
};

const renderProjects = () => {
  const query = searchInput.value.trim().toLowerCase();
  const sorted = [...state.projects];
  if (sortSelect.value === "title") {
    sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  } else {
    sorted.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }
  const filtered = sorted.filter((project) =>
    !query || (project.title || "").toLowerCase().includes(query)
  );

  projectList.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "card-meta";
    empty.textContent = "作品がありません。";
    projectList.appendChild(empty);
    return;
  }
  filtered.forEach((project) => {
    const card = document.createElement("div");
    card.className = "project-card";
    const title = document.createElement("h3");
    title.textContent = project.title || "無題";
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const chapterCount = project.chapters?.length || 0;
    const totalWords = project.chapters?.reduce((sum, chapter) => sum + (chapter.wordCount || 0), 0) || 0;
    meta.innerHTML = `
      <div>更新: ${new Date(project.updatedAt).toLocaleString()}</div>
      <div>章数: ${chapterCount}</div>
      <div>合計文字数: ${totalWords}</div>
    `;
    const actions = document.createElement("div");
    actions.className = "card-actions";

    const openBtn = document.createElement("button");
    openBtn.className = "btn primary";
    openBtn.textContent = "開く";
    openBtn.addEventListener("click", () => {
      location.href = `editor.html?id=${project.id}`;
    });

    const renameBtn = document.createElement("button");
    renameBtn.className = "btn";
    renameBtn.textContent = "名前変更";
    renameBtn.addEventListener("click", async () => {
      const next = prompt("新しいタイトル", project.title || "無題");
      if (next) {
        project.title = next;
        await AppStorage.saveProject(project);
        await loadProjects();
      }
    });

    const cloneBtn = document.createElement("button");
    cloneBtn.className = "btn";
    cloneBtn.textContent = "複製";
    cloneBtn.addEventListener("click", async () => {
      const cloned = AppStorage.cloneProject(project, "(複製)");
      await AppStorage.saveProject(cloned);
      await loadProjects();
    });

    const exportBtn = document.createElement("button");
    exportBtn.className = "btn";
    exportBtn.textContent = "JSON";
    exportBtn.addEventListener("click", () => {
      DomUtils.downloadFile(`${project.title || "project"}.json`, AppStorage.exportProjectJson(project));
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn";
    deleteBtn.textContent = "削除";
    deleteBtn.addEventListener("click", async () => {
      if (confirm("この作品を削除しますか？")) {
        await AppStorage.deleteProject(project.id);
        await loadProjects();
      }
    });

    actions.append(openBtn, renameBtn, cloneBtn, exportBtn, deleteBtn);
    card.append(title, meta, actions);
    projectList.appendChild(card);
  });
};

const loadProjects = async () => {
  state.projects = await AppStorage.listProjects();
  renderProjects();
};

createProjectBtn.addEventListener("click", async () => {
  const title = prompt("作品タイトル", "新しい作品");
  const project = AppStorage.createProject(title || "新しい作品");
  await AppStorage.saveProject(project);
  location.href = `editor.html?id=${project.id}`;
});

importBtn.addEventListener("click", () => importFile.click());

importFile.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    const project = AppStorage.importProjectJson(text);
    await AppStorage.saveProject(project);
    await loadProjects();
  } catch (error) {
    alert("読み込みに失敗しました。");
  }
  importFile.value = "";
});

exportAllBtn.addEventListener("click", async () => {
  const projects = await AppStorage.listProjects();
  DomUtils.downloadFile("projects.json", JSON.stringify(projects, null, 2));
});

[searchInput, sortSelect].forEach((el) => el.addEventListener("input", renderProjects));

loadProjects();
