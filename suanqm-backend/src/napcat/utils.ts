import { GroupMessage, PrivateFriendMessage } from 'node-napcat-ts';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { known_robots, robot_uin_range } from './main.js';
import { Simplified_Messages } from '../server/utils/suanq_types.js';
import { logger } from '../logger.js';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 图片保存目录
const IMAGE_SAVE_PATH = path.join(__dirname, '../../public/images');

// 确保图片保存目录存在
if (!fs.existsSync(IMAGE_SAVE_PATH)) {
  fs.mkdirSync(IMAGE_SAVE_PATH, { recursive: true });
}

function contains_image(message: GroupMessage | PrivateFriendMessage): boolean {
  return message.message.some((item) => item.type === 'image');
}

function extract_image_url_and_names(message: GroupMessage | PrivateFriendMessage | Simplified_Messages): { url: string; name: string }[] | null {
  const imageItems = message.message.filter((item) => item.type === 'image');
  if (imageItems.length === 0) {
    return null;
  }
  return imageItems.map((item) => ({
    url: item.data.url,
    name: item.data.file,
  }));
}

async function save_image(url: string, filename: string): Promise<{ success: boolean; path?: string; message?: string; size?: number; md5?: string; phash?: bigint | null }> {
  try {
    const fullPath = path.join(IMAGE_SAVE_PATH, filename);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      const md5 = calculateMD5(fullPath);
      const phash = await calculatePhash(fullPath);
      return { success: true, path: fullPath, message: 'File already exists', size: stats.size, md5, phash };
    }

    return new Promise((resolve, reject) => {
      https.get(url, async (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];

        response.on('data', (chunk) => {
          chunks.push(chunk);
        });

        response.on('end', async () => {
          try {
            const originalBuffer = Buffer.concat(chunks);
            const originalSize = originalBuffer.length;
            const isLargeFile = originalSize > 100 * 1024;
            
            const image = sharp(originalBuffer);
            const metadata = await image.metadata();

            let compressedBuffer;
            if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
              compressedBuffer = await image.jpeg({ quality: isLargeFile ? 50 : 70 }).toBuffer();
            } else if (metadata.format === 'png') {
              compressedBuffer = await image.png({ quality: isLargeFile ? 50 : 70, compressionLevel: isLargeFile ? 9 : 6 }).toBuffer();
            } else if (metadata.format === 'gif') {
              compressedBuffer = await image.gif().toBuffer();
            } else {
              compressedBuffer = await image.toBuffer();
            }

            fs.writeFileSync(fullPath, compressedBuffer);

            const stats = fs.statSync(fullPath);
            const md5 = calculateMD5(fullPath);
            const phash = await calculatePhash(fullPath);
            
            resolve({ success: true, path: fullPath, size: stats.size, md5, phash });
          } catch (error) {
            if (fs.existsSync(fullPath)) {
              fs.unlinkSync(fullPath);
            }
            reject(error);
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    logger.error('Error saving image:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function calculateMD5(filePath: string): string {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    return hash;
  } catch (error) {
    logger.error('Error calculating MD5:', error);
    return '';
  }
}
async function calculatePhash(filePath: string): Promise<bigint | null> {
  try {
    // ========== 增大核心尺寸：48x48预处理 → 24x24特征提取 ==========
    const { data } = await sharp(filePath)
      .resize(48, 48, { 
        fit: 'cover',          // 保持比例裁剪
        position: 'centre',    // 保留中心主体
        withoutEnlargement: true // 不放大过小图片
      })
      .greyscale()
      .blur(1.2)              // 稍强的模糊去噪（大尺寸更需要）
      .resize(24, 24, { fit: 'fill' }) // 降采样到24x24（核心特征层）
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = new Uint8Array(data);
    const pixelCount = pixels.length; // 24x24=576个像素

    // 中位数阈值（抗极端值干扰）
    const sortedPixels = [...pixels].sort((a, b) => a - b);
    const median = sortedPixels[Math.floor(pixelCount / 2)];

    // ========== 24x24 → 64位哈希（聚合特征，不改变长度） ==========
    // 策略：将24x24分为8x8个3x3的特征块（8*8=64），每个块取1位特征
    let hash = 0n;
    const blockSize = 3; // 3x3像素为一个特征块
    const blocksPerSide = 24 / blockSize; // 每边8个块（8x8=64块）

    for (let blockY = 0; blockY < blocksPerSide; blockY++) {
      for (let blockX = 0; blockX < blocksPerSide; blockX++) {
        // 计算每个3x3块的平均值
        let blockSum = 0;
        for (let y = 0; y < blockSize; y++) {
          for (let x = 0; x < blockSize; x++) {
            const pixelIndex = (blockY * blockSize + y) * 24 + (blockX * blockSize + x);
            blockSum += pixels[pixelIndex];
          }
        }
        const blockAvg = blockSum / (blockSize * blockSize);

        // 块平均值 ≥ 全局中位数 → 置1
        const bitPosition = blockY * blocksPerSide + blockX;
        if (blockAvg >= median) {
          hash |= (1n << BigInt(bitPosition));
        }
      }
    }

    return hash;
  } catch (error) {
    logger.error('Error calculating large 64-bit pHash:', error);
    return null;
  }
}
/**
 * 优化版汉明距离计算（适配新哈希
 * @param hash1 优化后的哈希值
 * @param hash2 优化后的哈希值
 */
function calculateHammingDistance(hash1: bigint, hash2: bigint): number{
  let xor = hash1 ^ hash2;
  let distance = 0;

  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }

  return distance;
}

async function save_images_from_message(message: GroupMessage | PrivateFriendMessage | Simplified_Messages): Promise<{ url: string; name: string; path?: string; size?: number; success: boolean; md5?: string; phash?: bigint | null }[]> {
  const images = extract_image_url_and_names(message);
  if (!images) {
    return [];
  }

  const savePromises = images.map(async (image) => {
    const result = await save_image(image.url, image.name);
    return {
      url: image.url,
      name: image.name,
      path: result.path,
      size: result.size,
      success: result.success,
      md5: result.md5,
      phash: result.phash,
    };
  });

  return Promise.all(savePromises);
}

function get_avatar_url_by_userid(qq: number){
  return `https://q1.qlogo.cn/g?b=qq&s=0&nk=${qq}`
}

function get_avatar_url_by_groupid(groupid: number){
  return `https://p.qlogo.cn/gh/${groupid}/${groupid}/0`
}

function is_robot(uin: number){
  if (known_robots.includes(uin)) {
    return true;
  }
  if (robot_uin_range.length > 0) {
    for (const range of robot_uin_range) {
      const minUin = BigInt(range.minUin);
      const maxUin = BigInt(range.maxUin);
      const uinBigInt = BigInt(uin);
      if (uinBigInt >= minUin && uinBigInt <= maxUin) {
        return true;
      }
    }
  }
  return false;
}




export { contains_image, extract_image_url_and_names, save_image, save_images_from_message, IMAGE_SAVE_PATH, get_avatar_url_by_userid, get_avatar_url_by_groupid, is_robot, calculateHammingDistance };
