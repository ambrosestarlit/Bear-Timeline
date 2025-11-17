// ========================================
// utils/math.js - 数学関連ユーティリティ
// ========================================

class MathUtils {
    // 線形補間
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
    
    // イージング関数
    static easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    static easeIn(t) {
        return t * t;
    }
    
    static easeOut(t) {
        return t * (2 - t);
    }
    
    // 角度を-180~180の範囲に正規化
    static normalizeAngle(angle) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }
    
    // 2点間の距離
    static distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    
    // 2点間の角度（度）
    static angle(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    }
    
    // 値を範囲内にクランプ
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    // 座標を回転
    static rotatePoint(x, y, angle) {
        const radians = angle * Math.PI / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        return {
            x: x * cos - y * sin,
            y: x * sin + y * cos
        };
    }
    
    // 時間を秒からフレームに変換
    static secondsToFrames(seconds, fps) {
        return Math.floor(seconds * fps);
    }
    
    // フレームから秒に変換
    static framesToSeconds(frames, fps) {
        return frames / fps;
    }
    
    // 時間を "00:00:00.000" 形式にフォーマット
    static formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    }
}
