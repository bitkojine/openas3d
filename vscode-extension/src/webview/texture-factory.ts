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
export function createTextSprite(message: string): THREE.Sprite {
    const { canvasWidth, padding, fontSize, lineHeight, font } = SPRITE_CONFIG;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.font = `${fontSize}px ${font}`;

    const rawLines = message.split('\n');
    const lines: string[] = [];
    const maxTextWidth = canvasWidth - padding * 2;

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

    const canvasHeight = padding * 2 + lines.length * lineHeight;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `${fontSize}px ${font}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    let y = padding;
    lines.forEach(line => {
        ctx.fillStyle = 'white';
        ctx.fillText(line, padding, y);
        y += lineHeight;
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: false });
    const sprite = new THREE.Sprite(spriteMaterial);

    sprite.userData.width = canvasWidth / 200;
    sprite.userData.height = canvasHeight / 200;
    sprite.scale.set(sprite.userData.width, sprite.userData.height, 1);

    return sprite;
}
