class HandwritingRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.options = {
            text: '',
            fontFamily: '"KaiTi", "STKaiti", "楷体", serif',
            styleName: 'kaishu',
            fontSize: 32,
            charSpacing: 2,
            lineHeight: 1.8,
            slantAngle: 0,
            inkDensity: 80,
            randomOffset: 3,
            strokeNoise: 30,
            pageWidth: 800,
            pageHeight: 1150,
            padding: 60,
            paperColor: '#faf8f0',
            inkColor: '#2c2c2c',
            weight: 'normal',
            useMultilingual: true
        };
        this.pages = [];
        this.currentPage = 0;
        this.seed = Math.random();
        this._textLinesCache = null;
        this._cacheKey = '';
        this._lineMetricsCache = null;
    }

    setOptions(options) {
        Object.assign(this.options, options);
        this.seed = Math.random();
        this._textLinesCache = null;
        this._cacheKey = '';
        this._lineMetricsCache = null;
        PaperEffects.clearCache();
    }

    seededRandom(seed) {
        return TextEffects.seededRandom(seed);
    }

    hexToRgb(hex) {
        return TextEffects.hexToRgb(hex);
    }

    splitTextIntoLines(text, maxWidth, ctx) {
        const cacheKey = `${text}_${maxWidth}_${this.options.fontFamily}_${this.options.fontSize}_${this.options.charSpacing}_${this.options.weight}_${this.options.styleName}_${this.options.useMultilingual}`;
        
        if (this._textLinesCache && this._cacheKey === cacheKey) {
            return this._textLinesCache;
        }

        if (!this.options.useMultilingual || typeof MultilingualProcessor === 'undefined') {
            const lines = this._splitTextSimple(text, maxWidth, ctx);
            this._textLinesCache = lines;
            this._cacheKey = cacheKey;
            return lines;
        }

        const lines = this._splitTextMultilingual(text, maxWidth, ctx);
        this._textLinesCache = lines;
        this._cacheKey = cacheKey;
        
        return lines;
    }

    _splitTextSimple(text, maxWidth, ctx) {
        const paragraphs = text.split('\n');
        const lines = [];
        
        ctx.font = `${this.options.weight} ${this.options.fontSize}px ${this.options.fontFamily}`;
        
        for (const paragraph of paragraphs) {
            if (paragraph === '') {
                lines.push({ segments: [], text: '', isMultilingual: false });
                continue;
            }
            
            let currentLine = '';
            let currentWidth = 0;
            
            for (let i = 0; i < paragraph.length; i++) {
                const char = paragraph[i];
                const charWidth = ctx.measureText(char).width + this.options.charSpacing;
                
                if (currentWidth + charWidth > maxWidth && currentLine !== '') {
                    lines.push({ segments: [{ text: currentLine, language: 'chinese' }], text: currentLine, isMultilingual: false });
                    currentLine = char;
                    currentWidth = charWidth;
                } else {
                    currentLine += char;
                    currentWidth += charWidth;
                }
            }
            
            if (currentLine !== '') {
                lines.push({ segments: [{ text: currentLine, language: 'chinese' }], text: currentLine, isMultilingual: false });
            }
        }
        
        return lines;
    }

    _splitTextMultilingual(text, maxWidth, ctx) {
        const allSegments = MultilingualProcessor.segmentText(text);
        const lines = [];
        let currentLineSegments = [];
        let currentLineWidth = 0;
        let currentLineText = '';
        let hasContent = false;

        for (const segment of allSegments) {
            if (segment.language === 'newline') {
                lines.push({
                    segments: currentLineSegments,
                    text: currentLineText,
                    isMultilingual: true,
                    lineMetrics: null
                });
                currentLineSegments = [];
                currentLineWidth = 0;
                currentLineText = '';
                hasContent = false;
                continue;
            }

            const segmentMetrics = MultilingualProcessor.measureSegment(
                ctx, segment, this.options.fontSize, this.options.charSpacing, this.options.styleName
            );

            if (currentLineWidth + segmentMetrics.width > maxWidth && hasContent) {
                lines.push({
                    segments: currentLineSegments,
                    text: currentLineText,
                    isMultilingual: true,
                    lineMetrics: null
                });
                currentLineSegments = [{ ...segment, metrics: segmentMetrics }];
                currentLineWidth = segmentMetrics.width;
                currentLineText = segment.text;
            } else {
                currentLineSegments.push({ ...segment, metrics: segmentMetrics });
                currentLineWidth += segmentMetrics.width;
                currentLineText += segment.text;
                hasContent = true;
            }
        }

        if (currentLineSegments.length > 0 || !hasContent) {
            lines.push({
                segments: currentLineSegments,
                text: currentLineText,
                isMultilingual: true,
                lineMetrics: null
            });
        }

        for (const line of lines) {
            if (line.segments.length > 0) {
                line.lineMetrics = this._calculateLineMetrics(line.segments, ctx);
            } else {
                line.lineMetrics = {
                    maxAscent: this.options.fontSize * 0.8,
                    maxDescent: this.options.fontSize * 0.2,
                    totalHeight: this.options.fontSize,
                    totalWidth: 0,
                    segmentMetrics: []
                };
            }
        }

        return lines;
    }

    _calculateLineMetrics(segmentsWithMetrics, ctx) {
        const { fontSize, styleName, charSpacing } = this.options;
        let maxAscent = 0;
        let maxDescent = 0;
        let totalWidth = 0;

        for (const seg of segmentsWithMetrics) {
            const metrics = seg.metrics || MultilingualProcessor.measureSegment(
                ctx, seg, fontSize, charSpacing, styleName
            );
            
            const effectiveAscent = metrics.ascent - metrics.baselineOffset;
            const effectiveDescent = metrics.descent + metrics.baselineOffset;
            
            maxAscent = Math.max(maxAscent, effectiveAscent);
            maxDescent = Math.max(maxDescent, effectiveDescent);
            totalWidth += metrics.width;
        }

        return {
            maxAscent,
            maxDescent,
            totalHeight: maxAscent + maxDescent,
            totalWidth,
            segmentMetrics: segmentsWithMetrics.map(s => ({
                segment: s,
                metrics: s.metrics
            }))
        };
    }

    calculatePages() {
        const { pageWidth, pageHeight, padding, lineHeight, fontSize, useMultilingual } = this.options;
        const contentWidth = pageWidth - padding * 2;
        const contentHeight = pageHeight - padding * 2;
        const defaultLineHeightPx = fontSize * lineHeight;
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        const lines = this.splitTextIntoLines(this.options.text, contentWidth, tempCtx);
        
        if (!useMultilingual || typeof MultilingualProcessor === 'undefined') {
            const linesPerPage = Math.floor(contentHeight / defaultLineHeightPx);
            const pages = [];
            for (let i = 0; i < lines.length; i += linesPerPage) {
                pages.push(lines.slice(i, i + linesPerPage));
            }
            if (pages.length === 0) {
                pages.push([]);
            }
            return pages;
        }
        
        const pages = [];
        let currentPageLines = [];
        let currentPageHeight = 0;
        
        for (const line of lines) {
            const lineMetrics = line.lineMetrics || { totalHeight: defaultLineHeightPx };
            const lineActualHeight = Math.max(lineMetrics.totalHeight * lineHeight, defaultLineHeightPx);
            
            if (currentPageHeight + lineActualHeight > contentHeight && currentPageLines.length > 0) {
                pages.push(currentPageLines);
                currentPageLines = [line];
                currentPageHeight = lineActualHeight;
            } else {
                currentPageLines.push(line);
                currentPageHeight += lineActualHeight;
            }
        }
        
        if (currentPageLines.length > 0 || pages.length === 0) {
            pages.push(currentPageLines);
        }
        
        return pages;
    }

    renderPage(pageIndex) {
        const { pageWidth, pageHeight, padding, fontSize, lineHeight, charSpacing,
                paperColor, inkColor, fontFamily, weight, slantAngle, inkDensity,
                randomOffset, strokeNoise, styleName, useMultilingual } = this.options;
        
        this.canvas.width = pageWidth;
        this.canvas.height = pageHeight;
        
        const ctx = this.ctx;
        
        PaperEffects.addPaperTexture(ctx, pageWidth, pageHeight, paperColor, this.seed);
        PaperEffects.addPaperFiberEffect(ctx, pageWidth, pageHeight, paperColor, this.seed);
        
        const pages = this.calculatePages();
        this.pages = pages;
        
        if (pageIndex >= pages.length) {
            pageIndex = pages.length - 1;
        }
        this.currentPage = pageIndex;
        
        const pageLines = pages[pageIndex];
        const defaultLineHeightPx = fontSize * lineHeight;
        const startY = padding;
        
        let charIndexOffset = 0;
        for (let i = 0; i < pageIndex; i++) {
            charIndexOffset += pages[i].reduce((sum, line) => sum + this._getLineCharCount(line), 0);
        }
        
        let charCount = 0;
        let currentY = startY;
        
        if (useMultilingual && typeof MultilingualProcessor !== 'undefined') {
            for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
                const line = pageLines[lineIndex];
                const lineMetrics = line.lineMetrics || { totalHeight: fontSize, maxAscent: fontSize * 0.8 };
                const lineActualHeight = Math.max(lineMetrics.totalHeight * lineHeight, defaultLineHeightPx);
                
                const baselineY = currentY + lineMetrics.maxAscent;
                let x = padding;
                
                if (line.segments && line.segments.length > 0) {
                    for (const segment of line.segments) {
                        const segMetrics = segment.metrics || MultilingualProcessor.measureSegment(
                            ctx, segment, fontSize, charSpacing, styleName
                        );
                        
                        const baselineAdjust = MultilingualProcessor.getBaselineAdjustment(
                            { metrics: segMetrics },
                            lineMetrics.maxAscent
                        );
                        
                        const segY = baselineY + baselineAdjust - segMetrics.ascent + segMetrics.baselineOffset;
                        
                        charCount = this._drawSegment(ctx, segment, x, segY, {
                            charIndexOffset,
                            charCount,
                            lineIndex,
                            fontSize,
                            charSpacing,
                            slantAngle,
                            inkColor,
                            inkDensity,
                            randomOffset,
                            strokeNoise,
                            styleName
                        });
                        
                        x += segMetrics.width;
                    }
                }
                
                currentY += lineActualHeight;
            }
        } else {
            ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
            
            for (let lineIndex = 0; lineIndex < pageLines.length; lineIndex++) {
                const line = pageLines[lineIndex];
                const lineText = line.text || '';
                const y = startY + lineIndex * defaultLineHeightPx;
                let x = padding;
                
                for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
                    const char = lineText[charIndex];
                    const globalCharIndex = charIndexOffset + charCount;
                    
                    TextEffects.drawChar(ctx, char, x, y, {
                        charIndex: globalCharIndex,
                        lineIndex,
                        seed: this.seed,
                        fontSize,
                        fontFamily,
                        weight,
                        slantAngle,
                        inkColor,
                        inkDensity,
                        randomOffset,
                        strokeNoise
                    });
                    
                    const charWidth = ctx.measureText(char).width + charSpacing;
                    x += charWidth;
                    charCount++;
                }
            }
        }
        
        return pages.length;
    }

    _getLineCharCount(line) {
        if (line.segments) {
            return line.segments.reduce((sum, seg) => sum + seg.text.length, 0);
        }
        return (line.text || '').length;
    }

    _drawSegment(ctx, segment, x, y, options) {
        const { charIndexOffset, charCount, lineIndex, fontSize, charSpacing,
                slantAngle, inkColor, inkDensity, randomOffset, strokeNoise, styleName } = options;
        
        const fontConfig = MultilingualProcessor.getFontConfig(segment.language, styleName);
        const actualFontSize = fontSize * fontConfig.fontSizeScale;
        
        let currentX = x;
        let currentCharCount = charCount;
        
        for (let i = 0; i < segment.text.length; i++) {
            const char = segment.text[i];
            const globalCharIndex = charIndexOffset + currentCharCount;
            
            TextEffects.drawChar(ctx, char, currentX, y, {
                charIndex: globalCharIndex,
                lineIndex,
                seed: this.seed,
                fontSize: actualFontSize,
                fontFamily: fontConfig.fontFamily,
                weight: fontConfig.weight,
                slantAngle,
                inkColor,
                inkDensity,
                randomOffset,
                strokeNoise
            });
            
            ctx.font = `${fontConfig.weight} ${actualFontSize}px ${fontConfig.fontFamily}`;
            const charWidth = ctx.measureText(char).width + charSpacing;
            currentX += charWidth;
            currentCharCount++;
        }
        
        return currentCharCount;
    }

    generateAllPages() {
        const pages = this.calculatePages();
        const canvases = [];
        
        const originalCanvas = this.canvas;
        const originalCtx = this.ctx;
        
        for (let i = 0; i < pages.length; i++) {
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            canvases.push(canvas);
        }
        
        this.canvas = originalCanvas;
        this.ctx = originalCtx;
        
        return canvases;
    }

    exportPageAsPNG(pageIndex = this.currentPage) {
        this.renderPage(pageIndex);
        return this.canvas.toDataURL('image/png');
    }

    exportAllPagesAsPNG() {
        const canvases = this.generateAllPages();
        return canvases.map(canvas => canvas.toDataURL('image/png'));
    }

    async exportAllPagesAsync(progressCallback = null) {
        const pages = this.calculatePages();
        const results = [];
        
        for (let i = 0; i < pages.length; i++) {
            if (progressCallback) {
                progressCallback(Math.round(((i + 1) / pages.length) * 100), `正在渲染第 ${i + 1}/${pages.length} 页...`);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            const originalCanvas = this.canvas;
            const originalCtx = this.ctx;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            this.canvas = originalCanvas;
            this.ctx = originalCtx;
            
            results.push(canvas.toDataURL('image/png'));
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        return results;
    }

    exportLongImage() {
        const canvases = this.generateAllPages();
        const width = this.options.pageWidth;
        const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
        
        const longCanvas = document.createElement('canvas');
        longCanvas.width = width;
        longCanvas.height = totalHeight;
        
        const ctx = longCanvas.getContext('2d');
        
        let y = 0;
        for (const canvas of canvases) {
            ctx.drawImage(canvas, 0, y);
            y += canvas.height;
        }
        
        return longCanvas.toDataURL('image/png');
    }

    async exportLongImageAsync(progressCallback = null) {
        const pages = this.calculatePages();
        const canvases = [];
        
        for (let i = 0; i < pages.length; i++) {
            if (progressCallback) {
                progressCallback(Math.round(((i + 1) / pages.length) * 80), `正在渲染第 ${i + 1}/${pages.length} 页...`);
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = this.options.pageWidth;
            canvas.height = this.options.pageHeight;
            
            const originalCanvas = this.canvas;
            const originalCtx = this.ctx;
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            
            this.renderPage(i);
            
            this.canvas = originalCanvas;
            this.ctx = originalCtx;
            
            canvases.push(canvas);
            
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        if (progressCallback) {
            progressCallback(85, '正在拼接长图...');
        }
        
        const width = this.options.pageWidth;
        const totalHeight = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
        
        const longCanvas = document.createElement('canvas');
        longCanvas.width = width;
        longCanvas.height = totalHeight;
        
        const ctx = longCanvas.getContext('2d');
        
        let y = 0;
        for (const canvas of canvases) {
            ctx.drawImage(canvas, 0, y);
            y += canvas.height;
        }
        
        if (progressCallback) {
            progressCallback(100, '完成');
        }
        
        return longCanvas.toDataURL('image/png');
    }

    getPageCount() {
        return this.calculatePages().length;
    }
}

if (typeof window !== 'undefined') {
    window.HandwritingRenderer = HandwritingRenderer;
}
