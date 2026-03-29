import SwiftUI
import AuthenticationServices
import CryptoKit

/// Sign in with Apple → `POST /auth/apple` with identity token and nonce.
struct HBSignInWithAppleRow: View {
    @EnvironmentObject private var session: SessionViewModel
    @EnvironmentObject private var api: APIClient

    @Binding var isLoading: Bool
    @Binding var error: String?

    @State private var rawNonce: String?

    var body: some View {
        SignInWithAppleButton(.signIn) { request in
            let nonce = Self.makeRawNonce()
            rawNonce = nonce
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256Hex(nonce)
        } onCompletion: { result in
            switch result {
            case .success(let authorization):
                guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                      let tokenData = credential.identityToken,
                      let tokenString = String(data: tokenData, encoding: .utf8) else {
                    error = "Could not read Sign in with Apple response."
                    return
                }
                Task { await completeSignIn(token: tokenString, credential: credential) }
            case .failure(let err):
                if let authErr = err as? ASAuthorizationError, authErr.code == .canceled {
                    return
                }
                error = err.localizedDescription
            }
        }
        .signInWithAppleButtonStyle(.black)
        .frame(height: 50)
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .disabled(isLoading)
    }

    private func completeSignIn(token: String, credential: ASAuthorizationAppleIDCredential) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        var body: [String: Any] = ["identityToken": token]
        if let n = rawNonce { body["nonce"] = n }

        let name = credential.fullName
        var parts: [String] = []
        if let g = name?.givenName { parts.append(g) }
        if let f = name?.familyName { parts.append(f) }
        if !parts.isEmpty { body["fullName"] = parts.joined(separator: " ") }

        do {
            let r: AuthResponse = try await api.request("/auth/apple", method: "POST", jsonBody: body)
            session.applyAuth(r)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private static func makeRawNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
        return String((0..<length).map { _ in charset.randomElement()! })
    }

    private static func sha256Hex(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.map { String(format: "%02x", $0) }.joined()
    }
}

struct HBAuthOrDivider: View {
    var body: some View {
        HStack(spacing: 12) {
            Rectangle()
                .fill(HBColors.mutedGray.opacity(0.25))
                .frame(height: 1)
            Text("or")
                .font(HBFont.caption().weight(.medium))
                .foregroundStyle(HBColors.mutedGray)
            Rectangle()
                .fill(HBColors.mutedGray.opacity(0.25))
                .frame(height: 1)
        }
        .padding(.vertical, 4)
    }
}
