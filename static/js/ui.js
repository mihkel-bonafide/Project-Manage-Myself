(() => {
  const columns = [
    { id: "backlog", title: "Ideas / Backlog" },
    { id: "in_progress", title: "In Progress" },
    { id: "done", title: "Done" },
  ];

  const els = {};

  const viewMode = (() => {
    const path = window.location.pathname;
    const match = path.match(/^\/projects\/([^/]+)\/?$/);
    if (match) {
      return { type: "project", projectId: decodeURIComponent(match[1]) };
    }
    return { type: "home", projectId: null };
  })();

  function qs(id) {
    return document.getElementById(id);
  }

  function initElements() {
    els.projectsList = qs("projectsList");
    els.projectOverview = qs("projectOverview");
    els.board = qs("board");
    els.appMain = document.querySelector(".app-main");
    els.boardArea = document.querySelector(".board-area");
    els.newProjectBtn = qs("newProjectBtn");
    els.emptyNewProjectBtn = qs("emptyNewProjectBtn");
    els.themeToggle = qs("themeToggle");
    els.modalBackdrop = qs("modalBackdrop");
    els.modalTitle = qs("modalTitle");
    els.modalBody = qs("modalBody");
    els.modalClose = qs("modalClose");
  }

  function openModal(title, bodyNode) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = "";
    els.modalBody.appendChild(bodyNode);
    els.modalBackdrop.classList.remove("hidden");
  }

  function closeModal() {
    els.modalBackdrop.classList.add("hidden");
  }

  function renderProjectsSidebar() {
    const projects = AppState.getProjects();
    const selected = AppState.getSelectedProject();
    els.projectsList.innerHTML = "";

    projects.forEach((project) => {
      if (project.archived) return;
      const doneCount = (project.milestones || []).filter(
        (m) => m.status === "done"
      ).length;
      const total = (project.milestones || []).length;
      const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

      if (viewMode.type === "home") {
        const container = document.createElement("div");
        container.className = "project-list-item home";

        const milestones = project.milestones || [];
        const projectEstimate = project.estimated_duration
          ? `<span class="project-estimate-inline">Est. duration: ${project.estimated_duration}</span>`
          : "";
        const milestonesHtml = milestones
          .map((m) => {
            const estimate = m.estimated_duration
              ? ` — <span class="milestone-estimate-inline">${m.estimated_duration}</span>`
              : "";
            return `<li><span class="pill pill-${m.status}">${labelForStatus(
              m.status
            )}</span> ${m.title}${estimate}</li>`;
          })
          .join("");

        container.innerHTML = `
          <div class="project-main">
            <div class="project-name-row">
              <span class="project-color-dot project-color-${project.color}"></span>
              <span class="project-name">${project.name}</span>
            </div>
            <p class="project-desc">${project.description || ""}</p>
            ${projectEstimate}
          </div>
          <div class="project-meta project-meta-home">
            <span class="project-progress-label">${percent}% complete · ${
          milestones.length
        } milestones</span>
          </div>
          ${
            milestones.length
              ? `<ul class="project-milestones-list">${milestonesHtml}</ul>`
              : `<p class="project-no-milestones">No milestones yet.</p>`
          }
        `;

        container.addEventListener("click", () => {
          window.location.href = `/projects/${encodeURIComponent(project.id)}`;
        });

        els.projectsList.appendChild(container);
      } else {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "project-list-item";
        if (selected && selected.id === project.id) {
          item.classList.add("selected");
        }

        item.innerHTML = `
          <div class="project-main">
            <div class="project-name-row">
              <span class="project-color-dot project-color-${project.color}"></span>
              <span class="project-name">${project.name}</span>
            </div>
            <p class="project-desc">${project.description || ""}</p>
          </div>
          <div class="project-meta">
            <span class="project-progress-label">${percent}%</span>
            <div class="project-progress-bar">
              <div class="project-progress-fill" style="width:${percent}%"></div>
            </div>
          </div>
        `;

        item.addEventListener("click", () => {
          AppState.selectProject(project.id);
          renderProjectsSidebar();
          renderBoard();
        });

        els.projectsList.appendChild(item);
      }
    });
  }

  function renderBoard() {
    const project = AppState.getSelectedProject();
    if (!project) {
      els.board.classList.add("hidden");
      els.projectOverview.classList.add("empty-state");
      return;
    }

    els.board.classList.remove("hidden");
    els.projectOverview.classList.remove("empty-state");

    const doneCount = (project.milestones || []).filter(
      (m) => m.status === "done"
    ).length;
    const total = (project.milestones || []).length;
    const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

    els.projectOverview.innerHTML = `
      <div class="overview-left">
        <h2>${project.name}</h2>
        <p>${project.description || ""}</p>
      </div>
      <div class="overview-right">
        <button type="button" class="ghost-button ghost-button-small" id="editProjectInline">
          Edit project
        </button>
        <span class="overview-percent">${percent}% done</span>
        <div class="overview-bar">
          <div class="overview-bar-fill" style="width:${percent}%"></div>
        </div>
      </div>
    `;

    const editBtn = document.getElementById("editProjectInline");
    if (editBtn) {
      editBtn.addEventListener("click", () => openProjectForm(project));
    }

    els.board.innerHTML = "";
    const byStatus = {};
    (project.milestones || []).forEach((m) => {
      if (!byStatus[m.status]) byStatus[m.status] = [];
      byStatus[m.status].push(m);
    });
    columns.forEach((col) => {
      const colEl = document.createElement("div");
      colEl.className = "board-column";
      colEl.dataset.columnId = col.id;
      colEl.innerHTML = `
        <div class="board-column-header">
          <h3>${col.title}</h3>
          <span class="badge">${(byStatus[col.id] || []).length}</span>
        </div>
        <div class="board-column-body" data-dropzone="${col.id}"></div>
        <button type="button" class="text-button add-milestone-btn">+ Add milestone</button>
      `;

      const body = colEl.querySelector(".board-column-body");
      (byStatus[col.id] || []).forEach((m) => {
        body.appendChild(renderMilestoneCard(m));
      });

      const addBtn = colEl.querySelector(".add-milestone-btn");
      addBtn.addEventListener("click", () => openMilestoneForm(project.id, col.id));

      attachDropzone(body, col.id);
      els.board.appendChild(colEl);
    });
  }

  function renderMilestoneCard(m) {
    const card = document.createElement("article");
    card.className = "milestone-card";
    card.draggable = true;
    card.dataset.milestoneId = m.id;
    card.dataset.status = m.status;

    const due = m.due_date ? `<span class="milestone-due">Due ${m.due_date}</span>` : "";
    const estimate = m.estimated_duration
      ? `<span class="milestone-estimate">${m.estimated_duration}</span>`
      : "";

    card.innerHTML = `
      <div class="milestone-header">
        <span class="milestone-title">${m.title}</span>
      </div>
      <p class="milestone-desc">${m.description || ""}</p>
      <div class="milestone-footer">
        <div class="milestone-footer-left">
          ${due}
          ${estimate}
        </div>
        <span class="milestone-status milestone-status-${m.status}">${labelForStatus(
          m.status
        )}</span>
      </div>
    `;

    card.addEventListener("click", (ev) => {
      if (ev.target.closest(".drag-handle")) return;
      openMilestoneDetail(m);
    });

    card.addEventListener("dragstart", (ev) => {
      ev.dataTransfer.effectAllowed = "move";
      ev.dataTransfer.setData("text/plain", m.id);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
    });

    return card;
  }

  function labelForStatus(status) {
    switch (status) {
      case "backlog":
        return "Backlog";
      case "in_progress":
        return "In Progress";
      case "done":
        return "Done";
      default:
        return status;
    }
  }

  function attachDropzone(zone, status) {
    zone.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      zone.classList.add("drop-active");
    });
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drop-active");
    });
    zone.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      zone.classList.remove("drop-active");
      const id = ev.dataTransfer.getData("text/plain");
      if (!id) return;
      const project = AppState.getSelectedProject();
      if (!project) return;

      const milestones = project.milestones || [];
      const m = milestones.find((x) => x.id === id);
      if (!m) return;

      const newIndex = (milestones.filter((x) => x.status === status).length || 0);
      try {
        const updated = await Api.updateMilestone(id, {
          status,
          order_index: newIndex,
        });
        const newMilestones = milestones.map((x) =>
          x.id === id ? updated : x
        );
        AppState.replaceProjectMilestones(project.id, newMilestones);
        renderBoard();
        renderProjectsSidebar();
      } catch (err) {
        console.error(err);
        alert("Could not move milestone: " + err.message);
      }
    });
  }

  function openProjectForm(existing) {
    const form = document.createElement("form");
    form.className = "stack-form";
    form.innerHTML = `
      <label>
        <span>Project name</span>
        <input name="name" required value="${existing ? existing.name : ""}" />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" rows="3">${existing ? existing.description : ""}</textarea>
      </label>
      <label>
        <span>Color mood</span>
        <select name="color">
          <option value="indigo">Indigo</option>
          <option value="teal">Teal</option>
          <option value="amber">Amber</option>
          <option value="rose">Rose</option>
        </select>
      </label>
      <label>
        <span>Project duration (estimate)</span>
        <input
          name="estimated_duration"
          placeholder="e.g., 3 months, 6 weeks"
          value="${existing && existing.estimated_duration ? existing.estimated_duration : ""}"
        />
      </label>
      <div class="form-actions">
        <button type="button" class="ghost-button" data-role="cancel">Cancel</button>
        <button type="submit" class="primary-button">${existing ? "Save" : "Create project"}</button>
      </div>
    `;

    if (existing) {
      form.color.value = existing.color || "indigo";
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const payload = {
        name: form.name.value.trim(),
        description: form.description.value.trim(),
        color: form.color.value,
        estimated_duration: form.estimated_duration.value.trim() || null,
      };
      try {
        let project;
        if (existing) {
          project = await Api.updateProject(existing.id, payload);
        } else {
          project = await Api.createProject(payload);
        }
        const { projects } = await Api.getProjects();
        AppState.setProjects(projects);

        if (viewMode.type === "project") {
          AppState.selectProject(project.id);
          closeModal();
          renderProjectsSidebar();
          renderBoard();
        } else {
          closeModal();
          renderProjectsSidebar();
        }
      } catch (err) {
        console.error(err);
        alert("Could not save project: " + err.message);
      }
    });

    form.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      closeModal();
    });

    openModal(existing ? "Edit project" : "New project", form);
  }

  function openMilestoneForm(projectId, status, existing) {
    const form = document.createElement("form");
    form.className = "stack-form";
    form.innerHTML = `
      <label>
        <span>Title</span>
        <input name="title" required value="${existing ? existing.title : ""}" />
      </label>
      <label>
        <span>Description</span>
        <textarea name="description" rows="3">${existing ? existing.description : ""}</textarea>
      </label>
      <label>
        <span>Status</span>
        <select name="status">
          <option value="backlog">Backlog</option>
          <option value="in_progress">In Progress</option>
          <option value="done">Done</option>
        </select>
      </label>
      <label>
        <span>Due date (optional)</span>
        <input name="due_date" type="date" value="${existing && existing.due_date ? existing.due_date : ""}" />
      </label>
      <label>
        <span>Estimated duration (optional)</span>
        <input name="estimated_duration" placeholder="e.g., 2h, 3 days, 1 week" value="${
          existing && existing.estimated_duration ? existing.estimated_duration : ""
        }" />
      </label>
      <div class="form-actions">
        <button type="button" class="ghost-button" data-role="cancel">Cancel</button>
        <button type="submit" class="primary-button">${existing ? "Save" : "Add milestone"}</button>
      </div>
    `;

    form.status.value = existing ? existing.status : status || "backlog";

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const payload = {
        title: form.title.value.trim(),
        description: form.description.value.trim(),
        status: form.status.value,
        due_date: form.due_date.value || null,
        estimated_duration: form.estimated_duration.value.trim() || null,
      };
      try {
        const project = AppState.getSelectedProject();
        let result;
        if (existing) {
          result = await Api.updateMilestone(existing.id, payload);
        } else {
          result = await Api.createMilestone(projectId, payload);
        }
        const { projects } = await Api.getProjects();
        AppState.setProjects(projects);
        AppState.selectProject(project.id);
        closeModal();
        renderProjectsSidebar();
        renderBoard();
      } catch (err) {
        console.error(err);
        alert("Could not save milestone: " + err.message);
      }
    });

    form.querySelector('[data-role="cancel"]').addEventListener("click", () => {
      closeModal();
    });

    openModal(existing ? "Edit milestone" : "New milestone", form);
  }

  function openMilestoneDetail(m) {
    openMilestoneForm(m.project_id, m.status, m);
  }

  function toggleTheme() {
    const current = window.localStorage.getItem("skepticalpm:theme") || "vibrant";
    const next = current === "vibrant" ? "minimal" : "vibrant";
    applyTheme(next);
    window.localStorage.setItem("skepticalpm:theme", next);
  }

  function applyTheme(mode) {
    document.body.classList.remove("theme-vibrant", "theme-minimal");
    if (mode === "minimal") {
      document.body.classList.add("theme-minimal");
    } else {
      document.body.classList.add("theme-vibrant");
    }
  }

  function restoreTheme() {
    const stored = window.localStorage.getItem("skepticalpm:theme") || "vibrant";
    applyTheme(stored);
  }

  async function bootstrap() {
    initElements();
    restoreTheme();
    AppState.restoreSelection();

    if (viewMode.type === "home") {
      if (els.appMain) {
        els.appMain.classList.add("home-mode");
      }
      if (els.boardArea) {
        els.boardArea.classList.add("home-hidden");
      }
    }

    els.newProjectBtn.addEventListener("click", () => openProjectForm());
    els.emptyNewProjectBtn.addEventListener("click", () => openProjectForm());
    els.themeToggle.addEventListener("click", toggleTheme);
    els.modalClose.addEventListener("click", closeModal);
    els.modalBackdrop.addEventListener("click", (ev) => {
      if (ev.target === els.modalBackdrop) {
        closeModal();
      }
    });

    try {
      const { projects } = await Api.getProjects();
      AppState.setProjects(projects);

      if (viewMode.type === "project" && viewMode.projectId) {
        AppState.selectProject(viewMode.projectId);
      }

      renderProjectsSidebar();

      if (viewMode.type === "project") {
        renderBoard();
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load projects: " + err.message);
    }
  }

  window.addEventListener("DOMContentLoaded", bootstrap);
})();

