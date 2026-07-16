(() => {
  const PROMPTS_PER_PAGE = 3;
  const INTERACTIVE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'DIALOG']);

  function normalizePageSize(value) {
    const numeric = Math.floor(Number(value));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : PROMPTS_PER_PAGE;
  }

  function paginate(items, requestedPage = 1, requestedPageSize = PROMPTS_PER_PAGE) {
    const source = Array.isArray(items) ? items : [];
    const pageSize = normalizePageSize(requestedPageSize);
    const totalItems = source.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    if (totalPages === 0) {
      return {
        items: [],
        page: 0,
        pageSize,
        totalItems: 0,
        totalPages: 0,
        hasPrevious: false,
        hasNext: false
      };
    }

    const numericPage = Math.floor(Number(requestedPage));
    const page = Math.max(1, Math.min(totalPages, Number.isFinite(numericPage) ? numericPage : 1));
    const start = (page - 1) * pageSize;

    return {
      items: source.slice(start, start + pageSize),
      page,
      pageSize,
      totalItems,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages
    };
  }

  function move(pageState, direction) {
    const page = Number(pageState?.page) || 0;
    const totalPages = Number(pageState?.totalPages) || 0;

    if (totalPages === 0) {
      return 0;
    }

    const delta = direction === 'backward' ? -1 : direction === 'forward' ? 1 : 0;
    return Math.max(1, Math.min(totalPages, page + delta));
  }

  function directionForKey(options = {}) {
    if (!options.panelOpen || options.dialogOpen || options.contentEditable) {
      return null;
    }

    const targetTagName = String(options.targetTagName ?? '').toUpperCase();
    if (INTERACTIVE_TAGS.has(targetTagName)) {
      return null;
    }

    if (options.key === 'ArrowLeft') {
      return 'backward';
    }

    return options.key === 'ArrowRight' ? 'forward' : null;
  }

  function resolveMenuPlacement(options = {}) {
    const menuHeight = Math.max(0, Number(options.menuHeight) || 0);
    const spaceAbove = Math.max(0, Number(options.spaceAbove) || 0);
    const spaceBelow = Math.max(0, Number(options.spaceBelow) || 0);

    if (menuHeight <= spaceBelow) {
      return { direction: 'down', constrained: false, maxHeight: null };
    }

    if (menuHeight <= spaceAbove) {
      return { direction: 'up', constrained: false, maxHeight: null };
    }

    const direction = spaceAbove > spaceBelow ? 'up' : 'down';
    const available = direction === 'up' ? spaceAbove : spaceBelow;
    return {
      direction,
      constrained: true,
      maxHeight: Math.max(32, Math.floor(available - 6))
    };
  }

  globalThis.deskPetPromptPagination = Object.freeze({
    PROMPTS_PER_PAGE,
    paginate,
    move,
    directionForKey,
    resolveMenuPlacement
  });
})();
