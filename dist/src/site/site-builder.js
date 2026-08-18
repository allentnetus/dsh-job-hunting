import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const templateDirectories = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../templates/default'),
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../templates/default'),
];
const dataMarker = '__SITE_DATA__';
const escapeJsonForHtmlScript = (json) => json.replace(/[<>&\u2028\u2029]/g, (character) => {
    switch (character) {
        case '<':
            return '\\u003C';
        case '>':
            return '\\u003E';
        case '&':
            return '\\u0026';
        case '\u2028':
            return '\\u2028';
        case '\u2029':
            return '\\u2029';
        default:
            return character;
    }
});
const standardIndustryAliases = {
    金融IT: ['金融', '银行', '证券', '保险', '基金', 'fintech'],
    网络安全: ['网络安全', '信息安全', '安全', '攻防', '密码', '渗透'],
    '信创/基础软件': ['信创', '国产化', '数据库', '操作系统', '中间件'],
    企业服务: ['企业服务', 'saas', 'crm', 'erp'],
    AI: ['ai', '人工智能', '大模型', '算法', '智能体', '机器学习'],
    机器人: ['机器人', '机械臂', '具身智能'],
    医疗健康: ['医疗', '健康', '医院', '医药'],
    工业: ['工业', '制造', '机床', '工厂', '新能源', '能源'],
    央企院所: ['央企院所', '科研院所'],
    国家电网信通系: ['国家电网', '电网', '电力', '信通'],
    央企总部数字化: ['央企总部', '总部数字化'],
    '央企/市属国企': ['央企', '国企', '集团总部'],
    事业单位: ['事业单位'],
    党政机关: ['党政机关', '政府', '机关', '公务员'],
    其他: [],
};
const normalizeIndustryText = (value) => value.toLowerCase().replace(/[\s·/／＋+_-]/g, '');
export const suggestIndustryClassifications = (industries) => {
    const suggestions = [];
    for (const requested of industries ?? []) {
        const label = requested.trim();
        if (!label)
            continue;
        const normalized = normalizeIndustryText(label);
        if (Object.keys(standardIndustryAliases).some((standard) => normalizeIndustryText(standard) === normalized)) {
            continue;
        }
        const match = Object.entries(standardIndustryAliases).find(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeIndustryText(alias))));
        if (match) {
            suggestions.push({
                requested: label,
                suggested: match[0],
                reason: `建议统一归入“${match[0]}”，便于不同城市使用同一套分类统计。`,
            });
        }
        else {
            suggestions.push({
                requested: label,
                suggested: '其他',
                reason: '暂未匹配到标准分类；如需跨城市统计，建议与用户确认后归入现有标准分类。',
            });
        }
    }
    return suggestions;
};
const resolveTemplateDirectory = async () => {
    for (const directory of templateDirectories) {
        try {
            await access(path.join(directory, 'index.html'));
            return directory;
        }
        catch {
            // Try the next known location for source and compiled layouts.
        }
    }
    throw new Error('Default site templates are missing');
};
export const embedSiteData = (template, data) => {
    if (!template.includes(dataMarker)) {
        throw new Error(`Site template is missing ${dataMarker}`);
    }
    const serializedData = escapeJsonForHtmlScript(JSON.stringify(data));
    const dataScript = `<script id="site-data" type="application/json">${serializedData}</script>`;
    return template.replace(dataMarker, dataScript);
};
export const buildSite = async (input) => {
    const industrySuggestions = input.selection
        ? input.selection.industrySuggestions ?? suggestIndustryClassifications(input.selection.industries)
        : [];
    const data = {
        generatedAt: input.generatedAt ?? new Date().toISOString(),
        jobs: input.jobs,
        ...(input.selection
            ? {
                selection: {
                    ...input.selection,
                    ...(industrySuggestions.length ? { industrySuggestions } : {}),
                },
            }
            : {}),
    };
    const indexPath = path.join(input.outputDir, 'index.html');
    const cssPath = path.join(input.outputDir, 'app.css');
    const jsPath = path.join(input.outputDir, 'app.js');
    await mkdir(input.outputDir, { recursive: true });
    const templateDirectory = await resolveTemplateDirectory();
    const [indexTemplate, css, js] = await Promise.all([
        readFile(path.join(templateDirectory, 'index.html'), 'utf8'),
        readFile(path.join(templateDirectory, 'app.css'), 'utf8'),
        readFile(path.join(templateDirectory, 'app.js'), 'utf8'),
    ]);
    await Promise.all([
        writeFile(indexPath, embedSiteData(indexTemplate, data), 'utf8'),
        writeFile(cssPath, css, 'utf8'),
        writeFile(jsPath, js, 'utf8'),
    ]);
    return {
        indexPath,
        assetPaths: [cssPath, jsPath],
        data,
    };
};
//# sourceMappingURL=site-builder.js.map