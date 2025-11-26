// ========================================
// clipping.js - クリッピング機能モジュール
// ========================================

class ClippingManager {
    constructor(app) {
        this.app = app;
        this.eyedropperActive = false;
        this.eyedropperHandler = null;
    }
    
    // クリップにclipSourceプロパティを初期化
    initClipProperties(clip) {
        if (!clip.clipSource) {
            clip.clipSource = null;
        }
        if (!clip.colorKey) {
            clip.colorKey = {
                enabled: false,
                color: { r: 0, g: 255, b: 0 }, // デフォルトは緑
                tolerance: 30,
                invertMask: false // false: 選択色を表示, true: 選択色以外を表示
            };
        }
        if (!clip.colorClipping) {
            clip.colorClipping = {
                enabled: false,
                referenceClipId: null,
                color: null,  // nullの場合は不透明部分全体でクリッピング
                tolerance: 30
            };
        }
    }
    
    // プロパティセクションの状態を初期化
    initPropertySectionStates() {
        if (!this.app.propertySectionStates.clipping) {
            this.app.propertySectionStates.clipping = false;
        }
    }
    
    // クリッピングセクションの選択肢を更新
    updateClipSourceSelect(clip) {
        const select = document.getElementById('clipSourceSelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">なし</option>';
        
        // 自分以外の全てのクリップを選択肢に追加（トラック位置に関係なく）
        const availableClips = this.app.clips.filter(c => 
            c.id !== clip.id // 自分自身のみ除外
        );
        
        // トラック順にソート（上から順）
        availableClips.sort((a, b) => a.track - b.track);
        
        availableClips.forEach(c => {
            const asset = this.app.assets.find(a => a.id === c.asset.id);
            const option = document.createElement('option');
            option.value = c.id;
            
            // 見やすい表示名
            const assetName = asset ? asset.name : `Clip ${c.id}`;
            const trackName = this.app.trackNames[c.track] || `Track ${c.track + 1}`;
            option.textContent = `${assetName} (${trackName})`;
            
            if (clip.clipSource == c.id) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    }
    
    // 色抜きクリッピング用の参照クリップセレクト更新
    updateColorClippingReferenceSelect(clip) {
        console.log('色抜きクリッピング参照セレクト更新開始');
        const select = document.getElementById('colorClippingReferenceSelect');
        if (!select) {
            console.log('colorClippingReferenceSelectが見つかりません');
            return;
        }
        
        console.log('selectを初期化');
        select.innerHTML = '<option value="">なし</option>';
        
        // 自分以外の全てのクリップを選択肢に追加
        const availableClips = this.app.clips.filter(c => 
            c.id !== clip.id
        );
        
        console.log('利用可能なクリップ数:', availableClips.length);
        
        // トラック順にソート
        availableClips.sort((a, b) => a.track - b.track);
        
        availableClips.forEach(c => {
            const asset = this.app.assets.find(a => a.id === c.asset.id);
            const option = document.createElement('option');
            option.value = c.id;
            
            const assetName = asset ? asset.name : `Clip ${c.id}`;
            const trackName = this.app.trackNames[c.track] || `Track ${c.track + 1}`;
            option.textContent = `${assetName} (${trackName})`;
            
            if (clip.colorClipping && clip.colorClipping.referenceClipId == c.id) {
                option.selected = true;
                console.log('選択されているクリップ:', assetName);
            }
            select.appendChild(option);
        });
        console.log('色抜きクリッピング参照セレクト更新完了');
    }
    
    // クリップソースを設定
    setClipSource() {
        if (!this.app.selectedClip) return;
        
        const select = document.getElementById('clipSourceSelect');
        const value = select.value;
        
        if (value) {
            this.app.selectedClip.clipSource = value;
        } else {
            this.app.selectedClip.clipSource = null;
        }
        
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('クリップソース設定');
    }
    
    // クリップソースを解除
    removeClipSource() {
        if (!this.app.selectedClip) return;
        
        this.app.selectedClip.clipSource = null;
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('クリップソース解除');
    }
    
    // スポイトツールを有効化
    activateEyedropper() {
        console.log('スポイトツール有効化');
        
        if (!this.app.selectedClip) {
            console.log('選択クリップなし');
            alert('クリップを選択してください');
            return;
        }
        
        // colorKeyプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorKey) {
            this.app.selectedClip.colorKey = {
                enabled: false,
                color: { r: 0, g: 255, b: 0 },
                tolerance: 30,
                invertMask: false
            };
        }
        
        this.eyedropperActive = true;
        const canvas = this.app.previewCanvas;
        const previewArea = document.getElementById('previewArea');
        
        // スポイト用のカーソルクラスを追加
        canvas.classList.add('eyedropper-active');
        if (previewArea) {
            previewArea.classList.add('eyedropper-active');
        }
        
        // 既存のハンドラーをクリーンアップ
        if (this.eyedropperHandler) {
            canvas.removeEventListener('mousedown', this.eyedropperHandler, true);
            if (previewArea) {
                previewArea.removeEventListener('mousedown', this.eyedropperHandler, true);
            }
        }
        
        // 新しいハンドラーを作成
        this.eyedropperHandler = (e) => {
            console.log('スポイトクリック検出');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.pickColorFromCanvas(e);
            this.deactivateEyedropper();
            return false;
        };
        
        // キャプチャフェーズで優先的にイベントを取得
        canvas.addEventListener('mousedown', this.eyedropperHandler, true);
        if (previewArea) {
            previewArea.addEventListener('mousedown', this.eyedropperHandler, true);
        }
    }
    
    // スポイトツールを無効化
    deactivateEyedropper() {
        console.log('スポイトツール無効化');
        this.eyedropperActive = false;
        this.eyedropperMode = null; // モードをリセット
        
        // スポイト用のカーソルクラスを削除
        this.app.previewCanvas.classList.remove('eyedropper-active');
        const previewArea = document.getElementById('previewArea');
        if (previewArea) {
            previewArea.classList.remove('eyedropper-active');
        }
        
        // イベントリスナーを削除
        if (this.eyedropperHandler) {
            this.app.previewCanvas.removeEventListener('mousedown', this.eyedropperHandler, true);
            if (previewArea) {
                previewArea.removeEventListener('mousedown', this.eyedropperHandler, true);
            }
            this.eyedropperHandler = null;
        }
    }
    
    // キャンバスから色を取得
    pickColorFromCanvas(e) {
        console.log('色を取得中...');
        if (!this.app.selectedClip) return;
        
        // colorKeyプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorKey) {
            this.app.selectedClip.colorKey = {
                enabled: false,
                color: { r: 0, g: 255, b: 0 },
                tolerance: 30,
                invertMask: false
            };
        }
        
        const rect = this.app.previewCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // キャンバスのスケールを考慮
        const scaleX = this.app.previewCanvas.width / rect.width;
        const scaleY = this.app.previewCanvas.height / rect.height;
        const canvasX = Math.floor(x * scaleX);
        const canvasY = Math.floor(y * scaleY);
        
        console.log(`座標: (${canvasX}, ${canvasY})`);
        
        // ピクセルデータを取得
        const imageData = this.app.previewCtx.getImageData(canvasX, canvasY, 1, 1);
        const data = imageData.data;
        
        console.log(`取得した色: RGB(${data[0]}, ${data[1]}, ${data[2]})`);
        
        // 色をクリップのcolorKeyに設定
        this.app.selectedClip.colorKey.color = {
            r: data[0],
            g: data[1],
            b: data[2]
        };
        
        // エフェクトウィンドウを更新
        this.app.refreshClipEffectWindow();
        this.app.updatePreview();
        this.app.saveHistory('色抜き色を選択');
    }
    
    // カラーキーの有効/無効を切り替え
    toggleColorKey(enabled) {
        if (!this.app.selectedClip) return;
        
        this.app.selectedClip.colorKey.enabled = enabled;
        this.app.updatePreview();
        this.app.saveHistory('色抜き切り替え');
    }
    
    // カラーキーの許容値を設定
    setColorKeyTolerance(tolerance) {
        if (!this.app.selectedClip) return;
        
        this.app.selectedClip.colorKey.tolerance = tolerance;
        this.app.updatePreview();
    }
    
    // カラーキーの反転設定を切り替え
    toggleColorKeyInvert(invert) {
        if (!this.app.selectedClip) return;
        
        this.app.selectedClip.colorKey.invertMask = invert;
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('色抜き反転切り替え');
    }
    
    // ===== 色抜きクリッピング機能 =====
    
    // 色抜きクリッピングの有効/無効を切り替え
    toggleColorClipping(enabled) {
        console.log('色抜きクリッピング切り替え:', enabled);
        if (!this.app.selectedClip) {
            console.log('選択クリップなし');
            return;
        }
        
        // colorClippingプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorClipping) {
            console.log('colorClippingプロパティを初期化');
            this.app.selectedClip.colorClipping = {
                enabled: false,
                referenceClipId: null,
                color: null,
                tolerance: 30
            };
        }
        
        this.app.selectedClip.colorClipping.enabled = enabled;
        this.app.updatePreview();
        this.app.saveHistory('色抜きクリッピング切り替え');
        console.log('色抜きクリッピング切り替え完了');
    }
    
