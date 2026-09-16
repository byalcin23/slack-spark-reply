import AppKit
import Foundation

// Original vector artwork. No downloaded assets, fonts, logos, or customer data.
let root = URL(fileURLWithPath: CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : FileManager.default.currentDirectoryPath)
let icons = root.appendingPathComponent("extension/icons")
let assets = root.appendingPathComponent("store/assets")
try FileManager.default.createDirectory(at: icons, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: assets, withIntermediateDirectories: true)

func color(_ hex: UInt32) -> NSColor {
    return NSColor(srgbRed: CGFloat((hex >> 16) & 255) / 255, green: CGFloat((hex >> 8) & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: 1)
}

func sparkle(_ x: CGFloat, _ y: CGFloat, _ radius: CGFloat) {
    let path = NSBezierPath()
    path.move(to: NSPoint(x: x, y: y - radius))
    path.curve(to: NSPoint(x: x + radius, y: y), controlPoint1: NSPoint(x: x + radius * 0.12, y: y - radius * 0.3), controlPoint2: NSPoint(x: x + radius * 0.3, y: y - radius * 0.12))
    path.curve(to: NSPoint(x: x, y: y + radius), controlPoint1: NSPoint(x: x + radius * 0.3, y: y + radius * 0.12), controlPoint2: NSPoint(x: x + radius * 0.12, y: y + radius * 0.3))
    path.curve(to: NSPoint(x: x - radius, y: y), controlPoint1: NSPoint(x: x - radius * 0.12, y: y + radius * 0.3), controlPoint2: NSPoint(x: x - radius * 0.3, y: y + radius * 0.12))
    path.curve(to: NSPoint(x: x, y: y - radius), controlPoint1: NSPoint(x: x - radius * 0.3, y: y - radius * 0.12), controlPoint2: NSPoint(x: x - radius * 0.12, y: y - radius * 0.3))
    path.close()
    path.fill()
}

func mark() {
    let square = NSBezierPath(roundedRect: NSRect(x: 16, y: 16, width: 96, height: 96), xRadius: 27, yRadius: 27)
    NSGradient(starting: color(0x8B73FF), ending: color(0x6242D9))!.draw(in: square, angle: 45)
    NSColor.white.setFill()
    sparkle(62, 60, 26)
    color(0xD8CEFF).setFill()
    sparkle(88, 87, 10)
}

func png(width: Int, height: Int, path: URL, draw: () -> Void) throws {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: width, pixelsHigh: height, bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    NSGraphicsContext.current?.imageInterpolation = .high
    NSColor.clear.setFill()
    NSRect(x: 0, y: 0, width: width, height: height).fill()
    let flip = NSAffineTransform()
    flip.translateX(by: 0, yBy: CGFloat(height))
    flip.scaleX(by: 1, yBy: -1)
    flip.concat()
    draw()
    NSGraphicsContext.restoreGraphicsState()
    try bitmap.representation(using: .png, properties: [:])!.write(to: path)
}

for size in [16, 32, 48, 128, 512] {
    let destination = size == 512 ? assets.appendingPathComponent("icon-512.png") : icons.appendingPathComponent("icon-\(size).png")
    try png(width: size, height: size, path: destination) {
        let scale = NSAffineTransform()
        scale.scale(by: CGFloat(size) / 128)
        scale.concat()
        mark()
    }
}

try png(width: 440, height: 280, path: assets.appendingPathComponent("promo-440x280.png")) {
    NSGradient(starting: color(0x1B1537), ending: color(0x45357B))!.draw(in: NSRect(x: 0, y: 0, width: 440, height: 280), angle: 30)
    color(0x58428D).withAlphaComponent(0.42).setFill()
    NSBezierPath(ovalIn: NSRect(x: 280, y: -90, width: 290, height: 290)).fill()
    NSBezierPath(ovalIn: NSRect(x: -120, y: 170, width: 280, height: 280)).fill()
    NSGraphicsContext.saveGraphicsState()
    let transform = NSAffineTransform()
    transform.translateX(by: 29, yBy: 60)
    transform.scale(by: 1.25)
    transform.concat()
    mark()
    NSGraphicsContext.restoreGraphicsState()
    let widths: [CGFloat] = [180, 150, 170]
    for (index, width) in widths.enumerated() {
        let y = CGFloat(74 + index * 50)
        color(index == 1 ? 0x7D65D9 : 0xF6F3FF).setFill()
        NSBezierPath(roundedRect: NSRect(x: 214, y: y, width: width, height: 38), xRadius: 12, yRadius: 12).fill()
        color(index == 1 ? 0xD7CBFF : 0xADA1C9).setFill()
        NSBezierPath(roundedRect: NSRect(x: 229, y: y + 11, width: width - 52, height: 4), xRadius: 2, yRadius: 2).fill()
        NSBezierPath(roundedRect: NSRect(x: 229, y: y + 22, width: width - 77, height: 4), xRadius: 2, yRadius: 2).fill()
    }
}
print("Generated icons and original 440×280 promotional artwork.")
