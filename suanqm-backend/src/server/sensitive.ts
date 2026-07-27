import { Router, Request, Response } from 'express';
import { authMiddleware } from './middleware/auth.js';
import { sensitiveFilter } from '../services/filter.js';
import { logger } from '../logger.js';
import fs from 'fs';
import path from 'path';

const router = Router();

interface PaginatedResponse<T> {
  code: number;
  message: string;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

interface SensitiveWordResponse {
  word: string;
  severity: number;
}

interface SensitiveWordCreateRequest {
  word: string;
  severity: number;
}

interface SensitiveWordUpdateRequest {
  severity: number;
}

function getSensitiveWords(): SensitiveWordResponse[] {
  const sensitivePath = path.join(process.cwd(), "data", "sensitive.json");
  const data = fs.readFileSync(sensitivePath, 'utf8');
  const json = JSON.parse(data);
  return json;
}

function saveSensitiveWords(words: SensitiveWordResponse[]): void {
  const sensitivePath = path.join(process.cwd(), "data", "sensitive.json");
  fs.writeFileSync(sensitivePath, JSON.stringify(words, null, 2));
}

router.get('/api/sensitive', authMiddleware, async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = req.query.search as string || '';

    if (page < 1) {
      return res.status(400).json({
        code: 400,
        message: '页码必须大于0'
      });
    }

    if (pageSize < 1 || pageSize > 100) {
      return res.status(400).json({
        code: 400,
        message: '每页数量必须在1-100之间'
      });
    }

    let words = getSensitiveWords();

    if (search) {
      words = words.filter(w => w.word.includes(search));
    }

    const total = words.length;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    const paginatedWords = words.slice(offset, offset + pageSize);

    const response: PaginatedResponse<SensitiveWordResponse> = {
      code: 200,
      message: '获取敏感词列表成功',
      data: paginatedWords,
      pagination: {
        page,
        pageSize,
        total,
        totalPages
      }
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error('获取敏感词列表失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取敏感词列表失败',
      data: null
    });
  }
});

router.get('/api/sensitive/:word', authMiddleware, async (req: Request, res: Response) => {
  try {
    const word = req.params.word;

    if (!word) {
      return res.status(400).json({
        code: 400,
        message: '敏感词不能为空'
      });
    }

    const words = getSensitiveWords();
    const foundWord = words.find(w => w.word === word);

    if (!foundWord) {
      return res.status(404).json({
        code: 404,
        message: '敏感词不存在'
      });
    }

    res.status(200).json({
      code: 200,
      message: '获取敏感词成功',
      data: foundWord
    });
  } catch (error) {
    logger.error('获取敏感词失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取敏感词失败',
      data: null
    });
  }
});

router.post('/api/sensitive', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { word, severity } = req.body as SensitiveWordCreateRequest;

    if (!word || typeof word !== 'string' || word.trim() === '') {
      return res.status(400).json({
        code: 400,
        message: '敏感词不能为空'
      });
    }

    if (severity === undefined || typeof severity !== 'number') {
      return res.status(400).json({
        code: 400,
        message: '严重程度必须是数字'
      });
    }

    if (severity < 1 || severity > 3) {
      return res.status(400).json({
        code: 400,
        message: '严重程度必须在1-3之间'
      });
    }

    const trimmedWord = word.trim();
    const words = getSensitiveWords();

    if (words.find(w => w.word === trimmedWord)) {
      return res.status(400).json({
        code: 400,
        message: '敏感词已存在'
      });
    }

    words.push({ word: trimmedWord, severity });
    saveSensitiveWords(words);

    sensitiveFilter.add(trimmedWord, severity);

    logger.log(`敏感词已添加: ${trimmedWord}, 严重程度: ${severity}`);

    res.status(201).json({
      code: 201,
      message: '敏感词添加成功',
      data: { word: trimmedWord, severity }
    });
  } catch (error) {
    logger.error('添加敏感词失败:', error);
    res.status(500).json({
      code: 500,
      message: '添加敏感词失败',
      data: null
    });
  }
});

router.put('/api/sensitive/:word', authMiddleware, async (req: Request, res: Response) => {
  try {
    const word = req.params.word;
    const { severity } = req.body as SensitiveWordUpdateRequest;

    if (!word) {
      return res.status(400).json({
        code: 400,
        message: '敏感词不能为空'
      });
    }

    if (severity === undefined || typeof severity !== 'number') {
      return res.status(400).json({
        code: 400,
        message: '严重程度必须是数字'
      });
    }

    if (severity < 1 || severity > 3) {
      return res.status(400).json({
        code: 400,
        message: '严重程度必须在1-3之间'
      });
    }

    const words = getSensitiveWords();
    const index = words.findIndex(w => w.word === word);

    if (index === -1) {
      return res.status(404).json({
        code: 404,
        message: '敏感词不存在'
      });
    }

    words[index].severity = severity;
    saveSensitiveWords(words);

    sensitiveFilter.remove(word);
    sensitiveFilter.add(word, severity);

    logger.log(`敏感词已更新: ${word}, 新严重程度: ${severity}`);

    res.status(200).json({
      code: 200,
      message: '敏感词更新成功',
      data: { word, severity }
    });
  } catch (error) {
    logger.error('更新敏感词失败:', error);
    res.status(500).json({
      code: 500,
      message: '更新敏感词失败',
      data: null
    });
  }
});

router.delete('/api/sensitive/:word', authMiddleware, async (req: Request, res: Response) => {
  try {
    const word = req.params.word;

    if (!word) {
      return res.status(400).json({
        code: 400,
        message: '敏感词不能为空'
      });
    }

    const words = getSensitiveWords();
    const index = words.findIndex(w => w.word === word);

    if (index === -1) {
      return res.status(404).json({
        code: 404,
        message: '敏感词不存在'
      });
    }

    words.splice(index, 1);
    saveSensitiveWords(words);

    sensitiveFilter.remove(word);

    logger.log(`敏感词已删除: ${word}`);

    res.status(200).json({
      code: 200,
      message: '敏感词删除成功',
      data: null
    });
  } catch (error) {
    logger.error('删除敏感词失败:', error);
    res.status(500).json({
      code: 500,
      message: '删除敏感词失败',
      data: null
    });
  }
});

export default router;
