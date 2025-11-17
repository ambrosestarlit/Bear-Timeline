// アプリケーションクラス
class StarlitTimelineApp {
    constructor() {
        this.assets = [];
        this.clips = [];
        this.selectedClip = null;
        this.currentTime = 0;
        this.isPlaying = false;
        this.loopPlayback = false; // ループ再生フラグ
        this.zoom = 50; // px per second
        this.trackCount = 5;
        this.trackHeight = 80;
        this.fps = 30;
        this.duration = 30; // seconds
        
        // トラック名（デフォルトはTrack 1, Track 2...）
        this.trackNames = Array.from({ length: this.trackCount }, (_, i) => `Track ${i + 1}`);
        
        // updatePreview実行中フラグ（重複実行防止）
        this.isUpdatingPreview = false;
        
        // updatePreviewデバウンス用タイマー（ドラッグ時のパフォーマンス向上）
        this.previewUpdateTimer = null;
        this.previewUpdateDelay = 4; // 4ms (約240FPS相当) - より滑らかなドラッグ操作
        
        // キャンバス
        this.previewCanvas = document.getElementById('previewCanvas');
        this.previewCtx = this.previewCanvas.getContext('2d');
        this.overlayCanvas = document.getElementById('overlayCanvas'); // SVG要素
        this.boundingBoxGroup = document.getElementById('boundingBoxGroup');
        this.timelineCanvas = document.getElementById('timelineCanvas');
        this.timelineCtx = this.timelineCanvas.getContext('2d');
        this.rulerCanvas = document.getElementById('rulerCanvas');
        this.rulerCtx = this.rulerCanvas.getContext('2d');
        
        // エフェクト設定（enabled はプロジェクト依存、その他はグローバル設定）
        this.effects = {
            letterbox: {
                enabled: false, // プロジェクトファイルに保存
                height: 100,    // localStorage に保存
                color: '#000000' // localStorage に保存
            },
            gradient: {
                enabled: false, // プロジェクトファイルに保存
                top: {
                    color: '#FFFF00',      // localStorage に保存
                    height: 300,           // localStorage に保存
                    opacity: 50,           // localStorage に保存
                    blendMode: 'normal'    // localStorage に保存
                },
                bottom: {
                    color: '#0000FF',      // localStorage に保存
                    height: 300,           // localStorage に保存
                    opacity: 50,           // localStorage に保存
                    blendMode: 'normal'    // localStorage に保存
                }
            },
            diffusion: {
                enabled: false, // プロジェクトファイルに保存
                blur: 0,        // 0-300, localStorage に保存
                contrast: 0,    // -100 to 100, localStorage に保存
                brightness: 0,  // -100 to 100, localStorage に保存
                saturation: 0,  // -100 to 100, localStorage に保存
                opacity: 100,   // 0-100%, localStorage に保存
                // キーフレーム対応
                keyframes: []   // { time: number, blur, contrast, brightness, saturation, opacity }
            },
            colorKey: {
                enabled: false,        // プロジェクトファイルに保存
                color: '#00FF00',      // キー色（デフォルトはグリーン）
                tolerance: 30,         // 許容値 0-100
                invert: false,         // false: キー色を透過, true: キー色以外を透過
                feather: 5             // エッジのぼかし 0-50
            },
            normalize: {
                enabled: false,        // プロジェクトファイルに保存
                strength: 1            // スムージング強度 0-3
            },
            windShake: {
                enabled: false,      // プロジェクトファイルに保存
                divisions: 10,       // 分割数 (1-50)
                angle: 30,          // 揺れ角 (0-360度)
                period: 2.0,        // 揺れ周期 (0.01-100秒)
                phaseShift: 90,     // 揺れズレ (-360 to 360度)
                center: 0,          // センター角度 (-180 to 180度)
                topFixed: 10,       // 上固定長％ (0-100)
                bottomFixed: 10,    // 下固定長％ (0-100)
                fromBottom: false,  // 下を基準にするか
                randomSwing: false, // ランダム揺れを使用
                randomPattern: 0,   // ランダムパターンシード
                timeShift: 0.1,     // 時間ずれ
                horizontalRepeat: false,  // 横に繰り返す
                repeatCount: 3,     // 繰り返し個数
                spacing: 50,        // 間隔(ピクセル)
                alphaCorrection: true,    // アルファ補正
                antiAliasing: true,       // 破綻軽減(アンチエイリアシング) - デフォルトON
                axisMode: false,    // 軸モードを有効化
                axisPosition: 50,   // 軸位置 (0-100%)
                axisStrength: 50,   // 揺れ強度 (0-100)
                axisRange: 30       // 影響範囲 (1-100%)
            }
        };
        
        // 音声コンテキスト
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioSources = [];
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.connect(this.audioContext.destination);
        
        // トランジション設定
        this.availableTransitions = [
            { id: 'none', name: 'なし' },
            { id: 'fade', name: 'フェード' },
            { id: 'dissolve', name: 'ディゾルブ' },
            { id: 'wipe_left', name: 'ワイプ(左)' },
            { id: 'wipe_right', name: 'ワイプ(右)' },
            { id: 'wipe_up', name: 'ワイプ(上)' },
            { id: 'wipe_down', name: 'ワイプ(下)' },
            { id: 'slide_left', name: 'スライド(左)' },
            { id: 'slide_right', name: 'スライド(右)' }
        ];
        
        // Undo/Redo
        this.history = [];
        this.historyIndex = -1;
        
        // 素材フィルター
        this.assetFilter = 'all'; // all, image, video, audio
        
        // プロパティセクションの開閉状態を保持
        // プロパティセクションの開閉状態（現在は未使用）
        this.propertySectionStates = {};
        
        // AEプロパティの開閉状態を保持
        this.aePropertyStates = {
            position: false,
            scale: false,
            rotation: false,
            opacity: false
        };
        
        // プロジェクト読み込み時の一時保存
        this.pendingProject = null;
        
        // プレビュードラッグ操作用
        this.isPreviewDragging = false;
        this.previewDragStart = null;
        this.previewDragMode = null; // 'position', 'rotation', 'scale'
        this.initialTransform = null;
        
        // パペット編集モード
        this.isPuppetEditMode = false; // パペット編集モードON時はトランスフォーム操作を無効化
        this.isDraggingPuppetPin = false; // ピンドラッグ中フラグ
        this.draggingPinId = null; // ドラッグ中のピンID
        
        // プレビューズーム機能
        this.previewZoom = 100; // パーセント表示（100% = 原寸）
        
        // キーフレーム画像を読み込み
        this.keyframeImage = new Image();
        this.keyframeImage.src = 'key.png';
        
        // シークバー(プレイヘッド)画像を読み込み
        this.seekbarImage = new Image();
        this.seekbarImage.onload = () => {
            this.drawTimeline(); // 画像読み込み完了後に再描画
        };
        this.seekbarImage.src = 'seekbar.png';
        
        // ピン画像を読み込み（pin-01.png ~ pin-05.png）
        this.pinImages = [];
        for (let i = 1; i <= 5; i++) {
            const pinImage = new Image();
            pinImage.src = `pin-0${i}.png`;
            pinImage.onload = () => {
                this.drawTimeline(); // 画像読み込み完了後に再描画
            };
            this.pinImages.push(pinImage);
        }
        
        // キーフレーム操作用
        this.isDraggingKeyframe = false;
        this.draggingKeyframe = null; // {clip, property, index}
        
        // スポイトモード
        this.eyedropperMode = false;
        
        // WindShake軸選択モード
        this.windShakeAxisPickMode = false;
        
        // レンズブラーのフォーカス位置選択モード
        this.lensBlurFocusPickMode = false;
        
        // インアウトポイント（ループ範囲）
        this.inPoint = null;  // null = 未設定
        this.outPoint = null; // null = 未設定
        
        // FFmpeg.wasm for MP4 export
        this.ffmpeg = null;
        this.ffmpegLoaded = false;
        
        // クリッピングマネージャーを初期化
        this.clippingManager = new ClippingManager(this);
        this.clippingManager.initPropertySectionStates();
        
        // シーンマネージャーを初期化
        this.sceneManager = new SceneManager(this);
        
        this.init();
    }
    
    init() {
        // キャッシュから設定を復元
        this.loadSettingsFromCache();
        
        this.setupEventListeners();
        
        // DOMの読み込みを待ってから描画
        setTimeout(() => {
            this.updateTimelineSize();
            this.drawTimeline();
            this.drawRuler();
            
            // シーンパネルを初期化
            this.sceneManager.updateScenePanel();
            this.sceneManager.updateBreadcrumb();
        }, 100);
        
        this.updatePreview();
        
        // ズームスライダー
        document.getElementById('zoomSlider').addEventListener('input', (e) => {
            this.zoom = parseInt(e.target.value);
            document.getElementById('zoomValue').textContent = `${this.zoom} px/秒`;
            this.updateTimelineSize();
            this.drawTimeline();
            this.drawRuler();
        });
        
        // プレビューズームスライダー
        document.getElementById('previewZoomSlider').addEventListener('input', (e) => {
            this.previewZoom = parseInt(e.target.value);
            document.getElementById('previewZoomValue').textContent = `${this.previewZoom}%`;
            this.updatePreviewZoom();
        });
        
        // エフェクトコントロール
        this.setupEffectControls();
        
        console.log('✨ エフェクト設定を復元しました');
    }
    
    setupEventListeners() {
        // タイムラインキャンバスイベント
        this.timelineCanvas.addEventListener('mousedown', (e) => this.handleTimelineMouseDown(e));
        
        // タイムラインキャンバスの右クリックメニューを無効化
        this.timelineCanvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // mouseupとmousemoveはdocumentレベルで監視（ドラッグ中にキャンバス外に出ても対応）
        document.addEventListener('mousemove', (e) => this.handleTimelineMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleTimelineMouseUp(e));
        
        // 定規のクリック/ドラッグイベント
        this.rulerCanvas.addEventListener('mousedown', (e) => this.handleRulerMouseDown(e));
        
        // プレビューエリア全体で直感的操作（画面外でも操作可能）
        this.previewArea = document.getElementById('previewArea');
        this.previewContainer = document.getElementById('previewContainer');
        this.previewArea.addEventListener('mousedown', (e) => this.handlePreviewMouseDown(e));
        this.previewArea.addEventListener('mousemove', (e) => this.handlePreviewCanvasHover(e));
        document.addEventListener('mousemove', (e) => this.handlePreviewMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handlePreviewMouseUp(e));
        
        // プレビューエリアの右クリックメニューを無効化（ピン削除に使用）
        this.previewArea.addEventListener('contextmenu', (e) => {
            if (this.isPuppetEditMode) {
                e.preventDefault();
                return false;
            }
        });
        
        // タイムラインスクロールエリアのドラッグ&ドロップ（素材追加用）
        const timelineScroll = document.getElementById('timelineScroll');
        timelineScroll.addEventListener('drop', (e) => this.handleAssetDrop(e));
        timelineScroll.addEventListener('dragover', (e) => e.preventDefault());
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        
        // 素材エクスプローラーのドラッグ&ドロップ
        document.getElementById('assetExplorer').addEventListener('drop', (e) => this.handleAssetDrop(e));
        document.getElementById('assetExplorer').addEventListener('dragover', (e) => e.preventDefault());
        
        // タイムラインスクロールとトラックパネルのスクロール同期
        const trackPanel = document.getElementById('trackPanel');
        
        if (timelineScroll && trackPanel) {
            timelineScroll.addEventListener('scroll', () => {
                trackPanel.scrollTop = timelineScroll.scrollTop;
                this.drawRuler(); // ルーラーを再描画
            });
        }
        
        // パペットUIイベントリスナー
        this.setupPuppetEventListeners();
    }
    
    setupPuppetEventListeners() {
        // パペット有効化チェックボックス
        const puppetEnabledCheckbox = document.getElementById('puppetEnabled');
        if (puppetEnabledCheckbox) {
            puppetEnabledCheckbox.addEventListener('change', (e) => {
                if (this.selectedClip && this.selectedClip.puppet) {
                    this.selectedClip.puppet.enabled = e.target.checked;
                    this.updatePreview();
                    this.saveHistory();
                }
            });
        }
        
        // グリッド密度スライダー
        const gridDensitySlider = document.getElementById('puppetGridDensity');
        if (gridDensitySlider) {
            gridDensitySlider.addEventListener('input', (e) => {
                if (this.selectedClip && this.selectedClip.puppet) {
                    this.selectedClip.puppet.gridDensity = parseInt(e.target.value);
                    document.getElementById('puppetGridDensityValue').textContent = e.target.value;
                    this.updatePreview();
                }
            });
            gridDensitySlider.addEventListener('change', () => {
                this.saveHistory();
            });
        }
        
        // 硬さスライダー
        const stiffnessSlider = document.getElementById('puppetStiffness');
        if (stiffnessSlider) {
            stiffnessSlider.addEventListener('input', (e) => {
                if (this.selectedClip && this.selectedClip.puppet) {
                    this.selectedClip.puppet.stiffness = parseInt(e.target.value) / 100;
                    document.getElementById('puppetStiffnessValue').textContent = e.target.value;
                    this.updatePreview();
                }
            });
            stiffnessSlider.addEventListener('change', () => {
                this.saveHistory();
            });
        }
    }
    
    setupEffectControls() {
        // レターボックス - パラメーター変更時はキャッシュに保存
        document.getElementById('letterboxHeight').addEventListener('input', (e) => {
            this.effects.letterbox.height = parseInt(e.target.value);
            document.getElementById('letterboxHeightValue').textContent = `${e.target.value}px`;
            this.saveSettingsToCache();
            this.updatePreview();
        });
        
        document.getElementById('letterboxColor').addEventListener('change', (e) => {
            this.effects.letterbox.color = e.target.value;
            this.saveSettingsToCache();
            this.updatePreview();
        });
        
        // レターボックス有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('letterboxEnable').addEventListener('change', (e) => {
            this.effects.letterbox.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // グラデーション有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('gradientEnable').addEventListener('change', (e) => {
            this.effects.gradient.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // ディフュージョン有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('diffusionEnable').addEventListener('change', (e) => {
            this.effects.diffusion.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // カラーキー有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('colorKeyEnable').addEventListener('change', (e) => {
            this.effects.colorKey.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // ノーマライズ有効/無効 - プロジェクト依存なのでキャッシュ保存しない
        document.getElementById('normalizeEnable').addEventListener('change', (e) => {
            this.effects.normalize.enabled = e.target.checked;
            this.updatePreview();
        });
        
        // 風揺れエフェクトのイベントリスナー
        this.setupWindShakeListeners();
        this.setupBlurListeners();
    }
    
