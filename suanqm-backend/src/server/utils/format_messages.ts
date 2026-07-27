import { GroupMessage, PrivateFriendMessage, Receive, MessageType } from 'node-napcat-ts';
import { Simplified_Message, Simplified_GroupMessage, Simplified_PrivateFriendMessage } from './suanq_types.js';
import napcat from '../../napcat/index.js';
import { logger } from '../../logger.js';

function handle_image(message: Receive['image']): Simplified_Message['image'] {
    return {
        type: 'image',
        data: {
            url: process.env.APP_BASE_URL + '/images/' + message.data.file,
            summary: message.data.summary || '',
            file: message.data.file || '',
        }
    }
}

function handle_text(message: Receive['text']): Simplified_Message['text'] {
    return {
        type: 'text',
        data: {
            text: message.data.text || '',
        }
    }
}

function handle_at(message: Receive['at']): Simplified_Message['at'] {
    return {
        type: 'at',
        data: {
            qq: message.data.qq || 'all',
        }
    }
}

async function handle_file(message: Receive['file'], group_id: number|null=null): Promise<Simplified_Message['file']> {
    let url = '';
    if (group_id) {
        url = await napcat.get_group_file_url({
            group_id: group_id,
            file_id: message.data.file_id || '',
        }).then(res => res.url);
    } else {
        url = await napcat.get_private_file_url({
            file_id: message.data.file_id || '',
        }).then(res => res.url);
    }
    
    return {
        type: 'file',
        data: {
            url: url,
            file_id: message.data.file_id || '',
            file_size: message.data.file_size || '0',
        }
    }
}

function handle_poke(message: Receive['poke']): Simplified_Message['poke'] {
    return {
        type: 'poke',
        data: {
            type: message.data.type || '',
            id: message.data.id || '',
        }
    }
}

function handle_dice(message: Receive['dice']): Simplified_Message['dice'] {
    return {
        type: 'dice',
        data: {
            result: message.data.result || '',
        }
    }
}

function handle_rps(message: Receive['rps']): Simplified_Message['rps'] {
    return {
        type: 'rps',
        data: {
            result: message.data.result || '',
        }
    }
}

function handle_face(message: Receive['face']): Simplified_Message['face'] {
    return {
        type: 'face',
        data: {
            id: message.data.id || '',
            resultId: message.data.resultId || null,
            chainCount: message.data.chainCount || null,
        }
    }
}

function handle_reply(message: Receive['reply']): Simplified_Message['reply'] {
    return {
        type: 'reply',
        data: {
            id: message.data.id || '',
        }
    }
}

function handle_video(message: Receive['video']): Simplified_Message['video'] {
    return {
        type: 'video',
        data: {
            url: message.data.url || '',
            file_size: message.data.file_size || '0',
        }
    }
}

function handle_forward(message: Receive['forward']): Simplified_Message['forward'] {
    return {
        type: 'forward',
        data: {
            id: message.data.id || '',
        }
    }
}

function handle_json(message: Receive['json']): Simplified_Message['json'] {
    return {
        type: 'json',
        data: {
            data: message.data.data || '{}',
        }
    }
}

function handle_markdown(message: Receive['markdown']): Simplified_Message['markdown'] {
    return {
        type: 'markdown',
        data: {
            content: message.data.content || '',
        }
    }
}

function handle_record(message: Receive['record']): Simplified_Message['record'] {
    console.log((message.data as any).url || '');
    return {
        type: 'record',
        data: {
            url: (message.data as any).url || '',
            file: message.data.file || '',
            file_size: message.data.file_size || '0',
        }
    }
}

async function handle_messages(messages: Receive[keyof Receive][], group_id: number|null=null): Promise<Simplified_Message[keyof Simplified_Message][]> {
    let simplified_messages: Simplified_Message[keyof Simplified_Message][] = [];
    
    for (const message of messages) {
        switch (message.type) {
            case 'text':
                simplified_messages.push(handle_text(message));
                break;

            case 'image':
                simplified_messages.push(handle_image(message));
                break;

            case 'at':
                simplified_messages.push(handle_at(message));
                break;

            case 'file':
                simplified_messages.push(await handle_file(message, group_id));
                break;

            case 'poke':
                simplified_messages.push(handle_poke(message));
                break;

            case 'dice':
                simplified_messages.push(handle_dice(message));
                break;

            case 'rps':
                simplified_messages.push(handle_rps(message));
                break;

            case 'face':
                simplified_messages.push(handle_face(message));
                break;

            case 'reply':
                simplified_messages.push(handle_reply(message));
                break;

            case 'video':
                simplified_messages.push(handle_video(message));
                break;

            case 'forward':
                simplified_messages.push(handle_forward(message));
                break;

            case 'json':
                simplified_messages.push(handle_json(message));
                break;

            case 'markdown':
                simplified_messages.push(handle_markdown(message));
                break;

            case 'record':
                simplified_messages.push(handle_record(message));
                break;
            default:
                
                break;
        }
    }

    return simplified_messages;
}

async function convert_group_message(message: GroupMessage): Promise<Simplified_GroupMessage> {
    const simplified_messages = await handle_messages(message.message, message.group_id);
    
    return {
        user_id: message.user_id,
        time: message.time,
        message_id: message.message_id,
        message_seq: message.message_seq,
        real_id: message.real_id,
        message_type: message.message_type,
        sender: message.sender,
        raw_message: message.raw_message,
        font: message.font,
        sub_type: message.sub_type,
        post_type: message.post_type,
        group_id: message.group_id,
        message_format: message.message_format,
        message: simplified_messages,
        is_read: false,
    };
}

async function convert_private_friend_message(message: PrivateFriendMessage): Promise<Simplified_PrivateFriendMessage> {
    const simplified_messages = await handle_messages(message.message, null);
    
    return {
        user_id: message.user_id,
        time: message.time,
        message_id: message.message_id,
        message_seq: message.message_seq,
        real_id: message.real_id,
        message_type: message.message_type,
        sender: message.sender,
        raw_message: message.raw_message,
        font: message.font,
        sub_type: message.sub_type,
        post_type: message.post_type,
        message_format: message.message_format,
        message: simplified_messages,
        is_read: false,
    };
}

export { handle_messages, convert_group_message, convert_private_friend_message };