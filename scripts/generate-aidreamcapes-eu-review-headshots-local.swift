// Local utility for preparing identity-preserving review headshots from the
// approved synthetic avatar source images. It removes the scene background but
// keeps the person, so the headshot and the themed result remain recognizably
// the same reviewer without reusing the same image.

import AppKit
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import UniformTypeIdentifiers
import Vision

guard CommandLine.arguments.count == 3 else {
    fputs("usage: generate-aidreamcapes-eu-review-headshots-local input output\n", stderr)
    exit(2)
}

let inputURL = URL(fileURLWithPath: CommandLine.arguments[1])
let outputURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(inputURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fputs("could not read input image\n", stderr)
    exit(1)
}

let request = VNGeneratePersonSegmentationRequest()
request.qualityLevel = .balanced
request.outputPixelFormat = kCVPixelFormatType_OneComponent8
let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
    try handler.perform([request])
} catch {
    fputs("segmentation failed: \(error)\n", stderr)
    exit(1)
}

guard let observation = request.results?.first else {
    fputs("no person mask returned\n", stderr)
    exit(1)
}

let context = CIContext(options: [.workingColorSpace: NSNull()])
let foreground = CIImage(cgImage: image)
let mask = CIImage(cvPixelBuffer: observation.pixelBuffer)
let scaleX = CGFloat(image.width) / mask.extent.width
let scaleY = CGFloat(image.height) / mask.extent.height
let scaledMask = mask.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))
let backgroundColor = CIImage(color: CIColor(red: 0.91, green: 0.88, blue: 0.83, alpha: 1))
    .cropped(to: foreground.extent)
let blend = CIFilter.blendWithMask()
blend.inputImage = foreground
blend.backgroundImage = backgroundColor
blend.maskImage = scaledMask
guard let output = blend.outputImage?.cropped(to: foreground.extent) else {
    fputs("could not compose avatar\n", stderr)
    exit(1)
}

guard let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil) else {
    fputs("could not create output\n", stderr)
    exit(1)
}
guard let rendered = context.createCGImage(output, from: output.extent) else {
    fputs("could not render output\n", stderr)
    exit(1)
}
CGImageDestinationAddImage(destination, rendered, nil)
guard CGImageDestinationFinalize(destination) else {
    fputs("could not finalize output\n", stderr)
    exit(1)
}
