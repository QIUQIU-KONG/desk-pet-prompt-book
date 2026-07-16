(() => {
  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function renderRatingControl(promptId, rating, ratingOpen) {
    if (!ratingOpen) {
      const label = rating > 0 ? `评分 ${rating}` : '评分';
      return `<button type="button" class="rating-trigger" data-rating-toggle="${promptId}" aria-expanded="false">${label}</button>`;
    }

    const stars = [1, 2, 3, 4, 5].map((value) => {
      const active = value <= rating ? ' active' : '';
      return `<button type="button" class="rating-star${active}" data-rating-prompt-id="${promptId}" data-rating-value="${value}" aria-label="评分 ${value}" aria-pressed="${value <= rating}">★</button>`;
    }).join('');

    return `<div class="rating-picker" role="group" aria-label="设置评分">${stars}</div>`;
  }

  function renderProjectOptions(projectOptions) {
    return [
      '<option value="">待归纳</option>',
      ...projectOptions.map((project) => {
        const selected = project.selected ? ' selected' : '';
        return `<option value="${escapeHtml(project.id)}"${selected}>${escapeHtml(project.name)}</option>`;
      })
    ].join('');
  }

  function renderMoreMenu(prompt, promptId, projectOptions, menuOpen) {
    if (!menuOpen) {
      return '';
    }

    const pinLabel = prompt.pinned ? '取消置顶' : '置顶';
    const options = renderProjectOptions(projectOptions);

    return `
      <div class="prompt-more-menu" data-prompt-menu="${promptId}">
        <button type="button" data-edit-prompt-id="${promptId}">编辑</button>
        <button type="button" data-pin-prompt-id="${promptId}">${pinLabel}</button>
        <label>
          <span>项目</span>
          <select data-project-select-id="${promptId}">${options}</select>
        </label>
        <button type="button" class="danger" data-delete-prompt-request="${promptId}">永久删除</button>
      </div>`;
  }

  function renderPromptEntry(model) {
    const prompt = model.prompt ?? {};
    const promptId = escapeHtml(prompt.id);
    const rating = Math.max(0, Math.min(5, Number(prompt.rating) || 0));
    const ratingOpen = Boolean(model.ratingOpen);
    const menuOpen = Boolean(model.menuOpen);
    const keywords = (model.keywords ?? []).slice(0, 3)
      .map((keyword) => `<span>${escapeHtml(keyword)}</span>`)
      .join('');
    const ratingControl = renderRatingControl(promptId, rating, ratingOpen);
    const moreMenu = renderMoreMenu(prompt, promptId, model.projectOptions ?? [], menuOpen);

    return `
      <article class="prompt-entry" data-prompt-id="${promptId}">
        <header>
          <h3>${escapeHtml(prompt.title)}</h3>
          ${prompt.pinned ? '<span class="prompt-pin" aria-label="已置顶" title="已置顶">★</span>' : ''}
          <button type="button" class="prompt-menu-toggle" data-prompt-menu-toggle="${promptId}" aria-label="更多操作" aria-expanded="${menuOpen}">⋯</button>
          ${moreMenu}
        </header>
        <p>${escapeHtml(prompt.content)}</p>
        <footer>
          <div class="keyword-row">${keywords}</div>
          ${ratingControl}
          <button type="button" class="copy-prompt-button" data-copy-prompt-id="${promptId}">复制</button>
        </footer>
      </article>`;
  }

  globalThis.deskPetPromptEntryView = Object.freeze({
    escapeHtml,
    renderPromptEntry
  });
})();
