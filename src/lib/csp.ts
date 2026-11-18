// Content-Security-Policy do site. Montada a cada requisição no proxy, com um
// nonce novo: o Next.js aplica esse nonce sozinho aos próprios scripts
// (docs: 02-guides/content-security-policy.md).
//
// Escolhas:
//   * script-src com nonce + 'strict-dynamic': só roda script que o próprio
//     Next.js entregou. 'wasm-unsafe-eval' é para o WebAssembly do leitor de QR
//     (servido de /zxing/, nunca de CDN). 'unsafe-eval' só no desenvolvimento.
//   * style-src com 'unsafe-inline' e SEM nonce: um nonce aqui desligaria o
//     'unsafe-inline' e bloquearia os style="" que os componentes geram.
//   * connect-src libera só o Supabase (login, banco, upload de PDF).
//   * upgrade-insecure-requests só quando o site roda em https; em
//     http://localhost ele quebraria todas as requisições.

export type OpcoesCsp = {
  nonce: string;
  supabaseUrl: string | undefined;
  siteUrl: string | undefined;
  desenvolvimento: boolean;
};

function origemDe(url: string | undefined) {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function montarCsp({ nonce, supabaseUrl, siteUrl, desenvolvimento }: OpcoesCsp) {
  const supabase = origemDe(supabaseUrl);
  const diretivas: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(desenvolvimento ? ["'unsafe-eval'"] : []),
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(supabase ? [supabase] : []), ...(desenvolvimento ? ["ws:"] : [])],
    // data: = o "bip" do leitor de QR ao ler um código (áudio embutido na biblioteca).
    "media-src": ["'self'", "data:", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const partes = Object.entries(diretivas).map(([nome, valores]) => `${nome} ${valores.join(" ")}`);
  if (siteUrl?.startsWith("https://")) partes.push("upgrade-insecure-requests");
  return partes.join("; ");
}

/** Nonce de 128 bits em base64, novo a cada requisição. */
export function gerarNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}
