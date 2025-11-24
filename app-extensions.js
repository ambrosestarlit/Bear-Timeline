// ========================================
// app-extensions.js - 新機能専用モジュール
// Version: 2.3.3 - Scene移動時のasset参照を完全修正
// ========================================

class StarlitTimelineExtensions {
    constructor(app) {
        this.app = app;
        
        // 複数選択機能のプロパティ
        this.selectedClips = new Set();
        
        console.log('🚀 Extensions constructor called');
        
        // 即座に初期化を試みる
        this.initAttempts = 0;
        this.tryInit();
    }
    
    tryInit() {
        this.initAttempts++;
        console.log(`🔄 Init attempt ${this.initAttempts}`);
        
        const timelineCanvas = document.getElementById('timelineCanvas');
        
        if (!timelineCanvas) {
            console.warn('⏳ Timeline canvas not ready, retrying...');
            if (this.initAttempts < 20) {
                setTimeout(() => this.tryInit(), 100);
            } else {
                console.error('❌ Failed to initialize after 20 attempts');
            }
            return;
        }
        
        this.init();
    }
    
    init() {
        console.log('✅ Extensions init() started');
        
        const timelineCanvas = document.getElementById('timelineCanvas');
        console.log('🎨 Timeline canvas:', timelineCanvas);
        
        // 右クリックメニューをセットアップ
        this.setupContextMenu();
        
        console.log('✅ Extensions initialized successfully');
    }
    
    // ========================================
    // 複数選択機能
    // ========================================
    
    toggleClipSelection(clip) {
        if (this.selectedClips.has(clip.id)) {
            this.selectedClips.delete(clip.id);
        } else {
            this.selectedClips.add(clip.id);
        }
        console.log('📋 Selected clips:', this.selectedClips.size);
        this.app.drawTimeline();
    }
    
    clearSelection() {
        this.selectedClips.clear();
        console.log('🧹 Selection cleared');
    }
    
    getSelectedClips() {
        return this.app.clips.filter(clip => this.selectedClips.has(clip.id));
    }
    
    isClipSelected(clipId) {
        return this.selectedClips.has(clipId);
    }
    
    drawSelectedClipHighlight(ctx, clip) {
        if (!this.isClipSelected(clip.id)) return;
        
        const clipX = clip.startTime * this.app.zoom;
        const clipWidth = clip.duration * this.app.zoom;
        const clipY = clip.track * this.app.trackHeight + 5;
        const clipHeight = this.app.trackHeight - 10;
        
        ctx.save();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.strokeRect(clipX - 2, clipY - 2, clipWidth + 4, clipHeight + 4);
        
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 20px Arial';
        ctx.fillText('✓', clipX + 8, clipY + 24);
        ctx.restore();
    }
    
    // ========================================
    // 右クリックメニュー
    // ========================================
    
    setupContextMenu() {
        const timelineCanvas = document.getElementById('timelineCanvas');
        
        console.log('🔧 Setting up context menu');
        
        // 既存のリスナーを削除
        if (this.boundContextMenuHandler) {
            timelineCanvas.removeEventListener('contextmenu', this.boundContextMenuHandler, true);
        }
        
        // ハンドラーをバインド
        this.boundContextMenuHandler = this.handleContextMenu.bind(this);
        
        // キャプチャフェーズで登録
        timelineCanvas.addEventListener('contextmenu', this.boundContextMenuHandler, true);
        
        console.log('✅ Context menu listener attached');
    }
    
    handleContextMenu(e) {
        console.log('🖱️ RIGHT CLICK DETECTED!');
        
        // デフォルトメニューを完全にブロック
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const timelineCanvas = document.getElementById('timelineCanvas');
        const rect = timelineCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        const x = (e.clientX - rect.left) + scrollContainer.scrollLeft;
        const y = e.clientY - rect.top;
        
        const clickedClip = this.app.getClipAt(x, y);
        console.log('🎯 Clicked clip:', clickedClip ? clickedClip.asset.name : 'none');
        
        if (clickedClip) {
            if (!this.selectedClips.has(clickedClip.id)) {
                this.selectedClips.clear();
                this.selectedClips.add(clickedClip.id);
                this.app.drawTimeline();
            }
            
            this.showContextMenu(e, clickedClip);
        }
        
        return false;
    }
    
