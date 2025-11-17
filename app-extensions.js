// ========================================
// app-extensions.js - 新機能専用モジュール
// Version: 2.3.0
// ========================================

class StarlitTimelineExtensions {
    constructor(app) {
        this.app = app;
        
        // 複数選択機能のプロパティ
        this.selectedClips = new Set(); // 選択されたクリップのIDセット
        this.isShiftPressed = false;
        
        this.init();
    }
    
    init() {
        console.log('🚀 Extensions module loaded (v2.3.0)');
        
        // Shiftキーの押下状態を監視
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift') {
                this.isShiftPressed = true;
            }
        });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === 'Shift') {
                this.isShiftPressed = false;
            }
        });
        
        // タイムラインの右クリックメニューをカスタマイズ
        this.setupTimelineContextMenu();
    }
    
    // ========================================
    // 複数選択機能
    // ========================================
    
    // クリップを選択に追加/削除
    toggleClipSelection(clip) {
        if (this.selectedClips.has(clip.id)) {
            this.selectedClips.delete(clip.id);
        } else {
            this.selectedClips.add(clip.id);
        }
        
        // タイムラインを再描画
        this.app.drawTimeline();
    }
    
    // すべての選択をクリア
    clearSelection() {
        this.selectedClips.clear();
    }
    
    // 選択されたクリップを取得
    getSelectedClips() {
        return this.app.clips.filter(clip => this.selectedClips.has(clip.id));
    }
    
    // クリップが選択されているか確認
    isClipSelected(clipId) {
        return this.selectedClips.has(clipId);
    }
    
    // ========================================
    // シーンまとめ機能
    // ========================================
    
    // 選択したクリップを新しいシーンにまとめる
    groupSelectedClipsIntoNewScene() {
        const selectedClips = this.getSelectedClips();
        
        if (selectedClips.length === 0) {
            alert('クリップが選択されていません');
            return;
        }
        
        // 新しいシーン名を入力
        const sceneName = prompt('新しいシーン名を入力してください:', `Scene from ${selectedClips.length} clips`);
        if (!sceneName || !sceneName.trim()) {
            return;
        }
        
        // 新しいシーンを作成
        const sceneId = this.app.sceneManager.createScene(sceneName.trim());
        
        // 選択されたクリップを新しいシーンに移動
        this.moveClipsToScene(selectedClips, sceneId);
        
        alert(`${selectedClips.length}個のクリップを「${sceneName.trim()}」シーンに移動しました`);
    }
    
    // 選択したクリップを既存のシーンに移動
    moveSelectedClipsToExistingScene() {
        const selectedClips = this.getSelectedClips();
        
        if (selectedClips.length === 0) {
            alert('クリップが選択されていません');
            return;
        }
        
        // シーン選択ダイアログを表示
        this.showSceneSelectionDialog(selectedClips);
    }
    
    // シーン選択ダイアログを表示
    showSceneSelectionDialog(clipsToMove) {
        // モーダルダイアログを作成
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: var(--chocolate-dark);
            border: 2px solid var(--chocolate-light);
            border-radius: 8px;
            padding: 20px;
            min-width: 400px;
            max-width: 600px;
            max-height: 70vh;
            overflow-y: auto;
        `;
        
        // ヘッダー
        const header = document.createElement('h3');
        header.textContent = `${clipsToMove.length}個のクリップを移動`;
        header.style.cssText = 'margin: 0 0 16px 0; color: var(--biscuit-light); font-size: 18px;';
        dialog.appendChild(header);
        
        // シーンリスト
        const sceneList = document.createElement('div');
        sceneList.style.cssText = 'margin-bottom: 16px;';
        
        const scenes = this.app.sceneManager.scenes;
        const currentSceneId = this.app.sceneManager.currentSceneId;
        
        for (const [sceneId, scene] of Object.entries(scenes)) {
            if (sceneId === currentSceneId) continue; // 現在のシーンは除外
            
            const sceneItem = document.createElement('div');
            sceneItem.style.cssText = `
                padding: 12px;
                margin-bottom: 8px;
                background: var(--chocolate-main);
                border-radius: 4px;
                cursor: pointer;
                color: var(--biscuit-light);
                transition: background 0.2s;
            `;
            sceneItem.textContent = `🎬 ${scene.name}`;
            
            sceneItem.onmouseover = () => {
                sceneItem.style.background = 'var(--accent-orange)';
            };
            sceneItem.onmouseout = () => {
                sceneItem.style.background = 'var(--chocolate-main)';
            };
            
            sceneItem.onclick = () => {
                this.moveClipsToScene(clipsToMove, sceneId);
                modal.remove();
                alert(`${clipsToMove.length}個のクリップを「${scene.name}」シーンに移動しました`);
            };
            
            sceneList.appendChild(sceneItem);
        }
        
        dialog.appendChild(sceneList);
        
        // キャンセルボタン
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'キャンセル';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            background: var(--chocolate-light);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelButton.onclick = () => modal.remove();
        dialog.appendChild(cancelButton);
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        // モーダル外クリックで閉じる
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }
    
    // クリップを指定したシーンに移動
    moveClipsToScene(clips, targetSceneId) {
        const targetScene = this.app.sceneManager.scenes[targetSceneId];
        if (!targetScene) return;
        
        // クリップをディープコピーして対象シーンに追加
        for (const clip of clips) {
            const clipCopy = JSON.parse(JSON.stringify(clip));
            targetScene.clips.push(clipCopy);
        }
        
        // 現在のシーンから削除
        for (const clip of clips) {
            const index = this.app.clips.indexOf(clip);
            if (index !== -1) {
                this.app.clips.splice(index, 1);
            }
        }
        
        // 選択をクリア
        this.clearSelection();
        
        // UIを更新
        this.app.drawTimeline();
        this.app.updatePreview();
        this.app.saveHistory('クリップをシーンに移動');
    }
    
    // ========================================
    // タイムライン右クリックメニュー
    // ========================================
    
    setupTimelineContextMenu() {
        const timelineCanvas = document.getElementById('timelineCanvas');
        if (!timelineCanvas) return;
        
        timelineCanvas.addEventListener('contextmenu', (e) => {
            // デフォルトのコンテキストメニューを無効化
            e.preventDefault();
            
            // クリック位置のクリップを取得
            const rect = timelineCanvas.getBoundingClientRect();
            const scrollContainer = document.getElementById('timelineScroll');
            const x = (e.clientX - rect.left) + scrollContainer.scrollLeft;
            const y = e.clientY - rect.top;
            
            const clickedClip = this.app.getClipAt(x, y);
            
            // 選択されたクリップがあれば、コンテキストメニューを表示
            if (this.selectedClips.size > 0 || clickedClip) {
                this.showClipContextMenu(e, clickedClip);
            }
        });
    }
    
    // クリップの右クリックメニューを表示
    showClipContextMenu(e, clickedClip) {
        // 既存のメニューを削除
        const existing = document.getElementById('clipContextMenu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.id = 'clipContextMenu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: var(--chocolate-dark);
            border: 1px solid var(--chocolate-light);
            border-radius: 4px;
            padding: 4px;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            min-width: 200px;
        `;
        
        const menuItems = [];
        
        // 複数選択されている場合
        if (this.selectedClips.size > 1 || (this.selectedClips.size === 1 && clickedClip && this.selectedClips.has(clickedClip.id))) {
            menuItems.push(
                { label: `✨ 新規シーンにまとめる (${this.selectedClips.size}個)`, action: () => this.groupSelectedClipsIntoNewScene() },
                { label: `📦 既存のシーンに移動 (${this.selectedClips.size}個)`, action: () => this.moveSelectedClipsToExistingScene() },
                { label: '---', action: null },
                { label: '❌ 選択をクリア', action: () => { this.clearSelection(); this.app.drawTimeline(); } }
            );
        } else if (clickedClip) {
            // 単一クリップの場合
            menuItems.push(
                { label: '🎬 このクリップを新規シーンに', action: () => {
                    this.selectedClips.clear();
                    this.selectedClips.add(clickedClip.id);
                    this.groupSelectedClipsIntoNewScene();
                }},
                { label: '📦 このクリップを既存シーンに移動', action: () => {
                    this.selectedClips.clear();
                    this.selectedClips.add(clickedClip.id);
                    this.moveSelectedClipsToExistingScene();
                }}
            );
        }
        
        for (const item of menuItems) {
            if (item.label === '---') {
                const separator = document.createElement('div');
                separator.style.cssText = 'height: 1px; background: var(--chocolate-light); margin: 4px 0;';
                menu.appendChild(separator);
                continue;
            }
            
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                white-space: nowrap;
                color: white;
                font-size: 13px;
            `;
            menuItem.onmouseover = () => {
                menuItem.style.background = 'var(--accent-orange)';
            };
            menuItem.onmouseout = () => {
                menuItem.style.background = 'transparent';
            };
            menuItem.onclick = () => {
                if (item.action) item.action();
                menu.remove();
            };
            menu.appendChild(menuItem);
        }
        
        document.body.appendChild(menu);
        
        // メニュー外クリックで閉じる
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 0);
    }
    
    // ========================================
    // タイムライン描画のオーバーライド（選択表示）
    // ========================================
    
    // 選択されたクリップを強調表示
    drawSelectedClipHighlight(ctx, clip) {
        if (!this.isClipSelected(clip.id)) return;
        
        const clipX = clip.startTime * this.app.zoom;
        const clipWidth = clip.duration * this.app.zoom;
        const clipY = 40 + clip.track * this.app.trackHeight;
        const clipHeight = this.app.trackHeight - 10;
        
        // 選択枠を描画
        ctx.strokeStyle = '#FFD700'; // ゴールド
        ctx.lineWidth = 3;
        ctx.strokeRect(clipX, clipY, clipWidth, clipHeight);
        
        // 選択マーカー
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('✓', clipX + 5, clipY + 20);
    }
}

// このファイルには今後追加する新機能のみを記述します
// 既存機能はapp-core.jsに残します
