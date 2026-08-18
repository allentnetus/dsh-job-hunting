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

  if (!dataElement) return;
  if (!listElement || !countElement || !statusElement || !searchElement || !markFilterElement || !exportElement) {
    if (document.getElementById('reference-job-site')) initReferenceSite(dataElement);
    else if (document.getElementById('job-hub')) initModernSite(dataElement);
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
      card.className = 'job-row';
      const titleCell = document.createElement('div');
      titleCell.className = 'job-title-cell';
      const title = makeText('h2', '', job.title || '未命名岗位');
      const url = safeUrl(job.url);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.append(title);
        titleCell.append(link);
      } else {
        titleCell.append(title);
      }
      titleCell.append(makeText('p', 'job-description', job.description || '暂无描述'));
      card.append(titleCell);
      card.append(makeText('p', 'job-company', job.company));
      card.append(makeText('p', 'job-location', job.location));

      const meta = document.createElement('div');
      meta.className = 'job-meta';
      meta.append(makeText('span', '', currentMark(job.id)));
      if (job.salary) meta.append(makeText('span', '', job.salary));
      titleCell.append(meta);

      const actions = document.createElement('div');
      actions.className = 'job-actions';
      ['favorite', 'interested', 'excluded'].forEach((mark) => {
        const labels = { favorite: '收藏', interested: '意向', excluded: '排除' };
        const button = makeText('button', 'button', labels[mark]);
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
      note.placeholder = '添加备注';
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
  function initModernSite(dataElement) {
    let raw = { jobs: [] };
    try {
      raw = JSON.parse(dataElement.textContent || '{"jobs":[]}');
    } catch {
      raw = { jobs: [] };
    }

    const palette = {
      '金融IT': ['#f0eaff', '#5b4bb0', '#d9d0fb'],
      '网络安全': ['#ffebeb', '#a32d2d', '#f5c9c9'],
      '信创/基础软件': ['#fff2df', '#a45d0a', '#f3d19e'],
      '企业服务': ['#e8f2ff', '#185fa5', '#c6ddf6'],
      'AI': ['#e4f5f1', '#0f766e', '#bde3da'],
      '机器人': ['#fceaf1', '#993556', '#f1c9d8'],
      '医疗健康': ['#eaf4df', '#3b6d11', '#cfe4b8'],
      '工业': ['#f1efe9', '#55534d', '#ddd8cf'],
      '央企院所': ['#ede8f8', '#5b4bb0', '#d9cdf0'],
      '国家电网信通系': ['#e0edfb', '#0c4a80', '#c4daf0'],
      '央企总部数字化': ['#f0e8fb', '#7044bc', '#dac7f1'],
      '央企/市属国企': ['#fff0dc', '#a45d0a', '#f1d1a2'],
      '事业单位': ['#e7f2fb', '#23608e', '#c6dfef'],
      '党政机关': ['#fde7e7', '#991b1b', '#f2c6c6'],
      '其他': ['#f1efe9', '#55534d', '#ddd8cf'],
    };
    const industryOrder = Object.keys(palette);
    const text = (value) => (value == null ? '' : String(value));
    const esc = (value) => text(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    const safeUrl = (value) => {
      if (!value) return '';
      try {
        const parsed = new URL(String(value), window.location.href);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
      } catch {
        return '';
      }
    };
    const normalizeDate = (value) => {
      const match = text(value).match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    };
    const cityName = (value) => {
      const city = text(value).trim();
      if (city.includes('北京')) return '北京';
      if (city.includes('天津')) return '天津';
      return city || '其他';
    };
    const industryName = (job) => {
      const explicit = text(job.industry || job.category).trim();
      if (industryOrder.includes(explicit)) return explicit;
      const haystack = [job.title, job.company, job.description, ...(job.requirements || [])].join(' ').toLowerCase();
      if (/金融|银行|证券|保险|基金/.test(haystack)) return '金融IT';
      if (/安全|攻防|等保|密码/.test(haystack)) return '网络安全';
      if (/信创|国产化|中间件|操作系统|数据库/.test(haystack)) return '信创/基础软件';
      if (/企业服务|saas|crm|erp/.test(haystack)) return '企业服务';
      if (/ai|人工智能|大模型|算法|智能体|机器学习|产品经理/.test(haystack)) return 'AI';
      if (/机器人|具身智能/.test(haystack)) return '机器人';
      if (/医疗|健康|医院|医药/.test(haystack)) return '医疗健康';
      if (/制造|工业|机床|工厂/.test(haystack)) return '工业';
      if (/电网|电力|信通/.test(haystack)) return '国家电网信通系';
      if (/央企|国企|集团总部/.test(haystack)) return '央企/市属国企';
      if (/事业单位/.test(haystack)) return '事业单位';
      if (/政府|机关|公务/.test(haystack)) return '党政机关';
      return '其他';
    };
    const normalizedJobs = (Array.isArray(raw.jobs) ? raw.jobs : []).map((job, index) => {
      const key = text(job.id || job.url || `job-${index + 1}`);
      const requirements = Array.isArray(job.requirements) ? job.requirements.map(text).filter(Boolean) : [];
      return {
        ...job,
        key,
        title: text(job.title || '未命名岗位'),
        company: text(job.company || '未注明单位'),
        city: cityName(job.location),
        url: safeUrl(job.url),
        date: normalizeDate(job.postedAt || job.collectedAt || raw.generatedAt) || '未注明日期',
        industry: industryName(job),
        description: text(job.description || requirements.join('；') || '暂无 JD 摘要'),
        requirements,
        source: text(job.source || '本地采集'),
        salary: text(job.salary),
        deadline: text(job.deadline),
        matchScore: typeof job.matchScore === 'number' ? job.matchScore : Number.isFinite(Number(job.matchScore)) ? Number(job.matchScore) : null,
        matchReasons: Array.isArray(job.matchReasons) ? job.matchReasons.map(text).filter(Boolean) : [],
      };
    });
    const dates = [...new Set(normalizedJobs.map((job) => job.date).filter((date) => date && date !== '未注明日期'))].sort().reverse();
    const storageKey = 'jh-site-interest-v1';
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
    const state = loadState();
    try {
      const legacyFav = JSON.parse(localStorage.getItem('jd_fav') || '{}');
      normalizedJobs.forEach((job) => {
        if (legacyFav[job.url] && !state.marks[job.key]) state.marks[job.key] = 'interested';
      });
    } catch {
      // Older localStorage data is optional.
    }
    const saveState = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* keep UI usable */ }
    };

    let view = 'all';
    let city = '';
    let date = dates[0] || '';
    let industry = '';
    let keyword = '';
    const el = (id) => document.getElementById(id);
    const markFor = (job) => state.marks[job.key] || 'none';
    const cityMatches = (job) => !city || job.city === city;
    const keywordMatches = (job) => {
      if (!keyword) return true;
      const haystack = [job.title, job.company, job.city, job.description, job.source, job.industry].join(' ').toLowerCase();
      return haystack.includes(keyword.toLowerCase());
    };
    const matches = (job, options = {}) => {
      if (view === 'interested' && markFor(job) !== 'interested') return false;
      if (!options.ignoreDate && date && job.date !== date) return false;
      if (!options.ignoreIndustry && industry && job.industry !== industry) return false;
      if (!cityMatches(job) || !keywordMatches(job)) return false;
      return true;
    };
    const filteredJobs = () => normalizedJobs.filter((job) => matches(job));
    const formatUpdate = (value) => {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) return text(value) || '--';
      return parsed.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    };
    const weekday = (value) => {
      const parsed = new Date(`${value}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return '';
      return ['日', '一', '二', '三', '四', '五', '六'][parsed.getDay()];
    };
    const parseDeadline = (job) => {
      if (job.deadline) {
        const parsed = new Date(job.deadline);
        if (!Number.isNaN(parsed.getTime())) return parsed;
      }
      const found = job.description.match(/(\d{1,2})月(\d{1,2})日(?:\s*(\d{1,2}:\d{2}))?\s*(?:截止|报名)/);
      if (found) {
        const year = Number((job.date || '').slice(0, 4)) || new Date().getFullYear();
        const time = found[3] ? found[3].split(':').map(Number) : [23, 59];
        return new Date(year, Number(found[1]) - 1, Number(found[2]), time[0], time[1]);
      }
      return null;
    };
    const daysUntil = (deadline) => {
      const base = new Date((raw.generatedAt || new Date().toISOString()).slice(0, 10));
      const target = new Date(deadline.toISOString().slice(0, 10));
      return Math.round((target - base) / 86400000);
    };
    const deadlineLabel = (days) => days === 0 ? '今日截止' : days === 1 ? '1天后截止' : `${days}天后截止`;

    const renderHeader = () => {
      const interestedCount = normalizedJobs.filter((job) => markFor(job) === 'interested').length;
      if (el('all-count')) el('all-count').textContent = String(normalizedJobs.length);
      if (el('interested-count')) el('interested-count').textContent = String(interestedCount);
      if (el('last-update')) el('last-update').textContent = formatUpdate(raw.generatedAt);
      const sources = [...new Set(normalizedJobs.map((job) => job.source).filter(Boolean))];
      if (el('source-summary')) el('source-summary').textContent = `${sources.length || 1} 个来源 · 本地采集`;
      document.querySelectorAll('#top-tabs .top-view').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
    };
    const renderCities = () => {
      const known = new Set([...document.querySelectorAll('#city-nav .city-tab')].map((button) => button.dataset.city));
      const extraCities = [...new Set(normalizedJobs.map((job) => job.city))].filter((name) => name !== '北京' && name !== '天津' && name !== '其他' && !known.has(name)).slice(0, 3);
      extraCities.forEach((name) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'city-tab';
        button.dataset.city = name;
        button.textContent = name;
        el('city-nav').append(button);
      });
      document.querySelectorAll('#city-nav .city-tab').forEach((button) => button.classList.toggle('is-active', button.dataset.city === city));
    };
    const renderNotice = () => {
      const items = normalizedJobs.map((job) => {
        const deadline = parseDeadline(job);
        return deadline ? { job, deadline, days: daysUntil(deadline) } : null;
      }).filter((item) => item && item.days >= 0 && item.days <= 7).sort((a, b) => a.days - b.days || a.job.title.localeCompare(b.job.title));
      const noticeList = el('notice-list');
      if (!noticeList) return;
      if (!items.length) {
        noticeList.innerHTML = '<p class="notice-empty">当前采集未发现 7 天内截止岗位，建议优先核验带有明确截止日期的公告。</p>';
        return;
      }
      noticeList.innerHTML = items.slice(0, 3).map(({ job, days }) => `<div class="notice-item"><span class="notice-badge">${deadlineLabel(days)}</span><span class="notice-copy"><strong>${esc(job.company)} · ${esc(job.title)}</strong>（${esc(job.city)}）</span></div>`).join('');
    };
    const countForIndustry = (name) => normalizedJobs.filter((job) => matches(job, { ignoreIndustry: true }) && (!name || job.industry === name)).length;
    const renderIndustries = () => {
      const allCount = countForIndustry('');
      const items = [{ name: '', label: '全部行业', count: allCount }].concat(industryOrder.map((name) => ({ name, label: name, count: countForIndustry(name) })));
      const container = el('industrysel');
      container.innerHTML = items.map((item) => {
        const colors = palette[item.label] || palette['其他'];
        const active = industry === item.name;
        const style = item.name ? ` style="--chip-bg:${colors[0]};--chip-fg:${colors[1]};--chip-line:${colors[2]}"` : '';
        return `<button class="industry-chip${active ? ' is-active' : ''}" type="button" data-industry="${esc(item.name)}"${style}>${esc(item.label)}<span class="chip-count">${item.count}</span></button>`;
      }).join('');
    };
    const renderDates = () => {
      const list = el('date-nav');
      const dateCounts = dates.map((day) => ({ day, count: normalizedJobs.filter((job) => job.date === day && matches(job, { ignoreDate: true })).length }));
      if (view !== 'interested' && !dateCounts.some((item) => item.day === date)) date = dateCounts[0]?.day || '';
      list.innerHTML = dateCounts.length ? dateCounts.map(({ day, count }, index) => {
        const active = view !== 'interested' && day === date;
        const label = index === 0 ? '今天' : day.slice(5);
        return `<button class="date-entry${active ? ' is-active' : ''}" type="button" data-date="${esc(day)}"><span><span class="date-label">${label}</span><span class="date-value">${day}</span></span><span class="date-count">${count}</span></button>`;
      }).join('') : '<p class="summary-empty" style="padding:16px">暂无日期</p>';
    };
    const renderDayHeading = (list) => {
      const current = view === 'interested' ? '全部日期' : (date || '未注明日期');
      const cityCounts = {};
      list.forEach((job) => { cityCounts[job.city] = (cityCounts[job.city] || 0) + 1; });
      if (el('day-title')) el('day-title').textContent = current === '全部日期' || current === '未注明日期' ? current : `${current} · 星期${weekday(current)}`;
      if (el('day-stats')) el('day-stats').innerHTML = `当天 <strong>${list.length}</strong> 条 · 北京 <strong>${cityCounts['北京'] || 0}</strong> / 天津 <strong>${cityCounts['天津'] || 0}</strong> · 感兴趣 <strong>${list.filter((job) => markFor(job) === 'interested').length}</strong>`;
    };
    const sourceLabel = (job) => {
      const url = job.url.toLowerCase();
      if (url.includes('zhipin')) return 'BOSS直聘';
      if (url.includes('liepin')) return '猎聘';
      if (url.includes('51job')) return '前程无忧';
      if (url.includes('zhaopin')) return '智联招聘';
      return job.source || '官方/其他';
    };
    const rowHtml = (job) => {
      const mark = markFor(job);
      const colors = palette[job.industry] || palette['其他'];
      const description = job.description.replace(/\s+/g, ' ').trim();
      const scoreTag = job.matchScore == null ? '' : `<span class="job-tag match">匹配 ${Math.round(job.matchScore)}</span>`;
      const salaryTag = job.salary ? `<span class="job-tag">${esc(job.salary)}</span>` : '';
      const tags = `<span class="job-tag industry" style="--tag-bg:${colors[0]};--tag-fg:${colors[1]};--tag-line:${colors[2]}">${esc(job.industry)}</span>${salaryTag}${scoreTag}`;
      const title = job.url ? `<a href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">${esc(job.title)}</a>` : esc(job.title);
      const link = job.url ? `<a class="job-link" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">查看原链 ↗</a>` : '';
      return `<article class="job-row${mark === 'interested' ? ' is-interested' : ''}${mark === 'excluded' ? ' is-excluded' : ''}" data-job="${esc(job.key)}"><div class="job-main"><div class="job-title-line"><h3 class="job-title">${title}</h3></div><p class="job-company">${esc(job.company)}</p><p class="job-location">${esc(job.city)} · ${esc(sourceLabel(job))}</p><div class="job-tags">${tags}</div></div><div class="job-summary"><span class="job-summary-label">岗位要求 / 职责摘要</span><p>${esc(description)}</p></div><div class="job-actions"><button class="mark-button${mark === 'favorite' ? ' is-active' : ''}" type="button" data-mark="favorite">收藏</button><button class="mark-button${mark === 'interested' ? ' is-active' : ''}" type="button" data-mark="interested">感兴趣</button><button class="mark-button${mark === 'excluded' ? ' is-active' : ''}" type="button" data-mark="excluded">排除</button><textarea class="job-note" rows="1" aria-label="${esc(`岗位备注：${job.title}`)}" data-note placeholder="添加临时备注">${esc(state.notes[job.key] || '')}</textarea>${link}</div></article>`;
    };
    const renderContent = () => {
      const list = filteredJobs();
      renderDayHeading(list);
      if (el('rescount')) el('rescount').textContent = `筛选出 ${list.length} 条`;
      const content = el('content');
      if (!list.length) {
        content.innerHTML = `<div class="empty-state">${view === 'interested' ? '还没有标记为感兴趣的岗位。' : '当前筛选条件下暂无岗位。'}</div>`;
        return;
      }
      content.innerHTML = `<div class="list-head"><span>岗位信息</span><span>岗位要求 / 职责摘要</span><span>状态与备注</span></div>${list.map(rowHtml).join('')}`;
    };
    const fallbackRecommendations = () => normalizedJobs.filter((job) => !city || cityMatches(job)).slice().sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1) || a.title.localeCompare(b.title)).slice(0, 5);
    const currentMeta = () => {
      const meta = raw.meta || raw.metadata || {};
      return meta[date] || meta;
    };
    const renderSummary = () => {
      const meta = currentMeta();
      const sources = [...new Set(normalizedJobs.map((job) => job.source).filter(Boolean))];
      const notes = text(meta.platform_notes || meta.platformNotes || `本次采集共整理 ${normalizedJobs.length} 条岗位，来源包括 ${sources.join('、') || '本地文件'}。岗位详情、标记和备注均保存在当前浏览器。`);
      const rawExcluded = Array.isArray(meta.excluded) ? meta.excluded : [];
      const expired = normalizedJobs.map((job) => { const deadline = parseDeadline(job); return deadline && daysUntil(deadline) < 0 ? { unit: `${job.company} · ${job.title}`, reason: `报名截止 ${deadline.toISOString().slice(5, 16).replace('T', ' ')}，已过期` } : null; }).filter(Boolean);
      const excluded = rawExcluded.length ? rawExcluded : expired.slice(0, 8);
      const recommendationItems = Array.isArray(meta.recommendations) && meta.recommendations.length ? meta.recommendations.map((value) => ({ text: text(value), job: null })) : fallbackRecommendations().map((job) => ({ text: `${job.title}（${job.city}${job.salary ? `，${job.salary}` : ''}）— ${job.matchReasons.join('；') || '与目标方向匹配，建议优先核验岗位详情。'}`, job }));
      const nextSteps = text(meta.next_steps || meta.nextSteps || '立即核验临近截止岗位；本周优先投递高匹配岗位；对连续多日无新增的渠道降低权重，继续跟踪官方直链。');
      const excludedHtml = excluded.length ? `<table class="summary-table"><thead><tr><th>单位 · 岗位</th><th>原因</th></tr></thead><tbody>${excluded.map((item) => `<tr><td>${esc(item.unit || item.title || '')}</td><td>${esc(item.reason || '')}</td></tr>`).join('')}</tbody></table>` : '<p class="summary-empty">暂无已排查不匹配或已过期公告。</p>';
      const recHtml = recommendationItems.length ? `<ol class="recommendation-list">${recommendationItems.slice(0, 10).map(({ text: itemText, job }) => { const score = job?.matchScore == null ? 4 : job.matchScore >= 90 ? 5 : job.matchScore >= 75 ? 4 : 3; const link = job?.url ? `<a class="recommendation-link" href="${esc(job.url)}" target="_blank" rel="noopener noreferrer">原链 ↗</a>` : ''; return `<li><span class="star-score">${'★'.repeat(score)}</span> ${esc(itemText)}${link}</li>`; }).join('')}</ol>` : '<p class="summary-empty">暂无重点推荐。</p>';
      el('bottom-summary').innerHTML = `<div class="summary-header"><h2>采集总结与下一步</h2><button class="summary-toggle" type="button" data-summary-toggle>折叠</button></div><div class="summary-body"><div class="summary-section-block"><h3>平台采集说明</h3><p>${esc(notes).replace(/\n/g, '<br>')}</p></div><div class="summary-section-block"><h3>已排查不匹配 / 已过期公告</h3>${excludedHtml}</div><div class="summary-section-block recommendation-block"><h3>重点推荐（按匹配度排序）</h3>${recHtml}</div><div class="summary-section-block"><h3>下一步建议</h3><p>${esc(nextSteps).replace(/\n/g, '<br>')}</p></div></div>`;
    };
    const render = () => {
      renderHeader();
      renderCities();
      renderNotice();
      renderDates();
      renderIndustries();
      renderContent();
      renderSummary();
    };

    el('top-tabs')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-view]');
      if (!button) return;
      view = button.dataset.view || 'all';
      if (view === 'interested') date = '';
      else if (!date) date = dates[0] || '';
      render();
    });
    el('city-nav')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-city]');
      if (!button) return;
      city = button.dataset.city || '';
      render();
    });
    el('date-nav')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-date]');
      if (!button) return;
      date = button.dataset.date || '';
      if (view === 'interested') view = 'all';
      render();
    });
    el('industrysel')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-industry]');
      if (!button) return;
      industry = button.dataset.industry || '';
      render();
    });
    el('searchbox')?.addEventListener('input', (event) => { keyword = event.target.value.trim(); render(); });
    el('content')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-mark]');
      if (!button) return;
      const row = button.closest('[data-job]');
      const job = normalizedJobs.find((item) => item.key === row?.dataset.job);
      if (!job) return;
      const mark = button.dataset.mark;
      state.marks[job.key] = markFor(job) === mark ? 'none' : mark;
      saveState();
      render();
    });
    el('content')?.addEventListener('change', (event) => {
      const note = event.target.closest('[data-note]');
      const row = note?.closest('[data-job]');
      if (!note || !row) return;
      const value = note.value.trim();
      if (value) state.notes[row.dataset.job] = value;
      else delete state.notes[row.dataset.job];
      saveState();
    });
    el('bottom-summary')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-summary-toggle]');
      if (!button) return;
      const body = el('bottom-summary').querySelector('.summary-body');
      const collapsed = body.style.display === 'none';
      body.style.display = collapsed ? '' : 'none';
      button.textContent = collapsed ? '折叠' : '展开';
    });
    el('export-button')?.addEventListener('click', () => {
      const timestamp = new Date().toISOString();
      const records = normalizedJobs.filter((job) => state.marks[job.key] && state.marks[job.key] !== 'none' || state.notes[job.key]).map((job) => ({ jobId: job.key, mark: state.marks[job.key] || 'none', note: state.notes[job.key] || '', timestamp }));
      const blob = new Blob([JSON.stringify({ records, knownJobIds: normalizedJobs.map((job) => job.key), updatedAt: timestamp }, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'jh-interest-marks.json';
      link.click();
      URL.revokeObjectURL(link.href);
    });
    render();
  }
  function initReferenceSite(dataElement) {
    let raw = { jobs: [] };
    try { raw = JSON.parse(dataElement.textContent || '{"jobs":[]}'); } catch { raw = { jobs: [] }; }
    const text = (value) => (value == null ? '' : String(value));
    const dateOf = (job) => {
      const value = text(job.date || job.postedAt || job.collectedAt || raw.generatedAt);
      const match = value.match(/\d{4}-\d{2}-\d{2}/);
      return match ? match[0] : '';
    };
    const cityOf = (job) => {
      const value = text(job.city || job.location);
      const knownCities = [
        ['北京', ['北京', 'beijing']],
        ['上海', ['上海', 'shanghai']],
        ['天津', ['天津', 'tianjin']],
        ['广州', ['广州', 'guangzhou']],
        ['深圳', ['深圳', 'shenzhen']],
        ['杭州', ['杭州', 'hangzhou']],
        ['成都', ['成都', 'chengdu']],
        ['南京', ['南京', 'nanjing']],
        ['武汉', ['武汉', 'wuhan']],
        ['西安', ['西安', "xi'an", 'xian']],
      ];
      const lower = value.toLowerCase();
      const hit = knownCities.find(([, aliases]) => aliases.some((alias) => lower.includes(alias.toLowerCase())));
      if (hit) return hit[0];
      return value || '其他';
    };
    const industryOf = (job) => {
      const explicit = text(job.industry || job.category).trim();
      const known = ['金融IT','网络安全','信创/基础软件','企业服务','AI','机器人','医疗健康','工业','央企院所','国家电网信通系','央企总部数字化','央企/市属国企','事业单位','党政机关','其他'];
      if (known.includes(explicit)) return explicit;
      const hay = [job.title, job.company, job.description, ...(Array.isArray(job.requirements) ? job.requirements : [])].map(text).join(' ').toLowerCase();
      if (/金融|银行|证券|保险|基金/.test(hay)) return '金融IT';
      if (/安全|攻防|密码|渗透/.test(hay)) return '网络安全';
      if (/信创|国产|数据库|操作系统/.test(hay)) return '信创/基础软件';
      if (/saas|crm|erp|企业服务/.test(hay)) return '企业服务';
      if (/ai|人工智能|大模型|算法|智能体|产品经理/.test(hay)) return 'AI';
      if (/机器人|机械臂/.test(hay)) return '机器人';
      if (/医疗|健康|医院|医药/.test(hay)) return '医疗健康';
      if (/制造|工业|机床|工厂/.test(hay)) return '工业';
      if (/电网|电力|国网/.test(hay)) return '国家电网信通系';
      if (/央企|国企|集团总部/.test(hay)) return '央企/市属国企';
      if (/事业单位/.test(hay)) return '事业单位';
      if (/政府|机关|公务员/.test(hay)) return '党政机关';
      return '其他';
    };
    const normalizeIndustryText = (value) => text(value).toLowerCase().replace(/[\s·/／＋+_-]/g, '');
    const selection = raw.selection || raw.preferences || raw.profile || {};
    const selectedCities = Array.isArray(selection.cities || selection.preferredLocations)
      ? (selection.cities || selection.preferredLocations).map(text).map((value) => cityOf({ city: value.trim() })).filter(Boolean)
      : [];
    const selectedIndustries = Array.isArray(selection.industries || selection.targetIndustries)
      ? (selection.industries || selection.targetIndustries).map(text).map((value) => value.trim()).filter(Boolean)
      : [];
    const selectedIndustriesByCity = selection.industriesByCity && typeof selection.industriesByCity === 'object'
      ? Object.fromEntries(Object.entries(selection.industriesByCity).map(([city, industries]) => [
        cityOf({city}),
        Array.isArray(industries) ? industries.map(text).map((value) => value.trim()).filter(Boolean) : [],
      ]))
      : {};
    const shareIndustriesAcrossCities = selection.shareIndustriesAcrossCities !== undefined
      ? selection.shareIndustriesAcrossCities
      : Object.keys(selectedIndustriesByCity).length === 0;
    const selectedIndustriesForCity = (city) => {
      if (!shareIndustriesAcrossCities && Object.prototype.hasOwnProperty.call(selectedIndustriesByCity, city)) {
        return selectedIndustriesByCity[city];
      }
      return selectedIndustries;
    };
    const selectedIndustryFor = (job) => {
      const industriesForJob = selectedIndustriesForCity(cityOf(job));
      if (!industriesForJob.length) return industryOf(job);
      const classified = industryOf(job);
      const explicit = text(job.industry || job.category).trim();
      const hay = [job.title, job.company, job.description, job.industry, job.category, classified, ...(Array.isArray(job.requirements) ? job.requirements : [])]
        .map(text).join(' ');
      const normalizedHay = normalizeIndustryText(hay);
      const exact = industriesForJob.find((value) => normalizedHay.includes(normalizeIndustryText(value)));
      if (exact) return exact;
      const canonical = industriesForJob.find((value) => normalizeIndustryText(value) === normalizeIndustryText(classified));
      return canonical || explicit || classified;
    };
    const matchesSelection = (job) => {
      const city = cityOf(job);
      if (selectedCities.length && !selectedCities.some((value) => city === value || city.includes(value) || value.includes(city))) return false;
      const industriesForCity = selectedIndustriesForCity(city);
      if (industriesForCity.length) {
        const classifiedIndustry = industryOf(job);
        const hay = [job.title, job.company, job.description, job.industry, job.category, classifiedIndustry, ...(Array.isArray(job.requirements) ? job.requirements : [])]
          .map(text).join(' ');
        const normalizedHay = normalizeIndustryText(hay);
        if (!industriesForCity.some((value) => normalizedHay.includes(normalizeIndustryText(value)) || normalizeIndustryText(value) === normalizeIndustryText(classifiedIndustry))) return false;
      }
      return true;
    };
    const jobs = (Array.isArray(raw.jobs) ? raw.jobs : []).filter(matchesSelection).map((job, index) => {
      const requirements = Array.isArray(job.requirements) ? job.requirements.map(text).filter(Boolean) : [];
      return {
        ...job,
        id: text(job.id || job.url || `job-${index + 1}`),
        title: text(job.title || '未命名岗位'),
        company: text(job.company || '未注明单位'),
        url: text(job.url),
        date: dateOf(job),
        city: cityOf(job),
        industry: selectedIndustryFor(job),
        note: text(job.note || job.deadline || job.source),
        source: text(job.source || '本地采集'),
        is_champion: Boolean(job.is_champion || (typeof job.matchScore === 'number' && job.matchScore >= 90)),
      };
    });
    const dates = [...new Set(jobs.map((job) => job.date).filter(Boolean))].sort().reverse();
    const today = text(raw.today || dates[0] || '');
    const meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    if (!Object.keys(meta).length) {
      dates.forEach((date) => {
        const sources = [...new Set(jobs.filter((job) => job.date === date).map((job) => job.source).filter(Boolean))];
        const build = (city) => ({
          platform_notes: `本次采集 ${jobs.filter((job) => job.date === date && (!city || job.city === city)).length} 条岗位，来源：${sources.join('、') || '本地数据'}。支持按城市、日期、行业和关键词筛选，标记记录保存在当前浏览器。`,
          excluded: [],
          recommendations: jobs.filter((job) => job.date === date && (!city || job.city === city)).slice(0, 5).map((job) => `**${job.company} · ${job.title}**（${job.city}）— ${job.note || '建议优先核验岗位详情。'}`),
          next_steps: '优先核验临近截止岗位；本周投递高匹配岗位；持续关注官方直链与更新日期。'
        });
        meta[date] = { 北京: build('北京'), 天津: build('天津') };
      });
    }
    window.JD_DATA = { ...raw, jobs, today, meta };
(function () {
  var DATA = window.JD_DATA;
  var JOBS = DATA.jobs || [];
  var META = DATA.meta || {};
  var TODAY = DATA.today || '';
  var CITY = '';
  var IND = '';
  var DATE = '';
  var KW = '';
  var VIEW = 'all';

  var IND_COLORS = {
    '金融IT':['#F1EDFE','#5B4BB0'],'网络安全':['#FCEBEB','#A32D2D'],'信创/基础软件':['#FDF3E3','#B45309'],
    '企业服务':['#E6F1FB','#185FA5'],'AI':['#E6F5F2','#0F766E'],'机器人':['#FBEAF0','#993556'],
    '医疗健康':['#EAF3DE','#3B6D11'],'工业':['#F1EFE8','#444441'],'央企院所':['#ECE7F7','#5B4BB0'],
    '国家电网信通系':['#DCEBFA','#0C447C'],'央企总部数字化':['#EFE7F7','#7C3AED'],
    '央企/市属国企':['#FDF3E3','#B45309'],'事业单位':['#E6F1FB','#185FA5'],'党政机关':['#FBE3E3','#8F1D1D'],
    '其他':['#F1EFE8','#444441']
  };
  var IND_ORDER = ['金融IT','网络安全','信创/基础软件','企业服务','AI','机器人','医疗健康','工业','央企院所','国家电网信通系','央企总部数字化','央企/市属国企','事业单位','党政机关','其他'];
  var SCOPE = DATA.selection || DATA.preferences || DATA.profile || {};
  var SCOPED_CITIES = (Array.isArray(SCOPE.cities || SCOPE.preferredLocations) ? (SCOPE.cities || SCOPE.preferredLocations) : []).filter(Boolean).map(function (value) { return cityOf({city: String(value)}); });
  var SCOPED_INDUSTRIES = (Array.isArray(SCOPE.industries || SCOPE.targetIndustries) ? (SCOPE.industries || SCOPE.targetIndustries) : []).filter(Boolean).map(String);
  var SCOPED_INDUSTRIES_BY_CITY = SCOPE.industriesByCity && typeof SCOPE.industriesByCity === 'object'
    ? Object.fromEntries(Object.entries(SCOPE.industriesByCity).map(function (entry) {
      return [cityOf({city: String(entry[0])}), Array.isArray(entry[1]) ? entry[1].filter(Boolean).map(String) : []];
    }))
    : {};
  var SHARE_INDUSTRIES = SCOPE.shareIndustriesAcrossCities !== undefined
    ? SCOPE.shareIndustriesAcrossCities
    : Object.keys(SCOPED_INDUSTRIES_BY_CITY).length === 0;
  if (SCOPED_CITIES.length === 1) CITY = SCOPED_CITIES[0];

  function favStore() {
    try { return JSON.parse(localStorage.getItem('jd_fav') || '{}'); } catch (e) { return {}; }
  }
  function saveFav(s) { localStorage.setItem('jd_fav', JSON.stringify(s)); }
  function isFav(url) { return !!favStore()[url]; }
  function toggleFav(url) { var s = favStore(); s[url] = !s[url]; saveFav(s); render(); }
  window.toggleFav = toggleFav;

  function parseDeadline(note) {
    if (!note) return null;
    var m = note.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2}:\d{2})?\s*截止/);
    if (m) {
      var y = new Date().getFullYear();
      var dt = new Date(y, +m[1] - 1, +m[2], m[3] ? +m[3].split(':')[0] : 0, m[3] ? +m[3].split(':')[1] : 0);
      return dt;
    }
    m = note.match(/今日\s*(\d{1,2}:\d{2})?\s*截止/);
    if (m) {
      var d = new Date();
      return new Date(d.getFullYear(), d.getMonth(), d.getDate(), m[1] ? +m[1].split(':')[0] : 23, m[1] ? +m[1].split(':')[1] : 59);
    }
    m = note.match(/(\d{1,2})\/(\d{1,2})\s*截止/);
    if (m) return new Date(new Date().getFullYear(), +m[1] - 1, +m[2], 23, 59);
    return null;
  }
  function daysLeft(dt) {
    var now = new Date();
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var b = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    return Math.round((b - a) / 86400000);
  }

  function esc(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function tag(txt, cls) { return '<span class="' + cls + '">' + esc(txt) + '</span>'; }
  function indTag(j) {
    var c = IND_COLORS[j.industry] || IND_COLORS['其他'];
    return '<span class="tag" style="background:' + c[0] + ';color:' + c[1] + '">' + esc(j.industry) + '</span>';
  }
  function dlTag(note) {
    var dt = parseDeadline(note);
    if (!dt) return '';
    var d = daysLeft(dt);
    if (d < 0) return '';
    var lbl = d === 0 ? '今日截止' : (d + '天后截止');
    return '<span class="deadline ' + (d <= 1 ? 'dl-red' : 'dl-amber') + '">' + lbl + '</span>';
  }
  function sourceOf(j) {
    var u = j.url || '';
    if (u.indexOf('zhipin') > -1) return 'BOSS直聘';
    if (u.indexOf('liepin') > -1) return '猎聘';
    if (u.indexOf('zhaopin') > -1) return '智联';
    if (u.indexOf('51job') > -1) return '前程无忧';
    if (u.indexOf('iguopin') > -1) return '国聘';
    return '官方/其他';
  }

  // Shared candidate logic keeps the city and industry filters in sync. Each
  // filter list is derived from the other active selections, so choosing one
  // dimension narrows the available choices in the other dimension.
  function matches(j, opts) {
    opts = opts || {};
    var favSet = VIEW === 'fav' ? favStore() : null;
    if (favSet && !favSet[j.url]) return false;
    if (!opts.ignoreDate && DATE && j.date !== DATE) return false;
    if (!opts.ignoreCity && CITY && j.city !== CITY) return false;
    if (!opts.ignoreIndustry && IND && j.industry !== IND) return false;
    if (KW) {
      var hay = (j.title + ' ' + j.company + ' ' + j.note + ' ' + sourceOf(j)).toLowerCase();
      if (hay.indexOf(KW.toLowerCase()) < 0) return false;
    }
    return true;
  }
  function hasMatch(opts) { return JOBS.some(function (j) { return matches(j, opts); }); }
  function normalizeSelections() {
    if (CITY && IND && !hasMatch()) {
      // Preserve the most recently meaningful dimension when a date/search
      // change makes the previous city + industry pair incompatible.
      if (!hasMatch({ignoreCity: true})) CITY = '';
      else if (!hasMatch({ignoreIndustry: true})) IND = '';
      else { CITY = ''; IND = ''; }
    }
    if (CITY && !hasMatch({ignoreCity: false})) CITY = '';
    if (IND && !hasMatch({ignoreIndustry: false})) IND = '';
  }

  function buildCities() {
    var counts = {};
    JOBS.forEach(function (j) {
      if (!matches(j, {ignoreCity: true})) return;
      var city = j.city || '其他';
      counts[city] = (counts[city] || 0) + 1;
    });
    var preferred = ['北京', '天津'];
    var cities = SCOPED_CITIES.length ? SCOPED_CITIES.slice() : preferred.filter(function (c) { return counts[c]; });
    if (!SCOPED_CITIES.length) {
      Object.keys(counts).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }).forEach(function (c) {
        if (cities.indexOf(c) < 0) cities.push(c);
      });
    }
    var html = SCOPED_CITIES.length ? '' : '<button class="ct' + (CITY === '' ? ' on' : '') + '" data-city="">全部城市</button>';
    cities.forEach(function (c) {
      html += '<button class="ct' + (CITY === c ? ' on' : '') + '" data-city="' + esc(c) + '">' + esc(c) + '</button>';
    });
    document.getElementById('citytab').innerHTML = html;
  }

  function buildAlert() {
    var items = [];
    JOBS.forEach(function (j) {
      var dt = parseDeadline(j.note);
      if (!dt) return;
      var d = daysLeft(dt);
      if (d < 0 || d > 7) return;
      items.push({d: d, j: j});
    });
    if (!items.length) { document.getElementById('alertbox').innerHTML = ''; return; }
    items.sort(function (a, b) { return a.d - b.d; });
    var html = items.slice(0, 3).map(function (it) {
      var txt = it.d === 0 ? '今日截止' : (it.d + '天后截止');
      return '<span class="al-item"><span class="al-tag">' + txt + '</span><span class="al-txt"><b>' + esc(it.j.company) + ' · ' + esc(it.j.title) + '</b>（' + esc(it.j.city) + '）</span></span>';
    }).join('<span style="color:#E5B4B4;margin:0 2px">|</span>');
    document.getElementById('alertbox').innerHTML =
      '<div class="alert"><span class="badge">截止提醒</span><div class="al-body">' + html + '</div></div>';
  }

  function buildSide() {
    var favSet = VIEW === 'fav' ? favStore() : null;
    var cnt = {};
    JOBS.forEach(function (j) {
      if (favSet && !favSet[j.url]) return;
      if (CITY && j.city !== CITY) return;
      if (IND && j.industry !== IND) return;
      if (KW) {
        var hay = (j.title + ' ' + j.company + ' ' + j.note + ' ' + sourceOf(j)).toLowerCase();
        if (hay.indexOf(KW.toLowerCase()) < 0) return;
      }
      cnt[j.date] = (cnt[j.date] || 0) + 1;
    });
    var dates = Object.keys(cnt).sort().reverse();
    if (dates.indexOf(DATE) < 0) DATE = '';
    if (!DATE && VIEW !== 'fav' && dates.length) DATE = dates[0];
    var html = '';
    if (!dates.length) {
      html = '<div style="padding:14px 12px;font-size:12px;color:var(--ink-3);text-align:center;line-height:1.5">' + (VIEW === 'fav' ? '暂无收藏<br><span style="font-size:11px">点岗位上的「感兴趣」收藏</span>' : '暂无数据') + '</div>';
    } else {
      dates.forEach(function (d) {
        var isToday = d === TODAY;
        var label = isToday ? '今天' : d.slice(5);
        var on = d === DATE ? ' on' : '';
        html += '<div class="dt' + (isToday ? ' today' : '') + on + '" data-date="' + d + '"><span class="d">' + label + '</span><span class="n">' + cnt[d] + '</span></div>';
      });
    }
    document.getElementById('sidedays').innerHTML = html;
  }

  function buildIndustry() {
    var available = {};
    JOBS.forEach(function (j) {
      // Shared mode builds one taxonomy from all active cities. Per-city mode
      // derives the menu from the selected city, when the user requested it.
      var options = !SHARE_INDUSTRIES && CITY ? {} : {ignoreCity: true};
      if (!matches(j, Object.assign(options, {ignoreIndustry: true}))) return;
      var industry = j.industry || '其他';
      available[industry] = (available[industry] || 0) + 1;
    });
    var cityLabels = !SHARE_INDUSTRIES && CITY && Object.prototype.hasOwnProperty.call(SCOPED_INDUSTRIES_BY_CITY, CITY)
      ? SCOPED_INDUSTRIES_BY_CITY[CITY].slice()
      : [];
    var perCityLabels = !SHARE_INDUSTRIES
      ? Object.values(SCOPED_INDUSTRIES_BY_CITY).reduce(function (all, labels) {
        labels.forEach(function (label) { if (all.indexOf(label) < 0) all.push(label); });
        return all;
      }, [])
      : [];
    var list = cityLabels.length
      ? cityLabels
      : perCityLabels.length
        ? perCityLabels
      : SCOPED_INDUSTRIES.length
        ? SCOPED_INDUSTRIES.slice()
        : SHARE_INDUSTRIES
          ? IND_ORDER.slice()
          : Object.keys(available).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
    if (!SCOPED_INDUSTRIES.length && !cityLabels.length && SHARE_INDUSTRIES) {
      Object.keys(available).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }).forEach(function (i) {
        if (list.indexOf(i) < 0) list.push(i);
      });
    }
    function countFor(industry) {
      var n = 0;
      JOBS.forEach(function (j) {
        if (!matches(j, {ignoreIndustry: true})) return;
        if (industry && j.industry !== industry) return;
        n++;
      });
      return n;
    }
    var hasConfiguredIndustryScope = SCOPED_INDUSTRIES.length || cityLabels.length || perCityLabels.length;
    var allStyle = IND === '' ? ' style="background:var(--brand);color:#fff;border-color:var(--brand)"' : '';
    var html = hasConfiguredIndustryScope ? '' : '<span class="chip' + (IND === '' ? ' on' : '') + '" data-ind=""' + allStyle + '>全部行业<span class="chip-n">' + countFor('') + '</span></span>';
    list.forEach(function (i) {
      var c = IND_COLORS[i] || IND_COLORS['其他'];
      var on = IND === i;
      var st = on
        ? 'style="background:var(--brand);color:#fff;border-color:var(--brand)"'
        : 'style="background:' + c[0] + ';color:' + c[1] + ';border-color:' + c[0] + '"';
      html += '<span class="chip' + (on ? ' on' : '') + '" ' + st + ' data-ind="' + esc(i) + '">' + esc(i) + '<span class="chip-n">' + countFor(i) + '</span></span>';
    });
    document.getElementById('industrysel').innerHTML = html;
    var hint = document.getElementById('industryhint');
    var suggestions = Array.isArray(SCOPE.industrySuggestions) ? SCOPE.industrySuggestions : [];
    if (hint) {
      hint.innerHTML = suggestions.length
        ? '分类建议（仅供确认）：' + suggestions.map(function (s) {
          return '<b>' + esc(s.requested) + '</b> → ' + esc(s.suggested) + (s.reason ? '（' + esc(s.reason) + '）' : '');
        }).join('；') + '。最终按已协商分类展示。'
        : '';
    }
  }

  function filtered() {
    var favs = VIEW === 'fav' ? favStore() : null;
    return JOBS.filter(function (j) {
      if (DATE && j.date !== DATE) return false;
      if (CITY && j.city !== CITY) return false;
      if (IND && j.industry !== IND) return false;
      if (VIEW === 'fav' && !favs[j.url]) return false;
      if (KW) {
        var src = sourceOf(j);
        var hay = (j.title + ' ' + j.company + ' ' + j.note + ' ' + src).toLowerCase();
        if (hay.indexOf(KW.toLowerCase()) < 0) return false;
      }
      return true;
    });
  }

  function dayStats() {
    var favs = favStore();
    var day = JOBS.filter(function (j) { return j.date === DATE; });
    var byCity = {};
    var favN = 0;
    day.forEach(function (j) { byCity[j.city] = (byCity[j.city] || 0) + 1; if (favs[j.url]) favN++; });
    return {byCity: byCity, fav: favN, total: day.length};
  }

  function recUrl(rec) {
    var m = rec.match(/\*\*([^*]+?)\*\*/);
    if (!m) return '';
    var name = m[1].split('·')[0].trim();
    if (!name) return '';
    var ALIAS = { '中科曙光':'曙光信息' };
    var candidates = JOBS.filter(function (j) { return j.date === DATE; });
    function hitBy(needle) {
      return candidates.find(function (j) {
        return j.company.indexOf(needle) >= 0 || needle.indexOf(j.company) >= 0;
      });
    }
    // 1. 精确子串
    var hit = hitBy(name);
    if (hit) return hit.url;
    // 2. 去掉常见公司修饰
    var clean = name.replace(/(集团|总行|公司|股份|有限公司|有限责任|事业)$/,'');
    if (clean.length >= 3 && clean !== name) {
      hit = hitBy(clean);
      if (hit) return hit.url;
    }
    // 3. 别名映射（品牌名 ↔ 工商全称）
    var alias = ALIAS[name] || ALIAS[clean];
    if (alias) { hit = hitBy(alias); if (hit) return hit.url; }
    return '';
  }

  function renderMeta() {
    var html = '';
    var metaCities = SCOPED_CITIES.length ? SCOPED_CITIES : ['北京', '天津'];
    metaCities.forEach(function (c) {
      if (CITY && CITY !== c) return;
      var m = META[DATE] && META[DATE][c];
      if (!m) return;
      var sec = '';
      if (m.platform_notes) sec += '<div class="meta-sec"><h4>平台采集说明</h4><p>' + esc(m.platform_notes).replace(/\n/g, '<br>') + '</p></div>';
      if (m.excluded && m.excluded.length) {
        var rows = m.excluded.map(function (e) { return '<tr><td>' + esc(e.unit) + '</td><td>' + esc(e.reason) + '</td></tr>'; }).join('');
        sec += '<div class="meta-sec"><h4>已排查不匹配 / 已过期公告</h4><table><tr><td><b>单位-岗位</b></td><td><b>原因</b></td></tr>' + rows + '</table></div>';
      }
      if (m.recommendations && m.recommendations.length) {
        var rec = m.recommendations.map(function (r) {
          var url = recUrl(r);
          var link = url ? ' <a class="rec-go" href="' + esc(url) + '" target="_blank" rel="noopener">原链 ↗</a>' : '';
          return '<li>' + esc(r) + link + '</li>';
        }).join('');
        sec += '<div class="meta-sec meta-rec"><h4>重点推荐（按匹配度排序）</h4><ul>' + rec + '</ul></div>';
      }
      if (m.next_steps) sec += '<div class="meta-sec"><h4>下步建议</h4><p>' + esc(m.next_steps).replace(/\n/g, '<br>') + '</p></div>';
      if (sec) html += '<div class="meta-panel"><div class="meta-hd" onclick="this.parentNode.querySelector(\'.meta-bd\').style.display=this.parentNode.querySelector(\'.meta-bd\').style.display===\'none\'?\'block\':\'none\'"><span class="mh-left"><span class="pin"></span>' + c + ' · 今日采集说明</span><span class="meta-fold">折叠</span></div><div class="meta-bd">' + sec + '</div></div>';
    });
    return html;
  }

  function render() {
    buildAlert();
    buildSide();
    normalizeSelections();
    buildCities();
    buildIndustry();
    var favs = favStore();
    var favTotal = 0;
    JOBS.forEach(function (j) { if (favs[j.url]) favTotal++; });
    var fc = document.getElementById('favcnt');
    if (fc) fc.textContent = favTotal;
    var st = dayStats();
    var list = filtered();
    var rc = document.getElementById('rescount');
    if (rc) rc.textContent = list.length ? ('筛选出 ' + list.length + ' 条') : '';
    var html = '';
    if (VIEW === 'fav') {
      var favCities = {};
      list.forEach(function (j) { favCities[j.city] = (favCities[j.city] || 0) + 1; });
      var favSummary = Object.keys(favCities).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }).map(function (c) {
        return c + ' <b>' + favCities[c] + '</b>';
      }).join(' / ');
      html += '<div class="dayhd"><div><span class="d">⭐ 感兴趣<span class="wk">全部收藏</span></span></div>' +
        '<span class="c">共 <b>' + favTotal + '</b> 条收藏' + (favSummary ? ' · ' + favSummary : '') + '</span></div>';
    } else {
      var wd = ['日','一','二','三','四','五','六'][new Date(DATE + 'T00:00:00').getDay()];
      var citySummary = Object.keys(st.byCity).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); }).map(function (c) {
        return c + ' <b>' + st.byCity[c] + '</b>';
      }).join(' / ');
      html += '<div class="dayhd"><div><span class="d">' + DATE + '<span class="wk">周' + wd + '</span></span></div>' +
        '<span class="c">当日 <b>' + st.total + '</b> · ' + (citySummary || '暂无城市') + ' · 感兴趣 <b>' + st.fav + '</b></span></div>';
    }
    if (!list.length) { html += '<div class="empty"><span class="em">' + (VIEW === 'fav' ? '☆' : '空') + '</span>' + (VIEW === 'fav' ? '还没有标记感兴趣的岗位，点击岗位上的「感兴趣」按钮收藏' : '该条件下暂无岗位') + '</div>'; }
    else if (VIEW === 'fav') {
      var byDate = {};
      list.forEach(function (j) { (byDate[j.date] = byDate[j.date] || []).push(j); });
      Object.keys(byDate).sort().reverse().forEach(function (d) {
        html += '<div class="citysec">' + d + ' <b>' + byDate[d].length + '</b></div>';
        byDate[d].forEach(function (j) { html += rowHtml(j); });
      });
    }
    else {
      var byCity = {};
      list.forEach(function (j) { (byCity[j.city] = byCity[j.city] || []).push(j); });
      var cityOrder = Object.keys(byCity).sort(function (a, b) {
        var order = ['北京', '上海', '天津', '广州', '深圳', '杭州', '成都', '南京', '武汉', '西安'];
        var ai = order.indexOf(a), bi = order.indexOf(b);
        if (ai < 0) ai = order.length;
        if (bi < 0) bi = order.length;
        return ai - bi || a.localeCompare(b, 'zh-CN');
      });
      cityOrder.forEach(function (c) {
        html += '<div class="citysec">' + c + ' <b>' + byCity[c].length + '</b></div>';
        byCity[c].forEach(function (j) { html += rowHtml(j); });
      });
    }
    html += renderMeta();
    document.getElementById('content').innerHTML = html;
  }

  function rowHtml(j) {
    var fav = isFav(j.url);
    var champ = j.is_champion ? tag('⭐ 隐形冠军', 'champ') : '';
    var src = sourceOf(j);
    var note = j.note ? '<p class="f-note">' + esc(j.note) + '</p>' : '';
    return '<div class="row">' +
      '<div class="f-title"><p class="t">' + esc(j.title) + champ + indTag(j) + dlTag(j.note) + '</p>' + note + '</div>' +
      '<div class="f-co" title="' + esc(j.company) + '">' + esc(j.company) + '</div>' +
      '<div class="f-src">' + esc(src) + '</div>' +
      '<div class="acts"><span class="fav' + (fav ? ' on' : '') + '" onclick="toggleFav(\'' + esc(j.url) + '\')">' + (fav ? '✓ 感兴趣' : '感兴趣') + '</span>' +
      '<a class="go" href="' + esc(j.url) + '" target="_blank" rel="noopener">原链 ↗</a></div>' +
      '</div>';
  }

  document.getElementById('citytab').addEventListener('click', function (e) {
    var el = e.target.closest('.ct');
    if (!el) return;
    CITY = el.getAttribute('data-city');
    if (IND && !hasMatch()) IND = '';
    render();
  });
  document.getElementById('viewtab').addEventListener('click', function (e) {
    var el = e.target.closest('.vt');
    if (!el) return;
    VIEW = el.getAttribute('data-view');
    if (VIEW === 'fav') DATE = '';
    document.querySelectorAll('.vt').forEach(function (x) {
      x.classList.toggle('on-all', x.getAttribute('data-view') === 'all' && VIEW === 'all');
      x.classList.toggle('on-fav', x.getAttribute('data-view') === 'fav' && VIEW === 'fav');
    });
    render();
  });
  document.getElementById('industrysel').addEventListener('click', function (e) {
    var el = e.target.closest('.chip');
    if (!el) return;
    IND = el.getAttribute('data-ind');
    if (CITY && !hasMatch()) CITY = '';
    render();
  });
  document.getElementById('searchbox').addEventListener('input', function (e) { KW = e.target.value.trim(); render(); });
  document.getElementById('sidedays').addEventListener('click', function (e) {
    var el = e.target.closest('.dt');
    if (!el) return;
    DATE = el.getAttribute('data-date');
    render();
  });

  document.getElementById('lastupdate').textContent = DATA.generatedAt || '--';
  render();
})();
  }
})();
