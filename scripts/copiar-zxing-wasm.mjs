// Copia o WebAssembly do leitor de QR (zxing-wasm) para public/zxing/, para o
// site servir o arquivo pela própria origem. Sem isso, a biblioteca baixa o
// .wasm de um CDN externo (fastly.jsdelivr.net), o que a Content-Security-Policy
// bloqueia e que também deixaria o check-in dependente de um terceiro.
// Roda no postinstall: a cópia acompanha sempre a versão instalada.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origem = join(raiz, "node_modules", "zxing-wasm", "dist", "reader", "zxing_reader.wasm");
const destino = join(raiz, "public", "zxing", "zxing_reader.wasm");

if (!existsSync(origem)) {
  console.warn("[zxing] zxing_reader.wasm não encontrado em node_modules; pulando a cópia.");
  process.exit(0);
}

mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origem, destino);
console.log("[zxing] WebAssembly copiado para public/zxing/zxing_reader.wasm");