    showContextMenu(e, clickedClip) {
        console.log('📋 Creating context menu');
        
        // 既存のメニューを削除
        const existing = document.getElementById('clipContextMenu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.id = 'clipContextMenu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: #3E2723;
            border: 2px solid #D2691E;
            border-radius: 6px;
            padding: 8px;
            z-index: 99999;
            box-shadow: 0 6px 20px rgba(0,0,0,0.8);
            min-width: 280px;
            font-family: sans-serif;
        `;
        
        const menuItems = [];
        
        if (this.selectedClips.size >= 1) {
            const count = this.selectedClips.size;
            menuItems.push(
                { 
                    label: `✨ 新規シーンにまとめる ${count > 1 ? `(${count}個)` : ''}`, 
                    action: () => this.groupSelectedClipsIntoNewScene() 
                },
                { 
                    label: `📦 既存シーンに移動 ${count > 1 ? `(${count}個)` : ''}`, 
                    action: () => this.moveSelectedClipsToExistingScene() 
                }
            );
            
            if (this.selectedClips.size > 1) {
                menuItems.push(
                    { label: '---', action: null },
                    { label: '❌ 選択をクリア', action: () => { this.clearSelection(); this.app.drawTimeline(); } }
                );
            }
        }
        
        for (const item of menuItems) {
            if (item.label === '---') {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: #8B4513; margin: 4px 0;';
                menu.appendChild(separator);
                continue;
            }
            
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 12px 16px;
                cursor: pointer;
                color: #F5DEB3;
                font-size: 14px;
                border-radius: 4px;
                transition: background 0.2s;
                user-select: none;
            `;
            
            menuItem.onmouseover = () => {
                menuItem.style.background = '#D2691E';
            };
            menuItem.onmouseout = () => {
                menuItem.style.background = 'transparent';
            };
            menuItem.onclick = (evt) => {
                evt.stopPropagation();
                console.log('📌 Menu item clicked:', item.label);
                if (item.action) item.action();
                menu.remove();
            };
            
            menu.appendChild(menuItem);
        }
        
        document.body.appendChild(menu);
        console.log('✅ Menu added to DOM');
        
        // メニュー外クリックで閉じる
        setTimeout(() => {
            const closeHandler = (event) => {
                if (!menu.contains(event.target)) {
                    menu.remove();
                    document.removeEventListener('mousedown', closeHandler, true);
                    document.removeEventListener('contextmenu', closeHandler, true);
                }
            };
            document.addEventListener('mousedown', closeHandler, true);
            document.addEventListener('contextmenu', closeHandler, true);
        }, 100);
    }
    
    // ========================================
    // シーン機能
    // ========================================
    
    groupSelectedClipsIntoNewScene() {
        const clips = this.getSelectedClips();
        
        if (clips.length === 0) {
            alert('クリップが選択されていません');
            return;
        }
        
        const sceneName = prompt('新しいシーン名:', `シーン ${clips.length}`);
        if (!sceneName || !sceneName.trim()) return;
        
        const sceneId = this.app.sceneManager.createScene(sceneName.trim(), null, true);
        this.moveClipsToScene(clips, sceneId, true);
        
        // まとめて履歴に保存
        this.app.saveHistory('クリップを新規シーンにまとめる');
        
        alert(`${clips.length}個のクリップを「${sceneName.trim()}」に移動しました`);
    }
    
    moveSelectedClipsToExistingScene() {
        const clips = this.getSelectedClips();
        
        if (clips.length === 0) {
            alert('クリップが選択されていません');
            return;
        }
        
        this.showSceneSelectionDialog(clips);
    }
    
    showSceneSelectionDialog(clipsToMove) {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #3E2723;
            border: 2px solid #8B4513;
            border-radius: 8px;
            padding: 24px;
            min-width: 400px;
            max-width: 600px;
            max-height: 70vh;
            overflow-y: auto;
        `;
        
        const header = document.createElement('h3');
        header.textContent = `${clipsToMove.length}個のクリップを移動`;
        header.style.cssText = 'margin: 0 0 16px 0; color: #F5DEB3; font-size: 18px;';
        dialog.appendChild(header);
        
        const sceneList = document.createElement('div');
        sceneList.style.cssText = 'margin-bottom: 16px;';
        
        const scenes = this.app.sceneManager.scenes;
        const currentSceneId = this.app.sceneManager.currentSceneId;
        
        for (const [sceneId, scene] of Object.entries(scenes)) {
            if (sceneId === currentSceneId) continue;
            
            const sceneItem = document.createElement('div');
            sceneItem.style.cssText = `
                padding: 12px;
                margin-bottom: 8px;
                background: #5D4037;
                border-radius: 4px;
                cursor: pointer;
                color: #F5DEB3;
                transition: background 0.2s;
            `;
            sceneItem.textContent = `🎬 ${scene.name}`;
            
            sceneItem.onmouseover = () => { sceneItem.style.background = '#D2691E'; };
            sceneItem.onmouseout = () => { sceneItem.style.background = '#5D4037'; };
            sceneItem.onclick = () => {
                this.moveClipsToScene(clipsToMove, sceneId);
                modal.remove();
                alert(`${clipsToMove.length}個を「${scene.name}」に移動`);
            };
            
            sceneList.appendChild(sceneItem);
        }
        
        dialog.appendChild(sceneList);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'キャンセル';
        cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #6D4C41;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.onclick = () => modal.remove();
        dialog.appendChild(cancelBtn);
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    }
    
    moveClipsToScene(clips, targetSceneId, skipHistory = false) {
        const targetScene = this.app.sceneManager.scenes[targetSceneId];
        if (!targetScene) return;
        
        // クリップを移動先シーンに追加（直接参照）
        for (const clip of clips) {
            targetScene.clips.push(clip);
        }
        
        // 現在のシーンからクリップを削除
        for (const clip of clips) {
            const index = this.app.clips.indexOf(clip);
            if (index !== -1) {
                this.app.clips.splice(index, 1);
            }
        }
        
        this.clearSelection();
        this.app.drawTimeline();
        this.app.updatePreview();
        if (!skipHistory) {
            this.app.saveHistory('クリップをシーンに移動');
        }
        this.app.sceneManager.updateScenePanel();
    }
}