    // 色抜きクリッピングの参照クリップを設定
    setColorClippingReference() {
        console.log('色抜きクリッピング参照設定開始');
        if (!this.app.selectedClip) {
            console.log('選択クリップなし');
            return;
        }
        
        // colorClippingプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorClipping) {
            console.log('colorClippingプロパティを初期化');
            this.app.selectedClip.colorClipping = {
                enabled: false,
                referenceClipId: null,
                color: null,
                tolerance: 30
            };
        }
        
        const select = document.getElementById('colorClippingReferenceSelect');
        if (!select) {
            console.log('selectが見つかりません');
            return;
        }
        
        const value = select.value;
        console.log('選択された値:', value);
        
        if (value) {
            this.app.selectedClip.colorClipping.referenceClipId = value;
            console.log('参照クリップIDを設定:', value);
        } else {
            this.app.selectedClip.colorClipping.referenceClipId = null;
            console.log('参照クリップIDをクリア');
        }
        
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('色抜きクリッピング参照設定');
        console.log('色抜きクリッピング参照設定完了');
    }
    
    // 色抜きクリッピングの許容値を設定
    setColorClippingTolerance(tolerance) {
        if (!this.app.selectedClip) return;
        
        // colorClippingプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorClipping) {
            this.app.selectedClip.colorClipping = {
                enabled: false,
                referenceClipId: null,
                color: null,
                tolerance: 30
            };
        }
        
        this.app.selectedClip.colorClipping.tolerance = tolerance;
        this.app.updatePreview();
    }
    
    // 色抜きクリッピングの色をクリア
    clearColorClippingColor() {
        if (!this.app.selectedClip) return;
        
        // colorClippingプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorClipping) {
            this.app.selectedClip.colorClipping = {
                enabled: false,
                referenceClipId: null,
                color: null,
                tolerance: 30
            };
        }
        
        this.app.selectedClip.colorClipping.color = null;
        this.app.updatePropertiesPanel();
        this.app.updatePreview();
        this.app.saveHistory('色抜きクリッピング色をクリア');
        
        // ウィンドウを再描画
        const existingWindow = document.getElementById('clipEffectTabWindow');
        if (existingWindow) {
            existingWindow.remove();
            this.app.openClipEffectWindow();
            setTimeout(() => {
                const buttons = document.querySelectorAll('.effect-tab-button');
                buttons.forEach((btn) => {
                    if (btn.textContent.includes('色抜きクリッピング')) btn.click();
                });
            }, 10);
        }
    }
    
    // 色抜きクリッピング用のスポイトツールを有効化
    activateColorClippingEyedropper() {
        console.log('色抜きクリッピング用スポイトツール有効化');
        if (!this.app.selectedClip) {
            console.log('選択クリップなし');
            alert('クリップを選択してください');
            return;
        }
        
        // colorClippingプロパティが存在しない場合は初期化
        if (!this.app.selectedClip.colorClipping) {
            console.log('colorClippingプロパティを初期化');
            this.app.selectedClip.colorClipping = {
                enabled: false,
                referenceClipId: null,
                color: null,
                tolerance: 30
            };
        }
        
        if (!this.app.selectedClip.colorClipping.referenceClipId) {
            console.log('参照クリップが設定されていません');
            alert('参照クリップを先に選択してください');
            return;
        }
        
        console.log('スポイトツール開始');
        this.eyedropperActive = true;
        this.eyedropperMode = 'colorClipping'; // モードを識別
        const canvas = this.app.previewCanvas;
        const previewArea = document.getElementById('previewArea');
        
        // スポイト用のカーソルクラスを追加
        canvas.classList.add('eyedropper-active');
        if (previewArea) {
            previewArea.classList.add('eyedropper-active');
        }
        
        // 既存のハンドラーをクリーンアップ
        if (this.eyedropperHandler) {
            canvas.removeEventListener('mousedown', this.eyedropperHandler, true);
            if (previewArea) {
                previewArea.removeEventListener('mousedown', this.eyedropperHandler, true);
            }
        }
        
        // 新しいハンドラーを作成
        this.eyedropperHandler = (e) => {
            console.log('色抜きクリッピング用スポイトクリック検出');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            this.pickColorForColorClipping(e);
            this.deactivateEyedropper();
            return false;
        };
        
        // キャプチャフェーズで優先的にイベントを取得
        canvas.addEventListener('mousedown', this.eyedropperHandler, true);
        if (previewArea) {
            previewArea.addEventListener('mousedown', this.eyedropperHandler, true);
        }
        console.log('スポイトツール準備完了');
    }
    
    // 色抜きクリッピング用に参照クリップから色を取得
    pickColorForColorClipping(e) {
        console.log('色抜きクリッピング用に色を取得中...');
        if (!this.app.selectedClip || !this.app.selectedClip.colorClipping.referenceClipId) return;
        
        const rect = this.app.previewCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // キャンバスのスケールを考慮
        const scaleX = this.app.previewCanvas.width / rect.width;
        const scaleY = this.app.previewCanvas.height / rect.height;
        const canvasX = Math.floor(x * scaleX);
        const canvasY = Math.floor(y * scaleY);
        
        console.log(`座標: (${canvasX}, ${canvasY})`);
        
        // 参照クリップのみを描画した一時キャンバスを作成
        const refClip = this.app.clips.find(c => c.id == this.app.selectedClip.colorClipping.referenceClipId);
        if (!refClip || !this.isClipVisibleAtTime(refClip, this.app.currentTime)) {
            alert('参照クリップが現在の時刻で表示されていません');
            return;
        }
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.app.previewCanvas.width;
        tempCanvas.height = this.app.previewCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 参照クリップを描画
        const originalCtx = this.app.previewCtx;
        this.app.previewCtx = tempCtx;
        
        this.renderReferenceClipForColorPick(tempCtx, refClip, this.app.currentTime);
        
        this.app.previewCtx = originalCtx;
        
        // ピクセルデータを取得
        const imageData = tempCtx.getImageData(canvasX, canvasY, 1, 1);
        const data = imageData.data;
        
        console.log(`取得した色: RGB(${data[0]}, ${data[1]}, ${data[2]})`);
        
        // 色を設定
        this.app.selectedClip.colorClipping.color = {
            r: data[0],
            g: data[1],
            b: data[2]
        };
        
        // エフェクトウィンドウを更新
        this.app.refreshClipEffectWindow();
        this.app.updatePreview();
        this.app.saveHistory('色抜きクリッピング色を選択');
    }
    
    // 参照クリップを一時キャンバスに描画（色取得用） - 動画・連番対応版
    renderReferenceClipForColorPick(ctx, clip, time) {
        const clipLocalTime = time - clip.startTime;
        
        // トランジション処理
        let effectiveLocalTime = clipLocalTime;
        let transitionProgress = 1;
        
        if (clip.transitionIn && clip.transitionIn.type !== 'none' && clipLocalTime < clip.transitionIn.duration) {
            transitionProgress = clipLocalTime / clip.transitionIn.duration;
        }
        
        if (clip.transitionOut && clip.transitionOut.type !== 'none' && clipLocalTime > clip.duration - clip.transitionOut.duration) {
            const timeInTransition = clip.duration - clipLocalTime;
            transitionProgress = timeInTransition / clip.transitionOut.duration;
        }
        
        const x = this.app.getKeyframeValue(clip, 'x', clipLocalTime);
        const y = this.app.getKeyframeValue(clip, 'y', clipLocalTime);
        const rotation = this.app.getKeyframeValue(clip, 'rotation', clipLocalTime);
        const opacity = this.app.getKeyframeValue(clip, 'opacity', clipLocalTime);
        const scale = this.app.getKeyframeValue(clip, 'scale', clipLocalTime);
        
        const parentTransform = this.app.getParentTransform(clip, clipLocalTime);
        
        const finalRotation = parentTransform.rotation + rotation;
        const finalScale = parentTransform.scale * scale;
        
        const radians = (parentTransform.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const finalX = parentTransform.x + (x * cos - y * sin) * parentTransform.scale;
        const finalY = parentTransform.y + (x * sin + y * cos) * parentTransform.scale;
        
        ctx.save();
        
        const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
        
        ctx.translate(ctx.canvas.width / 2 + finalX, ctx.canvas.height / 2 + finalY);
        ctx.rotate(finalRotation * Math.PI / 180);
        ctx.scale(finalScale, finalScale);
        ctx.globalAlpha = opacity * transitionProgress;
        
        // 素材を描画 - 動画・連番対応
        if (clip.asset.type === 'image') {
            if (clip.imageElement && clip.imageElement.complete) {
                const img = clip.imageElement;
                let drawWidth, drawHeight;
                
                if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
                    drawWidth = clip.originalWidth;
                    drawHeight = clip.originalHeight;
                } else {
                    const aspectRatio = img.width / img.height;
                    const maxWidth = this.app.previewCanvas.width;
                    const maxHeight = this.app.previewCanvas.height;
                    
                    drawWidth = maxWidth;
                    drawHeight = maxWidth / aspectRatio;
                    
                    if (drawHeight > maxHeight) {
                        drawHeight = maxHeight;
                        drawWidth = maxHeight * aspectRatio;
                    }
                }
                
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                
                ctx.drawImage(img, anchorX, anchorY, drawWidth, drawHeight);
            }
        } else if (clip.asset.type === 'video') {
            // 動画対応
            if (clip.videoElement && clip.videoElement.readyState >= 2) {
                const video = clip.videoElement;
                const aspectRatio = video.videoWidth / video.videoHeight;
                const maxWidth = this.app.previewCanvas.width;
                const maxHeight = this.app.previewCanvas.height;
                
                let drawWidth = maxWidth;
                let drawHeight = maxWidth / aspectRatio;
                
                if (drawHeight > maxHeight) {
                    drawHeight = maxHeight;
                    drawWidth = maxHeight * aspectRatio;
                }
                
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                
                ctx.drawImage(video, anchorX, anchorY, drawWidth, drawHeight);
            }
        } else if (clip.asset.type === 'sequence') {
            // 連番対応
            const frameRate = clip.frameRate || 30;
            const actualTime = clipLocalTime + (clip.trimStart || 0);
            const frameIndex = Math.floor(actualTime * frameRate) % clip.asset.frameCount;
            
            if (clip.sequenceImages && clip.sequenceImages[frameIndex]) {
                const img = clip.sequenceImages[frameIndex];
                if (img && img.complete) {
                    let drawWidth, drawHeight;
                    
                    if (clip.useOriginalSize && img.width && img.height) {
                        drawWidth = img.width;
                        drawHeight = img.height;
                    } else {
                        const aspectRatio = img.width / img.height;
                        const maxWidth = this.app.previewCanvas.width;
                        const maxHeight = this.app.previewCanvas.height;
                        
                        drawWidth = maxWidth;
                        drawHeight = maxWidth / aspectRatio;
                        
                        if (drawHeight > maxHeight) {
                            drawHeight = maxHeight;
                            drawWidth = maxHeight * aspectRatio;
                        }
                    }
                    
                    const anchorX = -drawWidth * anchor.x;
                    const anchorY = -drawHeight * anchor.y;
                    
                    ctx.drawImage(img, anchorX, anchorY, drawWidth, drawHeight);
                }
            }
        } else if (clip.asset.type === 'solid' || clip.asset.type === 'gradient' || clip.asset.type === 'stripe') {
            if (clip.asset.element) {
                const drawWidth = 1920;
                const drawHeight = 1080;
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                ctx.drawImage(clip.asset.element, anchorX, anchorY, drawWidth, drawHeight);
            }
        }
        
        ctx.restore();
    }
    
    // カラーキーマスクを生成
    createColorKeyMask(ctx, clip) {
        if (!clip.colorKey || !clip.colorKey.enabled) return null;
        
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = ctx.canvas.width;
        maskCanvas.height = ctx.canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // 現在のキャンバス内容をマスクキャンバスにコピー
        maskCtx.drawImage(ctx.canvas, 0, 0);
        
        // イメージデータを取得
        const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;
        
        const targetColor = clip.colorKey.color;
        const tolerance = clip.colorKey.tolerance;
        const invert = clip.colorKey.invertMask;
        
        // 各ピクセルを処理
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // 色の距離を計算（ユークリッド距離）
            const distance = Math.sqrt(
                Math.pow(r - targetColor.r, 2) +
                Math.pow(g - targetColor.g, 2) +
                Math.pow(b - targetColor.b, 2)
            );
            
            // 許容値以内かどうか
            const withinTolerance = distance <= tolerance;
            
            // マスクの適用（反転設定に応じて）
            if (invert) {
                // 選択色以外を表示 = 選択色を透明に
                if (withinTolerance) {
                    data[i + 3] = 0; // 完全に透明
                }
            } else {
                // 選択色を表示 = 選択色以外を透明に
                if (!withinTolerance) {
                    data[i + 3] = 0; // 完全に透明
                }
            }
        }
        
        // 処理したイメージデータを戻す
        maskCtx.putImageData(imageData, 0, 0);
        
        return maskCanvas;
    }
    
    // 色抜きクリッピング用マスクを生成（参照クリップから） - 動画・連番対応版
    createColorClippingMask(clip, time) {
        if (!clip.colorClipping || !clip.colorClipping.enabled || !clip.colorClipping.referenceClipId) {
            return null;
        }
        
        const refClip = this.app.clips.find(c => c.id == clip.colorClipping.referenceClipId);
        if (!refClip || !this.isClipVisibleAtTime(refClip, time)) {
            return null;
        }
        
        // 参照クリップを一時キャンバスに描画
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.app.previewCanvas.width;
        tempCanvas.height = this.app.previewCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 参照クリップを描画（動画・連番対応）
        const originalCtx = this.app.previewCtx;
        this.app.previewCtx = tempCtx;
        
        this.renderReferenceClipForColorPick(tempCtx, refClip, time);
        
        this.app.previewCtx = originalCtx;
        
        // 色抜きマスクを生成
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = tempCanvas.width;
        maskCanvas.height = tempCanvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // 参照クリップの内容をコピー
        maskCtx.drawImage(tempCanvas, 0, 0);
        
        // イメージデータを取得
        const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const data = imageData.data;
        
        const targetColor = clip.colorClipping.color;
        const tolerance = clip.colorClipping.tolerance;
        
        // 色が指定されていない場合（null）は不透明部分全体を使用
        if (targetColor === null) {
            // 各ピクセルを処理 - 不透明部分（アルファ > 0）を白、透明部分を透明に
            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                
                if (a > 0) {
                    // 不透明部分は白で塗りつぶし（マスクとして使用）
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                } else {
                    // 透明部分はそのまま透明
                    data[i + 3] = 0;
                }
            }
        } else {
            // 各ピクセルを処理 - 選択色の部分だけ不透明に
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                
                // 色の距離を計算
                const distance = Math.sqrt(
                    Math.pow(r - targetColor.r, 2) +
                    Math.pow(g - targetColor.g, 2) +
                    Math.pow(b - targetColor.b, 2)
                );
                
                // 許容値以内かどうか
                const withinTolerance = distance <= tolerance;
                
                // 選択色以外を透明に
                if (!withinTolerance) {
                    data[i + 3] = 0;
                } else {
                    // 選択色の部分は白で塗りつぶし（マスクとして使用）
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = 255;
                }
            }
        }
        
        // 処理したイメージデータを戻す
        maskCtx.putImageData(imageData, 0, 0);
        
        return maskCanvas;
    }
    
    // クリッピングを適用（メイン処理）
    // ctxは既にクリップが描画されているキャンバスのコンテキスト
    // clipは描画済みのクリップ（マスクされる側）
    applyClipping(ctx, clip, time) {
        let hasAppliedEffect = false;
        
        // まず色抜きクリッピングを適用
        if (clip.colorClipping && clip.colorClipping.enabled) {
            const colorClippingMask = this.createColorClippingMask(clip, time);
            if (colorClippingMask) {
                // 色抜きクリッピングマスクを適用
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(colorClippingMask, 0, 0);
                ctx.globalCompositeOperation = 'source-over';
                hasAppliedEffect = true;
            }
        }
        
        // 次にカラーキーを適用
        if (clip.colorKey && clip.colorKey.enabled) {
            const colorKeyMask = this.createColorKeyMask(ctx, clip);
            if (colorKeyMask) {
                // カラーキーマスクを適用
                ctx.globalCompositeOperation = 'destination-in';
                ctx.drawImage(colorKeyMask, 0, 0);
                ctx.globalCompositeOperation = 'source-over';
                hasAppliedEffect = true;
            }
        }
        
        // 最後にクリップソースを適用
        if (!clip.clipSource) {
            return hasAppliedEffect;
        }
        
        const clipSourceClip = this.app.clips.find(c => c.id == clip.clipSource);
        if (!clipSourceClip || !this.isClipVisibleAtTime(clipSourceClip, time)) {
            return hasAppliedEffect;
        }
        
        // クリップソースをマスク用の一時キャンバスに描画
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = ctx.canvas.width;
        maskCanvas.height = ctx.canvas.height;
        const maskCtx = maskCanvas.getContext('2d');
        
        // 一時的にpreviewCtxを切り替えてクリップソースを描画
        const originalCtx = this.app.previewCtx;
        this.app.previewCtx = maskCtx;
        
        // クリップソースをそのまま描画（renderClipと同じ処理）
        // ※awaitを使わないため、同期的に描画可能な部分のみ実行
        const clipSourceLocalTime = time - clipSourceClip.startTime;
        
        // トランジション処理
        let effectiveLocalTime = clipSourceLocalTime;
        let transitionProgress = 1;
        
        if (clipSourceClip.transitionIn && clipSourceClip.transitionIn.type !== 'none' && clipSourceLocalTime < clipSourceClip.transitionIn.duration) {
            transitionProgress = clipSourceLocalTime / clipSourceClip.transitionIn.duration;
        }
        
        if (clipSourceClip.transitionOut && clipSourceClip.transitionOut.type !== 'none' && clipSourceLocalTime > clipSourceClip.duration - clipSourceClip.transitionOut.duration) {
            const timeInTransition = clipSourceClip.duration - clipSourceLocalTime;
            transitionProgress = timeInTransition / clipSourceClip.transitionOut.duration;
        }
        
        const x = this.app.getKeyframeValue(clipSourceClip, 'x', clipSourceLocalTime);
        const y = this.app.getKeyframeValue(clipSourceClip, 'y', clipSourceLocalTime);
        const rotation = this.app.getKeyframeValue(clipSourceClip, 'rotation', clipSourceLocalTime);
        const opacity = this.app.getKeyframeValue(clipSourceClip, 'opacity', clipSourceLocalTime);
        const scale = this.app.getKeyframeValue(clipSourceClip, 'scale', clipSourceLocalTime);
        
        const parentTransform = this.app.getParentTransform(clipSourceClip, clipSourceLocalTime);
        
        const finalRotation = parentTransform.rotation + rotation;
        const finalScale = parentTransform.scale * scale;
        
        const radians = (parentTransform.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const finalX = parentTransform.x + (x * cos - y * sin) * parentTransform.scale;
        const finalY = parentTransform.y + (x * sin + y * cos) * parentTransform.scale;
        
        maskCtx.save();
        
        const anchor = clipSourceClip.anchorPoint || { x: 0.5, y: 0.5 };
        
        maskCtx.translate(maskCanvas.width / 2 + finalX, maskCanvas.height / 2 + finalY);
        maskCtx.rotate(finalRotation * Math.PI / 180);
        maskCtx.scale(finalScale, finalScale);
        maskCtx.globalAlpha = opacity * transitionProgress;
        
        // 素材を描画（同期的に可能なもののみ）
        if (clipSourceClip.asset.type === 'image') {
            if (clipSourceClip.imageElement && clipSourceClip.imageElement.complete) {
                const img = clipSourceClip.imageElement;
                let drawWidth, drawHeight;
                
                if (clipSourceClip.useOriginalSize && clipSourceClip.originalWidth && clipSourceClip.originalHeight) {
                    drawWidth = clipSourceClip.originalWidth;
                    drawHeight = clipSourceClip.originalHeight;
                } else {
                    const aspectRatio = img.width / img.height;
                    const maxWidth = this.app.previewCanvas.width;
                    const maxHeight = this.app.previewCanvas.height;
                    
                    drawWidth = maxWidth;
                    drawHeight = maxWidth / aspectRatio;
                    
                    if (drawHeight > maxHeight) {
                        drawHeight = maxHeight;
                        drawWidth = maxHeight * aspectRatio;
                    }
                }
                
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                
                maskCtx.drawImage(img, anchorX, anchorY, drawWidth, drawHeight);
            }
        } else if (clipSourceClip.asset.type === 'video') {
            // 動画の場合
            if (clipSourceClip.videoElement && clipSourceClip.videoElement.readyState >= 2) {
                const video = clipSourceClip.videoElement;
                const aspectRatio = video.videoWidth / video.videoHeight;
                const maxWidth = this.app.previewCanvas.width;
                const maxHeight = this.app.previewCanvas.height;
                
                let drawWidth = maxWidth;
                let drawHeight = maxWidth / aspectRatio;
                
                if (drawHeight > maxHeight) {
                    drawHeight = maxHeight;
                    drawWidth = maxHeight * aspectRatio;
                }
                
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                
                maskCtx.drawImage(video, anchorX, anchorY, drawWidth, drawHeight);
            }
        } else if (clipSourceClip.asset.type === 'sequence') {
            // 連番の場合
            const frameRate = clipSourceClip.frameRate || 30;
            const actualTime = clipSourceLocalTime + (clipSourceClip.trimStart || 0);
            const frameIndex = Math.floor(actualTime * frameRate) % clipSourceClip.asset.frameCount;
            
            if (clipSourceClip.sequenceImages && clipSourceClip.sequenceImages[frameIndex]) {
                const img = clipSourceClip.sequenceImages[frameIndex];
                if (img.complete) {
                    const aspectRatio = img.width / img.height;
                    const maxWidth = this.app.previewCanvas.width;
                    const maxHeight = this.app.previewCanvas.height;
                    
                    let drawWidth = maxWidth;
                    let drawHeight = maxWidth / aspectRatio;
                    
                    if (drawHeight > maxHeight) {
                        drawHeight = maxHeight;
                        drawWidth = maxHeight * aspectRatio;
                    }
                    
                    const anchorX = -drawWidth * anchor.x;
                    const anchorY = -drawHeight * anchor.y;
                    
                    maskCtx.drawImage(img, anchorX, anchorY, drawWidth, drawHeight);
                }
            }
        } else if (clipSourceClip.asset.type === 'solid' || clipSourceClip.asset.type === 'gradient' || clipSourceClip.asset.type === 'stripe') {
            if (clipSourceClip.asset.element) {
                const drawWidth = 1920;
                const drawHeight = 1080;
                const anchorX = -drawWidth * anchor.x;
                const anchorY = -drawHeight * anchor.y;
                maskCtx.drawImage(clipSourceClip.asset.element, anchorX, anchorY, drawWidth, drawHeight);
            }
        }
        
        maskCtx.restore();
        
        // クリップソースにもカラーキーが適用されている場合、それを適用
        if (clipSourceClip.colorKey && clipSourceClip.colorKey.enabled) {
            const clipSourceColorKeyMask = this.createColorKeyMask(maskCtx, clipSourceClip);
            if (clipSourceColorKeyMask) {
                maskCtx.globalCompositeOperation = 'destination-in';
                maskCtx.drawImage(clipSourceColorKeyMask, 0, 0);
                maskCtx.globalCompositeOperation = 'source-over';
            }
        }
        
        // previewCtxを元に戻す
        this.app.previewCtx = originalCtx;
        
        // 既存の描画内容にマスクを適用
        ctx.globalCompositeOperation = 'destination-in';
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        
        return true;
    }
    
    // 指定時刻でクリップが表示されているか判定
    isClipVisibleAtTime(clip, time) {
        return time >= clip.startTime && time < clip.startTime + clip.duration;
    }
    
    // プロジェクト保存時にクリップソースを含める
    serializeClipData(clip) {
        return {
            clipSource: clip.clipSource || null,
            colorKey: clip.colorKey || {
                enabled: false,
                color: { r: 0, g: 255, b: 0 },
                tolerance: 30,
                invertMask: false
            },
            colorClipping: clip.colorClipping || {
                enabled: false,
                referenceClipId: null,
                color: null,
                tolerance: 30
            }
        };
    }
    
    // プロジェクト読み込み時にクリップソースを復元
    deserializeClipData(clip, data) {
        if (data.clipSource !== undefined) {
            clip.clipSource = data.clipSource;
        }
        if (data.colorKey !== undefined) {
            clip.colorKey = data.colorKey;
        }
        if (data.colorClipping !== undefined) {
            clip.colorClipping = data.colorClipping;
        }
    }
}
