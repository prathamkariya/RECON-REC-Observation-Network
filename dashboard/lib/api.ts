// Single point of contact with the backend. No component should call
// fetch() directly — go through the functions exported here, so a real
// endpoint name/shape change only has to be fixed in one file.
//
// Real backend endpoints today (see backend/app/routers/certificates.py):
//   GET    /certificates              -> CertificateListItem[]
//   POST   /certificates/analyze      -> CertificateAnalyzeResponse (scoring only, nothing minted)
//   POST   /certificates/issue        -> CertificateIssueResponse (409 on duplicate record)
//   GET    /certificates/{token_id}   -> OnChainCertificate (merges on-chain + DB)
//   POST   /certificates/{token_id}/retire -> CertificateRetireResponse
//   POST   /certificates/{token_id}/transfer -> CertificateTransferResponse (409 if retired)
//
// There's no separate GET /certificates/{id}/verify — the public verify page
// uses the same merged GET /certificates/{token_id}, since that response
// already carries everything "verify" needs (on-chain proof + off-chain
// reasoning). If the backend ever splits that out, only getCertificate below
// needs to change.
import { ApiError } from "@/lib/api-error";
import { mockApi } from "@/lib/mock/data";
import type {
  ApiErrorBody,
  CertificateAnalyzeResponse,
  CertificateIssueRequest,
  CertificateIssueResponse,
  CertificateListItem,
  CertificateRetireResponse,
  CertificateTransferRequest,
  CertificateTransferResponse,
  OnChainCertificate,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError(0, "Couldn't reach the server. Check your connection and try again.");
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      if (body?.detail) detail = body.detail;
    } catch {
      // response wasn't JSON — keep the generic message
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  listCertificates: (): Promise<CertificateListItem[]> =>
    USE_MOCK ? mockApi.listCertificates() : request("/certificates"),

  analyzeCertificate: (payload: CertificateIssueRequest): Promise<CertificateAnalyzeResponse> =>
    USE_MOCK
      ? mockApi.analyzeCertificate(payload)
      : request("/certificates/analyze", { method: "POST", body: JSON.stringify(payload) }),

  issueCertificate: (payload: CertificateIssueRequest): Promise<CertificateIssueResponse> =>
    USE_MOCK
      ? mockApi.issueCertificate(payload)
      : request("/certificates/issue", { method: "POST", body: JSON.stringify(payload) }),

  getCertificate: (tokenId: number): Promise<OnChainCertificate> =>
    USE_MOCK ? mockApi.getCertificate(tokenId) : request(`/certificates/${tokenId}`),

  /** Alias of getCertificate, named for where it's used (the public verify page). */
  verifyCertificate: (tokenId: number): Promise<OnChainCertificate> => api.getCertificate(tokenId),

  retireCertificate: (tokenId: number): Promise<CertificateRetireResponse> =>
    USE_MOCK ? mockApi.retireCertificate(tokenId) : request(`/certificates/${tokenId}/retire`, { method: "POST" }),

  /** Moves the certificate NFT to another wallet. The contract rejects this for
   *  a retired certificate (a consumed REC must not be resold), surfaced as 409. */
  transferCertificate: (tokenId: number, toAddress: string): Promise<CertificateTransferResponse> =>
    USE_MOCK
      ? mockApi.transferCertificate(tokenId, toAddress)
      : request(`/certificates/${tokenId}/transfer`, {
          method: "POST",
          body: JSON.stringify({ to_address: toAddress } satisfies CertificateTransferRequest),
        }),
};
