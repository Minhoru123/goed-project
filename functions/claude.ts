import claude from '../api/claude';
import { createNetlifyHandler } from './_shared/bridge';

export const handler = createNetlifyHandler(claude);
