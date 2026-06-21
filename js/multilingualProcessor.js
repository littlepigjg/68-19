const MultilingualProcessor = {
    languageRanges: {
        chinese: [
            [0x4e00, 0x9fff],
            [0x3400, 0x4dbf],
            [0x20000, 0x2a6df],
            [0xf900, 0xfaff],
            [0x2f800, 0x2fa1f],
            [0x3000, 0x303f],
            [0xff00, 0xffef]
        ],
        japanese: [
            [0x3040, 0x309f],
            [0x30a0, 0x30ff],
            [0x31f0, 0x31ff],
            [0x4e00, 0x9fff],
            [0x3400, 0x4dbf]
        ],
        english: [
            [0x0041, 0x005a],
            [0x0061, 0x007a],
            [0x00c0, 0x024f]
        ],
        number: [
            [0x0030, 0x0039],
            [0xff10, 0xff19]
        ],
        punctuation: [
            [0x2000, 0x206f],
            [0x2e00, 0x2e7f],
            [0x0020, 0x002f],
            [0x003a, 0x0040],
            [0x005b, 0x0060],
            [0x007b, 0x007e]
        ]
    },

    detectCharLanguage(char) {
        if (!char || char.length === 0) return 'other';
        
        const code = char.codePointAt(0);
        
        if (this.isChinese(code)) return 'chinese';
        if (this.isHiraganaOrKatakana(code)) return 'japanese';
        if (this.isEnglish(code)) return 'english';
        if (this.isNumber(code)) return 'number';
        if (this.isPunctuation(code)) return 'punctuation';
        
        return 'other';
    },

    isChinese(code) {
        return this.languageRanges.chinese.some(([start, end]) => code >= start && code <= end);
    },

    isHiraganaOrKatakana(code) {
        return (code >= 0x3040 && code <= 0x309f) || 
               (code >= 0x30a0 && code <= 0x30ff) ||
               (code >= 0x31f0 && code <= 0x31ff);
    },

    isEnglish(code) {
        return this.languageRanges.english.some(([start, end]) => code >= start && code <= end);
    },

    isNumber(code) {
        return this.languageRanges.number.some(([start, end]) => code >= start && code <= end);
    },

    isPunctuation(code) {
        return this.languageRanges.punctuation.some(([start, end]) => code >= start && code <= end);
    },

    segmentText(text) {
        if (!text || text.length === 0) return [];
        
        const segments = [];
        let currentSegment = {
            text: '',
            language: null,
            startIndex: 0
        };

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const lang = this.detectCharLanguage(char);
            
            if (char === '\n') {
                if (currentSegment.text.length > 0) {
                    segments.push({ ...currentSegment, endIndex: i - 1 });
                }
                segments.push({
                    text: '\n',
                    language: 'newline',
                    startIndex: i,
                    endIndex: i
                });
                currentSegment = {
                    text: '',
                    language: null,
                    startIndex: i + 1
                };
                continue;
            }
            
            const effectiveLang = this.getEffectiveLanguage(lang, currentSegment.language);
            
            if (currentSegment.language === null) {
                currentSegment.text = char;
                currentSegment.language = effectiveLang;
                currentSegment.startIndex = i;
            } else if (effectiveLang === currentSegment.language || 
                       this.canMergeLanguages(effectiveLang, currentSegment.language)) {
                currentSegment.text += char;
            } else {
                if (currentSegment.text.length > 0) {
                    segments.push({ ...currentSegment, endIndex: i - 1 });
                }
                currentSegment = {
                    text: char,
                    language: effectiveLang,
                    startIndex: i
                };
            }
        }
        
        if (currentSegment.text.length > 0) {
            currentSegment.endIndex = text.length - 1;
            segments.push(currentSegment);
        }
        
        return segments;
    },

    getEffectiveLanguage(lang, currentLang) {
        if (lang === 'punctuation' || lang === 'number') {
            if (currentLang === 'chinese' || currentLang === 'japanese') {
                return currentLang;
            }
            if (currentLang === 'english') {
                return 'english';
            }
        }
        return lang;
    },

    canMergeLanguages(lang1, lang2) {
        const mergeableGroups = [
            ['chinese', 'japanese'],
            ['english', 'number']
        ];
        
        return mergeableGroups.some(group => 
            group.includes(lang1) && group.includes(lang2)
        );
    },

    getFontConfig(language, styleName = 'kaishu') {
        const fontConfigs = {
            kaishu: {
                chinese: {
                    fontFamily: '"ZCOOL XiaoWei", "KaiTi", "STKaiti", "楷体", serif',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                },
                japanese: {
                    fontFamily: '"Noto Serif JP", "KaiTi", "STKaiti", serif',
                    fontSizeScale: 0.95,
                    baselineOffset: 0.05,
                    weight: 'normal'
                },
                english: {
                    fontFamily: '"Georgia", "Times New Roman", "KaiTi", serif',
                    fontSizeScale: 0.85,
                    baselineOffset: 0.12,
                    weight: 'normal'
                },
                other: {
                    fontFamily: '"KaiTi", "STKaiti", serif',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                }
            },
            xingshu: {
                chinese: {
                    fontFamily: '"Ma Shan Zheng", "STXingkai", "华文行楷", "KaiTi", cursive',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                },
                japanese: {
                    fontFamily: '"Noto Serif JP", "Ma Shan Zheng", cursive',
                    fontSizeScale: 0.95,
                    baselineOffset: 0.03,
                    weight: 'normal'
                },
                english: {
                    fontFamily: '"Dancing Script", "Brush Script MT", cursive',
                    fontSizeScale: 0.9,
                    baselineOffset: 0.15,
                    weight: 'normal'
                },
                other: {
                    fontFamily: '"Ma Shan Zheng", "STXingkai", cursive',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                }
            },
            caoshu: {
                chinese: {
                    fontFamily: '"Long Cang", "Liu Jian Mao Cao", "STCaiyun", "华文彩云", cursive',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                },
                japanese: {
                    fontFamily: '"Noto Serif JP", "Long Cang", cursive',
                    fontSizeScale: 0.95,
                    baselineOffset: 0.02,
                    weight: 'normal'
                },
                english: {
                    fontFamily: '"Dancing Script", "Brush Script MT", cursive',
                    fontSizeScale: 0.88,
                    baselineOffset: 0.18,
                    weight: 'normal'
                },
                other: {
                    fontFamily: '"Long Cang", "STCaiyun", cursive',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                }
            },
            shoujie: {
                chinese: {
                    fontFamily: '"Noto Serif SC", "STShouti", "华文宋体", "SimSun", serif',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: '300'
                },
                japanese: {
                    fontFamily: '"Noto Serif JP", "Noto Serif SC", serif',
                    fontSizeScale: 0.95,
                    baselineOffset: 0.04,
                    weight: '300'
                },
                english: {
                    fontFamily: '"Noto Serif", "Georgia", "Times New Roman", serif',
                    fontSizeScale: 0.85,
                    baselineOffset: 0.1,
                    weight: '300'
                },
                other: {
                    fontFamily: '"Noto Serif SC", "SimSun", serif',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: '300'
                }
            },
            custom: {
                chinese: {
                    fontFamily: 'serif',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                },
                japanese: {
                    fontFamily: 'serif',
                    fontSizeScale: 0.95,
                    baselineOffset: 0.05,
                    weight: 'normal'
                },
                english: {
                    fontFamily: 'serif',
                    fontSizeScale: 0.85,
                    baselineOffset: 0.12,
                    weight: 'normal'
                },
                other: {
                    fontFamily: 'serif',
                    fontSizeScale: 1.0,
                    baselineOffset: 0,
                    weight: 'normal'
                }
            }
        };

        const styleConfig = fontConfigs[styleName] || fontConfigs.kaishu;
        return styleConfig[language] || styleConfig.other;
    },

    measureSegment(ctx, segment, baseFontSize, charSpacing, styleName) {
        const fontConfig = this.getFontConfig(segment.language, styleName);
        const fontSize = baseFontSize * fontConfig.fontSizeScale;
        
        ctx.font = `${fontConfig.weight} ${fontSize}px ${fontConfig.fontFamily}`;
        ctx.textBaseline = 'alphabetic';
        
        const metrics = ctx.measureText(segment.text);
        const width = metrics.width + charSpacing * segment.text.length;
        
        const actualBoundingBoxAscent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
        const actualBoundingBoxDescent = metrics.actualBoundingBoxDescent || fontSize * 0.2;
        
        return {
            width,
            fontSize,
            ascent: actualBoundingBoxAscent,
            descent: actualBoundingBoxDescent,
            height: actualBoundingBoxAscent + actualBoundingBoxDescent,
            baselineOffset: fontConfig.baselineOffset * baseFontSize,
            fontFamily: fontConfig.fontFamily,
            weight: fontConfig.weight
        };
    },

    calculateLineMetrics(segments, baseFontSize, charSpacing, styleName, ctx) {
        let maxAscent = 0;
        let maxDescent = 0;
        let totalWidth = 0;
        const segmentMetrics = [];

        for (const segment of segments) {
            if (segment.language === 'newline') continue;
            
            const metrics = this.measureSegment(ctx, segment, baseFontSize, charSpacing, styleName);
            segmentMetrics.push({
                segment,
                metrics
            });
            
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
            segmentMetrics
        };
    },

    getBaselineAdjustment(segmentMetrics, lineMaxAscent) {
        const effectiveAscent = segmentMetrics.metrics.ascent - segmentMetrics.metrics.baselineOffset;
        return lineMaxAscent - effectiveAscent;
    },

    loadMultilingualFonts() {
        const fontLinks = [
            {
                family: 'Noto Serif JP',
                url: 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400&display=swap'
            },
            {
                family: 'Noto Serif',
                url: 'https://fonts.googleapis.com/css2?family=Noto+Serif:wght@300;400&display=swap'
            },
            {
                family: 'Dancing Script',
                url: 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&display=swap'
            }
        ];

        const promises = fontLinks.map(fontInfo => {
            return new Promise((resolve) => {
                const existingLink = document.querySelector(`link[href*="${encodeURIComponent(fontInfo.family)}"]`);
                if (existingLink) {
                    resolve(true);
                    return;
                }

                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = fontInfo.url;
                link.onload = () => {
                    if (document.fonts && document.fonts.load) {
                        document.fonts.load(`16px "${fontInfo.family}"`)
                            .then(() => resolve(true))
                            .catch(() => resolve(false));
                    } else {
                        setTimeout(() => resolve(true), 500);
                    }
                };
                link.onerror = () => resolve(false);
                document.head.appendChild(link);
            });
        });

        return Promise.all(promises);
    }
};

if (typeof window !== 'undefined') {
    window.MultilingualProcessor = MultilingualProcessor;
}
