import SwiftUI
import XRSharp

@main
struct XRSharpCalculatorApp: App {
    var body: some Scene {
        ImmersiveSpace(id: "ImmersiveSpace") {
            XRSharpView(xrSharpAppDir: "Calculator")
        }
    }
}
