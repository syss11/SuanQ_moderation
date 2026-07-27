import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const consoleMethods = ['log', 'error', 'warn', 'info', 'debug'];
const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
const excludeDirs = ['node_modules', 'dist', 'build', '.git', 'coverage'];

let totalFiles = 0;
let totalReplacements = 0;

function shouldExcludeDir(dirName) {
  return excludeDirs.includes(dirName) || dirName.startsWith('.');
}

function isCodeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return codeExtensions.includes(ext);
}

function replaceConsoleInFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf-8');
    let fileReplacements = 0;

    consoleMethods.forEach(method => {
      const regex = new RegExp(`console\\.${method}\\s*\\(`, 'g');
      const matches = content.match(regex);
      if (matches) {
        fileReplacements += matches.length;
        content = content.replace(regex, `logger.${method}(`);
      }
    });

    if (fileReplacements > 0) {
      fs.writeFileSync(filePath, content, 'utf-8');
      logger.log(`✓ ${filePath}: ${fileReplacements} replacements`);
      totalReplacements += fileReplacements;
    }

    totalFiles++;
  } catch (error) {
    logger.error(`✗ Error processing ${filePath}:`, error);
  }
}

function processDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) {
          processDirectory(fullPath);
        }
      } else if (entry.isFile() && isCodeFile(fullPath)) {
        replaceConsoleInFile(fullPath);
      }
    }
  } catch (error) {
    logger.error(`✗ Error reading directory ${dirPath}:`, error);
  }
}

function main() {
  const startDir = process.argv[2] || process.cwd();
  logger.log(`\n🔍 Starting console replacement from: ${startDir}`);
  logger.log(`📁 Excluding directories: ${excludeDirs.join(', ')}`);
  logger.log(`📝 Processing files: ${codeExtensions.join(', ')}`);
  logger.log(`\nProcessing...\n`);

  processDirectory(startDir);

  logger.log(`\n✅ Done!`);
  logger.log(`📊 Statistics:`);
  logger.log(`   - Total files scanned: ${totalFiles}`);
  logger.log(`   - Total replacements made: ${totalReplacements}`);
}

main();