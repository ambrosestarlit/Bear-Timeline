// ========================================
// utils/drawing.js - 描画ヘルパー関数
// ========================================

class DrawingUtils {
    // 角丸矩形を描画
    static roundRect(ctx, x, y, width, height, radius) {
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
    
    // グラデーションを作成
    static createLinearGradient(ctx, x0, y0, x1, y1, colorStops) {
        const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
        for (const stop of colorStops) {
            gradient.addColorStop(stop.offset, stop.color);
        }
        return gradient;
    }
    
    // 破線を描画
    static dashedLine(ctx, x1, y1, x2, y2, dashArray = [5, 5]) {
        ctx.setLineDash(dashArray);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // テキストを中央揃えで描画
    static drawCenteredText(ctx, text, x, y, fontSize = 12, color = 'white') {
        ctx.save();
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
        ctx.restore();
    }
    
    // 影付きテキストを描画
    static drawShadowText(ctx, text, x, y, fontSize = 12, color = 'white', shadowColor = 'black') {
        ctx.save();
        ctx.font = `${fontSize}px sans-serif`;
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        ctx.restore();
    }
    
    // 画像をフィットさせて描画
    static drawImageFit(ctx, img, x, y, width, height, cover = false) {
        const imgAspect = img.width / img.height;
        const areaAspect = width / height;
        
        let drawWidth, drawHeight, drawX, drawY;
        
        if (cover) {
            // cover: エリアを完全に覆う
            if (imgAspect > areaAspect) {
                drawHeight = height;
                drawWidth = height * imgAspect;
                drawX = x - (drawWidth - width) / 2;
                drawY = y;
            } else {
                drawWidth = width;
                drawHeight = width / imgAspect;
                drawX = x;
                drawY = y - (drawHeight - height) / 2;
            }
        } else {
            // contain: エリア内に収める
            if (imgAspect > areaAspect) {
                drawWidth = width;
                drawHeight = width / imgAspect;
                drawX = x;
                drawY = y + (height - drawHeight) / 2;
            } else {
                drawHeight = height;
                drawWidth = height * imgAspect;
                drawX = x + (width - drawWidth) / 2;
                drawY = y;
            }
        }
        
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
    }
    
    // 色を16進数からRGBAに変換
    static hexToRgba(hex, alpha = 1) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    // RGBAから16進数に変換
    static rgbaToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
}
