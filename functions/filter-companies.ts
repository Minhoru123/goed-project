import filterCompanies from '../api/filter-companies';
import { createNetlifyHandler } from './_shared/bridge';

export const handler = createNetlifyHandler(filterCompanies);
