import handler from '../../../lib/admin/routes/ordersPost.js';
import { withCorsContext } from '../../../lib/http.js';
export default withCorsContext(handler);
