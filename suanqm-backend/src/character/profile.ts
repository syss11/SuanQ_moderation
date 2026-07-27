
import { getConfig } from '../config/index.js';
import { CharacterProfile } from '../config/config.js';
import { logger } from '../logger.js';

export class CharacterProfileManager {
    private profiles: Map<string, CharacterProfile>;
    private activeProfile: string | null;

    constructor() {
        this.profiles = new Map();
        this.activeProfile = null;
        this.loadProfiles();
    }

    private loadProfiles(): void {
        const aiConfig = getConfig().ai;
        if (!aiConfig || !aiConfig.profiles) {
            logger.warn('AI角色配置未找到');
            return;
        }

        Object.entries(aiConfig.profiles).forEach(([key, profile]) => {
            this.profiles.set(key, {
                name: profile.name,
                prompt: {
                    personality: profile.prompt.personality,
                    reply_style: profile.prompt.reply_style,
                    on_remind_recall_forward: profile.prompt.on_remind_recall_forward,
                    on_remind_flood: profile.prompt.on_remind_flood,
                    on_remind_violation: profile.prompt.on_remind_violation,
                }
            });
        });

        this.activeProfile = aiConfig.activeProfile || 'default';
        logger.log(`已加载${this.profiles.size}个AI角色配置，当前激活角色: ${this.activeProfile}`);
    }

    getActiveProfile(): CharacterProfile | null {
        if (!this.activeProfile) {
            return null;
        }
        return this.profiles.get(this.activeProfile) || null;
    }

    setActiveProfile(profileKey: string): boolean {
        if (!this.profiles.has(profileKey)) {
            logger.error(`角色${profileKey}不存在`);
            return false;
        }

        this.activeProfile = profileKey;
        logger.log(`已切换到角色: ${profileKey}`);
        return true;
    }

    getProfile(profileKey: string): CharacterProfile | null {
        return this.profiles.get(profileKey) || null;
    }

    getAllProfiles(): Map<string, CharacterProfile> {
        return new Map(this.profiles);
    }
}

const profileManager = new CharacterProfileManager();

export { profileManager };