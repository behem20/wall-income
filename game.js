class MainScene extends Phaser.Scene {
    constructor() { super('MainScene'); }

    create() {
        this.fieldSize    = 640;
        this.fieldOffsetX = 60;
        this.fieldOffsetY = 55;
        this.fieldCX = this.fieldOffsetX + this.fieldSize / 2; // 380
        this.fieldCY = this.fieldOffsetY + this.fieldSize / 2; // 375
        this.slotY = 748;
        this.btnY  = 829;

        this.targetMoney = 2000000; this.money = 0; this.incomeBase = 5;
        this.placedWalls = 0; this.ballCost = 100; this.wallPackCost = 60;
        this.incomeCost = 80; this.gameWon = false;
        this.draggingNewWall = false; this.draggingSlotIndex = -1;
        this.draggingWallType = null; this.draggingIncomeValue = 0;
        this.muted = false; this._audioCtx = null; this._lastHitSound = 0;
        this._musicStarted = false; this._musicGain = null; this._musicTimeout = null;

        this.wallHand = [];
        const types = ['horizontal', 'vertical', 'block'];
        for (let i = 0; i < 3; i++)
            this.wallHand.push({ type: Phaser.Math.RND.pick(types), incomeValue: this.incomeBase });

        // top bar bg
        this.add.rectangle(380, 26, 760, 52, 0xd5e5ef).setStrokeStyle(1, 0xaabbcc);
        // field bg
        this.add.rectangle(this.fieldCX, this.fieldCY, this.fieldSize, this.fieldSize, 0xeaa2ff)
            .setStrokeStyle(4, 0x5577cc);

        this._genCheckerTexture();
        this.physics.world.setBounds(this.fieldOffsetX, this.fieldOffsetY, this.fieldSize, this.fieldSize);
        this.wallsGroup = this.physics.add.staticGroup();
        this.ballsGroup = this.physics.add.group({ runChildUpdate: true });
        this._trailGraphics = this.add.graphics().setDepth(1);

        this.createBall();
        this.createUI();
        this.setupInput();
        this.updateUI();
        this.input.once('pointerdown', () => this.startMusic());
    }

    _genCheckerTexture() {
        const g = this.make.graphics({ add: false });
        g.fillStyle(0xffcc00); g.fillRect(0, 0, 24, 24);
        g.fillStyle(0xff8800); g.fillRect(0, 0, 12, 12);
        g.fillStyle(0xff8800); g.fillRect(12, 12, 12, 12);
        g.lineStyle(1, 0xcc5500, 0.45); g.strokeRect(0.5, 0.5, 23, 23);
        g.generateTexture('checker', 24, 24);
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
                case 'hover':   { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=1000; g.gain.setValueAtTime(0.04,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.04); o.start(t); o.stop(t+0.04); break; }
                case 'hit':     { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(240,t); o.frequency.exponentialRampToValueAtTime(100,t+0.07); g.gain.setValueAtTime(0.13,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09); o.start(t); o.stop(t+0.09); break; }
                case 'wallhit': { [880,1320,1760].forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(),dt=i*0.038; o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(f,t+dt); o.frequency.exponentialRampToValueAtTime(f*0.6,t+dt+0.18); g.gain.setValueAtTime(0.10,t+dt); g.gain.exponentialRampToValueAtTime(0.001,t+dt+0.20); o.start(t+dt); o.stop(t+dt+0.21); }); break; }
                case 'merge':   { [280,420,600,840].forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(),dt=i*0.065; o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=f; g.gain.setValueAtTime(0,t+dt); g.gain.linearRampToValueAtTime(0.13,t+dt+0.02); g.gain.exponentialRampToValueAtTime(0.001,t+dt+0.15); o.start(t+dt); o.stop(t+dt+0.15); }); break; }
                case 'buy':     { [350,500,700].forEach((f,i)=>{ const o=ctx.createOscillator(),g=ctx.createGain(),dt=i*0.055; o.connect(g); g.connect(ctx.destination); o.type='triangle'; o.frequency.value=f; g.gain.setValueAtTime(0.11,t+dt); g.gain.exponentialRampToValueAtTime(0.001,t+dt+0.13); o.start(t+dt); o.stop(t+dt+0.13); }); break; }
                case 'place':   { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.value=440; g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.09); o.start(t); o.stop(t+0.09); break; }
                case 'return':  { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(280,t+0.13); g.gain.setValueAtTime(0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.15); o.start(t); o.stop(t+0.15); break; }
                case 'error':   { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sawtooth'; o.frequency.value=140; g.gain.setValueAtTime(0.09,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.2); o.start(t); o.stop(t+0.2); break; }
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
        n(659.25,0,1.0); n(783.99,1,0.5); n(880.00,1.5,0.5); n(783.99,2,0.85); n(659.25,3,0.9);
        n(523.25,4,1.8); n(659.25,6,0.8); n(587.33,7,0.9);
        n(523.25,8,0.8); n(440.00,9,0.85); n(392.00,10,0.8); n(440.00,11,0.9);
        n(392.00,12,1.5); n(329.63,13.5,0.5); n(392.00,14,0.85); n(329.63,15,0.9);
        [0,2].forEach(sb=>n(130.81,sb,1.85,'sine',0.36));
        [4,6].forEach(sb=>n(110.00,sb,1.85,'sine',0.36));
        [8,10].forEach(sb=>n(174.61,sb,1.85,'sine',0.36));
        [12,14].forEach(sb=>n(196.00,sb,1.85,'sine',0.36));
        [[[130.81,164.81,196.00],0],[[110.00,130.81,164.81],4],
         [[174.61,220.00,261.63],8],[[196.00,246.94,293.66],12]
        ].forEach(([fs,sb])=>fs.forEach(f=>n(f,sb,3.85,'sine',0.065)));
        for (let bar=0;bar<4;bar++) [0,2].forEach(beat=>{
            const kt=t+(bar*4+beat)*b, kv=beat===0?0.45:0.28;
            const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(mg); o.type='sine';
            o.frequency.setValueAtTime(155,kt); o.frequency.exponentialRampToValueAtTime(40,kt+0.13);
            g.gain.setValueAtTime(kv,kt); g.gain.exponentialRampToValueAtTime(0.001,kt+0.15);
            o.start(kt); o.stop(kt+0.16);
        });
        for (let i=0;i<16;i++){
            const ht=t+i*b;
            const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g); g.connect(mg); o.type='square'; o.frequency.value=7800;
            g.gain.setValueAtTime(0.030,ht); g.gain.exponentialRampToValueAtTime(0.001,ht+0.05); o.start(ht); o.stop(ht+0.055);
            const ot=ht+b*0.5;
            const o2=ctx.createOscillator(),g2=ctx.createGain(); o2.connect(g2); g2.connect(mg); o2.type='square'; o2.frequency.value=7200;
            g2.gain.setValueAtTime(0.014,ot); g2.gain.exponentialRampToValueAtTime(0.001,ot+0.04); o2.start(ot); o2.stop(ot+0.044);
        }
        const loopDur = 16*b;
        this._nextMusicT = t + loopDur;
        this._musicTimeout = window.setTimeout(()=>this._loopMusic(), Math.max(100,(this._nextMusicT-ctx.currentTime-2*b)*1000));
    }

    toggleMute() {
        this.muted = !this.muted;
        this.muteBtn.setText(this.muted ? '🔇' : '🔊');
        if (this._musicGain && this._audioCtx)
            this._musicGain.gain.setValueAtTime(this.muted ? 0 : 0.12, this._audioCtx.currentTime);
        if (!this.muted && !this._musicStarted) this.startMusic();
    }

    // ──── Ball ────

    createBall() {
        const ox=this.fieldOffsetX, oy=this.fieldOffsetY, fs=this.fieldSize;
        const ball = this.add.circle(
            Phaser.Math.Between(ox+100, ox+fs-100),
            Phaser.Math.Between(oy+100, oy+fs-100),
            18, 0xffffff
        ).setDepth(2);
        this.physics.add.existing(ball);
        ball.body.setCircle(18).setBounce(1,1).setAllowGravity(false).setDrag(0);
        ball.bounceSpeed = 400; ball.currentSpeed = 400;
        ball._trail = [];
        const angle = Phaser.Math.DegToRad(Phaser.Math.Between(25, 65));
        const sx = Phaser.Math.RND.pick([-1,1]), sy = Phaser.Math.RND.pick([-1,1]);
        ball.body.setVelocity(sx*Math.cos(angle)*400, sy*Math.sin(angle)*400);
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
        const wall = this.add.tileSprite(x, y, width, height, 'checker');
        wall.setOrigin(0.5, 0.5);
        this.physics.add.existing(wall, true);
        wall.body.setSize(width, height);
        wall.isWall = true; wall.wallType = wallType;
        wall.incomeValue = val; wall.lastHit = 0; wall.lastFloat = 0;
        wall.setInteractive({ cursor: 'grab' });
        this.input.setDraggable(wall);
        wall.valueText = this.add.text(x, y, `$${val}`, {
            fontFamily: "'Impact', 'Arial Narrow', sans-serif",
            fontSize: '22px', fill: '#ffd700',
            stroke: '#000000', strokeThickness: 5,
            shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 3, fill: true }
        }).setOrigin(0.5).setDepth(3);
        this.wallsGroup.add(wall);
        return wall;
    }

    getWallDims(type) {
        if (type === 'block')    return { w: 75,  h: 75  };
        if (type === 'vertical') return { w: 60,  h: 180 };
        return                          { w: 180, h: 60  };
    }

    // ──── Helpers ────

    showFloatingText(x, y, text) {
        const t = this.add.text(x, y, text, {
            fontSize: '26px', fill: '#ffff00', fontStyle: 'bold',
            stroke: '#aa5500', strokeThickness: 5
        }).setOrigin(0.5).setDepth(20);
        this.tweens.add({
            targets: t, y: y - 55, duration: 850, ease: 'Power1',
            onComplete: () => {
                if (t && t.active)
                    this.tweens.add({ targets: t, y: '-=25', alpha: 0, duration: 500, ease: 'Power2', onComplete: () => t.destroy() });
            }
        });
    }

    showError(msg) {
        this.playSound('error');
        this.errorText.setText(msg).setAlpha(1);
        this.tweens.killTweensOf(this.errorText);
        this.tweens.add({ targets: this.errorText, alpha: 0, delay: 900, duration: 350 });
    }

    checkPlacementValid(cx, cy, w, h, type) {
        let ballTooClose = false;
        this.ballsGroup.children.iterate(ball => {
            if (ballTooClose || !ball) return;
            const bx = Phaser.Math.Clamp(ball.x, cx-w/2, cx+w/2);
            const by = Phaser.Math.Clamp(ball.y, cy-h/2, cy+h/2);
            if ((ball.x-bx)**2+(ball.y-by)**2 < 26*26) ballTooClose = true;
        });
        if (ballTooClose) return { ok: false, reason: 'Нельзя! Рядом мяч' };
        let diffBlocked = false, mergeTarget = null;
        this.wallsGroup.children.iterate(e => {
            if (!e) return;
            const ex1=e.x-e.width/2, ex2=e.x+e.width/2, ey1=e.y-e.height/2, ey2=e.y+e.height/2;
            if ((cx-w/2)<ex2&&(cx+w/2)>ex1&&(cy-h/2)<ey2&&(cy+h/2)>ey1) {
                if (e.wallType===type && !mergeTarget) mergeTarget=e;
                else if (e.wallType!==type) diffBlocked=true;
            }
        });
        if (diffBlocked) return { ok: false, reason: 'Нельзя! Мешает другая стена' };
        return { ok: true, mergeTarget };
    }

    // ──── UI ────

    createUI() {
        // progress bar graphics (drawn each updateUI call)
        this._progressGfx = this.add.graphics();

        // top bar — goal left, money right, mute far right
        this.goalText   = this.add.text(12,  7, '', { fontSize: '15px', fill: '#334466', fontStyle: 'bold' });
        this.moneyText  = this.add.text(700, 7, '', { fontSize: '18px', fill: '#aa7700', fontStyle: 'bold' }).setOrigin(1, 0);
        this.incomeText = this.add.text(380, 44, '', { fontSize: '11px', fill: '#1a6633' }).setOrigin(0.5, 1);

        this.muteBtn = this.add.text(750, 26, '🔊', { fontSize: '20px' })
            .setOrigin(1, 0.5).setInteractive({ useHandCursor: true }).setDepth(10);
        this.muteBtn.on('pointerover', () => this.playSound('hover'));
        this.muteBtn.on('pointerdown', () => this.toggleMute());

        // hand strip (below field)
        this.add.text(380, 701, 'РУКА', { fontSize: '11px', fill: '#6677aa', fontStyle: 'bold' }).setOrigin(0.5, 1);
        this.returnZoneBg = this.add.rectangle(380, this.slotY, 640, 88, 0xf0f5ff).setStrokeStyle(1, 0x8899cc);

        this.wallSlots = [];
        this.buildSlotUIs();

        // upgrades strip (bottom)
        this.add.text(380, 796, 'УЛУЧШЕНИЯ', { fontSize: '11px', fill: '#6677aa', fontStyle: 'bold' }).setOrigin(0.5, 1);
        this.add.rectangle(380, this.btnY, 640, 62, 0xf0f5ff).setStrokeStyle(1, 0x8899cc);

        const bx = [167, 380, 593];
        this.buttonBall     = this.createButton(bx[0], this.btnY, '🟠', 'Купить шар',  this.ballCost,     () => this.buyBall());
        this.buttonWallPack = this.createButton(bx[1], this.btnY, '🧱', 'Стены ×3',    this.wallPackCost,  () => this.buyWallPack());
        this.buttonIncome   = this.createButton(bx[2], this.btnY, '⚡', 'Прокачать',   this.incomeCost,    () => this.buyIncomeUpgrade());

        this.errorText = this.add.text(this.fieldCX, this.fieldCY, '', {
            fontSize: '20px', fill: '#cc2222', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30).setAlpha(0);
    }

    buildSlotUIs() {
        for (let i = 0; i < 3; i++) {
            const cx = Math.round(this.fieldOffsetX + (i + 0.5) * (this.fieldSize / 3));
            const cy = this.slotY;
            const bg  = this.add.rectangle(cx, cy, 200, 80, 0xe0eaff).setStrokeStyle(1, 0x8899cc).setInteractive({ cursor: 'pointer' });
            const gfx = this.add.graphics().setDepth(2);
            const idx = i;
            bg.on('pointerdown', ptr => this.startWallDragFromSlot(ptr, idx));
            bg.on('pointerover',  () => { this.playSound('hover'); if (idx < this.wallHand.length) bg.setStrokeStyle(2, 0x5577ff); });
            bg.on('pointerout',   () => { if (idx < this.wallHand.length) bg.setStrokeStyle(1, 0x8899cc); });
            this.wallSlots.push({ bg, gfx, cx, cy });
        }
        this.updateSlotsUI();
    }

    updateSlotsUI() {
        this.wallSlots.forEach((slot, i) => {
            slot.gfx.clear();
            if (i < this.wallHand.length) {
                const item = this.wallHand[i];
                slot.bg.setFillStyle(0xe0eaff).setStrokeStyle(1, 0x8899cc).setAlpha(1).setInteractive({ cursor: 'pointer' });
                const {w, h} = this.getWallDims(item.type);
                const scale = Math.min(190/w, 70/h);
                const dw = w*scale, dh = h*scale;
                const x0 = slot.cx - dw/2, y0 = slot.cy - dh/2;
                const cs = 10;
                for (let c = 0; c*cs < dw; c++) {
                    for (let r = 0; r*cs < dh; r++) {
                        slot.gfx.fillStyle((c+r)%2===0 ? 0xffcc00 : 0xff8800, 1);
                        slot.gfx.fillRect(x0+c*cs, y0+r*cs, Math.min(cs, dw-c*cs), Math.min(cs, dh-r*cs));
                    }
                }
                slot.gfx.lineStyle(2, 0xcc5500, 1);
                slot.gfx.strokeRect(x0, y0, dw, dh);
            } else {
                slot.bg.setFillStyle(0xd0d8ec).setStrokeStyle(1, 0xaabbcc).setAlpha(0.6).disableInteractive();
            }
        });
    }

    createButton(cx, cy, emoji, label, initCost, callback) {
        const w = 200, h = 50;
        const bg    = this.add.rectangle(cx, cy, w, h, 0x3366cc).setStrokeStyle(2, 0x7799dd).setInteractive({ useHandCursor: true });
        const emTxt = this.add.text(cx-w/2+10, cy,     emoji,          { fontSize: '20px' }).setOrigin(0, 0.5);
        const lbTxt = this.add.text(cx-w/2+40, cy-9,   label,          { fontSize: '13px', fill: '#ffffff' }).setOrigin(0, 0.5);
        const ctTxt = this.add.text(cx-w/2+40, cy+10,  `$${initCost}`, { fontSize: '12px', fill: '#ffdd88' }).setOrigin(0, 0.5);
        bg.on('pointerover',  () => { this.playSound('hover'); bg.setStrokeStyle(2, 0xaaccff); });
        bg.on('pointerout',   () => bg.setStrokeStyle(2, 0x7799dd));
        bg.on('pointerdown',  callback);
        return { bg, emTxt, lbTxt, ctTxt };
    }

    // ──── Input ────

    setupInput() {
        const _inField = (px, py) =>
            px >= this.fieldOffsetX && px <= this.fieldOffsetX+this.fieldSize &&
            py >= this.fieldOffsetY && py <= this.fieldOffsetY+this.fieldSize;

        this.input.on('pointermove', pointer => {
            if (!this.draggingNewWall || !this.wallPreview) return;
            this.wallPreview.setPosition(pointer.x, pointer.y);
            if (_inField(pointer.x, pointer.y)) {
                const {w,h} = this.getWallDims(this.draggingWallType);
                const cx = Phaser.Math.Clamp(pointer.x, this.fieldOffsetX+w/2, this.fieldOffsetX+this.fieldSize-w/2);
                const cy = Phaser.Math.Clamp(pointer.y, this.fieldOffsetY+h/2, this.fieldOffsetY+this.fieldSize-h/2);
                const chk = this.checkPlacementValid(cx, cy, w, h, this.draggingWallType);
                if (chk.ok && chk.mergeTarget) { this.wallPreview.setFillStyle(0x886600,0.85); this.wallPreview.setStrokeStyle(3,0xffdd00); }
                else if (chk.ok)               { this.wallPreview.setFillStyle(0x006633,0.85); this.wallPreview.setStrokeStyle(3,0x44ff88); }
                else                           { this.wallPreview.setFillStyle(0x660000,0.85); this.wallPreview.setStrokeStyle(3,0xff4444); }
            } else {
                this.wallPreview.setFillStyle(0x88cc88, 0.7); this.wallPreview.setStrokeStyle(2, 0xffffff);
            }
        });

        this.input.on('pointerup', pointer => {
            if (this.draggingNewWall && this.wallPreview) {
                if (_inField(pointer.x, pointer.y)) this.placeWall(pointer.x, pointer.y);
                this.wallPreview.destroy(); this.wallPreview = null;
                this.draggingNewWall = false; this.updateUI();
            }
        });

        this.input.on('dragstart', (pointer, obj) => {
            if (!obj.isWall) return;
            obj._originX = obj.x; obj._originY = obj.y;
            obj.clearTint();
            this.wallsGroup.remove(obj);
            if (this.wallHand.length < 3) this.returnZoneBg.setFillStyle(0xffd8cc).setStrokeStyle(2, 0xff6644);
        });

        this.input.on('drag', (pointer, obj, dragX, dragY) => {
            if (!obj.isWall) return;
            obj.setPosition(dragX, dragY);
            if (obj.valueText) obj.valueText.setPosition(dragX, dragY);
            if (_inField(dragX, dragY)) {
                const hw=obj.width/2, hh=obj.height/2;
                const cx=Phaser.Math.Clamp(dragX, this.fieldOffsetX+hw, this.fieldOffsetX+this.fieldSize-hw);
                const cy=Phaser.Math.Clamp(dragY, this.fieldOffsetY+hh, this.fieldOffsetY+this.fieldSize-hh);
                const chk = this.checkPlacementValid(cx, cy, obj.width, obj.height, obj.wallType);
                if (chk.ok && chk.mergeTarget) obj.setTint(0xffee00);
                else if (chk.ok)               obj.setTint(0x88ff88);
                else                           obj.setTint(0xff5555);
            } else {
                obj.clearTint();
            }
        });

        this.input.on('dragend', (pointer, obj) => {
            if (!obj.isWall) return;
            obj.clearTint();
            this.returnZoneBg.setFillStyle(0xf0f5ff).setStrokeStyle(1, 0x8899cc);

            if (!_inField(pointer.x, pointer.y) && this.wallHand.length < 3) {
                this.wallHand.push({ type: obj.wallType, incomeValue: obj.incomeValue });
                if (obj.valueText) obj.valueText.destroy(); obj.destroy();
                this.placedWalls--; this.playSound('return'); this.updateSlotsUI(); this.updateUI(); return;
            }

            let merged = false;
            this.wallsGroup.children.iterate(other => {
                if (merged||!other||other.wallType!==obj.wallType) return;
                const ex1=other.x-other.width/2, ex2=other.x+other.width/2;
                const ey1=other.y-other.height/2, ey2=other.y+other.height/2;
                const gx1=obj.x-obj.width/2, gx2=obj.x+obj.width/2;
                const gy1=obj.y-obj.height/2, gy2=obj.y+obj.height/2;
                if (gx1<ex2&&gx2>ex1&&gy1<ey2&&gy2>ey1) {
                    other.incomeValue += obj.incomeValue;
                    if (other.valueText) other.valueText.setText(`$${other.incomeValue}`);
                    this.tweens.add({ targets:other, alpha:0.15, duration:80, yoyo:true });
                    if (obj.valueText) obj.valueText.destroy(); obj.destroy();
                    this.placedWalls--; this.playSound('merge'); merged = true;
                }
            });

            if (!merged) {
                const hw=obj.width/2, hh=obj.height/2;
                const cx=Phaser.Math.Clamp(obj.x, this.fieldOffsetX+hw, this.fieldOffsetX+this.fieldSize-hw);
                const cy=Phaser.Math.Clamp(obj.y, this.fieldOffsetY+hh, this.fieldOffsetY+this.fieldSize-hh);
                let blocked = false;
                this.wallsGroup.children.iterate(o2 => {
                    if (blocked||!o2) return;
                    if ((cx-hw)<o2.x+o2.width/2&&(cx+hw)>o2.x-o2.width/2&&
                        (cy-hh)<o2.y+o2.height/2&&(cy+hh)>o2.y-o2.height/2) blocked=true;
                });
                const fx=blocked?obj._originX:cx, fy=blocked?obj._originY:cy;
                obj.setPosition(fx, fy); if (obj.valueText) obj.valueText.setPosition(fx, fy);
                this.wallsGroup.add(obj); obj.body.updateFromGameObject();
            }
            this.updateUI();
        });
    }

    startWallDragFromSlot(pointer, slotIndex) {
        if (slotIndex >= this.wallHand.length || this.draggingNewWall) return;
        this.draggingNewWall = true; this.draggingSlotIndex = slotIndex;
        const item = this.wallHand[slotIndex];
        this.draggingWallType = item.type; this.draggingIncomeValue = item.incomeValue;
        const {w, h} = this.getWallDims(item.type);
        this.wallPreview = this.add.rectangle(pointer.x, pointer.y, w, h, 0x88cc88, 0.7)
            .setStrokeStyle(2, 0xffffff).setDepth(10);
    }

    placeWall(x, y) {
        const type = this.draggingWallType;
        const {w, h} = this.getWallDims(type);
        const fo=this.fieldOffsetX, fy=this.fieldOffsetY, fs=this.fieldSize;
        const cx = Phaser.Math.Clamp(x, fo+w/2, fo+fs-w/2);
        const cy = Phaser.Math.Clamp(y, fy+h/2, fy+fs-h/2);
        const chk = this.checkPlacementValid(cx, cy, w, h, type);
        if (!chk.ok) { this.showError(chk.reason); return; }
        if (chk.mergeTarget) {
            const tgt = chk.mergeTarget; tgt.incomeValue += this.draggingIncomeValue;
            if (tgt.valueText) tgt.valueText.setText(`$${tgt.incomeValue}`);
            this.tweens.add({ targets:tgt, alpha:0.15, duration:80, yoyo:true });
            this.playSound('merge');
        } else {
            this.createWall(cx, cy, w, h, type, this.draggingIncomeValue);
            this.placedWalls++; this.playSound('place');
        }
        this.wallHand.splice(this.draggingSlotIndex, 1);
        this.updateSlotsUI();
    }

    // ──── Purchases ────

    buyBall() {
        if (this.money < this.ballCost) return;
        this.money -= this.ballCost;
        this.ballCost = Math.round(this.ballCost * 1.4);
        this.playSound('buy'); this.createBall(); this.updateUI();
    }

    buyWallPack() {
        if (this.money < this.wallPackCost) return;
        this.money -= this.wallPackCost; this.playSound('buy');
        this.wallHand = [];
        const types = ['horizontal','vertical','block'];
        for (let i=0;i<3;i++) this.wallHand.push({ type:Phaser.Math.RND.pick(types), incomeValue:this.incomeBase });
        this.wallPackCost = Math.round(this.wallPackCost * 1.4);
        this.updateSlotsUI(); this.updateUI();
    }

    buyIncomeUpgrade() {
        if (this.money < this.incomeCost) return;
        this.money -= this.incomeCost; this.playSound('buy');
        const boost = this.incomeBase;
        this.wallsGroup.children.iterate(wall => {
            if (!wall) return; wall.incomeValue += boost;
            if (wall.valueText) wall.valueText.setText(`$${wall.incomeValue}`);
        });
        this.wallHand.forEach(item => { item.incomeValue += boost; });
        this.incomeCost = Math.round(this.incomeCost * 1.4);
        this.updateSlotsUI(); this.updateUI();
    }

    // ──── Physics ────

    update() {
        const r = 18;
        const minX=this.fieldOffsetX+r,  maxX=this.fieldOffsetX+this.fieldSize-r;
        const minY=this.fieldOffsetY+r,  maxY=this.fieldOffsetY+this.fieldSize-r;

        this._trailGraphics.clear();

        this.ballsGroup.children.iterate(ball => {
            if (!ball || !ball.body) return;
            if (!ball.currentSpeed) ball.currentSpeed = ball.bounceSpeed;

            // trail
            if (!ball._trail) ball._trail = [];
            ball._trail.push({ x: ball.x, y: ball.y });
            if (ball._trail.length > 18) ball._trail.shift();
            ball._trail.forEach((pt, i) => {
                const ratio = (i+1) / ball._trail.length;
                this._trailGraphics.fillStyle(0x999999, ratio*0.5);
                this._trailGraphics.fillCircle(pt.x, pt.y, r*ratio*0.55);
            });

            // boundaries
            const _snd = () => { const now=this.time.now; if(now-this._lastHitSound>80){this._lastHitSound=now;this.playSound('hit');} };
            if (ball.x < minX) {
                ball.setX(minX); ball.body.setVelocityX(Math.abs(ball.body.velocity.x));
                ball.currentSpeed=Math.min(ball.currentSpeed*1.1,ball.bounceSpeed*2.0);
                this._squishBall(ball,0.55,1.45); _snd();
            } else if (ball.x > maxX) {
                ball.setX(maxX); ball.body.setVelocityX(-Math.abs(ball.body.velocity.x));
                ball.currentSpeed=Math.min(ball.currentSpeed*1.1,ball.bounceSpeed*2.0);
                this._squishBall(ball,0.55,1.45); _snd();
            }
            if (ball.y < minY) {
                ball.setY(minY); ball.body.setVelocityY(Math.abs(ball.body.velocity.y));
                ball.currentSpeed=Math.min(ball.currentSpeed*1.1,ball.bounceSpeed*2.0);
                this._squishBall(ball,1.45,0.55); _snd();
            } else if (ball.y > maxY) {
                ball.setY(maxY); ball.body.setVelocityY(-Math.abs(ball.body.velocity.y));
                ball.currentSpeed=Math.min(ball.currentSpeed*1.1,ball.bounceSpeed*2.0);
                this._squishBall(ball,1.45,0.55); _snd();
            }

            // wall collision
            this.wallsGroup.children.iterate(wall => {
                if (!wall) return;
                const hw=wall.width/2, hh=wall.height/2;
                const cx=Phaser.Math.Clamp(ball.x, wall.x-hw, wall.x+hw);
                const cy=Phaser.Math.Clamp(ball.y, wall.y-hh, wall.y+hh);
                const dx=ball.x-cx, dy=ball.y-cy, distSq=dx*dx+dy*dy;
                if (distSq >= r*r) return;
                const dist=distSq>0?Math.sqrt(distSq):0;
                const nx=dist>0?dx/dist:0, ny=dist>0?dy/dist:-1;
                ball.setPosition(ball.x+nx*(r-dist), ball.y+ny*(r-dist));
                const vel=ball.body.velocity, dot=vel.x*nx+vel.y*ny;
                if (dot < 0) {
                    ball.body.setVelocity(vel.x-2*dot*nx, vel.y-2*dot*ny);
                    const isH=Math.abs(ny)>Math.abs(nx);
                    this._squishBall(ball, isH?1.45:0.55, isH?0.55:1.45);
                }
                const now=this.time.now;
                if (now-(wall.lastHit||0) >= 35) {
                    wall.lastHit=now; this.money+=wall.incomeValue;
                    ball.currentSpeed=Math.min(ball.currentSpeed*1.35,ball.bounceSpeed*2.0);
                    if (now-this._lastHitSound>80){this._lastHitSound=now;this.playSound('wallhit');}
                    this.updateUI();
                }
                if (now-(wall.lastFloat||0) >= 180) {
                    wall.lastFloat=now;
                    this.showFloatingText(ball.x, ball.y-28, `+$${wall.incomeValue}`);
                }
            });

            // decay
            if (ball.currentSpeed > ball.bounceSpeed)
                ball.currentSpeed = Math.max(ball.currentSpeed*0.985, ball.bounceSpeed);
            const vel=ball.body.velocity, spd=Math.sqrt(vel.x*vel.x+vel.y*vel.y);
            if (spd > 0) ball.body.setVelocity(vel.x/spd*ball.currentSpeed, vel.y/spd*ball.currentSpeed);

            if (ball.body.speed < 1) {
                ball.currentSpeed = ball.bounceSpeed;
                const a=Phaser.Math.DegToRad(Phaser.Math.Between(25,65));
                const sx=Phaser.Math.RND.pick([-1,1]), sy=Phaser.Math.RND.pick([-1,1]);
                ball.body.setVelocity(sx*Math.cos(a)*ball.bounceSpeed, sy*Math.sin(a)*ball.bounceSpeed);
            }
        });
    }

    // ──── UI update ────

    updateUI() {
        this.moneyText.setText(`$ ${this.money.toLocaleString()}`);
        this.goalText.setText(`🏆 ${this.targetMoney.toLocaleString()}`);
        this.incomeText.setText(`Прокачка: +${this.incomeBase} ко всем стенам`);

        // progress bar
        const ratio = Math.min(1, this.money / this.targetMoney);
        const bx=200, by=13, bw=355, bh=14;
        this._progressGfx.clear();
        this._progressGfx.fillStyle(0xb0c0cc); this._progressGfx.fillRect(bx, by, bw, bh);
        const fc = ratio<0.5 ? 0x44cc77 : ratio<0.85 ? 0xccaa22 : 0xee4422;
        this._progressGfx.fillStyle(fc); this._progressGfx.fillRect(bx, by, Math.max(4, bw*ratio), bh);
        this._progressGfx.lineStyle(1, 0x778899); this._progressGfx.strokeRect(bx, by, bw, bh);

        this.updateButton(this.buttonBall, this.ballCost);
        this.updateButton(this.buttonWallPack, this.wallPackCost);
        this.updateButton(this.buttonIncome, this.incomeCost);
        if (this.money >= this.targetMoney && !this.gameWon) this.winGame();
    }

    updateButton(button, cost) {
        const ok = this.money >= cost;
        button.bg.fillColor = ok ? 0x3366cc : 0x7788aa;
        button.lbTxt.setColor(ok ? '#ffffff' : '#aabbcc');
        button.emTxt.setAlpha(ok ? 1 : 0.5);
        button.ctTxt.setText(`$${cost.toLocaleString()}`).setColor(ok ? '#ffdd88' : '#889977');
    }

    winGame() {
        this.gameWon = true; this.playSound('buy');
        this.add.rectangle(this.fieldCX, this.fieldCY, 440, 130, 0xfffff0).setStrokeStyle(3, 0xddcc00).setDepth(25);
        this.add.text(this.fieldCX, this.fieldCY-28, 'Уровень пройден!',
            { fontSize: '34px', fill: '#aa8800', fontStyle: 'bold' }).setOrigin(0.5).setDepth(26);
        this.add.text(this.fieldCX, this.fieldCY+18, `Заработано $${this.targetMoney.toLocaleString()}`,
            { fontSize: '20px', fill: '#445566' }).setOrigin(0.5).setDepth(26);
    }
}

const config = {
    type: Phaser.AUTO,
    width: 760, height: 870,
    backgroundColor: '#ccdae8',
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 760,
        height: 870,
    },
    input: {
        activePointers: 3,
    },
    scene: [MainScene],
    physics: { default: 'arcade', arcade: { gravity: { y: 0 }, debug: false } },
};
new Phaser.Game(config);
