#!/usr/bin/env node

/**
 * 贺卡模板标准化脚本
 * 
 * 功能：将外部模板标准化为可直接放入 server/src/data/ 的格式
 * - 以15号模板为参照标准
 * - 统一logo和音乐引用
 * - 注入必要占位符（name, blessing, company, year, month, day）
 * - 图片转base64内嵌
 * - 保留模板原有设计特点
 * 
 * 用法：
 *   node scripts/normalize-templates.js <source-dir> [output-dir]
 *   
 * 示例：
 *   # 检查模板是否符合标准
 *   node scripts/normalize-templates.js "uploads/others/贺卡模板" --check
 *   
 *   # 标准化所有模板
 *   node scripts/normalize-templates.js "uploads/others/贺卡模板" "uploads/normalized"
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ===== 配置 =====
const REFERENCE_TEMPLATE = join(__dirname, '..', 'server', 'src', 'data', 'birthday-card-15-executive-private-banquet');
const DEFAULT_OUTPUT_DIR = join(__dirname, '..', 'uploads', 'normalized');
const REQUIRED_PLACEHOLDERS = ['{{name}}', '{{blessing}}', '{{company}}', '{{year}}', '{{month}}', '{{day}}'];
const LOGO_PATH = '../logo.svg';
const MUSIC_PLACEHOLDER = '{{music_url}}';
const MUSIC_LOCAL_FALLBACK = '../music/music.mp3';

// ===== 工具函数 =====
function log(level, ...args) {
  const prefix = {
    info: '\x1b[36m[INFO]\x1b[0m',
    success: '\x1b[32m[OK]\x1b[0m',
    warning: '\x1b[33m[WARN]\x1b[0m',
    error: '\x1b[31m[ERROR]\x1b[0m'
  }[level];
  console.log(prefix, ...args);
}

function readFile(filePath) {
  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    log('error', `读取文件失败: ${filePath}`);
    return null;
  }
}

function writeFile(filePath, content) {
  try {
    const dir = dirname(filePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (e) {
    log('error', `写入文件失败: ${filePath}`, e.message);
    return false;
  }
}

function findFiles(dir, patterns) {
  const files = [];
  if (!existsSync(dir)) return files;
  
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    if (stat.isFile()) {
      const ext = extname(item).toLowerCase();
      if (patterns.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

// ===== 模板检查 =====
function checkTemplate(templateDir) {
  const issues = [];
  const htmlFiles = findFiles(templateDir, ['.html']);
  const cssFiles = findFiles(templateDir, ['.css']);
  const jsFiles = findFiles(templateDir, ['.js']);
  
  if (htmlFiles.length === 0) {
    issues.push('缺少HTML文件');
    return { valid: false, issues };
  }
  
  const html = readFile(htmlFiles[0]);
  if (!html) {
    issues.push('无法读取HTML文件');
    return { valid: false, issues };
  }
  
  // 检查占位符
  for (const ph of REQUIRED_PLACEHOLDERS) {
    if (!html.includes(ph)) {
      issues.push(`缺少占位符: ${ph}`);
    }
  }
  
  // 检查logo引用
  if (!html.includes(LOGO_PATH)) {
    issues.push('logo引用路径不正确');
  }
  
  // 检查音乐引用
  if (!html.includes(MUSIC_PLACEHOLDER) && !html.includes('music.mp3')) {
    issues.push('缺少音乐引用');
  }
  
  // 检查是否有外链资源
  const hasExternalImages = html.match(/src=["']https?:\/\//);
  if (hasExternalImages) {
    issues.push('包含外链图片（应转base64）');
  }
  
  // 检查是否有独立CSS/JS文件（应内嵌）
  if (cssFiles.length > 0 || jsFiles.length > 0) {
    issues.push('存在独立CSS/JS文件（应内嵌到HTML）');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    hasHtml: htmlFiles.length > 0,
    hasCss: cssFiles.length > 0,
    hasJs: jsFiles.length > 0
  };
}

// ===== HTML解析简易工具 =====
function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : '';
}

function extractCSS(html, cssFiles) {
  // 从style标签提取
  const styleMatches = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  let inlineCSS = '';
  for (const match of styleMatches) {
    inlineCSS += match[1] + '\n';
  }
  
  // 从外部CSS文件读取
  for (const cssFile of cssFiles) {
    const css = readFile(cssFile);
    if (css) inlineCSS += css + '\n';
  }
  
  return inlineCSS.trim();
}

function extractJS(html, jsFiles) {
  // 从script标签提取
  const scriptMatches = html.matchAll(/<script[^>>]*>([\s\S]*?)<\/script>/gi);
  let inlineJS = '';
  for (const match of scriptMatches) {
    // 跳过外部script引用
    if (!match[0].includes('src=')) {
      inlineJS += match[1] + '\n';
    }
  }
  
  // 从外部JS文件读取
  for (const jsFile of jsFiles) {
    const js = readFile(jsFile);
    if (js) inlineJS += js + '\n';
  }
  
  return inlineJS.trim();
}

// ===== 资源处理 =====
function convertImagesToBase64(html, templateDir) {
  // 匹配img标签中的src
  return html.replace(/src=["']([^"']+\.(?:png|jpg|jpeg|gif|webp))["']/gi, (match, srcPath) => {
    // 跳过占位符和外链
    if (srcPath.startsWith('{{') || srcPath.startsWith('http')) {
      return match;
    }
    
    // 构建完整路径
    let fullPath;
    if (srcPath.startsWith('../')) {
      fullPath = join(templateDir, srcPath);
    } else {
      fullPath = join(templateDir, srcPath);
    }
    
    if (!existsSync(fullPath)) {
      log('warning', `图片文件不存在: ${fullPath}`);
      return match;
    }
    
    try {
      const ext = extname(srcPath).substring(1).toLowerCase();
      const mimeType = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp'
      }[ext] || 'image/png';
      
      const content = readFileSync(fullPath);
      const base64 = content.toString('base64');
      return `src="data:${mimeType};base64,${base64}"`;
    } catch (e) {
      log('warning', `图片转换失败: ${srcPath}`, e.message);
      return match;
    }
  });
}

function convertCSSImagesToBase64(css, templateDir) {
  // 匹配CSS中的url()引用
  return css.replace(/url\(["']?([^"')]+\.(?:png|jpg|jpeg|gif|webp))["']?\)/gi, (match, srcPath) => {
    if (srcPath.startsWith('{{') || srcPath.startsWith('http') || srcPath.startsWith('data:')) {
      return match;
    }
    
    let fullPath = join(templateDir, srcPath);
    if (!existsSync(fullPath)) {
      return match;
    }
    
    try {
      const ext = extname(srcPath).substring(1).toLowerCase();
      const mimeType = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp'
      }[ext] || 'image/png';
      
      const content = readFileSync(fullPath);
      const base64 = content.toString('base64');
      return `url("data:${mimeType};base64,${base64}")`;
    } catch (e) {
      return match;
    }
  });
}

// ===== 占位符注入 =====
function injectPlaceholders(html, templateName) {
  let modified = false;
  
  // 检查现有占位符
  const existing = {};
  for (const ph of REQUIRED_PLACEHOLDERS) {
    existing[ph] = html.includes(ph);
  }
  
  log('info', `占位符检查 [${templateName}]:`, Object.entries(existing)
    .map(([k, v]) => v ? `\x1b[32m${k}\x1b[0m` : `\x1b[31m${k}\x1b[0m`)
    .join(' '));
  
  // 注入 {{name}} - 查找人名位置
  if (!existing['{{name}}']) {
    // 策略1: 在h1/h2/h3标签中查找"生日快乐"或名字相关位置
    const namePatterns = [
      /(<h[123][^>]*>)生日快乐(<\/h[123]>)/i,
      /(<h[123][^>]*>)生辰快乐(<\/h[123]>)/i,
      /class=["']hero-copy["'][^>]*>([\s\S]*?)<\/p>/i
    ];
    
    for (const pattern of namePatterns) {
      if (pattern.test(html)) {
        // 在标题下方插入占位符
        html = html.replace(pattern, (match, opening, content, closing) => {
          if (!match.includes('{{name}}')) {
            modified = true;
            return match.replace('<\/h[123]>', '<!-- 脚本自动添加 -->\n{{name}}</h[123]>');
          }
          return match;
        });
        if (modified) break;
      }
    }
  }
  
  // 注入 {{blessing}} - 查找祝福语位置
  if (!existing['{{blessing}}']) {
    // 查找message-text或blessing相关class
    const blessingPatterns = [
      /class=["']message-text["'][^>]*>([\s\S]*?)<\/[pdiv]/i,
      /class=["']blessing-text["'][^>]*>([\s\S]*?)<\/[pdiv]/i,
      /为你准备的一段祝福/i
    ];
    
    for (const pattern of blessingPatterns) {
      if (pattern.test(html)) {
        html = html.replace(pattern, (match) => {
          if (!match.includes('{{blessing}}')) {
            modified = true;
            // 在文本位置替换为占位符
            return match.replace(/>([\s\S]*?)</, '>{{blessing}}<');
          }
          return match;
        });
        if (modified) break;
      }
    }
  }
  
  // 注入 {{company}} - 查找公司名位置
  if (!existing['{{company}}']) {
    const companyPatterns = [
      /信阳移动/i,
      /class=["']brand-text["']/i,
      /class=["']sig-company["']/i
    ];
    
    for (const pattern of companyPatterns) {
      if (pattern.test(html)) {
        html = html.replace(pattern, (match) => {
          if (match.includes('信阳移动') && !html.includes('{{company}}')) {
            modified = true;
            return match.replace('信阳移动', '{{company}}');
          }
          return match;
        });
        if (modified) break;
      }
    }
  }
  
  // 注入日期占位符 - 查找日期位置
  const dateNeeded = !existing['{{year}}'] || !existing['{{month}}'] || !existing['{{day}}'];
  if (dateNeeded) {
    const datePattern = /(\d{4})年(\d{1,2})月(\d{1,2})日/i;
    if (datePattern.test(html)) {
      html = html.replace(datePattern, (match) => {
        modified = true;
        return '{{year}}年{{month}}月{{day}}日';
      });
    } else if (!existing['{{year}}']) {
      // 在页脚或签名区域添加日期
      const footerPatterns = [
        /class=["']sig-date["']/i,
        /敬贺/i,
        /<\/footer>/i
      ];
      
      for (const pattern of footerPatterns) {
        if (pattern.test(html)) {
          html = html.replace(pattern, (match) => {
            if (!html.includes('{{year}}')) {
              modified = true;
              return match + '\n<p class="auto-date">{{year}}年{{month}}月{{day}}日</p>';
            }
            return match;
          });
          if (modified) break;
        }
      }
    }
  }
  
  if (modified) {
    log('success', '已注入缺失的占位符');
  }
  
  return html;
}

// ===== 标准化处理 =====
function normalizeTemplate(templateDir, outputDir) {
  const templateName = basename(templateDir);
  log('info', `\n处理模板: ${templateName}`);
  
  // 检查模板
  const checkResult = checkTemplate(templateDir);
  if (checkResult.valid) {
    log('success', `模板已符合标准，跳过处理`);
    return false;
  }
  
  log('warning', '检测到以下问题:', checkResult.issues.join(', '));
  
  // 查找文件
  const htmlFiles = findFiles(templateDir, ['.html']);
  const cssFiles = findFiles(templateDir, ['.css']);
  const jsFiles = findFiles(templateDir, ['.js']);
  
  if (htmlFiles.length === 0) {
    log('error', '缺少HTML文件，跳过');
    return false;
  }
  
  let html = readFile(htmlFiles[0]);
  if (!html) return false;
  
  // 1. 提取CSS和JS
  let css = extractCSS(html, cssFiles);
  let js = extractJS(html, jsFiles);
  
  // 2. 转换图片为base64
  log('info', '转换图片资源...');
  html = convertImagesToBase64(html, templateDir);
  css = convertCSSImagesToBase64(css, templateDir);
  
  // 3. 统一logo引用
  log('info', '统一logo引用...');
  html = html.replace(
    /<img[^>]*class=["']brand-logo["'][^>]*src=["'][^"']*["']/gi,
    `<img class="brand-logo" src="${LOGO_PATH}" alt="信阳移动"`
  );
  
  // 4. 统一音乐引用
  log('info', '统一音乐引用...');
  if (js) {
    // 替换JS中的音乐URL变量
    js = js.replace(/const\s+bgMusic\s*=\s*["'][^"']*["'];/g, `const bgMusic = "${MUSIC_PLACEHOLDER}";`);
    js = js.replace(/const\s+localMusic\s*=\s*["'][^"']*["'];/g, `const localMusic = "${MUSIC_LOCAL_FALLBACK}";`);
  }
  
  // 5. 注入占位符
  log('info', '检查并注入占位符...');
  html = injectPlaceholders(html, templateName);
  
  // 6. 构建独立HTML文件
  log('info', '构建单文件模板...');
  const outputHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{{title}}</title>
  <style>
${css}
  </style>
</head>
<body>
${extractBody(html)}
  <script>
${js}
  </script>
</body>
</html>`;
  
  // 7. 输出文件
  const outputFileName = `${templateName}.html`;
  const outputPath = join(outputDir, outputFileName);
  
  if (writeFile(outputPath, outputHTML)) {
    log('success', `模板已输出: ${outputPath}`);
    return true;
  }
  
  return false;
}

// ===== 主流程 =====
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
贺卡模板标准化脚本

用法：
  node scripts/normalize-templates.js <source-dir> [output-dir] [选项]

选项：
  --check        仅检查模板状态，不进行处理
  --force        强制处理所有模板（包括已符合标准的）
  --help, -h     显示帮助信息

示例：
  # 检查模板
  node scripts/normalize-templates.js "uploads/others/贺卡模板" --check
  
  # 标准化所有模板
  node scripts/normalize-templates.js "uploads/others/贺卡模板" "uploads/normalized"
`);
    process.exit(0);
  }
  
  const sourceDir = args[0];
  const isCheckMode = args.includes('--check');
  const isForceMode = args.includes('--force');
  const outputDir = args.find(arg => !arg.startsWith('--')) || DEFAULT_OUTPUT_DIR;
  
  if (!existsSync(sourceDir)) {
    log('error', `源目录不存在: ${sourceDir}`);
    process.exit(1);
  }
  
  log('info', `源目录: ${sourceDir}`);
  log('info', `模式: ${isCheckMode ? '仅检查' : '标准化处理'}`);
  
  // 扫描模板目录
  const templates = readdirSync(sourceDir)
    .map(name => join(sourceDir, name))
    .filter(path => statSync(path).isDirectory());
  
  log('info', `发现 ${templates.length} 个模板\n`);
  
  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;
  
  for (const templateDir of templates) {
    const templateName = basename(templateDir);
    
    // 检查模板
    const checkResult = checkTemplate(templateDir);
    
    if (isCheckMode) {
      if (checkResult.valid) {
        log('success', `[${templateName}] 符合标准`);
      } else {
        log('warning', `[${templateName}] 需要处理:`, checkResult.issues.join(', '));
      }
      continue;
    }
    
    // 检查模式：如果已符合标准且非强制模式，跳过
    if (checkResult.valid && !isForceMode) {
      log('success', `[${templateName}] 已符合标准，跳过`);
      skipCount++;
      continue;
    }
    
    // 处理模板
    try {
      const result = normalizeTemplate(templateDir, outputDir);
      if (result) {
        successCount++;
      } else if (checkResult.valid) {
        skipCount++;
      } else {
        failCount++;
      }
    } catch (e) {
      log('error', `[${templateName}] 处理失败:`, e.message);
      failCount++;
    }
  }
  
  // 汇总报告
  console.log('\n' + '='.repeat(60));
  log('info', '处理完成');
  log('success', `成功: ${successCount}`);
  log('info', `跳过: ${skipCount}`);
  if (failCount > 0) log('error', `失败: ${failCount}`);
  console.log('='.repeat(60));
  
  if (!isCheckMode && successCount > 0) {
    log('info', `\n输出目录: ${outputDir}`);
    log('info', '请检查输出文件后，手动复制到 server/src/data/ 目录');
  }
}

main();
