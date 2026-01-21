/**
 * Factory for creating THREE.js textures for code objects.
 * Handles content textures with syntax highlighting and text sprites for labels.
 */
import * as THREE from 'three';
import { tokenizeLine, SYNTAX_COLORS } from './syntax-highlighter';

/** Wrapped line structure for text layout */
interface WrappedLine {
    lineNum: number;
    text: string;
    isWrap: boolean;
}

/** Configuration for content texture rendering */
const CONTENT_CONFIG = {
    maxLines: 150,
    padding: 12,
    fontSize: 14,
    lineHeight: 14 * 1.4,
    lineNumberWidth: 45,
    canvasWidth: 1024,
    font: '"Consolas", "Monaco", "Courier New", monospace'
} as const;

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
export function createContentTexture(fileContent: string): THREE.Texture {
    const { maxLines, padding, fontSize, lineHeight, lineNumberWidth, canvasWidth, font } = CONTENT_CONFIG;
    const lines = fileContent.split('\n').slice(0, maxLines);
    const codeAreaWidth = canvasWidth - lineNumberWidth - padding * 2;

    // Pre-calculate wrapped lines
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.font = `${fontSize}px ${font}`;

    const wrappedLines = wrapLines(lines, tempCtx, codeAreaWidth);
    const canvasHeight = Math.max(256, Math.min(1024, padding * 2 + wrappedLines.length * lineHeight));

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;

    // Enable better text rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Background
    ctx.fillStyle = SYNTAX_COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Line number background
    ctx.fillStyle = SYNTAX_COLORS.lineNumberBg;
    ctx.fillRect(0, 0, lineNumberWidth, canvas.height);

    ctx.font = `${fontSize}px ${font}`;
    ctx.textBaseline = 'top';

    let y = padding;
    for (const wrappedLine of wrappedLines) {
        if (y + lineHeight > canvasHeight - 40) break;

        // Draw line number or wrap indicator
        ctx.textAlign = 'right';
        if (!wrappedLine.isWrap) {
            ctx.fillStyle = SYNTAX_COLORS.lineNumber;
            ctx.fillText(String(wrappedLine.lineNum), lineNumberWidth - 8, y);
        } else {
            ctx.fillStyle = '#4a4a4a';
            ctx.fillText('↳', lineNumberWidth - 8, y);
        }

        // Draw code with syntax highlighting
        ctx.textAlign = 'left';
        let x = lineNumberWidth + 8;

        const tokens = tokenizeLine(wrappedLine.text);
        for (const token of tokens) {
            ctx.fillStyle = token.color;
            ctx.fillText(token.text, x, y);
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

        ctx.fillStyle = SYNTAX_COLORS.lineNumber;
        ctx.textAlign = 'center';
        ctx.fillText('...', canvasWidth / 2, canvasHeight - 20);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = 4;

    return texture;
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
    deps?: LabelDependencyStats
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

    if (deps) {
        if (deps.hasCircular) {
            statusIcon = '∞'; // Circular (Infinity)
            statusColor = '#ff4444'; // Red
            bgTint = 'rgba(40, 10, 10, 0.95)'; // Slight Red Tint
        } else if (deps.incoming > 5 || deps.outgoing > 5) {
            statusIcon = '⚡'; // Hot (High Voltage)
            statusColor = '#00bfff'; // Cyan
            bgTint = 'rgba(10, 20, 30, 0.95)'; // Slight Cyan Tint
        } else if (deps.outgoing === 0 && deps.incoming > 0) {
            statusIcon = '○'; // Leaf (Circle)
            statusColor = '#7cfc00'; // Lawn Green
            bgTint = 'rgba(15, 25, 15, 0.95)'; // Slight Green Tint
        } else if (deps.incoming === 0 && deps.outgoing > 0) {
            statusIcon = '◈'; // Root (Diamond)
            statusColor = '#ffd700'; // Gold
            bgTint = 'rgba(25, 25, 15, 0.95)'; // Slight Gold Tint
        }
    }

    // Add dependency line if stats exist
    let depsLine = '';
    if (deps && (deps.incoming > 0 || deps.outgoing > 0)) {
        const parts: string[] = [];
        if (deps.outgoing > 0) parts.push(`↓${deps.outgoing}`);
        if (deps.incoming > 0) parts.push(`↑${deps.incoming}`);
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
                if (currentLine) lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
            if (idx === words.length - 1) lines.push(currentLine);
        });
    });

    if (depsLine) lines.push(depsLine);

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
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontSize}px ${font}`;
        } else {
            // Metadata styling
            ctx.fillStyle = '#cccccc';
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
export function createTextSprite(message: string): THREE.Sprite {
    return renderLabel(message);
}

/**
 * Create a text sprite with dependency indicators
 * Shows ↓X (imports X files) and ↑Y (imported by Y files)
 */
export function createTextSpriteWithDeps(
    message: string,
    deps: LabelDependencyStats
): THREE.Sprite {
    return renderLabel(message, deps);
}

