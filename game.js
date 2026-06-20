// ── Bitmap font — atlas + Angelcode XML built, game starts after PNG blob ready ──
const _GF_KEY = '_gf';
let _gfPngURL = null;
let _gfXmlURL = null;

(function _buildGameFont() {
    const BASE = 88, PAD = 3, MAX_W = 2048;
    const CHARS = ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~—0123456789' +
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' +
        '→←◆✓▶★✖×♪⚡❄✨✏∞' +
        'АБВГДЕЁЖЗИЙКЛМНОП' + 'РСТУФХЦЧШЩЪЫЬЭЮЯ' +
        'абвгдеёжзийклмноп' + 'рстуфхцчшщъыьэюя';
    const uniq = [...new Set(CHARS)];
    const FSTR = `bold ${BASE}px "Segoe UI","Segoe UI Emoji",Arial,sans-serif`;
    const mc = document.createElement('canvas'); mc.width = 2; mc.height = 2;
    const mctx = mc.getContext('2d'); mctx.font = FSTR;
    const H = BASE + PAD * 4 + 4;
    const glyphs = {}; let rx = PAD, ry = 0;
    for (const ch of uniq) {
        const w = Math.ceil(mctx.measureText(ch).width) + PAD * 2;
        if (rx + w + PAD > MAX_W) { ry += H + PAD; rx = PAD; }
        glyphs[ch] = { x: rx, y: ry, w };
        rx += w + PAD;
    }
    const totalH = ry + H;
    const cv = document.createElement('canvas'); cv.width = MAX_W; cv.height = totalH;
    const ctx = cv.getContext('2d'); ctx.font = FSTR; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.72)'; ctx.lineWidth = BASE * 0.09; ctx.lineJoin = 'round';
    for (const [ch, g] of Object.entries(glyphs)) ctx.strokeText(ch, g.x + PAD, g.y + H / 2);
    ctx.fillStyle = '#fff';
    for (const [ch, g] of Object.entries(glyphs)) ctx.fillText(ch, g.x + PAD, g.y + H / 2);

    // Build Angelcode BMFont XML — Phaser's native bitmap font format
    let xmlChars = '';
    for (const [ch, g] of Object.entries(glyphs)) {
        const id = ch.codePointAt(0);
        xmlChars += `<char id="${id}" x="${g.x}" y="${g.y}" width="${g.w}" height="${H}" xoffset="0" yoffset="0" xadvance="${g.w - PAD}" page="0" chnl="0"/>`;
    }
    const xml = `<?xml version="1.0"?><font><info face="${_GF_KEY}" size="${BASE}" bold="1" italic="0" charset="" unicode="1" stretchH="100" smooth="1" aa="1" padding="0,0,0,0" spacing="1,1"/><common lineHeight="${H}" base="${BASE}" scaleW="${MAX_W}" scaleH="${totalH}" pages="1" packed="0"/><pages><page id="0" file="font.png"/></pages><chars count="${uniq.length}">${xmlChars}</chars></font>`;
    _gfXmlURL = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));

    cv.toBlob(function(blob) {
        _gfPngURL = URL.createObjectURL(blob);
        _startPhaserGame();
    }, 'image/png');
})();

// Called from each scene's preload() — loads font via Phaser's native bitmapFont pipeline
function _preloadGameFont(scene) {
    if (!scene.cache.bitmapFont.has(_GF_KEY)) {
        scene.load.bitmapFont(_GF_KEY, _gfPngURL, _gfXmlURL);
    }
}

// Called from each scene's create() — sets linear filtering on first call, returns key
function _initGameFont(scene) {
    const tex = scene.textures.get(_GF_KEY);
    if (tex && !tex._gfLinear) {
        tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
        tex._gfLinear = true;
    }
    return _GF_KEY;
}

