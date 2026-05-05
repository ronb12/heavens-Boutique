import handler from '../../../lib/admin/routes/customersById.js';
import { withCorsContext } from '../../../lib/http.js';
export default withCorsContext(handler);
