// ========================================
// sceneManager.js - シーン管理機能モジュール
// ========================================

class SceneManager {
    constructor(app) {
        this.app = app;
        
        // シーン構造
        this.scenes = {};
        this.currentSceneId = 'root';
        this.sceneIdCounter = 0;
        
        // ルートシーンを初期化
        this.initRootScene();
    }
    
    // ルートシーンを初期化
    initRootScene() {
        if (!this.scenes['root']) {
            this.scenes['root'] = {
                id: 'root',
                name: 'Root Timeline',
                clips: [],
                trackCount: 5,
                duration: 10,
                parentSceneId: null,
                childScenes: [],
                isCollapsed: false
            };
        }
    }
    
    // 新しいシーンを作成
    createScene(name = null, parentSceneId = null, skipHistory = false) {
        const sceneId = `scene_${this.sceneIdCounter++}`;
        const sceneName = name || `Scene ${this.sceneIdCounter}`;
        
        const newScene = {
            id: sceneId,
            name: sceneName,
            clips: [],
            trackCount: 5,
            duration: 5,
            parentSceneId: parentSceneId || 'root',
            childScenes: [],
            isCollapsed: false
        };
        
        this.scenes[sceneId] = newScene;
        
        // 親シーンの子リストに追加
        const parent = this.scenes[parentSceneId || 'root'];
        if (parent && !parent.childScenes.includes(sceneId)) {
            parent.childScenes.push(sceneId);
        }
        
        if (!skipHistory) {
            this.app.saveHistory('シーン作成');
        }
        this.updateScenePanel();
        
        return sceneId;
    }
    
    // シーンを削除
    deleteScene(sceneId) {
        if (sceneId === 'root') {
            alert('ルートタイムラインは削除できません');
            return;
        }
        
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        // 確認ダイアログ
        if (!confirm(`シーン「${scene.name}」を削除しますか？`)) {
            return;
        }
        
        // 子シーンも再帰的に削除
        for (const childId of scene.childScenes) {
            this.deleteScene(childId);
        }
        
        // 親シーンから削除
        if (scene.parentSceneId) {
            const parent = this.scenes[scene.parentSceneId];
            if (parent) {
                parent.childScenes = parent.childScenes.filter(id => id !== sceneId);
            }
        }
        
        // シーンを削除
        delete this.scenes[sceneId];
        
        // 現在のシーンが削除された場合はルートに戻る
        if (this.currentSceneId === sceneId) {
            this.switchToScene('root');
        }
        
        this.app.saveHistory('シーン削除');
        this.updateScenePanel();
    }
    
