/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const auditDir = __dirname;
const evidence = JSON.parse(
  fs.readFileSync(path.join(auditDir, 'page-evidence.json'), 'utf8'),
);

const pageRules = [
  { label: 'Cyberpunk', terms: ['cyberpunk'], categories: ['creative'] },
  { label: 'Mafia', terms: ['mafia'], categories: ['creative'] },
  {
    label: 'Magic Upscaler',
    terms: ['magic upscaler'],
    categories: ['utility'],
  },
  { label: 'Nature', terms: ['nature'], categories: ['creative'] },
  {
    label: 'Outdoor Creator Scenes',
    terms: ['outdoor creator scenes'],
    categories: ['creative'],
  },
  {
    label: 'Valentines Photo',
    terms: ["valentine's photo", 'valentines photo', 'valentine photos'],
    categories: ['couple'],
  },
  {
    label: 'Virtual Try-On',
    terms: ['virtual try-on', 'virtual try on'],
    categories: ['beauty'],
  },
  {
    label: 'Wedding Photo',
    terms: ['wedding portraits', 'wedding portrait', 'wedding photo', 'wedding'],
    categories: ['couple'],
  },
  {
    label: 'Soccer',
    terms: ['world cup fan photos', 'soccer'],
    categories: ['sports'],
  },
];