class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }

    init(data) {
        this.infiniteMode = !!(data && data.mode === 'infinite');
        this.customWalls = (data && data.customWalls) || null;
        this.testMode = !!(data && data.testMode);
        this.testLevelNum = (data && data.levelNum) || null;
        this.lightTheme = !!(data && data.lightTheme);
        this._initTargetMoney = (data && data.targetMoney) || null;
        const resumeKey = this.infiniteMode ? 'bumper_save_infinite' : 'bumper_save_normal';
        try {
            const raw = this.testMode ? null : localStorage.getItem(resumeKey);
            this.resumeData = raw ? JSON.parse(raw) : null;
        } catch (e) { this.resumeData = null; }
    }

    preload() { _preloadGameFont(this); }

    saveProgress() {
        if (this.testMode) return;
        const walls = [];
        this.wallsGroup.children.iterate(w => {
            if (w) walls.push({ x: w.x, y: w.y, type: w.wallType, incomeValue: w.incomeValue, specialType: w.specialType || null });
        });
        const state = {
            mode: this.infiniteMode ? 'infinite' : 'normal',
            level: this.registry.get('level') || 1,
            money: Math.round(this.money),
            totalEarned: Math.round(this.totalEarned),
            ballCount: this.ballsGroup.children.size,
            wallHand: this.wallHand.map(i => i ? { type: i.type, incomeValue: i.incomeValue, bonus: i.bonus || false } : null),
            placedWalls: walls,
            buttonLevels: { ball: this.buttonBall.level || 0, wallPack: this.buttonWallPack.level || 0, income: this.buttonIncome.level || 0 },
            costs: { ball: this.ballCost, wallPack: this.wallPackCost, income: this.incomeCost }
        };
        const key = this.infiniteMode ? 'bumper_save_infinite' : 'bumper_save_normal';
        try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) { }
    }

    _applyResumeData(d) {
        if (!d) return;
        this.money = d.money || 0;
        this.totalEarned = d.totalEarned || 0;
        if (d.costs) { this.ballCost = d.costs.ball; this.wallPackCost = d.costs.wallPack; this.incomeCost = d.costs.income; }
        if (d.buttonLevels) { this.buttonBall.level = d.buttonLevels.ball; this.buttonWallPack.level = d.buttonLevels.wallPack; this.buttonIncome.level = d.buttonLevels.income; }
        if (d.wallHand) this.wallHand = d.wallHand;
        // Safely destroy existing balls (copy array first)
        this.ballsGroup.getChildren().slice().forEach(b => { if (b && b.active) b.destroy(); });
        const bCount = d.ballCount || 1;
        for (let i = 0; i < bCount; i++) this.createBall();
        // Destroy initial hand walls placed by create(), then restore saved ones
        this.wallsGroup.getChildren().slice().forEach(w => {
            if (w && w.active) {
                if (w._fillGfx && w._fillGfx !== w && w._fillGfx.active) w._fillGfx.destroy();
                if (w._outlineGfx && w._outlineGfx.active) w._outlineGfx.destroy();
                if (w.valueText && w.valueText.active) w.valueText.destroy();
                w.destroy();
            }
        });
        this.placedWalls = 0;
        if (d.placedWalls) {
            d.placedWalls.forEach(pw => {
                const { w, h } = this.getWallDims(pw.type);
                const wall = this.createWall(pw.x, pw.y, w, h, pw.type, pw.incomeValue);
                if (pw.specialType) this._applySpecialWallStyle(wall, pw.specialType);
            });
            this.placedWalls = d.placedWalls.length;
        }
        this.updateSlotsUI(); this.updateUI();
    }


    create() {
        this.BALL_R = 18;
        this.fieldSize = 392;
        this.fieldOffsetX = 184;
        this.fieldOffsetY = 102;
        this.fieldCX = 380;
        this.fieldCY = 298;
        this.slotY = 605;
        this.btnY = 790;

        this.targetMoney = this._initTargetMoney || 2000; this.money = 0; this.totalEarned = 0; this.incomeBase = 1;
        this.placedWalls = 0; this.ballCost = 20; this.wallPackCost = 20;
        this.incomeCost = 50; this.gameWon = false;
        this.draggingNewWall = false; this.draggingSlotIndex = -1;
        this.draggingWallType = null; this.draggingIncomeValue = 0;
        this.muted = false; this._audioCtx = null; this._lastHitSound = 0; this._freezeBuffer = null;
        // load freeze.wav asynchronously via Web Audio API
        try {
            const _ctx = new (window.AudioContext || window.webkitAudioContext)();
            this._audioCtx = _ctx;
            fetch('freeze.wav').then(r => r.arrayBuffer()).then(ab => _ctx.decodeAudioData(ab)).then(buf => { this._freezeBuffer = buf; }).catch(() => { });
        } catch (e) { }
        this._musicStarted = false; this._musicGain = null; this._musicTimeout = null;
        this._physicsSpeedMult = 1;
        this._incomeWindow = [];
        this._fpsHist = {};

        const types = ['horizontal', 'vertical', 'block', 'horizontal', 'vertical', 'block', 'block', 'block', 'block', 'horizontal', 'vertical', 'tDown', 'tRight', 'silverZone'];
        this.wallHand = [
            { type: Phaser.Math.RND.pick(types), incomeValue: Phaser.Math.Between(1, 3) },
            { type: Phaser.Math.RND.pick(types), incomeValue: Phaser.Math.Between(1, 3) },
            { type: Phaser.Math.RND.pick(types), incomeValue: Phaser.Math.Between(1, 3) }
        ];

        // field bg — checkerboard + glow baked into one RenderTexture (single draw call per frame)
        const _cs = 28;
        const _bgGfx = this.make.graphics({ add: false });
        if (this.lightTheme) {
            for (let r = 0; r < 14; r++)
                for (let c = 0; c < 14; c++) {
                    _bgGfx.fillStyle((r + c) % 2 === 0 ? 0xf0e6c8 : 0xddd0a8, 1);
                    _bgGfx.fillRect(this.fieldOffsetX + c * _cs, this.fieldOffsetY + r * _cs, _cs, _cs);
                }
            _bgGfx.lineStyle(4, 0x8b6a3a, 1);
            _bgGfx.strokeRect(this.fieldOffsetX, this.fieldOffsetY, this.fieldSize, this.fieldSize);
        } else {
            for (let r = 0; r < 14; r++)
                for (let c = 0; c < 14; c++) {
                    _bgGfx.fillStyle((r + c) % 2 === 0 ? 0x333333 : 0x000000, 1);
                    _bgGfx.fillRect(this.fieldOffsetX + c * _cs, this.fieldOffsetY + r * _cs, _cs, _cs);
                }
            _bgGfx.lineStyle(4, 0x8855dd, 1);
            _bgGfx.strokeRect(this.fieldOffsetX, this.fieldOffsetY, this.fieldSize, this.fieldSize);
        }
        const _gx = this.fieldOffsetX, _gy = this.fieldOffsetY, _gs = this.fieldSize;
        const _glowColor = this.lightTheme ? 0xc8962a : 0x9966ff;
        const _glowN = 30;
        for (let _i = 0; _i < _glowN; _i++) {
            const _spread = (_glowN - _i) * 1.7;
            const _t = _i / (_glowN - 1);
            const _a = 0.42 * _t * _t * _t;
            const _r = 6 + _spread * 0.35;
            _bgGfx.lineStyle(2, _glowColor, _a);
            _bgGfx.strokeRoundedRect(_gx - _spread, _gy - _spread, _gs + _spread * 2, _gs + _spread * 2, _r);
        }
        this.add.renderTexture(0, 0, 760, 870).setDepth(0).setOrigin(0).draw(_bgGfx, 0, 0);
        _bgGfx.destroy();

        if (this.lightTheme) {
            this.cameras.main.setBackgroundColor('#e8dbb8');
            document.body.style.background = '#e8dbb8';
        }
        this.events.once('shutdown', () => {
            document.body.style.transition = '';
            document.body.style.background = '';
        });
        this._genCheckerTexture();
        this.physics.world.setBounds(this.fieldOffsetX, this.fieldOffsetY, this.fieldSize, this.fieldSize);
        this.wallsGroup = this.physics.add.staticGroup();
        this.ballsGroup = this.physics.add.group({ runChildUpdate: true });
        this.zones = [];
        this.time.addEvent({ delay: 1000, loop: true, callback: () => this._updateZones() });
        this._ballOverlayGfx = null;
        this._genParticleTexture();
        this._genWallDustTexture();
        this._genStarTexture();
        this._genLuzTexture();
        this._initWallShapesAtlas();
        this._gf = _initGameFont(this);

        this.createBall();
        this.createUI();
        this.setupInput();
        this.updateUI();
        this.input.once('pointerdown', () => this.startMusic());
        // Place any editor-defined custom walls
        if (this.customWalls && this.customWalls.length) {
            const D = this.BALL_R * 2;
            this.customWalls.forEach(cw => {
                if (cw.specialType === 'zone') {
                    this._createZone(cw.x, cw.y, D, D * 2);
                } else if (cw.specialType === 'income') {
                    this.createWall(cw.x, cw.y, D, D, 'block', Phaser.Math.Between(1, 3));
                } else {
                    const wall = this.createWall(cw.x, cw.y, D, D, 'block', 0);
                    wall.incomeValue = 0;
                    wall.isEditorWall = true;
                    if (cw.specialType) this._applySpecialWallStyle(wall, cw.specialType, cw.color, cw.damage);
                    else if (wall.valueText) wall.valueText.setText('');
                }
            });
        }
        if (this.zones && this.zones.length && !this.customWalls) this._scheduleZoneRelocation();
        // Restore saved progress if resuming
        if (this.resumeData) this._applyResumeData(this.resumeData);
        // Auto-save and stop music on scene shutdown
        this.events.once('shutdown', () => { try { if (!this.gameWon) this.saveProgress(); this.stopMusic(); } catch (e) { } });
    }

    // _genCheckerTexture() {
    //     const g = this.make.graphics({ add: false });
    //     g.fillStyle(0x180800); g.fillRect(0, 0, 24, 24);
    //     g.fillStyle(0x3c1e08); g.fillRect(1, 1, 22, 22);
    //     // vivid amber facet bands
    //     [[1,1,22,7,0x9a5020],[1,8,22,6,0x7a3c14],[1,14,22,5,0x5a2c10],[1,19,22,4,0x3c1e08]]
    //         .forEach(([x,y,w,h,c]) => { g.fillStyle(c); g.fillRect(x,y,w,h); });
    //     // top-left bevel — vivid orange highlight
    //     g.fillStyle(0xff8833); g.fillRect(1, 1, 22, 1); g.fillRect(1, 1, 1, 22);
    //     // secondary highlight line
    //     g.fillStyle(0xffcc66, 0.35); g.fillRect(2, 2, 20, 1);
    //     // bottom-right shadow
    //     g.fillStyle(0x080302); g.fillRect(1, 22, 22, 1); g.fillRect(22, 1, 1, 22);
    //     // horizontal facet line
    //     g.fillStyle(0x2c1006, 0.7); g.fillRect(1, 9, 22, 1);
    //     // corner nodes: dark ring + bright gold center
    //     [[3,3],[20,3],[3,20],[20,20]].forEach(([rx,ry]) => { g.fillStyle(0x8a3812); g.fillRect(rx-1,ry-1,3,3); g.fillStyle(0xffcc44); g.fillRect(rx,ry,1,1); });
    //     // center diamond cross
    //     g.fillStyle(0x2a1006); g.fillRect(10,11,4,2); g.fillRect(11,10,2,4);
    //     g.fillStyle(0xff9944); g.fillRect(11,11,2,2);
    //     g.generateTexture('checker', 24, 24);
    //     g.destroy();
    // }
    _genCheckerTexture() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0x180800); g.fillRect(0, 0, 24, 24);
        g.fillStyle(0x3c1e08); g.fillRect(1, 1, 22, 22);
        // vivid amber facet bands
        [[1, 1, 22, 7, 0xfaf000], [1, 8, 22, 6, 0xecbe08], [1, 14, 22, 5, 0xfaf000], [1, 19, 22, 4, 0xecbe08]]
            .forEach(([x, y, w, h, c]) => { g.fillStyle(c); g.fillRect(x, y, w, h); });
        // top-left bevel — vivid orange highlight
        g.fillStyle(0xffffff); g.fillRect(1, 1, 22, 1); g.fillRect(1, 1, 1, 22);
        // secondary highlight line
        g.fillStyle(0xffcc66, 0.35); g.fillRect(2, 2, 20, 1);
        // bottom-right shadow
        g.fillStyle(0x080302); g.fillRect(1, 22, 22, 1); g.fillRect(22, 1, 1, 22);
        // horizontal facet line
        g.fillStyle(0x2c1006, 0.7); g.fillRect(1, 9, 22, 1);
        // corner nodes: dark ring + bright gold center
        [[3, 3], [20, 3], [3, 20], [20, 20]].forEach(([rx, ry]) => { g.fillStyle(0x8a3812); g.fillRect(rx - 1, ry - 1, 3, 3); g.fillStyle(0xffcc44); g.fillRect(rx, ry, 1, 1); });
        // center diamond cross
        g.fillStyle(0x2a1006); g.fillRect(10, 11, 4, 2); g.fillRect(11, 10, 2, 4);
        g.fillStyle(0xff9944); g.fillRect(11, 11, 2, 2);
        g.generateTexture('checker', 24, 24);
        g.destroy();
    }

    _genParticleTexture() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(24, 24, 24);
        g.generateTexture('particle', 48, 48);
        g.destroy();
    }

    _genWallDustTexture() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(24, 24, 24);
        g.generateTexture('wallDust', 48, 48);
        g.destroy();
    }

    _genStarTexture() {
        if (this.textures.exists('star')) return;
        const sz = 16, c = sz / 2;
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffffff, 1);
        const pts = [];
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
            const r = (i % 2 === 0) ? c - 1 : c * 0.28;
            pts.push({ x: c + Math.cos(ang) * r, y: c + Math.sin(ang) * r });
        }
        g.fillPoints(pts, true, true);
        g.generateTexture('star', sz, sz);
        g.destroy();
    }

    _genLuzTexture() {
        if (this.textures.exists('luz')) return;
        const sz = 32, c = sz / 2;
        const g = this.make.graphics({ add: false });
        [[c, 0.05], [c * 0.75, 0.12], [c * 0.55, 0.22], [c * 0.35, 0.45], [c * 0.18, 0.8], [c * 0.07, 1]].forEach(([r, a]) => {
            g.fillStyle(0xffffff, a);
            g.fillCircle(c, c, r);
        });
        g.generateTexture('luz', sz, sz);
        g.destroy();
    }

    // ──── Audio: SFX ────

    getAudioCtx() {
        if (!this._audioCtx)
            try { this._audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { }
        return this._audioCtx;
    }

    playSound(type) {
        if (this.muted) return;
        try {
            const ctx = this.getAudioCtx(); if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();
            const t = ctx.currentTime;
            switch (type) {
                case 'hover': { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = 1000; g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04); o.start(t); o.stop(t + 0.04); break; }
                case 'hit': { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(100, t + 0.07); g.gain.setValueAtTime(0.13, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.start(t); o.stop(t + 0.09); break; }
                case 'wallhit': { [880, 1320, 1760].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), dt = i * 0.038; o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + dt + 0.18); g.gain.setValueAtTime(0.10, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.20); o.start(t + dt); o.stop(t + dt + 0.21); }); break; }
                case 'merge': { [280, 420, 600, 840].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), dt = i * 0.065; o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.13, t + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.15); o.start(t + dt); o.stop(t + dt + 0.15); }); break; }
                case 'buy': { [350, 500, 700].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), dt = i * 0.055; o.connect(g); g.connect(ctx.destination); o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.11, t + dt); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.13); o.start(t + dt); o.stop(t + dt + 0.13); }); break; }
                case 'place': { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.value = 440; g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.start(t); o.stop(t + 0.09); break; }
                case 'return': { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(280, t + 0.13); g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.start(t); o.stop(t + 0.15); break; }
                case 'error': { const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type = 'sawtooth'; o.frequency.value = 140; g.gain.setValueAtTime(0.09, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.start(t); o.stop(t + 0.2); break; }
                case 'freeze': { if (!this._freezeBuffer) break; const _fs = ctx.createBufferSource(); _fs.buffer = this._freezeBuffer; const _fg = ctx.createGain(); _fs.connect(_fg); _fg.connect(ctx.destination); _fg.gain.setValueAtTime(0.55, t); _fs.start(t); break; }
                case 'trap': { for (let _pi = 0; _pi < 3; _pi++) { const _dt = _pi * 0.072, _dur = 0.09; const _buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * _dur), ctx.sampleRate); const _d = _buf.getChannelData(0); for (let _j = 0; _j < _d.length; _j++) _d[_j] = Math.random() * 2 - 1; const _src = ctx.createBufferSource(); _src.buffer = _buf; const _hi = ctx.createBiquadFilter(); _hi.type = 'highpass'; _hi.frequency.value = 3200 + _pi * 400; const _g = ctx.createGain(); _src.connect(_hi); _hi.connect(_g); _g.connect(ctx.destination); _g.gain.setValueAtTime(0.16, t + _dt); _g.gain.exponentialRampToValueAtTime(0.001, t + _dt + _dur); _src.start(t + _dt); _src.stop(t + _dt + _dur + 0.01); } break; }
                case 'bonus': { [520, 780, 1100, 1560, 2100].forEach((f, i) => { const o = ctx.createOscillator(), g = ctx.createGain(), dt = i * 0.052; o.connect(g); g.connect(ctx.destination); o.type = i < 3 ? 'sine' : 'triangle'; o.frequency.setValueAtTime(f, t + dt); o.frequency.exponentialRampToValueAtTime(f * 1.08, t + dt + 0.14); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.1, t + dt + 0.018); g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.2); o.start(t + dt); o.stop(t + dt + 0.21); }); break; }
                case 'win': {
                    const fanfare = [523, 659, 784, 659, 784, 1047, 1319, 1568, 2093];
                    fanfare.forEach((f, i) => {
                        const o = ctx.createOscillator(), g = ctx.createGain(), dt = i * 0.11;
                        o.connect(g); g.connect(ctx.destination);
                        o.type = i % 2 === 0 ? 'sine' : 'triangle';
                        o.frequency.setValueAtTime(f, t + dt);
                        o.frequency.exponentialRampToValueAtTime(f * 1.04, t + dt + 0.18);
                        g.gain.setValueAtTime(0, t + dt);
                        g.gain.linearRampToValueAtTime(0.14, t + dt + 0.025);
                        g.gain.exponentialRampToValueAtTime(0.001, t + dt + 0.38);
                        o.start(t + dt); o.stop(t + dt + 0.4);
                    });
                    break;
                }
            }
        } catch (e) { }
    }

    // ──── Audio: Music ────

    startMusic() {
        const ctx = this.getAudioCtx();
        if (!ctx || this._musicStarted) return;
        this._musicStarted = true;
        if (ctx.state === 'suspended') ctx.resume();
        this._musicGain = ctx.createGain();
        this._musicGain.gain.value = this.muted ? 0 : 0.12;
        this._musicGain.connect(ctx.destination);
        this._musicBeat = 60 / 108;
        this._nextMusicT = ctx.currentTime + 0.1;
        this._loopMusic();
    }

    _oscNote(ctx, dest, freq, st, dur, type, vol) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(dest);
        o.type = type; o.frequency.value = freq;
        const atk = Math.min(0.04, dur * 0.1);
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(vol, st + atk);
        g.gain.setValueAtTime(vol * 0.75, st + dur * 0.65);
        g.gain.exponentialRampToValueAtTime(0.001, st + dur);
        o.start(st); o.stop(st + dur + 0.01);
    }

    _loopMusic() {
        if (!this._musicStarted || !this._audioCtx) return;
        const ctx = this._audioCtx, b = this._musicBeat, t = this._nextMusicT, mg = this._musicGain;
        const n = (f, sb, db, tp, v) => this._oscNote(ctx, mg, f, t + sb * b, db * b, tp || 'triangle', v || 0.26);
        n(659.25, 0, 1.0); n(783.99, 1, 0.5); n(880.00, 1.5, 0.5); n(783.99, 2, 0.85); n(659.25, 3, 0.9);
        n(523.25, 4, 1.8); n(659.25, 6, 0.8); n(587.33, 7, 0.9);
        n(523.25, 8, 0.8); n(440.00, 9, 0.85); n(392.00, 10, 0.8); n(440.00, 11, 0.9);
        n(392.00, 12, 1.5); n(329.63, 13.5, 0.5); n(392.00, 14, 0.85); n(329.63, 15, 0.9);
        [0, 2].forEach(sb => n(130.81, sb, 1.85, 'sine', 0.36));
        [4, 6].forEach(sb => n(110.00, sb, 1.85, 'sine', 0.36));
        [8, 10].forEach(sb => n(174.61, sb, 1.85, 'sine', 0.36));
        [12, 14].forEach(sb => n(196.00, sb, 1.85, 'sine', 0.36));
        [[[130.81, 164.81, 196.00], 0], [[110.00, 130.81, 164.81], 4],
        [[174.61, 220.00, 261.63], 8], [[196.00, 246.94, 293.66], 12]
        ].forEach(([fs, sb]) => fs.forEach(f => n(f, sb, 3.85, 'sine', 0.065)));
        for (let bar = 0; bar < 4; bar++) [0, 2].forEach(beat => {
            const kt = t + (bar * 4 + beat) * b, kv = beat === 0 ? 0.45 : 0.28;
            const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(mg); o.type = 'sine';
            o.frequency.setValueAtTime(155, kt); o.frequency.exponentialRampToValueAtTime(40, kt + 0.13);
            g.gain.setValueAtTime(kv, kt); g.gain.exponentialRampToValueAtTime(0.001, kt + 0.15);
            o.start(kt); o.stop(kt + 0.16);
        });
        for (let i = 0; i < 16; i++) {
            const ht = t + i * b;
            const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(mg); o.type = 'square'; o.frequency.value = 7800;
            g.gain.setValueAtTime(0.030, ht); g.gain.exponentialRampToValueAtTime(0.001, ht + 0.05); o.start(ht); o.stop(ht + 0.055);
            const ot = ht + b * 0.5;
            const o2 = ctx.createOscillator(), g2 = ctx.createGain(); o2.connect(g2); g2.connect(mg); o2.type = 'square'; o2.frequency.value = 7200;
            g2.gain.setValueAtTime(0.014, ot); g2.gain.exponentialRampToValueAtTime(0.001, ot + 0.04); o2.start(ot); o2.stop(ot + 0.044);
        }
        const loopDur = 16 * b;
        this._nextMusicT = t + loopDur;
        this._musicTimeout = window.setTimeout(() => this._loopMusic(), Math.max(100, (this._nextMusicT - ctx.currentTime - 2 * b) * 1000));
    }

    toggleMute() {
        this.muted = !this.muted;
        this.muteBtn.setText(this.muted ? '🔇' : '🔊');
        if (this._musicGain && this._audioCtx)
            this._musicGain.gain.setValueAtTime(this.muted ? 0 : 0.12, this._audioCtx.currentTime);
        if (!this.muted && !this._musicStarted) this.startMusic();
    }

    stopMusic() {
        this._musicStarted = false;
        if (this._musicTimeout) { window.clearTimeout(this._musicTimeout); this._musicTimeout = null; }
        if (this._musicGain) { try { this._musicGain.disconnect(); } catch (e) { } this._musicGain = null; }
        if (this._audioCtx) { try { this._audioCtx.close(); } catch (e) { } this._audioCtx = null; }
    }

    // ──── Ball ────

    createBall() {
        const R = Math.round(this.BALL_R * 0.9);
        const ox = this.fieldOffsetX, oy = this.fieldOffsetY, fs = this.fieldSize;
        const ball = this.add.circle(
            Phaser.Math.Between(ox + 80, ox + fs - 80),
            Phaser.Math.Between(oy + 80, oy + fs - 80),
            R, 0xf01cff
        ).setStrokeStyle(1, 0xf8ae0f).setDepth(2);
        this.physics.add.existing(ball);
        ball.body.setCircle(R).setBounce(1, 1).setAllowGravity(false).setDrag(0);
        ball.body.customSeparateX = true;
        ball.body.customSeparateY = true;
        ball.bounceSpeed = 200; ball.currentSpeed = 200;
        // ── PARTICLE TRAIL — edit config below ──────────────────
        // ball.trail = this.add.particles(0, 0, 'particle', {
        //     lifespan: 380,
        //     scale: { start: 0.8, end: 0 },
        //     alpha: { start: 0.6, end: 0 },
        //     // tint: 0xffccff,
        //     // blendMode: 1,
        //     frequency: -1
        // }).setDepth(1);
        ball.on('destroy', () => { if (ball.trail && ball.trail.active) ball.trail.destroy(); });
        // ─────────────────────────────────────────────────────────
        const angle = Phaser.Math.DegToRad(Phaser.Math.Between(25, 65));
        const sx = Phaser.Math.RND.pick([-1, 1]), sy = Phaser.Math.RND.pick([-1, 1]);
        ball.body.setVelocity(sx * Math.cos(angle) * 400, sy * Math.sin(angle) * 400);
        const _hr = Math.max(1, Math.round(R * 0.27));
        ball._highlight = this.add.arc(ball.x - R * 0.28, ball.y - R * 0.3, _hr)
            .setFillStyle(0xffffff, 0.55).setDepth(4);
        ball.on('destroy', () => { if (ball._highlight && ball._highlight.active) ball._highlight.destroy(); });
        this.ballsGroup.add(ball);
    }

    _squishBall(ball, scaleX, scaleY) {
        this.tweens.killTweensOf(ball);
        ball.setScale(1, 1);
        this.tweens.add({
            targets: ball, scaleX, scaleY, duration: 70, yoyo: true, hold: 8, ease: 'Power2',
            onComplete: () => { if (ball && ball.active) ball.setScale(1, 1); }
        });
    }

    // ──── Wall ────

    createWall(x, y, width, height, wallType, incomeValue) {
        const val = incomeValue !== undefined ? incomeValue : this.incomeBase;
        // Image from shared atlas — all walls batch in 1 WebGL draw call
        const wall = this.add.image(x, y, 'wallShapes', wallType).setOrigin(0.5, 0.5).setDepth(1);
        this.physics.add.existing(wall, true);
        wall.body.setSize(width, height);
        wall.isWall = true; wall.wallType = wallType;
        wall.incomeValue = val; wall.lastHit = 0; wall.lastFloat = 0;
        wall.wallTotalEarned = 0; wall._wallIncWin = [];
        wall.setInteractive({ useHandCursor: true });
        wall.on('pointerdown', (ptr) => this._pickUpFieldWall(ptr, wall));
        wall.on('pointerover', () => this._showWallTooltip(wall));
        wall.on('pointerout', () => this._hideWallTooltip());
        wall.on('destroy', () => this._hideWallTooltip());
        wall.valueText = this.add.bitmapText(x, y, this._gf, `${val}$`, 22).setOrigin(0.5).setDepth(3).setTint(0xffffff);
        this._setWallTint(wall, val);
        // compat refs — wall IS its own visual now
        wall._fillGfx = wall;
        wall._outlineGfx = null;
        wall._maskGfx = null;
        wall._drawMask = () => { };
        wall._drawFill = (ox, oy) => { if (wall.active) wall.setPosition(ox, oy); };
        wall._drawOutline = (ox, oy, color, alpha) => {
            const defColor = this._incomeToColors(wall.incomeValue).top;
            this._redrawWallOutlineGfx(wall._outlineGfx, wall, ox, oy, color, alpha, defColor);
        };
        this.wallsGroup.add(wall);
        return wall;
    }

    getWallDims(type) {
        const D = this.BALL_R * 2;
        if (type === 'block') return { w: D, h: D };
        if (type === 'silverZone') return { w: D, h: D * 2 };
        if (type === 'vertical') return { w: D, h: D * 3 };
        if (type === 'tDown' || type === 'tUp') return { w: D * 3, h: D * 2 };
        if (type === 'tLeft' || type === 'tRight') return { w: D * 2, h: D * 3 };
        return { w: D * 3, h: D };
    }

    // ──── Helpers ────

    showFloatingText(x, y, text, value) {
        const v = value || 0;
        const tint = v < 0 ? 0xff2200 : v >= 300 ? 0xff3311 : v >= 120 ? 0xff7722 : v >= 50 ? 0xffcc22 : v >= 20 ? 0xaaff22 : 0x04ff26;
        const t = this.add.bitmapText(x, y, this._gf, text, 22).setOrigin(0.5).setDepth(20).setTint(tint);
        this.tweens.add({
            targets: t, y: y - 40, scaleX: { from: 0, to: 1 }, duration: 380, ease: 'Power1',
            onComplete: () => {
                if (t && t.active)
                    this.tweens.add({ targets: t, y: '-=18', alpha: 0, duration: 320, ease: 'Power2', onComplete: () => t.destroy() });
            }
        });
    }

    showError(msg) {
        this.playSound('error');
        this.errorText.setText(msg).setAlpha(1);
        this.tweens.killTweensOf(this.errorText);
        this.tweens.add({ targets: this.errorText, alpha: 0, delay: 900, duration: 350 });
    }

    _getNewWallRects(cx, cy, w, h, type) {
        const D = this.BALL_R * 2;
        if (type === 'tDown') return [{ x: cx, y: cy - D / 2, hw: w / 2, hh: D / 2 }, { x: cx, y: cy + D / 2, hw: D / 2, hh: D / 2 }];
        if (type === 'tUp') return [{ x: cx, y: cy - D / 2, hw: D / 2, hh: D / 2 }, { x: cx, y: cy + D / 2, hw: w / 2, hh: D / 2 }];
        if (type === 'tLeft') return [{ x: cx - D / 2, y: cy, hw: D / 2, hh: D / 2 }, { x: cx + D / 2, y: cy, hw: D / 2, hh: h / 2 }];
        if (type === 'tRight') return [{ x: cx - D / 2, y: cy, hw: D / 2, hh: h / 2 }, { x: cx + D / 2, y: cy, hw: D / 2, hh: D / 2 }];
        return [{ x: cx, y: cy, hw: w / 2, hh: h / 2 }];
    }

    checkPlacementValid(cx, cy, w, h, type) {
        // Priority: what is directly under the cursor point?
        // Use actual collision rects (not bounding box) so T-wall empty corners don't block.
        let cursorTarget = null, cursorBlocked = false;
        this.wallsGroup.children.iterate(e => {
            if (!e) return;
            const eRects = this._getWallCollisionRects(e);
            let inside = false;
            for (const er of eRects) {
                if (cx > er.x - er.hw && cx < er.x + er.hw &&
                    cy > er.y - er.hh && cy < er.y + er.hh) { inside = true; break; }
            }
            if (inside) {
                if (e.isEditorWall) cursorBlocked = true;
                else if (e.wallType === type) cursorTarget = e;
                else cursorBlocked = true;
            }
        });
        if (cursorBlocked) return { ok: false, reason: 'Нельзя! Мешает другая стена' };
        if (cursorTarget) return { ok: true, mergeTarget: cursorTarget };

        // Fallback: actual T-shape rect overlap (3px shrink avoids false positives on touching edges)
        const SHRINK = 3;
        let diffBlocked = false, mergeTarget = null;
        const newRects = this._getNewWallRects(cx, cy, w, h, type);
        this.wallsGroup.children.iterate(e => {
            if (!e) return;
            const eRects = this._getWallCollisionRects(e);
            let overlaps = false;
            for (const nr of newRects) {
                for (const er of eRects) {
                    if ((nr.x - nr.hw + SHRINK) < (er.x + er.hw) && (nr.x + nr.hw - SHRINK) > (er.x - er.hw) &&
                        (nr.y - nr.hh + SHRINK) < (er.y + er.hh) && (nr.y + nr.hh - SHRINK) > (er.y - er.hh)) {
                        overlaps = true; break;
                    }
                }
                if (overlaps) break;
            }
            if (overlaps) {
                if (!e.isEditorWall && e.wallType === type && !mergeTarget) mergeTarget = e;
                else diffBlocked = true;
            }
        });
        if (diffBlocked) return { ok: false, reason: 'Нельзя! Мешает другая стена' };
        return { ok: true, mergeTarget };
    }

    // ──── UI ────

    createUI() {
        // ── Top panel (y 0–130): dark navy ──────────────────────────
        // this.add.rectangle(380, 65, 760, 130, 0x0e1a27);

        // subtle dot grid + wallet bg — all baked into RT before destroy
        const _icoX = 584, _valX = 604;
        const panelGfx = this.make.graphics({ add: false });
        panelGfx.fillStyle(0xffffff, 0.02);
        for (let gx = 30; gx < 760; gx += 48)
            for (let gy = 16; gy < 130; gy += 26)
                panelGfx.fillCircle(gx, gy, 1.5);
        // ── Right: wallet background panel ──
        panelGfx.fillStyle(this.lightTheme ? 0xf5ead0 : 0x070e16, 1);
        panelGfx.fillRoundedRect(415, 16, 330, 36, 6);
        panelGfx.lineStyle(2.5, this.lightTheme ? 0x6b4010 : 0x1e3d6a, this.lightTheme ? 1 : 0.7);
        panelGfx.strokeRoundedRect(415, 16, 330, 36, 6);
        // ball icon
        panelGfx.fillStyle(0xf01cff, 1);
        panelGfx.fillCircle(_icoX + 6, 124, 6);
        panelGfx.lineStyle(1.5, 0xf8ae0f, 1);
        panelGfx.strokeCircle(_icoX + 6, 124, 6);
        this.add.renderTexture(0, 0, 760, 130).setDepth(0).setOrigin(0).draw(panelGfx, 0, 0);
        panelGfx.destroy();

        // bottom separator line
        // this.add.rectangle(380, 129, 760, 2, 0x2d55aa).setAlpha(0.7);

        // ── Left: progress bar first, "ЦЕЛЬ УРОВНЯ" label below ─────
        this._pbx = 18; this._pby = 16; this._pbw = 360; this._pbh = 38;
        this._progressGfx = this.add.graphics().setDepth(4);
        this.barText = this.add.bitmapText(
            this._pbx + this._pbw / 2,
            this._pby + this._pbh / 2,
            this._gf, '0 / 2,000,000', 36
        ).setOrigin(0.5, 0.5).setDepth(5).setTint(this.lightTheme ? 0xaa7730 : 0x18ee50);
        const _lvl = this.registry.get('level') || 1;
        const _barLabel = this.infiniteMode ? '∞  БЕСКОНЕЧНЫЙ РЕЖИМ' : `ЦЕЛЬ УРОВНЯ ${_lvl}`;
        this.add.bitmapText(this._pbx + this._pbw / 2, this._pby + this._pbh + 5, this._gf, _barLabel, 22
        ).setOrigin(0.5, 0).setTint(this.infiniteMode ? 0x44aaff : (this.lightTheme ? 0xc89050 : 0xffffff));

        // ── Vertical divider ──────────────────────────────────────
        // const divGfx = this.add.graphics();
        // divGfx.lineStyle(1, 0x1e3a5c, 0.8);
        // divGfx.lineBetween(406, 6, 406, 122);

        // money number centered in the panel
        this.moneyText = this.add.bitmapText(580, 34, this._gf, '0$', 36).setOrigin(0.5, 0.5).setDepth(5).setTint(this.lightTheme ? 0xaa7730 : 0x18ee50);
        this.add.bitmapText(580, 58, this._gf, 'КОШЕЛЁК', 22).setOrigin(0.5, 0).setTint(this.lightTheme ? 0xc89050 : 0xffffff);

        // mute button (right side, vertically centered in panel)
        this.ballCountText = this.add.bitmapText(_valX, 116, this._gf, '1 шар', 16).setOrigin(0, 0).setDepth(5).setTint(0xcce4ff);
        this.add.bitmapText(_icoX, 136, this._gf, '⚡', 16).setOrigin(0, 0).setDepth(5).setTint(0xffe666);
        this.incomePerSecText = this.add.bitmapText(_valX, 136, this._gf, '0$/сек', 16).setOrigin(0, 0).setDepth(5).setTint(0xffe666);
        this.add.bitmapText(_icoX, 156, this._gf, '◆', 16).setOrigin(0, 0).setDepth(5).setTint(0xffdd44);
        this.passiveIncomeText = this.add.bitmapText(_valX, 156, this._gf, '0$/с', 16).setOrigin(0, 0).setDepth(5).setTint(0xffdd44);
        this._fpsDom = document.createElement('div');
        Object.assign(this._fpsDom.style, { position:'fixed', top:'6px', left:'8px', color:'#ff4444', fontSize:'18px', fontFamily:'monospace', fontWeight:'bold', zIndex:'9999', pointerEvents:'none', textShadow:'0 0 3px #000' });
        this._fpsDom.textContent = 'FPS: --';
        document.body.appendChild(this._fpsDom);
        this.events.once('shutdown', () => this._fpsDom.remove());
        this.muteBtn = this.add.text(748, 112, '🔊', { fontSize: '22px' })
            .setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(10);
        this.muteBtn.on('pointerover', () => this.playSound('hover'));
        this.muteBtn.on('pointerdown', () => this.toggleMute());
        // Menu button
        const menuGfx = this.add.graphics().setDepth(10);
        const drawMenuBtn = (hover) => {
            menuGfx.clear();
            menuGfx.fillStyle(hover ? 0x1a2a3a : 0x0d1824, 0.9);
            menuGfx.fillRoundedRect(695, 72, 55, 26, 6);
            menuGfx.lineStyle(1.5, hover ? 0x88ccff : 0x336699, 1);
            menuGfx.strokeRoundedRect(695, 72, 55, 26, 6);
        };
        drawMenuBtn(false);
        this.add.bitmapText(722, 85, this._gf, 'МЕНЮ', 14).setOrigin(0.5).setDepth(11).setTint(0x88ccff);
        const menuHit = this.add.rectangle(722, 85, 55, 26, 0, 0).setInteractive({ useHandCursor: true }).setDepth(12);
        menuHit.on('pointerover', () => { drawMenuBtn(true); this.playSound('hover'); });
        menuHit.on('pointerout', () => drawMenuBtn(false));
        menuHit.on('pointerdown', () => {
            this.saveProgress();
            this._fadeExit(400, () => this.scene.start('StartScene'));
        });

        // Back-to-editor button (test mode only)
        if (this.testMode) {
            const edBtnGfx = this.add.graphics().setDepth(10);
            const drawEdBtn = (hov) => {
                edBtnGfx.clear();
                edBtnGfx.fillStyle(hov ? 0x0e2a14 : 0x081208, 0.95);
                edBtnGfx.fillRoundedRect(628, 72, 62, 26, 6);
                edBtnGfx.lineStyle(1.5, hov ? 0x44ff88 : 0x226633, 1);
                edBtnGfx.strokeRoundedRect(628, 72, 62, 26, 6);
            };
            drawEdBtn(false);
            this.add.bitmapText(659, 85, this._gf, '← РЕД', 13).setOrigin(0.5).setDepth(11).setTint(0x44ff88);
            const edBtnHit = this.add.rectangle(659, 85, 62, 26, 0, 0).setInteractive({ useHandCursor: true }).setDepth(12);
            edBtnHit.on('pointerover', () => drawEdBtn(true));
            edBtnHit.on('pointerout', () => drawEdBtn(false));
            edBtnHit.on('pointerdown', () => this.scene.start('EditorScene', { levelNum: this.testLevelNum }));

            // ── DEV spawn buttons ────────────────────────────────────
            const devBtnStyle = { _gf: this._gf, size: 13, tint: 0xffee44 };
            const makeDevBtn = (label, bx, by, onClick) => {
                const gfx = this.add.graphics().setDepth(10);
                const draw = (hov) => {
                    gfx.clear();
                    gfx.fillStyle(hov ? 0x2a2200 : 0x111000, 0.95);
                    gfx.fillRoundedRect(bx, by, 66, 26, 6);
                    gfx.lineStyle(1.5, hov ? 0xffee44 : 0x665500, 1);
                    gfx.strokeRoundedRect(bx, by, 66, 26, 6);
                };
                draw(false);
                this.add.bitmapText(bx + 33, by + 13, devBtnStyle._gf, label, devBtnStyle.size).setOrigin(0.5).setDepth(11).setTint(devBtnStyle.tint);
                const hit = this.add.rectangle(bx + 33, by + 13, 66, 26, 0, 0).setInteractive({ useHandCursor: true }).setDepth(12);
                hit.on('pointerover', () => draw(true));
                hit.on('pointerout', () => draw(false));
                hit.on('pointerdown', onClick);
            };

            makeDevBtn('+МЯCH', 628, 188, () => {
                this.createBall();
            });

            const wallTypes = ['block', 'vertical', 'horizontal', 'tDown', 'tUp', 'tLeft', 'tRight'];
            let _devWallIdx = 0;
            makeDevBtn('+СТЕНА', 628, 218, () => {
                const type = wallTypes[_devWallIdx % wallTypes.length];
                _devWallIdx++;
                const { w, h } = this.getWallDims(type);
                const cx = this.fieldOffsetX + this.fieldSize / 2;
                const cy = this.fieldOffsetY + this.fieldSize / 2;
                const x = Phaser.Math.Between(cx - 100, cx + 100);
                const y = Phaser.Math.Between(cy - 100, cy + 100);
                this.createWall(x, y, w, h, type, Phaser.Math.Between(1, 5));
            });
            // ────────────────────────────────────────────────────────
        }

        // ── Hand strip (no label, no wrapper) ────────────────────
        this.returnZoneBg = this.add.rectangle(380, this.slotY, 740, 160, 0x0e1a27, 0);

        this.wallSlots = [];
        this.buildSlotUIs();

        // ── Upgrades strip (no label, no wrapper) ─────────────────
        const sharedBtnBg = this.make.graphics({ add: false });
        this.buttonBall = this.createButton(167, this.btnY, '🟠', '+ 1 шарик', this.ballCost, () => this.buyBall(), sharedBtnBg);
        this.buttonWallPack = this.createButton(380, this.btnY, '🧱', '+ 3 стены', this.wallPackCost, () => this.buyWallPack(), sharedBtnBg);
        this.buttonIncome = this.createButton(593, this.btnY, '⚡', '+ доход стен', this.incomeCost, () => this.buyIncomeUpgrade(), sharedBtnBg);
        this._upgradeBtnCenters = [{ cx: 167, cy: this.btnY }, { cx: 380, cy: this.btnY }, { cx: 593, cy: this.btnY }];
        this.add.renderTexture(0, 0, 760, 870).setDepth(-1).setOrigin(0).draw(sharedBtnBg, 0, 0);
        sharedBtnBg.destroy();
        this._scheduleUpgradeShimmer();
        this._scheduleRandomBlock();

        this.errorText = this.add.bitmapText(this.fieldCX, this.fieldCY, this._gf, '', 20).setOrigin(0.5).setDepth(30).setAlpha(0).setTint(0xff4444);

        // Wall hover tooltip — right of field
        const ttGfx = this.add.graphics().setDepth(28);
        ttGfx.fillStyle(0x060d18, 0.93); ttGfx.fillRoundedRect(0, 0, 165, 62, 8);
        ttGfx.lineStyle(1.5, 0x44aaff, 0.8); ttGfx.strokeRoundedRect(0, 0, 165, 62, 8);
        ttGfx.setVisible(false);
        this._wallTooltipGfx = ttGfx;
        this._wallTooltipIps = this.add.bitmapText(8, 10, this._gf, '⚡ 0$/сек', 17).setDepth(29).setVisible(false).setTint(0x44ddff);
        this._wallTooltipTotal = this.add.bitmapText(8, 36, this._gf, '$ 0$ всего', 17).setDepth(29).setVisible(false).setTint(0xffdd44);
        this._wallTooltipTimer = null;
    }

    buildSlotUIs() {
        const slotX = [167, 380, 593];
        for (let i = 0; i < 3; i++) {
            const cx = slotX[i], cy = this.slotY;
            // transparent hit area — large enough for vertical wall (50×150)
            const bg = this.add.rectangle(cx, cy, 160, 160, 0x000000, 0)
                .setInteractive({ cursor: 'pointer' });
            const gfx = this.add.graphics().setDepth(2);
            const valTxt = this.add.bitmapText(cx, cy, this._gf, '', 22).setOrigin(0.5, 0.5).setDepth(3).setTint(0xffffff);
            const idx = i;
            bg.on('pointerdown', ptr => this.startWallDragFromSlot(ptr, idx));
            bg.on('pointerover', () => { if (idx < this.wallHand.length) this.playSound('hover'); });
            this.wallSlots.push({ bg, gfx, valTxt, cx, cy });
        }
        this.updateSlotsUI();
    }

    _drawTShapeSlot(gfx, cx, cy, type, incomeValue = null) {
        const D = this.BALL_R * 2;
        const iv = incomeValue !== null ? incomeValue : 5;
        const outlineColor = this._incomeToColors(iv).top;
        if (type === 'tDown') {
            this._drawSlotWall(gfx, cx - D * 1.5, cy - D, D * 3, D, true, iv);
            this._drawSlotWall(gfx, cx - D / 2, cy, D, D, true, iv);
            gfx.lineStyle(2, outlineColor, 0.9);
            gfx.beginPath();
            gfx.moveTo(cx - D * 1.5, cy - D); gfx.lineTo(cx + D * 1.5, cy - D);
            gfx.lineTo(cx + D * 1.5, cy); gfx.lineTo(cx + D / 2, cy);
            gfx.lineTo(cx + D / 2, cy + D); gfx.lineTo(cx - D / 2, cy + D);
            gfx.lineTo(cx - D / 2, cy); gfx.lineTo(cx - D * 1.5, cy);
            gfx.closePath(); gfx.strokePath();
        } else if (type === 'tUp') {
            this._drawSlotWall(gfx, cx - D / 2, cy - D, D, D, true, iv);
            this._drawSlotWall(gfx, cx - D * 1.5, cy, D * 3, D, true, iv);
            gfx.lineStyle(2, outlineColor, 0.9);
            gfx.beginPath();
            gfx.moveTo(cx - D / 2, cy - D); gfx.lineTo(cx + D / 2, cy - D);
            gfx.lineTo(cx + D / 2, cy); gfx.lineTo(cx + D * 1.5, cy);
            gfx.lineTo(cx + D * 1.5, cy + D); gfx.lineTo(cx - D * 1.5, cy + D);
            gfx.lineTo(cx - D * 1.5, cy); gfx.lineTo(cx - D / 2, cy);
            gfx.closePath(); gfx.strokePath();
        } else if (type === 'tLeft') {
            this._drawSlotWall(gfx, cx - D, cy - D / 2, D, D, true, iv);
            this._drawSlotWall(gfx, cx, cy - D * 1.5, D, D * 3, true, iv);
            gfx.lineStyle(2, outlineColor, 0.9);
            gfx.beginPath();
            gfx.moveTo(cx, cy - D * 1.5); gfx.lineTo(cx + D, cy - D * 1.5);
            gfx.lineTo(cx + D, cy + D * 1.5); gfx.lineTo(cx, cy + D * 1.5);
            gfx.lineTo(cx, cy + D / 2); gfx.lineTo(cx - D, cy + D / 2);
            gfx.lineTo(cx - D, cy - D / 2); gfx.lineTo(cx, cy - D / 2);
            gfx.closePath(); gfx.strokePath();
        } else {
            this._drawSlotWall(gfx, cx - D, cy - D * 1.5, D, D * 3, true, iv);
            this._drawSlotWall(gfx, cx, cy - D / 2, D, D, true, iv);
            gfx.lineStyle(2, outlineColor, 0.9);
            gfx.beginPath();
            gfx.moveTo(cx - D, cy - D * 1.5); gfx.lineTo(cx, cy - D * 1.5);
            gfx.lineTo(cx, cy - D / 2); gfx.lineTo(cx + D, cy - D / 2);
            gfx.lineTo(cx + D, cy + D / 2); gfx.lineTo(cx, cy + D / 2);
            gfx.lineTo(cx, cy + D * 1.5); gfx.lineTo(cx - D, cy + D * 1.5);
            gfx.closePath(); gfx.strokePath();
        }
    }

    updateSlotsUI() {
        this.wallSlots.forEach((slot, i) => {
            slot.gfx.clear();
            if (slot.valTxt) slot.valTxt.setText('');
            if (this.wallHand[i]) {
                const item = this.wallHand[i];
                slot.bg.setInteractive({ cursor: 'pointer' });
                const { w, h } = this.getWallDims(item.type);
                if (item.type === 'silverZone') {
                    const x0 = slot.cx - w / 2, y0 = slot.cy - h / 2;
                    this._drawSlotWall(slot.gfx, x0, y0, w, h, false, null, 'silver');
                    if (slot.valTxt) slot.valTxt.setPosition(slot.cx, slot.cy + 4).setText('$/с').setTint(0xccccee);
                } else if (['tDown', 'tUp', 'tLeft', 'tRight'].includes(item.type)) {
                    this._drawTShapeSlot(slot.gfx, slot.cx, slot.cy, item.type, item.incomeValue);
                    if (slot.valTxt) {
                        const bonusTxt = item.bonus ? `★${item.incomeValue}$` : `${item.incomeValue}$`;
                        slot.valTxt.setPosition(slot.cx, slot.cy).setText(bonusTxt).setTint(item.bonus ? 0xffe033 : 0xffffff);
                    }
                } else {
                    const x0 = slot.cx - w / 2, y0 = slot.cy - h / 2;
                    this._drawSlotWall(slot.gfx, x0, y0, w, h, false, item.incomeValue);
                    if (slot.valTxt) {
                        const bonusTxt = item.bonus ? `★${item.incomeValue}$` : `${item.incomeValue}$`;
                        slot.valTxt.setPosition(slot.cx, slot.cy).setText(bonusTxt).setTint(item.bonus ? 0xffe033 : 0xffffff);
                    }
                }
            } else {
                slot.bg.disableInteractive();
                const bw = this.BALL_R * 2, bh = this.BALL_R * 2;
                const x0 = slot.cx - bw / 2, y0 = slot.cy - bh / 2;
                // outer glow halo gradient
                const _slotGlow = this.lightTheme ? 0x9966cc : 0x3322aa;
                [10, 8, 7, 6, 5, 4, 3, 2, 1].forEach(b => {
                    slot.gfx.fillStyle(_slotGlow, (10 - b) * 0.006);
                    slot.gfx.fillRect(x0 - b, y0 - b, bw + b * 2, bh + b * 2);
                });
                // ghost fill
                slot.gfx.fillStyle(this.lightTheme ? 0xe8d8f8 : 0x0c0e22, this.lightTheme ? 0.7 : 0.5);
                slot.gfx.fillRect(x0, y0, bw, bh);
                // inner cross lines
                slot.gfx.lineStyle(0.5, this.lightTheme ? 0xaa88dd : 0x4433bb, 0.35);
                slot.gfx.lineBetween(x0 + bw / 2, y0 + 2, x0 + bw / 2, y0 + bh - 2);
                slot.gfx.lineBetween(x0 + 2, y0 + bh / 2, x0 + bw - 2, y0 + bh / 2);
                // outer border
                slot.gfx.lineStyle(1.5, this.lightTheme ? 0x9966cc : 0x4433bb, this.lightTheme ? 0.7 : 0.45);
                slot.gfx.strokeRect(x0, y0, bw, bh);
            }
        });
    }

    _drawSlotWall(gfx, x0, y0, w, h, skipOutline = false, incomeValue = null, metalType = null) {
        const iv = incomeValue !== null ? incomeValue : 5;
        let fillTop, fillBot, outlineColor;
        if (metalType === 'silver') {
            fillTop = 0xddddee; fillBot = 0x7a7a8a; outlineColor = 0xbbbbcc;
        } else if (this.lightTheme) {
            const t = Math.min(1, (iv - 1) / 99);
            fillTop = this._lerpColor(0xc8b0e8, 0x9966cc, t);
            fillBot = this._lerpColor(0xa890cc, 0x7744aa, t);
            outlineColor = fillTop;
        } else {
            const colors = this._incomeToColors(iv);
            fillTop = this._darkenColor(colors.top, 0.32);
            fillBot = this._darkenColor(colors.bot, 0.45);
            outlineColor = colors.top;
        }
        gfx.fillGradientStyle(fillTop, fillTop, fillBot, fillBot, 1);
        gfx.fillRect(x0, y0, w, h);
        gfx.fillStyle(0x000000, 0.18);
        gfx.fillRect(x0, y0 + h - Math.max(3, h * 0.12), w, Math.max(3, h * 0.12));
        gfx.fillStyle(0xffffff, 0.15);
        gfx.fillRect(x0, y0, w, Math.max(2, h * 0.08));
        if (!skipOutline) {
            gfx.lineStyle(2, outlineColor, 0.9);
            gfx.strokeRoundedRect(x0, y0, w, h, 5);
        }
    }

    _scheduleRandomBlock() {
        const delay = Phaser.Math.Between(40000, 60000);
        this.time.delayedCall(delay, () => {
            if (!this.scene.isActive() || this.gameWon) return;
            this._spawnRandomBlock();
            this._scheduleRandomBlock();
        });
    }

    _playSpawnFlash(x, y, scale = 1.0) {
        const D = this.BALL_R * 2;
        const s = scale;
        // All Graphics drawn at world coords — no { x,y } constructor, no scaleX/Y tween
        // 1. Central white fill — just fades out
        const cf = this.add.graphics().setDepth(28);
        cf.fillStyle(0xffffff, 0.88); cf.fillCircle(x, y, D * 0.75 * s);
        this.tweens.add({ targets: cf, alpha: 0, duration: 190, ease: 'Power3', onComplete: () => cf.destroy() });

        // 2. Expanding rings — draw multiple rings with growing radii over time, each fades
        const ringColors = [0xffffff, 0xffee88, 0xff88ff, 0xaaffcc];
        for (let step = 0; step < 7; step++) {
            this.time.delayedCall(step * 30, () => {
                if (!this.scene.isActive()) return;
                const r = (D * 0.6 + step * D * 0.22) * s;
                const ring = this.add.graphics().setDepth(26);
                ring.lineStyle(3 - step * 0.3, ringColors[step % ringColors.length], 1 - step * 0.1);
                ring.strokeCircle(x, y, r);
                this.tweens.add({ targets: ring, alpha: 0, duration: 220, ease: 'Power2', onComplete: () => ring.destroy() });
            });
        }

        // 3. Star rays — drawn at world coords, just alpha fade
        const rays = this.add.graphics().setDepth(27);
        for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const r1 = D * 0.45 * s, r2 = D * 1.3 * s;
            rays.lineStyle(a % 2 === 0 ? 2.5 : 1.5, a % 2 === 0 ? 0xffffff : 0xffdd55, 1);
            rays.lineBetween(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1,
                x + Math.cos(ang) * r2, y + Math.sin(ang) * r2);
        }
        this.tweens.add({ targets: rays, alpha: 0, duration: 320, ease: 'Power2', onComplete: () => rays.destroy() });

        // 4. Main particle burst — emitter at (x,y), explode with no args = emits from emitter pos
        const n1 = Math.max(6, Math.round(38 * Math.min(s, 1)));
        const b1 = this.add.particles(x, y, 'wallDust', {
            lifespan: { min: 200, max: 460 }, scale: { start: 0.9 * s, end: 0 }, alpha: { start: 1, end: 0 },
            speed: { min: 35 * s, max: 120 * s }, angle: { min: 0, max: 360 },
            tint: [0xffffff, 0xffee44, 0xff88cc, 0xaaffee, 0xffaaff], quantity: n1, frequency: -1,
        }).setDepth(26);
        b1.explode(n1, x, y);
        this.time.delayedCall(680, () => { if (b1 && b1.active) b1.destroy(); });

        // 5. Delayed second burst
        this.time.delayedCall(140, () => {
            if (!this.scene.isActive()) return;
            const n2 = Math.max(4, Math.round(20 * Math.min(s, 1)));
            const b2 = this.add.particles(x, y, 'wallDust', {
                lifespan: { min: 160, max: 340 }, scale: { start: 0.55 * s, end: 0 }, alpha: { start: 1, end: 0 },
                speed: { min: 18 * s, max: 75 * s }, angle: { min: 0, max: 360 },
                tint: [0xffffff, 0xffe033, 0xff88ff], quantity: n2, frequency: -1,
            }).setDepth(27);
            b2.explode(n2, x, y);
            this.time.delayedCall(480, () => { if (b2 && b2.active) b2.destroy(); });
        });

        // 6. Glitter dots — drawn at world coords, alpha only
        const dotCount = Math.max(3, Math.round(8 * Math.min(s, 1)));
        for (let i = 0; i < dotCount; i++) {
            const ang = Math.random() * Math.PI * 2;
            const dist = (D * 0.25 + Math.random() * D * 0.85) * s;
            const sp = this.add.graphics().setDepth(29);
            sp.fillStyle([0xffffff, 0xffee44, 0xff88ff, 0xaaffcc][i % 4], 1);
            sp.fillCircle(x + Math.cos(ang) * dist, y + Math.sin(ang) * dist, (2 + Math.random() * 2) * Math.min(s, 1));
            this.tweens.add({ targets: sp, alpha: 0, duration: 250 + Math.random() * 200, delay: i * 25, ease: 'Power2', onComplete: () => sp.destroy() });
        }
    }

    _applySpecialWallStyle(wall, specialType, color, damage) {
        wall.specialType = specialType;
        if (!wall._fillGfx) return;
        const bdColor = color || 0x8855dd;
        const colors = specialType === 'trap'
            ? { fill: 0x220000, fillB: 0x440000, outline: 0xff2222 }
            : specialType === 'slow'
                ? { fill: 0x001030, fillB: 0x002060, outline: 0x2266ff }
                : (specialType === 'boundary' || specialType === 'static')
                    ? { fill: 0x060810, fillB: 0x0a0a16, outline: bdColor }
                    : { fill: 0x1a1a1a, fillB: 0x2a2a2a, outline: 0x888888 };
        const _rr = (specialType === 'trap' || specialType === 'slow')
            ? Math.round(Math.min(wall.width, wall.height) * 0.2)
            : 3;
        // Apply special tint — all from same wallShapes atlas so still batches
        if (specialType !== 'trap' && specialType !== 'slow') {
            wall.setTint(colors.outline);
        }
        wall._drawFill = (ox, oy) => { if (wall.active) wall.setPosition(ox, oy); };
        wall._drawFill(wall.x, wall.y);
        wall._drawOutline = (ox, oy, color, alpha) => {
            this._redrawWallOutlineGfx(wall._outlineGfx, wall, ox, oy, color, alpha, colors.outline);
        };
        if (wall._iconGfx) { try { wall._iconGfx.destroy(); } catch (e) { } wall._iconGfx = null; }
        // Hide fill for pass-through zones (they look like fields, not walls)
        if (specialType === 'trap' || specialType === 'slow') {
            if (wall._fillGfx) { wall._fillGfx.setDepth(0.8); wall._fillGfx.setAlpha(0); }
        }
        if (specialType === 'trap' || specialType === 'slow') {
            const ig = this.add.graphics().setDepth(1.2);
            wall._iconGfx = ig;
            wall.on('destroy', () => { if (ig && ig.active) ig.destroy(); });
            const cx = wall.x, cy = wall.y, hr = wall.width / 2 - 6;
            if (specialType === 'trap') {
                if (wall._fireEmitter) { try { wall._fireEmitter.destroy(); } catch (e) { } }
                const _hw = wall.width / 2, _hh = wall.height / 2;
                const _fe = this.add.particles(wall.x, wall.y, 'luz', {
                    lifespan: 270, frequency: 40, quantity: 5, blendMode: 'ADD',
                    gravityY: 20, speedX: { min: 0, max: 0 }, speedY: { min: -180, max: 0 },
                    scale: { start: 0.62, end: 0.46 }, tint: [0xb58608, 0xaa3a16, 0xff0000, 0xd46a0d],
                    alpha: { start: 1, end: 0.34 },
                    emitZone: [{ quantity: 32, type: 'edge', total: 32, yoyo: true, source: new Phaser.Geom.Triangle(-_hw, _hh, _hw, _hh, 0, -_hh) }]
                }).setDepth(3.5);
                wall._fireEmitter = _fe;
                wall.on('destroy', () => { if (_fe && _fe.active) _fe.destroy(); });
                if (wall._fireEmitter2) { try { wall._fireEmitter2.destroy(); } catch (e) { } }
                const _fe2 = this.add.particles(wall.x, wall.y, 'luz', {
                    lifespan: 620, frequency: 730, quantity: 22, blendMode: 'ADD',
                    speed: { min: 20, max: Math.max(_hw, _hh) * 4.5 },
                    scale: { start: 1.1, end: 2.0 }, rotate: { start: 0, end: 360 },
                    tint: [0xc97317, 0xffc90e, 0xa62f05, 0xc20003, 0xdb5f22],
                    alpha: { start: 1, end: 0 }
                }).setDepth(3.6);
                wall._fireEmitter2 = _fe2;
                wall.on('destroy', () => { if (_fe2 && _fe2.active) _fe2.destroy(); });
            } else {
                // slow zone: no border, no snowflake icon
                if (wall._outlineGfx) wall._outlineGfx.setAlpha(0);
                if (wall._miniSnowGfx) { wall._miniSnowGfx.forEach(g => { try { g.destroy(); } catch (e) { } }); wall._miniSnowGfx = []; }
                if (wall._snowEmitter) { try { wall._snowEmitter.destroy(); } catch (e) { } }
                const _se = this.add.particles(wall.x, wall.y, 'star', {
                    lifespan: 270, frequency: 40, quantity: 5, blendMode: 'ADD',
                    gravityY: -10, speedX: { min: -80, max: 80 }, speedY: { min: -80, max: 80 },
                    scale: { start: 1.5, end: 0.23 }, rotate: { start: 0, end: 360 },
                    tint: [0x88ccff, 0xffffff, 0x00aaff],
                    emitZone: [{ quantity: 32, type: 'edge', total: 32, yoyo: false, source: new Phaser.Geom.Ellipse(0, 0, wall.width + 8, wall.height + 8) }]
                }).setDepth(3.5);
                wall._snowEmitter = _se;
                wall.on('destroy', () => { if (_se && _se.active) _se.destroy(); });
            }
        }
        if (wall.valueText) {
            if (specialType === 'trap') {
                const _dmg = damage || 5;
                wall.trapDamage = _dmg;
                wall.totalTaken = wall.totalTaken || 0;
                wall._trapWindow = wall._trapWindow || [];
                wall.valueText.setText('');
            } else if (specialType === 'slow') {
                wall.valueText.setText('');
            } else {
                wall.valueText.setText('');
            }
        }
        if (specialType === 'boundary' || specialType === 'static') {
            wall.isBoundary = true;
            wall.removeInteractive();
        }
    }

    _createZone(x, y, w, h, metalType = 'gold') {
        const isSilver = metalType === 'silver';
        const hw = w / 2, hh = h / 2;
        const bev = Math.max(3, Math.round(w * 0.18));
        // Octagonal ingot points
        const ingot = [
            { x: x - hw + bev, y: y - hh },
            { x: x + hw - bev, y: y - hh },
            { x: x + hw,       y: y - hh + bev },
            { x: x + hw,       y: y + hh - bev },
            { x: x + hw - bev, y: y + hh },
            { x: x - hw + bev, y: y + hh },
            { x: x - hw,       y: y + hh - bev },
            { x: x - hw,       y: y - hh + bev },
        ];

        const gfx = this.add.graphics().setDepth(0.5);
        // Gradient: gold or silver — solid like a real ingot
        const fillT = isSilver ? 0xe8e8f0 : 0xffe066;
        const fillB = isSilver ? 0x7a7a8a : 0xb8800a;
        const outlineC = isSilver ? 0xccccdd : 0xffee55;
        gfx.fillGradientStyle(fillT, fillT, fillB, fillB, 0.97);
        gfx.fillPoints(ingot, true);
        // Top highlight band
        gfx.fillStyle(0xffffff, isSilver ? 0.45 : 0.32);
        gfx.fillRect(x - hw + bev, y - hh, w - bev * 2, Math.max(2, hh * 0.14));
        // Bottom shadow band
        gfx.fillStyle(0x000000, 0.35);
        gfx.fillRect(x - hw + bev, y + hh - Math.max(2, hh * 0.18), w - bev * 2, Math.max(2, hh * 0.18));
        // Center seam (dark + light)
        gfx.fillStyle(0x000000, 0.4);
        gfx.fillRect(x - hw + bev, y - 1, w - bev * 2, 1);
        gfx.fillStyle(0xffffff, 0.35);
        gfx.fillRect(x - hw + bev, y, w - bev * 2, 1);
        // Outline
        gfx.lineStyle(2, outlineC, 1);
        gfx.strokePoints(ingot, true);

        // Pulsing rect outline (replaces circle ring)
        const ringColor = isSilver ? 0xaaaacc : 0xffdd22;
        const ring = this.add.graphics().setDepth(0.55).setAlpha(0.9);
        this.tweens.add({
            targets: ring,
            scaleX: { from: 0.05, to: 1.3 },
            scaleY: { from: 0.05, to: 1.3 },
            alpha: { from: 0.9, to: 0 },
            duration: isSilver ? 1700 : 1300,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onRepeat: () => {
                ring.clear();
                ring.lineStyle(2, ringColor, 1);
                ring.strokePoints(ingot.map(p => ({ x: p.x - x, y: p.y - y })), true);
            }
        });
        ring.clear();
        ring.lineStyle(2, ringColor, 1);
        ring.strokePoints(ingot.map(p => ({ x: p.x - x, y: p.y - y })), true);
        ring.setPosition(x, y);

        const iconTint = isSilver ? 0xddddee : 0xffee88;
        const iconText = this.add.bitmapText(x, y - 5, this._gf, '$', 14).setOrigin(0.5).setDepth(0.6).setTint(iconTint);

        const txt = this.add.bitmapText(x, y + 8, this._gf, '...$/s', 10).setOrigin(0.5).setDepth(0.6).setVisible(false).setTint(iconTint);

        const zoneObj = {
            x, y, hw, hh, gfx, ring, iconText, txt,
            presenceSeconds: 0, incomePerSecond: 0, totalEarned: 0,
            _metalType: metalType,
            _incomeRate: isSilver ? 0.05 : 0.1,
            _allObjs: [gfx, ring, iconText, txt]
        };
        this.zones.push(zoneObj);
        gfx.setInteractive(new Phaser.Geom.Rectangle(x - hw, y - hh, w, h), Phaser.Geom.Rectangle.Contains);
        gfx.on('pointerover', () => this._showZoneTooltip(zoneObj));
        gfx.on('pointerout', () => this._hideWallTooltip());
    }

    _updateZones() {
        if (!this.zones || !this.zones.length || !this.scene.isActive()) return;
        let earned = 0;
        this.zones.forEach(zone => {
            zone.incomePerSecond = Math.floor(zone._incomeAccum || 0);
            earned += zone.incomePerSecond;
            zone.totalEarned = (zone.totalEarned || 0) + zone.incomePerSecond;
            const acc = zone._incomeAccum || 0;
            zone.txt.setText(acc > 0 ? `${acc.toFixed(1)}$/s` : '...$/s');
        });
        if (this.passiveIncomeText) this.passiveIncomeText.setText(`${earned}$/с`);
        if (earned > 0) {
            this.money += earned; this.totalEarned += earned;
            this.updateUI();
        }
    }

    _spawnRandomBlock() {
        const D = this.BALL_R * 2;
        const margin = D;
        const x = Phaser.Math.Between(this.fieldOffsetX + margin, this.fieldOffsetX + this.fieldSize - margin);
        const y = Phaser.Math.Between(this.fieldOffsetY + margin, this.fieldOffsetY + this.fieldSize - margin);
        const incomeValue = Phaser.Math.Between(1, Math.max(3, Math.ceil(this._getMaxWallIncome() * 0.4)));

        this.playSound('bonus');
        this._playSpawnFlash(x, y, 1.0);

        const wall = this.createWall(x, y, D, D, 'block', incomeValue);

        // "БОНУС БЛОК" label
        const label = this.add.bitmapText(x, y - 28, this._gf, '✨ БОНУС БЛОК', 17).setOrigin(0.5).setDepth(27).setTint(0xffe033);
        this.tweens.add({ targets: label, y: y - 62, alpha: 0, duration: 1200, delay: 350, ease: 'Power1', onComplete: () => label.destroy() });
    }

    _scheduleUpgradeShimmer() {
        const delay = Phaser.Math.Between(1600, 4200);
        this.time.delayedCall(delay, () => {
            if (!this.scene.isActive() || !this._upgradeBtnCenters) return;
            this._doUpgradeShimmer(Phaser.Math.RND.pick(this._upgradeBtnCenters));
            this._scheduleUpgradeShimmer();
        });
    }

    _doUpgradeShimmer(btn) {
        const { cx, cy } = btn;
        const bx = cx - 98, by = cy - 80, bw = 196, bh = 152;
        // bright fill flash
        const flash = this.add.graphics().setDepth(17);
        flash.fillStyle(0xffffff, 0.14);
        flash.fillRoundedRect(bx, by, bw, bh, 8);
        this.tweens.add({ targets: flash, alpha: 0, duration: 380, ease: 'Power2', onComplete: () => flash.destroy() });
        // bright sweep strip
        const shine = this.add.rectangle(cx, by + 10, bw - 8, 20, 0xffffff, 0.52).setDepth(19);
        this.tweens.add({
            targets: shine, y: by + bh - 10, alpha: { from: 0.52, to: 0 },
            duration: 420, ease: 'Sine.easeIn',
            onComplete: () => shine.destroy()
        });
        // bright border glow
        const glow = this.add.graphics().setDepth(18);
        glow.lineStyle(3, 0x88ffcc, 1);
        glow.strokeRoundedRect(bx, by, bw, bh, 8);
        this.tweens.add({ targets: glow, alpha: 0, duration: 480, ease: 'Power2', onComplete: () => glow.destroy() });
    }

    createButton(cx, cy, emoji, label, initCost, callback, sharedBg) {
        // block background — subtle dark panel for the whole column
        const blockBg = sharedBg || this.add.graphics();
        blockBg.fillStyle(this.lightTheme ? 0xede0f8 : 0x0d2818, this.lightTheme ? 1 : 0.72);
        blockBg.fillRoundedRect(cx - 98, cy - 80, 196, 152, 8);
        blockBg.lineStyle(2, this.lightTheme ? 0x9966cc : 0x1e5a38, this.lightTheme ? 0.7 : 0.4);
        blockBg.strokeRoundedRect(cx - 98, cy - 80, 196, 152, 8);

        // transparent hit area (on top of blockBg)
        const bg = this.add.rectangle(cx, cy - 4, 196, 152, 0x000000, 0)
            .setInteractive({ useHandCursor: true });

        // price panel
        const px = cx - 80, py = cy - 78, pw = 160, ph = 20;
        const pnlGfx = sharedBg || this.add.graphics();
        pnlGfx.fillStyle(this.lightTheme ? 0xd8c0f0 : 0x071609, 1);
        pnlGfx.fillRoundedRect(px, py, pw, ph, 5);
        pnlGfx.lineStyle(1, this.lightTheme ? 0x7744aa : 0x1e6a3d, this.lightTheme ? 0.9 : 0.7);
        pnlGfx.strokeRoundedRect(px, py, pw, ph, 5);

        const ctTxt = this.add.bitmapText(cx, py + ph / 2, this._gf, `${initCost.toLocaleString()}$`, 23).setOrigin(0.5, 0.5).setTint(0xffdd88);

        // illustration container — setScale(1.8)
        const illY = cy - 5;
        const illCon = this.add.container(cx, illY).setScale(1.8);
        const gfx = this.add.graphics();
        if (emoji === '🟠') {
            gfx.fillStyle(0x00ccff, 1); gfx.fillCircle(-20, 0, 22);
            gfx.lineStyle(3, 0x88eeff, 1); gfx.strokeCircle(-20, 0, 22);
            gfx.fillStyle(0xffffff, 0.5); gfx.fillCircle(-28, -8, 6);
            const plus = this.add.bitmapText(6, 0, this._gf, '+', 40).setOrigin(0, 0.5).setTint(0x00ee44);
            illCon.add([gfx, plus]);
        } else if (emoji === '🧱') {
            // 2 small blocks behind (faded = distant), 1 large block in front
            const backGfx = this.add.graphics();
            backGfx.setAlpha(0.6);
            this._drawSlotWall(backGfx, -32, -24, 20, 20, false, 3); // back-left, low income
            this._drawSlotWall(backGfx, 6, -24, 20, 20, false, 8);   // back-right, mid income
            this._drawSlotWall(gfx, -16, -16, 32, 32, false, 15);     // front block, high income
            illCon.add([backGfx, gfx]);
        } else {
            this._drawSlotWall(gfx, -34, -22, 48, 44, false, 12);
            gfx.fillStyle(0x18ee50, 1);
            gfx.fillTriangle(22, -18, 12, 2, 32, 2);
            gfx.fillRect(16, 2, 12, 14);
            illCon.add(gfx);
        }

        // description background
        const descY = cy + 57;
        const descBg = sharedBg || this.add.graphics();
        descBg.fillStyle(this.lightTheme ? 0xd8c0f0 : 0x0e2e16, 1);
        descBg.fillRoundedRect(cx - 80, descY - 11, 160, 22, 5);
        descBg.lineStyle(1, this.lightTheme ? 0x7744aa : 0x2a7a4d, this.lightTheme ? 0.9 : 0.7);
        descBg.strokeRoundedRect(cx - 80, descY - 11, 160, 22, 5);

        const lbTxt = this.add.bitmapText(cx, descY, this._gf, label, 21).setOrigin(0.5, 0.5).setTint(0xffffff);

        // hover highlight — bright glow border + white tint, only when affordable
        const hoverGfx = this.add.graphics();
        hoverGfx.fillStyle(0xffffff, 0.09);
        hoverGfx.fillRoundedRect(cx - 98, cy - 80, 196, 152, 8);
        hoverGfx.lineStyle(2, 0x44ff88, 0.9);
        hoverGfx.strokeRoundedRect(cx - 98, cy - 80, 196, 152, 8);
        hoverGfx.setAlpha(0);

        bg._cost = initCost;
        bg.on('pointerover', () => {
            this.playSound('hover');
            hoverGfx.setAlpha(1);
        });
        bg.on('pointerout', () => hoverGfx.setAlpha(0));
        bg.on('pointerdown', callback);

        return { bg, blockBg, hoverGfx, pnlGfx, ctTxt, emTxt: illCon, plusTxt: null, descBg, lbTxt, level: 0 };
    }

    // ──── Input ────

    setupInput() {
        const _inField = (px, py) =>
            px >= this.fieldOffsetX && px <= this.fieldOffsetX + this.fieldSize &&
            py >= this.fieldOffsetY && py <= this.fieldOffsetY + this.fieldSize;

        this.input.on('pointermove', pointer => {
            // Slot wall preview follows cursor
            if (this.draggingNewWall && this.wallPreview) {
                const wp = this.wallPreview;
                const dx2 = pointer.x - (wp._lastPx !== undefined ? wp._lastPx : pointer.x);
                const dy2 = pointer.y - (wp._lastPy !== undefined ? wp._lastPy : pointer.y);
                if (wp.tilePositionX !== undefined) { wp.tilePositionX -= dx2 * 0.7; wp.tilePositionY -= dy2 * 0.7; }
                wp._lastPx = pointer.x; wp._lastPy = pointer.y;
                wp.setPosition(pointer.x, pointer.y);
                if (wp._drawMask) wp._drawMask(pointer.x, pointer.y);
                if (this._slotDragParticles) this._slotDragParticles.setPosition(pointer.x, pointer.y);
                if (this._dragIncomeText) this._dragIncomeText.setPosition(pointer.x, pointer.y - (this.wallPreview ? this.wallPreview.height / 2 : 0) - 14);
                // Outline follows cursor
                if (this._drawSlotDragOutline) this._drawSlotDragOutline(pointer.x, pointer.y);
                if (_inField(pointer.x, pointer.y)) {
                    const { w, h } = this.getWallDims(this.draggingWallType);
                    const cx = Phaser.Math.Clamp(pointer.x, this.fieldOffsetX + w / 2, this.fieldOffsetX + this.fieldSize - w / 2);
                    const cy = Phaser.Math.Clamp(pointer.y, this.fieldOffsetY + h / 2, this.fieldOffsetY + this.fieldSize - h / 2);
                    const chk = this.draggingWallType === 'silverZone'
                        ? { ok: true }
                        : this.checkPlacementValid(cx, cy, w, h, this.draggingWallType);
                    // Tint only the outline, not the whole block
                    if (chk.ok && chk.mergeTarget) { wp.clearTint(); if (this._drawSlotDragOutline) this._drawSlotDragOutline(pointer.x, pointer.y, 0xffee44); }
                    else if (chk.ok) { wp.clearTint(); if (this._drawSlotDragOutline) this._drawSlotDragOutline(pointer.x, pointer.y, this.draggingWallType === 'silverZone' ? 0xaaaacc : 0x88ff88); }
                    else { wp.clearTint(); if (this._drawSlotDragOutline) this._drawSlotDragOutline(pointer.x, pointer.y, 0xff4444); }
                } else {
                    wp.clearTint ? wp.clearTint() : null;
                    // Show merge hint when hovering over same-type hand slot
                    const _msi = [167, 380, 593].findIndex((sx, i) =>
                        Math.abs(pointer.x - sx) < 80 && Math.abs(pointer.y - this.slotY) < 80 &&
                        this.wallHand[i] && this.wallHand[i].type === this.draggingWallType
                    );
                    if (_msi !== -1 && this._drawSlotDragOutline) this._drawSlotDragOutline(pointer.x, pointer.y, 0xffee44);
                }
            }
            // Carried field wall: follows cursor, texture scrolls, particles move
            if (this._carryingFieldWall) {
                const wall = this._carryingFieldWall;
                const dx = pointer.x - (wall._lastPx !== undefined ? wall._lastPx : pointer.x);
                const dy = pointer.y - (wall._lastPy !== undefined ? wall._lastPy : pointer.y);
                if (wall.tilePositionX !== undefined) { wall.tilePositionX -= dx * 0.7; wall.tilePositionY -= dy * 0.7; }
                wall._lastPx = pointer.x; wall._lastPy = pointer.y;
                wall.setPosition(pointer.x, pointer.y);
                if (wall._drawMask) wall._drawMask(pointer.x, pointer.y);
                if (wall._drawFill) wall._drawFill(pointer.x, pointer.y);
                if (wall.valueText) wall.valueText.setPosition(pointer.x, pointer.y);
                if (this._carryParticles) this._carryParticles.setPosition(pointer.x, pointer.y);
                wall.clearTint();
                if (_inField(pointer.x, pointer.y)) {
                    const hw = wall.width / 2, hh = wall.height / 2;
                    const cx = Phaser.Math.Clamp(pointer.x, this.fieldOffsetX + hw, this.fieldOffsetX + this.fieldSize - hw);
                    const cy = Phaser.Math.Clamp(pointer.y, this.fieldOffsetY + hh, this.fieldOffsetY + this.fieldSize - hh);
                    const chk = this.checkPlacementValid(cx, cy, wall.width, wall.height, wall.wallType);
                    // Tint only the outline, not the whole block
                    if (chk.ok && chk.mergeTarget) { if (wall._drawOutline) wall._drawOutline(pointer.x, pointer.y, 0xffee00, 1); }
                    else if (chk.ok) { if (wall._drawOutline) wall._drawOutline(pointer.x, pointer.y, 0x88ff88, 1); }
                    else { if (wall._drawOutline) wall._drawOutline(pointer.x, pointer.y, 0xff4444, 1); }
                } else {
                    // Show merge hint when hovering over same-type hand slot
                    const _fmsi = [167, 380, 593].findIndex((sx, i) =>
                        Math.abs(pointer.x - sx) < 80 && Math.abs(pointer.y - this.slotY) < 80 &&
                        this.wallHand[i] && this.wallHand[i].type === wall.wallType
                    );
                    const _foc = _fmsi !== -1 ? 0xffee00 : undefined;
                    if (wall._drawOutline) wall._drawOutline(pointer.x, pointer.y, _foc, _foc !== undefined ? 1 : undefined);
                }
            }
        });

        this.input.on('pointerdown', pointer => {
            // Swallow the pick-up click itself
            if (this._carryingFieldWallJustPickedUp) { this._carryingFieldWallJustPickedUp = false; return; }
            // Second click places the carried field wall
            if (this._carryingFieldWall) { this._placeCarriedFieldWall(pointer); return; }
            if (this._pickingUpWall) { this._pickingUpWall = false; return; }
            if (!this.draggingNewWall || !this.wallPreview) return;
            if (_inField(pointer.x, pointer.y)) {
                const { w, h } = this.getWallDims(this.draggingWallType);
                const cx = Phaser.Math.Clamp(pointer.x, this.fieldOffsetX + w / 2, this.fieldOffsetX + this.fieldSize - w / 2);
                const cy = Phaser.Math.Clamp(pointer.y, this.fieldOffsetY + h / 2, this.fieldOffsetY + this.fieldSize - h / 2);
                const chk = this.checkPlacementValid(cx, cy, w, h, this.draggingWallType);
                if (!chk.ok) { this.showError(chk.reason); return; }
                this.placeWall(pointer.x, pointer.y);
            } else {
                const slotXs = [167, 380, 593];
                // Hand-to-hand merge: same type in an occupied slot
                const mergeSlot = slotXs.findIndex((sx, i) =>
                    Math.abs(pointer.x - sx) < 80 && Math.abs(pointer.y - this.slotY) < 80 &&
                    this.wallHand[i] && this.wallHand[i].type === this.draggingWallType && i !== this.draggingSlotIndex
                );
                if (mergeSlot !== -1) {
                    this.wallHand[mergeSlot].incomeValue += this.draggingIncomeValue;
                    this._draggedSlotItem = null;
                    this.playSound('merge');
                    this.time.delayedCall(60, () => { this._playSpawnFlash(slotXs[mergeSlot], this.slotY, 0.42); });
                    this.updateSlotsUI();
                } else {
                    // Place in empty slot
                    const targetSlot = slotXs.findIndex((sx, i) =>
                        Math.abs(pointer.x - sx) < 80 && Math.abs(pointer.y - this.slotY) < 80 &&
                        !this.wallHand[i] && i !== this.draggingSlotIndex
                    );
                    if (targetSlot !== -1) {
                        this.wallHand[targetSlot] = { type: this.draggingWallType, incomeValue: this.draggingIncomeValue };
                        this.updateSlotsUI();
                        this.playSound('place');
                    } else {
                        this.wallHand[this.draggingSlotIndex] = this._draggedSlotItem;
                        this._draggedSlotItem = null;
                        this.updateSlotsUI();
                    }
                }
            }
            if (this.wallPreview) { this.wallPreview.destroy(); this.wallPreview = null; }
            if (this._dragIncomeText) { this._dragIncomeText.destroy(); this._dragIncomeText = null; }
            if (this._slotDragOutlineGfx) { this._slotDragOutlineGfx.destroy(); this._slotDragOutlineGfx = null; } this._drawSlotDragOutline = null;
            if (this._slotDragParticles) { this._slotDragParticles.stop(); this.time.delayedCall(600, () => { if (this._slotDragParticles && this._slotDragParticles.active) this._slotDragParticles.destroy(); this._slotDragParticles = null; }); }
            this.draggingNewWall = false;
            this._physicsSpeedMult = 1;
            this.updateUI();
        });

        this.input.keyboard.on('keydown-SPACE', () => {
            const hist = this._fpsHist || {};
            const sorted = Object.keys(hist).map(Number).sort((a, b) => b - a);
            console.log('=== FPS histogram ===');
            sorted.forEach(fps => console.log(`${fps} fps: ${hist[fps]} frames`));
            console.log('=====================');
        });

        this.input.keyboard.on('keydown-ESC', () => {
            if (this.draggingNewWall && this.wallPreview) {
                this.wallPreview.destroy(); this.wallPreview = null;
                if (this._dragIncomeText) { this._dragIncomeText.destroy(); this._dragIncomeText = null; }
                if (this._slotDragOutlineGfx) { this._slotDragOutlineGfx.destroy(); this._slotDragOutlineGfx = null; } this._drawSlotDragOutline = null;
                if (this._slotDragParticles) { this._slotDragParticles.stop(); this.time.delayedCall(600, () => { if (this._slotDragParticles && this._slotDragParticles.active) this._slotDragParticles.destroy(); this._slotDragParticles = null; }); }
                if (this._draggedSlotItem) { this.wallHand[this.draggingSlotIndex] = this._draggedSlotItem; this._draggedSlotItem = null; this.updateSlotsUI(); }
                this.draggingNewWall = false;
                this._physicsSpeedMult = 1;
                this.updateUI();
            }
            if (this._carryingFieldWall) {
                const wall = this._carryingFieldWall;
                this._carryingFieldWall = null;
                this._stopCarryParticles();
                this._physicsSpeedMult = 1;
                wall.setPosition(wall._originX, wall._originY);
                if (wall._drawMask) wall._drawMask(wall._originX, wall._originY);
                if (wall._drawFill) wall._drawFill(wall._originX, wall._originY);
                wall.setDepth(0);
                if (wall._fillGfx) wall._fillGfx.setDepth(1);
                if (wall._outlineGfx && wall._outlineGfx.active) { wall._outlineGfx.destroy(); wall._outlineGfx = null; }
                if (wall.valueText) { wall.valueText.setPosition(wall._originX, wall._originY); wall.valueText.setDepth(3); }
                this._refreshWallTexture(wall);
                this.wallsGroup.add(wall); wall.body.updateFromGameObject();
                this.updateUI();
            }
        });
    }

    startWallDragFromSlot(pointer, slotIndex) {
        if (!this.wallHand[slotIndex] || this.draggingNewWall || this._carryingFieldWall) return;
        this.draggingNewWall = true; this._pickingUpWall = true; this.draggingSlotIndex = slotIndex;
        const item = this.wallHand[slotIndex];
        this.draggingWallType = item.type; this.draggingIncomeValue = item.incomeValue;
        this._draggedSlotItem = item;
        this.wallHand[slotIndex] = null;
        // Clear slot visually without full updateSlotsUI (avoids disableInteractive during event dispatch)
        const _srcSlot = this.wallSlots[slotIndex];
        if (_srcSlot) { _srcSlot.gfx.clear(); if (_srcSlot.valTxt) _srcSlot.valTxt.setText(''); }
        const { w, h } = this.getWallDims(item.type);
        const type = item.type;

        // Gradient fill preview (colored by income value, clipped to wall shape)
        const preview = this.add.tileSprite(pointer.x, pointer.y, w, h, 'checker').setDepth(10).setAlpha(0.001);
        const _prevFillGfx = this.add.graphics().setDepth(10).setAlpha(0.9);
        const pmGfx = this.make.graphics({ add: false });
        const _D = this.BALL_R * 2;
        const drawPM = (px, py) => {
            pmGfx.clear(); pmGfx.fillStyle(0xffffff);
            const r = 5;
            if (type === 'tDown') { pmGfx.fillRoundedRect(px - w / 2, py - h / 2, w, _D, r); pmGfx.fillRoundedRect(px - _D / 2, py - h / 2 + _D, _D, _D, r); }
            else if (type === 'tUp') { pmGfx.fillRoundedRect(px - _D / 2, py - h / 2, _D, _D, r); pmGfx.fillRoundedRect(px - w / 2, py - h / 2 + _D, w, _D, r); }
            else if (type === 'tLeft') { pmGfx.fillRoundedRect(px - w / 2, py - _D / 2, _D, _D, r); pmGfx.fillRoundedRect(px - w / 2 + _D, py - h / 2, _D, h, r); }
            else if (type === 'tRight') { pmGfx.fillRoundedRect(px - w / 2, py - h / 2, _D, h, r); pmGfx.fillRoundedRect(px - w / 2 + _D, py - _D / 2, _D, _D, r); }
            else if (type === 'silverZone') {
                const bev = Math.max(3, Math.round(w * 0.18));
                pmGfx.fillPoints([
                    { x: px - w/2 + bev, y: py - h/2 }, { x: px + w/2 - bev, y: py - h/2 },
                    { x: px + w/2, y: py - h/2 + bev }, { x: px + w/2, y: py + h/2 - bev },
                    { x: px + w/2 - bev, y: py + h/2 }, { x: px - w/2 + bev, y: py + h/2 },
                    { x: px - w/2, y: py + h/2 - bev }, { x: px - w/2, y: py - h/2 + bev },
                ], true);
            } else { pmGfx.fillRoundedRect(px - w / 2, py - h / 2, w, h, r); }
        };
        const drawPrevFill = (px, py) => {
            _prevFillGfx.clear();
            if (type === 'silverZone') {
                _prevFillGfx.fillGradientStyle(0xe8e8f0, 0xe8e8f0, 0x7a7a8a, 0x7a7a8a, 0.9);
            } else {
                const { top, bot } = this._incomeToColors(this.draggingIncomeValue);
                _prevFillGfx.fillGradientStyle(top, top, bot, bot, 0.9);
            }
            _prevFillGfx.fillRect(px - w / 2, py - h / 2, w, h);
        };
        drawPM(pointer.x, pointer.y);
        drawPrevFill(pointer.x, pointer.y);
        preview.setMask(pmGfx.createGeometryMask());
        _prevFillGfx.setMask(pmGfx.createGeometryMask());
        preview._drawMask = (px, py) => { drawPM(px, py); drawPrevFill(px, py); };
        preview.on('destroy', () => { if (pmGfx.active) pmGfx.destroy(); if (_prevFillGfx.active) _prevFillGfx.destroy(); });
        preview._lastPx = pointer.x; preview._lastPy = pointer.y;
        this.wallPreview = preview;

        // Slot-drag outline (follows cursor, changes color on validation)
        const sdOGfx = this.add.graphics().setDepth(10.5);
        const drawSDO = (px, py, color = 0xffffff) => {
            sdOGfx.clear(); sdOGfx.lineStyle(2, color, 0.9);
            if (type === 'tDown') {
                sdOGfx.beginPath();
                sdOGfx.moveTo(px - w / 2, py - h / 2); sdOGfx.lineTo(px + w / 2, py - h / 2);
                sdOGfx.lineTo(px + w / 2, py - h / 2 + _D); sdOGfx.lineTo(px + _D / 2, py - h / 2 + _D);
                sdOGfx.lineTo(px + _D / 2, py + h / 2); sdOGfx.lineTo(px - _D / 2, py + h / 2);
                sdOGfx.lineTo(px - _D / 2, py - h / 2 + _D); sdOGfx.lineTo(px - w / 2, py - h / 2 + _D);
                sdOGfx.closePath(); sdOGfx.strokePath();
            } else if (type === 'tUp') {
                sdOGfx.beginPath();
                sdOGfx.moveTo(px - _D / 2, py - h / 2); sdOGfx.lineTo(px + _D / 2, py - h / 2);
                sdOGfx.lineTo(px + _D / 2, py - h / 2 + _D); sdOGfx.lineTo(px + w / 2, py - h / 2 + _D);
                sdOGfx.lineTo(px + w / 2, py + h / 2); sdOGfx.lineTo(px - w / 2, py + h / 2);
                sdOGfx.lineTo(px - w / 2, py - h / 2 + _D); sdOGfx.lineTo(px - _D / 2, py - h / 2 + _D);
                sdOGfx.closePath(); sdOGfx.strokePath();
            } else if (type === 'tLeft') {
                sdOGfx.beginPath();
                sdOGfx.moveTo(px - w / 2 + _D, py - h / 2); sdOGfx.lineTo(px + w / 2, py - h / 2);
                sdOGfx.lineTo(px + w / 2, py + h / 2); sdOGfx.lineTo(px - w / 2 + _D, py + h / 2);
                sdOGfx.lineTo(px - w / 2 + _D, py + _D / 2); sdOGfx.lineTo(px - w / 2, py + _D / 2);
                sdOGfx.lineTo(px - w / 2, py - _D / 2); sdOGfx.lineTo(px - w / 2 + _D, py - _D / 2);
                sdOGfx.closePath(); sdOGfx.strokePath();
            } else if (type === 'tRight') {
                sdOGfx.beginPath();
                sdOGfx.moveTo(px - w / 2, py - h / 2); sdOGfx.lineTo(px - w / 2 + _D, py - h / 2);
                sdOGfx.lineTo(px - w / 2 + _D, py - _D / 2); sdOGfx.lineTo(px + w / 2, py - _D / 2);
                sdOGfx.lineTo(px + w / 2, py + _D / 2); sdOGfx.lineTo(px - w / 2 + _D, py + _D / 2);
                sdOGfx.lineTo(px - w / 2 + _D, py + h / 2); sdOGfx.lineTo(px - w / 2, py + h / 2);
                sdOGfx.closePath(); sdOGfx.strokePath();
            } else if (type === 'silverZone') {
                const bev = Math.max(3, Math.round(w * 0.18));
                sdOGfx.beginPath();
                sdOGfx.moveTo(px - w/2 + bev, py - h/2); sdOGfx.lineTo(px + w/2 - bev, py - h/2);
                sdOGfx.lineTo(px + w/2, py - h/2 + bev); sdOGfx.lineTo(px + w/2, py + h/2 - bev);
                sdOGfx.lineTo(px + w/2 - bev, py + h/2); sdOGfx.lineTo(px - w/2 + bev, py + h/2);
                sdOGfx.lineTo(px - w/2, py + h/2 - bev); sdOGfx.lineTo(px - w/2, py - h/2 + bev);
                sdOGfx.closePath(); sdOGfx.strokePath();
            } else { sdOGfx.strokeRoundedRect(px - w / 2, py - h / 2, w, h, 5); }
        };
        drawSDO(pointer.x, pointer.y);
        this._slotDragOutlineGfx = sdOGfx;
        this._drawSlotDragOutline = drawSDO;

        this._dragIncomeText = this.add.bitmapText(pointer.x, pointer.y - h / 2 - 14, this._gf,
            type === 'silverZone' ? '0.05$/с' : `${item.incomeValue}$`, 20)
            .setOrigin(0.5, 1).setDepth(11).setTint(type === 'silverZone' ? 0xccccee : 0xffdd44);

        // dust particles for slot drag
        this._slotDragParticles = this.add.particles(pointer.x, pointer.y, 'wallDust', {
            lifespan: { min: 170, max: 340 },
            scale: { start: 0.34, end: 0.0 },
            alpha: { start: 0.9, end: 1 },
            speed: { min: 200, max: 240 },
            angle: { min: 0, max: 360 },
            // tint: [0xff8833, 0xffaa44, 0xcc5511, 0xffd070, 0xff6600],

            // tint: [0xfff833, 0xffaa44, 0xffffff, 0xffd070, 0xff6600],
            tint: [0xffaa44, 0xfff833, 0xffffff],
            quantity: 4,
            frequency: 30,
            blendMode: 'ADD'
        }).setDepth(11);

        this._physicsSpeedMult = 0.5;
    }

    placeWall(x, y) {
        const type = this.draggingWallType;
        const { w, h } = this.getWallDims(type);
        const fo = this.fieldOffsetX, fy = this.fieldOffsetY, fs = this.fieldSize;
        const cx = Phaser.Math.Clamp(x, fo + w / 2, fo + fs - w / 2);
        const cy = Phaser.Math.Clamp(y, fy + h / 2, fy + fs - h / 2);
        if (type === 'silverZone') {
            const D = this.BALL_R * 2;
            this._createZone(cx, cy, D, D * 2, 'silver');
            this.wallHand[this.draggingSlotIndex] = null;
            this.updateSlotsUI();
            this.playSound('place');
            return;
        }
        const chk = this.checkPlacementValid(cx, cy, w, h, type);
        if (!chk.ok) { this.showError(chk.reason); return; }
        if (chk.mergeTarget) {
            const tgt = chk.mergeTarget; tgt.incomeValue += this.draggingIncomeValue;
            if (tgt.valueText) tgt.valueText.setText(`${tgt.incomeValue}$`);
            this.tweens.add({ targets: tgt, alpha: 0.15, duration: 80, yoyo: true });
            this.playSound('merge');
        } else {
            this.createWall(cx, cy, w, h, type, this.draggingIncomeValue);
            this.placedWalls++; this.playSound('place');
        }
        this.wallHand[this.draggingSlotIndex] = null;
        this.updateSlotsUI();
    }

    _pickUpFieldWall(ptr, wall) {
        if (wall.isBoundary || wall.isEditorWall || this.draggingNewWall || this._carryingFieldWall) return;
        this._carryingFieldWall = wall;
        this._carryingFieldWallJustPickedUp = true;
        wall._originX = wall.x; wall._originY = wall.y;
        wall._lastPx = undefined; wall._lastPy = undefined;
        wall.clearTint();
        this._hideWallTooltip();
        this.wallsGroup.remove(wall);
        wall.setDepth(12);
        if (wall._fillGfx) wall._fillGfx.setDepth(12);
        // create drag outline Graphics (exists only while dragging)
        if (!wall._outlineGfx) {
            const { top: _oc } = this._incomeToColors(wall.incomeValue);
            const dragGfx = this.add.graphics().setDepth(12.5);
            wall._outlineGfx = dragGfx;
            this._redrawWallOutlineGfx(dragGfx, wall, wall.x, wall.y, _oc, 0.9, _oc);
            wall.once('destroy', () => { if (wall._outlineGfx && wall._outlineGfx.active) { wall._outlineGfx.destroy(); wall._outlineGfx = null; } });
        } else {
            wall._outlineGfx.setAlpha(1); wall._outlineGfx.setDepth(12.5);
        }
        if (wall.valueText) wall.valueText.setDepth(13);
        this._physicsSpeedMult = 0.5;
        this._startCarryParticles(wall);
    }

    _placeCarriedFieldWall(pointer) {
        const wall = this._carryingFieldWall;
        this._carryingFieldWall = null;
        this._stopCarryParticles();
        this._physicsSpeedMult = 1;
        wall.clearTint();

        const inField = (px, py) =>
            px >= this.fieldOffsetX && px <= this.fieldOffsetX + this.fieldSize &&
            py >= this.fieldOffsetY && py <= this.fieldOffsetY + this.fieldSize;

        if (!inField(pointer.x, pointer.y)) {
            const slotXs = [167, 380, 593];
            // Field-to-hand merge: same type in an occupied slot
            const mergeSlot = slotXs.findIndex((sx, i) =>
                Math.abs(pointer.x - sx) < 80 && Math.abs(pointer.y - this.slotY) < 80 &&
                this.wallHand[i] && this.wallHand[i].type === wall.wallType
            );
            if (mergeSlot !== -1) {
                this.wallHand[mergeSlot].incomeValue += wall.incomeValue;
                if (wall.valueText) wall.valueText.destroy(); wall.destroy();
                this.placedWalls--;
                this.playSound('merge');
                this.time.delayedCall(60, () => { this._playSpawnFlash(slotXs[mergeSlot], this.slotY, 0.42); });
                this.updateSlotsUI(); this.updateUI(); return;
            }
            // Return to hand in empty slot
            if (this.wallHand.filter(Boolean).length < 3) {
                const nearest = slotXs.reduce((bi, sx, i) => Math.abs(pointer.x - sx) < Math.abs(pointer.x - slotXs[bi]) ? i : bi, 0);
                const target = !this.wallHand[nearest] ? nearest : this.wallHand.findIndex(s => !s);
                if (target === -1) { this.wallsGroup.add(wall); wall.body.updateFromGameObject(); this.updateUI(); return; }
                this.wallHand[target] = { type: wall.wallType, incomeValue: wall.incomeValue };
                if (wall.valueText) wall.valueText.destroy(); wall.destroy();
                this.placedWalls--; this.playSound('return'); this.updateSlotsUI(); this.updateUI(); return;
            }
        }

        const _doMerge = (other) => {
            other.incomeValue += wall.incomeValue;
            if (other.valueText) other.valueText.setText(`${other.incomeValue}$`);
            this._refreshWallTexture(other);
            if (other._fillGfx) this.tweens.add({ targets: other._fillGfx, alpha: 0.2, duration: 80, yoyo: true, onComplete: () => { if (other._fillGfx && other._fillGfx.active) other._fillGfx.setAlpha(1); } });
            if (wall.valueText) wall.valueText.destroy(); wall.destroy();
            this.placedWalls--; this.playSound('merge');
        };
        let merged = false;
        // Priority: cursor center directly inside another wall (skip editor walls)
        this.wallsGroup.children.iterate(other => {
            if (merged || !other || other.isEditorWall || other.wallType !== wall.wallType) return;
            if (wall.x > other.x - other.width / 2 && wall.x < other.x + other.width / 2 &&
                wall.y > other.y - other.height / 2 && wall.y < other.y + other.height / 2) {
                _doMerge(other); merged = true;
            }
        });
        // Fallback: any rect overlap (skip editor walls)
        if (!merged) {
            this.wallsGroup.children.iterate(other => {
                if (merged || !other || other.isEditorWall || other.wallType !== wall.wallType) return;
                const ex1 = other.x - other.width / 2, ex2 = other.x + other.width / 2;
                const ey1 = other.y - other.height / 2, ey2 = other.y + other.height / 2;
                const gx1 = wall.x - wall.width / 2, gx2 = wall.x + wall.width / 2;
                const gy1 = wall.y - wall.height / 2, gy2 = wall.y + wall.height / 2;
                if (gx1 < ex2 && gx2 > ex1 && gy1 < ey2 && gy2 > ey1) {
                    _doMerge(other); merged = true;
                }
            });
        }

        if (!merged) {
            const hw = wall.width / 2, hh = wall.height / 2;
            const cx = Phaser.Math.Clamp(wall.x, this.fieldOffsetX + hw, this.fieldOffsetX + this.fieldSize - hw);
            const cy = Phaser.Math.Clamp(wall.y, this.fieldOffsetY + hh, this.fieldOffsetY + this.fieldSize - hh);
            let blocked = false;
            const newRects2 = this._getNewWallRects(cx, cy, wall.width, wall.height, wall.wallType);
            const SHRINK2 = 3;
            this.wallsGroup.children.iterate(o2 => {
                if (blocked || !o2) return;
                const o2Rects = this._getWallCollisionRects(o2);
                for (const nr of newRects2) {
                    for (const er of o2Rects) {
                        if ((nr.x - nr.hw + SHRINK2) < (er.x + er.hw) && (nr.x + nr.hw - SHRINK2) > (er.x - er.hw) &&
                            (nr.y - nr.hh + SHRINK2) < (er.y + er.hh) && (nr.y + nr.hh - SHRINK2) > (er.y - er.hh)) {
                            blocked = true; return;
                        }
                    }
                }
            });
            const fx = blocked ? wall._originX : cx, fy = blocked ? wall._originY : cy;
            const moved = !blocked && (Math.abs(fx - wall._originX) > 1 || Math.abs(fy - wall._originY) > 1);
            if (moved) {
                const newVal = Math.max(1, Math.floor(wall.incomeValue * 0.9));
                wall.incomeValue = newVal;
                if (wall.valueText && wall.valueText.active) wall.valueText.setText(`${newVal}$`);
            }
            this._refreshWallTexture(wall);
            wall._cachedRects = null;
            wall.setPosition(fx, fy);
            wall.setDepth(0);
            if (wall._drawMask) wall._drawMask(fx, fy);
            if (wall._drawFill) wall._drawFill(fx, fy);
            if (wall._fillGfx) wall._fillGfx.setDepth(1);
            if (wall._outlineGfx && wall._outlineGfx.active) { wall._outlineGfx.destroy(); wall._outlineGfx = null; }
            if (wall.valueText) { wall.valueText.setPosition(fx, fy); wall.valueText.setDepth(3); }
            this.wallsGroup.add(wall); wall.body.updateFromGameObject();
        }
        this.updateUI();
    }

    _startCarryParticles(wall) {
        if (this._carryParticles) { this._carryParticles.destroy(); this._carryParticles = null; }
        this._carryParticles = this.add.particles(wall.x, wall.y, 'wallDust', {
            lifespan: { min: 170, max: 340 },
            scale: { start: 0.34, end: 0.0 },
            alpha: { start: 0.9, end: 1 },
            speed: { min: 200, max: 240 },
            angle: { min: 0, max: 360 },
            // tint: [0xff8833, 0xffaa44, 0xcc5511, 0xffd070, 0xff6600],

            // tint: [0xfff833, 0xffaa44, 0xffffff, 0xffd070, 0xff6600],
            tint: [0xffaa44, 0xfff833, 0xffffff],
            quantity: 4,
            frequency: 30,
            blendMode: 'ADD'
        }).setDepth(15);
    }

    _stopCarryParticles() {
        if (this._carryParticles) {
            this._carryParticles.stop();
            const ref = this._carryParticles;
            this.time.delayedCall(800, () => { if (ref && ref.active) ref.destroy(); });
            this._carryParticles = null;
        }
    }

    // ──── Purchases ────

    _flashPurchase(cx, cy) {
        // bright block fill flash
        const flash = this.add.graphics().setDepth(21);
        flash.fillStyle(0xccffdd, 0.78);
        flash.fillRoundedRect(cx - 98, cy - 80, 196, 152, 8);
        this.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: 'Power2', onComplete: () => flash.destroy() });

        // 3 rings expanding at different speeds
        [
            { scale: 1.28, dur: 380, color: 0xffffff, lw: 3 },
            { scale: 1.45, dur: 560, color: 0x44ff88, lw: 2 },
            { scale: 1.18, dur: 260, color: 0xaaffcc, lw: 2 },
        ].forEach(({ scale, dur, color, lw }) => {
            const ring = this.add.graphics().setDepth(22);
            ring.lineStyle(lw, color, 1);
            ring.strokeRoundedRect(cx - 98, cy - 80, 196, 152, 8);
            this.tweens.add({ targets: ring, scaleX: scale, scaleY: scale, alpha: 0, duration: dur, ease: 'Power2', onComplete: () => ring.destroy() });
        });

        // large burst
        const burst = this.add.particles(cx, cy - 4, 'wallDust', {
            lifespan: { min: 320, max: 680 },
            scale: { start: 0.85, end: 0 },
            alpha: { start: 1, end: 0 },
            speed: { min: 55, max: 220 },
            angle: { min: 0, max: 360 },
            tint: [0x44ff88, 0xaaffcc, 0xffffff, 0x22dd66, 0x88ffaa, 0xffdd44],
            quantity: 30,
            frequency: -1,
        }).setDepth(22);
        burst.explode(30, cx, cy - 4);
        this.time.delayedCall(130, () => { if (burst && burst.active) burst.explode(14, cx, cy - 4); });
        this.time.delayedCall(900, () => { if (burst && burst.active) burst.destroy(); });
    }

    buyBall() {
        if (this.money < this.ballCost) return;
        this.money -= this.ballCost;
        this.buttonBall.level = (this.buttonBall.level || 0) + 1;
        const _bt = [20, 200, 800, 2000, 4000, 8000, 12000, 16000, 24000, 28000, 32000];
        this.ballCost = _bt[Math.min(this.buttonBall.level, _bt.length - 1)];
        this.playSound('buy');
        const ballCount = this.ballsGroup.getLength();
        if (ballCount < 12) {
            this.createBall();
        } else {
            const upgradable = this.ballsGroup.getChildren().filter(b => !b.multiplier || b.multiplier < 3);
            if (upgradable.length > 0) this._upgradeBall(Phaser.Utils.Array.GetRandom(upgradable));
        }
        this._flashPurchase(167, this.btnY);
        this.time.delayedCall(80, () => { this._playSpawnFlash(167, this.btnY, 0.85); });
        this.updateUI();
    }

    _upgradeBall(ball) {
        ball.multiplier = Math.min((ball.multiplier || 1) + 1, 3);
        const _cols = { 2: { fill: 0xff8833, stroke: 0xffdd00 }, 3: { fill: 0xff3300, stroke: 0xffee44 } };
        const c = _cols[ball.multiplier];
        ball.setFillStyle(c.fill);
        ball.setStrokeStyle(1, c.stroke);
        if (ball._multLabel && ball._multLabel.active) {
            ball._multLabel.setText(`x${ball.multiplier}`);
        } else {
            ball._multLabel = this.add.bitmapText(ball.x, ball.y, this._gf, `x${ball.multiplier}`, 11).setOrigin(0.5).setDepth(2.5).setTint(0xffffff);
            ball.on('destroy', () => { if (ball._multLabel && ball._multLabel.active) ball._multLabel.destroy(); });
        }
    }

    buyWallPack() {
        if (this.money < this.wallPackCost) return;
        this.money -= this.wallPackCost; this.playSound('buy');
        const types = ['horizontal', 'vertical', 'block', 'horizontal', 'vertical', 'block', 'block', 'block', 'block', 'horizontal', 'vertical', 'tDown', 'tRight', 'silverZone'];
        this.wallHand = [
            this._genWallItem(types),
            this._genWallItem(types),
            this._genWallItem(types)
        ];
        const bonusCount = this.wallHand.filter(item => item && item.bonus).length;
        if (bonusCount > 0) {
            this._showBonusMessage(bonusCount);
            this.playSound('bonus');
            const slotXPositions = [167, 380, 593];
            this.wallHand.forEach((item, i) => {
                if (item && item.bonus) {
                    this.time.delayedCall(i * 140, () => {
                        if (this.scene.isActive()) this._playSpawnFlash(slotXPositions[i], this.slotY, 0.48);
                    });
                }
            });
        }
        this.buttonWallPack.level = (this.buttonWallPack.level || 0) + 1;
        const _wt = [20, 120, 240, 400, 800, 1500];
        this.wallPackCost = _wt[Math.min(this.buttonWallPack.level, _wt.length - 1)];
        this._flashPurchase(380, this.btnY);
        this.time.delayedCall(80, () => { this._playSpawnFlash(380, this.btnY, 0.85); });
        this.updateSlotsUI(); this.updateUI();
    }

    buyIncomeUpgrade() {
        if (this.money < this.incomeCost) return;
        this.money -= this.incomeCost; this.playSound('buy');
        const slotOldVals = this.wallHand.map(item => item ? item.incomeValue : null);
        this.wallsGroup.children.iterate(wall => {
            if (!wall || wall.incomeValue === 0) return;
            const oldVal = wall.incomeValue;
            const pct = 0.08 + Math.random() * 0.03;
            wall.incomeValue = Math.ceil(oldVal + 1 + oldVal * pct);
            this._refreshWallTexture(wall);
            this._animateIncomeUpgrade(wall, oldVal, wall.incomeValue);
        });
        this.wallHand.forEach(item => {
            if (item) { const p = 0.08 + Math.random() * 0.03; item.incomeValue = Math.ceil(item.incomeValue + 1 + item.incomeValue * p); }
        });
        this.buttonIncome.level = (this.buttonIncome.level || 0) + 1;
        const _it = [50, 150, 350, 500, 1000, 2000, 3000, 5000, 10000];
        this.incomeCost = _it[Math.min(this.buttonIncome.level, _it.length - 1)];
        this._flashPurchase(593, this.btnY);
        this.time.delayedCall(80, () => { this._playSpawnFlash(593, this.btnY, 0.85); });
        this.updateSlotsUI(); this.updateUI();
        this.wallSlots.forEach((slot, i) => {
            const item = this.wallHand[i];
            const oldVal = slotOldVals[i];
            if (item && oldVal !== null) this._animateSlotIncomeUpgrade(slot, oldVal, item.incomeValue);
        });
    }

    _fireworkAt(x, y) {
        const emitter = this.add.particles(x, y, 'star', {
            lifespan: 560,
            frequency: 10,
            quantity: 1,
            blendMode: 'ADD',
            gravityY: 180,
            speedX: { min: 0, max: 0 },
            speedY: { min: 0, max: 0 },
            scale: { start: 0.5, end: 1 },
            rotate: { start: 0, end: 360 },
            tint: [0xffe033, 0xff8833, 0xffcc00, 0xff44aa, 0xffffff, 0x88ffcc],
            emitZone: [{
                quantity: 32, type: 'edge', total: 32, yoyo: false,
                source: new Phaser.Geom.Circle(0, 0, 24)
            }]
        }).setDepth(23);
        // stop emitting after one full cycle, let particles finish their lifespan then clean up
        this.time.delayedCall(560, () => {
            if (emitter && emitter.active) emitter.stop();
            this.time.delayedCall(600, () => { if (emitter && emitter.active) emitter.destroy(); });
        });
    }

    _animateIncomeUpgrade(wall, oldVal, newVal) {
        const x = wall.x, y = wall.y;
        if (wall.valueText) {
            this.tweens.killTweensOf(wall.valueText);
            wall.valueText.setAlpha(0);
        }
        this.time.delayedCall(750, () => {
            if (wall.valueText && wall.valueText.active)
                wall.valueText.setText(`${newVal}$`).setAlpha(1);
        });
        this._fireworkAt(x, y);
    }

    _animateSlotIncomeUpgrade(slot, oldVal, newVal) {
        if (slot.valTxt) slot.valTxt.setAlpha(0);
        this.time.delayedCall(750, () => {
            if (slot.valTxt && slot.valTxt.active) slot.valTxt.setAlpha(1);
        });
        this._fireworkAt(slot.cx, slot.cy);
    }

    _fadeExit(ms, cb) {
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:9999;';
        document.body.appendChild(ov);
        ov.getBoundingClientRect(); // force reflow so transition starts from opacity:0
        ov.style.transition = `opacity ${ms}ms ease-in`;
        ov.style.opacity = '1';
        this.time.delayedCall(ms, () => {
            cb();
            setTimeout(() => {
                ov.style.transition = 'opacity 220ms ease-out';
                ov.style.opacity = '0';
                setTimeout(() => { if (ov.parentNode) ov.remove(); }, 240);
            }, 50);
        });
    }

    _getMaxWallIncome() {
        let max = 3;
        this.wallsGroup.children.iterate(w => { if (w && w.incomeValue > max) max = w.incomeValue; });
        this.wallHand.forEach(item => { if (item && item.incomeValue > max) max = item.incomeValue; });
        return max;
    }

    _genWallItem(types, withBonus = true) {
        const type = Phaser.Math.RND.pick(types);
        let incomeValue = Phaser.Math.Between(1, 3);
        let bonus = false;
        if (withBonus && Math.random() < 0.25 && type !== 'silverZone') {
            const maxIncome = this._getMaxWallIncome();
            const bonusMax = Math.max(5, Math.floor(maxIncome / 2));
            incomeValue = Phaser.Math.Between(Math.max(4, Math.ceil(bonusMax * 0.4)), bonusMax);
            bonus = true;
        }
        return { type, incomeValue, bonus };
    }

    _showBonusMessage(count) {
        const msg = count > 1 ? `★ ${count}x БОНУС!` : '★ УРА! БОНУС!';
        const txt = this.add.bitmapText(380, 540, this._gf, msg, 34).setOrigin(0.5).setDepth(30).setTint(0xffe033);
        this.tweens.add({
            targets: txt, y: 490, scaleX: 1.18, scaleY: 1.18,
            duration: 320, ease: 'Back.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: txt, alpha: 0, duration: 700, delay: 900,
                    onComplete: () => txt.destroy()
                });
            }
        });
    }

    _lerpColor(c1, c2, t) {
        const r1 = (c1 >> 16) & 0xff, g1 = (c1 >> 8) & 0xff, b1 = c1 & 0xff;
        const r2 = (c2 >> 16) & 0xff, g2 = (c2 >> 8) & 0xff, b2 = c2 & 0xff;
        return ((Math.round(r1 + (r2 - r1) * t) << 16) | (Math.round(g1 + (g2 - g1) * t) << 8) | Math.round(b1 + (b2 - b1) * t));
    }

    _darkenColor(c, factor) {
        const r = Math.round(((c >> 16) & 0xff) * factor);
        const g = Math.round(((c >> 8) & 0xff) * factor);
        const b = Math.round((c & 0xff) * factor);
        return (r << 16) | (g << 8) | b;
    }

    _incomeToColors(val) {
        const t = Math.min(1, (val - 1) / 99);
        const stops = [
            [0, 0x00aaff, 0x003366],
            [0.2, 0x00dd55, 0x004422],
            [0.45, 0xddee00, 0x556600],
            [0.6, 0xffaa00, 0x884400],
            [0.8, 0xff2200, 0x770000],
            [1.0, 0xdd00ff, 0x550077],
        ];
        let s = stops.length - 2;
        for (let i = 0; i < stops.length - 1; i++) { if (t <= stops[i + 1][0]) { s = i; break; } }
        const seg = (stops[s + 1][0] - stops[s][0]) < 0.0001 ? 0 : (t - stops[s][0]) / (stops[s + 1][0] - stops[s][0]);
        return {
            top: this._lerpColor(stops[s][1], stops[s + 1][1], seg),
            bot: this._lerpColor(stops[s][2], stops[s + 1][2], seg)
        };
    }

    _initWallShapesAtlas() {
        if (this.textures.exists('wallShapes')) return;
        const D = this.BALL_R * 2;
        const PAD = 2;
        const configs = [
            { name: 'horizontal', w: D * 3, h: D },
            { name: 'vertical',   w: D,     h: D * 3 },
            { name: 'block',      w: D,     h: D },
            { name: 'tDown',      w: D * 3, h: D * 2 },
            { name: 'tUp',        w: D * 3, h: D * 2 },
            { name: 'tLeft',      w: D * 2, h: D * 3 },
            { name: 'tRight',     w: D * 2, h: D * 3 },
        ];
        let cx = 0, maxH = 0;
        const layout = configs.map(c => { const lx = cx; cx += c.w + PAD; maxH = Math.max(maxH, c.h); return { ...c, x: lx }; });
        const canvas = document.createElement('canvas');
        canvas.width = cx; canvas.height = maxH;
        const ctx = canvas.getContext('2d');
        for (const { name, x, w, h } of layout) {
            // gray fill so vertex-tint gives darker fill than white outline
            ctx.fillStyle = '#aaaaaa';
            if (name === 'tDown') {
                ctx.fillRect(x, 0, w, D); ctx.fillRect(x + D, D, D, D);
            } else if (name === 'tUp') {
                ctx.fillRect(x + D, 0, D, D); ctx.fillRect(x, D, w, D);
            } else if (name === 'tLeft') {
                ctx.fillRect(x + D, 0, D, h); ctx.fillRect(x, (h - D) / 2, D, D);
            } else if (name === 'tRight') {
                ctx.fillRect(x, 0, D, h); ctx.fillRect(x + D, (h - D) / 2, D, D);
            } else {
                ctx.fillRect(x, 0, w, h);
            }
            // white outline — tint makes it brighter than gray fill = natural border highlight
            ctx.strokeStyle = 'white'; ctx.lineWidth = 2; ctx.beginPath();
            if (name === 'tDown') {
                ctx.moveTo(x + 1, 1); ctx.lineTo(x + w - 1, 1);
                ctx.lineTo(x + w - 1, D); ctx.lineTo(x + 2 * D - 1, D);
                ctx.lineTo(x + 2 * D - 1, h - 1); ctx.lineTo(x + D + 1, h - 1);
                ctx.lineTo(x + D + 1, D); ctx.lineTo(x + 1, D); ctx.closePath();
            } else if (name === 'tUp') {
                ctx.moveTo(x + D + 1, 1); ctx.lineTo(x + 2 * D - 1, 1);
                ctx.lineTo(x + 2 * D - 1, D); ctx.lineTo(x + w - 1, D);
                ctx.lineTo(x + w - 1, h - 1); ctx.lineTo(x + 1, h - 1);
                ctx.lineTo(x + 1, D); ctx.lineTo(x + D + 1, D); ctx.closePath();
            } else if (name === 'tLeft') {
                const cy = (h - D) / 2;
                ctx.moveTo(x + D + 1, 1); ctx.lineTo(x + w - 1, 1);
                ctx.lineTo(x + w - 1, h - 1); ctx.lineTo(x + D + 1, h - 1);
                ctx.lineTo(x + D + 1, cy + D - 1); ctx.lineTo(x + 1, cy + D - 1);
                ctx.lineTo(x + 1, cy + 1); ctx.lineTo(x + D + 1, cy + 1); ctx.closePath();
            } else if (name === 'tRight') {
                const cy = (h - D) / 2;
                ctx.moveTo(x + 1, 1); ctx.lineTo(x + D - 1, 1);
                ctx.lineTo(x + D - 1, cy + 1); ctx.lineTo(x + w - 1, cy + 1);
                ctx.lineTo(x + w - 1, cy + D - 1); ctx.lineTo(x + D - 1, cy + D - 1);
                ctx.lineTo(x + D - 1, h - 1); ctx.lineTo(x + 1, h - 1); ctx.closePath();
            } else {
                ctx.rect(x + 1, 1, w - 2, h - 2);
            }
            ctx.stroke();
        }
        this.textures.addCanvas('wallShapes', canvas);
        const tex = this.textures.get('wallShapes');
        for (const { name, x, w, h } of layout) tex.add(name, 0, x, 0, w, h);
    }

    _setWallTint(wall, val) {
        if (this.lightTheme) {
            const t = Math.min(1, (val - 1) / 99);
            const top = this._lerpColor(0xc8b0e8, 0x9966cc, t);
            const bot = this._lerpColor(0xa890cc, 0x7744aa, t);
            wall.setTint(top, top, bot, bot);
        } else {
            const { top, bot } = this._incomeToColors(val);
            wall.setTint(top, top, bot, bot);
        }
    }

    _refreshWallTexture(wall) {
        if (!wall || !wall.active) return;
        this._setWallTint(wall, wall.incomeValue);
    }

    _redrawWallOutlineGfx(g, wall, ox, oy, color, alpha, defaultColor) {
        if (!g || !g.active) return;
        const D = this.BALL_R * 2;
        const hw = wall.width / 2, hh = wall.height / 2;
        const _c = color !== undefined ? color : defaultColor;
        const _a = alpha !== undefined ? alpha : 0.9;
        g.clear();
        g.lineStyle(2, _c, _a);
        if (wall.wallType === 'tDown') {
            g.beginPath();
            g.moveTo(ox - hw, oy - hh); g.lineTo(ox + hw, oy - hh);
            g.lineTo(ox + hw, oy - hh + D); g.lineTo(ox + D / 2, oy - hh + D);
            g.lineTo(ox + D / 2, oy + hh); g.lineTo(ox - D / 2, oy + hh);
            g.lineTo(ox - D / 2, oy - hh + D); g.lineTo(ox - hw, oy - hh + D);
            g.closePath(); g.strokePath();
        } else if (wall.wallType === 'tUp') {
            g.beginPath();
            g.moveTo(ox - D / 2, oy - hh); g.lineTo(ox + D / 2, oy - hh);
            g.lineTo(ox + D / 2, oy - hh + D); g.lineTo(ox + hw, oy - hh + D);
            g.lineTo(ox + hw, oy + hh); g.lineTo(ox - hw, oy + hh);
            g.lineTo(ox - hw, oy - hh + D); g.lineTo(ox - D / 2, oy - hh + D);
            g.closePath(); g.strokePath();
        } else if (wall.wallType === 'tLeft') {
            g.beginPath();
            g.moveTo(ox - hw + D, oy - hh); g.lineTo(ox + hw, oy - hh);
            g.lineTo(ox + hw, oy + hh); g.lineTo(ox - hw + D, oy + hh);
            g.lineTo(ox - hw + D, oy + D / 2); g.lineTo(ox - hw, oy + D / 2);
            g.lineTo(ox - hw, oy - D / 2); g.lineTo(ox - hw + D, oy - D / 2);
            g.closePath(); g.strokePath();
        } else if (wall.wallType === 'tRight') {
            g.beginPath();
            g.moveTo(ox - hw, oy - hh); g.lineTo(ox - hw + D, oy - hh);
            g.lineTo(ox - hw + D, oy - D / 2); g.lineTo(ox + hw, oy - D / 2);
            g.lineTo(ox + hw, oy + D / 2); g.lineTo(ox - hw + D, oy + D / 2);
            g.lineTo(ox - hw + D, oy + hh); g.lineTo(ox - hw, oy + hh);
            g.closePath(); g.strokePath();
        } else {
            g.strokeRoundedRect(ox - hw, oy - hh, wall.width, wall.height, 5);
        }
    }

    // ──── Physics ────

    _getWallCollisionRects(wall) {
        if (wall._cachedRects) return wall._cachedRects;
        const D = this.BALL_R * 2;
        const wx = wall.x, wy = wall.y;
        let rects;
        if (wall.wallType === 'tDown') {
            rects = [{ x: wx, y: wy - D / 2, hw: wall.width / 2, hh: D / 2 }, { x: wx, y: wy + D / 2, hw: D / 2, hh: D / 2 }];
        } else if (wall.wallType === 'tUp') {
            rects = [{ x: wx, y: wy - D / 2, hw: D / 2, hh: D / 2 }, { x: wx, y: wy + D / 2, hw: wall.width / 2, hh: D / 2 }];
        } else if (wall.wallType === 'tLeft') {
            rects = [{ x: wx - D / 2, y: wy, hw: D / 2, hh: D / 2 }, { x: wx + D / 2, y: wy, hw: D / 2, hh: wall.height / 2 }];
        } else if (wall.wallType === 'tRight') {
            rects = [{ x: wx - D / 2, y: wy, hw: D / 2, hh: wall.height / 2 }, { x: wx + D / 2, y: wy, hw: D / 2, hh: D / 2 }];
        } else {
            rects = [{ x: wx, y: wy, hw: wall.width / 2, hh: wall.height / 2 }];
        }
        // Only cache when wall is not being actively dragged
        if (wall !== this._carryingFieldWall) wall._cachedRects = rects;
        return rects;
    }

    update(time, delta) {
        // if (this.fpsText && this.game.loop.frame % 20 === 0) {
        //     this.fpsText.setText('FPS: ' + Math.round(1000 / this.game.loop.delta));
        // }
        const _fps = Math.round(1000 / this.game.loop.delta);
        if (this.game.loop.frame % 10 === 0) this._fpsDom.textContent = 'FPS: ' + _fps;
        this._fpsHist[_fps] = (this._fpsHist[_fps] || 0) + 1;
        const r = Math.round(this.BALL_R * 0.9);
        const minX = this.fieldOffsetX + r, maxX = this.fieldOffsetX + this.fieldSize - r;
        const minY = this.fieldOffsetY + r, maxY = this.fieldOffsetY + this.fieldSize - r;

        this.ballsGroup.children.iterate(ball => {
            if (!ball || !ball.body) return;
            if (!ball.currentSpeed) ball.currentSpeed = ball.bounceSpeed;

            if (ball._multLabel && ball._multLabel.active) ball._multLabel.setPosition(ball.x, ball.y);
            if (ball._highlight && ball._highlight.active) ball._highlight.setPosition(ball.x - r * 0.28, ball.y - r * 0.3);

            // emit trail particles at exact ball position
            if (ball.trail) ball.trail.explode(1, ball.x, ball.y);

            // boundaries
            const _snd = () => { const now = this.time.now; if (now - this._lastHitSound > 80) { this._lastHitSound = now; this.playSound('hit'); } };
            if (ball.x < minX) {
                ball.setX(minX); ball.body.setVelocityX(Math.abs(ball.body.velocity.x));
                ball.currentSpeed = ball.bounceSpeed;
                this._squishBall(ball, 0.55, 1.45); _snd();
            } else if (ball.x > maxX) {
                ball.setX(maxX); ball.body.setVelocityX(-Math.abs(ball.body.velocity.x));
                ball.currentSpeed = ball.bounceSpeed;
                this._squishBall(ball, 0.55, 1.45); _snd();
            }
            if (ball.y < minY) {
                ball.setY(minY); ball.body.setVelocityY(Math.abs(ball.body.velocity.y));
                ball.currentSpeed = ball.bounceSpeed;
                this._squishBall(ball, 1.45, 0.55); _snd();
            } else if (ball.y > maxY) {
                ball.setY(maxY); ball.body.setVelocityY(-Math.abs(ball.body.velocity.y));
                ball.currentSpeed = ball.bounceSpeed;
                this._squishBall(ball, 1.45, 0.55); _snd();
            }

            // wall collision — T-walls use 2 rects, others 1; slow-zone check merged here
            let _newInSlowZone = false;
            const _wallEntries = this.wallsGroup.children.entries;
            for (let _wi = 0, _wl = _wallEntries.length; _wi < _wl; _wi++) {
                const wall = _wallEntries[_wi];
                if (!wall) continue;
                if (wall.specialType === 'slow') {
                    const _shw = wall.width / 2, _shh = wall.height / 2;
                    if (ball.x >= wall.x - _shw && ball.x <= wall.x + _shw && ball.y >= wall.y - _shh && ball.y <= wall.y + _shh) _newInSlowZone = true;
                    continue;
                }
                const rects = this._getWallCollisionRects(wall);
                let hitNx = 0, hitNy = -1, hitOverlap = 0, didHit = false;
                for (const rect of rects) {
                    const cx = Phaser.Math.Clamp(ball.x, rect.x - rect.hw, rect.x + rect.hw);
                    const cy = Phaser.Math.Clamp(ball.y, rect.y - rect.hh, rect.y + rect.hh);
                    const dx = ball.x - cx, dy = ball.y - cy, distSq = dx * dx + dy * dy;
                    if (distSq >= r * r) continue;
                    const dist = distSq > 0 ? Math.sqrt(distSq) : 0;
                    hitNx = dist > 0 ? dx / dist : 0; hitNy = dist > 0 ? dy / dist : -1;
                    hitOverlap = r - dist; didHit = true; break;
                }
                if (!didHit) continue;
                const isPassThrough = wall.specialType === 'trap' || wall.specialType === 'slow';
                if (!isPassThrough) {
                    ball.setPosition(ball.x + hitNx * hitOverlap, ball.y + hitNy * hitOverlap);
                    const vel = ball.body.velocity, dot = vel.x * hitNx + vel.y * hitNy;
                    if (dot < 0) {
                        ball.body.setVelocity(vel.x - 2 * dot * hitNx, vel.y - 2 * dot * hitNy);
                        const isH = Math.abs(hitNy) > Math.abs(hitNx);
                        this._squishBall(ball, isH ? 1.45 : 0.55, isH ? 0.55 : 1.45);
                    }
                }
                const now = this.time.now;
                if (now - (wall.lastHit || 0) >= 16) {
                    wall.lastHit = now;
                    if (wall.incomeValue > 0) {
                        const _mult = ball.multiplier || 1;
                        const _earned = wall.incomeValue * _mult;
                        this.money += _earned; this.totalEarned += _earned;
                        this._incomeWindow.push({ t: now, v: _earned });
                        wall.wallTotalEarned = (wall.wallTotalEarned || 0) + _earned;
                        (wall._wallIncWin = wall._wallIncWin || []).push({ t: now, v: _earned });
                        ball.currentSpeed = ball.bounceSpeed;
                        if (now - this._lastHitSound > 80) { this._lastHitSound = now; this.playSound('wallhit'); }
                        if (wall.valueText && wall.valueText.active && !wall._scalePending) { wall._scalePending = true; this.tweens.add({ targets: wall.valueText, scaleX: 1.4, scaleY: 1.4, duration: 75, yoyo: true, ease: 'Power2', onComplete: () => { wall._scalePending = false; if (wall.valueText && wall.valueText.active) wall.valueText.setScale(1); } }); }
                        this._uiDirty = true;
                    }
                }
                if (wall.incomeValue > 0 && now - (wall.lastFloat || 0) >= 500) {
                    wall.lastFloat = now;
                    const _fv = wall.incomeValue * (ball.multiplier || 1);
                    this.showFloatingText(wall.x, wall.y, `${_fv}$`, _fv);
                }
                // Trap hiss sound (short cooldown, independent of damage tick)
                if (wall.specialType === 'trap' && didHit && now - (wall._lastTrapSound || 0) >= 380) {
                    wall._lastTrapSound = now;
                    this.playSound('trap');
                }
                // Special wall effects (editor walls)
                if (wall.specialType && didHit && now - (wall._lastSpecial || 0) >= 1500) {
                    wall._lastSpecial = now;
                    if (wall.specialType === 'trap') {
                        const loss = wall.trapDamage || 5;
                        this.money = Math.max(0, this.money - loss);
                        wall.totalTaken = (wall.totalTaken || 0) + loss;
                        (wall._trapWindow = wall._trapWindow || []).push({ t: now, v: loss });
                        this.showFloatingText(wall.x, wall.y, `-${loss}$`, -1);
                        this._uiDirty = true;
                    }
                }
            } // end wall for-loop

            // Zone collision — zones are now solid bouncing obstacles
            if (this.zones) {
                this.zones.forEach(zone => {
                    const zcx = Phaser.Math.Clamp(ball.x, zone.x - zone.hw, zone.x + zone.hw);
                    const zcy = Phaser.Math.Clamp(ball.y, zone.y - zone.hh, zone.y + zone.hh);
                    const zdx = ball.x - zcx, zdy = ball.y - zcy, zdistSq = zdx * zdx + zdy * zdy;
                    if (zdistSq >= r * r) return;
                    const zdist = zdistSq > 0 ? Math.sqrt(zdistSq) : 0;
                    const znx = zdist > 0 ? zdx / zdist : 0, zny = zdist > 0 ? zdy / zdist : -1;
                    ball.setPosition(ball.x + znx * (r - zdist), ball.y + zny * (r - zdist));
                    const zvel = ball.body.velocity, zdot = zvel.x * znx + zvel.y * zny;
                    if (zdot < 0) {
                        ball.body.setVelocity(zvel.x - 2 * zdot * znx, zvel.y - 2 * zdot * zny);
                        const isH = Math.abs(zny) > Math.abs(znx);
                        this._squishBall(ball, isH ? 1.45 : 0.55, isH ? 0.55 : 1.45);
                    }
                    ball.currentSpeed = Math.min(ball.currentSpeed * 1.35, ball.bounceSpeed * 2.0);
                    const znow = this.time.now;
                    if (znow - this._lastHitSound > 80) { this._lastHitSound = znow; this.playSound('wallhit'); }
                });
            }

            // decay
            if (ball.currentSpeed > ball.bounceSpeed)
                ball.currentSpeed = Math.max(ball.currentSpeed * 0.985, ball.bounceSpeed);
            if (_newInSlowZone !== !!ball._inSlowZone) { if (!_newInSlowZone) ball._slowExitTime = this.time.now; else this.playSound('freeze'); ball._inSlowZone = _newInSlowZone; }
            const _slowMult = ball._inSlowZone ? 0.25 : (ball._slowExitTime && (this.time.now - ball._slowExitTime) < 500 ? 0.25 + 0.75 * Math.min(1, (this.time.now - ball._slowExitTime) / 500) : 1);
            const vel = ball.body.velocity, spd = Math.sqrt(vel.x * vel.x + vel.y * vel.y);
            const _isSlowed = _slowMult < 1.0;
            if (spd > 0) { const ts = (this._physicsSpeedMult || 1) * _slowMult; const tspd = ball.currentSpeed * ts; if (Math.abs(spd - tspd) > tspd * 0.02) ball.body.setVelocity(vel.x / spd * tspd, vel.y / spd * tspd); }
            if (_isSlowed && !ball._isTinted) {
                ball._isTinted = true;
                ball._slowTween = this.tweens.addCounter({
                    from: 0, to: 100, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                    onUpdate: tw => {
                        if (!ball || !ball.active) return;
                        const t = tw.getValue() / 100;
                        ball.setFillStyle(Phaser.Display.Color.GetColor(Math.round(255 * (1 - t)), Math.round(255 - 204 * t), 255));
                    }
                });
                const _br = this.BALL_R;
                ball._slowEmitter = this.add.particles(ball.x, ball.y, 'star', {
                    lifespan: 450,
                    frequency: 55,
                    quantity: 2,
                    blendMode: 'ADD',
                    gravityY: -18,
                    speedX: { min: -45, max: 45 },
                    speedY: { min: -45, max: 45 },
                    scale: { start: 0.75, end: 0.05 },
                    rotate: { start: 0, end: 360 },
                    tint: [0x88ccff, 0xffffff, 0x00aaff, 0xaaddff],
                    emitZone: [{
                        quantity: 8, type: 'edge', total: 8, yoyo: false,
                        source: new Phaser.Geom.Ellipse(0, 0, _br * 2 + 8, _br * 2 + 8)
                    }]
                }).setDepth(2.4);
            } else if (!_isSlowed && ball._isTinted) {
                ball._isTinted = false;
                if (ball._slowTween) { try { ball._slowTween.stop(); } catch (e) { } ball._slowTween = null; }
                if (ball._slowEmitter) { try { ball._slowEmitter.destroy(); } catch (e) { } ball._slowEmitter = null; }
                ball.setFillStyle(0xf01cff);
                ball.setStrokeStyle(1, 0xf8ae0f);
            }
            if (_isSlowed && ball._slowEmitter && ball._slowEmitter.active) {
                ball._slowEmitter.setPosition(ball.x, ball.y);
            }

            // Zone crossing detection
            if (this.zones && this.zones.length) {
                this.zones.forEach(zone => {
                    if (!zone._ballsInside) zone._ballsInside = new Set();
                    const _zIn = ball.x >= zone.x - zone.hw - r && ball.x <= zone.x + zone.hw + r
                        && ball.y >= zone.y - zone.hh - r && ball.y <= zone.y + zone.hh + r;
                    if (_zIn && !zone._ballsInside.has(ball)) {
                        const _rate = zone._incomeRate || 0.1;
                        zone._incomeAccum = (zone._incomeAccum || 0) + _rate;
                        const _zt = this.add.bitmapText(zone.x, zone.y - 8, this._gf, `+${_rate}$/с`, 14).setOrigin(0.5).setDepth(19).setAlpha(0.85).setTint(zone._metalType === 'silver' ? 0xccccee : 0xbbcc44);
                        this.tweens.add({
                            targets: _zt, y: zone.y - 30, alpha: 0, duration: 800, ease: 'Power2',
                            onComplete: () => _zt.destroy()
                        });
                    }
                    if (_zIn) zone._ballsInside.add(ball); else zone._ballsInside.delete(ball);
                });
            }

            if (ball.body.speed < 1) {
                ball.currentSpeed = ball.bounceSpeed;
                const a = Phaser.Math.DegToRad(Phaser.Math.Between(25, 65));
                const sx = Phaser.Math.RND.pick([-1, 1]), sy = Phaser.Math.RND.pick([-1, 1]);
                ball.body.setVelocity(sx * Math.cos(a) * ball.bounceSpeed, sy * Math.sin(a) * ball.bounceSpeed);
            }
        });

        if (this._uiDirty) { this._uiDirty = false; this.updateUI(); }
    }

    _showWallTooltip(wall) {
        if (!this._wallTooltipGfx || this._carryingFieldWall || this.draggingNewWall) return;
        if (wall.specialType === 'slow') return;
        const isTrap = wall.specialType === 'trap';
        const tx = this.fieldOffsetX + this.fieldSize + 10;
        const ty = Math.max(this.fieldOffsetY + 4, Math.min(wall.y - 31, this.fieldOffsetY + this.fieldSize - 66));
        this._wallTooltipGfx.setPosition(tx, ty).setVisible(true);
        this._wallTooltipIps.setPosition(tx + 8, ty + 10).setVisible(true);
        this._wallTooltipTotal.setPosition(tx + 8, ty + 36).setVisible(true);
        const update = () => {
            if (!wall || !wall.active || !this._wallTooltipGfx || !this._wallTooltipGfx.visible) return;
            const n = this.time.now;
            if (isTrap) {
                wall._trapWindow = (wall._trapWindow || []).filter(e => n - e.t < 3000);
                const ps = wall._trapWindow.reduce((a, e) => a + e.v, 0) / 3;
                this._wallTooltipIps.setText(`× ${Math.round(ps).toLocaleString()}$/сек`);
                this._wallTooltipTotal.setText(`× ${(wall.totalTaken || 0).toLocaleString()}$ забрано`);
            } else {
                wall._wallIncWin = (wall._wallIncWin || []).filter(e => n - e.t < 3000);
                const ps = wall._wallIncWin.reduce((a, e) => a + e.v, 0) / 3;
                this._wallTooltipIps.setText(`⚡ ${Math.round(ps).toLocaleString()}$/сек`);
                this._wallTooltipTotal.setText(`$ ${(wall.wallTotalEarned || 0).toLocaleString()}$ всего`);
            }
        };
        update();
        if (this._wallTooltipTimer) this._wallTooltipTimer.destroy();
        this._wallTooltipTimer = this.time.addEvent({ delay: 250, loop: true, callback: update });
    }

    _hideWallTooltip() {
        if (this._wallTooltipGfx) this._wallTooltipGfx.setVisible(false);
        if (this._wallTooltipIps) this._wallTooltipIps.setVisible(false);
        if (this._wallTooltipTotal) this._wallTooltipTotal.setVisible(false);
        if (this._wallTooltipTimer) { this._wallTooltipTimer.destroy(); this._wallTooltipTimer = null; }
    }

    _showZoneTooltip(zone) {
        if (!this._wallTooltipGfx) return;
        const tx = this.fieldOffsetX + this.fieldSize + 10;
        const ty = Math.max(this.fieldOffsetY + 4, Math.min(zone.y - 31, this.fieldOffsetY + this.fieldSize - 66));
        this._wallTooltipGfx.setPosition(tx, ty).setVisible(true);
        this._wallTooltipIps.setPosition(tx + 8, ty + 10).setVisible(true);
        this._wallTooltipTotal.setPosition(tx + 8, ty + 36).setVisible(true);
        const update = () => {
            if (!this._wallTooltipGfx || !this._wallTooltipGfx.visible) return;
            this._wallTooltipIps.setText(`◆ ${(zone._incomeAccum || 0).toFixed(1)}$/с`);
            this._wallTooltipTotal.setText(`$ ${Math.round(zone.totalEarned || 0).toLocaleString()}$ всего`);
        };
        update();
        if (this._wallTooltipTimer) this._wallTooltipTimer.destroy();
        this._wallTooltipTimer = this.time.addEvent({ delay: 250, loop: true, callback: update });
    }

    _scheduleZoneRelocation() {
        if (!this.zones || !this.zones.length) return;
        const delay = Phaser.Math.Between(15000, 20000);
        this.time.delayedCall(delay, () => {
            if (this.scene.isActive()) this._relocateZones();
        });
    }

    _relocateZones() {
        if (!this.zones || !this.zones.length || !this.scene.isActive()) return;
        const count = this.zones.length;
        const metalTypes = this.zones.map(z => z._metalType || 'gold');
        const D = this.BALL_R * 2;
        const objs = this.zones.flatMap(z => (z._allObjs || []).filter(o => o && o.active));
        this.tweens.add({
            targets: objs,
            alpha: 0,
            duration: 700,
            ease: 'Power2',
            onComplete: () => {
                objs.forEach(o => { try { if (o && o.active) o.destroy(); } catch (e) { } });
                this.zones = [];
                const positions = this._randomZonePositions(count, D);
                positions.forEach((p, i) => this._createZone(p.x, p.y, D, D * 2, metalTypes[i] || 'gold'));
                const newObjs = this.zones.flatMap(z => (z._allObjs || []).filter(o => o && o.active));
                newObjs.forEach(o => o.setAlpha(0));
                this.tweens.add({
                    targets: newObjs,
                    alpha: 1,
                    duration: 700,
                    ease: 'Power2',
                    onComplete: () => {
                        this.zones.forEach(z => { if (z.ring && z.ring.active) z.ring.setAlpha(0.6); });
                    }
                });
                this._scheduleZoneRelocation();
            }
        });
    }

    _randomZonePositions(count, D) {
        const fx = this.fieldOffsetX, fy = this.fieldOffsetY;
        const cols = Math.floor(this.fieldSize / D);
        const rows = Math.floor(this.fieldSize / D);
        const occupied = new Set();
        this.wallsGroup.getChildren().forEach(w => {
            occupied.add(`${Math.round(w.x)}_${Math.round(w.y)}`);
        });
        const candidates = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = Math.round(fx + D / 2 + c * D);
                const y = Math.round(fy + D / 2 + r * D);
                if (!occupied.has(`${x}_${y}`)) candidates.push({ x, y });
            }
        }
        Phaser.Utils.Array.Shuffle(candidates);
        return candidates.slice(0, Math.min(count, candidates.length));
    }

    // ──── UI update ────

    updateUI() {
        this.moneyText.setText(`${this.money.toLocaleString()}$`);
        const ballCount = this.ballsGroup ? this.ballsGroup.getLength() : 0;
        if (this.ballCountText) this.ballCountText.setText(`${ballCount} ${ballCount === 1 ? 'шар' : ballCount < 5 ? 'шара' : 'шаров'}`);
        const now2 = this.time ? this.time.now : 0;
        if (this._incomeWindow) {
            this._incomeWindow = this._incomeWindow.filter(e => now2 - e.t < 3000);
            const ips = this._incomeWindow.reduce((a, e) => a + e.v, 0) / 3;
            if (this.incomePerSecText) this.incomePerSecText.setText(`${Math.round(ips).toLocaleString()}$/сек`);
        }

        const { _pbx: pbx, _pby: pby, _pbw: pbw, _pbh: pbh } = this;
        this._progressGfx.clear();
        this._progressGfx.fillStyle(this.lightTheme ? 0xe8d8b0 : 0x070e16, 1);
        this._progressGfx.fillRoundedRect(pbx, pby, pbw, pbh, 6);

        if (this.infiniteMode) {
            // Infinite mode: full bar in blue
            this._progressGfx.fillStyle(0x1155cc, 0.22);
            this._progressGfx.fillRoundedRect(pbx - 1, pby - 1, pbw + 2, pbh + 2, 7);
            this._progressGfx.fillStyle(0x2266ff, 1);
            this._progressGfx.fillRoundedRect(pbx, pby, pbw, pbh, 6);
            this._progressGfx.lineStyle(1, 0x2255aa, 0.7);
            this._progressGfx.strokeRoundedRect(pbx, pby, pbw, pbh, 6);
            this.barText.setText(`${this.totalEarned.toLocaleString()}$ заработано`);
        } else {
            const ratio = Math.min(1, this.totalEarned / this.targetMoney);
            if (ratio > 0) {
                const fw = Math.max(10, pbw * ratio);
                const fc = ratio < 0.5 ? 0x18b84a : ratio < 0.85 ? 0xc8a020 : 0xdd2f0f;
                this._progressGfx.fillStyle(fc, 0.22);
                this._progressGfx.fillRoundedRect(pbx - 1, pby - 1, fw + 2, pbh + 2, 7);
                this._progressGfx.fillStyle(fc, 1);
                this._progressGfx.fillRoundedRect(pbx, pby, fw, pbh, 6);
            }
            this._progressGfx.lineStyle(2.5, this.lightTheme ? 0x6b4010 : 0x1e3d6a, this.lightTheme ? 1 : 0.7);
            this._progressGfx.strokeRoundedRect(pbx, pby, pbw, pbh, 6);
            this.barText.setText(`${this.totalEarned.toLocaleString()}$ / ${this.targetMoney.toLocaleString()}$`);
            if (this.totalEarned >= this.targetMoney && !this.gameWon) this.winGame();
        }

        this.updateButton(this.buttonBall, this.ballCost);
        this.updateButton(this.buttonWallPack, this.wallPackCost);
        this.updateButton(this.buttonIncome, this.incomeCost);
    }

    updateButton(button, cost) {
        const ok = this.money >= cost;
        button.bg._cost = cost;
        button.ctTxt.setText(`${cost.toLocaleString()}$`).setTint(ok ? 0xffdd22 : 0xff3333);
    }

    winGame() {
        this.gameWon = true;
        // Clear the normal save — level is complete, start fresh next time
        try { localStorage.removeItem('bumper_save_normal'); } catch (e) { }
        this.playSound('win');

        // Dark overlay fade in
        const overlay = this.add.rectangle(380, 435, 760, 870, 0x000000, 0).setDepth(30);
        this.tweens.add({ targets: overlay, alpha: 0.62, duration: 700, ease: 'Power2' });

        // Winner panel
        const panel = this.add.graphics().setDepth(31);
        panel.fillStyle(0x071420, 0.95); panel.fillRoundedRect(160, 250, 440, 220, 18);
        panel.lineStyle(3, 0xffdd22, 1); panel.strokeRoundedRect(160, 250, 440, 220, 18);

        const lvl = this.registry.get('level') || 1;
        this.add.bitmapText(380, 295, this._gf, `УРОВЕНЬ ${lvl} ПРОЙДЕН!`, 36).setOrigin(0.5).setDepth(32).setTint(0xffdd22);
        this.add.bitmapText(380, 348, this._gf, `Заработано ${this.targetMoney.toLocaleString()}$`, 22).setOrigin(0.5).setDepth(32).setTint(0x44aaff);

        const nextLvl = lvl + 1;
        const goTxt = this.add.bitmapText(380, 410, this._gf, `→ Уровень ${nextLvl}`, 28).setOrigin(0.5).setDepth(32).setAlpha(0).setTint(0x88ff88);
        this.time.delayedCall(900, () => {
            this.tweens.add({ targets: goTxt, alpha: 1, duration: 500, ease: 'Power2' });
        });

        // Increment level in registry
        this.registry.set('level', nextLvl);

        // Fireworks
        this._playWinFireworks();

        // Fade out + return to menu
        this.time.delayedCall(4200, () => {
            this._fadeExit(900, () => this.scene.start('StartScene'));
        });
    }

    _playWinFireworks() {
        let count = 0;
        const fireOne = () => {
            if (count++ >= 28 || !this.scene.isActive()) return;
            const x = Phaser.Math.Between(60, 700);
            const y = Phaser.Math.Between(50, 520);
            const s = 0.65 + Math.random() * 1.1;
            this._playSpawnFlash(x, y, s);
            this.time.delayedCall(Phaser.Math.Between(80, 340), fireOne);
        };
        fireOne();
        this.time.delayedCall(180, () => { let c2 = 0; const f2 = () => { if (c2++ >= 14 || !this.scene.isActive()) return; this._playSpawnFlash(Phaser.Math.Between(60, 700), Phaser.Math.Between(50, 520), 0.5 + Math.random() * 0.9); this.time.delayedCall(Phaser.Math.Between(150, 500), f2); }; f2(); });
        this.time.delayedCall(600, () => { let c3 = 0; const f3 = () => { if (c3++ >= 10 || !this.scene.isActive()) return; this._playSpawnFlash(Phaser.Math.Between(60, 700), Phaser.Math.Between(50, 520), 0.8 + Math.random() * 1.4); this.time.delayedCall(Phaser.Math.Between(200, 600), f3); }; f3(); });
    }
}

