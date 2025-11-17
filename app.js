// ========================================
// app.js - メインアプリケーション（統合版）
// Version: 2.3.0 - 3分割アーキテクチャ + 複数選択機能
// ========================================

// app-core.jsで定義されたStarlitTimelineAppクラスを継承
class StarlitTimelineEditor extends StarlitTimelineApp {
    constructor() {
        super();
        
        // 拡張機能を初期化
        this.extensions = new StarlitTimelineExtensions(this);
        
        console.log('✨ Starlit Timeline Editor v2.3.0 loaded');
        console.log('📦 Architecture: Core + Extensions');
        console.log('🎯 New Features: Multi-select with Shift+Click, Group clips into scenes');
    }
    
    // 拡張機能の初期化フック（オーバーライド可能）
    initExtensions() {
        // 新機能の初期化処理をここに追加
        console.log('🔧 Extensions initialized');
    }
}

// アプリケーションを起動
let app;
window.addEventListener('DOMContentLoaded', () => {
    app = new StarlitTimelineEditor();
});
