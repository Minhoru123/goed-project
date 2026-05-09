import resources from '../api/resources';
import { createNetlifyHandler } from './_shared/bridge';

export const handler = createNetlifyHandler(resources);
