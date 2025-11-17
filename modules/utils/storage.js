// ========================================
// utils/storage.js - localStorage操作ユーティリティ
// ========================================

class StorageUtils {
    static PREFIX = 'starlit_';
    
    // 設定を保存
    static save(key, value) {
        try {
            const fullKey = this.PREFIX + key;
            localStorage.setItem(fullKey, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
            return false;
        }
    }
    
    // 設定を読み込み
    static load(key, defaultValue = null) {
        try {
            const fullKey = this.PREFIX + key;
            const item = localStorage.getItem(fullKey);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Failed to load from localStorage:', e);
            return defaultValue;
        }
    }
    
    // 設定を削除
    static remove(key) {
        try {
            const fullKey = this.PREFIX + key;
            localStorage.removeItem(fullKey);
            return true;
        } catch (e) {
            console.error('Failed to remove from localStorage:', e);
            return false;
        }
    }
    
    // すべての設定をクリア
    static clear() {
        try {
            const keys = Object.keys(localStorage);
            for (const key of keys) {
                if (key.startsWith(this.PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
            return true;
        } catch (e) {
            console.error('Failed to clear localStorage:', e);
            return false;
        }
    }
    
    // すべての設定を取得
    static getAll() {
        const result = {};
        const keys = Object.keys(localStorage);
        for (const key of keys) {
            if (key.startsWith(this.PREFIX)) {
                const shortKey = key.substring(this.PREFIX.length);
                result[shortKey] = this.load(shortKey);
            }
        }
        return result;
    }
    
    // 設定が存在するかチェック
    static has(key) {
        const fullKey = this.PREFIX + key;
        return localStorage.getItem(fullKey) !== null;
    }
}