    // 風揺れエフェクトのイベントリスナー設定
    setupWindShakeListeners() {
        document.getElementById('windShakeEnabled').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.enabled = e.target.checked;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeDivisions').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.divisions = parseInt(e.target.value);
                document.getElementById('windShakeDivisionsValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeAngle').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.angle = parseFloat(e.target.value);
                document.getElementById('windShakeAngleValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakePeriod').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.period = parseFloat(e.target.value);
                const period = parseFloat(e.target.value);
                document.getElementById('windShakePeriodValue').textContent = period.toFixed(2);
                
                // ループ情報を更新
                const loopTimes = [period, period * 2, period * 3, period * 4, period * 5].map(t => t.toFixed(2));
                document.getElementById('windShakeLoopInfo').textContent = 
                    `周期 ${period.toFixed(2)}秒 → ${loopTimes.join('秒, ')}秒でループ`;
                
                this.updatePreview();
            }
        });

        document.getElementById('windShakePhaseShift').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.phaseShift = parseFloat(e.target.value);
                document.getElementById('windShakePhaseShiftValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeCenter').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.center = parseFloat(e.target.value);
                document.getElementById('windShakeCenterValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeTopFixed').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.topFixed = parseFloat(e.target.value);
                document.getElementById('windShakeTopFixedValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeBottomFixed').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.bottomFixed = parseFloat(e.target.value);
                document.getElementById('windShakeBottomFixedValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeFromBottom').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.fromBottom = e.target.checked;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeRandomSwing').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.randomSwing = e.target.checked;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeRandomPattern').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.randomPattern = parseInt(e.target.value);
                document.getElementById('windShakeRandomPatternValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeHorizontalRepeat').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.horizontalRepeat = e.target.checked;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeRepeatCount').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.repeatCount = parseInt(e.target.value);
                document.getElementById('windShakeRepeatCountValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeSpacing').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.spacing = parseFloat(e.target.value);
                document.getElementById('windShakeSpacingValue').textContent = e.target.value;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeTimeShift').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.timeShift = parseFloat(e.target.value);
                document.getElementById('windShakeTimeShiftValue').textContent = parseFloat(e.target.value).toFixed(2);
                this.updatePreview();
            }
        });

        document.getElementById('windShakeAlphaCorrection').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.alphaCorrection = e.target.checked;
                this.updatePreview();
            }
        });

        document.getElementById('windShakeAntiAliasing').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.antiAliasing = e.target.checked;
                this.updatePreview();
            }
        });

        // プリセット選択
        document.getElementById('windShakePreset').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.applyWindShakePreset(e.target.value);
            }
        });
        
        // 軸モード関連
        document.getElementById('windShakeAxisMode').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.axisMode = e.target.checked;
                // UIの有効/無効を切り替え
                document.getElementById('windShakePickAxisBtn').disabled = !e.target.checked;
                document.getElementById('windShakeAxisPosition').disabled = !e.target.checked;
                document.getElementById('windShakeAxisStrength').disabled = !e.target.checked;
                document.getElementById('windShakeAxisRange').disabled = !e.target.checked;
                this.updatePreview();
            }
        });
        
        document.getElementById('windShakePickAxisBtn').addEventListener('click', () => {
            if (this.selectedClip && this.selectedClip.windShake && this.selectedClip.windShake.axisMode) {
                this.windShakeAxisPickMode = true;
                document.getElementById('windShakePickAxisBtn').textContent = '🎯 クリックして軸を選択中...';
                document.getElementById('windShakePickAxisBtn').style.background = '#ff6b9d';
            }
        });
        
        document.getElementById('windShakeAxisPosition').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.axisPosition = parseFloat(e.target.value);
                document.getElementById('windShakeAxisPositionValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
        
        document.getElementById('windShakeAxisStrength').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.axisStrength = parseFloat(e.target.value);
                document.getElementById('windShakeAxisStrengthValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
        
        document.getElementById('windShakeAxisRange').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.windShake) {
                this.selectedClip.windShake.axisRange = parseFloat(e.target.value);
                document.getElementById('windShakeAxisRangeValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
    }
    
    setupBlurListeners() {
        // ガウシアンブラー
        document.getElementById('gaussianBlurEnabled').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.gaussianBlur) {
                this.selectedClip.gaussianBlur.enabled = e.target.checked;
                this.updatePreview();
            }
        });
        
        document.getElementById('gaussianBlurStrength').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.gaussianBlur) {
                this.selectedClip.gaussianBlur.strength = parseFloat(e.target.value);
                document.getElementById('gaussianBlurStrengthValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
        
        document.getElementById('gaussianBlurHorizontalOnly').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.gaussianBlur) {
                this.selectedClip.gaussianBlur.horizontalOnly = e.target.checked;
                if (e.target.checked) {
                    document.getElementById('gaussianBlurVerticalOnly').checked = false;
                    this.selectedClip.gaussianBlur.verticalOnly = false;
                }
                this.updatePreview();
            }
        });
        
        document.getElementById('gaussianBlurVerticalOnly').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.gaussianBlur) {
                this.selectedClip.gaussianBlur.verticalOnly = e.target.checked;
                if (e.target.checked) {
                    document.getElementById('gaussianBlurHorizontalOnly').checked = false;
                    this.selectedClip.gaussianBlur.horizontalOnly = false;
                }
                this.updatePreview();
            }
        });
        
        // レンズブラー
        document.getElementById('lensBlurEnabled').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.lensBlur) {
                this.selectedClip.lensBlur.enabled = e.target.checked;
                this.updatePreview();
            }
        });
        
        document.getElementById('lensBlurPickFocusBtn').addEventListener('click', () => {
            if (this.selectedClip && this.selectedClip.lensBlur) {
                this.lensBlurFocusPickMode = true;
                document.getElementById('lensBlurPickFocusBtn').textContent = '🎯 クリックしてフォーカス位置を選択中...';
                document.getElementById('lensBlurPickFocusBtn').style.background = '#ff6b9d';
            }
        });
        
        document.getElementById('lensBlurFocusPosition').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.lensBlur) {
                this.selectedClip.lensBlur.focusPosition = parseFloat(e.target.value);
                document.getElementById('lensBlurFocusPositionValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
        
        document.getElementById('lensBlurFocusRange').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.lensBlur) {
                this.selectedClip.lensBlur.focusRange = parseFloat(e.target.value);
                document.getElementById('lensBlurFocusRangeValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
        
        document.getElementById('lensBlurStrength').addEventListener('input', (e) => {
            if (this.selectedClip && this.selectedClip.lensBlur) {
                this.selectedClip.lensBlur.strength = parseFloat(e.target.value);
                document.getElementById('lensBlurStrengthValue').textContent = e.target.value;
                this.updatePreview();
            }
        });
        
        document.getElementById('lensBlurInvert').addEventListener('change', (e) => {
            if (this.selectedClip && this.selectedClip.lensBlur) {
                this.selectedClip.lensBlur.invert = e.target.checked;
                this.updatePreview();
            }
        });
    }
    
    // グラデーションエフェクト更新（新規メソッド）
    updateGradientEffect() {
        // 上部
        this.effects.gradient.top.color = document.getElementById('gradientTopColor').value;
        this.effects.gradient.top.height = parseInt(document.getElementById('gradientTopHeight').value);
        this.effects.gradient.top.opacity = parseInt(document.getElementById('gradientTopOpacity').value);
        this.effects.gradient.top.blendMode = document.getElementById('gradientTopBlendMode').value;
        document.getElementById('gradientTopHeightValue').textContent = `${this.effects.gradient.top.height}px`;
        document.getElementById('gradientTopOpacityValue').textContent = `${this.effects.gradient.top.opacity}%`;
        
        // 下部
        this.effects.gradient.bottom.color = document.getElementById('gradientBottomColor').value;
        this.effects.gradient.bottom.height = parseInt(document.getElementById('gradientBottomHeight').value);
        this.effects.gradient.bottom.opacity = parseInt(document.getElementById('gradientBottomOpacity').value);
        this.effects.gradient.bottom.blendMode = document.getElementById('gradientBottomBlendMode').value;
        document.getElementById('gradientBottomHeightValue').textContent = `${this.effects.gradient.bottom.height}px`;
        document.getElementById('gradientBottomOpacityValue').textContent = `${this.effects.gradient.bottom.opacity}%`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    updateDiffusionEffect() {
        // パラメータ取得
        this.effects.diffusion.blur = parseFloat(document.getElementById('diffusionBlur').value);
        this.effects.diffusion.contrast = parseFloat(document.getElementById('diffusionContrast').value);
        this.effects.diffusion.brightness = parseFloat(document.getElementById('diffusionBrightness').value);
        this.effects.diffusion.saturation = parseFloat(document.getElementById('diffusionSaturation').value);
        this.effects.diffusion.opacity = parseFloat(document.getElementById('diffusionOpacity').value);
        
        // 表示値更新
        document.getElementById('diffusionBlurValue').textContent = `${this.effects.diffusion.blur}`;
        document.getElementById('diffusionContrastValue').textContent = `${this.effects.diffusion.contrast}`;
        document.getElementById('diffusionBrightnessValue').textContent = `${this.effects.diffusion.brightness}`;
        document.getElementById('diffusionSaturationValue').textContent = `${this.effects.diffusion.saturation}`;
        document.getElementById('diffusionOpacityValue').textContent = `${this.effects.diffusion.opacity}%`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    updateColorKeyEffect() {
        // パラメータ取得
        this.effects.colorKey.color = document.getElementById('colorKeyColor').value;
        this.effects.colorKey.tolerance = parseFloat(document.getElementById('colorKeyTolerance').value);
        this.effects.colorKey.feather = parseFloat(document.getElementById('colorKeyFeather').value);
        this.effects.colorKey.invert = document.getElementById('colorKeyInvert').checked;
        
        // 表示値更新
        document.getElementById('colorKeyToleranceValue').textContent = `${this.effects.colorKey.tolerance}`;
        document.getElementById('colorKeyFeatherValue').textContent = `${this.effects.colorKey.feather}`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    updateNormalizeEffect() {
        // パラメータ取得
        this.effects.normalize.strength = parseInt(document.getElementById('normalizeStrength').value);
        
        // 表示値更新
        document.getElementById('normalizeStrengthValue').textContent = `${this.effects.normalize.strength}`;
        
        // キャッシュに自動保存
        this.saveSettingsToCache();
        
        this.updatePreview();
    }
    
    // スポイト機能（プレビューキャンバスから色を取得）
    pickColorFromCanvas() {
        // スポイトモードを有効化
        this.eyedropperMode = true;
        this.showNotification('💉 プレビュー画面をクリックして色を取得してください');
        
        // プレビューキャンバスのカーソルを変更
        this.previewCanvas.style.cursor = 'crosshair';
        
        // 一時的なクリックイベントリスナーを追加
        const eyedropperClick = (e) => {
            const rect = this.previewCanvas.getBoundingClientRect();
            
            // CSSピクセルからキャンバスピクセルに変換
            const scaleX = this.previewCanvas.width / rect.width;
            const scaleY = this.previewCanvas.height / rect.height;
            
            const canvasX = Math.floor((e.clientX - rect.left) * scaleX);
            const canvasY = Math.floor((e.clientY - rect.top) * scaleY);
            
            // ピクセルの色を取得
            const imageData = this.previewCtx.getImageData(canvasX, canvasY, 1, 1);
            const data = imageData.data;
            
            const r = data[0];
            const g = data[1];
            const b = data[2];
            
            // RGBをHEXに変換
            const hex = '#' + [r, g, b].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            
            // カラーピッカーに設定
            document.getElementById('colorKeyColor').value = hex;
            this.updateColorKeyEffect();
            
            this.showNotification(`🎨 色を取得しました: ${hex}`);
            
            // スポイトモードを終了
            this.eyedropperMode = false;
            this.previewCanvas.style.cursor = 'default';
            this.previewCanvas.removeEventListener('click', eyedropperClick);
        };
        
        this.previewCanvas.addEventListener('click', eyedropperClick, { once: true });
    }
    
    // プレビューズームを更新
    updatePreviewZoom() {
        const zoomFactor = this.previewZoom / 100;
        this.previewCanvas.style.transform = `scale(${zoomFactor})`;
        this.previewCanvas.style.transformOrigin = 'center center';
        this.overlayCanvas.style.transform = `scale(${zoomFactor})`;
        this.overlayCanvas.style.transformOrigin = 'center center';
    }
    
    // ディフュージョンキーフレーム追加
    addDiffusionKeyframe() {
        const keyframe = {
            time: this.currentTime,
            blur: this.effects.diffusion.blur,
            contrast: this.effects.diffusion.contrast,
            brightness: this.effects.diffusion.brightness,
            saturation: this.effects.diffusion.saturation,
            opacity: this.effects.diffusion.opacity
        };
        
        // 既存のキーフレームを更新または追加
        const existingIndex = this.effects.diffusion.keyframes.findIndex(kf => Math.abs(kf.time - this.currentTime) < 0.01);
        if (existingIndex >= 0) {
            this.effects.diffusion.keyframes[existingIndex] = keyframe;
        } else {
            this.effects.diffusion.keyframes.push(keyframe);
        }
        
        this.updateDiffusionKeyframeList();
        this.saveHistory();
    }
    
    // ディフュージョンキーフレーム削除
    removeDiffusionKeyframe() {
        const keyframeIndex = this.effects.diffusion.keyframes.findIndex(kf => Math.abs(kf.time - this.currentTime) < 0.01);
        if (keyframeIndex >= 0) {
            this.effects.diffusion.keyframes.splice(keyframeIndex, 1);
            this.updateDiffusionKeyframeList();
            this.saveHistory();
        }
    }
    
    // ディフュージョンキーフレーム全削除
    clearDiffusionKeyframes() {
        if (confirm('すべてのディフュージョンキーフレームを削除しますか?')) {
            this.effects.diffusion.keyframes = [];
            this.updateDiffusionKeyframeList();
            this.saveHistory();
        }
    }
    
    // ディフュージョンキーフレームリスト更新
    updateDiffusionKeyframeList() {
        const list = document.getElementById('diffusionKeyframeList');
        if (!list) return;
        
        const keyframes = this.effects.diffusion.keyframes;
        
        if (keyframes.length === 0) {
            list.innerHTML = '<div class="empty-message">キーフレームなし</div>';
            return;
        }
        
        // 時刻順にソート
        keyframes.sort((a, b) => a.time - b.time);
        
        list.innerHTML = keyframes.map((kf, i) => {
            const timeStr = this.formatTime(kf.time);
            const isCurrent = Math.abs(kf.time - this.currentTime) < 0.01;
            return `
                <div class="keyframe-item ${isCurrent ? 'current' : ''}" onclick="app.seekToTime(${kf.time})">
                    <span class="keyframe-time">${timeStr}</span>
                    <span class="keyframe-values">B:${kf.blur.toFixed(0)} C:${kf.contrast.toFixed(0)} Br:${kf.brightness.toFixed(0)}</span>
                </div>
            `;
        }).join('');
    }
    
    // 時刻フォーマット関数
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    
    // 指定時刻にシーク
    seekToTime(time) {
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        this.updatePreview();
        this.drawTimeline();
        this.drawRuler();
    }
    
    // ファイル管理
    importMedia() {
        const input = document.getElementById('fileInput');
        const isSequence = document.getElementById('sequenceCheckbox').checked;
        
        if (isSequence) {
            // 連番の場合はフォルダ選択
            input.setAttribute('webkitdirectory', '');
            input.setAttribute('directory', '');
            input.removeAttribute('accept');
        } else {
            // 通常の場合はファイル選択
            input.removeAttribute('webkitdirectory');
            input.removeAttribute('directory');
            input.accept = 'image/*,video/*,audio/*,.mov,.MOV';
        }
        
        input.multiple = true;
        input.click();
    }
    
    // ベタ塗りクリップを作成
    createSolidColorClip() {
        const asset = {
            id: Date.now() + Math.random(),
            name: `ベタ塗り`,
            type: 'solid',
            color: '#FF6B9D',
            element: this.createSolidColorCanvas('#FF6B9D')
        };
        
        this.assets.push(asset);
        
        // タイムラインに自動配置
        this.addClipFromAsset(asset.id, this.currentTime, 0);
        
        // 追加したクリップを選択
        const addedClip = this.clips[this.clips.length - 1];
        this.selectedClip = addedClip;
        this.updatePropertiesPanel();
        this.drawTimeline();
        this.updatePreview();
    }
    
    // グラデーションクリップを作成
    createGradientClip() {
        const asset = {
            id: Date.now() + Math.random(),
            name: `グラデーション`,
            type: 'gradient',
            color1: '#FF6B9D',
            color2: '#6B9DFF',
            direction: '1', // 1:上→下, 2:左→右, 3:斜め
            gradientType: '1', // 1:色→色, 2:色→透明
            element: this.createGradientCanvas('#FF6B9D', '#6B9DFF', '1')
        };
        
        this.assets.push(asset);
        
        // タイムラインに自動配置
        this.addClipFromAsset(asset.id, this.currentTime, 0);
        
        // 追加したクリップを選択
        const addedClip = this.clips[this.clips.length - 1];
        this.selectedClip = addedClip;
        this.updatePropertiesPanel();
        this.drawTimeline();
        this.updatePreview();
    }
    
    // ストライプクリップを作成
    createStripeClip() {
        const asset = {
            id: Date.now() + Math.random(),
            name: `ストライプ`,
            type: 'stripe',
            color1: '#FF6B9D',
            color2: '#6B9DFF',
            stripeWidth: 50,
            direction: '1', // 1:横, 2:縦, 3:斜め
            stripeType: '1', // 1:色+色, 2:色+透明
            element: this.createStripeCanvas('#FF6B9D', '#6B9DFF', 50, '1')
        };
        
        this.assets.push(asset);
        
        // タイムラインに自動配置
        this.addClipFromAsset(asset.id, this.currentTime, 0);
        
        // 追加したクリップを選択
        const addedClip = this.clips[this.clips.length - 1];
        this.selectedClip = addedClip;
        this.updatePropertiesPanel();
        this.drawTimeline();
        this.updatePreview();
    }
    
    // ベタ塗りキャンバスを作成
    createSolidColorCanvas(color) {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1920, 1080);
        return canvas;
    }
    
    // グラデーションキャンバスを作成
    createGradientCanvas(color1, color2, direction) {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        let gradient;
        if (direction === '1') {
            // 上→下
            gradient = ctx.createLinearGradient(0, 0, 0, 1080);
        } else if (direction === '2') {
            // 左→右
            gradient = ctx.createLinearGradient(0, 0, 1920, 0);
        } else {
            // 斜め
            gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
        }
        
        gradient.addColorStop(0, color1);
        gradient.addColorStop(1, color2);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1920, 1080);
        return canvas;
    }
    
    // ストライプキャンバスを作成
    createStripeCanvas(color1, color2, stripeWidth, direction) {
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        
        if (direction === '1') {
            // 横ストライプ
            for (let y = 0; y < 1080; y += stripeWidth * 2) {
                ctx.fillStyle = color1;
                ctx.fillRect(0, y, 1920, stripeWidth);
                ctx.fillStyle = color2;
                ctx.fillRect(0, y + stripeWidth, 1920, stripeWidth);
            }
        } else if (direction === '2') {
            // 縦ストライプ
            for (let x = 0; x < 1920; x += stripeWidth * 2) {
                ctx.fillStyle = color1;
                ctx.fillRect(x, 0, stripeWidth, 1080);
                ctx.fillStyle = color2;
                ctx.fillRect(x + stripeWidth, 0, stripeWidth, 1080);
            }
        } else {
            // 斜めストライプ
            ctx.save();
            ctx.translate(960, 540);
            ctx.rotate(-45 * Math.PI / 180);
            for (let x = -2000; x < 2000; x += stripeWidth * 2) {
                ctx.fillStyle = color1;
                ctx.fillRect(x, -2000, stripeWidth, 4000);
                ctx.fillStyle = color2;
                ctx.fillRect(x + stripeWidth, -2000, stripeWidth, 4000);
            }
            ctx.restore();
        }
        
        return canvas;
    }
    
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        const isSequence = document.getElementById('sequenceCheckbox').checked;
        
        if (isSequence && files.length > 0) {
            // 連番画像として処理 - 画像ファイルのみフィルター
            const imageFiles = files.filter(f => f.type.startsWith('image/'));
            
            if (imageFiles.length > 0) {
                this.addSequenceAsset(imageFiles);
            } else {
                alert('画像ファイルが見つかりませんでした');
            }
        } else {
            // 通常の素材として処理
            for (let file of files) {
                this.addAsset(file);
            }
        }
        
        event.target.value = ''; // リセット
        document.getElementById('sequenceCheckbox').checked = false; // チェックを解除
    }
    
    // 連番画像素材を追加
    addSequenceAsset(files) {
        // ファイル名でソート
        files.sort((a, b) => a.name.localeCompare(b.name));
        
        // フォルダ名を取得
        const folderPath = files[0].webkitRelativePath || files[0].name;
        const folderName = folderPath.split('/')[0] || '連番';
        
        const asset = {
            id: Date.now() + Math.random(),
            name: `${folderName} (連番)`,
            type: 'sequence',
            files: files,
            urls: files.map(f => URL.createObjectURL(f)),
            frameCount: files.length
        };
        
        this.assets.push(asset);
        this.renderAssets();
    }
    
    addAsset(file) {
        // MOVファイルの判定（MIMEタイプが空の場合もあるので拡張子で判定）
        const fileName = file.name.toLowerCase();
        const isMOV = fileName.endsWith('.mov');
        
        let assetType = file.type.split('/')[0]; // image, video, audio
        
        // MOVファイルは動画として扱う
        if (isMOV || file.type === 'video/quicktime') {
            assetType = 'video';
        }
        
        const asset = {
            id: Date.now() + Math.random(),
            name: file.name,
            type: assetType,
            file: file,
            url: URL.createObjectURL(file)
        };
        
        this.assets.push(asset);
        this.renderAssets();
    }
    
    renderAssets() {
        const explorer = document.getElementById('assetExplorer');
        explorer.innerHTML = '';
        
        // フィルター適用
        const filteredAssets = this.assetFilter === 'all' 
            ? this.assets 
            : this.assets.filter(asset => asset.type === this.assetFilter);
        
        if (filteredAssets.length === 0) {
            const filterNames = {
                'all': '素材',
                'image': '画像',
                'video': '動画',
                'audio': '音声',
                'sequence': '連番',
                'scene': 'シーン'
            };
            const message = this.assetFilter === 'all' 
                ? '素材をドロップまたは➕ボタンで追加' 
                : `${filterNames[this.assetFilter]}素材がありません`;
            explorer.innerHTML = `<div class="empty-message">${message}</div>`;
            return;
        }
        
        filteredAssets.forEach(asset => {
            const item = document.createElement('div');
            item.className = 'asset-item';
            item.draggable = true;
            item.dataset.assetId = asset.id;
            
            const icon = {
                'image': '🖼️',
                'video': '🎬',
                'audio': '🎵',
                'sequence': '📹',
                'scene': '🎬'
            }[asset.type] || '📄';
            
            const typeDisplay = asset.type === 'sequence' 
                ? `連番 (${asset.frameCount}枚)` 
                : asset.type === 'scene'
                ? 'シーン'
                : asset.type;
            
            item.innerHTML = `
                <div class="asset-thumbnail">${icon}</div>
                <div class="asset-info">
                    <div class="asset-name">${asset.name}</div>
                    <div class="asset-type">${typeDisplay}</div>
                </div>
            `;
            
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('assetId', asset.id);
            });
            
            // シーン素材のダブルクリックでシーンに移動
            if (asset.type === 'scene') {
                item.addEventListener('dblclick', () => {
                    this.sceneManager.switchToScene(asset.sceneId);
                });
                item.style.cursor = 'pointer';
            }
            
            explorer.appendChild(item);
        });
    }
    
    // 素材フィルター設定
    setAssetFilter(filter) {
        this.assetFilter = filter;
        
        // ボタンのアクティブ状態を更新
        document.querySelectorAll('.filter-button').forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        this.renderAssets();
    }
    
    handleAssetDrop(event) {
        event.preventDefault();
        
        // クリップ移動中の場合は何もしない
        if (this.isMovingClip) {
            return;
        }
        
        const rect = event.target.getBoundingClientRect();
        const targetIsTimeline = event.target.id === 'timelineCanvas' || 
                                 event.target.closest('#timelineScroll');
        
        // ファイルドロップ (素材エクスプローラーへ)
        if (event.dataTransfer.files.length > 0 && !targetIsTimeline) {
            for (let file of event.dataTransfer.files) {
                this.addAsset(file);
            }
            return;
        }
        
        // タイムラインへのドロップ (素材エクスプローラーから)
        const assetId = event.dataTransfer.getData('assetId');
        if (assetId && targetIsTimeline) {
            // timelineCanvasの座標を取得
            const canvasRect = this.timelineCanvas.getBoundingClientRect();
            const scrollContainer = document.getElementById('timelineScroll');
            
            // キャンバス内の相対座標を計算
            // getBoundingClientRect()は既にスクロールを考慮しているので、scrollTopは足さない
            const x = (event.clientX - canvasRect.left) + scrollContainer.scrollLeft;
            const y = event.clientY - canvasRect.top;
            
            const time = x / this.zoom;
            const track = Math.floor(y / this.trackHeight);
            
            this.addClipFromAsset(assetId, time, track);
        }
    }
    
    addClipFromAsset(assetId, startTime, track) {
        const asset = this.assets.find(a => a.id == assetId);
        if (!asset) return;
        
        const defaultDuration = 5; // 画像のデフォルト5秒
        
        const clip = {
            id: Date.now() + Math.random(),
            asset: asset,
            track: Math.max(0, Math.min(track, this.trackCount - 1)),
            startTime: Math.max(0, startTime),
            duration: defaultDuration, // 後で更新される場合がある
            originalDuration: defaultDuration, // 元の長さを保存
            offset: 0, // オフセット（トリミング用）
            volume: 1.0, // 音量 (0.0 - 1.0)
            pan: 0, // パン (-1.0 左 ～ 0 中央 ～ 1.0 右)
            loopCount: 1, // ループ回数
            useOriginalSize: true, // 原寸表示フラグ
            transitionIn: {
                type: 'none',
                duration: 0.5
            },
            transitionOut: {
                type: 'none',
                duration: 0.5
            },
            keyframes: {
                x: [{time: 0, value: 0}],
                y: [{time: 0, value: 0}],
                rotation: [{time: 0, value: 0}],
                opacity: [{time: 0, value: 1}],
                scale: [{time: 0, value: 1}],
                pan: [{time: 0, value: 0}] // パンのキーフレーム
            },
            windShake: {
                enabled: false,
                divisions: 10,
                angle: 30,
                period: 2.0,
                phaseShift: 90,
                center: 0,
                topFixed: 10,
                bottomFixed: 10,
                fromBottom: false,
                randomSwing: false,
                randomPattern: 0,
                timeShift: 0.1,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorrection: true,
                antiAliasing: true,  // デフォルトON
                seed: Math.random() * 10000,
                axisMode: false,
                axisPosition: 50,
                axisStrength: 50,
                axisRange: 30
            },
            gaussianBlur: {
                enabled: false,
                strength: 10,
                horizontalOnly: false,
                verticalOnly: false
            },
            lensBlur: {
                enabled: false,
                focusPosition: 50,  // Y位置 0-100%
                focusRange: 20,     // フォーカス範囲
                strength: 30,       // 最大ブラー強度
                invert: false       // 反転モード
            },
            puppet: {
                enabled: false,
                pins: [],  // { id, x, y, keyframes: [{time, x, y}] }
                gridDensity: 20,  // メッシュの細かさ
                stiffness: 0.5    // 変形の硬さ (0-1)
            },
            anchorPoint: {
                x: 0.5,  // 0-1 (画像の中心が0.5)
                y: 0.5   // 0-1 (画像の中心が0.5)
            },
            blendMode: 'normal',  // ブレンドモード
            clipSource: null  // クリッピングソース
        };
        
        // 連番アセットの場合
        if (asset.type === 'sequence') {
            clip.currentFrame = 0;
            clip.frameRate = 30; // デフォルト30fps
            // 連番の長さを計算
            const sequenceDuration = asset.frameCount / clip.frameRate;
            clip.duration = sequenceDuration;
            clip.originalDuration = sequenceDuration;
        }
        
        // 音声素材または動画素材の場合、AudioElementを準備
        if (asset.type === 'audio' || asset.type === 'video') {
            this.prepareAudioClip(clip);
        }
        
        // 画像・動画の場合、原寸情報を取得
        if (asset.type === 'image' || asset.type === 'video') {
            this.loadAssetDimensions(clip);
        }
        
        // 動画の場合、実際の長さを取得
        if (asset.type === 'video') {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                clip.duration = video.duration;
                clip.originalDuration = video.duration;
                this.drawTimeline();
            };
            video.src = asset.url;
        }
        
        // 音声の場合、実際の長さを取得
        if (asset.type === 'audio') {
            const audio = new Audio();
            audio.onloadedmetadata = () => {
                clip.duration = audio.duration;
                clip.originalDuration = audio.duration;
                this.drawTimeline();
            };
            audio.src = asset.url;
        }
        
        this.clips.push(clip);
        this.drawTimeline();
        this.saveHistory();
    }
    
    // 素材の原寸情報を読み込み
    loadAssetDimensions(clip) {
        if (clip.asset.type === 'image') {
            const img = new Image();
            img.onload = () => {
                clip.originalWidth = img.width;
                clip.originalHeight = img.height;
            };
            img.src = clip.asset.url;
        } else if (clip.asset.type === 'video') {
            const video = document.createElement('video');
            video.onloadedmetadata = () => {
                clip.originalWidth = video.videoWidth;
                clip.originalHeight = video.videoHeight;
            };
            video.src = clip.asset.url;
        }
    }
    
    // 音声クリップの準備
    prepareAudioClip(clip) {
        // 既に準備済みの場合は何もしない
        if (clip.audioElement && clip.audioSource) {
            return;
        }
        
        // 動画の場合は音声専用のaudioElementを作成（videoElementは映像用でmuted）
        // 音声クリップの場合は通常のaudioElementを作成
        clip.audioElement = new Audio(clip.asset.url);
        clip.audioElement.preload = 'auto';
        
        try {
            // Web Audio APIのノードを作成
            clip.audioSource = this.audioContext.createMediaElementSource(clip.audioElement);
            clip.gainNode = this.audioContext.createGain();
            clip.panNode = this.audioContext.createStereoPanner();
            
            // ノードを接続: audioSource → panNode → gainNode → destination
            clip.audioSource.connect(clip.panNode);
            clip.panNode.connect(clip.gainNode);
            clip.gainNode.connect(this.audioContext.destination);
            
            console.log('✅ 音声ノード作成成功:', clip.asset.name);
        } catch (error) {
            console.error('❌ 音声ノード作成エラー:', clip.asset.name, error);
        }
    }
    
    // タイムライン描画
    updateTimelineSize() {
        const width = Math.max(3000, this.duration * this.zoom + 100);
        const height = this.trackCount * this.trackHeight;
        
        this.timelineCanvas.width = width;
        this.timelineCanvas.height = height;
        
        // ルーラーの親要素の幅を取得
        const rulerParent = this.rulerCanvas.parentElement;
        if (rulerParent) {
            this.rulerCanvas.width = rulerParent.clientWidth;
        }
        
        // トラックパネルを更新
        this.updateTrackPanel();
    }
    
    // トラックパネルを更新
    updateTrackPanel() {
        const trackPanel = document.getElementById('trackPanel');
        if (!trackPanel) return;
        
        trackPanel.innerHTML = '';
        
        // トラック名が足りない場合は追加
        while (this.trackNames.length < this.trackCount) {
            this.trackNames.push(`Track ${this.trackNames.length + 1}`);
        }
        
        for (let i = 0; i < this.trackCount; i++) {
            const trackItem = document.createElement('div');
            trackItem.className = 'track-item';
            
            const trackNumber = document.createElement('div');
            trackNumber.className = 'track-number';
            trackNumber.textContent = `Track ${i + 1}`;
            
            const trackNameInput = document.createElement('input');
            trackNameInput.type = 'text';
            trackNameInput.className = 'track-name-input';
            trackNameInput.value = this.trackNames[i];
            trackNameInput.placeholder = `Track ${i + 1}`;
            trackNameInput.dataset.trackIndex = i;
            
            trackNameInput.addEventListener('input', (e) => {
                const trackIndex = parseInt(e.target.dataset.trackIndex);
                this.trackNames[trackIndex] = e.target.value;
            });
            
            trackNameInput.addEventListener('blur', () => {
                this.saveHistory();
            });
            
            trackItem.appendChild(trackNumber);
            trackItem.appendChild(trackNameInput);
            trackPanel.appendChild(trackItem);
        }
    }
    
    drawTimeline() {
        const ctx = this.timelineCtx;
        const width = this.timelineCanvas.width;
        const height = this.timelineCanvas.height;
        
        // 背景
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(0, 0, width, height);
        
        // トラックライン
        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = 1;
        for (let i = 0; i <= this.trackCount; i++) {
            const y = i * this.trackHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // 時間グリッド
        ctx.strokeStyle = '#B8956F';
        ctx.lineWidth = 1;
        for (let t = 0; t <= this.duration; t++) {
            const x = t * this.zoom;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // クリップ描画
        this.clips.forEach(clip => {
            this.drawClip(clip);
        });
        
        // 親子関係の線を描画
        this.drawParentingLines();
        
        // 複数選択されたクリップの強調表示
        if (this.extensions && this.extensions.selectedClips.size > 0) {
            this.clips.forEach(clip => {
                if (this.extensions.isClipSelected(clip.id)) {
                    this.extensions.drawSelectedClipHighlight(ctx, clip);
                }
            });
        }
        
        // 再生ヘッド
        this.drawPlayhead();
    }
    
    drawClip(clip) {
        const ctx = this.timelineCtx;
        const x = clip.startTime * this.zoom;
        const y = clip.track * this.trackHeight + 5;
        
        // offset を考慮した実際の表示幅を計算
        const visibleDuration = clip.duration - (clip.offset || 0);
        const width = visibleDuration * this.zoom;
        const height = this.trackHeight - 10;
        const radius = 8; // 角丸の半径
        
        // クリップ背景 - 音声クリップは異なる色
        if (clip.asset.type === 'audio') {
            ctx.fillStyle = clip === this.selectedClip ? '#D2691E' : '#8B6914';
        } else if (clip.asset.type === 'sequence') {
            ctx.fillStyle = clip === this.selectedClip ? '#D2691E' : '#6B5423';
        } else {
            ctx.fillStyle = clip === this.selectedClip ? '#D2691E' : '#6B4423';
        }
        
        // 角丸矩形を描画
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + radius, radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
        ctx.lineTo(x + radius, y + height);
        ctx.arcTo(x, y + height, x, y + height - radius, radius);
        ctx.lineTo(x, y + radius);
        ctx.arcTo(x, y, x + radius, y, radius);
        ctx.closePath();
        ctx.fill();
        
        // ボーダー
        ctx.strokeStyle = '#5D3A1A';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // オフセットインジケーター（トリミングされている場合）
        if (clip.offset && clip.offset > 0) {
            // 左端にオレンジのトリミングマーク
            ctx.fillStyle = 'rgba(255, 140, 0, 0.7)';
            ctx.fillRect(x, y, 4, height);
            
            ctx.fillStyle = '#FF8C00';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('✂', x + 6, y + 15);
        }
        
        // アイコンとテキスト
        const icon = {
            'image': '🖼️',
            'video': '🎬',
            'audio': '🎵',
            'sequence': '📹'
        }[clip.asset.type] || '📄';
        
        ctx.fillStyle = '#F5DEB3';
        ctx.font = '16px sans-serif';
        ctx.fillText(icon, x + 5, y + 25);
        
        ctx.font = '12px sans-serif';
        const displayName = clip.asset.name.length > 20 ? clip.asset.name.substring(0, 20) + '...' : clip.asset.name;
        ctx.fillText(displayName, x + 25, y + 20);
        
        // トランジションインジケーター
        this.drawTransitionIndicators(clip, x, y, width, height);
        
        // キーフレームインジケーター（全てのクリップタイプで表示）
        this.drawKeyframeIndicators(clip, x, y, height);
        
        // 音声クリップまたは動画クリップの場合は波形表示
        if (clip.asset.type === 'audio' || clip.asset.type === 'video') {
            this.drawAudioWaveform(clip, x, y, width, height);
        }
    }
    
    drawTransitionIndicators(clip, x, y, width, height) {
        const ctx = this.timelineCtx;
        
        // トランジションイン
        if (clip.transitionIn.type !== 'none') {
            const transWidth = clip.transitionIn.duration * this.zoom;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(x, y, Math.min(transWidth, width), height);
            
            ctx.fillStyle = '#FFFF00';
            ctx.font = '10px sans-serif';
            ctx.fillText('IN', x + 2, y + 12);
        }
        
        // トランジションアウト
        if (clip.transitionOut.type !== 'none') {
            const transWidth = clip.transitionOut.duration * this.zoom;
            const startX = x + width - transWidth;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(Math.max(startX, x), y, Math.min(transWidth, width), height);
            
            ctx.fillStyle = '#FFFF00';
            ctx.font = '10px sans-serif';
            ctx.fillText('OUT', x + width - 30, y + 12);
        }
    }
    
    drawAudioWaveform(clip, x, y, width, height) {
        const ctx = this.timelineCtx;
        const centerY = y + height / 2;
        
        // 音声データがまだ解析されていない場合は解析開始
        if (!clip.waveformData && clip.audioElement && clip.audioElement.src) {
            this.analyzeAudioWaveform(clip);
            // 解析中は簡易波形を表示
            ctx.strokeStyle = '#F5DEB3';
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            for (let i = 0; i < width; i += 5) {
                const waveHeight = Math.sin(i / 10) * (height / 6);
                if (i === 0) {
                    ctx.moveTo(x + i, centerY + waveHeight);
                } else {
                    ctx.lineTo(x + i, centerY + waveHeight);
                }
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
            return;
        }
        
        // 波形データがある場合は実際の波形を描画
        if (clip.waveformData) {
            const trimStart = clip.trimStart || clip.offset || 0;
            const sampleRate = clip.waveformData.sampleRate;
            const samples = clip.waveformData.samples;
            const originalDuration = clip.originalDuration || (samples.length / sampleRate);
            
            // ループが有効な場合は波形を繰り返し描画
            const loopEnabled = clip.loopEnabled || false;
            
            // 波形を描画
            ctx.strokeStyle = '#F5DEB3';
            ctx.fillStyle = 'rgba(245, 222, 179, 0.3)';
            ctx.lineWidth = 1;
            
            ctx.beginPath();
            ctx.moveTo(x, centerY);
            
            // 上半分の波形
            for (let i = 0; i < width; i++) {
                const timeInClip = (i / width) * clip.duration;
                let actualTime = trimStart + timeInClip;
                
                // ループ対応：元の長さを超えたら繰り返し
                if (loopEnabled && actualTime >= originalDuration) {
                    actualTime = trimStart + (timeInClip % (originalDuration - trimStart));
                }
                
                const sampleIndex = Math.floor(actualTime * sampleRate);
                
                if (sampleIndex >= 0 && sampleIndex < samples.length) {
                    const waveHeight = Math.abs(samples[sampleIndex]) * (height / 2) * 0.8;
                    ctx.lineTo(x + i, centerY - waveHeight);
                } else {
                    ctx.lineTo(x + i, centerY);
                }
            }
            
            // 下半分の波形（逆順）
            for (let i = width - 1; i >= 0; i--) {
                const timeInClip = (i / width) * clip.duration;
                let actualTime = trimStart + timeInClip;
                
                // ループ対応
                if (loopEnabled && actualTime >= originalDuration) {
                    actualTime = trimStart + (timeInClip % (originalDuration - trimStart));
                }
                
                const sampleIndex = Math.floor(actualTime * sampleRate);
                
                if (sampleIndex >= 0 && sampleIndex < samples.length) {
                    const waveHeight = Math.abs(samples[sampleIndex]) * (height / 2) * 0.8;
                    ctx.lineTo(x + i, centerY + waveHeight);
                } else {
                    ctx.lineTo(x + i, centerY);
                }
            }
            
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // ループ境界線を描画
            if (loopEnabled && clip.duration > originalDuration - trimStart) {
                const loopPointPixel = ((originalDuration - trimStart) / clip.duration) * width;
                ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(x + loopPointPixel, y);
                ctx.lineTo(x + loopPointPixel, y + height);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
    }
    
    // 音声波形データを解析
    async analyzeAudioWaveform(clip) {
        if (!clip.audioElement || !clip.audioElement.src || clip.waveformData) return;
        
        try {
            const response = await fetch(clip.audioElement.src);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
            
            // モノラルに変換（全チャンネルの平均）
            const numChannels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length;
            const sampleRate = audioBuffer.sampleRate;
            const samples = new Float32Array(length);
            
            for (let i = 0; i < length; i++) {
                let sum = 0;
                for (let channel = 0; channel < numChannels; channel++) {
                    sum += audioBuffer.getChannelData(channel)[i];
                }
                samples[i] = sum / numChannels;
            }
            
            clip.waveformData = {
                samples: samples,
                sampleRate: sampleRate
            };
            
            // 波形データが準備できたらタイムラインを再描画
            this.drawTimeline();
        } catch (err) {
            console.error('波形解析エラー:', err);
        }
    }
    
    drawKeyframeIndicators(clip, clipX, clipY, clipHeight) {
        const ctx = this.timelineCtx;
        const keyframeSize = 16; // くま画像のサイズ
        const pinKeyframeSize = 12; // ピンのキーフレーム画像サイズ（小さめ）
        
        let yOffset = 0; // キーフレームを縦に並べるためのオフセット
        
        // 通常のキーフレーム（Transform、Opacity、Scaleなど）
        Object.keys(clip.keyframes).forEach(property => {
            const keyframes = clip.keyframes[property];
            keyframes.forEach(kf => {
                const x = clipX + (kf.time * this.zoom);
                const y = clipY + clipHeight - keyframeSize - 2 - yOffset;
                
                // くま画像が読み込まれていれば画像を描画、なければ黄色い丸
                if (this.keyframeImage && this.keyframeImage.complete) {
                    ctx.drawImage(
                        this.keyframeImage,
                        x - keyframeSize / 2,
                        y,
                        keyframeSize,
                        keyframeSize
                    );
                } else {
                    // フォールバック: 黄色い丸
                    ctx.fillStyle = '#FFFF00';
                    ctx.beginPath();
                    ctx.arc(x, y + keyframeSize / 2, 4, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });
        
        // ピンのキーフレーム
        if (clip.puppet && clip.puppet.enabled && clip.puppet.pins && clip.puppet.pins.length > 0) {
            clip.puppet.pins.forEach((pin, pinIndex) => {
                if (pin.keyframes && pin.keyframes.length > 0) {
                    // ピンのインデックスから対応する画像を取得（1-5の範囲）
                    const pinImageIndex = ((pinIndex % 5) + 1);
                    const pinImage = this.pinImages[pinImageIndex - 1]; // 0-indexedの配列
                    
                    pin.keyframes.forEach(kf => {
                        const x = clipX + (kf.time * this.zoom);
                        const y = clipY + clipHeight - pinKeyframeSize - 2 - yOffset;
                        
                        // ピン画像が読み込まれていれば画像を描画
                        if (pinImage && pinImage.complete) {
                            ctx.drawImage(
                                pinImage,
                                x - pinKeyframeSize / 2,
                                y,
                                pinKeyframeSize,
                                pinKeyframeSize
                            );
                        } else {
                            // フォールバック: 色付きの丸
                            const pinColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8'];
                            ctx.fillStyle = pinColors[pinIndex % 5];
                            ctx.beginPath();
                            ctx.arc(x, y + pinKeyframeSize / 2, 4, 0, Math.PI * 2);
                            ctx.fill();
                        }
                    });
                    
                    yOffset += pinKeyframeSize + 2; // 次のピンのキーフレームは少し上に表示
                }
            });
        }
    }
    
    drawPlayhead() {
        const ctx = this.timelineCtx;
        const x = this.currentTime * this.zoom;
        
        // 赤いライン(タイムラインキャンバスに描画)
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.timelineCanvas.height);
        ctx.stroke();
        
        // プレイヘッドトップ(くま画像) - タイムラインキャンバスに描画
        const bearSize = 36;
        if (this.seekbarImage && this.seekbarImage.complete) {
            ctx.drawImage(
                this.seekbarImage,
                x - bearSize / 2,
                10, // 10px下にずらしてルーラーに隠れないように
                bearSize,
                bearSize
            );
        }
    }
    
    // 親子関係の線を描画
    drawParentingLines() {
        const ctx = this.timelineCtx;
        
        this.clips.forEach(clip => {
            if (clip.parentId) {
                const parent = this.clips.find(c => c.id === clip.parentId);
                if (!parent) return;
                
                // 親クリップの中心位置
                const parentX = parent.startTime * this.zoom + (parent.duration * this.zoom) / 2;
                const parentY = parent.track * this.trackHeight + this.trackHeight / 2;
                
                // 子クリップの中心位置
                const childX = clip.startTime * this.zoom + (clip.duration * this.zoom) / 2;
                const childY = clip.track * this.trackHeight + this.trackHeight / 2;
                
                // ベジェ曲線で親子を結ぶ
                ctx.save();
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 3;
                ctx.setLineDash([5, 5]);
                ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
                ctx.shadowBlur = 4;
                
                ctx.beginPath();
                ctx.moveTo(parentX, parentY);
                
                // 制御点を計算（少し曲線を描く）
                const controlPointOffset = Math.abs(childY - parentY) * 0.5;
                ctx.bezierCurveTo(
                    parentX, parentY + controlPointOffset,
                    childX, childY - controlPointOffset,
                    childX, childY
                );
                
                ctx.stroke();
                ctx.setLineDash([]);
                
                // 矢印を描画（子クリップ側）
                const arrowSize = 8;
                const angle = Math.atan2(childY - parentY, childX - parentX);
                
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.moveTo(childX, childY);
                ctx.lineTo(
                    childX - arrowSize * Math.cos(angle - Math.PI / 6),
                    childY - arrowSize * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                    childX - arrowSize * Math.cos(angle + Math.PI / 6),
                    childY - arrowSize * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
                
                // 親クリップ側に小さな丸を描画
                ctx.beginPath();
                ctx.arc(parentX, parentY, 4, 0, Math.PI * 2);
                ctx.fillStyle = '#FFD700';
                ctx.fill();
                ctx.strokeStyle = '#8B7355';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                ctx.restore();
            }
        });
    }
    
    drawRuler() {
        const ctx = this.rulerCtx;
        const width = this.rulerCanvas.width;
        const height = 30;
        
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#DEB887';
        ctx.fillRect(0, 0, width, height);
        
        const scrollLeft = document.getElementById('timelineScroll').scrollLeft;
        
        // インアウトポイントの範囲を表示
        if (this.inPoint !== null && this.outPoint !== null) {
            const inX = this.inPoint * this.zoom - scrollLeft;
            const outX = this.outPoint * this.zoom - scrollLeft;
            const rangeWidth = outX - inX;
            
            ctx.fillStyle = 'rgba(210, 105, 30, 0.3)'; // 半透明のオレンジ
            ctx.fillRect(inX, 0, rangeWidth, height);
        }
        
        // インポイントマーカー
        if (this.inPoint !== null) {
            const inX = this.inPoint * this.zoom - scrollLeft;
            ctx.fillStyle = '#00FF00';
            ctx.fillRect(inX - 2, 0, 4, height);
            ctx.fillStyle = '#5D3A1A';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('IN', inX + 4, 10);
        }
        
        // アウトポイントマーカー
        if (this.outPoint !== null) {
            const outX = this.outPoint * this.zoom - scrollLeft;
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(outX - 2, 0, 4, height);
            ctx.fillStyle = '#5D3A1A';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('OUT', outX + 4, 10);
        }
        
        ctx.fillStyle = '#5D3A1A';
        ctx.font = '10px sans-serif';
        
        const startTime = Math.floor(scrollLeft / this.zoom);
        const endTime = Math.ceil((scrollLeft + width) / this.zoom);
        
        for (let t = startTime; t <= endTime; t++) {
            const x = t * this.zoom - scrollLeft;
            
            ctx.beginPath();
            ctx.moveTo(x, height - 10);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            const minutes = Math.floor(t / 60);
            const seconds = t % 60;
            const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            ctx.fillText(timeStr, x + 2, height - 12);
        }
    }
    
    // タイムライン操作
    handleTimelineMouseDown(e) {
        const rect = this.timelineCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        
        const x = (e.clientX - rect.left) + scrollContainer.scrollLeft;
        const y = e.clientY - rect.top;
        
        // プレイヘッド(くま)のクリック判定(上部40pxの範囲)
        const playheadX = this.currentTime * this.zoom;
        const bearSize = 36;
        const hitArea = 25; // 当たり判定を広く
        
        if (y < 40 && Math.abs(x - playheadX) < hitArea) {
            this.isSeekbarDragging = true;
            this.currentTime = x / this.zoom;
            this.updateTimeDisplay();
            this.updatePreview();
            this.drawTimeline();
            return;
        }
        
        // 右クリックの場合、キーフレーム削除をチェック
        if (e.button === 2) {
            const keyframe = this.getKeyframeAt(x, y);
            if (keyframe) {
                e.preventDefault();
                this.deleteKeyframe(keyframe.clip, keyframe.property, keyframe.index);
                return;
            }
            // 右クリックはコンテキストメニュー用なので、ここでreturnはしない
        }
        
        // 左クリックの場合、キーフレームドラッグをチェック
        if (e.button === 0) {
            const keyframe = this.getKeyframeAt(x, y);
            if (keyframe) {
                this.isDraggingKeyframe = true;
                this.draggingKeyframe = keyframe;
                this.dragStartX = x;
                return;
            }
        }
        
        // クリップ選択
        const clickedClip = this.getClipAt(x, y);
        
        if (clickedClip && e.button === 0) {
            // Shift+クリックで複数選択
            if (e.shiftKey && this.extensions) {
                this.extensions.toggleClipSelection(clickedClip);
                this.selectedClip = clickedClip; // プロパティパネル用
                this.updatePropertiesPanel();
                this.drawTimeline();
                return;
            }
            
            // 通常のクリック（単一選択）
            if (this.extensions) {
                this.extensions.clearSelection();
                this.extensions.selectedClips.add(clickedClip.id);
            }
            
            this.selectedClip = clickedClip;
            this.isDragging = true;
            this.isMovingClip = true; // クリップ移動中フラグ
            this.dragStartX = x;
            this.dragStartY = y;
            
            // 初期位置を保存
            this.initialClipPosition = {
                startTime: clickedClip.startTime,
                track: clickedClip.track
            };
            
            this.updatePropertiesPanel();
            this.drawTimeline();
            this.updatePreview(); // バウンディングボックスを更新
            
            // ブラウザのドラッグ&ドロップを無効化
            e.preventDefault();
            return;
        } else if (e.button === 0 && !e.shiftKey && this.extensions) {
            // 空白をクリックした場合、選択をクリア
            this.extensions.clearSelection();
            this.drawTimeline();
        }
        
        // プレイヘッド移動
        if (e.button === 0) {
            this.currentTime = x / this.zoom;
            this.updateTimeDisplay();
            this.updatePreview();
            this.drawTimeline();
        }
    }
    
    // 定規のマウスダウン - シークバードラッグ
    handleRulerMouseDown(e) {
        this.isSeekbarDragging = true;
        this.updateSeekbar(e);
    }
    
    // シークバーの更新
    updateSeekbar(e) {
        const rect = this.rulerCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        const x = e.clientX - rect.left + scrollContainer.scrollLeft;
        
        this.currentTime = Math.max(0, x / this.zoom);
        this.updateTimeDisplay();
        this.updatePreview();
        this.drawTimeline();
        this.updatePropertiesPanel();
    }
    
    handleTimelineMouseMove(e) {
        // シークバードラッグ中
        if (this.isSeekbarDragging) {
            this.updateSeekbar(e);
            return;
        }
        
        // キーフレームドラッグ中
        if (this.isDraggingKeyframe && this.draggingKeyframe) {
            const rect = this.timelineCanvas.getBoundingClientRect();
            const scrollContainer = document.getElementById('timelineScroll');
            const x = (e.clientX - rect.left) + scrollContainer.scrollLeft;
            
            const deltaX = x - this.dragStartX;
            const newTime = this.draggingKeyframe.keyframe.time + (deltaX / this.zoom);
            
            // クリップの範囲内に制限
            const clip = this.draggingKeyframe.clip;
            const maxTime = clip.duration;
            this.draggingKeyframe.keyframe.time = Math.max(0, Math.min(newTime, maxTime));
            
            // キーフレームを時刻順にソート
            clip.keyframes[this.draggingKeyframe.property].sort((a, b) => a.time - b.time);
            
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
            return;
        }
        
        // クリップドラッグ中
        if (!this.isDragging || !this.selectedClip || !this.initialClipPosition) return;
        
        const rect = this.timelineCanvas.getBoundingClientRect();
        const scrollContainer = document.getElementById('timelineScroll');
        
        const x = (e.clientX - rect.left) + scrollContainer.scrollLeft;
        const y = e.clientY - rect.top;
        
        // ドラッグ開始位置からの差分を計算
        const deltaX = x - this.dragStartX;
        const deltaY = y - this.dragStartY;
        
        // 初期位置からの差分で新しい位置を計算
        const newStartTime = this.initialClipPosition.startTime + (deltaX / this.zoom);
        const newTrack = this.initialClipPosition.track + Math.round(deltaY / this.trackHeight);
        
        // 新しい位置を設定（範囲制限あり）
        this.selectedClip.startTime = Math.max(0, newStartTime);
        this.selectedClip.track = Math.max(0, Math.min(newTrack, this.trackCount - 1));
        
        this.drawTimeline();
        this.updatePropertiesPanel();
    }
    
    handleTimelineMouseUp(e) {
        // console.log('=== mouseup ===');
        // console.log('isDragging:', this.isDragging);
        // console.log('isPreviewDragging:', this.isPreviewDragging);
        // console.log('クリップ数:', this.clips.length);
        
        // キーフレームドラッグ終了
        if (this.isDraggingKeyframe) {
            this.isDraggingKeyframe = false;
            this.draggingKeyframe = null;
            this.saveHistory();
            return;
        }
        
        // プレビューキャンバスでのドラッグ中は何もしない
        if (this.isPreviewDragging) {
            // console.log('プレビュードラッグ中なのでスキップ');
            return;
        }
        
        if (this.isDragging && this.isMovingClip && this.selectedClip) {
            // オートトリミング処理を実行
            this.autoTrimCollisions(this.selectedClip);
            this.saveHistory();
        }
        this.isDragging = false;
        this.isMovingClip = false; // フラグをリセット
        this.isSeekbarDragging = false; // シークバーフラグもリセット
        // console.log('ドラッグ終了');
    }
    
    getClipAt(x, y) {
        for (let clip of this.clips) {
            const clipX = clip.startTime * this.zoom;
            const clipY = clip.track * this.trackHeight;
            
            // offsetを考慮した実際の表示幅
            const visibleDuration = clip.duration - (clip.offset || 0);
            const clipWidth = visibleDuration * this.zoom;
            const clipHeight = this.trackHeight;
            
            if (x >= clipX && x <= clipX + clipWidth &&
                y >= clipY && y <= clipY + clipHeight) {
                return clip;
            }
        }
        return null;
    }
    
    getKeyframeAt(x, y) {
        const keyframeSize = 16;
        const hitArea = 12; // クリック判定を少し広げる
        
        for (let clip of this.clips) {
            const clipX = clip.startTime * this.zoom;
            const clipY = clip.track * this.trackHeight;
            const clipHeight = this.trackHeight;
            
            // クリップの範囲内か確認
            if (y < clipY || y > clipY + clipHeight) continue;
            
            // すべてのプロパティのキーフレームをチェック
            for (let property in clip.keyframes) {
                const keyframes = clip.keyframes[property];
                for (let i = 0; i < keyframes.length; i++) {
                    const kf = keyframes[i];
                    const kfX = clipX + (kf.time * this.zoom);
                    const kfY = clipY + clipHeight - keyframeSize - 2;
                    
                    // 当たり判定
                    if (Math.abs(x - kfX) < hitArea && 
                        y >= kfY && y <= kfY + keyframeSize) {
                        return {
                            clip: clip,
                            property: property,
                            index: i,
                            keyframe: kf
                        };
                    }
                }
            }
        }
        return null;
    }
    
    deleteKeyframe(clip, property, index) {
        if (confirm('このキーフレームを削除しますか?')) {
            clip.keyframes[property].splice(index, 1);
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
            this.saveHistory();
        }
    }
    
    // オートトリミング機能
    autoTrimCollisions(movedClip) {
        // 移動したクリップの範囲を計算
        const movedStart = movedClip.startTime;
        const movedEnd = movedClip.startTime + movedClip.duration - movedClip.offset;
        
        // 同じトラックの他のクリップをチェック
        for (let otherClip of this.clips) {
            // 自分自身はスキップ
            if (otherClip === movedClip) continue;
            
            // 別のトラックはスキップ
            if (otherClip.track !== movedClip.track) continue;
            
            // 他のクリップの範囲を計算
            const otherStart = otherClip.startTime;
            const otherEnd = otherClip.startTime + otherClip.duration - otherClip.offset;
            
            // パターン1: 移動クリップが左から押す（他のクリップの頭をトリミング）
            if (movedEnd > otherStart && movedEnd < otherEnd && movedStart < otherStart) {
                const overlap = movedEnd - otherStart;
                
                // 他のクリップの頭をカット
                otherClip.offset += overlap;
                otherClip.startTime = movedEnd;
                
                // 最小デュレーション確認
                const visibleDuration = otherClip.duration - otherClip.offset;
                if (visibleDuration < 0.1) {
                    otherClip.offset = otherClip.duration - 0.1;
                    otherClip.startTime = movedEnd;
                }
            }
            
            // パターン2: 移動クリップが右から押す（他のクリップの後ろをトリミング）
            else if (movedStart < otherEnd && movedStart > otherStart && movedEnd > otherEnd) {
                const overlap = otherEnd - movedStart;
                
                // 他のクリップの後ろをカット
                const visibleDuration = otherClip.duration - otherClip.offset;
                const newVisibleDuration = visibleDuration - overlap;
                
                // 最小デュレーション確認
                if (newVisibleDuration < 0.1) {
                    otherClip.duration = otherClip.offset + 0.1;
                } else {
                    otherClip.duration = otherClip.offset + newVisibleDuration;
                }
            }
            
            // パターン3: 移動クリップが完全に覆う（他のクリップを後方へ移動）
            else if (movedStart <= otherStart && movedEnd >= otherEnd) {
                // 他のクリップを後方へ移動
                otherClip.startTime = movedEnd;
                otherClip.offset = 0; // オフセットをリセット
            }
        }
        
        // タイムラインを再描画
        this.drawTimeline();
        this.updatePropertiesPanel();
    }
    
    // プロパティパネル
    // プロパティパネル
    updatePropertiesPanel() {
        const panel = document.getElementById('propertiesContent');
        
        if (!this.selectedClip) {
            panel.innerHTML = '<div class="empty-message">クリップを選択してください</div>';
            return;
        }
        
        const clip = this.selectedClip;
        const localTime = this.currentTime - clip.startTime;
        
        // 実際の表示時間を計算
        const visibleDuration = clip.duration - (clip.offset || 0);
        
        let propertiesHTML = `
            <div class="property-group">
                <div class="property-label">クリップ名</div>
                <div class="property-value">${clip.asset.name}</div>
            </div>
            
            <!-- 開始時間 -->
            <div class="property-group">
                <div class="property-label">開始時間: <input type="number" id="startTimeValue" value="${clip.startTime.toFixed(2)}" 
                    min="0" max="30" step="0.1" class="value-input"
                    oninput="app.updateClipProperty('startTime', parseFloat(this.value)); document.getElementById('startTimeSlider').value = this.value">秒</div>
                <input type="range" class="property-slider" id="startTimeSlider" value="${clip.startTime.toFixed(2)}" 
                    min="0" max="30" step="0.1"
                    oninput="app.updateClipProperty('startTime', parseFloat(this.value)); document.getElementById('startTimeValue').value = this.value">
            </div>
            
            <!-- 継続時間 -->
            <div class="property-group">
                <div class="property-label">継続時間: <input type="number" id="durationValue" value="${clip.duration.toFixed(2)}" 
                    min="0.1" max="30" step="0.1" class="value-input"
                    oninput="app.updateClipProperty('duration', parseFloat(this.value)); document.getElementById('durationSlider').value = this.value">秒</div>
                <input type="range" class="property-slider" id="durationSlider" value="${clip.duration.toFixed(2)}" 
                    min="0.1" max="30" step="0.1"
                    oninput="app.updateClipProperty('duration', parseFloat(this.value)); document.getElementById('durationValue').value = this.value">
            </div>
        `;
        
        // オフセット表示（トリミングされている場合）
        if (clip.offset && clip.offset > 0) {
            propertiesHTML += `
                <div class="property-group" style="background-color: rgba(255, 140, 0, 0.1); padding: 8px; border-radius: 4px;">
                    <div class="property-label">✂ オフセット: <span style="color: #FF8C00; font-weight: bold;">${clip.offset.toFixed(2)}秒</span></div>
                    <div class="property-label" style="font-size: 11px; color: #666;">表示時間: ${visibleDuration.toFixed(2)}秒</div>
                </div>
            `;
        }
        
        // 連番アニメーションの場合はフレームレート設定
        if (clip.asset.type === 'sequence') {
            propertiesHTML += `
                <div class="property-group">
                    <div class="property-label">フレームレート: <input type="number" id="frameRateValue" value="${clip.frameRate || 30}" 
                        min="1" max="120" step="1" class="value-input"
                        oninput="app.updateClipProperty('frameRate', parseInt(this.value)); document.getElementById('frameRateSlider').value = this.value"> fps</div>
                    <input type="range" class="property-slider" id="frameRateSlider" value="${clip.frameRate || 30}" 
                        min="1" max="120" step="1"
                        oninput="app.updateClipProperty('frameRate', parseInt(this.value)); document.getElementById('frameRateValue').value = this.value">
                </div>
            `;
        }
        
        // 生成オブジェクト（solid/gradient/stripe）の色設定
        if (clip.asset.type === 'solid' || clip.asset.type === 'gradient' || clip.asset.type === 'stripe') {
            propertiesHTML += `<div style="margin: 16px 0; padding: 12px; background: rgba(210, 105, 30, 0.1); border-radius: 8px;">`;
            
            if (clip.asset.type === 'solid') {
                propertiesHTML += `
                    <div class="property-group">
                        <div class="property-label">色</div>
                        <input type="color" value="${clip.asset.color}" onchange="app.updateGeneratedObjectColor('color', this.value)" style="width: 100%; height: 40px; border: none; cursor: pointer;">
                    </div>
                `;
            } else if (clip.asset.type === 'gradient') {
                propertiesHTML += `
                    <div class="property-group">
                        <div class="property-label">グラデーションタイプ</div>
                        <select onchange="app.updateGeneratedObjectProperty('gradientType', this.value)" style="width: 100%; padding: 8px;">
                            <option value="1" ${clip.asset.gradientType === '1' ? 'selected' : ''}>色→色</option>
                            <option value="2" ${clip.asset.gradientType === '2' ? 'selected' : ''}>色→透明</option>
                        </select>
                    </div>
                    <div class="property-group">
                        <div class="property-label">開始色</div>
                        <input type="color" value="${clip.asset.color1}" onchange="app.updateGeneratedObjectColor('color1', this.value)" style="width: 100%; height: 40px; border: none; cursor: pointer;">
                    </div>
                    <div class="property-group" id="gradientColor2Group" style="${clip.asset.gradientType === '2' ? 'display:none' : ''}">
                        <div class="property-label">終了色</div>
                        <input type="color" value="${clip.asset.color2}" onchange="app.updateGeneratedObjectColor('color2', this.value)" style="width: 100%; height: 40px; border: none; cursor: pointer;">
                    </div>
                    <div class="property-group">
                        <div class="property-label">方向</div>
                        <select onchange="app.updateGeneratedObjectProperty('direction', this.value)" style="width: 100%; padding: 8px;">
                            <option value="1" ${clip.asset.direction === '1' ? 'selected' : ''}>上→下</option>
                            <option value="2" ${clip.asset.direction === '2' ? 'selected' : ''}>左→右</option>
                            <option value="3" ${clip.asset.direction === '3' ? 'selected' : ''}>斜め</option>
                        </select>
                    </div>
                `;
            } else if (clip.asset.type === 'stripe') {
                propertiesHTML += `
                    <div class="property-group">
                        <div class="property-label">ストライプタイプ</div>
                        <select onchange="app.updateGeneratedObjectProperty('stripeType', this.value)" style="width: 100%; padding: 8px;">
                            <option value="1" ${clip.asset.stripeType === '1' ? 'selected' : ''}>色+色</option>
                            <option value="2" ${clip.asset.stripeType === '2' ? 'selected' : ''}>色+透明</option>
                        </select>
                    </div>
                    <div class="property-group">
                        <div class="property-label">色1</div>
                        <input type="color" value="${clip.asset.color1}" onchange="app.updateGeneratedObjectColor('color1', this.value)" style="width: 100%; height: 40px; border: none; cursor: pointer;">
                    </div>
                    <div class="property-group" id="stripeColor2Group" style="${clip.asset.stripeType === '2' ? 'display:none' : ''}">
                        <div class="property-label">色2</div>
                        <input type="color" value="${clip.asset.color2}" onchange="app.updateGeneratedObjectColor('color2', this.value)" style="width: 100%; height: 40px; border: none; cursor: pointer;">
                    </div>
                    <div class="property-group">
                        <div class="property-label">太さ: <span id="stripeWidthValue">${clip.asset.stripeWidth}px</span></div>
                        <input type="range" class="property-slider" value="${clip.asset.stripeWidth}" 
                            min="5" max="200" step="5"
                            oninput="document.getElementById('stripeWidthValue').textContent = this.value + 'px'"
                            onchange="app.updateGeneratedObjectProperty('stripeWidth', parseInt(this.value))">
                    </div>
                    <div class="property-group">
                        <div class="property-label">方向</div>
                        <select onchange="app.updateGeneratedObjectProperty('direction', this.value)" style="width: 100%; padding: 8px;">
                            <option value="1" ${clip.asset.direction === '1' ? 'selected' : ''}>横</option>
                            <option value="2" ${clip.asset.direction === '2' ? 'selected' : ''}>縦</option>
                        </select>
                    </div>
                `;
            }
            
            propertiesHTML += `</div>`;
        }
        
        // 映像クリップと生成オブジェクトの場合
        if (clip.asset.type === 'image' || clip.asset.type === 'video' || clip.asset.type === 'sequence' || 
            clip.asset.type === 'solid' || clip.asset.type === 'gradient' || clip.asset.type === 'stripe') {
            
            const currentX = this.getKeyframeValue(clip, 'x', localTime);
            const currentY = this.getKeyframeValue(clip, 'y', localTime);
            const currentRotation = this.getKeyframeValue(clip, 'rotation', localTime);
            const currentOpacity = this.getKeyframeValue(clip, 'opacity', localTime);
            const currentScale = this.getKeyframeValue(clip, 'scale', localTime);
            
            // ===== ブレンドモード（ドロップダウンのみ、常に表示） =====
            propertiesHTML += `
                <div class="property-group">
                    <div class="property-label">🎨 ブレンドモード</div>
                    <select id="blendModeSelect" class="property-slider" style="width: 100%; padding: 8px; background: var(--chocolate-main); color: var(--biscuit-light); border: 1px solid var(--chocolate-dark); border-radius: 4px;" onchange="app.setBlendMode(this.value)">
                        <optgroup label="通常">
                            <option value="normal" ${clip.blendMode === 'normal' ? 'selected' : ''}>通常</option>
                        </optgroup>
                        <optgroup label="暗くする系">
                            <option value="multiply" ${clip.blendMode === 'multiply' ? 'selected' : ''}>乗算</option>
                            <option value="darken" ${clip.blendMode === 'darken' ? 'selected' : ''}>比較(暗)</option>
                            <option value="color-burn" ${clip.blendMode === 'color-burn' ? 'selected' : ''}>焼き込みカラー</option>
                        </optgroup>
                        <optgroup label="明るくする系">
                            <option value="screen" ${clip.blendMode === 'screen' ? 'selected' : ''}>スクリーン</option>
                            <option value="lighten" ${clip.blendMode === 'lighten' ? 'selected' : ''}>比較(明)</option>
                            <option value="color-dodge" ${clip.blendMode === 'color-dodge' ? 'selected' : ''}>覆い焼きカラー</option>
                            <option value="lighter" ${clip.blendMode === 'lighter' ? 'selected' : ''}>加算</option>
                        </optgroup>
                        <optgroup label="コントラスト">
                            <option value="overlay" ${clip.blendMode === 'overlay' ? 'selected' : ''}>オーバーレイ</option>
                            <option value="soft-light" ${clip.blendMode === 'soft-light' ? 'selected' : ''}>ソフトライト</option>
                            <option value="hard-light" ${clip.blendMode === 'hard-light' ? 'selected' : ''}>ハードライト</option>
                        </optgroup>
                        <optgroup label="比較">
                            <option value="difference" ${clip.blendMode === 'difference' ? 'selected' : ''}>差の絶対値</option>
                            <option value="exclusion" ${clip.blendMode === 'exclusion' ? 'selected' : ''}>除外</option>
                        </optgroup>
                        <optgroup label="色調整">
                            <option value="hue" ${clip.blendMode === 'hue' ? 'selected' : ''}>色相</option>
                            <option value="saturation" ${clip.blendMode === 'saturation' ? 'selected' : ''}>彩度</option>
                            <option value="color" ${clip.blendMode === 'color' ? 'selected' : ''}>カラー</option>
                            <option value="luminosity" ${clip.blendMode === 'luminosity' ? 'selected' : ''}>輝度</option>
                        </optgroup>
                    </select>
                </div>
            `;
            
            // ===== トランスフォーム（常に表示） =====
            propertiesHTML += `
                <div style="margin: 16px 0; padding: 12px; background: rgba(210, 105, 30, 0.15); border-radius: 8px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--biscuit-light);">📐 トランスフォーム</h3>
                    
                    <!-- 位置 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('position')">
                            <span class="ae-property-icon" id="positionIcon">▶</span>
                            <span class="ae-property-name">📍 位置</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'x', localTime) || this.hasKeyframeAt(clip, 'y', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('x'); app.toggleKeyframe('y')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="positionContent">
                            <div class="ae-subproperty">
                                <label>X: <span id="xValue">${currentX.toFixed(0)}</span>px</label>
                                <input type="range" class="property-slider" value="${currentX.toFixed(0)}"
                                    min="-960" max="960" step="1"
                                    oninput="document.getElementById('xValue').textContent = this.value; app.setKeyframeValueLive('x', parseFloat(this.value))"
                                    onchange="app.setKeyframeValue('x', parseFloat(this.value))">
                            </div>
                            <div class="ae-subproperty">
                                <label>Y: <span id="yValue">${currentY.toFixed(0)}</span>px</label>
                                <input type="range" class="property-slider" value="${currentY.toFixed(0)}"
                                    min="-540" max="540" step="1"
                                    oninput="document.getElementById('yValue').textContent = this.value; app.setKeyframeValueLive('y', parseFloat(this.value))"
                                    onchange="app.setKeyframeValue('y', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- スケール -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('scale')">
                            <span class="ae-property-icon" id="scaleIcon">▶</span>
                            <span class="ae-property-name">🔍 スケール</span>
                            <span class="ae-property-value">${(currentScale * 100).toFixed(0)}%</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'scale', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('scale')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="scaleContent">
                            <div class="ae-subproperty">
                                <input type="range" class="property-slider" value="${(currentScale * 100).toFixed(0)}" 
                                    min="10" max="300" step="1" id="scaleSlider"
                                    oninput="document.querySelector('#scaleContent').parentElement.querySelector('.ae-property-value').textContent = this.value + '%'; app.setKeyframeValueLive('scale', parseFloat(this.value) / 100)"
                                    onchange="app.setKeyframeValue('scale', parseFloat(this.value) / 100)">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 回転 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('rotation')">
                            <span class="ae-property-icon" id="rotationIcon">▶</span>
                            <span class="ae-property-name">🔄 回転</span>
                            <span class="ae-property-value">${currentRotation.toFixed(0)}°</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'rotation', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('rotation')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="rotationContent">
                            <div class="ae-subproperty">
                                <input type="range" class="property-slider" value="${currentRotation.toFixed(0)}" 
                                    min="-180" max="180" step="1" id="rotationSlider"
                                    oninput="document.querySelector('#rotationContent').parentElement.querySelector('.ae-property-value').textContent = this.value + '°'; app.setKeyframeValueLive('rotation', parseFloat(this.value))"
                                    onchange="app.setKeyframeValue('rotation', parseFloat(this.value))">
                            </div>
                        </div>
                    </div>
                    
                    <!-- 不透明度 -->
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('opacity')">
                            <span class="ae-property-icon" id="opacityIcon">▶</span>
                            <span class="ae-property-name">👁️ 不透明度</span>
                            <span class="ae-property-value">${(currentOpacity * 100).toFixed(0)}%</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'opacity', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('opacity')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="opacityContent">
                            <div class="ae-subproperty">
                                <input type="range" class="property-slider" value="${(currentOpacity * 100).toFixed(0)}" 
                                    min="0" max="100" step="1" id="opacitySlider"
                                    oninput="document.querySelector('#opacityContent').parentElement.querySelector('.ae-property-value').textContent = this.value + '%'; app.setKeyframeValueLive('opacity', parseFloat(this.value) / 100)"
                                    onchange="app.setKeyframeValue('opacity', parseFloat(this.value) / 100)">
                            </div>
                        </div>
                    </div>
                    
                    <!-- アンカーポイント -->
                    <div class="property-group" style="margin-top: 8px;">
                        <div class="property-label">⚓ アンカーポイント</div>
                        <div style="display: flex; gap: 8px;">
                            <div style="flex: 1;">
                                <label style="font-size: 11px;">X: <span id="anchorXValue">${((clip.anchorPoint?.x || 0.5) * 100).toFixed(0)}%</span></label>
                                <input type="range" class="property-slider" value="${(clip.anchorPoint?.x || 0.5) * 100}" 
                                    min="0" max="100" step="1"
                                    oninput="document.getElementById('anchorXValue').textContent = this.value + '%'; app.setAnchorPointLive('x', parseFloat(this.value) / 100)"
                                    onchange="app.setAnchorPoint('x', parseFloat(this.value) / 100)">
                            </div>
                            <div style="flex: 1;">
                                <label style="font-size: 11px;">Y: <span id="anchorYValue">${((clip.anchorPoint?.y || 0.5) * 100).toFixed(0)}%</span></label>
                                <input type="range" class="property-slider" value="${(clip.anchorPoint?.y || 0.5) * 100}" 
                                    min="0" max="100" step="1"
                                    oninput="document.getElementById('anchorYValue').textContent = this.value + '%'; app.setAnchorPointLive('y', parseFloat(this.value) / 100)"
                                    onchange="app.setAnchorPoint('y', parseFloat(this.value) / 100)">
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // ===== クリッピング（常に表示） =====
            let clipSourceName = 'なし';
            if (clip.clipSource) {
                const clipSourceClip = this.clips.find(c => c.id == clip.clipSource);
                if (clipSourceClip && clipSourceClip.asset) {
                    clipSourceName = clipSourceClip.asset.name;
                }
            }
            
            propertiesHTML += `
                <div style="margin: 16px 0; padding: 12px; background: rgba(210, 105, 30, 0.15); border-radius: 8px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--biscuit-light);">✂️ クリッピング</h3>
                    <div class="property-group">
                        <div class="property-label" style="font-size: 12px; color: ${clip.clipSource ? '#FFD700' : '#999'};">
                            現在: ${clipSourceName}
                        </div>
                        <select id="clipSourceSelect" class="property-slider" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--chocolate-main); color: var(--biscuit-light); border: 1px solid var(--chocolate-dark); border-radius: 4px;">
                            <option value="">なし</option>
                        </select>
                        <div style="display: flex; gap: 8px;">
                            <button class="small-button" onclick="app.clippingManager.setClipSource()" style="flex: 1; padding: 8px; background: var(--accent-orange); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                ✂️ 設定
                            </button>
                            <button class="small-button" onclick="app.clippingManager.removeClipSource()" style="flex: 1; padding: 8px; background: var(--chocolate-dark); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                ❌ 解除
                            </button>
                        </div>
                        <div style="background: rgba(210, 105, 30, 0.2); padding: 8px; margin-top: 8px; border-radius: 4px; font-size: 10px; line-height: 1.4; color: var(--biscuit-light);">
                            💡 クリップソースの不透明部分だけに表示されます
                        </div>
                    </div>
                </div>
            `;
            
            // ===== 親子関係（常に表示） =====
            let parentClipName = 'なし';
            if (clip.parentId) {
                const parentClip = this.clips.find(c => c.id === clip.parentId);
                if (parentClip) {
                    parentClipName = parentClip.asset.name;
                }
            }
            
            propertiesHTML += `
                <div style="margin: 16px 0; padding: 12px; background: rgba(210, 105, 30, 0.15); border-radius: 8px;">
                    <h3 style="margin: 0 0 8px 0; font-size: 14px; color: var(--biscuit-light);">🔗 親子関係</h3>
                    <div class="property-group">
                        <div class="property-label" style="font-size: 12px; color: ${clip.parentId ? '#FFD700' : '#999'};">
                            現在: ${parentClipName}
                        </div>
                        <select id="parentClipSelect" class="property-slider" style="width: 100%; padding: 8px; margin-bottom: 8px; background: var(--chocolate-main); color: var(--biscuit-light); border: 1px solid var(--chocolate-dark); border-radius: 4px;">
                            <option value="">なし (独立)</option>
                        </select>
                        <div style="display: flex; gap: 8px;">
                            <button class="small-button" onclick="app.setParentClip()" style="flex: 1; padding: 8px; background: var(--accent-orange); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                🔗 設定
                            </button>
                            <button class="small-button" onclick="app.removeParentClip()" style="flex: 1; padding: 8px; background: var(--chocolate-dark); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
                                ✂️ 解除
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // 音声クリップの場合
        if (clip.asset.type === 'audio') {
            const currentVolume = clip.volume || 1.0;
            const currentPan = this.getKeyframeValue(clip, 'pan', localTime);
            
            propertiesHTML += `
                <div style="margin: 16px 0; padding: 12px; background: rgba(210, 105, 30, 0.15); border-radius: 8px;">
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; color: var(--biscuit-light);">🔊 オーディオ</h3>
                    
                    <div class="property-group">
                        <div class="property-label">🔊 音量: <span id="volumeValue">${(currentVolume * 100).toFixed(0)}%</span></div>
                        <input type="range" class="property-slider" value="${(currentVolume * 100).toFixed(0)}" 
                            min="0" max="200" step="1"
                            oninput="document.getElementById('volumeValue').textContent = this.value + '%'; app.updateClipProperty('volume', parseFloat(this.value) / 100)"
                            onchange="app.updateClipProperty('volume', parseFloat(this.value) / 100)">
                    </div>
                    
                    <div class="ae-property-group">
                        <div class="ae-property-header" onclick="app.toggleAEProperty('pan')">
                            <span class="ae-property-icon" id="panIcon">▶</span>
                            <span class="ae-property-name">🎚️ パン</span>
                            <span class="ae-property-value">${(currentPan * 100).toFixed(0)}</span>
                            <button class="ae-keyframe-indicator ${this.hasKeyframeAt(clip, 'pan', localTime) ? 'active' : ''}" 
                                onclick="event.stopPropagation(); app.toggleKeyframe('pan')">💎</button>
                        </div>
                        <div class="ae-property-content collapsed" id="panContent">
                            <div class="ae-subproperty">
                                <label style="font-size: 11px;">左 ← <span id="panValue">${(currentPan * 100).toFixed(0)}</span> → 右</label>
                                <input type="range" class="property-slider" value="${(currentPan * 100).toFixed(0)}" 
                                    min="-100" max="100" step="1"
                                    oninput="document.getElementById('panValue').textContent = this.value; document.querySelector('#panContent').parentElement.querySelector('.ae-property-value').textContent = this.value; app.setKeyframeValueLive('pan', parseFloat(this.value) / 100)"
                                    onchange="app.setKeyframeValue('pan', parseFloat(this.value) / 100)">
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        panel.innerHTML = propertiesHTML;
        
        // 親子関係UIの更新（選択肢を追加）
        if (this.selectedClip && (this.selectedClip.asset.type === 'image' || this.selectedClip.asset.type === 'video' || 
            this.selectedClip.asset.type === 'sequence' || this.selectedClip.asset.type === 'solid' || 
            this.selectedClip.asset.type === 'gradient' || this.selectedClip.asset.type === 'stripe')) {
            this.updateParentingUI();
            this.clippingManager.updateClipSourceSelect(this.selectedClip);
        }
    }
    
    // 風揺れUIの更新
    updateWindShakeUI() {
        const clipPanel = document.getElementById('clipPropertiesPanel');
        
        if (!this.selectedClip) {
            if (clipPanel) clipPanel.style.display = 'none';
            return;
        }
        
        if (clipPanel) clipPanel.style.display = 'block';
        
        if (!this.selectedClip.windShake) return;
        
        const ws = this.selectedClip.windShake;
        
        document.getElementById('windShakeEnabled').checked = ws.enabled || false;
        document.getElementById('windShakeDivisions').value = ws.divisions || 10;
        document.getElementById('windShakeDivisionsValue').textContent = ws.divisions || 10;
        document.getElementById('windShakeAngle').value = ws.angle || 30;
        document.getElementById('windShakeAngleValue').textContent = ws.angle || 30;
        document.getElementById('windShakePeriod').value = ws.period || 2.0;
        const period = ws.period || 2.0;
        document.getElementById('windShakePeriodValue').textContent = period.toFixed(2);
        
        // ループ情報を更新
        const loopTimes = [period, period * 2, period * 3, period * 4, period * 5].map(t => t.toFixed(2));
        document.getElementById('windShakeLoopInfo').textContent = 
            `周期 ${period.toFixed(2)}秒 → ${loopTimes.join('秒, ')}秒でループ`;
        
        document.getElementById('windShakePhaseShift').value = ws.phaseShift || 90;
        document.getElementById('windShakePhaseShiftValue').textContent = ws.phaseShift || 90;
        document.getElementById('windShakeCenter').value = ws.center || 0;
        document.getElementById('windShakeCenterValue').textContent = ws.center || 0;
        document.getElementById('windShakeTopFixed').value = ws.topFixed || 10;
        document.getElementById('windShakeTopFixedValue').textContent = ws.topFixed || 10;
        document.getElementById('windShakeBottomFixed').value = ws.bottomFixed || 10;
        document.getElementById('windShakeBottomFixedValue').textContent = ws.bottomFixed || 10;
        document.getElementById('windShakeFromBottom').checked = ws.fromBottom || false;
        document.getElementById('windShakeRandomSwing').checked = ws.randomSwing || false;
        document.getElementById('windShakeRandomPattern').value = ws.randomPattern || 0;
        document.getElementById('windShakeRandomPatternValue').textContent = ws.randomPattern || 0;
        document.getElementById('windShakeHorizontalRepeat').checked = ws.horizontalRepeat || false;
        document.getElementById('windShakeRepeatCount').value = ws.repeatCount || 3;
        document.getElementById('windShakeRepeatCountValue').textContent = ws.repeatCount || 3;
        document.getElementById('windShakeSpacing').value = ws.spacing || 50;
        document.getElementById('windShakeSpacingValue').textContent = ws.spacing || 50;
        document.getElementById('windShakeTimeShift').value = ws.timeShift || 0.1;
        document.getElementById('windShakeTimeShiftValue').textContent = (ws.timeShift || 0.1).toFixed(2);
        document.getElementById('windShakeAlphaCorrection').checked = ws.alphaCorrection !== false;
        document.getElementById('windShakeAntiAliasing').checked = ws.antiAliasing !== false;
        
        // 軸モードの更新
        document.getElementById('windShakeAxisMode').checked = ws.axisMode || false;
        document.getElementById('windShakeAxisPosition').value = ws.axisPosition || 50;
        document.getElementById('windShakeAxisPositionValue').textContent = (ws.axisPosition || 50).toFixed(0);
        document.getElementById('windShakeAxisStrength').value = ws.axisStrength || 50;
        document.getElementById('windShakeAxisStrengthValue').textContent = ws.axisStrength || 50;
        document.getElementById('windShakeAxisRange').value = ws.axisRange || 30;
        document.getElementById('windShakeAxisRangeValue').textContent = ws.axisRange || 30;
        
        // UIの有効/無効を設定
        const axisEnabled = ws.axisMode || false;
        document.getElementById('windShakePickAxisBtn').disabled = !axisEnabled;
        document.getElementById('windShakeAxisPosition').disabled = !axisEnabled;
        document.getElementById('windShakeAxisStrength').disabled = !axisEnabled;
        document.getElementById('windShakeAxisRange').disabled = !axisEnabled;
        
        // ブラーエフェクトの更新
        if (this.selectedClip.gaussianBlur) {
            const gb = this.selectedClip.gaussianBlur;
            document.getElementById('gaussianBlurEnabled').checked = gb.enabled || false;
            document.getElementById('gaussianBlurStrength').value = gb.strength || 10;
            document.getElementById('gaussianBlurStrengthValue').textContent = gb.strength || 10;
            document.getElementById('gaussianBlurHorizontalOnly').checked = gb.horizontalOnly || false;
            document.getElementById('gaussianBlurVerticalOnly').checked = gb.verticalOnly || false;
        }
        
        if (this.selectedClip.lensBlur) {
            const lb = this.selectedClip.lensBlur;
            document.getElementById('lensBlurEnabled').checked = lb.enabled || false;
            document.getElementById('lensBlurFocusPosition').value = lb.focusPosition || 50;
            document.getElementById('lensBlurFocusPositionValue').textContent = (lb.focusPosition || 50).toFixed(0);
            document.getElementById('lensBlurFocusRange').value = lb.focusRange || 20;
            document.getElementById('lensBlurFocusRangeValue').textContent = lb.focusRange || 20;
            document.getElementById('lensBlurStrength').value = lb.strength || 30;
            document.getElementById('lensBlurStrengthValue').textContent = lb.strength || 30;
            document.getElementById('lensBlurInvert').checked = lb.invert || false;
        }
        
        // 親子関係UIを更新
        this.updateParentingUI();
        
        // クリッピングUIを更新
        this.updateClippingUI();
    }
    
    // クリップエフェクトの折りたたみ
    toggleClipEffect(effectName) {
        const controls = document.getElementById(effectName + 'Controls');
        if (controls) {
            controls.style.display = controls.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // 親子関係UIの更新
    updateParentingUI() {
        if (!this.selectedClip) return;
        
        const parentClipSelect = document.getElementById('parentClipSelect');
        if (!parentClipSelect) return;
        
        // 親クリップの選択肢を更新
        parentClipSelect.innerHTML = '<option value="">なし (独立)</option>';
        
        this.clips.forEach(clip => {
            // 自分自身と、自分の子孫は親に設定できない
            if (clip.id === this.selectedClip.id || this.isDescendantOf(this.selectedClip.id, clip.id)) {
                return;
            }
            
            const option = document.createElement('option');
            option.value = clip.id;
            option.textContent = `${clip.asset.name} (Track ${clip.track + 1})`;
            
            if (this.selectedClip.parentId === clip.id) {
                option.selected = true;
            }
            
            parentClipSelect.appendChild(option);
        });
    }
    
    // クリッピングUIの更新
    updateClippingUI() {
        if (!this.selectedClip) return;
        
        const clipSourceSelect = document.getElementById('clipSourceSelect');
        if (!clipSourceSelect) return;
        
        // クリップソースの選択肢を更新
        clipSourceSelect.innerHTML = '<option value="">なし</option>';
        
        this.clips.forEach(clip => {
            // 自分自身と、自分より上または同じトラックは除外（下のトラックのみ選択可能）
            if (clip.id === this.selectedClip.id) {
                return;
            }
            if (clip.track >= this.selectedClip.track) {
                return;
            }
            
            const option = document.createElement('option');
            option.value = clip.id;
            option.textContent = `${clip.asset.name} (Track ${clip.track + 1})`;
            
            if (this.selectedClip.clipSource == clip.id) {
                option.selected = true;
            }
            
            clipSourceSelect.appendChild(option);
        });
    }
    
    // 親クリップを設定
    setParentClip() {
        if (!this.selectedClip) return;
        
        const parentClipSelect = document.getElementById('parentClipSelect');
        const selectedParentId = parentClipSelect.value;
        
        // 古い親から子を削除
        if (this.selectedClip.parentId) {
            const oldParent = this.clips.find(c => c.id === this.selectedClip.parentId);
            if (oldParent && oldParent.childrenIds) {
                oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== this.selectedClip.id);
            }
        }
        
        // 新しい親を設定
        if (selectedParentId) {
            const parentClip = this.clips.find(c => c.id === Number(selectedParentId));
            if (parentClip) {
                this.selectedClip.parentId = parentClip.id;
                
                // 親の子リストに追加
                if (!parentClip.childrenIds) {
                    parentClip.childrenIds = [];
                }
                if (!parentClip.childrenIds.includes(this.selectedClip.id)) {
                    parentClip.childrenIds.push(this.selectedClip.id);
                }
            }
        } else {
            this.selectedClip.parentId = null;
        }
        
        this.updatePropertiesPanel();
        this.updatePreview();
        this.drawTimeline();
        this.saveHistory();
    }
    
    // 親子関係を解除
    removeParentClip() {
        if (!this.selectedClip) return;
        
        // 親から子を削除
        if (this.selectedClip.parentId) {
            const parent = this.clips.find(c => c.id === this.selectedClip.parentId);
            if (parent && parent.childrenIds) {
                parent.childrenIds = parent.childrenIds.filter(id => id !== this.selectedClip.id);
            }
            this.selectedClip.parentId = null;
        }
        
        // 全ての子の親を解除
        if (this.selectedClip.childrenIds) {
            this.selectedClip.childrenIds.forEach(childId => {
                const child = this.clips.find(c => c.id === childId);
                if (child) {
                    child.parentId = null;
                }
            });
            this.selectedClip.childrenIds = [];
        }
        
        this.updatePropertiesPanel();
        this.updatePreview();
        this.drawTimeline();
        this.saveHistory();
    }
    
    // ブレンドモードの表示名を取得
    getBlendModeDisplayName(mode) {
        const modeNames = {
            'normal': '通常',
            'multiply': '乗算',
            'screen': 'スクリーン',
            'overlay': 'オーバーレイ',
            'darken': '比較(暗)',
            'lighten': '比較(明)',
            'color-dodge': '覆い焼きカラー',
            'color-burn': '焼き込みカラー',
            'hard-light': 'ハードライト',
            'soft-light': 'ソフトライト',
            'difference': '差の絶対値',
            'exclusion': '除外',
            'hue': '色相',
            'saturation': '彩度',
            'color': 'カラー',
            'luminosity': '輝度',
            'lighter': '加算'
        };
        return modeNames[mode] || mode;
    }
    
    // ブレンドモードを設定
    setBlendMode(mode) {
        if (!this.selectedClip) return;
        
        this.selectedClip.blendMode = mode;
        this.updatePropertiesPanel();
        this.updatePreview();
        this.saveHistory('ブレンドモード変更');
    }
    
    // clipBがclipAの子孫かどうかを判定
    isDescendantOf(clipAId, clipBId) {
        const clipB = this.clips.find(c => c.id === clipBId);
        if (!clipB || !clipB.childrenIds) return false;
        
        for (const childId of clipB.childrenIds) {
            if (childId === clipAId) return true;
            if (this.isDescendantOf(clipAId, childId)) return true;
        }
        
        return false;
    }
    
    // 親のトランスフォームを取得（再帰的に計算）
    getParentTransform(clip, localTime) {
        if (!clip.parentId) {
            return {
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1
            };
        }
        
        const parent = this.clips.find(c => c.id === clip.parentId);
        if (!parent) {
            return {
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1
            };
        }
        
        // 親のローカル時間を計算
        const parentLocalTime = localTime + clip.startTime - parent.startTime;
        
        // 親のトランスフォームを取得
        const parentX = this.getKeyframeValue(parent, 'x', parentLocalTime);
        const parentY = this.getKeyframeValue(parent, 'y', parentLocalTime);
        const parentRotation = this.getKeyframeValue(parent, 'rotation', parentLocalTime);
        const parentScale = this.getKeyframeValue(parent, 'scale', parentLocalTime);
        
        // 親の親のトランスフォームを再帰的に取得
        const grandParentTransform = this.getParentTransform(parent, parentLocalTime);
        
        // 累積的なトランスフォームを計算
        const radians = (grandParentTransform.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        
        return {
            x: grandParentTransform.x + (parentX * cos - parentY * sin) * grandParentTransform.scale,
            y: grandParentTransform.y + (parentX * sin + parentY * cos) * grandParentTransform.scale,
            rotation: grandParentTransform.rotation + parentRotation,
            scale: grandParentTransform.scale * parentScale
        };
    }
    
    // トランジション更新
    updateTransition(direction, property, value) {
        if (!this.selectedClip) return;
        
        if (direction === 'in') {
            this.selectedClip.transitionIn[property] = value;
        } else {
            this.selectedClip.transitionOut[property] = value;
        }
        
        this.drawTimeline();
        this.updatePreview();
        this.saveHistory();
    }
    
    // プロパティセクションの折りたたみ
    togglePropertySection(header) {
        const content = header.nextElementSibling;
        const icon = header.querySelector('.section-toggle-icon');
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            icon.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            icon.textContent = '▶';
        }
    }
    
    updateClipProperty(property, value) {
        if (!this.selectedClip) return;
        
        // 開始時間を変更した場合、offsetを調整（継続時間は変えない）
        if (property === 'startTime') {
            const oldStartTime = this.selectedClip.startTime;
            const newStartTime = value;
            const timeDiff = newStartTime - oldStartTime;
            
            // 開始時間が増えた場合（右に移動）
            if (timeDiff > 0) {
                // offsetを増やして左側をトリミング（継続時間はそのまま）
                const currentOffset = this.selectedClip.offset || 0;
                this.selectedClip.offset = currentOffset + timeDiff;
                
                // offsetが元の長さを超えないようにする
                const maxOffset = (this.selectedClip.originalDuration || this.selectedClip.duration) - 0.1;
                if (this.selectedClip.offset > maxOffset) {
                    this.selectedClip.offset = maxOffset;
                }
            }
            // 開始時間が減った場合（左に移動）
            else if (timeDiff < 0) {
                const currentOffset = this.selectedClip.offset || 0;
                
                // offsetを減らす
                this.selectedClip.offset = Math.max(0, currentOffset + timeDiff);
            }
            
            this.selectedClip[property] = value;
        }
        // ループ回数を変更した場合、元の長さを保存
        else if (property === 'loopCount') {
            // 初回の場合、現在の長さを元の長さとして保存
            if (!this.selectedClip.originalDuration) {
                this.selectedClip.originalDuration = this.selectedClip.duration;
            }
            
            this.selectedClip[property] = value;
            // クリップの長さをループ回数に合わせて変更
            this.selectedClip.duration = this.selectedClip.originalDuration * value;
            
            console.log('ループ回数変更:', value);
            console.log('元の長さ:', this.selectedClip.originalDuration);
            console.log('新しい長さ:', this.selectedClip.duration);
        }
        // 継続時間を変更した場合、音声・動画クリップはループ有効化
        else if (property === 'duration') {
            this.selectedClip[property] = value;
            
            // 音声または動画クリップで、継続時間が元の長さを超えた場合はループ有効化
            if ((this.selectedClip.asset.type === 'audio' || this.selectedClip.asset.type === 'video')) {
                const originalDuration = this.selectedClip.originalDuration || value;
                if (value > originalDuration) {
                    this.selectedClip.loopEnabled = true;
                    console.log('🔁 ループ有効化: 継続時間', value, '> 元の長さ', originalDuration);
                }
            }
        }
        else {
            this.selectedClip[property] = value;
        }
        
        // 音量を変更した場合、gainNodeに反映
        if (property === 'volume' && this.selectedClip.gainNode) {
            this.selectedClip.gainNode.gain.value = value;
            console.log('🔊 Volume updated:', value, 'Node exists:', !!this.selectedClip.gainNode);
            
            // テスト再生（スライダー操作中のみ）
            this.testPlayAudio(this.selectedClip);
        }
        
        this.drawTimeline();
        this.updatePreview();
        this.saveHistory();
    }
    
    // 生成オブジェクトの色を更新
    updateGeneratedObjectColor(property, value) {
        if (!this.selectedClip) return;
        const asset = this.selectedClip.asset;
        
        asset[property] = value;
        
        // キャンバスを再生成
        if (asset.type === 'solid') {
            asset.element = this.createSolidColorCanvas(asset.color);
        } else if (asset.type === 'gradient') {
            const color2 = asset.gradientType === '2' ? 'transparent' : asset.color2;
            asset.element = this.createGradientCanvas(asset.color1, color2, asset.direction);
        } else if (asset.type === 'stripe') {
            const color2 = asset.stripeType === '2' ? 'transparent' : asset.color2;
            asset.element = this.createStripeCanvas(asset.color1, color2, asset.stripeWidth, asset.direction);
        }
        
        this.updatePreview();
        this.saveHistory();
    }
    
    // 生成オブジェクトのプロパティを更新
    updateGeneratedObjectProperty(property, value) {
        if (!this.selectedClip) return;
        const asset = this.selectedClip.asset;
        
        asset[property] = value;
        
        // タイプ変更時のUI更新
        if (property === 'gradientType') {
            const color2Group = document.getElementById('gradientColor2Group');
            if (color2Group) {
                color2Group.style.display = value === '2' ? 'none' : 'block';
            }
        } else if (property === 'stripeType') {
            const color2Group = document.getElementById('stripeColor2Group');
            if (color2Group) {
                color2Group.style.display = value === '2' ? 'none' : 'block';
            }
        }
        
        // キャンバスを再生成
        if (asset.type === 'gradient') {
            const color2 = asset.gradientType === '2' ? 'transparent' : asset.color2;
            asset.element = this.createGradientCanvas(asset.color1, color2, asset.direction);
        } else if (asset.type === 'stripe') {
            const color2 = asset.stripeType === '2' ? 'transparent' : asset.color2;
            asset.element = this.createStripeCanvas(asset.color1, color2, asset.stripeWidth, asset.direction);
        }
        
        this.updatePreview();
        this.saveHistory();
    }
    
    // キーフレーム管理
    getKeyframeValue(clip, property, localTime) {
        const keyframes = clip.keyframes[property];
        if (!keyframes || keyframes.length === 0) return 0;
        
        if (localTime <= keyframes[0].time) return keyframes[0].value;
        if (localTime >= keyframes[keyframes.length - 1].time) return keyframes[keyframes.length - 1].value;
        
        // 線形補間
        for (let i = 0; i < keyframes.length - 1; i++) {
            if (localTime >= keyframes[i].time && localTime <= keyframes[i + 1].time) {
                const t = (localTime - keyframes[i].time) / (keyframes[i + 1].time - keyframes[i].time);
                return keyframes[i].value + (keyframes[i + 1].value - keyframes[i].value) * t;
            }
        }
        
        return keyframes[0].value;
    }
    
    setKeyframeValue(property, value) {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        const keyframes = this.selectedClip.keyframes[property];
        
        // 既存のキーフレームを更新または追加
        const existing = keyframes.find(kf => Math.abs(kf.time - localTime) < 0.05);
        if (existing) {
            existing.value = value;
            console.log(`✏️ Updated keyframe: ${property} at ${localTime.toFixed(2)}s = ${value.toFixed(2)}`);
        } else {
            keyframes.push({ time: localTime, value: value });
            keyframes.sort((a, b) => a.time - b.time);
            console.log(`➕ Added keyframe: ${property} at ${localTime.toFixed(2)}s = ${value.toFixed(2)}`);
        }
        
        // 音声パラメータ（pan）の場合、リアルタイムで適用
        if (property === 'pan' && this.selectedClip.panNode) {
            this.selectedClip.panNode.pan.value = value;
        }
        
        this.updatePreview(); // リアルタイム更新
        this.drawTimeline();
        this.updatePropertiesPanel();
        this.saveHistory();
    }
    
    // ライブ更新用（履歴保存なし、プレビューのみ更新）
    setKeyframeValueLive(property, value) {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        const keyframes = this.selectedClip.keyframes[property];
        
        // 既存のキーフレームを更新または追加
        const existing = keyframes.find(kf => Math.abs(kf.time - localTime) < 0.05);
        if (existing) {
            existing.value = value;
        } else {
            keyframes.push({ time: localTime, value: value });
            keyframes.sort((a, b) => a.time - b.time);
        }
        
        // 音声パラメータ（pan）の場合、リアルタイムで適用
        if (property === 'pan' && this.selectedClip.panNode) {
            this.selectedClip.panNode.pan.value = value;
            console.log('🎚️ Pan updated (live):', value, 'Node exists:', !!this.selectedClip.panNode);
            
            // テスト再生（スライダー操作中のみ）
            this.testPlayAudio(this.selectedClip);
        }
        
        // デバウンス版updatePreviewを使用（8ms）
        this.updatePreviewDebounced();
    }
    
    // 音声パラメータ調整時のテスト再生
    testPlayAudio(clip) {
        if (!clip.audioElement || !clip.audioElement.paused) return;
        
        const localTime = this.currentTime - clip.startTime;
        const actualTime = localTime + (clip.trimStart || 0);
        
        // 範囲内かチェック
        if (localTime < 0 || localTime >= clip.duration) return;
        
        // 短時間だけ再生
        clip.audioElement.currentTime = actualTime;
        clip.audioElement.play().catch(e => console.log('Test play error:', e));
        
        // 既存のタイマーをクリア
        if (clip._testPlayTimeout) {
            clearTimeout(clip._testPlayTimeout);
        }
        
        // 0.5秒後に停止
        clip._testPlayTimeout = setTimeout(() => {
            clip.audioElement.pause();
        }, 500);
    }
    
    // アンカーポイント設定（ライブ更新）
    setAnchorPointLive(axis, value) {
        if (!this.selectedClip) return;
        
        if (!this.selectedClip.anchorPoint) {
            this.selectedClip.anchorPoint = { x: 0.5, y: 0.5 };
        }
        
        this.selectedClip.anchorPoint[axis] = value;
        this.updatePreviewDebounced(); // デバウンス版を使用
    }
    
    // アンカーポイント設定（確定時）
    setAnchorPoint(axis, value) {
        if (!this.selectedClip) return;
        
        if (!this.selectedClip.anchorPoint) {
            this.selectedClip.anchorPoint = { x: 0.5, y: 0.5 };
        }
        
        this.selectedClip.anchorPoint[axis] = value;
        this.updatePreview();
        this.saveHistory();
    }
    
    toggleKeyframe(property) {
        if (!this.selectedClip) return;
        
        const localTime = this.currentTime - this.selectedClip.startTime;
        const keyframes = this.selectedClip.keyframes[property];
        
        const existingIndex = keyframes.findIndex(kf => Math.abs(kf.time - localTime) < 0.05);
        
        if (existingIndex !== -1) {
            // 削除
            keyframes.splice(existingIndex, 1);
        } else {
            // 追加
            const currentValue = this.getKeyframeValue(this.selectedClip, property, localTime);
            keyframes.push({ time: localTime, value: currentValue });
            keyframes.sort((a, b) => a.time - b.time);
        }
        
        this.drawTimeline();
        this.updatePropertiesPanel();
        this.saveHistory();
    }
    
    hasKeyframeAt(clip, property, localTime) {
        const keyframes = clip.keyframes[property];
        return keyframes.some(kf => Math.abs(kf.time - localTime) < 0.05);
    }
    
    // プレビュー更新
    async updatePreview() {
        // 既に実行中の場合はスキップ
        if (this.isUpdatingPreview) {
            return;
        }
        
        this.isUpdatingPreview = true;
        
        try {
            const ctx = this.previewCtx;
            const width = this.previewCanvas.width;
            const height = this.previewCanvas.height;
            
            // 背景クリア
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, width, height);
            
            // アクティブなクリップを描画（トラック番号が小さいほど手前に描画）
            const activeClips = this.clips.filter(clip => 
                this.currentTime >= clip.startTime && 
                this.currentTime < clip.startTime + clip.duration
            ).sort((a, b) => b.track - a.track); // 逆順: トラック番号が大きい方から先に描画
            
            // 範囲外の音声クリップを停止
            this.clips.forEach(clip => {
                if (clip.audioElement && !activeClips.includes(clip)) {
                    if (!clip.audioElement.paused) {
                        clip.audioElement.pause();
                    }
                }
            });
            
            // クリップを順番に描画（awaitで完了を待つ）
            for (const clip of activeClips) {
                await this.renderClip(clip);
            }
            
            // エフェクト適用
            this.applyEffects();
            
            // SVGオーバーレイをクリア
            while (this.boundingBoxGroup.firstChild) {
                this.boundingBoxGroup.removeChild(this.boundingBoxGroup.firstChild);
            }
            
            // パペットピンを常にクリア
            const existingPins = document.querySelectorAll('.puppet-pin-overlay');
            existingPins.forEach(p => p.remove());
            
            // バウンディングボックスを描画（動画・画像・連番画像クリップを選択している場合のみ）
            if (this.selectedClip && activeClips.includes(this.selectedClip)) {
                const clipType = this.selectedClip.asset.type;
                if (clipType === 'video' || clipType === 'image' || clipType === 'sequence' || 
                    clipType === 'solid' || clipType === 'gradient' || clipType === 'stripe') {
                    this.drawBoundingBox(this.selectedClip);
                    
                    // パペットピンを描画
                    this.drawPuppetPins(this.selectedClip);
                }
            }
        } finally {
            // 必ずフラグをリセット
            this.isUpdatingPreview = false;
        }
    }
    
    // デバウンス付きupdatePreview（ドラッグ操作時などに使用）
    updatePreviewDebounced() {
        // 既存のタイマーをキャンセル
        if (this.previewUpdateTimer) {
            clearTimeout(this.previewUpdateTimer);
        }
        
        // 新しいタイマーをセット
        this.previewUpdateTimer = setTimeout(() => {
            this.updatePreview();
            this.previewUpdateTimer = null;
        }, this.previewUpdateDelay);
    }
    
    // パペットピンを画面上に描画
    drawPuppetPins(clip) {
        if (!clip.puppet || !clip.puppet.enabled || clip.puppet.pins.length === 0) {
            // ピンがない場合は既存のピン要素を削除
            const existingPins = document.querySelectorAll('.puppet-pin-overlay');
            existingPins.forEach(p => p.remove());
            return;
        }
        
        // 既存のピン要素を削除
        const existingPins = document.querySelectorAll('.puppet-pin-overlay');
        existingPins.forEach(p => p.remove());
        
        const localTime = this.currentTime - clip.startTime;
        const x = this.getKeyframeValue(clip, 'x', localTime);
        const y = this.getKeyframeValue(clip, 'y', localTime);
        const scale = this.getKeyframeValue(clip, 'scale', localTime);
        const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
        
        let w, h;
        if (clip.useOriginalSize && clip.originalWidth) {
            w = clip.originalWidth * scale;
            h = clip.originalHeight * scale;
        } else {
            w = this.previewCanvas.width * 0.5 * scale;
            h = this.previewCanvas.height * 0.5 * scale;
        }
        
        const cx = this.previewCanvas.width / 2 + x;
        const cy = this.previewCanvas.height / 2 + y;
        const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
        
        // 回転を考慮したピン描画
        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        // 各ピンを描画
        for (const pin of clip.puppet.pins) {
            const pinPos = this.getPuppetPinPosition(pin, localTime);
            
            // ピンの元の位置(中心基準)
            let pinX = (pin.x - 0.5) * w;
            let pinY = (pin.y - 0.5) * h;
            
            // 他のピンの影響を適用して、変形後の位置を計算
            const stiffness = clip.puppet.stiffness || 0.5;
            for (const otherPin of clip.puppet.pins) {
                const otherPinPos = this.getPuppetPinPosition(otherPin, localTime);
                const otherPinOrigX = (otherPin.x - 0.5) * w;
                const otherPinOrigY = (otherPin.y - 0.5) * h;
                const otherPinCurrX = (otherPinPos.x - 0.5) * w;
                const otherPinCurrY = (otherPinPos.y - 0.5) * h;
                
                const dx = otherPinCurrX - otherPinOrigX;
                const dy = otherPinCurrY - otherPinOrigY;
                
                const distX = pinX - otherPinOrigX;
                const distY = pinY - otherPinOrigY;
                const dist = Math.sqrt(distX * distX + distY * distY);
                
                // 影響範囲を計算（stiffnessが高いほど影響範囲が広い）
                const baseRadius = Math.max(w, h) * 0.3; // ベース影響範囲
                const influenceRadius = baseRadius * (0.5 + stiffness * 1.5); // 0.5-2.0倍の範囲
                
                // 影響力を計算（距離に応じて指数減衰、stiffnessで減衰の強さを調整）
                const falloff = 2.0 - stiffness * 1.5; // falloff: 0.5-2.0（小さいほど遠くまで影響）
                const influence = Math.exp(-dist * falloff / influenceRadius);
                
                pinX += dx * influence;
                pinY += dy * influence;
            }
            
            // 中心基準からアンカーポイント基準に変換
            const offsetX = pinX;
            const offsetY = pinY;
            
            // 回転を適用
            const rotatedX = offsetX * cos - offsetY * sin;
            const rotatedY = offsetX * sin + offsetY * cos;
            
            const screenX = cx + rotatedX;
            const screenY = cy + rotatedY;
            
            // SVGオーバーレイに画像要素を追加（ズームは不要、SVGのviewBoxで自動調整される）
            const svgNS = "http://www.w3.org/2000/svg";
            const pinImage = document.createElementNS(svgNS, "image");
            pinImage.setAttributeNS("http://www.w3.org/1999/xlink", "href", `pin-0${pin.index + 1}.png`);
            
            const pinSize = 64;
            pinImage.setAttribute("x", screenX - pinSize / 2);
            pinImage.setAttribute("y", screenY - pinSize / 2);
            pinImage.setAttribute("width", pinSize);
            pinImage.setAttribute("height", pinSize);
            pinImage.setAttribute("class", "puppet-pin-overlay");
            pinImage.style.pointerEvents = "none";
            
            this.overlayCanvas.appendChild(pinImage);
        }
    }
    
    async renderClip(clip) {
        const localTime = this.currentTime - clip.startTime;
        
        // ループ処理 - 継続時間内で素材を繰り返す
        let effectiveLocalTime = localTime;
        
        // 動画と連番画像のみループ処理を行う（画像と音声は除外）
        if ((clip.asset.type === 'video' || clip.asset.type === 'sequence') && clip.loopEnabled) {
            // 素材の実際の長さを取得
            let originalDuration;
            if (clip.asset.type === 'video' && clip.videoElement) {
                originalDuration = clip.videoElement.duration || 1;
            } else if (clip.asset.type === 'sequence') {
                const frameRate = clip.frameRate || 30;
                originalDuration = clip.asset.frameCount / frameRate;
            } else {
                originalDuration = clip.duration; // フォールバック
            }
            
            // trimStartを考慮したループ処理
            const trimStart = clip.trimStart || 0;
            const availableDuration = originalDuration - trimStart;
            
            // クリップ内での有効な再生位置を計算
            if (availableDuration > 0) {
                effectiveLocalTime = (localTime % availableDuration);
            }
        }
        
        // トランジション進行度を計算
        let transitionProgress = 1;
        
        // トランジションイン
        if (clip.transitionIn.type !== 'none' && localTime < clip.transitionIn.duration) {
            transitionProgress = localTime / clip.transitionIn.duration;
        }
        
        // トランジションアウト
        if (clip.transitionOut.type !== 'none' && localTime > clip.duration - clip.transitionOut.duration) {
            const timeInTransition = clip.duration - localTime;
            transitionProgress = timeInTransition / clip.transitionOut.duration;
        }
        
        const x = this.getKeyframeValue(clip, 'x', localTime);
        const y = this.getKeyframeValue(clip, 'y', localTime);
        const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
        const opacity = this.getKeyframeValue(clip, 'opacity', localTime);
        const scale = this.getKeyframeValue(clip, 'scale', localTime);
        
        // 親のトランスフォームを取得
        const parentTransform = this.getParentTransform(clip, localTime);
        
        // 親のトランスフォームを適用した最終的なトランスフォームを計算
        const finalRotation = parentTransform.rotation + rotation;
        const finalScale = parentTransform.scale * scale;
        
        // 親の回転を考慮して子の位置を計算
        const radians = (parentTransform.rotation * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const finalX = parentTransform.x + (x * cos - y * sin) * parentTransform.scale;
        const finalY = parentTransform.y + (x * sin + y * cos) * parentTransform.scale;
        
        const ctx = this.previewCtx;
        
        // 音声クリップの場合は音声のみ再生
        if (clip.asset.type === 'audio') {
            this.playAudioClip(clip, effectiveLocalTime);
            return;
        }
        
        // クリッピングが有効な場合は一時キャンバスに描画
        let targetCtx = ctx;
        let tempCanvas = null;
        
        if (clip.clipSource) {
            tempCanvas = document.createElement('canvas');
            tempCanvas.width = this.previewCanvas.width;
            tempCanvas.height = this.previewCanvas.height;
            targetCtx = tempCanvas.getContext('2d');
        }
        
        targetCtx.save();
        
        // ブレンドモードを適用（音声クリップ以外）
        if (clip.blendMode && clip.blendMode !== 'normal') {
            targetCtx.globalCompositeOperation = clip.blendMode;
        }
        
        // アンカーポイントを取得（デフォルトは中心）
        const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
        
        // 中心を基準に変形（キャンバスの実際のサイズを使用、親のトランスフォームを適用）
        targetCtx.translate(this.previewCanvas.width / 2 + finalX, this.previewCanvas.height / 2 + finalY);
        targetCtx.rotate(finalRotation * Math.PI / 180);
        targetCtx.scale(finalScale, finalScale);
        targetCtx.globalAlpha = opacity * transitionProgress;
        
        // 一時的にthis.previewCtxを切り替え（drawImage等が使用するため）
        const originalCtx = this.previewCtx;
        if (tempCanvas) {
            this.previewCtx = targetCtx;
        }
        
        // 素材を描画
        if (clip.asset.type === 'image') {
            await this.drawImage(clip);
        } else if (clip.asset.type === 'video') {
            await this.drawVideo(clip, effectiveLocalTime);
            this.playAudioClip(clip, effectiveLocalTime);
        } else if (clip.asset.type === 'sequence') {
            await this.drawSequence(clip, effectiveLocalTime);
        } else if (clip.asset.type === 'solid' || clip.asset.type === 'gradient' || clip.asset.type === 'stripe') {
            // 生成オブジェクトを描画
            this.drawGeneratedObject(clip);
        } else if (clip.asset.type === 'scene') {
            // シーンクリップを描画
            await this.sceneManager.renderSceneClip(targetCtx, clip, effectiveLocalTime, {
                x: finalX,
                y: finalY,
                rotation: finalRotation,
                scale: finalScale,
                opacity: opacity * transitionProgress
            });
        }
        
        // previewCtxを元に戻す
        if (tempCanvas) {
            this.previewCtx = originalCtx;
        }
        
        targetCtx.restore();
        
        // クリッピングを適用（一時キャンバスにマスク適用後、メインキャンバスに描画）
        if (clip.clipSource && tempCanvas) {
            this.clippingManager.applyClipping(targetCtx, clip, this.currentTime);
            
            // メインキャンバスに描画する際もブレンドモードを適用
            ctx.save();
            if (clip.blendMode && clip.blendMode !== 'normal') {
                ctx.globalCompositeOperation = clip.blendMode;
            }
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
        }
    }
    
    // 連番アニメーションを描画
    async drawSequence(clip, localTime) {
        const frameRate = clip.frameRate || 30;
        
        // trimStartを考慮した実際の時間を計算
        const actualTime = localTime + (clip.trimStart || 0);
        const frameIndex = Math.floor(actualTime * frameRate) % clip.asset.frameCount;
        
        return new Promise((resolve) => {
            if (!clip.sequenceImages) {
                clip.sequenceImages = [];
                clip.asset.urls.forEach((url, idx) => {
                    const img = new Image();
                    img.src = url;
                    clip.sequenceImages[idx] = img;
                });
            }
            
            const img = clip.sequenceImages[frameIndex];
            if (img && img.complete) {
                this.drawSequenceFrame(clip, img);
            }
            resolve();
        });
    }
    
    drawSequenceFrame(clip, img) {
        const ctx = this.previewCtx;
        
        // 画像が完全に読み込まれているか確認
        if (!img || !img.complete || img.width === 0 || img.height === 0) {
            return; // 読み込み中は何も描画しない
        }
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && img.width && img.height) {
            drawWidth = img.width;
            drawHeight = img.height;
        } else {
            const aspectRatio = img.width / img.height;
            const maxWidth = this.previewCanvas.width; // 1920
            const maxHeight = this.previewCanvas.height; // 1080
            
            drawWidth = maxWidth;
            drawHeight = maxWidth / aspectRatio;
            
            if (drawHeight > maxHeight) {
                drawHeight = maxHeight;
                drawWidth = maxHeight * aspectRatio;
            }
        }
        
        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    
    // トランジション効果を適用
    applyTransition(clip, localTime, progress) {
        const ctx = this.previewCtx;
        // キャンバスの実際のサイズを使用
        const width = this.previewCanvas.width;
        const height = this.previewCanvas.height;
        
        let transitionType = 'none';
        
        // トランジションイン
        if (clip.transitionIn.type !== 'none' && localTime < clip.transitionIn.duration) {
            transitionType = clip.transitionIn.type;
        }
        
        // トランジションアウト
        if (clip.transitionOut.type !== 'none' && localTime > clip.duration - clip.transitionOut.duration) {
            transitionType = clip.transitionOut.type;
        }
        
        if (transitionType === 'none') return;
        
        ctx.save();
        
        switch (transitionType) {
            case 'fade':
            case 'dissolve':
                // フェード/ディゾルブは不透明度で処理済み
                break;
                
            case 'wipe_left':
                ctx.beginPath();
                ctx.rect(0, 0, width * progress, height);
                ctx.clip();
                break;
                
            case 'wipe_right':
                ctx.beginPath();
                ctx.rect(width * (1 - progress), 0, width * progress, height);
                ctx.clip();
                break;
                
            case 'wipe_up':
                ctx.beginPath();
                ctx.rect(0, 0, width, height * progress);
                ctx.clip();
                break;
                
            case 'wipe_down':
                ctx.beginPath();
                ctx.rect(0, height * (1 - progress), width, height * progress);
                ctx.clip();
                break;
                
            case 'slide_left':
                ctx.translate(-width * (1 - progress), 0);
                break;
                
            case 'slide_right':
                ctx.translate(width * (1 - progress), 0);
                break;
        }
        
        ctx.restore();
    }
    
    // 音声クリップ再生
    playAudioClip(clip, localTime) {
        if (!clip.audioElement) return;
        
        // クリップのdurationを超えている場合は停止
        if (localTime >= clip.duration || localTime < 0) {
            if (!clip.audioElement.paused) {
                clip.audioElement.pause();
            }
            return;
        }
        
        // trimStartを考慮した実際の再生位置を計算
        const trimStart = clip.trimStart || clip.offset || 0;
        const originalDuration = clip.originalDuration || clip.duration;
        const loopEnabled = clip.loopEnabled || false;
        
        let actualTime = trimStart + localTime;
        
        // ループ対応：元の長さを超えたら繰り返し
        if (loopEnabled && actualTime >= originalDuration) {
            const loopDuration = originalDuration - trimStart;
            actualTime = trimStart + (localTime % loopDuration);
        }
        
        // パンとボリュームをキーフレームから取得
        const pan = this.getKeyframeValue(clip, 'pan', localTime);
        const volume = clip.volume || 1.0;
        
        console.log('🎵 Playing audio - localTime:', localTime.toFixed(2), 'actualTime:', actualTime.toFixed(2), 'pan:', pan.toFixed(2), 'volume:', volume.toFixed(2));
        
        // Web Audio APIノードに値を設定
        if (clip.gainNode) {
            clip.gainNode.gain.value = volume;
            // console.log('🔊 Volume set:', volume);
        }
        if (clip.panNode) {
            clip.panNode.pan.value = pan;
            // console.log('🎚️ Pan set:', pan);
        }
        
        if (this.isPlaying) {
            if (clip.audioElement.paused) {
                clip.audioElement.currentTime = actualTime;
                clip.audioElement.play().catch(e => console.log('Audio play error:', e));
            }
        } else {
            if (!clip.audioElement.paused) {
                clip.audioElement.pause();
            }
        }
    }
    
    async drawImage(clip) {
        return new Promise((resolve) => {
            if (!clip.imageElement) {
                clip.imageElement = new Image();
                clip.imageElement.onload = () => {
                    this.drawImageOnCanvas(clip);
                    // updatePreviewの再帰呼び出しを削除（renderClip内で既に呼ばれている）
                    resolve();
                };
                clip.imageElement.onerror = () => {
                    console.error('画像読み込みエラー:', clip.asset.name);
                    resolve();
                };
                clip.imageElement.src = clip.asset.url;
            } else if (clip.imageElement.complete) {
                this.drawImageOnCanvas(clip);
                resolve();
            } else {
                // 読み込み中の場合は待つ
                clip.imageElement.onload = () => {
                    this.drawImageOnCanvas(clip);
                    // updatePreviewの再帰呼び出しを削除
                    resolve();
                };
            }
        });
    }
    
    drawGeneratedObject(clip) {
        const ctx = this.previewCtx;
        const canvas = clip.asset.element;
        
        if (!canvas) return;
        
        // キャンバスのサイズを取得
        const drawWidth = canvas.width;
        const drawHeight = canvas.height;
        
        // 中心を基準に描画
        ctx.drawImage(canvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    
    drawImageOnCanvas(clip) {
        const img = clip.imageElement;
        const ctx = this.previewCtx;
        
        // 画像が完全に読み込まれているか確認
        if (!img || !img.complete || img.width === 0 || img.height === 0) {
            return; // 読み込み中は何も描画しない
        }
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
            // 原寸表示
            drawWidth = clip.originalWidth;
            drawHeight = clip.originalHeight;
        } else {
            // アスペクト比を維持してフィット(キャンバスの実際のサイズに合わせる)
            const aspectRatio = img.width / img.height;
            const maxWidth = this.previewCanvas.width; // 1920
            const maxHeight = this.previewCanvas.height; // 1080
            
            drawWidth = maxWidth;
            drawHeight = maxWidth / aspectRatio;
            
            if (drawHeight > maxHeight) {
                drawHeight = maxHeight;
                drawWidth = maxHeight * aspectRatio;
            }
        }
        
        // アンカーポイントを取得（デフォルトは中心）
        const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
        const anchorX = -drawWidth * anchor.x;
        const anchorY = -drawHeight * anchor.y;
        
        // パペット変形が有効な場合
        if (clip.puppet && clip.puppet.enabled && clip.puppet.pins.length > 0) {
            const localTime = this.currentTime - clip.startTime;
            this.drawPuppetDeformedImage(ctx, clip, img, anchorX, anchorY, drawWidth, drawHeight, localTime);
        }
        // 風揺れエフェクトが有効な場合
        else if (clip.windShake && clip.windShake.enabled) {
            const localTime = this.currentTime - clip.startTime;
            this.applyWindShakeToImage(ctx, img, drawWidth, drawHeight, clip, localTime, anchorX, anchorY);
        } else {
            ctx.drawImage(img, anchorX, anchorY, drawWidth, drawHeight);
        }
        
        // ブラーエフェクトが有効な場合のみ適用
        const hasBlurEffect = (clip.gaussianBlur && clip.gaussianBlur.enabled && clip.gaussianBlur.strength > 0) ||
                              (clip.lensBlur && clip.lensBlur.enabled && clip.lensBlur.strength > 0);
        if (hasBlurEffect) {
            this.applyBlurEffects(ctx, clip, drawWidth, drawHeight);
        }
    }
    
    applyBlurEffects(ctx, clip, width, height) {
        // 変形状態を保存
        const currentTransform = ctx.getTransform();
        
        // ガウシアンブラー
        if (clip.gaussianBlur && clip.gaussianBlur.enabled && clip.gaussianBlur.strength > 0) {
            const strength = clip.gaussianBlur.strength;
            
            // 変形をリセットして画像データを取得
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            
            const centerX = this.previewCanvas.width / 2;
            const centerY = this.previewCanvas.height / 2;
            
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // 描画済みの画像を一時キャンバスにコピー
            tempCtx.drawImage(ctx.canvas, 
                centerX - width / 2, 
                centerY - height / 2, 
                width, height,
                0, 0, width, height);
            
            // ブラーを適用
            if (clip.gaussianBlur.horizontalOnly) {
                tempCtx.filter = `blur(${strength}px) blur(0px)`;
            } else if (clip.gaussianBlur.verticalOnly) {
                tempCtx.filter = `blur(0px) blur(${strength}px)`;
            } else {
                tempCtx.filter = `blur(${strength}px)`;
            }
            
            const tempCanvas2 = document.createElement('canvas');
            tempCanvas2.width = width;
            tempCanvas2.height = height;
            const tempCtx2 = tempCanvas2.getContext('2d');
            tempCtx2.filter = tempCtx.filter;
            tempCtx2.drawImage(tempCanvas, 0, 0);
            
            // 元の位置に描画し直す
            ctx.drawImage(tempCanvas2, centerX - width / 2, centerY - height / 2);
            
            // 変形状態を復元
            ctx.setTransform(currentTransform);
        }
        
        // レンズブラー
        if (clip.lensBlur && clip.lensBlur.enabled && clip.lensBlur.strength > 0) {
            // 変形をリセットしてからレンズブラーを適用
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.applyLensBlur(ctx, clip, width, height);
            // 変形状態を復元
            ctx.setTransform(currentTransform);
        }
    }
    
    applyLensBlur(ctx, clip, width, height) {
        const lb = clip.lensBlur;
        const focusPos = lb.focusPosition / 100; // 0-1
        const focusRange = lb.focusRange / 100; // 0-1
        const maxStrength = lb.strength;
        
        // ボケ強度が低い場合は処理をスキップ
        if (maxStrength < 1) return;
        
        const centerX = this.previewCanvas.width / 2;
        const centerY = this.previewCanvas.height / 2;
        
        // 元の画像データを取得
        const sourceImageData = ctx.getImageData(
            centerX - width / 2,
            centerY - height / 2,
            width, height
        );
        
        // 出力用の画像データを作成
        const outputImageData = ctx.createImageData(width, height);
        const src = sourceImageData.data;
        const dst = outputImageData.data;
        
        // Y座標ごとにボケ強度マップを作成
        const blurMap = new Float32Array(height);
        for (let y = 0; y < height; y++) {
            const normalizedY = y / height;
            let distance = Math.abs(normalizedY - focusPos);
            
            let blurStrength = 0;
            if (distance > focusRange) {
                const beyondRange = (distance - focusRange) / Math.max(1 - focusRange, 0.01);
                blurStrength = Math.min(beyondRange * maxStrength, maxStrength);
            }
            
            if (lb.invert) {
                blurStrength = maxStrength - blurStrength;
            }
            
            blurMap[y] = blurStrength;
        }
        
        // 各ピクセルに対して円形ボケを適用（最適化版）
        const step = 2; // 処理を間引いて高速化
        
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const radius = blurMap[y];
                
                if (radius < 0.5) {
                    // ボケなし - そのままコピー
                    for (let dy = 0; dy < step && y + dy < height; dy++) {
                        for (let dx = 0; dx < step && x + dx < width; dx++) {
                            const idx = ((y + dy) * width + (x + dx)) * 4;
                            dst[idx] = src[idx];
                            dst[idx + 1] = src[idx + 1];
                            dst[idx + 2] = src[idx + 2];
                            dst[idx + 3] = src[idx + 3];
                        }
                    }
                } else {
                    // 円形ボケを適用
                    let r = 0, g = 0, b = 0, a = 0;
                    let count = 0;
                    
                    // 円形サンプリング（六角形ボケ風）
                    const samples = Math.min(Math.max(6, Math.floor(radius * 2)), 36);
                    
                    for (let i = 0; i < samples; i++) {
                        const angle = (i / samples) * Math.PI * 2;
                        // 六角形に近い形状
                        const hexFactor = 1.0 + 0.1 * Math.cos(angle * 6);
                        const sampleRadius = radius * Math.sqrt(Math.random()) * hexFactor;
                        
                        const sx = Math.round(x + Math.cos(angle) * sampleRadius);
                        const sy = Math.round(y + Math.sin(angle) * sampleRadius);
                        
                        if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
                            const sidx = (sy * width + sx) * 4;
                            r += src[sidx];
                            g += src[sidx + 1];
                            b += src[sidx + 2];
                            a += src[sidx + 3];
                            count++;
                        }
                    }
                    
                    if (count > 0) {
                        const avgR = r / count;
                        const avgG = g / count;
                        const avgB = b / count;
                        const avgA = a / count;
                        
                        // stepサイズ分のピクセルに適用
                        for (let dy = 0; dy < step && y + dy < height; dy++) {
                            for (let dx = 0; dx < step && x + dx < width; dx++) {
                                const idx = ((y + dy) * width + (x + dx)) * 4;
                                dst[idx] = avgR;
                                dst[idx + 1] = avgG;
                                dst[idx + 2] = avgB;
                                dst[idx + 3] = avgA;
                            }
                        }
                    }
                }
            }
        }
        
        // 結果を描画
        ctx.putImageData(outputImageData, 
            centerX - width / 2,
            centerY - height / 2);
    }
    
    async drawVideo(clip, localTime) {
        return new Promise((resolve) => {
            // trimStartを考慮した実際の再生位置を計算
            const actualTime = localTime + (clip.trimStart || 0);
            
            if (!clip.videoElement) {
                clip.videoElement = document.createElement('video');
                clip.videoElement.src = clip.asset.url;
                clip.videoElement.muted = true;
                clip.videoElement.preload = 'auto';
                clip.videoElement.crossOrigin = 'anonymous'; // CORS対応
                
                // MOVファイルなど、ブラウザがネイティブサポートしていないコーデックのための追加設定
                // ※ブラウザによっては H.264/AAC の MOV をサポート
                clip.videoElement.setAttribute('playsinline', 'true');
                
                // シーク中フラグを初期化
                clip.videoElement._isSeeking = false;
                
                clip.videoElement.onloadeddata = () => {
                    clip.videoElement.currentTime = actualTime;
                    clip.videoElement._isSeeking = true;
                };
                
                // シーク完了時に描画
                clip.videoElement.onseeked = () => {
                    clip.videoElement._isSeeking = false;
                    if (clip.videoElement.readyState >= 2) {
                        this.drawVideoOnCanvas(clip);
                    }
                    resolve();
                };
                
                // エラーハンドリング追加（MOVが読み込めない場合のログ）
                clip.videoElement.onerror = (e) => {
                    console.error('動画読み込みエラー:', clip.asset.name, e);
                    console.warn('MOVファイルはブラウザのコーデックサポートに依存します。H.264/AAC形式のMOVを推奨します。');
                    resolve();
                };
                
                // タイムアウト処理
                setTimeout(() => resolve(), 100);
            } else {
                // currentTimeを更新（閾値を1フレーム分 = 約0.033秒 に設定）
                const timeDiff = Math.abs(clip.videoElement.currentTime - actualTime);
                const frameTime = 1.0 / this.fps; // FPSに基づいた1フレームの時間
                
                if (timeDiff > frameTime) {
                    // シーク中でも現在のフレームを描画（ちらつき防止）
                    if (clip.videoElement.readyState >= 2) {
                        this.drawVideoOnCanvas(clip);
                    }
                    
                    // シークが必要な場合のみシーク実行
                    if (!clip.videoElement._isSeeking) {
                        clip.videoElement._isSeeking = true;
                        clip.videoElement.currentTime = actualTime;
                        
                        // シーク完了を待つ
                        const onSeeked = () => {
                            clip.videoElement._isSeeking = false;
                            if (clip.videoElement.readyState >= 2) {
                                this.drawVideoOnCanvas(clip);
                            }
                            clip.videoElement.removeEventListener('seeked', onSeeked);
                            resolve();
                        };
                        clip.videoElement.addEventListener('seeked', onSeeked);
                        
                        // タイムアウト（シークが完了しない場合）
                        setTimeout(() => {
                            clip.videoElement._isSeeking = false;
                            clip.videoElement.removeEventListener('seeked', onSeeked);
                            resolve();
                        }, 100);
                    } else {
                        // 既にシーク中の場合は何もしない
                        resolve();
                    }
                } else {
                    // 時間差が小さい場合は、readyStateが準備できていれば描画
                    if (clip.videoElement.readyState >= 2) {
                        this.drawVideoOnCanvas(clip);
                    }
                    resolve();
                }
            }
        });
    }
    
    drawVideoOnCanvas(clip) {
        const video = clip.videoElement;
        const ctx = this.previewCtx;
        
        // 動画が十分に読み込まれているかチェック
        // readyState: 0=HAVE_NOTHING, 1=HAVE_METADATA, 2=HAVE_CURRENT_DATA, 3=HAVE_FUTURE_DATA, 4=HAVE_ENOUGH_DATA
        if (!video || video.readyState < 2) {
            return; // 準備できていなければ何も描画しない
        }
        
        let drawWidth, drawHeight;
        
        if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
            // 原寸表示
            drawWidth = clip.originalWidth;
            drawHeight = clip.originalHeight;
        } else {
            // アスペクト比を維持してフィット(キャンバスの実際のサイズに合わせる)
            const aspectRatio = video.videoWidth / video.videoHeight;
            
            if (!aspectRatio || !isFinite(aspectRatio)) {
                return; // アスペクト比が不正なら描画しない
            }
            
            const maxWidth = this.previewCanvas.width; // 1920
            const maxHeight = this.previewCanvas.height; // 1080
            
            drawWidth = maxWidth;
            drawHeight = maxWidth / aspectRatio;
            
            if (drawHeight > maxHeight) {
                drawHeight = maxHeight;
                drawWidth = maxHeight * aspectRatio;
            }
        }
        
        // 中央に描画（画像と同じ処理）
        ctx.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    }
    
    applyEffects() {
        const ctx = this.previewCtx;
        // キャンバスの実際のサイズを取得（HTML属性のwidth/height）
        const width = this.previewCanvas.width;   // 1920
        const height = this.previewCanvas.height; // 1080
        
        // 座標変換を完全にリセット（重要！）
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // グラデーション（先に描画 = レターボックスの下）
        if (this.effects.gradient.enabled) {
            // 上部グラデーション
            if (this.effects.gradient.top.height > 0) {
                // 上部専用のブレンドモード設定
                ctx.globalCompositeOperation = this.effects.gradient.top.blendMode;
                
                const topGradient = ctx.createLinearGradient(0, 0, 0, this.effects.gradient.top.height);
                const topOpacity = this.effects.gradient.top.opacity / 100;
                const topColor = this.hexToRgba(this.effects.gradient.top.color, topOpacity);
                const topTransparent = this.hexToRgba(this.effects.gradient.top.color, 0);
                
                topGradient.addColorStop(0, topColor);
                topGradient.addColorStop(1, topTransparent);
                
                ctx.fillStyle = topGradient;
                ctx.fillRect(0, 0, width, this.effects.gradient.top.height);
                
                // ブレンドモードをリセット
                ctx.globalCompositeOperation = 'source-over';
            }
            
            // 下部グラデーション
            if (this.effects.gradient.bottom.height > 0) {
                // 下部専用のブレンドモード設定
                ctx.globalCompositeOperation = this.effects.gradient.bottom.blendMode;
                
                const bottomGradient = ctx.createLinearGradient(
                    0, 
                    height - this.effects.gradient.bottom.height, 
                    0, 
                    height
                );
                const bottomOpacity = this.effects.gradient.bottom.opacity / 100;
                const bottomTransparent = this.hexToRgba(this.effects.gradient.bottom.color, 0);
                const bottomColor = this.hexToRgba(this.effects.gradient.bottom.color, bottomOpacity);
                
                bottomGradient.addColorStop(0, bottomTransparent);
                bottomGradient.addColorStop(1, bottomColor);
                
                ctx.fillStyle = bottomGradient;
                ctx.fillRect(0, height - this.effects.gradient.bottom.height, width, this.effects.gradient.bottom.height);
                
                // ブレンドモードをリセット
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        
        // レターボックス（後に描画 = グラデーションの上）
        if (this.effects.letterbox.enabled) {
            ctx.fillStyle = this.effects.letterbox.color;
            // 上部のレターボックス
            ctx.fillRect(0, 0, width, this.effects.letterbox.height);
            // 下部のレターボックス
            ctx.fillRect(0, height - this.effects.letterbox.height, width, this.effects.letterbox.height);
        }
        
        // ノーマライズ(スムージング)エフェクト（ディフュージョンより先に適用）
        if (this.effects.normalize.enabled) {
            this.applyNormalizeEffect(ctx, width, height);
        }
        
        // ディフュージョン撮影エフェクト
        if (this.effects.diffusion.enabled) {
            this.applyDiffusionEffect(ctx, width, height);
        }
        
        // カラーキーエフェクト（最後に適用して透過処理）
        if (this.effects.colorKey.enabled) {
            this.applyColorKeyEffect(ctx, width, height);
        }
    }
    
    // ディフュージョン撮影エフェクトの適用
    applyDiffusionEffect(ctx, width, height) {
        // 現在時刻のパラメータを取得（キーフレーム補間）
        const params = this.getDiffusionParamsAtTime(this.currentTime);
        
        // 元の画像データを保存（不透明度調整用）
        const originalImageData = ctx.getImageData(0, 0, width, height);
        
        // エフェクト適用用の画像データを取得
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // パラメータを適用
        // 1. ブラー効果（簡易実装: ぼかし半径に応じてピクセルを平均化）
        if (params.blur > 0) {
            this.applySimpleBlur(imageData, width, height, params.blur);
        }
        
        // 2. 明るさ、コントラスト、彩度調整
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // 明るさ調整 (-100 to 100)
            if (params.brightness !== 0) {
                const brightnessFactor = params.brightness * 2.55; // -255 to 255
                r = Math.max(0, Math.min(255, r + brightnessFactor));
                g = Math.max(0, Math.min(255, g + brightnessFactor));
                b = Math.max(0, Math.min(255, b + brightnessFactor));
            }
            
            // コントラスト調整 (-100 to 100)
            if (params.contrast !== 0) {
                const contrastFactor = (100 + params.contrast) / 100;
                r = Math.max(0, Math.min(255, ((r - 128) * contrastFactor) + 128));
                g = Math.max(0, Math.min(255, ((g - 128) * contrastFactor) + 128));
                b = Math.max(0, Math.min(255, ((b - 128) * contrastFactor) + 128));
            }
            
            // 彩度調整 (-100 to 100)
            if (params.saturation !== 0) {
                const gray = 0.2989 * r + 0.5870 * g + 0.1140 * b;
                const saturationFactor = (100 + params.saturation) / 100;
                r = Math.max(0, Math.min(255, gray + (r - gray) * saturationFactor));
                g = Math.max(0, Math.min(255, gray + (g - gray) * saturationFactor));
                b = Math.max(0, Math.min(255, gray + (b - gray) * saturationFactor));
            }
            
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
        }
        
        // 3. 不透明度調整（元画像とエフェクト適用画像をブレンド）
        if (params.opacity < 100) {
            const opacityFactor = params.opacity / 100;
            const originalData = originalImageData.data;
            
            for (let i = 0; i < data.length; i += 4) {
                // エフェクト適用画像と元画像をブレンド
                data[i] = originalData[i] * (1 - opacityFactor) + data[i] * opacityFactor;
                data[i + 1] = originalData[i + 1] * (1 - opacityFactor) + data[i + 1] * opacityFactor;
                data[i + 2] = originalData[i + 2] * (1 - opacityFactor) + data[i + 2] * opacityFactor;
                // アルファチャンネルはそのまま
            }
        }
        
        // 画像データを戻す
        ctx.putImageData(imageData, 0, 0);
    }
    
    // ガウシアンブラー実装（滑らかでふんわりとしたぼかし）
    applySimpleBlur(imageData, width, height, blurRadius) {
        const data = imageData.data;
        
        // ブラー半径を0-300から0-20ピクセル程度に変換
        let radius = Math.floor(blurRadius / 15);
        if (radius < 1) return;
        
        // 半径が大きすぎる場合は制限（パフォーマンス考慮）
        radius = Math.min(radius, 20);
        
        // ガウシアンカーネルを生成
        const kernel = this.generateGaussianKernel(radius);
        const kernelSize = kernel.length;
        const halfKernel = Math.floor(kernelSize / 2);
        
        const tempData = new Uint8ClampedArray(data);
        
        // 水平方向のガウシアンブラー
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, totalWeight = 0;
                
                for (let i = 0; i < kernelSize; i++) {
                    const px = x + i - halfKernel;
                    if (px >= 0 && px < width) {
                        const idx = (y * width + px) * 4;
                        const weight = kernel[i];
                        r += tempData[idx] * weight;
                        g += tempData[idx + 1] * weight;
                        b += tempData[idx + 2] * weight;
                        a += tempData[idx + 3] * weight;
                        totalWeight += weight;
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / totalWeight;
                data[idx + 1] = g / totalWeight;
                data[idx + 2] = b / totalWeight;
                data[idx + 3] = a / totalWeight;
            }
        }
        
        // 垂直方向のガウシアンブラー
        tempData.set(data);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0, totalWeight = 0;
                
                for (let i = 0; i < kernelSize; i++) {
                    const py = y + i - halfKernel;
                    if (py >= 0 && py < height) {
                        const idx = (py * width + x) * 4;
                        const weight = kernel[i];
                        r += tempData[idx] * weight;
                        g += tempData[idx + 1] * weight;
                        b += tempData[idx + 2] * weight;
                        a += tempData[idx + 3] * weight;
                        totalWeight += weight;
                    }
                }
                
                const idx = (y * width + x) * 4;
                data[idx] = r / totalWeight;
                data[idx + 1] = g / totalWeight;
                data[idx + 2] = b / totalWeight;
                data[idx + 3] = a / totalWeight;
            }
        }
    }
    
    // ガウシアンカーネルを生成
    generateGaussianKernel(radius) {
        // カーネルサイズ = 半径 × 2 + 1
        const size = radius * 2 + 1;
        const kernel = new Array(size);
        
        // 標準偏差（シグマ）は半径の1/3が一般的
        const sigma = radius / 3;
        const twoSigmaSquare = 2 * sigma * sigma;
        const sigmaRoot = Math.sqrt(twoSigmaSquare * Math.PI);
        
        let sum = 0;
        
        // ガウス分布の値を計算
        for (let i = 0; i < size; i++) {
            const x = i - radius;
            kernel[i] = Math.exp(-(x * x) / twoSigmaSquare) / sigmaRoot;
            sum += kernel[i];
        }
        
        // 正規化（合計が1になるように）
        for (let i = 0; i < size; i++) {
            kernel[i] /= sum;
        }
        
        return kernel;
    }
    
    // カラーキーエフェクトの適用
    applyColorKeyEffect(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // キー色をRGBに変換
        const keyColor = this.hexToRgb(this.effects.colorKey.color);
        const tolerance = this.effects.colorKey.tolerance;
        const invert = this.effects.colorKey.invert;
        const feather = this.effects.colorKey.feather;
        
        // 各ピクセルを処理
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // 色の距離を計算（ユークリッド距離）
            const distance = Math.sqrt(
                Math.pow(r - keyColor.r, 2) +
                Math.pow(g - keyColor.g, 2) +
                Math.pow(b - keyColor.b, 2)
            );
            
            // 最大距離（RGB空間での対角線）
            const maxDistance = Math.sqrt(255 * 255 * 3);
            
            // 正規化された距離（0-100）
            const normalizedDistance = (distance / maxDistance) * 100;
            
            // 許容値との比較
            let alpha = 255;
            
            if (normalizedDistance <= tolerance) {
                // キー色の範囲内
                if (feather > 0 && normalizedDistance > tolerance - feather) {
                    // フェザー範囲内 - グラデーション
                    const featherFactor = (normalizedDistance - (tolerance - feather)) / feather;
                    alpha = invert ? featherFactor * 255 : (1 - featherFactor) * 255;
                } else {
                    // 完全にキー色
                    alpha = invert ? 0 : 255;
                }
            } else {
                // キー色の範囲外
                alpha = invert ? 255 : 0;
            }
            
            data[i + 3] = alpha;
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    // ノーマライズ(スムージング)エフェクトの適用
    applyNormalizeEffect(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const tempData = new Uint8ClampedArray(data);
        
        const strength = Math.max(1, Math.min(3, this.effects.normalize.strength));
        
        // スムージング処理（強度に応じて複数回適用）
        for (let pass = 0; pass < strength; pass++) {
            tempData.set(data);
            
            // 各ピクセルを処理（エッジ部分のみスムージング）
            for (let y = 1; y < height - 1; y++) {
                for (let x = 1; x < width - 1; x++) {
                    const idx = (y * width + x) * 4;
                    
                    // 現在のピクセル
                    const r = tempData[idx];
                    const g = tempData[idx + 1];
                    const b = tempData[idx + 2];
                    
                    // 周囲8ピクセルの平均を計算
                    let sumR = 0, sumG = 0, sumB = 0;
                    let count = 0;
                    
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            
                            const neighborIdx = ((y + dy) * width + (x + dx)) * 4;
                            const nr = tempData[neighborIdx];
                            const ng = tempData[neighborIdx + 1];
                            const nb = tempData[neighborIdx + 2];
                            
                            // 色の差が大きい場合のみ（エッジ検出）
                            const diff = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
                            
                            if (diff > 30) {  // エッジ閾値
                                sumR += nr;
                                sumG += ng;
                                sumB += nb;
                                count++;
                            }
                        }
                    }
                    
                    // エッジが検出された場合のみスムージング
                    if (count > 0) {
                        const avgR = sumR / count;
                        const avgG = sumG / count;
                        const avgB = sumB / count;
                        
                        // 元の色と平均をブレンド（50%）
                        data[idx] = (r + avgR) / 2;
                        data[idx + 1] = (g + avgG) / 2;
                        data[idx + 2] = (b + avgB) / 2;
                    }
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    // HEXカラーをRGBに変換
    hexToRgb(hex) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return { r, g, b };
    }
    
    // 現在時刻におけるディフュージョンパラメータを取得（キーフレーム補間）
    getDiffusionParamsAtTime(time) {
        const keyframes = this.effects.diffusion.keyframes;
        
        // キーフレームが無い場合はデフォルト値を返す
        if (!keyframes || keyframes.length === 0) {
            return {
                blur: this.effects.diffusion.blur,
                contrast: this.effects.diffusion.contrast,
                brightness: this.effects.diffusion.brightness,
                saturation: this.effects.diffusion.saturation,
                opacity: this.effects.diffusion.opacity
            };
        }
        
        // キーフレームを時刻順にソート
        const sortedKeyframes = [...keyframes].sort((a, b) => a.time - b.time);
        
        // 現在時刻より前のキーフレームと後のキーフレームを見つける
        let beforeKf = null;
        let afterKf = null;
        
        for (let i = 0; i < sortedKeyframes.length; i++) {
            if (sortedKeyframes[i].time <= time) {
                beforeKf = sortedKeyframes[i];
            }
            if (sortedKeyframes[i].time > time && !afterKf) {
                afterKf = sortedKeyframes[i];
                break;
            }
        }
        
        // 補間なし（キーフレームが1つ以下、または範囲外）
        if (!beforeKf && !afterKf) {
            return {
                blur: this.effects.diffusion.blur,
                contrast: this.effects.diffusion.contrast,
                brightness: this.effects.diffusion.brightness,
                saturation: this.effects.diffusion.saturation,
                opacity: this.effects.diffusion.opacity
            };
        }
        
        if (beforeKf && !afterKf) {
            // 最後のキーフレーム以降
            return {
                blur: beforeKf.blur,
                contrast: beforeKf.contrast,
                brightness: beforeKf.brightness,
                saturation: beforeKf.saturation,
                opacity: beforeKf.opacity
            };
        }
        
        if (!beforeKf && afterKf) {
            // 最初のキーフレームより前
            return {
                blur: afterKf.blur,
                contrast: afterKf.contrast,
                brightness: afterKf.brightness,
                saturation: afterKf.saturation,
                opacity: afterKf.opacity
            };
        }
        
        // 線形補間
        const t = (time - beforeKf.time) / (afterKf.time - beforeKf.time);
        return {
            blur: beforeKf.blur + (afterKf.blur - beforeKf.blur) * t,
            contrast: beforeKf.contrast + (afterKf.contrast - beforeKf.contrast) * t,
            brightness: beforeKf.brightness + (afterKf.brightness - beforeKf.brightness) * t,
            saturation: beforeKf.saturation + (afterKf.saturation - beforeKf.saturation) * t,
            opacity: beforeKf.opacity + (afterKf.opacity - beforeKf.opacity) * t
        };
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // FFmpeg.wasmの初期化
    async loadFFmpeg() {
        if (this.ffmpegLoaded) return;
        
        try {
            const { FFmpeg } = FFmpegWASM;
            const { toBlobURL } = FFmpegUtil;
            
            this.ffmpeg = new FFmpeg();
            
            // jsdelivr CDN を使用（CORS対応）
            const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
            
            this.ffmpeg.on('log', ({ message }) => {
                console.log('[FFmpeg]', message);
            });
            
            // CORSエラーを回避するため、toBlobURLを使わずに直接読み込み
            await this.ffmpeg.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
            });
            
            this.ffmpegLoaded = true;
            console.log('✅ FFmpeg loaded successfully');
        } catch (error) {
            console.error('❌ Failed to load FFmpeg:', error);
            throw error;
        }
    }
    
    // バウンディングボックスを描画（SVG）
    drawBoundingBox(clip) {
        const localTime = this.currentTime - clip.startTime;
        
        // クリップの現在の変形値を取得
        const x = this.getKeyframeValue(clip, 'x', localTime);
        const y = this.getKeyframeValue(clip, 'y', localTime);
        const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
        const scale = this.getKeyframeValue(clip, 'scale', localTime);
        
        // クリップのサイズを取得(キャンバスの実際のサイズに合わせる)
        let clipWidth = this.previewCanvas.width; // 1920
        let clipHeight = this.previewCanvas.height; // 1080
        
        if (clip.asset.type === 'image' && clip.imageElement) {
            if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
                clipWidth = clip.originalWidth;
                clipHeight = clip.originalHeight;
            } else if (clip.imageElement.complete && clip.imageElement.width > 0 && clip.imageElement.height > 0) {
                const aspectRatio = clip.imageElement.width / clip.imageElement.height;
                clipWidth = this.previewCanvas.width;
                clipHeight = this.previewCanvas.width / aspectRatio;
                if (clipHeight > this.previewCanvas.height) {
                    clipHeight = this.previewCanvas.height;
                    clipWidth = this.previewCanvas.height * aspectRatio;
                }
            }
        } else if (clip.asset.type === 'video' && clip.videoElement) {
            if (clip.useOriginalSize && clip.originalWidth && clip.originalHeight) {
                clipWidth = clip.originalWidth;
                clipHeight = clip.originalHeight;
            } else if (clip.videoElement.readyState >= 2 && clip.videoElement.videoWidth > 0 && clip.videoElement.videoHeight > 0) {
                const aspectRatio = clip.videoElement.videoWidth / clip.videoElement.videoHeight;
                clipWidth = this.previewCanvas.width;
                clipHeight = this.previewCanvas.width / aspectRatio;
                if (clipHeight > this.previewCanvas.height) {
                    clipHeight = this.previewCanvas.height;
                    clipWidth = this.previewCanvas.height * aspectRatio;
                }
            }
        } else if (clip.asset.type === 'sequence' && clip.sequenceImages && clip.sequenceImages.length > 0) {
            const img = clip.sequenceImages[0];
            if (img && img.complete && img.width > 0 && img.height > 0) {
                if (clip.useOriginalSize && img.width && img.height) {
                    clipWidth = img.width;
                    clipHeight = img.height;
                } else {
                    const aspectRatio = img.width / img.height;
                    clipWidth = this.previewCanvas.width;
                    clipHeight = this.previewCanvas.width / aspectRatio;
                    if (clipHeight > this.previewCanvas.height) {
                        clipHeight = this.previewCanvas.height;
                        clipWidth = this.previewCanvas.height * aspectRatio;
                    }
                }
            }
        } else if (clip.asset.type === 'solid' || clip.asset.type === 'gradient' || clip.asset.type === 'stripe') {
            // 生成オブジェクトは常に1920x1080
            clipWidth = 1920;
            clipHeight = 1080;
        }
        
        // スケール適用
        const scaledWidth = clipWidth * scale;
        const scaledHeight = clipHeight * scale;
        
        // キャンバス中心を基準に変形を適用
        const centerX = this.previewCanvas.width / 2 + x;
        const centerY = this.previewCanvas.height / 2 + y;
        
        // SVGグループを作成して変形を適用
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('transform', `translate(${centerX}, ${centerY}) rotate(${rotation})`);
        
        // バウンディングボックスの矩形を描画
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -scaledWidth / 2);
        rect.setAttribute('y', -scaledHeight / 2);
        rect.setAttribute('width', scaledWidth);
        rect.setAttribute('height', scaledHeight);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#00D9FF');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('stroke-dasharray', '5,5');
        group.appendChild(rect);
        
        // ハンドルを描画
        const handleSize = 10;
        const handles = [
            { x: -scaledWidth / 2, y: -scaledHeight / 2, type: 'corner-tl' }, // 左上
            { x: scaledWidth / 2, y: -scaledHeight / 2, type: 'corner-tr' },  // 右上
            { x: scaledWidth / 2, y: scaledHeight / 2, type: 'corner-br' },   // 右下
            { x: -scaledWidth / 2, y: scaledHeight / 2, type: 'corner-bl' },  // 左下
            { x: 0, y: -scaledHeight / 2, type: 'edge-t' },                   // 上
            { x: scaledWidth / 2, y: 0, type: 'edge-r' },                     // 右
            { x: 0, y: scaledHeight / 2, type: 'edge-b' },                    // 下
            { x: -scaledWidth / 2, y: 0, type: 'edge-l' }                     // 左
        ];
        
        handles.forEach(handle => {
            const handleRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            handleRect.setAttribute('x', handle.x - handleSize / 2);
            handleRect.setAttribute('y', handle.y - handleSize / 2);
            handleRect.setAttribute('width', handleSize);
            handleRect.setAttribute('height', handleSize);
            handleRect.setAttribute('fill', '#00D9FF');
            handleRect.setAttribute('stroke', '#FFFFFF');
            handleRect.setAttribute('stroke-width', '1');
            group.appendChild(handleRect);
        });
        
        // 回転ハンドル（上部中央から少し離れた位置）
        const rotateHandleDistance = 30;
        const rotateX = 0;
        const rotateY = -scaledHeight / 2 - rotateHandleDistance;
        
        // 回転ハンドルへの線
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', 0);
        line.setAttribute('y1', -scaledHeight / 2);
        line.setAttribute('x2', rotateX);
        line.setAttribute('y2', rotateY);
        line.setAttribute('stroke', '#00D9FF');
        line.setAttribute('stroke-width', '2');
        group.appendChild(line);
        
        // 回転ハンドル（円形）
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', rotateX);
        circle.setAttribute('cy', rotateY);
        circle.setAttribute('r', handleSize / 2);
        circle.setAttribute('fill', '#00D9FF');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '2');
        group.appendChild(circle);
        
        this.boundingBoxGroup.appendChild(group);
        
        // バウンディングボックス情報をキャッシュ（マウス操作で使用）
        this.boundingBoxCache = {
            centerX, centerY, rotation, scale,
            scaledWidth, scaledHeight,
            handles: handles.map(h => ({
                ...h,
                screenX: centerX + Math.cos(rotation * Math.PI / 180) * h.x - Math.sin(rotation * Math.PI / 180) * h.y,
                screenY: centerY + Math.sin(rotation * Math.PI / 180) * h.x + Math.cos(rotation * Math.PI / 180) * h.y
            })),
            rotateHandle: {
                type: 'rotate',
                screenX: centerX + Math.cos(rotation * Math.PI / 180) * rotateX - Math.sin(rotation * Math.PI / 180) * rotateY,
                screenY: centerY + Math.sin(rotation * Math.PI / 180) * rotateX + Math.cos(rotation * Math.PI / 180) * rotateY
            }
        };
    }
    
    // 再生コントロール
    play() {
        if (this.isPlaying) {
            this.pause();
            return;
        }
        
        // ループ再生チェックボックスの状態を取得
        this.loopPlayback = document.getElementById('loopPlaybackCheckbox').checked;
        
        // ループ範囲の決定
        let loopStart = 0;
        let loopEnd = this.duration;
        
        if (this.loopPlayback && this.inPoint !== null && this.outPoint !== null) {
            loopStart = this.inPoint;
            loopEnd = this.outPoint;
            // 再生開始位置がループ範囲外なら範囲内に移動
            if (this.currentTime < loopStart || this.currentTime >= loopEnd) {
                this.currentTime = loopStart;
            }
        }
        
        this.isPlaying = true;
        const playButton = document.getElementById('playButton');
        playButton.innerHTML = '<img src="pause.png" alt="一時停止" class="button-icon">';
        playButton.title = '一時停止';
        
        const frameInterval = 1 / this.fps; // 1フレームあたりの秒数
        let lastFrameTime = performance.now();
        let accumulatedTime = 0;
        
        const playbackLoop = () => {
            if (!this.isPlaying) return;
            
            const now = performance.now();
            const deltaTime = (now - lastFrameTime) / 1000; // 経過時間（秒）
            lastFrameTime = now;
            
            accumulatedTime += deltaTime;
            
            // フレーム単位で進める
            if (accumulatedTime >= frameInterval) {
                const framesToAdvance = Math.floor(accumulatedTime / frameInterval);
                this.currentTime += framesToAdvance * frameInterval;
                accumulatedTime -= framesToAdvance * frameInterval;
                
                // ループ処理
                if (this.loopPlayback && this.inPoint !== null && this.outPoint !== null) {
                    // 選択範囲でのループ
                    if (this.currentTime >= loopEnd) {
                        this.currentTime = loopStart;
                        accumulatedTime = 0;
                    }
                } else {
                    // 通常のループまたは停止
                    if (this.currentTime >= this.duration) {
                        if (this.loopPlayback) {
                            this.currentTime = 0;
                            accumulatedTime = 0;
                        } else {
                            this.stop();
                            return;
                        }
                    }
                }
                
                this.updateTimeDisplay();
                this.updatePreview();
                this.drawTimeline();
            }
            
            this.playbackAnimationFrame = requestAnimationFrame(playbackLoop);
        };
        
        this.playbackAnimationFrame = requestAnimationFrame(playbackLoop);
    }
    
    pause() {
        this.isPlaying = false;
        const playButton = document.getElementById('playButton');
        playButton.innerHTML = '<img src="play.png" alt="再生" class="button-icon">';
        playButton.title = '再生';
        
        if (this.playbackAnimationFrame) {
            cancelAnimationFrame(this.playbackAnimationFrame);
            this.playbackAnimationFrame = null;
        }
        
        // すべての音声と動画を一時停止
        this.clips.forEach(clip => {
            if (clip.audioElement && !clip.audioElement.paused) {
                clip.audioElement.pause();
            }
            if (clip.videoElement && !clip.videoElement.paused) {
                clip.videoElement.pause();
            }
        });
    }
    
    stop() {
        this.pause();
        this.currentTime = 0;
        
        // すべての音声を停止
        this.clips.forEach(clip => {
            if (clip.audioElement && !clip.audioElement.paused) {
                clip.audioElement.pause();
                clip.audioElement.currentTime = 0;
            }
        });
        
        this.updateTimeDisplay();
        this.updatePreview();
        this.drawTimeline();
    }
    
    // インポイントを設定
    setInPoint() {
        this.inPoint = this.currentTime;
        this.drawTimeline();
        this.drawRuler();
        
        // 書き出し開始時間を更新
        document.getElementById('exportStart').value = this.inPoint.toFixed(2);
        
        this.showNotification(`📍 インポイント設定: ${this.formatTime(this.inPoint)}`);
    }
    
    // アウトポイントを設定
    setOutPoint() {
        this.outPoint = this.currentTime;
        if (this.inPoint !== null && this.outPoint < this.inPoint) {
            // アウトポイントがインポイントより前の場合は入れ替え
            [this.inPoint, this.outPoint] = [this.outPoint, this.inPoint];
            // 入れ替えた場合は両方の値を更新
            document.getElementById('exportStart').value = this.inPoint.toFixed(2);
            document.getElementById('exportEnd').value = this.outPoint.toFixed(2);
        } else {
            // 書き出し終了時間を更新
            document.getElementById('exportEnd').value = this.outPoint.toFixed(2);
        }
        this.drawTimeline();
        this.drawRuler();
        this.showNotification(`📍 アウトポイント設定: ${this.formatTime(this.outPoint)}`);
    }
    
    // インアウトポイントをクリア
    clearInOutPoints() {
        this.inPoint = null;
        this.outPoint = null;
        this.drawTimeline();
        this.drawRuler();
        
        // 書き出し範囲をデフォルト値にリセット
        document.getElementById('exportStart').value = '0';
        const projectDuration = Math.max(...this.clips.map(c => c.startTime + c.duration), this.duration);
        document.getElementById('exportEnd').value = projectDuration.toFixed(2);
        
        this.showNotification('❌ ループ範囲をクリアしました');
    }
    
    // 時間をフォーマット
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    }
    
    updateTimeDisplay() {
        const totalSeconds = Math.floor(this.currentTime);
        const milliseconds = Math.floor((this.currentTime % 1) * 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
        document.getElementById('timeDisplay').textContent = timeStr;
    }
    
    // UI操作
    changeFPS(newFPS) {
        this.fps = parseInt(newFPS);
        console.log(`📹 FPSを${this.fps}に変更しました`);
        
        // 再生中の場合、フレームレートの変更を反映
        if (this.isPlaying) {
            this.pause();
            this.play();
        }
        
        this.showNotification(`📹 FPS: ${this.fps}`);
    }
    
    increaseTrackCount() {
        this.trackCount++;
        document.getElementById('trackCount').textContent = this.trackCount;
        this.updateTimelineSize();
        this.drawTimeline();
        this.drawRuler();
    }
    
    decreaseTrackCount() {
        if (this.trackCount > 1) {
            this.trackCount--;
            document.getElementById('trackCount').textContent = this.trackCount;
            this.updateTimelineSize();
            this.drawTimeline();
            this.drawRuler();
        }
    }
    
    deleteSelected() {
        if (!this.selectedClip) return;
        
        const clipToDelete = this.selectedClip;
        
        // 親から子を削除
        if (clipToDelete.parentId) {
            const parent = this.clips.find(c => c.id === clipToDelete.parentId);
            if (parent && parent.childrenIds) {
                parent.childrenIds = parent.childrenIds.filter(id => id !== clipToDelete.id);
            }
        }
        
        // 子の親参照を削除
        if (clipToDelete.childrenIds) {
            clipToDelete.childrenIds.forEach(childId => {
                const child = this.clips.find(c => c.id === childId);
                if (child) {
                    child.parentId = null;
                }
            });
        }
        
        const index = this.clips.indexOf(clipToDelete);
        if (index !== -1) {
            this.clips.splice(index, 1);
            this.selectedClip = null;
            this.updatePropertiesPanel();
            this.drawTimeline();
            this.updatePreview();
            this.saveHistory();
        }
    }
    
    // 選択したクリップからシーンを作成
    createSceneFromSelection() {
        if (!this.selectedClip) {
            alert('クリップを選択してください');
            return;
        }
        
        const sceneName = prompt('シーン名を入力してください:', 'New Scene');
        if (!sceneName) return;
        
        // 新しいシーンを作成
        const sceneId = this.sceneManager.createScene(sceneName);
        const newScene = this.sceneManager.scenes[sceneId];
        
        // 選択されたクリップをシーンに移動
        const selectedClip = this.selectedClip;
        const clipCopy = JSON.parse(JSON.stringify(selectedClip));
        
        // クリップの開始時間を0にリセット
        clipCopy.startTime = 0;
        
        newScene.clips.push(clipCopy);
        
        // 元のクリップを削除
        this.deleteSelected();
        
        // シーン素材を作成
        const assetId = this.sceneManager.createSceneAsset(sceneId);
        
        // シーンクリップをタイムラインに配置
        const asset = this.assets.find(a => a.id === assetId);
        if (asset) {
            const newClip = this.sceneManager.createSceneClip(sceneId, selectedClip.track, selectedClip.startTime);
            if (newClip) {
                this.clips.push(newClip);
                this.drawTimeline();
                this.updatePreview();
                this.saveHistory('シーン作成');
            }
        }
        
        this.showNotification(`✅ シーン「${sceneName}」を作成しました`);
    }
    
    togglePropertySection(sectionName) {
        const content = document.getElementById(`${sectionName}Content`);
        const toggle = document.getElementById(`${sectionName}Toggle`);
        
        if (content && toggle) {
            content.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
            
            // 状態を保存
            this.propertySectionStates[sectionName] = !content.classList.contains('collapsed');
        }
    }
    
    toggleAEProperty(propertyName) {
        const content = document.getElementById(`${propertyName}Content`);
        const icon = document.getElementById(`${propertyName}Icon`);
        
        if (content && icon) {
            content.classList.toggle('collapsed');
            icon.classList.toggle('expanded');
            
            // 状態を保存
            this.aePropertyStates[propertyName] = !content.classList.contains('collapsed');
        }
    }
    
    toggleEffect(effectName) {
        const controls = document.getElementById(`${effectName}Controls`);
        if (controls.classList.contains('active')) {
            controls.classList.remove('active');
        } else {
            controls.classList.add('active');
        }
    }
    
    setExportRangeToAll() {
        document.getElementById('exportStart').value = 0;
        
        let maxEnd = 10;
        this.clips.forEach(clip => {
            const end = clip.startTime + clip.duration;
            if (end > maxEnd) maxEnd = end;
        });
        
        document.getElementById('exportEnd').value = maxEnd.toFixed(1);
    }
    
    setExportRangeToSelection() {
        if (!this.selectedClip) {
            alert('クリップを選択してください');
            return;
        }
        
        document.getElementById('exportStart').value = this.selectedClip.startTime.toFixed(2);
        document.getElementById('exportEnd').value = (this.selectedClip.startTime + this.selectedClip.duration).toFixed(2);
    }
    
    // キーボードショートカット
    handleKeyDown(e) {
        // Ctrl/Cmd判定（MacとWindowsの両対応）
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const cmdKey = isMac ? e.metaKey : e.ctrlKey;
        
        if (e.key === 'Delete' && this.selectedClip) {
            this.deleteSelected();
        }
        
        // Ctrl/Cmd + Z: 元に戻す
        if (cmdKey && e.key === 'z') {
            e.preventDefault();
            this.undo();
        }
        
        // Ctrl/Cmd + Y: やり直し
        if (cmdKey && e.key === 'y') {
            e.preventDefault();
            this.redo();
        }
        
        // Ctrl/Cmd + S: プロジェクト保存
        if (cmdKey && e.key === 's') {
            e.preventDefault();
            this.saveProject();
        }
        
        // Ctrl/Cmd + O: プロジェクト読み込み
        if (cmdKey && e.key === 'o') {
            e.preventDefault();
            this.openProject();
        }
        
        // Ctrl/Cmd + E: 書き出しメニューを開く
        if (cmdKey && e.key === 'e') {
            e.preventDefault();
            this.openExportMenu();
        }
        
        if (e.key === ' ') {
            e.preventDefault();
            if (this.isPlaying) {
                this.pause();
            } else {
                this.play();
            }
        }
        
        // I: インポイント設定
        if (e.key === 'i' || e.key === 'I') {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.setInPoint();
            }
        }
        
        // O: アウトポイント設定
        if (e.key === 'o' || e.key === 'O') {
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                this.setOutPoint();
            }
        }
    }
    
    // Undo/Redo
    saveHistory() {
        // assetは参照のみ保存（IDで復元）
        const clipsForSave = this.clips.map(clip => ({
            ...clip,
            assetId: clip.asset.id, // asset IDのみ保存
            asset: undefined, // assetオブジェクトは保存しない
            imageElement: undefined,
            videoElement: undefined,
            audioElement: undefined,
            sequenceImages: undefined,
            gainNode: undefined,
            panNode: undefined,
            sourceNode: undefined
        }));
        
        const state = JSON.stringify({
            clips: clipsForSave,
            effects: this.effects
        });
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        this.historyIndex++;
        
        if (this.history.length > 50) {
            this.history.shift();
            this.historyIndex--;
        }
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadHistory();
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadHistory();
        }
    }
    
    loadHistory() {
        const state = JSON.parse(this.history[this.historyIndex]);
        
        // 古いクリップのDOM要素を完全に破棄
        this.clips.forEach(clip => {
            if (clip.videoElement) {
                clip.videoElement.pause();
                clip.videoElement.src = '';
                clip.videoElement = null;
            }
            if (clip.audioElement) {
                clip.audioElement.pause();
                clip.audioElement.src = '';
                clip.audioElement = null;
            }
            if (clip.imageElement) {
                clip.imageElement = null;
            }
            if (clip.sequenceImages) {
                clip.sequenceImages = null;
            }
            // Web Audio APIノードの破棄
            if (clip.sourceNode) {
                try {
                    clip.sourceNode.disconnect();
                } catch (e) {}
                clip.sourceNode = null;
            }
            if (clip.gainNode) {
                try {
                    clip.gainNode.disconnect();
                } catch (e) {}
                clip.gainNode = null;
            }
            if (clip.panNode) {
                try {
                    clip.panNode.disconnect();
                } catch (e) {}
                clip.panNode = null;
            }
        });
        
        // クリップを復元（assetを再接続）
        this.clips = state.clips.map(clipData => {
            // assetIdから実際のassetを取得
            const asset = this.assets.find(a => a.id === clipData.assetId);
            if (!asset) {
                console.warn('Asset not found:', clipData.assetId);
                return null;
            }
            
            const clip = {
                ...clipData,
                asset: asset, // 実際のassetオブジェクトを再接続
                imageElement: null,
                videoElement: null,
                audioElement: null,
                sequenceImages: null,
                sourceNode: null,
                gainNode: null,
                panNode: null
            };
            
            // 音声素材または動画素材の場合、AudioElementを準備
            if (asset.type === 'audio' || asset.type === 'video') {
                this.prepareAudioClip(clip);
            }
            
            return clip;
        }).filter(clip => clip !== null); // nullを除外
        
        this.effects = state.effects;
        
        // 選択中のクリップをクリア
        this.selectedClip = null;
        
        this.drawTimeline();
        this.updatePreview();
        this.updatePropertiesPanel();
    }
    
    // プロジェクト保存/読み込み
    async saveProject() {
        // プロジェクト名を入力
        const projectName = prompt('プロジェクト名を入力してください:', 'starlit_project');
        if (!projectName) return; // キャンセルされた場合
        
        const project = {
            version: '2.2.0',
            projectName: projectName,
            clips: this.clips.map(clip => ({
                ...clip,
                asset: {
                    id: clip.asset.id,
                    name: clip.asset.name,
                    type: clip.asset.type,
                    // 連番の場合はフレーム数も保存
                    ...(clip.asset.type === 'sequence' ? { frameCount: clip.asset.frameCount } : {}),
                    // シーン素材の場合はシーンIDも保存
                    ...(clip.asset.type === 'scene' ? { sceneId: clip.asset.sceneId } : {})
                }
            })),
            // エフェクトのenabledフラグのみ保存（パラメーターはlocalStorageに保存済み）
            effectsEnabled: {
                letterbox: this.effects.letterbox.enabled,
                gradient: this.effects.gradient.enabled,
                diffusion: this.effects.diffusion.enabled,
                colorKey: this.effects.colorKey.enabled,
                normalize: this.effects.normalize.enabled
            },
            // ディフュージョンキーフレームはプロジェクトに保存
            diffusionKeyframes: this.effects.diffusion.keyframes,
            // トラック名を保存
            trackNames: this.trackNames,
            // シーンデータを保存
            sceneData: this.sceneManager.serialize(),
            settings: {
                fps: this.fps,
                duration: this.duration,
                resolution: {
                    width: this.previewCanvas.width,
                    height: this.previewCanvas.height
                }
            }
        };
        
        // プロジェクトJSONを保存
        const projectBlob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const projectUrl = URL.createObjectURL(projectBlob);
        const projectLink = document.createElement('a');
        projectLink.href = projectUrl;
        projectLink.download = `${projectName}.json`;
        projectLink.click();
        URL.revokeObjectURL(projectUrl);
        
        // 素材ZIPを生成して保存
        this.showNotification('📦 素材をZIPに圧縮中...');
        await this.saveAssetsZip(projectName);
        this.showNotification('✅ プロジェクトと素材を保存しました！');
    }
    
    // 素材をZIPで保存
    async saveAssetsZip(projectName) {
        if (this.assets.length === 0) {
            this.showNotification('⚠️ 保存する素材がありません');
            return;
        }
        
        const zip = new JSZip();
        const assetsFolder = zip.folder('assets');
        
        // 各素材をZIPに追加
        for (const asset of this.assets) {
            if (asset.type === 'sequence') {
                // 連番画像の場合、フォルダを作成
                const sequenceFolder = assetsFolder.folder(asset.name.replace(' (連番)', ''));
                for (let i = 0; i < asset.files.length; i++) {
                    const file = asset.files[i];
                    sequenceFolder.file(file.name, file);
                }
            } else {
                // 通常ファイル
                assetsFolder.file(asset.name, asset.file);
            }
        }
        
        // ZIPを生成してダウンロード
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = URL.createObjectURL(zipBlob);
        const zipLink = document.createElement('a');
        zipLink.href = zipUrl;
        zipLink.download = `${projectName}_assets.zip`;
        zipLink.click();
        URL.revokeObjectURL(zipUrl);
    }
    
    openProject() {
        document.getElementById('projectInput').click();
    }
    
    handleProjectLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const project = JSON.parse(e.target.result);
                
                // プロジェクトデータを一時保存
                this.pendingProject = project;
                
                // 設定を復元
                if (project.settings) {
                    if (project.settings.fps) {
                        this.fps = project.settings.fps;
                        document.getElementById('fpsSelect').value = this.fps;
                    }
                }
                
                // エフェクトのenabledフラグのみ復元（パラメーターはlocalStorageから既に読み込み済み）
                if (project.effectsEnabled) {
                    this.effects.letterbox.enabled = project.effectsEnabled.letterbox || false;
                    this.effects.gradient.enabled = project.effectsEnabled.gradient || false;
                    this.effects.diffusion.enabled = project.effectsEnabled.diffusion || false;
                    this.effects.colorKey.enabled = project.effectsEnabled.colorKey || false;
                    this.effects.normalize.enabled = project.effectsEnabled.normalize || false;
                }
                
                // ディフュージョンキーフレームを復元
                if (project.diffusionKeyframes) {
                    this.effects.diffusion.keyframes = project.diffusionKeyframes;
                    this.updateDiffusionKeyframeList();
                }
                
                // トラック名を復元
                if (project.trackNames && Array.isArray(project.trackNames)) {
                    this.trackNames = project.trackNames;
                    this.updateTrackPanel();
                }
                
                // シーンデータを復元
                if (project.sceneData) {
                    this.sceneManager.deserialize(project.sceneData);
                }
                
                // UIを更新
                this.updateEffectUI();
                this.updatePreview();
                
                // 素材ZIP読み込みを促す
                const projectName = project.projectName || 'プロジェクト';
                if (confirm(`プロジェクト「${projectName}」を読み込みました。\n\n続いて素材ZIPファイル（${projectName}_assets.zip）を選択してください。`)) {
                    document.getElementById('assetsZipInput').click();
                } else {
                    this.showNotification('⚠️ 素材なしでプロジェクトを読み込みました');
                    this.pendingProject = null;
                }
                
            } catch (err) {
                alert('プロジェクトの読み込みに失敗しました:\n' + err.message);
            }
        };
        reader.readAsText(file);
    }
    
    // 素材ZIPを読み込み
    async handleAssetsZipLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            this.showNotification('📦 素材ZIPを展開中...');
            
            const zip = await JSZip.loadAsync(file);
            const assetsFolder = zip.folder('assets');
            
            if (!assetsFolder) {
                throw new Error('ZIPファイル内にassetsフォルダが見つかりません');
            }
            
            // 素材をクリア
            this.assets = [];
            
            // 連番画像を格納するマップ
            const sequenceFolders = new Map();
            
            // ZIPから素材を復元
            const filePromises = [];
            assetsFolder.forEach((relativePath, zipEntry) => {
                if (zipEntry.dir) return; // ディレクトリはスキップ
                
                const pathParts = relativePath.split('/');
                
                if (pathParts.length > 1) {
                    // 連番画像（フォルダ内のファイル）
                    const folderName = pathParts[0];
                    if (!sequenceFolders.has(folderName)) {
                        sequenceFolders.set(folderName, []);
                    }
                    
                    const promise = zipEntry.async('blob').then(blob => {
                        const fileName = pathParts[pathParts.length - 1];
                        const mimeType = this.getMimeTypeFromFileName(fileName);
                        const file = new File([blob], fileName, { type: mimeType });
                        sequenceFolders.get(folderName).push(file);
                    });
                    filePromises.push(promise);
                    
                } else {
                    // 通常ファイル
                    const fileName = pathParts[0];
                    const promise = zipEntry.async('blob').then(blob => {
                        const mimeType = this.getMimeTypeFromFileName(fileName);
                        const file = new File([blob], fileName, { type: mimeType });
                        this.addAsset(file);
                    });
                    filePromises.push(promise);
                }
            });
            
            // すべてのファイルを読み込み完了まで待つ
            await Promise.all(filePromises);
            
            // 連番画像を追加
            for (const [folderName, files] of sequenceFolders) {
                files.sort((a, b) => a.name.localeCompare(b.name));
                this.addSequenceAsset(files);
            }
            
            // プロジェクトデータからクリップを復元
            if (this.pendingProject) {
                await this.restoreClipsFromProject(this.pendingProject);
                this.pendingProject = null;
            }
            
            this.showNotification('✅ 素材を復元しました！');
            this.renderAssets();
            
        } catch (err) {
            alert('素材ZIPの読み込みに失敗しました:\n' + err.message);
        }
        
        // ファイル入力をリセット
        event.target.value = '';
    }
    
    // ファイル名からMIMEタイプを取得
    getMimeTypeFromFileName(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        
        const mimeTypes = {
            // 画像
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'bmp': 'image/bmp',
            'svg': 'image/svg+xml',
            
            // 動画
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'ogg': 'video/ogg',
            'mov': 'video/quicktime',
            'avi': 'video/x-msvideo',
            
            // 音声
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'ogg': 'audio/ogg',
            'flac': 'audio/flac',
            'm4a': 'audio/mp4'
        };
        
        return mimeTypes[ext] || 'application/octet-stream';
    }
    
    // プロジェクトデータからクリップを復元
    async restoreClipsFromProject(project) {
        // クリップをクリア
        this.clips = [];
        
        console.log('📦 プロジェクトからクリップを復元中...', project.clips.length, 'クリップ');
        console.log('📁 利用可能な素材:', this.assets.map(a => a.name));
        
        // クリップを復元
        for (const clipData of project.clips) {
            // 素材を名前で検索
            const asset = this.assets.find(a => a.name === clipData.asset.name);
            
            if (!asset) {
                console.warn(`❌ 素材が見つかりません: ${clipData.asset.name}`);
                continue;
            }
            
            console.log(`✅ 素材を発見: ${asset.name}, type: ${asset.type}, url: ${asset.url ? '有' : '無'}`);
            
            // クリップを復元（assetは完全に置き換え）
            const clip = {
                id: clipData.id,
                track: clipData.track,
                startTime: clipData.startTime,
                duration: clipData.duration,
                inPoint: clipData.inPoint,
                x: clipData.x,
                y: clipData.y,
                scale: clipData.scale,
                rotation: clipData.rotation,
                opacity: clipData.opacity,
                volume: clipData.volume,
                pan: clipData.pan !== undefined ? clipData.pan : 0,
                blendMode: clipData.blendMode || 'normal',
                anchorPoint: clipData.anchorPoint || { x: 0.5, y: 0.5 },
                keyframes: clipData.keyframes,
                clipEffects: clipData.clipEffects || {},
                transitionIn: clipData.transitionIn || null,
                transitionOut: clipData.transitionOut || null,
                asset: asset  // 新しく読み込んだassetオブジェクトを使用
            };
            
            // 古いプロジェクトとの互換性：panが無い場合はデフォルト値を設定
            if (clip.pan === undefined) {
                clip.pan = 0;
            }
            if (!clip.keyframes.pan) {
                clip.keyframes.pan = [{time: 0, value: 0}];
            }
            
            // 音声素材または動画素材の場合、AudioElementを準備
            if (asset.type === 'audio' || asset.type === 'video') {
                this.prepareAudioClip(clip);
            }
            
            this.clips.push(clip);
            console.log(`✅ クリップを復元: ${clip.asset.name}, asset.url: ${clip.asset.url}`);
        }
        
        console.log('✅ クリップ復元完了:', this.clips.length, 'クリップ');
        
        this.drawTimeline();
        this.updatePreview();
    }
    
    newProject() {
        if (confirm('新規プロジェクトを作成しますか?未保存の変更は失われます。')) {
            this.clips = [];
            this.selectedClip = null;
            this.currentTime = 0;
            
            // エフェクトのenabledフラグをリセット（パラメーターはlocalStorageに残る）
            this.effects.letterbox.enabled = false;
            this.effects.gradient.enabled = false;
            
            this.drawTimeline();
            this.updatePreview();
            this.updatePropertiesPanel();
            this.updateEffectUI(); // エフェクトUIも更新
        }
    }
    
    // エフェクト設定の保存・読込（ファイルとしてエクスポート/インポート用）
    saveEffectSettings() {
        const settings = {
            version: '1.0',
            type: 'effect_settings',
            timestamp: new Date().toISOString(),
            // パラメーターのみ（enabledフラグは含めない）
            effectParameters: {
                letterbox: {
                    height: this.effects.letterbox.height,
                    color: this.effects.letterbox.color
                },
                gradient: {
                    top: {
                        color: this.effects.gradient.top.color,
                        height: this.effects.gradient.top.height,
                        opacity: this.effects.gradient.top.opacity,
                        blendMode: this.effects.gradient.top.blendMode
                    },
                    bottom: {
                        color: this.effects.gradient.bottom.color,
                        height: this.effects.gradient.bottom.height,
                        opacity: this.effects.gradient.bottom.opacity,
                        blendMode: this.effects.gradient.bottom.blendMode
                    }
                },
                diffusion: {
                    blur: this.effects.diffusion.blur,
                    contrast: this.effects.diffusion.contrast,
                    brightness: this.effects.diffusion.brightness,
                    saturation: this.effects.diffusion.saturation,
                    opacity: this.effects.diffusion.opacity
                }
            }
        };
        
        // キャッシュに保存（自動）
        this.saveSettingsToCache();
        
        // ファイルとしても保存（バックアップ用）
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // タイムスタンプ付きファイル名
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `starlit_effect_settings_${dateStr}.json`;
        
        a.click();
        URL.revokeObjectURL(url);
        
        // 成功メッセージ
        this.showNotification('💾 エフェクトパラメーターを保存しました（ファイル + キャッシュ）');
    }
    
    loadEffectSettings() {
        document.getElementById('effectSettingsInput').click();
    }
    
    // クリップエフェクトの設定を保存
    saveClipEffectSettings() {
        if (!this.selectedClip) {
            alert('クリップを選択してください');
            return;
        }
        
        const clip = this.selectedClip;
        const settings = {
            version: '1.0',
            type: 'clip_effect_settings',
            timestamp: new Date().toISOString(),
            clipEffects: {
                transitionIn: clip.transitionIn,
                transitionOut: clip.transitionOut,
                puppet: clip.puppet,
                windShake: clip.windShake,
                gaussianBlur: clip.gaussianBlur,
                lensBlur: clip.lensBlur
            }
        };
        
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `clip_effect_settings_${dateStr}.json`;
        
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('💾 クリップエフェクト設定を保存しました');
    }
    
    // クリップエフェクトの設定を読込
    loadClipEffectSettings() {
        if (!this.selectedClip) {
            alert('クリップを選択してください');
            return;
        }
        
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const settings = JSON.parse(event.target.result);
                    
                    if (settings.type !== 'clip_effect_settings') {
                        alert('クリップエフェクト設定ファイルではありません');
                        return;
                    }
                    
                    const clip = this.selectedClip;
                    
                    // エフェクト設定を適用
                    if (settings.clipEffects.transitionIn) {
                        clip.transitionIn = settings.clipEffects.transitionIn;
                    }
                    if (settings.clipEffects.transitionOut) {
                        clip.transitionOut = settings.clipEffects.transitionOut;
                    }
                    if (settings.clipEffects.puppet) {
                        clip.puppet = settings.clipEffects.puppet;
                    }
                    if (settings.clipEffects.windShake) {
                        clip.windShake = settings.clipEffects.windShake;
                    }
                    if (settings.clipEffects.gaussianBlur) {
                        clip.gaussianBlur = settings.clipEffects.gaussianBlur;
                    }
                    if (settings.clipEffects.lensBlur) {
                        clip.lensBlur = settings.clipEffects.lensBlur;
                    }
                    
                    this.updatePreview();
                    this.showNotification('📂 クリップエフェクト設定を読み込みました');
                    
                    // ウィンドウが開いている場合は再描画
                    const effectWindow = document.getElementById('clipEffectTabWindow');
                    if (effectWindow) {
                        effectWindow.remove();
                        this.openClipEffectWindow();
                    }
                } catch (error) {
                    console.error('設定読込エラー:', error);
                    alert('設定ファイルの読み込みに失敗しました');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    handleEffectSettingsLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                
                // バージョンチェック
                if (settings.type !== 'effect_settings') {
                    throw new Error('エフェクト設定ファイルではありません');
                }
                
                // パラメーターのみ復元（enabledフラグは触らない）
                if (settings.effectParameters) {
                    // レターボックスパラメーター
                    if (settings.effectParameters.letterbox) {
                        this.effects.letterbox.height = settings.effectParameters.letterbox.height;
                        this.effects.letterbox.color = settings.effectParameters.letterbox.color;
                    }
                    
                    // グラデーションパラメーター
                    if (settings.effectParameters.gradient) {
                        const grad = settings.effectParameters.gradient;
                        if (grad.top) {
                            this.effects.gradient.top.color = grad.top.color;
                            this.effects.gradient.top.height = grad.top.height;
                            this.effects.gradient.top.opacity = grad.top.opacity;
                            this.effects.gradient.top.blendMode = grad.top.blendMode || 'normal';
                        }
                        if (grad.bottom) {
                            this.effects.gradient.bottom.color = grad.bottom.color;
                            this.effects.gradient.bottom.height = grad.bottom.height;
                            this.effects.gradient.bottom.opacity = grad.bottom.opacity;
                            this.effects.gradient.bottom.blendMode = grad.bottom.blendMode || 'normal';
                        }
                    }
                    
                    // ディフュージョンパラメーター
                    if (settings.effectParameters.diffusion) {
                        const diff = settings.effectParameters.diffusion;
                        this.effects.diffusion.blur = diff.blur || 0;
                        this.effects.diffusion.contrast = diff.contrast || 0;
                        this.effects.diffusion.brightness = diff.brightness || 0;
                        this.effects.diffusion.saturation = diff.saturation || 0;
                        this.effects.diffusion.opacity = diff.opacity !== undefined ? diff.opacity : 100;
                    }
                }
                
                // UIを更新
                this.updateEffectUI();
                this.updatePreview();
                
                // キャッシュにも保存
                this.saveSettingsToCache();
                
                // 成功メッセージ
                this.showNotification('📂 エフェクトパラメーターを読み込みました');
                
            } catch (err) {
                alert('エフェクト設定の読み込みに失敗しました:\n' + err.message);
            }
        };
        reader.readAsText(file);
        
        // ファイル入力をリセット（同じファイルを再度選択可能にする）
        event.target.value = '';
    }
    
    // クリップエフェクト設定を保存
    saveClipEffectSettings() {
        if (!this.selectedClip) {
            alert('クリップが選択されていません');
            return;
        }
        
        const settings = {
            version: '1.0',
            type: 'clip_effect_settings',
            timestamp: new Date().toISOString(),
            windShake: this.selectedClip.windShake,
            gaussianBlur: this.selectedClip.gaussianBlur,
            lensBlur: this.selectedClip.lensBlur
        };
        
        // ファイルとして保存
        const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = `starlit_clip_effect_${dateStr}.json`;
        
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('💾 クリップエフェクト設定を保存しました');
    }
    
    // クリップエフェクト設定を読み込み
    loadClipEffectSettings() {
        if (!this.selectedClip) {
            alert('クリップが選択されていません');
            return;
        }
        document.getElementById('clipEffectSettingsInput').click();
    }
    
    handleClipEffectSettingsLoad(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!this.selectedClip) {
            alert('クリップが選択されていません');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const settings = JSON.parse(e.target.result);
                
                if (settings.type !== 'clip_effect_settings') {
                    throw new Error('クリップエフェクト設定ファイルではありません');
                }
                
                // windShake設定を復元
                if (settings.windShake) {
                    this.selectedClip.windShake = settings.windShake;
                }
                
                // ブラーエフェクト設定を復元
                if (settings.gaussianBlur) {
                    this.selectedClip.gaussianBlur = settings.gaussianBlur;
                }
                
                if (settings.lensBlur) {
                    this.selectedClip.lensBlur = settings.lensBlur;
                }
                
                // UIを更新
                this.updateWindShakeUI();
                this.updatePreview();
                
                this.showNotification('📂 クリップエフェクト設定を読み込みました');
                
            } catch (err) {
                alert('クリップエフェクト設定の読み込みに失敗しました:\n' + err.message);
            }
        };
        reader.readAsText(file);
        
        event.target.value = '';
    }
    
    // エフェクトUIを設定に合わせて更新
    updateEffectUI() {
        // レターボックス
        document.getElementById('letterboxEnable').checked = this.effects.letterbox.enabled;
        document.getElementById('letterboxHeight').value = this.effects.letterbox.height;
        document.getElementById('letterboxHeightValue').textContent = `${this.effects.letterbox.height}px`;
        document.getElementById('letterboxColor').value = this.effects.letterbox.color;
        
        // グラデーション
        document.getElementById('gradientEnable').checked = this.effects.gradient.enabled;
        
        // 上部
        document.getElementById('gradientTopColor').value = this.effects.gradient.top.color;
        document.getElementById('gradientTopHeight').value = this.effects.gradient.top.height;
        document.getElementById('gradientTopHeightValue').textContent = `${this.effects.gradient.top.height}px`;
        document.getElementById('gradientTopOpacity').value = this.effects.gradient.top.opacity;
        document.getElementById('gradientTopOpacityValue').textContent = `${this.effects.gradient.top.opacity}%`;
        document.getElementById('gradientTopBlendMode').value = this.effects.gradient.top.blendMode;
        
        // 下部
        document.getElementById('gradientBottomColor').value = this.effects.gradient.bottom.color;
        document.getElementById('gradientBottomHeight').value = this.effects.gradient.bottom.height;
        document.getElementById('gradientBottomHeightValue').textContent = `${this.effects.gradient.bottom.height}px`;
        document.getElementById('gradientBottomOpacity').value = this.effects.gradient.bottom.opacity;
        document.getElementById('gradientBottomOpacityValue').textContent = `${this.effects.gradient.bottom.opacity}%`;
        document.getElementById('gradientBottomBlendMode').value = this.effects.gradient.bottom.blendMode;
        
        // ディフュージョン
        document.getElementById('diffusionEnable').checked = this.effects.diffusion.enabled;
        document.getElementById('diffusionBlur').value = this.effects.diffusion.blur;
        document.getElementById('diffusionBlurValue').textContent = `${this.effects.diffusion.blur}`;
        document.getElementById('diffusionContrast').value = this.effects.diffusion.contrast;
        document.getElementById('diffusionContrastValue').textContent = `${this.effects.diffusion.contrast}`;
        document.getElementById('diffusionBrightness').value = this.effects.diffusion.brightness;
        document.getElementById('diffusionBrightnessValue').textContent = `${this.effects.diffusion.brightness}`;
        document.getElementById('diffusionSaturation').value = this.effects.diffusion.saturation;
        document.getElementById('diffusionSaturationValue').textContent = `${this.effects.diffusion.saturation}`;
        document.getElementById('diffusionOpacity').value = this.effects.diffusion.opacity;
        document.getElementById('diffusionOpacityValue').textContent = `${this.effects.diffusion.opacity}%`;
        
        // カラーキー
        document.getElementById('colorKeyEnable').checked = this.effects.colorKey.enabled;
        document.getElementById('colorKeyColor').value = this.effects.colorKey.color;
        document.getElementById('colorKeyTolerance').value = this.effects.colorKey.tolerance;
        document.getElementById('colorKeyToleranceValue').textContent = `${this.effects.colorKey.tolerance}`;
        document.getElementById('colorKeyFeather').value = this.effects.colorKey.feather;
        document.getElementById('colorKeyFeatherValue').textContent = `${this.effects.colorKey.feather}`;
        document.getElementById('colorKeyInvert').checked = this.effects.colorKey.invert;
        
        // ノーマライズ
        document.getElementById('normalizeEnable').checked = this.effects.normalize.enabled;
        document.getElementById('normalizeStrength').value = this.effects.normalize.strength;
        document.getElementById('normalizeStrengthValue').textContent = `${this.effects.normalize.strength}`;
        
        // キーフレームリスト更新
        this.updateDiffusionKeyframeList();
    }
    
    // 通知表示
    showNotification(message) {
        // 既存の通知があれば削除
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }
        
        // 通知要素を作成
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // フェードイン
        setTimeout(() => notification.classList.add('show'), 10);
        
        // 3秒後にフェードアウト
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // キャッシュ（localStorage）への保存・読込
    // パラメーターのみ保存、enabledフラグはプロジェクト依存
    saveSettingsToCache() {
        try {
            const settings = {
                version: '1.0',
                timestamp: new Date().toISOString(),
                effectParameters: {
                    letterbox: {
                        height: this.effects.letterbox.height,
                        color: this.effects.letterbox.color
                    },
                    gradient: {
                        top: {
                            color: this.effects.gradient.top.color,
                            height: this.effects.gradient.top.height,
                            opacity: this.effects.gradient.top.opacity,
                            blendMode: this.effects.gradient.top.blendMode
                        },
                        bottom: {
                            color: this.effects.gradient.bottom.color,
                            height: this.effects.gradient.bottom.height,
                            opacity: this.effects.gradient.bottom.opacity,
                            blendMode: this.effects.gradient.bottom.blendMode
                        }
                    },
                    diffusion: {
                        blur: this.effects.diffusion.blur,
                        contrast: this.effects.diffusion.contrast,
                        brightness: this.effects.diffusion.brightness,
                        saturation: this.effects.diffusion.saturation,
                        opacity: this.effects.diffusion.opacity
                    },
                    colorKey: {
                        color: this.effects.colorKey.color,
                        tolerance: this.effects.colorKey.tolerance,
                        feather: this.effects.colorKey.feather,
                        invert: this.effects.colorKey.invert
                    },
                    normalize: {
                        strength: this.effects.normalize.strength
                    }
                }
            };
            localStorage.setItem('starlitEffectSettings', JSON.stringify(settings));
            console.log('💾 エフェクトパラメーターをキャッシュに保存しました');
        } catch (error) {
            console.error('キャッシュ保存エラー:', error);
        }
    }
    
    loadSettingsFromCache() {
        try {
            const cached = localStorage.getItem('starlitEffectSettings');
            if (cached) {
                const settings = JSON.parse(cached);
                
                // パラメーターのみ復元（enabledフラグはプロジェクト依存なので触らない）
                if (settings.effectParameters) {
                    // レターボックスパラメーター
                    if (settings.effectParameters.letterbox) {
                        this.effects.letterbox.height = settings.effectParameters.letterbox.height;
                        this.effects.letterbox.color = settings.effectParameters.letterbox.color;
                    }
                    
                    // グラデーションパラメーター
                    if (settings.effectParameters.gradient) {
                        const grad = settings.effectParameters.gradient;
                        if (grad.top) {
                            this.effects.gradient.top.color = grad.top.color;
                            this.effects.gradient.top.height = grad.top.height;
                            this.effects.gradient.top.opacity = grad.top.opacity;
                            this.effects.gradient.top.blendMode = grad.top.blendMode || 'normal';
                        }
                        if (grad.bottom) {
                            this.effects.gradient.bottom.color = grad.bottom.color;
                            this.effects.gradient.bottom.height = grad.bottom.height;
                            this.effects.gradient.bottom.opacity = grad.bottom.opacity;
                            this.effects.gradient.bottom.blendMode = grad.bottom.blendMode || 'normal';
                        }
                    }
                    
                    // ディフュージョンパラメーター
                    if (settings.effectParameters.diffusion) {
                        const diff = settings.effectParameters.diffusion;
                        this.effects.diffusion.blur = diff.blur || 0;
                        this.effects.diffusion.contrast = diff.contrast || 0;
                        this.effects.diffusion.brightness = diff.brightness || 0;
                        this.effects.diffusion.saturation = diff.saturation || 0;
                        this.effects.diffusion.opacity = diff.opacity !== undefined ? diff.opacity : 100;
                    }
                    
                    // カラーキーパラメーター
                    if (settings.effectParameters.colorKey) {
                        const ck = settings.effectParameters.colorKey;
                        this.effects.colorKey.color = ck.color || '#00FF00';
                        this.effects.colorKey.tolerance = ck.tolerance !== undefined ? ck.tolerance : 30;
                        this.effects.colorKey.feather = ck.feather !== undefined ? ck.feather : 5;
                        this.effects.colorKey.invert = ck.invert || false;
                    }
                    
                    // ノーマライズパラメーター
                    if (settings.effectParameters.normalize) {
                        const norm = settings.effectParameters.normalize;
                        this.effects.normalize.strength = norm.strength !== undefined ? norm.strength : 1;
                    }
                }
                
                // UIを更新（次のフレームで実行）
                setTimeout(() => {
                    this.updateEffectUI();
                }, 0);
                
                console.log('✨ キャッシュからエフェクトパラメーターを復元しました');
            } else {
                console.log('ℹ️ キャッシュに保存された設定がありません（初回起動）');
            }
        } catch (error) {
            console.error('キャッシュ読込エラー:', error);
        }
    }
    
    // プレビューキャンバスでのマウス操作
    handlePreviewCanvasHover(e) {
        if (this.isPreviewDragging || !this.selectedClip || !this.boundingBoxCache) {
            return;
        }
        
        const rect = this.previewCanvas.getBoundingClientRect();
        
        // プレビューズームを考慮した座標変換
        const zoomFactor = this.previewZoom / 100;
        
        // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
        const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
        const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
        
        // マウス座標をキャンバス中心からの相対座標に変換
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relativeX = (e.clientX - centerX) / zoomFactor;
        const relativeY = (e.clientY - centerY) / zoomFactor;
        
        // キャンバス座標系に変換
        const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
        const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
        
        const handleHitArea = 15;
        
        // 回転ハンドルの判定
        const rotateHandle = this.boundingBoxCache.rotateHandle;
        const distToRotate = Math.sqrt(
            Math.pow(mouseX - rotateHandle.screenX, 2) + 
            Math.pow(mouseY - rotateHandle.screenY, 2)
        );
        
        if (distToRotate < handleHitArea) {
            this.previewCanvas.style.cursor = 'grab';
            // console.log('Hover: Rotate handle');
            return;
        }
        
        // 各ハンドルの判定
        for (let handle of this.boundingBoxCache.handles) {
            const dist = Math.sqrt(
                Math.pow(mouseX - handle.screenX, 2) + 
                Math.pow(mouseY - handle.screenY, 2)
            );
            
            if (dist < handleHitArea) {
                // console.log('Hover: Handle', handle.type);
                // ハンドルタイプに応じたカーソル
                if (handle.type.startsWith('corner-tl') || handle.type.startsWith('corner-br')) {
                    this.previewCanvas.style.cursor = 'nwse-resize';
                } else if (handle.type.startsWith('corner-tr') || handle.type.startsWith('corner-bl')) {
                    this.previewCanvas.style.cursor = 'nesw-resize';
                } else if (handle.type === 'edge-t' || handle.type === 'edge-b') {
                    this.previewCanvas.style.cursor = 'ns-resize';
                } else if (handle.type === 'edge-l' || handle.type === 'edge-r') {
                    this.previewCanvas.style.cursor = 'ew-resize';
                }
                return;
            }
        }
        
        // バウンディングボックス内の判定
        const bbox = this.boundingBoxCache;
        const cos = Math.cos(-bbox.rotation * Math.PI / 180);
        const sin = Math.sin(-bbox.rotation * Math.PI / 180);
        
        const localX = cos * (mouseX - bbox.centerX) - sin * (mouseY - bbox.centerY);
        const localY = sin * (mouseX - bbox.centerX) + cos * (mouseY - bbox.centerY);
        
        if (Math.abs(localX) < bbox.scaledWidth / 2 && Math.abs(localY) < bbox.scaledHeight / 2) {
            this.previewCanvas.style.cursor = 'move';
            // console.log('Hover: Inside bounding box');
        } else {
            this.previewCanvas.style.cursor = 'default';
        }
    }
    
    handlePreviewMouseDown(e) {
        // パペット編集モードの場合
        if (this.isPuppetEditMode && this.selectedClip && this.selectedClip.puppet && this.selectedClip.puppet.enabled) {
            const rect = this.previewCanvas.getBoundingClientRect();
            const zoomFactor = this.previewZoom / 100;
            
            const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
            const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const relativeX = (e.clientX - centerX) / zoomFactor;
            const relativeY = (e.clientY - centerY) / zoomFactor;
            
            const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
            const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
            
            // ピンの位置を確認
            const clip = this.selectedClip;
            const localTime = this.currentTime - clip.startTime;
            const x = this.getKeyframeValue(clip, 'x', localTime);
            const y = this.getKeyframeValue(clip, 'y', localTime);
            const scale = this.getKeyframeValue(clip, 'scale', localTime);
            const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
            
            let w, h;
            if (clip.useOriginalSize && clip.originalWidth) {
                w = clip.originalWidth * scale;
                h = clip.originalHeight * scale;
            } else {
                w = this.previewCanvas.width * 0.5 * scale;
                h = this.previewCanvas.height * 0.5 * scale;
            }
            
            const cx = this.previewCanvas.width / 2 + x;
            const cy = this.previewCanvas.height / 2 + y;
            const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
            
            // 回転を考慮した描画位置
            const rad = rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            // 各ピンの位置をチェック
            for (let pin of clip.puppet.pins) {
                const pinPos = this.getPuppetPinPosition(pin, localTime); // キーフレーム補間
                const pinX = w * pinPos.x;
                const pinY = h * pinPos.y;
                
                // アンカーポイント基準の座標
                const offsetX = pinX - w * anchor.x;
                const offsetY = pinY - h * anchor.y;
                
                // 回転を適用
                const rotatedX = offsetX * cos - offsetY * sin;
                const rotatedY = offsetX * sin + offsetY * cos;
                
                const screenX = cx + rotatedX;
                const screenY = cy + rotatedY;
                
                const dist = Math.sqrt(Math.pow(mouseX - screenX, 2) + Math.pow(mouseY - screenY, 2));
                
                if (dist < 32) { // ピンのクリック判定（少し広く）
                    // 右クリックの場合はピンを削除
                    if (e.button === 2) {
                        e.preventDefault();
                        this.removePuppetPin(pin.id);
                        return;
                    }
                    
                    // 左クリックの場合はドラッグ開始
                    this.isDraggingPuppetPin = true;
                    this.draggingPinId = pin.id;
                    this.previewCanvas.style.cursor = 'move';
                    e.preventDefault();
                    return;
                }
            }
            
            return;
        }
        
        // レンズブラーのフォーカス位置選択モードの処理
        if (this.lensBlurFocusPickMode && this.selectedClip) {
            const rect = this.previewCanvas.getBoundingClientRect();
            const zoomFactor = this.previewZoom / 100;
            
            const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
            const centerY = rect.top + rect.height / 2;
            const relativeY = (e.clientY - centerY) / zoomFactor;
            const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
            
            const clip = this.selectedClip;
            const asset = this.assets.find(a => a.id === clip.assetId);
            if (asset && asset.element) {
                const imgHeight = asset.element.naturalHeight || asset.element.videoHeight || 1080;
                const focusPosition = Math.max(0, Math.min(100, (mouseY / imgHeight) * 100));
                
                if (clip.lensBlur) {
                    clip.lensBlur.focusPosition = focusPosition;
                    document.getElementById('lensBlurFocusPosition').value = focusPosition;
                    document.getElementById('lensBlurFocusPositionValue').textContent = focusPosition.toFixed(0);
                    this.updatePreview();
                }
            }
            
            this.lensBlurFocusPickMode = false;
            document.getElementById('lensBlurPickFocusBtn').textContent = '🎯 キャンバスをクリックしてフォーカス位置を選択';
            document.getElementById('lensBlurPickFocusBtn').style.background = '';
            this.previewCanvas.style.cursor = 'default';
            
            e.preventDefault();
            return;
        }
        
        // WindShake軸選択モードの処理
        if (this.windShakeAxisPickMode && this.selectedClip) {
            const rect = this.previewCanvas.getBoundingClientRect();
            const zoomFactor = this.previewZoom / 100;
            
            // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
            const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
            
            // マウス座標をキャンバス中心からの相対座標に変換
            const centerY = rect.top + rect.height / 2;
            const relativeY = (e.clientY - centerY) / zoomFactor;
            
            // キャンバス座標系に変換 (0-1080の範囲)
            const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
            
            // 画像の実際の高さを取得
            const clip = this.selectedClip;
            const asset = this.assets.find(a => a.id === clip.assetId);
            if (asset && asset.element) {
                const imgHeight = asset.element.naturalHeight || asset.element.videoHeight || 1080;
                
                // Y座標をパーセンテージに変換 (0-100)
                const axisPosition = Math.max(0, Math.min(100, (mouseY / imgHeight) * 100));
                
                // UIを更新
                if (clip.windShake) {
                    clip.windShake.axisPosition = axisPosition;
                    document.getElementById('windShakeAxisPosition').value = axisPosition;
                    document.getElementById('windShakeAxisPositionValue').textContent = axisPosition.toFixed(0);
                    this.updatePreview();
                }
            }
            
            // 軸選択モードを終了
            this.windShakeAxisPickMode = false;
            document.getElementById('windShakePickAxisBtn').textContent = '🎯 キャンバスをクリックして軸を選択';
            document.getElementById('windShakePickAxisBtn').style.background = '';
            this.previewCanvas.style.cursor = 'default';
            
            e.preventDefault();
            return;
        }
        
        // console.log('Preview mousedown triggered');
        if (!this.selectedClip || !this.boundingBoxCache) {
            // console.log('No selected clip or bounding box cache');
            return;
        }
        
        const rect = this.previewCanvas.getBoundingClientRect();
        
        // プレビューズームを考慮した座標変換
        const zoomFactor = this.previewZoom / 100;
        
        // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
        const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
        const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
        
        // マウス座標をキャンバス中心からの相対座標に変換
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relativeX = (e.clientX - centerX) / zoomFactor;
        const relativeY = (e.clientY - centerY) / zoomFactor;
        
        // キャンバス座標系に変換
        const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
        const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
        
        const handleSize = 10;
        const handleHitArea = 15; // クリック判定を少し広げる
        
        // 回転ハンドルの判定
        const rotateHandle = this.boundingBoxCache.rotateHandle;
        const distToRotate = Math.sqrt(
            Math.pow(mouseX - rotateHandle.screenX, 2) + 
            Math.pow(mouseY - rotateHandle.screenY, 2)
        );
        
        if (distToRotate < handleHitArea) {
            // console.log('Clicked rotate handle');
            this.isPreviewDragging = true;
            this.previewDragStart = { x: mouseX, y: mouseY };
            this.previewDragMode = 'rotate';
            this.previewCanvas.style.cursor = 'grabbing';
            
            const localTime = this.currentTime - this.selectedClip.startTime;
            const parentTransform = this.getParentTransform(this.selectedClip, localTime);
            
            this.initialTransform = {
                x: this.getKeyframeValue(this.selectedClip, 'x', localTime),
                y: this.getKeyframeValue(this.selectedClip, 'y', localTime),
                rotation: this.getKeyframeValue(this.selectedClip, 'rotation', localTime),
                scale: this.getKeyframeValue(this.selectedClip, 'scale', localTime),
                centerX: this.boundingBoxCache.centerX,
                centerY: this.boundingBoxCache.centerY,
                parentTransform: parentTransform
            };
            e.preventDefault();
            return;
        }
        
        // 各ハンドルの判定
        for (let handle of this.boundingBoxCache.handles) {
            const dist = Math.sqrt(
                Math.pow(mouseX - handle.screenX, 2) + 
                Math.pow(mouseY - handle.screenY, 2)
            );
            
            if (dist < handleHitArea) {
                // console.log('Clicked handle:', handle.type);
                this.isPreviewDragging = true;
                this.previewDragStart = { x: mouseX, y: mouseY };
                this.previewDragMode = handle.type;
                this.activeHandle = handle;
                
                const localTime = this.currentTime - this.selectedClip.startTime;
                const parentTransform = this.getParentTransform(this.selectedClip, localTime);
                
                this.initialTransform = {
                    x: this.getKeyframeValue(this.selectedClip, 'x', localTime),
                    y: this.getKeyframeValue(this.selectedClip, 'y', localTime),
                    rotation: this.getKeyframeValue(this.selectedClip, 'rotation', localTime),
                    scale: this.getKeyframeValue(this.selectedClip, 'scale', localTime),
                    width: this.boundingBoxCache.scaledWidth,
                    height: this.boundingBoxCache.scaledHeight,
                    centerX: this.boundingBoxCache.centerX,
                    centerY: this.boundingBoxCache.centerY,
                    parentTransform: parentTransform
                };
                e.preventDefault();
                return;
            }
        }
        
        // バウンディングボックス内のクリック判定(位置移動)
        const bbox = this.boundingBoxCache;
        const cos = Math.cos(-bbox.rotation * Math.PI / 180);
        const sin = Math.sin(-bbox.rotation * Math.PI / 180);
        
        // マウス座標を回転を考慮してローカル座標に変換
        const localX = cos * (mouseX - bbox.centerX) - sin * (mouseY - bbox.centerY);
        const localY = sin * (mouseX - bbox.centerX) + cos * (mouseY - bbox.centerY);
        
        if (Math.abs(localX) < bbox.scaledWidth / 2 && Math.abs(localY) < bbox.scaledHeight / 2) {
            // console.log('Clicked inside bounding box for move');
            this.isPreviewDragging = true;
            this.previewDragStart = { x: mouseX, y: mouseY };
            this.previewDragMode = 'move';
            
            const localTime = this.currentTime - this.selectedClip.startTime;
            const parentTransform = this.getParentTransform(this.selectedClip, localTime);
            
            this.initialTransform = {
                x: this.getKeyframeValue(this.selectedClip, 'x', localTime),
                y: this.getKeyframeValue(this.selectedClip, 'y', localTime),
                rotation: this.getKeyframeValue(this.selectedClip, 'rotation', localTime),
                scale: this.getKeyframeValue(this.selectedClip, 'scale', localTime),
                parentTransform: parentTransform  // 親のトランスフォームを保存
            };
            // console.log('isPreviewDragging set to:', this.isPreviewDragging);
            // console.log('previewDragMode:', this.previewDragMode);
            e.preventDefault();
        }
    }
    
    handlePreviewMouseMove(e) {
        // パペットピンドラッグ中
        if (this.isDraggingPuppetPin && this.selectedClip && this.draggingPinId) {
            const rect = this.previewCanvas.getBoundingClientRect();
            const zoomFactor = this.previewZoom / 100;
            
            const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
            const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
            
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const relativeX = (e.clientX - centerX) / zoomFactor;
            const relativeY = (e.clientY - centerY) / zoomFactor;
            
            const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
            const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
            
            const clip = this.selectedClip;
            const localTime = this.currentTime - clip.startTime;
            const x = this.getKeyframeValue(clip, 'x', localTime);
            const y = this.getKeyframeValue(clip, 'y', localTime);
            const scale = this.getKeyframeValue(clip, 'scale', localTime);
            const rotation = this.getKeyframeValue(clip, 'rotation', localTime);
            
            let w, h;
            if (clip.useOriginalSize && clip.originalWidth) {
                w = clip.originalWidth * scale;
                h = clip.originalHeight * scale;
            } else {
                w = this.previewCanvas.width * 0.5 * scale;
                h = this.previewCanvas.height * 0.5 * scale;
            }
            
            const cx = this.previewCanvas.width / 2 + x;
            const cy = this.previewCanvas.height / 2 + y;
            const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
            
            // 回転を逆適用してローカル座標に変換
            const rad = -rotation * Math.PI / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            
            const offsetX = mouseX - cx;
            const offsetY = mouseY - cy;
            
            const rotatedX = offsetX * cos - offsetY * sin;
            const rotatedY = offsetX * sin + offsetY * cos;
            
            // アンカー基準の相対座標を0-1範囲に変換
            const relX = (rotatedX + w * anchor.x) / w;
            const relY = (rotatedY + h * anchor.y) / h;
            
            // ピンのキーフレームを更新（リアルタイム）
            const pin = clip.puppet.pins.find(p => p.id === this.draggingPinId);
            if (pin) {
                const newX = Math.max(0, Math.min(1, relX));
                const newY = Math.max(0, Math.min(1, relY));
                
                // 現在時刻のキーフレームを探すまたは作成
                const existingKf = pin.keyframes.find(kf => Math.abs(kf.time - localTime) < 0.01);
                if (existingKf) {
                    existingKf.x = newX;
                    existingKf.y = newY;
                } else {
                    pin.keyframes.push({ time: localTime, x: newX, y: newY });
                    pin.keyframes.sort((a, b) => a.time - b.time);
                }
                
                this.updatePreviewDebounced(); // デバウンス版を使用
                this.updatePuppetUI();
            }
            
            e.preventDefault();
            return;
        }
        
        if (!this.isPreviewDragging || !this.selectedClip) {
            // console.log('Preview move skipped - isPreviewDragging:', this.isPreviewDragging, 'selectedClip:', !!this.selectedClip);
            return;
        }
        
        // console.log('Preview mouse move - mode:', this.previewDragMode);
        
        const rect = this.previewCanvas.getBoundingClientRect();
        
        // プレビューズームを考慮した座標変換
        const zoomFactor = this.previewZoom / 100;
        
        // CSSピクセルからキャンバスピクセルに変換(ズーム考慮)
        const scaleX = this.previewCanvas.width / (rect.width / zoomFactor);
        const scaleY = this.previewCanvas.height / (rect.height / zoomFactor);
        
        // マウス座標をキャンバス中心からの相対座標に変換
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const relativeX = (e.clientX - centerX) / zoomFactor;
        const relativeY = (e.clientY - centerY) / zoomFactor;
        
        // キャンバス座標系に変換
        const mouseX = this.previewCanvas.width / 2 + relativeX * scaleX;
        const mouseY = this.previewCanvas.height / 2 + relativeY * scaleY;
        
        const dx = mouseX - this.previewDragStart.x;
        const dy = mouseY - this.previewDragStart.y;
        
        if (this.previewDragMode === 'move') {
            // 位置移動
            // スクリーン座標の差分を取得
            const screenDx = mouseX - this.previewDragStart.x;
            const screenDy = mouseY - this.previewDragStart.y;
            
            // 親の回転を逆適用してローカル座標の差分に変換
            const parentRotation = this.initialTransform.parentTransform.rotation;
            const parentScale = this.initialTransform.parentTransform.scale;
            const radians = -(parentRotation * Math.PI / 180);  // 逆回転
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            
            // 親のスケールも考慮
            const localDx = (screenDx * cos - screenDy * sin) / parentScale;
            const localDy = (screenDx * sin + screenDy * cos) / parentScale;
            
            const newX = this.initialTransform.x + localDx;
            const newY = this.initialTransform.y + localDy;
            // console.log('Moving to:', newX, newY);
            this.setKeyframeValueLive('x', newX);
            this.setKeyframeValueLive('y', newY);
            
        } else if (this.previewDragMode === 'rotate') {
            // 回転
            const centerX = this.initialTransform.centerX;
            const centerY = this.initialTransform.centerY;
            
            // 開始角度
            const startAngle = Math.atan2(
                this.previewDragStart.y - centerY,
                this.previewDragStart.x - centerX
            );
            
            // 現在の角度
            const currentAngle = Math.atan2(
                mouseY - centerY,
                mouseX - centerX
            );
            
            // 角度差(度)
            const angleDelta = (currentAngle - startAngle) * 180 / Math.PI;
            const newRotation = this.initialTransform.rotation + angleDelta;
            // console.log('Rotating to:', newRotation);
            
            this.setKeyframeValueLive('rotation', newRotation);
            
        } else if (this.previewDragMode.startsWith('corner-')) {
            // コーナーハンドル: 均等スケール(アスペクト比維持)
            // 中心からの距離の変化でスケールを計算
            const initialDist = Math.sqrt(
                Math.pow(this.previewDragStart.x - this.initialTransform.centerX, 2) +
                Math.pow(this.previewDragStart.y - this.initialTransform.centerY, 2)
            );
            const currentDist = Math.sqrt(
                Math.pow(mouseX - this.initialTransform.centerX, 2) +
                Math.pow(mouseY - this.initialTransform.centerY, 2)
            );
            
            // スケール比率を計算
            const scaleRatio = initialDist > 0 ? currentDist / initialDist : 1;
            const newScale = Math.max(0.1, this.initialTransform.scale * scaleRatio);
            // console.log('Scaling to:', newScale, 'ratio:', scaleRatio);
            
            this.setKeyframeValueLive('scale', newScale);
            
        } else if (this.previewDragMode.startsWith('edge-')) {
            // エッジハンドル: 方向に応じた均等スケール
            let scaleRatio = 1;
            
            if (this.previewDragMode === 'edge-r' || this.previewDragMode === 'edge-l') {
                // 左右エッジ: X方向の変化
                const initialDistX = Math.abs(this.previewDragStart.x - this.initialTransform.centerX);
                const currentDistX = Math.abs(mouseX - this.initialTransform.centerX);
                scaleRatio = initialDistX > 0 ? currentDistX / initialDistX : 1;
            } else if (this.previewDragMode === 'edge-t' || this.previewDragMode === 'edge-b') {
                // 上下エッジ: Y方向の変化
                const initialDistY = Math.abs(this.previewDragStart.y - this.initialTransform.centerY);
                const currentDistY = Math.abs(mouseY - this.initialTransform.centerY);
                scaleRatio = initialDistY > 0 ? currentDistY / initialDistY : 1;
            }
            
            const newScale = Math.max(0.1, this.initialTransform.scale * scaleRatio);
            // console.log('Scaling to:', newScale, 'ratio:', scaleRatio);
            
            this.setKeyframeValueLive('scale', newScale);
        }
        
        this.updatePropertiesPanel();
        
        e.preventDefault();
    }
    
    handlePreviewMouseUp(e) {
        // パペットピンドラッグ終了
        if (this.isDraggingPuppetPin) {
            this.isDraggingPuppetPin = false;
            this.draggingPinId = null;
            
            if (this.isPuppetEditMode) {
                this.previewCanvas.style.cursor = 'crosshair';
            } else {
                this.previewCanvas.style.cursor = 'default';
            }
            
            this.saveHistory();
            return;
        }
        
        if (this.isPreviewDragging) {
            // console.log('Preview drag ended');
            this.isPreviewDragging = false;
            this.previewDragStart = null;
            this.previewDragMode = null;
            this.initialTransform = null;
            this.activeHandle = null;
            this.previewCanvas.style.cursor = 'default';
            
            // タイムラインとプロパティパネルを更新して履歴を保存
            this.drawTimeline();
            this.saveHistory();
        }
    }
    
    // 書き出しメニューを開く
    openExportMenu() {
        // 書き出しダイアログを表示
        const choice = prompt(
            '書き出し形式を選択してください:\n\n' +
            '1: WebM動画 (透過対応・高速)\n' +
            '2: 連番PNG (高品質・MP4変換用)\n' +
            '3: キャンセル',
            '1'
        );
        
        if (choice === '1') {
            this.exportWebM();
        } else if (choice === '2') {
            this.exportSequence();
        }
    }
    
    // 書き出し機能
    async exportVideo() {
        const startTime = parseFloat(document.getElementById('exportStart').value);
        const endTime = parseFloat(document.getElementById('exportEnd').value);
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const duration = endTime - startTime;
        const frames = Math.ceil(duration * this.fps);
        
        if (!confirm(`MP4動画を書き出しますか?\n\n長さ: ${duration.toFixed(2)}秒\nフレーム数: ${frames}\nFPS: ${this.fps}`)) {
            return;
        }
        
        // 進捗表示用の要素を作成
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'JK Maru Gothic M', sans-serif;
            text-align: center;
            min-width: 400px;
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">MP4書き出し中...</h3>
            <div id="exportProgress" style="margin: 10px 0;">FFmpegを読み込み中...</div>
            <div id="exportDetail" style="font-size: 12px; color: #999; margin-top: 10px;">準備中...</div>
        `;
        document.body.appendChild(progressDiv);
        
        const updateProgress = (message, detail = '') => {
            const progressEl = document.getElementById('exportProgress');
            const detailEl = document.getElementById('exportDetail');
            if (progressEl) progressEl.textContent = message;
            if (detailEl) detailEl.textContent = detail;
        };
        
        const originalTime = this.currentTime;
        
        try {
            // FFmpegを初期化
            updateProgress('FFmpegを読み込み中...', '初回のみ時間がかかります');
            await this.loadFFmpeg();
            
            updateProgress('フレームを生成中...', `0/${frames} フレーム`);
            
            const { fetchFile } = FFmpegUtil;
            
            // 各フレームをPNG画像として生成
            for (let i = 0; i < frames; i++) {
                this.currentTime = startTime + (i / this.fps);
                this.updatePreview();
                
                // キャンバスをBlobに変換
                const blob = await new Promise(resolve => {
                    this.previewCanvas.toBlob(resolve, 'image/png');
                });
                
                // FFmpegのファイルシステムに書き込み
                const fileName = `frame${i.toString().padStart(5, '0')}.png`;
                await this.ffmpeg.writeFile(fileName, await fetchFile(blob));
                
                updateProgress(
                    `フレームを生成中...`,
                    `${i + 1}/${frames} フレーム (${Math.floor((i + 1) / frames * 100)}%)`
                );
            }
            
            updateProgress('MP4にエンコード中...', 'FFmpegで変換しています');
            
            // FFmpegでMP4に変換
            await this.ffmpeg.exec([
                '-framerate', this.fps.toString(),
                '-i', 'frame%05d.png',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'medium',
                '-crf', '18',
                'output.mp4'
            ]);
            
            updateProgress('ファイルを生成中...', 'ダウンロード準備中');
            
            // 生成されたMP4を読み込み
            const data = await this.ffmpeg.readFile('output.mp4');
            
            // Blobを作成してダウンロード
            const blob = new Blob([data.buffer], { type: 'video/mp4' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `starlit_timeline_export_${Date.now()}.mp4`;
            a.click();
            
            URL.revokeObjectURL(url);
            
            // 一時ファイルをクリーンアップ
            updateProgress('クリーンアップ中...', 'ファイルを削除しています');
            for (let i = 0; i < frames; i++) {
                const fileName = `frame${i.toString().padStart(5, '0')}.png`;
                try {
                    await this.ffmpeg.deleteFile(fileName);
                } catch (e) {
                    // ファイルが存在しない場合は無視
                }
            }
            await this.ffmpeg.deleteFile('output.mp4');
            
            // 進捗表示を削除
            document.body.removeChild(progressDiv);
            
            // 元の時間に戻す
            this.currentTime = originalTime;
            this.updatePreview();
            this.drawTimeline();
            
            alert('✅ MP4書き出しが完了しました!');
            
        } catch (error) {
            console.error('Export error:', error);
            if (progressDiv.parentNode) {
                document.body.removeChild(progressDiv);
            }
            
            this.currentTime = originalTime;
            this.updatePreview();
            this.drawTimeline();
            
            alert('❌ 書き出しに失敗しました:\n' + error.message);
        }
    }
    
    async exportWebM() {
        // In/Outポイントが設定されている場合はそれを使用
        let startTime, endTime;
        if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            startTime = parseFloat(document.getElementById('exportStart').value);
            endTime = parseFloat(document.getElementById('exportEnd').value);
        }
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const duration = endTime - startTime;
        const frames = Math.ceil(duration * this.fps);
        
        const rangeInfo = (this.inPoint !== null && this.outPoint !== null) 
            ? '\n範囲: In/Outポイント' 
            : '';
        
        if (!confirm(`WebM動画を書き出しますか?\n\n長さ: ${duration.toFixed(2)}秒\nフレーム数: ${frames}\nFPS: ${this.fps}${rangeInfo}\n\n※WebMは透過（アルファチャンネル）に対応しています`)) {
            return;
        }
        
        // 進捗表示用の要素を作成
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'JK Maru Gothic M', sans-serif;
            text-align: center;
            min-width: 300px;
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">WebM書き出し中...</h3>
            <div id="exportProgress" style="margin: 10px 0;">準備中...</div>
            <div style="font-size: 12px; color: #999; margin-top: 10px;">しばらくお待ちください</div>
        `;
        document.body.appendChild(progressDiv);
        
        const updateProgress = (message) => {
            const progressEl = document.getElementById('exportProgress');
            if (progressEl) progressEl.textContent = message;
        };
        
        try {
            // MediaRecorderのセットアップ
            const stream = this.previewCanvas.captureStream(this.fps);
            
            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8'
                : 'video/webm';
            
            updateProgress(`エンコーダー: ${mimeType}`);
            
            const recorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                videoBitsPerSecond: 8000000 // 8Mbps
            });
            
            const chunks = [];
            
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };
            
            recorder.onstop = async () => {
                updateProgress('ファイルを生成中...');
                
                const blob = new Blob(chunks, { type: mimeType });
                const url = URL.createObjectURL(blob);
                
                // ダウンロード
                const a = document.createElement('a');
                a.href = url;
                a.download = `starlit_timeline_export_${Date.now()}.webm`;
                a.click();
                
                URL.revokeObjectURL(url);
                
                // 進捗表示を削除
                document.body.removeChild(progressDiv);
                
                // 元の時間に戻す
                this.currentTime = originalTime;
                this.updatePreview();
                this.drawTimeline();
                
                alert('✅ WebM書き出しが完了しました!\n\nWebM形式で保存されています。\n透過（アルファチャンネル）に対応しています。');
            };
            
            recorder.onerror = (e) => {
                console.error('Recording error:', e);
                document.body.removeChild(progressDiv);
                alert('❌ 書き出し中にエラーが発生しました');
            };
            
            // 録画開始
            recorder.start();
            updateProgress('録画開始...');
            
            const originalTime = this.currentTime;
            const originalSelectedClip = this.selectedClip; // 選択状態を保存
            
            // 書き出し中は選択を解除してバウンディングボックスを非表示
            this.selectedClip = null;
            
            const frameInterval = 1000 / this.fps; // ミリ秒
            let currentFrame = 0;
            
            // フレームごとにプレビューを更新
            const renderFrame = () => {
                if (currentFrame >= frames) {
                    // 録画停止
                    updateProgress('エンコード中...');
                    setTimeout(() => {
                        recorder.stop();
                        // 選択状態を復元
                        this.selectedClip = originalSelectedClip;
                    }, 500); // 最後のフレームを確実にキャプチャ
                    return;
                }
                
                this.currentTime = startTime + (currentFrame / this.fps);
                this.updatePreview();
                this.drawTimeline();
                
                currentFrame++;
                updateProgress(`録画中: ${currentFrame}/${frames} フレーム (${Math.floor(currentFrame / frames * 100)}%)`);
                
                // 次のフレームをスケジュール
                setTimeout(renderFrame, frameInterval);
            };
            
            // レンダリング開始
            renderFrame();
            
        } catch (error) {
            console.error('Export error:', error);
            if (progressDiv.parentNode) {
                document.body.removeChild(progressDiv);
            }
            alert('❌ 書き出しに失敗しました: ' + error.message);
        }
    }
    
    async exportSequence() {
        // In/Outポイントが設定されている場合はそれを使用
        let startTime, endTime;
        if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            startTime = parseFloat(document.getElementById('exportStart').value);
            endTime = parseFloat(document.getElementById('exportEnd').value);
        }
        
        if (startTime >= endTime) {
            alert('書き出し範囲が不正です');
            return;
        }
        
        const frames = Math.ceil((endTime - startTime) * this.fps);
        
        const rangeInfo = (this.inPoint !== null && this.outPoint !== null) 
            ? ' (In/Outポイント範囲)' 
            : '';
        
        if (!confirm(`${frames}フレームを連番PNG (ZIP圧縮) で書き出しますか?${rangeInfo}`)) {
            return;
        }
        
        // 進捗表示用の要素を作成
        const progressDiv = document.createElement('div');
        progressDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 10px;
            z-index: 10000;
            font-family: 'JK Maru Gothic M', sans-serif;
            text-align: center;
            min-width: 400px;
        `;
        progressDiv.innerHTML = `
            <h3 style="margin: 0 0 15px 0;">連番PNG書き出し中...</h3>
            <div id="sequenceProgress" style="margin: 10px 0;">0 / ${frames} フレーム</div>
            <div style="font-size: 12px; color: #999; margin-top: 10px;">しばらくお待ちください...</div>
        `;
        document.body.appendChild(progressDiv);
        
        const originalTime = this.currentTime;
        const originalSelectedClip = this.selectedClip; // 選択状態を保存
        
        // 書き出し中は選択を解除してバウンディングボックスを非表示
        this.selectedClip = null;
        
        // JSZipライブラリを動的に読み込み
        if (typeof JSZip === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        const zip = new JSZip();
        const folder = zip.folder('sequence');
        
        for (let i = 0; i < frames; i++) {
            this.currentTime = startTime + (i / this.fps);
            
            // updatePreviewの完了を待つ（重要: 全クリップのレンダリングが完了してからキャプチャ）
            await this.updatePreview();
            
            // さらに少し待ってレンダリングが確実に完了するようにする
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // フレームを画像として取得
            const dataUrl = this.previewCanvas.toDataURL('image/png');
            const base64Data = dataUrl.split(',')[1];
            
            // ZIPに追加
            folder.file(`frame_${i.toString().padStart(5, '0')}.png`, base64Data, {base64: true});
            
            // 進捗更新
            document.getElementById('sequenceProgress').textContent = `${i + 1} / ${frames} フレーム`;
            
            // UIの更新を待つ
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        // 元の状態に戻す
        this.currentTime = originalTime;
        this.selectedClip = originalSelectedClip; // 選択状態を復元
        await this.updatePreview();
        
        // ZIP圧縮
        document.getElementById('sequenceProgress').textContent = 'ZIP圧縮中...';
        const blob = await zip.generateAsync({type: 'blob'});
        
        // ダウンロード
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `sequence_${frames}frames.zip`;
        a.click();
        
        // クリーンアップ
        URL.revokeObjectURL(a.href);
        document.body.removeChild(progressDiv);
        
        alert(`連番PNG書き出しが完了しました!\n${frames}フレームをZIPファイルにまとめました。`);
    }
    
    async exportAudio() {
        // 音声クリップがあるか確認
        const audioClips = this.clips.filter(clip => 
            clip.asset.type === 'audio' || clip.asset.type === 'video'
        );
        
        if (audioClips.length === 0) {
            alert('音声クリップがありません');
            return;
        }
        
        // In/Outポイントが設定されている場合はそれを使用
        let startTime, endTime;
        if (this.inPoint !== null && this.outPoint !== null) {
            startTime = Math.min(this.inPoint, this.outPoint);
            endTime = Math.max(this.inPoint, this.outPoint);
        } else {
            // プロジェクトの長さを計算
            startTime = 0;
            endTime = Math.max(...this.clips.map(c => c.startTime + c.duration), this.duration);
        }
        
        const duration = endTime - startTime;
        const rangeInfo = (this.inPoint !== null && this.outPoint !== null) 
            ? '\n範囲: In/Outポイント' 
            : '';
        
        if (!confirm(`音声を書き出しますか？\n\n長さ: ${duration.toFixed(2)}秒\nサンプルレート: 48000Hz\nフォーマット: WAV (16bit)${rangeInfo}`)) {
            return;
        }
        
        try {
            this.showNotification('🎵 音声を書き出し中...');
            
            // オフラインAudioContextを作成
            const sampleRate = 48000;
            const offlineCtx = new OfflineAudioContext(2, sampleRate * duration, sampleRate);
            
            // 各音声クリップを処理
            for (const clip of audioClips) {
                // 範囲外のクリップをスキップ
                if (clip.startTime + clip.duration < startTime || clip.startTime > endTime) {
                    continue;
                }
                
                if (!clip.audioElement || !clip.audioElement.src) {
                    console.warn('音声が読み込まれていません:', clip.asset.name);
                    continue;
                }
                
                try {
                    // 音声データを取得
                    const response = await fetch(clip.audioElement.src);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);
                    
                    // ソースを作成
                    const source = offlineCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    
                    // ゲインノードを作成（音量調整）
                    const gainNode = offlineCtx.createGain();
                    gainNode.gain.value = clip.volume * this.masterGainNode.gain.value;
                    
                    // パンノードを作成（クリップ開始時点のパン値を使用）
                    const panNode = offlineCtx.createStereoPanner();
                    const initialPan = this.getKeyframeValue(clip, 'pan', 0);
                    panNode.pan.value = initialPan;
                    
                    // 接続
                    source.connect(gainNode);
                    gainNode.connect(panNode);
                    panNode.connect(offlineCtx.destination);
                    
                    // 書き出し範囲内でのクリップの開始時間を計算
                    const clipStartInRange = Math.max(0, clip.startTime - startTime);
                    const trimStart = clip.trimStart || clip.offset || 0;
                    
                    // クリップが範囲の開始前から始まっている場合、trimStartを調整
                    const adjustedTrimStart = trimStart + Math.max(0, startTime - clip.startTime);
                    
                    // 書き出し範囲内での再生時間を計算
                    const clipDuration = Math.min(
                        clip.duration - Math.max(0, startTime - clip.startTime),
                        endTime - Math.max(clip.startTime, startTime),
                        audioBuffer.duration - adjustedTrimStart
                    );
                    
                    if (clipDuration > 0) {
                        source.start(clipStartInRange, adjustedTrimStart, clipDuration);
                    }
                    
                } catch (err) {
                    console.error('音声クリップの処理エラー:', clip.asset.name, err);
                }
            }
            
            // レンダリング
            const renderedBuffer = await offlineCtx.startRendering();
            
            // WAVファイルに変換
            const wavBlob = this.bufferToWave(renderedBuffer, renderedBuffer.length);
            
            // ダウンロード
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.href = url;
            
            const date = new Date();
            const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-');
            a.download = `starlit_audio_${dateStr}.wav`;
            
            a.click();
            URL.revokeObjectURL(url);
            
            this.showNotification('✅ 音声を書き出しました！');
            
        } catch (err) {
            alert('音声書き出しに失敗しました:\n' + err.message);
            console.error('音声書き出しエラー:', err);
        }
    }
    
    // AudioBufferをWAVファイルに変換
    bufferToWave(abuffer, len) {
        const numOfChan = abuffer.numberOfChannels;
        const length = len * numOfChan * 2 + 44;
        const buffer = new ArrayBuffer(length);
        const view = new DataView(buffer);
        const channels = [];
        let offset = 0;
        let pos = 0;
        
        // WAVヘッダーを書き込む
        const setUint16 = (data) => {
            view.setUint16(pos, data, true);
            pos += 2;
        };
        const setUint32 = (data) => {
            view.setUint32(pos, data, true);
            pos += 4;
        };
        
        // RIFFヘッダー
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // ファイルサイズ - 8
        setUint32(0x45564157); // "WAVE"
        
        // fmtチャンク
        setUint32(0x20746d66); // "fmt "
        setUint32(16); // チャンクサイズ
        setUint16(1); // オーディオフォーマット (1 = PCM)
        setUint16(numOfChan); // チャンネル数
        setUint32(abuffer.sampleRate); // サンプルレート
        setUint32(abuffer.sampleRate * 2 * numOfChan); // バイトレート
        setUint16(numOfChan * 2); // ブロックアライン
        setUint16(16); // ビット深度
        
        // dataチャンク
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4); // データサイズ
        
        // チャンネルデータを取得
        for (let i = 0; i < abuffer.numberOfChannels; i++) {
            channels.push(abuffer.getChannelData(i));
        }
        
        // インターリーブしてPCMデータを書き込む
        while (pos < length) {
            for (let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset])); // クリッピング
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF; // 16bitに変換
                view.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }
        
        return new Blob([buffer], { type: 'audio/wav' });
    }
    
    // ============================================================
    // 風揺れエフェクト実装
    // ============================================================
    
    // 風揺れエフェクトを画像に適用（WebGL版）
    applyWindShakeWebGL(ctx, img, width, height, clip, localTime) {
        // 一時キャンバスでWebGL処理
        if (!this.windShakeCanvas) {
            this.windShakeCanvas = document.createElement('canvas');
            this.windShakeGL = this.windShakeCanvas.getContext('webgl', { 
                premultipliedAlpha: false,
                alpha: true 
            });
            this.initWindShakeWebGL();
        }
        
        const gl = this.windShakeGL;
        const canvas = this.windShakeCanvas;
        
        const ws = clip.windShake;
        
        // メッシュを生成してバウンディングボックスを取得
        const meshData = this.createWindShakeMeshWithBounds(ws, width, height, localTime);
        
        // バウンディングボックスのサイズを計算（余裕を持たせる）
        const padding = 100; // 余白ピクセル
        const canvasWidth = meshData.bounds.width + padding * 2;
        const canvasHeight = meshData.bounds.height + padding * 2;
        
        // キャンバスサイズを設定
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        
        // WebGLで描画
        this.renderWindShakeWebGL(gl, img, meshData.mesh, canvasWidth, canvasHeight);
        
        // 結果をメインキャンバスに描画（元の画像中心に配置）
        ctx.drawImage(canvas, -canvasWidth / 2, -canvasHeight / 2, canvasWidth, canvasHeight);
    }
    
    // WebGL初期化
    initWindShakeWebGL() {
        const gl = this.windShakeGL;
        
        // 頂点シェーダー
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        // フラグメントシェーダー
        const fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            
            void main() {
                gl_FragColor = texture2D(u_image, v_texCoord);
            }
        `;
        
        // シェーダーをコンパイル
        const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // プログラムを作成
        this.windShakeProgram = this.createProgram(gl, vertexShader, fragmentShader);
        
        // アトリビュート・ユニフォームの位置を取得
        this.windShakeProgramInfo = {
            attribLocations: {
                position: gl.getAttribLocation(this.windShakeProgram, 'a_position'),
                texCoord: gl.getAttribLocation(this.windShakeProgram, 'a_texCoord'),
            },
            uniformLocations: {
                image: gl.getUniformLocation(this.windShakeProgram, 'u_image'),
            },
        };
    }
    
    // シェーダー作成
    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }
    
    // プログラム作成
    createProgram(gl, vertexShader, fragmentShader) {
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
        }
        
        return program;
    }
    
    // 風揺れメッシュを作成（バウンディングボックス付き）
    createWindShakeMeshWithBounds(ws, width, height, t) {
        let N = Math.floor(ws.divisions);
        if (N < 1) N = 1;
        if (N > 50) N = 50;
        
        const M = 8; // 横分割数
        
        const F = Math.PI * ws.angle / 180;
        const dt = ws.period;
        const c = 2 * Math.PI / dt;
        const d = 2 * ws.phaseShift * Math.PI / 180;
        const CNT = ws.center * Math.PI / 180;
        
        let dL = ws.topFixed * 0.01 * height;
        let dL2 = ws.bottomFixed * 0.01 * height;
        
        if (ws.fromBottom) {
            [dL, dL2] = [dL2, dL];
        }
        
        if (dL < 0) dL = 0;
        if (dL > height) dL = height;
        if (dL2 < 0) dL2 = 0;
        if (dL2 > height - dL) dL2 = height - dL;
        
        const L = height - dL - dL2;
        
        // ランダム揺れ
        let currentF = F;
        if (ws.randomSwing) {
            const s = t / ws.period;
            const n1 = Math.floor(s);
            const frac = s - n1;
            
            const f0 = this.getRandomValue(n1 - 1, ws.seed, ws.randomPattern) * F;
            const f1 = this.getRandomValue(n1, ws.seed, ws.randomPattern) * F;
            const f2 = this.getRandomValue(n1 + 1, ws.seed, ws.randomPattern) * F;
            const f3 = this.getRandomValue(n1 + 2, ws.seed, ws.randomPattern) * F;
            
            currentF = this.cubicInterpolation(frac, f0, f1, f2, f3);
        }
        
        // 中心線を計算
        const centerX = [];
        const centerY = [];
        
        centerX[0] = 0;
        centerY[0] = 0;
        
        for (let i = 1; i <= N; i++) {
            const ratio = i / N;
            
            // 軸モードが有効な場合、軸より上の部分の揺れを減衰
            let axisMultiplier = 1.0;
            if (ws.axisMode) {
                const axisPos = ws.axisPosition / 100; // 0-1に正規化
                
                // 軸より上の部分のみ処理
                if (ratio < axisPos) {
                    const distanceFromAxis = axisPos - ratio; // 軸からの距離(上方向)
                    const range = ws.axisRange / 100; // 影響範囲 0-1
                    
                    // 影響範囲内の場合のみ減衰
                    if (distanceFromAxis < range) {
                        const normalizedDist = distanceFromAxis / range; // 0-1に正規化
                        // スムーズな減衰カーブ (軸に近いほど減衰が強い)
                        const decayFactor = Math.pow(1 - normalizedDist, 2);
                        // 揺れ強度を適用 (0-100 → 0-1の範囲)
                        // axisStrength=0: 完全に揺れない、axisStrength=100: 通常通り揺れる
                        axisMultiplier = (ws.axisStrength / 100) + decayFactor * (1.0 - ws.axisStrength / 100);
                    }
                }
                // 軸より下の部分(ratio >= axisPos)はaxisMultiplier = 1.0のまま
            }
            
            const Si = (currentF * Math.sin(c * t - i * d / N) + CNT) * (1 - Math.pow(1 - ratio, 4)) * axisMultiplier;
            
            centerX[i] = centerX[i - 1] + Math.sin(Si) * (L / N);
            centerY[i] = dL + L * ratio;
        }
        
        // 2Dメッシュグリッド生成とバウンディングボックス計算
        const worldPositions = []; // ピクセル座標
        const texCoords = [];
        const indices = [];
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= M; j++) {
                const xRatio = j / M;
                const yRatio = i / N;
                
                // ワールド座標（ピクセル座標）
                const x = centerX[i] + (xRatio - 0.5) * width;
                const y = centerY[i];
                
                // バウンディングボックス更新
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                
                worldPositions.push(x, y);
                texCoords.push(xRatio, yRatio);
            }
        }
        
        // インデックス生成（三角形）
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                const topLeft = i * (M + 1) + j;
                const topRight = topLeft + 1;
                const bottomLeft = (i + 1) * (M + 1) + j;
                const bottomRight = bottomLeft + 1;
                
                // 三角形1
                indices.push(topLeft, bottomLeft, topRight);
                // 三角形2
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }
        
        // バウンディングボックス情報
        const bounds = {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (maxX + minX) / 2,
            centerY: (maxY + minY) / 2
        };
        
        return { 
            mesh: { worldPositions, texCoords, indices },
            bounds: bounds
        };
    }
    
    // WebGLでメッシュを描画
    renderWindShakeWebGL(gl, img, mesh, canvasWidth, canvasHeight) {
        const program = this.windShakeProgram;
        const programInfo = this.windShakeProgramInfo;
        
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        gl.useProgram(program);
        
        // ワールド座標をWebGL座標に変換
        const glPositions = [];
        let minGlX = Infinity, maxGlX = -Infinity;
        let minGlY = Infinity, maxGlY = -Infinity;
        
        for (let i = 0; i < mesh.worldPositions.length; i += 2) {
            const x = mesh.worldPositions[i];
            const y = mesh.worldPositions[i + 1];
            
            // キャンバス中心を原点として、WebGL座標系に変換
            const glX = (x / canvasWidth) * 2;
            const glY = -(y / canvasHeight) * 2;  // +1を削除
            
            minGlX = Math.min(minGlX, glX);
            maxGlX = Math.max(maxGlX, glX);
            minGlY = Math.min(minGlY, glY);
            maxGlY = Math.max(maxGlY, glY);
            
            glPositions.push(glX, glY);
        }
        
        console.log('  WebGL座標範囲: X[' + minGlX.toFixed(3) + ' ~ ' + maxGlX.toFixed(3) + 
                    '], Y[' + minGlY.toFixed(3) + ' ~ ' + maxGlY.toFixed(3) + ']');
        
        // 位置バッファ
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(glPositions), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(programInfo.attribLocations.position);
        gl.vertexAttribPointer(programInfo.attribLocations.position, 2, gl.FLOAT, false, 0, 0);
        
        // テクスチャ座標バッファ
        const texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.texCoords), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(programInfo.attribLocations.texCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.texCoord, 2, gl.FLOAT, false, 0, 0);
        
        // インデックスバッファ
        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
        
        // テクスチャ作成
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        
        // 描画
        gl.uniform1i(programInfo.uniformLocations.image, 0);
        gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
        
        // クリーンアップ
        gl.deleteBuffer(positionBuffer);
        gl.deleteBuffer(texCoordBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteTexture(texture);
    }
    
    // 以下、既存の関数は削除または簡略化
    applyWindShakeToImage(ctx, img, width, height, clip, localTime, anchorX = null, anchorY = null) {
        // アンカーポイントが指定されていない場合は中心を使用
        if (anchorX === null) anchorX = -width / 2;
        if (anchorY === null) anchorY = -height / 2;
        
        // 互換性のため残すが、WebGL版を呼ぶ
        this.applyWindShakeWebGL(ctx, img, width, height, clip, localTime, anchorX, anchorY);
    }
    
    // 風揺れメッシュのレンダリング（2Dグリッド方式）
    renderWindShakeMesh(ctx, img, w, h, N, F, c, d, CNT, dL, dL2, L, t, ws, offsetX) {
        const w2 = w / 2;
        const h2 = h / 2;
        
        // ランダム揺れの場合、振幅を調整
        let currentF = F;
        if (ws.randomSwing) {
            const s = t / ws.period;
            const n1 = Math.floor(s);
            const frac = s - n1;
            
            const f0 = this.getRandomValue(n1 - 1, ws.seed, ws.randomPattern) * F;
            const f1 = this.getRandomValue(n1, ws.seed, ws.randomPattern) * F;
            const f2 = this.getRandomValue(n1 + 1, ws.seed, ws.randomPattern) * F;
            const f3 = this.getRandomValue(n1 + 2, ws.seed, ws.randomPattern) * F;
            
            currentF = this.cubicInterpolation(frac, f0, f1, f2, f3);
        }
        
        // 横方向の分割数（固定）
        const M = 4; // 横4分割
        
        // 2Dグリッドのメッシュポイントを計算
        const gridX = [];
        const gridY = [];
        const gridU = [];
        const gridV = [];
        
        // 中心線の座標を計算（縦方向）
        const centerX = [];
        const centerY = [];
        
        centerX[0] = 0;
        centerY[0] = -h2;
        
        for (let i = 1; i <= N; i++) {
            const ratio = i / N;
            const yPos = -h2 + (dL + L * ratio);
            
            // 揺れの計算（縦位置に応じて変化）
            const Si = (currentF * Math.sin(c * t - i * d / N) + CNT) * (1 - Math.pow(1 - ratio, 4));
            
            centerX[i] = centerX[i - 1] + Math.sin(Si) * (L / N);
            centerY[i] = yPos;
        }
        
        // 2Dグリッドを生成
        for (let i = 0; i <= N; i++) {
            gridX[i] = [];
            gridY[i] = [];
            gridU[i] = [];
            gridV[i] = [];
            
            const baseX = centerX[i];
            const baseY = centerY[i];
            
            // 横方向に展開
            for (let j = 0; j <= M; j++) {
                const xRatio = (j / M) - 0.5; // -0.5 to 0.5
                
                gridX[i][j] = baseX + xRatio * w;
                gridY[i][j] = baseY;
                gridU[i][j] = (j / M) * w;
                gridV[i][j] = (i / N) * h;
            }
        }
        
        // バウンディングボックスを計算してオフセット調整
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= M; j++) {
                minX = Math.min(minX, gridX[i][j]);
                maxX = Math.max(maxX, gridX[i][j]);
                minY = Math.min(minY, gridY[i][j]);
                maxY = Math.max(maxY, gridY[i][j]);
            }
        }
        
        const CX = (maxX + minX) * 0.5;
        const CY = (maxY + minY) * 0.5;
        
        // 中心を原点に調整
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= M; j++) {
                gridX[i][j] -= CX;
                gridY[i][j] -= CY;
            }
        }
        
        // メッシュを描画
        ctx.save();
        ctx.translate(offsetX, 0);
        
        if (ws.fromBottom) {
            ctx.scale(1, -1);
        }
        
        // 各グリッドセルを描画
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                // 四角形の4つの頂点
                const x0 = gridX[i][j];
                const y0 = gridY[i][j];
                const u0 = gridU[i][j];
                const v0 = gridV[i][j];
                
                const x1 = gridX[i][j + 1];
                const y1 = gridY[i][j + 1];
                const u1 = gridU[i][j + 1];
                const v1 = gridV[i][j + 1];
                
                const x2 = gridX[i + 1][j + 1];
                const y2 = gridY[i + 1][j + 1];
                const u2 = gridU[i + 1][j + 1];
                const v2 = gridV[i + 1][j + 1];
                
                const x3 = gridX[i + 1][j];
                const y3 = gridY[i + 1][j];
                const u3 = gridU[i + 1][j];
                const v3 = gridV[i + 1][j];
                
                // 四角形を2つの三角形として描画
                this.drawTexturedTriangle(ctx, img, w, h, x0, y0, u0, v0, x1, y1, u1, v1, x3, y3, u3, v3);
                this.drawTexturedTriangle(ctx, img, w, h, x1, y1, u1, v1, x2, y2, u2, v2, x3, y3, u3, v3);
            }
        }
        
        ctx.restore();
    }
    
    // テクスチャ付き四角形の描画（改善版：バイリニア補間を使用）
    drawTexturedQuad(ctx, img, imgWidth, imgHeight, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2, x3, y3, u3, v3) {
        // 四角形を2つの三角形に分割して描画（より正確）
        this.drawTexturedTriangle(ctx, img, imgWidth, imgHeight, x0, y0, u0, v0, x1, y1, u1, v1, x3, y3, u3, v3);
        this.drawTexturedTriangle(ctx, img, imgWidth, imgHeight, x1, y1, u1, v1, x2, y2, u2, v2, x3, y3, u3, v3);
    }
    
    // テクスチャ付き三角形の描画（改善版）
    drawTexturedTriangle(ctx, img, imgWidth, imgHeight, x0, y0, u0, v0, x1, y1, u1, v1, x2, y2, u2, v2) {
        // 画像を一時キャンバスに描画してから変形
        ctx.save();
        
        // クリッピング領域を設定
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.closePath();
        ctx.clip();
        
        // アンチエイリアスを有効化
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 3点アフィン変換
        const du1 = u1 - u0;
        const dv1 = v1 - v0;
        const du2 = u2 - u0;
        const dv2 = v2 - v0;
        const dx1 = x1 - x0;
        const dy1 = y1 - y0;
        const dx2 = x2 - x0;
        const dy2 = y2 - y0;
        
        const det = du1 * dv2 - du2 * dv1;
        if (Math.abs(det) < 0.001) {
            ctx.restore();
            return;
        }
        
        const a = (dx1 * dv2 - dx2 * dv1) / det;
        const b = (dx2 * du1 - dx1 * du2) / det;
        const c = (dy1 * dv2 - dy2 * dv1) / det;
        const d = (dy2 * du1 - dy1 * du2) / det;
        const e = x0 - (a * u0 + b * v0);
        const f = y0 - (c * u0 + d * v0);
        
        ctx.transform(a, c, b, d, e, f);
        ctx.drawImage(img, 0, 0, imgWidth, imgHeight);
        
        ctx.restore();
    }
    
    // ランダム値の生成（再現性のある疑似乱数）
    getRandomValue(n, baseSeed, pattern) {
        const seed = Math.abs(10 + pattern) + n;
        // 簡易的なハッシュ関数
        const x = Math.sin(seed * baseSeed) * 10000;
        return (x - Math.floor(x));
    }
    
    // キュービック補間
    cubicInterpolation(t, p0, p1, p2, p3) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        const a0 = p3 - p2 - p0 + p1;
        const a1 = p0 - p1 - a0;
        const a2 = p2 - p0;
        const a3 = p1;
        
        return a0 * t3 + a1 * t2 + a2 * t + a3;
    }
    
    // 風揺れプリセットを適用
    applyWindShakePreset(presetName) {
        if (!this.selectedClip || !this.selectedClip.windShake) return;
        
        const presets = {
            gentle_breeze: {
                divisions: 10,
                angle: 15,
                period: 3.0,
                phaseShift: 90,
                center: 0,
                topFixed: 10,
                bottomFixed: 10,
                fromBottom: false,
                randomSwing: false,
                randomPattern: 0,
                timeShift: 0.1,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorrection: true,
                antiAliasing: true
            },
            moderate_wind: {
                divisions: 15,
                angle: 30,
                period: 2.0,
                phaseShift: 90,
                center: 0,
                topFixed: 10,
                bottomFixed: 10,
                fromBottom: false,
                randomSwing: true,
                randomPattern: 5,
                timeShift: 0.1,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorrection: true,
                antiAliasing: true
            },
            strong_wind: {
                divisions: 20,
                angle: 60,
                period: 1.5,
                phaseShift: 120,
                center: 15,
                topFixed: 15,
                bottomFixed: 5,
                fromBottom: false,
                randomSwing: true,
                randomPattern: 10,
                timeShift: 0.05,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorrection: true,
                antiAliasing: true
            },
            flag: {
                divisions: 25,
                angle: 45,
                period: 1.2,
                phaseShift: 180,
                center: 0,
                topFixed: 0,
                bottomFixed: 0,
                fromBottom: false,
                randomSwing: true,
                randomPattern: 15,
                timeShift: 0.08,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorrection: true,
                antiAliasing: true
            },
            curtain: {
                divisions: 30,
                angle: 25,
                period: 2.5,
                phaseShift: 90,
                center: 0,
                topFixed: 5,
                bottomFixed: 15,
                fromBottom: false,
                randomSwing: false,
                randomPattern: 0,
                timeShift: 0.15,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorreption: true,
                antiAliasing: true
            },
            underwater: {
                divisions: 20,
                angle: 20,
                period: 4.0,
                phaseShift: 60,
                center: 5,
                topFixed: 10,
                bottomFixed: 10,
                fromBottom: false,
                randomSwing: true,
                randomPattern: 8,
                timeShift: 0.2,
                horizontalRepeat: false,
                repeatCount: 3,
                spacing: 50,
                alphaCorrection: true,
                antiAliasing: true
            }
        };
        
        if (presets[presetName]) {
            Object.assign(this.selectedClip.windShake, presets[presetName]);
            this.updateWindShakeUI();
            this.updatePreview();
        }
    }
    
    // ==================== パペット機能 ====================
    
    // パペットピンを追加（番号指定版）
    addPuppetPin(x, y, pinIndex) {
        if (!this.selectedClip || !this.selectedClip.puppet) return;
        
        // ピンは最大5個
        if (this.selectedClip.puppet.pins.length >= 5) {
            alert('ピンは最大5個までです');
            return;
        }
        
        const pin = {
            id: Date.now() + Math.random(),
            index: pinIndex, // 0-4
            x: x,
            y: y,
            keyframes: [{
                time: this.currentTime - this.selectedClip.startTime,
                x: x,
                y: y
            }]
        };
        
        this.selectedClip.puppet.pins.push(pin);
        this.updatePuppetUI();
        this.updatePreview();
        this.saveHistory();
    }
    
    // パペット編集モード切替メソッドを追加
    togglePuppetEditMode() {
        this.isPuppetEditMode = !this.isPuppetEditMode;
        
        const btn = document.getElementById('puppetEditModeBtn');
        if (this.isPuppetEditMode) {
            btn.textContent = '🎭 パペット編集モード ON';
            btn.style.background = '#E67E22'; // オレンジ色で強調
            this.previewCanvas.style.cursor = 'crosshair';
        } else {
            btn.textContent = '🎭 パペット編集モード OFF';
            btn.style.background = 'var(--chocolate-main)';
            this.previewCanvas.style.cursor = 'default';
        }
        
        this.updatePreview();
    }
    
    // ピン追加モード開始（番号指定版）
    startAddPuppetPin(pinIndex) {
        if (!this.selectedClip || !this.selectedClip.puppet) return;
        
        // 既にこの番号のピンが配置済みの場合は削除
        const existingPinIndex = this.selectedClip.puppet.pins.findIndex(p => p.index === pinIndex);
        if (existingPinIndex !== -1) {
            this.selectedClip.puppet.pins.splice(existingPinIndex, 1);
            this.updatePuppetUI();
        }
        
        // 既に5個ある場合（削除後にまだ5個ある場合）
        if (this.selectedClip.puppet.pins.length >= 5) {
            alert('ピンは最大5個までです');
            return;
        }
        
        this.puppetAddPinMode = true;
        this.puppetAddPinIndex = pinIndex;
        this.previewCanvas.style.cursor = 'crosshair';
        
        const clickHandler = (e) => {
            if (!this.puppetAddPinMode) return;
            
            const rect = this.previewCanvas.getBoundingClientRect();
            const clickX = (e.clientX - rect.left) * (this.previewCanvas.width / rect.width);
            const clickY = (e.clientY - rect.top) * (this.previewCanvas.height / rect.height);
            
            const clip = this.selectedClip;
            if (!clip) return;
            
            const localTime = this.currentTime - clip.startTime;
            const x = this.getKeyframeValue(clip, 'x', localTime);
            const y = this.getKeyframeValue(clip, 'y', localTime);
            const scale = this.getKeyframeValue(clip, 'scale', localTime);
            
            let w, h;
            if (clip.useOriginalSize && clip.originalWidth) {
                w = clip.originalWidth * scale;
                h = clip.originalHeight * scale;
            } else {
                w = this.previewCanvas.width * 0.5 * scale;
                h = this.previewCanvas.height * 0.5 * scale;
            }
            
            const cx = this.previewCanvas.width / 2 + x;
            const cy = this.previewCanvas.height / 2 + y;
            
            const anchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
            const drawX = cx - w * anchor.x;
            const drawY = cy - h * anchor.y;
            
            // クリック位置がクリップ内にあるか判定
            if (clickX >= drawX && clickX <= drawX + w &&
                clickY >= drawY && clickY <= drawY + h) {
                const relX = (clickX - drawX) / w;
                const relY = (clickY - drawY) / h;
                
                this.addPuppetPin(relX, relY, this.puppetAddPinIndex);
            }
            
            this.puppetAddPinMode = false;
            this.previewCanvas.style.cursor = 'default';
            this.previewCanvas.removeEventListener('click', clickHandler);
        };
        
        this.previewCanvas.addEventListener('click', clickHandler, { once: true });
    }
    
    // パペットピンを削除
    removePuppetPin(pinId) {
        console.log('🗑️ removePuppetPin呼び出し:', pinId);
        if (!this.selectedClip || !this.selectedClip.puppet) {
            console.log('⚠️ selectedClipまたはpuppetがありません');
            return;
        }
        
        const index = this.selectedClip.puppet.pins.findIndex(p => p.id === pinId);
        console.log('📍 ピンのインデックス:', index);
        if (index !== -1) {
            this.selectedClip.puppet.pins.splice(index, 1);
            console.log('✅ ピンを削除しました。残りのピン数:', this.selectedClip.puppet.pins.length);
            this.updatePuppetUI();
            this.updatePreview();
            this.saveHistory();
        } else {
            console.log('⚠️ ピンが見つかりませんでした');
        }
    }
    
    // パペットピンのキーフレームを追加/更新
    setPuppetPinKeyframe(pinId, x, y, time) {
        if (!this.selectedClip || !this.selectedClip.puppet) return;
        
        const pin = this.selectedClip.puppet.pins.find(p => p.id === pinId);
        if (!pin) return;
        
        const existingKf = pin.keyframes.find(kf => Math.abs(kf.time - time) < 0.01);
        if (existingKf) {
            existingKf.x = x;
            existingKf.y = y;
        } else {
            pin.keyframes.push({ time, x, y });
            pin.keyframes.sort((a, b) => a.time - b.time);
        }
        
        this.updatePreview();
        this.saveHistory();
    }
    
    // 現在時刻でのパペットピン位置を取得
    getPuppetPinPosition(pin, time) {
        if (!pin.keyframes || pin.keyframes.length === 0) {
            return { x: pin.x, y: pin.y };
        }
        
        // キーフレーム補間
        const kfs = pin.keyframes;
        
        if (time <= kfs[0].time) {
            return { x: kfs[0].x, y: kfs[0].y };
        }
        
        if (time >= kfs[kfs.length - 1].time) {
            const last = kfs[kfs.length - 1];
            return { x: last.x, y: last.y };
        }
        
        for (let i = 0; i < kfs.length - 1; i++) {
            if (time >= kfs[i].time && time <= kfs[i + 1].time) {
                const t = (time - kfs[i].time) / (kfs[i + 1].time - kfs[i].time);
                return {
                    x: kfs[i].x + (kfs[i + 1].x - kfs[i].x) * t,
                    y: kfs[i].y + (kfs[i + 1].y - kfs[i].y) * t
                };
            }
        }
        
        return { x: pin.x, y: pin.y };
    }
    
    // パペット変形を適用した画像を描画
    drawPuppetDeformedImage(ctx, clip, img, x, y, w, h, time) {
        console.log('🎭 drawPuppetDeformedImage called');
        console.log('  位置: x=' + x + ', y=' + y);
        console.log('  サイズ: w=' + w + ', h=' + h);
        console.log('  パペット有効:', clip.puppet.enabled);
        console.log('  ピン数:', clip.puppet.pins.length);
        
        if (!clip.puppet.enabled || clip.puppet.pins.length === 0) {
            // パペット無効時は通常描画
            console.log('  → 通常描画を実行');
            ctx.drawImage(img, x, y, w, h);
            return;
        }
        
        console.log('  → パペット変形描画を実行(風揺れと同じ方式)');
        
        // 風揺れと同じくWebGL版を呼ぶ（anchorは無視される）
        this.applyPuppetWebGL(ctx, img, w, h, clip, time);
    }
    
    // パペット用WebGL描画（風揺れと完全に同じ構造）
    applyPuppetWebGL(ctx, img, width, height, clip, time) {
        console.log('🎨 applyPuppetWebGL called');
        console.log('  width=' + width + ', height=' + height);
        
        // 風揺れと同じWebGLコンテキストを使用
        if (!this.windShakeCanvas) {
            this.windShakeCanvas = document.createElement('canvas');
            this.windShakeGL = this.windShakeCanvas.getContext('webgl', { 
                premultipliedAlpha: false,
                alpha: true 
            });
            this.initWindShakeWebGL();
        }
        
        const gl = this.windShakeGL;
        const canvas = this.windShakeCanvas;
        
        // メッシュを生成してバウンディングボックスを取得
        const meshData = this.createPuppetMeshWithBounds(clip.puppet, width, height, time);
        
        // バウンディングボックスのサイズを計算
        // パペットは変形に応じて動的に拡張するため、padding不要
        const padding = 0;
        const canvasWidth = meshData.bounds.width + padding * 2;
        const canvasHeight = meshData.bounds.height + padding * 2;
        
        console.log('  バウンディング: ' + meshData.bounds.width.toFixed(1) + 'x' + meshData.bounds.height.toFixed(1));
        console.log('  bounds.centerX: ' + meshData.bounds.centerX.toFixed(1) + ', centerY: ' + meshData.bounds.centerY.toFixed(1));
        console.log('  bounds.minX: ' + meshData.bounds.minX.toFixed(1) + ', minY: ' + meshData.bounds.minY.toFixed(1));
        console.log('  bounds.maxX: ' + meshData.bounds.maxX.toFixed(1) + ', maxY: ' + meshData.bounds.maxY.toFixed(1));
        console.log('  拡張後キャンバス: ' + canvasWidth + 'x' + canvasHeight);
        
        // キャンバスサイズを設定
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        
        // WebGLで描画（メッシュはそのまま使用）
        this.renderWindShakeWebGL(gl, img, meshData.mesh, canvasWidth, canvasHeight);
        
        // 描画位置を計算 - 拡張キャンバス全体を中心に配置
        const drawX = -canvasWidth / 2;
        const drawY = -canvasHeight / 2;
        
        // 結果をメインキャンバスに描画
        console.log('  → メインキャンバスに転送: (' + drawX.toFixed(1) + ', ' + drawY.toFixed(1) + ')');
        ctx.drawImage(canvas, drawX, drawY, canvasWidth, canvasHeight);
    }
    
    
    // パペット用メッシュ生成（風揺れと同じ形式でバウンディングボックスも返す）
    createPuppetMeshWithBounds(puppet, width, height, time) {
        const density = puppet.gridDensity || 20;
        const stiffness = puppet.stiffness || 0.5;
        
        const M = Math.max(4, Math.floor(width / density)); // 横分割数
        const N = Math.max(4, Math.floor(height / density)); // 縦分割数
        
        const worldPositions = [];
        const texCoords = [];
        const indices = [];
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        // グリッド頂点を生成（風揺れと同じく中心基準）
        for (let i = 0; i <= N; i++) {
            for (let j = 0; j <= M; j++) {
                const u = j / M;
                const v = i / N;
                
                // 風揺れと同じく中心基準で座標を計算
                let px = (u - 0.5) * width;
                let py = (v - 0.5) * height;
                
                // ピンの影響を適用
                for (const pin of puppet.pins) {
                    const pinPos = this.getPuppetPinPosition(pin, time);
                    const pinOrigX = (pin.x - 0.5) * width;
                    const pinOrigY = (pin.y - 0.5) * height;
                    const pinCurrX = (pinPos.x - 0.5) * width;
                    const pinCurrY = (pinPos.y - 0.5) * height;
                    
                    const dx = pinCurrX - pinOrigX;
                    const dy = pinCurrY - pinOrigY;
                    
                    // デバッグログ（最初のグリッド点のみ）
                    if (i === 0 && j === 0) {
                        console.log('  🔍 ピン影響計算:');
                        console.log('    pin.x=' + pin.x.toFixed(3) + ', pin.y=' + pin.y.toFixed(3));
                        console.log('    pinPos.x=' + pinPos.x.toFixed(3) + ', pinPos.y=' + pinPos.y.toFixed(3));
                        console.log('    dx=' + dx.toFixed(2) + ', dy=' + dy.toFixed(2));
                    }
                    
                    const distX = px - pinOrigX;
                    const distY = py - pinOrigY;
                    const dist = Math.sqrt(distX * distX + distY * distY);
                    
                    // 影響範囲を計算（stiffnessが高いほど影響範囲が広い）
                    const baseRadius = Math.max(width, height) * 0.3; // ベース影響範囲
                    const influenceRadius = baseRadius * (0.5 + stiffness * 1.5); // 0.5-2.0倍の範囲
                    
                    // 影響力を計算（距離に応じて指数減衰、stiffnessで減衰の強さを調整）
                    const falloff = 2.0 - stiffness * 1.5; // falloff: 0.5-2.0（小さいほど遠くまで影響）
                    const influence = Math.exp(-dist * falloff / influenceRadius);
                    
                    px += dx * influence;
                    py += dy * influence;
                }
                
                // バウンディングボックス更新
                minX = Math.min(minX, px);
                maxX = Math.max(maxX, px);
                minY = Math.min(minY, py);
                maxY = Math.max(maxY, py);
                
                // ワールド座標を保存（風揺れと同じ形式）
                worldPositions.push(px, py);
                texCoords.push(u, v);
            }
        }
        
        // インデックス生成（風揺れと同じ）
        for (let i = 0; i < N; i++) {
            for (let j = 0; j < M; j++) {
                const idx0 = i * (M + 1) + j;
                const idx1 = i * (M + 1) + (j + 1);
                const idx2 = (i + 1) * (M + 1) + (j + 1);
                const idx3 = (i + 1) * (M + 1) + j;
                
                // 2つの三角形
                indices.push(idx0, idx1, idx3);
                indices.push(idx1, idx2, idx3);
            }
        }
        
        // バウンディングボックス情報（風揺れと同じ形式）
        const bounds = {
            minX: minX,
            maxX: maxX,
            minY: minY,
            maxY: maxY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (maxX + minX) / 2,
            centerY: (maxY + minY) / 2
        };
        
        return { 
            mesh: { worldPositions, texCoords, indices },
            bounds: bounds
        };
    }
    
    // パペット変形後の実際のバウンディングボックスを計算
    
    // ==================== アンカーポイント機能 ====================
    
    // アンカーポイントをリセット
    resetAnchorPoint() {
        if (!this.selectedClip) return;
        
        this.selectedClip.anchorPoint = { x: 0.5, y: 0.5 };
        this.updateAnchorPointUI();
        this.updatePreview();
        this.saveHistory();
    }
    
    // アンカーポイントをクリック位置に設定
    setAnchorPointByClick() {
        if (!this.selectedClip) return;
        
        this.anchorPointPickMode = true;
        this.previewCanvas.style.cursor = 'crosshair';
        
        const clickHandler = (e) => {
            const rect = this.previewCanvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // キャンバス座標をクリップ内の相対座標(0-1)に変換
            const clip = this.selectedClip;
            const x = this.getKeyframeValue(clip.keyframes.x, this.currentTime - clip.startTime);
            const y = this.getKeyframeValue(clip.keyframes.y, this.currentTime - clip.startTime);
            const scale = this.getKeyframeValue(clip.keyframes.scale, this.currentTime - clip.startTime);
            
            let w, h;
            if (clip.useOriginalSize && clip.originalWidth) {
                w = clip.originalWidth * scale;
                h = clip.originalHeight * scale;
            } else {
                w = this.previewCanvas.width * 0.5 * scale;
                h = this.previewCanvas.height * 0.5 * scale;
            }
            
            const cx = this.previewCanvas.width / 2 + x;
            const cy = this.previewCanvas.height / 2 + y;
            
            // アンカーポイントを考慮した描画位置
            const currentAnchor = clip.anchorPoint || { x: 0.5, y: 0.5 };
            const drawX = cx - w * currentAnchor.x;
            const drawY = cy - h * currentAnchor.y;
            
            // クリック位置がクリップ内にあるか判定
            if (clickX >= drawX && clickX <= drawX + w &&
                clickY >= drawY && clickY <= drawY + h) {
                // 相対座標を計算
                const relX = (clickX - drawX) / w;
                const relY = (clickY - drawY) / h;
                
                clip.anchorPoint = { x: relX, y: relY };
                this.updateAnchorPointUI();
                this.updatePreview();
                this.saveHistory();
            }
            
            this.anchorPointPickMode = false;
            this.previewCanvas.style.cursor = 'default';
            this.previewCanvas.removeEventListener('click', clickHandler);
        };
        
        this.previewCanvas.addEventListener('click', clickHandler, { once: true });
    }
    
    // UI更新関数
    updatePuppetUI() {
        if (!this.selectedClip || !this.selectedClip.puppet) return;
        
        const enabledCheckbox = document.getElementById('puppetEnabled');
        const pinsList = document.getElementById('puppetPinsList');
        const gridDensitySlider = document.getElementById('puppetGridDensity');
        const stiffnessSlider = document.getElementById('puppetStiffness');
        
        if (enabledCheckbox) {
            enabledCheckbox.checked = this.selectedClip.puppet.enabled;
        }
        
        if (gridDensitySlider) {
            gridDensitySlider.value = this.selectedClip.puppet.gridDensity;
            document.getElementById('puppetGridDensityValue').textContent = this.selectedClip.puppet.gridDensity;
        }
        
        if (stiffnessSlider) {
            stiffnessSlider.value = this.selectedClip.puppet.stiffness * 100;
            document.getElementById('puppetStiffnessValue').textContent = Math.round(this.selectedClip.puppet.stiffness * 100);
        }
        
        if (pinsList) {
            pinsList.innerHTML = '';
            this.selectedClip.puppet.pins.forEach((pin, index) => {
                const pinItem = document.createElement('div');
                pinItem.className = 'puppet-pin-item';
                pinItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 8px; margin: 4px 0; background: rgba(255,255,255,0.1); border-radius: 4px;';
                
                const pinInfo = document.createElement('span');
                pinInfo.textContent = `ピン ${index + 1} (${(pin.x * 100).toFixed(0)}%, ${(pin.y * 100).toFixed(0)}%)`;
                
                const deleteBtn = document.createElement('button');
                deleteBtn.textContent = '削除';
                deleteBtn.style.cssText = 'padding: 4px 12px; background: #8B4513; color: white; border: none; border-radius: 4px; cursor: pointer;';
                deleteBtn.addEventListener('click', () => {
                    console.log('🗑️ 削除ボタンがクリックされました:', pin.id);
                    this.removePuppetPin(pin.id);
                });
                
                pinItem.appendChild(pinInfo);
                pinItem.appendChild(deleteBtn);
                pinsList.appendChild(pinItem);
            });
        }
    }
    
    updateAnchorPointUI() {
        if (!this.selectedClip) return;
        
        const anchor = this.selectedClip.anchorPoint || { x: 0.5, y: 0.5 };
        
        const xInput = document.getElementById('anchorPointX');
        const yInput = document.getElementById('anchorPointY');
        
        if (xInput) xInput.value = (anchor.x * 100).toFixed(1);
        if (yInput) yInput.value = (anchor.y * 100).toFixed(1);
    }
    
    // エフェクト編集ウィンドウを開く
    openEffectEditor() {
        this.openEditorWindow('effect');
    }
    
    // クリップエフェクト編集ウィンドウを開く
    openClipEffectEditor() {
        this.openEditorWindow('clipEffect');
    }
    
    // タブ切り替え可能なクリップエフェクトウィンドウを開く
    openClipEffectWindow() {
        const windowId = 'clipEffectTabWindow';
        
        // 既存のウィンドウがあれば閉じる
        const existingWindow = document.getElementById(windowId);
        if (existingWindow) {
            existingWindow.remove();
            return;
        }
        
        if (!this.selectedClip) {
            alert('クリップを選択してください');
            return;
        }
        
        const clip = this.selectedClip;
        
        // ウィンドウを作成
        const window = document.createElement('div');
        window.id = windowId;
        window.className = 'effect-editor-window visible';
        window.style.left = '100px';
        window.style.top = '50px';
        window.style.width = '600px';
        window.style.height = '900px';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'effect-editor-header';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        
        const title = document.createElement('div');
        title.className = 'effect-editor-title';
        title.textContent = '✨ Effect';
        title.style.flex = '1';
        
        // 保存ボタン
        const saveBtn = document.createElement('button');
        saveBtn.className = 'round-button small';
        saveBtn.textContent = '💾';
        saveBtn.title = 'エフェクト設定を保存';
        saveBtn.onclick = (e) => {
            e.stopPropagation();
            this.saveClipEffectSettings();
        };
        saveBtn.style.cssText = 'padding: 6px 10px; background: var(--chocolate-main); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
        
        // 読込ボタン
        const loadBtn = document.createElement('button');
        loadBtn.className = 'round-button small';
        loadBtn.textContent = '📂';
        loadBtn.title = 'エフェクト設定を読込';
        loadBtn.onclick = (e) => {
            e.stopPropagation();
            this.loadClipEffectSettings();
        };
        loadBtn.style.cssText = 'padding: 6px 10px; background: var(--chocolate-main); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'effect-editor-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => window.remove();
        
        header.appendChild(title);
        header.appendChild(saveBtn);
        header.appendChild(loadBtn);
        header.appendChild(closeBtn);
        
        // タブエリア
        const tabArea = document.createElement('div');
        tabArea.style.cssText = 'display: flex; background: var(--chocolate-dark); border-bottom: 2px solid var(--chocolate-darker); overflow-x: auto;';
        
        const tabs = [
            { id: 'transition', label: '🎬 トランジション', icon: '🎬' },
            { id: 'puppet', label: '🎭 パペット', icon: '🎭' },
            { id: 'windShake', label: '🍃 風揺れ', icon: '🍃' },
            { id: 'blur', label: '🌫️ ブラー', icon: '🌫️' }
        ];
        
        tabs.forEach((tab, index) => {
            const tabBtn = document.createElement('button');
            tabBtn.className = 'effect-tab-button';
            if (index === 0) tabBtn.classList.add('active');
            tabBtn.textContent = tab.label;
            tabBtn.onclick = () => {
                document.querySelectorAll('.effect-tab-button').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.effect-tab-content').forEach(c => c.style.display = 'none');
                tabBtn.classList.add('active');
                document.getElementById(`tab-${tab.id}`).style.display = 'block';
            };
            tabBtn.style.cssText = 'flex: 1; padding: 12px; background: transparent; color: var(--biscuit-light); border: none; cursor: pointer; font-size: 13px; transition: all 0.2s; white-space: nowrap;';
            tabArea.appendChild(tabBtn);
        });
        
        // コンテンツエリア
        const content = document.createElement('div');
        content.className = 'effect-editor-content';
        content.style.padding = '16px';
        
        // トランジションタブ
        const transitionTab = this.createTransitionTabContent(clip);
        transitionTab.id = 'tab-transition';
        transitionTab.className = 'effect-tab-content';
        transitionTab.style.display = 'block';
        
        // パペットタブ
        const puppetTab = this.createPuppetTabContent(clip);
        puppetTab.id = 'tab-puppet';
        puppetTab.className = 'effect-tab-content';
        puppetTab.style.display = 'none';
        
        // 風揺れタブ
        const windShakeTab = this.createWindShakeTabContent(clip);
        windShakeTab.id = 'tab-windShake';
        windShakeTab.className = 'effect-tab-content';
        windShakeTab.style.display = 'none';
        
        // ブラータブ
        const blurTab = this.createBlurTabContent(clip);
        blurTab.id = 'tab-blur';
        blurTab.className = 'effect-tab-content';
        blurTab.style.display = 'none';
        
        content.appendChild(transitionTab);
        content.appendChild(puppetTab);
        content.appendChild(windShakeTab);
        content.appendChild(blurTab);
        
        // リサイズハンドル
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'effect-editor-resize-handle';
        
        window.appendChild(header);
        window.appendChild(tabArea);
        window.appendChild(content);
        window.appendChild(resizeHandle);
        
        document.body.appendChild(window);
        
        // ドラッグ機能
        this.makeWindowDraggable(window, header);
        
        // リサイズ機能
        this.makeWindowResizable(window, resizeHandle);
        
        // CSSスタイルを追加（タブボタン用）
        if (!document.getElementById('effect-tab-styles')) {
            const style = document.createElement('style');
            style.id = 'effect-tab-styles';
            style.textContent = `
                .effect-tab-button:hover {
                    background: rgba(255, 255, 255, 0.1) !important;
                }
                .effect-tab-button.active {
                    background: var(--accent-orange) !important;
                    font-weight: bold;
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // トランジションタブのコンテンツを作成
    createTransitionTabContent(clip) {
        const div = document.createElement('div');
        div.innerHTML = `
            <h3 style="margin: 0 0 12px 0; color: var(--biscuit-light);">トランジションイン</h3>
            <div class="property-group">
                <div class="property-label">タイプ</div>
                <select onchange="app.updateTransition('in', 'type', this.value)" style="width: 100%; padding: 8px;">
                    <option value="none" ${clip.transitionIn.type === 'none' ? 'selected' : ''}>なし</option>
                    <option value="fade" ${clip.transitionIn.type === 'fade' ? 'selected' : ''}>フェード</option>
                    <option value="slide-left" ${clip.transitionIn.type === 'slide-left' ? 'selected' : ''}>スライド (左から)</option>
                    <option value="slide-right" ${clip.transitionIn.type === 'slide-right' ? 'selected' : ''}>スライド (右から)</option>
                    <option value="slide-up" ${clip.transitionIn.type === 'slide-up' ? 'selected' : ''}>スライド (下から)</option>
                    <option value="slide-down" ${clip.transitionIn.type === 'slide-down' ? 'selected' : ''}>スライド (上から)</option>
                    <option value="zoom" ${clip.transitionIn.type === 'zoom' ? 'selected' : ''}>ズーム</option>
                </select>
            </div>
            <div class="property-group">
                <div class="property-label">継続時間: <span id="transitionInDuration">${clip.transitionIn.duration.toFixed(2)}</span>秒</div>
                <input type="range" class="property-slider" value="${clip.transitionIn.duration}" 
                    min="0.1" max="3" step="0.1"
                    oninput="document.getElementById('transitionInDuration').textContent = parseFloat(this.value).toFixed(2); app.updateTransition('in', 'duration', parseFloat(this.value))">
            </div>
            
            <h3 style="margin: 24px 0 12px 0; color: var(--biscuit-light);">トランジションアウト</h3>
            <div class="property-group">
                <div class="property-label">タイプ</div>
                <select onchange="app.updateTransition('out', 'type', this.value)" style="width: 100%; padding: 8px;">
                    <option value="none" ${clip.transitionOut.type === 'none' ? 'selected' : ''}>なし</option>
                    <option value="fade" ${clip.transitionOut.type === 'fade' ? 'selected' : ''}>フェード</option>
                    <option value="slide-left" ${clip.transitionOut.type === 'slide-left' ? 'selected' : ''}>スライド (左へ)</option>
                    <option value="slide-right" ${clip.transitionOut.type === 'slide-right' ? 'selected' : ''}>スライド (右へ)</option>
                    <option value="slide-up" ${clip.transitionOut.type === 'slide-up' ? 'selected' : ''}>スライド (上へ)</option>
                    <option value="slide-down" ${clip.transitionOut.type === 'slide-down' ? 'selected' : ''}>スライド (下へ)</option>
                    <option value="zoom" ${clip.transitionOut.type === 'zoom' ? 'selected' : ''}>ズーム</option>
                </select>
            </div>
            <div class="property-group">
                <div class="property-label">継続時間: <span id="transitionOutDuration">${clip.transitionOut.duration.toFixed(2)}</span>秒</div>
                <input type="range" class="property-slider" value="${clip.transitionOut.duration}" 
                    min="0.1" max="3" step="0.1"
                    oninput="document.getElementById('transitionOutDuration').textContent = parseFloat(this.value).toFixed(2); app.updateTransition('out', 'duration', parseFloat(this.value))">
            </div>
        `;
        return div;
    }
    
    // パペットタブのコンテンツを作成（簡易版、詳細は既存のUIを参照）
    createPuppetTabContent(clip) {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="property-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" ${clip.puppet?.enabled ? 'checked' : ''} onchange="app.togglePuppetEffect(this.checked)">
                    <span style="font-weight: bold;">パペットアニメーション有効化</span>
                </label>
            </div>
            ${clip.puppet?.enabled ? `
                <div style="background: rgba(210, 105, 30, 0.2); padding: 12px; margin: 12px 0; border-radius: 4px; font-size: 12px; line-height: 1.5;">
                    💡 プレビュー画面で素材をクリックしてピンを配置してください。<br>
                    ピンをドラッグして変形させることができます。
                </div>
                <div class="property-group">
                    <button onclick="app.togglePuppetEditMode()" style="width: 100%; padding: 12px; background: ${this.isPuppetEditMode ? '#FF4444' : 'var(--accent-orange)'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        ${this.isPuppetEditMode ? '✅ 編集モード中 (クリックで終了)' : '✏️ 編集モード開始'}
                    </button>
                </div>
                <div class="property-group">
                    <div class="property-label">ピン数: ${clip.puppet.pins.length}</div>
                </div>
                <div class="property-group">
                    <div class="property-label">硬さ: <span id="puppetStiffness">${((clip.puppet.stiffness || 0.5) * 100).toFixed(0)}%</span></div>
                    <input type="range" class="property-slider" value="${(clip.puppet.stiffness || 0.5) * 100}" 
                        min="0" max="100" step="1"
                        oninput="document.getElementById('puppetStiffness').textContent = this.value + '%'; app.updatePuppetStiffness(parseFloat(this.value) / 100)">
                </div>
                <div class="property-group">
                    <button onclick="app.clearAllPuppetPins()" style="width: 100%; padding: 10px; background: var(--chocolate-dark); color: white; border: none; border-radius: 4px; cursor: pointer;">
                        🗑️ 全ピンクリア
                    </button>
                </div>
            ` : ''}
        `;
        return div;
    }
    
    // 風揺れタブのコンテンツを作成（簡易版）
    createWindShakeTabContent(clip) {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="property-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" ${clip.windShake?.enabled ? 'checked' : ''} onchange="app.toggleWindShake(this.checked)">
                    <span style="font-weight: bold;">風揺れエフェクト有効化</span>
                </label>
            </div>
            ${clip.windShake?.enabled ? `
                <div style="max-height: 700px; overflow-y: auto; padding-right: 8px;">
                    <div class="property-group">
                        <div class="property-label">分割数: <span id="windDivisions">${clip.windShake.divisions}</span></div>
                        <input type="range" class="property-slider" value="${clip.windShake.divisions}" 
                            min="1" max="50" step="1"
                            oninput="document.getElementById('windDivisions').textContent = this.value"
                            onchange="app.updateWindShakeProperty('divisions', parseInt(this.value))">
                    </div>
                    <div class="property-group">
                        <div class="property-label">揺れ角: <span id="windAngle">${clip.windShake.angle}°</span></div>
                        <input type="range" class="property-slider" value="${clip.windShake.angle}" 
                            min="0" max="360" step="1"
                            oninput="document.getElementById('windAngle').textContent = this.value + '°'"
                            onchange="app.updateWindShakeProperty('angle', parseFloat(this.value))">
                    </div>
                    <div class="property-group">
                        <div class="property-label">周期: <span id="windPeriod">${clip.windShake.period}秒</span></div>
                        <input type="range" class="property-slider" value="${clip.windShake.period}" 
                            min="0.01" max="10" step="0.01"
                            oninput="document.getElementById('windPeriod').textContent = parseFloat(this.value).toFixed(2) + '秒'"
                            onchange="app.updateWindShakeProperty('period', parseFloat(this.value))">
                    </div>
                </div>
            ` : ''}
        `;
        return div;
    }
    
    // ブラータブのコンテンツを作成
    createBlurTabContent(clip) {
        const div = document.createElement('div');
        div.innerHTML = `
            <h3 style="margin: 0 0 12px 0; color: var(--biscuit-light);">🌫️ ガウシアンブラー</h3>
            <div class="property-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" ${clip.gaussianBlur?.enabled ? 'checked' : ''} onchange="app.toggleGaussianBlur(this.checked)">
                    <span>有効化</span>
                </label>
            </div>
            ${clip.gaussianBlur?.enabled ? `
                <div class="property-group">
                    <div class="property-label">強度: <span id="gaussianStrength">${clip.gaussianBlur.strength}</span></div>
                    <input type="range" class="property-slider" value="${clip.gaussianBlur.strength}" 
                        min="0" max="50" step="1"
                        oninput="document.getElementById('gaussianStrength').textContent = this.value"
                        onchange="app.updateGaussianBlurProperty('strength', parseInt(this.value))">
                </div>
            ` : ''}
            
            <h3 style="margin: 24px 0 12px 0; color: var(--biscuit-light);">📷 レンズブラー</h3>
            <div class="property-group">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="checkbox" ${clip.lensBlur?.enabled ? 'checked' : ''} onchange="app.toggleLensBlur(this.checked)">
                    <span>有効化</span>
                </label>
            </div>
            ${clip.lensBlur?.enabled ? `
                <div class="property-group">
                    <div class="property-label">強度: <span id="lensStrength">${clip.lensBlur.strength}</span></div>
                    <input type="range" class="property-slider" value="${clip.lensBlur.strength}" 
                        min="0" max="100" step="1"
                        oninput="document.getElementById('lensStrength').textContent = this.value"
                        onchange="app.updateLensBlurProperty('strength', parseInt(this.value))">
                </div>
                <div class="property-group">
                    <div class="property-label">フォーカス位置: <span id="lensFocus">${clip.lensBlur.focusPosition}%</span></div>
                    <input type="range" class="property-slider" value="${clip.lensBlur.focusPosition}" 
                        min="0" max="100" step="1"
                        oninput="document.getElementById('lensFocus').textContent = this.value + '%'"
                        onchange="app.updateLensBlurProperty('focusPosition', parseInt(this.value))">
                </div>
            ` : ''}
        `;
        return div;
    }
    
    // 個別のエフェクト詳細ウィンドウを開く
    openEffectDetailWindow(effectType) {
        const windowId = `effectDetailWindow_${effectType}`;
        
        // 既存のウィンドウがあれば削除
        const existingWindow = document.getElementById(windowId);
        if (existingWindow) {
            existingWindow.remove();
            return;
        }
        
        // 元のコントロールを探す
        const sourceControls = document.getElementById(`${effectType}Controls`);
        if (!sourceControls) {
            alert('エフェクトコントロールが見つかりません');
            return;
        }
        
        // タイトルマップ
        const titleMap = {
            'letterbox': '🎬 映画風レターボックス',
            'gradient': '🌈 グラデーション',
            'diffusion': '✨ ディフュージョン撮影',
            'colorKey': '🎨 カラーキー',
            'normalize': '✨ ノーマライズ(スムージング)'
        };
        
        this.createDetailWindow(windowId, titleMap[effectType] || effectType, sourceControls.innerHTML);
    }
    
    // 個別のクリップエフェクト詳細ウィンドウを開く
    openClipEffectDetailWindow(effectType) {
        const windowId = `clipEffectDetailWindow_${effectType}`;
        
        // 既存のウィンドウがあれば削除
        const existingWindow = document.getElementById(windowId);
        if (existingWindow) {
            existingWindow.remove();
            return;
        }
        
        // 元のコントロールを探す
        const sourceControls = document.getElementById(`${effectType}Controls`);
        if (!sourceControls) {
            alert('エフェクトコントロールが見つかりません');
            return;
        }
        
        // タイトルマップ
        const titleMap = {
            'puppet': '🎭 パペットアニメーション',
            'windShake': '🍃 風揺れエフェクト',
            'gaussianBlur': '🌫️ ガウシアンブラー',
            'lensBlur': '📷 レンズブラー (被写界深度)'
        };
        
        this.createDetailWindow(windowId, titleMap[effectType] || effectType, sourceControls.innerHTML);
    }
    
    // 詳細ウィンドウを作成
    createDetailWindow(windowId, title, content) {
        const window = document.createElement('div');
        window.id = windowId;
        window.className = 'effect-editor-window visible';
        window.style.left = '100px';
        window.style.top = '100px';
        window.style.width = '500px';
        window.style.height = '900px';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'effect-editor-header';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'effect-editor-title';
        titleDiv.textContent = title;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'effect-editor-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => window.remove();
        
        header.appendChild(titleDiv);
        header.appendChild(closeBtn);
        
        // コンテンツエリア - 元のコントロールをそのまま移動
        const contentDiv = document.createElement('div');
        contentDiv.className = 'effect-editor-content';
        
        // 元のコントロールのIDから取得して移動
        const effectType = windowId.replace('effectDetailWindow_', '').replace('clipEffectDetailWindow_', '');
        const originalControls = document.getElementById(`${effectType}Controls`);
        
        if (originalControls) {
            // 元のコントロールを一時的に保存
            const originalParent = originalControls.parentNode;
            const originalDisplay = originalControls.style.display;
            
            // ウィンドウに移動
            contentDiv.appendChild(originalControls);
            originalControls.style.display = 'block';
            
            // ウィンドウが閉じられたときに元に戻す
            const originalClose = closeBtn.onclick;
            closeBtn.onclick = () => {
                if (originalParent) {
                    originalParent.appendChild(originalControls);
                    originalControls.style.display = originalDisplay;
                }
                window.remove();
            };
        } else {
            contentDiv.innerHTML = content;
        }
        
        // リサイズハンドル
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'effect-editor-resize-handle';
        
        window.appendChild(header);
        window.appendChild(contentDiv);
        window.appendChild(resizeHandle);
        
        document.body.appendChild(window);
        
        // ドラッグ機能
        this.makeWindowDraggable(window, header);
        
        // リサイズ機能
        this.makeWindowResizable(window, resizeHandle);
    }
    
    // 編集ウィンドウを開く共通関数
    openEditorWindow(type) {
        const isClipEffect = type === 'clipEffect';
        const windowId = isClipEffect ? 'clipEffectEditorWindow' : 'effectEditorWindow';
        const sourceId = isClipEffect ? 'clipPropertiesPanel' : 'effects-panel';
        
        // 既存のウィンドウがあれば削除
        const existingWindow = document.getElementById(windowId);
        if (existingWindow) {
            existingWindow.remove();
            return;
        }
        
        // 元のパネルを探す
        const sourcePanel = isClipEffect ? 
            document.querySelector('.clip-properties-content') :
            document.querySelector('.effects-content');
        
        if (!sourcePanel) {
            alert('エフェクトパネルが見つかりません');
            return;
        }
        
        // ウィンドウを作成
        const window = document.createElement('div');
        window.id = windowId;
        window.className = 'effect-editor-window visible';
        window.style.left = '100px';
        window.style.top = '100px';
        window.style.width = '500px';
        window.style.height = '900px';
        
        // ヘッダー
        const header = document.createElement('div');
        header.className = 'effect-editor-header';
        
        const title = document.createElement('div');
        title.className = 'effect-editor-title';
        title.textContent = isClipEffect ? '🎨 クリップエフェクト編集' : '✨ エフェクト編集';
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'effect-editor-close';
        closeBtn.textContent = '×';
        closeBtn.onclick = () => window.remove();
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // コンテンツエリア
        const content = document.createElement('div');
        content.className = 'effect-editor-content';
        content.innerHTML = sourcePanel.innerHTML; // 元のパネルの内容をコピー
        
        // リサイズハンドル
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'effect-editor-resize-handle';
        
        window.appendChild(header);
        window.appendChild(content);
        window.appendChild(resizeHandle);
        
        document.body.appendChild(window);
        
        // ドラッグ機能
        this.makeWindowDraggable(window, header);
        
        // リサイズ機能
        this.makeWindowResizable(window, resizeHandle);
    }
    
    // ウィンドウをドラッグ可能にする
    makeWindowDraggable(windowElement, handle) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        
        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.effect-editor-close')) return;
            
            isDragging = true;
            initialX = e.clientX - windowElement.offsetLeft;
            initialY = e.clientY - windowElement.offsetTop;
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            
            windowElement.style.left = currentX + 'px';
            windowElement.style.top = currentY + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }
    
    // ウィンドウをリサイズ可能にする
    makeWindowResizable(windowElement, handle) {
        let isResizing = false;
        let initialWidth;
        let initialHeight;
        let initialMouseX;
        let initialMouseY;
        
        handle.addEventListener('mousedown', (e) => {
            isResizing = true;
            initialWidth = windowElement.offsetWidth;
            initialHeight = windowElement.offsetHeight;
            initialMouseX = e.clientX;
            initialMouseY = e.clientY;
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - initialMouseX;
            const deltaY = e.clientY - initialMouseY;
            
            const newWidth = Math.max(400, initialWidth + deltaX);
            const newHeight = Math.max(300, initialHeight + deltaY);
            
            windowElement.style.width = newWidth + 'px';
            windowElement.style.height = newHeight + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            isResizing = false;
        });
    }
}

// アプリケーション初期化
const app = new StarlitTimelineApp();