class StartScene extends Phaser.Scene {
    constructor() { super('StartScene'); }
    preload() { _preloadGameFont(this); }
    create() {
        const W = 760, H = 870;
        const ch = (n) => '#' + n.toString(16).padStart(6, '0');
        const GF = _initGameFont(this);
        this.add.rectangle(W / 2, H / 2, W, H, 0x0b1520);
        const dotGfx = this.add.graphics();
        dotGfx.fillStyle(0xffffff, 0.025);
        for (let gx = 30; gx < W; gx += 48)
            for (let gy = 20; gy < H; gy += 40)
                dotGfx.fillCircle(gx, gy, 1.5);

        this.add.bitmapText(W / 2, H * 0.23, GF, 'BUMPER', 88).setOrigin(0.5).setTint(0x18ee50);
        this.add.bitmapText(W / 2, H * 0.23 + 90, GF, 'БИЗНЕС', 50).setOrigin(0.5).setTint(0x44aaff);
        this.add.bitmapText(W / 2, H * 0.23 + 148, GF, 'Строй стены — зарабатывай деньги', 20).setOrigin(0.5).setTint(0xaaaacc);

        const level = this.registry.get('level') || 1;
        let hasNormalSave = false, hasInfSave = false;
        try { hasNormalSave = !!localStorage.getItem('bumper_save_normal'); } catch (e) { }
        try { hasInfSave = !!localStorage.getItem('bumper_save_infinite'); } catch (e) { }

        // 3 fixed buttons — normal and infinite each auto-resume their own save
        const btnDefs = [
            {
                label: 'ИГРАТЬ',
                sub: '(выбрать уровень)',
                clr: 0x44ff88, bg: 0x0d2818, bgH: 0x1a4828,
                action: () => this.scene.start('LevelSelectScene'), pulse: true
            },
            {
                label: '∞  БЕСКОНЕЧНЫЙ',
                sub: hasInfSave ? '(продолжить)' : null,
                clr: 0x44aaff, bg: 0x07101f, bgH: 0x0e1f40,
                action: () => this.scene.start('MainScene', { mode: 'infinite' })
            },
            {
                label: 'УРОВНИ',
                sub: null,
                clr: 0xffcc44, bg: 0x1a1500, bgH: 0x2a2200,
                action: () => this.scene.start('LevelSelectScene')
            }
        ];

        const bw = 290, bh = 64, bx = W / 2 - bw / 2;
        let cy = 490;

        btnDefs.forEach(def => {
            const by = cy;
            const gfx = this.add.graphics();
            const draw = (hov) => {
                gfx.clear();
                gfx.fillStyle(hov ? def.bgH : def.bg, 1);
                gfx.fillRoundedRect(bx, by - bh / 2, bw, bh, 12);
                gfx.lineStyle(2.5, def.clr, hov ? 1 : 0.75);
                gfx.strokeRoundedRect(bx, by - bh / 2, bw, bh, 12);
            };
            draw(false);
            const mainY = def.sub ? by - 8 : by;
            const sz = def.label.length > 15 ? 26 : 34;
            const txt = this.add.bitmapText(W / 2, mainY, GF, def.label, sz).setOrigin(0.5).setTint(def.clr);
            if (def.sub) this.add.bitmapText(W / 2, by + 18, GF, def.sub, 13).setOrigin(0.5).setAlpha(0.6).setTint(def.clr);
            const hit = this.add.rectangle(W / 2, by, bw, bh, 0, 0).setInteractive({ useHandCursor: true });
            hit.on('pointerover', () => draw(true));
            hit.on('pointerout', () => draw(false));
            hit.on('pointerdown', def.action);
            if (def.pulse) this.tweens.add({ targets: txt, scaleX: 1.05, scaleY: 1.05, duration: 750, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            cy += bh + 12;
        });
    }
}

class EditorScene extends Phaser.Scene {
    constructor() { super('EditorScene'); }
    preload() { _preloadGameFont(this); }
    init(data) {
        this.levelNum = (data && data.levelNum) || null;
    }


    create() {
        const W = 760, H = 870;
        const D = 36; // cell size (BALL_R*2 = 18*2)
        const FOX = 96, FOY = 102, FS = 392;
        const COLS = Math.floor(FS / D), ROWS = Math.floor(FS / D); // 10
        const GSX = FOX + Math.floor((FS - COLS * D) / 2); // grid start x = 200
        const GSY = FOY + Math.floor((FS - ROWS * D) / 2); // grid start y = 118

        const GF = _initGameFont(this); this._gf = GF;
        this.D = D; this.COLS = COLS; this.ROWS = ROWS; this.GSX = GSX; this.GSY = GSY;
        this.cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
        this.currentTool = 'boundary';
        this.currentBoundaryColor = 0x888888;
        this.isPainting = false;
        this.lightTheme = false;

        // Field background (redrawn on theme toggle)
        const fieldGfx = this.add.graphics();
        const gridGfx = this.add.graphics();
        const drawEditorBg = () => {
            fieldGfx.clear();
            gridGfx.clear();
            if (this.lightTheme) {
                // light: checkerboard in pale blue tones
                const _cs = D;
                for (let r = 0; r < ROWS; r++)
                    for (let c = 0; c < COLS; c++) {
                        fieldGfx.fillStyle((r + c) % 2 === 0 ? 0xb8cce0 : 0xdceaf8, 1);
                        fieldGfx.fillRect(GSX + c * _cs, GSY + r * _cs, _cs, _cs);
                    }
                // fill gaps outside grid but inside FOX/FOY
                fieldGfx.fillStyle(0xdceaf8, 1);
                fieldGfx.fillRect(FOX, FOY, FS, GSY - FOY);
                fieldGfx.fillRect(FOX, GSY + ROWS * D, FS, FOY + FS - (GSY + ROWS * D));
                fieldGfx.fillRect(FOX, FOY, GSX - FOX, FS);
                fieldGfx.fillRect(GSX + COLS * D, FOY, FOX + FS - (GSX + COLS * D), FS);
                fieldGfx.lineStyle(3, 0x2255cc, 1); fieldGfx.strokeRect(FOX, FOY, FS, FS);
                gridGfx.lineStyle(1, 0x7799bb, 0.6);
            } else {
                fieldGfx.fillStyle(0x0d0820, 1); fieldGfx.fillRect(FOX, FOY, FS, FS);
                fieldGfx.lineStyle(3, 0x8855dd, 1); fieldGfx.strokeRect(FOX, FOY, FS, FS);
                gridGfx.lineStyle(1, 0x334466, 0.5);
            }
            for (let c = 0; c <= COLS; c++) gridGfx.lineBetween(GSX + c * D, GSY, GSX + c * D, GSY + ROWS * D);
            for (let r = 0; r <= ROWS; r++) gridGfx.lineBetween(GSX, GSY + r * D, GSX + COLS * D, GSY + r * D);
        };
        drawEditorBg();
        this._drawEditorBg = drawEditorBg;

        // Cell render graphics
        this._cellGfx = this.add.graphics().setDepth(2);

        // Sidebar background — two columns
        const sideX = FOX + FS + 8;
        const colW = 122; // width of each column
        const col2X = sideX + colW + 6; // second column start X
        const sideW = colW * 2 + 6 + 8; // total sidebar width
        this.add.rectangle(sideX + sideW / 2, H / 2, sideW, H, 0x0e1a27).setDepth(1);

        // Title
        const edTitle = this.levelNum ? `РЕД. УР. ${this.levelNum}` : 'РЕДАКТОР';
        this.add.bitmapText(FOX + FS / 2, FOY - 26, GF, edTitle, 28).setOrigin(0.5).setDepth(2).setTint(0xffcc44);

        // Tool palette
        const tools = [
            { key: 'boundary', label: 'СТЕНА', color: 0x888888, desc: 'Препятствие' },
            { key: 'income', label: 'ДОХОД', color: 0x44ff88, desc: '+деньги хит' },
            { key: 'trap', label: 'ЛОВУШКА', color: 0xff3333, desc: '-деньги' },
            { key: 'slow', label: 'ЛЁД', color: 0x3366ff, desc: 'Замедление' },
            { key: 'zone', label: 'ЗОНА', color: 0x00ddaa, desc: 'Пасс. доход' },
            { key: 'erase', label: 'СТЕРЕТЬ', color: 0x444444, desc: '' },
        ];
        const tBtnW = colW - 4, tBtnH = 44, tBtnX = sideX + 2;
        const c2BtnW = colW - 4, c2X = col2X + 2;
        let tY = FOY + 16;
        this._toolBtns = {};
        tools.forEach(t => {
            const by = tY;
            const g = this.add.graphics().setDepth(2);
            const draw = (sel) => {
                g.clear();
                g.fillStyle(sel ? 0x223355 : 0x0e1a27, 1);
                g.fillRoundedRect(tBtnX, by, tBtnW, tBtnH, 8);
                g.lineStyle(2, t.key === 'boundary' ? this.currentBoundaryColor : t.color, sel ? 1 : 0.5);
                g.strokeRoundedRect(tBtnX, by, tBtnW, tBtnH, 8);
            };
            draw(t.key === this.currentTool);
            this.add.bitmapText(tBtnX + tBtnW / 2, by + (t.desc ? 11 : 22), GF, t.label, 15).setOrigin(0.5).setDepth(3).setTint(t.color);
            if (t.desc) this.add.bitmapText(tBtnX + tBtnW / 2, by + 30, GF, t.desc, 11).setOrigin(0.5).setDepth(3).setTint(0xaaaaaa);
            const hit = this.add.rectangle(tBtnX + tBtnW / 2, by + tBtnH / 2, tBtnW, tBtnH, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
            this._toolBtns[t.key] = { g, draw, key: t.key };
            hit.on('pointerdown', () => {
                this.currentTool = t.key;
                tools.forEach(tt => this._toolBtns[tt.key].draw(tt.key === t.key));
            });
            tY += tBtnH + 8;
        });

        // Color swatches for boundary wall
        tY += 4;
        this.add.bitmapText(tBtnX + tBtnW / 2, tY, GF, 'ЦВЕТ СТЕНЫ', 10).setOrigin(0.5, 0).setDepth(2).setTint(0x888888);
        tY += 14;
        const bdColors = [0x888888, 0x8855dd, 0x336644, 0x336688, 0xaa5533];
        const swSz = 20, swGap = 5;
        const swTotalW = bdColors.length * (swSz + swGap) - swGap;
        const swX0 = tBtnX + (tBtnW - swTotalW) / 2;
        this._swatchGfx = [];
        bdColors.forEach((c, ci) => {
            const sx = swX0 + ci * (swSz + swGap);
            const sy = tY;
            const sg = this.add.graphics().setDepth(2);
            const drawSw = (sel) => {
                sg.clear();
                sg.fillStyle(c, 1); sg.fillRect(sx, sy, swSz, swSz);
                sg.lineStyle(2, sel ? 0xffffff : 0x222222, 1); sg.strokeRect(sx, sy, swSz, swSz);
            };
            drawSw(c === this.currentBoundaryColor);
            this._swatchGfx.push({ sg, drawSw, color: c });
            const sh = this.add.rectangle(sx + swSz / 2, sy + swSz / 2, swSz, swSz, 0, 0).setInteractive({ useHandCursor: true }).setDepth(3);
            sh.on('pointerdown', () => {
                this.currentBoundaryColor = c;
                this.currentTool = 'boundary';
                this._swatchGfx.forEach(s => s.drawSw(s.color === c));
                tools.forEach(tt => this._toolBtns[tt.key].draw(tt.key === 'boundary'));
            });
        });
        tY += swSz + 10;

        // Trap damage selector
        this.currentTrapDamage = 5;
        this.add.bitmapText(tBtnX + tBtnW / 2, tY, GF, 'УРОН ЛОВУШКИ', 10).setOrigin(0.5, 0).setDepth(2).setTint(0xff8888);
        tY += 14;
        const trapDmgs = [1, 2, 4, 5, 10];
        const tdSz = Math.floor((tBtnW - 4 * 4) / 5);
        this._trapDmgBtns = [];
        trapDmgs.forEach((d, di) => {
            const bx = tBtnX + di * (tdSz + 4);
            const syd = tY;
            const bg = this.add.graphics().setDepth(2);
            const drawTd = (sel) => {
                bg.clear();
                bg.fillStyle(sel ? 0x550000 : 0x1a0000, 1);
                bg.fillRect(bx, syd, tdSz, 22);
                bg.lineStyle(2, sel ? 0xff4444 : 0x550000, 1);
                bg.strokeRect(bx, syd, tdSz, 22);
            };
            drawTd(d === this.currentTrapDamage);
            this.add.bitmapText(bx + tdSz / 2, syd + 11, GF, `${d}$`, 11).setOrigin(0.5).setDepth(3).setTint(0xff8888);
            const hit = this.add.rectangle(bx + tdSz / 2, syd + 11, tdSz, 22, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
            this._trapDmgBtns.push({ bg, drawTd, val: d });
            hit.on('pointerdown', () => {
                this.currentTrapDamage = d;
                this._trapDmgBtns.forEach(b => b.drawTd(b.val === d));
            });
        });
        tY += 22 + 8;

        // Legend
        this.add.bitmapText(tBtnX + tBtnW / 2, tY, GF, '× = -деньги\n❄ = замедление\n◆ = зона дохода', 11).setOrigin(0.5, 0).setDepth(2).setTint(0x888888).setCenterAlign();
        tY += 52;

        // ── RIGHT COLUMN (col2) ──────────────────────────────────
        let c2Y = FOY + 16;

        // Target money input
        this.editorTargetMoney = 2000;
        this.add.bitmapText(c2X + c2BtnW / 2, c2Y, GF, 'ЦЕЛЬ ($)', 10).setOrigin(0.5, 0).setDepth(2).setTint(0xffcc44);
        c2Y += 14;

        const targetGfx = this.add.graphics().setDepth(2);
        const drawTargetBox = (focused) => {
            targetGfx.clear();
            targetGfx.fillStyle(focused ? 0x1a1400 : 0x0d0a00, 1);
            targetGfx.fillRoundedRect(c2X, c2Y, c2BtnW, 28, 6);
            targetGfx.lineStyle(2, focused ? 0xffcc44 : 0x665500, 1);
            targetGfx.strokeRoundedRect(c2X, c2Y, c2BtnW, 28, 6);
        };
        drawTargetBox(false);
        this._targetValText = this.add.bitmapText(c2X + c2BtnW / 2, c2Y + 14, GF, '2000$', 15).setOrigin(0.5).setDepth(3).setTint(0xffcc44);

        const steps = [100, 500, 1000, 5000];
        let _stepIdx = 0;
        const _updateTargetDisplay = () => {
            this._targetValText.setText(this.editorTargetMoney.toLocaleString() + '$');
        };

        const minusHit = this.add.rectangle(c2X + 12, c2Y + 14, 24, 28, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
        this.add.bitmapText(c2X + 12, c2Y + 14, GF, '−', 18).setOrigin(0.5).setDepth(4).setTint(0xffcc44);
        minusHit.on('pointerdown', () => {
            this.editorTargetMoney = Math.max(100, this.editorTargetMoney - steps[_stepIdx]);
            _updateTargetDisplay();
        });

        const plusHit = this.add.rectangle(c2X + c2BtnW - 12, c2Y + 14, 24, 28, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
        this.add.bitmapText(c2X + c2BtnW - 12, c2Y + 14, GF, '+', 18).setOrigin(0.5).setDepth(4).setTint(0xffcc44);
        plusHit.on('pointerdown', () => {
            this.editorTargetMoney = this.editorTargetMoney + steps[_stepIdx];
            _updateTargetDisplay();
        });

        c2Y += 32;
        this.add.bitmapText(c2X + c2BtnW / 2, c2Y, GF, 'шаг:', 10).setOrigin(0.5, 0).setDepth(2).setTint(0x888888);
        c2Y += 13;
        const stepBtnW = Math.floor((c2BtnW - 3 * 4) / 4);
        this._stepBtns = [];
        steps.forEach((s, si) => {
            const bx = c2X + si * (stepBtnW + 4);
            const sg = this.add.graphics().setDepth(2);
            const drawSB = (sel) => {
                sg.clear();
                sg.fillStyle(sel ? 0x2a2000 : 0x0d0900, 1);
                sg.fillRect(bx, c2Y, stepBtnW, 20);
                sg.lineStyle(1.5, sel ? 0xffcc44 : 0x443300, 1);
                sg.strokeRect(bx, c2Y, stepBtnW, 20);
            };
            drawSB(si === 0);
            this.add.bitmapText(bx + stepBtnW / 2, c2Y + 10, GF, s >= 1000 ? (s / 1000) + 'k' : String(s), 11).setOrigin(0.5).setDepth(3).setTint(0xffcc44);
            const sh = this.add.rectangle(bx + stepBtnW / 2, c2Y + 10, stepBtnW, 20, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
            this._stepBtns.push({ sg, drawSB });
            sh.on('pointerdown', () => {
                _stepIdx = si;
                this._stepBtns.forEach((b, bi) => b.drawSB(bi === si));
            });
        });
        c2Y += 28;

        // Light theme toggle
        c2Y += 8;
        const ltY = c2Y;
        c2Y += 42;
        const ltGfx = this.add.graphics().setDepth(2);
        const drawLtToggle = () => {
            ltGfx.clear();
            if (this.lightTheme) {
                ltGfx.fillStyle(0xdceaf8, 1);
                ltGfx.fillRoundedRect(c2X, ltY, c2BtnW, 34, 8);
                ltGfx.lineStyle(2, 0x2255cc, 1);
                ltGfx.strokeRoundedRect(c2X, ltY, c2BtnW, 34, 8);
                ltGfx.fillStyle(0x2255cc, 1);
                ltGfx.fillRoundedRect(c2X + 8, ltY + 9, 16, 16, 3);
                ltGfx.lineStyle(2.5, 0xffffff, 1);
                ltGfx.lineBetween(c2X + 11, ltY + 17, c2X + 14, ltY + 21);
                ltGfx.lineBetween(c2X + 14, ltY + 21, c2X + 22, ltY + 13);
            } else {
                ltGfx.fillStyle(0x0e1a27, 1);
                ltGfx.fillRoundedRect(c2X, ltY, c2BtnW, 34, 8);
                ltGfx.lineStyle(2, 0x335566, 0.7);
                ltGfx.strokeRoundedRect(c2X, ltY, c2BtnW, 34, 8);
                ltGfx.lineStyle(1.5, 0x557799, 1);
                ltGfx.strokeRoundedRect(c2X + 8, ltY + 9, 16, 16, 3);
            }
        };
        drawLtToggle();
        const ltLabel = this.add.bitmapText(c2X + 31, ltY + 17, GF, 'Светлая', 12).setOrigin(0, 0.5).setDepth(3).setTint(this.lightTheme ? 0x224499 : 0x88aacc);
        this._ltLabel = ltLabel;
        this._drawLtToggle = drawLtToggle;
        const ltHit = this.add.rectangle(c2X + c2BtnW / 2, ltY + 17, c2BtnW, 34, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
        ltHit.on('pointerdown', () => {
            this.lightTheme = !this.lightTheme;
            drawLtToggle();
            ltLabel.setTint(this.lightTheme ? 0x224499 : 0x88aacc);
            this._drawEditorBg();
            this._drawCells();
        });

        // Clear button
        const clrY = c2Y;
        c2Y += 42;
        const clrG = this.add.graphics().setDepth(2);
        const drawClr = (hov) => { clrG.clear(); clrG.fillStyle(hov ? 0x300a0a : 0x1a0606, 1); clrG.fillRoundedRect(c2X, clrY, c2BtnW, 34, 8); clrG.lineStyle(2, 0xff4444, hov ? 1 : 0.6); clrG.strokeRoundedRect(c2X, clrY, c2BtnW, 34, 8); };
        drawClr(false);
        this.add.bitmapText(c2X + c2BtnW / 2, clrY + 17, GF, 'ОЧИСТИТЬ', 14).setOrigin(0.5).setDepth(3).setTint(0xff4444);
        const clrHit = this.add.rectangle(c2X + c2BtnW / 2, clrY + 17, c2BtnW, 34, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
        clrHit.on('pointerover', () => drawClr(true)); clrHit.on('pointerout', () => drawClr(false));
        clrHit.on('pointerdown', () => { this.cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); this._drawCells(); });

        // Action buttons — ТЕСТ / СОХРАНИТЬ / МЕНЮ
        const abLabels = ['ТЕСТ', 'СОХРАНИТЬ', 'МЕНЮ'];
        const abColors = [0x44ff88, 0xffcc44, 0xaaaaaa];
        abLabels.forEach((lbl, i) => {
            const ag = this.add.graphics().setDepth(2);
            const ay = c2Y;
            c2Y += 46;
            const draw = (hov) => {
                ag.clear();
                ag.fillStyle(hov ? 0x223344 : 0x0d1824, 1);
                ag.fillRoundedRect(c2X, ay, c2BtnW, 38, 8);
                ag.lineStyle(2, abColors[i], hov ? 1 : 0.7);
                ag.strokeRoundedRect(c2X, ay, c2BtnW, 38, 8);
            };
            draw(false);
            this.add.bitmapText(c2X + c2BtnW / 2, ay + 19, GF, lbl, 16).setOrigin(0.5).setDepth(3).setTint(abColors[i]);
            const hit = this.add.rectangle(c2X + c2BtnW / 2, ay + 19, c2BtnW, 38, 0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
            hit.on('pointerover', () => draw(true)); hit.on('pointerout', () => draw(false));
            hit.on('pointerdown', () => {
                if (i === 0) this._testLevel();
                else if (i === 1) this._saveLevel();
                else if (this.levelNum) this.scene.start('LevelSelectScene');
                else this.scene.start('StartScene');
            });
        });

        // Load saved if exists
        this._loadLevel();

        // Input: paint on click/drag within grid
        this.input.on('pointerdown', (p) => { this.isPainting = true; this._paintAt(p.x, p.y); });
        this.input.on('pointermove', (p) => { if (this.isPainting) this._paintAt(p.x, p.y); });
        this.input.on('pointerup', () => { this.isPainting = false; });
    }

    _getCellAt(px, py) {
        const col = Math.floor((px - this.GSX) / this.D);
        const row = Math.floor((py - this.GSY) / this.D);
        if (col < 0 || col >= this.COLS || row < 0 || row >= this.ROWS) return null;
        return { col, row };
    }

    _paintAt(px, py) {
        const cell = this._getCellAt(px, py);
        if (!cell) return;
        const { col, row } = cell;
        if (this.currentTool === 'erase') {
            this.cells[row][col] = null;
        } else if (this.currentTool === 'boundary') {
            this.cells[row][col] = { type: 'boundary', color: this.currentBoundaryColor };
        } else if (this.currentTool === 'trap') {
            this.cells[row][col] = { type: 'trap', damage: this.currentTrapDamage };
        } else if (this.currentTool === 'income') {
            this.cells[row][col] = { type: 'income' };
        } else {
            this.cells[row][col] = { type: this.currentTool };
        }
        this._drawCells();
    }

    _drawCells() {
        const g = this._cellGfx; g.clear();
        if (this._iconObjs) this._iconObjs.forEach(o => o.destroy());
        this._iconObjs = [];
        for (let r = 0; r < this.ROWS; r++) {
            for (let c = 0; c < this.COLS; c++) {
                const cell = this.cells[r][c];
                if (!cell) continue;
                const x = this.GSX + c * this.D, y = this.GSY + r * this.D;
                if (cell.type === 'boundary' || cell.type === 'static') {
                    const col = cell.color || 0x888888;
                    g.fillStyle(col, 1); g.fillRect(x, y, this.D, this.D);
                    g.lineStyle(2, col, 1); g.strokeRect(x, y, this.D, this.D);
                } else if (cell.type === 'zone') {
                    g.fillStyle(0x00ddaa, 0.3); g.fillRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    g.lineStyle(2, 0x00ffcc, 0.9); g.strokeRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    this._iconObjs.push(this.add.bitmapText(x + this.D / 2, y + this.D / 2, this._gf, '◆', 13).setOrigin(0.5).setDepth(3).setTint(0x00ffcc));
                } else if (cell.type === 'trap') {
                    g.fillStyle(0x440000, 1); g.fillRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    g.lineStyle(2, 0xff3333, 1); g.strokeRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    const _dmgStr = `-${cell.damage || 5}$`;
                    this._iconObjs.push(this.add.bitmapText(x + this.D / 2, y + this.D / 2 - 7, this._gf, '×', 11).setOrigin(0.5).setDepth(3).setTint(0xff4444));
                    this._iconObjs.push(this.add.bitmapText(x + this.D / 2, y + this.D / 2 + 6, this._gf, _dmgStr, 10).setOrigin(0.5).setDepth(3).setTint(0xff8888));
                } else if (cell.type === 'slow') {
                    g.fillStyle(0x001040, 1); g.fillRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    g.lineStyle(2, 0x3366ff, 1); g.strokeRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    this._iconObjs.push(this.add.bitmapText(x + this.D / 2, y + this.D / 2, this._gf, '❄', 13).setOrigin(0.5).setDepth(3).setTint(0x88aaff));
                } else if (cell.type === 'income') {
                    const iv = cell.incomeValue || 1;
                    g.fillStyle(0x002200, 1); g.fillRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    g.lineStyle(2, 0x44ff88, 1); g.strokeRect(x + 1, y + 1, this.D - 2, this.D - 2);
                    g.fillStyle(0x44ff88, 0.12); g.fillRect(x + 1, y + 1, this.D - 2, Math.floor((this.D - 2) * 0.35));
                    this._iconObjs.push(this.add.bitmapText(x + this.D / 2, y + this.D / 2, this._gf, `+${iv}$`, 12).setOrigin(0.5).setDepth(3).setTint(0x44ff88));
                }
            }
        }
    }

    _levelKey() {
        return this.levelNum ? `bumper_level_${this.levelNum}` : 'bumper_editor_level';
    }

    _saveLevel() {
        const walls = [];
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.cells[r][c]) {
                    const _sc = this.cells[r][c];
                    const _se = { col: c, row: r, type: _sc.type };
                    if (_sc.color) _se.color = _sc.color;
                    if (_sc.damage) _se.damage = _sc.damage;
                    if (_sc.incomeValue !== undefined) _se.incomeValue = _sc.incomeValue;
                    walls.push(_se);
                }
        try { localStorage.setItem(this._levelKey(), JSON.stringify({ walls, lightTheme: this.lightTheme, targetMoney: this.editorTargetMoney })); } catch (e) { }
        const txt = this.add.bitmapText(this.GSX + (this.COLS * this.D) / 2, this.GSY + (this.ROWS * this.D) / 2, this._gf, 'СОХРАНЕНО!', 38).setOrigin(0.5).setDepth(10).setTint(0x44ff88);
        this.tweens.add({ targets: txt, alpha: 0, y: txt.y - 40, duration: 1200, ease: 'Power2', onComplete: () => txt.destroy() });
    }

    _loadLevel() {
        try {
            const raw = localStorage.getItem(this._levelKey());
            if (!raw) return;
            const parsed = JSON.parse(raw);
            const walls = Array.isArray(parsed) ? parsed : (parsed.walls || []);
            this.lightTheme = !Array.isArray(parsed) && !!(parsed.lightTheme);
            if (!Array.isArray(parsed) && parsed.targetMoney) {
                this.editorTargetMoney = parsed.targetMoney;
                if (this._targetValText) this._targetValText.setText(parsed.targetMoney.toLocaleString() + '$');
            }
            if (this._drawLtToggle) this._drawLtToggle();
            if (this._ltLabel) this._ltLabel.setTint(this.lightTheme ? 0x224499 : 0x88aacc);
            walls.forEach(w => {
                if (w.row < this.ROWS && w.col < this.COLS) {
                    const _lc = { type: w.type };
                    if (w.color) _lc.color = w.color;
                    if (w.damage) _lc.damage = w.damage;
                    if (w.incomeValue !== undefined) _lc.incomeValue = w.incomeValue;
                    this.cells[w.row][w.col] = _lc;
                }
            });
            if (this._drawEditorBg) this._drawEditorBg();
            this._drawCells();
        } catch (e) { }
    }

    _testLevel() {
        // Auto-save current state so returning to editor via "← РЕД" shows unsaved changes
        const snap = [];
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.cells[r][c]) {
                    const _tc = this.cells[r][c];
                    const _te = { col: c, row: r, type: _tc.type };
                    if (_tc.color) _te.color = _tc.color;
                    if (_tc.damage) _te.damage = _tc.damage;
                    if (_tc.incomeValue !== undefined) _te.incomeValue = _tc.incomeValue;
                    snap.push(_te);
                }
        try { localStorage.setItem(this._levelKey(), JSON.stringify({ walls: snap, lightTheme: this.lightTheme, targetMoney: this.editorTargetMoney })); } catch (e) { }

        const customWalls = [];
        const D = this.D;
        // GameScene uses fieldOffsetX=184, fieldOffsetY=102 — compute coords from there
        const GS_FOX = 184, GS_FOY = 102, GS_FS = 392;
        const GS_GSX = GS_FOX + Math.floor((GS_FS - this.COLS * D) / 2);
        const GS_GSY = GS_FOY + Math.floor((GS_FS - this.ROWS * D) / 2);
        for (let r = 0; r < this.ROWS; r++)
            for (let c = 0; c < this.COLS; c++)
                if (this.cells[r][c]) {
                    const _tc = this.cells[r][c];
                    customWalls.push({ x: GS_GSX + c * D + D / 2, y: GS_GSY + r * D + D / 2, specialType: _tc.type, color: _tc.color || null, damage: _tc.damage || null, incomeValue: _tc.incomeValue || null });
                }
        this.scene.start('MainScene', { customWalls, testMode: true, levelNum: this.levelNum, lightTheme: this.lightTheme, targetMoney: this.editorTargetMoney });
    }
}

class LevelSelectScene extends Phaser.Scene {
    constructor() { super('LevelSelectScene'); }
    preload() { _preloadGameFont(this); }
    create() {
        this._seedDefaultLevels();
        const W = 760, H = 870;
        const ch = (n) => '#' + n.toString(16).padStart(6, '0');
        const GF = _initGameFont(this);

        this.add.rectangle(W / 2, H / 2, W, H, 0x0b1520);
        const dotGfx = this.add.graphics();
        dotGfx.fillStyle(0xffffff, 0.025);
        for (let gx = 30; gx < W; gx += 48)
            for (let gy = 20; gy < H; gy += 40)
                dotGfx.fillCircle(gx, gy, 1.5);

        this.add.bitmapText(W / 2, 52, GF, 'УРОВНИ', 52).setOrigin(0.5).setTint(0xffcc44);

        // Back button (top-left)
        const backGfx = this.add.graphics();
        const drawBack = (hov) => {
            backGfx.clear();
            backGfx.fillStyle(hov ? 0x1a1a2a : 0x0d1020, 1);
            backGfx.fillRoundedRect(18, 18, 110, 38, 8);
            backGfx.lineStyle(2, 0x8888aa, hov ? 1 : 0.55);
            backGfx.strokeRoundedRect(18, 18, 110, 38, 8);
        };
        drawBack(false);
        this.add.bitmapText(73, 37, GF, '← НАЗАД', 16).setOrigin(0.5).setTint(0xaaaacc);
        const backHit = this.add.rectangle(73, 37, 110, 38, 0, 0).setInteractive({ useHandCursor: true });
        backHit.on('pointerover', () => drawBack(true));
        backHit.on('pointerout', () => drawBack(false));
        backHit.on('pointerdown', () => this.scene.start('StartScene'));

        // Level grid 10×5 = 50 levels
        const COLS = 10, TOTAL = 50;
        const BW = 62, BH = 54, GAP = 4;
        const gridW = COLS * (BW + GAP) - GAP;
        const startX = (W - gridW) / 2;
        const startY = 100;

        this._selectedLevel = null;
        this._btnDraw = [];

        for (let i = 0; i < TOTAL; i++) {
            const lvl = i + 1;
            const col = i % COLS;
            const row = Math.floor(i / COLS);
            const bx = startX + col * (BW + GAP) + BW / 2;
            const by = startY + row * (BH + GAP) + BH / 2;

            let hasSave = false;
            try { hasSave = !!localStorage.getItem(`bumper_level_${lvl}`); } catch (e) { }

            const gfx = this.add.graphics();
            const draw = (sel) => {
                gfx.clear();
                gfx.fillStyle(sel ? 0x1a3a18 : (hasSave ? 0x0d2018 : 0x0e1524), 1);
                gfx.fillRoundedRect(bx - BW / 2, by - BH / 2, BW, BH, 7);
                gfx.lineStyle(2, sel ? 0x44ff88 : (hasSave ? 0x2a6640 : 0x223355), sel ? 1 : 0.7);
                gfx.strokeRoundedRect(bx - BW / 2, by - BH / 2, BW, BH, 7);
            };
            draw(false);
            this.add.bitmapText(bx, by - (hasSave ? 8 : 0), GF, `${lvl}`, 20).setOrigin(0.5).setTint(hasSave ? 0x44ff88 : 0x8899aa);
            if (hasSave) this.add.bitmapText(bx, by + 14, GF, '✓', 13).setOrigin(0.5).setTint(0x44ff88);

            this._btnDraw.push({ lvl, draw });

            const hit = this.add.rectangle(bx, by, BW, BH, 0, 0).setInteractive({ useHandCursor: true });
            hit.on('pointerdown', () => this._selectLevel(lvl));
        }

        // Action panel (shown after selecting a level)
        const panY = startY + 5 * (BH + GAP) + 30;

        const hintGfx = this.add.graphics();
        hintGfx.fillStyle(0x0d1824, 0.7);
        hintGfx.fillRoundedRect(W / 2 - 260, panY, 520, 55, 12);
        hintGfx.lineStyle(1.5, 0x445566, 0.5);
        hintGfx.strokeRoundedRect(W / 2 - 260, panY, 520, 55, 12);
        this._hintTxt = this.add.bitmapText(W / 2, panY + 28, GF, 'Выберите уровень', 22).setOrigin(0.5).setTint(0x556677);

        // Action buttons (hidden until level selected)
        const actY = panY + 90;
        const BW2 = 230, BH2 = 58, gap2 = 16;
        const playX = W / 2 - BW2 - gap2 / 2;
        const editX = W / 2 + gap2 / 2;

        // ИГРАТЬ button (left)
        const playGfx = this.add.graphics();
        const drawPlay = (hov) => {
            playGfx.clear();
            playGfx.fillStyle(hov ? 0x0a1a3a : 0x060e20, 1);
            playGfx.fillRoundedRect(playX, actY, BW2, BH2, 12);
            playGfx.lineStyle(2.5, 0x44aaff, hov ? 1 : 0.75);
            playGfx.strokeRoundedRect(playX, actY, BW2, BH2, 12);
        };
        drawPlay(false);
        const playTxt = this.add.bitmapText(playX + BW2 / 2, actY + BH2 / 2, GF, '▶  ИГРАТЬ', 26).setOrigin(0.5).setTint(0x44aaff);
        const playHit = this.add.rectangle(playX + BW2 / 2, actY + BH2 / 2, BW2, BH2, 0, 0).setInteractive({ useHandCursor: true });
        playHit.on('pointerover', () => drawPlay(true));
        playHit.on('pointerout', () => drawPlay(false));
        playHit.on('pointerdown', () => {
            if (!this._selectedLevel) return;
            let customWalls = [], lightTheme = false, targetMoney = null;
            try {
                const raw = localStorage.getItem(`bumper_level_${this._selectedLevel}`);
                if (raw) {
                    const D = 36, GSX = 200, GSY = 118;
                    const parsed = JSON.parse(raw);
                    const walls = Array.isArray(parsed) ? parsed : (parsed.walls || []);
                    lightTheme = !Array.isArray(parsed) && !!(parsed.lightTheme);
                    if (!Array.isArray(parsed) && parsed.targetMoney) targetMoney = parsed.targetMoney;
                    walls.forEach(w => {
                        customWalls.push({ x: GSX + w.col * D + D / 2, y: GSY + w.row * D + D / 2, specialType: w.type || null, color: w.color || null, damage: w.damage || null, incomeValue: w.incomeValue || null });
                    });
                }
            } catch (e) { }
            this.scene.start('MainScene', { customWalls, testMode: true, levelNum: this._selectedLevel, lightTheme, targetMoney });
        });

        // РЕДАКТИРОВАТЬ button (right)
        const editGfx = this.add.graphics();
        const drawEdit = (hov) => {
            editGfx.clear();
            editGfx.fillStyle(hov ? 0x1a3a18 : 0x0d2010, 1);
            editGfx.fillRoundedRect(editX, actY, BW2, BH2, 12);
            editGfx.lineStyle(2.5, 0x44ff88, hov ? 1 : 0.75);
            editGfx.strokeRoundedRect(editX, actY, BW2, BH2, 12);
        };
        drawEdit(false);
        const editTxt = this.add.bitmapText(editX + BW2 / 2, actY + BH2 / 2, GF, '✏  РЕДАКТИРОВАТЬ', 20).setOrigin(0.5).setTint(0x44ff88);
        const editHit = this.add.rectangle(editX + BW2 / 2, actY + BH2 / 2, BW2, BH2, 0, 0).setInteractive({ useHandCursor: true });
        editHit.on('pointerover', () => drawEdit(true));
        editHit.on('pointerout', () => drawEdit(false));
        editHit.on('pointerdown', () => {
            if (this._selectedLevel) this.scene.start('EditorScene', { levelNum: this._selectedLevel });
        });

        [playGfx, playTxt, playHit, editGfx, editTxt, editHit].forEach(o => o.setVisible(false));
        this._actionObjs = [playGfx, playTxt, playHit, editGfx, editTxt, editHit];
        this._drawPlay = drawPlay;
        this._drawEdit = drawEdit;
    }

    _seedDefaultLevels() {
        const b = (col, row, color) => ({ col, row, type: 'boundary', color: color || 0x3366cc });
        const s = (col, row) => ({ col, row, type: 'slow' });
        const t = (col, row, dmg) => ({ col, row, type: 'trap', damage: dmg || 2 });
        const z = (col, row) => ({ col, row, type: 'zone' });

        const levels = [
            // ── Уровень 1 – «Уголки» ──────────────────────────────────
            // Четыре L-образных бампера по углам, две зоны дохода в центре
            [
                b(2, 1), b(3, 1), b(2, 2),
                b(6, 1), b(7, 1), b(7, 2),
                b(2, 7), b(2, 8), b(3, 8),
                b(7, 7), b(6, 8), b(7, 8),
                z(4, 4), z(5, 5),
            ],
            // ── Уровень 2 – «Каналы» ──────────────────────────────────
            // Два горизонтальных барьера сверху и снизу, зоны по бокам, один замедлитель
            [
                b(0, 2, 0x44bb44), b(1, 2, 0x44bb44), b(2, 2, 0x44bb44),
                b(7, 2, 0x44bb44), b(8, 2, 0x44bb44), b(9, 2, 0x44bb44),
                b(0, 7, 0x44bb44), b(1, 7, 0x44bb44), b(2, 7, 0x44bb44),
                b(7, 7, 0x44bb44), b(8, 7, 0x44bb44), b(9, 7, 0x44bb44),
                z(0, 4), z(9, 4), z(0, 5), z(9, 5),
                s(4, 4),
            ],
            // ── Уровень 3 – «Крест» ───────────────────────────────────
            // Крест из блоков делит поле на четыре секции, зоны по углам, ловушки + лёд в центре
            [
                b(4, 1, 0xaa4444), b(5, 1, 0xaa4444), b(4, 2, 0xaa4444), b(5, 2, 0xaa4444),
                b(1, 4, 0xaa4444), b(2, 4, 0xaa4444), b(7, 4, 0xaa4444), b(8, 4, 0xaa4444),
                b(1, 5, 0xaa4444), b(2, 5, 0xaa4444), b(7, 5, 0xaa4444), b(8, 5, 0xaa4444),
                b(4, 7, 0xaa4444), b(5, 7, 0xaa4444), b(4, 8, 0xaa4444), b(5, 8, 0xaa4444),
                z(1, 1), z(8, 1), z(1, 8), z(8, 8),
                t(4, 4, 2), t(5, 5, 2),
                s(4, 5),
            ],
            // ── Уровень 4 – «Лабиринт» ───────────────────────────────
            // П-образная стена слева, зеркальная справа, ловушки и замедлители в проходах
            [
                b(1, 1, 0x9944cc), b(2, 1, 0x9944cc), b(3, 1, 0x9944cc),
                b(3, 2, 0x9944cc),
                b(3, 3, 0x9944cc), b(4, 3, 0x9944cc), b(5, 3, 0x9944cc),
                b(3, 6, 0x9944cc), b(4, 6, 0x9944cc), b(5, 6, 0x9944cc),
                b(3, 7, 0x9944cc),
                b(3, 8, 0x9944cc), b(4, 8, 0x9944cc), b(5, 8, 0x9944cc),
                z(6, 2), z(0, 4), z(0, 9), z(9, 9),
                s(1, 5), s(7, 5),
                t(8, 4, 4), t(6, 9, 4),
            ],
            // ── Уровень 5 – «Арена» ──────────────────────────────────
            // Арена с рамкой из бамперов, ловушки в 4 квадрантах, лёд в центре, зоны в углах
            [
                b(1, 1, 0xcc8833), b(4, 1, 0xcc8833), b(5, 1, 0xcc8833), b(8, 1, 0xcc8833),
                b(1, 2, 0xcc8833), b(8, 2, 0xcc8833),
                b(1, 7, 0xcc8833), b(8, 7, 0xcc8833),
                b(1, 8, 0xcc8833), b(4, 8, 0xcc8833), b(5, 8, 0xcc8833), b(8, 8, 0xcc8833),
                s(4, 4), s(5, 4), s(5, 5),
                t(3, 3, 4), t(6, 3, 4), t(3, 6, 5), t(6, 6, 5),
                z(0, 5), z(9, 5), z(0, 9), z(9, 9),
            ],
        ];

        levels.forEach((walls, i) => {
            const key = `bumper_level_${i + 1}`;
            try { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(walls)); } catch (e) { }
        });
    }

    _selectLevel(lvl) {
        this._btnDraw.forEach(b => b.draw(b.lvl === lvl));
        this._selectedLevel = lvl;
        this._hintTxt.setText(`УРОВЕНЬ  ${lvl}`).setTint(0xffcc44);
        this._actionObjs.forEach(o => o.setVisible(true));
        this._drawPlay(false);
        this._drawEdit(false);
    }
}

const _isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
const config = {
    type: Phaser.WEBGL,
    width: 760, height: 870,
    backgroundColor: '#0b1520',
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        width: 760,
        height: 870,
    },
    render: {
        antialias: false,
        powerPreference: 'high-performance',
        roundPixels: true,
    },
    
    input: {
        activePointers: 3,
    },
    scene: [StartScene, MainScene, EditorScene, LevelSelectScene],
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: 0 } },
};
// Worker-driven requestAnimationFrame: the Web Worker runs in a separate OS thread
// that is never subject to main-thread idle throttling. It sends ticks via MessageChannel
// (zero extra delay) so Phaser's game loop fires at true 60fps regardless of user input.
// Must run BEFORE new Phaser.Game() so Phaser picks up the override.
(function _workerRaf() {
    if (!_isMobile) return; // desktop uses native rAF at full monitor refresh rate
    let _w;
    try {
        _w = new Worker(URL.createObjectURL(
            new Blob(['function f(){postMessage(null);setTimeout(f,14);}f();'], { type: 'text/javascript' })
        ));
    } catch (e) { return; }

    const _ch = new MessageChannel();
    const _cbs = [];
    let _busy = false;

    _ch.port2.onmessage = () => {
        _busy = false;
        const t = performance.now();
        _cbs.splice(0).forEach(cb => { try { cb(t); } catch (e) { } });
    };
    _w.onmessage = () => {
        if (!_busy && _cbs.length) { _busy = true; _ch.port1.postMessage(null); }
    };

    let _nextId = 0;
    const _live = new Set();
    window.requestAnimationFrame = cb => {
        const id = ++_nextId;
        _live.add(id);
        _cbs.push(t => { if (_live.delete(id)) cb(t); });
        return id;
    };
    window.cancelAnimationFrame = id => _live.delete(id);
})();

function _startPhaserGame() { new Phaser.Game(config); }
