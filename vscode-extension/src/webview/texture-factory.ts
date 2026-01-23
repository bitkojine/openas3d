/**
 * Factory for creating THREE.js textures for code objects.
 * Handles content textures with syntax highlighting and text sprites for labels.
 */
import * as THREE from 'three';
import { tokenizeLine, getSyntaxColors } from './syntax-highlighter';
import { ThemeColors, EditorConfig } from '../shared/types';

/**
 * Helper to convert hex to rgba
 */
function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Wrapped line structure for text layout */
export interface WrappedLine {
    lineNum: number;
    text: string;
    isWrap: boolean;
}

/** Configuration for content texture rendering */
export let CONTENT_CONFIG = {
    maxLines: 150,
    padding: 12,
    fontSize: 24,
    lineHeight: 24 * 1.5,
    lineNumberWidth: 55, // Increased for larger font
    canvasWidth: 1024,
    fontFamily: '"Consolas", "Monaco", "Courier New", monospace'
};

/** Update the content configuration from editor settings */
export function updateContentConfig(config: EditorConfig) {
    // We scale up the editor font size for 3D legibility
    const SCALE_FACTOR = 1.75;
    CONTENT_CONFIG.fontSize = Math.round(config.fontSize * SCALE_FACTOR);
    CONTENT_CONFIG.fontFamily = config.fontFamily;

    // Recalculate line height based on new font size
    const baseLineHeight = config.lineHeight > 0 ? config.lineHeight : config.fontSize * 1.5;
    CONTENT_CONFIG.lineHeight = Math.round(baseLineHeight * SCALE_FACTOR);
}

/**
 * Get the current font string
 */
function getFontString(): string {
    return `bold ${CONTENT_CONFIG.fontSize}px ${CONTENT_CONFIG.fontFamily}`;
}

/** Configuration for text sprite rendering */
const SPRITE_CONFIG = {
    canvasWidth: 512,
    padding: 10,
    fontSize: 36,
    lineHeight: 36 * 1.2,
    font: 'Arial'
} as const;

/**
 * Wrap lines of text to fit within available width
 */
function wrapLines(
    lines: string[],
    ctx: CanvasRenderingContext2D,
    availableWidth: number
): WrappedLine[] {
    const wrappedLines: WrappedLine[] = [];
    const breakChars = [' ', ',', '.', ';', ':', '{', '}', '(', ')', '[', ']', '+', '-', '*', '/', '='];

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        if (line.length === 0) {
            wrappedLines.push({ lineNum, text: '', isWrap: false });
            return;
        }

        let remaining = line;
        let isFirstPart = true;

        while (remaining.length > 0) {
            let fitChars = remaining.length;
            const textWidth = ctx.measureText(remaining).width;

            if (textWidth > availableWidth) {
                // Binary search for cutoff point
                let low = 1, high = remaining.length;
                while (low < high) {
                    const mid = Math.ceil((low + high) / 2);
                    if (ctx.measureText(remaining.slice(0, mid)).width <= availableWidth) {
                        low = mid;
                    } else {
                        high = mid - 1;
                    }
                }
                fitChars = low;

                // Try to break at reasonable point
                if (fitChars > 10) {
                    for (let i = fitChars - 1; i > fitChars - 20 && i > 0; i--) {
                        if (breakChars.includes(remaining[i])) {
                            fitChars = i + 1;
                            break;
                        }
                    }
                }
            }

            wrappedLines.push({
                lineNum,
                text: remaining.slice(0, fitChars),
                isWrap: !isFirstPart
            });

            remaining = remaining.slice(fitChars);
            isFirstPart = false;
        }
    });

    return wrappedLines;
}

/**
 * Create a content texture with syntax highlighting and line numbers
 */
/**
 * Create a content texture with syntax highlighting and line numbers
 * Now supports theming to match VSCode editor colors
 */
/**
 * Create a content texture with syntax highlighting and line numbers
 * Now supports theming to match VSCode editor colors
 */
