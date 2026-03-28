import Foundation

enum APIError: LocalizedError {
    case invalidURL
    case status(Int, String?)
    case decoding(Error)
    case network(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case let .status(code, msg): return msg ?? "HTTP \(code)"
        case .decoding(let e): return e.localizedDescription
        case .network(let e): return e.localizedDescription
        }
    }
}

@MainActor
final class APIClient: ObservableObject {
    private let session: URLSession
    private var token: String?

    init(session: URLSession = .shared) {
        self.session = session
        self.token = KeychainStore.readToken()
    }

    func setToken(_ t: String?) {
        token = t
        if let t { KeychainStore.save(token: t) } else { KeychainStore.clear() }
    }

    func currentToken() -> String? { token }

    private func makeRequest(path: String, method: String, body: Data? = nil) throws -> URLRequest {
        let base = Config.apiBaseURL.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        guard let url = URL(string: "\(base)\(path)") else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token {
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        req.httpBody = body
        return req
    }

    func request<T: Decodable>(_ path: String, method: String = "GET", jsonBody: [String: Any]? = nil) async throws -> T {
        let data: Data? = try jsonBody.map { try JSONSerialization.data(withJSONObject: $0) }
        let req = try makeRequest(path: path, method: method, body: data)
        do {
            let (respData, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else { throw APIError.status(-1, nil) }
            if http.statusCode >= 400 {
                let msg = (try? JSONDecoder().decode(APIErrorBody.self, from: respData))?.error
                throw APIError.status(http.statusCode, msg)
            }
            let decoder = JSONDecoder()
            do {
                return try decoder.decode(T.self, from: respData)
            } catch {
                throw APIError.decoding(error)
            }
        } catch let e as APIError {
            throw e
        } catch {
            throw APIError.network(error)
        }
    }

    func requestVoid(_ path: String, method: String = "POST", jsonBody: [String: Any]? = nil) async throws {
        let data: Data? = try jsonBody.map { try JSONSerialization.data(withJSONObject: $0) }
        let req = try makeRequest(path: path, method: method, body: data)
        let (respData, resp) = try await session.data(for: req)
        guard let http = resp as? HTTPURLResponse else { throw APIError.status(-1, nil) }
        if http.statusCode >= 400 {
            let msg = (try? JSONDecoder().decode(APIErrorBody.self, from: respData))?.error
            throw APIError.status(http.statusCode, msg)
        }
    }
}
