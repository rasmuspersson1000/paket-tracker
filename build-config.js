import { writeFileSync } from 'fs';

const config = `export const CONFIG = {
  google: { clientId: '${process.env.GOOGLE_CLIENT_ID ?? ''}' },
  microsoft: { clientId: '${process.env.MICROSOFT_CLIENT_ID ?? ''}', tenantId: 'common' },
  postnord: { apiKey: '${process.env.POSTNORD_API_KEY ?? ''}' },
  dhl: { apiKey: '${process.env.DHL_API_KEY ?? ''}' },
};
`;

writeFileSync('config.js', config);
console.log('config.js generated');
