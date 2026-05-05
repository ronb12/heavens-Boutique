import handler from '../../../lib/admin/routes/customersIndex.js';
import { withCorsContext } from '../../../lib/http.js';
export default withCorsContext(handler);