export function createContentTexture(
    fileContent: string,
    theme?: ThemeColors,
    cachedLines?: WrappedLine[],
    meshWidth: number = 1,
    meshHeight: number = 1
): { texture: THREE.Texture; lines: WrappedLine[] } {
    const colors = getSyntaxColors(theme);
    const { maxLines, padding, fontSize, lineHeight, lineNumberWidth, canvasWidth } = CONTENT_CONFIG;
    const font = getFontString();

    // Check if we need to invalidate cache due to config change
    // (This is tricky because cache is passed in from outside. 
    //  Caller needs to know invalidation logic.)

    const lines = fileContent.split('\n').slice(0, maxLines);
    const codeAreaWidth = canvasWidth - lineNumberWidth - padding * 2;

    let wrappedLines = cachedLines;
    if (!wrappedLines) {
        // Pre-calculate wrapped lines (Expensive!)
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.font = font;
        wrappedLines = wrapLines(lines, tempCtx, codeAreaWidth);
    }

    // Dynamic height based on mesh aspect ratio
    // If mesh is 1:1, canvas is square (1024x1024)
    // If mesh is 1:2 (tall), canvas should be 1024x2048 to prevent stretch
    // We base it on width being fixed at 1024.
    const aspectRatio = meshHeight / meshWidth;
    const canvasHeight = Math.round(canvasWidth * aspectRatio);

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // Enable better text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Background
    if (theme) {
        ctx.fillStyle = theme.editorBackground;
    } else {
        ctx.fillStyle = colors.background;
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Line number background - tint slightly from base
    if (theme) {
        // Create a slightly different shade for gutter
        const col = new THREE.Color(theme.editorBackground);
        col.offsetHSL(0, 0, 0.05); // slightly lighter/different
        ctx.fillStyle = '#' + col.getHexString();
    } else {
        ctx.fillStyle = colors.lineNumberBg;
    }
    ctx.fillRect(0, 0, lineNumberWidth, canvas.height);

    ctx.font = font;
    ctx.textBaseline = 'top';

    let y = padding;
    for (const wrappedLine of wrappedLines) {
        if (y + lineHeight > canvasHeight - 40) { break; }

        // Draw line number or wrap indicator
        ctx.textAlign = 'right';
        const lineNumColor = theme ? theme.editorForeground : colors.lineNumber; // Use fg for numbers too? Or dim it?
        // Let's dim the foreground for line numbers if themed
        let finalLineNumColor = lineNumColor;
        if (theme) {
            const c = new THREE.Color(theme.editorForeground);
            c.multiplyScalar(0.6);
            finalLineNumColor = '#' + c.getHexString();
        }

        if (!wrappedLine.isWrap) {
            ctx.fillStyle = finalLineNumColor;
            ctx.fillText(String(wrappedLine.lineNum), lineNumberWidth - 8, y);
        } else {
            ctx.fillStyle = finalLineNumColor;
            ctx.fillText('↳', lineNumberWidth - 8, y);
        }

        // Draw code with syntax highlighting
        ctx.textAlign = 'left';
        let x = lineNumberWidth + 8;

        const tokens = tokenizeLine(wrappedLine.text, theme);
        for (const token of tokens) {
            // Ideally we'd map token types to theme colors, but we lack that data.
            // For now, if we have a theme, we might want to override the default syntax colors 
            // if they look bad on the new background.
            // But syntax colors are usually vibrant.
            // Let's default "plain text" to editorForeground.
            // (Our tokenizer returns colors directly... hard to override without parsing again).
            // We'll trust the tokenizer colors for now, but ensure default text is fixed.

            // If the token color is "default" (usually black/white depending on tokenizer default), we override.
            // But tokenizer returns hardcoded hex.
            // Let's just use the token color as valid. 
            // IMPROVEMENT: If we implement full TextMate theming later, do it here.
            ctx.fillStyle = token.color;
            // Reduce blurring by rounding coordinates
            ctx.fillText(token.text, Math.round(x), Math.round(y));
            x += ctx.measureText(token.text).width;
        }

        y += lineHeight;
    }

    // Truncation indicator
    if (wrappedLines.length * lineHeight > canvasHeight - padding * 2 - 40 || lines.length >= maxLines) {
        const gradient = ctx.createLinearGradient(0, canvasHeight - 40, 0, canvasHeight);
        gradient.addColorStop(0, 'rgba(30, 30, 30, 0)');
        gradient.addColorStop(1, 'rgba(30, 30, 30, 1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvasHeight - 40, canvasWidth, 40);

        ctx.fillStyle = colors.lineNumber;
        ctx.textAlign = 'center';
        ctx.fillText('...', canvasWidth / 2, canvasHeight - 20);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 16;

    return { texture, lines: wrappedLines };
}

/**
 * Create a text sprite for labels above objects
 */
/** Dependency stats for enhanced label display */
export interface LabelDependencyStats {
    incoming: number;
    outgoing: number;
    hasCircular: boolean;
}

/**
 * Draw a rounded rectangle path
 */
function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

/**
 * Common label renderer for unified aesthetic
 */
function renderLabel(
    message: string,
    deps?: LabelDependencyStats,
    theme?: ThemeColors
): THREE.Sprite {
    const { canvasWidth, padding, fontSize, lineHeight, font } = SPRITE_CONFIG;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.font = `${fontSize}px ${font}`;

    // Prepare lines
    const rawLines = message.split('\n');
    const lines: string[] = [];
    const maxTextWidth = canvasWidth - padding * 2;

    // Determine State and Icons
    let statusIcon = '';
    let statusColor = '#444444'; // Default Grey
    let bgTint = 'rgba(15, 15, 20, 0.90)'; // Default Black

    // Apply Theme if available
    if (theme) {
        statusColor = theme.labelBorder; // Use border color as default accent
        bgTint = hexToRgba(theme.labelBackground, 0.90);
    }

    if (deps) {
        if (deps.hasCircular) {
            statusIcon = '∞'; // Circular (Infinity)
            statusColor = '#ff4444'; // Red
            if (theme) { bgTint = hexToRgba('#441111', 0.95); }
            else { bgTint = 'rgba(40, 10, 10, 0.95)'; }
        } else if (deps.incoming > 5 || deps.outgoing > 5) {
            statusIcon = '⚡'; // Hot (High Voltage)
            statusColor = '#00bfff'; // Cyan
            if (theme) { bgTint = hexToRgba('#112233', 0.95); }
            else { bgTint = 'rgba(10, 20, 30, 0.95)'; }
        } else if (deps.outgoing === 0 && deps.incoming > 0) {
            statusIcon = '○'; // Leaf (Circle)
            statusColor = '#7cfc00'; // Lawn Green
            if (theme) { bgTint = hexToRgba('#112211', 0.95); }
            else { bgTint = 'rgba(15, 25, 15, 0.95)'; }
        } else if (deps.incoming === 0 && deps.outgoing > 0) {
            statusIcon = '◈'; // Root (Diamond)
            statusColor = '#ffd700'; // Gold
            if (theme) { bgTint = hexToRgba('#222211', 0.95); }
            else { bgTint = 'rgba(25, 25, 15, 0.95)'; }
        }
    }

    // Add dependency line if stats exist
    let depsLine = '';
    if (deps && (deps.incoming > 0 || deps.outgoing > 0)) {
        const parts: string[] = [];
        if (deps.outgoing > 0) { parts.push(`↓${deps.outgoing}`); }
        if (deps.incoming > 0) { parts.push(`↑${deps.incoming}`); }
        depsLine = parts.join(' ');

        // Add status icon to the stats line
        if (statusIcon) {
            depsLine += ` ${statusIcon}`;
        }
    }

    rawLines.forEach(rawLine => {
        const words = rawLine.split(' ');
        let currentLine = '';
        words.forEach((word, idx) => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            if (tempCtx.measureText(testLine).width > maxTextWidth) {
                if (currentLine) { lines.push(currentLine); }
                currentLine = word;
            } else {
                currentLine = testLine;
            }
            if (idx === words.length - 1) { lines.push(currentLine); }
        });
    });

    if (depsLine) { lines.push(depsLine); }

    const canvasHeight = padding * 2 + lines.length * lineHeight;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // Config
    const cornerRadius = 12;
    const borderWidth = 4;

    // Clear
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw Glass Card Background
    roundRect(ctx, borderWidth / 2, borderWidth / 2, canvasWidth - borderWidth, canvasHeight - borderWidth, cornerRadius);

    // Fill: Tinted Background
    ctx.fillStyle = bgTint;
    ctx.fill();

    // Border
    ctx.lineWidth = borderWidth;
    ctx.strokeStyle = statusColor;
    ctx.stroke();

    // Text Rendering
    ctx.font = `${fontSize}px ${font}`;
    ctx.textBaseline = 'top';

    let y = padding;
    lines.forEach((line, idx) => {
        const isDepLine = depsLine && idx === lines.length - 1;

        if (isDepLine) {
            // Stats line styling - matches status color
            ctx.fillStyle = statusColor === '#444444' ? '#cccccc' : statusColor;
            ctx.font = `bold ${fontSize}px ${font}`;
        } else if (idx === 0 && line.startsWith('Filename:')) {
            // Title styling
            ctx.fillStyle = theme ? theme.labelColor : '#ffffff';
            ctx.font = `bold ${fontSize}px ${font}`;
        } else {
            // Metadata styling
            // High contrast check
            let labelColor = theme ? theme.labelColor : '#cccccc';
            if (theme) {
                const bg = new THREE.Color(theme.labelBackground);
                const bgL = bg.getHSL({ h: 0, s: 0, l: 0 }).l;
                // If background is light (>0.5), force black text
                if (bgL > 0.6) {
                    labelColor = '#000000';
                }
            }
            ctx.fillStyle = labelColor;
            ctx.font = `${fontSize}px ${font}`;
        }

        ctx.fillText(line, padding + borderWidth, y);
        y += lineHeight;
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);

    sprite.userData.width = canvasWidth / 200;
    sprite.userData.height = canvasHeight / 200;
    sprite.scale.set(sprite.userData.width, sprite.userData.height, 1);

    return sprite;
}

/**
 * Create a text sprite for labels above objects
 */
export function createTextSprite(message: string, theme?: ThemeColors): THREE.Sprite {
    return renderLabel(message, undefined, theme);
}

/**
 * Create a text sprite with dependency indicators
 * Shows ↓X (imports X files) and ↑Y (imported by Y files)
 */
export function createTextSpriteWithDeps(
    message: string,
    deps: LabelDependencyStats,
    theme?: ThemeColors
): THREE.Sprite {
    return renderLabel(message, deps, theme);
}

