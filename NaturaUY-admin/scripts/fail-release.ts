import { adminClient, required } from './shared';
const client = adminClient(); const releaseId = required('CATALOG_RELEASE_ID'); const message = process.env.FAILURE_MESSAGE ?? 'GitHub Actions catalog build failed';
await client.from('catalog_releases').update({ status: 'failed', error: message }).eq('id', releaseId); console.log(`Marked release ${releaseId} as failed.`);
