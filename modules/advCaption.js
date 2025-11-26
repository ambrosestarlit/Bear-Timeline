// ========================================
// advCaption.js - ADV風字幕モジュール
// Version: 1.1.0 - 別ウィンドウエディター対応
// ========================================

class ADVCaptionManager {
    constructor(app) {
        this.app = app;
        
        // メッセージボックスのカテゴリ定義
        this.messageBoxCategories = {
            elegant: { name: 'エレガント', files: ['E01', 'E02', 'E03'] },
            stylish: { name: 'スタイリッシュ', files: ['S01'] },
            dot: { name: 'ドット風', files: ['D01', 'D02', 'D03', 'D04'] },
            pop: { name: 'ポップ', files: ['P01', 'P02', 'P03', 'P04'] },
            japanese: { name: '和風', files: ['J01', 'J02', 'J03', 'J04'] }
        };
        
        // 利用可能なフォント
        this.fonts = [
            { id: 'jk-maru', name: 'JK丸ゴシック', family: "'JK Maru Gothic', sans-serif" },
            { id: 'cinecaption', name: 'シネキャプション', family: "'CineCaption', sans-serif" }
        ];
        
        // トランジション設定
        this.transitions = [
            { id: 'none', name: 'なし' },
            { id: 'fade', name: 'フェード' },
            { id: 'slide_up', name: 'スライド(上から)' },
            { id: 'slide_down', name: 'スライド(下から)' },
            { id: 'scale', name: 'スケール' }
        ];
        
        // 読み込み済みメッセージボックス画像キャッシュ
        this.messageBoxImages = {};
        
        // グローバルタイプライター速度（文字/秒）
        this.globalTypewriterSpeed = 20;
        
        // エディターウィンドウ参照
        this.editorWindow = null;
        
        // 初期化
        this.init();
    }
    
    init() {
        const savedSpeed = localStorage.getItem('advCaption_typewriterSpeed');
        if (savedSpeed) {
            this.globalTypewriterSpeed = parseFloat(savedSpeed);
        }
        console.log('✅ ADVCaptionManager initialized');
    }
    
