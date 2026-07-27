import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { Simplified_Messages } from '../server/utils/suanq_types';
import napcat from '../napcat/index.js';

export function get_message_hash(message: string) {
    return createHash('md5').update(message).digest('hex');
}

export async function quick_reply(
    message: Simplified_Messages,
    text: string,
    fail: boolean = false
){
    if (message.message_type=='group') {
        await napcat.send_group_msg({
            group_id: message.group_id,
            message: [
            {
                type:'reply',
                data:{
                    id:String(message.message_id)
                }
            },
            {
                type: 'text',
                data: {
                    text: text,
                }
            }]
        });
    } else if (message.message_type=='private') {
        await napcat.send_private_msg({
            user_id: message.user_id,
            message: [
                {
                type:'reply',
                data:{
                    id:String(message.message_id)
                }
            },
                {
                type: 'text',
                data: {
                    text: text,
                }
            }]
        });
    }

    if (fail) {
        throw new Error(text);
    }
}

export function readFileContent(relativePath: string): string | null {
    try {
        const fullPath = path.resolve(process.cwd(), relativePath);
        if (!fs.existsSync(fullPath)) {
            return null;
        }
        return fs.readFileSync(fullPath, 'utf-8');
    } catch {
        return null;
    }
}