    // シーンをリネーム
    renameScene(sceneId, newName) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        scene.name = newName;
        this.app.saveHistory('シーン名変更');
        this.updateScenePanel();
    }
    
    // シーンを複製
    duplicateScene(sceneId) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        const newSceneId = this.createScene(`${scene.name} (コピー)`, scene.parentSceneId);
        const newScene = this.scenes[newSceneId];
        
        // クリップをディープコピー
        newScene.clips = JSON.parse(JSON.stringify(scene.clips));
        newScene.trackCount = scene.trackCount;
        newScene.duration = scene.duration;
        
        this.app.saveHistory('シーン複製');
        this.updateScenePanel();
        
        return newSceneId;
    }
    
    // シーンに切り替え
    switchToScene(sceneId) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        // 現在のシーンの状態を保存
        this.saveCurrentSceneState();
        
        // 新しいシーンに切り替え
        this.currentSceneId = sceneId;
        this.loadSceneState(sceneId);
        
        // UIを更新（即座に反映）
        this.updateScenePanel();
        this.updateBreadcrumb();
        
        // タイムラインとプレビューを強制的に再描画
        requestAnimationFrame(() => {
            this.app.drawTimeline();
            this.app.updatePreview();
            this.app.updatePropertiesPanel();
        });
    }
    
    // 現在のシーン状態を保存
    saveCurrentSceneState() {
        const scene = this.scenes[this.currentSceneId];
        if (!scene) return;
        
        // クリップを直接参照として保存（シャローコピー）
        // こうすることでimageElement等の非シリアライズ要素も保持される
        scene.clips = [...this.app.clips]; // 配列のシャローコピー
        scene.trackCount = this.app.trackCount;
        scene.duration = this.app.duration;
    }
    
    // シーン状態をロード
    loadSceneState(sceneId) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        // クリップを直接参照としてロード（シャローコピー）
        // こうすることでimageElement等の非シリアライズ要素も保持される
        this.app.clips = [...scene.clips]; // 配列のシャローコピー
        
        this.app.trackCount = scene.trackCount;
        this.app.duration = scene.duration;
        this.app.selectedClip = null;
    }
    
    // シーン素材を作成
    createSceneAsset(sceneId) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        // シーン素材として素材リストに追加
        const assetId = `scene_asset_${Date.now()}`;
        const sceneAsset = {
            id: assetId,
            name: scene.name,
            type: 'scene',
            sceneId: sceneId,
            duration: scene.duration,
            thumbnail: null // TODO: サムネイル生成
        };
        
        this.app.assets.push(sceneAsset);
        this.app.updateAssetExplorer();
        
        return assetId;
    }
    
    // シーン管理パネルを更新
    updateScenePanel() {
        const panel = document.getElementById('scenePanel');
        if (!panel) return;
        
        panel.innerHTML = '';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        header.innerHTML = `
            <h3>🎬 シーン</h3>
            <button class="round-button small" onclick="app.sceneManager.createScene()" title="新規シーン作成">➕</button>
        `;
        panel.appendChild(header);
        
        // シーンツリー
        const treeContainer = document.createElement('div');
        treeContainer.className = 'scene-tree-container';
        treeContainer.style.cssText = 'overflow-y: auto; flex: 1; padding: 10px;';
        
        // ルートから再帰的にツリーを構築
        this.buildSceneTree(treeContainer, 'root', 0);
        
        panel.appendChild(treeContainer);
    }
    
    // シーンツリーを再帰的に構築
    buildSceneTree(container, sceneId, depth) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        const isCurrentScene = sceneId === this.currentSceneId;
        const hasChildren = scene.childScenes && scene.childScenes.length > 0;
        
        const sceneItem = document.createElement('div');
        sceneItem.className = 'scene-item';
        sceneItem.style.cssText = `
            padding: 8px;
            padding-left: ${depth * 20 + 8}px;
            margin-bottom: 4px;
            background: ${isCurrentScene ? 'var(--accent-orange)' : 'var(--chocolate-main)'};
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            color: white;
        `;
        
        // 折りたたみアイコン
        if (hasChildren) {
            const collapseIcon = document.createElement('span');
            collapseIcon.textContent = scene.isCollapsed ? '▶' : '▼';
            collapseIcon.style.cssText = 'cursor: pointer; user-select: none; width: 16px;';
            collapseIcon.onclick = (e) => {
                e.stopPropagation();
                scene.isCollapsed = !scene.isCollapsed;
                this.updateScenePanel();
            };
            sceneItem.appendChild(collapseIcon);
        } else {
            const spacer = document.createElement('span');
            spacer.style.cssText = 'width: 16px;';
            sceneItem.appendChild(spacer);
        }
        
        // アイコン
        const icon = document.createElement('span');
        icon.textContent = sceneId === 'root' ? '📍' : '🎬';
        sceneItem.appendChild(icon);
        
        // シーン名
        const nameSpan = document.createElement('span');
        nameSpan.textContent = scene.name;
        nameSpan.style.flex = '1';
        sceneItem.appendChild(nameSpan);
        
        // クリップ数表示
        const clipCountSpan = document.createElement('span');
        clipCountSpan.textContent = `(${scene.clips.length}クリップ)`;
        clipCountSpan.style.cssText = 'font-size: 11px; opacity: 0.7; margin-right: 8px;';
        sceneItem.appendChild(clipCountSpan);
        
        // 時間表示
        const durationSpan = document.createElement('span');
        durationSpan.textContent = `${scene.duration.toFixed(1)}s`;
        durationSpan.style.cssText = 'font-size: 11px; opacity: 0.8;';
        sceneItem.appendChild(durationSpan);
        
        // ダブルクリックでシーン切り替え
        sceneItem.ondblclick = () => {
            this.switchToScene(sceneId);
        };
        
        // 右クリックメニュー
        sceneItem.oncontextmenu = (e) => {
            e.preventDefault();
            this.showSceneContextMenu(e, sceneId);
        };
        
        container.appendChild(sceneItem);
        
        // 子シーンを再帰的に追加
        if (hasChildren && !scene.isCollapsed) {
            for (const childId of scene.childScenes) {
                this.buildSceneTree(container, childId, depth + 1);
            }
        }
    }
    
    // シーンのコンテキストメニューを表示
    showSceneContextMenu(e, sceneId) {
        // 既存のメニューを削除
        const existing = document.getElementById('sceneContextMenu');
        if (existing) existing.remove();
        
        const menu = document.createElement('div');
        menu.id = 'sceneContextMenu';
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
        `;
        
        const menuItems = [
            { label: '✏️ 名前を変更', action: () => this.promptRenameScene(sceneId) },
            { label: '🎬 このシーンに移動', action: () => this.switchToScene(sceneId) },
            { label: '📦 素材として作成', action: () => this.createSceneAsset(sceneId) },
            { label: '📋 複製', action: () => this.duplicateScene(sceneId) },
            { label: '➕ 子シーンを追加', action: () => this.createScene(null, sceneId) }
        ];
        
        if (sceneId !== 'root') {
            menuItems.push({ label: '❌ 削除', action: () => this.deleteScene(sceneId) });
        }
        
        for (const item of menuItems) {
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
                item.action();
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
    
    // シーン名変更プロンプト
    promptRenameScene(sceneId) {
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        const newName = prompt('シーン名を入力:', scene.name);
        if (newName && newName.trim()) {
            this.renameScene(sceneId, newName.trim());
        }
    }
    
    // パンくずリストを更新
    updateBreadcrumb() {
        const breadcrumb = document.getElementById('sceneBreadcrumb');
        if (!breadcrumb) return;
        
        breadcrumb.innerHTML = '';
        
        // 現在のシーンまでのパスを取得
        const path = this.getScenePath(this.currentSceneId);
        
        for (let i = 0; i < path.length; i++) {
            const sceneId = path[i];
            const scene = this.scenes[sceneId];
            if (!scene) continue;
            
            const crumb = document.createElement('span');
            crumb.textContent = scene.name;
            crumb.style.cssText = `
                cursor: pointer;
                color: ${i === path.length - 1 ? 'var(--accent-orange)' : 'var(--biscuit-light)'};
                font-weight: ${i === path.length - 1 ? 'bold' : 'normal'};
            `;
            
            if (i < path.length - 1) {
                crumb.onclick = () => this.switchToScene(sceneId);
            }
            
            breadcrumb.appendChild(crumb);
            
            if (i < path.length - 1) {
                const separator = document.createElement('span');
                separator.textContent = ' > ';
                separator.style.color = 'var(--biscuit-main)';
                breadcrumb.appendChild(separator);
            }
        }
    }
    
    // シーンのパスを取得（ルートから現在まで）
    getScenePath(sceneId) {
        const path = [];
        let currentId = sceneId;
        
        while (currentId) {
            path.unshift(currentId);
            const scene = this.scenes[currentId];
            if (!scene) break;
            currentId = scene.parentSceneId;
        }
        
        return path;
    }
    
    // 上の階層に戻る
    goToParentScene() {
        const currentScene = this.scenes[this.currentSceneId];
        if (currentScene && currentScene.parentSceneId) {
            this.switchToScene(currentScene.parentSceneId);
        }
    }
    
    // シーンをタイムラインに配置する際のクリップ生成
    createSceneClip(sceneId, track, startTime) {
        const scene = this.scenes[sceneId];
        if (!scene) return null;
        
        // シーン素材を検索または作成
        let sceneAsset = this.app.assets.find(a => a.type === 'scene' && a.sceneId === sceneId);
        if (!sceneAsset) {
            const assetId = this.createSceneAsset(sceneId);
            sceneAsset = this.app.assets.find(a => a.id === assetId);
        }
        
        if (!sceneAsset) return null;
        
        // クリップを作成
        const clip = {
            id: Date.now(),
            asset: sceneAsset,
            track: track,
            startTime: startTime,
            duration: scene.duration,
            x: 0,
            y: 0,
            rotation: 0,
            scale: 1,
            opacity: 1,
            keyframes: {},
            transitionIn: { type: 'none', duration: 0 },
            transitionOut: { type: 'none', duration: 0 },
            blendMode: 'source-over',
            parent: null,
            children: [],
            anchorPoint: { x: 0.5, y: 0.5 },
            useOriginalSize: false,
            clipSource: null
        };
        
        return clip;
    }
    
    // シーンクリップをレンダリング（再帰的に子シーンもレンダリング）
    async renderSceneClip(ctx, clip, localTime, globalTransform) {
        if (!clip.asset || clip.asset.type !== 'scene') return;
        
        const sceneId = clip.asset.sceneId;
        const scene = this.scenes[sceneId];
        if (!scene) return;
        
        // シーン内の時間を計算
        const sceneTime = localTime % scene.duration;
        
        // 一時キャンバスにシーンをレンダリング
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.app.previewCanvas.width;
        tempCanvas.height = this.app.previewCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // シーン内の全クリップをレンダリング
        const sortedClips = [...scene.clips].sort((a, b) => a.track - b.track);
        
        for (const sceneClip of sortedClips) {
            if (sceneTime >= sceneClip.startTime && sceneTime < sceneClip.startTime + sceneClip.duration) {
                const clipLocalTime = sceneTime - sceneClip.startTime;
                
                // 再帰的にシーンクリップをレンダリング
                if (sceneClip.asset && sceneClip.asset.type === 'scene') {
                    await this.renderSceneClip(tempCtx, sceneClip, clipLocalTime, globalTransform);
                } else {
                    // 通常のクリップをレンダリング
                    await this.app.renderClip(tempCtx, sceneClip, clipLocalTime);
                }
            }
        }
        
        // 一時キャンバスをメインキャンバスに描画
        ctx.save();
        ctx.translate(globalTransform.x, globalTransform.y);
        ctx.rotate(globalTransform.rotation * Math.PI / 180);
        ctx.scale(globalTransform.scale, globalTransform.scale);
        ctx.globalAlpha = globalTransform.opacity;
        ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
        ctx.restore();
    }
    
    // プロジェクト保存時にシーンデータをシリアライズ
    serialize() {
        // 現在のシーン状態を保存
        this.saveCurrentSceneState();
        
        return {
            scenes: this.scenes,
            currentSceneId: this.currentSceneId,
            sceneIdCounter: this.sceneIdCounter
        };
    }
    
    // プロジェクト読み込み時にシーンデータをデシリアライズ
    deserialize(data) {
        if (!data) return;
        
        this.scenes = data.scenes || {};
        this.currentSceneId = data.currentSceneId || 'root';
        this.sceneIdCounter = data.sceneIdCounter || 0;
        
        // ルートシーンがない場合は初期化
        if (!this.scenes['root']) {
            this.initRootScene();
        }
        
        // 現在のシーンをロード
        this.loadSceneState(this.currentSceneId);
        this.updateScenePanel();
        this.updateBreadcrumb();
    }
}
