import { makeZip } from '../../utils/zip';

// Entrega o agente local num .zip. Se o app estiver hospedado, os scripts já saem
// configurados para aceitar este endereço (JOBFINDER_ORIGENS).
// Os arquivos vêm de agente-local/, embutidos no servidor no build (nitro.serverAssets).
export default defineEventHandler(async (event) => {
  const assets = useStorage('assets:agente');
  const read = async (f: string) => {
    const v = await assets.getItem(f);
    if (v == null) throw createError({ statusCode: 500, message: `Arquivo do agente ausente: ${f}` });
    return typeof v === 'string' ? v : Buffer.isBuffer(v) ? v.toString('utf8') : String(v);
  };
  const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin;
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

  let bat = await read('iniciar.bat');
  let sh = await read('iniciar.sh');
  if (!isLocal) {
    bat = bat.replace('title Agente do JobFinder', `title Agente do JobFinder\r\nset JOBFINDER_ORIGENS=${origin}`);
    sh = sh.replace('cd "$(dirname "$0")" || exit 1', `cd "$(dirname "$0")" || exit 1\nexport JOBFINDER_ORIGENS="${origin}"`);
  }

  const zip = makeZip([
    { name: 'agente-jobfinder/agente.py', data: await read('agente.py') },
    { name: 'agente-jobfinder/requirements.txt', data: await read('requirements.txt') },
    { name: 'agente-jobfinder/iniciar.bat', data: bat },
    { name: 'agente-jobfinder/iniciar.sh', data: sh },
    { name: 'agente-jobfinder/LEIAME.md', data: await read('LEIAME.md') },
  ]);
  setResponseHeaders(event, {
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="agente-jobfinder.zip"',
  });
  return zip;
});
