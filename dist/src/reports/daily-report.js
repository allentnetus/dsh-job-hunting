import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { matchJob } from '../domain/matcher.js';
import { readLocalCollectionMeta } from '../jobs/job-collector.js';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const compareJobs = (left, right) => right.matchScore - left.matchScore ||
    left.title.localeCompare(right.title) ||
    left.company.localeCompare(right.company);
const toUtcDate = (date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new TypeError(`Invalid report date: ${date}`);
    }
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
        throw new TypeError(`Invalid report date: ${date}`);
    }
    return parsed;
};
const resolveReportJobs = (jobs) => {
    const meta = readLocalCollectionMeta(jobs);
    if (!meta) {
        return [...jobs];
    }
    const newJobIds = new Set(meta.newJobIds);
    return jobs.filter((job) => newJobIds.has(job.id));
};
const toDailyReportJob = (job, profile) => {
    const result = matchJob(job, profile);
    return {
        ...job,
        matchScore: result.score,
        matchReasons: result.reasons,
    };
};
const toCollectedAtValues = (reportJobs, sourceStatuses) => {
    const collectedAt = new Set();
    for (const job of reportJobs) {
        collectedAt.add(job.collectedAt);
    }
    for (const sourceStatus of sourceStatuses) {
        for (const value of sourceStatus.collectedAt) {
            collectedAt.add(value);
        }
    }
    return [...collectedAt].sort((left, right) => left.localeCompare(right));
};
const deriveFallbackStatuses = (jobs) => {
    const grouped = new Map();
    for (const job of jobs) {
        const existing = grouped.get(job.source) ?? {
            source: job.source,
            status: 'complete',
            fileCount: 0,
            jobCount: 0,
            collectedAt: [],
            errors: [],
        };
        existing.jobCount += 1;
        if (!existing.collectedAt.includes(job.collectedAt)) {
            existing.collectedAt.push(job.collectedAt);
        }
        grouped.set(job.source, existing);
    }
    return [...grouped.values()]
        .map((status) => ({
        ...status,
        collectedAt: [...status.collectedAt].sort((left, right) => left.localeCompare(right)),
    }))
        .sort((left, right) => left.source.localeCompare(right.source));
};
const collectDeadlineAnomalies = (reportJobs, reportDate) => {
    const reminders = [];
    const anomalies = [];
    for (const job of reportJobs) {
        if (!job.deadline) {
            continue;
        }
        const deadline = new Date(job.deadline);
        if (Number.isNaN(deadline.getTime())) {
            anomalies.push(`Invalid deadline format for ${job.title} @ ${job.company}: ${job.deadline}`);
            continue;
        }
        const daysUntilDeadline = Math.round((deadline.getTime() - reportDate.getTime()) / MS_PER_DAY);
        if (daysUntilDeadline < 0 || daysUntilDeadline > 7) {
            continue;
        }
        reminders.push({
            ...job,
            daysUntilDeadline,
        });
    }
    reminders.sort((left, right) => left.daysUntilDeadline - right.daysUntilDeadline || compareJobs(left, right));
    return {
        reminders,
        anomalies,
    };
};
const escapeHtml = (value) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const isSafeJobUrl = (value) => {
    try {
        return new URL(value).protocol === 'https:';
    }
    catch {
        return false;
    }
};
const formatJobLineItems = (job) => [
    `- Match Score: ${job.matchScore}`,
    `- Match Reasons: ${job.matchReasons.length === 0 ? 'None' : job.matchReasons.join(' | ')}`,
    `- Source: ${job.source}`,
    `- Location: ${job.location}`,
    `- URL: ${job.url}`,
    `- Collected At: ${job.collectedAt}`,
    ...(job.deadline ? [`- Deadline: ${job.deadline}`] : []),
];
const renderMarkdown = (report) => {
    const lines = [
        `# Daily Job Report - ${report.date}`,
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Collected At: ${report.collectedAt.length === 0 ? 'N/A' : report.collectedAt.join(', ')}`,
        `- Profile Version: ${report.profileVersion}`,
        '',
        '## Source Statuses',
        '',
        '| Source | Status | Files | Jobs | Collected At | Errors |',
        '| --- | --- | ---: | ---: | --- | --- |',
        ...report.sourceStatuses.map((status) => `| ${status.source} | ${status.status} | ${status.fileCount} | ${status.jobCount} | ${status.collectedAt.join(', ') || 'N/A'} | ${status.errors.join(' ; ') || 'None'} |`),
        '',
        '## Failures',
        '',
    ];
    if (report.failures.length === 0) {
        lines.push('- None');
    }
    else {
        for (const failure of report.failures) {
            lines.push(`- ${failure.source}: ${failure.filePath} -> ${failure.message}`);
        }
    }
    lines.push('', '## New Jobs', '');
    if (report.newJobs.length === 0) {
        lines.push('- None');
    }
    else {
        for (const job of report.newJobs) {
            lines.push(`### ${job.title} @ ${job.company}`);
            lines.push(...formatJobLineItems(job), '');
        }
    }
    lines.push('## Recommended Jobs', '');
    if (report.recommendedJobs.length === 0) {
        lines.push('- None');
    }
    else {
        for (const job of report.recommendedJobs) {
            lines.push(`- ${job.title} @ ${job.company} (${job.matchScore})`);
        }
    }
    lines.push('', '## Deadline Reminders', '');
    if (report.deadlineReminders.length === 0) {
        lines.push('- None');
    }
    else {
        for (const reminder of report.deadlineReminders) {
            lines.push(`- ${reminder.title} @ ${reminder.company} (${reminder.daysUntilDeadline} day(s))`);
        }
    }
    lines.push('', '## Anomalies', '');
    if (report.anomalies.length === 0) {
        lines.push('- None');
    }
    else {
        for (const anomaly of report.anomalies) {
            lines.push(`- ${anomaly}`);
        }
    }
    return `${lines.join('\n')}\n`;
};
const renderHtml = (report) => {
    const sourceStatusRows = report.sourceStatuses
        .map((status) => `
        <tr>
          <td>${escapeHtml(status.source)}</td>
          <td>${escapeHtml(status.status)}</td>
          <td>${status.fileCount}</td>
          <td>${status.jobCount}</td>
          <td>${escapeHtml(status.collectedAt.join(', ') || 'N/A')}</td>
          <td>${escapeHtml(status.errors.join(' ; ') || 'None')}</td>
        </tr>`)
        .join('');
    const failures = report.failures.length === 0
        ? '<li>None</li>'
        : report.failures
            .map((failure) => `<li>${escapeHtml(failure.source)}: ${escapeHtml(failure.filePath)} -> ${escapeHtml(failure.message)}</li>`)
            .join('');
    const newJobs = report.newJobs.length === 0
        ? '<li>None</li>'
        : report.newJobs
            .map((job) => `
            <li>
              <h3>${escapeHtml(job.title)} @ ${escapeHtml(job.company)}</h3>
              <ul>
                <li>Match Score: ${job.matchScore}</li>
                <li>Match Reasons: ${escapeHtml(job.matchReasons.join(' | ') || 'None')}</li>
                <li>Source: ${escapeHtml(job.source)}</li>
                <li>Location: ${escapeHtml(job.location)}</li>
                <li>URL: ${isSafeJobUrl(job.url)
            ? `<a href="${escapeHtml(job.url)}">${escapeHtml(job.url)}</a>`
            : escapeHtml(job.url)}</li>
                <li>Collected At: ${escapeHtml(job.collectedAt)}</li>
                ${job.deadline ? `<li>Deadline: ${escapeHtml(job.deadline)}</li>` : ''}
              </ul>
            </li>`)
            .join('');
    const recommendedJobs = report.recommendedJobs.length === 0
        ? '<li>None</li>'
        : report.recommendedJobs
            .map((job) => `<li>${escapeHtml(job.title)} @ ${escapeHtml(job.company)} (${job.matchScore})</li>`)
            .join('');
    const deadlineReminders = report.deadlineReminders.length === 0
        ? '<li>None</li>'
        : report.deadlineReminders
            .map((job) => `<li>${escapeHtml(job.title)} @ ${escapeHtml(job.company)} (${job.daysUntilDeadline} day(s))</li>`)
            .join('');
    const anomalies = report.anomalies.length === 0
        ? '<li>None</li>'
        : report.anomalies.map((anomaly) => `<li>${escapeHtml(anomaly)}</li>`).join('');
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Daily Job Report - ${escapeHtml(report.date)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
      th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; }
      h1, h2, h3 { color: #111827; }
      ul { padding-left: 20px; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <h1>Daily Job Report - ${escapeHtml(report.date)}</h1>
    <ul>
      <li>Generated At: ${escapeHtml(report.generatedAt)}</li>
      <li>Collected At: ${escapeHtml(report.collectedAt.join(', ') || 'N/A')}</li>
      <li>Profile Version: ${report.profileVersion}</li>
    </ul>

    <h2>Source Statuses</h2>
    <table>
      <thead>
        <tr>
          <th>Source</th>
          <th>Status</th>
          <th>Files</th>
          <th>Jobs</th>
          <th>Collected At</th>
          <th>Errors</th>
        </tr>
      </thead>
      <tbody>${sourceStatusRows}</tbody>
    </table>

    <h2>Failures</h2>
    <ul>${failures}</ul>

    <h2>New Jobs</h2>
    <ul>${newJobs}</ul>

    <h2>Recommended Jobs</h2>
    <ul>${recommendedJobs}</ul>

    <h2>Deadline Reminders</h2>
    <ul>${deadlineReminders}</ul>

    <h2>Anomalies</h2>
    <ul>${anomalies}</ul>
  </body>
</html>
`;
};
export const buildDailyReport = (jobs, profile, date) => {
    if (profile.state !== 'profile-confirmed') {
        throw new TypeError('buildDailyReport requires a profile-confirmed CareerProfile');
    }
    const generatedAt = new Date().toISOString();
    const reportDate = toUtcDate(date);
    const sourceStatuses = readLocalCollectionMeta(jobs)?.sourceStatuses ?? deriveFallbackStatuses(jobs);
    const failures = readLocalCollectionMeta(jobs)?.failures ?? [];
    const newJobs = resolveReportJobs(jobs).map((job) => toDailyReportJob(job, profile)).sort(compareJobs);
    const recommendedJobs = newJobs.filter((job) => job.matchScore >= 60);
    const deadlineResult = collectDeadlineAnomalies(newJobs, reportDate);
    return {
        date,
        generatedAt,
        collectedAt: toCollectedAtValues(newJobs, sourceStatuses),
        profileVersion: profile.version,
        newJobs,
        recommendedJobs,
        deadlineReminders: deadlineResult.reminders,
        sourceStatuses,
        failures,
        anomalies: deadlineResult.anomalies,
    };
};
export const writeReportBundle = async (report, outputRoot) => {
    toUtcDate(report.date);
    const resolvedOutputRoot = path.resolve(outputRoot);
    await mkdir(resolvedOutputRoot, { recursive: true });
    const jsonPath = path.join(resolvedOutputRoot, `${report.date}.json`);
    const markdownPath = path.join(resolvedOutputRoot, `${report.date}.md`);
    const htmlPath = path.join(resolvedOutputRoot, `${report.date}.html`);
    await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    await writeFile(markdownPath, renderMarkdown(report), 'utf8');
    await writeFile(htmlPath, renderHtml(report), 'utf8');
};
//# sourceMappingURL=daily-report.js.map