    // メッセージボックス画像を読み込み
    loadMessageBoxImage(category, file) {
        const key = `${category}/${file}`;
        
        if (this.messageBoxImages[key]) {
            return Promise.resolve(this.messageBoxImages[key]);
        }
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.messageBoxImages[key] = img;
                console.log(`✅ MessageBox loaded: ${key}`);
                resolve(img);
            };
            img.onerror = () => {
                console.error(`❌ Failed to load message box: ${key}`);
                reject(new Error(`Failed to load: ${key}`));
            };
            img.src = `assets/msgbox/${category}/${file}.png`;
        });
    }
    
    // ADV字幕クリップを作成
    createADVCaptionClip() {
        const asset = {
            id: Date.now() + Math.random(),
            name: `ADV字幕`,
            type: 'adv-caption',
            advCaptionSettings: {
                characterName: '',
                dialogueText: 'ここにセリフを入力',
                messageBox: {
                    category: 'japanese',
                    file: 'J01',
                    opacity: 100,
                    scale: 100,
                    positionY: 0
                },
                nameSettings: {
                    fontSize: 32,
                    fontFamily: 'jk-maru',
                    color: '#FFFFFF',
                    strokeColor: '#000000',
                    strokeWidth: 2,
                    positionX: 100,
                    positionY: 750,
                    visible: true
                },
                dialogueSettings: {
                    fontSize: 40,
                    fontFamily: 'jk-maru',
                    color: '#FFFFFF',
                    strokeColor: '#000000',
                    strokeWidth: 3,
                    marginLeft: 100,
                    marginRight: 100,
                    marginTop: 820,
                    lineHeight: 1.5,
                    letterSpacing: 2
                },
                typewriter: {
                    enabled: true,
                    useGlobalSpeed: true,
                    localSpeed: 20
                },
                transition: {
                    in: 'fade',
                    out: 'fade',
                    duration: 0.3
                },
                keyframes: []
            }
        };
        
        this.app.assets.push(asset);
        this.app.addClipFromAsset(asset.id, this.app.currentTime, 0);
        
        const addedClip = this.app.clips[this.app.clips.length - 1];
        this.app.selectedClip = addedClip;
        
        // メッセージボックス画像をプリロード
        this.loadMessageBoxImage(
            asset.advCaptionSettings.messageBox.category,
            asset.advCaptionSettings.messageBox.file
        ).then(() => {
            this.app.updatePreview();
        });
        
        this.app.updatePropertiesPanel();
        this.app.drawTimeline();
        this.app.updatePreview();
        
        // 自動でエディターウィンドウを開く
        this.openEditorWindow();
        
        return addedClip;
    }
    
    // ADV字幕を描画
    drawADVCaption(clip, ctx, currentTime) {
        const settings = clip.asset.advCaptionSettings;
        if (!settings) {
            return;
        }
        
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // クリップ内の相対時間
        const localTime = currentTime - clip.startTime;
        const clipDuration = clip.duration;
        
        // 範囲外なら描画しない
        if (localTime < 0 || localTime > clipDuration) {
            return;
        }
        
        // 現在時刻のキャラ名と台詞を取得（キーフレームからの経過時間も計算）
        let displayName = settings.characterName;
        let displayDialogue = settings.dialogueText;
        let keyframeStartTime = 0; // 現在のキーフレーム（またはクリップ）の開始時間
        
        if (settings.keyframes && settings.keyframes.length > 0) {
            const sortedKeyframes = [...settings.keyframes].sort((a, b) => a.time - b.time);
            let activeKeyframe = null;
            
            for (const kf of sortedKeyframes) {
                if (kf.time <= localTime) {
                    activeKeyframe = kf;
                    keyframeStartTime = kf.time;
                } else {
                    break;
                }
            }
            
            if (activeKeyframe) {
                if (activeKeyframe.characterName !== undefined) {
                    displayName = activeKeyframe.characterName;
                }
                if (activeKeyframe.dialogueText !== undefined) {
                    displayDialogue = activeKeyframe.dialogueText;
                }
            }
        }
        
        // キーフレームからの経過時間（タイプライター用）
        const timeSinceKeyframe = localTime - keyframeStartTime;
        
        // トランジション計算
        const transitionDuration = settings.transition.duration;
        let transitionProgress = 1;
        let transitionType = null;
        
        if (localTime < transitionDuration) {
            transitionProgress = localTime / transitionDuration;
            transitionType = settings.transition.in;
        } else if (localTime > clipDuration - transitionDuration) {
            transitionProgress = (clipDuration - localTime) / transitionDuration;
            transitionType = settings.transition.out;
        }
        
        // コンテキストを保存して変形をリセット
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // トランジションエフェクト適用
        this.applyTransition(ctx, transitionType, transitionProgress, canvasWidth, canvasHeight, settings);
        
        // メッセージボックスを描画
        this.drawMessageBox(ctx, settings, canvasWidth, canvasHeight);
        
        // キャラクター名を描画
        if (settings.nameSettings.visible && displayName) {
            this.drawCharacterName(ctx, displayName, settings);
        }
        
        // 台詞テキストを描画（キーフレームからの経過時間を使用）
        if (displayDialogue) {
            this.drawDialogueText(ctx, displayDialogue, settings, timeSinceKeyframe, canvasWidth);
        }
        
        ctx.restore();
    }
    
    // トランジションエフェクト適用
    applyTransition(ctx, type, progress, canvasWidth, canvasHeight, settings) {
        if (!type || type === 'none' || progress >= 1) return;
        
        const easeProgress = this.easeOutCubic(progress);
        
        switch (type) {
            case 'fade':
                ctx.globalAlpha = easeProgress;
                break;
            case 'slide_up':
                ctx.translate(0, (1 - easeProgress) * 100);
                ctx.globalAlpha = easeProgress;
                break;
            case 'slide_down':
                ctx.translate(0, (1 - easeProgress) * -100);
                ctx.globalAlpha = easeProgress;
                break;
            case 'scale':
                const scale = 0.8 + (0.2 * easeProgress);
                const centerX = canvasWidth / 2;
                const centerY = canvasHeight - 200;
                ctx.translate(centerX, centerY);
                ctx.scale(scale, scale);
                ctx.translate(-centerX, -centerY);
                ctx.globalAlpha = easeProgress;
                break;
        }
    }
    
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    
    // メッセージボックスを描画
    drawMessageBox(ctx, settings, canvasWidth, canvasHeight) {
        const msgBox = settings.messageBox;
        const key = `${msgBox.category}/${msgBox.file}`;
        const img = this.messageBoxImages[key];
        
        if (!img) {
            console.log('⏳ メッセージボックス読み込み中:', key);
            this.loadMessageBoxImage(msgBox.category, msgBox.file).then(() => {
                console.log('✅ メッセージボックス読み込み完了:', key);
                this.app.updatePreview();
            }).catch(err => {
                console.error('❌ メッセージボックス読み込み失敗:', err);
            });
            // 画像がなくても続行（テキストは表示される）
            return;
        }
        
        ctx.save();
        ctx.globalAlpha *= (msgBox.opacity / 100);
        
        const scale = msgBox.scale / 100;
        const drawWidth = canvasWidth * scale;
        const drawHeight = canvasHeight * scale;
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = msgBox.positionY;
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }
    
    // キャラクター名を描画
    drawCharacterName(ctx, name, settings) {
        const ns = settings.nameSettings;
        const fontFamily = this.getFontFamily(ns.fontFamily);
        
        ctx.font = `${ns.fontSize}px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        if (ns.strokeWidth > 0) {
            ctx.strokeStyle = ns.strokeColor;
            ctx.lineWidth = ns.strokeWidth * 2;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(name, ns.positionX, ns.positionY);
        }
        
        ctx.fillStyle = ns.color;
        ctx.fillText(name, ns.positionX, ns.positionY);
    }
    
    // 台詞テキストを描画
    drawDialogueText(ctx, text, settings, localTime, canvasWidth) {
        const ds = settings.dialogueSettings;
        const tw = settings.typewriter;
        const fontFamily = this.getFontFamily(ds.fontFamily);
        
        ctx.font = `${ds.fontSize}px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        let displayLength = text.length;
        
        if (tw.enabled) {
            const speed = tw.useGlobalSpeed ? this.globalTypewriterSpeed : tw.localSpeed;
            displayLength = Math.floor(localTime * speed);
            displayLength = Math.min(displayLength, text.length);
        }
        
        const displayText = text.substring(0, displayLength);
        const maxWidth = canvasWidth - ds.marginLeft - ds.marginRight;
        const startX = ds.marginLeft;
        const startY = ds.marginTop;
        
        const lines = this.wrapText(ctx, displayText, maxWidth);
        
        lines.forEach((line, index) => {
            const y = startY + index * (ds.fontSize * ds.lineHeight);
            
            if (ds.letterSpacing && ds.letterSpacing !== 0) {
                this.drawTextWithSpacing(ctx, line, startX, y, ds);
            } else {
                if (ds.strokeWidth > 0) {
                    ctx.strokeStyle = ds.strokeColor;
                    ctx.lineWidth = ds.strokeWidth * 2;
                    ctx.lineJoin = 'round';
                    ctx.miterLimit = 2;
                    ctx.strokeText(line, startX, y);
                }
                ctx.fillStyle = ds.color;
                ctx.fillText(line, startX, y);
            }
        });
    }
    
    drawTextWithSpacing(ctx, text, x, y, settings) {
        const chars = [...text];
        let currentX = x;
        
        chars.forEach(char => {
            if (settings.strokeWidth > 0) {
                ctx.strokeStyle = settings.strokeColor;
                ctx.lineWidth = settings.strokeWidth * 2;
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.strokeText(char, currentX, y);
            }
            ctx.fillStyle = settings.color;
            ctx.fillText(char, currentX, y);
            
            const metrics = ctx.measureText(char);
            currentX += metrics.width + settings.letterSpacing;
        });
    }
    
    wrapText(ctx, text, maxWidth) {
        const lines = [];
        const paragraphs = text.split('\n');
        
        paragraphs.forEach(paragraph => {
            const chars = [...paragraph];
            let currentLine = '';
            
            chars.forEach(char => {
                const testLine = currentLine + char;
                const metrics = ctx.measureText(testLine);
                
                if (metrics.width > maxWidth && currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            });
            
            if (currentLine) {
                lines.push(currentLine);
            }
        });
        
        return lines;
    }
    
    getFontFamily(fontId) {
        const font = this.fonts.find(f => f.id === fontId);
        return font ? font.family : "'JK Maru Gothic', sans-serif";
    }
    
    setGlobalTypewriterSpeed(speed) {
        this.globalTypewriterSpeed = parseFloat(speed);
        localStorage.setItem('advCaption_typewriterSpeed', speed.toString());
        this.app.updatePreview();
    }
    
    // キーフレームを追加
    addKeyframe(clip) {
        if (!clip || clip.asset.type !== 'adv-caption') return;
        
        const settings = clip.asset.advCaptionSettings;
        const localTime = this.app.currentTime - clip.startTime;
        
        const existingIndex = settings.keyframes.findIndex(
            kf => Math.abs(kf.time - localTime) < 0.001
        );
        
        if (existingIndex >= 0) {
            settings.keyframes[existingIndex] = {
                time: localTime,
                characterName: settings.characterName,
                dialogueText: settings.dialogueText
            };
        } else {
            settings.keyframes.push({
                time: localTime,
                characterName: settings.characterName,
                dialogueText: settings.dialogueText
            });
            settings.keyframes.sort((a, b) => a.time - b.time);
        }
        
        this.app.drawTimeline();
        this.updateEditorKeyframeList();
    }
    
    removeKeyframe(clip, index) {
        if (!clip || clip.asset.type !== 'adv-caption') return;
        
        const settings = clip.asset.advCaptionSettings;
        if (index >= 0 && index < settings.keyframes.length) {
            settings.keyframes.splice(index, 1);
            this.app.drawTimeline();
            this.updateEditorKeyframeList();
        }
    }
    
    clearKeyframes(clip) {
        if (!clip || clip.asset.type !== 'adv-caption') return;
        clip.asset.advCaptionSettings.keyframes = [];
        this.app.drawTimeline();
        this.updateEditorKeyframeList();
    }
    
    // ===== エディターウィンドウ =====
    
    openEditorWindow() {
        // 既存のウィンドウがあればフォーカス
        if (this.editorWindow && document.body.contains(this.editorWindow)) {
            this.editorWindow.style.zIndex = '10000';
            this.updateEditorContent();
            return;
        }
        
        // ウィンドウ作成
        const win = document.createElement('div');
        win.id = 'advCaptionEditorWindow';
        win.className = 'adv-editor-window';
        win.innerHTML = `
            <div class="adv-editor-header">
                <span class="adv-editor-title">🎮 ADV風字幕エディター</span>
                <button class="adv-editor-close" onclick="app.advCaptionManager.closeEditorWindow()">×</button>
            </div>
            <div class="adv-editor-body">
                <div class="adv-editor-left">
                    <div id="advEditorSettings"></div>
                </div>
                <div class="adv-editor-right">
                    <div class="adv-preview-area">
                        <div class="adv-preview-label">📺 プレビュー</div>
                        <div class="adv-preview-container">
                            <canvas id="advPreviewCanvas" width="640" height="360"></canvas>
                        </div>
                    </div>
                    <div class="adv-input-area" id="advEditorInput"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(win);
        this.editorWindow = win;
        
        // プレビューキャンバスを取得
        this.previewCanvas = document.getElementById('advPreviewCanvas');
        this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;
        
        // ドラッグ可能にする
        this.makeWindowDraggable(win);
        
        // 内容を更新
        this.updateEditorContent();
        
        // プレビューを開始
        this.startPreviewLoop();
    }
    
    closeEditorWindow() {
        if (this.editorWindow) {
            this.stopPreviewLoop();
            this.editorWindow.remove();
            this.editorWindow = null;
            this.previewCanvas = null;
            this.previewCtx = null;
        }
    }
    
    // プレビューループを開始
    startPreviewLoop() {
        if (this.previewLoopId) return;
        
        const loop = () => {
            // キャンバスが未取得なら取得
            if (!this.previewCanvas || !this.previewCtx) {
                this.previewCanvas = document.getElementById('advPreviewCanvas');
                if (this.previewCanvas) {
                    this.previewCtx = this.previewCanvas.getContext('2d');
                }
            }
            this.updateEditorPreview();
            this.previewLoopId = requestAnimationFrame(loop);
        };
        this.previewLoopId = requestAnimationFrame(loop);
    }
    
    // プレビューループを停止
    stopPreviewLoop() {
        if (this.previewLoopId) {
            cancelAnimationFrame(this.previewLoopId);
            this.previewLoopId = null;
        }
    }
    
    // エディター内プレビューを更新（入力内容をプレビュー）
    updateEditorPreview() {
        if (!this.previewCtx || !this.previewCanvas) return;
        
        const clip = this.app.selectedClip;
        if (!clip || clip.asset.type !== 'adv-caption') {
            // クリップがない場合はグレー背景
            this.previewCtx.fillStyle = '#333';
            this.previewCtx.fillRect(0, 0, this.previewCanvas.width, this.previewCanvas.height);
            this.previewCtx.fillStyle = '#666';
            this.previewCtx.font = '16px sans-serif';
            this.previewCtx.textAlign = 'center';
            this.previewCtx.fillText('ADV字幕クリップを選択してください', this.previewCanvas.width / 2, this.previewCanvas.height / 2);
            return;
        }
        
        const ctx = this.previewCtx;
        const canvas = this.previewCanvas;
        
        // 背景をクリア（黒）
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // スケール計算（1920x1080 → 640x360）
        const scaleX = canvas.width / 1920;
        const scaleY = canvas.height / 1080;
        
        ctx.save();
        ctx.scale(scaleX, scaleY);
        
        const settings = clip.asset.advCaptionSettings;
        
        // 入力中の内容を直接プレビュー（キーフレームではなく現在の設定値）
        const displayName = settings.characterName;
        const displayDialogue = settings.dialogueText;
        
        // メッセージボックスを描画
        this.drawMessageBoxPreview(ctx, settings, 1920, 1080);
        
        // キャラクター名を描画
        if (settings.nameSettings.visible && displayName) {
            this.drawCharacterName(ctx, displayName, settings);
        }
        
        // 台詞テキストを描画（タイプライターなし、全文表示）
        if (displayDialogue) {
            this.drawDialogueTextPreview(ctx, displayDialogue, settings, 1920, null);
        }
        
        ctx.restore();
    }
    
    // プレビュー用メッセージボックス描画
    drawMessageBoxPreview(ctx, settings, canvasWidth, canvasHeight) {
        const msgBox = settings.messageBox;
        const key = `${msgBox.category}/${msgBox.file}`;
        const img = this.messageBoxImages[key];
        
        if (!img) return;
        
        ctx.save();
        ctx.globalAlpha = msgBox.opacity / 100;
        
        const scale = msgBox.scale / 100;
        const drawWidth = canvasWidth * scale;
        const drawHeight = canvasHeight * scale;
        const drawX = (canvasWidth - drawWidth) / 2;
        const drawY = msgBox.positionY;
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
    }
    
    // プレビュー用台詞描画（タイプライター効果付き）
    drawDialogueTextPreview(ctx, text, settings, canvasWidth, timeSinceKeyframe) {
        const ds = settings.dialogueSettings;
        const tw = settings.typewriter;
        const fontFamily = this.getFontFamily(ds.fontFamily);
        
        ctx.font = `${ds.fontSize}px ${fontFamily}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // タイプライター効果（nullの場合は全文表示）
        let displayLength = text.length;
        if (tw.enabled && timeSinceKeyframe !== null && timeSinceKeyframe !== undefined) {
            const speed = tw.useGlobalSpeed ? this.globalTypewriterSpeed : tw.localSpeed;
            displayLength = Math.floor(timeSinceKeyframe * speed);
            displayLength = Math.min(displayLength, text.length);
        }
        
        const displayText = text.substring(0, displayLength);
        const maxWidth = canvasWidth - ds.marginLeft - ds.marginRight;
        const startX = ds.marginLeft;
        const startY = ds.marginTop;
        
        const lines = this.wrapText(ctx, displayText, maxWidth);
        
        lines.forEach((line, index) => {
            const y = startY + index * (ds.fontSize * ds.lineHeight);
            
            if (ds.letterSpacing && ds.letterSpacing !== 0) {
                this.drawTextWithSpacing(ctx, line, startX, y, ds);
            } else {
                if (ds.strokeWidth > 0) {
                    ctx.strokeStyle = ds.strokeColor;
                    ctx.lineWidth = ds.strokeWidth * 2;
                    ctx.lineJoin = 'round';
                    ctx.miterLimit = 2;
                    ctx.strokeText(line, startX, y);
                }
                ctx.fillStyle = ds.color;
                ctx.fillText(line, startX, y);
            }
        });
    }
    
    updateEditorContent() {
        if (!this.editorWindow) return;
        
        const clip = this.app.selectedClip;
        if (!clip || clip.asset.type !== 'adv-caption') {
            const settingsEl = document.getElementById('advEditorSettings');
            const inputEl = document.getElementById('advEditorInput');
            if (settingsEl) settingsEl.innerHTML = '<div class="adv-no-clip">ADV字幕クリップを選択してください</div>';
            if (inputEl) inputEl.innerHTML = '';
            return;
        }
        
        const settings = clip.asset.advCaptionSettings;
        
        // 左カラム: 設定項目
        this.renderSettingsPanel(settings);
        
        // 右カラム: 入力エリア
        this.renderInputPanel(settings);
    }
    
    renderSettingsPanel(settings) {
        const container = document.getElementById('advEditorSettings');
        if (!container) return;
        
        // カテゴリオプション
        let categoryOptions = '';
        for (const [key, cat] of Object.entries(this.messageBoxCategories)) {
            categoryOptions += `<option value="${key}" ${key === settings.messageBox.category ? 'selected' : ''}>${cat.name}</option>`;
        }
        
        // バリエーションオプション
        const currentCat = this.messageBoxCategories[settings.messageBox.category];
        let variationOptions = '';
        if (currentCat) {
            currentCat.files.forEach(file => {
                variationOptions += `<option value="${file}" ${file === settings.messageBox.file ? 'selected' : ''}>${file}</option>`;
            });
        }
        
        container.innerHTML = `
            <!-- メッセージボックス -->
            <div class="adv-section">
                <div class="adv-section-title">📦 メッセージボックス</div>
                <div class="adv-row">
                    <label>カテゴリ</label>
                    <select id="advMsgCategory" onchange="app.advCaptionManager.onCategoryChange(this.value)">${categoryOptions}</select>
                </div>
                <div class="adv-row">
                    <label>種類</label>
                    <select id="advMsgVariation" onchange="app.advCaptionManager.onVariationChange(this.value)">${variationOptions}</select>
                </div>
                <div class="adv-row">
                    <label>不透明度</label>
                    <input type="range" min="0" max="100" value="${settings.messageBox.opacity}" 
                           oninput="app.advCaptionManager.setSetting('messageBox.opacity', this.value)">
                    <span class="adv-val">${settings.messageBox.opacity}%</span>
                </div>
                <div class="adv-row">
                    <label>スケール</label>
                    <input type="range" min="50" max="150" value="${settings.messageBox.scale}" 
                           oninput="app.advCaptionManager.setSetting('messageBox.scale', this.value)">
                    <span class="adv-val">${settings.messageBox.scale}%</span>
                </div>
                <div class="adv-row">
                    <label>Y位置</label>
                    <input type="range" min="-200" max="200" value="${settings.messageBox.positionY}" 
                           oninput="app.advCaptionManager.setSetting('messageBox.positionY', this.value)">
                    <span class="adv-val">${settings.messageBox.positionY}px</span>
                </div>
            </div>
            
            <!-- キャラ名設定 -->
            <div class="adv-section">
                <div class="adv-section-title">👤 キャラクター名</div>
                <div class="adv-row">
                    <label>表示</label>
                    <input type="checkbox" ${settings.nameSettings.visible ? 'checked' : ''} 
                           onchange="app.advCaptionManager.setSetting('nameSettings.visible', this.checked)">
                </div>
                <div class="adv-row">
                    <label>フォント</label>
                    <select onchange="app.advCaptionManager.setSetting('nameSettings.fontFamily', this.value)">
                        ${this.fonts.map(f => `<option value="${f.id}" ${f.id === settings.nameSettings.fontFamily ? 'selected' : ''}>${f.name}</option>`).join('')}
                    </select>
                </div>
                <div class="adv-row">
                    <label>サイズ</label>
                    <input type="range" min="16" max="80" value="${settings.nameSettings.fontSize}" 
                           oninput="app.advCaptionManager.setSetting('nameSettings.fontSize', this.value)">
                    <span class="adv-val">${settings.nameSettings.fontSize}px</span>
                </div>
                <div class="adv-row">
                    <label>文字色</label>
                    <input type="color" value="${settings.nameSettings.color}" 
                           onchange="app.advCaptionManager.setSetting('nameSettings.color', this.value)">
                </div>
                <div class="adv-row">
                    <label>縁色</label>
                    <input type="color" value="${settings.nameSettings.strokeColor}" 
                           onchange="app.advCaptionManager.setSetting('nameSettings.strokeColor', this.value)">
                </div>
                <div class="adv-row">
                    <label>縁太さ</label>
                    <input type="range" min="0" max="10" value="${settings.nameSettings.strokeWidth}" 
                           oninput="app.advCaptionManager.setSetting('nameSettings.strokeWidth', this.value)">
                    <span class="adv-val">${settings.nameSettings.strokeWidth}px</span>
                </div>
                <div class="adv-row">
                    <label>X位置</label>
                    <input type="range" min="0" max="500" value="${settings.nameSettings.positionX}" 
                           oninput="app.advCaptionManager.setSetting('nameSettings.positionX', this.value)">
                    <span class="adv-val">${settings.nameSettings.positionX}px</span>
                </div>
                <div class="adv-row">
                    <label>Y位置</label>
                    <input type="range" min="600" max="1000" value="${settings.nameSettings.positionY}" 
                           oninput="app.advCaptionManager.setSetting('nameSettings.positionY', this.value)">
                    <span class="adv-val">${settings.nameSettings.positionY}px</span>
                </div>
            </div>
            
            <!-- 台詞設定 -->
            <div class="adv-section">
                <div class="adv-section-title">💬 台詞テキスト</div>
                <div class="adv-row">
                    <label>フォント</label>
                    <select onchange="app.advCaptionManager.setSetting('dialogueSettings.fontFamily', this.value)">
                        ${this.fonts.map(f => `<option value="${f.id}" ${f.id === settings.dialogueSettings.fontFamily ? 'selected' : ''}>${f.name}</option>`).join('')}
                    </select>
                </div>
                <div class="adv-row">
                    <label>サイズ</label>
                    <input type="range" min="20" max="100" value="${settings.dialogueSettings.fontSize}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.fontSize', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.fontSize}px</span>
                </div>
                <div class="adv-row">
                    <label>文字色</label>
                    <input type="color" value="${settings.dialogueSettings.color}" 
                           onchange="app.advCaptionManager.setSetting('dialogueSettings.color', this.value)">
                </div>
                <div class="adv-row">
                    <label>縁色</label>
                    <input type="color" value="${settings.dialogueSettings.strokeColor}" 
                           onchange="app.advCaptionManager.setSetting('dialogueSettings.strokeColor', this.value)">
                </div>
                <div class="adv-row">
                    <label>縁太さ</label>
                    <input type="range" min="0" max="10" value="${settings.dialogueSettings.strokeWidth}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.strokeWidth', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.strokeWidth}px</span>
                </div>
                <div class="adv-row">
                    <label>行間</label>
                    <input type="range" min="1" max="3" step="0.1" value="${settings.dialogueSettings.lineHeight}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.lineHeight', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.lineHeight}</span>
                </div>
                <div class="adv-row">
                    <label>字間</label>
                    <input type="range" min="0" max="20" value="${settings.dialogueSettings.letterSpacing}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.letterSpacing', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.letterSpacing}px</span>
                </div>
                <div class="adv-row">
                    <label>左マージン</label>
                    <input type="range" min="0" max="400" value="${settings.dialogueSettings.marginLeft}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.marginLeft', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.marginLeft}px</span>
                </div>
                <div class="adv-row">
                    <label>右マージン</label>
                    <input type="range" min="0" max="400" value="${settings.dialogueSettings.marginRight}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.marginRight', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.marginRight}px</span>
                </div>
                <div class="adv-row">
                    <label>上マージン</label>
                    <input type="range" min="600" max="1000" value="${settings.dialogueSettings.marginTop}" 
                           oninput="app.advCaptionManager.setSetting('dialogueSettings.marginTop', this.value)">
                    <span class="adv-val">${settings.dialogueSettings.marginTop}px</span>
                </div>
            </div>
            
            <!-- タイプライター -->
            <div class="adv-section">
                <div class="adv-section-title">⌨️ タイプライター</div>
                <div class="adv-row">
                    <label>有効</label>
                    <input type="checkbox" ${settings.typewriter.enabled ? 'checked' : ''} 
                           onchange="app.advCaptionManager.setSetting('typewriter.enabled', this.checked)">
                </div>
                <div class="adv-row">
                    <label>グローバル速度</label>
                    <input type="checkbox" ${settings.typewriter.useGlobalSpeed ? 'checked' : ''} 
                           onchange="app.advCaptionManager.setSetting('typewriter.useGlobalSpeed', this.checked)">
                </div>
                <div class="adv-row">
                    <label>速度</label>
                    <input type="range" min="5" max="100" value="${this.globalTypewriterSpeed}" 
                           oninput="app.advCaptionManager.setGlobalTypewriterSpeed(this.value)">
                    <span class="adv-val">${this.globalTypewriterSpeed}文字/秒</span>
                </div>
            </div>
            
            <!-- トランジション -->
            <div class="adv-section">
                <div class="adv-section-title">✨ トランジション</div>
                <div class="adv-row">
                    <label>表示</label>
                    <select onchange="app.advCaptionManager.setSetting('transition.in', this.value)">
                        ${this.transitions.map(t => `<option value="${t.id}" ${t.id === settings.transition.in ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="adv-row">
                    <label>消去</label>
                    <select onchange="app.advCaptionManager.setSetting('transition.out', this.value)">
                        ${this.transitions.map(t => `<option value="${t.id}" ${t.id === settings.transition.out ? 'selected' : ''}>${t.name}</option>`).join('')}
                    </select>
                </div>
                <div class="adv-row">
                    <label>時間</label>
                    <input type="range" min="0" max="1" step="0.1" value="${settings.transition.duration}" 
                           oninput="app.advCaptionManager.setSetting('transition.duration', this.value)">
                    <span class="adv-val">${settings.transition.duration}秒</span>
                </div>
            </div>
        `;
    }
    
    renderInputPanel(settings) {
        const container = document.getElementById('advEditorInput');
        if (!container) return;
        
        container.innerHTML = `
            <div class="adv-input-section">
                <label class="adv-input-label">👤 キャラクター名</label>
                <input type="text" id="advCharNameInput" class="adv-name-input" 
                       value="${this.escapeHtml(settings.characterName)}" 
                       placeholder="キャラクター名を入力..."
                       oninput="app.advCaptionManager.setSetting('characterName', this.value)">
            </div>
            
            <div class="adv-input-section adv-dialogue-section">
                <label class="adv-input-label">💬 セリフ</label>
                <textarea id="advDialogueInput" class="adv-dialogue-input" 
                          placeholder="セリフを入力..."
                          oninput="app.advCaptionManager.setSetting('dialogueText', this.value)">${this.escapeHtml(settings.dialogueText)}</textarea>
            </div>
            
            <div class="adv-keyframe-section">
                <div class="adv-keyframe-header">
                    <span>🎬 キーフレーム</span>
                    <div class="adv-keyframe-buttons">
                        <button onclick="app.advCaptionManager.addKeyframe(app.selectedClip)">➕ 追加</button>
                        <button onclick="app.advCaptionManager.clearKeyframes(app.selectedClip)">🗑️ 全削除</button>
                    </div>
                </div>
                <div class="adv-keyframe-list" id="advKeyframeList">
                    ${this.generateKeyframeListHTML(settings.keyframes)}
                </div>
            </div>
        `;
    }
    
    updateEditorKeyframeList() {
        const clip = this.app.selectedClip;
        if (!clip || clip.asset.type !== 'adv-caption') return;
        
        const listEl = document.getElementById('advKeyframeList');
        if (listEl) {
            listEl.innerHTML = this.generateKeyframeListHTML(clip.asset.advCaptionSettings.keyframes);
        }
    }
    
    generateKeyframeListHTML(keyframes) {
        if (!keyframes || keyframes.length === 0) {
            return '<div class="adv-no-keyframes">キーフレームなし</div>';
        }
        
        return keyframes.map((kf, idx) => {
            const time = this.formatTime(kf.time);
            const name = kf.characterName || '(名前なし)';
            const dialogue = kf.dialogueText ? kf.dialogueText.substring(0, 15) + '...' : '(台詞なし)';
            
            return `
                <div class="adv-keyframe-item">
                    <span class="adv-kf-time" onclick="app.seekTo(app.selectedClip.startTime + ${kf.time})">${time}</span>
                    <span class="adv-kf-content">${this.escapeHtml(name)}: ${this.escapeHtml(dialogue)}</span>
                    <button class="adv-kf-delete" onclick="app.advCaptionManager.removeKeyframe(app.selectedClip, ${idx})">×</button>
                </div>
            `;
        }).join('');
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        return `${mins}:${secs.padStart(5, '0')}`;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 設定を更新
    setSetting(path, value) {
        const clip = this.app.selectedClip;
        if (!clip || clip.asset.type !== 'adv-caption') return;
        
        const settings = clip.asset.advCaptionSettings;
        const parts = path.split('.');
        let target = settings;
        
        for (let i = 0; i < parts.length - 1; i++) {
            target = target[parts[i]];
        }
        
        const finalKey = parts[parts.length - 1];
        
        if (typeof target[finalKey] === 'number') {
            value = parseFloat(value);
        } else if (typeof target[finalKey] === 'boolean') {
            value = !!value;
        }
        
        target[finalKey] = value;
        
        // スライダーの値表示を更新
        if (event && event.target && event.target.type === 'range') {
            const valSpan = event.target.nextElementSibling;
            if (valSpan && valSpan.classList.contains('adv-val')) {
                let suffix = '';
                if (path.includes('opacity') || path.includes('scale')) suffix = '%';
                else if (path.includes('fontSize') || path.includes('strokeWidth') || path.includes('margin') || path.includes('position') || path.includes('letterSpacing')) suffix = 'px';
                else if (path.includes('duration')) suffix = '秒';
                else if (path === 'typewriter.localSpeed') suffix = '文字/秒';
                valSpan.textContent = value + suffix;
            }
        }
        
        this.app.updatePreview();
    }
    
    onCategoryChange(category) {
        const clip = this.app.selectedClip;
        if (!clip || clip.asset.type !== 'adv-caption') return;
        
        const settings = clip.asset.advCaptionSettings;
        settings.messageBox.category = category;
        
        const catData = this.messageBoxCategories[category];
        if (catData && catData.files.length > 0) {
            settings.messageBox.file = catData.files[0];
            
            const varSelect = document.getElementById('advMsgVariation');
            if (varSelect) {
                varSelect.innerHTML = catData.files.map(f => 
                    `<option value="${f}">${f}</option>`
                ).join('');
            }
        }
        
        this.loadMessageBoxImage(category, settings.messageBox.file).then(() => {
            this.app.updatePreview();
        });
    }
    
    onVariationChange(file) {
        const clip = this.app.selectedClip;
        if (!clip || clip.asset.type !== 'adv-caption') return;
        
        clip.asset.advCaptionSettings.messageBox.file = file;
        
        this.loadMessageBoxImage(clip.asset.advCaptionSettings.messageBox.category, file).then(() => {
            this.app.updatePreview();
        });
    }
    
    makeWindowDraggable(win) {
        const header = win.querySelector('.adv-editor-header');
        let isDragging = false;
        let offsetX, offsetY;
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('adv-editor-close')) return;
            isDragging = true;
            offsetX = e.clientX - win.offsetLeft;
            offsetY = e.clientY - win.offsetTop;
            win.style.zIndex = '10001';
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            win.style.left = (e.clientX - offsetX) + 'px';
            win.style.top = (e.clientY - offsetY) + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    // プロパティパネル用の簡易HTML
    generatePropertiesHTML(clip) {
        return `
            <div style="padding: 16px; text-align: center;">
                <h3 style="margin: 0 0 16px 0; color: var(--biscuit-light);">🎮 ADV風字幕</h3>
                <button onclick="app.advCaptionManager.openEditorWindow()" 
                        style="padding: 16px 32px; background: var(--accent-orange); color: white; 
                               border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold;">
                    📝 ADV風エディターを開く
                </button>
            </div>
        `;
    }
}

window.ADVCaptionManager = ADVCaptionManager;
