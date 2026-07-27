export interface Simplified_Message {
    text: {
        type: 'text';
        data: {
            text: string;
        };
    };
    at: {
        type: 'at';
        data: {
            qq: string | 'all';
        };
    };
    image: {
        type: 'image';
        data: {
            summary: string;
            url: string;
            file: string;
        }
    };
    file: {
        type: 'file';
        data: {
            url : string;
            file_id: string;
            file_size: string;
        };
    };
    poke: {
        type: 'poke';
        data: {
            type: string;
            id: string;
        };
    };
    dice: {
        type: 'dice';
        data: {
            result: string;
        };
    };
    rps: {
        type: 'rps';
        data: {
            result: string;
        };
    };
    face: {
        type: 'face';
        data: {
            id: string;
            resultId: string | null;
            chainCount: number | null;
        };
    };
    reply: {
        type: 'reply';
        data: {
            id: string;
        };
    };
    video: {
        type: 'video';
        data: {
            url: string;
            file_size: string;
        };
    };
    
    forward: {
        type: 'forward';
        data: {
            id: string;
            content?: Simplified_Message[keyof Simplified_Message][];
        };
    };
    json: {
        type: 'json';
        data: {
            data: string;
        };
    };
    markdown: {
        type: 'markdown';
        data: {
            content: string;
        };
    };
    record: {
        type: 'record';
        data: {
            url: string;
            file: string;
            file_size: string;
        };
    };
}

export type Simplified_GroupMessage = {
    user_id: number;
    time: number;
    message_id: number;
    message_seq: number;
    real_id: number;
    message_type: "group";
    sender: {
        user_id: number;
        nickname: string;
        card: string;
        role?: "owner" | "admin" | "member";
    };
    raw_message: string;
    font: number;
    sub_type: "normal";
    post_type: "message";
    group_id: number;
    message_format: "array";
    message: Simplified_Message[keyof Simplified_Message][];
    is_read: boolean;
}

export type Simplified_PrivateFriendMessage = {
    user_id: number;
    time: number;
    message_id: number;
    message_seq: number;
    real_id: number;
    message_type: "private";
    sender: {
        user_id: number;
        nickname: string;
        card: string;
    };
    raw_message: string;
    font: number;
    sub_type: "friend";
    post_type: "message";
    message_format: "array";
    message: Simplified_Message[keyof Simplified_Message][];
    is_read: boolean;
}

export type Simplified_Messages = Simplified_GroupMessage|Simplified_PrivateFriendMessage
