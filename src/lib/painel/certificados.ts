/** Quantas atividades ainda não terminaram (o banco só libera certificados com 0). */
export function atividadesPendentes(atividades: { fim: string }[], agora: Date = new Date()) {
  return atividades.filter((a) => new Date(a.fim).getTime() > agora.getTime()).length;
}

export type CertificadoPainel = {
  id: string;
  codigo: string;
  tipo: string;
  nome: string;
  carga_horaria_minutos: number;
  revogado_em: string | null;
  revogado_motivo: string | null;
};

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Busca por nome (sem acento) ou código (sem hífens/maiúsculas). */
export function filtrarCertificados(lista: CertificadoPainel[], busca: string) {
  const termo = normalizar(busca.trim());
  if (!termo) return lista;
  const codigo = termo.replace(/[^a-z0-9]/g, "");
  return lista.filter(
    (c) =>
      normalizar(c.nome).includes(termo) ||
      (codigo !== "" && c.codigo.toLowerCase().replace(/-/g, "").includes(codigo)),
  );
}

/** Move o item `de` para a posição `para` (reordenar assinaturas). */
export function moverItem<T>(lista: T[], de: number, para: number) {
  if (para < 0 || para >= lista.length || de === para) return lista;
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}
