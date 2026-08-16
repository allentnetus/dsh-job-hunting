(() => {
  'use strict';

  const storageKey = 'jh-site-interest-v1';
  const dataElement = document.getElementById('site-data');
  const listElement = document.getElementById('job-list');
  const countElement = document.getElementById('job-count');
  const statusElement = document.getElementById('status-message');
  const searchElement = document.getElementById('search-input');
  const markFilterElement = document.getElementById('mark-filter');
  const exportElement = document.getElementById('export-button');

  if (!dataElement || !listElement || !countElement || !statusElement || !searchElement || !markFilterElement || !exportElement) {
    return;
  }

  let siteData;
  try {
    siteData = JSON.parse(dataElement.textContent || '{"jobs":[]}');
  } catch {
    statusElement.textContent = '岗位数据无法读取。';
    return;
  }

  const jobs = Array.isArray(siteData.jobs) ? siteData.jobs : [];
  const loadState = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return {
        marks: parsed && parsed.marks && typeof parsed.marks === 'object' ? parsed.marks : {},
        notes: parsed && parsed.notes && typeof parsed.notes === 'object' ? parsed.notes : {},
      };
    } catch {
      return { marks: {}, notes: {} };
    }
  };
  let state = loadState();

  const saveState = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // Browser storage can be unavailable or full; keep in-memory interaction usable.
    }
  };

  const safeUrl = (value) => {
    if (typeof value !== 'string') return '';
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch {
      return '';
    }
  };

  const text = (value) => (value == null ? '' : String(value));
  const currentMark = (jobId) => state.marks[jobId] || 'none';

  const makeText = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text(value);
    return element;
  };

  const render = () => {
    const query = searchElement.value.trim().toLowerCase();
    const markFilter = markFilterElement.value;
    const visibleJobs = jobs.filter((job) => {
      const searchable = [job.title, job.company, job.location, job.description].map(text).join(' ').toLowerCase();
      return (!query || searchable.includes(query)) && (markFilter === 'all' || currentMark(job.id) === markFilter);
    });

    listElement.replaceChildren();
    countElement.textContent = `${visibleJobs.length} / ${jobs.length} 个岗位`;
    if (!visibleJobs.length) {
      listElement.append(makeText('p', 'empty-state', '没有符合条件的岗位。'));
      return;
    }

    visibleJobs.forEach((job) => {
      const card = document.createElement('article');
      card.className = 'job-card';
      const title = makeText('h2', '', job.title || '未命名岗位');
      const url = safeUrl(job.url);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.append(title);
        card.append(link);
      } else {
        card.append(title);
      }
      card.append(makeText('p', 'job-company', job.company));
      card.append(makeText('p', 'job-location', job.location));
      card.append(makeText('p', 'job-description', job.description || '暂无描述'));

      const meta = document.createElement('div');
      meta.className = 'job-meta';
      meta.append(makeText('span', '', currentMark(job.id)));
      if (job.salary) meta.append(makeText('span', '', job.salary));
      card.append(meta);

      const actions = document.createElement('div');
      actions.className = 'job-actions';
      ['favorite', 'interested', 'excluded'].forEach((mark) => {
        const button = makeText('button', 'button', mark);
        button.type = 'button';
        if (currentMark(job.id) === mark) button.classList.add('is-active');
        button.addEventListener('click', () => {
          if (currentMark(job.id) === mark) delete state.marks[job.id];
          else state.marks[job.id] = mark;
          saveState();
          render();
        });
        actions.append(button);
      });
      const note = document.createElement('textarea');
      note.className = 'job-note';
      note.rows = 2;
      note.setAttribute('aria-label', `岗位备注：${text(job.title || job.id)}`);
      note.placeholder = '添加临时备注';
      note.value = state.notes[job.id] || '';
      note.addEventListener('change', () => {
        if (note.value.trim()) state.notes[job.id] = note.value.trim();
        else delete state.notes[job.id];
        saveState();
      });
      actions.append(note);
      card.append(actions);
      listElement.append(card);
    });
  };

  exportElement.addEventListener('click', () => {
    const timestamp = new Date().toISOString();
    const knownIds = new Set(jobs.map((job) => job.id));
    const ids = new Set([...Object.keys(state.marks), ...Object.keys(state.notes)]);
    const records = [...ids].filter((id) => knownIds.has(id)).sort().map((jobId) => ({
      jobId,
      mark: state.marks[jobId] || 'none',
      note: state.notes[jobId] || '',
      timestamp,
    }));
    const blob = new Blob([JSON.stringify({ records, knownJobIds: [...knownIds].sort(), unknownIds: [...ids].filter((id) => !knownIds.has(id)).sort(), updatedAt: timestamp }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'jh-interest-marks.json';
    link.click();
    URL.revokeObjectURL(link.href);
    statusElement.textContent = `已导出 ${records.length} 条兴趣标记。`;
  });

  searchElement.addEventListener('input', render);
  markFilterElement.addEventListener('change', render);
  render();
})();