if (evidence.pages.length !== pageRules.length) {
  throw new Error(`Expected ${pageRules.length} pages, found ${evidence.pages.length}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalize(text, rule) {
  let normalized = text.toLowerCase();
  for (const term of [...rule.terms].sort((a, b) => b.length - a.length)) {
    normalized = normalized.replace(
      new RegExp(`\\b${escapeRegExp(term.toLowerCase())}\\b`, 'g'),
      ' topic ',
    );
  }
  for (const category of rule.categories) {
    normalized = normalized.replace(
      new RegExp(`\\b${escapeRegExp(category.toLowerCase())}\\b`, 'g'),
      ' category ',
    );
  }
  return normalized
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(text, size = 5) {
  const words = text.split(' ').filter(Boolean);
  const result = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    result.add(words.slice(index, index + size).join(' '));
  }
  return result;
}

function jaccard(left, right) {
  let intersection = 0;
  for (const value of left) {
    if (right.has(value)) intersection += 1;
  }
  const union = left.size + right.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

const pages = evidence.pages.map((page, index) => {
  const rule = pageRules[index];
  const content = page.article.orderedContent
    .map((item) => item.text)
    .join(' ');
  const normalized = normalize(content, rule);
  return {
    number: index + 1,
    label: rule.label,
    url: page.requestedUrl,
    wordCount: page.article.wordCount,
    orderedContentCount: page.article.orderedContent.length,
    tagSequence: page.article.orderedContent.map((item) => item.tag).join('>'),
    headingSequence: page.article.orderedContent
      .filter((item) => /^H[1-6]$/.test(item.tag))
      .map((item) => item.tag)
      .join('>'),
    normalizedWordCount: normalized.split(' ').filter(Boolean).length,
    shingleCount: shingles(normalized).size,
    normalized,
  };
});

const comparisons = [];
for (let left = 0; left < pages.length; left += 1) {
  for (let right = left + 1; right < pages.length; right += 1) {
    comparisons.push({
      left: pages[left].number,
      right: pages[right].number,
      leftLabel: pages[left].label,
      rightLabel: pages[right].label,
      fiveWordShingleJaccard: Number(
        jaccard(shingles(pages[left].normalized), shingles(pages[right].normalized)).toFixed(4),
      ),
      sameTagSequence: pages[left].tagSequence === pages[right].tagSequence,
      sameHeadingSequence: pages[left].headingSequence === pages[right].headingSequence,
      sameOrderedContentCount:
        pages[left].orderedContentCount === pages[right].orderedContentCount,
    });
  }
}

const scores = comparisons.map((comparison) => comparison.fiveWordShingleJaccard);
const result = {
  capturedAt: evidence.capturedAt,
  methodology: {
    source: 'Visible article orderedContent only; global header/footer navigation excluded.',
    normalization:
      'Lowercase; replace only the page own topic aliases with TOPIC and its template category label with CATEGORY; remove punctuation and collapse whitespace.',
    metric: 'Jaccard similarity over unique consecutive five-word shingles.',
    caveat:
      'This measures shared wording after expected topic substitutions. It does not by itself prove a search-engine duplicate-content action.',
  },
  summary: {
    comparisonCount: comparisons.length,
    minimum: Math.min(...scores),
    maximum: Math.max(...scores),
    average: Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(4)),
    allSameTagSequence: comparisons.every((comparison) => comparison.sameTagSequence),
    allSameHeadingSequence: comparisons.every((comparison) => comparison.sameHeadingSequence),
    allSameOrderedContentCount: comparisons.every(
      (comparison) => comparison.sameOrderedContentCount,
    ),
  },
  pages: pages.map(({ normalized, ...page }) => page),
  comparisons,
};

fs.writeFileSync(
  path.join(auditDir, 'similarity-analysis.json'),
  `${JSON.stringify(result, null, 2)}\n`,
);

const matrixHeader = ['页面', ...pages.map((page) => String(page.number))];
const matrixRows = pages.map((page, rowIndex) => {
  const cells = pages.map((_, columnIndex) => {
    if (rowIndex === columnIndex) return '1.0000';
    const left = Math.min(rowIndex, columnIndex) + 1;
    const right = Math.max(rowIndex, columnIndex) + 1;
    return comparisons.find(
      (comparison) => comparison.left === left && comparison.right === right,
    ).fiveWordShingleJaccard.toFixed(4);
  });
  return [`${page.number}. ${page.label}`, ...cells];
});

const markdown = [
  '# GPT10 跨页正文相似度证据',
  '',
  `原始抓取时间：${evidence.capturedAt}`,
  '',
  '## 方法',
  '',
  '- 只使用每页可见文章正文的有序内容，排除全站 Header/Footer。',
  '- 仅把每页自己的主题别名替换为 `TOPIC`，把模板大类名替换为 `CATEGORY`，然后转小写、移除标点、合并空格。',
  '- 指标是“唯一连续 5 词组集合”的 Jaccard 相似度；1.0000 表示归一化后 5 词组集合相同。',
  '- 该指标证明共享措辞程度，不单独等同于搜索引擎惩罚或人工处置。',
  '',
  '## 结果',
  '',
  `- 共比较 ${comparisons.length} 对页面；最小 ${result.summary.minimum.toFixed(4)}，最大 ${result.summary.maximum.toFixed(4)}，平均 ${result.summary.average.toFixed(4)}。`,
  `- 全部页面标题层级序列相同：${result.summary.allSameHeadingSequence ? '是' : '否'}。`,
  `- 全部页面正文标签序列相同：${result.summary.allSameTagSequence ? '是' : '否'}。`,
  `- 全部页面有序内容块数量相同：${result.summary.allSameOrderedContentCount ? '是' : '否'}。`,
  '',
  `| ${matrixHeader.join(' | ')} |`,
  `|${matrixHeader.map(() => '---').join('|')}|`,
  ...matrixRows.map((row) => `| ${row.join(' | ')} |`),
  '',
  '## 页面结构',
  '',
  '| # | 页面 | 原始词数 | 有序内容块 | 归一化词数 | 唯一 5 词组 |',
  '|---:|---|---:|---:|---:|---:|',
  ...pages.map(
    (page) =>
      `| ${page.number} | [${page.label}](${page.url}) | ${page.wordCount} | ${page.orderedContentCount} | ${page.normalizedWordCount} | ${page.shingleCount} |`,
  ),
  '',
  '详细机器可读结果见 `similarity-analysis.json`。',
  '',
].join('\n');

fs.writeFileSync(path.join(auditDir, 'GPT10-similarity-analysis.md'), markdown);
